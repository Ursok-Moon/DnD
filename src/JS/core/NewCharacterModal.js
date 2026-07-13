export class NewCharacterModal {
    constructor(tabManager, characterSheetClass) {
        this.tabManager = tabManager;
        this.CharacterSheet = characterSheetClass;
        this.modal = document.getElementById('newCharacterModal');
        this.bestiaryData = [];
        this.speciesData = [];
        this.isLoading = false;
        this.currentSearchType = 'standard';

        if (!this.modal) {
            console.error('❌ Modal newCharacterModal no encontrado.');
            return;
        }

        this.loadData();
        this.setupEventListeners();
        this.setupAutocomplete();
        console.log('✅ NewCharacterModal inicializado');
    }

    async loadData() {
        this.isLoading = true;
        
        try {
            const response = await fetch('/api/json/bestiario');
            if (response.ok) {
                const data = await response.json();
                this.bestiaryData = Array.isArray(data) ? data : [];
                console.log(`📚 Bestiario cargado: ${this.bestiaryData.length} criaturas`);
            }
        } catch (error) {
            console.warn('⚠️ Error cargando bestiario:', error);
            try {
                const response = await fetch('/data/bestiario.json');
                const data = await response.json();
                this.bestiaryData = Array.isArray(data) ? data : [];
                console.log(`📚 Bestiario cargado (fallback): ${this.bestiaryData.length} criaturas`);
            } catch (e) {
                this.bestiaryData = [];
            }
        }

        try {
            const response = await fetch('/api/json/especies');
            if (response.ok) {
                const data = await response.json();
                this.speciesData = Array.isArray(data) ? data : [];
                console.log(`🧬 Especies cargadas: ${this.speciesData.length} razas`);
            }
        } catch (error) {
            console.warn('⚠️ Error cargando especies:', error);
            try {
                const response = await fetch('/data/especies.json');
                const data = await response.json();
                this.speciesData = Array.isArray(data) ? data : [];
                console.log(`🧬 Especies cargadas (fallback): ${this.speciesData.length} razas`);
            } catch (e) {
                this.speciesData = [];
            }
        }

        this.isLoading = false;
        this.updateTypeHint();
    }

    show() {
        if (!this.modal) return;
        this.modal.style.display = 'flex';
        
        const nameInput = document.getElementById('newCharName');
        const raceInput = document.getElementById('newCharRace');
        const resultsList = document.getElementById('newCharRaceResults');
        
        if (nameInput) {
            nameInput.value = '';
            setTimeout(() => nameInput.focus(), 100);
        }
        if (raceInput) raceInput.value = '';
        if (resultsList) resultsList.style.display = 'none';
        
        const standardRadio = document.querySelector('input[name="newCharType"][value="standard"]');
        if (standardRadio) {
            standardRadio.checked = true;
            this.currentSearchType = 'standard';
        }
        
        this.updateTypeHint();
    }

    hide() {
        if (this.modal) this.modal.style.display = 'none';
    }

    setupEventListeners() {
        const closeBtn = document.getElementById('closeNewCharModal');
        const cancelBtn = document.getElementById('cancelNewCharBtn');
        const createBtn = document.getElementById('createNewCharBtn');
        const nameInput = document.getElementById('newCharName');
        const raceInput = document.getElementById('newCharRace');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.hide());
        }
        
        if (this.modal) {
            this.modal.addEventListener('click', (e) => {
                if (e.target === this.modal) this.hide();
            });
        }

        if (createBtn) {
            const newBtn = createBtn.cloneNode(true);
            createBtn.parentNode.replaceChild(newBtn, createBtn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.createNewCharacter();
            });
        }

        if (nameInput) {
            nameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.createNewCharacter();
                }
            });
        }

        if (raceInput) {
            raceInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    const resultsList = document.getElementById('newCharRaceResults');
                    const selected = resultsList?.querySelector('.selected');
                    if (selected) {
                        selected.click();
                    } else {
                        this.createNewCharacter();
                    }
                }
            });
        }

        document.querySelectorAll('input[name="newCharType"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.currentSearchType = e.target.value;
                this.updateTypeHint();
                const raceInput = document.getElementById('newCharRace');
                const resultsList = document.getElementById('newCharRaceResults');
                if (raceInput) raceInput.value = '';
                if (resultsList) resultsList.style.display = 'none';
                if (raceInput) raceInput.focus();
            });
        });
    }

    updateTypeHint() {
        const raceInput = document.getElementById('newCharRace');
        const hint = raceInput?.closest('.form-group')?.querySelector('small');
        
        if (hint) {
            if (this.currentSearchType === 'bestiary') {
                const count = this.bestiaryData.length;
                hint.innerHTML = `<i class="fas fa-dragon" style="color: var(--accent-gold, #d4af37);"></i> Buscando en el bestiario del DM (${count} criaturas)`;
            } else {
                const count = this.speciesData.length;
                hint.innerHTML = `<i class="fas fa-users" style="color: var(--accent-blue, #1e3a5f);"></i> Buscando en razas jugables (${count} especies)`;
            }
        }
    }

    setupAutocomplete() {
        const raceInput = document.getElementById('newCharRace');
        const resultsList = document.getElementById('newCharRaceResults');

        if (!raceInput || !resultsList) return;

        if (this._boundRaceInputHandler) {
            raceInput.removeEventListener('input', this._boundRaceInputHandler);
        }
        if (this._boundDocumentClickHandler) {
            document.removeEventListener('click', this._boundDocumentClickHandler);
        }
        if (this._boundKeydownHandler) {
            raceInput.removeEventListener('keydown', this._boundKeydownHandler);
        }

        this._boundRaceInputHandler = (e) => {
            const searchTerm = raceInput.value.toLowerCase().trim();
            resultsList.innerHTML = '';
            resultsList.style.display = 'none';

            if (searchTerm.length === 0) return;

            let dataSource = [];
            let dataType = '';

            if (this.currentSearchType === 'bestiary') {
                dataSource = this.bestiaryData;
                dataType = 'criatura';
                if (this.bestiaryData.length === 0) {
                    const li = document.createElement('li');
                    li.textContent = '⏳ Cargando bestiario...';
                    li.style.cssText = `
                        padding: 10px 15px;
                        color: var(--ink-light, #5c4033);
                        font-style: italic;
                        font-family: 'Cinzel', serif;
                    `;
                    resultsList.appendChild(li);
                    resultsList.style.display = 'block';
                    return;
                }
            } else {
                dataSource = this.speciesData;
                dataType = 'raza';
                if (this.speciesData.length === 0) {
                    const li = document.createElement('li');
                    li.textContent = '⏳ Cargando razas...';
                    li.style.cssText = `
                        padding: 10px 15px;
                        color: var(--ink-light, #5c4033);
                        font-style: italic;
                        font-family: 'Cinzel', serif;
                    `;
                    resultsList.appendChild(li);
                    resultsList.style.display = 'block';
                    return;
                }
            }

            const filtered = dataSource.filter(item => {
                const itemName = this.currentSearchType === 'bestiary' 
                    ? (item.nombre || '').toLowerCase()
                    : (item.name || '').toLowerCase();
                return itemName.includes(searchTerm) || 
                       itemName.startsWith(searchTerm) ||
                       (searchTerm.length >= 3 && itemName.includes(searchTerm));
            }).slice(0, 15);

            if (filtered.length > 0) {
                filtered.forEach(item => {
                    const li = document.createElement('li');
                    const name = this.currentSearchType === 'bestiary' 
                        ? (item.nombre || 'Criatura sin nombre')
                        : (item.name || 'Raza sin nombre');
                    
                    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    const highlightedText = name.replace(regex, '<span class="highlight">$1</span>');
                    
                    let extraInfo = '';
                    if (this.currentSearchType === 'bestiary') {
                        if (item.estadisticas?.tipo) extraInfo += ` 🏷️ ${item.estadisticas.tipo}`;
                        if (item.estadisticas?.desafio) extraInfo += ` ⭐ ${item.estadisticas.desafio}`;
                        if (item.book) extraInfo += ` 📖 ${item.book}`;
                    } else {
                        if (item.publisher) extraInfo += ` 📖 ${item.publisher}`;
                        if (item.book) extraInfo += ` 📖 ${item.book}`;
                    }
                    
                    li.innerHTML = `
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: bold;">${highlightedText}</span>
                            ${extraInfo ? `<small style="color: var(--ink-light, #5c4033); font-size: 0.7rem;">${extraInfo}</small>` : ''}
                            ${this.currentSearchType === 'bestiary' && item.descripcion ? 
                                `<small style="color: var(--ink-light, #5c4033); font-size: 0.65rem; opacity: 0.7;">${item.descripcion.substring(0, 80)}${item.descripcion.length > 80 ? '...' : ''}</small>` : 
                                ''}
                        </div>
                    `;
                    li.style.cssText = `
                        padding: 10px 15px;
                        cursor: pointer;
                        border-bottom: 1px solid var(--parchment-dark, #e6d0b5);
                        font-family: 'Cinzel', serif;
                        transition: background 0.2s ease;
                    `;
                    
                    li.addEventListener('mouseover', () => {
                        li.style.background = 'var(--parchment-light, #f5e6d3)';
                    });
                    li.addEventListener('mouseout', () => {
                        li.style.background = 'white';
                    });
                    li.addEventListener('click', () => {
                        raceInput.value = name;
                        resultsList.style.display = 'none';
                        raceInput.dataset.selectedItem = JSON.stringify(item);
                        const nameInput = document.getElementById('newCharName');
                        if (nameInput && !nameInput.value.trim()) {
                            nameInput.value = name;
                        }
                    });
                    resultsList.appendChild(li);
                });
                resultsList.style.display = 'block';
            } else {
                const li = document.createElement('li');
                const message = this.currentSearchType === 'bestiary' 
                    ? '🔍 No se encontraron criaturas en el bestiario' 
                    : '🔍 No se encontraron razas disponibles';
                li.textContent = message;
                li.style.cssText = `
                    padding: 10px 15px;
                    color: var(--ink-light, #5c4033);
                    font-style: italic;
                    font-family: 'Cinzel', serif;
                `;
                resultsList.appendChild(li);
                resultsList.style.display = 'block';
            }
        };

        raceInput.addEventListener('input', this._boundRaceInputHandler);

        this._boundKeydownHandler = (e) => {
            const items = resultsList.getElementsByTagName('li');
            let selectedIndex = -1;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].classList.contains('selected')) {
                    selectedIndex = i;
                    items[i].classList.remove('selected');
                    items[i].style.background = 'white';
                    break;
                }
            }
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (items.length > 0) {
                    const nextIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
                    items[nextIndex].classList.add('selected');
                    items[nextIndex].style.background = 'var(--parchment-light, #f5e6d3)';
                    items[nextIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (items.length > 0) {
                    const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
                    items[prevIndex].classList.add('selected');
                    items[prevIndex].style.background = 'var(--parchment-light, #f5e6d3)';
                    items[prevIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex].click();
            } else if (e.key === 'Escape') {
                resultsList.style.display = 'none';
            }
        };
        raceInput.addEventListener('keydown', this._boundKeydownHandler);

        this._boundDocumentClickHandler = (e) => {
            if (e.target !== raceInput && !resultsList.contains(e.target)) {
                resultsList.style.display = 'none';
            }
        };
        document.addEventListener('click', this._boundDocumentClickHandler);
    }

    async createNewCharacter() {
        const nameInput = document.getElementById('newCharName');
        const raceInput = document.getElementById('newCharRace');
        const typeRadio = document.querySelector('input[name="newCharType"]:checked');
        
        const name = nameInput?.value?.trim() || '';
        const race = raceInput?.value?.trim() || '';
        const type = typeRadio?.value || 'standard';

        if (!name) {
            if (nameInput) {
                nameInput.style.borderColor = '#ff4444';
                nameInput.style.boxShadow = '0 0 0 3px rgba(255,68,68,0.2)';
                setTimeout(() => {
                    nameInput.style.borderColor = '';
                    nameInput.style.boxShadow = '';
                }, 1500);
                nameInput.focus();
            }
            alert('⚠️ Por favor, ingresa un nombre para el personaje.');
            return;
        }

        let selectedItem = null;
        if (raceInput?.dataset.selectedItem) {
            try {
                selectedItem = JSON.parse(raceInput.dataset.selectedItem);
            } catch (e) {
                console.warn('Error parseando item seleccionado:', e);
            }
        }

        if (!selectedItem && race) {
            if (type === 'bestiary') {
                selectedItem = this.bestiaryData.find(item => 
                    (item.nombre || '').toLowerCase() === race.toLowerCase()
                );
                if (!selectedItem) {
                    selectedItem = this.bestiaryData.find(item => 
                        (item.nombre || '').toLowerCase().includes(race.toLowerCase())
                    );
                }
            } else {
                selectedItem = this.speciesData.find(item => 
                    (item.name || '').toLowerCase() === race.toLowerCase()
                );
                if (!selectedItem) {
                    selectedItem = this.speciesData.find(item => 
                        (item.name || '').toLowerCase().includes(race.toLowerCase())
                    );
                }
            }
        }

        if (type === 'bestiary' && race && !selectedItem) {
            const confirmCreate = confirm(
                `⚠️ No se encontró "${race}" en el bestiario.\n\n` +
                `¿Quieres crear la hoja igualmente sin datos precargados?`
            );
            if (!confirmCreate) return;
        }

        // Crear pestaña usando TabManager (que ahora crea contenido desde cero)
        const newTabId = this.tabManager.createTab(name, null, true);

        // Obtener la hoja recién creada
        const tabData = this.tabManager.getTabData(newTabId);
        if (tabData && tabData.characterSheet) {
            const sheet = tabData.characterSheet;

            // Establecer nombre
            const nameInputEl = sheet.container?.querySelector('#char-name');
            if (nameInputEl) {
                nameInputEl.value = name;
                nameInputEl.dispatchEvent(new Event('change', { bubbles: true }));
            }

            // Aplicar datos según el tipo
            if (type === 'bestiary' && selectedItem) {
                this.applyBestiaryData(sheet, selectedItem);
            } else if (type === 'standard' && selectedItem) {
                this.applySpeciesData(sheet, selectedItem);
            } else if (race) {
                const raceInputEl = sheet.container?.querySelector('#char-race');
                if (raceInputEl) {
                    raceInputEl.value = race;
                    raceInputEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }

            // Guardar automáticamente
            setTimeout(() => {
                if (sheet.saveCharacter) {
                    sheet.saveCharacter();
                    console.log(`💾 Personaje "${name}" guardado automáticamente`);
                }
            }, 500);
        }

        this.hide();
    }

    applyBestiaryData(sheet, creature) {
        if (!sheet || !creature) return;
        console.log(`📚 Aplicando datos de bestiario: ${creature.nombre}`);

        const raceInput = sheet.container?.querySelector('#char-race');
        if (raceInput) {
            raceInput.value = creature.nombre || '';
            raceInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const stats = creature.estadisticas;
        if (stats) {
            this.applyAttributesFromStats(sheet, stats);
        }

        if (creature.descripcion) {
            const featuresTextarea = sheet.container?.querySelector('#features');
            if (featuresTextarea) {
                let description = `🐉 ${creature.nombre || 'Criatura'}\n\n`;
                description += creature.descripcion + '\n\n';
                
                if (stats) {
                    description += '--- 📊 ESTADÍSTICAS ---\n';
                    if (stats.tipo) description += `Tipo: ${stats.tipo}\n`;
                    if (stats.ca) description += `CA: ${stats.ca}\n`;
                    if (stats.pg) description += `PG: ${stats.pg}\n`;
                    if (stats.velocidad) description += `Velocidad: ${stats.velocidad}\n`;
                    if (stats.desafio) description += `Desafío: ${stats.desafio}\n`;
                }
                
                featuresTextarea.value = description;
                featuresTextarea.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        if (creature.img_url) {
            const imagePreview = sheet.container?.querySelector('#imagePreview');
            const characterImage = sheet.container?.querySelector('#characterImage');
            if (characterImage && imagePreview) {
                characterImage.src = creature.img_url;
                imagePreview.style.display = 'flex';
                const uploadArea = sheet.container?.querySelector('#imageUploadArea');
                if (uploadArea) uploadArea.style.display = 'none';
            }
        }
    }

    applySpeciesData(sheet, species) {
        if (!sheet || !species) return;
        console.log(`🧬 Aplicando datos de especie: ${species.name}`);

        const raceInput = sheet.container?.querySelector('#char-race');
        if (raceInput) {
            raceInput.value = species.name || '';
            raceInput.dispatchEvent(new Event('change', { bubbles: true }));
        }

        const atributos = species.atributos || species.properties?.['Ability Score Increase'];
        if (atributos && typeof sheet.aplicarAtributosDeEspecie === 'function') {
            try {
                sheet.aplicarAtributosDeEspecie(atributos);
                console.log(`📊 Atributos de ${species.name} aplicados`);
            } catch (e) {
                console.warn('⚠️ Error aplicando atributos:', e);
            }
        }

        if (species.descripcion) {
            const featuresTextarea = sheet.container?.querySelector('#features');
            if (featuresTextarea) {
                featuresTextarea.value = `🧬 ${species.name || 'Especie'}\n\n${species.descripcion}`;
                featuresTextarea.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    applyAttributesFromStats(sheet, stats) {
        const attributeMap = {
            'FUE': 'Fuerza',
            'DES': 'DESTREZA',
            'CON': 'CONSTITUCIÓN',
            'INT': 'INTELIGENCIA',
            'SAB': 'SABIDURÍA',
            'CAR': 'CARISMA'
        };

        const attributes = [];
        for (const [key, value] of Object.entries(stats)) {
            if (attributeMap[key] && typeof value === 'number') {
                attributes.push({ name: attributeMap[key], value: value });
            } else if (attributeMap[key] && typeof value === 'string') {
                const match = value.match(/(\d+)/);
                if (match) {
                    attributes.push({ name: attributeMap[key], value: parseInt(match[1]) });
                }
            }
        }

        if (attributes.length > 0 && typeof sheet.aplicarAtributosDeEspecie === 'function') {
            try {
                const attrObject = {};
                attributes.forEach(a => {
                    attrObject[a.name] = a.value - 10;
                });
                sheet.aplicarAtributosDeEspecie(attrObject);
            } catch (e) {
                console.warn('⚠️ Error aplicando atributos de bestiario:', e);
            }
        }

        if (stats.ca) {
            const caInput = sheet.container?.querySelector('#armor-class');
            if (caInput) {
                const caMatch = String(stats.ca).match(/\d+/);
                if (caMatch) {
                    caInput.value = parseInt(caMatch[0]);
                    caInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }

        if (stats.pg) {
            const hpInput = sheet.container?.querySelector('#max-hp');
            if (hpInput) {
                const hpMatch = String(stats.pg).match(/\d+/);
                if (hpMatch) {
                    const hpValue = parseInt(hpMatch[0]);
                    hpInput.value = hpValue;
                    hpInput.dispatchEvent(new Event('change', { bubbles: true }));
                    const currentHpInput = sheet.container?.querySelector('#current-hp');
                    if (currentHpInput) {
                        currentHpInput.value = hpValue;
                        currentHpInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }
        }

        if (stats.velocidad) {
            const speedInput = sheet.container?.querySelector('#speed');
            if (speedInput) {
                const speedMatch = String(stats.velocidad).match(/\d+/);
                if (speedMatch) {
                    speedInput.value = parseInt(speedMatch[0]);
                    speedInput.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    }

    getBestiary() {
        return this.bestiaryData;
    }

    getSpecies() {
        return this.speciesData;
    }
}