import { Helpers } from '../../utils/Helpers.js';
import { SpellDictionaryService } from '../../services/SpellDictionaryService.js';

export class SpellManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.spells = [];
        this.listeners = [];
        this.dictionary = new SpellDictionaryService();
        this.load();
    }

    load() {
        const saved = this.storage.load('spells');
        if (saved && saved.length > 0) {
            this.spells = saved;
        }
    }

    getAll() {
        return [...this.spells];
    }

    add(name = '', level = '', description = '') {
        const spell = {
            id: Helpers.generateId(),
            name: name,
            level: level,
            description: description,
            prepared: false,
            date: new Date().toISOString()
        };
        
        this.spells.push(spell);
        this.save();
        this.notify();
        this.eventBus.emit('spellAdded', spell);
        
        setTimeout(() => {
            this.setupAutocompleteForNewSpell(spell.id);
        }, 100);
        
        return spell;
    }

    remove(id) {
        const index = this.spells.findIndex(s => s.id === id);
        if (index !== -1) {
            const removed = this.spells[index];
            this.spells.splice(index, 1);
            this.save();
            this.notify();
            this.eventBus.emit('spellRemoved', removed);
            return true;
        }
        return false;
    }

    update(id, updates) {
        const index = this.spells.findIndex(s => s.id === id);
        if (index !== -1) {
            this.spells[index] = { ...this.spells[index], ...updates };
            this.save();
            this.notify();
            this.eventBus.emit('spellUpdated', { id, updates, spell: this.spells[index] });
            return true;
        }
        return false;
    }

    togglePrepared(id) {
        const spell = this.spells.find(s => s.id === id);
        if (spell) {
            spell.prepared = !spell.prepared;
            this.save();
            this.notify();
            this.eventBus.emit('spellPreparedChanged', spell);
        }
    }

    getByLevel(level) {
        return this.spells.filter(s => s.level === level);
    }

    getPrepared() {
        return this.spells.filter(s => s.prepared);
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.spells);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.spells));
        this.eventBus.emit('spellsChanged', this.spells);
    }

    save() {
        this.storage.save('spells', this.spells);
    }

    // ===== METODOS DE AUTOCOMPLETADO =====

    async setupAutocomplete() {
        await this.dictionary.loadSpells();
        this.setupExistingSpellInputs();
        this.observeNewSpells();
    }

    setupExistingSpellInputs() {
        const spellNameInputs = document.querySelectorAll('#spellsList .spell-name');
        spellNameInputs.forEach(input => {
            if (!input.hasAttribute('data-autocomplete-enabled')) {
                this.setupSingleSpellAutocomplete(input);
            }
        });
    }

    setupAutocompleteForNewSpell(spellId) {
        const spellItem = document.querySelector(`#spellsList .spell-item[data-id="${spellId}"]`);
        if (spellItem) {
            const nameInput = spellItem.querySelector('.spell-name');
            if (nameInput && !nameInput.hasAttribute('data-autocomplete-enabled')) {
                this.setupSingleSpellAutocomplete(nameInput);
            }
        }
    }

    observeNewSpells() {
        const spellsList = document.getElementById('spellsList');
        if (!spellsList) return;
        
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.classList && node.classList.contains('spell-item')) {
                            const nameInput = node.querySelector('.spell-name');
                            if (nameInput && !nameInput.hasAttribute('data-autocomplete-enabled')) {
                                this.setupSingleSpellAutocomplete(nameInput);
                            }
                        }
                    });
                }
            });
        });
        
        observer.observe(spellsList, { childList: true, subtree: true });
    }

    setupSingleSpellAutocomplete(input) {
        if (!input || input.hasAttribute('data-autocomplete-enabled')) return;
        
        input.setAttribute('data-autocomplete-enabled', 'true');
        
        const spellHeader = input.closest('.spell-header');
        if (!spellHeader) return;
        
        if (getComputedStyle(spellHeader).position === 'static') {
            spellHeader.style.position = 'relative';
        }
        
        let resultsList = spellHeader.querySelector('.spell-search-results');
        if (!resultsList) {
            resultsList = document.createElement('ul');
            resultsList.className = 'spell-search-results';
            resultsList.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                max-height: 200px;
                overflow-y: auto;
                background: white;
                border: 2px solid #d4af37;
                border-radius: 4px;
                list-style: none;
                padding: 0;
                margin: 0;
                z-index: 10000;
                display: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            spellHeader.appendChild(resultsList);
        }
        
        let searchTimeout;
        
        const inputHandler = (e) => {
            clearTimeout(searchTimeout);
            const searchTerm = input.value.toLowerCase().trim();
            
            if (!resultsList) return;
            resultsList.innerHTML = '';
            
            if (searchTerm.length === 0) {
                resultsList.style.display = 'none';
                return;
            }
            
            searchTimeout = setTimeout(() => {
                const filtered = this.dictionary.searchSpells(searchTerm, 15);
                
                if (filtered.length > 0) {
                    filtered.forEach(spell => {
                        const li = document.createElement('li');
                        const levelText = this.dictionary.getLevelText(spell.level);
                        const schoolText = this.dictionary.getSchoolSpanish(spell.school);
                        
                        let highlightedName = spell.name;
                        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                        highlightedName = spell.name.replace(regex, '<span class="highlight">$1</span>');
                        
                        li.innerHTML = `
                            <div style="display: flex; flex-direction: column;">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span style="font-weight: bold; color: #d4af37;">${highlightedName}</span>
                                    <span style="font-size: 0.7rem; background: rgba(106,13,173,0.2); padding: 2px 6px; border-radius: 4px;">
                                        ${levelText}
                                    </span>
                                </div>
                                <div style="display: flex; gap: 8px; font-size: 0.7rem; color: #666; margin-top: 4px;">
                                    ${spell.castingTime && spell.castingTime !== '—' ? `<span>${spell.castingTime}</span>` : ''}
                                    ${spell.range && spell.range !== '—' ? `<span>${spell.range}</span>` : ''}
                                    ${spell.components && spell.components !== '—' ? `<span>${spell.components}</span>` : ''}
                                    ${schoolText ? `<span>${schoolText}</span>` : ''}
                                </div>
                                <div style="font-size: 0.65rem; color: #888; margin-top: 4px;">
                                    ${spell.book ? `Fuente: ${spell.book}` : ''}
                                </div>
                            </div>
                        `;
                        
                        li.style.cssText = `
                            padding: 10px 15px;
                            cursor: pointer;
                            border-bottom: 1px solid #e6d0b5;
                            font-family: 'Cinzel', serif;
                            transition: background 0.2s ease;
                        `;
                        
                        li.addEventListener('mouseover', () => {
                            li.style.background = '#f5e6d3';
                        });
                        
                        li.addEventListener('mouseout', () => {
                            li.style.background = 'white';
                        });
                        
                        // IMPORTANTE: Prevenir que el evento se propague al documento
                        li.addEventListener('mousedown', (e) => {
                            e.preventDefault();  // Prevenir que el input pierda foco
                            e.stopPropagation(); // Prevenir que el documento lo cierre
                        });
                        
                        li.addEventListener('click', (e) => {
                            e.stopPropagation();
                            this.fillSpellData(input, spell);
                            resultsList.style.display = 'none';
                        });
                        
                        resultsList.appendChild(li);
                    });
                    resultsList.style.display = 'block';
                } else {
                    resultsList.style.display = 'none';
                }
            }, 300);
        };
        
        input.removeEventListener('input', this._boundSpellInputHandler);
        this._boundSpellInputHandler = inputHandler;
        input.addEventListener('input', this._boundSpellInputHandler);
        
        // Cerrar al hacer clic fuera - usando delay para permitir que el click del li se ejecute primero
        const documentClickHandler = (e) => {
            // Pequeño delay para permitir que el click del li se procese
            setTimeout(() => {
                if (resultsList && 
                    e.target !== input && 
                    !resultsList.contains(e.target) &&
                    !spellHeader.contains(e.target)) {
                    resultsList.style.display = 'none';
                }
            }, 10);
        };
        
        document.removeEventListener('click', this._boundSpellDocumentClickHandler);
        this._boundSpellDocumentClickHandler = documentClickHandler;
        document.addEventListener('click', this._boundSpellDocumentClickHandler);
    }

fillSpellData(input, spellData) {
    const spellItem = input.closest('.spell-item');
    if (!spellItem) return;
    
    const spellId = spellItem.getAttribute('data-id');
    
    // Asegurar que el nivel es un número o string válido
    const levelValue = spellData.level !== undefined && spellData.level !== null ? String(spellData.level) : '0';
    
    // ACTUALIZAR EL MODELO DE DATOS PRIMERO
    if (spellId) {
        this.update(spellId, {
            name: spellData.name,
            level: levelValue,
            description: spellData.description
        });
    }
    
    // DESPUÉS actualizar la UI
    input.value = spellData.name;
    
    const levelInput = spellItem.querySelector('.spell-level-input');
    if (levelInput) {
        levelInput.value = levelValue;
        // Disparar evento change para que el UI se actualice
        levelInput.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    const descTextarea = spellItem.querySelector('.spell-desc');
    if (descTextarea) {
        let metadata = '';
        
        if (spellData.castingTime && spellData.castingTime !== '—') {
            metadata += `Tiempo de lanzamiento: ${spellData.castingTime}\n`;
        }
        if (spellData.range && spellData.range !== '—') {
            metadata += `Alcance: ${spellData.range}\n`;
        }
        if (spellData.components && spellData.components !== '—') {
            metadata += `Componentes: ${spellData.components}\n`;
        }
        if (spellData.duration && spellData.duration !== '—') {
            metadata += `Duracion: ${spellData.duration}\n`;
        }
        if (spellData.damageType && spellData.damageType !== '—') {
            metadata += `Tipo de dano: ${spellData.damageType}\n`;
        }
        if (spellData.school) {
            const schoolSpanish = this.dictionary.getSchoolSpanish(spellData.school);
            if (schoolSpanish) {
                metadata += `Escuela: ${schoolSpanish}\n`;
            }
        }
        if (spellData.ritual) metadata += `Ritual: Si\n`;
        if (spellData.concentration) metadata += `Concentracion: Si\n`;
        
        if (metadata) {
            metadata = metadata.trim() + '\n\n---\n\n';
        }
        
        descTextarea.value = metadata + spellData.description;
        descTextarea.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    console.log(`Conjuro cargado: ${spellData.name} (nivel ${levelValue})`);
}

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}