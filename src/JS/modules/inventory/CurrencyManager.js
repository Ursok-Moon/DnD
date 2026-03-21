export class CurrencyManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.gold = 0;
        this.silver = 0;
        this.copper = 0;
        this.name = 'Monedas';
        this.goldName = 'Oro';
        this.silverName = 'Plata';
        this.copperName = 'Cobre';
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('currency');
        if (saved) {
            this.gold = saved.gold || 0;
            this.silver = saved.silver || 0;
            this.copper = saved.copper || 0;
            this.name = saved.name || 'Monedas';
            this.goldName = saved.goldName || 'Oro';
            this.silverName = saved.silverName || 'Plata';
            this.copperName = saved.copperName || 'Cobre';
        }
    }

    getData() {
        return {
            gold: this.gold,
            silver: this.silver,
            copper: this.copper,
            name: this.name,
            goldName: this.goldName,
            silverName: this.silverName,
            copperName: this.copperName,
            total: this.getTotalValue()
        };
    }

    getTotalValue() {
        return this.gold * 100 + this.silver * 10 + this.copper;
    }

    setGold(value) {
        this.gold = Math.max(0, value);
        this.save();
        this.notify();
        this.eventBus.emit('currencyChanged', this.getData());
    }

    setSilver(value) {
        this.silver = Math.max(0, value);
        this.save();
        this.notify();
        this.eventBus.emit('currencyChanged', this.getData());
    }

    setCopper(value) {
        this.copper = Math.max(0, value);
        this.save();
        this.notify();
        this.eventBus.emit('currencyChanged', this.getData());
    }

    addGold(amount) {
        this.gold = Math.max(0, this.gold + amount);
        this.save();
        this.notify();
        this.eventBus.emit('currencyChanged', this.getData());
    }

    addSilver(amount) {
        this.silver = Math.max(0, this.silver + amount);
        this.save();
        this.notify();
        this.eventBus.emit('currencyChanged', this.getData());
    }

    addCopper(amount) {
        this.copper = Math.max(0, this.copper + amount);
        this.save();
        this.notify();
        this.eventBus.emit('currencyChanged', this.getData());
    }

    updateNames(names) {
        if (names.name) this.name = names.name;
        if (names.goldName) this.goldName = names.goldName;
        if (names.silverName) this.silverName = names.silverName;
        if (names.copperName) this.copperName = names.copperName;
        this.save();
        this.notify();
        this.eventBus.emit('currencyChanged', this.getData());
    }

    reset() {
        this.gold = 0;
        this.silver = 0;
        this.copper = 0;
        this.name = 'Monedas';
        this.goldName = 'Oro';
        this.silverName = 'Plata';
        this.copperName = 'Cobre';
        this.save();
        this.notify();
        this.eventBus.emit('currencyChanged', this.getData());
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.getData());
    }

    notify() {
        const data = this.getData();
        this.listeners.forEach(listener => listener(data));
        this.eventBus.emit('currencyChanged', data);
    }

    save() {
        this.storage.save('currency', {
            gold: this.gold,
            silver: this.silver,
            copper: this.copper,
            name: this.name,
            goldName: this.goldName,
            silverName: this.silverName,
            copperName: this.copperName
        });
    }
}