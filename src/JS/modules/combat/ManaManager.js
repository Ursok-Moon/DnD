export class ManaManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.current = 2;
        this.max = 15;
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('mana');
        if (saved) {
            this.current = saved.current || 2;
            this.max = saved.max || 15;
        }
    }

    getData() {
        return {
            current: this.current,
            max: this.max,
            percentage: this.getPercentage()
        };
    }

setCurrent(value) {
    this.current = Math.max(0, Math.min(this.max, value));
    this.save();
    this.notify();
    this.eventBus.emit('manaChanged', this.getData());
}

setMax(value) {
    this.max = Math.max(1, value);
    this.current = Math.min(this.current, this.max);
    this.save();
    this.notify();
    this.eventBus.emit('manaChanged', this.getData());
}

modify(amount) {
    this.current = Math.max(0, Math.min(this.max, this.current + amount));
    this.save();
    this.notify();
    this.eventBus.emit('manaChanged', this.getData());
}

    getPercentage() {
        return (this.current / this.max) * 100;
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.getData());
    }

    notify() {
        const data = this.getData();
        this.listeners.forEach(listener => listener(data));
        this.eventBus.emit('manaChanged', data);
    }

    save() {
        this.storage.save('mana', {
            current: this.current,
            max: this.max
        });
    }
}