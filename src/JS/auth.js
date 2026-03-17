// src/JS/auth.js
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.sessionId = this.generateSessionId();
        this.init();
    }
    
    init() {
        // Verificar si hay sesión guardada
        const savedSession = localStorage.getItem('userSession');
        if (savedSession) {
            this.currentUser = JSON.parse(savedSession);
            // Aplicar permisos inmediatamente si hay sesión guardada
            setTimeout(() => {
                this.applyPermissions();
            }, 100);
        }
        
        // Detectar si es localhost
        this.checkIfLocalhost();
    }
    
    async checkIfLocalhost() {
        try {
            const response = await fetch('/api/check-localhost');
            const data = await response.json();
            
            if (data.isLocalhost && !this.currentUser) {
                // Es localhost y no ha iniciado sesión - ofrecer modo DM
                this.showDMLoginPrompt();
            } else if (data.isLocalhost && this.currentUser?.type === 'dm') {
                // Ya es DM, aplicar permisos
                this.applyPermissions();
            } else if (!data.isLocalhost && !this.currentUser) {
                // No es localhost y no hay sesión - jugador anónimo
                this.continueAsPlayer();
            }
        } catch (error) {
            console.error('Error checking localhost:', error);
        }
    }
    
    showDMLoginPrompt() {
        // Verificar si ya existe el modal
        if (document.querySelector('.auth-modal')) return;
        
        // Crear modal para que el DM ingrese contraseña
        const modal = document.createElement('div');
        modal.className = 'auth-modal';
        modal.innerHTML = `
            <div class="auth-modal-content">
                <h2><i class="fas fa-crown"></i> Acceso de Dungeon Master</h2>
                <p>Has accedido desde la máquina del servidor.</p>
                <p>Introduce la contraseña de DM para acceder a todas las funciones:</p>
                <input type="password" id="dmPassword" placeholder="Contraseña de DM">
                <div class="auth-buttons">
                    <button id="submitDMPassword" class="auth-btn primary">Acceder como DM</button>
                    <button id="continueAsPlayer" class="auth-btn secondary">Continuar como Jugador</button>
                </div>
                <p class="auth-hint">(Si no eres el DM, elige "Continuar como Jugador")</p>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Event listeners
        document.getElementById('submitDMPassword').addEventListener('click', () => {
            const password = document.getElementById('dmPassword').value;
            this.loginAsDM(password);
        });
        
        document.getElementById('continueAsPlayer').addEventListener('click', () => {
            this.continueAsPlayer();
            modal.remove();
        });
    }
    
    async loginAsDM(password) {
        try {
            const response = await fetch('/api/dm-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.currentUser = {
                    type: 'dm',
                    name: 'Dungeon Master',
                    sessionId: this.sessionId
                };
                
                localStorage.setItem('userSession', JSON.stringify(this.currentUser));
                document.querySelector('.auth-modal')?.remove();
                this.applyPermissions();
                this.showNotification('✅ Bienvenido, Dungeon Master', 'success');
            } else {
                alert('❌ Contraseña incorrecta');
            }
        } catch (error) {
            console.error('Error en login DM:', error);
        }
    }
    
    continueAsPlayer() {
        // Pedir nombre de jugador si no existe
        let playerName = localStorage.getItem('jugadorNombre');
        if (!playerName) {
            playerName = prompt('¿Cómo te llamas, aventurero?', 'Aventurero') || 'Aventurero';
            localStorage.setItem('jugadorNombre', playerName);
        }
        
        this.currentUser = {
            type: 'player',
            name: playerName,
            sessionId: this.sessionId
        };
        
        localStorage.setItem('userSession', JSON.stringify(this.currentUser));
        this.applyPermissions();
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    applyPermissions() {
        console.log('🎭 Aplicando permisos para:', this.currentUser);
        
        // Ocultar/mostrar elementos según el tipo de usuario
        if (this.currentUser?.type === 'dm') {
            document.body.classList.add('dm-mode');
            document.body.classList.remove('player-mode');
            
            // Mostrar elementos DM
            document.querySelectorAll('.dm-only').forEach(el => {
                el.style.display = '';
                // Si es un contenedor block/inline según su estilo original
                if (el.style.display === 'none') {
                    el.style.display = 'block';
                }
            });
            
            console.log('👑 Modo DM activado');
        } else {
            document.body.classList.add('player-mode');
            document.body.classList.remove('dm-mode');
            
            // Ocultar elementos DM
            document.querySelectorAll('.dm-only').forEach(el => {
                el.style.display = 'none';
            });
            
            console.log('⚔️ Modo Jugador activado');
        }
        
        // Actualizar UI para mostrar usuario actual
        this.updateUserBadge();
    }
    
    updateUserBadge() {
        let badge = document.getElementById('userBadge');
        if (!badge) {
            badge = document.createElement('div');
            badge.id = 'userBadge';
            badge.className = 'user-badge';
            document.body.appendChild(badge);
        }
        
        if (this.currentUser) {
            const icon = this.currentUser.type === 'dm' ? '👑' : '⚔️';
            badge.innerHTML = `${icon} ${this.currentUser.name}`;
            badge.style.display = 'flex';
        }
    }
    
    showNotification(message, type) {
        // Usar tu sistema de notificaciones existente
        if (window.dmScreen) {
            window.dmScreen.showNotification(message, type);
        } else {
            alert(message);
        }
    }
    
    isDM() {
        return this.currentUser?.type === 'dm';
    }
    
    isPlayer() {
        return this.currentUser?.type === 'player';
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();
});