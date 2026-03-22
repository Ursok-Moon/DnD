export class SpellStatsManager {
    constructor(storageService, eventBus, attributeManager, expManager) {
        this.storage = storageService;
        this.eventBus = eventBus;
        this.attributeManager = attributeManager;
        this.expManager = expManager;
        
        this.spellStats = {
            spellcastingAbility: 'Sabiduría',
            spellSaveDC: 10,
            spellAttackBonus: 0,
            preparedSpells: 0,
            cantripsKnown: 0,
            maxPreparedSpells: 0
        };
        
        this.listeners = [];
        this.load();
        this.calculateStats();
    }
    
    load() {
        const saved = this.storage.load('spellStats');
        if (saved) {
            this.spellStats = { ...this.spellStats, ...saved };
        }
        this.calculateStats();
    }
    
    getData() {
        return { ...this.spellStats };
    }
    
    calculateStats() {
        // Obtener el modificador del atributo mágico
        let abilityMod = 0;
        const abilityName = this.spellStats.spellcastingAbility;
        const attribute = this.attributeManager.getByName(abilityName);
        
        if (attribute) {
            abilityMod = attribute.modifier;
        }
        
        // Bonificación de competencia
        const proficiencyBonus = this.expManager?.getProficiencyBonus() || 2;
        
        // Calcular CD de Salvación: 8 + mod. atributo + bonif. competencia
        this.spellStats.spellSaveDC = 8 + abilityMod + proficiencyBonus;
        
        // Calcular Bonificación de Ataque: mod. atributo + bonif. competencia
        this.spellStats.spellAttackBonus = abilityMod + proficiencyBonus;
        
        // Calcular conjuros preparados máximos (opcional, basado en nivel + mod atributo)
        const level = this.expManager?.getData().level || 1;
        this.spellStats.maxPreparedSpells = Math.max(1, level + abilityMod);
        
        // Asegurar que preparados no exceda el máximo
        if (this.spellStats.preparedSpells > this.spellStats.maxPreparedSpells) {
            this.spellStats.preparedSpells = this.spellStats.maxPreparedSpells;
        }
        
        this.save();
        this.notify();
        
        return this.spellStats;
    }
    
    setSpellcastingAbility(ability) {
        this.spellStats.spellcastingAbility = ability;
        this.calculateStats();
        this.eventBus.emit('spellStatsChanged', this.getData());
    }
    
    setPreparedSpells(value) {
        this.spellStats.preparedSpells = Math.max(0, Math.min(this.spellStats.maxPreparedSpells, value));
        this.save();
        this.notify();
        this.eventBus.emit('spellStatsChanged', this.getData());
    }
    
    setCantripsKnown(value) {
        this.spellStats.cantripsKnown = Math.max(0, value);
        this.save();
        this.notify();
        this.eventBus.emit('spellStatsChanged', this.getData());
    }
    
    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.getData());
    }
    
    notify() {
        const data = this.getData();
        this.listeners.forEach(listener => listener(data));
        this.eventBus.emit('spellStatsChanged', data);
    }
    
    save() {
        this.storage.save('spellStats', this.spellStats);
    }
}