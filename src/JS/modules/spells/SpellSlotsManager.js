export class SpellSlotsManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.slots = {
            level: 1,
            total: 4,
            used: 0
        };
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('spellSlots');
        if (saved) {
            this.slots = saved;
        }
    }

    getData() {
        return { ...this.slots };
    }

    setLevel(level) {
        this.slots.level = Math.max(1, Math.min(9, level));
        this.save();
        this.notify();
        this.eventBus.emit('spellSlotsChanged', this.slots);
    }

    setTotal(total) {
        this.slots.total = Math.max(0, Math.min(20, total));
        this.slots.used = Math.min(this.slots.used, this.slots.total);
        this.save();
        this.notify();
        this.eventBus.emit('spellSlotsChanged', this.slots)
    }

    setUsed(used) {
        this.slots.used = Math.max(0, Math.min(this.slots.total, used));
        this.save();
        this.notify();
        this.eventBus.emit('spellSlotsChanged', this.slots)
    }

    toggleSlot(index) {
        if (index >= 0 && index < this.slots.total) {
            if (index < this.slots.used) {
                // Si está usado, desusarlo
                this.slots.used--;
            } else {
                // Si no está usado y hay espacio, usarlo
                if (this.slots.used < this.slots.total) {
                    this.slots.used++;
                }
            }
            this.save();
            this.notify();
            this.eventBus.emit('spellSlotsChanged', this.slots);
        }
    }

    reset() {
        this.slots.used = 0;
        this.save();
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.slots);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.slots));
        this.eventBus.emit('spellSlotsChanged', this.slots);
    }

    save() {
        this.storage.save('spellSlots', this.slots);
    }
}