const DEFAULT_ATTRIBUTES = [
    { name: 'FUERZA', value: 10 },
    { name: 'DESTREZA', value: 10 },
    { name: 'CONSTITUCIÓN', value: 10 },
    { name: 'INTELIGENCIA', value: 10 },
    { name: 'SABIDURÍA', value: 10 },
    { name: 'CARISMA', value: 10 }
];

// Text colors default
const DEFAULT_TEXT_COLORS = {
    title: '#1e3a5f',
    subtitle: '#5c4033',
    label: '#5c4033',
    input: '#2c1810',
    number: '#2c1810',
    modifier: '#2a4a7a'
};

class CharacterSheet {
    constructor() {
        this.currentMana = 2;
        this.maxMana = 15;
        this.currentHP = 26;
        this.maxHP = 26;
        this.tempHP = 0;
        this.attributes = [];
        this.attributeCount = 0;
        this.spellSlots = { total: 4, used: 0, level: 1 };
        this.isDragging = false;
        this.draggedElement = null;
        this.dragOffset = { x: 0, y: 0 };
        this.cardLayout = {};
        this.textColors = { ...DEFAULT_TEXT_COLORS };

        this.savingThrows = [];

        this.deathSaves = {
            successes: [false, false, false],
            fails: [false, false, false]
        };
        this.skills = [];
        this.passivePerception = 10;
        this.proficiencies = [];
        this.defaultSkills = [
            { name: 'Acrobacias', bonus: 0 },
            { name: 'Atletismo', bonus: 0 },
            { name: 'Arcano', bonus: 0 },
            { name: 'Engaño', bonus: 0 },
            { name: 'Historia', bonus: 0 },
            { name: 'Interpretación', bonus: 0 },
            { name: 'Intimidación', bonus: 0 },
            { name: 'Investigación', bonus: 0 },
            { name: 'Juego de Manos', bonus: 0 },
            { name: 'Medicina', bonus: 0 },
            { name: 'Naturaleza', bonus: 0 },
            { name: 'Percepción', bonus: 0 },
            { name: 'Perspicacia', bonus: 0 },
            { name: 'Persuasión', bonus: 0 },
            { name: 'Religión', bonus: 0 },
            { name: 'Sigilo', bonus: 0 },
            { name: 'Supervivencia', bonus: 0 }
        ];
        this.proficiencyTypes = ['armor', 'weapon', 'tool', 'language'];
        
        // Nuevas propiedades para inventario
        this.currency = {
            gold: 0,
            silver: 0,
            copper: 0,
            name: 'Monedas',
            goldName: 'Oro',
            silverName: 'Plata',
            copperName: 'Cobre'
        };
        this.treasures = [];
        this.potions = [];
        // NUEVA: Propiedad para equipo
        this.equipment = [];
        
        // Propiedades de experiencia
        this.currentExp = 0;
        this.maxExp = 300;
        this.characterLevel = 1;
        
        this.init();
    }
    
    init() {
        this.loadDefaultAttributes();
        this.setupEventListeners();
        this.updateHPDisplay();
        this.updateManaDisplay();
        this.setupSpellSlots();
        this.setupRedimensionamiento();
        this.setupCustomization();
        this.setupTextCustomization();
        this.loadFromLocalStorage();
        this.setupImageUpload();
        this.setupInventory();
        this.setupInventoryCollapse(); 
        this.setupCardDragDrop();
        this.setupExpListeners();
        this.updateExpDisplay();

        this.setupDeathSaves();
        this.setupSkills();
        this.setupPassivePerception();
        this.setupProficiencies();
        this.setupSavingThrows(); 
        
        console.log('CharacterSheet inicializado');
    }
    
    // ===== NUEVO: Sistema de arrastre de tarjetas =====
    
    /**
     * Configurar el sistema de arrastre de tarjetas
     */
    setupCardDragDrop() {
        const cards = document.querySelectorAll('.card');
        const columns = document.querySelectorAll('.left-column, .center-column, .right-column');
        
        // Hacer todas las tarjetas arrastrables
        cards.forEach(card => {
            // Solo el título es arrastrable
            const title = card.querySelector('.card-title');
            if (title) {
                title.style.cursor = 'grab';
                title.setAttribute('draggable', 'true');
                
                // Asegurar que la tarjeta tenga un ID único
                if (!card.id) {
                    card.id = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                }
                
                // Prevenir que el texto dentro del título sea seleccionable
                title.addEventListener('dragstart', (e) => {
                    e.stopPropagation();
                    card.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', card.id);
                    e.dataTransfer.setData('card-id', card.id);
                    e.dataTransfer.effectAllowed = 'move';
                    
                    // Guardar datos de la tarjeta origen
                    e.dataTransfer.setData('card-html', card.outerHTML);
                    
                    // Cambiar cursor
                    title.style.cursor = 'grabbing';
                    
                    // Añadir clase al body para prevenir selección
                    document.body.classList.add('dragging-active');
                });
                
                title.addEventListener('dragend', (e) => {
                    card.classList.remove('dragging');
                    title.style.cursor = 'grab';
                    document.body.classList.remove('dragging-active');
                });
                
                // Prevenir comportamiento por defecto del drag
                title.addEventListener('drag', (e) => {
                    e.preventDefault();
                });
            }
        });
        
        // Configurar zonas de drop (columnas)
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                column.classList.add('drag-over');
            });
            
            column.addEventListener('dragleave', (e) => {
                column.classList.remove('drag-over');
            });
            
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                
                const draggedCardId = e.dataTransfer.getData('card-id');
                const draggedCard = document.getElementById(draggedCardId);
                
                if (!draggedCard) return;
                
                // Encontrar la tarjeta sobre la que se soltó
                const dropTarget = e.target.closest('.card');
                
                if (dropTarget && dropTarget !== draggedCard) {
                    // INTERCAMBIAR POSICIONES
                    this.swapCards(draggedCard, dropTarget);
                } else if (!dropTarget) {
                    // Si se soltó en el espacio vacío, mover al final de la columna
                    column.appendChild(draggedCard);
                }
                
                this.saveCharacter();
            });
        });
        
        // Prevenir drag en elementos interactivos
        cards.forEach(card => {
            const inputs = card.querySelectorAll('input, textarea, select, button, .btn-remove, .btn-config-resource, .btn-add, .btn-secondary, .btn-remove-attack, .btn-remove-spell');
            inputs.forEach(input => {
                input.addEventListener('dragstart', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                });
            });
        });
    }
    
    /**
     * Intercambiar dos tarjetas de posición
     */
    swapCards(cardA, cardB) {
        // Guardar los padres
        const parentA = cardA.parentNode;
        const parentB = cardB.parentNode;
        
        // Guardar los IDs originales
        const idA = cardA.id;
        const idB = cardB.id;
        
        // Crear marcadores de posición
        const placeholderA = document.createElement('div');
        const placeholderB = document.createElement('div');
        
        // Insertar marcadores
        parentA.insertBefore(placeholderA, cardA);
        parentB.insertBefore(placeholderB, cardB);
        
        // Mover las tarjetas
        parentA.insertBefore(cardB, placeholderA);
        parentB.insertBefore(cardA, placeholderB);
        
        // Remover marcadores
        placeholderA.remove();
        placeholderB.remove();
        
        // Restaurar IDs
        cardA.id = idA;
        cardB.id = idB;
        
        // Reinicializar eventos en las tarjetas intercambiadas
        this.reinitializeCard(cardA);
        this.reinitializeCard(cardB);
        
        // Animación de intercambio
        cardA.classList.add('swap-animation');
        cardB.classList.add('swap-animation');
        
        setTimeout(() => {
            cardA.classList.remove('swap-animation');
            cardB.classList.remove('swap-animation');
        }, 300);
    }
    
    /**
     * Reinicializar eventos de una tarjeta después de intercambio
     */
    reinitializeCard(card) {
        // Reasignar eventos de drag al título
        const title = card.querySelector('.card-title');
        if (title) {
            title.style.cursor = 'grab';
            title.setAttribute('draggable', 'true');
            
            // Remover eventos anteriores y agregar nuevos
            title.replaceWith(title.cloneNode(true));
            const newTitle = card.querySelector('.card-title');
            
            newTitle.style.cursor = 'grab';
            newTitle.setAttribute('draggable', 'true');
            
            newTitle.addEventListener('dragstart', (e) => {
                e.stopPropagation();
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', card.id);
                e.dataTransfer.setData('card-id', card.id);
                e.dataTransfer.effectAllowed = 'move';
                newTitle.style.cursor = 'grabbing';
                document.body.classList.add('dragging-active');
            });
            
            newTitle.addEventListener('dragend', (e) => {
                card.classList.remove('dragging');
                newTitle.style.cursor = 'grab';
                document.body.classList.remove('dragging-active');
            });
        }
        
        // Reasignar el manejador de redimensionamiento
        this.addResizeHandle(card);
        
        // Reasignar eventos de botones de eliminar atributos
        const removeButtons = card.querySelectorAll('.btn-remove');
        removeButtons.forEach(btn => {
            btn.replaceWith(btn.cloneNode(true));
        });
    }
    
    loadDefaultAttributes() {
        const container = document.getElementById('attributesContainer');
        container.innerHTML = '';
        this.attributes = [];
        this.attributeCount = 0;
        
        DEFAULT_ATTRIBUTES.forEach(attr => {
            this.addAttribute(attr.name, attr.value, false);
        });
        setTimeout(() => {
        this.updateSavingThrowsFromAttributes();
        this.renderSavingThrows();
        this.updateAllSavingThrows();
            }, 100);
    }
    
    addAttribute(name = 'NUEVO', value = 10, isNew = true) {
        const container = document.getElementById('attributesContainer');
        const id = isNew ? this.attributeCount++ : this.attributes.length;
        
        const attributeItem = document.createElement('div');
        attributeItem.className = 'attribute-item';
        attributeItem.dataset.id = id;
        
        attributeItem.innerHTML = `
            <div class="attribute-header">
                <input type="text" class="attribute-name" value="${name}" 
                       placeholder="Nombre del atributo">
                <button type="button" class="btn-remove">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="ability-score">
                <input type="number" class="ability-value" value="${value}" min="1" max="30">
                <div class="ability-modifier">${this.calculateModifier(value)}</div>
            </div>
        `;
        
        container.appendChild(attributeItem);
        
        if (isNew) {
            this.attributes.push({
                id: id,
                name: name,
                value: value,
                modifier: this.calculateModifier(value)
            });
        }
        
        this.setupAttributeListeners(attributeItem);
        setTimeout(() => {
        this.updateSavingThrowsFromAttributes();
        this.renderSavingThrows();
        this.updateAllSavingThrows();
                }, 100);
    }
    
    setupAttributeListeners(attributeItem) {
        const valueInput = attributeItem.querySelector('.ability-value');
        const nameInput = attributeItem.querySelector('.attribute-name');
        const removeBtn = attributeItem.querySelector('.btn-remove');
        const modifierElement = attributeItem.querySelector('.ability-modifier');
        
        valueInput.addEventListener('input', () => {
            const value = parseInt(valueInput.value) || 0;
            const modifier = this.calculateModifier(value);
            
            if (modifier >= 0) {
                modifierElement.textContent = `+${modifier}`;
                modifierElement.style.color = this.textColors.modifier;
            } else {
                modifierElement.textContent = modifier.toString();
                modifierElement.style.color = this.textColors.modifier;
            }
            
            const id = parseInt(attributeItem.dataset.id);
            const attrIndex = this.attributes.findIndex(a => a.id === id);
            if (attrIndex !== -1) {
                this.attributes[attrIndex].value = value;
                this.attributes[attrIndex].modifier = modifier;
            }

            this.updateAllSavingThrows();
        
        document.dispatchEvent(new CustomEvent('attributeChanged'));
        
        this.saveCharacter();

            const nameInput = attributeItem.querySelector('.attribute-name');
            if (nameInput) {
            const attrName = nameInput.value.trim().toUpperCase();
            const savingThrowIndex = this.savingThrows.findIndex(st => st.basedOn === attrName);
            if (savingThrowIndex !== -1) {
                this.updateSavingThrowValue(savingThrowIndex);
            }
    }
            
            
            this.saveCharacter();
        });
        
        nameInput.addEventListener('blur', () => {
            const id = parseInt(attributeItem.dataset.id);
            const attrIndex = this.attributes.findIndex(a => a.id === id);
            if (attrIndex !== -1) {
                this.attributes[attrIndex].name = nameInput.value.trim() || 'ATRIBUTO';
                document.dispatchEvent(new CustomEvent('attributeNameChanged'));
                this.saveCharacter();
            }
        });
        
        removeBtn.addEventListener('click', () => {
            const totalAttributes = document.querySelectorAll('.attribute-item').length;
            if (totalAttributes <= 3) {
                this.showMessage('Debes mantener al menos 3 atributos', 'warning');
                return;
            }
            
            if (confirm('¿Eliminar este atributo?')) {
                const id = parseInt(attributeItem.dataset.id);
                const attrIndex = this.attributes.findIndex(a => a.id === id);
                if (attrIndex !== -1) {
                    this.attributes.splice(attrIndex, 1);
                }
                attributeItem.remove();
                this.updateSavingThrowsFromAttributes();
                this.renderSavingThrows();
                this.updateAllSavingThrows();
                this.showMessage('Atributo eliminado', 'info');
                this.saveCharacter();
            }
        });
    }
    
    calculateModifier(value) {
        return Math.floor((value - 10) / 2);
    }
    
    setupEventListeners() {
        // Botón añadir atributo
        document.getElementById('addAttributeBtn').addEventListener('click', () => {
            this.addAttribute();
            this.saveCharacter();
        });
        
        // Botones de maná
        document.getElementById('manaPlusBtn').addEventListener('click', () => {
            this.changeMana(1);
            this.saveCharacter();
        });
        
        document.getElementById('manaMinusBtn').addEventListener('click', () => {
            this.changeMana(-1);
            this.saveCharacter();
        });
        
        document.getElementById('manaInput').addEventListener('change', (e) => {
            this.setMana(parseInt(e.target.value) || 0);
            this.saveCharacter();
        });
        
        // Configurar maná
        document.getElementById('configManaBtn').addEventListener('click', () => {
            this.showManaConfigModal();
        });
        
        // Controles de HP
        document.getElementById('current-hp').addEventListener('input', (e) => {
            this.currentHP = parseInt(e.target.value) || 0;
            this.updateHPDisplay();
            this.saveCharacter();
        });
        
        document.getElementById('max-hp').addEventListener('input', (e) => {
            this.maxHP = parseInt(e.target.value) || 1;
            this.updateHPDisplay();
            this.saveCharacter();
        });
        
        document.getElementById('temp-hp').addEventListener('input', (e) => {
            this.tempHP = parseInt(e.target.value) || 0;
            this.saveCharacter();
        });
        
        // Botón añadir ataque
        document.getElementById('addAttackBtn').addEventListener('click', () => {
            this.addAttack();
            this.saveCharacter();
        });
        
        // Botón añadir conjuro
        document.getElementById('addSpellBtn').addEventListener('click', () => {
            this.addSpell();
            this.saveCharacter();
        });
        
        // Botón guardar
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveCharacter();
        });
        
        // Botón importar
        document.getElementById('importBtn').addEventListener('click', () => {
            this.importCharacter();
        });
        
        // Botón exportar
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportCharacter();
        });
        
        // Botón restablecer
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (confirm('¿Restablecer toda la hoja de personaje? Se perderán los cambios no guardados.')) {
                this.resetCharacter();
            }
        });
        
        // Cerrar modal
        document.getElementById('closeModalBtn').addEventListener('click', () => {
            document.getElementById('configModal').style.display = 'none';
        });
        
        document.getElementById('configModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('configModal')) {
                document.getElementById('configModal').style.display = 'none';
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && document.getElementById('configModal').style.display === 'flex') {
                document.getElementById('configModal').style.display = 'none';
            }
        });
        
        // Controles rápidos de HP
        this.setupQuickHPControls();
    }
    
    // ===== MÉTODO DE IMPORTAR PERSONAJE =====
    
importCharacter() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json,.pdf';
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const fileExt = file.name.split('.').pop().toLowerCase();
        
        if (fileExt === 'json') {
            // Procesar JSON
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const characterData = JSON.parse(event.target.result);
                    this.loadCharacterFromData(characterData);
                    this.showMessage('Personaje JSON cargado correctamente', 'info');
                } catch (error) {
                    console.error('Error al cargar archivo:', error);
                    this.showMessage('Error al cargar el archivo JSON. Formato inválido.', 'error');
                }
            };
            reader.readAsText(file);
            
        } else if (fileExt === 'pdf') {
            // Procesar PDF
            try {
                this.showMessage('Procesando PDF...', 'info');
                
                const pdfImporter = new PDFImporter();
                const result = await pdfImporter.importFromPDF(file);
                
                if (result.success) {
                    this.loadCharacterFromData(result.data);
                    this.showMessage('Personaje PDF cargado correctamente', 'info');
                } else {
                    this.showMessage('Error al procesar PDF: ' + result.error, 'error');
                }
            } catch (error) {
                console.error('Error al procesar PDF:', error);
                this.showMessage('Error al procesar el archivo PDF', 'error');
            }
        }
    });
    
    fileInput.click();
}
    
    /**
 * Cargar datos del personaje desde un objeto
 */
loadCharacterFromData(characterData) {
    if (characterData.basicInfo) {
        document.getElementById('char-name').value = characterData.basicInfo.name || '';
        document.getElementById('char-class').value = characterData.basicInfo.class || '';
        document.getElementById('char-race').value = document.getElementById('char-race')?.value || characterData.basicInfo.race || '';
        document.getElementById('char-bg').value = characterData.basicInfo.background || '';
        document.getElementById('char-align').value = characterData.basicInfo.alignment || '';
    }
    
    if (characterData.hp) {
        this.currentHP = characterData.hp.current || 26;
        this.maxHP = characterData.hp.max || 26;
        this.tempHP = characterData.hp.temp || 0;
        this.updateHPDisplay();
    }
    
    if (characterData.mana) {
        this.currentMana = characterData.mana.current || 2;
        this.maxMana = characterData.mana.max || 15;
        this.updateManaDisplay();
    }
    
    if (characterData.spellSlots) {
        this.spellSlots = characterData.spellSlots;
        document.getElementById('spellLevel').value = this.spellSlots.level;
        document.getElementById('totalSlots').value = this.spellSlots.total;
        this.generateSpellGems();
    }
    
    // Cargar atributos
    if (characterData.attributes && characterData.attributes.length > 0) {
        document.getElementById('attributesContainer').innerHTML = '';
        this.attributes = [];
        characterData.attributes.forEach(attr => {
            this.addAttribute(attr.name || attr.nombre, attr.value || attr.valor, true);
        });
    } else if (characterData.stats?.atributos && characterData.stats.atributos.length > 0) {
        document.getElementById('attributesContainer').innerHTML = '';
        this.attributes = [];
        characterData.stats.atributos.forEach(attr => {
            this.addAttribute(attr.nombre, attr.valor, true);
        });
    }
    
    // Cargar ataques
    if (characterData.attacks && characterData.attacks.length > 0) {
        const attacksList = document.querySelector('.attacks-list');
        const attackItems = attacksList.querySelectorAll('.attack-item');
        attackItems.forEach(item => item.remove());
        
        characterData.attacks.forEach(attack => {
            this.addAttack(attack.name, attack.bonus, attack.damage, false);
        });
    }
    
    // Cargar conjuros
    if (characterData.spells && characterData.spells.length > 0) {
        const spellsList = document.getElementById('spellsList');
        spellsList.innerHTML = '';
        
        characterData.spells.forEach(spell => {
            this.addSpell(spell.name, spell.level, spell.description, false);
        });
    }
    
    // Cargar experiencia
    if (characterData.exp) {
        this.currentExp = characterData.exp.current || 0;
        this.maxExp = characterData.exp.max || 300;
        this.characterLevel = characterData.exp.level || 1;
        
        document.getElementById('current-exp').value = this.currentExp;
        document.getElementById('max-exp').value = this.maxExp;
        document.getElementById('character-level').value = this.characterLevel;
        document.getElementById('level-display').textContent = this.characterLevel;
        this.updateExpDisplay();
    }
    
    // Cargar inventario
    if (characterData.currency) {
        this.currency = characterData.currency;
        this.updateCurrencyDisplay();
    }
    
    if (characterData.treasures) {
        this.treasures = characterData.treasures;
        this.renderTreasures();
    }
    
    if (characterData.potions) {
        this.potions = characterData.potions;
        this.renderPotions();
    }
    
    // Cargar equipo
    if (characterData.equipment) {
        this.equipment = characterData.equipment;
        this.renderEquipment();
        
        setTimeout(() => {
            this.equipment.forEach(item => {
                if (item.attribute && item.bonus !== 0) {
                    this.applyEquipmentBonus(item, true);
                }
            });
        }, 500);
    }
    
    // Cargar notas
    if (characterData.notas) {
        document.getElementById('personality').value = characterData.notas.personalidad || '';
        document.getElementById('ideals').value = characterData.notas.ideales || '';
        document.getElementById('bonds').value = characterData.notas.vinculos || '';
        document.getElementById('flaws').value = characterData.notas.defectos || '';
        document.getElementById('features').value = characterData.notas.rasgos || '';
    }
    
    // ===== NUEVO: Cargar habilidades (skills) =====
    if (characterData.skills && characterData.skills.length > 0) {
        this.loadSkillsFromData(characterData);
    }
    
    // ===== NUEVO: Cargar percepción pasiva =====
    if (characterData.passivePerception !== undefined) {
        this.loadPassivePerceptionFromData(characterData);
    }
    
    // ===== NUEVO: Cargar competencias e idiomas (proficiencies) =====
    if (characterData.proficiencies && characterData.proficiencies.length > 0) {
        this.loadProficienciesFromData(characterData);
    }
    
    // ===== NUEVO: Cargar salvaciones de muerte =====
    if (characterData.deathSaves) {
        this.loadDeathSavesFromData(characterData);
    }
    
    // ===== NUEVO: Cargar tiradas de salvación (savingThrows) =====
    if (characterData.savingThrows && characterData.savingThrows.length > 0) {
        this.loadSavingThrowsFromData(characterData);
    }
    
    this.saveCharacter();
}

// Cargar tiradas de salvación desde los datos

loadSavingThrowsFromData(data) {
    if (data.savingThrows && data.savingThrows.length > 0) {
        this.savingThrows = data.savingThrows.map(st => ({
            name: st.name,
            value: st.value,
            proficient: st.proficient,
            basedOn: st.basedOn || st.name
        }));
        
        // Renderizar las tiradas de salvación
        this.renderSavingThrows();
        
        // Sincronizar con los atributos existentes
        setTimeout(() => {
            this.updateAllSavingThrows();
        }, 200);
    }
}
    
    changeMana(amount) {
        this.currentMana = Math.max(0, Math.min(this.maxMana, this.currentMana + amount));
        this.updateManaDisplay();
    }
    
    setMana(value) {
        this.currentMana = Math.max(0, Math.min(this.maxMana, value));
        this.updateManaDisplay();
    }
    
    updateManaDisplay() {
        const manaInput = document.getElementById('manaInput');
        const currentManaSpan = document.getElementById('currentMana');
        const maxManaSpan = document.getElementById('maxMana');
        const manaBarFill = document.getElementById('manaBarFill');
        
        manaInput.value = this.currentMana;
        currentManaSpan.textContent = this.currentMana;
        maxManaSpan.textContent = this.maxMana;
        
        const percentage = (this.currentMana / this.maxMana) * 100;
        manaBarFill.style.width = `${percentage}%`;
        
        // Cambiar color según nivel
        if (percentage < 20) {
            manaBarFill.style.background = 'linear-gradient(90deg, #ff4444, #ff6b6b)';
        } else if (percentage < 50) {
            manaBarFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
        } else {
            manaBarFill.style.background = 'linear-gradient(90deg, var(--mana-color), #6495ed)';
        }
        
        manaInput.max = this.maxMana;
    }
    
    updateHPDisplay() {
        const currentHPInput = document.getElementById('current-hp');
        const maxHPInput = document.getElementById('max-hp');
        const hpBarFill = document.getElementById('hpBarFill');
        const hpCurrentLabel = document.getElementById('hpCurrentLabel');
        const hpMaxLabel = document.getElementById('hpMaxLabel');
        
        currentHPInput.value = this.currentHP;
        maxHPInput.value = this.maxHP;
        
        const percentage = Math.min(100, (this.currentHP / this.maxHP) * 100);
        hpBarFill.style.width = `${percentage}%`;
        hpCurrentLabel.textContent = this.currentHP;
        hpMaxLabel.textContent = this.maxHP;
        
        // Cambiar color según porcentaje
        if (percentage < 25) {
            hpBarFill.style.background = 'linear-gradient(90deg, #000000, #332f2f)';
        } else if (percentage < 50) {
            hpBarFill.style.background = 'linear-gradient(90deg, #ffaa00, #ffcc44)';
        } else if (percentage < 75) {
            hpBarFill.style.background = 'linear-gradient(90deg, var(--hp-color), #ff6b6b)';
        }
    }
    
    showManaConfigModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-bolt"></i> Configurar Maná</h4>
            <div class="form-row">
                <label>Maná Máximo</label>
                <input type="number" id="configMaxMana" value="${this.maxMana}" min="1" max="999">
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveManaConfigBtn">
                    <i class="fas fa-check"></i> Guardar
                </button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelManaConfigBtn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveManaConfigBtn').addEventListener('click', () => {
            const newMax = parseInt(document.getElementById('configMaxMana').value) || 15;
            this.maxMana = Math.max(1, newMax);
            
            if (this.currentMana > this.maxMana) {
                this.currentMana = this.maxMana;
            }
            
            this.updateManaDisplay();
            this.saveCharacter();
            modal.style.display = 'none';
        });
        
        document.getElementById('cancelManaConfigBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    setupQuickHPControls() {
        const hpContainer = document.querySelector('.hp-container');
        const barContainer = document.querySelector('.hp-bar-container');
        
        // Verificar si ya existen controles
        if (!document.querySelector('.hp-quick-controls')) {
            const quickControls = document.createElement('div');
            quickControls.className = 'hp-quick-controls';
            quickControls.innerHTML = `
                <button type="button" class="hp-quick-btn hp-damage" data-amount="-1">-1</button>
                <button type="button" class="hp-quick-btn hp-damage" data-amount="-5">-5</button>
                <button type="button" class="hp-quick-btn hp-heal" data-amount="+1">+1</button>
                <button type="button" class="hp-quick-btn hp-heal" data-amount="+5">+5</button>
            `;
            
            hpContainer.insertBefore(quickControls, barContainer.nextSibling);
            
            quickControls.addEventListener('click', (e) => {
                if (e.target.classList.contains('hp-quick-btn')) {
                    const amount = parseInt(e.target.dataset.amount);
                    this.currentHP = Math.max(0, Math.min(this.maxHP, this.currentHP + amount));
                    this.updateHPDisplay();
                    this.saveCharacter();
                }
            });
        }
    }
    
    setupImageUpload() {
    const uploadArea = document.getElementById('imageUploadArea');
    const imageUpload = document.getElementById('imageUpload');
    const imagePreview = document.getElementById('imagePreview');
    const characterImage = document.getElementById('characterImage');
    const imageContainer = document.getElementById('imageContainer');
    
    uploadArea.addEventListener('click', () => imageUpload.click());
    
    imageUpload.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Mostrar preview inmediato
        const reader = new FileReader();
        reader.onload = (event) => {
            characterImage.src = event.target.result;
            uploadArea.style.display = 'none';
            imagePreview.style.display = 'flex';
            imageContainer.classList.add('has-image');
        };
        reader.readAsDataURL(file);
        
        // Subir al servidor
        try {
            const imagenUrl = await this.subirImagenAlServidor(file);
            if (imagenUrl) {
                // Guardar la URL en localStorage para usarla después
                localStorage.setItem('imagenUrl', imagenUrl);
                console.log('✅ Imagen subida:', imagenUrl);
                this.showMessage('Imagen subida correctamente', 'info');
            }
        } catch (error) {
            console.error('❌ Error subiendo imagen:', error);
            this.showMessage('Error al subir la imagen', 'error');
        }
    });
    
    const changeImageBtn = document.getElementById('changeImageBtn');
    if (changeImageBtn) {
        changeImageBtn.addEventListener('click', () => {
            imageUpload.click();
        });
    }
    
    // Cargar imagen guardada (URL del servidor)
    const imagenUrl = localStorage.getItem('imagenUrl');
    if (imagenUrl) {
        characterImage.src = imagenUrl;
        characterImage.onload = () => {
            uploadArea.style.display = 'none';
            imagePreview.style.display = 'flex';
            imageContainer.classList.add('has-image');
        };
    }
}

 // ===== NUEVO: MÉTODOS PARA SALVACIONES DE MUERTE =====
    
    setupDeathSaves() {
        const successCheckboxes = document.querySelectorAll('.death-save-success');
        const failCheckboxes = document.querySelectorAll('.death-save-fail');
        
        successCheckboxes.forEach((checkbox, index) => {
            checkbox.addEventListener('change', (e) => {
                this.deathSaves.successes[index] = e.target.checked;
                this.checkDeathSaveStatus();
                this.saveCharacter();
            });
        });
        
        failCheckboxes.forEach((checkbox, index) => {
            checkbox.addEventListener('change', (e) => {
                this.deathSaves.fails[index] = e.target.checked;
                this.checkDeathSaveStatus();
                this.saveCharacter();
            });
        });
    }
    
    checkDeathSaveStatus() {
        const successCount = this.deathSaves.successes.filter(Boolean).length;
        const failCount = this.deathSaves.fails.filter(Boolean).length;
        
        if (successCount >= 3) {
            this.showMessage('¡Personaje estable! 3 éxitos en salvaciones de muerte', 'info');
    
        } else if (failCount >= 3) {
            this.showMessage('¡Personaje ha muerto! 3 fallos en salvaciones de muerte', 'error');

        }
    }
    
    resetDeathSaves() {
        this.deathSaves.successes = [false, false, false];
        this.deathSaves.fails = [false, false, false];
        
        document.querySelectorAll('.death-save-success').forEach(cb => cb.checked = false);
        document.querySelectorAll('.death-save-fail').forEach(cb => cb.checked = false);
        this.saveCharacter();
    }
    
    // ===== NUEVO: MÉTODOS PARA HABILIDADES =====
    
    setupSkills() {
        document.getElementById('addSkillBtn').addEventListener('click', () => {
            this.addSkill('', 0);
        });
        
        document.getElementById('removeAllSkillsBtn').addEventListener('click', () => {
            if (confirm('¿Estás seguro de que quieres eliminar TODAS las habilidades?')) {
                this.skills = [];
                this.renderSkills();
                this.saveCharacter();
                this.showMessage('Todas las habilidades eliminadas', 'info');
            }
        });
        
        // Cargar habilidades por defecto
        this.defaultSkills.forEach(skill => {
            this.addSkill(skill.name, skill.bonus, false);
        });
        
        this.renderSkills();
    }
    
    addSkill(name = '', bonus = 0, saveToStorage = true) {
        const skill = {
            id: Date.now() + Math.random(),
            name: name,
            bonus: bonus
        };
        
        this.skills.push(skill);
        this.renderSkills();
        
        if (saveToStorage) {
            this.saveCharacter();
            this.showMessage('Habilidad añadida', 'info');
        }
    }
    
    renderSkills() {
        const container = document.getElementById('skillsContainer');
        if (!container) return;
        
        container.innerHTML = '';
        
        if (this.skills.length === 0) {
            container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center; padding: 20px;">No hay habilidades. Añade una nueva.</p>';
            return;
        }
        
        // Ordenar alfabéticamente
        this.skills.sort((a, b) => a.name.localeCompare(b.name));
        
        this.skills.forEach(skill => {
            const skillItem = document.createElement('div');
            skillItem.className = 'skill-item';
            skillItem.dataset.id = skill.id;
            
            const bonusClass = skill.bonus > 0 ? 'positive' : (skill.bonus < 0 ? 'negative' : '');
            
            skillItem.innerHTML = `
                <input type="text" class="skill-name" value="${skill.name}" placeholder="Habilidad">
                <input type="number" class="skill-bonus ${bonusClass}" value="${skill.bonus}" min="-10" max="20">
                <button type="button" class="btn-remove-skill" title="Eliminar habilidad">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            container.appendChild(skillItem);
            
            // Event listeners
            const nameInput = skillItem.querySelector('.skill-name');
            const bonusInput = skillItem.querySelector('.skill-bonus');
            const removeBtn = skillItem.querySelector('.btn-remove-skill');
            
            nameInput.addEventListener('input', () => {
                skill.name = nameInput.value;
                this.saveCharacter();
            });
            
            bonusInput.addEventListener('input', () => {
                skill.bonus = parseInt(bonusInput.value) || 0;
                bonusInput.className = `skill-bonus ${skill.bonus > 0 ? 'positive' : (skill.bonus < 0 ? 'negative' : '')}`;
                this.saveCharacter();
            });
            
            removeBtn.addEventListener('click', () => {
                this.removeSkill(skill.id);
            });
        });
    }
    
    removeSkill(id) {
        if (confirm('¿Eliminar esta habilidad?')) {
            this.skills = this.skills.filter(s => s.id !== id);
            this.renderSkills();
            this.saveCharacter();
            this.showMessage('Habilidad eliminada', 'info');
        }
    }
    
    // ===== NUEVO: MÉTODO PARA PERCEPCIÓN PASIVA =====
    
    setupPassivePerception() {
        const perceptionInput = document.getElementById('passivePerception');
        
        perceptionInput.addEventListener('input', () => {
            this.passivePerception = parseInt(perceptionInput.value) || 10;
            this.saveCharacter();
        });
        
        // Actualizar percepción pasiva basado en sabiduría (opcional)
        this.updatePassivePerceptionFromWisdom();
    }
    
    updatePassivePerceptionFromWisdom() {
        // Buscar el atributo de Sabiduría
        const wisdomItem = Array.from(document.querySelectorAll('.attribute-item')).find(item => {
            const nameInput = item.querySelector('.attribute-name');
            return nameInput && nameInput.value.trim().toUpperCase() === 'SABIDURÍA';
        });
        
        if (wisdomItem) {
            const valueInput = wisdomItem.querySelector('.ability-value');
            if (valueInput) {
                const wisdom = parseInt(valueInput.value) || 10;
                const wisdomMod = this.calculateModifier(wisdom);
                // Fórmula: 10 + modificador de sabiduría + bonificador de competencia (opcional)
                const basePassive = 10 + wisdomMod;
                const proficiencyBonus = Math.floor((this.characterLevel - 1) / 4) + 2; // +2 a +6 según nivel
                
                // Si tiene competencia en Percepción, sumar bonificador de competencia
                const hasPerception = this.skills.some(s => 
                    s.name.toLowerCase().includes('percepción') && s.bonus > 0
                );
                
                const total = hasPerception ? basePassive + proficiencyBonus : basePassive;
                
                document.getElementById('passivePerception').value = total;
                this.passivePerception = total;
                this.saveCharacter();
            }
        }
    }
    
    // ===== NUEVO: MÉTODOS PARA COMPETENCIAS E IDIOMAS =====
    
    setupProficiencies() {
        document.getElementById('addProficiencyBtn').addEventListener('click', () => {
            this.addProficiency('', 'language');
        });
        
        this.setupProficiencyTabs();
        this.renderProficiencies();
    }
    
    setupProficiencyTabs() {
        const tabs = document.querySelectorAll('.proficiency-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                const type = tab.dataset.type;
                this.filterProficiencies(type);
            });
        });
    }
    
    addProficiency(name = '', type = 'language', saveToStorage = true) {
    // Si no se proporciona nombre, no añadir
    if (!name.trim()) return;
    
    const proficiency = {
        id: Date.now() + Math.random(),
        name: name,
        type: type
    };
    
    this.proficiencies.push(proficiency);
    
    // Ordenar automáticamente las competencias
    this.sortProficiencies();
    
    this.renderProficiencies(document.querySelector('.proficiency-tab.active').dataset.type);
    
    if (saveToStorage) {
        this.saveCharacter();
        // Abrir modal de edición para la nueva competencia
        setTimeout(() => {
            this.openProficiencyEditModal(proficiency);
        }, 100);
    }
}

renderProficiencies(filterType = 'all') {
    const container = document.getElementById('proficienciesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (this.proficiencies.length === 0) {
        container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center; padding: 20px;">No hay competencias o idiomas. Haz clic en + para añadir.</p>';
        return;
    }
    
    // Asegurar que estén ordenadas antes de filtrar
    this.sortProficiencies();
    
    // Filtrar según pestaña activa
    let filteredProficiencies = this.proficiencies;
    if (filterType !== 'all') {
        filteredProficiencies = this.proficiencies.filter(p => p.type === filterType);
    }
    
    // Ya están ordenadas por tipo y nombre gracias a sortProficiencies()
    
    filteredProficiencies.forEach(prof => {
        const profButton = document.createElement('button');
        profButton.className = 'proficiency-button';
        profButton.dataset.id = prof.id;
        profButton.dataset.type = prof.type;
        
        const icon = this.getProficiencyIcon(prof.type);
        
        profButton.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${prof.name}</span>
        `;
        
        // Al hacer clic, abrir modal de edición
        profButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openProficiencyEditModal(prof);
        });
        
        container.appendChild(profButton);
    });
}

// ===== NUEVO: Ordenar competencias por tipo y nombre =====
sortProficiencies() {
    // Ordenar primero por tipo y luego por nombre
    this.proficiencies.sort((a, b) => {
        // Definir orden de tipos
        const typeOrder = {
            'armor': 1,
            'weapon': 2,
            'tool': 3,
            'language': 4
        };
        
        const orderA = typeOrder[a.type] || 99;
        const orderB = typeOrder[b.type] || 99;
        
        // Si son del mismo tipo, ordenar alfabéticamente
        if (orderA === orderB) {
            return a.name.localeCompare(b.name);
        }
        
        // Ordenar por tipo
        return orderA - orderB;
    });
}

// ===== NUEVO: MÉTODOS PARA TIRADAS DE SALVACIÓN =====

setupSavingThrows() {
    this.updateSavingThrowsFromAttributes();
    this.renderSavingThrows();
    
    // Escuchar cambios en atributos
    this.setupAttributeSync();
}

setupAttributeSync() {
    // Observar cambios en el contenedor de atributos
    const attributesContainer = document.getElementById('attributesContainer');
    if (attributesContainer) {
        const observer = new MutationObserver((mutations) => {
            // Verificar si se añadió o eliminó un atributo
            const relevantChange = mutations.some(m => 
                m.type === 'childList' || 
                (m.type === 'attributes' && m.attributeName === 'value')
            );
            
            if (relevantChange) {
                setTimeout(() => {
                    this.updateSavingThrowsFromAttributes();
                    this.renderSavingThrows();
                    this.updateAllSavingThrows();
                }, 100);
            }
        });
        
        observer.observe(attributesContainer, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['value']
        });
    }
    
    // También actualizar cuando se edite un nombre de atributo
    document.addEventListener('attributeNameChanged', () => {
        this.updateSavingThrowsFromAttributes();
        this.renderSavingThrows();
        this.updateAllSavingThrows();
    });
}

updateSavingThrowsFromAttributes() {
    const attributeItems = document.querySelectorAll('.attribute-item');
    const newSavingThrows = [];
    
    attributeItems.forEach(item => {
        const nameInput = item.querySelector('.attribute-name');
        if (nameInput) {
            const attrName = nameInput.value.trim();
            if (attrName) {
                // Buscar si ya existe una salvación para este atributo
                const existing = this.savingThrows.find(st => 
                    st.basedOn.toUpperCase() === attrName.toUpperCase()
                );
                
                if (existing) {
                    // Mantener el estado de competencia existente
                    newSavingThrows.push({
                        name: attrName,
                        value: existing.value,
                        proficient: existing.proficient,
                        basedOn: attrName
                    });
                } else {
                    // Crear nueva salvación
                    newSavingThrows.push({
                        name: attrName,
                        value: 0,
                        proficient: false,
                        basedOn: attrName
                    });
                }
            }
        }
    });
    
    this.savingThrows = newSavingThrows;
}

renderSavingThrows() {
    const container = document.getElementById('savingThrowsContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (this.savingThrows.length === 0) {
        container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center; padding: 10px;">No hay atributos para mostrar salvaciones</p>';
        return;
    }
    
    this.savingThrows.forEach((savingThrow, index) => {
        const item = document.createElement('div');
        item.className = 'saving-throw-item';
        item.dataset.index = index;
        item.title = savingThrow.name; // Tooltip con nombre completo
        
        const valueClass = savingThrow.value > 0 ? 'positive' : (savingThrow.value < 0 ? 'negative' : '');
        const profIcon = savingThrow.proficient ? 'fa-check-circle' : 'fa-circle';
        const profClass = savingThrow.proficient ? 'proficient' : '';
        
        // ABREVIAR NOMBRES LARGOS AQUÍ
        let displayName = savingThrow.name;
        if (displayName.length > 10) {
            displayName = displayName.substring(0, 9) + '…';
        }
        
        // Crear un ID único para cada input
        const inputId = `saving-throw-${index}-${Date.now()}`;
        
        item.innerHTML = `
            <span class="saving-throw-name" title="${savingThrow.name}">${displayName}</span>
            <input type="number" id="${inputId}" class="saving-throw-value ${valueClass}" value="${savingThrow.value}" min="-10" max="20" step="1" readonly>
            <span class="saving-throw-proficiency ${profClass}" title="Competencia en ${savingThrow.name}">
                <i class="fas ${profIcon}"></i>
            </span>
        `;
        
        container.appendChild(item);
        
        const profIconElement = item.querySelector('.saving-throw-proficiency');
        profIconElement.addEventListener('click', () => {
            savingThrow.proficient = !savingThrow.proficient;
            this.updateSavingThrowValue(index);
            this.saveCharacter();
            
            profIconElement.classList.toggle('proficient');
            const icon = profIconElement.querySelector('i');
            icon.className = savingThrow.proficient ? 'fas fa-check-circle' : 'fas fa-circle';
            profIconElement.title = savingThrow.proficient ? 
                `Competente en ${savingThrow.name}` : 
                `No competente en ${savingThrow.name}`;
        });
    });
}

updateSavingThrowValue(index) {
    if (index < 0 || index >= this.savingThrows.length) return;
    
    const savingThrow = this.savingThrows[index];
    
    // Buscar el atributo correspondiente por nombre
    const attributeItem = Array.from(document.querySelectorAll('.attribute-item')).find(item => {
        const nameInput = item.querySelector('.attribute-name');
        return nameInput && nameInput.value.trim().toUpperCase() === savingThrow.basedOn.toUpperCase();
    });
    
    if (attributeItem) {
        const valueInput = attributeItem.querySelector('.ability-value');
        if (valueInput) {
            const attributeValue = parseInt(valueInput.value) || 10;
            const attributeMod = this.calculateModifier(attributeValue);
            
            // Calcular bonificador de competencia
            const proficiencyBonus = savingThrow.proficient ? (Math.floor((this.characterLevel - 1) / 4) + 2) : 0;
            
            // Valor total = modificador de atributo + competencia (si aplica)
            savingThrow.value = attributeMod + proficiencyBonus;
            
            // Actualizar el input en el DOM
            const container = document.getElementById('savingThrowsContainer');
            if (container && index < container.children.length) {
                const item = container.children[index];
                const valueInput = item.querySelector('.saving-throw-value');
                if (valueInput) {
                    valueInput.value = savingThrow.value;
                    
                    // Actualizar clase de color
                    valueInput.classList.remove('positive', 'negative');
                    if (savingThrow.value > 0) {
                        valueInput.classList.add('positive');
                    } else if (savingThrow.value < 0) {
                        valueInput.classList.add('negative');
                    }
                }
            }
        }
    }
}

updateAllSavingThrows() {
    this.savingThrows.forEach((_, index) => {
        this.updateSavingThrowValue(index);
    });
}

// Nuevo método: Abrir modal para editar competencia
openProficiencyEditModal(proficiency) {
    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'proficiency-edit-modal';
    modal.id = 'proficiencyEditModal';
    
    modal.innerHTML = `
        <div class="proficiency-edit-content">
            <div class="proficiency-edit-header">
                <h4><i class="fas fa-edit"></i> Editar Competencia</h4>
                <button class="proficiency-edit-close" id="closeEditModal">&times;</button>
            </div>
            <div class="proficiency-edit-body">
                <input type="text" id="editProficiencyName" value="${proficiency.name}" placeholder="Nombre">
                <select id="editProficiencyType">
                    <option value="armor" ${proficiency.type === 'armor' ? 'selected' : ''}>Armadura</option>
                    <option value="weapon" ${proficiency.type === 'weapon' ? 'selected' : ''}>Arma</option>
                    <option value="tool" ${proficiency.type === 'tool' ? 'selected' : ''}>Herramienta</option>
                    <option value="language" ${proficiency.type === 'language' ? 'selected' : ''}>Idioma</option>
                </select>
            </div>
            <div class="proficiency-edit-actions">
                <button class="proficiency-edit-btn delete" id="deleteProficiencyBtn">
                    <i class="fas fa-trash"></i> Eliminar
                </button>
                <button class="proficiency-edit-btn cancel" id="cancelEditBtn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
                <button class="proficiency-edit-btn save" id="saveEditBtn">
                    <i class="fas fa-check"></i> Guardar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
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
            proficiency.name = newName;
            proficiency.type = newType;
            this.sortProficiencies();
            this.renderProficiencies(document.querySelector('.proficiency-tab.active').dataset.type);
            this.saveCharacter();
            this.showMessage('Competencia actualizada', 'info');
            modal.remove();
        } else {
            this.showMessage('El nombre no puede estar vacío', 'warning');
        }
    });
    
    document.getElementById('deleteProficiencyBtn').addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres eliminar esta competencia?')) {
            this.proficiencies = this.proficiencies.filter(p => p.id !== proficiency.id);
            this.renderProficiencies(document.querySelector('.proficiency-tab.active').dataset.type);
            this.saveCharacter();
            this.showMessage('Competencia eliminada', 'info');
            modal.remove();
        }
    });
    
    // Cerrar al hacer clic fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Modificar el método addProficiency para abrir modal de edición después de crear
addProficiency(name = '', type = 'language', saveToStorage = true) {
    const proficiency = {
        id: Date.now() + Math.random(),
        name: name,
        type: type
    };
    
    this.proficiencies.push(proficiency);
    this.renderProficiencies(document.querySelector('.proficiency-tab.active').dataset.type);
    
    if (saveToStorage) {
        this.saveCharacter();
        // Abrir modal de edición para la nueva competencia
        setTimeout(() => {
            this.openProficiencyEditModal(proficiency);
        }, 100);
    }
}

loadProficienciesFromData(data) {
    if (data.proficiencies && data.proficiencies.length > 0) {
        this.proficiencies = data.proficiencies.map(prof => ({
            id: prof.id || Date.now() + Math.random(),
            name: prof.name,
            type: prof.type || 'language'
        }));
    } else {
        // Competencias por defecto
        this.proficiencies = [
            { id: Date.now() + 1, name: 'Común', type: 'language' },
            { id: Date.now() + 2, name: 'Armaduras ligeras', type: 'armor' },
            { id: Date.now() + 3, name: 'Armas simples', type: 'weapon' }
        ];
    }
    
    // Ordenar al cargar
    this.sortProficiencies();
    this.renderProficiencies();
}

    getProficiencyIcon(type) {
        switch(type) {
            case 'armor': return 'fa-shield-alt';
            case 'weapon': return 'fa-crosshairs';
            case 'tool': return 'fa-tools';
            case 'language': return 'fa-language';
            default: return 'fa-tag';
        }
    }
    
    filterProficiencies(type) {
        this.renderProficiencies(type);
    }
    
    removeProficiency(id) {
        if (confirm('¿Eliminar esta competencia/idioma?')) {
            this.proficiencies = this.proficiencies.filter(p => p.id !== id);
            this.renderProficiencies(document.querySelector('.proficiency-tab.active').dataset.type);
            this.saveCharacter();
            this.showMessage('Competencia/Idioma eliminado', 'info');
        }
    }
    
    // ===== CARGAR DATOS GUARDADOS =====
    loadDeathSavesFromData(data) {
    if (data.deathSaves) {
        this.deathSaves = {
            successes: data.deathSaves.successes || [false, false, false],
            fails: data.deathSaves.fails || [false, false, false]
        };
        
        const successCheckboxes = document.querySelectorAll('.death-save-success');
        const failCheckboxes = document.querySelectorAll('.death-save-fail');
        
        this.deathSaves.successes.forEach((checked, index) => {
            if (successCheckboxes[index]) successCheckboxes[index].checked = checked;
        });
        
        this.deathSaves.fails.forEach((checked, index) => {
            if (failCheckboxes[index]) failCheckboxes[index].checked = checked;
        });
    }
}
    
    loadSkillsFromData(data) {
        if (data.skills && data.skills.length > 0) {
            this.skills = data.skills;
        } else {
            this.skills = [...this.defaultSkills];
        }
        this.renderSkills();
    }
    
    loadPassivePerceptionFromData(data) {
    if (data.passivePerception !== undefined) {
        this.passivePerception = data.passivePerception;
        const perceptionInput = document.getElementById('passivePerception');
        if (perceptionInput) {
            perceptionInput.value = this.passivePerception;
        }
    }
}
    
    loadProficienciesFromData(data) {
        if (data.proficiencies && data.proficiencies.length > 0) {
            this.proficiencies = data.proficiencies;
        } else {
            // Competencias por defecto
            this.proficiencies = [
                { id: Date.now() + 1, name: 'Común', type: 'language' },
                { id: Date.now() + 2, name: 'Armaduras ligeras', type: 'armor' },
                { id: Date.now() + 3, name: 'Armas simples', type: 'weapon' }
            ];
        }
        this.renderProficiencies();
    }

// NUEVO MÉTODO: Subir imagen al servidor
async subirImagenAlServidor(file) {
    const formData = new FormData();
    formData.append('imagen', file);
    
    try {
        const response = await fetch('/api/imagenes/subir', {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.imagenUrl;
        } else {
            console.error('Error en respuesta:', response.status);
            return null;
        }
    } catch (error) {
        console.error('Error subiendo imagen:', error);
        return null;
    }
}
    
    setupSpellSlots() {
        const configSlotsBtn = document.getElementById('configSlotsBtn');
        const slotsGrid = document.getElementById('slotsGrid');
        
        slotsGrid.innerHTML = `
            <div class="slots-gems-container">
                <div class="slots-config">
                    <div class="form-row">
                        <label>Nivel de Conjuros:</label>
                        <input type="number" id="spellLevel" value="1" min="1" max="9" class="slots-config-input">
                    </div>
                    <div class="form-row">
                        <label>Total de Slots:</label>
                        <input type="number" id="totalSlots" value="4" min="0" max="20" class="slots-config-input">
                    </div>
                    <button type="button" class="btn-secondary" id="applySlotsConfig">
                        <i class="fas fa-check"></i> Aplicar
                    </button>
                </div>
                <div class="slots-gems" id="slotsGems">
                    <!-- Gemas se generan dinámicamente -->
                </div>
            </div>
        `;
        
        // Generar gemas iniciales
        this.generateSpellGems();
        
        document.getElementById('applySlotsConfig').addEventListener('click', () => {
            const level = parseInt(document.getElementById('spellLevel').value) || 1;
            const total = parseInt(document.getElementById('totalSlots').value) || 4;
            
            this.spellSlots = {
                level: Math.max(1, Math.min(9, level)),
                total: Math.max(0, Math.min(20, total)),
                used: Math.min(this.spellSlots.used, total)
            };
            
            this.generateSpellGems();
            this.saveCharacter();
        });
        
        configSlotsBtn.addEventListener('click', () => {
            const modal = document.getElementById('configModal');
            const modalBody = document.getElementById('modalBody');
            
            modalBody.innerHTML = `
                <h4><i class="fas fa-gem"></i> Configurar Slots de Conjuros</h4>
                <div class="form-row">
                    <label>Nivel de Conjuros</label>
                    <input type="number" id="modalSpellLevel" value="${this.spellSlots.level}" min="1" max="9">
                </div>
                <div class="form-row">
                    <label>Total de Slots</label>
                    <input type="number" id="modalTotalSlots" value="${this.spellSlots.total}" min="0" max="20">
                </div>
                <div class="form-row">
                    <label>Slots Usados</label>
                    <input type="number" id="modalUsedSlots" value="${this.spellSlots.used}" min="0" max="${this.spellSlots.total}">
                </div>
                <div class="modal-actions">
                    <button type="button" class="btn-secondary" id="saveSlotsConfigBtn">
                        <i class="fas fa-check"></i> Guardar
                    </button>
                    <button type="button" class="btn-secondary btn-cancel" id="cancelSlotsConfigBtn">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            `;
            
            modal.style.display = 'flex';
            
            document.getElementById('saveSlotsConfigBtn').addEventListener('click', () => {
                const level = parseInt(document.getElementById('modalSpellLevel').value) || 1;
                const total = parseInt(document.getElementById('modalTotalSlots').value) || 4;
                const used = parseInt(document.getElementById('modalUsedSlots').value) || 0;
                
                this.spellSlots = {
                    level: Math.max(1, Math.min(9, level)),
                    total: Math.max(0, Math.min(20, total)),
                    used: Math.max(0, Math.min(total, used))
                };
                
                document.getElementById('spellLevel').value = this.spellSlots.level;
                document.getElementById('totalSlots').value = this.spellSlots.total;
                
                this.generateSpellGems();
                this.saveCharacter();
                modal.style.display = 'none';
            });
            
            document.getElementById('cancelSlotsConfigBtn').addEventListener('click', () => {
                modal.style.display = 'none';
            });
        });
    }
    
    generateSpellGems() {
        const slotsGems = document.getElementById('slotsGems');
        slotsGems.innerHTML = '';
        
        for (let i = 0; i < this.spellSlots.total; i++) {
            const gemSlot = document.createElement('div');
            gemSlot.className = `gem-slot ${i < this.spellSlots.used ? 'used' : ''}`;
            gemSlot.dataset.index = i;
            gemSlot.dataset.level = this.spellSlots.level;
            
            gemSlot.innerHTML = `
                <div class="gem-shape">
                    ${i + 1}
                </div>
                <div class="gem-level">Niv. ${this.spellSlots.level}</div>
            `;
            
            gemSlot.addEventListener('click', () => {
                const index = parseInt(gemSlot.dataset.index);
                const isUsed = gemSlot.classList.contains('used');
                
                if (isUsed) {
                    gemSlot.classList.remove('used');
                    this.spellSlots.used--;
                } else {
                    if (this.spellSlots.used < this.spellSlots.total) {
                        gemSlot.classList.add('used');
                        this.spellSlots.used++;
                    }
                }
                
                this.saveCharacter();
            });
            
            slotsGems.appendChild(gemSlot);
        }
        
        if (this.spellSlots.total === 0) {
            slotsGems.innerHTML = '<p style="color: var(--ink-light); font-style: italic;">Sin slots configurados</p>';
        }
    }
    
    setupRedimensionamiento() {
        const cards = document.querySelectorAll('.card');
        
        cards.forEach(card => {
            this.addResizeHandle(card);
        });
    }
    
    addResizeHandle(card) {
        // Evitar duplicar manejadores
        if (card.querySelector('.resize-handle')) return;
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        card.appendChild(resizeHandle);
        
        let isResizing = false;
        let startWidth, startHeight, startX, startY;
        
        const startResize = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            isResizing = true;
            startWidth = parseInt(getComputedStyle(card).width, 10);
            startHeight = parseInt(getComputedStyle(card).height, 10);
            
            if (e.type === 'mousedown') {
                startX = e.clientX;
                startY = e.clientY;
            } else if (e.type === 'touchstart') {
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
            }
            
            document.addEventListener('mousemove', resize);
            document.addEventListener('touchmove', resize);
            document.addEventListener('mouseup', stopResize);
            document.addEventListener('touchend', stopResize);
        };
        
        const resize = (e) => {
            if (!isResizing) return;
            
            e.preventDefault();
            
            let clientX, clientY;
            
            if (e.type === 'mousemove') {
                clientX = e.clientX;
                clientY = e.clientY;
            } else if (e.type === 'touchmove') {
                const touch = e.touches[0];
                clientX = touch.clientX;
                clientY = touch.clientY;
            }
            
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;
            
            const newWidth = Math.max(200, Math.min(800, startWidth + deltaX));
            const newHeight = Math.max(150, Math.min(600, startHeight + deltaY));
            
            card.style.width = `${newWidth}px`;
            card.style.height = `${newHeight}px`;
        };
        
        const stopResize = () => {
            isResizing = false;
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('touchmove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.removeEventListener('touchend', stopResize);
            
            this.saveCharacter();
        };
        
        resizeHandle.addEventListener('mousedown', startResize);
        resizeHandle.addEventListener('touchstart', startResize);
    }
    
    setupCustomization() {
        const customizerBtn = document.getElementById('colorCustomizerBtn');
        
        if (customizerBtn) {
            customizerBtn.addEventListener('click', () => {
                this.showColorCustomizerModal();
            });
        }
    }
    
    setupTextCustomization() {
        const textCustomizerBtn = document.getElementById('textCustomizerBtn');
        const textColorModal = document.getElementById('textColorModal');
        const closeTextColorModalBtn = document.getElementById('closeTextColorModalBtn');
        
        textCustomizerBtn.addEventListener('click', () => {
            this.showTextColorCustomizerModal();
        });
        
        closeTextColorModalBtn.addEventListener('click', () => {
            textColorModal.style.display = 'none';
        });
        
        textColorModal.addEventListener('click', (e) => {
            if (e.target === textColorModal) {
                textColorModal.style.display = 'none';
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && textColorModal.style.display === 'flex') {
                textColorModal.style.display = 'none';
            }
        });
    }
    
    showColorCustomizerModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        
        // Obtener color actual de EXP
        const currentExpColor = localStorage.getItem('expColor') || '#4a90e2';
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-palette"></i> Personalizar Colores</h4>
            <div class="color-customizer">
                <div class="color-group">
                    <label>Color de Maná</label>
                    <input type="color" id="colorMana" value="#4169e1">
                </div>
                <div class="color-group">
                    <label>Color de Vida</label>
                    <input type="color" id="colorHP" value="#dc143c">
                </div>
                <div class="color-group">
                    <label>Color de Experiencia</label>
                    <input type="color" id="colorExp" value="${currentExpColor}">
                </div>
                <div class="color-group">
                    <label>Color de Acento</label>
                    <input type="color" id="colorAccent" value="#d4af37">
                </div>
                <div class="color-group">
                    <label>Color de Fondo</label>
                    <input type="color" id="colorBackground" value="#1a0f0a">
                </div>
                <div class="color-group">
                    <label>Color de Pergamino</label>
                    <input type="color" id="colorParchment" value="#f5e6d3">
                </div>
                <div class="color-group">
                    <label>Color de Gemas</label>
                    <input type="color" id="colorGems" value="#9370db">
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveColorsBtn">
                    <i class="fas fa-check"></i> Aplicar Colores
                </button>
                <button type="button" class="btn-secondary" id="resetColorsBtn">
                    <i class="fas fa-redo"></i> Restaurar
                </button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelColorsBtn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        `;
        
        const savedColors = JSON.parse(localStorage.getItem('characterColors') || '{}');
        if (savedColors.mana) document.getElementById('colorMana').value = savedColors.mana;
        if (savedColors.hp) document.getElementById('colorHP').value = savedColors.hp;
        if (savedColors.exp) document.getElementById('colorExp').value = savedColors.exp;
        if (savedColors.accent) document.getElementById('colorAccent').value = savedColors.accent;
        if (savedColors.background) document.getElementById('colorBackground').value = savedColors.background;
        if (savedColors.parchment) document.getElementById('colorParchment').value = savedColors.parchment;
        if (savedColors.gems) document.getElementById('colorGems').value = savedColors.gems;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveColorsBtn').addEventListener('click', () => {
            this.applyCustomColors();
            modal.style.display = 'none';
        });
        
        document.getElementById('resetColorsBtn').addEventListener('click', () => {
            this.resetCustomColors();
            modal.style.display = 'none';
        });
        
        document.getElementById('cancelColorsBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    showTextColorCustomizerModal() {
        const modal = document.getElementById('textColorModal');
        const modalBody = document.getElementById('textColorModalBody');
        
        modalBody.innerHTML = `
            <div class="text-color-customizer">
                <div class="text-color-group">
                    <label><i class="fas fa-heading"></i> Color de Títulos</label>
                    <input type="color" id="textColorTitle" value="${this.textColors.title}">
                </div>
                <div class="text-color-group">
                    <label><i class="fas fa-heading"></i> Color de Subtítulos</label>
                    <input type="color" id="textColorSubtitle" value="${this.textColors.subtitle}">
                </div>
                <div class="text-color-group">
                    <label><i class="fas fa-tag"></i> Color de Etiquetas</label>
                    <input type="color" id="textColorLabel" value="${this.textColors.label}">
                </div>
                <div class="text-color-group">
                    <label><i class="fas fa-keyboard"></i> Color de Textos de Entrada</label>
                    <input type="color" id="textColorInput" value="${this.textColors.input}">
                </div>
                <div class="text-color-group">
                    <label><i class="fas fa-sort-numeric-up"></i> Color de Números</label>
                    <input type="color" id="textColorNumber" value="${this.textColors.number}">
                </div>
                <div class="text-color-group">
                    <label><i class="fas fa-plus-circle"></i> Color de Modificadores</label>
                    <input type="color" id="textColorModifier" value="${this.textColors.modifier}">
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveTextColorsBtn">
                    <i class="fas fa-check"></i> Aplicar Colores
                </button>
                <button type="button" class="btn-secondary" id="resetTextColorsBtn">
                    <i class="fas fa-redo"></i> Restaurar Valores por Defecto
                </button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelTextColorsBtn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
            <div style="margin-top: 15px; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 5px;">
                <p style="font-size: 0.85rem; color: var(--ink-light); margin: 0;">
                    <i class="fas fa-info-circle"></i> Los cambios se aplicarán a:
                    <ul style="margin: 5px 0 0 15px; font-size: 0.8rem;">
                        <li>Títulos principales y de secciones</li>
                        <li>Subtítulos y etiquetas</li>
                        <li>Texto en campos de entrada</li>
                        <li>Números en atributos y estadísticas</li>
                        <li>Modificadores de atributos</li>
                    </ul>
                </p>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveTextColorsBtn').addEventListener('click', () => {
            this.applyCustomTextColors();
            modal.style.display = 'none';
        });
        
        document.getElementById('resetTextColorsBtn').addEventListener('click', () => {
            this.resetCustomTextColors();
            modal.style.display = 'none';
        });
        
        document.getElementById('cancelTextColorsBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    applyCustomTextColors() {
        this.textColors = {
            title: document.getElementById('textColorTitle').value,
            subtitle: document.getElementById('textColorSubtitle').value,
            label: document.getElementById('textColorLabel').value,
            input: document.getElementById('textColorInput').value,
            number: document.getElementById('textColorNumber').value,
            modifier: document.getElementById('textColorModifier').value
        };
        
        const root = document.documentElement;
        root.style.setProperty('--text-title-color', this.textColors.title);
        root.style.setProperty('--text-subtitle-color', this.textColors.subtitle);
        root.style.setProperty('--text-label-color', this.textColors.label);
        root.style.setProperty('--text-input-color', this.textColors.input);
        root.style.setProperty('--text-number-color', this.textColors.number);
        root.style.setProperty('--text-modifier-color', this.textColors.modifier);
        
        this.applyDirectTextColors();
        
        localStorage.setItem('characterTextColors', JSON.stringify(this.textColors));
        
        this.showMessage('Colores de texto aplicados correctamente', 'info');
    }
    
    applyDirectTextColors() {
        const abilityModifiers = document.querySelectorAll('.ability-modifier');
        abilityModifiers.forEach(mod => {
            mod.style.color = this.textColors.modifier;
        });
        
        const hpInputs = document.querySelectorAll('.hp-display-large input');
        hpInputs.forEach(input => {
            input.style.color = this.textColors.number;
        });
        
        const manaInputs = document.querySelectorAll('.mana-input');
        manaInputs.forEach(input => {
            input.style.color = this.textColors.number;
        });
        
        this.updateAllAttributeModifiers();
    }
    
    updateAllAttributeModifiers() {
        const attributes = document.querySelectorAll('.attribute-item');
        attributes.forEach(attr => {
            const valueInput = attr.querySelector('.ability-value');
            const modifierElement = attr.querySelector('.ability-modifier');
            if (valueInput && modifierElement) {
                const value = parseInt(valueInput.value) || 0;
                const modifier = this.calculateModifier(value);
                
                if (modifier >= 0) {
                    modifierElement.textContent = `+${modifier}`;
                    modifierElement.style.color = this.textColors.modifier;
                } else {
                    modifierElement.textContent = modifier.toString();
                    modifierElement.style.color = this.textColors.modifier;
                }
            }
        });
    }
    
    resetCustomTextColors() {
        this.textColors = { ...DEFAULT_TEXT_COLORS };
        
        const root = document.documentElement;
        root.style.setProperty('--text-title-color', this.textColors.title);
        root.style.setProperty('--text-subtitle-color', this.textColors.subtitle);
        root.style.setProperty('--text-label-color', this.textColors.label);
        root.style.setProperty('--text-input-color', this.textColors.input);
        root.style.setProperty('--text-number-color', this.textColors.number);
        root.style.setProperty('--text-modifier-color', this.textColors.modifier);
        
        this.applyDirectTextColors();
        
        localStorage.removeItem('characterTextColors');
        
        this.showMessage('Colores de texto restaurados a valores por defecto', 'info');
    }
    
    applyCustomColors() {
        const colors = {
            mana: document.getElementById('colorMana').value,
            hp: document.getElementById('colorHP').value,
            exp: document.getElementById('colorExp').value,
            accent: document.getElementById('colorAccent').value,
            background: document.getElementById('colorBackground').value,
            parchment: document.getElementById('colorParchment').value,
            gems: document.getElementById('colorGems').value
        };
        
        const root = document.documentElement;
        root.style.setProperty('--mana-color', colors.mana);
        root.style.setProperty('--hp-color', colors.hp);
        root.style.setProperty('--exp-color', colors.exp);
        root.style.setProperty('--accent-gold', colors.accent);
        root.style.setProperty('--body-bg', colors.background);
        root.style.setProperty('--parchment-light', colors.parchment);
        root.style.setProperty('--slot-color', colors.gems);
        
        this.updateHPDisplay();
        this.updateManaDisplay();
        this.updateExpDisplay();
        this.generateSpellGems();
        
        localStorage.setItem('characterColors', JSON.stringify(colors));
        localStorage.setItem('expColor', colors.exp);
        
        this.showMessage('Colores del tema aplicados correctamente', 'info');
    }
    
    resetCustomColors() {
        const root = document.documentElement;
        root.style.removeProperty('--mana-color');
        root.style.removeProperty('--hp-color');
        root.style.removeProperty('--exp-color');
        root.style.removeProperty('--accent-gold');
        root.style.removeProperty('--body-bg');
        root.style.removeProperty('--parchment-light');
        root.style.removeProperty('--slot-color');
        
        localStorage.removeItem('characterColors');
        localStorage.removeItem('expColor');
        
        this.updateHPDisplay();
        this.updateManaDisplay();
        this.updateExpDisplay();
        this.generateSpellGems();
        
        this.showMessage('Colores del tema restaurados a valores por defecto', 'info');
    }
    
    // ===== MÉTODOS PARA ATAQUES Y CONJUROS =====
    
    /**
     * Añadir un nuevo ataque (con botón eliminar)
     */
    addAttack(name = '', bonus = '', damage = '', saveToStorage = true) {
        const attacksList = document.querySelector('.attacks-list');
        const addButton = document.getElementById('addAttackBtn');
        
        const attackItem = document.createElement('div');
        attackItem.className = 'attack-item';
        
        attackItem.innerHTML = `
            <input type="text" class="attack-name" placeholder="Nombre del ataque" value="${name}">
            <input type="text" class="attack-bonus" placeholder="Bonif." value="${bonus}">
            <input type="text" class="attack-damage" placeholder="Daño/Tipo" value="${damage}">
            <button type="button" class="btn-remove-attack" title="Eliminar ataque">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        attacksList.insertBefore(attackItem, addButton);
        
        // Configurar eventos para guardar
        attackItem.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => this.saveCharacter());
        });
        
        // Configurar botón eliminar
        const removeBtn = attackItem.querySelector('.btn-remove-attack');
        removeBtn.addEventListener('click', () => {
            if (confirm('¿Eliminar este ataque?')) {
                attackItem.remove();
                this.saveCharacter();
                this.showMessage('Ataque eliminado', 'info');
            }
        });
        
        if (saveToStorage) {
            this.saveCharacter();
        }
    }
    
    /**
     * Añadir un nuevo conjuro (con input text y botón eliminar)
     */
    addSpell(name = '', level = '', description = '', saveToStorage = true) {
        const spellsList = document.getElementById('spellsList');
        
        const spellItem = document.createElement('div');
        spellItem.className = 'spell-item';
        
        spellItem.innerHTML = `
            <div class="spell-header">
                <input type="text" class="spell-name" placeholder="Nombre del conjuro" value="${name}">
                <input type="text" class="spell-level-input" placeholder="Nivel (Truco, 1°, etc.)" value="${level}">
                <button type="button" class="btn-remove-spell" title="Eliminar conjuro">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <textarea class="spell-desc" rows="2" placeholder="Descripción del conjuro...">${description}</textarea>
        `;
        
        spellsList.appendChild(spellItem);
        
        // Configurar eventos para guardar
        spellItem.querySelectorAll('input, textarea').forEach(input => {
            input.addEventListener('input', () => this.saveCharacter());
        });
        
        // Configurar botón eliminar
        const removeBtn = spellItem.querySelector('.btn-remove-spell');
        removeBtn.addEventListener('click', () => {
            if (confirm('¿Eliminar este conjuro?')) {
                spellItem.remove();
                this.saveCharacter();
                this.showMessage('Conjuro eliminado', 'info');
            }
        });
        
        if (saveToStorage) {
            this.saveCharacter();
        }
    }
    
    /**
     * Obtener lista de ataques
     */
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
    
    /**
     * Obtener lista de conjuros
     */
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
    
    // ===== MÉTODOS DE EXPERIENCIA MEJORADOS =====

    setupExpListeners() {
        const currentExpInput = document.getElementById('current-exp');
        const maxExpInput = document.getElementById('max-exp');
        
        currentExpInput.addEventListener('input', () => {
            this.currentExp = parseInt(currentExpInput.value) || 0;
            this.updateExpDisplay();
            this.checkLevelUp();
            this.saveCharacter();
        });
        
        maxExpInput.addEventListener('input', () => {
            this.maxExp = parseInt(maxExpInput.value) || 1;
            this.updateExpDisplay();
            this.saveCharacter();
        });
        
        // Botones de subir/bajar nivel
        document.getElementById('level-up-btn').addEventListener('click', () => {
            this.changeLevel(1);
        });
        
        document.getElementById('level-down-btn').addEventListener('click', () => {
            this.changeLevel(-1);
        });
        
        const configExpBtn = document.getElementById('configExpBtn');
        if (configExpBtn) {
            configExpBtn.addEventListener('click', () => {
                this.showExpConfigModal();
            });
        } else {
            console.error('Botón configExpBtn no encontrado en el DOM');
        }
    }

    /**
     * Cambiar nivel manualmente
     */
    changeLevel(amount) {
        const newLevel = this.characterLevel + amount;
        if (newLevel < 1 || newLevel > 20) {
            this.showMessage('El nivel debe estar entre 1 y 20', 'warning');
            return;
        }
        
        this.characterLevel = newLevel;
        document.getElementById('level-display').textContent = this.characterLevel;
        document.getElementById('character-level').value = this.characterLevel;
        
        // Actualizar experiencia requerida según el sistema
        this.updateRequiredExpForLevel();
        
        this.updateAllSavingThrows();
        this.showMessage(`Nivel ${this.characterLevel}`, 'info');
        this.saveCharacter();
    }

    /**
     * Actualizar experiencia requerida según nivel y sistema
     */
    updateRequiredExpForLevel() {
        const expSystem = localStorage.getItem('expSystem') || 'custom';
        
        if (expSystem === 'dnd5e') {
            const expTable = {
                1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
                6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
                11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
                16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
            };
            this.maxExp = expTable[this.characterLevel] || 300;
        } else if (expSystem === 'pathfinder') {
            this.maxExp = this.characterLevel * 1000;
        }
        // Sistema personalizado: mantener el valor actual
        
        document.getElementById('max-exp').value = this.maxExp;
        this.updateExpDisplay();
    }

    /**
     * Actualizar display de experiencia
     */
    updateExpDisplay() {
        const currentExpInput = document.getElementById('current-exp');
        const maxExpInput = document.getElementById('max-exp');
        const expBarFill = document.getElementById('expBarFill');
        const expCurrentLabel = document.getElementById('expCurrentLabel');
        const expMaxLabel = document.getElementById('expMaxLabel');
        const expPercentage = document.getElementById('expPercentage');
        
        currentExpInput.value = this.currentExp;
        maxExpInput.value = this.maxExp;
        
        const percentage = Math.min(100, (this.currentExp / this.maxExp) * 100);
        expBarFill.style.width = `${percentage}%`;
        expCurrentLabel.textContent = this.currentExp;
        expMaxLabel.textContent = this.maxExp;
        expPercentage.textContent = `${Math.round(percentage)}%`;
        
        // Cambiar color según cercanía a subir de nivel
        if (percentage >= 100) {
            expBarFill.style.background = 'linear-gradient(90deg, #ffd700, #ffaa00)';
        } else if (percentage >= 75) {
            expBarFill.style.background = 'linear-gradient(90deg, #4CAF50, #8bc34a)';
        } else {
            expBarFill.style.background = 'linear-gradient(90deg, var(--exp-color, #4a90e2), #7dc1ff)';
        }
    }

    /**
     * Verificar si el personaje ha subido de nivel automáticamente
     */
    checkLevelUp() {
        if (this.currentExp >= this.maxExp && this.characterLevel < 20) {
            // Subir de nivel automáticamente
            const expSoFar = this.currentExp - this.maxExp;
            this.characterLevel++;
            
            // Actualizar experiencia requerida según sistema
            const expSystem = localStorage.getItem('expSystem') || 'custom';
            
            if (expSystem === 'custom') {
                // Sistema personalizado: multiplicar x2
                this.maxExp = this.maxExp * 2;
            } else {
                // Sistemas predefinidos: actualizar según tabla
                this.updateRequiredExpForLevel();
            }
            
            // Mantener el excedente de experiencia
            this.currentExp = expSoFar;
            
            document.getElementById('level-display').textContent = this.characterLevel;
            document.getElementById('character-level').value = this.characterLevel;
            document.getElementById('max-exp').value = this.maxExp;
            
            this.updateExpDisplay();
            this.saveCharacter();
            
            this.showMessage(`¡Has subido al nivel ${this.characterLevel}!`, 'info');
        }
    }

    /**
     * Mostrar modal de configuración de experiencia (solo color y sistema)
     */
    showExpConfigModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        
        const savedExpColor = localStorage.getItem('expColor') || '#4a90e2';
        const savedExpSystem = localStorage.getItem('expSystem') || 'custom';
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-chart-line"></i> Configurar Experiencia</h4>
            <div class="form-group">
                <label><i class="fas fa-palette"></i> Color de la barra de experiencia</label>
                <input type="color" id="configExpColor" value="${savedExpColor}">
            </div>
            <div class="form-group">
                <label><i class="fas fa-calculator"></i> Sistema de niveles</label>
                <select id="configExpSystem">
                    <option value="custom" ${savedExpSystem === 'custom' ? 'selected' : ''}>Personalizado (x2 al subir nivel)</option>
                    <option value="dnd5e" ${savedExpSystem === 'dnd5e' ? 'selected' : ''}>D&D 5e (estándar)</option>
                    <option value="pathfinder" ${savedExpSystem === 'pathfinder' ? 'selected' : ''}>Pathfinder (1000 x nivel)</option>
                </select>
                <small style="color: var(--ink-light);">
                    <i class="fas fa-info-circle"></i> 
                    Personalizado: la experiencia requerida se multiplica x2 al subir de nivel<br>
                    D&D 5e/Pathfinder: sigue la tabla oficial del sistema
                </small>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveExpConfigBtn">
                    <i class="fas fa-check"></i> Guardar configuración
                </button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelExpConfigBtn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveExpConfigBtn').addEventListener('click', () => {
            // Guardar color
            const expColor = document.getElementById('configExpColor').value;
            document.documentElement.style.setProperty('--exp-color', expColor);
            localStorage.setItem('expColor', expColor);
            
            // Guardar sistema
            const expSystem = document.getElementById('configExpSystem').value;
            localStorage.setItem('expSystem', expSystem);
            
            // Actualizar experiencia requerida según el nuevo sistema
            if (expSystem !== 'custom') {
                this.updateRequiredExpForLevel();
            }
            
            this.updateExpDisplay();
            this.saveCharacter();
            modal.style.display = 'none';
            this.showMessage('Configuración de experiencia guardada', 'info');
        });
        
        document.getElementById('cancelExpConfigBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    async saveCharacter() {
    this.saveInventory();
    
    const personajeNombre = document.getElementById('char-name').value.trim() || 'Sin nombre';

    const inventoryCard = document.getElementById('card-inventory');
    const isInventoryCollapsed = inventoryCard ? inventoryCard.classList.contains('collapsed') : false;
    
    // Obtener la URL de la imagen (si existe)
    const imagenUrl = localStorage.getItem('imagenUrl') || null;
    
    // Obtener atributos directamente del DOM
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
                modifier = this.calculateModifier(valor);
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
    
    const characterData = {
    id: `pj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    nombre: personajeNombre,
    clase: this.getBasicInfo().class || 'Sin clase',
    raza: this.getBasicInfo().race || 'Sin raza',
    nivel: this.characterLevel,
    jugador: localStorage.getItem('jugadorNombre') || 'Aventurero',
    imagen: imagenUrl,
    colores_personalizados: {
        background: localStorage.getItem('backgroundColor') || null,
        parchment: localStorage.getItem('parchmentColor') || null,
        accent: localStorage.getItem('accentColor') || null,
        mana: localStorage.getItem('manaColor') || null,
        hp: localStorage.getItem('hpColor') || null,
        gems: localStorage.getItem('gemsColor') || null,
        textColors: JSON.parse(localStorage.getItem('characterTextColors') || '{}')
    },
    stats: {
        hp: {
            current: this.currentHP,
            max: this.maxHP,
            temp: this.tempHP
        },
        mana: {
            current: this.currentMana,
            max: this.maxMana
        },
        ca: parseInt(document.getElementById('armor-class')?.value) || 12,
        velocidad: parseInt(document.getElementById('speed')?.value) || 30,
        iniciativa: parseInt(document.getElementById('initiative')?.value) || 1,
        atributos: atributosDOM
    },
    ataques: this.getAttacks(),
    conjuros: this.getSpells(),
    inventario: {
        monedas: this.currency,
        tesoros: this.treasures,
        pociones: this.potions,
        equipo: this.equipment,
        collapsed: isInventoryCollapsed
    },
    deathSaves: this.deathSaves,
    skills: this.skills,
    passivePerception: this.passivePerception,
    proficiencies: this.proficiencies,
    savingThrows: this.savingThrows,
    
    notas: notas,
    fecha_creacion: new Date().toISOString(),
    version: '3.2'
};
    
    localStorage.setItem('dndCharacterSheet', JSON.stringify(characterData));
    localStorage.setItem('personajeNombre', personajeNombre);
    
    await this.guardarPersonajeEnServidor(characterData);
    
    this.showSaveConfirmation();
}

    async guardarPersonajeEnServidor(characterData) {
        try {
            const response = await fetch('/api/personajes/guardar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(characterData)
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('✅ Personaje guardado en servidor');
                //this.showMessage('Personaje registrado en la sesión', 'info');
            } else {
                console.error('❌ Error en respuesta del servidor:', response.status);
                this.showMessage('Error al guardar en servidor', 'warning');
            }
        } catch (error) {
            console.error('❌ Error guardando personaje:', error);
            this.showMessage('Error de conexión con el servidor', 'error');
        }
    }

    // NUEVO MÉTODO: Obtener personajes de hoy
    async obtenerPersonajesHoy() {
        try {
            const BASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SERVER_URL) 
                ? CONFIG.SERVER_URL 
                : 'http://localhost:3000';
            
            const response = await fetch(`${BASE_URL}/api/personajes/hoy`);
            const data = await response.json();
            return data.personajes || [];
        } catch (error) {
            console.error('Error obteniendo personajes:', error);
            return [];
        }
    }

    // NUEVO MÉTODO: Obtener información del jugador actual
    getJugadorActual() {
        return {
            id: localStorage.getItem('jugadorId'),
            nombre: localStorage.getItem('jugadorNombre'),
            personaje: this.getBasicInfo().name || 'Sin personaje'
        };
    }
    
    getLayout() {
        const layout = {};
        const cards = document.querySelectorAll('.card');
        
        cards.forEach((card, index) => {
            const id = card.id || `card-${index}`;
            layout[id] = {
                width: card.style.width || getComputedStyle(card).width,
                height: card.style.height || getComputedStyle(card).height,
                parentId: card.parentNode.id || card.parentNode.className
            };
        });
        
        return layout;
    }
    
    getBasicInfo() {
        return {
            name: document.getElementById('char-name').value,
            class: document.getElementById('char-class').value,
            race: document.getElementById('char-race').value,
            background: document.getElementById('char-bg').value,
            alignment: document.getElementById('char-align').value
        };
    }
    
    showSaveConfirmation() {
        const saveBtn = document.getElementById('saveBtn');
        const originalHTML = saveBtn.innerHTML;
        
        saveBtn.innerHTML = '<i class="fas fa-check"></i> ✓ GUARDADO';
        saveBtn.style.background = 'linear-gradient(145deg, #4CAF50, #2E7D32)';
        
        setTimeout(() => {
            saveBtn.innerHTML = originalHTML;
            saveBtn.style.background = '';
        }, 2000);
    }
    
    exportCharacter() {
        // Obtener atributos directamente del DOM para exportación
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
                    modifier = this.calculateModifier(valor);
                }
                
                atributosDOM.push({
                    nombre: nombre,
                    valor: valor,
                    modificador: modifier
                });
            }
        });
        
        // Obtener notas
        const notas = {
            personalidad: document.getElementById('personality')?.value || '',
            ideales: document.getElementById('ideals')?.value || '',
            vinculos: document.getElementById('bonds')?.value || '',
            defectos: document.getElementById('flaws')?.value || '',
            rasgos: document.getElementById('features')?.value || ''
        };
        
        const characterData = {
            basicInfo: this.getBasicInfo(),
            attributes: atributosDOM,
            hp: {
                current: this.currentHP,
                max: this.maxHP,
                temp: this.tempHP
            },
            mana: {
                current: this.currentMana,
                max: this.maxMana
            },
            spellSlots: this.spellSlots,
            attacks: this.getAttacks(),
            spells: this.getSpells(),
            exp: {
                current: this.currentExp,
                max: this.maxExp,
                level: this.characterLevel
            },
            currency: this.currency,
            treasures: this.treasures,
            potions: this.potions,
            equipment: this.equipment,
            notas: notas,
            layout: this.getLayout(),
            lastExported: new Date().toISOString(),
            deathSaves: this.deathSaves,
            skills: this.skills,
            passivePerception: this.passivePerception,
            proficiencies: this.proficiencies,
            savingThrows: this.savingThrows,
            
        };
        
        const dataStr = JSON.stringify(characterData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `personaje-${this.getBasicInfo().name || 'sin-nombre'}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
        
        this.showMessage('Personaje exportado como JSON', 'info');
    }
    
    loadFromLocalStorage() {
    const savedData = localStorage.getItem('dndCharacterSheet');
    if (savedData) {
        try {
            const characterData = JSON.parse(savedData);
            
            // Cargar imagen si existe URL
            if (characterData.imagen) {
                const characterImage = document.getElementById('characterImage');
                const uploadArea = document.getElementById('imageUploadArea');
                const imagePreview = document.getElementById('imagePreview');
                const imageContainer = document.getElementById('imageContainer');
                
                if (characterImage) {
                    characterImage.src = characterData.imagen;
                    uploadArea.style.display = 'none';
                    imagePreview.style.display = 'flex';
                    imageContainer.classList.add('has-image');
                    localStorage.setItem('imagenUrl', characterData.imagen);
                }
            }
                
                if (characterData.inventario && characterData.inventario.collapsed) {
                const inventoryCard = document.getElementById('card-inventory');
                const toggleBtn = document.getElementById('toggleInventoryBtn');
                if (inventoryCard && toggleBtn) {
                    inventoryCard.classList.add('collapsed');
                    const icon = toggleBtn.querySelector('i');
                    if (icon) icon.className = 'fas fa-chevron-down';
                }
            }

                if (characterData.basicInfo) {
                    document.getElementById('char-name').value = characterData.basicInfo.name || '';
                    document.getElementById('char-class').value = characterData.basicInfo.class || '';
                    document.getElementById('char-race').value = characterData.basicInfo.race || '';
                    document.getElementById('char-bg').value = characterData.basicInfo.background || '';
                    document.getElementById('char-align').value = characterData.basicInfo.alignment || '';
                }
                
                if (characterData.hp) {
                    this.currentHP = characterData.hp.current || 26;
                    this.maxHP = characterData.hp.max || 26;
                    this.tempHP = characterData.hp.temp || 0;
                    this.updateHPDisplay();
                }
                
                if (characterData.mana) {
                    this.currentMana = characterData.mana.current || 2;
                    this.maxMana = characterData.mana.max || 15;
                    this.updateManaDisplay();
                }
                
                if (characterData.spellSlots) {
                    this.spellSlots = characterData.spellSlots;
                    document.getElementById('spellLevel').value = this.spellSlots.level;
                    document.getElementById('totalSlots').value = this.spellSlots.total;
                    this.generateSpellGems();
                }
                
                if (characterData.attributes && characterData.attributes.length > 0) {
                    document.getElementById('attributesContainer').innerHTML = '';
                    this.attributes = [];
                    characterData.attributes.forEach(attr => {
                        this.addAttribute(attr.name || attr.nombre, attr.value || attr.valor, true);
                    });
                } else if (characterData.stats?.atributos && characterData.stats.atributos.length > 0) {
                    document.getElementById('attributesContainer').innerHTML = '';
                    this.attributes = [];
                    characterData.stats.atributos.forEach(attr => {
                        this.addAttribute(attr.nombre, attr.valor, true);
                    });
                }
                
                // Cargar ataques
                if (characterData.attacks && characterData.attacks.length > 0) {
                    const attacksList = document.querySelector('.attacks-list');
                    const attackItems = attacksList.querySelectorAll('.attack-item');
                    attackItems.forEach(item => item.remove());
                    
                    characterData.attacks.forEach(attack => {
                        this.addAttack(attack.name, attack.bonus, attack.damage, false);
                    });
                }
                
                // Cargar conjuros
                if (characterData.spells && characterData.spells.length > 0) {
                    const spellsList = document.getElementById('spellsList');
                    spellsList.innerHTML = '';
                    
                    characterData.spells.forEach(spell => {
                        this.addSpell(spell.name, spell.level, spell.description, false);
                    });
                }
                
                // Cargar experiencia
                if (characterData.exp) {
                    this.currentExp = characterData.exp.current || 0;
                    this.maxExp = characterData.exp.max || 300;
                    this.characterLevel = characterData.exp.level || 1;
                    
                    document.getElementById('current-exp').value = this.currentExp;
                    document.getElementById('max-exp').value = this.maxExp;
                    document.getElementById('character-level').value = this.characterLevel;
                    document.getElementById('level-display').textContent = this.characterLevel;
                    this.updateExpDisplay();
                }
                
                // Cargar inventario
                if (characterData.currency) {
                    this.currency = characterData.currency;
                    this.updateCurrencyDisplay();
                }
                
                if (characterData.treasures) {
                    this.treasures = characterData.treasures;
                    this.renderTreasures();
                }
                
                if (characterData.potions) {
                    this.potions = characterData.potions;
                    this.renderPotions();
                }
                
                // Cargar equipo
                if (characterData.equipment) {
                    this.equipment = characterData.equipment;
                    this.renderEquipment();
                    
                    setTimeout(() => {
                        this.equipment.forEach(item => {
                            if (item.attribute && item.bonus !== 0) {
                                this.applyEquipmentBonus(item, true);
                            }
                        });
                    }, 500);
                }
                
                // Cargar notas
                if (characterData.notas) {
                    document.getElementById('personality').value = characterData.notas.personalidad || '';
                    document.getElementById('ideals').value = characterData.notas.ideales || '';
                    document.getElementById('bonds').value = characterData.notas.vinculos || '';
                    document.getElementById('flaws').value = characterData.notas.defectos || '';
                    document.getElementById('features').value = characterData.notas.rasgos || '';
                }
                
                if (characterData.textColors) {
                    this.textColors = { ...this.textColors, ...characterData.textColors };
                    this.applyCustomTextColors();
                }
                
                if (characterData.layout) {
                    Object.entries(characterData.layout).forEach(([cardId, cardLayout]) => {
                        const card = document.getElementById(cardId);
                        if (card) {
                            if (cardLayout.width && cardLayout.width !== 'auto') {
                                card.style.width = cardLayout.width;
                            }
                            if (cardLayout.height && cardLayout.height !== 'auto') {
                                card.style.height = cardLayout.height;
                            }
                        }

                        // Cargar salvaciones de muerte
                    if (characterData.deathSaves) {
                            this.loadDeathSavesFromData(characterData);
                        }

                        // Cargar habilidades
                    if (characterData.skills) {
                            this.loadSkillsFromData(characterData);
                        }

                        // Cargar percepción pasiva
                    if (characterData.passivePerception !== undefined) {
                            this.loadPassivePerceptionFromData(characterData);
                        }

                        // Cargar competencias
                    if (characterData.proficiencies) {
                            this.loadProficienciesFromData(characterData);
                        }
                    if (characterData.savingThrows) {
                            this.savingThrows = characterData.savingThrows;
                            this.renderSavingThrows();
                        }
                    });
                }
                
                console.log('Datos del personaje cargados');
            } catch (error) {
                console.error('Error al cargar datos:', error);
            }
        }
        
        const savedColors = localStorage.getItem('characterColors');
        if (savedColors) {
            try {
                const colors = JSON.parse(savedColors);
                const root = document.documentElement;
                
                if (colors.mana) root.style.setProperty('--mana-color', colors.mana);
                if (colors.hp) root.style.setProperty('--hp-color', colors.hp);
                if (colors.exp) root.style.setProperty('--exp-color', colors.exp);
                if (colors.accent) root.style.setProperty('--accent-gold', colors.accent);
                if (colors.background) root.style.setProperty('--body-bg', colors.background);
                if (colors.parchment) root.style.setProperty('--parchment-light', colors.parchment);
                if (colors.gems) root.style.setProperty('--slot-color', colors.gems);
                
                this.updateHPDisplay();
                this.updateManaDisplay();
                this.updateExpDisplay();
                this.generateSpellGems();
            } catch (error) {
                console.error('Error al cargar colores:', error);
            }
        }
        
        const savedTextColors = localStorage.getItem('characterTextColors');
        if (savedTextColors) {
            try {
                const textColors = JSON.parse(savedTextColors);
                this.textColors = { ...this.textColors, ...textColors };
                
                const root = document.documentElement;
                root.style.setProperty('--text-title-color', this.textColors.title);
                root.style.setProperty('--text-subtitle-color', this.textColors.subtitle);
                root.style.setProperty('--text-label-color', this.textColors.label);
                root.style.setProperty('--text-input-color', this.textColors.input);
                root.style.setProperty('--text-number-color', this.textColors.number);
                root.style.setProperty('--text-modifier-color', this.textColors.modifier);
                
                setTimeout(() => {
                    this.applyDirectTextColors();
                }, 100);
                
            } catch (error) {
                console.error('Error al cargar colores de texto:', error);
            }
        }
        
        // Cargar color de EXP guardado
        const savedExpColor = localStorage.getItem('expColor');
        if (savedExpColor) {
            document.documentElement.style.setProperty('--exp-color', savedExpColor);
        }
        
        // Cargar sistema de EXP guardado
        const savedExpSystem = localStorage.getItem('expSystem');
        if (savedExpSystem) {
            // Solo para referencia, no hay elemento select fuera del modal
        }
    }
    
    resetCharacter() {
        if (confirm('¿Estás seguro de que quieres restablecer todo? Esta acción no se puede deshacer.')) {
            localStorage.clear();
            location.reload();
        }
    }
    
    showMessage(message, type = 'info') {
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        
        document.body.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => messageEl.remove(), 300);
        }, 3000);
    }
    
    // ===== MÉTODOS DE INVENTARIO =====
    
    setupInventory() {
        this.setupCurrencyListeners();
        this.setupTreasureListeners();
        this.setupPotionListeners();
        this.setupEquipmentListeners();
        this.loadInventoryFromStorage();
        this.updateCurrencyDisplay();
    }

    setupInventoryCollapse() {
    const toggleBtn = document.getElementById('toggleInventoryBtn');
    const inventoryCard = document.getElementById('card-inventory');
    
    if (!toggleBtn || !inventoryCard) return;
    
    // Eliminar cualquier evento anterior para evitar duplicados
    toggleBtn.replaceWith(toggleBtn.cloneNode(true));
    const newToggleBtn = document.getElementById('toggleInventoryBtn');
    
    newToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        // Alternar la clase collapsed
        inventoryCard.classList.toggle('collapsed');
        
        // Cambiar el icono del botón
        const icon = newToggleBtn.querySelector('i');
        if (inventoryCard.classList.contains('collapsed')) {
            icon.className = 'fas fa-chevron-down'; // Flecha hacia abajo = colapsado
            this.showMessage('Inventario enrollado', 'info');
        } else {
            icon.className = 'fas fa-chevron-up'; // Flecha hacia arriba = expandido
            this.showMessage('Inventario desplegado', 'info');
        }
        
        this.saveCharacter();
    });
}
    
    setupCurrencyListeners() {
        document.getElementById('goldAmount').addEventListener('input', () => {
            this.currency.gold = parseInt(document.getElementById('goldAmount').value) || 0;
            this.saveInventory();
        });
        
        document.getElementById('silverAmount').addEventListener('input', () => {
            this.currency.silver = parseInt(document.getElementById('silverAmount').value) || 0;
            this.saveInventory();
        });
        
        document.getElementById('copperAmount').addEventListener('input', () => {
            this.currency.copper = parseInt(document.getElementById('copperAmount').value) || 0;
            this.saveInventory();
        });
        
        document.getElementById('configCurrencyBtn').addEventListener('click', () => {
            this.showCurrencyConfigModal();
        });
    }
    
    setupTreasureListeners() {
        document.getElementById('addTreasureBtn').addEventListener('click', () => {
            this.showAddTreasureModal();
        });
    }
    
    setupPotionListeners() {
        document.getElementById('addPotionBtn').addEventListener('click', () => {
            this.showAddPotionModal();
        });
    }
    
    showCurrencyConfigModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-coins"></i> Configurar Sistema Monetario</h4>
            <div class="modal-form">
                <div class="form-group">
                    <label><i class="fas fa-tag"></i> Nombre genérico de la moneda</label>
                    <input type="text" id="modalCurrencyName" value="${this.currency.name}" 
                           placeholder="Ej: Monedas, Piezas, Talentos, Dracmas...">
                    <small style="color: var(--ink-light); font-style: italic;">
                        Nombre que aparece en el encabezado (ej: "Monedas", "Piezas de Oro")
                    </small>
                </div>
                
                <div style="border-top: 1px dashed var(--accent-gold); margin: 15px 0; padding-top: 15px;">
                    <h5 style="color: var(--accent-purple); margin-bottom: 15px;">Personalizar nombres de las monedas</h5>
                    
                    <div class="form-group">
                        <label><i class="fas fa-circle" style="color: #ffd700;"></i> Nombre para ORO</label>
                        <input type="text" id="modalGoldName" value="${this.currency.goldName || 'Oro'}" 
                               placeholder="Ej: Oro, Dragones, Ducados...">
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-circle" style="color: #c0c0c0;"></i> Nombre para PLATA</label>
                        <input type="text" id="modalSilverName" value="${this.currency.silverName || 'Plata'}" 
                               placeholder="Ej: Plata, Platas, Chelines...">
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-circle" style="color: #b87333;"></i> Nombre para COBRE</label>
                        <input type="text" id="modalCopperName" value="${this.currency.copperName || 'Cobre'}" 
                               placeholder="Ej: Cobre, Cobres, Peniques...">
                    </div>
                </div>
                
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="saveCurrencyConfigBtn">
                    <i class="fas fa-check"></i> Guardar
                </button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelCurrencyConfigBtn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('saveCurrencyConfigBtn').addEventListener('click', () => {
            this.currency.name = document.getElementById('modalCurrencyName').value.trim() || 'Monedas';
            this.currency.goldName = document.getElementById('modalGoldName').value.trim() || 'Oro';
            this.currency.silverName = document.getElementById('modalSilverName').value.trim() || 'Plata';
            this.currency.copperName = document.getElementById('modalCopperName').value.trim() || 'Cobre';
            
            this.updateCurrencyDisplay();
            this.saveInventory();
            modal.style.display = 'none';
            this.showMessage('Sistema monetario actualizado', 'info');
        });
        
        document.getElementById('cancelCurrencyConfigBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    showAddTreasureModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-gem"></i> Añadir Tesoro o Gema</h4>
            <div class="modal-form">
                <div class="form-group">
                    <label><i class="fas fa-tag"></i> Nombre</label>
                    <input type="text" id="treasureName" placeholder="Ej: Rubí, Collar de oro, Estatua...">
                </div>
                <div class="form-group">
                    <label><i class="fas fa-coins"></i> Valor</label>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="number" id="treasureValue" min="0" value="0" style="flex: 1;">
                        <span style="font-weight: bold;">${this.currency.name}</span>
                    </div>
                </div>
                <div class="form-group">
                    <label><i class="fas fa-palette"></i> Tipo</label>
                    <select id="treasureType">
                        <option value="gem">💎 Gema</option>
                        <option value="jewelry">👑 Joya</option>
                        <option value="artifact">🏺 Artefacto</option>
                        <option value="other">📦 Otro</option>
                    </select>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="addTreasureConfirmBtn">
                    <i class="fas fa-plus"></i> Añadir
                </button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelTreasureBtn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('addTreasureConfirmBtn').addEventListener('click', () => {
            const name = document.getElementById('treasureName').value.trim();
            const value = parseInt(document.getElementById('treasureValue').value) || 0;
            const type = document.getElementById('treasureType').value;
            
            if (name) {
                this.addTreasure(name, value, type);
                modal.style.display = 'none';
            } else {
                this.showMessage('Por favor, ingresa un nombre para el tesoro', 'warning');
            }
        });
        
        document.getElementById('cancelTreasureBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    addTreasure(name, value, type) {
        const treasure = {
            id: Date.now(),
            name: name,
            value: value,
            type: type,
            date: new Date().toISOString()
        };
        
        this.treasures.push(treasure);
        this.renderTreasures();
        this.saveInventory();
        this.showMessage('Tesoro añadido', 'info');
    }
    
    renderTreasures() {
        const treasureList = document.getElementById('treasureList');
        treasureList.innerHTML = '';
        
        if (this.treasures.length === 0) {
            treasureList.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center;">No hay tesoros añadidos</p>';
            return;
        }
        
        this.treasures.sort((a, b) => b.value - a.value);
        
        this.treasures.forEach(treasure => {
            const treasureItem = document.createElement('div');
            treasureItem.className = 'treasure-item';
            
            const icon = this.getTreasureIcon(treasure.type);
            
            treasureItem.innerHTML = `
                <div class="treasure-info">
                    <i class="fas ${icon}" style="color: var(--accent-gold);"></i>
                    <span class="treasure-name">${treasure.name}</span>
                    <span class="treasure-value">${treasure.value} ${this.currency.name}</span>
                </div>
                <button type="button" class="btn-remove-treasure" data-id="${treasure.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            treasureList.appendChild(treasureItem);
            
            treasureItem.querySelector('.btn-remove-treasure').addEventListener('click', () => {
                this.removeTreasure(treasure.id);
            });
        });
    }
    
    getTreasureIcon(type) {
        switch(type) {
            case 'gem': return 'fa-gem';
            case 'jewelry': return 'fa-crown';
            case 'artifact': return 'fa-archway';
            default: return 'fa-box';
        }
    }
    
    removeTreasure(id) {
        if (confirm('¿Eliminar este tesoro?')) {
            this.treasures = this.treasures.filter(t => t.id !== id);
            this.renderTreasures();
            this.saveInventory();
            this.showMessage('Tesoro eliminado', 'info');
        }
    }
    
    showAddPotionModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-flask"></i> Añadir Poción</h4>
            <div class="modal-form">
                <div class="form-group">
                    <label><i class="fas fa-tag"></i> Nombre de la poción</label>
                    <input type="text" id="potionName" placeholder="Ej: Poción de vida menor, Elixir de maná...">
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-syringe"></i> Tipo de poción</label>
                    <div class="form-radio-group">
                        <label class="form-radio">
                            <input type="radio" name="potionType" value="life" checked>
                            <i class="fas fa-heart" style="color: #dc143c;"></i> Vida
                        </label>
                        <label class="form-radio">
                            <input type="radio" name="potionType" value="mana">
                            <i class="fas fa-bolt" style="color: #4169e1;"></i> Maná
                        </label>
                    </div>
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-coins"></i> Valor (en ${this.currency.name})</label>
                    <input type="number" id="potionValue" min="0" value="50">
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-arrow-up"></i> Cantidad que restaura</label>
                    <input type="number" id="potionAmount" min="1" value="10">
                    <small style="color: var(--ink-light);">La cantidad de vida o maná que recupera</small>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="addPotionConfirmBtn">
                    <i class="fas fa-plus"></i> Añadir Poción
                </button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelPotionBtn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('addPotionConfirmBtn').addEventListener('click', () => {
            const name = document.getElementById('potionName').value.trim();
            const type = document.querySelector('input[name="potionType"]:checked').value;
            const value = parseInt(document.getElementById('potionValue').value) || 0;
            const amount = parseInt(document.getElementById('potionAmount').value) || 10;
            
            if (name) {
                this.addPotion(name, type, value, amount);
                modal.style.display = 'none';
            } else {
                this.showMessage('Por favor, ingresa un nombre para la poción', 'warning');
            }
        });
        
        document.getElementById('cancelPotionBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    addPotion(name, type, value, amount) {
        const potion = {
            id: Date.now(),
            name: name,
            type: type,
            value: value,
            amount: amount,
            date: new Date().toISOString()
        };
        
        this.potions.push(potion);
        this.renderPotions();
        this.saveInventory();
        this.showMessage('Poción añadida', 'info');
    }
    
    renderPotions() {
        const potionsList = document.getElementById('potionsList');
        potionsList.innerHTML = '';
        
        if (this.potions.length === 0) {
            potionsList.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center;">No hay pociones en el inventario</p>';
            return;
        }
        
        this.potions.forEach(potion => {
            const potionItem = document.createElement('div');
            potionItem.className = 'potion-item';
            
            const icon = potion.type === 'life' ? 'fa-heart' : 'fa-bolt';
            const iconClass = potion.type === 'life' ? 'life' : 'mana';
            const targetBar = potion.type === 'life' ? 'Vida' : 'Maná';
            
            potionItem.innerHTML = `
                <div class="potion-icon ${iconClass}">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="potion-details">
                    <span class="potion-name">${potion.name}</span>
                    <span class="potion-effect">
                        <i class="fas ${icon}"></i>
                        Restaura <span class="potion-amount">+${potion.amount}</span> ${targetBar}
                    </span>
                    <span class="potion-value">${potion.value} ${this.currency.name}</span>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button type="button" class="btn-consume" data-id="${potion.id}">
                        <i class="fas fa-wine-bottle"></i> Consumir
                    </button>
                    <button type="button" class="btn-remove-potion" data-id="${potion.id}">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
            
            potionsList.appendChild(potionItem);
            
            potionItem.querySelector('.btn-consume').addEventListener('click', () => {
                this.consumePotion(potion);
            });
            
            potionItem.querySelector('.btn-remove-potion').addEventListener('click', () => {
                this.removePotion(potion.id);
            });
        });
    }
    
    consumePotion(potion) {
        if (potion.type === 'life') {
            const maxHP = parseInt(document.getElementById('max-hp').value) || 26;
            this.currentHP = Math.min(maxHP, this.currentHP + potion.amount);
            this.updateHPDisplay();
            this.showMessage(`Has recuperado ${potion.amount} puntos de vida`, 'info');
        } else {
            this.currentMana = Math.min(this.maxMana, this.currentMana + potion.amount);
            this.updateManaDisplay();
            this.showMessage(`Has recuperado ${potion.amount} puntos de maná`, 'info');
        }
        
        this.removePotion(potion.id);
        this.saveCharacter();
    }
    
    removePotion(id) {
        if (confirm('¿Eliminar esta poción?')) {
            this.potions = this.potions.filter(p => p.id !== id);
            this.renderPotions();
            this.saveInventory();
            this.showMessage('Poción eliminada', 'info');
        }
    }
    
    saveInventory() {
        const inventoryData = {
            currency: this.currency,
            treasures: this.treasures,
            potions: this.potions,
            // NUEVO: Guardar equipo
            equipment: this.equipment
        };
        
        localStorage.setItem('characterInventory', JSON.stringify(inventoryData));
    }
    
    loadInventoryFromStorage() {
        const savedInventory = localStorage.getItem('characterInventory');
        
        if (savedInventory) {
            try {
                const inventoryData = JSON.parse(savedInventory);
                
                if (inventoryData.currency) {
                    this.currency = {
                        gold: inventoryData.currency.gold || 0,
                        silver: inventoryData.currency.silver || 0,
                        copper: inventoryData.currency.copper || 0,
                        name: inventoryData.currency.name || 'Monedas',
                        goldName: inventoryData.currency.goldName || 'Oro',
                        silverName: inventoryData.currency.silverName || 'Plata',
                        copperName: inventoryData.currency.copperName || 'Cobre'
                    };
                    this.updateCurrencyDisplay();
                }
                if (inventoryData.treasures) {
                    this.treasures = inventoryData.treasures;
                    this.renderTreasures();
                }
                
                if (inventoryData.potions) {
                    this.potions = inventoryData.potions;
                    this.renderPotions();
                }
                
                // NUEVO: Cargar equipo
                if (inventoryData.equipment) {
                    this.equipment = inventoryData.equipment;
                    this.renderEquipment();
                    
                    // Reaplicar bonificadores al cargar
                    setTimeout(() => {
                        this.equipment.forEach(item => {
                            if (item.attribute && item.bonus !== 0) {
                                this.applyEquipmentBonus(item, true);
                            }
                        });
                    }, 500);
                }
                
            } catch (error) {
                console.error('Error al cargar inventario:', error);
            }
        }
    }
    
    resetInventory() {
        this.currency = {
            gold: 0,
            silver: 0,
            copper: 0,
            name: 'Monedas',
            goldName: 'Oro',
            silverName: 'Plata',
            copperName: 'Cobre'
        };
        this.treasures = [];
        this.potions = [];
        this.equipment = [];
        
        document.getElementById('currencyName').textContent = this.currency.name;
        document.getElementById('goldAmount').value = 0;
        document.getElementById('silverAmount').value = 0;
        document.getElementById('copperAmount').value = 0;
        
        this.renderTreasures();
        this.renderPotions();
        this.renderEquipment();
        this.saveInventory();
    }
    
    updateCurrencyDisplay() {
        document.getElementById('currencyName').textContent = this.currency.name;
        
        // Actualizar las etiquetas de las monedas
        const goldLabel = document.querySelector('.currency-item:first-child label');
        const silverLabel = document.querySelector('.currency-item:nth-child(2) label');
        const copperLabel = document.querySelector('.currency-item:last-child label');
        
        if (goldLabel) {
            goldLabel.innerHTML = `<i class="fas fa-circle" style="color: #ffd700;"></i> ${this.currency.goldName || 'Oro'}`;
        }
        if (silverLabel) {
            silverLabel.innerHTML = `<i class="fas fa-circle" style="color: #c0c0c0;"></i> ${this.currency.silverName || 'Plata'}`;
        }
        if (copperLabel) {
            copperLabel.innerHTML = `<i class="fas fa-circle" style="color: #b87333;"></i> ${this.currency.copperName || 'Cobre'}`;
        }
        
        document.getElementById('goldAmount').value = this.currency.gold;
        document.getElementById('silverAmount').value = this.currency.silver;
        document.getElementById('copperAmount').value = this.currency.copper;
    }
    
    setupEquipmentListeners() {
        document.getElementById('addEquipmentBtn').addEventListener('click', () => {
            this.showAddEquipmentModal();
        });
    }

    /**
     * Mostrar modal para añadir equipo
     */
    showAddEquipmentModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        
        // Obtener lista de atributos disponibles
        const attributeOptions = this.getAttributeOptions();
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-chess-board"></i> Añadir Equipo</h4>
            <div class="modal-form">
                <div class="form-group">
                    <label><i class="fas fa-tag"></i> Nombre del equipo</label>
                    <input type="text" id="equipmentName" placeholder="...">
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div class="form-group">
                        <label><i class="fas fa-coins"></i> Costo (${this.currency.name})</label>
                        <input type="number" id="equipmentCost" min="0" value="0">
                    </div>
                    
                    <div class="form-group">
                        <label><i class="fas fa-weight-hanging"></i> Peso</label>
                        <input type="number" id="equipmentWeight" min="0" value="1" step="0.1">
                        <small style="color: var(--ink-light);">En libras/kg</small>
                    </div>
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-align-left"></i> Descripción</label>
                    <textarea id="equipmentDesc" rows="2" placeholder="Describe el equipo..."></textarea>
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-user-secret"></i> Ventaja en Sigilo</label>
                    <select id="equipmentStealth">
                        <option value="none">Sin efecto</option>
                        <option value="disadvantage">Desventaja</option>
                        <option value="advantage">Ventaja</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label><i class="fas fa-plus-circle"></i> Bonificador a atributo</label>
                    <div style="display: flex; gap: 10px;">
                        <select id="equipmentAttribute" style="flex: 2;">
                            <option value="">Ninguno (sin bonificador)</option>
                            ${attributeOptions}
                        </select>
                        <input type="number" id="equipmentBonus" min="-5" max="5" value="1" style="flex: 1; text-align: center;" placeholder="+/-">
                    </div>
                    <small style="color: var(--ink-light);">
                        <i class="fas fa-info-circle"></i> El bonificador se sumará al atributo seleccionado
                    </small>
                </div>
            </div>
            <div class="modal-actions">
                <button type="button" class="btn-secondary" id="addEquipmentConfirmBtn">
                    <i class="fas fa-plus"></i> Añadir Equipo
                </button>
                <button type="button" class="btn-secondary btn-cancel" id="cancelEquipmentBtn">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        `;
        
        modal.style.display = 'flex';
        
        document.getElementById('addEquipmentConfirmBtn').addEventListener('click', () => {
            this.addEquipmentFromModal();
        });
        
        document.getElementById('cancelEquipmentBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    /**
     * Obtener opciones de atributos para el select
     */
    getAttributeOptions() {
        const attributeItems = document.querySelectorAll('.attribute-item');
        let options = '';
        
        attributeItems.forEach(item => {
            const nameInput = item.querySelector('.attribute-name');
            if (nameInput) {
                const attrName = nameInput.value.trim() || 'ATRIBUTO';
                options += `<option value="${attrName}">${attrName}</option>`;
            }
        });
        
        return options;
    }

    /**
     * Añadir equipo desde el modal
     */
    addEquipmentFromModal() {
        const name = document.getElementById('equipmentName').value.trim();
        const cost = parseInt(document.getElementById('equipmentCost').value) || 0;
        const weight = parseFloat(document.getElementById('equipmentWeight').value) || 0;
        const description = document.getElementById('equipmentDesc').value.trim();
        const stealth = document.getElementById('equipmentStealth').value;
        const attribute = document.getElementById('equipmentAttribute').value;
        const bonus = parseInt(document.getElementById('equipmentBonus').value) || 0;
        
        if (!name) {
            this.showMessage('Por favor, ingresa un nombre para el equipo', 'warning');
            return;
        }
        
        const equipmentItem = {
            id: Date.now(),
            name: name,
            cost: cost,
            weight: weight,
            description: description || 'Sin descripción',
            stealth: stealth,
            attribute: attribute,
            bonus: bonus,
            date: new Date().toISOString()
        };
        
        this.equipment.push(equipmentItem);
        this.renderEquipment();
        this.saveInventory();
        
        // Si tiene bonificador, aplicarlo inmediatamente
        if (attribute && bonus !== 0) {
            this.applyEquipmentBonus(equipmentItem, true);
        }
        
        document.getElementById('configModal').style.display = 'none';
        this.showMessage('Equipo añadido', 'info');
    }

    /**
     * Renderizar la lista de equipo
     */
    renderEquipment() {
        const equipmentList = document.getElementById('equipmentList');
        if (!equipmentList) return;
        
        equipmentList.innerHTML = '';
        
        if (this.equipment.length === 0) {
            equipmentList.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center;">No hay equipo añadido</p>';
            return;
        }
        
        this.equipment.forEach(item => {
            const equipmentItem = document.createElement('div');
            equipmentItem.className = 'equipment-item';
            equipmentItem.dataset.id = item.id;
            
            // Icono según ventaja/desventaja
            const stealthIcon = item.stealth === 'advantage' ? 'fa-check-circle' : (item.stealth === 'disadvantage' ? 'fa-exclamation-circle' : 'fa-circle');
            const stealthColor = item.stealth === 'advantage' ? '#4CAF50' : (item.stealth === 'disadvantage' ? '#ff4444' : '#888');
            
            // Mostrar bonificador si existe
            const bonusHtml = item.attribute && item.bonus !== 0 ? 
                `<span class="equipment-bonus" style="color: ${item.bonus > 0 ? '#4CAF50' : '#ff4444'};">
                    <i class="fas fa-arrow-up"></i> ${item.bonus > 0 ? '+' : ''}${item.bonus} a ${item.attribute}
                </span>` : '';
            
            equipmentItem.innerHTML = `
                <div class="equipment-header">
                    <div class="equipment-name">
                        <i class="fas fa-chess-queen" style="color: var(--accent-gold);"></i>
                        <span>${item.name}</span>
                        ${bonusHtml}
                    </div>
                    <button type="button" class="btn-remove-equipment" data-id="${item.id}" title="Eliminar equipo">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="equipment-details">
                    <span class="equipment-cost"><i class="fas fa-coins"></i> ${item.cost} ${this.currency.name}</span>
                    <span class="equipment-weight"><i class="fas fa-weight-hanging"></i> ${item.weight} lb/kg</span>
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
            
            equipmentList.appendChild(equipmentItem);
            
            // Botón eliminar
            equipmentItem.querySelector('.btn-remove-equipment').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeEquipment(item.id);
            });
        });
    }

    /**
     * Eliminar un equipo
     */
    removeEquipment(id) {
        if (confirm('¿Eliminar este equipo?')) {
            // Antes de eliminar, quitar bonificador si tenía
            const item = this.equipment.find(e => e.id === id);
            if (item && item.attribute && item.bonus !== 0) {
                this.applyEquipmentBonus(item, false);
            }
            
            this.equipment = this.equipment.filter(e => e.id !== id);
            this.renderEquipment();
            this.saveInventory();
            this.showMessage('Equipo eliminado', 'info');
        }
    }

    /**
     * Aplicar o quitar bonificador de equipo a un atributo
     */
    applyEquipmentBonus(item, apply) {
        if (!item.attribute || item.bonus === 0) return;
        
        const attributeItems = document.querySelectorAll('.attribute-item');
        
        attributeItems.forEach(attrItem => {
            const nameInput = attrItem.querySelector('.attribute-name');
            if (nameInput && nameInput.value.trim() === item.attribute) {
                const valueInput = attrItem.querySelector('.ability-value');
                if (valueInput) {
                    let currentValue = parseInt(valueInput.value) || 10;
                    
                    if (apply) {
                        // Aplicar bonificador
                        currentValue += item.bonus;
                    } else {
                        // Quitar bonificador
                        currentValue -= item.bonus;
                    }
                    
                    valueInput.value = currentValue;
                    
                    // Actualizar modificador
                    const modifierElement = attrItem.querySelector('.ability-modifier');
                    const modifier = this.calculateModifier(currentValue);
                    
                    if (modifier >= 0) {
                        modifierElement.textContent = `+${modifier}`;
                        modifierElement.style.color = this.textColors.modifier;
                    } else {
                        modifierElement.textContent = modifier.toString();
                        modifierElement.style.color = this.textColors.modifier;
                    }
                    
                    // Actualizar el atributo en el array
                    const id = parseInt(attrItem.dataset.id);
                    const attrIndex = this.attributes.findIndex(a => a.id === id);
                    if (attrIndex !== -1) {
                        this.attributes[attrIndex].value = currentValue;
                        this.attributes[attrIndex].modifier = modifier;
                    }
                }
            }
        });
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
        
        @keyframes gemPulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
        }
        
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes cardSwap {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
        }
        
        .card.swap-animation {
            animation: cardSwap 0.3s ease;
        }
        
        .dragging-active {
            user-select: none;
            -webkit-user-select: none;
            -moz-user-select: none;
            -ms-user-select: none;
        }
        
        .card.drop-target {
            border: 2px solid var(--accent-gold);
            box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.3);
            transform: scale(1.02);
        }
    `;
    document.head.appendChild(style);
    
    try {
        const characterSheet = new CharacterSheet();
        window.characterSheet = characterSheet;
        console.log('La Libreta del Escriba');
    } catch (error) {
        console.error('Error al inicializar:', error);
        alert('Hubo un error al cargar la aplicación. Por favor, recarga la página.');
    }
});