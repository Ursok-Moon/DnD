// hoja-personaje.js - Versión 3.2 (Con GridStack y Toggle)
// Atributos base por defecto
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

// Variable global para GridStack
let grid = null;

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
        this.textColors = { ...DEFAULT_TEXT_COLORS };
        this.gridEnabled = true; // Estado inicial: activado
        this.gridInstance = null; // Referencia a la instancia de GridStack
        
        // Propiedades para inventario
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
        
        // Propiedades de experiencia
        this.currentExp = 0;
        this.maxExp = 300;
        this.characterLevel = 1;
        
        this.init();
    }
    
    init() {
        // Inicializar GridStack primero
        this.initGridStack();
        
        this.loadDefaultAttributes();
        this.setupEventListeners();
        this.updateHPDisplay();
        this.updateManaDisplay();
        this.setupSpellSlots();
        this.setupCustomization();
        this.setupTextCustomization();
        this.loadFromLocalStorage();
        this.setupImageUpload();
        this.setupInventory();
        this.setupExpListeners();
        this.updateExpDisplay();
        this.setupAddCardButton();
        this.setupKeyboardShortcuts(); // Añadir atajos de teclado
        
        console.log('CharacterSheet inicializado con GridStack y Toggle');
    }
    
    // ===== MÉTODOS DE GRIDSTACK =====
    
    initGridStack() {
        setTimeout(() => {
            const gridElement = document.querySelector('.character-sheet');
            if (!gridElement) return;
            
            // Guardar la instancia
            this.gridInstance = GridStack.init({
                column: 12,
                cellHeight: 80,
                margin: 10,
                minRow: 2,
                float: true,
                animate: true,
                draggable: {
                    handle: '.card-title',
                    scroll: true,
                    appendTo: 'body'
                },
                resizable: {
                    handles: 'e, se, s, sw, w',
                    autoHide: false
                },
                alwaysShowResizeHandle: true
            }, gridElement);
            
            grid = this.gridInstance; // Mantener compatibilidad
            
            console.log('GridStack inicializado:', this.gridInstance);
            
            // Configurar estilos para los handles
            this.setupResizeHandles();
            
            // Inicializar el botón de toggle
            this.setupGridToggle();
            
            // Cargar estado guardado
            this.updateToggleButton();
            
        }, 100);
    }

    setupResizeHandles() {
        // Los handles ya son añadidos automáticamente por GridStack
        // Solo aseguramos que tengan los iconos correctos
        const style = document.createElement('style');
        style.textContent = `
            .grid-stack-item .ui-resizable-handle::after {
                content: '';
                position: absolute;
                width: 8px;
                height: 8px;
                border-right: 2px solid #d4af37;
                border-bottom: 2px solid #d4af37;
            }
            .grid-stack-item .ui-resizable-handle.ui-resizable-se::after {
                bottom: 5px;
                right: 5px;
                transform: rotate(-45deg);
            }
            .grid-stack-item .ui-resizable-handle.ui-resizable-sw::after {
                bottom: 5px;
                left: 5px;
                transform: rotate(45deg);
            }
            .grid-stack-item .ui-resizable-handle.ui-resizable-s::after {
                bottom: 5px;
                left: 50%;
                transform: translateX(-50%) rotate(45deg);
            }
        `;
        document.head.appendChild(style);
    }

    setupGridToggle() {
        const toggleBtn = document.getElementById('gridstackToggleBtn');
        if (!toggleBtn) return;
        
        toggleBtn.addEventListener('click', () => {
            this.toggleGridStack();
        });
        
        // Actualizar estado inicial del botón
        this.updateToggleButton();
    }

    toggleGridStack() {
        if (!this.gridInstance) return;
        
        this.gridEnabled = !this.gridEnabled;
        
        const gridElement = document.querySelector('.character-sheet');
        const toggleBtn = document.getElementById('gridstackToggleBtn');
        const statusSpan = toggleBtn ? toggleBtn.querySelector('.toggle-status') : null;
        
        if (this.gridEnabled) {
            // Activar GridStack
            this.gridInstance.enable(); // Reactivar drag & drop
            this.gridInstance.enableResize(); // Reactivar redimensionamiento
            
            // Quitar clase desactivada
            gridElement.classList.remove('gridstack-disabled');
            
            // Actualizar botón
            if (toggleBtn) {
                toggleBtn.classList.remove('disabled');
                toggleBtn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
                if (statusSpan) statusSpan.textContent = 'Modo Edición';
            }
            
            // Restaurar estilos de los títulos
            document.querySelectorAll('.card-title').forEach(title => {
                title.style.cursor = 'grab';
                title.style.background = '';
            });
            
            this.showMessage('Modo edición activado', 'info');
            
        } else {
            // Desactivar GridStack
            this.gridInstance.disable(); // Desactivar drag & drop
            this.gridInstance.disableResize(); // Desactivar redimensionamiento
            
            // Añadir clase desactivada
            gridElement.classList.add('gridstack-disabled');
            
            // Actualizar botón
            if (toggleBtn) {
                toggleBtn.classList.add('disabled');
                toggleBtn.style.background = 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)';
                if (statusSpan) statusSpan.textContent = 'Modo Estático';
            }
            
            // Cambiar cursor de los títulos
            document.querySelectorAll('.card-title').forEach(title => {
                title.style.cursor = 'default';
            });
            
            this.showMessage('Modo estático activado', 'info');
        }
        
        // Guardar preferencia
        localStorage.setItem('gridstackEnabled', this.gridEnabled);
    }

    updateToggleButton() {
        const savedState = localStorage.getItem('gridstackEnabled');
        if (savedState !== null) {
            this.gridEnabled = savedState === 'true';
            if (!this.gridEnabled) {
                // Si estaba desactivado, aplicar estado
                setTimeout(() => {
                    this.toggleGridStack(); // Esto lo desactivará
                }, 200);
            }
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+E para activar/desactivar GridStack
            if (e.ctrlKey && e.key === 'e') {
                e.preventDefault();
                this.toggleGridStack();
            }
            
            // Ctrl+N para nueva tarjeta
            if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                this.addNewCard();
            }
        });
    }

    addNewCard() {
        if (!this.gridInstance) return;
        
        if (!this.gridEnabled) {
            this.showMessage('Activa el modo edición (Ctrl+E) para añadir tarjetas', 'warning');
            return;
        }
        
        const cardId = `card-${Date.now()}`;
        const cardNumber = document.querySelectorAll('.grid-stack-item').length + 1;
        
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        
        const widget = {
            x: 0,
            y: 0,
            w: 3,
            h: 4,
            id: cardId,
            content: `
                <div class="grid-stack-item-content">
                    <section class="card" id="${cardId}" style="background: ${randomColor}20;">
                        <h3 class="card-title" style="cursor: grab; background: ${randomColor}40;">
                            <i class="fas fa-square"></i>
                            TARJETA ${cardNumber}
                        </h3>
                        <div style="padding: 15px; text-align: center; color: #333;">
                            <i class="fas fa-dragon" style="font-size: 48px; margin-bottom: 10px; color: ${randomColor};"></i>
                            <p>Puedes personalizar esta tarjeta</p>
                            <p style="font-size: 12px; opacity: 0.7;">ID: ${cardId}</p>
                            <button type="button" class="btn-remove-card" onclick="characterSheet.removeCard('${cardId}')">
                                <i class="fas fa-times"></i> Eliminar
                            </button>
                        </div>
                    </section>
                </div>
            `
        };
        
        this.gridInstance.addWidget(widget);
        this.showMessage('Nueva tarjeta añadida', 'info');
    }

    removeCard(cardId) {
        if (!this.gridInstance) return;
        
        if (!this.gridEnabled) {
            this.showMessage('Activa el modo edición (Ctrl+E) para eliminar tarjetas', 'warning');
            return;
        }
        
        if (confirm('¿Eliminar esta tarjeta?')) {
            const card = document.getElementById(cardId);
            if (card) {
                const gridItem = card.closest('.grid-stack-item');
                if (gridItem) {
                    this.gridInstance.removeWidget(gridItem);
                    this.showMessage('Tarjeta eliminada', 'info');
                }
            }
        }
    }

    setupAddCardButton() {
        const addBtn = document.getElementById('addCardBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.addNewCard();
            });
        }
    }

    // ===== MÉTODOS EXISTENTES (sin cambios) =====
    
    loadDefaultAttributes() {
        const container = document.getElementById('attributesContainer');
        container.innerHTML = '';
        this.attributes = [];
        this.attributeCount = 0;
        
        DEFAULT_ATTRIBUTES.forEach(attr => {
            this.addAttribute(attr.name, attr.value, false);
        });
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
            
            this.saveCharacter();
        });
        
        nameInput.addEventListener('blur', () => {
            const id = parseInt(attributeItem.dataset.id);
            const attrIndex = this.attributes.findIndex(a => a.id === id);
            if (attrIndex !== -1) {
                this.attributes[attrIndex].name = nameInput.value.trim() || 'ATRIBUTO';
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
    
    // ===== MÉTODOS DE IMPORTAR/EXPORTAR =====
    
    importCharacter() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const characterData = JSON.parse(event.target.result);
                    this.loadCharacterFromData(characterData);
                    this.showMessage('Personaje cargado correctamente', 'info');
                } catch (error) {
                    console.error('Error al cargar archivo:', error);
                    this.showMessage('Error al cargar el archivo. Formato inválido.', 'error');
                }
            };
            reader.readAsText(file);
        });
        
        fileInput.click();
    }
    
    loadCharacterFromData(characterData) {
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
                this.addAttribute(attr.name, attr.value, true);
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
        
        // No cargamos layout de GridStack para mantener el layout por defecto
        
        this.saveCharacter();
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
        
        imageUpload.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                
                reader.onload = (event) => {
                    characterImage.src = event.target.result;
                    uploadArea.style.display = 'none';
                    imagePreview.style.display = 'flex';
                    imageContainer.classList.add('has-image');
                    
                    // Ajustar tamaño del contenedor según la imagen
                    characterImage.onload = () => {
                        const maxHeight = 400;
                        const aspectRatio = characterImage.naturalWidth / characterImage.naturalHeight;
                        
                        if (characterImage.naturalHeight > maxHeight) {
                            imageContainer.style.height = `${maxHeight}px`;
                        } else {
                            imageContainer.style.height = `${characterImage.naturalHeight}px`;
                        }
                    };
                    
                    this.saveCharacter();
                };
                
                reader.readAsDataURL(file);
            }
        });
        
        const changeImageBtn = document.getElementById('changeImageBtn');
        if (changeImageBtn) {
            changeImageBtn.addEventListener('click', () => {
                imageUpload.click();
            });
        }
        
        // Cargar imagen guardada
        const savedImage = localStorage.getItem('characterImage');
        if (savedImage) {
            characterImage.src = savedImage;
            characterImage.onload = () => {
                uploadArea.style.display = 'none';
                imagePreview.style.display = 'flex';
                imageContainer.classList.add('has-image');
                
                const maxHeight = 400;
                if (characterImage.naturalHeight > maxHeight) {
                    imageContainer.style.height = `${maxHeight}px`;
                } else {
                    imageContainer.style.height = `${characterImage.naturalHeight}px`;
                }
            };
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
    
    // ===== MÉTODOS DE EXPERIENCIA =====

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
        
        this.showMessage(`Nivel ${this.characterLevel}`, 'info');
        this.saveCharacter();
    }

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
    
    saveCharacter() {
        this.saveInventory();
        
        const characterData = {
            basicInfo: this.getBasicInfo(),
            attributes: this.attributes,
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
            // No guardamos layout para mantener el layout por defecto
            textColors: this.textColors,
            lastSaved: new Date().toISOString(),
            version: '3.2'
        };
        
        const characterImage = document.getElementById('characterImage');
        if (characterImage && characterImage.src && !characterImage.src.includes('data:,')) {
            localStorage.setItem('characterImage', characterImage.src);
        }
        
        localStorage.setItem('dndCharacterSheet', JSON.stringify(characterData));
        this.showSaveConfirmation();
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
        const characterData = {
            basicInfo: this.getBasicInfo(),
            attributes: this.attributes,
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
            lastExported: new Date().toISOString()
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
                        this.addAttribute(attr.name, attr.value, true);
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
                
                // Cargar equipo
                if (characterData.equipment) {
                    this.equipment = characterData.equipment;
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
                
                if (characterData.textColors) {
                    this.textColors = { ...this.textColors, ...characterData.textColors };
                    this.applyCustomTextColors();
                }
                
                // No cargamos layout para mantener el layout por defecto
                
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
        
        // Cargar estado de GridStack
        const savedGridState = localStorage.getItem('gridstackEnabled');
        if (savedGridState !== null) {
            this.gridEnabled = savedGridState === 'true';
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
                
                if (inventoryData.equipment) {
                    this.equipment = inventoryData.equipment;
                    this.renderEquipment();
                    
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

    showAddEquipmentModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        
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
        
        if (attribute && bonus !== 0) {
            this.applyEquipmentBonus(equipmentItem, true);
        }
        
        document.getElementById('configModal').style.display = 'none';
        this.showMessage('Equipo añadido', 'info');
    }

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
            
            const stealthIcon = item.stealth === 'advantage' ? 'fa-check-circle' : (item.stealth === 'disadvantage' ? 'fa-exclamation-circle' : 'fa-circle');
            const stealthColor = item.stealth === 'advantage' ? '#4CAF50' : (item.stealth === 'disadvantage' ? '#ff4444' : '#888');
            
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
            
            equipmentItem.querySelector('.btn-remove-equipment').addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeEquipment(item.id);
            });
        });
    }

    removeEquipment(id) {
        if (confirm('¿Eliminar este equipo?')) {
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
                        currentValue += item.bonus;
                    } else {
                        currentValue -= item.bonus;
                    }
                    
                    valueInput.value = currentValue;
                    
                    const modifierElement = attrItem.querySelector('.ability-modifier');
                    const modifier = this.calculateModifier(currentValue);
                    
                    if (modifier >= 0) {
                        modifierElement.textContent = `+${modifier}`;
                        modifierElement.style.color = this.textColors.modifier;
                    } else {
                        modifierElement.textContent = modifier.toString();
                        modifierElement.style.color = this.textColors.modifier;
                    }
                    
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
        
        .message {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: #4CAF50;
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        }
        
        .message-info {
            background: #2196F3;
        }
        
        .message-warning {
            background: #ff9800;
        }
        
        .message-error {
            background: #f44336;
        }
        
        .btn-remove-card {
            background: #ff4757;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 5px 10px;
            cursor: pointer;
            font-size: 12px;
        }
        
        .btn-remove-card:hover {
            background: #ff6b81;
        }
    `;
    document.head.appendChild(style);
    
    try {
        const characterSheet = new CharacterSheet();
        window.characterSheet = characterSheet;
        console.log('La Libreta del Escriba - Versión 3.2 con GridStack y Toggle');
    } catch (error) {
        console.error('Error al inicializar:', error);
        alert('Hubo un error al cargar la aplicación. Por favor, recarga la página.');
    }
});