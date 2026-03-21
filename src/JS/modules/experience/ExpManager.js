// js/modules/experience/ExpManager.js
import { EXP_TABLE_DND5E, PROFICIENCY_BONUS } from '../../utils/Constants.js';
import { Helpers } from '../../utils/Helpers.js';

export class ExpManager {
    constructor(storageService, eventBus) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.current = 0;
        this.max = 300;
        this.level = 1;
        this.system = 'custom'; // custom, dnd5e, pathfinder
        this.listeners = [];
        this.load();
    }

    load() {
        const saved = this.storage.load('exp');
        if (saved) {
            this.current = saved.current || 0;
            this.max = saved.max || 300;
            this.level = saved.level || 1;
            this.system = saved.system || 'custom';
        }
        
        // Cargar sistema guardado
        const savedSystem = localStorage.getItem('expSystem');
        if (savedSystem) {
            this.system = savedSystem;
        }
    }

    getData() {
        return {
            current: this.current,
            max: this.max,
            level: this.level,
            percentage: this.getPercentage(),
            proficiencyBonus: this.getProficiencyBonus()
        };
    }

    setCurrent(value) {
        this.current = Math.max(0, value);
        this.checkLevelUp();
        this.save();
        this.notify();
    }

    setMax(value) {
        this.max = Math.max(1, value);
        this.save();
        this.notify();
    }

    setLevel(value) {
    if (value >= 1 && value <= 20) {
        console.log(`📊 Nivel cambiado a ${value} (setLevel)`);
        this.level = value;
        this.updateRequiredExp();
        this.save();
        this.notify();
        this.eventBus.emit('levelChanged', this.level);
    }
}

    addExp(amount) {
        this.current += amount;
        this.checkLevelUp();
        this.save();
        this.notify();
    }

    changeLevel(delta) {
    const newLevel = this.level + delta;
    if (newLevel >= 1 && newLevel <= 20) {
        console.log(`📊 Cambiando nivel de ${this.level} a ${newLevel}`);
        this.level = newLevel;
        this.updateRequiredExp();
        this.save();
        this.notify();
        console.log('📢 Emitiendo levelChanged');
        this.eventBus.emit('levelChanged', this.level);
    }
}

    checkLevelUp() {
        if (this.system === 'custom') {
            while (this.current >= this.max && this.level < 20) {
                this.current -= this.max;
                this.level++;
                this.max = this.max * 2; // Sistema personalizado
                this.eventBus.emit('levelUp', this.level);
            }
        } else if (this.system === 'dnd5e') {
            // Para D&D 5e, verificamos según la tabla
            while (this.level < 20 && this.current >= (EXP_TABLE_DND5E[this.level + 1] || Infinity)) {
                this.level++;
                this.max = EXP_TABLE_DND5E[this.level + 1] || this.max;
                this.eventBus.emit('levelUp', this.level);
            }
        }
    }

    updateRequiredExp() {
        if (this.system === 'dnd5e') {
            this.max = EXP_TABLE_DND5E[this.level + 1] || EXP_TABLE_DND5E[20];
        } else if (this.system === 'pathfinder') {
            this.max = this.level * 1000;
        }
        // Sistema custom: no cambiamos el max automáticamente
    }

    getPercentage() {
        return (this.current / this.max) * 100;
    }

    getProficiencyBonus() {
        return PROFICIENCY_BONUS[this.level - 1] || 2;
    }

    setSystem(system) {
        this.system = system;
        this.updateRequiredExp();
        localStorage.setItem('expSystem', system);
        this.save();
        this.notify();
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.getData());
    }

    notify() {
        const data = this.getData();
        this.listeners.forEach(listener => listener(data));
        this.eventBus.emit('expChanged', data);
    }

    save() {
        this.storage.save('exp', {
            current: this.current,
            max: this.max,
            level: this.level,
            system: this.system
        });
    }
}