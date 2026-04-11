// js/core/CharacterSheet.js
import { StorageService } from '../services/StorageService.js';
import { ApiService } from '../services/ApiService.js';
import { EventBus } from './EventBus.js';
import { Helpers } from '../utils/Helpers.js';

// Managers
import { AttributeManager } from '../modules/attributes/AttributeManager.js';
import { AttributeUI } from '../modules/attributes/AttributeUI.js';
import { HealthManager } from '../modules/combat/HealthManager.js';
import { ManaManager } from '../modules/combat/ManaManager.js';
import { DeathSavesManager } from '../modules/combat/DeathSavesManager.js';
import { SkillsManager } from '../modules/skills/SkillsManager.js';
import { ProficiencyManager } from '../modules/skills/ProficiencyManager.js';
import { SavingThrowsManager } from '../modules/skills/SavingThrowsManager.js';
import { ExpManager } from '../modules/experience/ExpManager.js';
import { ColorManager } from '../modules/ui/ColorManager.js';
import { DragDropManager } from '../modules/ui/DragDropManager.js';
import { ResizeManager } from '../modules/ui/ResizeManager.js';
import { ImageManager } from '../modules/ui/ImageManager.js';
import { UserManager } from './UserManager.js';

// Inventory Managers
import { CurrencyManager } from '../modules/inventory/CurrencyManager.js';
import { TreasureManager } from '../modules/inventory/TreasureManager.js';
import { PotionManager } from '../modules/inventory/PotionManager.js';
import { EquipmentManager } from '../modules/inventory/EquipmentManager.js';

// Spell Managers
import { SpellSlotsManager } from '../modules/spells/SpellSlotsManager.js';
import { SpellManager } from '../modules/spells/SpellManager.js';
import { SpellUI } from '../modules/spells/SpellUI.js';
import { SpellStatsManager } from '../modules/spells/SpellStatsManager.js'; // <-- IMPORTAR

export class CharacterSheet {
    constructor() {
        // Core services
        this.eventBus = new EventBus();
        this.storage = new StorageService('dnd_');
        this.api = new ApiService();
        this.userManager = new UserManager(this.storage); 
        
        // Usar WebSocket global
        this.ws = null;
        this.waitForWebSocket();
        
        // Initialize all managers
        this.initManagers();
        
        // Setup UI bindings
        this.initUI();

        setTimeout(() => {
    this.createAIImportButton();
    }, 500);
        
        // Setup global events
        this.setupGlobalEvents();

        this.setupAutoSave();

        this.setupCombatStatsAutoSave();

        this.setupTraitsAutoSave();

        this.passivePerception = 10;

        this.ensureUserIsSet();

        const savedName = localStorage.getItem('jugadorNombre');
        if (savedName === 'Aventurero' || savedName === 'Anónimo' || !savedName) {
            localStorage.removeItem('jugadorNombre');
        }
    }

    waitForWebSocket() {
        if (window.wsClient) {
            this.ws = window.wsClient;
            this.setupWebSocketListeners();
            
            if (this.ws.isConectado()) {
                this.syncCharacterWithWebSocket();
            }
            return;
        }
        
        const checkInterval = setInterval(() => {
            if (window.wsClient) {
                this.ws = window.wsClient;
                this.setupWebSocketListeners();
                
                if (this.ws.isConectado()) {
                    this.syncCharacterWithWebSocket();
                }
                clearInterval(checkInterval);
            }
        }, 100);
        
        setTimeout(() => clearInterval(checkInterval), 5000);
    }


async analyzePDFWithAI(pdfFile) {
    if (!pdfFile || pdfFile.type !== 'application/pdf') {
        Helpers.showMessage('Por favor, selecciona un archivo PDF válido', 'error');
        return null;
    }

    console.log('📄 Iniciando análisis de PDF:', pdfFile.name);

    // Verificar conexión con Groq
    try {
        const statusResponse = await fetch('/api/ai/status');
        if (!statusResponse.ok) {
            throw new Error(`HTTP ${statusResponse.status}`);
        }
        const status = await statusResponse.json();
        
        if (!status.available) {
            Helpers.showMessage('IA no disponible. Verifica tu conexión con Groq.', 'error');
            return null;
        }
        console.log('✅ IA disponible, modelo:', status.model);
    } catch (error) {
        console.error('Error verificando IA:', error);
        Helpers.showMessage('Error de conexión con el servidor de IA. ¿Está el servidor corriendo?', 'error');
        return null;
    }

    // Mostrar indicador de carga
    const loadingDiv = this.showLoadingIndicator('Analizando PDF...');
    console.log('Mostrando indicador de carga');

    try {
        // Crear FormData para enviar el PDF
        const formData = new FormData();
        formData.append('pdf', pdfFile);
        
        console.log('Enviando PDF al servidor...');
        
        // Llamar al endpoint de análisis de PDF
        const response = await fetch('/api/ai/analyze-pdf', {
            method: 'POST',
            body: formData
        });

        console.log('📥 Respuesta recibida, status:', response.status);
        
        const result = await response.json();
        console.log('📦 Datos recibidos:', result);

        if (!response.ok) {
            throw new Error(result.error || `Error HTTP ${response.status}`);
        }

        if (result.success && result.analysis) {
            console.log('✅ Análisis recibido, procesando JSON...');
            
            // Extraer JSON de la respuesta
            let jsonString = result.analysis;
            
            // Limpiar markdown si está presente
            jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            
            // Buscar el objeto JSON
            const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No se encontró JSON válido en la respuesta');
            }
            
            console.log('🔍 JSON encontrado, parseando...');
            const characterData = JSON.parse(jsonMatch[0]);
            
            // Validar y completar datos faltantes
            const validatedData = this.validateCharacterData(characterData);
            
            console.log('📋 Datos validados:', validatedData.basicInfo);
            
            // Cargar el personaje en la hoja
            this.loadCharacterFromData(validatedData);
            
            // Mostrar mensaje de éxito
            Helpers.showMessage('✅ Personaje generado desde PDF correctamente', 'success');
            
            // Guardar automáticamente
            setTimeout(() => {
                this.saveCharacter();
                console.log('💾 Personaje guardado automáticamente');
            }, 500);
            
            return validatedData;
        } else {
            throw new Error(result.error || 'Error al analizar el PDF');
        }

    } catch (error) {
        console.error('❌ Error analizando PDF:', error);
        Helpers.showMessage(`Error al analizar PDF: ${error.message}`, 'error');
        return null;
    } finally {
        this.hideLoadingIndicator(loadingDiv);
        console.log('🏁 Proceso finalizado');
    }
}

validateCharacterData(data) {
    // Mapeo de habilidades estándar con sus atributos en D&D 5e
    const SKILL_ATTRIBUTE_MAP = {
        'acrobacias': 'DESTREZA',
        'arcano': 'INTELIGENCIA',
        'atletismo': 'FUERZA',
        'engaño': 'CARISMA',
        'historia': 'INTELIGENCIA',
        'interpretación': 'CARISMA',
        'intimidación': 'CARISMA',
        'investigación': 'INTELIGENCIA',
        'juego de manos': 'DESTREZA',
        'medicina': 'SABIDURÍA',
        'naturaleza': 'INTELIGENCIA',
        'percepción': 'SABIDURÍA',
        'perspicacia': 'SABIDURÍA',
        'persuasión': 'CARISMA',
        'religión': 'INTELIGENCIA',
        'sigilo': 'DESTREZA',
        'supervivencia': 'SABIDURÍA',
        'trato con animales': 'SABIDURÍA'
    };

    // Estructura base
    const defaultData = {
        basicInfo: { name: '', class: '', race: '', background: '', alignment: '' },
        attributes: [],
        hp: { current: 10, max: 10, temp: 0 },
        attacks: [],
        exp: { current: 0, max: 300, level: 1 },
        skills: [],
        proficiencies: [],
        savingThrows: [],
        notas: { personalidad: '', ideales: '', vinculos: '', defectos: '', rasgos: '' },
        equipment: [],
        treasures: [],
        potions: []
    };
    
    const result = { ...defaultData, ...data };
    
    // Asegurar que haya 6 atributos
    const defaultAttributes = [
        { nombre: 'Fuerza', valor: 10, modificador: 0 },
        { nombre: 'DESTREZA', valor: 10, modificador: 0 },
        { nombre: 'CONSTITUCIÓN', valor: 10, modificador: 0 },
        { nombre: 'INTELIGENCIA', valor: 10, modificador: 0 },
        { nombre: 'SABIDURÍA', valor: 10, modificador: 0 },
        { nombre: 'CARISMA', valor: 10, modificador: 0 }
    ];
    
    if (!result.attributes || result.attributes.length === 0) {
        result.attributes = defaultAttributes;
    } else {
        for (let i = 0; i < defaultAttributes.length; i++) {
            if (!result.attributes[i]) {
                result.attributes.push(defaultAttributes[i]);
            }
        }
    }
    
    // Calcular modificadores si faltan
    result.attributes.forEach(attr => {
        if (attr.valor && (attr.modificador === undefined || attr.modificador === null)) {
            attr.modificador = Math.floor((attr.valor - 10) / 2);
        }
    });
    
    // Crear mapa de atributos
    const attributeMap = {};
    result.attributes.forEach(attr => {
        const nombreKey = attr.nombre.toUpperCase();
        attributeMap[nombreKey] = attr;
        attributeMap[attr.nombre] = attr;
    });
    
    // Lista completa de habilidades estándar
    const defaultSkills = [
        'Acrobacias', 'Arcano', 'Atletismo', 'Engaño', 'Historia',
        'Interpretación', 'Intimidación', 'Investigación', 'Juego de Manos',
        'Medicina', 'Naturaleza', 'Percepción', 'Perspicacia', 'Persuasión',
        'Religión', 'Sigilo', 'Supervivencia', 'Trato con Animales'
    ];
    
    // Procesar habilidades
    if (!result.skills || result.skills.length === 0) {
        result.skills = defaultSkills.map(name => {
            const skillNameLower = name.toLowerCase();
            const assignedAttribute = SKILL_ATTRIBUTE_MAP[skillNameLower] || '';
            return { 
                name: name, 
                bonus: 0,
                attribute: assignedAttribute,
                proficient: false,
                expertise: false,
                misc: 0
            };
        });
    } else {
        const processedSkills = [];
        const existingSkillNames = new Set();
        
        result.skills.forEach(skill => {
            const skillName = skill.name;
            const skillNameLower = skillName.toLowerCase();
            existingSkillNames.add(skillName);
            
            // Asignar atributo si falta
            if (!skill.attribute || skill.attribute === '') {
                const assignedAttribute = SKILL_ATTRIBUTE_MAP[skillNameLower];
                if (assignedAttribute) {
                    skill.attribute = assignedAttribute;
                    console.log(`✅ Asignado atributo ${assignedAttribute} a habilidad ${skillName}`);
                }
            }
            
            // Asegurar campos necesarios
            skill.proficient = skill.proficient || false;
            skill.expertise = skill.expertise || false;
            skill.misc = skill.misc || 0;
            
            // Calcular bonus si falta
            if (skill.bonus === undefined || skill.bonus === null) {
                let bonus = 0;
                if (skill.attribute && attributeMap[skill.attribute]) {
                    bonus += attributeMap[skill.attribute].modificador || 0;
                }
                if (skill.proficient) {
                    const profBonus = result.exp?.level ? Math.floor((result.exp.level + 7) / 4) : 2;
                    bonus += skill.expertise ? profBonus * 2 : profBonus;
                }
                bonus += skill.misc || 0;
                skill.bonus = bonus;
            }
            
            processedSkills.push(skill);
        });
        
        // Agregar habilidades faltantes
        defaultSkills.forEach(defaultSkill => {
            if (!existingSkillNames.has(defaultSkill)) {
                const skillNameLower = defaultSkill.toLowerCase();
                const assignedAttribute = SKILL_ATTRIBUTE_MAP[skillNameLower] || '';
                processedSkills.push({
                    id: Date.now() + Math.random(),
                    name: defaultSkill,
                    bonus: 0,
                    attribute: assignedAttribute,
                    proficient: false,
                    expertise: false,
                    misc: 0
                });
                console.log(`➕ Agregada habilidad estándar faltante: ${defaultSkill} (${assignedAttribute})`);
            }
        });
        
        result.skills = processedSkills;
    }
    
    // Procesar tiradas de salvación
    const defaultSavingThrows = [
        { name: 'Fuerza', basedOn: 'Fuerza', proficient: false, value: 0 },
        { name: 'DESTREZA', basedOn: 'DESTREZA', proficient: false, value: 0 },
        { name: 'CONSTITUCIÓN', basedOn: 'CONSTITUCIÓN', proficient: false, value: 0 },
        { name: 'INTELIGENCIA', basedOn: 'INTELIGENCIA', proficient: false, value: 0 },
        { name: 'SABIDURÍA', basedOn: 'SABIDURÍA', proficient: false, value: 0 },
        { name: 'CARISMA', basedOn: 'CARISMA', proficient: false, value: 0 }
    ];
    
    if (!result.savingThrows || result.savingThrows.length === 0) {
        result.savingThrows = defaultSavingThrows;
    } else {
        const existingThrowNames = new Set(result.savingThrows.map(st => st.name));
        defaultSavingThrows.forEach(defaultThrow => {
            if (!existingThrowNames.has(defaultThrow.name)) {
                result.savingThrows.push(defaultThrow);
            }
        });
    }
    
    // Calcular valores de tiradas de salvación
    result.savingThrows.forEach(st => {
        const attributeKey = st.basedOn || st.name;
        const attribute = attributeMap[attributeKey] || attributeMap[attributeKey.toUpperCase()];
        let value = attribute?.modificador || 0;
        if (st.proficient) {
            const profBonus = result.exp?.level ? Math.floor((result.exp.level + 7) / 4) : 2;
            value += profBonus;
        }
        st.value = value;
    });
    
    // Normalizar nombres de atributos
    result.attributes = result.attributes.map(attr => {
        const nameMap = {
            'str': 'Fuerza', 'strength': 'Fuerza',
            'dex': 'DESTREZA', 'dexterity': 'DESTREZA',
            'con': 'CONSTITUCIÓN', 'constitution': 'CONSTITUCIÓN',
            'int': 'INTELIGENCIA', 'intelligence': 'INTELIGENCIA',
            'wis': 'SABIDURÍA', 'wisdom': 'SABIDURÍA',
            'cha': 'CARISMA', 'charisma': 'CARISMA'
        };
        const lowerName = (attr.nombre || '').toLowerCase();
        if (nameMap[lowerName]) {
            attr.nombre = nameMap[lowerName];
        }
        return attr;
    });
    
    // Calcular percepción pasiva
    const sabiduriaAttr = result.attributes.find(attr => 
        attr.nombre === 'SABIDURÍA' || attr.nombre === 'Sabiduría'
    );
    if (sabiduriaAttr) {
        const profBonus = result.exp?.level ? Math.floor((result.exp.level + 7) / 4) : 2;
        const wisdomMod = sabiduriaAttr.modificador || 0;
        const isPerceptionProficient = result.skills?.find(s => 
            s.name === 'Percepción' && s.proficient
        );
        result.passivePerception = 10 + wisdomMod + (isPerceptionProficient ? profBonus : 0);
    } else {
        result.passivePerception = 10;
    }
    
    // Procesar proficiencies - eliminar duplicados
    if (result.proficiencies && result.proficiencies.length > 0) {
        const uniqueProficiencies = [];
        const seen = new Set();
        for (const prof of result.proficiencies) {
            const key = `${prof.name}-${prof.type}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueProficiencies.push(prof);
            }
        }
        result.proficiencies = uniqueProficiencies;
    }
    
    return result;
}

/**
 * Mostrar indicador de carga
 */
showLoadingIndicator(message) {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i>
            <p>${message}</p>
            <small>Esto puede tomar unos segundos...</small>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

/**
 * Ocultar indicador de carga
 */
hideLoadingIndicator(element) {
    if (element && element.parentNode) {
        element.remove();
    }
}

/**
 * Crear botón de importación con IA
 */
createAIImportButton() {
    // Buscar el contenedor correcto (footer-buttons en tu HTML)
    const container = document.querySelector('.footer-buttons');
    if (!container) {
        console.warn('No se encontró el contenedor .footer-buttons');
        return;
    }
    
    const existingBtn = document.getElementById('aiImportPdfBtn');
    if (existingBtn) return;
    
    const aiButton = document.createElement('button');
    aiButton.id = 'aiImportPdfBtn';
    aiButton.className = 'btn-import';
    aiButton.innerHTML = 'IMPORTAR PDF (demo)';
    aiButton.title = 'Analizar PDF y crear personaje automáticamente';
    aiButton.style.background = 'linear-gradient(135deg, #6a0dad, #4a90e2)';
    aiButton.style.margin = '0 5px';
    aiButton.style.border = 'none';
    aiButton.style.color = 'white';
    aiButton.style.cursor = 'pointer';
    aiButton.style.padding = '10px 15px';
    aiButton.style.borderRadius = '6px';
    aiButton.style.fontFamily = 'Cinzel, serif';
    aiButton.style.fontWeight = 'bold';
    aiButton.style.transition = 'all 0.3s ease';
    
    aiButton.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.pdf';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (file) {
                console.log('📄 Archivo seleccionado:', file.name);
                await this.analyzePDFWithAI(file);
            }
        };
        input.click();
    });
    
    // Insertar después del botón de importar existente o al inicio
    const importBtn = document.getElementById('importBtn');
    if (importBtn) {
        importBtn.insertAdjacentElement('afterend', aiButton);
    } else {
        container.appendChild(aiButton);
    }
    
    console.log('✅ Botón creado correctamente');
}

    async ensureUserIsSet() {
        // Esperar a que el DOM esté listo
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        // Si no hay usuario configurado, mostrar prompt
        if (!this.userManager.isUserSet()) {
            await this.userManager.showUserPrompt();
        }
        
        // Actualizar cualquier UI que muestre el nombre del jugador
        this.updatePlayerNameDisplay();
        
        // Sincronizar con WebSocket
        this.syncCharacterWithWebSocket();
    }

    updatePlayerNameDisplay() {
        const userName = this.userManager.getUserName();
        if (userName) {
            const playerNameElements = document.querySelectorAll('.player-name-display, .jugador-nombre, [data-player-name]');
            playerNameElements.forEach(el => {
                el.textContent = userName;
            });
            
            const playerNameInputs = document.querySelectorAll('input[name="jugadorNombre"], input[name="playerName"]');
            playerNameInputs.forEach(input => {
                input.value = userName;
            });
        }
    }

    async saveCharacter() {
        const personajeNombre = document.getElementById('char-name')?.value.trim() || 'Sin nombre';
        const clase = document.getElementById('char-class')?.value || '';
        const raza = document.getElementById('char-race')?.value || '';
        const trasfondo = document.getElementById('char-bg')?.value || '';
        const alineamiento = document.getElementById('char-align')?.value || '';
        const jugadorNombre = this.getPlayerName();
        if (jugadorNombre === 'Aventurero' || jugadorNombre === 'Anónimo') {
            console.warn('⚠️ Jugador sin registrar, mostrando prompt');
            await this.userManager.showUserPrompt();
            const nuevoNombre = this.getPlayerName();
            if (nuevoNombre === 'Aventurero' || nuevoNombre === 'Anónimo') {
                Helpers.showMessage('Por favor ingresa tu nombre para guardar el personaje', 'warning');
                return;
            }
        }

        const inventoryCard = document.getElementById('card-inventory');
        const isInventoryCollapsed = inventoryCard ? inventoryCard.classList.contains('collapsed') : false;
        
        const imagenUrl = localStorage.getItem('imagenUrl') || null;
        
        const atributosDOM = [];
        document.querySelectorAll('.attribute-item').forEach(item => {
            const nameInput = item.querySelector('.attribute-name');
            const valueInput = item.querySelector('.ability-value');
            const modifierElement = item.querySelector('.ability-modifier');
            
            if (nameInput && valueInput) {
                const nombre = nameInput.value.trim() || 'ATRIBUTO';
                const valor = parseInt(valueInput.value) || 10;
                let modifier = 0;
                
                if (modifierElement) {
                    const modifierText = modifierElement.textContent;
                    modifier = parseInt(modifierText) || 0;
                } else {
                    modifier = Helpers.calculateModifier(valor);
                }
                
                atributosDOM.push({
                    nombre: nombre,
                    valor: valor,
                    modificador: modifier
                });
            }
        });
        
        const notas = {
            personalidad: document.getElementById('personality')?.value || '',
            ideales: document.getElementById('ideals')?.value || '',
            vinculos: document.getElementById('bonds')?.value || '',
            defectos: document.getElementById('flaws')?.value || '',
            rasgos: document.getElementById('features')?.value || ''
        };
        
        const coloresGuardados = JSON.parse(localStorage.getItem('characterColors') || '{}');
        const textColorsGuardados = JSON.parse(localStorage.getItem('characterTextColors') || '{}');
        
        const layout = {};
        document.querySelectorAll('.card').forEach((card, index) => {
            const id = card.id || `card-${index}`;
            layout[id] = {
                width: card.style.width || getComputedStyle(card).width,
                height: card.style.height || getComputedStyle(card).height,
                parentId: card.parentNode?.id || card.parentNode?.className || ''
            };
        });

        const characterData = {
            id: `pj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nombre: personajeNombre,
            clase: clase,
            raza: raza,
            nivel: this.expManager?.getData().level || 1,
            jugador: this.getPlayerName(),
            trasfondo: trasfondo,
            alineamiento: alineamiento, 
            imagen: imagenUrl,
            colores_personalizados: {
                background: coloresGuardados.background || null,
                parchment: coloresGuardados.parchment || null,
                accent: coloresGuardados.accent || null,
                mana: coloresGuardados.mana || null,
                hp: coloresGuardados.hp || null,
                gems: coloresGuardados.gems || null,
                textColors: textColorsGuardados
            },
            stats: {
                hp: this.healthManager.getData(),
                mana: this.manaManager.getData(),
                ca: parseInt(document.getElementById('armor-class')?.value) || 12,
                velocidad: parseInt(document.getElementById('speed')?.value) || 30,
                iniciativa: parseInt(document.getElementById('initiative')?.value) || 1,
                atributos: atributosDOM
            },
            spellSlots: this.spellSlotsManager.getData(),
            spellStats: this.spellStatsManager.getData(),
            ataques: this.getAttacks(),
            conjuros: this.getSpells(),
            inventario: {
                monedas: this.currencyManager.getData(),
                tesoros: this.treasureManager.getAll(),
                pociones: this.potionManager.getAll(),
                equipo: this.equipmentManager.getAll(),
                collapsed: isInventoryCollapsed
            },
            deathSaves: this.deathSavesManager.getData(),
            skills: this.skillsManager.getAll(),
            passivePerception: this.calcularPercepcionPasiva() || 10,
            proficiencies: this.proficiencyManager.getAll(),
            savingThrows: this.savingThrowsManager.getAll(),
            notas: notas,
            layout: layout,
            fecha_creacion: new Date().toISOString(),
            version: '3.2'
        };
        
        localStorage.setItem('dndCharacterSheet', JSON.stringify(characterData));
        localStorage.setItem('personajeNombre', personajeNombre);
        
        this.storage.save('basicInfo', {
            name: personajeNombre,
            class: clase,
            race: raza,
            background: trasfondo,
            alignment: alineamiento
        });
        
        if (personajeNombre === 'Sin nombre' && !document.getElementById('char-name')?.value.trim()) {
            return;
        }

        this.storage.save('traits', {
            personality: notas.personalidad,
            ideals: notas.ideales,
            bonds: notas.vinculos,
            flaws: notas.defectos,
            features: notas.rasgos
        });
        this.storage.save('passivePerception', this.passivePerception);
        
        // Sincronizar con WebSocket con datos completos
        if (window.wsClient && window.wsClient.isConectado()) {
            const notificacionCompleta = {
                id: characterData.id,
                nombre: personajeNombre,
                jugador: characterData.jugador,
                clase: clase,
                nivel: characterData.nivel,
                raza: raza,
                trasfondo: trasfondo,
                alineamiento: alineamiento,
                stats: characterData.stats,
                spellSlots: characterData.spellSlots,
                spellStats: characterData.spellStats,
                inventario: characterData.inventario,
                ataques: characterData.ataques,
                conjuros: characterData.conjuros,
                notas: characterData.notas,
                skills: characterData.skills,
                savingThrows: characterData.savingThrows,
                passivePerception: characterData.passivePerception,
                deathSaves: characterData.deathSaves,
                proficiencies: characterData.proficiencies,
                imagen: characterData.imagen,
                colores_personalizados: characterData.colores_personalizados,
                timestamp: new Date().toISOString()
            };
            
            window.wsClient.emit('personaje-guardado', {
                personaje: notificacionCompleta
            });
            
            window.wsClient.actualizarPersonaje(notificacionCompleta);
        }
        
        try {
            const result = await this.api.saveCharacter(characterData);
            
            if (result.success) {
                console.log('✅ Personaje guardado en servidor', result.data);
                this.showSaveConfirmation();
            } else {
                console.error('❌ Error guardando personaje:', result.error);
                Helpers.showMessage('Error al guardar en servidor: ' + result.error, 'error');
            }
        } catch (error) {
            console.error('❌ Error inesperado:', error);
            Helpers.showMessage('Error de conexión con el servidor', 'error');
        }
    }

    async refreshCharacterFromServer() {
        try {
            const nombrePersonaje = this.getCharacterName();
            if (!nombrePersonaje || nombrePersonaje === 'Sin nombre') return;
            
            const response = await fetch('/api/personajes/hoy');
            const data = await response.json();
            
            const jugadorActual = this.getPlayerName();
            const personajeEncontrado = data.personajes?.find(p => 
                p.nombre === nombrePersonaje && p.jugador === jugadorActual
            );
            
            if (personajeEncontrado) {
                this.loadCharacterFromData(personajeEncontrado);
            }
        } catch (error) {
            console.error('Error recargando personaje:', error);
            Helpers.showMessage('Error al recargar personaje', 'error');
        }
    }

    setupWebSocketListeners() {
        if (!this.ws) return;
        
        this.ws.on('personaje-actualizado', (data) => {
            if (data.personaje?.nombre === this.getCharacterName()) {
                Helpers.showMessage('Tu personaje fue actualizado en otra sesión', 'info');
            }
        });

        this.ws.on('personaje-guardado', (data) => {
            const personajeRecibido = data.personaje;
            
            if (personajeRecibido?.nombre === this.getCharacterName() && 
                personajeRecibido?.jugador === this.getPlayerName()) {
                // Actualización recibida
            }
        });

        this.ws.on('usuario-unido', (usuario) => {
            if (usuario.nombre !== this.getPlayerName()) {
                Helpers.showMessage(`${usuario.nombre} se unió a la sesión`, 'info');
            }
        });

        this.ws.on('connect', () => {
            this.syncCharacterWithWebSocket();
        });
    }

    initManagers() {
        this.colorManager = new ColorManager(this.storage);
        this.attributeManager = new AttributeManager(this.storage);
        this.healthManager = new HealthManager(this.storage, this.eventBus);
        this.manaManager = new ManaManager(this.storage, this.eventBus);
        this.deathSavesManager = new DeathSavesManager(this.storage, this.eventBus);
        this.loadDeathSavesFromStorage();
        this.loadPassivePerceptionFromStorage();
        this.expManager = new ExpManager(this.storage, this.eventBus);
        this.skillsManager = new SkillsManager(this.storage, this.attributeManager, this.eventBus, this.expManager);
        this.proficiencyManager = new ProficiencyManager(this.storage, this.eventBus);
        this.savingThrowsManager = new SavingThrowsManager(this.storage, this.attributeManager, this.eventBus, this.expManager);
        
        this.currencyManager = new CurrencyManager(this.storage, this.eventBus);
        this.treasureManager = new TreasureManager(this.storage, this.eventBus);
        this.potionManager = new PotionManager(this.storage, this.eventBus);
        this.equipmentManager = new EquipmentManager(this.storage, this.eventBus, this.attributeManager);
        
        this.spellSlotsManager = new SpellSlotsManager(this.storage, this.eventBus);
        this.spellManager = new SpellManager(this.storage, this.eventBus);
        this.spellStatsManager = new SpellStatsManager(this.storage, this.eventBus, this.attributeManager, this.expManager);
        
        this.imageManager = new ImageManager(this.api, this.eventBus);
        this.dragDropManager = new DragDropManager(this.storage);
        this.resizeManager = new ResizeManager(this.storage);
        this.loadAttacksFromStorage();
    }

    initUI() {
        this.attributeUI = new AttributeUI(this.attributeManager, this.colorManager, this.eventBus);
        this.spellUI = new SpellUI(this.spellManager, this.spellSlotsManager, this.eventBus);
        
        this.setupSubscriptions();
        
        this.setupQuickHPControls();
        this.setupInventoryCollapse();
        this.setupBasicInfo();
        this.setupAddButtons();
        this.setupAttributeEvents();
        this.setupAttackEvents();
        this.setupSpellEvents();
        this.setupCurrencyEvents();
        this.setupDeathSavesEvents();
        this.setupSpellStatsEvents();
        this.loadTraitsFromStorage();
    }

    setupSpellStatsEvents() {
    const spellcastingAbilitySelect = document.getElementById('spellcastingAbility');
    const preparedSpellsInput = document.getElementById('preparedSpells');
    const cantripsKnownInput = document.getElementById('cantripsKnown');
    
    // Poblar el select de Característica Mágica con los atributos actuales
    this.populateSpellcastingAbilitySelect();
    
    // Escuchar cambios en atributos para actualizar el select
    this.eventBus.on('attributeChanged', () => {
        this.populateSpellcastingAbilitySelect();
        this.spellStatsManager.calculateStats();
        this.updateSpellStatsDisplay();
    });
    
    this.eventBus.on('attributeNameChanged', () => {
        this.populateSpellcastingAbilitySelect();
        this.spellStatsManager.calculateStats();
        this.updateSpellStatsDisplay();
    });
    
    this.eventBus.on('attributeRemoved', () => {
        this.populateSpellcastingAbilitySelect();
        this.spellStatsManager.calculateStats();
        this.updateSpellStatsDisplay();
    });
    
    if (spellcastingAbilitySelect) {
        spellcastingAbilitySelect.addEventListener('change', (e) => {
            this.spellStatsManager.setSpellcastingAbility(e.target.value);
            this.updateSpellStatsDisplay();
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
    }
    
    if (preparedSpellsInput) {
        preparedSpellsInput.addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 0;
            this.spellStatsManager.setPreparedSpells(value);
            this.updateSpellStatsDisplay();
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
    }
    
    if (cantripsKnownInput) {
        cantripsKnownInput.addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 0;
            this.spellStatsManager.setCantripsKnown(value);
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
    }
    
    // Suscribirse a cambios para actualizar UI
    this.spellStatsManager.subscribe(() => {
        this.updateSpellStatsDisplay();
    });
    
    // Recalcular cuando cambien atributos o nivel
    this.eventBus.on('attributeChanged', () => {
        this.spellStatsManager.calculateStats();
        this.updateSpellStatsDisplay();
    });
    
    this.eventBus.on('expChanged', () => {
        this.spellStatsManager.calculateStats();
        this.updateSpellStatsDisplay();
    });
    
    // Actualizar display inicial
    this.updateSpellStatsDisplay();
}

populateSpellcastingAbilitySelect() {
    const select = document.getElementById('spellcastingAbility');
    if (!select) return;
    
    const attributes = this.attributeManager.getAll();
    const currentValue = this.spellStatsManager.getData().spellcastingAbility;
    
    // Guardar el valor seleccionado actualmente
    let selectedValue = currentValue;
    
    // Verificar si el valor seleccionado aún existe
    const attributeExists = attributes.some(attr => attr.name === currentValue);
    if (!attributeExists && attributes.length > 0) {
        // Si no existe, seleccionar el primer atributo
        selectedValue = attributes[0].name;
        if (selectedValue !== currentValue) {
            this.spellStatsManager.setSpellcastingAbility(selectedValue);
        }
    }
    
    // Limpiar y repoblar el select
    select.innerHTML = '';
    
    if (attributes.length === 0) {
        select.innerHTML = '<option value="">No hay atributos</option>';
        return;
    }
    
    attributes.forEach(attr => {
        const option = document.createElement('option');
        option.value = attr.name;
        option.textContent = attr.name;
        if (attr.name === selectedValue) {
            option.selected = true;
        }
        select.appendChild(option);
    });
}

    updateSpellStatsDisplay() {
    const stats = this.spellStatsManager.getData();
    
    const saveDC = document.getElementById('spellSaveDC');
    const attackBonus = document.getElementById('spellAttackBonus');
    const preparedSpellsInput = document.getElementById('preparedSpells');
    const maxPreparedSpan = document.getElementById('maxPreparedSpells');
    const cantripsKnownInput = document.getElementById('cantripsKnown');
    const spellcastingAbilitySelect = document.getElementById('spellcastingAbility');
    
    if (saveDC) saveDC.textContent = stats.spellSaveDC;
    if (attackBonus) attackBonus.textContent = stats.spellAttackBonus > 0 ? `+${stats.spellAttackBonus}` : stats.spellAttackBonus;
    if (maxPreparedSpan) maxPreparedSpan.textContent = stats.maxPreparedSpells;
    
    if (preparedSpellsInput && preparedSpellsInput.value != stats.preparedSpells) {
        preparedSpellsInput.value = stats.preparedSpells;
        preparedSpellsInput.max = stats.maxPreparedSpells;
    }
    
    if (cantripsKnownInput && cantripsKnownInput.value != stats.cantripsKnown) {
        cantripsKnownInput.value = stats.cantripsKnown;
    }
    
    // Actualizar el select sin disparar evento change
    if (spellcastingAbilitySelect && spellcastingAbilitySelect.value != stats.spellcastingAbility) {
        // Verificar si la opción existe en el select
        let optionExists = false;
        for (let i = 0; i < spellcastingAbilitySelect.options.length; i++) {
            if (spellcastingAbilitySelect.options[i].value === stats.spellcastingAbility) {
                optionExists = true;
                break;
            }
        }
        
        if (optionExists) {
            spellcastingAbilitySelect.value = stats.spellcastingAbility;
        }
    }
}

    setupDeathSavesEvents() {
        const successCheckboxes = document.querySelectorAll('.death-save-success');
        const failCheckboxes = document.querySelectorAll('.death-save-fail');
        
        successCheckboxes.forEach((checkbox, index) => {
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
            
            newCheckbox.addEventListener('change', (e) => {
                console.log('✅ Éxito de muerte cambiado:', index, e.target.checked);
                this.deathSavesManager.setSuccess(index, e.target.checked);
            });
        });
        
        failCheckboxes.forEach((checkbox, index) => {
            const newCheckbox = checkbox.cloneNode(true);
            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
            
            newCheckbox.addEventListener('change', (e) => {
                console.log('❌ Fallo de muerte cambiado:', index, e.target.checked);
                this.deathSavesManager.setFail(index, e.target.checked);
            });
        });
    }

    setupCurrencyEvents() {
        const goldInput = document.getElementById('goldAmount');
        const silverInput = document.getElementById('silverAmount');
        const copperInput = document.getElementById('copperAmount');
        
        if (goldInput) {
            const newGold = goldInput.cloneNode(true);
            goldInput.parentNode.replaceChild(newGold, goldInput);
            
            newGold.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 0;
                console.log('💰 Oro cambiado a:', value);
                this.currencyManager.setGold(value);
            });
        }
        
        if (silverInput) {
            const newSilver = silverInput.cloneNode(true);
            silverInput.parentNode.replaceChild(newSilver, silverInput);
            
            newSilver.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 0;
                console.log('💰 Plata cambiado a:', value);
                this.currencyManager.setSilver(value);
            });
        }
        
        if (copperInput) {
            const newCopper = copperInput.cloneNode(true);
            copperInput.parentNode.replaceChild(newCopper, copperInput);
            
            newCopper.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 0;
                console.log('💰 Cobre cambiado a:', value);
                this.currencyManager.setCopper(value);
            });
        }
    }

    setupAttributeEvents() {
        this.eventBus.on('attributeChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        
        this.eventBus.on('attributeNameChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
    }

    setupAttackEvents() {
        const attacksList = document.querySelector('.attacks-list');
        if (attacksList) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => {
                            if (node.classList && node.classList.contains('attack-item')) {
                                this.setupAttackItemEvents(node);
                            }
                        });
                    }
                });
            });
            
            observer.observe(attacksList, { childList: true, subtree: true });
        }
        
        document.querySelectorAll('.attack-item').forEach(item => {
            this.setupAttackItemEvents(item);
        });
    }

    setupAttackItemEvents(attackItem) {
        const inputs = attackItem.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                this.saveAttacksToStorage();
                if (this.hasValidCharacterName()) this.saveCharacter();
            });
        });
        
        const removeBtn = attackItem.querySelector('.btn-remove-attack');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                setTimeout(() => {
                    this.saveAttacksToStorage();
                    if (this.hasValidCharacterName()) this.saveCharacter();
                }, 100);
            });
        }
    }

    setupSpellEvents() {
        const spellsList = document.getElementById('spellsList');
        if (spellsList) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => {
                            if (node.classList && node.classList.contains('spell-item')) {
                                this.setupSpellItemEvents(node);
                            }
                        });
                    }
                });
            });
            
            observer.observe(spellsList, { childList: true, subtree: true });
        }
        
        document.querySelectorAll('#spellsList .spell-item').forEach(item => {
            this.setupSpellItemEvents(item);
        });
        
        this.eventBus.on('spellsChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
    }

    setupSpellItemEvents(spellItem) {
        const inputs = spellItem.querySelectorAll('input, textarea');
        inputs.forEach(input => {
            input.addEventListener('change', () => {
                if (this.hasValidCharacterName()) this.saveCharacter();
            });
        });
        
        const removeBtn = spellItem.querySelector('.btn-remove-spell');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => {
                setTimeout(() => {
                    if (this.hasValidCharacterName()) this.saveCharacter();
                }, 100);
            });
        }
    }

    setupAutoSave() {
        let saveTimeout;
        const debouncedSave = () => {
            if (!this.hasValidCharacterName()) return;
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveCharacter();
            }, 300); 
        };
        
        this.eventBus.on('attributeChanged', () => {
            debouncedSave();
        });
        
        this.eventBus.on('attributeNameChanged', () => {
            debouncedSave();
        });

        this.eventBus.on('healthChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('manaChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('skillsChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('proficienciesChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('savingThrowsChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('expChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('deathSavesChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('currencyChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('treasuresChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('potionsChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('equipmentChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('spellSlotsChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('spellStatsChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.eventBus.on('imageChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        this.setupCombatStatsAutoSave();
        this.setupTraitsAutoSave();
    }

    hasValidCharacterName() {
        const charName = document.getElementById('char-name')?.value.trim();
        return charName && charName !== '' && charName !== 'Sin nombre';
    }

    showAddProficiencyModal() {
        const existingModal = document.getElementById('addProficiencyModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'addProficiencyModal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3><i class="fas fa-plus-circle"></i> Añadir Competencia / Idioma</h3>
                    <button class="modal-close" id="closeAddModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label><i class="fas fa-tag"></i> Nombre</label>
                        <input type="text" id="newProficiencyName" placeholder=" ">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-filter"></i> Tipo</label>
                        <select id="newProficiencyType">
                            <option value="language">Idioma</option>
                            <option value="armor">Armadura</option>
                            <option value="weapon">Arma</option>
                            <option value="tool">Herramienta</option>
                        </select>
                    </div>
                </div>
                <div class="modal-actions" style="justify-content: flex-end; gap: 10px; padding: 15px;">
                    <button type="button" class="btn-secondary btn-cancel" id="cancelAddBtn">
                        Cancelar
                    </button>
                    <button type="button" class="btn-secondary" id="saveAddBtn" style="background: #4CAF50;">
                        <i class="fas fa-check"></i> Añadir
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('closeAddModal').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('cancelAddBtn').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('saveAddBtn').addEventListener('click', () => {
            const name = document.getElementById('newProficiencyName').value.trim();
            const type = document.getElementById('newProficiencyType').value;
            
            if (name) {
                this.proficiencyManager.add(name, type);
                Helpers.showMessage('Competencia añadida', 'info');
                modal.remove();
            } else {
                Helpers.showMessage('Por favor, ingresa un nombre', 'warning');
            }
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    setupSubscriptions() {
        this.healthManager.subscribe((data) => {
            this.updateHealthDisplay(data);
        });
        
        this.manaManager.subscribe((data) => {
            this.updateManaDisplay(data);
        });
        
        this.deathSavesManager.subscribe((data) => {
            this.updateDeathSavesDisplay(data);
        });
        
        this.skillsManager.subscribe((skills) => {
            this.renderSkills(skills);
        });
        
        this.proficiencyManager.subscribe((allProficiencies) => {
            const activeTab = document.querySelector('.proficiency-tab.active');
            const filterType = activeTab ? activeTab.dataset.type : 'all';
            
            if (filterType === 'all') {
                this.renderProficiencies(allProficiencies);
            } else {
                const filtered = this.proficiencyManager.getByType(filterType);
                this.renderProficiencies(filtered);
            }
        });
        
        this.savingThrowsManager.subscribe((savingThrows) => {
            this.renderSavingThrows(savingThrows);
        });
        
        this.expManager.subscribe((data) => {
            this.updateExpDisplay(data);
            this.calcularPercepcionPasiva();
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        
        this.currencyManager.subscribe((data) => {
            this.updateCurrencyDisplay(data);
        });
        
        this.treasureManager.subscribe((treasures) => {
            this.renderTreasures(treasures);
        });
        
        this.potionManager.subscribe((potions) => {
            this.renderPotions(potions);
        });
        
        this.equipmentManager.subscribe((equipment) => {
            this.renderEquipment(equipment);
        });
        
        this.spellSlotsManager.subscribe((slots) => {});
        
        this.eventBus.on('levelChanged', (level) => {
            this.updateSavingThrows();
            document.getElementById('level-display').textContent = level;
            document.getElementById('character-level').value = level;
        });
        
        this.eventBus.on('deathSavesSuccess', (message) => {
            Helpers.showMessage(message, 'info');
        });
        
        this.eventBus.on('deathSavesFail', (message) => {
            Helpers.showMessage(message, 'error');
        });
        
        this.eventBus.on('requestProficiencyBonus', () => {
            const bonus = this.expManager.getProficiencyBonus();
            this.eventBus.emit('proficiencyBonusResponse', bonus);
        });

        this.eventBus.on('attributeChanged', () => {
            this.calcularPercepcionPasiva();
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
    }

    setupAddButtons() {
        document.getElementById('addSkillBtn')?.addEventListener('click', () => {
            const name = prompt('Nombre de la habilidad:');
            if (name) {
                const attribute = prompt('Atributo asociado (FUERZA, DESTREZA, etc.) opcional:');
                this.skillsManager.add(name, attribute || '');
            }
        });
        
        document.getElementById('addProficiencyBtn')?.addEventListener('click', () => {
            this.showAddProficiencyModal();
        });

        document.getElementById('addTreasureBtn')?.addEventListener('click', () => {
            this.showAddTreasureModal();
        });

        document.getElementById('addPotionBtn')?.addEventListener('click', () => {
            this.showAddPotionModal();
        });

        document.getElementById('addEquipmentBtn')?.addEventListener('click', () => {
            this.showAddEquipmentModal();
        });

        document.getElementById('addAttackBtn')?.addEventListener('click', () => {
            this.addAttack();
        });

        document.getElementById('addSpellBtn')?.addEventListener('click', () => {
            this.spellManager.add();
        });
    }

    setupGlobalEvents() {
        document.querySelectorAll('.proficiency-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.proficiency-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const type = tab.dataset.type;
                const proficiencies = this.proficiencyManager.getByType(type);
                this.renderProficiencies(proficiencies);
            });
        });
        
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            this.exportCharacter();
        });
        
        document.getElementById('importBtn')?.addEventListener('click', () => {
            this.importCharacter();
        });

        document.getElementById('saveBtn')?.addEventListener('click', () => {
            this.saveCharacter();
        });
        
        document.getElementById('resetBtn')?.addEventListener('click', () => {
            if (confirm('¿Restablecer toda la hoja? Se perderán los cambios no guardados.')) {
                this.resetAll();
            }
        });
        
        document.getElementById('colorCustomizerBtn')?.addEventListener('click', () => {
            this.showColorCustomizer();
        });
        
        document.getElementById('textCustomizerBtn')?.addEventListener('click', () => {
            this.showTextColorCustomizer();
        });
        
        document.getElementById('configManaBtn')?.addEventListener('click', () => {
            this.showManaConfig();
        });
        
        document.getElementById('configExpBtn')?.addEventListener('click', () => {
            this.showExpConfig();
        });
        
        document.getElementById('configSlotsBtn')?.addEventListener('click', () => {
            this.showSpellSlotsConfig();
        });
        
        document.getElementById('configCurrencyBtn')?.addEventListener('click', () => {
            this.showCurrencyConfig();
        });
        
        document.getElementById('level-up-btn')?.addEventListener('click', () => {
            this.expManager.changeLevel(1);
        });
        
        document.getElementById('level-down-btn')?.addEventListener('click', () => {
            this.expManager.changeLevel(-1);
        });

        const currentExpInput = document.getElementById('current-exp');
        const maxExpInput = document.getElementById('max-exp');
        if (currentExpInput) {
            currentExpInput.replaceWith(currentExpInput.cloneNode(true));
            const newCurrentExp = document.getElementById('current-exp');
            
            newCurrentExp.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 0;
                this.expManager.setCurrent(value);
            });
        }

        if (maxExpInput) {
            maxExpInput.replaceWith(maxExpInput.cloneNode(true));
            const newMaxExp = document.getElementById('max-exp');
            
            newMaxExp.addEventListener('change', (e) => {
                const value = parseInt(e.target.value) || 1;
                this.expManager.setMax(value);
            });
        }
        
        document.getElementById('manaPlusBtn')?.addEventListener('click', () => {
            this.manaManager.modify(1);
        });
        
        document.getElementById('manaMinusBtn')?.addEventListener('click', () => {
            this.manaManager.modify(-1);
        });
        
        document.getElementById('manaInput')?.addEventListener('change', (e) => {
            this.manaManager.setCurrent(parseInt(e.target.value) || 0);
        });
        
        document.getElementById('current-hp')?.addEventListener('change', (e) => {
            this.healthManager.setCurrent(parseInt(e.target.value) || 0);
        });
        
        document.getElementById('max-hp')?.addEventListener('change', (e) => {
            this.healthManager.setMax(parseInt(e.target.value) || 1);
        });
        
        document.getElementById('temp-hp')?.addEventListener('change', (e) => {
            this.healthManager.setTemp(parseInt(e.target.value) || 0);
        });
        
        document.getElementById('closeModalBtn')?.addEventListener('click', () => {
            document.getElementById('configModal').style.display = 'none';
        });
        
        document.getElementById('closeTextColorModalBtn')?.addEventListener('click', () => {
            document.getElementById('textColorModal').style.display = 'none';
        });
        
        document.getElementById('configModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('configModal')) {
                e.target.style.display = 'none';
            }
        });
        
        document.getElementById('textColorModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('textColorModal')) {
                e.target.style.display = 'none';
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.getElementById('configModal').style.display = 'none';
                document.getElementById('textColorModal').style.display = 'none';
            }
        });
    }

    updateHealthDisplay(data) {
        const currentHP = document.getElementById('current-hp');
        const maxHP = document.getElementById('max-hp');
        const hpBarFill = document.getElementById('hpBarFill');
        const hpCurrentLabel = document.getElementById('hpCurrentLabel');
        const hpMaxLabel = document.getElementById('hpMaxLabel');
        const tempHP = document.getElementById('temp-hp');
        
        if (currentHP) currentHP.value = data.current;
        if (maxHP) maxHP.value = data.max;
        if (tempHP) tempHP.value = data.temp;
        if (hpCurrentLabel) hpCurrentLabel.textContent = data.current;
        if (hpMaxLabel) hpMaxLabel.textContent = data.max;
        
        if (hpBarFill) {
            hpBarFill.style.width = `${data.percentage}%`;
            
            if (data.percentage < 25) {
                hpBarFill.style.background = 'linear-gradient(90deg, #000000, #332f2f)';
            } else if (data.percentage < 50) {
                hpBarFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
            } else {
                hpBarFill.style.background = 'linear-gradient(90deg, var(--hp-color, #dc143c), #ff6b6b)';
            }
        }
    }

    updateManaDisplay(data) {
        const manaInput = document.getElementById('manaInput');
        const currentManaSpan = document.getElementById('currentMana');
        const maxManaSpan = document.getElementById('maxMana');
        const manaBarFill = document.getElementById('manaBarFill');
        
        if (manaInput) {
            manaInput.value = data.current;
            manaInput.max = data.max;
        }
        if (currentManaSpan) currentManaSpan.textContent = data.current;
        if (maxManaSpan) maxManaSpan.textContent = data.max;
        
        if (manaBarFill) {
            manaBarFill.style.width = `${data.percentage}%`;
            
            if (data.percentage < 20) {
                manaBarFill.style.background = 'linear-gradient(90deg, #ff4444, #ff6b6b)';
            } else if (data.percentage < 50) {
                manaBarFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
            } else {
                manaBarFill.style.background = 'linear-gradient(90deg, var(--mana-color, #4169e1), #6495ed)';
            }
        }
    }

    updateDeathSavesDisplay(data) {
        const successCheckboxes = document.querySelectorAll('.death-save-success');
        const failCheckboxes = document.querySelectorAll('.death-save-fail');
        
        data.successes.forEach((checked, index) => {
            if (successCheckboxes[index]) successCheckboxes[index].checked = checked;
        });
        
        data.fails.forEach((checked, index) => {
            if (failCheckboxes[index]) failCheckboxes[index].checked = checked;
        });
    }

    loadTraitsFromStorage() {
        const savedData = this.storage.load('traits');
        if (savedData) {
            document.getElementById('personality').value = savedData.personality || '';
            document.getElementById('ideals').value = savedData.ideals || '';
            document.getElementById('bonds').value = savedData.bonds || '';
            document.getElementById('flaws').value = savedData.flaws || '';
            document.getElementById('features').value = savedData.features || '';
        }
    }

    loadDeathSavesFromStorage() {
        const saved = this.storage.load('deathSaves');
        if (saved) {
            this.deathSavesManager.successes = saved.successes || [false, false, false];
            this.deathSavesManager.fails = saved.fails || [false, false, false];
            this.deathSavesManager.notify();
        }
    }

    loadPassivePerceptionFromStorage() {
        const saved = this.storage.load('passivePerception');
        if (saved) {
            this.passivePerception = saved;
            const perceptionInput = document.getElementById('passivePerception');
            if (perceptionInput) perceptionInput.value = saved;
        }
        setTimeout(() => {
            this.calcularPercepcionPasiva();
        }, 500);
    }

    updateExpDisplay(data) {
        const currentExp = document.getElementById('current-exp');
        const maxExp = document.getElementById('max-exp');
        const expBarFill = document.getElementById('expBarFill');
        const expCurrentLabel = document.getElementById('expCurrentLabel');
        const expMaxLabel = document.getElementById('expMaxLabel');
        const expPercentage = document.getElementById('expPercentage');
        const levelDisplay = document.getElementById('level-display');
        const characterLevel = document.getElementById('character-level');
        
        if (currentExp) currentExp.value = data.current;
        if (maxExp) maxExp.value = data.max;
        if (expCurrentLabel) expCurrentLabel.textContent = data.current;
        if (expMaxLabel) expMaxLabel.textContent = data.max;
        if (expPercentage) expPercentage.textContent = `${Math.round(data.percentage)}%`;
        if (levelDisplay) levelDisplay.textContent = data.level;
        if (characterLevel) characterLevel.value = data.level;
        
        if (expBarFill) {
            expBarFill.style.width = `${data.percentage}%`;
            
            if (data.percentage >= 100) {
                expBarFill.style.background = 'linear-gradient(90deg, #ffd700, #ffaa00)';
            } else if (data.percentage >= 75) {
                expBarFill.style.background = 'linear-gradient(90deg, #4CAF50, #8bc34a)';
            } else {
                expBarFill.style.background = 'linear-gradient(90deg, var(--exp-color, #4a90e2), #7dc1ff)';
            }
        }
    }

    updateCurrencyDisplay(data) {
        document.getElementById('currencyName').textContent = data.name;
        
        const goldLabel = document.querySelector('.currency-item:first-child label');
        const silverLabel = document.querySelector('.currency-item:nth-child(2) label');
        const copperLabel = document.querySelector('.currency-item:last-child label');
        
        if (goldLabel) {
            goldLabel.innerHTML = `<i class="fas fa-circle" style="color: #ffd700;"></i> ${data.goldName}`;
        }
        if (silverLabel) {
            silverLabel.innerHTML = `<i class="fas fa-circle" style="color: #c0c0c0;"></i> ${data.silverName}`;
        }
        if (copperLabel) {
            copperLabel.innerHTML = `<i class="fas fa-circle" style="color: #b87333;"></i> ${data.copperName}`;
        }
        
        const goldInput = document.getElementById('goldAmount');
        const silverInput = document.getElementById('silverAmount');
        const copperInput = document.getElementById('copperAmount');
        
        if (goldInput && goldInput.value != data.gold) goldInput.value = data.gold;
        if (silverInput && silverInput.value != data.silver) silverInput.value = data.silver;
        if (copperInput && copperInput.value != data.copper) copperInput.value = data.copper;
    }

    renderSkills(skills) {
    const container = document.getElementById('skillsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (skills.length === 0) {
        container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center;">No hay habilidades</p>';
        return;
    }
    
    skills.sort((a, b) => a.name.localeCompare(b.name)).forEach(skill => {
        const item = document.createElement('div');
        item.className = 'skill-item';
        item.dataset.id = skill.id;
        
        const bonusClass = skill.bonus > 0 ? 'positive' : (skill.bonus < 0 ? 'negative' : '');
        
        const profIcon = skill.proficient ? (skill.expertise ? 'fa-star' : 'fa-check-circle') : 'fa-circle';
        const profTitle = skill.expertise ? 'Experto' : (skill.proficient ? 'Competente' : 'Sin competencia');
        
        const attributeText = skill.attribute && skill.attribute !== '' ? skill.attribute : 'Sin atributo';
        
        item.innerHTML = `
            <div class="skill-header">
                <span class="skill-prof" title="${profTitle}" style="color: var(--accent-gold); cursor: pointer;">
                    <i class="fas ${profIcon}"></i>
                </span>
                <span class="skill-name">${skill.name}</span>
                <span class="skill-bonus ${bonusClass}">${Helpers.formatModifier(skill.bonus)}</span>
                <button class="skill-edit-btn" data-id="${skill.id}" title="Editar habilidad" style="background: none; border: none; cursor: pointer; color: var(--accent-gold); margin: 0 5px;">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn-remove-skill" title="Eliminar"><i class="fas fa-times"></i></button>
            </div>
            <div class="skill-attribute-info" style="font-size: 0.7rem; color: var(--ink-light); margin-top: 4px; padding-left: 28px;">
                <i class="fas fa-dice-d20"></i> ${attributeText}
            </div>
        `;
        
        container.appendChild(item);
        
        // Evento para competencia
        const profSpan = item.querySelector('.skill-prof');
        profSpan.addEventListener('click', () => {
            if (!skill.proficient) {
                this.skillsManager.toggleProficient(skill.id);
            } else if (!skill.expertise) {
                this.skillsManager.toggleExpertise(skill.id);
            } else {
                this.skillsManager.toggleProficient(skill.id);
            }
        });
        
        // Evento para editar
        const editBtn = item.querySelector('.skill-edit-btn');
        editBtn.addEventListener('click', () => {
            this.showEditSkillModal(skill);
        });
        
        // Evento para eliminar
        item.querySelector('.btn-remove-skill').addEventListener('click', () => {
            if (confirm('¿Eliminar esta habilidad?')) {
                this.skillsManager.remove(skill.id);
            }
        });
    });
}

    renderSavingThrows(savingThrows) {
        const container = document.getElementById('savingThrowsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (savingThrows.length === 0) {
            container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center;">No hay atributos</p>';
            return;
        }
        
        savingThrows.forEach((st, index) => {
            const item = document.createElement('div');
            item.className = 'saving-throw-item';
            
            const valueClass = st.value > 0 ? 'positive' : (st.value < 0 ? 'negative' : '');
            const profIcon = st.proficient ? 'fa-check-circle' : 'fa-circle';
            const profClass = st.proficient ? 'proficient' : '';
            
            let displayName = st.name;
            if (displayName.length > 8) {
                displayName = displayName.substring(0, 7) + '…';
            }
            
            item.innerHTML = `
                <span class="saving-throw-name" title="${st.name}">${displayName}</span>
                <input type="number" class="saving-throw-value ${valueClass}" value="${st.value}" readonly>
                <span class="saving-throw-proficiency ${profClass}" title="Competencia">
                    <i class="fas ${profIcon}"></i>
                </span>
            `;
            
            container.appendChild(item);
            
            const profIconElement = item.querySelector('.saving-throw-proficiency');
            profIconElement.addEventListener('click', () => {
                this.savingThrowsManager.toggleProficient(index);
            });
        });
    }

    renderProficiencies(proficiencies) {
        const container = document.getElementById('proficienciesContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (!proficiencies || proficiencies.length === 0) {
            container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center; padding: 20px;">No hay competencias o idiomas. Haz clic en + para añadir.</p>';
            return;
        }
        
        proficiencies.forEach(prof => {
            const profButton = document.createElement('button');
            profButton.className = 'proficiency-button';
            profButton.dataset.id = prof.id;
            profButton.dataset.type = prof.type;
            
            const icon = this.proficiencyManager.getIcon(prof.type);
            
            profButton.innerHTML = `
                <i class="fas ${icon}"></i>
                <span>${prof.name}</span>
            `;
            
            profButton.addEventListener('click', (e) => {
                e.stopPropagation();
                
                if (e.target.classList.contains('fa-times') || 
                    e.target.parentElement?.classList.contains('fa-times')) {
                    return;
                }
                
                this.openProficiencyEditModal(prof);
            });
            
            const deleteIcon = document.createElement('i');
            deleteIcon.className = 'fas fa-times';
            deleteIcon.style.marginLeft = 'auto';
            deleteIcon.style.opacity = '0.7';
            deleteIcon.style.cursor = 'pointer';
            deleteIcon.style.padding = '0 5px';
            deleteIcon.style.fontSize = '0.9rem';
            
            deleteIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('¿Eliminar esta competencia?')) {
                    this.proficiencyManager.remove(prof.id);
                    Helpers.showMessage('Competencia eliminada', 'info');
                }
            });
            
            profButton.appendChild(deleteIcon);
            container.appendChild(profButton);
        });
    }

    openProficiencyEditModal(proficiency) {
        const existingModal = document.getElementById('proficiencyEditModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'proficiencyEditModal';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3><i class="fas fa-edit"></i> Editar Competencia</h3>
                    <button class="modal-close" id="closeEditModal">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label><i class="fas fa-tag"></i> Nombre</label>
                        <input type="text" id="editProficiencyName" value="${proficiency.name}" placeholder="Nombre">
                    </div>
                    <div class="form-group">
                        <label><i class="fas fa-filter"></i> Tipo</label>
                        <select id="editProficiencyType">
                            <option value="armor" ${proficiency.type === 'armor' ? 'selected' : ''}>Armadura</option>
                            <option value="weapon" ${proficiency.type === 'weapon' ? 'selected' : ''}>Arma</option>
                            <option value="tool" ${proficiency.type === 'tool' ? 'selected' : ''}>Herramienta</option>
                            <option value="language" ${proficiency.type === 'language' ? 'selected' : ''}>Idioma</option>
                        </select>
                    </div>
                </div>
                <div class="modal-actions" style="justify-content: space-between; padding: 15px;">
                    <button type="button" class="btn-secondary" id="deleteProficiencyBtn" style="background: #dc3545;">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                    <div>
                        <button type="button" class="btn-secondary" id="cancelEditBtn">
                            Cancelar
                        </button>
                        <button type="button" class="btn-secondary" id="saveEditBtn" style="background: #4CAF50;">
                            <i class="fas fa-check"></i> Guardar
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        document.getElementById('closeEditModal').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('cancelEditBtn').addEventListener('click', () => {
            modal.remove();
        });
        
        document.getElementById('saveEditBtn').addEventListener('click', () => {
            const newName = document.getElementById('editProficiencyName').value.trim();
            const newType = document.getElementById('editProficiencyType').value;
            
            if (newName) {
                this.proficiencyManager.update(proficiency.id, { 
                    name: newName, 
                    type: newType 
                });
                Helpers.showMessage('Competencia actualizada', 'info');
                modal.remove();
            } else {
                Helpers.showMessage('El nombre no puede estar vacío', 'warning');
            }
        });
        
        document.getElementById('deleteProficiencyBtn').addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres eliminar esta competencia?')) {
                this.proficiencyManager.remove(proficiency.id);
                Helpers.showMessage('Competencia eliminada', 'info');
                modal.remove();
            }
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }

    renderTreasures(treasures) {
        const container = document.getElementById('treasureList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (treasures.length === 0) {
            container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center;">No hay tesoros</p>';
            return;
        }
        
        treasures.sort((a, b) => b.value - a.value).forEach(treasure => {
            const item = document.createElement('div');
            item.className = 'treasure-item';
            
            const icon = this.getTreasureIcon(treasure.type);
            
            item.innerHTML = `
                <div class="treasure-info">
                    <i class="fas ${icon}" style="color: var(--accent-gold);"></i>
                    <span class="treasure-name">${treasure.name}</span>
                    <span class="treasure-value">${treasure.value} ${this.currencyManager.getData().name}</span>
                </div>
                <button type="button" class="btn-remove-treasure" data-id="${treasure.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            container.appendChild(item);
            
            item.querySelector('.btn-remove-treasure').addEventListener('click', () => {
                this.treasureManager.remove(treasure.id);
            });
        });
    }

    renderPotions(potions) {
        const container = document.getElementById('potionsList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (potions.length === 0) {
            container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center;">No hay pociones</p>';
            return;
        }
        
        potions.forEach(potion => {
            const item = document.createElement('div');
            item.className = 'potion-item';
            
            const icon = potion.type === 'life' ? 'fa-heart' : 'fa-bolt';
            const iconClass = potion.type === 'life' ? 'life' : 'mana';
            const targetBar = potion.type === 'life' ? 'Vida' : 'Maná';
            
            item.innerHTML = `
                <div class="potion-icon ${iconClass}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="potion-details">
                    <span class="potion-name">${potion.name}</span>
                    <span class="potion-effect">
                        <i class="fas ${icon}"></i>
                        Restaura <span class="potion-amount">+${potion.amount}</span> ${targetBar}
                    </span>
                    <span class="potion-value">${potion.value} ${this.currencyManager.getData().name}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn-consume" data-id="${potion.id}">
                        <i class="fas fa-wine-bottle"></i>
                    </button>
                    <button type="button" class="btn-remove-potion" data-id="${potion.id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            container.appendChild(item);
            
            item.querySelector('.btn-consume').addEventListener('click', () => {
                this.potionManager.consume(potion.id, this.healthManager, this.manaManager);
            });
            
            item.querySelector('.btn-remove-potion').addEventListener('click', () => {
                this.potionManager.remove(potion.id);
            });
        });
    }

    renderEquipment(equipment) {
        const container = document.getElementById('equipmentList');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (equipment.length === 0) {
            container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center;">No hay equipo</p>';
            return;
        }
        
        equipment.forEach(item => {
            const element = document.createElement('div');
            element.className = 'equipment-item';
            element.dataset.id = item.id;
            
            const stealthIcon = item.stealth === 'advantage' ? 'fa-check-circle' : 
                               (item.stealth === 'disadvantage' ? 'fa-exclamation-circle' : 'fa-circle');
            const stealthColor = item.stealth === 'advantage' ? '#4CAF50' : 
                                (item.stealth === 'disadvantage' ? '#ff4444' : '#888');
            
            const bonusHtml = item.attribute && item.bonus !== 0 ? 
                `<span class="equipment-bonus" style="color: ${item.bonus > 0 ? '#4CAF50' : '#ff4444'};">
                    <i class="fas fa-arrow-up"></i> ${item.bonus > 0 ? '+' : ''}${item.bonus} a ${item.attribute}
                </span>` : '';
            
            element.innerHTML = `
                <div class="equipment-header">
                    <div class="equipment-name">
                        <i class="fas fa-chess-queen" style="color: var(--accent-gold);"></i>
                        <span>${item.name}</span>
                        ${bonusHtml}
                    </div>
                    <button type="button" class="btn-remove-equipment">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="equipment-details">
                    <span class="equipment-cost"><i class="fas fa-coins"></i> ${item.cost} ${this.currencyManager.getData().name}</span>
                    <span class="equipment-weight"><i class="fas fa-weight-hanging"></i> ${item.weight} kg</span>
                    <span class="equipment-stealth" style="color: ${stealthColor};">
                        <i class="fas ${stealthIcon}"></i> 
                        ${item.stealth === 'advantage' ? 'Ventaja' : (item.stealth === 'disadvantage' ? 'Desventaja' : 'Normal')}
                    </span>
                </div>
                <div class="equipment-description">
                    <i class="fas fa-align-left" style="color: var(--ink-light);"></i>
                    ${item.description}
                </div>
            `;
            
            container.appendChild(element);
            
            element.querySelector('.btn-remove-equipment').addEventListener('click', () => {
                this.equipmentManager.remove(item.id);
            });
        });
    }

    getTreasureIcon(type) {
        const icons = {
            'gem': 'fa-gem',
            'jewelry': 'fa-crown',
            'artifact': 'fa-archway',
            'other': 'fa-box'
        };
        return icons[type] || 'fa-box';
    }

    setupBasicInfo() {
        const basicInfo = this.storage.load('basicInfo');
        if (basicInfo) {
            document.getElementById('char-name').value = basicInfo.name || '';
            document.getElementById('char-class').value = basicInfo.class || '';
            document.getElementById('char-race').value = basicInfo.race || '';
            document.getElementById('char-bg').value = basicInfo.background || '';
            document.getElementById('char-align').value = basicInfo.alignment || '';
        }
        
        const charNameInput = document.getElementById('char-name');
        if (charNameInput) {
            charNameInput.addEventListener('change', () => {
                this.saveBasicInfo();
                this.saveCharacter(); 
            });
        }
        
        ['char-class', 'char-race', 'char-bg', 'char-align'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => {
                    this.saveBasicInfo();
                    const currentName = document.getElementById('char-name')?.value.trim();
                    if (currentName && currentName !== '') {
                        this.saveCharacter();
                    }
                });
            }
        });
    }

    calcularPercepcionPasiva() {
        let sabiduriaMod = 0;
        const atributos = this.attributeManager.getAll();
        
        const sabiduriaAttr = atributos.find(attr => 
            attr.name.toUpperCase() === 'SABIDURÍA' || 
            attr.name.toUpperCase() === 'SABIDURIA' ||
            attr.name.toUpperCase() === 'WISDOM' ||
            attr.name.toUpperCase() === 'WIS'
        );
        
        if (sabiduriaAttr) {
            sabiduriaMod = sabiduriaAttr.modifier;
        }
        
        const proficiencyBonus = this.expManager?.getProficiencyBonus() || 2;
        
        const passivePerception = 10 + sabiduriaMod + proficiencyBonus;
        
        const perceptionInput = document.getElementById('passivePerception');
        if (perceptionInput && perceptionInput.value != passivePerception) {
            perceptionInput.value = passivePerception;
        }
        
        this.passivePerception = passivePerception;
        
        return passivePerception;
    }

    saveBasicInfo() {
        const basicInfo = {
            name: document.getElementById('char-name')?.value || '',
            class: document.getElementById('char-class')?.value || '',
            race: document.getElementById('char-race')?.value || '',
            background: document.getElementById('char-bg')?.value || '',
            trasfondo: document.getElementById('char-bg')?.value || '',
            alignment: document.getElementById('char-align')?.value || '',
            alineamiento: document.getElementById('char-align')?.value || ''
        };
        this.storage.save('basicInfo', basicInfo);
    }

    setupQuickHPControls() {
        const hpContainer = document.querySelector('.hp-container');
        if (!hpContainer || document.querySelector('.hp-quick-controls')) return;
        
        const controls = document.createElement('div');
        controls.className = 'hp-quick-controls';
        controls.innerHTML = `
            <button type="button" class="hp-quick-btn hp-damage" data-amount="-1">-1</button>
            <button type="button" class="hp-quick-btn hp-damage" data-amount="-5">-5</button>
            <button type="button" class="hp-quick-btn hp-heal" data-amount="+1">+1</button>
            <button type="button" class="hp-quick-btn hp-heal" data-amount="+5">+5</button>
        `;
        
        hpContainer.appendChild(controls);
        
        controls.addEventListener('click', (e) => {
            if (e.target.classList.contains('hp-quick-btn')) {
                const amount = parseInt(e.target.dataset.amount);
                this.healthManager.modify(amount);
            }
        });
    }

    setupCombatStatsAutoSave() {
        ['armor-class', 'speed', 'initiative'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('change', () => {
                    if (this.hasValidCharacterName()) {
                        this.saveCharacter();
                    }
                });
            }
        });
    }

    setupInventoryCollapse() {
        const toggleBtn = document.getElementById('toggleInventoryBtn');
        const inventoryCard = document.getElementById('card-inventory');
        
        if (!toggleBtn || !inventoryCard) return;
        
        const savedState = this.storage.load('inventoryCollapsed');
        if (savedState) {
            inventoryCard.classList.add('collapsed');
            toggleBtn.querySelector('i').className = 'fas fa-chevron-down';
        }
        
        toggleBtn.addEventListener('click', () => {
            inventoryCard.classList.toggle('collapsed');
            const icon = toggleBtn.querySelector('i');
            icon.className = inventoryCard.classList.contains('collapsed') 
                ? 'fas fa-chevron-down' 
                : 'fas fa-chevron-up';
            
            this.storage.save('inventoryCollapsed', inventoryCard.classList.contains('collapsed'));
        });
    }

    addAttack(name = '', bonus = '', damage = '', saveToStorage = true) {
        const attacksList = document.querySelector('.attacks-list');
        const addBtn = document.getElementById('addAttackBtn');
        if (!attacksList || !addBtn) return;
        
        const item = document.createElement('div');
        item.className = 'attack-item';
        item.innerHTML = `
            <input type="text" class="attack-name" placeholder="Ataque" value="${name}">
            <input type="text" class="attack-bonus" placeholder="Bonif." value="${bonus}">
            <input type="text" class="attack-damage" placeholder="Daño" value="${damage}">
            <button type="button" class="btn-remove-attack"><i class="fas fa-times"></i></button>
        `;
        
        attacksList.insertBefore(item, addBtn);
        
        this.setupAttackItemEvents(item);
        
        if (saveToStorage) {
            this.saveAttacksToStorage();
            if (this.hasValidCharacterName()) this.saveCharacter();
        }
    }

    setupTraitsAutoSave() {
        ['personality', 'ideals', 'bonds', 'flaws', 'features'].forEach(id => {
            const textarea = document.getElementById(id);
            if (textarea) {
                textarea.addEventListener('change', () => {
                    if (this.hasValidCharacterName()) {
                        this.saveCharacter();
                    }
                });
            }
        });
    }

    saveAttacksToStorage() {
        const attacks = this.getAttacks();
        this.storage.save('attacks', attacks);
        this.eventBus.emit('attacksChanged', attacks);
    }

    getAttacks() {
        const attacks = [];
        const attackItems = document.querySelectorAll('.attack-item');
        
        attackItems.forEach(item => {
            const name = item.querySelector('.attack-name')?.value || '';
            const bonus = item.querySelector('.attack-bonus')?.value || '';
            const damage = item.querySelector('.attack-damage')?.value || '';
            
            attacks.push({ name, bonus, damage });
        });
        
        return attacks;
    }

    getSpells() {
        const spells = [];
        const spellItems = document.querySelectorAll('#spellsList .spell-item');
        
        spellItems.forEach(item => {
            const name = item.querySelector('.spell-name')?.value || '';
            const level = item.querySelector('.spell-level-input')?.value || '';
            const description = item.querySelector('.spell-desc')?.value || '';
            
            spells.push({ name, level, description });
        });
        
        return spells;
    }

    showEditSkillModal(skill) {
    const existingModal = document.getElementById('editSkillModal');
    if (existingModal) existingModal.remove();
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editSkillModal';
    modal.style.display = 'flex';
    
    // Obtener lista de atributos para el select
    const attributes = this.attributeManager.getAll();
    let attributeOptions = '<option value="">Sin atributo</option>';
    attributes.forEach(attr => {
        const selected = skill.attribute === attr.name ? 'selected' : '';
        attributeOptions += `<option value="${attr.name}" ${selected}>${attr.name}</option>`;
    });
    
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 450px;">
            <div class="modal-header">
                <h3><i class="fas fa-edit"></i> Editar Habilidad</h3>
                <button class="modal-close" id="closeSkillModal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label><i class="fas fa-tag"></i> Nombre de la habilidad</label>
                    <input type="text" id="editSkillName" value="${skill.name.replace(/"/g, '&quot;')}" placeholder="Ej: Atletismo">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-dice-d20"></i> Atributo asociado</label>
                    <select id="editSkillAttribute">
                        ${attributeOptions}
                    </select>
                    <small style="color: var(--ink-light); font-size: 0.7rem;">El modificador de este atributo se sumará al bonus</small>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-star"></i> Competencia</label>
                    <div style="display: flex; gap: 15px; margin-top: 5px;">
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="radio" name="proficiency" value="none" ${!skill.proficient ? 'checked' : ''}>
                            <span>Sin competencia</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="radio" name="proficiency" value="proficient" ${skill.proficient && !skill.expertise ? 'checked' : ''}>
                            <span>Competente</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; cursor: pointer;">
                            <input type="radio" name="proficiency" value="expertise" ${skill.expertise ? 'checked' : ''}>
                            <span>Experto</span>
                        </label>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-plus-circle"></i> Bonificador adicional</label>
                    <input type="number" id="editSkillMisc" value="${skill.misc || 0}" step="1" min="-10" max="10">
                    <small style="color: var(--ink-light); font-size: 0.7rem;">Bonificador extra (se suma al total)</small>
                </div>
                <div class="skill-preview" style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px; text-align: center;">
                    <span style="font-size: 0.8rem; color: var(--ink-light);">Vista previa:</span>
                    <span style="font-weight: bold; margin-left: 5px;" id="skillPreviewBonus">+0</span>
                </div>
            </div>
            <div class="modal-actions" style="justify-content: flex-end; gap: 10px; padding: 15px;">
                <button type="button" class="btn-secondary btn-cancel" id="cancelSkillBtn">
                    Cancelar
                </button>
                <button type="button" class="btn-secondary" id="saveSkillBtn" style="background: #4CAF50;">
                    <i class="fas fa-check"></i> Guardar cambios
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Función para actualizar vista previa
    const updatePreview = () => {
        const attributeName = document.getElementById('editSkillAttribute').value;
        const proficiencyRadio = document.querySelector('input[name="proficiency"]:checked');
        const misc = parseInt(document.getElementById('editSkillMisc').value) || 0;
        
        let proficiencyBonus = 0;
        if (proficiencyRadio) {
            const profValue = proficiencyRadio.value;
            if (profValue === 'proficient') {
                proficiencyBonus = this.expManager?.getProficiencyBonus() || 2;
            } else if (profValue === 'expertise') {
                proficiencyBonus = (this.expManager?.getProficiencyBonus() || 2) * 2;
            }
        }
        
        let attributeMod = 0;
        if (attributeName) {
            const attribute = this.attributeManager.getByName(attributeName);
            if (attribute) {
                attributeMod = attribute.modifier;
            }
        }
        
        const totalBonus = attributeMod + proficiencyBonus + misc;
        const sign = totalBonus >= 0 ? '+' : '';
        const previewSpan = document.getElementById('skillPreviewBonus');
        if (previewSpan) {
            previewSpan.textContent = `${sign}${totalBonus}`;
            previewSpan.style.color = totalBonus >= 0 ? '#4CAF50' : '#ff4444';
        }
    };
    
    const nameInput = document.getElementById('editSkillName');
    const attributeSelect = document.getElementById('editSkillAttribute');
    const miscInput = document.getElementById('editSkillMisc');
    const radioButtons = document.querySelectorAll('input[name="proficiency"]');
    
    nameInput?.addEventListener('input', updatePreview);
    attributeSelect?.addEventListener('change', updatePreview);
    miscInput?.addEventListener('input', updatePreview);
    radioButtons.forEach(radio => radio.addEventListener('change', updatePreview));
    
    updatePreview();
    
    // Cerrar modal
    const closeModal = () => modal.remove();
    document.getElementById('closeSkillModal')?.addEventListener('click', closeModal);
    document.getElementById('cancelSkillBtn')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });
    
    // Guardar cambios
    document.getElementById('saveSkillBtn')?.addEventListener('click', () => {
        const newName = document.getElementById('editSkillName').value.trim();
        const newAttribute = document.getElementById('editSkillAttribute').value;
        const newMisc = parseInt(document.getElementById('editSkillMisc').value) || 0;
        const proficiencyRadio = document.querySelector('input[name="proficiency"]:checked');
        
        if (!newName) {
            Helpers.showMessage('El nombre de la habilidad no puede estar vacío', 'warning');
            return;
        }
        
        let newProficient = false;
        let newExpertise = false;
        
        if (proficiencyRadio) {
            if (proficiencyRadio.value === 'proficient') {
                newProficient = true;
                newExpertise = false;
            } else if (proficiencyRadio.value === 'expertise') {
                newProficient = true;
                newExpertise = true;
            }
        }
        
        // Actualizar la habilidad
        this.skillsManager.update(skill.id, {
            name: newName,
            attribute: newAttribute || '',
            proficient: newProficient,
            expertise: newExpertise,
            misc: newMisc
        });
        
        closeModal();
        Helpers.showMessage('Habilidad actualizada', 'info');
    });
}

    showManaConfig() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        if (!modal || !modalBody) return;
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-bolt"></i> Configurar Maná Máximo</h4>
            <div class="form-row">
                <label>Maná Máximo:</label>
                <input type="number" id="configMaxMana" value="${this.manaManager.max}" min="1" max="999">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveManaConfig">Guardar</button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelManaConfig">Cancelar</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveManaConfig').addEventListener('click', () => {
            const newMax = parseInt(document.getElementById('configMaxMana').value) || 15;
            this.manaManager.setMax(newMax);
            modal.style.display = 'none';
        });
        
        document.getElementById('cancelManaConfig').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    showExpConfig() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        if (!modal || !modalBody) return;
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-chart-line"></i> Configurar Experiencia</h4>
            <div class="form-group">
                <label>Color de barra:</label>
                <input type="color" id="configExpColor" value="${localStorage.getItem('expColor') || '#4a90e2'}">
            </div>
            <div class="form-group">
                <label>Sistema:</label>
                <select id="configExpSystem">
                    <option value="custom" ${this.expManager.system === 'custom' ? 'selected' : ''}>Personalizado</option>
                    <option value="dnd5e" ${this.expManager.system === 'dnd5e' ? 'selected' : ''}>D&D 5e</option>
                    <option value="pathfinder" ${this.expManager.system === 'pathfinder' ? 'selected' : ''}>Pathfinder</option>
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveExpConfig">Guardar</button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelExpConfig">Cancelar</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveExpConfig').addEventListener('click', () => {
            const color = document.getElementById('configExpColor').value;
            const system = document.getElementById('configExpSystem').value;
            
            document.documentElement.style.setProperty('--exp-color', color);
            localStorage.setItem('expColor', color);
            this.expManager.setSystem(system);
            
            modal.style.display = 'none';
        });
        
        document.getElementById('cancelExpConfig').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    showSpellSlotsConfig() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        const slots = this.spellSlotsManager.getData();
        
        if (!modal || !modalBody) return;
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-gem"></i> Configurar Slots</h4>
            <div class="form-row">
                <label>Nivel:</label>
                <input type="number" id="modalSpellLevel" value="${slots.level}" min="1" max="9">
            </div>
            <div class="form-row">
                <label>Total:</label>
                <input type="number" id="modalTotalSlots" value="${slots.total}" min="0" max="20">
            </div>
            <div class="form-row">
                <label>Usados:</label>
                <input type="number" id="modalUsedSlots" value="${slots.used}" min="0" max="${slots.total}">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveSlotsConfig">Guardar</button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelSlotsConfig">Cancelar</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveSlotsConfig').addEventListener('click', () => {
            const level = parseInt(document.getElementById('modalSpellLevel').value) || 1;
            const total = parseInt(document.getElementById('modalTotalSlots').value) || 4;
            const used = parseInt(document.getElementById('modalUsedSlots').value) || 0;
            
            this.spellSlotsManager.setLevel(level);
            this.spellSlotsManager.setTotal(total);
            this.spellSlotsManager.setUsed(Math.min(used, total));
            
            document.getElementById('spellLevel').value = level;
            document.getElementById('totalSlots').value = total;
            
            modal.style.display = 'none';
        });
        
        document.getElementById('cancelSlotsConfig').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    showCurrencyConfig() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        const currencyData = this.currencyManager.getData();
        
        if (!modal || !modalBody) return;
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-coins"></i> Configurar Monedas</h4>
            <div class="form-group">
                <label>Nombre genérico:</label>
                <input type="text" id="modalCurrencyName" value="${currencyData.name}">
            </div>
            <div class="form-group">
                <label>Nombre Oro:</label>
                <input type="text" id="modalGoldName" value="${currencyData.goldName}">
            </div>
            <div class="form-group">
                <label>Nombre Plata:</label>
                <input type="text" id="modalSilverName" value="${currencyData.silverName}">
            </div>
            <div class="form-group">
                <label>Nombre Cobre:</label>
                <input type="text" id="modalCopperName" value="${currencyData.copperName}">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveCurrencyConfig">Guardar</button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelCurrencyConfig">Cancelar</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveCurrencyConfig').addEventListener('click', () => {
            this.currencyManager.updateNames({
                name: document.getElementById('modalCurrencyName').value,
                goldName: document.getElementById('modalGoldName').value,
                silverName: document.getElementById('modalSilverName').value,
                copperName: document.getElementById('modalCopperName').value
            });
            modal.style.display = 'none';
        });
        
        document.getElementById('cancelCurrencyConfig').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    showAddTreasureModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        const currencyData = this.currencyManager.getData();
        
        if (!modal || !modalBody) return;
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-gem"></i> Añadir Tesoro</h4>
            <div class="form-group">
                <label>Nombre:</label>
                <input type="text" id="treasureName">
            </div>
            <div class="form-group">
                <label>Valor (${currencyData.name}):</label>
                <input type="number" id="treasureValue" min="0" value="0">
            </div>
            <div class="form-group">
                <label>Tipo:</label>
                <select id="treasureType">
                    <option value="gem">Gema</option>
                    <option value="jewelry">Joya</option>
                    <option value="artifact">Artefacto</option>
                    <option value="other">Otro</option>
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="addTreasureConfirm">Añadir</button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelTreasure">Cancelar</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('addTreasureConfirm').addEventListener('click', () => {
            const name = document.getElementById('treasureName').value.trim();
            const value = parseInt(document.getElementById('treasureValue').value) || 0;
            const type = document.getElementById('treasureType').value;
            
            if (name) {
                this.treasureManager.add(name, value, type);
                modal.style.display = 'none';
            } else {
                Helpers.showMessage('Ingresa un nombre', 'warning');
            }
        });
        
        document.getElementById('cancelTreasure').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    showAddPotionModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        const currencyData = this.currencyManager.getData();
        
        if (!modal || !modalBody) return;
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-flask"></i> Añadir Poción</h4>
            <div class="form-group">
                <label>Nombre:</label>
                <input type="text" id="potionName">
            </div>
            <div class="form-group">
                <label>Tipo:</label>
                <select id="potionType">
                    <option value="life">Vida</option>
                    <option value="mana">Maná</option>
                </select>
            </div>
            <div class="form-group">
                <label>Valor (${currencyData.name}):</label>
                <input type="number" id="potionValue" min="0" value="50">
            </div>
            <div class="form-group">
                <label>Cantidad que restaura:</label>
                <input type="number" id="potionAmount" min="1" value="10">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="addPotionConfirm">Añadir</button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelPotion">Cancelar</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('addPotionConfirm').addEventListener('click', () => {
            const name = document.getElementById('potionName').value.trim();
            const type = document.getElementById('potionType').value;
            const value = parseInt(document.getElementById('potionValue').value) || 0;
            const amount = parseInt(document.getElementById('potionAmount').value) || 10;
            
            if (name) {
                this.potionManager.add(name, type, value, amount);
                modal.style.display = 'none';
            } else {
                Helpers.showMessage('Ingresa un nombre', 'warning');
            }
        });
        
        document.getElementById('cancelPotion').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    showAddEquipmentModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        const currencyData = this.currencyManager.getData();
        const attributes = this.attributeManager.getAll();
        
        if (!modal || !modalBody) return;
        
        let attributeOptions = '<option value="">Ninguno</option>';
        attributes.forEach(attr => {
            attributeOptions += `<option value="${attr.name}">${attr.name}</option>`;
        });
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-chess-board"></i> Añadir Equipo</h4>
            <div class="form-group">
                <label>Nombre:</label>
                <input type="text" id="equipmentName">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label>Costo:</label>
                    <input type="number" id="equipmentCost" min="0" value="0">
                </div>
                <div class="form-group">
                    <label>Peso:</label>
                    <input type="number" id="equipmentWeight" min="0" value="1" step="0.1">
                </div>
            </div>
            <div class="form-group">
                <label>Descripción:</label>
                <textarea id="equipmentDesc" rows="2"></textarea>
            </div>
            <div class="form-group">
                <label>Sigilo:</label>
                <select id="equipmentStealth">
                    <option value="none">Sin efecto</option>
                    <option value="disadvantage">Desventaja</option>
                    <option value="advantage">Ventaja</option>
                </select>
            </div>
            <div class="form-group">
                <label>Bonificador:</label>
                <div class="form-row">
                    <select id="equipmentAttribute" style="flex: 2;">${attributeOptions}</select>
                    <input type="number" id="equipmentBonus" min="-5" max="5" value="1" style="flex: 1;">
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="addEquipmentConfirm">Añadir</button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelEquipment">Cancelar</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('addEquipmentConfirm').addEventListener('click', () => {
            const name = document.getElementById('equipmentName').value.trim();
            const cost = parseInt(document.getElementById('equipmentCost').value) || 0;
            const weight = parseFloat(document.getElementById('equipmentWeight').value) || 0;
            const description = document.getElementById('equipmentDesc').value.trim();
            const stealth = document.getElementById('equipmentStealth').value;
            const attribute = document.getElementById('equipmentAttribute').value;
            const bonus = parseInt(document.getElementById('equipmentBonus').value) || 0;
            
            if (name) {
                this.equipmentManager.add(name, cost, weight, description, stealth, attribute, bonus);
                modal.style.display = 'none';
            } else {
                Helpers.showMessage('Ingresa un nombre', 'warning');
            }
        });
        
        document.getElementById('cancelEquipment').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    showColorCustomizer() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        if (!modal || !modalBody) return;
        
        const currentColors = {
            mana: this.colorManager.themeColors.mana || '#4169e1',
            hp: this.colorManager.themeColors.hp || '#dc143c',
            exp: this.colorManager.themeColors.exp || '#4a90e2',
            accent: this.colorManager.themeColors.accent || '#d4af37',
            background: this.colorManager.themeColors.background || '#1a0f0a',
            parchment: this.colorManager.themeColors.parchment || '#f5e6d3',
            gems: this.colorManager.themeColors.gems || '#9370db'
        };
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-palette"></i> Colores del Tema</h4>
            <div class="color-customizer">
                <div class="color-group">
                    <label>Maná</label>
                    <input type="color" id="colorMana" value="${currentColors.mana}">
                </div>
                <div class="color-group">
                    <label>Vida</label>
                    <input type="color" id="colorHP" value="${currentColors.hp}">
                </div>
                <div class="color-group">
                    <label>Experiencia</label>
                    <input type="color" id="colorExp" value="${currentColors.exp}">
                </div>
                <div class="color-group">
                    <label>Acento</label>
                    <input type="color" id="colorAccent" value="${currentColors.accent}">
                </div>
                <div class="color-group">
                    <label>Fondo</label>
                    <input type="color" id="colorBackground" value="${currentColors.background}">
                </div>
                <div class="color-group">
                    <label>Pergamino</label>
                    <input type="color" id="colorParchment" value="${currentColors.parchment}">
                </div>
                <div class="color-group">
                    <label>Gemas</label>
                    <input type="color" id="colorGems" value="${currentColors.gems}">
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveColorsBtn">Aplicar</button>
                <button type="button" class="btn-secondary" id="resetColorsBtn">Restaurar</button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelColorsBtn">Cancelar</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        const saveBtn = document.getElementById('saveColorsBtn');
        const resetBtn = document.getElementById('resetColorsBtn');
        const cancelBtn = document.getElementById('cancelColorsBtn');
        
        saveBtn.addEventListener('click', () => {
            const colors = {
                mana: document.getElementById('colorMana').value,
                hp: document.getElementById('colorHP').value,
                exp: document.getElementById('colorExp').value,
                accent: document.getElementById('colorAccent').value,
                background: document.getElementById('colorBackground').value,
                parchment: document.getElementById('colorParchment').value,
                gems: document.getElementById('colorGems').value
            };
            
            Object.entries(colors).forEach(([key, value]) => {
                this.colorManager.setThemeColor(key, value);
            });
            
            setTimeout(() => {
                this.updateHealthDisplay(this.healthManager.getData());
                this.updateManaDisplay(this.manaManager.getData());
                this.updateExpDisplay(this.expManager.getData());
                if (this.spellUI) {
                    this.spellUI.renderSpellSlots(this.spellSlotsManager.getData());
                }
            }, 50);
            
            modal.style.display = 'none';
            Helpers.showMessage('Colores aplicados', 'info');
        });
        
        resetBtn.addEventListener('click', () => {
            const defaultColors = {
                mana: '#4169e1',
                hp: '#dc143c',
                exp: '#4a90e2',
                accent: '#d4af37',
                background: '#1a0f0a',
                parchment: '#f5e6d3',
                gems: '#9370db'
            };
            
            Object.entries(defaultColors).forEach(([key, value]) => {
                this.colorManager.setThemeColor(key, value);
            });
            
            setTimeout(() => {
                this.updateHealthDisplay(this.healthManager.getData());
                this.updateManaDisplay(this.manaManager.getData());
                this.updateExpDisplay(this.expManager.getData());
                if (this.spellUI) {
                    this.spellUI.renderSpellSlots(this.spellSlotsManager.getData());
                }
            }, 50);
            
            modal.style.display = 'none';
            Helpers.showMessage('Colores restaurados', 'info');
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    showTextColorCustomizer() {
        const modal = document.getElementById('textColorModal');
        const modalBody = document.getElementById('textColorModalBody');
        if (!modal || !modalBody) return;
        
        modalBody.innerHTML = `
            <div class="text-color-customizer">
                <div class="text-color-group">
                    <label>Títulos</label>
                    <input type="color" id="textColorTitle" value="${this.colorManager.textColors.title}">
                </div>
                <div class="text-color-group">
                    <label>Subtítulos</label>
                    <input type="color" id="textColorSubtitle" value="${this.colorManager.textColors.subtitle}">
                </div>
                <div class="text-color-group">
                    <label>Etiquetas</label>
                    <input type="color" id="textColorLabel" value="${this.colorManager.textColors.label}">
                </div>
                <div class="text-color-group">
                    <label>Inputs</label>
                    <input type="color" id="textColorInput" value="${this.colorManager.textColors.input}">
                </div>
                <div class="text-color-group">
                    <label>Números</label>
                    <input type="color" id="textColorNumber" value="${this.colorManager.textColors.number}">
                </div>
                <div class="text-color-group">
                    <label>Modificadores</label>
                    <input type="color" id="textColorModifier" value="${this.colorManager.textColors.modifier}">
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveTextColors">Aplicar</button>
                <button type="button" class="btn-secondary" id="resetTextColors">Restaurar</button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelTextColors">Cancelar</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveTextColors').addEventListener('click', () => {
            const colors = {
                title: document.getElementById('textColorTitle').value,
                subtitle: document.getElementById('textColorSubtitle').value,
                label: document.getElementById('textColorLabel').value,
                input: document.getElementById('textColorInput').value,
                number: document.getElementById('textColorNumber').value,
                modifier: document.getElementById('textColorModifier').value
            };
            
            this.colorManager.setAllTextColors(colors);
            modal.style.display = 'none';
            Helpers.showMessage('Colores de texto aplicados', 'info');
        });
        
        document.getElementById('resetTextColors').addEventListener('click', () => {
            this.colorManager.resetTextColors();
            modal.style.display = 'none';
            Helpers.showMessage('Colores de texto restaurados', 'info');
        });
        
        document.getElementById('cancelTextColors').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    showSaveConfirmation() {
        const saveBtn = document.getElementById('saveBtn');
        if (!saveBtn) return;
        
        const originalHTML = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-check"></i> ✓ GUARDADO';
        saveBtn.style.background = 'linear-gradient(145deg, #4CAF50, #2E7D32)';
        
        setTimeout(() => {
            saveBtn.innerHTML = originalHTML;
            saveBtn.style.background = '';
        }, 2000);
    }

    exportCharacter() {
        const personajeNombre = document.getElementById('char-name')?.value.trim() || 'Sin nombre';
        const clase = document.getElementById('char-class')?.value || '';
        const raza = document.getElementById('char-race')?.value || '';
        const trasfondo = document.getElementById('char-bg')?.value || '';
        const alineamiento = document.getElementById('char-align')?.value || '';
        
        const inventoryCard = document.getElementById('card-inventory');
        const isInventoryCollapsed = inventoryCard ? inventoryCard.classList.contains('collapsed') : false;
        
        const imagenUrl = localStorage.getItem('imagenUrl') || null;
        
        const atributosDOM = [];
        document.querySelectorAll('.attribute-item').forEach(item => {
            const nameInput = item.querySelector('.attribute-name');
            const valueInput = item.querySelector('.ability-value');
            const modifierElement = item.querySelector('.ability-modifier');
            
            if (nameInput && valueInput) {
                const nombre = nameInput.value.trim() || 'ATRIBUTO';
                const valor = parseInt(valueInput.value) || 10;
                let modifier = 0;
                
                if (modifierElement) {
                    const modifierText = modifierElement.textContent;
                    modifier = parseInt(modifierText) || 0;
                } else {
                    modifier = Helpers.calculateModifier(valor);
                }
                
                atributosDOM.push({
                    nombre: nombre,
                    valor: valor,
                    modificador: modifier
                });
            }
        });
        
        const notas = {
            personalidad: document.getElementById('personality')?.value || '',
            ideales: document.getElementById('ideals')?.value || '',
            vinculos: document.getElementById('bonds')?.value || '',
            defectos: document.getElementById('flaws')?.value || '',
            rasgos: document.getElementById('features')?.value || ''
        };
        
        const coloresGuardados = JSON.parse(localStorage.getItem('characterColors') || '{}');
        const textColorsGuardados = JSON.parse(localStorage.getItem('characterTextColors') || '{}');
        
        const layout = {};
        document.querySelectorAll('.card').forEach((card, index) => {
            const id = card.id || `card-${index}`;
            layout[id] = {
                width: card.style.width || getComputedStyle(card).width,
                height: card.style.height || getComputedStyle(card).height,
                parentId: card.parentNode?.id || card.parentNode?.className || ''
            };
        });
        
        const characterData = {
            id: `pj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            nombre: personajeNombre,
            clase: clase,
            raza: raza,
            nivel: this.expManager?.getData().level || 1,
            jugador: localStorage.getItem('jugadorNombre') || 'Aventurero',
            imagen: imagenUrl,
            colores_personalizados: {
                background: coloresGuardados.background || null,
                parchment: coloresGuardados.parchment || null,
                accent: coloresGuardados.accent || null,
                mana: coloresGuardados.mana || null,
                hp: coloresGuardados.hp || null,
                gems: coloresGuardados.gems || null,
                textColors: textColorsGuardados
            },
            stats: {
                hp: this.healthManager.getData(),
                mana: this.manaManager.getData(),
                ca: parseInt(document.getElementById('armor-class')?.value) || 12,
                velocidad: parseInt(document.getElementById('speed')?.value) || 30,
                iniciativa: parseInt(document.getElementById('initiative')?.value) || 1,
                atributos: atributosDOM
            },
            ataques: this.getAttacks(),
            conjuros: this.getSpells(),
            inventario: {
                monedas: this.currencyManager.getData(),
                tesoros: this.treasureManager.getAll(),
                pociones: this.potionManager.getAll(),
                equipo: this.equipmentManager.getAll(),
                collapsed: isInventoryCollapsed
            },
            deathSaves: this.deathSavesManager.getData(),
            skills: this.skillsManager.getAll(),
            passivePerception: this.passivePerception || 10,
            proficiencies: this.proficiencyManager.getAll(),
            savingThrows: this.savingThrowsManager.getAll(),
            notas: notas,
            layout: layout,
            fecha_creacion: new Date().toISOString(),
            version: '3.2'
        };
        
        const dataStr = JSON.stringify(characterData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `personaje-${personajeNombre.replace(/\s+/g, '-').toLowerCase() || 'sin-nombre'}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        Helpers.showMessage('Personaje exportado correctamente', 'info');
    }

    importCharacter() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    this.loadCharacterFromData(data);
                    Helpers.showMessage('Personaje importado correctamente', 'info');
                } catch (error) {
                    console.error('Error importing character:', error);
                    Helpers.showMessage('Error al importar el archivo', 'error');
                }
            };
            reader.readAsText(file);
        };
        
        input.click();
    }

    loadAttacksFromStorage() {
        const savedAttacks = this.storage.load('attacks');
        if (savedAttacks && savedAttacks.length > 0) {
            const attacksList = document.querySelector('.attacks-list');
            const addAttackBtn = document.getElementById('addAttackBtn');
            if (attacksList) {
                const attackItems = attacksList.querySelectorAll('.attack-item');
                attackItems.forEach(item => item.remove());
                
                savedAttacks.forEach(attack => {
                    this.addAttack(attack.name, attack.bonus, attack.damage, false);
                });
            }
        }
    }

    loadCharacterFromData(data) {
        this.clearAllData();
        
        if (data.basicInfo) {
            document.getElementById('char-name').value = data.basicInfo.name || '';
            document.getElementById('char-class').value = data.basicInfo.class || '';
            document.getElementById('char-race').value = data.basicInfo.race || '';
            document.getElementById('char-bg').value = data.basicInfo.background || '';
            document.getElementById('char-align').value = data.basicInfo.alignment || '';
            this.saveBasicInfo();
        } else if (data.nombre) {
            document.getElementById('char-name').value = data.nombre || '';
            document.getElementById('char-class').value = data.clase || '';
            document.getElementById('char-race').value = data.raza || '';
        }
        
        if (data.attributes && data.attributes.length > 0) {
            this.attributeManager.attributes = [];
            data.attributes.forEach(attr => {
                const nombre = attr.name || attr.nombre || 'ATRIBUTO';
                const valor = attr.value || attr.valor || 10;
                this.attributeManager.add(nombre, valor);
            });
            setTimeout(() => {
                this.savingThrowsManager.updateFromAttributes();
            }, 100);
        } else if (data.stats?.atributos && data.stats.atributos.length > 0) {
            this.attributeManager.attributes = [];
            data.stats.atributos.forEach(attr => {
                this.attributeManager.add(attr.nombre, attr.valor);
            });
        }
        
        if (data.hp) {
            this.healthManager.setCurrent(data.hp.current || 26);
            this.healthManager.setMax(data.hp.max || 26);
            this.healthManager.setTemp(data.hp.temp || 0);
        } else if (data.stats?.hp) {
            this.healthManager.setCurrent(data.stats.hp.current || 26);
            this.healthManager.setMax(data.stats.hp.max || 26);
            this.healthManager.setTemp(data.stats.hp.temp || 0);
        }
        
        if (data.mana) {
            this.manaManager.setCurrent(data.mana.current || 2);
            this.manaManager.setMax(data.mana.max || 15);
        } else if (data.stats?.mana) {
            this.manaManager.setCurrent(data.stats.mana.current || 2);
            this.manaManager.setMax(data.stats.mana.max || 15);
        }
        
        if (data.spellSlots) {
            this.spellSlotsManager.setLevel(data.spellSlots.level || 1);
            this.spellSlotsManager.setTotal(data.spellSlots.total || 4);
            this.spellSlotsManager.setUsed(data.spellSlots.used || 0);
        }
        
        if (data.spellStats) {
            this.spellStatsManager.spellStats = { ...this.spellStatsManager.spellStats, ...data.spellStats };
            this.spellStatsManager.calculateStats();
        }
        
        if (data.stats) {
            document.getElementById('armor-class').value = data.stats.ca || 12;
            document.getElementById('speed').value = data.stats.velocidad || 30;
            document.getElementById('initiative').value = data.stats.iniciativa || 1;
        }
        
        const attacksList = document.querySelector('.attacks-list');
        const addAttackBtn = document.getElementById('addAttackBtn');
        if (attacksList) {
            const attackItems = attacksList.querySelectorAll('.attack-item');
            attackItems.forEach(item => item.remove());
            
            const attacks = data.attacks || data.ataques || [];
            attacks.forEach(attack => {
                this.addAttack(attack.name, attack.bonus, attack.damage, false);
            });
        }

        if (data.attacks && data.attacks.length > 0) {
            const attacksList = document.querySelector('.attacks-list');
            const addAttackBtn = document.getElementById('addAttackBtn');
            if (attacksList) {
                const attackItems = attacksList.querySelectorAll('.attack-item');
                attackItems.forEach(item => item.remove());
                
                data.attacks.forEach(attack => {
                    this.addAttack(attack.name, attack.bonus, attack.damage, false);
                });
                
                this.saveAttacksToStorage();
            }
        } else if (data.ataques && data.ataques.length > 0) {
            const attacksList = document.querySelector('.attacks-list');
            const addAttackBtn = document.getElementById('addAttackBtn');
            if (attacksList) {
                const attackItems = attacksList.querySelectorAll('.attack-item');
                attackItems.forEach(item => item.remove());
                
                data.ataques.forEach(attack => {
                    this.addAttack(attack.name, attack.bonus, attack.damage, false);
                });
                
                this.saveAttacksToStorage();
            }
        }
        
        const spellsList = document.getElementById('spellsList');
        if (spellsList) {
            spellsList.innerHTML = '';
            const spells = data.spells || data.conjuros || [];
            spells.forEach(spell => {
                this.spellManager.add(spell.name, spell.level, spell.description);
            });
        }
        
        if (data.exp) {
            this.expManager.setCurrent(data.exp.current || 0);
            this.expManager.setMax(data.exp.max || 300);
            this.expManager.setLevel(data.exp.level || 1);
        } else if (data.nivel) {
            this.expManager.setLevel(data.nivel || 1);
        }
        
        const inventory = data.inventario || data;
        
        if (inventory.currency || inventory.monedas) {
            const currency = inventory.currency || inventory.monedas || {};
            this.currencyManager.setGold(currency.gold || 0);
            this.currencyManager.setSilver(currency.silver || 0);
            this.currencyManager.setCopper(currency.copper || 0);
            
            if (currency.name) this.currencyManager.updateNames({
                name: currency.name,
                goldName: currency.goldName || 'Oro',
                silverName: currency.silverName || 'Plata',
                copperName: currency.copperName || 'Cobre'
            });
        }
        
        if (inventory.treasures || inventory.tesoros) {
            const treasures = inventory.treasures || inventory.tesoros || [];
            this.treasureManager.treasures = [];
            treasures.forEach(t => {
                this.treasureManager.add(t.name, t.value, t.type);
            });
        }
        
        if (inventory.potions || inventory.pociones) {
            const potions = inventory.potions || inventory.pociones || [];
            this.potionManager.potions = [];
            potions.forEach(p => {
                this.potionManager.add(p.name, p.type, p.value, p.amount);
            });
        }
        
        if (inventory.equipment || inventory.equipo) {
            const equipment = inventory.equipment || inventory.equipo || [];
            this.equipmentManager.equipment = [];
            equipment.forEach(e => {
                this.equipmentManager.add(
                    e.name, 
                    e.cost || 0, 
                    e.weight || 0, 
                    e.description || '', 
                    e.stealth || 'none', 
                    e.attribute || '', 
                    e.bonus || 0
                );
            });
        }
        
        if (data.deathSaves) {
            this.deathSavesManager.successes = data.deathSaves.successes || [false, false, false];
            this.deathSavesManager.fails = data.deathSaves.fails || [false, false, false];
            this.deathSavesManager.notify();
        }
        
         if (data.skills && data.skills.length > 0) {
        // Obtener mapa de atributos actuales
        const currentAttributes = this.attributeManager.getAll();
        const attributeMap = {};
        currentAttributes.forEach(attr => {
            attributeMap[attr.name] = attr;
            attributeMap[attr.name.toUpperCase()] = attr;
        });
        
        this.skillsManager.skills = [];
        data.skills.forEach(skill => {
            // Asegurar que el atributo esté asignado para habilidades estándar
            let attribute = skill.attribute || '';
            if (!attribute) {
                const skillNameLower = skill.name.toLowerCase();
                const SKILL_ATTRIBUTE_MAP = {
                    'acrobacias': 'DESTREZA',
                    'arcano': 'INTELIGENCIA',
                    'atletismo': 'FUERZA',
                    'engaño': 'CARISMA',
                    'historia': 'INTELIGENCIA',
                    'interpretación': 'CARISMA',
                    'intimidación': 'CARISMA',
                    'investigación': 'INTELIGENCIA',
                    'juego de manos': 'DESTREZA',
                    'medicina': 'SABIDURÍA',
                    'naturaleza': 'INTELIGENCIA',
                    'percepción': 'SABIDURÍA',
                    'perspicacia': 'SABIDURÍA',
                    'persuasión': 'CARISMA',
                    'religión': 'INTELIGENCIA',
                    'sigilo': 'DESTREZA',
                    'supervivencia': 'SABIDURÍA',
                    'trato con animales': 'SABIDURÍA'
                };
                attribute = SKILL_ATTRIBUTE_MAP[skillNameLower] || '';
            }
            
            this.skillsManager.add(skill.name, attribute);
            
            const lastSkill = this.skillsManager.skills[this.skillsManager.skills.length - 1];
            if (lastSkill) {
                lastSkill.bonus = skill.bonus || 0;
                lastSkill.proficient = skill.proficient || false;
                lastSkill.expertise = skill.expertise || false;
                lastSkill.misc = skill.misc || 0;
            }
        });
        this.skillsManager.updateAllBonuses();
        this.skillsManager.notify();
    }
        
        if (data.passivePerception !== undefined) {
            this.passivePerception = data.passivePerception;
            document.getElementById('passivePerception').value = data.passivePerception;
        }
        
        if (data.proficiencies && data.proficiencies.length > 0) {
            this.proficiencyManager.proficiencies = [];
            data.proficiencies.forEach(prof => {
                this.proficiencyManager.add(prof.name, prof.type || 'language');
            });
        }
        
        if (data.savingThrows && data.savingThrows.length > 0) {
            this.savingThrowsManager.savingThrows = data.savingThrows.map(st => ({
                name: st.name,
                value: st.value || 0,
                proficient: st.proficient || false,
                basedOn: st.basedOn || st.name,
                modifier: st.modifier || 0
            }));
            this.savingThrowsManager.updateAllValues();
            this.savingThrowsManager.notify();
        }
        
        const notas = data.notas || data;
        
        if (notas.personalidad !== undefined) {
            document.getElementById('personality').value = notas.personalidad || '';
            document.getElementById('ideals').value = notas.ideales || '';
            document.getElementById('bonds').value = notas.vinculos || '';
            document.getElementById('flaws').value = notas.defectos || '';
            document.getElementById('features').value = notas.rasgos || '';
        } else if (notas.personality) {
            document.getElementById('personality').value = notas.personality || '';
            document.getElementById('ideals').value = notas.ideals || '';
            document.getElementById('bonds').value = notas.bonds || '';
            document.getElementById('flaws').value = notas.flaws || '';
            document.getElementById('features').value = notas.features || '';
        }
        
        if (data.layout) {
            Object.entries(data.layout).forEach(([cardId, cardLayout]) => {
                const card = document.getElementById(cardId);
                if (card) {
                    if (cardLayout.width) card.style.width = cardLayout.width;
                    if (cardLayout.height) card.style.height = cardLayout.height;
                }
            });
        }
        
        setTimeout(() => {
            this.skillsManager.updateAllBonuses();
            this.savingThrowsManager.updateFromAttributes();
            this.calcularPercepcionPasiva();
            this.updateSpellStatsDisplay();
            this.syncCharacterWithWebSocket();
        }, 500);
        
        this.saveCharacter();
    }

    clearAllData() {
        if (this.attributeManager) {
            this.attributeManager.attributes = [];
        }
        
        if (this.skillsManager) {
            this.skillsManager.skills = [];
        }
        
        if (this.proficiencyManager) {
            this.proficiencyManager.proficiencies = [];
        }
        
        if (this.treasureManager) {
            this.treasureManager.treasures = [];
        }
        
        if (this.potionManager) {
            this.potionManager.potions = [];
        }
        
        if (this.equipmentManager) {
            this.equipmentManager.equipment = [];
        }
        
        if (this.spellManager) {
            this.spellManager.spells = [];
        }
        
        const attacksList = document.querySelector('.attacks-list');
        if (attacksList) {
            const attackItems = attacksList.querySelectorAll('.attack-item');
            attackItems.forEach(item => item.remove());
        }
    }

    resetAll() {
        if (confirm('¿Estás seguro? Esta acción no se puede deshacer.')) {
            this.storage.clear();
            localStorage.clear();
            location.reload();
        }
    }

    updateSavingThrows() {
        this.savingThrowsManager.updateFromAttributes();
    }

    getCharacterName() {
        return document.getElementById('char-name')?.value || 'Sin nombre';
    }

    getPlayerName() {
        if (this.userManager && this.userManager.isUserSet()) {
            return this.userManager.getUserName();
        }
        return localStorage.getItem('jugadorNombre') || 'Anónimo';
    }

    syncCharacterWithWebSocket() {
        if (!this.ws || !this.ws.isConectado()) return;
        
        const personaje = {
            nombre: this.getCharacterName(),
            clase: document.getElementById('char-class')?.value || '',
            nivel: this.expManager?.getData().level || 1,
            raza: document.getElementById('char-race')?.value || '',
            jugador: this.getPlayerName()
        };
        
        if (personaje.nombre && personaje.nombre !== 'Sin nombre') {
            this.ws.actualizarPersonaje(personaje);
        }
    }
}