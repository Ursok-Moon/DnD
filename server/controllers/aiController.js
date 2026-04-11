import Groq from 'groq-sdk';
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFParser from 'pdf2json';
import { prompts, systemPrompts } from '../prompts/groqPrompts.js';
import characterContextService from '../services/characterContextService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Inicializar Groq
let groqClient = null;
let groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

try {
    if (!process.env.GROQ_API_KEY) {
        console.warn('⚠️  GROQ_API_KEY no encontrada en .env. Las funciones de IA no estarán disponibles.');
    } else {
        groqClient = new Groq({
            apiKey: process.env.GROQ_API_KEY
        });
        console.log(`✅ Groq inicializado correctamente`);
        console.log(`📌 Modelo configurado: ${groqModel}`);
        console.log(`🚀 Groq listo para usar!`);
    }
} catch (error) {
    console.error('❌ Error inicializando Groq:', error.message);
}

// Función para extraer texto de PDFs
async function extractPDFText(filePath) {
    return new Promise((resolve) => {
        const pdfParser = new PDFParser();
        
        pdfParser.on('pdfParser_data_error', (err) => {
            console.error('❌ Error parsing PDF:', err);
            resolve(`[No se pudo extraer texto del PDF. Archivo: ${path.basename(filePath)}. Error: ${err.message || err}]`);
        });
        
        pdfParser.on('pdfParser_data_ready', (pdfData) => {
            try {
                let text = '';
                
                if (pdfData && pdfData.formImage && pdfData.formImage.Pages) {
                    for (const page of pdfData.formImage.Pages) {
                        if (page.Texts && Array.isArray(page.Texts)) {
                            for (const textItem of page.Texts) {
                                if (textItem.R && textItem.R[0] && textItem.R[0].T) {
                                    const decodedText = decodeURIComponent(textItem.R[0].T);
                                    text += decodedText + ' ';
                                }
                            }
                        }
                    }
                }
                
                text = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
                
                if (!text || text.length === 0) {
                    text = `[El PDF "${path.basename(filePath)}" no contiene texto extraíble. Es posible que sea un documento escaneado.]`;
                } else {
                    console.log(`📄 Texto extraído con pdf2json: ${text.length} caracteres`);
                }
                
                resolve(text);
            } catch (error) {
                console.error('Error procesando texto del PDF:', error);
                resolve(`[Error extrayendo texto: ${error.message}]`);
            }
        });
        
        const timeout = setTimeout(() => {
            console.error('❌ Timeout extrayendo texto del PDF');
            resolve(`[Timeout extrayendo texto del PDF: ${path.basename(filePath)}]`);
        }, 30000);
        
        pdfParser.on('pdfParser_data_ready', () => clearTimeout(timeout));
        pdfParser.on('pdfParser_data_error', () => clearTimeout(timeout));
        
        pdfParser.loadPDF(filePath);
    });
}

/**
 * Verificar estado de la IA
 */
export const getAIStatus = async (req, res) => {
    try {
        const isAvailable = groqClient !== null && process.env.GROQ_API_KEY;
        
        // Cargar contexto de personajes para información adicional
        await characterContextService.loadCurrentCharacters();
        
        res.json({ 
            success: true, 
            available: isAvailable,
            model: groqModel,
            provider: 'groq',
            context: {
                charactersLoaded: characterContextService.currentCharacters.length,
                lastUpdate: characterContextService.lastUpdate
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Chat general con Groq (con contexto automático de personajes)
 */
export const chatWithGroq = async (req, res) => {
    try {
        const { message, history = [], context = {}, dmContext = null } = req.body;
        
        if (!message) {
            return res.status(400).json({ success: false, error: 'Mensaje no proporcionado' });
        }

        if (!groqClient) {
            return res.status(503).json({ success: false, error: 'Groq no disponible' });
        }

        // Construir contexto automático de personajes
        const characterContext = await characterContextService.buildAIContext(message, dmContext);
        
        // Combinar contexto manual con contexto automático
        const enhancedContext = {
            ...context,
            characters: characterContext.hasCharacters ? characterContext.contextString : null,
            mentionedCharacters: characterContext.mentionedCharacters.map(c => ({
                name: c.nombre,
                class: c.clase,
                race: c.raza,
                level: c.nivel,
                player: c.jugador
            })),
            totalPartyMembers: characterContext.fullContext?.totalCharacters || 0,
            sessionDate: characterContext.fullContext?.sessionDate || new Date().toISOString().split('T')[0]
        };

        const { system, user } = prompts.chat(enhancedContext, history, message);

        // Añadir el contexto de personajes al mensaje del usuario
        let enhancedUserMessage = user;
        if (characterContext.hasCharacters && !context.skipCharacterContext) {
            enhancedUserMessage = `${user}\n\n[CONTEXTO AUTOMÁTICO DE LA SESIÓN]\n${characterContext.contextString}`;
        }

        const messages = [
            { role: 'system', content: system },
            ...history,
            { role: 'user', content: enhancedUserMessage }
        ];

        const completion = await groqClient.chat.completions.create({
            messages: messages,
            model: groqModel,
            temperature: 0.7,
            max_tokens: 2048,
            top_p: 0.9,
        });

        const response = completion.choices[0]?.message?.content || 'Lo siento, no pude procesar tu solicitud.';

        // Incluir información de contexto en la respuesta
        res.json({
            success: true,
            response: response,
            model: groqModel,
            usage: completion.usage,
            context: {
                charactersFound: characterContext.mentionedCharacters.length,
                totalCharacters: characterContext.fullContext?.totalCharacters || 0,
                sessionDate: characterContext.fullContext?.sessionDate,
                mentionedCharacters: characterContext.mentionedCharacters.map(c => c.nombre)
            }
        });

    } catch (error) {
        console.error('Error en chat con Groq:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Error al procesar la solicitud',
            details: error.message 
        });
    }
};

/**
 * Chat con streaming (con contexto automático de personajes)
 */
export const chatWithGroqStream = async (req, res) => {
    try {
        const { message, history = [], context = {}, dmContext = null } = req.body;
        
        if (!message) {
            return res.status(400).json({ error: 'Mensaje no proporcionado' });
        }

        if (!groqClient) {
            return res.status(503).json({ error: 'Groq no disponible' });
        }

        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Transfer-Encoding', 'chunked');

        // Construir contexto automático
        const characterContext = await characterContextService.buildAIContext(message, dmContext);
        
        const enhancedContext = {
            ...context,
            characters: characterContext.hasCharacters ? characterContext.contextString : null
        };

        const { system, user } = prompts.chat(enhancedContext, history, message);

        let enhancedUserMessage = user;
        if (characterContext.hasCharacters && !context.skipCharacterContext) {
            enhancedUserMessage = `${user}\n\n[CONTEXTO DE LA SESIÓN]\n${characterContext.contextString}`;
        }

        const messages = [
            { role: 'system', content: system },
            ...history,
            { role: 'user', content: enhancedUserMessage }
        ];

        const stream = await groqClient.chat.completions.create({
            messages: messages,
            model: groqModel,
            temperature: 0.7,
            max_tokens: 2048,
            stream: true,
        });

        for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
                res.write(content);
            }
        }
        
        res.end();

    } catch (error) {
        console.error('Error en streaming:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        } else {
            res.end();
        }
    }
};

/**
 * Analizar PDF de personaje
 */
export const analyzePDF = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: 'PDF requerido' });
        }

        if (!groqClient) {
            return res.status(503).json({ success: false, error: 'Groq no disponible' });
        }

        const filePath = req.file.path;
        console.log(`📁 Archivo PDF guardado en: ${filePath}`);
        
        const extractedText = await extractPDFText(filePath);
        
        if (!extractedText || extractedText.trim().length === 0) {
            console.warn('⚠️ No se pudo extraer texto del PDF');
        } else {
            console.log(`📄 Texto extraído del PDF: ${extractedText.length} caracteres`);
        }

        const prompt = prompts.analyzePDF(req.file.originalname, extractedText);

        console.log('📤 Enviando prompt a Groq...');
        
        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompts.jsonOnly },
                { role: 'user', content: prompt }
            ],
            model: groqModel,
            temperature: 0.1,
            max_tokens: 8192,
        });

        let analysis = completion.choices[0]?.message?.content || '';
        console.log(`📥 Respuesta de Groq recibida: ${analysis.length} caracteres`);
        
        analysis = analysis.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        try {
            JSON.parse(analysis);
        } catch (parseError) {
            console.error('❌ Respuesta no es JSON válido, intentando extraer...');
            const jsonMatch = analysis.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                analysis = jsonMatch[0];
                try {
                    JSON.parse(analysis);
                } catch (e) {
                    throw new Error('No se pudo extraer JSON válido');
                }
            } else {
                throw new Error('No se encontró JSON en la respuesta');
            }
        }
        
        try {
            await fs.unlink(filePath);
            console.log(`🗑️ Archivo PDF eliminado: ${filePath}`);
        } catch (e) {
            console.warn('No se pudo eliminar el archivo PDF:', e.message);
        }
        
        // Refrescar contexto de personajes después de agregar uno nuevo
        await characterContextService.loadCurrentCharacters(true);
        
        res.json({ success: true, analysis });
        
    } catch (error) {
        console.error('❌ Error analizando PDF:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Mejorar entrada del bestiario
 */
export const enhanceBestiary = async (req, res) => {
    try {
        const { entry } = req.body;
        
        if (!entry || !entry.name) {
            return res.status(400).json({ success: false, error: 'Entrada de bestiario requerida' });
        }

        if (!groqClient) {
            return res.status(503).json({ success: false, error: 'Groq no disponible' });
        }

        const prompt = prompts.enhanceBestiary(entry);

        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompts.bestiary },
                { role: 'user', content: prompt }
            ],
            model: groqModel,
            temperature: 0.7,
            max_tokens: 1024,
        });

        let response = completion.choices[0]?.message?.content || '';
        response = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        let enhanced;
        try {
            enhanced = JSON.parse(response);
        } catch (e) {
            enhanced = { ...entry, description: response.substring(0, 500) };
        }

        res.json({ success: true, enhanced });
    } catch (error) {
        console.error('Error enhancing bestiary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Generar encuentro aleatorio
 */
export const generateEncounter = async (req, res) => {
    try {
        const { partyLevel = 1, location = 'genérica', environment = 'variado', partySize = 4 } = req.body;
        
        if (!groqClient) {
            return res.status(503).json({ success: false, error: 'Groq no disponible' });
        }

        const prompt = prompts.generateEncounter(partyLevel, location, environment, partySize);

        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompts.encounter },
                { role: 'user', content: prompt }
            ],
            model: groqModel,
            temperature: 0.8,
            max_tokens: 1024,
        });

        let response = completion.choices[0]?.message?.content || '';
        response = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        let encounter;
        try {
            encounter = JSON.parse(response);
        } catch (e) {
            encounter = { description: response.substring(0, 500) };
        }

        res.json({ success: true, encounter });
    } catch (error) {
        console.error('Error generating encounter:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Analizar personaje y dar recomendaciones
 */
export const analyzeCharacter = async (req, res) => {
    try {
        const { characterData } = req.body;
        
        if (!characterData || !characterData.nombre) {
            return res.status(400).json({ success: false, error: 'Datos de personaje requeridos' });
        }

        if (!groqClient) {
            return res.status(503).json({ success: false, error: 'Groq no disponible' });
        }

        const prompt = prompts.analyzeCharacter(characterData);

        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompts.characterAnalyzer },
                { role: 'user', content: prompt }
            ],
            model: groqModel,
            temperature: 0.7,
            max_tokens: 1024,
        });

        const analysis = completion.choices[0]?.message?.content || 'No se pudo analizar el personaje.';

        res.json({ success: true, analysis });
    } catch (error) {
        console.error('Error analyzing character:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Generar diálogo para NPC
 */
export const generateDialogue = async (req, res) => {
    try {
        const { npc, situation, playerAction = null } = req.body;
        
        if (!npc || !situation) {
            return res.status(400).json({ success: false, error: 'NPC y situación requeridos' });
        }

        if (!groqClient) {
            return res.status(503).json({ success: false, error: 'Groq no disponible' });
        }

        const prompt = prompts.generateDialogue(npc, situation, playerAction);

        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompts.npcInterpreter },
                { role: 'user', content: prompt }
            ],
            model: groqModel,
            temperature: 0.8,
            max_tokens: 1024,
        });

        const dialogue = completion.choices[0]?.message?.content || 'No se pudo generar el diálogo.';

        res.json({ success: true, dialogue });
    } catch (error) {
        console.error('Error generating dialogue:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Sugerir acciones para una situación
 */
export const suggestActions = async (req, res) => {
    try {
        const { situation, character = null } = req.body;
        
        if (!situation) {
            return res.status(400).json({ success: false, error: 'Situación requerida' });
        }

        if (!groqClient) {
            return res.status(503).json({ success: false, error: 'Groq no disponible' });
        }

        const prompt = prompts.suggestActions(situation, character);

        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompts.actionAdvisor },
                { role: 'user', content: prompt }
            ],
            model: groqModel,
            temperature: 0.7,
            max_tokens: 1024,
        });

        const actions = completion.choices[0]?.message?.content || 'No se pudieron sugerir acciones.';

        res.json({ success: true, actions });
    } catch (error) {
        console.error('Error suggesting actions:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Generar JSON estructurado
 */
export const generateStructuredJSON = async (req, res) => {
    try {
        const { instruction, data, schema } = req.body;
        
        if (!instruction) {
            return res.status(400).json({ success: false, error: 'Instrucción requerida' });
        }

        if (!groqClient) {
            return res.status(503).json({ success: false, error: 'Groq no disponible' });
        }

        const prompt = prompts.generateStructuredJSON(instruction, data, schema);

        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompts.jsonGenerator },
                { role: 'user', content: prompt }
            ],
            model: groqModel,
            temperature: 0.2,
            max_tokens: 4096,
        });
        
        let responseText = completion.choices[0]?.message?.content || '';
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(responseText);
        } catch (e) {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonResponse = JSON.parse(jsonMatch[0]);
            } else {
                throw new Error('No se pudo parsear el JSON');
            }
        }
        
        res.json({ success: true, data: jsonResponse });
    } catch (error) {
        console.error('Error generando JSON estructurado:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Consultar bestiario
 */
export const queryBestiary = async (req, res) => {
    try {
        const { creatureName, query = '' } = req.body;
        
        if (!creatureName) {
            return res.status(400).json({ success: false, error: 'Nombre de criatura requerido' });
        }

        if (!groqClient) {
            return res.status(503).json({ success: false, error: 'Groq no disponible' });
        }

        const prompt = prompts.queryBestiary(creatureName, query);

        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompts.default },
                { role: 'user', content: prompt }
            ],
            model: groqModel,
            temperature: 0.5,
            max_tokens: 1024,
        });

        const response = completion.choices[0]?.message?.content || 'No se encontró información sobre esta criatura.';

        res.json({ success: true, response });
    } catch (error) {
        console.error('Error querying bestiary:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Generar contenido RPG (encuentros, loot, quests)
 */
export const generateRPGContent = async (req, res) => {
    try {
        const { type, parameters = {} } = req.body;
        
        if (!groqClient) {
            return res.status(503).json({ success: false, error: 'Groq no disponible' });
        }
        
        let prompt = '';
        let systemPrompt = 'Eres un generador de contenido para juegos de rol. Crea contenido creativo y equilibrado.';
        
        switch(type) {
            case 'encounter':
                prompt = `Genera un encuentro aleatorio para nivel ${parameters.level || 1} en un entorno de ${parameters.environment || 'fantasía'}. Incluye criaturas y descripción. Devuelve en formato JSON con: name, description, enemies, challenge, rewards.`;
                break;
            case 'loot':
                prompt = `Genera un botín para un grupo de nivel ${parameters.level || 1}. Incluye monedas, objetos mágicos y objetos comunes. Devuelve en formato JSON.`;
                break;
            case 'quest':
                prompt = `Crea una misión secundaria para un grupo de nivel ${parameters.level || 1}. Incluye objetivo, recompensa y un giro interesante. Devuelve en formato JSON.`;
                break;
            default:
                prompt = parameters.customPrompt || 'Genera contenido de juego de rol interesante.';
                systemPrompt = systemPrompts.default;
        }
        
        const completion = await groqClient.chat.completions.create({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt }
            ],
            model: groqModel,
            temperature: 0.8,
            max_tokens: 1024,
        });

        const content = completion.choices[0]?.message?.content || 'No se pudo generar contenido.';

        res.json({
            success: true,
            content: content
        });

    } catch (error) {
        console.error('Error generando contenido:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Obtener contexto de personajes actual (endpoint especial)
 */
export const getCharacterContext = async (req, res) => {
    try {
        const { mentionText } = req.query;
        await characterContextService.loadCurrentCharacters(true);
        
        if (mentionText) {
            const context = await characterContextService.buildAIContext(mentionText);
            res.json({
                success: true,
                context: context
            });
        } else {
            const summary = characterContextService.getCharactersContextSummary();
            res.json({
                success: true,
                summary: summary,
                characters: characterContextService.currentCharacters,
                total: characterContextService.currentCharacters.length
            });
        }
    } catch (error) {
        console.error('Error obteniendo contexto:', error);
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Refrescar contexto de personajes
 */
export const refreshCharacterContext = async (req, res) => {
    try {
        await characterContextService.loadCurrentCharacters(true);
        res.json({
            success: true,
            characters: characterContextService.currentCharacters,
            total: characterContextService.currentCharacters.length,
            lastUpdate: characterContextService.lastUpdate,
            message: 'Contexto de personajes actualizado'
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Buscar personaje específico
 */
export const searchCharacter = async (req, res) => {
    try {
        const { name } = req.params;
        await characterContextService.loadCurrentCharacters();
        const character = characterContextService.findCharacterByName(name);
        
        if (character) {
            const detailedContext = characterContextService.getDetailedCharacterContext(name);
            res.json({
                success: true,
                character: character,
                detailedContext: detailedContext
            });
        } else {
            res.json({
                success: false,
                message: `No se encontró el personaje: ${name}`
            });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};