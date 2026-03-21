export class DeathSavesManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.successes = [false, false, false];
        this.fails = [false, false, false];
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('deathSaves');
        if (saved) {
            this.successes = saved.successes || [false, false, false];
            this.fails = saved.fails || [false, false, false];
        }
    }

    getData() {
        return {
            successes: [...this.successes],
            fails: [...this.fails],
            successCount: this.successes.filter(Boolean).length,
            failCount: this.fails.filter(Boolean).length
        };
    }

    setSuccess(index, value) {
        if (index >= 0 && index < 3) {
            this.successes[index] = value;
            this.checkStatus();
            this.save();
            this.notify();
            this.eventBus.emit('deathSavesChanged', this.getData());
        }
    }

    setFail(index, value) {
        if (index >= 0 && index < 3) {
            this.fails[index] = value;
            this.checkStatus();
            this.save();
            this.notify();
            this.eventBus.emit('deathSavesChanged', this.getData());
        }
    }

    reset() {
        this.successes = [false, false, false];
        this.fails = [false, false, false];
        this.save();
        this.notify();
        this.eventBus.emit('deathSavesChanged', this.getData());
        this.eventBus.emit('deathSavesReset');
    }

    checkStatus() {
        const successCount = this.successes.filter(Boolean).length;
        const failCount = this.fails.filter(Boolean).length;
        
        if (successCount >= 3) {
            this.eventBus.emit('deathSavesSuccess', '¡Personaje estable!');
        } else if (failCount >= 3) {
            this.eventBus.emit('deathSavesFail', '¡Personaje ha muerto!');
        }
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.getData());
    }

    notify() {
        const data = this.getData();
        this.listeners.forEach(listener => listener(data));
        this.eventBus.emit('deathSavesChanged', data);
    }

    save() {
        this.storage.save('deathSaves', {
            successes: this.successes,
            fails: this.fails
        });
    }
}