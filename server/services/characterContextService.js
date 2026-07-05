import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '../../data');

class CharacterContextService {
    constructor() {
        this.currentCharacters = [];
        this.lastUpdate = null;
        this.cacheTimeout = 30000; // 30 segundos de caché
    }

    /**
     * Obtener la fecha más reciente de archivo de personajes
     */
    async getLatestCharacterFile() {
        try {
            const personajesPath = path.join(DATA_PATH, 'personajes');
            
            // Verificar si la carpeta existe
            try {
                await fs.access(personajesPath);
            } catch {
                return null;
            }
            
            const files = await fs.readdir(personajesPath);
            
            // Filtrar archivos JSON con formato de fecha
            const dateFiles = files.filter(f => f.match(/^\d{4}-\d{2}-\d{2}\.json$/));
            
            if (dateFiles.length === 0) return null;
            
            // Ordenar por fecha descendente y tomar el más reciente
            dateFiles.sort().reverse();
            const latestFile = dateFiles[0];
            const filePath = path.join(personajesPath, latestFile);
            
            return {
                path: filePath,
                date: latestFile.replace('.json', ''),
                filename: latestFile
            };
        } catch (error) {
            console.error('Error obteniendo archivo más reciente:', error);
            return null;
        }
    }

    /**
     * Cargar personajes del archivo más reciente
     */
    async loadCurrentCharacters(forceRefresh = false) {
        // Verificar caché
        if (!forceRefresh && this.lastUpdate && 
            (Date.now() - this.lastUpdate) < this.cacheTimeout) {
            return this.currentCharacters;
        }

        try {
            const latestFile = await this.getLatestCharacterFile();
            
            if (!latestFile) {
                console.log('⚠️ No se encontraron archivos de personajes');
                this.currentCharacters = [];
                return [];
            }

            const data = await fs.readFile(latestFile.path, 'utf8');
            const sessionData = JSON.parse(data);
            
            // Adaptar la estructura de personajes a lo que espera el servicio
            this.currentCharacters = (sessionData.personajes || []).map(char => ({
                id: char.id,
                nombre: char.nombre,
                clase: char.clase,
                raza: char.raza,
                nivel: char.nivel || 1,
                jugador: char.jugador,
                trasfondo: char.trasfondo,
                alineamiento: char.alineamiento,
                imagen: char.imagen,
                colores_personalizados: char.colores_personalizados || {},
                
                // Estadísticas
                hp: char.stats?.hp || { current: 0, max: 0, temp: 0 },
                mana: char.stats?.mana || { current: 0, max: 0 },
                ca: char.stats?.ca || 10,
                velocidad: char.stats?.velocidad || 30,
                iniciativa: char.stats?.iniciativa || 0,
                attributes: char.stats?.atributos || [],
                
                // Conjuros
                spellSlots: char.spellSlots || { level: 1, total: 0, used: 0 },
                spellStats: char.spellStats || {},
                
                // Ataques
                attacks: char.ataques || [],
                spells: char.conjuros || [],
                
                // Inventario
                inventory: char.inventario || { equipo: [], monedas: { gold: 0, silver: 0, copper: 0 } },
                
                // Tiradas de salvación
                savingThrows: char.savingThrows || [],
                
                // Habilidades
                skills: char.skills || [],
                passivePerception: char.passivePerception || 10,
                
                // Competencias
                proficiencies: char.proficiencies || [],
                
                // Notas y rasgos
                notas: char.notas || {},
                
                // Estado
                deathSaves: char.deathSaves || { successes: [false, false, false], fails: [false, false, false] },
                
                // Metadatos
                fecha_creacion: char.fecha_creacion,
                version: char.version
            }));
            
            this.lastUpdate = Date.now();
            
            console.log(`📚 Cargados ${this.currentCharacters.length} personajes de ${latestFile.date}`);
            
            // También intentar cargar personajes_hoy.json como respaldo
            try {
                const hoyPath = path.join(DATA_PATH, 'personajes_hoy.json');
                const hoyData = await fs.readFile(hoyPath, 'utf8');
                const hoySession = JSON.parse(hoyData);
                
                const hoyCharacters = (hoySession.personajes || []);
                if (hoyCharacters.length > this.currentCharacters.length) {
                    // Fusionar sin duplicados
                    const existingIds = new Set(this.currentCharacters.map(c => c.id));
                    const newChars = hoyCharacters.filter(c => !existingIds.has(c.id));
                    
                    if (newChars.length > 0) {
                        this.currentCharacters.push(...newChars);
                        console.log(`📚 +${newChars.length} personajes adicionales desde personajes_hoy.json`);
                    }
                }
            } catch (e) {
                // No hay archivo hoy, continuar
            }
            
            return this.currentCharacters;
        } catch (error) {
            console.error('Error cargando personajes:', error);
            this.currentCharacters = [];
            return [];
        }
    }

    /**
     * Buscar personaje por nombre
     */
    findCharacterByName(name) {
        if (!name) return null;
        
        const searchName = name.toLowerCase();
        return this.currentCharacters.find(c => 
            c.nombre?.toLowerCase() === searchName ||
            c.nombre?.toLowerCase().includes(searchName) ||
            c.jugador?.toLowerCase() === searchName ||
            c.jugador?.toLowerCase().includes(searchName)
        );
    }

    /**
     * Buscar personajes por clase
     */
    findCharactersByClass(className) {
        if (!className) return [];
        
        const searchClass = className.toLowerCase();
        return this.currentCharacters.filter(c => 
            c.clase?.toLowerCase().includes(searchClass)
        );
    }

    /**
     * Buscar personajes por raza
     */
    findCharactersByRace(raceName) {
        if (!raceName) return [];
        
        const searchRace = raceName.toLowerCase();
        return this.currentCharacters.filter(c => 
            c.raza?.toLowerCase().includes(searchRace)
        );
    }

    /**
     * Obtener resumen de todos los personajes para contexto de IA
     */
    getCharactersContextSummary() {
        if (this.currentCharacters.length === 0) {
            return "No hay personajes cargados en la sesión actual.";
        }

        let summary = `=== PERSONAJES DE LA SESIÓN ACTUAL (${this.currentCharacters.length}) ===\n\n`;
        
        for (const char of this.currentCharacters) {
            summary += `📋 **${char.nombre || 'Sin nombre'}**\n`;
            summary += `   - Jugador: ${char.jugador || 'Desconocido'}\n`;
            summary += `   - Clase: ${char.clase || 'No especificada'} Nivel ${char.nivel || 1}\n`;
            summary += `   - Raza: ${char.raza || 'No especificada'}\n`;
            
            // Atributos principales
            if (char.attributes && char.attributes.length > 0) {
                const attrs = char.attributes.map(a => `${a.nombre}: ${a.valor}`).join(', ');
                summary += `   - Atributos: ${attrs}\n`;
            }
            
            // HP y estado
            if (char.hp) {
                const hpPercent = char.hp.max > 0 ? Math.round((char.hp.current / char.hp.max) * 100) : 0;
                summary += `   - HP: ${char.hp.current}/${char.hp.max} (${hpPercent}%)\n`;
            }
            
            // CA
            if (char.ca) {
                summary += `   - CA: ${char.ca}\n`;
            }
            
            // Ataques principales
            if (char.attacks && char.attacks.length > 0) {
                const mainAttacks = char.attacks.slice(0, 2).map(a => `${a.name} (${a.bonus}, ${a.damage})`).join(', ');
                summary += `   - Ataques: ${mainAttacks}\n`;
            }
            
            summary += '\n';
        }
        
        return summary;
    }

    /**
     * Obtener contexto detallado de un personaje específico
     */
    getDetailedCharacterContext(characterName) {
        const character = this.findCharacterByName(characterName);
        
        if (!character) {
            return null;
        }

        let context = `=== FICHA COMPLETA: ${character.nombre} ===\n\n`;
        context += `**Información Básica**\n`;
        context += `- Jugador: ${character.jugador || 'N/A'}\n`;
        context += `- Clase: ${character.clase || 'N/A'} Nivel ${character.nivel || 1}\n`;
        context += `- Raza: ${character.raza || 'N/A'}\n`;
        context += `- Trasfondo: ${character.trasfondo || 'N/A'}\n`;
        context += `- Alineamiento: ${character.alineamiento || 'N/A'}\n`;
        context += `- CA: ${character.ca || 10}\n`;
        context += `- Velocidad: ${character.velocidad || 30} pies\n\n`;
        
        // Atributos
        if (character.attributes && character.attributes.length > 0) {
            context += `**Atributos**\n`;
            for (const attr of character.attributes) {
                const mod = attr.modificador !== undefined ? attr.modificador : Math.floor((attr.valor - 10) / 2);
                context += `- ${attr.nombre}: ${attr.valor} (Mod: ${mod >= 0 ? '+' : ''}${mod})\n`;
            }
            context += `\n`;
        }
        
        // Puntos de vida y maná
        if (character.hp) {
            context += `**Salud**\n`;
            context += `- HP Actual: ${character.hp.current || 0}\n`;
            context += `- HP Máximo: ${character.hp.max || 0}\n`;
            if (character.hp.temp) context += `- HP Temporal: ${character.hp.temp}\n`;
            context += `\n`;
        }
        
        if (character.mana) {
            context += `**Maná**\n`;
            context += `- Maná Actual: ${character.mana.current || 0}\n`;
            context += `- Maná Máximo: ${character.mana.max || 0}\n\n`;
        }
        
        // Habilidades competentes
        if (character.skills && character.skills.length > 0) {
            const proficientSkills = character.skills.filter(s => s.proficient === true);
            if (proficientSkills.length > 0) {
                context += `**Habilidades con Competencia**\n`;
                for (const skill of proficientSkills.slice(0, 6)) {
                    const bonus = skill.bonus || 0;
                    context += `- ${skill.name}: +${bonus}\n`;
                }
                context += `\n`;
            }
        }
        
        // Tiradas de salvación
        if (character.savingThrows && character.savingThrows.length > 0) {
            const proficientThrows = character.savingThrows.filter(s => s.proficient === true);
            if (proficientThrows.length > 0) {
                context += `**Tiradas de Salvación con Competencia**\n`;
                for (const st of proficientThrows) {
                    const value = st.value || 0;
                    context += `- ${st.name}: +${value}\n`;
                }
                context += `\n`;
            }
        }
        
        // Ataques
        if (character.attacks && character.attacks.length > 0) {
            context += `**Ataques**\n`;
            for (const attack of character.attacks.slice(0, 4)) {
                context += `- ${attack.name}: +${attack.bonus || 0} al ataque, daño ${attack.damage || 'N/A'}\n`;
            }
            context += `\n`;
        }
        
        // Equipo importante
        if (character.inventory?.equipo && character.inventory.equipo.length > 0) {
            context += `**Equipo Notable**\n`;
            for (const item of character.inventory.equipo.slice(0, 5)) {
                context += `- ${item.name}\n`;
            }
            context += `\n`;
        }
        
        // Monedas
        if (character.inventory?.monedas) {
            const coins = character.inventory.monedas;
            context += `**Monedas**\n`;
            context += `- Oro: ${coins.gold || 0}, Plata: ${coins.silver || 0}, Cobre: ${coins.copper || 0}\n\n`;
        }
        
        // Competencias
        if (character.proficiencies && character.proficiencies.length > 0) {
            const languages = character.proficiencies.filter(p => p.type === 'language');
            const weapons = character.proficiencies.filter(p => p.type === 'weapon');
            const armors = character.proficiencies.filter(p => p.type === 'armor');
            const tools = character.proficiencies.filter(p => p.type === 'tool');
            
            if (languages.length > 0) {
                context += `**Idiomas**\n`;
                context += `- ${languages.map(l => l.name).join(', ')}\n\n`;
            }
            
            if (weapons.length > 0) {
                context += `**Competencia en Armas**\n`;
                context += `- ${weapons.slice(0, 5).map(w => w.name).join(', ')}\n\n`;
            }
            
            if (armors.length > 0) {
                context += `**Competencia en Armaduras**\n`;
                context += `- ${armors.map(a => a.name).join(', ')}\n\n`;
            }
        }
        
        // Rasgos y notas
        if (character.notas) {
            context += `**Rasgos de Personalidad**\n`;
            if (character.notas.rasgos) context += `- Rasgos: ${character.notas.rasgos.substring(0, 200)}${character.notas.rasgos.length > 200 ? '...' : ''}\n`;
            if (character.notas.personalidad) context += `- Personalidad: ${character.notas.personalidad.substring(0, 200)}${character.notas.personalidad.length > 200 ? '...' : ''}\n`;
            if (character.notas.ideales) context += `- Ideales: ${character.notas.ideales}\n`;
            if (character.notas.vinculos) context += `- Vínculos: ${character.notas.vinculos}\n`;
            if (character.notas.defectos) context += `- Defectos: ${character.notas.defectos}\n`;
        }
        
        return context;
    }

    /**
     * Detectar menciones a personajes en el texto del usuario
     */
    detectCharacterMentions(text) {
        const mentions = [];
        const lowerText = text.toLowerCase();
        
        for (const character of this.currentCharacters) {
            const name = character.nombre?.toLowerCase();
            const player = character.jugador?.toLowerCase();
            const className = character.clase?.toLowerCase();
            const raceName = character.raza?.toLowerCase();
            
            // Buscar por nombre del personaje
            if (name && lowerText.includes(name)) {
                mentions.push({
                    type: 'name',
                    character: character,
                    matched: character.nombre
                });
            } 
            // Buscar por nombre del jugador
            else if (player && lowerText.includes(player)) {
                mentions.push({
                    type: 'player',
                    character: character,
                    matched: character.jugador
                });
            } 
            // Buscar por clase (solo si es única o específica)
            else if (className && lowerText.includes(className) && 
                     this.currentCharacters.filter(c => c.clase?.toLowerCase() === className).length === 1) {
                mentions.push({
                    type: 'class',
                    character: character,
                    matched: character.clase
                });
            } 
            // Buscar por raza
            else if (raceName && lowerText.includes(raceName) && 
                     this.currentCharacters.filter(c => c.raza?.toLowerCase() === raceName).length === 1) {
                mentions.push({
                    type: 'race',
                    character: character,
                    matched: character.raza
                });
            }
        }
        
        // Eliminar duplicados (por si un personaje coincide por múltiples criterios)
        const uniqueMentions = [];
        const seenIds = new Set();
        for (const mention of mentions) {
            if (!seenIds.has(mention.character.id)) {
                seenIds.add(mention.character.id);
                uniqueMentions.push(mention);
            }
        }
        
        return uniqueMentions;
    }

async buildAIContext(userMessage, dmContext = null) {
    await this.loadCurrentCharacters();
    
    if (this.currentCharacters.length === 0) {
        return {
            hasCharacters: false,
            contextString: "No hay personajes registrados en la sesión actual.",
            mentionedCharacters: [],
            fullContext: null
        };
    }
    
    const mentions = this.detectCharacterMentions(userMessage);
    
    let contextString = "";
    let mentionedCharacters = [];
    
    if (mentions.length > 0) {
        contextString += `🎲 **CONTEXTO DE PERSONAJES MENCIONADOS**\n\n`;
        
        for (const mention of mentions) {
            const char = mention.character;
            mentionedCharacters.push(char);
            
            contextString += `╔══════════════════════════════════════════════════════════════╗\n`;
            contextString += `║ 🎭 ${char.nombre} (${char.clase || 'Clase desconocida'} nivel ${char.nivel || 1})\n`;
            contextString += `╠══════════════════════════════════════════════════════════════╣\n`;
            
            // Información básica
            contextString += `║ 📋 BÁSICO:\n`;
            contextString += `║    Jugador: ${char.jugador || 'N/A'}\n`;
            contextString += `║    Raza: ${char.raza || 'N/A'}\n`;
            contextString += `║    Trasfondo: ${char.trasfondo || 'N/A'}\n`;
            contextString += `║    Alineamiento: ${char.alineamiento || 'N/A'}\n`;
            contextString += `║\n`;
            
            // Salud y combate
            contextString += `║ ❤️ SALUD Y COMBATE:\n`;
            contextString += `║    HP: ${char.hp?.current || 0}/${char.hp?.max || 0}`;
            if (char.hp?.temp) contextString += ` (Temp: ${char.hp.temp})`;
            contextString += `\n`;
            if (char.mana) contextString += `║    Maná: ${char.mana?.current || 0}/${char.mana?.max || 0}\n`;
            contextString += `║    CA: ${char.ca || 10}\n`;
            contextString += `║    Velocidad: ${char.velocidad || 30} pies\n`;
            contextString += `║    Iniciativa: +${char.iniciativa || 0}\n`;
            contextString += `║\n`;
            
            // Atributos
            if (char.attributes && char.attributes.length > 0) {
                contextString += `║ 📊 ATRIBUTOS:\n`;
                for (const attr of char.attributes) {
                    const mod = attr.modificador !== undefined ? attr.modificador : Math.floor((attr.valor - 10) / 2);
                    const modStr = mod >= 0 ? `+${mod}` : `${mod}`;
                    contextString += `║    ${attr.nombre}: ${attr.valor} (${modStr})\n`;
                }
                contextString += `║\n`;
            }
            
            // Tiradas de salvación con competencia
            if (char.savingThrows && char.savingThrows.length > 0) {
                const proficientThrows = char.savingThrows.filter(s => s.proficient === true);
                if (proficientThrows.length > 0) {
                    contextString += `║ 🛡️ SALVACIONES CON COMPETENCIA:\n`;
                    for (const st of proficientThrows) {
                        const value = st.value || 0;
                        const mod = st.modifier || 0;
                        contextString += `║    ${st.name}: +${value} (Mod: ${mod >= 0 ? `+${mod}` : `${mod}`})\n`;
                    }
                    contextString += `║\n`;
                }
            }
            
            // Habilidades con competencia
            if (char.skills && char.skills.length > 0) {
                const proficientSkills = char.skills.filter(s => s.proficient === true);
                if (proficientSkills.length > 0) {
                    contextString += `║ 🎯 HABILIDADES CON COMPETENCIA:\n`;
                    for (const skill of proficientSkills.slice(0, 8)) {
                        const bonus = skill.bonus || 0;
                        contextString += `║    ${skill.name}: +${bonus}\n`;
                    }
                    contextString += `║\n`;
                }
            }
            
            // Ataques
            if (char.attacks && char.attacks.length > 0) {
                contextString += `║ ⚔️ ATAQUES:\n`;
                for (const attack of char.attacks.slice(0, 4)) {
                    contextString += `║    ${attack.name}: +${attack.bonus || 0} | Daño: ${attack.damage || 'N/A'}\n`;
                }
                contextString += `║\n`;
            }
            
            // Equipo/Inventario
            if (char.inventory?.equipo && char.inventory.equipo.length > 0) {
                contextString += `║ 🎒 EQUIPO:\n`;
                for (const item of char.inventory.equipo.slice(0, 6)) {
                    contextString += `║    • ${item.name}`;
                    if (item.description) contextString += ` - ${item.description.substring(0, 40)}`;
                    contextString += `\n`;
                }
                if (char.inventory.equipo.length > 6) {
                    contextString += `║    ... y ${char.inventory.equipo.length - 6} objetos más\n`;
                }
                contextString += `║\n`;
            }
            
            // Monedas
            if (char.inventory?.monedas) {
                const coins = char.inventory.monedas;
                contextString += `║ 💰 MONEDAS:\n`;
                contextString += `║    Oro: ${coins.gold || 0} | Plata: ${coins.silver || 0} | Cobre: ${coins.copper || 0}\n`;
                contextString += `║\n`;
            }
            
            // Conjuros (si tiene)
            if (char.spells && char.spells.length > 0) {
                contextString += `║ 🔮 CONJUROS:\n`;
                for (const spell of char.spells.slice(0, 5)) {
                    contextString += `║    • ${spell.name || spell}\n`;
                }
                contextString += `║\n`;
            }
            
            // Competencias importantes
            if (char.proficiencies && char.proficiencies.length > 0) {
                const weapons = char.proficiencies.filter(p => p.type === 'weapon');
                const languages = char.proficiencies.filter(p => p.type === 'language');
                
                if (weapons.length > 0) {
                    contextString += `║ 🗡️ COMPETENCIA EN ARMAS:\n`;
                    contextString += `║    ${weapons.slice(0, 5).map(w => w.name).join(', ')}\n`;
                    contextString += `║\n`;
                }
                
                if (languages.length > 0) {
                    contextString += `║ 🗣️ IDIOMAS:\n`;
                    contextString += `║    ${languages.map(l => l.name).join(', ')}\n`;
                    contextString += `║\n`;
                }
            }
            
            // Rasgos especiales
            if (char.notas?.rasgos) {
                contextString += `║ ✨ RASGOS ESPECIALES:\n`;
                const rasgos = char.notas.rasgos.split('\n').filter(r => r.trim());
                for (const rasgo of rasgos.slice(0, 4)) {
                    contextString += `║    • ${rasgo.substring(0, 60)}\n`;
                }
                contextString += `║\n`;
            }
            
            contextString += `╚══════════════════════════════════════════════════════════════╝\n\n`;
        }
    } else {
        contextString += this.getCharactersContextSummary();
        mentionedCharacters = this.currentCharacters;
    }
    
    if (dmContext) {
        contextString += `\n📌 **CONTEXTO DEL DM**\n${dmContext}\n\n`;
    }
    
    contextString += `\n📖 **INSTRUCCIONES IMPORTANTES PARA LA IA**\n`;
    contextString += `1. TIENES ACCESO COMPLETO a la información de los personajes: HP, equipo, atributos, etc.\n`;
    contextString += `2. Cuando respondas, USA los datos específicos como HP actual, equipo que tienen, etc.\n`;
    contextString += `3. Si un personaje está herido (HP bajo), MENCIONALO y sugiere curarse.\n`;
    contextString += `4. Si tienen objetos específicos en su inventario, SUGIERE usarlos cuando sea relevante.\n`;
    contextString += `5. Personaliza las respuestas según su clase, raza y equipo disponible.\n`;
    contextString += `6. SI NO VES INFORMACIÓN COMPLETA, ES PORQUE EL SISTEMA NO LA ENVIÓ, NO PORQUE NO EXISTA.\n`;
    
    return {
        hasCharacters: true,
        contextString: contextString,
        mentionedCharacters: mentionedCharacters,
        fullContext: {
            allCharacters: this.currentCharacters,
            summary: this.getCharactersContextSummary(),
            sessionDate: this.lastUpdate ? new Date(this.lastUpdate).toISOString().split('T')[0] : 'desconocida',
            totalCharacters: this.currentCharacters.length
        }
    };
}
}

// Exportar instancia única (singleton)
export default new CharacterContextService();