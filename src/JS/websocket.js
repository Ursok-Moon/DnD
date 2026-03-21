// /src/JS/websocket.js
class WebSocketClient {
    constructor() {
        this.socket = null;
        this.conectado = false;
        this.salaActual = null;
        this.usuario = null;
        this.eventos = {};
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    init() {
        // Usar el puerto del servidor (3000) donde corre Socket.IO
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`; // Esto usará el mismo host y puerto que la página
        
        console.log('🔌 Conectando a WebSocket:', wsUrl);
        this.socket = io(wsUrl, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });
        
        this.socket.on('connect', () => {
            console.log('✅ Conectado a WebSocket');
            this.conectado = true;
            this.reconnectAttempts = 0;
            this.registrarUsuario();
            this.ejecutarEvento('connect');
        });
        
        this.socket.on('disconnect', () => {
            console.log('❌ Desconectado de WebSocket');
            this.conectado = false;
            this.ejecutarEvento('disconnect');
            this.intentarReconectar();
        });
        
        this.socket.on('usuarios-actualizados', (usuarios) => {
            console.log('👥 Usuarios actualizados:', usuarios.length);
            this.ejecutarEvento('usuarios', usuarios);
        });
        
        this.socket.on('usuario-unido', (usuario) => {
            console.log(`👤 ${usuario.nombre} se unió a la sala`);
            this.ejecutarEvento('usuario-unido', usuario);
        });
        
        this.socket.on('usuario-desconectado', (usuarioId) => {
            this.ejecutarEvento('usuario-desconectado', usuarioId);
        });
        
        this.socket.on('personaje-guardado', (data) => {
            console.log(`📝 Personaje guardado: ${data.personaje?.nombre}`);
            this.ejecutarEvento('personaje-guardado', data);
        });
        
        this.socket.on('personaje-actualizado', (data) => {
            console.log('🔄 Personaje actualizado:', data);
            this.ejecutarEvento('personaje-actualizado', data);
        });
        
        this.socket.on('nuevo-mensaje', (mensaje) => {
            this.ejecutarEvento('mensaje', mensaje);
        });
        
        this.socket.on('iniciativa-actualizada', (orden) => {
            console.log(`⚔️ Iniciativa actualizada`);
            this.ejecutarEvento('iniciativa', orden);
        });
        
        this.socket.on('nuevo-dibujo', (puntos) => {
            this.ejecutarEvento('dibujo', puntos);
        });
        
        this.socket.on('pizarra-limpia', () => {
            console.log(`🧹 Pizarra limpiada`);
            this.ejecutarEvento('pizarra-limpia');
        });
    }
    
    intentarReconectar() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Intento de reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
            
            setTimeout(() => {
                if (!this.conectado && this.socket) {
                    this.socket.connect();
                }
            }, 3000 * this.reconnectAttempts);
        }
    }
    
    registrarUsuario() {
        this.usuario = {
            nombre: localStorage.getItem('jugadorNombre') || 'Anónimo',
            tipo: this.esDM() ? 'dm' : 'jugador',
            personaje: localStorage.getItem('personajeNombre') || null,
            id: localStorage.getItem('jugadorId') || `temp_${Date.now()}`
        };
        
        console.log('📝 Registrando usuario:', this.usuario);
        this.emit('registrar-usuario', this.usuario);
    }
    
    esDM() {
        return window.authSystem?.isDM ? window.authSystem.isDM() : false;
    }
    
    unirseSala(codigoSala) {
        if (!codigoSala) return;
        this.salaActual = codigoSala;
        this.emit('unirse-sala', codigoSala);
    }
    
    enviarMensaje(mensaje, tipo = 'texto') {
        if (!this.salaActual || !mensaje?.trim()) return;
        this.emit('mensaje-sala', {
            sala: this.salaActual,
            mensaje: mensaje.trim(),
            tipo: tipo
        });
    }
    
    actualizarIniciativa(orden) {
        if (!this.salaActual) return;
        this.emit('actualizar-iniciativa', {
            sala: this.salaActual,
            orden: orden
        });
    }
    
    enviarDibujo(puntos) {
        if (!this.salaActual) return;
        this.emit('dibujo', {
            sala: this.salaActual,
            puntos: puntos
        });
    }
    
    limpiarPizarra() {
        if (!this.salaActual) return;
        this.emit('limpiar-pizarra', this.salaActual);
    }
    
    actualizarPersonaje(personaje) {
        if (!this.salaActual) return;
        if (personaje) {
            this.usuario.personaje = personaje.nombre || null;
            localStorage.setItem('personajeNombre', personaje.nombre || '');
        }
        this.emit('actualizar-personaje', {
            sala: this.salaActual,
            personaje: personaje
        });
    }
    
    emit(evento, datos) {
        if (this.socket && this.conectado) {
            this.socket.emit(evento, datos);
        } else {
            console.warn(`⚠️ No se pudo emitir ${evento}: WebSocket no conectado`);
        }
    }
    
    on(evento, callback) {
        if (!this.eventos[evento]) this.eventos[evento] = [];
        this.eventos[evento].push(callback);
    }
    
    off(evento, callback) {
        if (this.eventos[evento]) {
            this.eventos[evento] = this.eventos[evento].filter(cb => cb !== callback);
        }
    }
    
    ejecutarEvento(evento, datos) {
        if (this.eventos[evento]) {
            this.eventos[evento].forEach(callback => {
                try { callback(datos); } catch (error) {
                    console.error(`❌ Error en evento ${evento}:`, error);
                }
            });
        }
    }
    
    isConectado() {
        return this.conectado;
    }
}

// Crear instancia global
window.wsClient = new WebSocketClient();

// Inicializar cuando el DOM esté listo (PERO SOLO UNA VEZ)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        if (window.wsClient && !window.wsClient.conectado) {
            window.wsClient.init();
        }
    });
} else {
    // DOM ya está cargado
    setTimeout(() => {
        if (window.wsClient && !window.wsClient.conectado) {
            window.wsClient.init();
        }
    }, 100);
}