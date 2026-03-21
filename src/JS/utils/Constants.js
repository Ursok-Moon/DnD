// js/utils/Constants.js
export const DEFAULT_ATTRIBUTES = [
    { name: 'FUERZA', value: 10 },
    { name: 'DESTREZA', value: 10 },
    { name: 'CONSTITUCIÓN', value: 10 },
    { name: 'INTELIGENCIA', value: 10 },
    { name: 'SABIDURÍA', value: 10 },
    { name: 'CARISMA', value: 10 }
];

export const DEFAULT_TEXT_COLORS = {
    title: '#1e3a5f',
    subtitle: '#5c4033',
    label: '#5c4033',
    input: '#2c1810',
    number: '#2c1810',
    modifier: '#2a4a7a'
};

export const DEFAULT_SKILLS = [
    { name: 'Acrobacias', bonus: 0, attribute: 'DESTREZA' },
    { name: 'Atletismo', bonus: 0, attribute: 'FUERZA' },
    { name: 'Arcano', bonus: 0, attribute: 'INTELIGENCIA' },
    { name: 'Engaño', bonus: 0, attribute: 'CARISMA' },
    { name: 'Historia', bonus: 0, attribute: 'INTELIGENCIA' },
    { name: 'Interpretación', bonus: 0, attribute: 'CARISMA' },
    { name: 'Intimidación', bonus: 0, attribute: 'CARISMA' },
    { name: 'Investigación', bonus: 0, attribute: 'INTELIGENCIA' },
    { name: 'Juego de Manos', bonus: 0, attribute: 'DESTREZA' },
    { name: 'Medicina', bonus: 0, attribute: 'SABIDURÍA' },
    { name: 'Naturaleza', bonus: 0, attribute: 'INTELIGENCIA' },
    { name: 'Percepción', bonus: 0, attribute: 'SABIDURÍA' },
    { name: 'Perspicacia', bonus: 0, attribute: 'SABIDURÍA' },
    { name: 'Persuasión', bonus: 0, attribute: 'CARISMA' },
    { name: 'Religión', bonus: 0, attribute: 'INTELIGENCIA' },
    { name: 'Sigilo', bonus: 0, attribute: 'DESTREZA' },
    { name: 'Supervivencia', bonus: 0, attribute: 'SABIDURÍA' }
];

export const PROFICIENCY_TYPES = {
    armor: { icon: 'fa-shield-alt', name: 'Armaduras' },
    weapon: { icon: 'fa-crosshairs', name: 'Armas' },
    tool: { icon: 'fa-tools', name: 'Herramientas' },
    language: { icon: 'fa-language', name: 'Idiomas' }
};

export const EXP_TABLE_DND5E = {
    1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
    6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
    11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
    16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
};

export const PROFICIENCY_BONUS = [2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6];