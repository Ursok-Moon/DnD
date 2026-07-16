export class SpellDictionaryService {
    constructor() {
        this.spells = [];
        this.isLoading = false;
        this.loadPromise = null;
        this.cacheKey = 'spells_dictionary_cache';
        this.cacheExpiry = 24 * 60 * 60 * 1000; // 24 horas
        this.dbName = 'SpellDictionaryDB';
        this.dbVersion = 1;
        this.storeName = 'spells';
        this.db = null;
        this.useIndexedDB = true; // Usar IndexedDB en lugar de localStorage
    }

    /**
     * Inicializa la base de datos IndexedDB
     */
    async initDB() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.warn('⚠️ Error abriendo IndexedDB, usando localStorage como fallback:', request.error);
                this.useIndexedDB = false;
                resolve(null);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                    console.log('📦 Base de datos IndexedDB creada para conjuros');
                }
            };
        });
    }

    async loadSpells(forceRefresh = false) {
        if (this.spells.length > 0 && !forceRefresh) return this.spells;
        if (this.loadPromise && !forceRefresh) return this.loadPromise;

        if (!forceRefresh) {
            const cached = await this.loadFromCache();
            if (cached) {
                this.spells = cached;
                console.log(`✅ Conjuros cargados desde cache: ${this.spells.length}`);
                return this.spells;
            }
        }

        this.isLoading = true;
        this.loadPromise = this.fetchSpells();

        return this.loadPromise;
    }

    async fetchSpells() {
        try {
            const response = await fetch('/data/conjuros.jsonl');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const text = await response.text();
            const lines = text.split('\n').filter(line => line.trim());

            this.spells = lines.map(line => {
                try {
                    const spell = JSON.parse(line);
                    return {
                        name: spell.name,
                        level: spell.Level ?? spell.level ?? 0,
                        school: spell.School ?? spell.school ?? '',
                        components: spell.Components ?? spell.components ?? '',
                        castingTime: spell['Casting Time'] ?? spell.castingTime ?? '',
                        range: spell['data-RangeAoe'] ?? spell.Range ?? spell.range ?? '',
                        duration: spell.Duration ?? spell.duration ?? '',
                        damageType: spell['Damage Type'] ?? spell.damageType ?? '',
                        description: spell.description ?? '',
                        ritual: spell.Ritual === 'yes' || spell.ritual === true,
                        concentration: (spell.Duration ?? spell.duration ?? '').toLowerCase().includes('concentracion'),
                        book: spell.book ?? '',
                        publisher: spell.publisher ?? ''
                    };
                } catch (e) {
                    console.error('Error parsing spell line:', e);
                    return null;
                }
            }).filter(spell => spell !== null);

            console.log(`📚 Diccionario cargado: ${this.spells.length} conjuros`);

            // Guardar en cache (IndexedDB o localStorage)
            await this.saveToCache(this.spells);

            return this.spells;
        } catch (error) {
            console.error('❌ Error loading spells dictionary:', error);
            this.spells = [];
            return [];
        } finally {
            this.isLoading = false;
            this.loadPromise = null;
        }
    }

    /**
     * Carga desde cache usando IndexedDB o localStorage como fallback
     */
    async loadFromCache() {
        // Intentar con IndexedDB primero
        if (this.useIndexedDB) {
            try {
                await this.initDB();
                if (this.db) {
                    const data = await this.loadFromIndexedDB();
                    if (data) return data;
                }
            } catch (e) {
                console.warn('⚠️ Error cargando desde IndexedDB, usando localStorage:', e);
                this.useIndexedDB = false;
            }
        }

        // Fallback a localStorage
        return this.loadFromLocalStorage();
    }

    /**
     * Carga desde IndexedDB
     */
    loadFromIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(null);
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(this.cacheKey);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const result = request.result;
                if (!result) {
                    resolve(null);
                    return;
                }

                const now = Date.now();
                if (now - result.timestamp > this.cacheExpiry) {
                    // Cache expirado, eliminarlo
                    this.deleteFromIndexedDB();
                    resolve(null);
                    return;
                }

                resolve(result.data);
            };
        });
    }

    /**
     * Carga desde localStorage (fallback)
     */
    loadFromLocalStorage() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            const now = Date.now();

            if (now - timestamp > this.cacheExpiry) {
                localStorage.removeItem(this.cacheKey);
                return null;
            }

            return data;
        } catch (e) {
            return null;
        }
    }

    /**
     * Guarda en cache usando IndexedDB o localStorage como fallback
     */
    async saveToCache(data) {
        // Intentar con IndexedDB primero
        if (this.useIndexedDB) {
            try {
                await this.initDB();
                if (this.db) {
                    await this.saveToIndexedDB(data);
                    console.log(`💾 Cache de conjuros guardado en IndexedDB (${data.length} conjuros)`);
                    return;
                }
            } catch (e) {
                console.warn('⚠️ Error guardando en IndexedDB, usando localStorage:', e);
                this.useIndexedDB = false;
            }
        }

        // Fallback a localStorage
        this.saveToLocalStorage(data);
    }

    /**
     * Guarda en IndexedDB
     */
    saveToIndexedDB(data) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                reject(new Error('Base de datos no inicializada'));
                return;
            }

            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({
                key: this.cacheKey,
                data: data,
                timestamp: Date.now()
            });

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    /**
     * Guarda en localStorage (fallback)
     */
    saveToLocalStorage(data) {
        try {
            // Verificar si hay espacio suficiente
            const cacheData = {
                data: data,
                timestamp: Date.now()
            };
            const serialized = JSON.stringify(cacheData);

            // Si el dato es muy grande (> 4MB), no guardar en localStorage
            if (serialized.length > 4 * 1024 * 1024) {
                console.warn('⚠️ Los conjuros son demasiado grandes para localStorage, usando solo IndexedDB');
                return;
            }

            localStorage.setItem(this.cacheKey, serialized);
            console.log(`💾 Cache de conjuros guardado en localStorage (${data.length} conjuros)`);
        } catch (e) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                console.warn('⚠️ No hay espacio en localStorage para cache de conjuros');
                // Intentar limpiar cache antigua
                try {
                    localStorage.removeItem(this.cacheKey);
                } catch (cleanupError) {
                    // Ignorar
                }
            } else {
                console.warn('⚠️ No se pudo guardar cache de conjuros:', e);
            }
        }
    }

    /**
     * Elimina cache de IndexedDB
     */
    deleteFromIndexedDB() {
        if (!this.db) return;

        try {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            store.delete(this.cacheKey);
        } catch (e) {
            console.warn('Error eliminando cache de IndexedDB:', e);
        }
    }

    /**
     * Limpia toda la cache de conjuros (ambos sistemas)
     */
    clearCache() {
        // Limpiar localStorage
        try {
            localStorage.removeItem(this.cacheKey);
        } catch (e) {}

        // Limpiar IndexedDB
        if (this.db) {
            try {
                const transaction = this.db.transaction([this.storeName], 'readwrite');
                const store = transaction.objectStore(this.storeName);
                store.delete(this.cacheKey);
            } catch (e) {}
        }

        this.spells = [];
        console.log('🧹 Cache de conjuros limpiada');
    }

    searchSpells(searchTerm, maxResults = 15) {
        if (!searchTerm || searchTerm.length < 2) return [];

        const term = searchTerm.toLowerCase().trim();

        const results = this.spells.map(spell => {
            const name = spell.name.toLowerCase();
            let score = 0;

            if (name === term) score = 100;
            else if (name.startsWith(term)) score = 80;
            else if (name.includes(term)) score = 60;
            else {
                const words = name.split(/\s+/);
                for (const word of words) {
                    if (word === term) score = 70;
                    else if (word.startsWith(term)) score = 50;
                    else if (word.includes(term) && term.length >= 3) score = 30;
                }
            }

            return { spell, score };
        }).filter(r => r.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, maxResults);

        return results.map(r => r.spell);
    }

    getSpellByName(name) {
        if (!name) return null;
        const searchName = name.toLowerCase().trim();
        return this.spells.find(spell =>
            spell.name.toLowerCase() === searchName
        );
    }

    formatSpellMetadata(spell) {
        const lines = [];

        const levelText = spell.level === 0 ? 'Truco' : `Nivel ${spell.level}`;
        lines.push(`${levelText} - ${this.getSchoolSpanish(spell.school)}`);
        lines.push('');

        if (spell.castingTime && spell.castingTime !== '—') {
            lines.push(`Tiempo de lanzamiento: ${spell.castingTime}`);
        }

        if (spell.range && spell.range !== '—') {
            lines.push(`Alcance: ${spell.range}`);
        }

        if (spell.components && spell.components !== '—') {
            lines.push(`Componentes: ${spell.components}`);
        }

        if (spell.duration && spell.duration !== '—') {
            lines.push(`Duracion: ${spell.duration}`);
        }

        if (spell.damageType && spell.damageType !== '—') {
            lines.push(`Tipo de dano: ${spell.damageType}`);
        }

        if (spell.ritual) lines.push('Ritual: Si');
        if (spell.concentration) lines.push('Concentracion: Si');

        if (lines.length > 0 && lines[lines.length - 1] !== '') {
            lines.push('');
        }

        if (spell.book) {
            lines.push(`Fuente: ${spell.book}${spell.publisher ? ` (${spell.publisher})` : ''}`);
        }

        return lines;
    }

    getSchoolSpanish(school) {
        const schools = {
            'abjuration': 'Abjuracion',
            'conjuration': 'Conjuracion',
            'divination': 'Adivinacion',
            'enchantment': 'Encantamiento',
            'evocation': 'Evocacion',
            'illusion': 'Ilusion',
            'necromancy': 'Nigromancia',
            'transmutation': 'Transmutacion'
        };
        return schools[school?.toLowerCase()] || school || '';
    }

    getLevelText(level) {
        if (level === 0) return 'Truco';
        if (level === 1) return '1er Nivel';
        if (level === 2) return '2do Nivel';
        if (level === 3) return '3er Nivel';
        return `${level}° Nivel`;
    }
}