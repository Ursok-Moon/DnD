import { Helpers } from '../../utils/Helpers.js';

export class ProficiencyManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.proficiencies = [];
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('proficiencies');
        if (saved && saved.length > 0) {
            this.proficiencies = saved;
        }
        this.sort();
        this.notify();
        this.eventBus.emit('proficienciesChanged', this.proficiencies);
    }

    getAll() {
        return [...this.proficiencies];
    }

    getByType(type) {
        if (type === 'all') return this.getAll();
        return this.proficiencies.filter(p => p.type === type);
    }

    add(name, type) {
        if (!name || !name.trim()) return null;
        
        const proficiency = {
            id: Helpers.generateId(),
            name: name.trim(),
            type: type
        };
        
        this.proficiencies.push(proficiency);
        this.sort();
        this.save();
        this.notify();
        this.eventBus.emit('proficienciesChanged', this.proficiencies);
        return proficiency;
    }

    update(id, updates) {
        const index = this.proficiencies.findIndex(p => p.id === id);
        if (index !== -1) {
            this.proficiencies[index] = { ...this.proficiencies[index], ...updates };
            this.sort();
            this.save();
            this.notify();
            this.eventBus.emit('proficienciesChanged', this.proficiencies);
            return true;
        }
        return false;
    }

    remove(id) {
        const index = this.proficiencies.findIndex(p => p.id === id);
        if (index !== -1) {
            this.proficiencies.splice(index, 1);
            this.sort();
            this.save();
            this.notify();
            this.eventBus.emit('proficienciesChanged', this.proficiencies);
            return true;
        }
        return false;
    }

    sort() {
        const typeOrder = { armor: 1, weapon: 2, tool: 3, language: 4 };
        
        this.proficiencies.sort((a, b) => {
            const orderA = typeOrder[a.type] || 99;
            const orderB = typeOrder[b.type] || 99;
            
            if (orderA === orderB) {
                return a.name.localeCompare(b.name);
            }
            return orderA - orderB;
        });
    }

    getIcon(type) {
        const icons = {
            'armor': 'fa-shield-alt',
            'weapon': 'fa-crosshairs',
            'tool': 'fa-tools',
            'language': 'fa-language'
        };
        return icons[type] || 'fa-tag';
    }

    subscribe(listener) {
        this.listeners.push(listener);
        // Llamar inmediatamente con los datos actuales
        listener(this.getAll());
    }

    notify() {
        const allProficiencies = this.getAll();
        this.listeners.forEach(listener => listener(allProficiencies));
        this.eventBus.emit('proficienciesChanged', this.proficiencies);
    }

    save() {
        this.storage.save('proficiencies', this.proficiencies);
    }
}