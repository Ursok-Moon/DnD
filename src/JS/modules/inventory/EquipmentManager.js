import { Helpers } from '../../utils/Helpers.js';

export class EquipmentManager {
    constructor(storageService, eventBus, attributeManager) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.attributeManager = attributeManager;
        this.equipment = [];
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('equipment');
        if (saved && saved.length > 0) {
            this.equipment = saved;
            // Reaplicar bonificadores al cargar
            setTimeout(() => {
                this.equipment.forEach(item => {
                    if (item.attribute && item.bonus !== 0) {
                        this.applyBonus(item, true);
                    }
                });
            }, 500);
        }
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

    remove(id) {
        const index = this.equipment.findIndex(e => e.id === id);
        if (index !== -1) {
            const item = this.equipment[index];
            
            // Quitar bonificador si tenía
            if (item.attribute && item.bonus !== 0) {
                this.applyBonus(item, false);
            }
            
            this.equipment.splice(index, 1);
            this.save();
            this.notify();
            this.eventBus.emit('equipmentRemoved', item);
            return true;
        }
        return false;
    }

    update(id, updates) {
        const index = this.equipment.findIndex(e => e.id === id);
        if (index !== -1) {
            const oldItem = this.equipment[index];
            
            // Si cambió el bonificador, ajustar
            if (oldItem.attribute && oldItem.bonus !== 0) {
                this.applyBonus(oldItem, false);
            }
            
            this.equipment[index] = { ...this.equipment[index], ...updates };
            
            // Aplicar nuevo bonificador
            if (this.equipment[index].attribute && this.equipment[index].bonus !== 0) {
                this.applyBonus(this.equipment[index], true);
            }
            
            this.save();
            this.notify();
            this.eventBus.emit('equipmentUpdated', this.equipment[index]);
            return true;
        }
        return false;
    }

    applyBonus(item, apply) {
        if (!item.attribute || item.bonus === 0) return;
        
        const attributes = this.attributeManager.getAll();
        const attrIndex = attributes.findIndex(a => 
            a.name.toUpperCase() === item.attribute.toUpperCase()
        );
        
        if (attrIndex !== -1) {
            const currentValue = attributes[attrIndex].value;
            const newValue = apply ? currentValue + item.bonus : currentValue - item.bonus;
            
            this.attributeManager.update(attributes[attrIndex].id, { value: newValue });
            
            Helpers.showMessage(
                `${apply ? 'Equipado' : 'Desequipado'}: ${item.bonus > 0 ? '+' : ''}${item.bonus} a ${item.attribute}`,
                'info'
            );
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