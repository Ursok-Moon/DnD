// Almacenamiento de conexiones activas
const connectedUsers = new Map();
const activeRooms = new Map();

function setupWebSocketHandlers(io) {
    io.on('connection', (socket) => {
        const clientIP = socket.handshake.address;
        console.log(`🔌 Nueva conexión WebSocket: ${socket.id} (${clientIP})`);

        // ===== REGISTRAR USUARIO =====
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
            
            console.log(`👤 Usuario registrado: ${nombre} (${tipo || 'jugador'})`);
            io.emit('usuarios-actualizados', Array.from(connectedUsers.values()));
        });

        // ===== UNIRSE A SALA =====
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

        // ===== SALIR DE SALA =====
        socket.on('salir-sala', (codigoSala) => {
            socket.leave(codigoSala);
            console.log(`📌 Usuario ${socket.id} salió de sala: ${codigoSala}`);
            
            if (activeRooms.has(codigoSala)) {
                const sala = activeRooms.get(codigoSala);
                const index = sala.usuarios.findIndex(u => u.id === socket.id);
                if (index !== -1) {
                    sala.usuarios.splice(index, 1);
                    io.to(codigoSala).emit('usuario-desconectado', socket.id);
                }
                
                // Si la sala queda vacía, eliminarla después de 5 minutos
                if (sala.usuarios.length === 0) {
                    setTimeout(() => {
                        if (activeRooms.has(codigoSala) && activeRooms.get(codigoSala).usuarios.length === 0) {
                            activeRooms.delete(codigoSala);
                            console.log(`🗑️ Sala eliminada por inactividad: ${codigoSala}`);
                        }
                    }, 300000); // 5 minutos
                }
            }
        });

        // ===== MENSAJE EN SALA =====
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

        // ===== MENSAJE PRIVADO =====
        socket.on('mensaje-privado', (data) => {
            const { destinatarioId, mensaje } = data;
            const usuario = connectedUsers.get(socket.id);
            
            const mensajeCompleto = {
                id: Date.now(),
                remitente: usuario?.nombre || 'Anónimo',
                remitenteId: socket.id,
                mensaje: mensaje,
                timestamp: new Date().toISOString()
            };
            
            io.to(destinatarioId).emit('mensaje-privado-recibido', mensajeCompleto);
            socket.emit('mensaje-privado-enviado', mensajeCompleto);
        });

        // ===== ACTUALIZAR PERSONAJE =====
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
                    // Notificar a la sala sobre el cambio
                    io.to(sala).emit('personaje-sala-actualizado', {
                        usuarioId: socket.id,
                        nombre: usuario.nombre,
                        personaje: personaje
                    });
                }
                
                io.emit('personaje-actualizado', {
                    usuarioId: socket.id,
                    personaje: personaje
                });
            }
        });

        // ===== ACTUALIZAR INICIATIVA =====
        socket.on('actualizar-iniciativa', (data) => {
            const { sala, orden } = data;
            io.to(sala).emit('iniciativa-actualizada', orden);
        });

        // ===== ACTUALIZAR DADOS =====
        socket.on('lanzar-dados', (data) => {
            const { sala, dados, resultado, total } = data;
            const usuario = connectedUsers.get(socket.id);
            
            io.to(sala).emit('dados-lanzados', {
                usuario: usuario?.nombre || 'Anónimo',
                personaje: usuario?.personaje,
                dados: dados,
                resultado: resultado,
                total: total,
                timestamp: new Date().toISOString()
            });
        });

        // ===== PIZARRA / DIBUJO =====
        socket.on('dibujo', (data) => {
            const { sala, puntos } = data;
            socket.to(sala).emit('nuevo-dibujo', puntos);
        });

        // ===== INICIAR DIBUJO =====
        socket.on('iniciar-dibujo', (data) => {
            const { sala, punto } = data;
            socket.to(sala).emit('dibujo-iniciado', punto);
        });

        // ===== DIBUJANDO =====
        socket.on('dibujando', (data) => {
            const { sala, punto } = data;
            socket.to(sala).emit('dibujando', punto);
        });

        // ===== TERMINAR DIBUJO =====
        socket.on('terminar-dibujo', (data) => {
            const { sala } = data;
            socket.to(sala).emit('dibujo-terminado');
        });

        // ===== LIMPIAR PIZARRA =====
        socket.on('limpiar-pizarra', (sala) => {
            io.to(sala).emit('pizarra-limpia');
        });

        // ===== CAMBIAR COLOR PIZARRA =====
        socket.on('cambiar-color-pizarra', (data) => {
            const { sala, color } = data;
            socket.to(sala).emit('color-pizarra-cambiado', color);
        });

        // ===== CAMBIAR GROSOR PIZARRA =====
        socket.on('cambiar-grosor-pizarra', (data) => {
            const { sala, grosor } = data;
            socket.to(sala).emit('grosor-pizarra-cambiado', grosor);
        });

        // ===== ACTUALIZAR MAPA =====
        socket.on('actualizar-mapa', (data) => {
            const { sala, mapaData } = data;
            io.to(sala).emit('mapa-actualizado', mapaData);
        });

        // ===== MOVER TOKEN MAPA =====
        socket.on('mover-token', (data) => {
            const { sala, tokenId, posicion } = data;
            socket.to(sala).emit('token-movido', { tokenId, posicion });
        });

        // ===== ESTADO DE TIPEO =====
        socket.on('escribiendo', (data) => {
            const { sala, estaEscribiendo } = data;
            const usuario = connectedUsers.get(socket.id);
            
            if (usuario) {
                socket.to(sala).emit('usuario-escribiendo', {
                    usuario: usuario.nombre,
                    estaEscribiendo: estaEscribiendo
                });
            }
        });

        // ===== SOLICITAR DATOS DE SALA =====
        socket.on('solicitar-datos-sala', (codigoSala) => {
            const sala = activeRooms.get(codigoSala);
            if (sala) {
                socket.emit('datos-sala', {
                    codigo: sala.codigo,
                    usuarios: sala.usuarios,
                    creada: sala.creada
                });
            }
        });

        // ===== SOLICITAR USUARIOS CONECTADOS =====
        socket.on('solicitar-usuarios', () => {
            socket.emit('usuarios-actualizados', Array.from(connectedUsers.values()));
        });

        // ===== PERSONAJE GUARDADO (desde API) =====
        socket.on('personaje-guardado', (data) => {
            io.emit('personaje-guardado-broadcast', {
                personaje: data.personaje,
                timestamp: new Date().toISOString()
            });
        });

        // ===== DESCONEXIÓN =====
        socket.on('disconnect', () => {
            const usuario = connectedUsers.get(socket.id);
            if (usuario) {
                console.log(`🔌 Usuario desconectado: ${usuario.nombre} (${socket.id})`);
                connectedUsers.delete(socket.id);
                
                // Notificar a todas las salas
                activeRooms.forEach((sala, codigo) => {
                    const index = sala.usuarios.findIndex(u => u.id === socket.id);
                    if (index !== -1) {
                        sala.usuarios.splice(index, 1);
                        io.to(codigo).emit('usuario-desconectado', {
                            usuarioId: socket.id,
                            nombre: usuario.nombre
                        });
                    }
                });
                
                // Actualizar lista global de usuarios
                io.emit('usuarios-actualizados', Array.from(connectedUsers.values()));
            }
        });
    });

    // Devolver los almacenamientos para uso externo si es necesario
    return { connectedUsers, activeRooms };
}

export default setupWebSocketHandlers;