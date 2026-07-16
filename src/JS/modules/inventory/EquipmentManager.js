import { Helpers } from '../../utils/Helpers.js';

export class EquipmentManager {
    constructor(storageService, eventBus, attributeManager) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.attributeManager = attributeManager;
        this.equipment = [];
        this.listeners = [];
        this.acConfig = {
            base: 10,
            attribute: 'DESTREZA',
            useAttribute: true,
            armorMod: 0,
            totalBonus: 0
        };
        this.load();
        
        // Escuchar cambios en atributos para recalcular CA
        this.eventBus.on('attributeChanged', () => {
            this.recalculateAC();
        });
        
        this.eventBus.on('attributeNameChanged', () => {
            this.recalculateAC();
        });
        
        this.eventBus.on('attributeAdded', () => {
            this.recalculateAC();
        });
        
        this.eventBus.on('attributeRemoved', () => {
            this.recalculateAC();
        });
    }

    load() {
        const saved = this.storage.load('equipment');
        if (saved && saved.length > 0) {
            this.equipment = saved;
        }
        
        // Cargar configuración de CA
        const acConfig = this.storage.load('acConfig');
        if (acConfig) {
            this.acConfig = { ...this.acConfig, ...acConfig };
        }
        
        // Recalcular CA al cargar
        setTimeout(() => {
            this.recalculateAC();
        }, 300);
    }

    // ===== CONFIGURAR ATRIBUTO PARA CA =====
    setACAttribute(attributeName) {
        this.acConfig.attribute = attributeName;
        this.acConfig.useAttribute = true;
        this.saveACConfig();
        this.recalculateAC();
    }

    setACBase(base) {
        this.acConfig.base = Math.max(1, Math.min(30, base));
        this.saveACConfig();
        this.recalculateAC();
    }

    setACUseAttribute(use) {
        this.acConfig.useAttribute = use;
        this.saveACConfig();
        this.recalculateAC();
    }

    setACArmorMod(mod) {
        this.acConfig.armorMod = Math.max(0, mod);
        this.saveACConfig();
        this.recalculateAC();
    }

    saveACConfig() {
        this.storage.save('acConfig', this.acConfig);
    }

    // ===== RECALCULAR CLASE DE ARMADURA =====
    recalculateAC() {
        const base = this.acConfig.base || 10;
        let attrMod = 0;
        let attrName = this.acConfig.attribute || 'DESTREZA';
        let details = [`Base: ${base}`];
        
        // 1. Obtener modificador del atributo seleccionado
        if (this.acConfig.useAttribute) {
            const attr = this.attributeManager.getByName(attrName);
            if (attr) {
                attrMod = attr.modifier || 0;
                details.push(`+${attrMod} (${attr.name})`);
            } else {
                // Si el atributo no existe, intentar con Destreza como fallback
                const fallbackAttr = this.attributeManager.getByName('DESTREZA');
                if (fallbackAttr) {
                    attrMod = fallbackAttr.modifier || 0;
                    attrName = 'DESTREZA';
                    details.push(`+${attrMod} (${fallbackAttr.name} - fallback)`);
                }
            }
        }
        
        // 2. Sumar modificador de armadura
        const armorMod = this.acConfig.armorMod || 0;
        if (armorMod > 0) {
            details.push(`+${armorMod} (armadura)`);
        }
        
        // 3. Sumar bonificadores de equipo
        let bonusTotal = 0;
        this.equipment.forEach(item => {
            if (item.acBonus && item.acBonus > 0) {
                bonusTotal += item.acBonus;
                details.push(`+${item.acBonus} (${item.name})`);
            }
        });
        
        // 4. Calcular CA total
        let totalAC = base + attrMod + armorMod + bonusTotal;
        totalAC = Math.max(1, Math.min(30, totalAC));
        
        // 5. Actualizar input de CA en la UI
        const acInput = document.getElementById('armor-class');
        if (acInput) {
            acInput.value = totalAC;
            acInput.dataset.base = base;
            acInput.dataset.attribute = attrName;
            acInput.dataset.attributeMod = attrMod;
            acInput.dataset.armorMod = armorMod;
            acInput.dataset.bonus = bonusTotal;
            acInput.dataset.useAttribute = this.acConfig.useAttribute;
            
            // Mostrar tooltip con el desglose
            const formulaParts = [`${base}`];
            if (this.acConfig.useAttribute) {
                formulaParts.push(`${attrMod >= 0 ? '+' : ''}${attrMod} (${attrName})`);
            }
            if (armorMod > 0) {
                formulaParts.push(`+${armorMod} (armadura)`);
            }
            if (bonusTotal > 0) {
                formulaParts.push(`+${bonusTotal} (equipo)`);
            }
            
            const formula = formulaParts.join(' + ');
            acInput.title = `CA = ${formula} = ${totalAC}`;
            
            // Guardar detalles como data attribute
            acInput.setAttribute('data-ac-details', JSON.stringify({
                base: base,
                attribute: attrName,
                attributeMod: attrMod,
                armorMod: armorMod,
                bonus: bonusTotal,
                total: totalAC,
                useAttribute: this.acConfig.useAttribute,
                formula: formula
            }));
        }
        
        // 6. Actualizar display de fórmula en la UI
        const formulaDisplay = document.getElementById('acFormulaDisplay');
        if (formulaDisplay) {
            const displayParts = [`${base}`];
            if (this.acConfig.useAttribute && attrMod !== 0) {
                displayParts.push(`${attrMod >= 0 ? '+' : ''}${attrMod} ${attrName}`);
            }
            if (armorMod > 0) {
                displayParts.push(`+${armorMod} armadura`);
            }
            if (bonusTotal > 0) {
                displayParts.push(`+${bonusTotal} equipo`);
            }
            formulaDisplay.textContent = displayParts.join(' ') || 'Sin bonificadores';
        }
        
        // Disparar evento para notificar cambio
        this.eventBus.emit('armorClassChanged', {
            total: totalAC,
            base: base,
            attribute: attrName,
            attributeMod: attrMod,
            armorMod: armorMod,
            bonus: bonusTotal,
            useAttribute: this.acConfig.useAttribute,
            details: details
        });
        
        return totalAC;
    }

    getAll() {
        return [...this.equipment];
    }

    add(name, cost, weight, description, stealth = 'none', attribute = '', bonus = 0) {
        const item = {
            id: Helpers.generateId(),
            name: name,
            cost: cost,
            weight: weight,
            description: description || 'Sin descripción',
            stealth: stealth,
            attribute: attribute,
            bonus: bonus,
            acBonus: 0,
            isArmor: false,
            date: new Date().toISOString()
        };
        
        this.equipment.push(item);
        
        if (attribute && bonus !== 0) {
            this.applyBonus(item, true);
        }
        
        this.save();
        this.notify();
        this.eventBus.emit('equipmentAdded', item);
        return item;
    }

    // ===== AÑADIR ARMADURA =====
    addArmorItem(name, cost, weight, description, acBase = null, acAttribute = null, acModifier = 0, acBonus = 0, stealth = 'none') {
        // Si no se especifica, usar valores de configuración
        const base = acBase !== null ? acBase : this.acConfig.base;
        const attribute = acAttribute !== null ? acAttribute : this.acConfig.attribute;
        
        const item = {
            id: Helpers.generateId(),
            name: name,
            cost: cost,
            weight: weight,
            description: description || 'Sin descripción',
            stealth: stealth,
            attribute: 'CA',
            bonus: 0,
            acBonus: acBonus,
            acBase: base,
            acAttribute: attribute,
            acModifier: acModifier,
            isArmor: true,
            date: new Date().toISOString()
        };
        
        this.equipment.push(item);
        
        // Actualizar configuración de CA con los valores de la armadura
        if (acBase !== null) {
            this.setACBase(acBase);
        }
        if (acAttribute !== null) {
            this.setACAttribute(acAttribute);
        }
        if (acModifier > 0) {
            this.setACArmorMod(acModifier);
        }
        
        this.save();
        this.notify();
        this.eventBus.emit('equipmentAdded', item);
        this.recalculateAC();
        
        return item;
    }

    remove(id) {
        const index = this.equipment.findIndex(e => e.id === id);
        if (index !== -1) {
            const item = this.equipment[index];
            
            // Quitar bonificador si tenía (solo si no es CA)
            if (item.attribute && item.bonus !== 0 && item.attribute !== 'CA') {
                this.applyBonus(item, false);
            }
            
            this.equipment.splice(index, 1);
            this.save();
            this.notify();
            this.eventBus.emit('equipmentRemoved', item);
            
            // Recalcular CA
            this.recalculateAC();
            
            return true;
        }
        return false;
    }

    update(id, updates) {
        const index = this.equipment.findIndex(e => e.id === id);
        if (index !== -1) {
            const oldItem = this.equipment[index];
            
            if (oldItem.attribute && oldItem.bonus !== 0 && oldItem.attribute !== 'CA') {
                this.applyBonus(oldItem, false);
            }
            
            this.equipment[index] = { ...this.equipment[index], ...updates };
            
            if (this.equipment[index].attribute && this.equipment[index].bonus !== 0 && this.equipment[index].attribute !== 'CA') {
                this.applyBonus(this.equipment[index], true);
            }
            
            this.save();
            this.notify();
            this.eventBus.emit('equipmentUpdated', this.equipment[index]);
            
            // Recalcular CA
            this.recalculateAC();
            
            return true;
        }
        return false;
    }

    applyBonus(item, apply) {
        if (!item.attribute || item.bonus === 0 || item.attribute === 'CA') return;
        
        const attributes = this.attributeManager.getAll();
        const attrIndex = attributes.findIndex(a => 
            a.name.toUpperCase() === item.attribute.toUpperCase()
        );
        
        if (attrIndex !== -1) {
            const currentValue = attributes[attrIndex].value;
            const newValue = apply ? currentValue + item.bonus : currentValue - item.bonus;
            
            this.attributeManager.update(attributes[attrIndex].id, { value: newValue });
        }
    }

    getTotalWeight() {
        return this.equipment.reduce((sum, e) => sum + e.weight, 0);
    }

    getTotalCost() {
        return this.equipment.reduce((sum, e) => sum + e.cost, 0);
    }

    getByStealthEffect(effect) {
        return this.equipment.filter(e => e.stealth === effect);
    }

    hasStealthDisadvantage() {
        return this.equipment.some(e => e.stealth === 'disadvantage');
    }

    hasStealthAdvantage() {
        return this.equipment.some(e => e.stealth === 'advantage');
    }

    getACBonus() {
        return this.equipment.reduce((sum, e) => sum + (e.acBonus || 0), 0);
    }

    getEquippedArmor() {
        return this.equipment.filter(e => e.isArmor || e.attribute === 'CA');
    }

    getACConfig() {
        return { ...this.acConfig };
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.equipment);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.equipment));
        this.eventBus.emit('equipmentChanged', this.equipment);
    }

    save() {
        this.storage.save('equipment', this.equipment);
    }
}