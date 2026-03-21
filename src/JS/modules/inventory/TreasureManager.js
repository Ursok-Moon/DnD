import { Helpers } from '../../utils/Helpers.js';

export class TreasureManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.treasures = [];
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('treasures');
        if (saved && saved.length > 0) {
            this.treasures = saved;
        }
    }

    getAll() {
        return [...this.treasures];
    }

    add(name, value, type = 'other') {
        const treasure = {
            id: Helpers.generateId(),
            name: name,
            value: value,
            type: type,
            date: new Date().toISOString()
        };
        
        this.treasures.push(treasure);
        this.save();
        this.notify();
        this.eventBus.emit('treasuresChanged', this.treasures);
        return treasure;
    }

    remove(id) {
        const index = this.treasures.findIndex(t => t.id === id);
        if (index !== -1) {
            const removed = this.treasures[index];
            this.treasures.splice(index, 1);
            this.save();
            this.notify();
            this.eventBus.emit('treasuresChanged', this.treasures);
            return true;
        }
        return false;
    }

    update(id, updates) {
        const index = this.treasures.findIndex(t => t.id === id);
        if (index !== -1) {
            this.treasures[index] = { ...this.treasures[index], ...updates };
            this.save();
            this.notify();
            this.eventBus.emit('treasuresChanged', this.treasures);
            return true;
        }
        return false;
    }

    getTotalValue() {
        return this.treasures.reduce((sum, t) => sum + t.value, 0);
    }

    getByType(type) {
        return this.treasures.filter(t => t.type === type);
    }

    sortByValue(descending = true) {
        return [...this.treasures].sort((a, b) => 
            descending ? b.value - a.value : a.value - b.value
        );
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.treasures);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.treasures));
        this.eventBus.emit('treasuresChanged', this.treasures);
    }

    save() {
        this.storage.save('treasures', this.treasures);
    }
}