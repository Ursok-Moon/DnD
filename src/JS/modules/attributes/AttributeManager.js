import { Helpers } from '../../utils/Helpers.js';
import { DEFAULT_ATTRIBUTES } from '../../utils/Constants.js';

export class AttributeManager {
    constructor(storageService) {
        this.storage = storageService;
        this.attributes = [];
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('attributes');
        if (saved && saved.length > 0) {
            this.attributes = saved;
        } else {
            this.loadDefaults();
        }
    }

    loadDefaults() {
        this.attributes = DEFAULT_ATTRIBUTES.map((attr, index) => ({
            id: index,
            name: attr.name,
            value: attr.value,
            modifier: Helpers.calculateModifier(attr.value)
        }));
        this.save();
    }

    getAll() {
        return [...this.attributes];
    }

    getById(id) {
        return this.attributes.find(a => a.id === id);
    }

    getByName(name) {
        return this.attributes.find(a => a.name.toUpperCase() === name.toUpperCase());
    }

    getModifier(attributeName) {
        const attr = this.getByName(attributeName);
        return attr ? attr.modifier : 0;
    }

    add(name = 'NUEVO', value = 10) {
        const newId = this.attributes.length > 0 
            ? Math.max(...this.attributes.map(a => a.id)) + 1 
            : 0;
        
        const attribute = {
            id: newId,
            name: name,
            value: value,
            modifier: Helpers.calculateModifier(value)
        };
        
        this.attributes.push(attribute);
        this.save();
        this.notify();
        return attribute;
    }

    update(id, updates) {
        const index = this.attributes.findIndex(a => a.id === id);
        if (index !== -1) {
            const oldValue = this.attributes[index].value;
            const newValue = updates.value !== undefined ? updates.value : oldValue;
            
            this.attributes[index] = { ...this.attributes[index], ...updates };
            
            if (updates.value !== undefined && updates.value !== oldValue) {
                this.attributes[index].modifier = Helpers.calculateModifier(updates.value);
            }
            
            this.save();
            this.notify();
            return true;
        }
        return false;
    }

    remove(id) {
        const initialLength = this.attributes.length;
        this.attributes = this.attributes.filter(a => a.id !== id);
        
        if (this.attributes.length !== initialLength) {
            this.save();
            this.notify();
            return true;
        }
        return false;
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.attributes);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.attributes));
    }

    save() {
        this.storage.save('attributes', this.attributes);
    }
}