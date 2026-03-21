export class HealthManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.current = 26;
        this.max = 26;
        this.temp = 0;
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('hp');
        if (saved) {
            this.current = saved.current || 26;
            this.max = saved.max || 26;
            this.temp = saved.temp || 0;
        }
    }

    getData() {
        return {
            current: this.current,
            max: this.max,
            temp: this.temp,
            percentage: this.getPercentage()
        };
    }

    setCurrent(value) {
    this.current = Math.max(0, Math.min(this.max, value));
    this.save();
    this.notify();
    this.eventBus.emit('healthChanged', this.getData()); // ¡NUEVO!
    }

    setMax(value) {
    this.max = Math.max(1, value);
    this.current = Math.min(this.current, this.max);
    this.save();
    this.notify();
    this.eventBus.emit('healthChanged', this.getData()); // ¡NUEVO!
    }   

    setTemp(value) {
        this.temp = Math.max(0, value);
        this.save();
        this.notify();
    }

    modify(amount) {
        if (amount < 0) { // Daño
            let remainingDamage = Math.abs(amount);
            
            if (this.temp > 0) {
                const tempDamage = Math.min(this.temp, remainingDamage);
                this.temp -= tempDamage;
                remainingDamage -= tempDamage;
            }
            
            if (remainingDamage > 0) {
                this.current = Math.max(0, this.current - remainingDamage);
            }
        } else { // Curación
            this.current = Math.min(this.max, this.current + amount);
        }
        
        this.save();
        this.notify();
        this.eventBus.emit('healthChanged', this.getData());
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
        this.eventBus.emit('hpChanged', data);
    }

    save() {
        this.storage.save('hp', {
            current: this.current,
            max: this.max,
            temp: this.temp
        });
    }
}