export class SavingThrowsManager {
    constructor(storageService, attributeManager, eventBus, expManager) {
        this.storage = storageService;
        this.attributeManager = attributeManager;
        this.eventBus = eventBus;
        this.expManager = expManager;
        this.savingThrows = [];
        this.listeners = [];

        // Escuchar cambios de nivel
        this.eventBus.on('levelChanged', (level) => {
            console.log('📊 SavingThrows: levelChanged recibido, nivel:', level);
            this.updateAllValues();
        });
        
        // Escuchar cambios en atributos
        this.eventBus.on('attributeChanged', (data) => {
            console.log('📊 SavingThrows: attributeChanged recibido:', data);
            this.updateFromAttributes();
        });
        
        // Escuchar cambios en nombres de atributos
        this.eventBus.on('attributeNameChanged', (data) => {
            console.log('📊 SavingThrows: attributeNameChanged recibido:', data);
            this.updateFromAttributes();
        });
        
        this.load();
    }

    load() {
        const saved = this.storage.load('savingThrows');
        console.log('📊 SavingThrows: cargando datos guardados:', saved?.length || 0);
        
        if (saved && saved.length > 0) {
            this.savingThrows = saved;
        } else {
            this.updateFromAttributes();
        }
        
        // Asegurar que los valores se recalcular después de cargar
        this.updateAllValues();
    }

    updateFromAttributes() {
        const attributes = this.attributeManager.getAll();
        console.log('📊 SavingThrows: actualizando desde atributos, cantidad:', attributes.length);
        
        const newSavingThrows = [];
        
        attributes.forEach(attr => {
            // Buscar si ya existe una salvación para este atributo
            const existing = this.savingThrows.find(st => 
                st.basedOn && st.basedOn.toUpperCase() === attr.name.toUpperCase()
            );
            
            newSavingThrows.push({
                name: attr.name,
                value: existing ? existing.value : 0,
                proficient: existing ? existing.proficient : false,
                basedOn: attr.name,
                modifier: attr.modifier
            });
        });
        
        this.savingThrows = newSavingThrows;
        console.log('📊 SavingThrows: nuevas salvaciones generadas:', this.savingThrows.length);
        
        // Actualizar valores y emitir eventos
        this.updateAllValues();
    }

    updateAllValues() {
        const proficiencyBonus = this.getProficiencyBonus();
        
        console.log('📊 SavingThrows: actualizando valores, proficiency bonus:', proficiencyBonus);
        
        this.savingThrows.forEach(st => {
            const attr = this.attributeManager.getByName(st.basedOn);
            if (attr) {
                const baseValue = attr.modifier;
                const profValue = st.proficient ? proficiencyBonus : 0;
                const newValue = baseValue + profValue;
                
                if (st.value !== newValue) {
                    console.log(`   ${st.name}: ${st.value} → ${newValue} (base:${baseValue}, prof:${profValue})`);
                }
                
                st.value = newValue;
                st.modifier = baseValue;
            } else {
                console.warn(`   ⚠️ No se encontró atributo para: ${st.basedOn}`);
            }
        });
        
        this.save();
        this.notify();
        
        // Emitir evento específico para cambios en salvaciones
        this.eventBus.emit('savingThrowsChanged', this.savingThrows);
        console.log('📊 SavingThrows: evento savingThrowsChanged emitido con', this.savingThrows.length, 'items');
    }

    getProficiencyBonus() {
        const bonus = this.expManager ? this.expManager.getProficiencyBonus() : 2;
        return bonus;
    }

    toggleProficient(index) {
        if (index >= 0 && index < this.savingThrows.length) {
            const oldValue = this.savingThrows[index].proficient;
            this.savingThrows[index].proficient = !this.savingThrows[index].proficient;
            console.log(`📊 SavingThrows: toggled proficiency for ${this.savingThrows[index].name}: ${oldValue} → ${this.savingThrows[index].proficient}`);
            
            this.updateAllValues();
            this.save();
            this.notify();
            this.eventBus.emit('savingThrowsChanged', this.savingThrows);
        }
    }

    getAll() {
        return [...this.savingThrows];
    }

    subscribe(listener) {
        this.listeners.push(listener);
        // Llamar inmediatamente con los datos actuales
        listener(this.savingThrows);
    }

    notify() {
        console.log('📊 SavingThrows: notificando a', this.listeners.length, 'listeners');
        this.listeners.forEach(listener => listener(this.savingThrows));
        this.eventBus.emit('savingThrowsChanged', this.savingThrows);
    }

    save() {
        // Guardar solo el estado de competencia, no los valores calculados
        const toSave = this.savingThrows.map(st => ({
            name: st.name,
            value: st.value,
            proficient: st.proficient,
            basedOn: st.basedOn,
            modifier: st.modifier
        }));
        this.storage.save('savingThrows', toSave);
    }
}