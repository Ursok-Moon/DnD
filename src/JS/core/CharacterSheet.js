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
import { RichTextEditor } from '../modules/ui/RichTextEditor.js';
import { UserManager } from './UserManager.js';
import { SpeciesService } from '../services/SpeciesService.js';

// Inventory Managers
import { CurrencyManager } from '../modules/inventory/CurrencyManager.js';
import { TreasureManager } from '../modules/inventory/TreasureManager.js';
import { PotionManager } from '../modules/inventory/PotionManager.js';
import { EquipmentManager } from '../modules/inventory/EquipmentManager.js';

// Spell Managers
import { SpellSlotsManager } from '../modules/spells/SpellSlotsManager.js';
import { SpellManager } from '../modules/spells/SpellManager.js';
import { SpellUI } from '../modules/spells/SpellUI.js';
import { SpellStatsManager } from '../modules/spells/SpellStatsManager.js';

export class CharacterSheet {
    constructor(containerId = null, tabId = null) {
        this.containerId = containerId || 'hojaPrincipal';
        this.tabId = tabId || `tab-${Date.now()}`;
        
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            this.container = document.querySelector('.character-sheet');
            if (this.container) {
                this.containerId = this.container.id || 'hojaPrincipal';
            }
        }
        
        if (!this.container) {
            console.warn('⚠️ No se encontró contenedor, creando uno...');
            this.container = document.createElement('main');
            this.container.className = 'character-sheet';
            this.container.id = this.containerId;
            const contentArea = document.getElementById('tabContentArea');
            if (contentArea) {
                contentArea.appendChild(this.container);
            } else {
                document.querySelector('.parchment')?.appendChild(this.container);
            }
        }
        
        console.log(`📄 Inicializando CharacterSheet para contenedor: ${this.containerId} (tab: ${this.tabId})`);

        // ============================================================
        // ⚠️ IMPORTANTE: Usar un storage COMPARTIDO para todos los tabs
        // Esto permite que los datos persistan entre recargas
        // ============================================================
        this.storage = new StorageService('dnd_'); // SIN prefijo de tab
        this.eventBus = new EventBus();
        this.api = new ApiService();
        this.userManager = new UserManager(this.storage); 

        this.speciesService = new SpeciesService();
        this.atributosBaseGuardados = null; 
        this.razaActual = null;
        this.atributosPersonalizablesPendientes = [];
        this.richTextEditor = null;
        this._isLoadingData = false;
        this._isInitialLoad = true;
        this._dataLoaded = false;
        this._isSaving = false;
        this._saveQueue = [];
        this._lastSaveTime = 0;
        this._saveDebounceTimer = null;
        
        this.ws = null;
        this.waitForWebSocket();
        
        this.initManagers();
        this.initUI();

        // CARGAR DATOS GUARDADOS
        requestAnimationFrame(() => {
            setTimeout(() => {
                this.loadSavedCharacterData();
            }, 100);
        });

        this.setupPeriodicAutoSave();

        setTimeout(() => {
            this.createAIImportButton();
        }, 500);
        
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
        
        console.log(`✅ CharacterSheet inicializado para ${this.containerId}`);
    }

    // ===== MÉTODO DE UTILIDAD =====
    $(selector) {
        return this.container.querySelector(selector);
    }

    $$(selector) {
        return this.container.querySelectorAll(selector);
    }

    // ===== INICIALIZACIÓN DE MANAGERS =====
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
        
        this.imageManager = new ImageManager(this.api, this.eventBus, this.storage, this.container);
        this.dragDropManager = new DragDropManager(this.storage);
        this.resizeManager = new ResizeManager(this.storage);
        this.loadAttacksFromStorage();
    }

    // ===== INICIALIZACIÓN DE UI =====
    initUI() {
        this.attributeUI = new AttributeUI(
            this.attributeManager, 
            this.colorManager, 
            this.eventBus,
            this.container  
        );
        
        this.spellUI = new SpellUI(
            this.spellManager, 
            this.spellSlotsManager, 
            this.eventBus,
            this.container  
        );

        if (this.spellManager) {
            setTimeout(() => {
                this.spellManager.setupAutocomplete();
            }, 500);
        }
        
        // Limpiar duplicados de conjuros al iniciar
        setTimeout(() => {
            this.cleanupDuplicateSpells();
        }, 100);
        
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
        this.setupRaceAutocomplete();
        this.setupRaceClearHandler();
        this.initRichTextEditor();
        this.setupProficiencyBonusDisplay();
        this.setupPassivePerceptionConfig();
        
        this.setupColorCustomizer();
        this.setupTextColorCustomizer();
    }

    setupColorCustomizer() {
        const btn = document.querySelector('#colorCustomizerBtn');
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                this.showColorCustomizer();
            });
        }
    }

    setupTextColorCustomizer() {
        const btn = document.querySelector('#textCustomizerBtn');
        if (btn) {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            newBtn.addEventListener('click', () => {
                this.showTextColorCustomizer();
            });
        }
    }

    // ===== REFRESH =====
    refresh() {
        console.log(`🔄 Recargando hoja ${this.containerId}`);
        
        if (this.attributeManager) {
            this.attributeManager.notify();
        }
        if (this.healthManager) {
            this.healthManager.notify();
        }
        if (this.manaManager) {
            this.manaManager.notify();
        }
        if (this.skillsManager) {
            this.skillsManager.notify();
        }
        if (this.proficiencyManager) {
            this.proficiencyManager.notify();
        }
        if (this.savingThrowsManager) {
            this.savingThrowsManager.notify();
        }
        if (this.expManager) {
            this.expManager.notify();
        }
        if (this.currencyManager) {
            this.currencyManager.notify();
        }
        if (this.spellSlotsManager) {
            this.spellSlotsManager.notify();
        }
        if (this.spellStatsManager) {
            this.spellStatsManager.calculateStats();
            this.spellStatsManager.notify();
        }
        if (this.spellManager) {
            this.spellManager.notify();
        }
        if (this.deathSavesManager) {
            this.deathSavesManager.notify();
        }
        if (this.treasureManager) {
            this.treasureManager.notify();
        }
        if (this.potionManager) {
            this.potionManager.notify();
        }
        if (this.equipmentManager) {
            this.equipmentManager.notify();
        }
        
        this.loadAttacksFromStorage();
        this.calcularPercepcionPasiva();
        this.updateSpellStatsDisplay();
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

    // ===== MÉTODO PARA ANALIZAR PDF CON IA =====
    async analyzePDFWithAI(pdfFile) {
        if (!pdfFile || pdfFile.type !== 'application/pdf') {
            Helpers.showMessage('Por favor, selecciona un archivo PDF válido', 'error');
            return null;
        }

        console.log('📄 Iniciando análisis de PDF:', pdfFile.name);

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

        const loadingDiv = this.showLoadingIndicator('Analizando PDF...');

        try {
            const formData = new FormData();
            formData.append('pdf', pdfFile);
            
            const response = await fetch('/api/ai/analyze-pdf', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `Error HTTP ${response.status}`);
            }

            if (result.success && result.analysis) {
                let jsonString = result.analysis;
                jsonString = jsonString.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                
                const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    throw new Error('No se encontró JSON válido en la respuesta');
                }
                
                const characterData = JSON.parse(jsonMatch[0]);
                const validatedData = this.validateCharacterData(characterData);
                
                this.loadCharacterFromData(validatedData);
                
                Helpers.showMessage('✅ Personaje generado desde PDF correctamente', 'success');
                
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
        }
    }

    // ===== VALIDAR DATOS DEL PERSONAJE =====
    validateCharacterData(data) {
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
        
        result.attributes.forEach(attr => {
            if (attr.valor && (attr.modificador === undefined || attr.modificador === null)) {
                attr.modificador = Math.floor((attr.valor - 10) / 2);
            }
        });
        
        const attributeMap = {};
        result.attributes.forEach(attr => {
            const nombreKey = attr.nombre.toUpperCase();
            attributeMap[nombreKey] = attr;
            attributeMap[attr.nombre] = attr;
        });
        
        const defaultSkills = [
            'Acrobacias', 'Arcano', 'Atletismo', 'Engaño', 'Historia',
            'Interpretación', 'Intimidación', 'Investigación', 'Juego de Manos',
            'Medicina', 'Naturaleza', 'Percepción', 'Perspicacia', 'Persuasión',
            'Religión', 'Sigilo', 'Supervivencia', 'Trato con Animales'
        ];
        
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
                
                if (!skill.attribute || skill.attribute === '') {
                    const assignedAttribute = SKILL_ATTRIBUTE_MAP[skillNameLower];
                    if (assignedAttribute) {
                        skill.attribute = assignedAttribute;
                    }
                }
                
                skill.proficient = skill.proficient || false;
                skill.expertise = skill.expertise || false;
                skill.misc = skill.misc || 0;
                
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
                }
            });
            
            result.skills = processedSkills;
        }
        
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

    hideLoadingIndicator(element) {
        if (element && element.parentNode) {
            element.remove();
        }
    }

    createAIImportButton() {
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
        
        const importBtn = document.getElementById('importBtn');
        if (importBtn) {
            importBtn.insertAdjacentElement('afterend', aiButton);
        } else {
            container.appendChild(aiButton);
        }
        
        console.log('✅ Botón creado correctamente');
    }

    async ensureUserIsSet() {
        if (document.readyState === 'loading') {
            await new Promise(resolve => {
                document.addEventListener('DOMContentLoaded', resolve);
            });
        }
        
        if (!this.userManager.isUserSet()) {
            await this.userManager.showUserPrompt();
        }
        
        this.updatePlayerNameDisplay();
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

    // ============================================================
    // ===== MÉTODOS DE CARGA Y GUARDADO - CORREGIDOS =====
    // ============================================================

    /**
     * Carga los datos guardados del personaje
     */
    async loadSavedCharacterData() {
        if (this._isLoadingData || this._dataLoaded) return;
        this._isLoadingData = true;

        try {
            console.log(`📂 Cargando datos para ${this.tabId}...`);
            
            // 1. INTENTAR CARGAR DESDE LOCALSTORAGE (compartido)
            const localData = this.loadFromLocalStorage();
            if (localData) {
                console.log(`✅ Datos cargados desde localStorage`);
                this._dataLoaded = true;
                this._isLoadingData = false;
                this._isInitialLoad = false;
                return true;
            }
            
            // 2. INTENTAR CARGAR DESDE EL SERVIDOR
            const serverData = await this.loadFromServer();
            if (serverData) {
                console.log(`✅ Datos cargados desde servidor`);
                this.storage.save('characterData', serverData);
                this._dataLoaded = true;
                this._isLoadingData = false;
                this._isInitialLoad = false;
                return true;
            }
            
            // 3. Si no hay datos, cargar valores por defecto
            console.log(`📂 No se encontraron datos, cargando defaults...`);
            this.loadDefaults();
            
            this._dataLoaded = true;
            this._isLoadingData = false;
            this._isInitialLoad = false;
            return false;
            
        } catch (error) {
            console.error('❌ Error cargando datos:', error);
            this._isLoadingData = false;
            this._isInitialLoad = false;
            return false;
        }
    }

    /**
     * Carga valores por defecto
     */
    loadDefaults() {
        this.attributeManager.loadDefaults();
        this.skillsManager.loadDefaults();
        this.healthManager.setCurrent(26);
        this.healthManager.setMax(26);
        this.healthManager.setTemp(0);
        this.manaManager.setCurrent(2);
        this.manaManager.setMax(15);
        this.expManager.setCurrent(0);
        this.expManager.setMax(300);
        this.expManager.setLevel(1);
        this.currencyManager.reset();
        this.deathSavesManager.reset();
        
        this.treasureManager.treasures = [];
        this.potionManager.potions = [];
        this.equipmentManager.equipment = [];
        this.spellManager.spells = [];
        this.proficiencyManager.proficiencies = [];
        
        this.refresh();
    }

    /**
     * Carga datos desde localStorage (usando storage COMPARTIDO)
     */
    loadFromLocalStorage() {
        try {
            const savedData = this.storage.load('characterData');
            if (savedData && savedData.nombre) {
                console.log(`📂 Cargando datos locales: ${savedData.nombre}`);
                this.loadCharacterFromData(savedData);
                
                const savedImage = this.storage.load('imagenUrl');
                if (savedImage && this.imageManager) {
                    this.imageManager.currentImageUrl = savedImage;
                    this.imageManager.displayImage(savedImage);
                }
                
                return savedData;
            }
            return null;
        } catch (error) {
            console.warn('⚠️ Error cargando desde localStorage:', error);
            return null;
        }
    }

    /**
     * Carga datos desde el servidor
     */
    async loadFromServer() {
        try {
            const response = await fetch('/api/personajes/ultimo');
            if (!response.ok) {
                console.warn('⚠️ No se pudo cargar desde el servidor:', response.status);
                return null;
            }
            
            const result = await response.json();
            
            if (result.success && result.personaje) {
                console.log(`📂 Cargando personaje desde servidor: ${result.personaje.nombre}`);
                this.loadCharacterFromData(result.personaje);
                return result.personaje;
            }
            
            return null;
        } catch (error) {
            console.warn('⚠️ No se pudo cargar desde servidor:', error);
            return null;
        }
    }

    /* CARGA DATOS EN LA HOJA - SIN GUARDAR AUTOMÁTICAMENTE */

loadCharacterFromData(data) {
    console.log('Cargando datos en la hoja...');
    
    // 1. INFORMACIÓN BÁSICA - CORREGIDO
    const charName = this.$('#char-name');
    const charClass = this.$('#char-class');
    const charRace = this.$('#char-race');
    const charBg = this.$('#char-bg');
    const charAlign = this.$('#char-align');
    
    if (data.basicInfo) {
        if (charName) charName.value = data.basicInfo.name || '';
        if (charClass) charClass.value = data.basicInfo.class || '';
        if (charRace) charRace.value = data.basicInfo.race || '';
        if (charBg) charBg.value = data.basicInfo.background || data.basicInfo.trasfondo || '';
        if (charAlign) charAlign.value = data.basicInfo.alignment || data.basicInfo.alineamiento || '';
    } else {
        if (charName) charName.value = data.nombre || '';
        if (charClass) charClass.value = data.clase || '';
        if (charRace) charRace.value = data.raza || '';
        if (charBg) charBg.value = data.trasfondo || '';
        if (charAlign) charAlign.value = data.alineamiento || '';
    }
    
    // Asegurar que trasfondo y alineamiento se guarden en storage
    if (charBg && charBg.value) {
        this.storage.save('trasfondo', charBg.value);
    }
    if (charAlign && charAlign.value) {
        this.storage.save('alineamiento', charAlign.value);
    }
    
    if (charName && charName.value) {
        this.eventBus.emit('characterNameChanged', charName.value);
    }
    
    // 2. IMAGEN - CORREGIDO
    if (data.imagen && this.imageManager) {
        console.log('🖼️ Cargando imagen:', data.imagen);
        this.storage.save('imagenUrl', data.imagen);
        this.imageManager.currentImageUrl = data.imagen;
        this.imageManager.displayImage(data.imagen);
    } else if (data.imagen) {
        // Si no hay imageManager pero hay imagen, guardarla
        console.log('🖼️ Guardando URL de imagen en storage:', data.imagen);
        this.storage.save('imagenUrl', data.imagen);
    }
    
    // 3. ATRIBUTOS
    if (data.attributes || data.stats?.atributos) {
        const attributes = data.attributes || data.stats.atributos || [];
        this.attributeManager.attributes = [];
        
        attributes.forEach(attr => {
            const name = attr.name || attr.nombre || 'ATRIBUTO';
            const value = attr.value || attr.valor || 10;
            this.attributeManager.add(name, value);
        });
        
        if (this.attributeManager.attributes.length === 0) {
            this.attributeManager.loadDefaults();
        }
        
        this.attributeManager.save();
        this.attributeManager.notify();
    }
    
    // 4. HP
    if (data.hp || data.stats?.hp) {
        const hp = data.hp || data.stats.hp;
        this.healthManager.setCurrent(hp.current || 26);
        this.healthManager.setMax(hp.max || 26);
        this.healthManager.setTemp(hp.temp || 0);
    }
    
    // 5. MANÁ
    if (data.mana || data.stats?.mana) {
        const mana = data.mana || data.stats.mana;
        this.manaManager.setCurrent(mana.current || 0);
        this.manaManager.setMax(mana.max || 15);
    }
    
    // 6. EXPERIENCIA
    if (data.exp) {
        this.expManager.setCurrent(data.exp.current || 0);
        this.expManager.setMax(data.exp.max || 300);
        if (data.exp.level) this.expManager.setLevel(data.exp.level);
    } else if (data.nivel) {
        this.expManager.setLevel(data.nivel);
    }
    
    // 7. STATS DE COMBATE
    if (data.stats) {
        const armorClass = this.$('#armor-class');
        const speed = this.$('#speed');
        const initiative = this.$('#initiative');
        
        if (armorClass) armorClass.value = data.stats.ca || 10;
        if (speed) speed.value = data.stats.velocidad || 30;
        if (initiative) initiative.value = data.stats.iniciativa || 1;
    }
    
    // 8. ATAQUES
    const attacks = data.attacks || data.ataques || [];
    if (attacks.length > 0) {
        const attacksList = this.$('.attacks-list');
        if (attacksList) {
            const existingItems = attacksList.querySelectorAll('.attack-item');
            existingItems.forEach(item => item.remove());
            
            attacks.forEach(attack => {
                this.addAttack(attack.name, attack.bonus, attack.damage, false);
            });
            
            this.saveAttacksToStorage();
        }
    }
    
    // 9. CONJUROS - CON DEDUPLICACIÓN Y CONTROL DE DUPLICADOS
    const spells = data.spells || data.conjuros || [];
    if (spells.length > 0) {
        const spellsList = this.$('#spellsList');
        
        // Solo limpiar si es la primera carga o si no hay conjuros
        if (this._isInitialLoad || this.spellManager.spells.length === 0) {
            if (spellsList) {
                // No limpiar completamente, solo eliminar si está vacío
                const existingItems = spellsList.querySelectorAll('.spell-item');
                if (existingItems.length === 0) {
                    spellsList.innerHTML = '';
                }
            }
        }
        
        // Añadir conjuros sin duplicar
        spells.forEach(spell => {
            const spellName = spell.name || '';
            const spellLevel = spell.level || '0';
            
            // Verificar si ya existe en el manager
            const exists = this.spellManager.spells.some(s => 
                s.name.toLowerCase() === spellName.toLowerCase() &&
                String(s.level) === String(spellLevel)
            );
            
            if (!exists && spellName.trim() !== '') {
                this.spellManager.add(spellName, spellLevel, spell.description || '');
            }
        });
    }
    
    // 10. INVENTARIO
    const inventory = data.inventario || data;
    
    if (inventory.currency || inventory.monedas) {
        const currency = inventory.currency || inventory.monedas || {};
        this.currencyManager.setGold(currency.gold || 0);
        this.currencyManager.setSilver(currency.silver || 0);
        this.currencyManager.setCopper(currency.copper || 0);
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
    
    // 11. SALVACIONES DE MUERTE
    if (data.deathSaves) {
        this.deathSavesManager.successes = data.deathSaves.successes || [false, false, false];
        this.deathSavesManager.fails = data.deathSaves.fails || [false, false, false];
        this.deathSavesManager.notify();
    }
    
    // 12. HABILIDADES
    if (data.skills && data.skills.length > 0) {
        this.skillsManager.skills = [];
        data.skills.forEach(skill => {
            const attr = skill.attribute || this.getSkillDefaultAttribute(skill.name) || '';
            this.skillsManager.add(skill.name, attr);
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
    
    // 13. COMPETENCIAS
    if (data.proficiencies && data.proficiencies.length > 0) {
        this.proficiencyManager.proficiencies = [];
        data.proficiencies.forEach(prof => {
            this.proficiencyManager.add(prof.name, prof.type || 'language');
        });
    }
    
    // 14. TIRADAS DE SALVACIÓN
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
    
    // 15. PERCEPCIÓN PASIVA
    if (data.passivePerceptionAttribute) {
    this.storage.save('passivePerceptionAttribute', data.passivePerceptionAttribute);
    // Poblar el select después de que los atributos estén cargados
    setTimeout(() => {
        this.populatePassivePerceptionSelect();
        this.calcularPercepcionPasiva();
    }, 200);
    }
    
    // 16. SLOTS DE CONJUROS
    if (data.spellSlots) {
        this.spellSlotsManager.setLevel(data.spellSlots.level || 1);
        this.spellSlotsManager.setTotal(data.spellSlots.total || 4);
        this.spellSlotsManager.setUsed(data.spellSlots.used || 0);
    }
    
    // 17. STATS DE CONJUROS
    if (data.spellStats) {
        this.spellStatsManager.spellStats = { ...this.spellStatsManager.spellStats, ...data.spellStats };
        this.spellStatsManager.calculateStats();
    }
    
    // 18. NOTAS / RASGOS 
    const notas = data.notas || data;
    const personality = this.$('#personality');
    const ideals = this.$('#ideals');
    const bonds = this.$('#bonds');
    const flaws = this.$('#flaws');
    const features = this.$('#features');

    // Usar tanto 'rasgos' como 'features' para compatibilidad
    const rasgosValue = notas.rasgos || notas.features || '';

    if (personality) personality.value = notas.personalidad || notas.personality || '';
    if (ideals) ideals.value = notas.ideales || notas.ideals || '';
    if (bonds) bonds.value = notas.vinculos || notas.bonds || '';
    if (flaws) flaws.value = notas.defectos || notas.flaws || '';
    if (features) features.value = rasgosValue;

    // Guardar en storage para persistencia
    if (personality?.value || ideals?.value || bonds?.value || flaws?.value || features?.value) {
        this.storage.save('traits', {
            personality: personality?.value || '',
            ideals: ideals?.value || '',
            bonds: bonds?.value || '',
            flaws: flaws?.value || '',
            features: features?.value || ''
        });
    }

    // ===== NUEVO: Convertir a Rich Text después de cargar los datos =====
    // Si hay datos y el editor no se ha inicializado, convertirlo ahora
    const hasTraitData = rasgosValue || personality?.value || ideals?.value || bonds?.value || flaws?.value;
    if (hasTraitData) {
        setTimeout(() => {
            this.convertRichTextAfterLoad();
        }, 200);
    }
    
    // 19. COLORES PERSONALIZADOS 
    if (data.colores_personalizados) {
        console.log('🎨 Cargando colores personalizados:', data.colores_personalizados);
        
        const colors = data.colores_personalizados;
        const colorsToSave = {};
        
        // Colores del tema
        const themeColorKeys = ['background', 'parchment', 'accent', 'mana', 'hp', 'exp', 'gems', 'tabBar'];
        themeColorKeys.forEach(key => {
            if (colors[key]) {
                colorsToSave[key] = colors[key];
                this.colorManager.setThemeColor(key, colors[key]);
            }
        });
        
        // Guardar todos los colores en storage
        if (Object.keys(colorsToSave).length > 0) {
            this.storage.save('characterColors', colorsToSave);
        }
        
        // Colores de texto
        if (colors.textColors && typeof colors.textColors === 'object') {
            const textColorsToSave = {};
            const textColorKeys = ['title', 'subtitle', 'label', 'input', 'number', 'modifier'];
            textColorKeys.forEach(key => {
                if (colors.textColors[key]) {
                    textColorsToSave[key] = colors.textColors[key];
                }
            });
            
            if (Object.keys(textColorsToSave).length > 0) {
                this.storage.save('characterTextColors', textColorsToSave);
                this.colorManager.setAllTextColors(textColorsToSave);
            }
        }
        
        // TabBar - asegurar que se aplica
        if (colors.tabBar) {
            document.documentElement.style.setProperty('--tab-bar-bg', colors.tabBar);
            this.storage.save('tabBarColor', colors.tabBar);
        } else if (colors.parchment) {
            document.documentElement.style.setProperty('--tab-bar-bg', colors.parchment);
            this.storage.save('tabBarColor', colors.parchment);
        }
    }
    
    // 20. LAYOUT
    if (data.layout) {
        Object.entries(data.layout).forEach(([cardId, cardLayout]) => {
            const card = document.getElementById(cardId);
            if (card) {
                if (cardLayout.width) card.style.width = cardLayout.width;
                if (cardLayout.height) card.style.height = cardLayout.height;
            }
        });
    }
    
    // 21. REFRESCAR UI - CON UN SOLO GUARDADO AL FINAL
    setTimeout(() => {
        this.skillsManager.updateAllBonuses();
        this.savingThrowsManager.updateFromAttributes();
        this.calcularPercepcionPasiva();
        this.updateSpellStatsDisplay();
        this.refresh();
        
        this._dataLoaded = true;
        this._isInitialLoad = false;
        
        // Solo un guardado después de cargar
        setTimeout(() => {
            this.saveCharacter();
        }, 500);
    }, 300);
    
    console.log('✅ Datos cargados correctamente');
}

    getSkillDefaultAttribute(skillName) {
        const map = {
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
        return map[skillName.toLowerCase()] || '';
    }

    /**
     * GUARDAR PERSONAJE - CON DEBOUNCE
     */
    async saveCharacter() {
        if (this._isLoadingData) {
            console.log('⏳ Cargando datos, omitiendo guardado...');
            return;
        }

        if (this._isSaving) {
            console.log('⏳ Guardado en progreso...');
            return new Promise((resolve) => {
                this._saveQueue.push(resolve);
            });
        }

        // Debounce: 1 segundo entre guardados
        const now = Date.now();
        if (now - this._lastSaveTime < 1000) {
            if (this._saveDebounceTimer) {
                clearTimeout(this._saveDebounceTimer);
            }
            this._saveDebounceTimer = setTimeout(() => {
                this._saveDebounceTimer = null;
                this.saveCharacter();
            }, 500);
            return;
        }

        this._isSaving = true;
        this._lastSaveTime = now;

        try {
            const personajeNombre = this.$('#char-name')?.value?.trim() || 'Sin nombre';
            
            if (personajeNombre === 'Sin nombre' || personajeNombre === '') {
                this._isSaving = false;
                return;
            }
            
            const clase = this.$('#char-class')?.value || '';
            const raza = this.$('#char-race')?.value || '';
            const trasfondo = this.$('#char-bg')?.value || '';
            const alineamiento = this.$('#char-align')?.value || '';
            const jugadorNombre = this.getPlayerName();
            
            if (jugadorNombre === 'Aventurero' || jugadorNombre === 'Anónimo') {
                await this.userManager.showUserPrompt();
                const nuevoNombre = this.getPlayerName();
                if (nuevoNombre === 'Aventurero' || nuevoNombre === 'Anónimo') {
                    Helpers.showMessage('Por favor ingresa tu nombre para guardar el personaje', 'warning');
                    this._isSaving = false;
                    return;
                }
            }

            const inventoryCard = this.$('#card-inventory');
            const isInventoryCollapsed = inventoryCard ? inventoryCard.classList.contains('collapsed') : false;
            
            const imagenUrl = this.storage.load('imagenUrl') || null;
            
            const atributosDOM = [];
            this.$$('.attribute-item').forEach(item => {
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
                personalidad: this.$('#personality')?.value || '',
                ideales: this.$('#ideals')?.value || '',
                vinculos: this.$('#bonds')?.value || '',
                defectos: this.$('#flaws')?.value || '',
                rasgos: this.$('#features')?.value || ''
            };
            
            const coloresGuardados = JSON.parse(localStorage.getItem('characterColors') || '{}');
            const textColorsGuardados = JSON.parse(localStorage.getItem('characterTextColors') || '{}');
            
            const layout = {};
            this.$$('.card').forEach((card, index) => {
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
                    tabBar: coloresGuardados.tabBar || null,
                    textColors: textColorsGuardados
                },
                stats: {
                    hp: this.healthManager.getData(),
                    mana: this.manaManager.getData(),
                    ca: parseInt(this.$('#armor-class')?.value) || 12,
                    velocidad: parseInt(this.$('#speed')?.value) || 30,
                    iniciativa: parseInt(this.$('#initiative')?.value) || 1,
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
                passivePerceptionAttribute: this.getPassivePerceptionAttribute(),
                proficiencies: this.proficiencyManager.getAll(),
                savingThrows: this.savingThrowsManager.getAll(),
                notas: notas,
                layout: layout,
                fecha_creacion: new Date().toISOString(),
                version: '3.2',
                tabId: this.tabId
            };
            
            // Guardar en storage COMPARTIDO
            this.storage.save('characterData', characterData);
            this.storage.save('personajeNombre', personajeNombre);
            this.storage.save('basicInfo', {
                name: personajeNombre,
                class: clase,
                race: raza,
                background: trasfondo,
                alignment: alineamiento
            });
            this.storage.save('traits', notas);
            this.storage.save('passivePerception', this.passivePerception);
            
            if (imagenUrl) {
                this.storage.save('imagenUrl', imagenUrl);
            }
            
            // Guardar en el servidor
            try {
                const result = await this.api.saveCharacter(characterData);
                
                if (result.success) {
                    console.log(`✅ Personaje "${personajeNombre}" guardado (${this.tabId})`);
                    this.showSaveConfirmation();
                    
                    if (result.data && result.data.id) {
                        localStorage.setItem('lastCharacterId', result.data.id);
                    }
                    localStorage.setItem('lastCharacterName', personajeNombre);
                } else {
                    console.error('❌ Error guardando personaje:', result.error);
                }
            } catch (error) {
                console.error('❌ Error inesperado:', error);
            }
            
            // Sincronizar con WebSocket
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
                    timestamp: new Date().toISOString(),
                    tabId: this.tabId
                };
                
                window.wsClient.emit('personaje-guardado', {
                    personaje: notificacionCompleta
                });
                
                window.wsClient.actualizarPersonaje(notificacionCompleta);
            }
            
        } finally {
            this._isSaving = false;
            
            while (this._saveQueue.length > 0) {
                const resolve = this._saveQueue.shift();
                resolve();
            }
        }
    }

    // ===== REFRESCAR PERSONAJE DESDE EL SERVIDOR =====
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

    // ===== CONFIGURAR LISTENERS DE WEBSOCKET =====
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

    // ===== INICIALIZAR RICH TEXT EDITOR =====
    initRichTextEditor() {
    // Solo crear el editor si los textareas existen y no han sido convertidos
    const textareaIds = ['personality', 'ideals', 'bonds', 'flaws', 'features'];
    let hasContent = false;
    
    textareaIds.forEach(id => {
        const textarea = document.getElementById(id);
        if (textarea && textarea.value && textarea.value.trim() !== '') {
            hasContent = true;
        }
    });
    
    // Si hay contenido, no convertir inmediatamente (se convertirá después de cargar)
    if (hasContent) {
        console.log('⏳ Los textareas tienen contenido, esperando carga para convertir...');
        // Guardar referencia para convertir después
        this._pendingRichTextConversion = true;
        return;
    }
    
    this.richTextEditor = new RichTextEditor();
    this.richTextEditor.initRichTextAreas();
    
    const textareaIds2 = ['personality', 'ideals', 'bonds', 'flaws', 'features'];
    textareaIds2.forEach(id => {
        const textarea = this.$(`#${id}`);
        if (textarea) {
            textarea.addEventListener('change', () => {
                if (this.hasValidCharacterName()) {
                    this.saveCharacter();
                }
            });
        }
    });
    
    console.log('✅ Rich Text Editor inicializado sin contenido previo');
}

convertRichTextAfterLoad() {
    // Si ya hay un editor, actualizar su contenido
    if (this.richTextEditor) {
        const textareaIds = ['personality', 'ideals', 'bonds', 'flaws', 'features'];
        textareaIds.forEach(id => {
            const textarea = document.getElementById(id);
            if (textarea && textarea.value) {
                // El editor ya existe, solo actualizar el contenido
                const editorData = this.richTextEditor.textareas.get(id);
                if (editorData) {
                    editorData.editor.innerHTML = textarea.value;
                    editorData.textarea.value = textarea.value;
                }
            }
        });
        console.log('✅ Rich Text Editor actualizado con datos cargados');
        return;
    }
    
    // Crear nuevo editor
    this.richTextEditor = new RichTextEditor();
    this.richTextEditor.initRichTextAreas();
    this._pendingRichTextConversion = false;
    
    // Agregar event listeners para auto-guardado
    const textareaIds = ['personality', 'ideals', 'bonds', 'flaws', 'features'];
    textareaIds.forEach(id => {
        const textarea = this.$(`#${id}`);
        if (textarea) {
            textarea.addEventListener('change', () => {
                if (this.hasValidCharacterName()) {
                    this.saveCharacter();
                }
            });
        }
    });
    
    console.log('✅ Rich Text Editor creado después de cargar datos');
}

    // ===== CONFIGURAR AUTOCOMPLETADO DE RAZAS =====
    async setupRaceAutocomplete() {
        const raceInput = this.$('#char-race');
        if (!raceInput) return;
        
        await this.speciesService.loadSpecies();
        const speciesList = this.speciesService.getSpeciesDenominaciones();
        
        let resultsList = this.$('#raceSearchResults');
        if (!resultsList) {
            resultsList = document.createElement('ul');
            resultsList.id = 'raceSearchResults';
            resultsList.className = 'search-results';
            
            resultsList.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                max-height: 200px;
                overflow-y: auto;
                background: white;
                border: 2px solid var(--accent-gold);
                border-radius: 4px;
                list-style: none;
                padding: 0;
                margin: 0;
                z-index: 10000;
                display: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            
            if (raceInput.parentNode) {
                raceInput.parentNode.style.position = 'relative';
                raceInput.parentNode.appendChild(resultsList);
            }
        }
        
        const inputHandler = (e) => {
            const searchTerm = raceInput.value.toLowerCase().trim();
            resultsList.innerHTML = '';
            
            if (searchTerm.length === 0) {
                resultsList.style.display = 'none';
                return;
            }
            
            const filtered = speciesList.filter(item => {
                const itemText = item.text.toLowerCase();
                if (itemText === searchTerm) return true;
                if (itemText.startsWith(searchTerm)) return true;
                const words = itemText.split(/\s+/);
                if (words.some(word => word === searchTerm)) return true;
                if (words.some(word => word.startsWith(searchTerm))) return true;
                if (searchTerm.length >= 3 && itemText.includes(searchTerm)) return true;
                return false;
            }).slice(0, 15);
            
            if (filtered.length > 0) {
                filtered.forEach(item => {
                    const li = document.createElement('li');
                    
                    let highlightedText = item.text;
                    const escapedSearch = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(`(${escapedSearch})`, 'gi');
                    highlightedText = item.text.replace(regex, '<span class="highlight">$1</span>');
                    
                    li.innerHTML = `
                        <div style="display: flex; flex-direction: column;">
                            <span>${highlightedText}</span>
                            <small style="color: var(--ink-light); font-size: 0.7rem;">
                                ${item.book ? `📖 ${item.book}` : ''}
                                ${item.publisher ? ` • ${item.publisher}` : ''}
                            </small>
                        </div>
                    `;
                    
                    li.style.cssText = `
                        padding: 10px 15px;
                        cursor: pointer;
                        border-bottom: 1px solid var(--parchment-dark);
                        font-family: 'Cinzel', serif;
                        transition: background 0.2s ease;
                    `;
                    
                    li.addEventListener('mouseover', () => {
                        li.style.background = 'var(--parchment-light)';
                    });
                    
                    li.addEventListener('mouseout', () => {
                        li.style.background = 'white';
                    });
                    
                    li.addEventListener('click', () => {
                        raceInput.value = item.text;
                        const especieCompleta = this.speciesService.getSpeciesByName(item.text);
                        this.cargarDatosRaza(especieCompleta || item);
                        resultsList.style.display = 'none';
                    });
                    
                    resultsList.appendChild(li);
                });
                resultsList.style.display = 'block';
            } else {
                resultsList.style.display = 'none';
            }
        };
        
        raceInput.removeEventListener('input', this._boundRaceInputHandler);
        this._boundRaceInputHandler = inputHandler;
        raceInput.addEventListener('input', this._boundRaceInputHandler);
        
        raceInput.addEventListener('change', async () => {
            const value = raceInput.value.trim();
            if (value) {
                const especieCompleta = this.speciesService.getSpeciesByName(value);
                if (especieCompleta) {
                    this.cargarDatosRaza(especieCompleta);
                }
            }
        });
        
        const documentClickHandler = (e) => {
            if (e.target !== raceInput && !resultsList.contains(e.target)) {
                resultsList.style.display = 'none';
            }
        };
        
        document.removeEventListener('click', this._boundRaceDocumentClickHandler);
        this._boundRaceDocumentClickHandler = documentClickHandler;
        document.addEventListener('click', this._boundRaceDocumentClickHandler);
    }

    // ===== CARGAR DATOS DE RAZA =====
    cargarDatosRaza(speciesItem) {
    const raceInput = this.$('#char-race');
    if (raceInput) raceInput.value = speciesItem.text || speciesItem.name;
    
    let especieCompleta = speciesItem;
    if (!speciesItem.description && speciesItem.text) {
        especieCompleta = this.speciesService.getSpeciesByName(speciesItem.text);
    }
    
    const nombreRaza = especieCompleta?.name || especieCompleta?.text;
    if (this.razaActual === nombreRaza) {
        console.log('Misma raza seleccionada, omitiendo cambios');
        return;
    }
    
    if (this.razaActual && this.atributosBaseGuardados) {
        this.restaurarAtributosBase();
    }
    
    this.razaActual = nombreRaza;
    
    // ✅ ACTUALIZAR VELOCIDAD (speed)
    if (especieCompleta) {
        const speedInput = this.$('#speed');
        if (speedInput && especieCompleta.speed !== undefined && especieCompleta.speed !== null) {
            const newSpeed = parseInt(especieCompleta.speed) || 30;
            speedInput.value = newSpeed;
            console.log(`🏃 Velocidad actualizada: ${newSpeed} pies`);
        }
        
        // ✅ ACTUALIZAR RASGOS ESPECIALES (features)
        const featuresTextarea = this.$('#features');
        if (featuresTextarea) {
            let descripcion = '';
            
            // Nombre de la especie
            const nombreEspecie = especieCompleta.name || especieCompleta.text || 'Especie sin nombre';
            descripcion += `🧬 ${nombreEspecie}\n`;
            
            // Descripción completa
            if (especieCompleta.description) {
                descripcion += `\n${especieCompleta.description}\n`;
            }
            
            // Rasgos raciales (properties)
            if (especieCompleta.properties) {
                descripcion += `\n--- 📋 RASGOS RACIALES ---\n`;
                for (const [key, value] of Object.entries(especieCompleta.properties)) {
                    if (key !== 'Category') {
                        descripcion += `• ${key}: ${value}\n`;
                    }
                }
            }
            
            // Atributos (mostrar como +X al modificador)
            if (especieCompleta.atributos) {
                descripcion += `\n--- 📊 INCREMENTOS DE ATRIBUTOS ---\n`;
                for (const [attr, valor] of Object.entries(especieCompleta.atributos)) {
                    if (typeof valor === 'number' && valor > 0) {
                        descripcion += `• ${attr}: +${valor} al modificador (${valor * 2} puntos)\n`;
                    }
                }
            }
            
            // Velocidad
            if (especieCompleta.speed !== undefined && especieCompleta.speed !== null) {
                descripcion += `\n--- 🏃 VELOCIDAD ---\n`;
                descripcion += `• ${especieCompleta.speed} pies\n`;
            }
            
            // Libro y editorial
            if (especieCompleta.book || especieCompleta.publisher) {
                descripcion += `\n--- 📖 FUENTE ---\n`;
                if (especieCompleta.book) descripcion += `• Libro: ${especieCompleta.book}\n`;
                if (especieCompleta.publisher) descripcion += `• Editorial: ${especieCompleta.publisher}\n`;
            }
            
            // ✅ ACTUALIZAR TANTO textarea COMO editor rich text
            const descripcionTrimmed = descripcion.trim();
            
            // 1. Actualizar textarea (siempre existe)
            featuresTextarea.value = descripcionTrimmed;
            
            // 2. Si hay un editor rich text, actualizar su contenido
            if (this.richTextEditor) {
                // Buscar el editor para 'features'
                const editorData = this.richTextEditor.textareas.get('features');
                if (editorData && editorData.editor) {
                    // Convertir saltos de línea a <br> para el editor
                    const htmlContent = descripcionTrimmed.replace(/\n/g, '<br>');
                    editorData.editor.innerHTML = htmlContent;
                    console.log('✅ Rich Text Editor actualizado con la descripción');
                } else {
                    // Si no hay editor en el mapa, intentar buscarlo por el contenedor
                    const container = document.querySelector('.rich-editor-container[data-id="features"]');
                    if (container) {
                        const editorDiv = container.querySelector('.rich-editor-content');
                        if (editorDiv) {
                            const htmlContent = descripcionTrimmed.replace(/\n/g, '<br>');
                            editorDiv.innerHTML = htmlContent;
                            console.log('✅ Rich Text Editor encontrado por selector y actualizado');
                        }
                    }
                }
            }
            
            // 3. Disparar evento change para guardar
            featuresTextarea.dispatchEvent(new Event('change', { bubbles: true }));
            
            console.log(`📝 Información de ${nombreEspecie} cargada en Rasgos Especiales`);
        }
        
        // Aplicar atributos
        if (especieCompleta.atributos) {
            this.aplicarAtributosDeEspecie(especieCompleta.atributos);
        }
        
        if (especieCompleta.properties && especieCompleta.properties['Ability Score Increase']) {
            this.aplicarAtributosDeEspecie(especieCompleta.properties['Ability Score Increase']);
        }
        
        this.verificarAtributosPersonalizables(especieCompleta);
        
        // ✅ Guardar después de actualizar
        if (this.hasValidCharacterName()) {
            setTimeout(() => {
                this.saveCharacter();
            }, 300);
        }
    }
}

    // ===== VERIFICAR ATRIBUTOS PERSONALIZABLES =====
    verificarAtributosPersonalizables(especieCompleta) {
    const atributos = especieCompleta.atributos || 
                      especieCompleta.properties?.['Ability Score Increase'];
    
    if (!atributos) return;
    
    const atributosParaElegir = [];
    let tieneIncrementoFijo = false;
    let mensajeAtributos = [];
    
    for (const [attr, valor] of Object.entries(atributos)) {
        if (typeof valor === 'number' && valor > 0 && valor <= 3) {
            const nombreNormalizado = attr.toLowerCase();
            // ✅ DETECTAR ATRIBUTOS PERSONALIZABLES
            const esPersonalizable = 
                nombreNormalizado === 'cualquier' || 
                nombreNormalizado === 'elige' || 
                nombreNormalizado === 'personalizable' ||
                nombreNormalizado === 'any' ||
                nombreNormalizado === 'choose' ||
                nombreNormalizado === 'custom' ||
                // También si el nombre es "Dos atributos +1" o similar
                attr.includes('cualquier') ||
                attr.includes('elige') ||
                attr.includes('personalizable') ||
                attr.includes('any') ||
                attr.includes('choose');
            
            if (esPersonalizable) {
                // ✅ Es personalizable → mostrar modal
                atributosParaElegir.push({ atributo: null, valor });
            } else {
                // ✅ Es fijo → aplicar automáticamente
                tieneIncrementoFijo = true;
                const nombreAttr = this.normalizarNombreAtributo(attr);
                mensajeAtributos.push(`${nombreAttr} +${valor} al modificador`);
            }
        }
    }
    
    // ✅ SI HAY ATRIBUTOS PERSONALIZABLES → mostrar modal
    if (atributosParaElegir.length > 0) {
        this.mostrarModalSeleccionAtributos(atributosParaElegir);
        return;
    }
    
    // ✅ SI SOLO HAY ATRIBUTOS FIJOS → mensaje informativo
    if (tieneIncrementoFijo && mensajeAtributos.length > 0) {
        const mensaje = `✨ Atributos aplicados: ${mensajeAtributos.join(', ')}`;
        Helpers.showMessage(mensaje, 'success');
        console.log(`📊 ${mensaje}`);
    }
}

// ✅ MÉTODO AUXILIAR para normalizar nombres de atributos
normalizarNombreAtributo(nombre) {
    const mapa = {
        'fuerza': 'Fuerza',
        'str': 'Fuerza',
        'strength': 'Fuerza',
        'destreza': 'DESTREZA',
        'dex': 'DESTREZA',
        'dexterity': 'DESTREZA',
        'agilidad': 'AGILIDAD',
        'constitución': 'CONSTITUCIÓN',
        'con': 'CONSTITUCIÓN',
        'constitution': 'CONSTITUCIÓN',
        'aguante': 'AGUANTE',
        'inteligencia': 'INTELIGENCIA',
        'int': 'INTELIGENCIA',
        'intelligence': 'INTELIGENCIA',
        'sabiduría': 'SABIDURÍA',
        'wis': 'SABIDURÍA',
        'wisdom': 'SABIDURÍA',
        'espíritu': 'ESPÍRITU',
        'carisma': 'CARISMA',
        'cha': 'CARISMA',
        'charisma': 'CARISMA'
    };
    
    const lower = nombre.toLowerCase();
    return mapa[lower] || nombre;
}

    // ===== MOSTRAR MODAL DE SELECCIÓN DE ATRIBUTOS =====
    mostrarModalSeleccionAtributos(atributosParaElegir) {
        let modal = document.getElementById('atributosModal');
        if (modal) modal.remove();
        
        modal = document.createElement('div');
        modal.id = 'atributosModal';
        modal.className = 'modal';
        modal.style.display = 'flex';
        
        const atributosDisponibles = this.attributeManager.getAll().map(attr => ({
            id: attr.id,
            name: attr.name,
            currentValue: attr.value
        }));
        
        if (atributosDisponibles.length === 0) {
            const defaultAttrs = ['Fuerza', 'DESTREZA', 'CONSTITUCIÓN', 'INTELIGENCIA', 'SABIDURÍA', 'CARISMA'];
            defaultAttrs.forEach(name => {
                this.attributeManager.add(name, 10);
            });
            atributosDisponibles.length = 0;
            this.attributeManager.getAll().forEach(attr => {
                atributosDisponibles.push({ id: attr.id, name: attr.name, currentValue: attr.value });
            });
        }
        
        let html = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-dice-d20"></i> Aumentar Atributos</h3>
                    <button class="modal-close" id="closeAtributosModal">&times;</button>
                </div>
                <div class="modal-body">
                    <p>Esta especie te permite aumentar tus atributos. Elige dónde aplicar los siguientes incrementos:</p>
        `;
        
        for (const item of atributosParaElegir) {
            html += `
                <div class="atributo-choice-group" style="margin-bottom: 20px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                    <label style="font-weight: bold; color: var(--accent-gold);">
                        <i class="fas fa-arrow-up"></i> +${item.valor} punto${item.valor !== 1 ? 's' : ''}
                    </label>
                    <select class="atributo-choice-select" data-valor="${item.valor}" style="width: 100%; margin-top: 8px; padding: 8px; border-radius: 6px; border: 1px solid var(--accent-gold); background: var(--parchment-light);">
                        <option value="">Selecciona un atributo...</option>
            `;
            
            atributosDisponibles.forEach(attr => {
                html += `<option value="${attr.id}" data-name="${attr.name}" data-current="${attr.currentValue}">${attr.name} (actual: ${attr.currentValue})</option>`;
            });
            
            html += `
                    </select>
                </div>
            `;
        }
        
        html += `
                </div>
                <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; padding: 15px;">
                    <button type="button" class="btn-secondary btn-cancel" id="cancelAtributosBtn">Cancelar</button>
                    <button type="button" class="btn-secondary" id="confirmAtributosBtn" style="background: #4CAF50;">Aplicar</button>
                </div>
            </div>
        `;
        
        modal.innerHTML = html;
        document.body.appendChild(modal);
        
        const closeModal = () => modal.remove();
        document.getElementById('closeAtributosModal')?.addEventListener('click', closeModal);
        document.getElementById('cancelAtributosBtn')?.addEventListener('click', closeModal);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
        document.getElementById('confirmAtributosBtn')?.addEventListener('click', () => {
    const selects = modal.querySelectorAll('.atributo-choice-select');
    let seleccionesValidas = true;
    const atributosAAplicar = [];
    
    selects.forEach(select => {
        const valorModificador = parseInt(select.dataset.valor); // +1 o +2 al modificador
        const attrId = select.value;
        const attrName = select.options[select.selectedIndex]?.dataset?.name;
        
        if (!attrId) {
            seleccionesValidas = false;
            select.style.borderColor = '#ff4444';
            return;
        }
        select.style.borderColor = 'var(--accent-gold)';
        atributosAAplicar.push({ 
            id: parseInt(attrId), 
            name: attrName, 
            // ✅ Multiplicamos por 2 para obtener el incremento en valor
            incrementoValor: valorModificador * 2 
        });
    });
    
    if (!seleccionesValidas) {
        Helpers.showMessage('Por favor, selecciona todos los atributos', 'warning');
        return;
    }
    
    for (const item of atributosAAplicar) {
        const attr = this.attributeManager.getById(item.id);
        if (attr) {
            const nuevoValor = (attr.value || 10) + item.incrementoValor;
            const valorLimitado = Math.min(30, Math.max(1, nuevoValor));
            console.log(`📈 Aplicando +${item.incrementoValor} a ${item.name}: ${attr.value} → ${valorLimitado}`);
            this.attributeManager.update(item.id, { value: valorLimitado });
        }
    }
            
            this.attributeUI?.render(this.attributeManager.getAll());
            this.savingThrowsManager?.updateFromAttributes();
            this.calcularPercepcionPasiva();
            
            closeModal();
            Helpers.showMessage('✅ Atributos actualizados correctamente', 'success');
            
            if (this.hasValidCharacterName()) {
                this.saveCharacter();
            }
        });
    }

    // ===== APLICAR ATRIBUTOS DE ESPECIE =====
aplicarAtributosDeEspecie(atributos) {
    if (!atributos || typeof atributos !== 'object') return;
    
    if (!this.atributosBaseGuardados) {
        this.guardarAtributosBase();
    }
    
    console.log('📊 Aplicando atributos de especie:', atributos);
    
    // ✅ MAPA COMPLETO DE ATRIBUTOS
    const nombreMap = {
        'fuerza': 'Fuerza',
        'str': 'Fuerza',
        'strength': 'Fuerza',
        'destreza': 'DESTREZA',
        'dex': 'DESTREZA',
        'dexterity': 'DESTREZA',
        'agilidad': 'AGILIDAD',
        'constitución': 'CONSTITUCIÓN',
        'con': 'CONSTITUCIÓN',
        'constitution': 'CONSTITUCIÓN',
        'aguante': 'AGUANTE',
        'inteligencia': 'INTELIGENCIA',
        'int': 'INTELIGENCIA',
        'intelligence': 'INTELIGENCIA',
        'sabiduría': 'SABIDURÍA',
        'wis': 'SABIDURÍA',
        'wisdom': 'SABIDURÍA',
        'espíritu': 'ESPÍRITU',
        'carisma': 'CARISMA',
        'cha': 'CARISMA',
        'charisma': 'CARISMA'
    };
    
    const atributosFijos = {};
    const atributosPersonalizables = [];
    
    for (const [nombreAttr, incremento] of Object.entries(atributos)) {
        if (typeof incremento !== 'number') continue;
        
        const nombreNormalizado = nombreMap[nombreAttr.toLowerCase()] || nombreAttr;
        const nombreLower = nombreAttr.toLowerCase();
        
        // ✅ DETECTAR si es personalizable
        const esPersonalizable = 
            nombreLower === 'cualquier' || 
            nombreLower === 'elige' || 
            nombreLower === 'personalizable' ||
            nombreLower === 'any' ||
            nombreLower === 'choose' ||
            nombreLower === 'custom' ||
            nombreAttr.includes('cualquier') ||
            nombreAttr.includes('elige') ||
            nombreAttr.includes('personalizable') ||
            nombreAttr.includes('any') ||
            nombreAttr.includes('choose');
        
        // Si es personalizable, guardar para el modal
        if (esPersonalizable) {
            atributosPersonalizables.push({ 
                originalName: nombreAttr, 
                incremento, 
                esPersonalizable: true 
            });
        } else {
            // Es un atributo fijo
            const attrName = nombreMap[nombreAttr.toLowerCase()] || nombreAttr;
            atributosFijos[attrName] = incremento;
        }
    }
    
    // APLICAR ATRIBUTOS FIJOS
    const atributosActuales = this.attributeManager.getAll();
    
    for (const [nombreAttr, incrementoModificador] of Object.entries(atributosFijos)) {
        // Buscar el atributo existente o crearlo
        let attrExistente = atributosActuales.find(attr => 
            attr.name === nombreAttr || 
            attr.name.toUpperCase() === nombreAttr.toUpperCase()
        );
        
        const incrementoValor = incrementoModificador * 2;
        
        if (attrExistente) {
            const valorActual = attrExistente.value || 10;
            const nuevoValor = valorActual + incrementoValor;
            const valorLimitado = Math.min(30, Math.max(1, nuevoValor));
            
            console.log(`📈 Aplicando ${nombreAttr}: +${incrementoModificador} al modificador → +${incrementoValor} al valor (${valorActual} → ${valorLimitado})`);
            this.attributeManager.update(attrExistente.id, { value: valorLimitado });
        } else {
            // Si no existe, crear con valor base 10 + incremento * 2
            const nuevoValor = 10 + incrementoValor;
            const valorLimitado = Math.min(30, Math.max(1, nuevoValor));
            console.log(`➕ Creando nuevo atributo: ${nombreAttr} con valor ${valorLimitado} (modificador +${incrementoModificador})`);
            this.attributeManager.add(nombreAttr, valorLimitado);
        }
    }
    
    // Si hay personalizables, se mostrará el modal desde verificarAtributosPersonalizables
    if (atributosPersonalizables.length > 0) {
        this.atributosPersonalizablesPendientes = atributosPersonalizables;
    }
    
    this.attributeUI?.render(this.attributeManager.getAll());
    this.savingThrowsManager?.updateFromAttributes();
    this.calcularPercepcionPasiva();
    
    if (this.hasValidCharacterName()) {
        this.saveCharacter();
    }
}

    // ===== GUARDAR ATRIBUTOS BASE =====
    guardarAtributosBase() {
        const atributosActuales = this.attributeManager.getAll();
        this.atributosBaseGuardados = atributosActuales.map(attr => ({
            id: attr.id,
            name: attr.name,
            value: attr.value,
            modifier: attr.modifier
        }));
        console.log('💾 Atributos base guardados:', this.atributosBaseGuardados);
    }

    // ===== RESTAURAR ATRIBUTOS BASE =====
    restaurarAtributosBase() {
        if (!this.atributosBaseGuardados) return;
        
        console.log('🔄 Restaurando atributos base...');
        
        const idsBase = new Set(this.atributosBaseGuardados.map(a => a.id));
        const atributosActuales = this.attributeManager.getAll();
        
        for (const attr of atributosActuales) {
            if (!idsBase.has(attr.id)) {
                console.log(`🗑️ Eliminando atributo extra: ${attr.name}`);
                this.attributeManager.remove(attr.id);
            }
        }
        
        for (const attrBase of this.atributosBaseGuardados) {
            const attrActual = this.attributeManager.getById(attrBase.id);
            if (attrActual) {
                if (attrActual.value !== attrBase.value) {
                    console.log(`📊 Restaurando ${attrBase.name}: ${attrActual.value} -> ${attrBase.value}`);
                    this.attributeManager.update(attrBase.id, { value: attrBase.value });
                }
            } else {
                console.log(`➕ Recreando atributo base: ${attrBase.name}`);
                this.attributeManager.add(attrBase.name, attrBase.value);
            }
        }
        
        this.attributeUI?.render(this.attributeManager.getAll());
    }

    // ===== CONFIGURAR EVENTOS DE STATS DE CONJUROS =====
    setupSpellStatsEvents() {
        const spellcastingAbilitySelect = this.$('#spellcastingAbility');
        const preparedSpellsInput = this.$('#preparedSpells');
        const cantripsKnownInput = this.$('#cantripsKnown');
        
        this.populateSpellcastingAbilitySelect();
        
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
        
        this.spellStatsManager.subscribe(() => {
            this.updateSpellStatsDisplay();
        });
        
        this.eventBus.on('attributeChanged', () => {
            this.spellStatsManager.calculateStats();
            this.updateSpellStatsDisplay();
        });
        
        this.eventBus.on('expChanged', () => {
            this.spellStatsManager.calculateStats();
            this.updateSpellStatsDisplay();
        });
        
        this.updateSpellStatsDisplay();
    }

    populateSpellcastingAbilitySelect() {
        const select = this.$('#spellcastingAbility');
        if (!select) return;
        
        const attributes = this.attributeManager.getAll();
        const currentValue = this.spellStatsManager.getData().spellcastingAbility;
        
        let selectedValue = currentValue;
        const attributeExists = attributes.some(attr => attr.name === currentValue);
        if (!attributeExists && attributes.length > 0) {
            selectedValue = attributes[0].name;
            if (selectedValue !== currentValue) {
                this.spellStatsManager.setSpellcastingAbility(selectedValue);
            }
        }
        
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
        
        const saveDC = this.$('#spellSaveDC');
        const attackBonus = this.$('#spellAttackBonus');
        const preparedSpellsInput = this.$('#preparedSpells');
        const maxPreparedSpan = this.$('#maxPreparedSpells');
        const cantripsKnownInput = this.$('#cantripsKnown');
        const spellcastingAbilitySelect = this.$('#spellcastingAbility');
        
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
        
        if (spellcastingAbilitySelect && spellcastingAbilitySelect.value != stats.spellcastingAbility) {
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

    // ===== CONFIGURAR EVENTOS DE SALVACIONES DE MUERTE =====
    setupDeathSavesEvents() {
        const successCheckboxes = this.$$('.death-save-success');
        const failCheckboxes = this.$$('.death-save-fail');
        
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

    // ===== CONFIGURAR EVENTOS DE MONEDAS =====
    setupCurrencyEvents() {
        const goldInput = this.$('#goldAmount');
        const silverInput = this.$('#silverAmount');
        const copperInput = this.$('#copperAmount');
        
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

    // ===== CONFIGURAR EVENTOS DE ATRIBUTOS =====
    setupAttributeEvents() {
        this.eventBus.on('attributeChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
        
        this.eventBus.on('attributeNameChanged', () => {
            if (this.hasValidCharacterName()) this.saveCharacter();
        });
    }

    // ===== CONFIGURAR EVENTOS DE ATAQUES =====
    setupAttackEvents() {
        const attacksList = this.$('.attacks-list');
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
        
        this.$$('.attack-item').forEach(item => {
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

    // ===== CONFIGURAR EVENTOS DE CONJUROS - CON DEDUPLICACIÓN =====
    setupSpellEvents() {
        const spellsList = this.$('#spellsList');
        if (spellsList) {
            // Usar un Set para rastrear IDs ya procesados
            const processedIds = new Set();
            
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        mutation.addedNodes.forEach(node => {
                            if (node.classList && node.classList.contains('spell-item')) {
                                const id = node.dataset.id;
                                // Evitar procesar el mismo nodo múltiples veces
                                if (id && !processedIds.has(id)) {
                                    processedIds.add(id);
                                    this.setupSpellItemEvents(node);
                                }
                            }
                        });
                    }
                });
            });
            
            observer.observe(spellsList, { childList: true, subtree: true });
        }
        
        this.$$('#spellsList .spell-item').forEach(item => {
            this.setupSpellItemEvents(item);
        });
        
        this.eventBus.on('spellsChanged', () => {
            if (this.hasValidCharacterName()) {
                this.saveCharacter();
            }
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

    // ===== LIMPIAR CONJUROS DUPLICADOS =====
    cleanupDuplicateSpells() {
        if (!this.spellManager) return;
        
        const uniqueSpells = new Map();
        const duplicates = [];
        
        this.spellManager.spells.forEach(spell => {
            const key = `${spell.name.toLowerCase()}|${spell.level}`;
            if (!uniqueSpells.has(key)) {
                uniqueSpells.set(key, spell);
            } else {
                duplicates.push(spell.id);
            }
        });
        
        if (duplicates.length > 0) {
            console.log(`🧹 Eliminando ${duplicates.length} conjuros duplicados`);
            duplicates.forEach(id => {
                this.spellManager.remove(id);
            });
            this.spellManager.save();
        }
    }

    // ===== CONFIGURAR AUTO-GUARDADO - CON DEBOUNCE =====
    setupAutoSave() {
        let saveTimeout;
        const debouncedSave = () => {
            if (!this.hasValidCharacterName()) return;
            if (this._isSaving) return;
            
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.saveCharacter();
            }, 500);
        };
        
        this.eventBus.on('attributeChanged', () => {
            debouncedSave();
        });
        
        this.eventBus.on('attributeNameChanged', () => {
            debouncedSave();
        });

        this.eventBus.on('healthChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('manaChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('skillsChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('proficienciesChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('savingThrowsChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('expChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('deathSavesChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('currencyChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('treasuresChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('potionsChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('equipmentChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('spellSlotsChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('spellStatsChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        this.eventBus.on('imageChanged', () => {
            if (this.hasValidCharacterName()) debouncedSave();
        });
        
        this.setupCombatStatsAutoSave();
        this.setupTraitsAutoSave();
    }

    hasValidCharacterName() {
        const charName = this.$('#char-name')?.value?.trim();
        return charName && charName !== '' && charName !== 'Sin nombre';
    }

    // ===== MOSTRAR MODAL PARA AÑADIR COMPETENCIA =====
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

    // ===== CONFIGURAR SUSCRIPCIONES =====
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
            const activeTab = this.container.querySelector('.proficiency-tab.active');
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
            const levelDisplay = this.$('#level-display');
            const characterLevel = this.$('#character-level');
            if (levelDisplay) levelDisplay.textContent = level;
            if (characterLevel) characterLevel.value = level;
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
        
        this.eventBus.on('imageChanged', (imageUrl) => {
            if (this.hasValidCharacterName()) {
                this.saveCharacter();
            }
        });
    }

    // ===== CONFIGURAR BOTONES DE AÑADIR =====
    setupAddButtons() {
        const addSkillBtn = this.$('#addSkillBtn');
        if (addSkillBtn) {
            addSkillBtn.addEventListener('click', () => {
                const name = prompt('Nombre de la habilidad:');
                if (name) {
                    const attribute = prompt('Atributo asociado (FUERZA, DESTREZA, etc.) opcional:');
                    this.skillsManager.add(name, attribute || '');
                }
            });
        }
        
        const addProficiencyBtn = this.$('#addProficiencyBtn');
        if (addProficiencyBtn) {
            addProficiencyBtn.addEventListener('click', () => {
                this.showAddProficiencyModal();
            });
        }

        const addTreasureBtn = this.$('#addTreasureBtn');
        if (addTreasureBtn) {
            addTreasureBtn.addEventListener('click', () => {
                this.showAddTreasureModal();
            });
        }

        const addPotionBtn = this.$('#addPotionBtn');
        if (addPotionBtn) {
            addPotionBtn.addEventListener('click', () => {
                this.showAddPotionModal();
            });
        }

        const addEquipmentBtn = this.$('#addEquipmentBtn');
        if (addEquipmentBtn) {
            addEquipmentBtn.addEventListener('click', () => {
                this.showAddEquipmentModal();
            });
        }

        const addAttackBtn = this.$('#addAttackBtn');
        if (addAttackBtn) {
            addAttackBtn.addEventListener('click', () => {
                this.addAttack();
            });
        }

        const addSpellBtn = this.$('#addSpellBtn');
        if (addSpellBtn) {
            addSpellBtn.addEventListener('click', () => {
                this.spellManager.add();
            });
        }
        
        const addAttributeBtn = this.$('#addAttributeBtn');
        if (addAttributeBtn) {
            addAttributeBtn.addEventListener('click', () => {
                this.attributeManager.add();
                Helpers.showMessage('Atributo añadido', 'info');
            });
        }
    }

    // ===== CONFIGURAR EVENTOS GLOBALES =====
setupGlobalEvents() {
    // Tabs de competencias
    this.$$('.proficiency-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            this.$$('.proficiency-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const type = tab.dataset.type;
            const proficiencies = this.proficiencyManager.getByType(type);
            this.renderProficiencies(proficiencies);
        });
    });
    
    // ===== BOTONES DEL FOOTER =====
    const exportBtn = document.querySelector('#exportBtn');
    const importBtn = document.querySelector('#importBtn');
    const saveBtn = document.querySelector('#saveBtn');
    const resetBtn = document.querySelector('#resetBtn');
    
    if (exportBtn) {
        const newExport = exportBtn.cloneNode(true);
        exportBtn.parentNode.replaceChild(newExport, exportBtn);
        newExport.addEventListener('click', () => {
            this.exportCharacter();
        });
    }
    
    if (importBtn) {
        const newImport = importBtn.cloneNode(true);
        importBtn.parentNode.replaceChild(newImport, importBtn);
        newImport.addEventListener('click', () => {
            this.importCharacter();
        });
    }
    
    if (saveBtn) {
        const newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        newSave.addEventListener('click', () => {
            this.saveCharacter();
        });
    }
    
    if (resetBtn) {
        const newReset = resetBtn.cloneNode(true);
        resetBtn.parentNode.replaceChild(newReset, resetBtn);
        newReset.addEventListener('click', () => {
            if (confirm('¿Restablecer toda la hoja? Se perderán los cambios no guardados.')) {
                this.resetAll();
            }
        });
    }
    
    // ===== BOTONES DE CONFIGURACIÓN =====
    const configManaBtn = this.$('#configManaBtn');
    if (configManaBtn) {
        const newBtn = configManaBtn.cloneNode(true);
        configManaBtn.parentNode.replaceChild(newBtn, configManaBtn);
        newBtn.addEventListener('click', () => {
            this.showManaConfig();
        });
    }

    const setupACConfigBtn = () => {
    // Buscar si ya existe un botón de configuración de CA
    let acConfigBtn = document.getElementById('acConfigBtn');
    if (!acConfigBtn) {
        // Buscar el contenedor de estadísticas de combate
        const combatStats = document.querySelector('.combat-grid');
        if (combatStats) {
            const statDiv = combatStats.querySelector('.combat-stat:first-child');
            if (statDiv) {
                const statDisplay = statDiv.querySelector('.stat-display');
                if (statDisplay) {
                    // Añadir botón de configuración
                    const configBtn = document.createElement('button');
                    configBtn.id = 'acConfigBtn';
                    configBtn.type = 'button';
                    configBtn.className = 'btn-config-resource';
                    configBtn.style.cssText = 'position: absolute; right: 5px; top: 5px; background: none; border: none; color: var(--accent-gold, #d4af37); cursor: pointer; font-size: 0.8rem; padding: 2px 6px;';
                    configBtn.innerHTML = '<i class="fas fa-cog"></i>';
                    configBtn.title = 'Configurar Clase de Armadura';
                    
                    statDisplay.style.position = 'relative';
                    statDisplay.appendChild(configBtn);
                    
                    configBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.showACConfig();
                    });
                }
            }
        }
    }
};

// Llamar después de que la UI esté cargada
setTimeout(setupACConfigBtn, 500);
    
    const configExpBtn = this.$('#configExpBtn');
    if (configExpBtn) {
        const newBtn = configExpBtn.cloneNode(true);
        configExpBtn.parentNode.replaceChild(newBtn, configExpBtn);
        newBtn.addEventListener('click', () => {
            this.showExpConfig();
        });
    }
    
    const configSlotsBtn = this.$('#configSlotsBtn');
    if (configSlotsBtn) {
        const newBtn = configSlotsBtn.cloneNode(true);
        configSlotsBtn.parentNode.replaceChild(newBtn, configSlotsBtn);
        newBtn.addEventListener('click', () => {
            this.showSpellSlotsConfig();
        });
    }
    
    const configCurrencyBtn = this.$('#configCurrencyBtn');
    if (configCurrencyBtn) {
        const newBtn = configCurrencyBtn.cloneNode(true);
        configCurrencyBtn.parentNode.replaceChild(newBtn, configCurrencyBtn);
        newBtn.addEventListener('click', () => {
            this.showCurrencyConfig();
        });
    }
    
    // ===== BOTONES DE NIVEL =====
    const levelUpBtn = this.$('#level-up-btn');
    if (levelUpBtn) {
        const newBtn = levelUpBtn.cloneNode(true);
        levelUpBtn.parentNode.replaceChild(newBtn, levelUpBtn);
        newBtn.addEventListener('click', () => {
            this.expManager.changeLevel(1);
        });
    }
    
    const levelDownBtn = this.$('#level-down-btn');
    if (levelDownBtn) {
        const newBtn = levelDownBtn.cloneNode(true);
        levelDownBtn.parentNode.replaceChild(newBtn, levelDownBtn);
        newBtn.addEventListener('click', () => {
            this.expManager.changeLevel(-1);
        });
    }

    // ===== INPUTS DE EXPERIENCIA =====
    const currentExpInput = this.$('#current-exp');
    const maxExpInput = this.$('#max-exp');
    if (currentExpInput) {
        const newCurrentExp = currentExpInput.cloneNode(true);
        currentExpInput.parentNode.replaceChild(newCurrentExp, currentExpInput);
        
        newCurrentExp.addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 0;
            this.expManager.setCurrent(value);
        });
    }

    if (maxExpInput) {
        const newMaxExp = maxExpInput.cloneNode(true);
        maxExpInput.parentNode.replaceChild(newMaxExp, maxExpInput);
        
        newMaxExp.addEventListener('change', (e) => {
            const value = parseInt(e.target.value) || 1;
            this.expManager.setMax(value);
        });
    }
    
    // ===== CONTROLES DE MANÁ =====
    const manaPlusBtn = this.$('#manaPlusBtn');
    if (manaPlusBtn) {
        const newBtn = manaPlusBtn.cloneNode(true);
        manaPlusBtn.parentNode.replaceChild(newBtn, manaPlusBtn);
        newBtn.addEventListener('click', () => {
            this.manaManager.modify(1);
        });
    }
    
    const manaMinusBtn = this.$('#manaMinusBtn');
    if (manaMinusBtn) {
        const newBtn = manaMinusBtn.cloneNode(true);
        manaMinusBtn.parentNode.replaceChild(newBtn, manaMinusBtn);
        newBtn.addEventListener('click', () => {
            this.manaManager.modify(-1);
        });
    }
    
    const manaInput = this.$('#manaInput');
    if (manaInput) {
        const newInput = manaInput.cloneNode(true);
        manaInput.parentNode.replaceChild(newInput, manaInput);
        newInput.addEventListener('change', (e) => {
            this.manaManager.setCurrent(parseInt(e.target.value) || 0);
        });
    }
    
    // ===== INPUTS DE HP =====
    const currentHp = this.$('#current-hp');
    if (currentHp) {
        const newInput = currentHp.cloneNode(true);
        currentHp.parentNode.replaceChild(newInput, currentHp);
        newInput.addEventListener('change', (e) => {
            this.healthManager.setCurrent(parseInt(e.target.value) || 0);
        });
    }
    
    const maxHp = this.$('#max-hp');
    if (maxHp) {
        const newInput = maxHp.cloneNode(true);
        maxHp.parentNode.replaceChild(newInput, maxHp);
        newInput.addEventListener('change', (e) => {
            this.healthManager.setMax(parseInt(e.target.value) || 1);
        });
    }
    
    const tempHp = this.$('#temp-hp');
    if (tempHp) {
        const newInput = tempHp.cloneNode(true);
        tempHp.parentNode.replaceChild(newInput, tempHp);
        newInput.addEventListener('change', (e) => {
            this.healthManager.setTemp(parseInt(e.target.value) || 0);
        });
    }
    
    // ============================================================
    // ===== MODALES - CONFIGURACIÓN CON EVENT DELEGATION =====
    // ============================================================
    
    // 1. Cerrar modales con botón X (usando event delegation en el documento)
    document.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.modal-close');
        if (closeBtn) {
            const modal = closeBtn.closest('.modal');
            if (modal) {
                modal.style.display = 'none';
                e.preventDefault();
                e.stopPropagation();
            }
        }
    });
    
    // 2. Cerrar modales haciendo clic en el fondo (overlay)
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // 3. Cerrar modales con tecla ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal').forEach(modal => {
                if (modal.style.display === 'flex') {
                    modal.style.display = 'none';
                }
            });
        }
    });
}

    closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        return true;
    }
    return false;
}

    // ===== ACTUALIZAR DISPLAY DE VIDA =====
    updateHealthDisplay(data) {
        const currentHP = this.$('#current-hp');
        const maxHP = this.$('#max-hp');
        const hpBarFill = this.$('#hpBarFill');
        const hpCurrentLabel = this.$('#hpCurrentLabel');
        const hpMaxLabel = this.$('#hpMaxLabel');
        const tempHP = this.$('#temp-hp');
        
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

    // ===== ACTUALIZAR DISPLAY DE MANÁ =====
    updateManaDisplay(data) {
        const manaInput = this.$('#manaInput');
        const currentManaSpan = this.$('#currentMana');
        const maxManaSpan = this.$('#maxMana');
        const manaBarFill = this.$('#manaBarFill');
        
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

    // ===== ACTUALIZAR DISPLAY DE SALVACIONES DE MUERTE =====
    updateDeathSavesDisplay(data) {
        const successCheckboxes = this.$$('.death-save-success');
        const failCheckboxes = this.$$('.death-save-fail');
        
        data.successes.forEach((checked, index) => {
            if (successCheckboxes[index]) successCheckboxes[index].checked = checked;
        });
        
        data.fails.forEach((checked, index) => {
            if (failCheckboxes[index]) failCheckboxes[index].checked = checked;
        });
    }

    // ===== CARGAR RASGOS DESDE STORAGE =====
    loadTraitsFromStorage() {
        const savedData = this.storage.load('traits');
        if (savedData) {
            const personality = this.$('#personality');
            const ideals = this.$('#ideals');
            const bonds = this.$('#bonds');
            const flaws = this.$('#flaws');
            const features = this.$('#features');
            
            if (personality) personality.value = savedData.personality || '';
            if (ideals) ideals.value = savedData.ideals || '';
            if (bonds) bonds.value = savedData.bonds || '';
            if (flaws) flaws.value = savedData.flaws || '';
            if (features) features.value = savedData.features || '';
        }
    }

    // ===== CARGAR SALVACIONES DE MUERTE DESDE STORAGE =====
    loadDeathSavesFromStorage() {
        const saved = this.storage.load('deathSaves');
        if (saved) {
            this.deathSavesManager.successes = saved.successes || [false, false, false];
            this.deathSavesManager.fails = saved.fails || [false, false, false];
            this.deathSavesManager.notify();
        }
    }

    // ===== CARGAR PERCEPCIÓN PASIVA DESDE STORAGE =====
    loadPassivePerceptionFromStorage() {
        const saved = this.storage.load('passivePerception');
        if (saved) {
            this.passivePerception = saved;
            const perceptionInput = this.$('#passivePerception');
            if (perceptionInput) perceptionInput.value = saved;
        }
        setTimeout(() => {
            this.calcularPercepcionPasiva();
        }, 500);
    }

    // ===== ACTUALIZAR DISPLAY DE EXPERIENCIA =====
    updateExpDisplay(data) {
        const currentExp = this.$('#current-exp');
        const maxExp = this.$('#max-exp');
        const expBarFill = this.$('#expBarFill');
        const expCurrentLabel = this.$('#expCurrentLabel');
        const expMaxLabel = this.$('#expMaxLabel');
        const expPercentage = this.$('#expPercentage');
        const levelDisplay = this.$('#level-display');
        const characterLevel = this.$('#character-level');
        
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

    // ===== ACTUALIZAR DISPLAY DE MONEDAS =====
    updateCurrencyDisplay(data) {
        const currencyName = this.$('#currencyName');
        if (currencyName) currencyName.textContent = data.name;
        
        const goldLabel = this.$('.currency-item:first-child label');
        const silverLabel = this.$('.currency-item:nth-child(2) label');
        const copperLabel = this.$('.currency-item:last-child label');
        
        if (goldLabel) {
            goldLabel.innerHTML = `<i class="fas fa-circle" style="color: #ffd700;"></i> ${data.goldName}`;
        }
        if (silverLabel) {
            silverLabel.innerHTML = `<i class="fas fa-circle" style="color: #c0c0c0;"></i> ${data.silverName}`;
        }
        if (copperLabel) {
            copperLabel.innerHTML = `<i class="fas fa-circle" style="color: #b87333;"></i> ${data.copperName}`;
        }
        
        const goldInput = this.$('#goldAmount');
        const silverInput = this.$('#silverAmount');
        const copperInput = this.$('#copperAmount');
        
        if (goldInput && goldInput.value != data.gold) goldInput.value = data.gold;
        if (silverInput && silverInput.value != data.silver) silverInput.value = data.silver;
        if (copperInput && copperInput.value != data.copper) copperInput.value = data.copper;
    }

    // ===== RENDERIZAR HABILIDADES =====
    renderSkills(skills) {
        const container = this.$('#skillsContainer');
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
            
            const editBtn = item.querySelector('.skill-edit-btn');
            editBtn.addEventListener('click', () => {
                this.showEditSkillModal(skill);
            });
            
            item.querySelector('.btn-remove-skill').addEventListener('click', () => {
                if (confirm('¿Eliminar esta habilidad?')) {
                    this.skillsManager.remove(skill.id);
                }
            });
        });
    }

    // ===== RENDERIZAR TIRADAS DE SALVACIÓN =====
    renderSavingThrows(savingThrows) {
        const container = this.$('#savingThrowsContainer');
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

    // ===== RENDERIZAR COMPETENCIAS =====
    renderProficiencies(proficiencies) {
        const container = this.$('#proficienciesContainer');
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

    // ===== ABRIR MODAL DE EDICIÓN DE COMPETENCIA =====
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

    // ===== RENDERIZAR TESOROS =====
    renderTreasures(treasures) {
        const container = this.$('#treasureList');
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

    // ===== RENDERIZAR POCIONES =====
    renderPotions(potions) {
        const container = this.$('#potionsList');
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

    // ===== RENDERIZAR EQUIPO =====
    renderEquipment(equipment) {
        const container = this.$('#equipmentList');
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

    // ===== OBTENER ICONO DE TESORO =====
    getTreasureIcon(type) {
        const icons = {
            'gem': 'fa-gem',
            'jewelry': 'fa-crown',
            'artifact': 'fa-archway',
            'other': 'fa-box'
        };
        return icons[type] || 'fa-box';
    }

    // ===== CONFIGURAR INFORMACIÓN BÁSICA =====
    setupBasicInfo() {
        const basicInfo = this.storage.load('basicInfo');
        
        const charName = this.$('#char-name');
        const charClass = this.$('#char-class');
        const charRace = this.$('#char-race');
        const charBg = this.$('#char-bg');
        const charAlign = this.$('#char-align');
        
        if (basicInfo) {
            if (charName) charName.value = basicInfo.name || '';
            if (charClass) charClass.value = basicInfo.class || '';
            if (charRace) charRace.value = basicInfo.race || '';
            if (charBg) charBg.value = basicInfo.background || '';
            if (charAlign) charAlign.value = basicInfo.alignment || '';
        }
        
        const savedImage = this.storage.load('imagenUrl');
        if (savedImage && this.imageManager) {
            this.imageManager.currentImageUrl = savedImage;
            this.imageManager.displayImage(savedImage);
        }
        
        if (charName) {
            charName.addEventListener('change', () => {
                this.saveBasicInfo();
                this.saveCharacter();
                const newName = charName.value.trim();
                if (newName && window.tabManager) {
                    window.tabManager.renameTab(this.tabId, newName);
                }
            });
        }
        
        ['#char-class', '#char-race', '#char-bg', '#char-align'].forEach(selector => {
            const input = this.$(selector);
            if (input) {
                input.addEventListener('change', () => {
                    this.saveBasicInfo();
                    const currentName = this.$('#char-name')?.value?.trim();
                    if (currentName && currentName !== '') {
                        this.saveCharacter();
                    }
                });
            }
        });
    }

 setupProficiencyBonusDisplay() {
    this.eventBus.on('levelChanged', () => {
        this.updateProficiencyBonusDisplay();
    });
    
    this.eventBus.on('proficiencyBonusChanged', () => {
        this.updateProficiencyBonusDisplay();
    });
    
    const editBtn = this.$('#editProficiencyBtn');
    if (editBtn) {
        const newBtn = editBtn.cloneNode(true);
        editBtn.parentNode.replaceChild(newBtn, editBtn);
        newBtn.addEventListener('click', () => {
            this.showExpConfig();  // ✅ AHORA USA showExpConfig
        });
    }
    
    setTimeout(() => {
        this.updateProficiencyBonusDisplay();
    }, 300);
}

updateProficiencyBonusDisplay() {
    const display = this.$('#proficiencyBonusDisplay');
    if (!display) return;
    
    const bonus = this.expManager?.getProficiencyBonus() || 2;
    const sign = bonus >= 0 ? '+' : '';
    display.textContent = `${sign}${bonus}`;
}

showProficiencyConfig() {
    // Usamos el mismo modal que los recursos
    const modal = document.getElementById('configModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;
    
    const currentSystem = this.expManager?.system || 'custom';
    const currentBonus = this.expManager?.customProficiencyBonus || 2;
    const isCustom = currentSystem === 'custom';
    
    modalBody.innerHTML = `
        <h4><i class="fas fa-medal"></i> Bonificador por Competencia</h4>
        <p style="font-size:0.85rem;color:var(--ink-light);margin-bottom:15px;">
            Sistema actual: <strong>${currentSystem.toUpperCase()}</strong>
            ${currentSystem === 'dnd5e' ? '📖 (según nivel)' : 
              currentSystem === 'pathfinder' ? '⚔️ (nivel/2+1)' : '🎲 (personalizado)'}
        </p>
        
        <div class="form-group">
            <label>Valor actual: <strong id="bonusPreview">${currentBonus}</strong></label>
            <div style="display:flex;gap:10px;align-items:center;margin-top:5px;">
                <button type="button" class="btn-secondary btn-small" id="bonusMinus" ${!isCustom ? 'disabled style="opacity:0.5;"' : ''}>-</button>
                <input type="number" id="customBonusInput" value="${currentBonus}" min="0" max="20" 
                       ${!isCustom ? 'disabled' : ''} 
                       style="width:80px;text-align:center;padding:6px;border-radius:4px;border:2px solid var(--accent-gold);">
                <button type="button" class="btn-secondary btn-small" id="bonusPlus" ${!isCustom ? 'disabled style="opacity:0.5;"' : ''}>+</button>
            </div>
            <small style="color:var(--ink-light);font-size:0.7rem;">
                ${isCustom ? 'Ajusta el valor manualmente' : 'Cambia a "Personalizado" para editar'}
            </small>
        </div>
        
        <div class="form-group">
            <label>Cambiar sistema:</label>
            <select id="systemSelect" style="width:100%;padding:8px;border-radius:6px;border:2px solid var(--accent-gold);">
                <option value="custom" ${currentSystem === 'custom' ? 'selected' : ''}>🎲 Personalizado</option>
                <option value="dnd5e" ${currentSystem === 'dnd5e' ? 'selected' : ''}>📖 D&D 5e</option>
                <option value="pathfinder" ${currentSystem === 'pathfinder' ? 'selected' : ''}>⚔️ Pathfinder</option>
            </select>
        </div>
        
        <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:10px;padding-top:15px;border-top:1px solid var(--parchment-dark);">
            <button type="button" class="btn-secondary btn-cancel" id="cancelProfConfig">Cancelar</button>
            <button type="button" class="btn-secondary" id="saveProfConfig" style="background:#4CAF50;">Guardar</button>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    const bonusInput = document.getElementById('customBonusInput');
    const bonusPreview = document.getElementById('bonusPreview');
    const systemSelect = document.getElementById('systemSelect');
    
    document.getElementById('bonusMinus').addEventListener('click', () => {
        if (bonusInput.disabled) return;
        let val = parseInt(bonusInput.value) || 0;
        val = Math.max(0, val - 1);
        bonusInput.value = val;
        if (bonusPreview) bonusPreview.textContent = val;
    });
    
    document.getElementById('bonusPlus').addEventListener('click', () => {
        if (bonusInput.disabled) return;
        let val = parseInt(bonusInput.value) || 0;
        val = Math.min(20, val + 1);
        bonusInput.value = val;
        if (bonusPreview) bonusPreview.textContent = val;
    });
    
    bonusInput?.addEventListener('input', () => {
        const val = parseInt(bonusInput.value) || 0;
        if (bonusPreview) bonusPreview.textContent = Math.min(20, Math.max(0, val));
    });
    
    systemSelect.addEventListener('change', (e) => {
        const system = e.target.value;
        const isCustomSelected = system === 'custom';
        bonusInput.disabled = !isCustomSelected;
        document.getElementById('bonusMinus').disabled = !isCustomSelected;
        document.getElementById('bonusPlus').disabled = !isCustomSelected;
        if (!isCustomSelected) {
            bonusInput.value = 2;
            if (bonusPreview) bonusPreview.textContent = 2;
        }
    });
    
    document.getElementById('saveProfConfig').addEventListener('click', () => {
        const system = systemSelect.value;
        const bonus = parseInt(bonusInput.value) || 2;
        
        this.expManager.setSystem(system);
        if (system === 'custom') {
            this.expManager.setCustomProficiencyBonus(bonus);
        }
        
        this.updateProficiencyBonusDisplay();
        modal.style.display = 'none';
        Helpers.showMessage('Bonificador actualizado', 'info');
    });
    
    document.getElementById('cancelProfConfig').addEventListener('click', () => {
        modal.style.display = 'none';
    });
}

    // ===== CALCULAR PERCEPCIÓN PASIVA =====
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
        
        const perceptionInput = this.$('#passivePerception');
        if (perceptionInput && perceptionInput.value != passivePerception) {
            perceptionInput.value = passivePerception;
        }
        
        this.passivePerception = passivePerception;
        return passivePerception;
    }

    // ===== GUARDAR INFORMACIÓN BÁSICA =====
    saveBasicInfo() {
        const charName = this.$('#char-name');
        const charClass = this.$('#char-class');
        const charRace = this.$('#char-race');
        const charBg = this.$('#char-bg');
        const charAlign = this.$('#char-align');
        
        const basicInfo = {
            name: charName?.value || '',
            class: charClass?.value || '',
            race: charRace?.value || '',
            background: charBg?.value || '',
            trasfondo: charBg?.value || '',
            alignment: charAlign?.value || '',
            alineamiento: charAlign?.value || ''
        };
        this.storage.save('basicInfo', basicInfo);
    }

    // ===== CONFIGURAR CONTROLES RÁPIDOS DE HP =====
    setupQuickHPControls() {
        const hpContainer = this.$('.hp-container');
        if (!hpContainer || hpContainer.querySelector('.hp-quick-controls')) return;
        
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

    // ===== CONFIGURAR AUTO-GUARDADO DE ESTADÍSTICAS DE COMBATE =====
    setupCombatStatsAutoSave() {
        ['#armor-class', '#speed', '#initiative'].forEach(selector => {
            const input = this.$(selector);
            if (input) {
                input.addEventListener('change', () => {
                    if (this.hasValidCharacterName()) {
                        this.saveCharacter();
                    }
                });
            }
        });
    }

    // ===== CONFIGURAR COLLAPSE DE INVENTARIO =====
    setupInventoryCollapse() {
        const toggleBtn = this.$('#toggleInventoryBtn');
        const inventoryCard = this.$('#card-inventory');
        
        if (!toggleBtn || !inventoryCard) return;
        
        const savedState = this.storage.load('inventoryCollapsed');
        if (savedState) {
            inventoryCard.classList.add('collapsed');
            const icon = toggleBtn.querySelector('i');
            if (icon) icon.className = 'fas fa-chevron-down';
        }
        
        toggleBtn.addEventListener('click', () => {
            inventoryCard.classList.toggle('collapsed');
            const icon = toggleBtn.querySelector('i');
            if (icon) {
                icon.className = inventoryCard.classList.contains('collapsed') 
                    ? 'fas fa-chevron-down' 
                    : 'fas fa-chevron-up';
            }
            
            this.storage.save('inventoryCollapsed', inventoryCard.classList.contains('collapsed'));
        });
    }

    // ===== AÑADIR ATAQUE =====
    addAttack(name = '', bonus = '', damage = '', saveToStorage = true) {
        const attacksList = this.$('.attacks-list');
        const addBtn = this.$('#addAttackBtn');
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

    // ===== CONFIGURAR AUTO-GUARDADO DE RASGOS =====
    setupTraitsAutoSave() {
        ['#personality', '#ideals', '#bonds', '#flaws', '#features'].forEach(selector => {
            const textarea = this.$(selector);
            if (textarea) {
                textarea.addEventListener('change', () => {
                    if (this.hasValidCharacterName()) {
                        this.saveCharacter();
                    }
                });
            }
        });
    }

    // ===== GUARDAR ATAQUES EN STORAGE =====
    saveAttacksToStorage() {
        const attacks = this.getAttacks();
        this.storage.save('attacks', attacks);
        this.eventBus.emit('attacksChanged', attacks);
    }

    // ===== OBTENER ATAQUES =====
    getAttacks() {
        const attacks = [];
        const attackItems = this.$$('.attack-item');
        
        attackItems.forEach(item => {
            const name = item.querySelector('.attack-name')?.value || '';
            const bonus = item.querySelector('.attack-bonus')?.value || '';
            const damage = item.querySelector('.attack-damage')?.value || '';
            
            attacks.push({ name, bonus, damage });
        });
        
        return attacks;
    }

    // ===== OBTENER CONJUROS =====
    getSpells() {
        const spells = [];
        const spellItems = this.$$('#spellsList .spell-item');
        
        spellItems.forEach(item => {
            const name = item.querySelector('.spell-name')?.value || '';
            const level = item.querySelector('.spell-level-input')?.value || '';
            const description = item.querySelector('.spell-desc')?.value || '';
            
            spells.push({ name, level, description });
        });
        
        return spells;
    }

    // ===== MOSTRAR MODAL DE EDICIÓN DE HABILIDAD =====
    showEditSkillModal(skill) {
        const existingModal = document.getElementById('editSkillModal');
        if (existingModal) existingModal.remove();
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'editSkillModal';
        modal.style.display = 'flex';
        
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
        
        const closeModal = () => modal.remove();
        document.getElementById('closeSkillModal')?.addEventListener('click', closeModal);
        document.getElementById('cancelSkillBtn')?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        
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

    // ===== CONFIGURAR PERCEPCIÓN PASIVA EDITABLE =====
setupPassivePerceptionConfig() {
    const attributeSelect = this.$('#passivePerceptionAttribute');
    if (!attributeSelect) return;
    
    // Poblar el selector con los atributos disponibles
    this.populatePassivePerceptionSelect();
    
    // Escuchar cambios en el atributo
    attributeSelect.addEventListener('change', () => {
        this.calcularPercepcionPasiva();
        if (this.hasValidCharacterName()) {
            this.saveCharacter();
        }
    });
    
    // Botón de actualizar
    const refreshBtn = this.$('#refreshPassivePerception');
    if (refreshBtn) {
        const newBtn = refreshBtn.cloneNode(true);
        refreshBtn.parentNode.replaceChild(newBtn, refreshBtn);
        newBtn.addEventListener('click', () => {
            this.calcularPercepcionPasiva();
            Helpers.showMessage('Percepción pasiva actualizada', 'info');
        });
    }
    
    // Escuchar cambios en atributos y nivel
    this.eventBus.on('attributeChanged', () => {
        this.populatePassivePerceptionSelect();
        this.calcularPercepcionPasiva();
    });
    
    this.eventBus.on('attributeNameChanged', () => {
        this.populatePassivePerceptionSelect();
        this.calcularPercepcionPasiva();
    });
    
    this.eventBus.on('attributeRemoved', () => {
        this.populatePassivePerceptionSelect();
        this.calcularPercepcionPasiva();
    });
    
    this.eventBus.on('levelChanged', () => {
        this.calcularPercepcionPasiva();
    });
    
    this.eventBus.on('proficiencyBonusChanged', () => {
        this.calcularPercepcionPasiva();
    });
    
    // Inicializar
    setTimeout(() => {
        this.calcularPercepcionPasiva();
    }, 300);
}

populatePassivePerceptionSelect() {
    const select = this.$('#passivePerceptionAttribute');
    if (!select) return;
    
    const attributes = this.attributeManager.getAll();
    const currentValue = this.storage.load('passivePerceptionAttribute') || 'SABIDURÍA';
    
    select.innerHTML = '';
    
    if (attributes.length === 0) {
        select.innerHTML = '<option value="">No hay atributos</option>';
        return;
    }
    
    // Verificar si el atributo guardado existe
    const attributeExists = attributes.some(attr => 
        attr.name === currentValue || attr.name.toUpperCase() === currentValue.toUpperCase()
    );
    
    let selectedValue = attributeExists ? currentValue : (attributes[0]?.name || '');
    
    attributes.forEach(attr => {
        const option = document.createElement('option');
        option.value = attr.name;
        option.textContent = attr.name;
        if (attr.name === selectedValue || attr.name.toUpperCase() === selectedValue.toUpperCase()) {
            option.selected = true;
            selectedValue = attr.name;
        }
        select.appendChild(option);
    });
    
    // Guardar el valor seleccionado
    if (selectedValue) {
        this.storage.save('passivePerceptionAttribute', selectedValue);
    }
}

getPassivePerceptionAttribute() {
    const select = this.$('#passivePerceptionAttribute');
    if (select && select.value) {
        return select.value;
    }
    return this.storage.load('passivePerceptionAttribute') || 'SABIDURÍA';
}

// ===== CALCULAR PERCEPCIÓN PASIVA (MODIFICADO) =====
calcularPercepcionPasiva() {
    let atributoMod = 0;
    const atributos = this.attributeManager.getAll();
    
    // Obtener el atributo seleccionado
    const atributoSeleccionado = this.getPassivePerceptionAttribute();
    
    // Buscar el atributo por nombre (case insensitive)
    const attrEncontrado = atributos.find(attr => 
        attr.name === atributoSeleccionado || 
        attr.name.toUpperCase() === atributoSeleccionado.toUpperCase()
    );
    
    if (attrEncontrado) {
        atributoMod = attrEncontrado.modifier || 0;
    } else {
        // Si no se encuentra, intentar con Sabiduría como fallback
        const sabiduriaAttr = atributos.find(attr => 
            attr.name.toUpperCase() === 'SABIDURÍA' || 
            attr.name.toUpperCase() === 'SABIDURIA' ||
            attr.name.toUpperCase() === 'WISDOM' ||
            attr.name.toUpperCase() === 'WIS'
        );
        if (sabiduriaAttr) {
            atributoMod = sabiduriaAttr.modifier || 0;
        }
    }
    
    const proficiencyBonus = this.expManager?.getProficiencyBonus() || 2;
    const passivePerception = 10 + atributoMod + proficiencyBonus;
    
    const perceptionInput = this.$('#passivePerception');
    if (perceptionInput && perceptionInput.value != passivePerception) {
        perceptionInput.value = passivePerception;
    }
    
    // Actualizar la fórmula mostrada
    const formulaSpan = this.$('#passivePerceptionFormula');
    if (formulaSpan) {
        const attrName = attrEncontrado ? attrEncontrado.name : 'SABIDURÍA';
        const modDisplay = atributoMod >= 0 ? `+${atributoMod}` : `${atributoMod}`;
        const profDisplay = proficiencyBonus >= 0 ? `+${proficiencyBonus}` : `${proficiencyBonus}`;
        formulaSpan.textContent = `10 + Mod. ${attrName} (${modDisplay}) + Bonif. Competencia (${profDisplay}) = ${passivePerception}`;
    }
    
    this.passivePerception = passivePerception;
    return passivePerception;
}

    // ===== MOSTRAR CONFIGURACIÓN DE MANÁ =====
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

    // ===== MOSTRAR CONFIGURACIÓN DE EXPERIENCIA =====
showExpConfig() {
    const modal = document.getElementById('configModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;
    
    const currentSystem = this.expManager?.system || 'custom';
    const currentBonus = this.expManager?.customProficiencyBonus || 2;
    const currentDisplayBonus = this.expManager?.getProficiencyBonus() || 2;
    const isCustom = currentSystem === 'custom';
    
    modalBody.innerHTML = `
        <h4><i class="fas fa-chart-line"></i> Configurar Experiencia</h4>
        
        <div class="form-group">
            <label><i class="fas fa-palette"></i> Color de barra:</label>
            <input type="color" id="configExpColor" value="${localStorage.getItem('expColor') || '#4a90e2'}">
        </div>
        
        <div class="form-group">
            <label><i class="fas fa-cog"></i> Sistema de experiencia:</label>
            <select id="configExpSystem">
                <option value="custom" ${currentSystem === 'custom' ? 'selected' : ''}>🎲 Personalizado</option>
                <option value="dnd5e" ${currentSystem === 'dnd5e' ? 'selected' : ''}>📖 D&D 5e</option>
                <option value="pathfinder" ${currentSystem === 'pathfinder' ? 'selected' : ''}>⚔️ Pathfinder</option>
            </select>
            <small style="color:var(--ink-light);font-size:0.7rem;">
                ${currentSystem === 'dnd5e' ? '📖 Bonificador según nivel (2-6)' : 
                  currentSystem === 'pathfinder' ? '⚔️ Bonificador = (Nivel/2) + 1' : 
                  '🎲 Bonificador personalizado ajustable'}
            </small>
        </div>
        
        <div class="form-group" style="border-top:1px solid var(--parchment-dark);padding-top:15px;margin-top:5px;">
            <label><i class="fas fa-medal"></i> Bonificador por Competencia</label>
            <div style="display:flex;gap:10px;align-items:center;margin-top:5px;">
                <button type="button" class="btn-secondary btn-small" id="configBonusMinus" ${!isCustom ? 'disabled style="opacity:0.5;"' : ''}>-</button>
                <input type="number" id="configCustomBonus" value="${currentBonus}" min="0" max="20" 
                       ${!isCustom ? 'disabled' : ''} 
                       style="width:80px;text-align:center;padding:6px;border-radius:4px;border:2px solid var(--accent-gold);">
                <button type="button" class="btn-secondary btn-small" id="configBonusPlus" ${!isCustom ? 'disabled style="opacity:0.5;"' : ''}>+</button>
                <span style="font-weight:bold;margin-left:10px;font-size:1.1rem;color:var(--accent-gold);">
                    → <span id="configBonusPreview">+${currentDisplayBonus}</span>
                </span>
            </div>
            <small style="color:var(--ink-light);font-size:0.7rem;" id="configBonusHint">
                ${isCustom ? 'Ajusta el valor manualmente' : 'Cambia a "Personalizado" para editar'}
            </small>
        </div>
        
        <div class="modal-actions" style="display:flex;justify-content:flex-end;gap:10px;padding-top:15px;border-top:1px solid var(--parchment-dark);">
            <button type="button" class="btn-secondary btn-cancel" id="cancelExpConfig">Cancelar</button>
            <button type="button" class="btn-secondary" id="saveExpConfig" style="background:#4CAF50;">Guardar</button>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    // Referencias
    const bonusInput = document.getElementById('configCustomBonus');
    const systemSelect = document.getElementById('configExpSystem');
    const bonusPreview = document.getElementById('configBonusPreview');
    const bonusHint = document.getElementById('configBonusHint');
    
    // Actualizar preview del bonificador
    const updateBonusPreview = () => {
        const system = systemSelect.value;
        const isCustomSelected = system === 'custom';
        const bonus = isCustomSelected ? (parseInt(bonusInput.value) || 2) : 
                      (system === 'dnd5e' ? this.expManager?.getProficiencyBonus() || 2 : 
                       Math.floor((this.expManager?.level || 1 + 1) / 2) + 1);
        if (bonusPreview) {
            bonusPreview.textContent = `+${bonus}`;
        }
    };
    
    // Botón -
    document.getElementById('configBonusMinus').addEventListener('click', () => {
        if (bonusInput.disabled) return;
        let val = parseInt(bonusInput.value) || 0;
        val = Math.max(0, val - 1);
        bonusInput.value = val;
        updateBonusPreview();
    });
    
    // Botón +
    document.getElementById('configBonusPlus').addEventListener('click', () => {
        if (bonusInput.disabled) return;
        let val = parseInt(bonusInput.value) || 0;
        val = Math.min(20, val + 1);
        bonusInput.value = val;
        updateBonusPreview();
    });
    
    // Input manual
    bonusInput?.addEventListener('input', () => {
        const val = parseInt(bonusInput.value) || 0;
        if (val < 0) bonusInput.value = 0;
        if (val > 20) bonusInput.value = 20;
        updateBonusPreview();
    });
    
    // Cambio de sistema
    systemSelect.addEventListener('change', (e) => {
        const system = e.target.value;
        const isCustomSelected = system === 'custom';
        
        bonusInput.disabled = !isCustomSelected;
        document.getElementById('configBonusMinus').disabled = !isCustomSelected;
        document.getElementById('configBonusPlus').disabled = !isCustomSelected;
        
        if (isCustomSelected) {
            bonusInput.value = this.expManager?.customProficiencyBonus || 2;
            bonusHint.textContent = 'Ajusta el valor manualmente';
        } else if (system === 'dnd5e') {
            bonusInput.value = 2;
            bonusHint.textContent = '📖 Bonificador según nivel (2-6)';
        } else if (system === 'pathfinder') {
            bonusInput.value = 2;
            bonusHint.textContent = '⚔️ Bonificador = (Nivel/2) + 1';
        }
        
        updateBonusPreview();
    });
    
    // Guardar
    document.getElementById('saveExpConfig').addEventListener('click', () => {
        const color = document.getElementById('configExpColor').value;
        const system = systemSelect.value;
        const customBonus = parseInt(bonusInput.value) || 2;
        
        document.documentElement.style.setProperty('--exp-color', color);
        localStorage.setItem('expColor', color);
        
        this.expManager.setSystem(system);
        if (system === 'custom') {
            this.expManager.setCustomProficiencyBonus(customBonus);
        }
        
        this.updateProficiencyBonusDisplay();
        modal.style.display = 'none';
        Helpers.showMessage('Configuración actualizada', 'info');
    });
    
    // Cancelar
    document.getElementById('cancelExpConfig').addEventListener('click', () => {
        modal.style.display = 'none';
    });
}

    // ===== MOSTRAR CONFIGURACIÓN DE SLOTS DE CONJUROS =====
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
            
            const spellLevel = this.$('#spellLevel');
            const totalSlots = this.$('#totalSlots');
            if (spellLevel) spellLevel.value = level;
            if (totalSlots) totalSlots.value = total;
            
            modal.style.display = 'none';
        });
        
        document.getElementById('cancelSlotsConfig').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // ===== MOSTRAR CONFIGURACIÓN DE MONEDAS =====
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

    // ===== MOSTRAR MODAL PARA AÑADIR TESORO =====
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

    // ===== MOSTRAR MODAL PARA AÑADIR POCIÓN =====
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

    // ===== MOSTRAR MODAL PARA AÑADIR EQUIPO =====
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
            <label>Tipo de equipo:</label>
            <select id="equipmentType">
                <option value="standard">Equipo estándar</option>
                <option value="armor">Armadura (modifica CA)</option>
            </select>
        </div>
        
        <!-- Campos para armadura (ocultos por defecto) -->
        <div id="armorFields" style="display: none; border-top: 2px solid var(--accent-gold); padding-top: 15px; margin-top: 10px;">
            <h5 style="color: var(--accent-gold);"><i class="fas fa-shield-alt"></i> Configuración de Armadura</h5>
            
            <div class="form-group">
                <label>CA Base (ej: 10, 11, 12):</label>
                <input type="number" id="armorBase" value="10" min="1" max="30">
                <small style="color: var(--ink-light); font-size: 0.7rem;">Base para el cálculo de CA (por defecto 10)</small>
            </div>
            
            <div class="form-group">
                <label>Atributo para CA:</label>
                <select id="armorAttribute">
                    <option value="DESTREZA">Destreza</option>
                    <option value="CONSTITUCIÓN">Constitución</option>
                    <option value="FUERZA">Fuerza</option>
                    <option value="INTELIGENCIA">Inteligencia</option>
                    <option value="SABIDURÍA">Sabiduría</option>
                    <option value="CARISMA">Carisma</option>
                </select>
                <small style="color: var(--ink-light); font-size: 0.7rem;">Atributo cuyo modificador se sumará a la CA</small>
            </div>
            
            <div class="form-group">
                <label>Bonificador adicional de la armadura:</label>
                <input type="number" id="armorModifier" value="0" min="0" max="10">
                <small style="color: var(--ink-light); font-size: 0.7rem;">Bonificador fijo de la armadura (ej: +1, +2)</small>
            </div>
            
            <div class="form-group">
                <label>Bonificador extra de CA (ej: escudo +2):</label>
                <input type="number" id="armorBonus" value="0" min="0" max="10">
                <small style="color: var(--ink-light); font-size: 0.7rem;">Bonificador adicional de este item</small>
            </div>
        </div>
        
        <div class="form-group">
            <label>Sigilo:</label>
            <select id="equipmentStealth">
                <option value="none">Sin efecto</option>
                <option value="disadvantage">Desventaja</option>
                <option value="advantage">Ventaja</option>
            </select>
        </div>
        
        <div class="form-group" id="standardBonusFields">
            <label>Bonificador de atributo:</label>
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
    
    // Mostrar/ocultar campos de armadura según el tipo seleccionado
    const typeSelect = document.getElementById('equipmentType');
    const armorFields = document.getElementById('armorFields');
    const standardFields = document.getElementById('standardBonusFields');
    
    typeSelect.addEventListener('change', () => {
        if (typeSelect.value === 'armor') {
            armorFields.style.display = 'block';
            standardFields.style.display = 'none';
        } else {
            armorFields.style.display = 'none';
            standardFields.style.display = 'block';
        }
    });
    
    document.getElementById('addEquipmentConfirm').addEventListener('click', () => {
        const name = document.getElementById('equipmentName').value.trim();
        const cost = parseInt(document.getElementById('equipmentCost').value) || 0;
        const weight = parseFloat(document.getElementById('equipmentWeight').value) || 0;
        const description = document.getElementById('equipmentDesc').value.trim();
        const stealth = document.getElementById('equipmentStealth').value;
        const type = document.getElementById('equipmentType').value;
        
        if (!name) {
            Helpers.showMessage('Ingresa un nombre', 'warning');
            return;
        }
        
        if (type === 'armor') {
            // Añadir armadura
            const acBase = parseInt(document.getElementById('armorBase').value) || 10;
            const acAttribute = document.getElementById('armorAttribute').value;
            const acModifier = parseInt(document.getElementById('armorModifier').value) || 0;
            const acBonus = parseInt(document.getElementById('armorBonus').value) || 0;
            
            this.equipmentManager.addArmorItem(
                name, cost, weight, description,
                acBase, acAttribute, acModifier, acBonus, stealth
            );
            
            Helpers.showMessage(`Armadura "${name}" añadida (CA: ${acBase} + ${acModifier})`, 'success');
        } else {
            // Añadir equipo estándar
            const attribute = document.getElementById('equipmentAttribute').value;
            const bonus = parseInt(document.getElementById('equipmentBonus').value) || 0;
            
            this.equipmentManager.add(name, cost, weight, description, stealth, attribute, bonus);
            Helpers.showMessage(`Equipo "${name}" añadido`, 'success');
        }
        
        modal.style.display = 'none';
    });
    
    document.getElementById('cancelEquipment').addEventListener('click', () => {
        modal.style.display = 'none';
    });
}

// ===== MOSTRAR CONFIGURACIÓN DE CLASE DE ARMADURA =====
// ===== MOSTRAR CONFIGURACIÓN DE CLASE DE ARMADURA =====
showACConfig() {
    const modal = document.getElementById('configModal');
    const modalBody = document.getElementById('modalBody');
    if (!modal || !modalBody) return;
    
    const attributes = this.attributeManager.getAll();
    const acConfig = this.equipmentManager.getACConfig();
    
    let attributeOptions = '';
    attributes.forEach(attr => {
        const selected = attr.name === acConfig.attribute ? 'selected' : '';
        const modDisplay = attr.modifier >= 0 ? `+${attr.modifier}` : `${attr.modifier}`;
        attributeOptions += `<option value="${attr.name}" ${selected}>${attr.name} (Mod: ${modDisplay})</option>`;
    });
    
    // Si no hay atributos, mostrar opción por defecto
    if (attributes.length === 0) {
        attributeOptions = '<option value="DESTREZA">Destreza (Mod: +0)</option>';
    }
    
    // Calcular CA actual para mostrar
    const currentAC = this.equipmentManager.recalculateAC() || 10;
    const formulaDisplay = this.getACFormulaDisplay();
    
    modalBody.innerHTML = `
        <h4><i class="fas fa-shield-alt"></i> Configurar Clase de Armadura</h4>
        
        <div style="background: var(--parchment-light, #f5e6d3); padding: 15px; border-radius: 8px; margin-bottom: 15px; border: 2px solid var(--accent-gold, #d4af37);">
            <div style="text-align: center; font-size: 1.5rem; font-weight: bold; color: var(--accent-gold, #d4af37);">
                CA Actual: <span id="acPreviewTotal">${currentAC}</span>
            </div>
            <div style="text-align: center; font-size: 0.8rem; color: var(--ink-light, #5c4033);" id="acFormulaPreview">
                ${formulaDisplay}
            </div>
        </div>
        
        <div class="form-group">
            <label><i class="fas fa-dice-d20"></i> Atributo para CA</label>
            <div style="display: flex; gap: 10px; align-items: center;">
                <select id="acAttributeSelect" style="flex: 1;">
                    ${attributeOptions}
                </select>
                <label style="display: flex; align-items: center; gap: 5px; font-size: 0.8rem; white-space: nowrap; cursor: pointer;">
                    <input type="checkbox" id="acUseAttribute" ${acConfig.useAttribute !== false ? 'checked' : ''}>
                    <i class="fas fa-check-circle"></i> Usar atributo
                </label>
            </div>
            <small style="color: var(--ink-light, #5c4033); font-size: 0.7rem;">
                El modificador del atributo seleccionado se sumará a la CA. Desmarca para ignorarlo.
            </small>
        </div>
        
        <div style="background: var(--parchment-light, #f5e6d3); padding: 12px; border-radius: 8px; margin-top: 15px; border: 1px solid var(--parchment-dark, #e6d0b5);">
            <h5 style="margin: 0 0 5px 0; color: var(--accent-gold, #d4af37); font-size: 0.9rem;">
                <i class="fas fa-info-circle"></i> ¿Cómo funciona?
            </h5>
            <p style="margin: 0; font-size: 0.8rem; color: var(--ink-light, #5c4033); line-height: 1.5;">
                CA = <strong>Base (10)</strong> + <strong>Modificador del Atributo</strong> + <strong>Bonificadores de Armadura</strong> + <strong>Bonificadores de Equipo</strong>
            </p>
            <p style="margin: 5px 0 0 0; font-size: 0.75rem; color: var(--ink-light, #5c4033); font-style: italic;">
                💡 Para modificar la base o añadir bonificadores de armadura, usa el <strong>Equipo</strong> con tipo "Armadura".
            </p>
        </div>
        
        <div class="modal-actions" style="display: flex; justify-content: flex-end; gap: 10px; padding-top: 15px; border-top: 1px solid var(--parchment-dark, #e6d0b5); margin-top: 15px;">
            <button type="button" class="btn-secondary btn-cancel" id="cancelACConfig">Cancelar</button>
            <button type="button" class="btn-secondary" id="saveACConfig" style="background: #4CAF50;">
                <i class="fas fa-check"></i> Guardar
            </button>
        </div>
    `;
    
    modal.style.display = 'flex';
    
    // Función para actualizar la vista previa
    const updatePreview = () => {
        const attrSelect = document.getElementById('acAttributeSelect');
        const useAttrCheck = document.getElementById('acUseAttribute');
        const previewTotal = document.getElementById('acPreviewTotal');
        const formulaPreview = document.getElementById('acFormulaPreview');
        
        // Verificar que los elementos existen
        if (!attrSelect || !useAttrCheck) {
            console.warn('Elementos del modal no encontrados para actualizar preview');
            return;
        }
        
        const attributeName = attrSelect.value;
        const useAttribute = useAttrCheck.checked;
        
        let attrMod = 0;
        
        if (useAttribute) {
            const attr = this.attributeManager.getByName(attributeName);
            if (attr) {
                attrMod = attr.modifier || 0;
            }
        }
        
        // Obtener base y bonificadores desde equipmentManager
        const acConfigData = this.equipmentManager.getACConfig();
        const base = acConfigData.base || 10;
        const armorMod = acConfigData.armorMod || 0;
        
        // Sumar bonificadores de equipo
        let bonusTotal = 0;
        if (this.equipmentManager) {
            this.equipmentManager.getAll().forEach(item => {
                if (item.acBonus && item.acBonus > 0) {
                    bonusTotal += item.acBonus;
                }
            });
        }
        
        const totalAC = Math.max(1, Math.min(30, base + attrMod + armorMod + bonusTotal));
        
        if (previewTotal) previewTotal.textContent = totalAC;
        
        // Actualizar fórmula
        const formulaParts = [`${base}`];
        if (useAttribute && attrMod !== 0) {
            formulaParts.push(`${attrMod >= 0 ? '+' : ''}${attrMod} (${attributeName})`);
        }
        if (armorMod > 0) {
            formulaParts.push(`+${armorMod} (armadura)`);
        }
        if (bonusTotal > 0) {
            formulaParts.push(`+${bonusTotal} (equipo)`);
        }
        
        if (formulaPreview) {
            formulaPreview.textContent = `Fórmula: ${formulaParts.join(' + ')} = ${totalAC}`;
        }
    };
    
    // Asignar eventos SOLO DESPUÉS de verificar que los elementos existen
    const attrSelect = document.getElementById('acAttributeSelect');
    const useAttrCheck = document.getElementById('acUseAttribute');
    
    if (attrSelect) {
        attrSelect.addEventListener('change', updatePreview);
    }
    if (useAttrCheck) {
        useAttrCheck.addEventListener('change', updatePreview);
    }
    
    // Guardar referencia a los eventos para limpiarlos después
    const eventHandlers = {
        updatePreview: updatePreview,
        onAttributeChanged: () => updatePreview(),
        onAttributeNameChanged: () => updatePreview(),
        onAttributeAdded: () => updatePreview(),
        onAttributeRemoved: () => updatePreview()
    };
    
    // Escuchar cambios en atributos
    this.eventBus.on('attributeChanged', eventHandlers.onAttributeChanged);
    this.eventBus.on('attributeNameChanged', eventHandlers.onAttributeNameChanged);
    this.eventBus.on('attributeAdded', eventHandlers.onAttributeAdded);
    this.eventBus.on('attributeRemoved', eventHandlers.onAttributeRemoved);
    
    // Guardar configuración
    const saveBtn = document.getElementById('saveACConfig');
    const cancelBtn = document.getElementById('cancelACConfig');
    
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            const attribute = document.getElementById('acAttributeSelect')?.value || 'DESTREZA';
            const useAttribute = document.getElementById('acUseAttribute')?.checked || false;
            
            // Solo guardar el atributo y el toggle
            this.equipmentManager.setACAttribute(attribute);
            this.equipmentManager.setACUseAttribute(useAttribute);
            
            // Recalcular y actualizar
            this.equipmentManager.recalculateAC();
            
            modal.style.display = 'none';
            Helpers.showMessage('Configuración de CA guardada', 'success');
            
            // Limpiar listeners
            this.eventBus.off('attributeChanged', eventHandlers.onAttributeChanged);
            this.eventBus.off('attributeNameChanged', eventHandlers.onAttributeNameChanged);
            this.eventBus.off('attributeAdded', eventHandlers.onAttributeAdded);
            this.eventBus.off('attributeRemoved', eventHandlers.onAttributeRemoved);
        });
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
            // Limpiar listeners
            this.eventBus.off('attributeChanged', eventHandlers.onAttributeChanged);
            this.eventBus.off('attributeNameChanged', eventHandlers.onAttributeNameChanged);
            this.eventBus.off('attributeAdded', eventHandlers.onAttributeAdded);
            this.eventBus.off('attributeRemoved', eventHandlers.onAttributeRemoved);
        });
    }
    
    // Actualizar vista previa inicial
    setTimeout(updatePreview, 100);
}

// ===== OBTENER FÓRMULA DE CA PARA MOSTRAR =====
getACFormulaDisplay() {
    if (!this.equipmentManager) return '10 + Destreza';
    
    const acConfig = this.equipmentManager.getACConfig();
    const base = acConfig.base || 10;
    let attrMod = 0;
    let attrName = acConfig.attribute || 'DESTREZA';
    
    if (acConfig.useAttribute !== false) {
        const attr = this.attributeManager.getByName(attrName);
        if (attr) {
            attrMod = attr.modifier || 0;
        }
    }
    
    const armorMod = acConfig.armorMod || 0;
    let bonusTotal = 0;
    if (this.equipmentManager) {
        this.equipmentManager.getAll().forEach(item => {
            if (item.acBonus && item.acBonus > 0) {
                bonusTotal += item.acBonus;
            }
        });
    }
    
    const totalAC = Math.max(1, Math.min(30, base + attrMod + armorMod + bonusTotal));
    
    const parts = [`${base}`];
    if (acConfig.useAttribute !== false && attrMod !== 0) {
        parts.push(`${attrMod >= 0 ? '+' : ''}${attrMod} (${attrName})`);
    }
    if (armorMod > 0) {
        parts.push(`+${armorMod} (armadura)`);
    }
    if (bonusTotal > 0) {
        parts.push(`+${bonusTotal} (equipo)`);
    }
    
    return `${parts.join(' + ')} = ${totalAC}`;
}

// ===== OBTENER FÓRMULA DE CA PARA MOSTRAR =====
getACFormulaDisplay() {
    const acConfig = this.equipmentManager.getACConfig();
    const base = acConfig.base || 10;
    let attrMod = 0;
    let attrName = acConfig.attribute || 'DESTREZA';
    
    if (acConfig.useAttribute) {
        const attr = this.attributeManager.getByName(attrName);
        if (attr) {
            attrMod = attr.modifier || 0;
        }
    }
    
    const armorMod = acConfig.armorMod || 0;
    let bonusTotal = 0;
    this.equipmentManager.getAll().forEach(item => {
        if (item.acBonus && item.acBonus > 0) {
            bonusTotal += item.acBonus;
        }
    });
    
    const totalAC = Math.max(1, Math.min(30, base + attrMod + armorMod + bonusTotal));
    
    const parts = [`${base}`];
    if (acConfig.useAttribute && attrMod !== 0) {
        parts.push(`${attrMod >= 0 ? '+' : ''}${attrMod} (${attrName})`);
    }
    if (armorMod > 0) {
        parts.push(`+${armorMod} (armadura)`);
    }
    if (bonusTotal > 0) {
        parts.push(`+${bonusTotal} (equipo)`);
    }
    
    return `${parts.join(' + ')} = ${totalAC}`;
}

    // ===== MOSTRAR PERSONALIZADOR DE COLORES =====
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
            gems: this.colorManager.themeColors.gems || '#9370db',
            tabBar: this.colorManager.themeColors.tabBar || this.colorManager.themeColors.parchment || '#e6d0b5'
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
                <div class="color-group">
                <label>Barra de Pestañas</label>
                <input type="color" id="colorTabBar" value="${currentColors.tabBar}">
            </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveColorsBtn">Aplicar</button>
                <button type="button" class="btn-secondary" id="resetColorsBtn">Restaurar</button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelColorsBtn">Cancelar</button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveColorsBtn').addEventListener('click', () => {
            const colors = {
                mana: document.getElementById('colorMana').value,
                hp: document.getElementById('colorHP').value,
                exp: document.getElementById('colorExp').value,
                accent: document.getElementById('colorAccent').value,
                background: document.getElementById('colorBackground').value,
                parchment: document.getElementById('colorParchment').value,
                gems: document.getElementById('colorGems').value,
                tabBar: document.getElementById('colorTabBar').value
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
        
        document.getElementById('resetColorsBtn').addEventListener('click', () => {
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
        
        document.getElementById('cancelColorsBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // ===== MOSTRAR PERSONALIZADOR DE COLORES DE TEXTO =====
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

    // ===== MOSTRAR CONFIRMACIÓN DE GUARDADO =====
    showSaveConfirmation() {
        const saveBtn = document.querySelector('#saveBtn');
        if (!saveBtn) return;
        
        const originalHTML = saveBtn.innerHTML;
        saveBtn.innerHTML = '<i class="fas fa-check"></i> ✓ GUARDADO';
        saveBtn.style.background = 'linear-gradient(145deg, #4CAF50, #2E7D32)';
        
        setTimeout(() => {
            saveBtn.innerHTML = originalHTML;
            saveBtn.style.background = '';
        }, 2000);
    }

    // ===== EXPORTAR PERSONAJE =====
exportCharacter() {
    const personajeNombre = this.$('#char-name')?.value?.trim() || 'Sin nombre';
    const clase = this.$('#char-class')?.value || '';
    const raza = this.$('#char-race')?.value || '';
    const trasfondo = this.$('#char-bg')?.value || '';
    const alineamiento = this.$('#char-align')?.value || '';
    
    const inventoryCard = this.$('#card-inventory');
    const isInventoryCollapsed = inventoryCard ? inventoryCard.classList.contains('collapsed') : false;
    
    // ===== IMPORTANTE: Obtener imagen del storage correctamente =====
    const imagenUrl = this.storage.load('imagenUrl') || null;
    
    const atributosDOM = [];
    this.$$('.attribute-item').forEach(item => {
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
        personalidad: this.$('#personality')?.value || '',
        ideales: this.$('#ideals')?.value || '',
        vinculos: this.$('#bonds')?.value || '',
        defectos: this.$('#flaws')?.value || '',
        rasgos: this.$('#features')?.value || ''  // <-- Asegurar que se guarda
    };
    
    // ===== IMPORTANTE: Obtener colores del ColorManager =====
    const coloresGuardados = this.storage.load('characterColors') || {};
    const textColorsGuardados = this.storage.load('characterTextColors') || {};
    
    // Obtener TODOS los colores del tema actual
    const themeColors = this.colorManager.themeColors || {};
    const textColors = this.colorManager.textColors || {};
    
    // Construir colores finales (priorizar colores actuales sobre guardados)
    const coloresFinales = {
        background: themeColors.background || coloresGuardados.background || null,
        parchment: themeColors.parchment || coloresGuardados.parchment || null,
        accent: themeColors.accent || coloresGuardados.accent || '#d4af37',
        mana: themeColors.mana || coloresGuardados.mana || '#4169e1',
        hp: themeColors.hp || coloresGuardados.hp || '#dc143c',
        exp: themeColors.exp || coloresGuardados.exp || '#4a90e2',
        gems: themeColors.gems || coloresGuardados.gems || '#9370db',
        tabBar: themeColors.tabBar || coloresGuardados.tabBar || null,
        textColors: {
            title: textColors.title || '#2c1810',
            subtitle: textColors.subtitle || '#4a3728',
            label: textColors.label || '#5c4033',
            input: textColors.input || '#2c1810',
            number: textColors.number || '#1e3a5f',
            modifier: textColors.modifier || '#6a0dad'
        }
    };
    
    const layout = {};
    this.$$('.card').forEach((card, index) => {
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
        colores_personalizados: coloresFinales,
        stats: {
            hp: this.healthManager.getData(),
            mana: this.manaManager.getData(),
            ca: parseInt(this.$('#armor-class')?.value) || 12,
            velocidad: parseInt(this.$('#speed')?.value) || 30,
            iniciativa: parseInt(this.$('#initiative')?.value) || 1,
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
        passivePerception: this.passivePerception || 10,
        proficiencies: this.proficiencyManager.getAll(),
        savingThrows: this.savingThrowsManager.getAll(),
        notas: notas,
        layout: layout,
        fecha_creacion: new Date().toISOString(),
        version: '3.2',
        tabId: this.tabId
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

    // ===== IMPORTAR PERSONAJE =====
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

    // ===== CARGAR ATAQUES DESDE STORAGE =====
    loadAttacksFromStorage() {
        const savedAttacks = this.storage.load('attacks');
        if (savedAttacks && savedAttacks.length > 0) {
            const attacksList = this.$('.attacks-list');
            if (attacksList) {
                const attackItems = attacksList.querySelectorAll('.attack-item');
                attackItems.forEach(item => item.remove());
                
                savedAttacks.forEach(attack => {
                    this.addAttack(attack.name, attack.bonus, attack.damage, false);
                });
            }
        }
    }

    // ===== LIMPIAR TODOS LOS DATOS =====
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
        
        const attacksList = this.$('.attacks-list');
        if (attacksList) {
            const attackItems = attacksList.querySelectorAll('.attack-item');
            attackItems.forEach(item => item.remove());
        }
    }

    // ===== REINICIAR TODO =====
    resetAll() {
        if (confirm('¿Estás seguro? Esta acción no se puede deshacer.')) {
            this.cleanupAutoSave();
            
            this.storage.clear();
            
            this.attributeManager.loadDefaults();
            this.healthManager.setCurrent(26);
            this.healthManager.setMax(26);
            this.healthManager.setTemp(0);
            this.manaManager.setCurrent(0);
            this.manaManager.setMax(15);
            this.deathSavesManager.reset();
            this.currencyManager.reset();
            
            this.treasureManager.treasures = [];
            this.potionManager.potions = [];
            this.equipmentManager.equipment = [];
            this.spellManager.spells = [];
            this.skillsManager.skills = [];
            this.proficiencyManager.proficiencies = [];
            
            const attacksList = this.$('.attacks-list');
            if (attacksList) {
                const attackItems = attacksList.querySelectorAll('.attack-item');
                attackItems.forEach(item => item.remove());
            }
            
            this.refresh();
            
            const textareas = ['personality', 'ideals', 'bonds', 'flaws', 'features'];
            textareas.forEach(id => {
                const el = this.$(`#${id}`);
                if (el) el.value = '';
            });
            
            const nameInput = this.$('#char-name');
            if (nameInput) nameInput.value = '';
            
            const armorClass = this.$('#armor-class');
            const speed = this.$('#speed');
            const initiative = this.$('#initiative');
            if (armorClass) armorClass.value = 10;
            if (speed) speed.value = 30;
            if (initiative) initiative.value = 1;
            
            this._dataLoaded = false;
            
            Helpers.showMessage('Hoja restablecida correctamente', 'info');
        }
    }

    // ===== ACTUALIZAR TIRADAS DE SALVACIÓN =====
    updateSavingThrows() {
        this.savingThrowsManager.updateFromAttributes();
    }

    // ===== OBTENER NOMBRE DEL PERSONAJE =====
    getCharacterName() {
        return this.$('#char-name')?.value || 'Sin nombre';
    }

    // ===== OBTENER NOMBRE DEL JUGADOR =====
    getPlayerName() {
        if (this.userManager && this.userManager.isUserSet()) {
            return this.userManager.getUserName();
        }
        return localStorage.getItem('jugadorNombre') || 'Anónimo';
    }

    // ===== SINCRONIZAR CON WEBSOCKET =====
    syncCharacterWithWebSocket() {
        if (!this.ws || !this.ws.isConectado()) return;
        
        const personaje = {
            nombre: this.getCharacterName(),
            clase: this.$('#char-class')?.value || '',
            nivel: this.expManager?.getData().level || 1,
            raza: this.$('#char-race')?.value || '',
            jugador: this.getPlayerName(),
            tabId: this.tabId
        };
        
        if (personaje.nombre && personaje.nombre !== 'Sin nombre') {
            this.ws.actualizarPersonaje(personaje);
        }
    }

    // ===== CONFIGURAR RACE CLEAR HANDLER =====
    setupRaceClearHandler() {
        const raceInput = this.$('#char-race');
        if (!raceInput) return;
        
        raceInput.addEventListener('input', (e) => {
            const value = e.target.value.trim();
            if (value === '') {
                // Si el usuario borra la raza, no hacemos nada con la descripción
            }
        });
    }

    // ===== CONFIGURAR AUTO-GUARDADO PERIÓDICO =====
    setupPeriodicAutoSave() {
        if (this._autoSaveInterval) {
            clearInterval(this._autoSaveInterval);
        }
        
        this._autoSaveInterval = setInterval(() => {
            const charName = this.$('#char-name')?.value?.trim();
            if (charName && charName !== '' && charName !== 'Sin nombre' && this._dataLoaded && !this._isSaving) {
                this.saveCharacter();
                console.log(`⏰ Auto-guardado periódico (${this.tabId})`);
            }
        }, 30000);
    }

    // ===== LIMPIAR AUTO-GUARDADO =====
    cleanupAutoSave() {
        if (this._autoSaveInterval) {
            clearInterval(this._autoSaveInterval);
            this._autoSaveInterval = null;
        }
    }
}