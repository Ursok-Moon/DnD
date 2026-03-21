import { Helpers } from '../../utils/Helpers.js';

export class SpellManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.spells = [];
        this.listeners = [];
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
            // Enviar evento con el ID y los updates específicos
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
}