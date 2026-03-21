import { Helpers } from '../../utils/Helpers.js';

export class PotionManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.potions = [];
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('potions');
        if (saved && saved.length > 0) {
            this.potions = saved;
        }
    }

    getAll() {
        return [...this.potions];
    }

    add(name, type, value, amount) {
        const potion = {
            id: Helpers.generateId(),
            name: name,
            type: type, // 'life' o 'mana'
            value: value,
            amount: amount,
            date: new Date().toISOString()
        };
        
        this.potions.push(potion);
        this.save();
        this.notify();
        this.eventBus.emit('potionsChanged', this.potions);
        return potion;
    }

    remove(id) {
        const index = this.potions.findIndex(p => p.id === id);
        if (index !== -1) {
            const removed = this.potions[index];
            this.potions.splice(index, 1);
            this.save();
            this.notify();
            this.eventBus.emit('potionsChanged', this.potions);
            return true;
        }
        return false;
    }

    consume(id, healthManager, manaManager) {
        const potion = this.potions.find(p => p.id === id);
        if (!potion) return false;
        
        if (potion.type === 'life') {
            healthManager.modify(potion.amount);
            Helpers.showMessage(`Has recuperado ${potion.amount} puntos de vida`, 'info');
        } else {
            manaManager.modify(potion.amount);
            Helpers.showMessage(`Has recuperado ${potion.amount} puntos de maná`, 'info');
        }
        
        this.remove(id);
        this.eventBus.emit('potionConsumed', potion);
        return true;
    }

    getByType(type) {
        return this.potions.filter(p => p.type === type);
    }

    getTotalValue() {
        return this.potions.reduce((sum, p) => sum + p.value, 0);
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.potions);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.potions));
        this.eventBus.emit('potionsChanged', this.potions);
    }

    save() {
        this.storage.save('potions', this.potions);
    }
}