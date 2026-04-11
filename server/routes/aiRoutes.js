import express from 'express';
import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import {
    getAIStatus,
    chatWithGroq,
    chatWithGroqStream,
    analyzePDF,
    enhanceBestiary,
    generateEncounter,
    analyzeCharacter,
    generateDialogue,
    suggestActions,
    generateStructuredJSON,
    queryBestiary,
    generateRPGContent,
    getCharacterContext,
    refreshCharacterContext,
    searchCharacter
} from '../controllers/aiController.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configuración de multer para PDFs
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const uploadPath = path.join(__dirname, '../../data/pdfs');
        await fs.mkdir(uploadPath, { recursive: true });
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'pdf_' + uniqueSuffix + '.pdf');
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten PDFs'), false);
        }
    }
});

// ===== RUTAS PRINCIPALES =====

// Estado y health check
router.get('/status', getAIStatus);
router.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        service: 'Groq AI Assistant', 
        provider: 'groq',
        version: '1.0.0'
    });
});

// Chat
router.post('/chat', chatWithGroq);
router.post('/chat/stream', chatWithGroqStream);

// Análisis de PDF
router.post('/analyze-pdf', upload.single('pdf'), analyzePDF);

// Bestiario
router.post('/enhance-bestiary', enhanceBestiary);
router.post('/query-bestiary', queryBestiary);

// Encuentros
router.post('/generate-encounter', generateEncounter);

// Personajes
router.post('/analyze-character', analyzeCharacter);

// Diálogo
router.post('/generate-dialogue', generateDialogue);

// Acciones
router.post('/suggest-actions', suggestActions);

// JSON estructurado
router.post('/generate-json', generateStructuredJSON);

// Contenido RPG (compatibilidad)
router.post('/generate', generateRPGContent);

// ===== RUTAS DE CONTEXTO DE PERSONAJES =====

// Obtener contexto de personajes actual
router.get('/characters/context', getCharacterContext);

// Refrescar contexto de personajes
router.post('/characters/refresh', refreshCharacterContext);

// Buscar personaje específico
router.get('/characters/search/:name', searchCharacter);

// Obtener resumen rápido de personajes
router.get('/characters/summary', async (req, res) => {
    try {
        const characterContextService = (await import('../services/characterContextService.js')).default;
        await characterContextService.loadCurrentCharacters();
        const summary = characterContextService.getCharactersContextSummary();
        res.json({
            success: true,
            summary: summary,
            count: characterContextService.currentCharacters.length
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ===== RUTAS DE UTILIDAD =====

// Verificar qué personajes menciona un texto
router.post('/characters/detect', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, error: 'Texto requerido' });
        }
        
        const characterContextService = (await import('../services/characterContextService.js')).default;
        await characterContextService.loadCurrentCharacters();
        const mentions = characterContextService.detectCharacterMentions(text);
        
        res.json({
            success: true,
            mentions: mentions.map(m => ({
                type: m.type,
                character: {
                    nombre: m.character.nombre,
                    clase: m.character.clase,
                    raza: m.character.raza,
                    jugador: m.character.jugador
                },
                matched: m.matched
            }))
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Exportar router
export default router;