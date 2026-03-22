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
        this.saveTimeout = null;
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

    // Método interno para guardar con debounce
    _scheduleSaveAndNotify() {
        if (this.saveTimeout) {
            clearTimeout(this.saveTimeout);
        }
        this.saveTimeout = setTimeout(() => {
            this.save();
            this.notify();
            this.eventBus.emit('currencyChanged', this.getData());
        }, 300); // Espera 300ms después del último cambio
    }

    setGold(value) {
        this.gold = Math.max(0, value);
        this._scheduleSaveAndNotify();
    }

    setSilver(value) {
        this.silver = Math.max(0, value);
        this._scheduleSaveAndNotify();
    }

    setCopper(value) {
        this.copper = Math.max(0, value);
        this._scheduleSaveAndNotify();
    }

    addGold(amount) {
        this.gold = Math.max(0, this.gold + amount);
        this._scheduleSaveAndNotify();
    }

    addSilver(amount) {
        this.silver = Math.max(0, this.silver + amount);
        this._scheduleSaveAndNotify();
    }

    addCopper(amount) {
        this.copper = Math.max(0, this.copper + amount);
        this._scheduleSaveAndNotify();
    }

    updateNames(names) {
        if (names.name) this.name = names.name;
        if (names.goldName) this.goldName = names.goldName;
        if (names.silverName) this.silverName = names.silverName;
        if (names.copperName) this.copperName = names.copperName;
        this._scheduleSaveAndNotify();
    }

    reset() {
        this.gold = 0;
        this.silver = 0;
        this.copper = 0;
        this.name = 'Monedas';
        this.goldName = 'Oro';
        this.silverName = 'Plata';
        this.copperName = 'Cobre';
        this._scheduleSaveAndNotify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.getData());
    }

    notify() {
        const data = this.getData();
        this.listeners.forEach(listener => listener(data));
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