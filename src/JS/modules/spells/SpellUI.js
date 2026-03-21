export class SpellUI {
    constructor(spellManager, spellSlotsManager, eventBus) {
        this.spellManager = spellManager;
        this.spellSlotsManager = spellSlotsManager;
        this.eventBus = eventBus;
        
        // Buscar contenedores
        this.container = document.getElementById('spellsList');
        this.slotsGrid = document.getElementById('slotsGrid');
        
        console.log('🔍 SpellUI - slotsGrid:', this.slotsGrid);
        
        if (!this.slotsGrid) {
            console.error('❌ CRÍTICO: No se encontró el elemento #slotsGrid');
            return;
        }
        
        // Crear la estructura de slots
        this.createSlotsStructure();
        
        // Suscribirse a eventos específicos
        this.spellManager.subscribe((spells) => {
            // Solo para carga inicial o cambios masivos
            this.renderSpells(spells);
        });
        
        // Eventos específicos para actualizaciones parciales
        this.eventBus.on('spellUpdated', (data) => {
            this.updateSpellField(data.id, data.updates);
        });
        
        this.eventBus.on('spellAdded', (spell) => {
            this.addSpellToDOM(spell);
        });
        
        this.eventBus.on('spellRemoved', (spell) => {
            this.removeSpellFromDOM(spell.id);
        });
        
        this.eventBus.on('spellPreparedChanged', (spell) => {
            this.updateSpellPrepared(spell.id, spell.prepared);
        });
        
        this.spellSlotsManager.subscribe((slots) => {
            console.log('💎 Slots actualizados:', slots);
            this.renderSpellSlots(slots);
        });
        
        this.setupAddButton();
        this.setupConfigButton();
        
        // Render inicial
        const initialSlots = this.spellSlotsManager.getData();
        console.log('🎯 Render inicial con slots:', initialSlots);
        this.renderSpellSlots(initialSlots);
    }

    // Crear la estructura de slots
    createSlotsStructure() {
        if (!this.slotsGrid) return;
        
        this.slotsGrid.innerHTML = `
            <div class="slots-gems-container">
                <div class="slots-config" style="display: none;">
                    <!-- Esto se mantiene oculto porque usamos modal -->
                </div>
                <div class="slots-gems" id="slotsGems">
                    <!-- Las gemas se generarán aquí -->
                </div>
            </div>
        `;
        
        this.slotsContainer = document.getElementById('slotsGems');
        console.log('✨ slotsContainer creado:', this.slotsContainer);
    }

    setupAddButton() {
        const addBtn = document.getElementById('addSpellBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.spellManager.add();
            });
        }
    }

    setupConfigButton() {
        const configBtn = document.getElementById('configSlotsBtn');
        if (configBtn) {
            configBtn.addEventListener('click', () => {
                this.showSlotsConfigModal();
            });
        }
    }

    showSlotsConfigModal() {
        const modal = document.getElementById('configModal');
        const modalBody = document.getElementById('modalBody');
        const slots = this.spellSlotsManager.getData();
        
        if (!modal || !modalBody) return;
        
        modalBody.innerHTML = `
            <h4><i class="fas fa-gem"></i> Configurar Slots de Conjuros</h4>
            <div class="form-row">
                <label>Nivel de Conjuros</label>
                <input type="number" id="modalSpellLevel" value="${slots.level}" min="1" max="9">
            </div>
            <div class="form-row">
                <label>Total de Slots</label>
                <input type="number" id="modalTotalSlots" value="${slots.total}" min="0" max="20">
            </div>
            <div class="form-row">
                <label>Slots Usados</label>
                <input type="number" id="modalUsedSlots" value="${slots.used}" min="0" max="${slots.total}">
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
        
        const saveBtn = document.getElementById('saveSlotsConfigBtn');
        const cancelBtn = document.getElementById('cancelSlotsConfigBtn');
        
        const handleSave = () => {
            const level = parseInt(document.getElementById('modalSpellLevel').value) || 1;
            const total = parseInt(document.getElementById('modalTotalSlots').value) || 4;
            const used = parseInt(document.getElementById('modalUsedSlots').value) || 0;
            
            this.spellSlotsManager.setLevel(level);
            this.spellSlotsManager.setTotal(total);
            this.spellSlotsManager.setUsed(Math.min(used, total));
            
            modal.style.display = 'none';
            
            saveBtn.removeEventListener('click', handleSave);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        
        const handleCancel = () => {
            modal.style.display = 'none';
            saveBtn.removeEventListener('click', handleSave);
            cancelBtn.removeEventListener('click', handleCancel);
        };
        
        saveBtn.addEventListener('click', handleSave);
        cancelBtn.addEventListener('click', handleCancel);
        
        modal.addEventListener('click', function modalClick(e) {
            if (e.target === modal) {
                modal.style.display = 'none';
                saveBtn.removeEventListener('click', handleSave);
                cancelBtn.removeEventListener('click', handleCancel);
                modal.removeEventListener('click', modalClick);
            }
        });
    }

    // NUEVO: Actualizar solo un campo específico sin reconstruir todo
    updateSpellField(spellId, updates) {
        const spellItem = this.container?.querySelector(`[data-id="${spellId}"]`);
        if (!spellItem) return;
        
        if (updates.name !== undefined) {
            const nameInput = spellItem.querySelector('.spell-name');
            if (nameInput && nameInput.value !== updates.name) {
                nameInput.value = updates.name;
            }
        }
        
        if (updates.level !== undefined) {
            const levelInput = spellItem.querySelector('.spell-level-input');
            if (levelInput && levelInput.value !== updates.level) {
                levelInput.value = updates.level;
            }
        }
        
        if (updates.description !== undefined) {
            const descTextarea = spellItem.querySelector('.spell-desc');
            if (descTextarea && descTextarea.value !== updates.description) {
                descTextarea.value = updates.description;
            }
        }
    }

    // NUEVO: Actualizar solo el estado de preparado
    updateSpellPrepared(spellId, prepared) {
        const spellItem = this.container?.querySelector(`[data-id="${spellId}"]`);
        if (!spellItem) return;
        
        const preparedSpan = spellItem.querySelector('.spell-prepared');
        if (preparedSpan) {
            preparedSpan.className = `spell-prepared ${prepared ? 'prepared' : ''}`;
            const icon = preparedSpan.querySelector('i');
            if (icon) {
                icon.className = `fas ${prepared ? 'fa-check-circle' : 'fa-circle'}`;
            }
            preparedSpan.title = prepared ? 'Preparado' : 'No preparado';
        }
    }

    // NUEVO: Añadir un conjuro al DOM sin reconstruir todo
    addSpellToDOM(spell) {
        if (!this.container) return;
        
        // Si no hay conjuros, eliminar el mensaje de "no hay conjuros"
        if (this.container.children.length === 1 && this.container.children[0].tagName === 'P') {
            this.container.innerHTML = '';
        }
        
        const item = this.createSpellElement(spell);
        this.container.appendChild(item);
    }

    // NUEVO: Eliminar un conjuro del DOM sin reconstruir todo
    removeSpellFromDOM(spellId) {
        const spellItem = this.container?.querySelector(`[data-id="${spellId}"]`);
        if (spellItem) {
            spellItem.remove();
        }
        
        // Si no quedan conjuros, mostrar mensaje
        if (this.container && this.container.children.length === 0) {
            this.container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center; padding: 20px;">No hay conjuros. Haz clic en "Añadir conjuro" para crear uno.</p>';
        }
    }

    // NUEVO: Crear elemento sin añadirlo al DOM (para reutilizar)
    createSpellElement(spell) {
        const item = document.createElement('div');
        item.className = 'spell-item';
        item.dataset.id = spell.id;
        
        const preparedClass = spell.prepared ? 'prepared' : '';
        
        item.innerHTML = `
            <div class="spell-header">
                <span class="spell-prepared ${preparedClass}" title="${spell.prepared ? 'Preparado' : 'No preparado'}">
                    <i class="fas ${spell.prepared ? 'fa-check-circle' : 'fa-circle'}"></i>
                </span>
                <input type="text" class="spell-name" value="${this.escapeHtml(spell.name)}" placeholder="Conjuro">
                <input type="text" class="spell-level-input" value="${this.escapeHtml(spell.level)}" placeholder="Nivel">
                <button type="button" class="btn-remove-spell" title="Eliminar">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <textarea class="spell-desc" rows="2" placeholder="Descripción...">${this.escapeHtml(spell.description)}</textarea>
        `;
        
        this.attachSpellEvents(item, spell);
        return item;
    }

    // NUEVO: Escapar HTML para evitar inyección
    escapeHtml(text) {
        if (!text) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // NUEVO: Adjuntar eventos con debounce para no saturar
    attachSpellEvents(item, spell) {
        const preparedIcon = item.querySelector('.spell-prepared');
        const nameInput = item.querySelector('.spell-name');
        const levelInput = item.querySelector('.spell-level-input');
        const descTextarea = item.querySelector('.spell-desc');
        const removeBtn = item.querySelector('.btn-remove-spell');
        
        const spellId = spell.id;
        const self = this;
        
        // Evento para preparado
        preparedIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            self.spellManager.togglePrepared(spellId);
        });
        
        // Evento para nombre
        let nameTimeout;
        nameInput.addEventListener('input', function() {
            clearTimeout(nameTimeout);
            nameTimeout = setTimeout(() => {
                self.spellManager.update(spellId, { name: this.value });
            }, 3000);
        });
        
        // Evento para nivel 
        let levelTimeout;
        levelInput.addEventListener('input', function() {
            clearTimeout(levelTimeout);
            levelTimeout = setTimeout(() => {
                self.spellManager.update(spellId, { level: this.value });
            }, 3000);
        });
        
        // Evento para descripción 
        let descTimeout;
        descTextarea.addEventListener('input', function() {
            clearTimeout(descTimeout);
            descTimeout = setTimeout(() => {
                self.spellManager.update(spellId, { description: this.value });
            }, 3000);
        });
        
        // Evento para eliminar
        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            if (confirm('¿Eliminar este conjuro?')) {
                self.spellManager.remove(spellId);
            }
        });
    }

    // MODIFICADO: Renderizar todos los conjuros (solo para carga inicial)
    renderSpells(spells) {
        if (!this.container) return;
        
        this.container.innerHTML = '';
        
        if (spells.length === 0) {
            this.container.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center; padding: 20px;">No hay conjuros. Haz clic en "Añadir conjuro" para crear uno.</p>';
            return;
        }
        
        spells.forEach(spell => {
            const item = this.createSpellElement(spell);
            this.container.appendChild(item);
        });
    }

    renderSpellSlots(slots) {
        if (!this.slotsContainer) {
            console.error('slotsContainer no disponible');
            return;
        }
        
        this.slotsContainer.innerHTML = '';
        
        if (slots.total === 0) {
            this.slotsContainer.innerHTML = '<p style="color: var(--ink-light); font-style: italic; text-align: center;">Sin slots configurados</p>';
            return;
        }

        for (let i = 0; i < slots.total; i++) {
            const gemSlot = document.createElement('div');
            gemSlot.className = `gem-slot ${i < slots.used ? 'used' : ''}`;
            gemSlot.dataset.index = i;
            gemSlot.dataset.level = slots.level;
            
            gemSlot.innerHTML = `
                <div class="gem-shape">
                    ${i + 1}
                </div>
                <div class="gem-level">Niv. ${slots.level}</div>
            `;
            
            gemSlot.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(gemSlot.dataset.index);
                const isUsed = gemSlot.classList.contains('used');
                const currentSlots = this.spellSlotsManager.getData();
                
                if (isUsed) {
                    gemSlot.classList.remove('used');
                    this.spellSlotsManager.setUsed(currentSlots.used - 1);
                } else {
                    if (currentSlots.used < currentSlots.total) {
                        gemSlot.classList.add('used');
                        this.spellSlotsManager.setUsed(currentSlots.used + 1);
                    }
                }
            });
            
            this.slotsContainer.appendChild(gemSlot);
        }
    }
}