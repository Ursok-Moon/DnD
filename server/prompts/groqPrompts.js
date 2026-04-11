const prompts = {
    // Prompt para análisis de PDF (VERSIÓN COMPLETA de tu servidor original)
    analyzePDF: (fileName, extractedText) => {
        return `Eres un experto en D&D 5e analizando hojas de personaje desde un PDF.

INSTRUCCIONES CRÍTICAS:
1. EXTRAE TODO. No omitas nada. Si ves información en el PDF, debe estar en el JSON.
2. Calcula los modificadores de atributos como (valor - 10) / 2, redondeado hacia abajo.
3. Para CADA HABILIDAD, asigna el atributo correcto según el mapeo de D&D 5e.
4. Identifica qué habilidades tienen competencia (proficient: true) basado en la clase y nivel.
5. Identifica qué tiradas de salvación tienen competencia.
6. Extrae TODAS las competencias (armaduras, armas, herramientas, idiomas).
7. Extrae TODOS los rasgos raciales, de clase y dotes.

TEXTO EXTRAÍDO DEL PDF (nombre del archivo: ${fileName}):

${extractedText.substring(0, 15000)}

DEBES GENERAR UN JSON CON ESTA ESTRUCTURA EXACTA. NO FALTAN CAMPOS:

{
    "basicInfo": {
        "name": "Nombre completo del personaje",
        "class": "Clase y nivel (ej: Pícaro 2)",
        "race": "Raza y subraza (ej: Tiefling variante)",
        "background": "Trasfondo (ej: Ermitaño)",
        "alignment": "Alineamiento (ej: Caótico neutral)"
    },
    "attributes": [
        {"nombre": "Fuerza", "valor": 0, "modificador": 0},
        {"nombre": "DESTREZA", "valor": 0, "modificador": 0},
        {"nombre": "CONSTITUCIÓN", "valor": 0, "modificador": 0},
        {"nombre": "INTELIGENCIA", "valor": 0, "modificador": 0},
        {"nombre": "SABIDURÍA", "valor": 0, "modificador": 0},
        {"nombre": "CARISMA", "valor": 0, "modificador": 0}
    ],
    "hp": {"current": 0, "max": 0, "temp": 0},
    "mana": {"current": 0, "max": 0},
    "spellSlots": {"level": 1, "total": 0, "used": 0},
    "attacks": [],
    "spells": [],
    "exp": {"current": 0, "max": 300, "level": 1},
    "currency": {"gold": 0, "silver": 0, "copper": 0, "name": "Monedas", "goldName": "Oro", "silverName": "Plata", "copperName": "Cobre"},
    "treasures": [],
    "potions": [],
    "equipment": [],
    "notas": {
        "personalidad": "",
        "ideales": "",
        "vinculos": "",
        "defectos": "",
        "rasgos": ""
    },
    "deathSaves": {"successes": [false, false, false], "fails": [false, false, false]},
    "skills": [
        {"name": "Acrobacias", "attribute": "DESTREZA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Arcano", "attribute": "INTELIGENCIA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Atletismo", "attribute": "FUERZA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Engaño", "attribute": "CARISMA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Historia", "attribute": "INTELIGENCIA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Interpretación", "attribute": "CARISMA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Intimidación", "attribute": "CARISMA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Investigación", "attribute": "INTELIGENCIA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Juego de Manos", "attribute": "DESTREZA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Medicina", "attribute": "SABIDURÍA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Naturaleza", "attribute": "INTELIGENCIA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Percepción", "attribute": "SABIDURÍA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Perspicacia", "attribute": "SABIDURÍA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Persuasión", "attribute": "CARISMA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Religión", "attribute": "INTELIGENCIA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Sigilo", "attribute": "DESTREZA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Supervivencia", "attribute": "SABIDURÍA", "proficient": false, "expertise": false, "bonus": 0},
        {"name": "Trato con Animales", "attribute": "SABIDURÍA", "proficient": false, "expertise": false, "bonus": 0}
    ],
    "passivePerception": 0,
    "proficiencies": [],
    "savingThrows": [
        {"name": "Fuerza", "value": 0, "proficient": false},
        {"name": "DESTREZA", "value": 0, "proficient": false},
        {"name": "CONSTITUCIÓN", "value": 0, "proficient": false},
        {"name": "INTELIGENCIA", "value": 0, "proficient": false},
        {"name": "SABIDURÍA", "value": 0, "proficient": false},
        {"name": "CARISMA", "value": 0, "proficient": false}
    ]
}

GUÍA DE EXTRACCIÓN POR SECCIÓN:

=== COMPETENCIAS (proficiencies) ===
Extrae TODAS las competencias que aparezcan, clasificándolas por tipo:
- Armaduras: "Armadura ligera", "Armadura media", "Armadura pesada", "Escudos" → type: "armor"
- Armas: "Armas sencillas", "Armas marciales", "Ballesta de mano", "Daga", "Espada corta", etc. → type: "weapon"
- Herramientas: "Herramientas de ladrón", "Kit de herborista", etc. → type: "tool"
- Idiomas: "Común", "Celestial", "Abisal", "Infernal", "Enano", "Élfico" → type: "language"

=== ATAQUES (attacks) ===
Extrae cada ataque con:
- name: nombre del arma o ataque
- bonus: bonificación al ataque (ej: "+5")
- damage: dado de daño (ej: "1d4+3")

=== EQUIPO (equipment) ===
Extrae cada objeto con:
- name: nombre
- cost: valor en monedas (si se especifica)
- weight: peso en kg/libras
- description: descripción si la hay

=== RASGOS (notas.rasgos) ===
Extrae TODOS los rasgos raciales, de clase y dotes:
- Visión en la oscuridad
- Resistencia al fuego
- Alas/Alado
- Ataque furtivo (especificar dado: 1d6)
- Acción astuta
- Jerga de ladrones
- Cualquier otra habilidad especial

RESPONDE SOLO CON EL JSON COMPLETO, SIN TEXTO ADICIONAL, SIN MARKDOWN.`;
    },

    // Prompt para chat (versión completa)
    chat: (context, history, message) => {
        return {
            system: `Eres un asistente virtual para un juego de rol. 
Contexto adicional: ${JSON.stringify(context)}
Ayudas a los jugadores con:
- Reglas del juego
- Creación de personajes
- Resolución de acciones
- Interpretación de tiradas de dados
- Lore del mundo
Mantén respuestas concisas pero útiles, en español.`,
            user: message
        };
    },

    // Prompt para mejorar bestiario
    enhanceBestiary: (entry) => {
        return `Mejora esta entrada del bestiario con más detalles, estadísticas y lore. Devuelve SOLO JSON válido sin markdown:

Entrada original: ${JSON.stringify(entry)}

Genera una versión mejorada con:
- name: nombre
- description: descripción detallada
- stats: { strength, dexterity, constitution, intelligence, wisdom, charisma }
- abilities: habilidades especiales
- lore: información de trasfondo
- combat_tips: consejos para combatirla

Responde SOLO con el JSON, sin texto adicional.`;
    },

    // Prompt para generar encuentros
    generateEncounter: (partyLevel, location, environment, partySize) => {
        return `Genera un encuentro de juego de rol con:
- Nivel del grupo: ${partyLevel}
- Ubicación: ${location}
- Entorno: ${environment}
- Tamaño del grupo: ${partySize} jugadores

Devuelve SOLO JSON con:
{
  "name": "Nombre del encuentro",
  "description": "Descripción atmosférica",
  "enemies": ["enemigo1", "enemigo2"],
  "challenge": "Nivel de dificultad",
  "rewards": ["recompensa1", "recompensa2"],
  "special_mechanics": "Mecánicas especiales",
  "dm_tips": "Consejos para el DM"
}

Responde SOLO con el JSON, sin texto adicional.`;
    },

    // Prompt para analizar personaje
    analyzeCharacter: (characterData) => {
        return `Analiza este personaje de juego de rol y da recomendaciones:

Personaje: ${JSON.stringify(characterData)}

Proporciona:
1. Fortalezas del personaje
2. Debilidades
3. Sugerencias de mejora
4. Estrategias de juego recomendadas
5. Posibles arcos de historia

Responde en español de forma amigable y útil.`;
    },

    // Prompt para generar diálogo
    generateDialogue: (npc, situation, playerAction = null) => {
        let prompt = `Genera diálogo para un NPC en esta situación:

NPC: ${JSON.stringify(npc)}
Situación: ${situation}`;
        
        if (playerAction) {
            prompt += `\nAcción del jugador: ${playerAction}`;
        }
        
        prompt += `

Genera:
1. Frase de inicio del NPC
2. Posibles respuestas a diferentes acciones del jugador
3. Consejos para interpretar al NPC
4. Información clave que el NPC podría revelar

Responde en español de forma natural.`;

        return prompt;
    },

    // Prompt para sugerir acciones
    suggestActions: (situation, character = null) => {
        let prompt = `Sugiere acciones para esta situación de juego de rol:

Situación: ${situation}`;
        
        if (character) {
            prompt += `\nPersonaje: ${JSON.stringify(character)}`;
        } else {
            prompt += `\nSin personaje específico`;
        }
        
        prompt += `

Proporciona:
1. 3-5 acciones posibles con sus posibles consecuencias
2. Tiradas de dados recomendadas para cada acción
3. Dificultad estimada (CD)
4. Consejos de roleplay

Responde en español.`;

        return prompt;
    },

    // Prompt para generar JSON estructurado
    generateStructuredJSON: (instruction, data, schema) => {
        let prompt = `Genera JSON estructurado basado en: ${instruction}`;
        
        if (data) {
            prompt += `\nDatos de entrada: ${JSON.stringify(data)}`;
        }
        
        if (schema) {
            prompt += `\nSigue este esquema: ${JSON.stringify(schema)}`;
        }
        
        prompt += `\nResponde SOLO con JSON válido sin markdown.`;

        return prompt;
    },

    // Prompt para consultar bestiario
    queryBestiary: (creatureName, query = '') => {
        return `Proporciona información sobre ${creatureName}. ${query || 'Describe sus características principales, hábitat, comportamiento y peligrosidad.'}
Responde en español de forma concisa pero detallada.`;
    }
};

const systemPrompts = {
    default: 'Eres un asistente virtual para juegos de rol. Ayudas con reglas, personajes, dados y lore. Responde en español.',
    jsonOnly: 'Eres un experto en D&D 5e. Tu única función es analizar hojas de personaje y devolver JSON válido. Nunca agregues texto fuera del JSON. Responde SOLO con el JSON, sin explicaciones.',
    bestiary: 'Eres un experto en bestiario de juegos de rol. Responde SOLO con JSON válido.',
    encounter: 'Eres un generador de encuentros para juegos de rol. Responde SOLO con JSON válido.',
    characterAnalyzer: 'Eres un experto analizando personajes de juegos de rol.',
    npcInterpreter: 'Eres un experto en interpretación de NPCs para juegos de rol.',
    actionAdvisor: 'Eres un asistente de juego de rol que sugiere acciones útiles.',
    jsonGenerator: 'Eres un generador de JSON estructurado. Responde SOLO con JSON válido.'
};

export { prompts, systemPrompts };