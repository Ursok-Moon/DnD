import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_PATH = path.join(__dirname, '../../data');

class DMContextService {
    constructor() {
        this.bestiarioActual = null;
        this.bestiarioFuente = 'original';
        this.lastBestiaryUpdate = null;
        
        // Enemigos activos en la sesión (se actualizan desde el frontend)
        this.activeEnemies = [];
        this.activePlayers = [];
        this.initiativeOrder = [];
        this.currentRound = 1;
        this.currentTurn = 0;
        this.combatActive = false;
        
        this.lastUpdate = null;
    }

    /**
     * Cargar el bestiario actual (desde el archivo o desde el que envió el frontend)
     */
    async loadBestiary() {
        try {
            // Primero intentar cargar el bestiario original del servidor
            const bestiaryPath = path.join(DATA_PATH, 'bestiario.json');
            const data = await fs.readFile(bestiaryPath, 'utf8');
            this.bestiarioActual = JSON.parse(data);
            this.bestiarioFuente = 'original';
            this.lastBestiaryUpdate = Date.now();
            console.log(`📚 Bestiario cargado: ${this.bestiarioActual.length} criaturas`);
            return this.bestiarioActual;
        } catch (error) {
            console.error('Error cargando bestiario:', error);
            return null;
        }
    }

    /**
     * Actualizar bestiario personalizado desde el frontend
     */
    updateCustomBestiary(bestiarioData, fuente = 'personalizado') {
        if (bestiarioData && Array.isArray(bestiarioData)) {
            this.bestiarioActual = bestiarioData;
            this.bestiarioFuente = fuente;
            this.lastBestiaryUpdate = Date.now();
            console.log(`📚 Bestiario personalizado cargado: ${this.bestiarioActual.length} criaturas`);
            return true;
        }
        return false;
    }

    /**
     * Actualizar estado del combate desde el frontend
     */
    updateCombatState(combatData) {
        if (combatData.enemies) this.activeEnemies = combatData.enemies;
        if (combatData.players) this.activePlayers = combatData.players;
        if (combatData.initiativeOrder) this.initiativeOrder = combatData.initiativeOrder;
        if (combatData.currentRound !== undefined) this.currentRound = combatData.currentRound;
        if (combatData.currentTurn !== undefined) this.currentTurn = combatData.currentTurn;
        if (combatData.combatActive !== undefined) this.combatActive = combatData.combatActive;
        
        this.lastUpdate = Date.now();
        console.log(`⚔️ Estado de combate actualizado: ${this.activeEnemies.length} enemigos, ${this.activePlayers.length} jugadores`);
    }

    /**
     * Buscar criatura en el bestiario por nombre
     */
    findCreatureInBestiary(creatureName) {
        if (!this.bestiarioActual) return null;
        
        const searchTerm = creatureName.toLowerCase().trim();
        
        // Búsqueda exacta
        let found = this.bestiarioActual.find(c => 
            c.nombre?.toLowerCase() === searchTerm
        );
        
        // Búsqueda por inicio
        if (!found) {
            found = this.bestiarioActual.find(c => 
                c.nombre?.toLowerCase().startsWith(searchTerm)
            );
        }
        
        // Búsqueda por inclusión
        if (!found && searchTerm.length >= 3) {
            found = this.bestiarioActual.find(c => 
                c.nombre?.toLowerCase().includes(searchTerm)
            );
        }
        
        return found;
    }

    /**
     * Obtener contexto completo del combate actual
     */
    getCombatContext() {
        if (!this.combatActive && this.activeEnemies.length === 0) {
            return "No hay combate activo en este momento.";
        }

        let context = `⚔️ **ESTADO ACTUAL DEL COMBATE** ⚔️\n\n`;
        
        context += `📍 Ronda: ${this.currentRound}\n`;
        context += `🎯 Turno actual: ${this.currentTurn + 1} de ${this.initiativeOrder.length}\n`;
        
        if (this.initiativeOrder.length > 0 && this.initiativeOrder[this.currentTurn]) {
            const currentEntity = this.initiativeOrder[this.currentTurn];
            context += `👥 Turno de: ${currentEntity.name} (${currentEntity.type === 'player' ? 'Jugador' : 'Enemigo'})\n`;
        }
        
        context += `\n`;

        // Jugadores activos
        if (this.activePlayers.length > 0) {
            context += `🎭 **JUGADORES EN COMBATE** (${this.activePlayers.length})\n`;
            for (const player of this.activePlayers) {
                const hpPercent = player.maxHp > 0 ? (player.hp / player.maxHp) * 100 : 0;
                const hpStatus = hpPercent < 25 ? '⚠️ GRAVEMENTE HERIDO' : hpPercent < 50 ? '⚡ Herido' : '✅ Saludable';
                context += `- **${player.name}**: CA ${player.ca} | ❤️ ${player.hp}/${player.maxHp} (${hpStatus}) | Iniciativa: ${player.initiative || 0}\n`;
            }
            context += `\n`;
        }

        // Enemigos activos
        if (this.activeEnemies.length > 0) {
            context += `👹 **ENEMIGOS EN COMBATE** (${this.activeEnemies.length})\n`;
            for (const enemy of this.activeEnemies) {
                const hpPercent = enemy.maxHp > 0 ? (enemy.hp / enemy.maxHp) * 100 : 0;
                const hpStatus = hpPercent < 25 ? '💀 Casi muerto' : hpPercent < 50 ? '⚡ Herido' : '💪 Saludable';
                context += `- **${enemy.name}** ${enemy.race ? `(${enemy.race})` : ''}: CA ${enemy.ca} | ❤️ ${enemy.hp}/${enemy.maxHp} (${hpStatus}) | Iniciativa: ${enemy.initiative || 0}\n`;
            }
            context += `\n`;
        }

        // Orden de iniciativa
        if (this.initiativeOrder.length > 0) {
            context += `📋 **ORDEN DE INICIATIVA**\n`;
            for (let i = 0; i < this.initiativeOrder.length; i++) {
                const entity = this.initiativeOrder[i];
                const isCurrent = i === this.currentTurn;
                context += `${isCurrent ? '▶' : '  '} ${i + 1}. ${entity.name} (${entity.type === 'player' ? 'Jugador' : 'Enemigo'}) - Iniciativa: ${entity.initiative}\n`;
            }
        }

        return context;
    }

    /**
     * Obtener información detallada de una criatura del bestiario
     */
    getCreatureDetails(creatureName) {
        const creature = this.findCreatureInBestiary(creatureName);
        
        if (!creature) {
            return null;
        }

        let details = `📖 **FICHA DE CRIATURA: ${creature.nombre}**\n\n`;
        
        if (creature.descripcion) {
            details += `📝 **Descripción:** ${creature.descripcion}\n\n`;
        }
        
        if (creature.estadisticas) {
            const stats = creature.estadisticas;
            details += `📊 **Estadísticas:**\n`;
            if (stats.tipo) details += `- Tipo: ${stats.tipo}\n`;
            if (stats.ca) details += `- Clase de Armadura (CA): ${stats.ca}\n`;
            if (stats.pg) details += `- Puntos de Golpe (PG): ${stats.pg}\n`;
            if (stats.velocidad) details += `- Velocidad: ${stats.velocidad}\n`;
            
            // Atributos
            details += `- Atributos: `;
            const attrs = [];
            if (stats.FUE) attrs.push(`FUE: ${stats.FUE}`);
            if (stats.DES) attrs.push(`DES: ${stats.DES}`);
            if (stats.CON) attrs.push(`CON: ${stats.CON}`);
            if (stats.INT) attrs.push(`INT: ${stats.INT}`);
            if (stats.SAB) attrs.push(`SAB: ${stats.SAB}`);
            if (stats.CAR) attrs.push(`CAR: ${stats.CAR}`);
            details += attrs.join(', ') + '\n';
            
            // Habilidades especiales
            if (stats.habilidades) details += `- Habilidades: ${stats.habilidades}\n`;
            if (stats.resistencias) details += `- Resistencias: ${stats.resistencias}\n`;
            if (stats.inmunidades_daño) details += `- Inmunidades al daño: ${stats.inmunidades_daño}\n`;
            if (stats.sentidos) details += `- Sentidos: ${stats.sentidos}\n`;
            if (stats.idiomas) details += `- Idiomas: ${stats.idiomas}\n`;
            if (stats.desafio) details += `- Nivel de Desafío: ${stats.desafio}\n`;
            
            // Acciones
            if (stats.acciones && stats.acciones.length > 0) {
                details += `\n⚔️ **Acciones:**\n`;
                for (const action of stats.acciones) {
                    details += `- **${action.nombre}**: ${action.descripcion}\n`;
                }
            }
            
            // Atributos especiales
            if (stats.atributos_especiales && stats.atributos_especiales.length > 0) {
                details += `\n✨ **Habilidades Especiales:**\n`;
                for (const attr of stats.atributos_especiales) {
                    details += `- **${attr.nombre}**: ${attr.descripcion}\n`;
                }
            }
        }
        
        return details;
    }

    /**
     * Sugerir estrategias basadas en el combate actual
     */
    getCombatStrategies() {
        if (!this.combatActive && this.activeEnemies.length === 0) {
            return null;
        }

        let strategies = `🎯 **SUGERENCIAS ESTRATÉGICAS**\n\n`;
        
        // Analizar enemigos más débiles
        const weakEnemies = this.activeEnemies.filter(e => e.hp < e.maxHp * 0.3);
        if (weakEnemies.length > 0) {
            strategies += `⚠️ Enemigos debilitados: ${weakEnemies.map(e => e.name).join(', ')} están casi muertos. ¡Priorizarlos!\n\n`;
        }
        
        // Analizar jugadores heridos
        const hurtPlayers = this.activePlayers.filter(p => p.hp < p.maxHp * 0.5);
        if (hurtPlayers.length > 0 && this.combatActive) {
            strategies += `🩺 Jugadores heridos: ${hurtPlayers.map(p => p.name).join(', ')} necesitan curación urgente.\n\n`;
        }
        
        // Analizar enemigos por tipo (si hay información del bestiario)
        for (const enemy of this.activeEnemies) {
            if (enemy.race) {
                const creatureInfo = this.findCreatureInBestiary(enemy.race);
                if (creatureInfo?.estadisticas) {
                    const stats = creatureInfo.estadisticas;
                    if (stats.resistencias) {
                        strategies += `💡 ${enemy.name} tiene resistencia a: ${stats.resistencias}. Evita ese tipo de daño.\n`;
                    }
                    if (stats.inmunidades_daño) {
                        strategies += `💡 ${enemy.name} es inmune a: ${stats.inmunidades_daño}.\n`;
                    }
                    if (stats.atributos_especiales) {
                        const special = stats.atributos_especiales.find(a => a.nombre?.toLowerCase().includes('debuff') || a.nombre?.toLowerCase().includes('debilitar'));
                        if (special) {
                            strategies += `⚠️ Cuidado: ${enemy.name} puede usar "${special.nombre}".\n`;
                        }
                    }
                }
            }
        }
        
        return strategies;
    }

    /**
     * Construir contexto completo para la IA
     */
    async buildAIContext(userMessage, combatData = null) {
        // Actualizar estado de combate si se proporcionó
        if (combatData) {
            this.updateCombatState(combatData);
        }
        
        // Asegurar que el bestiario esté cargado
        if (!this.bestiarioActual) {
            await this.loadBestiary();
        }
        
        let contextString = "";
        
        // Contexto de combate
        if (this.combatActive || this.activeEnemies.length > 0) {
            contextString += this.getCombatContext();
            contextString += "\n";
            
            const strategies = this.getCombatStrategies();
            if (strategies) {
                contextString += strategies;
                contextString += "\n";
            }
        }
        
        // Detectar menciones a criaturas del bestiario
        const creatureMentions = this.detectCreatureMentions(userMessage);
        if (creatureMentions.length > 0) {
            contextString += `📖 **INFORMACIÓN DE BESTIARIO**\n\n`;
            for (const creature of creatureMentions) {
                const details = this.getCreatureDetails(creature);
                if (details) {
                    contextString += details;
                    contextString += "\n";
                }
            }
        }
        
        // Instrucciones para la IA
        contextString += `\n📖 **INSTRUCCIONES ESPECIALES**\n`;
        contextString += `- Eres el "Erudito", un asistente sabio y conocedor del mundo.\n`;
        contextString += `- Usa la información del bestiario para dar consejos tácticos sobre criaturas.\n`;
        contextString += `- Si el grupo está en combate, sugiere estrategias basadas en el estado actual.\n`;
        contextString += `- Si un jugador está herido, sugiere opciones de curación o retirada.\n`;
        contextString += `- Puedes hacer referencia a habilidades específicas de los enemigos.\n`;
        contextString += `- Responde en español, con un tono acorde a un sabio consejero.\n`;
        
        return {
            hasContext: true,
            contextString: contextString,
            combatActive: this.combatActive,
            activeEnemies: this.activeEnemies.length,
            activePlayers: this.activePlayers.length
        };
    }

    /**
     * Detectar menciones a criaturas en el texto del usuario
     */
    detectCreatureMentions(text) {
        if (!this.bestiarioActual) return [];
        
        const mentions = [];
        const lowerText = text.toLowerCase();
        
        for (const creature of this.bestiarioActual) {
            const name = creature.nombre?.toLowerCase();
            if (name && lowerText.includes(name)) {
                mentions.push(creature.nombre);
            }
        }
        
        // También detectar enemigos actuales por nombre
        for (const enemy of this.activeEnemies) {
            const enemyName = enemy.name?.toLowerCase();
            if (enemyName && lowerText.includes(enemyName)) {
                if (!mentions.includes(enemy.name)) {
                    mentions.push(enemy.name);
                }
            }
            if (enemy.race && lowerText.includes(enemy.race.toLowerCase())) {
                if (!mentions.includes(enemy.race)) {
                    mentions.push(enemy.race);
                }
            }
        }
        
        return [...new Set(mentions)]; // Eliminar duplicados
    }

    /**
     * Resetear estado de combate
     */
    resetCombatState() {
        this.activeEnemies = [];
        this.activePlayers = [];
        this.initiativeOrder = [];
        this.currentRound = 1;
        this.currentTurn = 0;
        this.combatActive = false;
        this.lastUpdate = Date.now();
        console.log('🔄 Estado de combate reseteado');
    }
}

// Exportar instancia única
export default new DMContextService();