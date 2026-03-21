import { DEFAULT_TEXT_COLORS } from '../../utils/Constants.js';

export class ColorManager {
    constructor(storageService) {
        this.storage = storageService;
        this.themeColors = {};
        this.textColors = { ...DEFAULT_TEXT_COLORS };
        this.load();
    }

    load() {
        const savedTheme = this.storage.load('themeColors');
        if (savedTheme) {
            this.themeColors = savedTheme;
        }
        
        const savedText = this.storage.load('textColors');
        if (savedText) {
            this.textColors = { ...this.textColors, ...savedText };
        }
        
        this.applyToCSS();
    }

    getColor(key) {
        return this.textColors[key] || this.themeColors[key] || DEFAULT_TEXT_COLORS[key] || '#000000';
    }

    setThemeColor(key, value) {
        this.themeColors[key] = value;
        this.storage.save('themeColors', this.themeColors);
        this.applyToCSS();
    }

    setTextColor(key, value) {
        this.textColors[key] = value;
        this.storage.save('textColors', this.textColors);
        this.applyToCSS();
    }

    setAllTextColors(colors) {
        this.textColors = { ...this.textColors, ...colors };
        this.storage.save('textColors', this.textColors);
        this.applyToCSS();
    }

    resetThemeColors() {
        this.themeColors = {};
        this.storage.remove('themeColors');
        this.applyToCSS();
    }

    resetTextColors() {
        this.textColors = { ...DEFAULT_TEXT_COLORS };
        this.storage.remove('textColors');
        this.applyToCSS();
    }

    applyToCSS() {
        const root = document.documentElement;
        
        // Mapear los nombres de las propiedades del tema a las variables CSS correctas
        const cssVarMap = {
            'mana': '--mana-color',
            'hp': '--hp-color',
            'exp': '--exp-color',
            'accent': '--accent-gold',      // Mapeo correcto
            'background': '--body-bg',
            'parchment': '--parchment-light', // Mapeo correcto
            'gems': '--slot-color'           // Mapeo correcto
        };
        
        // Aplicar colores del tema usando el mapeo
        Object.entries(this.themeColors).forEach(([key, value]) => {
            const cssVar = cssVarMap[key];
            if (cssVar) {
                root.style.setProperty(cssVar, value);
            } else {
                // Por si acaso, también intentar con el formato original
                root.style.setProperty(`--${key}-color`, value);
            }
        });
        
        // Aplicar colores de texto
        root.style.setProperty('--text-title-color', this.textColors.title);
        root.style.setProperty('--text-subtitle-color', this.textColors.subtitle);
        root.style.setProperty('--text-label-color', this.textColors.label);
        root.style.setProperty('--text-input-color', this.textColors.input);
        root.style.setProperty('--text-number-color', this.textColors.number);
        root.style.setProperty('--text-modifier-color', this.textColors.modifier);
        
        // Aplicar colores directamente a elementos específicos
        this.applyDirectColors();
    }

    applyDirectColors() {
        setTimeout(() => {
            const modifiers = document.querySelectorAll('.ability-modifier');
            modifiers.forEach(mod => {
                mod.style.color = this.textColors.modifier;
            });
            
            const hpInputs = document.querySelectorAll('.hp-display-large input, .mana-input');
            hpInputs.forEach(input => {
                input.style.color = this.textColors.number;
            });
            
            // Forzar actualización de gemas si existen
            const gemSlots = document.querySelectorAll('.gem-slot');
            if (gemSlots.length > 0) {
                // Las gemas usan --slot-color, que ya se actualizó arriba
            }
        }, 100);
    }
}