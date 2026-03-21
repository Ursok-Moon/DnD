const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// ===== ALMACENAMIENTO DE CONEXIONES ACTIVAS =====
const connectedUsers = new Map();
const activeRooms = new Map();

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

console.log(` Servidor configurado en: ${SERVER_URL}`);
console.log(` Ruta de datos: ${DATA_PATH}`);

// ===== CONFIGURACIÓN DE MULTER PARA SUBIR IMÁGENES =====
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadPath = path.join(__dirname, 'data', 'imagenes');
        fs.mkdir(uploadPath, { recursive: true }).then(() => {
            cb(null, uploadPath);
        }).catch(err => {
            cb(err, uploadPath);
        });
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, 'pj_' + uniqueSuffix + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Solo se permiten imágenes'), false);
        }
    }
});

// ===== FUNCIÓN PARA INICIALIZAR ARCHIVO DE SESIÓN =====
async function inicializarArchivoSesion() {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        
        const personajesPath = path.join(DATA_PATH, 'personajes');
        await fs.mkdir(personajesPath, { recursive: true });
        
        const imagenesPath = path.join(DATA_PATH, 'imagenes');
        await fs.mkdir(imagenesPath, { recursive: true });
        
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

// ===== FUNCIÓN PARA LIMPIAR ARCHIVOS ANTIGUOS =====
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

// ===== EJECUTAR INICIALIZACIÓN AL ARRANCAR EL SERVIDOR =====
(async () => {
    await inicializarArchivoSesion();
    await limpiarArchivosAntiguos(30);
})();

// ===== MANEJADORES DE WEBSOCKET =====
io.on('connection', (socket) => {
    const clientIP = socket.handshake.address;
    console.log(`🔌 Nueva conexión WebSocket: ${socket.id} (${clientIP})`);

    // Registrar usuario
    socket.on('registrar-usuario', (data) => {
        const { nombre, tipo, personaje } = data;
        connectedUsers.set(socket.id, {
            id: socket.id,
            nombre: nombre,
            tipo: tipo || 'jugador',
            personaje: personaje || null,
            ip: clientIP,
            conectado: new Date()
        });
        
        console.log(`👤 Usuario registrado: ${nombre} (${tipo})`);
        io.emit('usuarios-actualizados', Array.from(connectedUsers.values()));
    });

    // Unirse a sala
    socket.on('unirse-sala', (codigoSala) => {
        socket.join(codigoSala);
        console.log(`📌 Usuario ${socket.id} se unió a sala: ${codigoSala}`);
        
        if (!activeRooms.has(codigoSala)) {
            activeRooms.set(codigoSala, {
                codigo: codigoSala,
                usuarios: [],
                creada: new Date()
            });
        }
        
        const sala = activeRooms.get(codigoSala);
        const usuario = connectedUsers.get(socket.id);
        if (usuario && !sala.usuarios.find(u => u.id === socket.id)) {
            sala.usuarios.push(usuario);
        }
        
        io.to(codigoSala).emit('usuario-unido', usuario);
    });

    // Enviar mensaje
    socket.on('mensaje-sala', (data) => {
        const { sala, mensaje, tipo } = data;
        const usuario = connectedUsers.get(socket.id);
        
        const mensajeCompleto = {
            id: Date.now(),
            usuario: usuario?.nombre || 'Anónimo',
            personaje: usuario?.personaje,
            mensaje: mensaje,
            tipo: tipo || 'texto',
            timestamp: new Date().toISOString()
        };
        
        io.to(sala).emit('nuevo-mensaje', mensajeCompleto);
    });

    // Actualizar personaje
    socket.on('actualizar-personaje', (data) => {
        const { sala, personaje } = data;
        const usuario = connectedUsers.get(socket.id);
        
        if (usuario) {
            usuario.personaje = personaje;
            
            if (sala && activeRooms.has(sala)) {
                const salaData = activeRooms.get(sala);
                const userIndex = salaData.usuarios.findIndex(u => u.id === socket.id);
                if (userIndex !== -1) {
                    salaData.usuarios[userIndex].personaje = personaje;
                }
            }
            
            io.emit('personaje-actualizado', {
                usuarioId: socket.id,
                personaje: personaje
            });
        }
    });

    // Iniciativa en tiempo real
    socket.on('actualizar-iniciativa', (data) => {
        const { sala, orden } = data;
        io.to(sala).emit('iniciativa-actualizada', orden);
    });

    // Dibujo en tiempo real
    socket.on('dibujo', (data) => {
        const { sala, puntos } = data;
        socket.to(sala).emit('nuevo-dibujo', puntos);
    });

    // Limpiar pizarra
    socket.on('limpiar-pizarra', (sala) => {
        io.to(sala).emit('pizarra-limpia');
    });

    // Desconexión
    socket.on('disconnect', () => {
        const usuario = connectedUsers.get(socket.id);
        if (usuario) {
            console.log(`🔌 Usuario desconectado: ${usuario.nombre} (${socket.id})`);
            connectedUsers.delete(socket.id);
            
            activeRooms.forEach((sala, codigo) => {
                const index = sala.usuarios.findIndex(u => u.id === socket.id);
                if (index !== -1) {
                    sala.usuarios.splice(index, 1);
                    io.to(codigo).emit('usuario-desconectado', socket.id);
                }
            });
            
            io.emit('usuarios-actualizados', Array.from(connectedUsers.values()));
        }
    });
});

// ===== SERVIDOR DE ARCHIVOS ESTÁTICOS =====
app.use(express.static(path.join(__dirname)));
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/src/FROND', express.static(path.join(__dirname, 'src/FROND')));
app.use('/src/CSS', express.static(path.join(__dirname, 'src/CSS')));
app.use('/src/JS', express.static(path.join(__dirname, 'src/JS')));
app.use('/src/Cartas', express.static(path.join(__dirname, 'src/Cartas')));
app.use('/src/demo', express.static(path.join(__dirname, 'src/demo')));

app.use('/data/imagenes', express.static(path.join(__dirname, 'data', 'imagenes')));
app.use('/data', express.static(path.join(__dirname, 'data')));
app.use('/data/personajes', express.static(path.join(__dirname, 'data', 'personajes')));

// ===== ENDPOINTS DE IMÁGENES =====
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

// ===== ENDPOINTS ESPECÍFICOS PARA ADMIN =====
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
        
        const filePath = path.join(DATA_PATH,'personajes', filename);
        
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
    const archiver = require('archiver');
    const dataDir = path.join(__dirname, 'data');
    const outputPath = path.join(__dirname, 'temp', 'backup.zip');
    
    if (!fs.existsSync(path.join(__dirname, 'temp'))) {
        fs.mkdirSync(path.join(__dirname, 'temp'));
    }
    
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip');
    
    archive.pipe(output);
    archive.directory(dataDir, false);
    archive.finalize();
    
    output.on('close', () => {
        res.download(outputPath, 'backup.zip', (err) => {
            if (err) console.error(err);
            fs.unlinkSync(outputPath);
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

// ===== ENDPOINTS GENÉRICOS PARA JSON =====
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

// ===== ENDPOINTS DE BÚSQUEDA =====
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

// ===== ENDPOINTS DE AUTENTICACIÓN =====
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

// ===== ENDPOINTS PARA JUGADORES =====
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

// ===== ENDPOINTS PARA PERSONAJES =====
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
        
        // NUEVO: Emitir evento de personaje guardado
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

// ===== ENDPOINT DE SESIÓN ACTUAL =====
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

// ===== INICIAR SERVIDOR =====
server.listen(PORT, () => {
    console.log(`🚀 Servidor HTTP corriendo en ${SERVER_URL}`);
    console.log(`🔌 WebSocket server activo en ws://localhost:${PORT}`);
    console.log(`📊 Endpoints API:`);
    console.log(`   - GET ${SERVER_URL}/api/json/list`);
    console.log(`   - GET ${SERVER_URL}/api/json/stats`);
    console.log(`   - POST ${SERVER_URL}/api/json/upload`);
    console.log(`   - POST ${SERVER_URL}/api/json/delete`);
    console.log(`   - GET ${SERVER_URL}/api/json/export-all`);
    console.log(`   - GET ${SERVER_URL}/api/json/bestiario`);
    console.log(`   - POST ${SERVER_URL}/api/json/bestiario`);
    console.log(`   - GET ${SERVER_URL}/api/bestiario/buscar/:termino`);
    console.log(`   - GET ${SERVER_URL}/api/personajes/hoy`);
    console.log(`   - POST ${SERVER_URL}/api/personajes/guardar`);
    console.log(`   - GET ${SERVER_URL}/api/imagenes/listar`);
    console.log(`   - POST ${SERVER_URL}/api/imagenes/subir`);
    console.log(`   - POST ${SERVER_URL}/api/imagenes/eliminar`);
});