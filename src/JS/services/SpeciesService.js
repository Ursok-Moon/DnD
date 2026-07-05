export class SpeciesService {
    constructor() {
        this.species = [];
        this.speciesMap = new Map();
        this.loaded = false;
    }

    /**
     * Parsea contenido JSONL (una línea = un objeto JSON)
     */
    parseJSONL(content) {
        const lines = content.trim().split('\n');
        const objects = [];
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line === '') continue; // Saltar líneas vacías
            
            try {
                const obj = JSON.parse(line);
                objects.push(obj);
            } catch (e) {
                console.warn(`Error parseando línea ${i + 1}:`, e.message);
                console.warn(`Línea problemática: ${line.substring(0, 100)}...`);
            }
        }
        
        return objects;
    }

    async loadSpecies() {
        if (this.loaded) return this.species;
        
        try {
            // Intentar cargar desde el servidor primero
            const response = await fetch('/api/json/especies');
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                const text = await response.text();
                
                // Detectar si es JSONL o JSON normal
                if (contentType?.includes('application/x-jsonlines') || 
                    contentType?.includes('application/jsonl') ||
                    (text.trim().startsWith('{') && !text.trim().startsWith('['))) {
                    // Es JSONL
                    this.species = this.parseJSONL(text);
                } else {
                    // Es JSON normal (array)
                    const data = JSON.parse(text);
                    this.species = Array.isArray(data) ? data : [];
                }
            } else {
                throw new Error('No se pudo cargar desde el servidor');
            }
        } catch (error) {
            console.warn('Cargando especies desde archivo local:', error);
            // Fallback: cargar desde archivo local
            try {
                const response = await fetch('/data/especies.json');
                const text = await response.text();
                
                // Detectar si es JSONL o JSON normal
                if (text.trim().startsWith('{') && !text.trim().startsWith('[')) {
                    // Es JSONL
                    this.species = this.parseJSONL(text);
                } else {
                    // Es JSON normal (array)
                    this.species = JSON.parse(text);
                }
            } catch (localError) {
                console.error('Error cargando especies.json:', localError);
                this.species = [];
            }
        }
        
        // Crear mapa para búsqueda rápida
        this.buildSpeciesMap();
        
        this.loaded = true;
        console.log(`✅ ${this.species.length} especies cargadas`);
        return this.species;
    }

    buildSpeciesMap() {
        this.speciesMap.clear();
        this.species.forEach(esp => {
            const nombreKey = esp.name?.toUpperCase() || '';
            this.speciesMap.set(nombreKey, esp);
            this.speciesMap.set(esp.name, esp);
            
            // También añadir variantes del nombre (eliminando sufijos como (EGTW))
            if (esp.name) {
                const baseName = esp.name.replace(/\s*\([^)]+\)\s*$/, '').trim();
                if (baseName !== esp.name) {
                    this.speciesMap.set(baseName.toUpperCase(), esp);
                    this.speciesMap.set(baseName, esp);
                }
            }
        });
    }

    getSpeciesList() {
        return this.species;
    }

    getSpeciesByName(name) {
        if (!name) return null;
        const searchTerm = name.toUpperCase().trim();
        
        // Búsqueda exacta
        if (this.speciesMap.has(searchTerm)) {
            return this.speciesMap.get(searchTerm);
        }
        
        // Búsqueda parcial (primera coincidencia)
        return this.species.find(esp => 
            esp.name?.toUpperCase().includes(searchTerm)
        );
    }

    getSpeciesByExactName(name) {
        if (!name) return null;
        return this.speciesMap.get(name) || 
               this.speciesMap.get(name?.toUpperCase());
    }

    getSpeciesDenominaciones() {
        return this.species.map(esp => ({
            text: esp.name,
            value: esp.name,
            description: esp.description,
            book: esp.book,
            publisher: esp.publisher,
            properties: esp.properties
        }));
    }

    getSpeciesByPublisher(publisher) {
        if (!publisher) return [];
        return this.species.filter(esp => 
            esp.publisher?.toLowerCase() === publisher.toLowerCase()
        );
    }

    getSpeciesByBook(book) {
        if (!book) return [];
        return this.species.filter(esp => 
            esp.book?.toLowerCase().includes(book.toLowerCase())
        );
    }

    searchSpecies(query) {
        if (!query) return this.species;
        const lowerQuery = query.toLowerCase();
        return this.species.filter(esp => 
            esp.name?.toLowerCase().includes(lowerQuery) ||
            esp.description?.toLowerCase().includes(lowerQuery) ||
            esp.book?.toLowerCase().includes(lowerQuery)
        );
    }

    // Método para agregar una especie (útil si se necesita añadir dinámicamente)
    addSpecies(speciesItem) {
        if (!speciesItem || !speciesItem.name) return false;
        
        if (!this.speciesMap.has(speciesItem.name)) {
            this.species.push(speciesItem);
            this.speciesMap.set(speciesItem.name, speciesItem);
            this.speciesMap.set(speciesItem.name.toUpperCase(), speciesItem);
            return true;
        }
        return false;
    }

    // Método para obtener estadísticas del catálogo
    getStats() {
        const publishers = new Map();
        const books = new Map();
        
        this.species.forEach(esp => {
            if (esp.publisher) {
                publishers.set(esp.publisher, (publishers.get(esp.publisher) || 0) + 1);
            }
            if (esp.book) {
                books.set(esp.book, (books.get(esp.book) || 0) + 1);
            }
        });
        
        return {
            totalSpecies: this.species.length,
            publishers: Object.fromEntries(publishers),
            books: Object.fromEntries(books)
        };
    }
}