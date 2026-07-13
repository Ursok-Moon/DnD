// js/core/TabManager.js

export class TabManager {
    constructor(options = {}) {
        this.containerId = options.containerId || 'tabSystemContainer';
        this.container = document.getElementById(this.containerId);
        this.tabs = [];
        this.activeTabId = null;
        this.tabIdCounter = 0;
        this.onTabChangeCallbacks = [];
        this.onTabCreateCallbacks = [];
        this.CharacterSheetClass = options.CharacterSheetClass || null;
        this.isInitialized = false;
        
        if (!this.container) {
            console.error('❌ TabManager: Contenedor no encontrado:', this.containerId);
            return;
        }
        
        this.init();
    }

    init() {
        this.tabList = this.container.querySelector('#tabList');
        this.contentArea = this.container.querySelector('#tabContentArea');
        this.newTabBtn = this.container.querySelector('#newTabBtn');
        
        if (!this.tabList || !this.contentArea) {
            console.error('❌ TabManager: Estructura HTML incorrecta');
            return;
        }

        // Verificar si ya hay una hoja principal
        const mainContent = this.contentArea.querySelector('#hojaPrincipal');
        if (mainContent) {
            const charName = mainContent.querySelector('#char-name')?.value || 'Personaje Principal';
            const mainTabId = this.createTab(charName, mainContent, true);
            const mainTabElement = this.getTabElement(mainTabId);
            if (mainTabElement) {
                mainTabElement.dataset.mainTab = 'true';
                const closeBtn = mainTabElement.querySelector('.tab-close-btn');
                if (closeBtn) closeBtn.style.display = 'none';
            }
        }

        if (this.newTabBtn) {
            const newBtn = this.newTabBtn.cloneNode(true);
            this.newTabBtn.parentNode.replaceChild(newBtn, this.newTabBtn);
            this.newTabBtn = newBtn;
            
            this.newTabBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (typeof this.onNewTabClick === 'function') {
                    this.onNewTabClick();
                } else {
                    const name = prompt('Nombre del nuevo personaje:');
                    if (name && name.trim()) {
                        this.createTab(name.trim(), null, true);
                    }
                }
            });
        }

        this.isInitialized = true;
        console.log('✅ TabManager inicializado con', this.tabs.length, 'pestañas');
    }

    createTab(name, contentElement, activate = false) {
        // Generar un ID único para la pestaña
        const tabId = `tab-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        const tabData = {
            id: tabId,
            name: name || 'Personaje',
            contentElement: contentElement,
            characterSheet: null,
            isMain: false
        };
        this.tabs.push(tabData);

        // 1. Crear elemento de pestaña
        const tabLi = document.createElement('li');
        tabLi.className = 'tab-item';
        tabLi.dataset.tabId = tabId;
        
        const safeName = String(name || 'Personaje').replace(/[<>]/g, '');
        tabLi.innerHTML = `
            <span class="tab-name" title="${safeName}">${safeName}</span>
            <button class="tab-close-btn" title="Cerrar pestaña">×</button>
        `;
        this.tabList.appendChild(tabLi);

        // 2. Preparar contenido
        if (!contentElement) {
            // Crear contenido desde cero
            contentElement = this.createFreshCharacterSheetContent(tabId);
        } else {
            if (!contentElement.id || contentElement.id === 'hojaPrincipal') {
                contentElement.id = `tab-content-${tabId}`;
            }
            contentElement.className = 'tab-content';
            if (!contentElement.parentNode || contentElement.parentNode !== this.contentArea) {
                this.contentArea.appendChild(contentElement);
            }
            this.cleanupClonedContent(contentElement);
        }

        // 3. Eventos de la pestaña
        tabLi.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close-btn')) return;
            this.activateTab(tabId);
        });

        const closeBtn = tabLi.querySelector('.tab-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.closeTab(tabId);
            });
        }

        // 4. Inicializar CharacterSheet
        if (this.CharacterSheetClass && contentElement) {
            const sheetId = contentElement.id;
            try {
                if (typeof this.CharacterSheetClass === 'function') {
                    console.log(`📄 Creando CharacterSheet para pestaña ${tabId} en contenedor ${sheetId}`);
                    const sheet = new this.CharacterSheetClass(sheetId, tabId);
                    tabData.characterSheet = sheet;
                    tabData.contentElement = contentElement;
                    
                    // Escuchar cambios de nombre para actualizar la pestaña
                    if (sheet.eventBus) {
                        sheet.eventBus.on('characterNameChanged', (name) => {
                            if (name && name.trim()) {
                                this.renameTab(tabId, name.trim());
                            }
                        });
                    }
                    
                    const nameInput = sheet.container?.querySelector('#char-name');
                    if (nameInput) {
                        nameInput.addEventListener('change', () => {
                            const newName = nameInput.value.trim();
                            if (newName) {
                                this.renameTab(tabId, newName);
                            }
                        });
                    }
                    
                    // Recargar datos guardados si existen
                    setTimeout(() => {
                        if (sheet.refresh) {
                            sheet.refresh();
                        }
                    }, 100);
                }
            } catch (error) {
                console.warn('⚠️ Error inicializando CharacterSheet para pestaña', tabId, error);
            }
        }

        if (activate) {
            this.activateTab(tabId);
        }

        this.onTabCreateCallbacks.forEach(cb => {
            try { cb(tabData); } catch (e) { console.warn('Error en callback onTabCreate:', e); }
        });

        return tabId;
    }

    createFreshCharacterSheetContent(tabId) {
        const contentId = `tab-content-${tabId}`;
        const newContent = document.createElement('div');
        newContent.id = contentId;
        newContent.className = 'tab-content';

        // Obtener la estructura de la hoja principal
        const mainContent = document.getElementById('hojaPrincipal');
        if (mainContent) {
            newContent.innerHTML = mainContent.innerHTML;
        } else {
            newContent.innerHTML = this.getMinimalCharacterSheetHTML();
        }

        // Limpiar contenedores que deben ser poblados por los managers
        this.cleanupClonedContent(newContent);

        this.contentArea.appendChild(newContent);
        return newContent;
    }

    getMinimalCharacterSheetHTML() {
        return `
            <main class="character-sheet">
                <div class="left-column">
                    <section class="card basic-info" id="card-basic-info">
                        <h3 class="card-title">INFORMACIÓN DEL PERSONAJE</h3>
                        <div class="form-row">
                            <label><i class="fas fa-user"></i> Nombre</label>
                            <input type="text" id="char-name" placeholder="...">
                        </div>
                        <div class="form-row">
                            <label><i class="fas fa-hat-wizard"></i> Clase</label>
                            <input type="text" id="char-class" placeholder="...">
                        </div>
                        <div class="form-row">
                            <label><i class="fas fa-dragon"></i> Especie</label>
                            <input type="text" id="char-race" placeholder="...">
                        </div>
                        <div class="form-row">
                            <label><i class="fas fa-history"></i> Trasfondo</label>
                            <input type="text" id="char-bg" placeholder="...">
                        </div>
                        <div class="form-row">
                            <label><i class="fas fa-balance-scale"></i> Alineamiento</label>
                            <input type="text" id="char-align" placeholder="...">
                        </div>
                        <div class="exp-section">
                            <div class="exp-header">
                                <div class="exp-level-display">
                                    <label><i class="fas fa-level-up-alt"></i> NIVEL</label>
                                    <div class="level-badge" id="level-display">1</div>
                                    <div class="level-controls">
                                        <button type="button" class="level-btn minus" id="level-down-btn">-</button>
                                        <button type="button" class="level-btn" id="level-up-btn">+</button>
                                    </div>
                                </div>
                            </div>
                            <div class="exp-bar-container">
                                <div class="exp-bar-bg">
                                    <div class="exp-bar-fill" id="expBarFill"></div>
                                </div>
                                <div class="exp-numbers">
                                    <span id="expCurrentLabel">0</span>
                                    <span id="expPercentage">0%</span>
                                    <span id="expMaxLabel">300</span>
                                </div>
                            </div>
                            <div class="exp-inputs">
                                <div class="exp-input-group">
                                    <label>Actual</label>
                                    <input type="number" id="current-exp" value="0" min="0">
                                </div>
                                <div class="exp-input-group">
                                    <label>Requerida</label>
                                    <input type="number" id="max-exp" value="300" min="1">
                                </div>
                            </div>
                            <input type="hidden" id="character-level" value="1">
                        </div>
                    </section>
                    <section class="card passive-perception" id="card-passive-perception">
                        <h3 class="card-title">PERCEPCIÓN PASIVA</h3>
                        <div class="passive-perception-container">
                            <div class="passive-perception-display">
                                <input type="number" id="passivePerception" value="10" min="1" max="30" class="passive-perception-input" readonly>
                                <span class="passive-perception-label">Total</span>
                            </div>
                        </div>
                    </section>
                    <section class="card attributes-section" id="card-attributes">
                        <div class="section-header">
                            <h3 class="card-title">ATRIBUTOS</h3>
                            <button type="button" class="btn-add" id="addAttributeBtn">+</button>
                        </div>
                        <div class="attributes-container" id="attributesContainer"></div>
                    </section>
                </div>
                <div class="right-column">
                    <section class="card saving-throws" id="card-saving-throws">
                        <div class="section-header">
                            <h3 class="card-title">TIRADAS DE SALVACIÓN</h3>
                        </div>
                        <div class="saving-throws-container" id="savingThrowsContainer"></div>
                    </section>
                    <section class="card resources-section" id="card-resources">
                        <h3 class="card-title">RECURSOS MÁGICOS</h3>
                        <div class="resource-mana">
                            <div class="resource-header">
                                <h4>MANÁ</h4>
                            </div>
                            <div class="mana-display">
                                <div class="mana-bar-container">
                                    <div class="mana-bar-bg">
                                        <div class="mana-bar-fill" id="manaBarFill"></div>
                                    </div>
                                    <div class="mana-numbers">
                                        <span id="currentMana">2</span>
                                        <span class="mana-separator">/</span>
                                        <span id="maxMana">15</span>
                                    </div>
                                </div>
                                <div class="mana-controls">
                                    <button type="button" class="mana-btn mana-minus" id="manaMinusBtn">-</button>
                                    <input type="number" class="mana-input" id="manaInput" value="2" min="0" max="15">
                                    <button type="button" class="mana-btn mana-plus" id="manaPlusBtn">+</button>
                                </div>
                            </div>
                        </div>
                        <div class="spell-slots-section">
                            <div class="resource-header">
                                <h4>SLOTS DE CONJUROS</h4>
                            </div>
                            <div class="slots-grid" id="slotsGrid"></div>
                        </div>
                    </section>
                    <section class="card proficiencies" id="card-proficiencies">
                        <div class="section-header">
                            <h3 class="card-title">COMPETENCIAS & IDIOMAS</h3>
                            <button type="button" class="btn-add" id="addProficiencyBtn">+</button>
                        </div>
                        <div class="proficiencies-container" id="proficienciesContainer"></div>
                        <div class="proficiency-tabs">
                            <button type="button" class="proficiency-tab active" data-type="all">Todos</button>
                            <button type="button" class="proficiency-tab" data-type="armor">Armaduras</button>
                            <button type="button" class="proficiency-tab" data-type="weapon">Armas</button>
                            <button type="button" class="proficiency-tab" data-type="tool">Herramientas</button>
                            <button type="button" class="proficiency-tab" data-type="language">Idiomas</button>
                        </div>
                    </section>
                </div>
                <div class="center-column">
                    <section class="card combat-stats" id="card-combat-stats">
                        <h3 class="card-title">ESTADÍSTICAS DE COMBATE</h3>
                        <div class="combat-grid">
                            <div class="combat-stat">
                                <label>CLASE DE ARMADURA</label>
                                <div class="stat-display">
                                    <input type="number" id="armor-class" value="12" min="0">
                                </div>
                            </div>
                            <div class="combat-stat">
                                <label>VELOCIDAD</label>
                                <div class="stat-display">
                                    <input type="number" id="speed" value="30" min="0">
                                    <span class="stat-unit">pies</span>
                                </div>
                            </div>
                            <div class="combat-stat">
                                <label>INICIATIVA</label>
                                <div class="stat-display">
                                    <input type="number" id="initiative" value="1" min="-5" max="10">
                                </div>
                            </div>
                        </div>
                    </section>
                    <section class="card hit-points" id="card-hit-points">
                        <h3 class="card-title">PUNTOS DE GOLPE</h3>
                        <div class="hp-container">
                            <div class="hp-main">
                                <div class="hp-current-section">
                                    <label>ACTUAL</label>
                                    <div class="hp-display-large">
                                        <input type="number" id="current-hp" value="26" min="0" max="999">
                                    </div>
                                </div>
                                <div class="hp-max-section">
                                    <label>MÁXIMO</label>
                                    <div class="hp-display-large">
                                        <input type="number" id="max-hp" value="26" min="1" max="999">
                                    </div>
                                </div>
                            </div>
                            <div class="hp-temp-section">
                                <label>TEMPORALES</label>
                                <div class="hp-display">
                                    <input type="number" id="temp-hp" value="0" min="0" max="999">
                                </div>
                            </div>
                            <div class="hp-bar-container">
                                <div class="hp-bar-bg">
                                    <div class="hp-bar-fill" id="hpBarFill"></div>
                                </div>
                                <div class="hp-bar-labels">
                                    <span>0</span>
                                    <span id="hpCurrentLabel">26</span>
                                    <span id="hpMaxLabel">26</span>
                                </div>
                            </div>
                        </div>
                    </section>
                    <section class="card skills-section" id="card-skills">
                        <div class="section-header">
                            <h3 class="card-title">HABILIDADES</h3>
                            <div class="skills-header-buttons">
                                <button type="button" class="btn-add" id="addSkillBtn">+</button>
                            </div>
                        </div>
                        <div class="skills-container" id="skillsContainer"></div>
                    </section>
                    <section class="card attacks-spells" id="card-attacks-spells">
                        <h3 class="card-title">ATAQUES & CONJUROS</h3>
                        <div class="attacks-list">
                            <button type="button" class="btn-secondary" id="addAttackBtn">Añadir ataque</button>
                        </div>
                    </section>
                </div>
                <div class="full-width">
                    <section class="card traits" id="card-traits">
                        <h3 class="card-title">RASGOS & CARACTERÍSTICAS</h3>
                        <div class="traits-grid">
                            <div class="trait-group">
                                <label>Rasgos</label>
                                <textarea id="personality" rows="3"></textarea>
                            </div>
                            <div class="trait-group">
                                <label>Ideales</label>
                                <textarea id="ideals" rows="3"></textarea>
                            </div>
                            <div class="trait-group">
                                <label>Vínculos</label>
                                <textarea id="bonds" rows="3"></textarea>
                            </div>
                            <div class="trait-group">
                                <label>Defectos</label>
                                <textarea id="flaws" rows="3"></textarea>
                            </div>
                            <div class="trait-group full-width">
                                <label>Rasgos Especiales</label>
                                <textarea id="features" rows="4"></textarea>
                            </div>
                        </div>
                    </section>
                    <section class="card spells" id="card-spells">
                        <div class="section-header">
                            <h3 class="card-title">CONJUROS</h3>
                            <button type="button" class="btn-secondary" id="addSpellBtn">Añadir conjuro</button>
                        </div>
                        <div class="spell-stats-section">
                            <div class="spell-stats-grid">
                                <div class="spell-stat-item">
                                    <label>Característica Mágica</label>
                                    <select id="spellcastingAbility" class="spell-stat-select"></select>
                                </div>
                                <div class="spell-stat-item">
                                    <label>CD Salvación Conjuros</label>
                                    <div class="spell-stat-value" id="spellSaveDC">10</div>
                                </div>
                                <div class="spell-stat-item">
                                    <label>Bonif. Ataque Conjuros</label>
                                    <div class="spell-stat-value" id="spellAttackBonus">+0</div>
                                </div>
                                <div class="spell-stat-item">
                                    <label>Conjuros Preparados</label>
                                    <div class="spell-stat-input-group">
                                        <input type="number" id="preparedSpells" class="spell-stat-input" min="0" value="0">
                                        <span class="spell-stat-max">/ <span id="maxPreparedSpells">0</span></span>
                                    </div>
                                </div>
                                <div class="spell-stat-item">
                                    <label>Trucos Conocidos</label>
                                    <input type="number" id="cantripsKnown" class="spell-stat-input" min="0" value="0">
                                </div>
                            </div>
                        </div>
                        <div class="spells-list" id="spellsList"></div>
                    </section>
                </div>
            </main>
        `;
    }

    cleanupClonedContent(content) {
        const containers = [
            'slotsGrid', 
            'attributesContainer', 
            'savingThrowsContainer', 
            'skillsContainer',
            'proficienciesContainer',
            'treasureList',
            'potionsList',
            'equipmentList',
            'spellsList'
        ];
        
        containers.forEach(id => {
            const el = content.querySelector(`#${id}`);
            if (el) {
                el.innerHTML = '';
            }
        });
    }

    activateTab(tabId) {
        if (this.activeTabId === tabId) return;

        if (this.activeTabId) {
            const oldTab = this.getTabElement(this.activeTabId);
            if (oldTab) oldTab.classList.remove('active');
            const oldContent = this.getContentElement(this.activeTabId);
            if (oldContent) oldContent.classList.remove('active');
        }

        this.activeTabId = tabId;
        const newTab = this.getTabElement(tabId);
        if (newTab) newTab.classList.add('active');
        const newContent = this.getContentElement(tabId);
        if (newContent) newContent.classList.add('active');

        this.onTabChangeCallbacks.forEach(cb => {
            try { cb(tabId); } catch (e) { console.warn('Error en callback onTabChange:', e); }
        });
    }

    closeTab(tabId) {
        const tabData = this.tabs.find(t => t.id === tabId);
        if (!tabData) return;

        const tabElement = this.getTabElement(tabId);
        if (tabElement && tabElement.dataset.mainTab === 'true') {
            console.warn('⚠️ No se puede cerrar la pestaña principal.');
            return;
        }

        if (this.activeTabId === tabId) {
            const index = this.tabs.findIndex(t => t.id === tabId);
            const nextTab = this.tabs[index + 1] || this.tabs[index - 1];
            if (nextTab) {
                this.activateTab(nextTab.id);
            } else if (this.tabs.length > 0) {
                this.activateTab(this.tabs[0].id);
            }
        }

        if (tabElement) tabElement.remove();
        if (tabData.contentElement) tabData.contentElement.remove();

        this.tabs = this.tabs.filter(t => t.id !== tabId);
        console.log(`🗑️ Pestaña cerrada: ${tabData.name}`);
    }

    getTabElement(tabId) {
        return this.tabList?.querySelector(`.tab-item[data-tab-id="${tabId}"]`);
    }

    getContentElement(tabId) {
        return this.contentArea?.querySelector(`#tab-content-${tabId}`);
    }

    getActiveTabId() {
        return this.activeTabId;
    }

    getActiveTabData() {
        return this.tabs.find(t => t.id === this.activeTabId);
    }

    getTabData(tabId) {
        return this.tabs.find(t => t.id === tabId);
    }

    renameTab(tabId, newName) {
        const tabData = this.tabs.find(t => t.id === tabId);
        if (tabData && newName && newName.trim()) {
            tabData.name = newName.trim();
            const tabElement = this.getTabElement(tabId);
            if (tabElement) {
                const nameSpan = tabElement.querySelector('.tab-name');
                if (nameSpan) {
                    const safeName = String(newName.trim()).replace(/[<>]/g, '');
                    nameSpan.textContent = safeName;
                    nameSpan.title = safeName;
                }
            }
        }
    }

    onTabChange(callback) {
        if (typeof callback === 'function') {
            this.onTabChangeCallbacks.push(callback);
        }
    }

    onTabCreate(callback) {
        if (typeof callback === 'function') {
            this.onTabCreateCallbacks.push(callback);
        }
    }

    onNewTabClick() {
        console.warn('⚠️ onNewTabClick debe ser implementado externamente.');
        const name = prompt('Nombre del nuevo personaje:');
        if (name && name.trim()) {
            return this.createTab(name.trim(), null, true);
        }
        return null;
    }
}