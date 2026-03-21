import { DEFAULT_SKILLS } from '../../utils/Constants.js';
import { Helpers } from '../../utils/Helpers.js';

export class SkillsManager {
    constructor(storageService, attributeManager, eventBus, expManager) {
        this.storage = storageService;
        this.attributeManager = attributeManager;
        this.eventBus = eventBus;
        this.expManager = expManager; 
        this.skills = [];
        this.listeners = [];
        this.load();
        
        this.eventBus.on('attributeChanged', () => {
            this.updateAllBonuses();
        });
        
        this.eventBus.on('levelChanged', () => {
            this.updateAllBonuses();
        });
    }

    load() {
        const saved = this.storage.load('skills');
        if (saved && saved.length > 0) {
            this.skills = saved;
            this.skills.forEach(skill => {
            const defaultSkill = DEFAULT_SKILLS.find(ds => ds.name === skill.name);
            if (defaultSkill && !skill.attribute) {
                skill.attribute = defaultSkill.attribute;
            }
            });
            this.updateAllBonuses();
        } else {
            this.loadDefaults();
        }
    }

    loadDefaults() {
        this.skills = DEFAULT_SKILLS.map(skill => ({
            id: Helpers.generateId(),
            name: skill.name,
            bonus: skill.bonus,
            attribute: skill.attribute,
            proficient: false,
            expertise: false,
            misc: 0
        }));
        this.updateAllBonuses();
        this.save();
    }

    getAll() {
        return [...this.skills];
    }

    add(name = '', attribute = '') {
        const skill = {
            id: Helpers.generateId(),
            name: name,
            bonus: 0,
            attribute: attribute,
            proficient: false,
            expertise: false,
            misc: 0
        };
        this.skills.push(skill);
        this.updateSkillBonus(skill);
        this.save();
        this.notify();
        this.eventBus.emit('skillsChanged', this.skills);
        return skill;
    }

    remove(id) {
        this.skills = this.skills.filter(s => s.id !== id);
        this.save();
        this.notify();
        this.eventBus.emit('skillsChanged', this.skills);
    }

    update(id, updates) {
        const index = this.skills.findIndex(s => s.id === id);
        if (index !== -1) {
            this.skills[index] = { ...this.skills[index], ...updates };
            this.updateSkillBonus(this.skills[index]);
            this.save();
            this.notify();
            this.eventBus.emit('skillsChanged', this.skills);
            return true;
        }
        return false;
    }

    toggleProficient(id) {
        const skill = this.skills.find(s => s.id === id);
        if (skill) {
            skill.proficient = !skill.proficient;
            if (!skill.proficient) skill.expertise = false;
            this.updateSkillBonus(skill);
            this.save();
            this.notify();
            this.eventBus.emit('skillsChanged', this.skills);
        }
    }

    toggleExpertise(id) {
        const skill = this.skills.find(s => s.id === id);
        if (skill && skill.proficient) {
            skill.expertise = !skill.expertise;
            this.updateSkillBonus(skill);
            this.save();
            this.notify();
            this.eventBus.emit('skillsChanged', this.skills);
        }
    }

    updateSkillBonus(skill) {
        const attributeMod = skill.attribute ? 
            this.attributeManager.getModifier(skill.attribute) : 0;
        
        // Obtener proficiency bonus real del ExpManager
        const proficiencyBonus = this.expManager ? this.expManager.getProficiencyBonus() : 2;
        const profMultiplier = skill.expertise ? 2 : (skill.proficient ? 1 : 0);
        
        skill.bonus = attributeMod + (proficiencyBonus * profMultiplier) + (skill.misc || 0);
    }

    updateAllBonuses() {
        this.skills.forEach(skill => this.updateSkillBonus(skill));
        this.notify();
        this.eventBus.emit('skillsChanged', this.skills);
    }

    getProficiencyBonus() {
        return this.expManager ? this.expManager.getProficiencyBonus() : 2;
    }

    getByAttribute(attribute) {
        return this.skills.filter(s => s.attribute === attribute);
    }

    subscribe(listener) {
        this.listeners.push(listener);
        listener(this.skills);
    }

    notify() {
        this.listeners.forEach(listener => listener(this.skills));
        this.eventBus.emit('skillsChanged', this.skills);
    }

    save() {
        this.storage.save('skills', this.skills);
    }
}