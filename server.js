import express from 'express';
import cors from 'cors';
import path from 'path';
import { promises as fs } from 'fs';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import multer from 'multer';
import archiver from 'archiver';

// Importar rutas de IA y WebSockets
import aiRoutes from './server/routes/aiRoutes.js';
import setupWebSocketHandlers from './server/middleware/websocketHandlers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// ===== MIDDLEWARE =====
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Middleware para detectar IP
app.use((req, res, next) => {
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const isLocalhost = clientIP === '::1' || clientIP === '::ffff:127.0.0.1' || clientIP === '127.0.0.1' || clientIP === 'localhost';
    
    req.userInfo = {
        ip: clientIP,
        isLocalhost: isLocalhost,
        isDM: isLocalhost,
        userType: isLocalhost ? 'dm' : 'player'
    };
    
    console.log(`👤 Conexión desde: ${clientIP} (${isLocalhost ? 'DM' : 'Jugador'})`);
    next();
});

const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const DATA_PATH = process.env.JSON_PATH || path.join(__dirname, 'data');

console.log(`📡 Servidor configurado en: ${SERVER_URL}`);
console.log(`📁 Ruta de datos: ${DATA_PATH}`);

// ===== CONFIGURACIÓN DE MULTER PARA SUBIR ARCHIVOS =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath;
        if (file.mimetype === 'application/pdf') {
            uploadPath = path.join(__dirname, 'data', 'pdfs');
        } else {
            uploadPath = path.join(__dirname, 'data', 'imagenes');
        }
        fs.mkdir(uploadPath, { recursive: true }).then(() => {
            cb(null, uploadPath);
        }).catch(err => {
            cb(err, uploadPath);
        });
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        let prefix = file.mimetype === 'application/pdf' ? 'pdf_' : 'pj_';
        cb(null, prefix + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes y PDFs'), false);
        }
    }
});

// ===== WEBSOCKETS =====
setupWebSocketHandlers(io);

// ===== RUTAS DE IA =====
app.use('/api/ai', aiRoutes);

console.log('🤖 Rutas de IA con Groq configuradas:');
console.log('   - GET  /api/ai/status');
console.log('   - POST /api/ai/chat');
console.log('   - POST /api/ai/chat/stream');
console.log('   - POST /api/ai/analyze-pdf');
console.log('   - POST /api/ai/enhance-bestiary');
console.log('   - POST /api/ai/generate-encounter');
console.log('   - POST /api/ai/analyze-character');
console.log('   - POST /api/ai/generate-dialogue');
console.log('   - POST /api/ai/suggest-actions');
console.log('   - POST /api/ai/generate-json');
console.log('   - POST /api/ai/query-bestiary');

// ===== SERVIDOR DE ARCHIVOS ESTÁTICOS =====
app.use(express.static(path.join(__dirname)));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/src/FROND', express.static(path.join(__dirname, 'src/FROND')));
app.use('/src/CSS', express.static(path.join(__dirname, 'src/CSS')));
app.use('/src/JS', express.static(path.join(__dirname, 'src/JS')));
app.use('/src/Cartas', express.static(path.join(__dirname, 'src/Cartas')));
app.use('/src/demo', express.static(path.join(__dirname, 'src/demo')));

app.use('/data/imagenes', express.static(path.join(__dirname, 'data', 'imagenes')));
app.use('/data/pdfs', express.static(path.join(__dirname, 'data', 'pdfs')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/data/personajes', express.static(path.join(__dirname, 'data', 'personajes')));

// ===== FUNCIONES DE INICIALIZACIÓN =====
async function inicializarArchivoSesion() {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        
        const personajesPath = path.join(DATA_PATH, 'personajes');
        await fs.mkdir(personajesPath, { recursive: true });
        
        const imagenesPath = path.join(DATA_PATH, 'imagenes');
        await fs.mkdir(imagenesPath, { recursive: true });
        
        const pdfsPath = path.join(DATA_PATH, 'pdfs');
        await fs.mkdir(pdfsPath, { recursive: true });
        
        const archivoHoy = path.join(personajesPath, `${hoy}.json`);
        
        try {
            await fs.access(archivoHoy);
            console.log(`📁 Archivo de sesión para ${hoy} ya existe`);
        } catch {
            const sesionInicial = {
                fecha: hoy,
                personajes: [],
                creado: new Date().toISOString(),
                sesion: `Sesión del ${hoy}`
            };
            
            await fs.writeFile(archivoHoy, JSON.stringify(sesionInicial, null, 2));
            console.log(`✅ Archivo de sesión creado: ${hoy}.json`);
        }
        
        const archivoHoyLink = path.join(DATA_PATH, 'personajes_hoy.json');
        const contenidoHoy = await fs.readFile(archivoHoy, 'utf8');
        await fs.writeFile(archivoHoyLink, contenidoHoy);
        
        console.log(`📋 Archivo personajes_hoy.json actualizado`);
        
    } catch (error) {
        console.error('❌ Error inicializando archivo de sesión:', error);
    }
}

async function limpiarArchivosAntiguos(diasAMantener = 30) {
    try {
        const personajesPath = path.join(DATA_PATH, 'personajes');
        const archivos = await fs.readdir(personajesPath);
        
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - diasAMantener);
        
        for (const archivo of archivos) {
            if (!archivo.match(/^\d{4}-\d{2}-\d{2}\.json$/)) continue;
            
            const fechaArchivoStr = archivo.replace('.json', '');
            const fechaArchivo = new Date(fechaArchivoStr);
            
            if (fechaArchivo < fechaLimite) {
                await fs.unlink(path.join(personajesPath, archivo));
                console.log(`🧹 Archivo antiguo eliminado: ${archivo}`);
            }
        }
    } catch (error) {
        console.error('Error limpiando archivos antiguos:', error);
    }
}

// ===== ENDPOINTS ADICIONALES =====

// Usuarios
app.post('/api/usuario/registrar', async (req, res) => {
    try {
        const { nombre, socketId, ip } = req.body;
        
        if (!nombre || nombre.trim().length < 2) {
            return res.status(400).json({ error: 'Nombre debe tener al menos 2 caracteres' });
        }
        
        const usuariosPath = path.join(DATA_PATH, 'usuarios.json');
        
        let usuarios = { usuarios: [] };
        try {
            const data = await fs.readFile(usuariosPath, 'utf8');
            usuarios = JSON.parse(data);
        } catch (e) {}
        
        const index = usuarios.usuarios.findIndex(u => u.nombre === nombre);
        
        const usuarioData = {
            nombre: nombre.trim(),
            socketId: socketId,
            ip: ip,
            ultimaConexion: new Date().toISOString(),
            fechaRegistro: index !== -1 ? usuarios.usuarios[index].fechaRegistro : new Date().toISOString()
        };
        
        if (index !== -1) {
            usuarios.usuarios[index] = usuarioData;
        } else {
            usuarios.usuarios.push(usuarioData);
        }
        
        await fs.writeFile(usuariosPath, JSON.stringify(usuarios, null, 2));
        
        console.log(`👤 Usuario registrado: ${nombre} desde ${ip}`);
        
        res.json({ 
            success: true, 
            usuario: usuarioData,
            mensaje: 'Usuario registrado correctamente'
        });
        
    } catch (error) {
        console.error('Error registrando usuario:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/usuarios', async (req, res) => {
    try {
        const usuariosPath = path.join(DATA_PATH, 'usuarios.json');
        let usuarios = { usuarios: [] };
        
        try {
            const data = await fs.readFile(usuariosPath, 'utf8');
            usuarios = JSON.parse(data);
        } catch (e) {}
        
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Imágenes
app.post('/api/imagenes/subir', upload.single('imagen'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No se subió ninguna imagen' });
        }
        
        const imagenUrl = `/data/imagenes/${req.file.filename}`;
        console.log('✅ Imagen guardada:', imagenUrl);
        
        res.json({ 
            success: true, 
            imagenUrl: imagenUrl,
            filename: req.file.filename
        });
    } catch (error) {
        console.error('❌ Error subiendo imagen:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/imagenes/listar', async (req, res) => {
    try {
        const imagenesPath = path.join(__dirname, 'data', 'imagenes');
        await fs.mkdir(imagenesPath, { recursive: true });
        
        const files = await fs.readdir(imagenesPath);
        const images = await Promise.all(
            files
                .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
                .map(async (f) => {
                    const stat = await fs.stat(path.join(imagenesPath, f));
                    return {
                        filename: f,
                        url: `/data/imagenes/${f}`,
                        size: stat.size,
                        modified: stat.mtime
                    };
                })
        );
        
        res.json({ images });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/imagenes/eliminar', async (req, res) => {
    try {
        const { filename } = req.body;
        
        if (!filename || filename.includes('..') || filename.includes('/')) {
            return res.status(400).json({ error: 'Nombre inválido' });
        }
        
        const imagePath = path.join(__dirname, 'data', 'imagenes', filename);
        await fs.unlink(imagePath);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/imagenes/limpiar-todas', async (req, res) => {
    try {
        const imagenesPath = path.join(__dirname, 'data', 'imagenes');
        const files = await fs.readdir(imagenesPath);
        
        let deleted = 0;
        for (const file of files) {
            if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
                await fs.unlink(path.join(imagenesPath, file));
                deleted++;
            }
        }
        
        res.json({ success: true, deleted });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// JSON management
app.get('/api/json/list', async (req, res) => {
    try {
        const archivosOcultos = [
            'bestiario.json',
            'bestiario-eng.json', 
            'demo.json'
        ];
        
        async function getJsonFiles(dir, baseDir = '') {
            let results = [];
            const items = await fs.readdir(dir);
            
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const relativePath = path.join(baseDir, item);
                const stat = await fs.stat(fullPath);
                
                if (stat.isDirectory()) {
                    const subFiles = await getJsonFiles(fullPath, relativePath);
                    results = results.concat(subFiles);
                } else if (item.endsWith('.json')) {
                    if (!archivosOcultos.includes(item)) {
                        results.push({
                            name: relativePath,
                            size: stat.size,
                            modified: stat.mtime,
                            path: relativePath,
                            isProtected: false
                        });
                    }
                }
            }
            return results;
        }
        
        const jsonFiles = await getJsonFiles(DATA_PATH);
        res.json({ files: jsonFiles });
    } catch (error) {
        console.error('Error listing JSON files:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/json/upload', (req, res) => {
    const { filename, content } = req.body;
    const filePath = path.join(DATA_PATH, filename);
    
    fs.writeFile(filePath, content, 'utf8', (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/api/json/delete', async (req, res) => {
    try {
        const { filename } = req.body;
        
        if (!filename || filename.includes('..')) {
            return res.status(400).json({ error: 'Nombre inválido' });
        }
        
        const filePath = path.join(DATA_PATH, 'personajes', filename);
        
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }
        
        await fs.unlink(filePath);
        console.log(`🗑️ Archivo eliminado: ${filename}`);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/json/export-all', (req, res) => {
    const dataDir = path.join(__dirname, 'data');
    const outputPath = path.join(__dirname, 'temp', 'backup.zip');
    
    if (!require('fs').existsSync(path.join(__dirname, 'temp'))) {
        require('fs').mkdirSync(path.join(__dirname, 'temp'));
    }
    
    const output = require('fs').createWriteStream(outputPath);
    const archive = archiver('zip');
    
    archive.pipe(output);
    archive.directory(dataDir, false);
    archive.finalize();
    
    output.on('close', () => {
        res.download(outputPath, 'backup.zip', (err) => {
            if (err) console.error(err);
            require('fs').unlinkSync(outputPath);
        });
    });
});

app.get('/api/json/stats', async (req, res) => {
    try {
        const dataDir = path.join(__dirname, 'data');
        const imagenesPath = path.join(__dirname, 'data', 'imagenes');
        
        let stats = {
            bestiary: 0,
            players: 0,
            sessions: 0,
            totalSize: 0,
            images: {
                count: 0,
                size: 0
            }
        };
        
        async function countJsonFiles(dir) {
            let count = 0;
            try {
                const items = await fs.readdir(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    const stat = await fs.stat(fullPath);
                    
                    if (stat.isDirectory()) {
                        count += await countJsonFiles(fullPath);
                    } else if (item.endsWith('.json')) {
                        const fileStat = await fs.stat(fullPath);
                        stats.totalSize += fileStat.size;
                        
                        if (item.includes('bestiario')) stats.bestiary++;
                        if (item.includes('personajes')) stats.players++;
                        if (item.includes('session')) stats.sessions++;
                        count++;
                    }
                }
            } catch (error) {
                console.error('Error counting JSON files:', error);
            }
            return count;
        }
        
        await countJsonFiles(dataDir);
        
        const imageFiles = await fs.readdir(imagenesPath).catch(() => []);
        stats.images.count = imageFiles.filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f)).length;
        
        for (const file of imageFiles) {
            if (/\.(jpg|jpeg|png|gif|webp)$/i.test(file)) {
                const stat = await fs.stat(path.join(imagenesPath, file));
                stats.images.size += stat.size;
                stats.totalSize += stat.size;
            }
        }
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/json/:tipo', async (req, res) => {
    try {
        const { tipo } = req.params;
        const rutaJson = path.join(DATA_PATH, `${tipo}.json`);
        const datos = await fs.readFile(rutaJson, 'utf8');
        res.json(JSON.parse(datos));
    } catch (error) {
        res.status(500).json({ error: 'Error al leer los datos' });
    }
});

app.post('/api/json/:tipo', async (req, res) => {
    try {
        const { tipo } = req.params;
        const nuevosDatos = req.body;
        const rutaJson = path.join(DATA_PATH, `${tipo}.json`);
        await fs.writeFile(rutaJson, JSON.stringify(nuevosDatos, null, 2));
        res.json({ mensaje: 'Datos guardados correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al guardar los datos' });
    }
});

// Bestiario
app.get('/api/bestiario/buscar/:termino', async (req, res) => {
    try {
        const { termino } = req.params;
        const rutaJson = path.join(DATA_PATH, 'bestiario.json');
        const datos = await fs.readFile(rutaJson, 'utf8');
        const bestiario = JSON.parse(datos);
        const resultados = bestiario.filter(item => 
            item.nombre?.toLowerCase().includes(termino.toLowerCase()) ||
            item.descripcion?.toLowerCase().includes(termino.toLowerCase())
        );
        res.json(resultados);
    } catch (error) {
        res.status(500).json({ error: 'Error en la búsqueda' });
    }
});

// Utilidades
app.get('/api/check-localhost', (req, res) => {
    res.json({ 
        isLocalhost: req.userInfo.isLocalhost,
        userType: req.userInfo.userType 
    });
});

app.post('/api/dm-login', (req, res) => {
    const { password } = req.body;
    const DM_PASSWORD = process.env.DM_PASSWORD || 'dm1234';
    
    if (password === DM_PASSWORD && req.userInfo.isLocalhost) {
        res.json({ success: true, message: 'DM authenticated' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.get('/api/jugadores', async (req, res) => {
    try {
        const rutaJugadores = path.join(DATA_PATH, 'jugadores.json');
        let jugadores = { jugadores: [] };
        try {
            const data = await fs.readFile(rutaJugadores, 'utf8');
            jugadores = JSON.parse(data);
        } catch (e) {}
        res.json(jugadores);
    } catch (error) {
        res.status(500).json({ error: 'Error al leer jugadores' });
    }
});

app.post('/api/jugadores/registrar', async (req, res) => {
    try {
        const jugadorData = req.body;
        const rutaJugadores = path.join(DATA_PATH, 'jugadores.json');
        
        let jugadores = { jugadores: [] };
        try {
            const data = await fs.readFile(rutaJugadores, 'utf8');
            jugadores = JSON.parse(data);
        } catch (e) {}
        
        const index = jugadores.jugadores.findIndex(j => j.id === jugadorData.id);
        
        if (index !== -1) {
            jugadores.jugadores[index] = jugadorData;
        } else {
            jugadores.jugadores.push(jugadorData);
        }
        
        await fs.writeFile(rutaJugadores, JSON.stringify(jugadores, null, 2));
        res.json({ success: true, jugador: jugadorData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Personajes
app.post('/api/personajes/guardar', async (req, res) => {
    try {
        const personajeData = req.body;
        
        if (!personajeData.nombre) {
            return res.status(400).json({ error: 'El personaje debe tener un nombre' });
        }
        
        if (!personajeData.colores_personalizados) {
            personajeData.colores_personalizados = {};
            console.log('🎨 Añadiendo campo colores_personalizados vacío');
        } else {
            console.log('🎨 Colores personalizados recibidos:', personajeData.colores_personalizados);
        }
        
        const hoy = new Date().toISOString().split('T')[0];
        
        const personajesPath = path.join(DATA_PATH, 'personajes');
        await fs.mkdir(personajesPath, { recursive: true });
        
        const rutaPersonajes = path.join(personajesPath, `${hoy}.json`);
        
        let personajesHoy = { fecha: hoy, personajes: [] };
        try {
            const data = await fs.readFile(rutaPersonajes, 'utf8');
            personajesHoy = JSON.parse(data);
        } catch (e) {
            console.log('📁 Creando nuevo archivo de personajes para hoy');
        }
        
        const index = personajesHoy.personajes.findIndex(p => 
            p.id === personajeData.id || p.nombre === personajeData.nombre
        );
        
        if (index !== -1) {
            personajesHoy.personajes[index] = personajeData;
            console.log(`🔄 Personaje actualizado: ${personajeData.nombre}`);
        } else {
            personajesHoy.personajes.push(personajeData);
            console.log(`➕ Nuevo personaje guardado: ${personajeData.nombre}`);
        }
        
        await fs.writeFile(rutaPersonajes, JSON.stringify(personajesHoy, null, 2));
        
        const rutaHoy = path.join(DATA_PATH, 'personajes_hoy.json');
        await fs.writeFile(rutaHoy, JSON.stringify(personajesHoy, null, 2));
        
        console.log(`✅ Personaje guardado con ${Object.keys(personajeData.colores_personalizados || {}).length} colores personalizados`);
        
        io.emit('personaje-guardado', {
            personaje: {
                nombre: personajeData.nombre,
                jugador: personajeData.jugador,
                nivel: personajeData.nivel,
                clase: personajeData.clase
            },
            timestamp: new Date().toISOString()
        });
        
        res.json({ 
            success: true, 
            personaje: personajeData,
            mensaje: 'Personaje guardado correctamente'
        });
        
    } catch (error) {
        console.error('❌ Error guardando personaje:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/personajes/hoy', async (req, res) => {
    try {
        const rutaHoy = path.join(DATA_PATH, 'personajes_hoy.json');
        
        let personajesHoy = { 
            fecha: new Date().toISOString().split('T')[0], 
            personajes: [] 
        };
        
        try {
            const data = await fs.readFile(rutaHoy, 'utf8');
            personajesHoy = JSON.parse(data);
            
            personajesHoy.personajes = personajesHoy.personajes.map(p => {
                if (!p.colores_personalizados) {
                    p.colores_personalizados = {};
                }
                return p;
            });
            
            console.log(`📊 ${personajesHoy.personajes.length} personajes servidos`);
        } catch (e) {
            console.log('📁 No hay personajes guardados hoy');
        }
        
        res.json(personajesHoy);
    } catch (error) {
        console.error('❌ Error al leer personajes:', error);
        res.status(500).json({ error: 'Error al leer personajes' });
    }
});

app.get('/api/personajes/check', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'API de personajes funcionando',
        clientIP: req.userInfo?.ip || 'desconocida',
        isLocalhost: req.userInfo?.isLocalhost || false
    });
});

app.get('/api/personajes/:fecha', async (req, res) => {
    try {
        const { fecha } = req.params;
        const rutaPersonajes = path.join(DATA_PATH, 'personajes', `${fecha}.json`);
        
        let personajes = { fecha, personajes: [] };
        try {
            const data = await fs.readFile(rutaPersonajes, 'utf8');
            personajes = JSON.parse(data);
        } catch (e) {}
        
        res.json(personajes);
    } catch (error) {
        res.status(500).json({ error: 'Error al leer personajes' });
    }
});

app.get('/api/personajes/buscar/:termino', async (req, res) => {
    try {
        const { termino } = req.params;
        const rutaHoy = path.join(DATA_PATH, 'personajes_hoy.json');
        
        let personajesHoy = { personajes: [] };
        try {
            const data = await fs.readFile(rutaHoy, 'utf8');
            personajesHoy = JSON.parse(data);
        } catch (e) {
            return res.json([]);
        }
        
        const resultados = personajesHoy.personajes.filter(p => 
            p.nombre?.toLowerCase().includes(termino.toLowerCase()) ||
            p.jugador?.toLowerCase().includes(termino.toLowerCase()) ||
            p.clase?.toLowerCase().includes(termino.toLowerCase())
        );
        
        res.json(resultados);
    } catch (error) {
        res.status(500).json({ error: 'Error en la búsqueda' });
    }
});

app.get('/api/sesion/actual', async (req, res) => {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        const rutaPersonajes = path.join(DATA_PATH, 'personajes', `${hoy}.json`);
        
        let sesionInfo = {
            fecha: hoy,
            totalPersonajes: 0,
            personajes: []
        };
        
        try {
            const data = await fs.readFile(rutaPersonajes, 'utf8');
            const personajesHoy = JSON.parse(data);
            sesionInfo.totalPersonajes = personajesHoy.personajes.length;
            sesionInfo.personajes = personajesHoy.personajes.map(p => ({
                nombre: p.nombre,
                jugador: p.jugador,
                clase: p.clase,
                nivel: p.nivel
            }));
        } catch (e) {}
        
        res.json(sesionInfo);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== RUTA PRINCIPAL =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== INICIALIZACIÓN Y ARRANQUE =====
(async () => {
    await inicializarArchivoSesion();
    await limpiarArchivosAntiguos(30);
    
    server.listen(PORT, () => {
        console.log(`\n🚀 Servidor HTTP corriendo en ${SERVER_URL}`);
        console.log(`🔌 WebSocket server activo en ws://localhost:${PORT}`);
        console.log(`\n🤖 IA con Groq activa y lista para usar!`);
        console.log(`📄 Análisis de PDF disponible con extracción de texto mejorada`);
    });
})();