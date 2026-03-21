// js/core/UserManager.js

import { ApiService } from '../services/ApiService.js';

export class UserManager {
    constructor(storageService) {
        this.storage = storageService;
        this.api = new ApiService();
        this.userName = null;
        this.load();
    }

    async load() {
        // Primero intentar cargar desde localStorage
        const savedName = localStorage.getItem('jugadorNombre');
        
        if (savedName && savedName !== 'Aventurero' && savedName !== 'Anónimo') {
            this.userName = savedName;
            return;
        }
        
        // Si no hay en localStorage, intentar cargar desde el servidor
        await this.loadFromServer();
    }

    async loadFromServer() {
        try {
            const usuarios = await this.api.getUsuarios();
            // Buscar el último usuario conectado desde esta IP
            const miIP = window.location.hostname;
            const miUsuario = usuarios.find(u => u.ip === miIP);
            
            if (miUsuario && miUsuario.nombre && miUsuario.nombre !== 'Aventurero') {
                this.userName = miUsuario.nombre;
                localStorage.setItem('jugadorNombre', this.userName);
                console.log('📥 Usuario cargado desde servidor:', this.userName);
            }
        } catch (error) {
            console.warn('No se pudo cargar usuario desde servidor:', error);
        }
    }

    getUserName() {
        return this.userName;
    }

    isUserSet() {
        return this.userName !== null && 
               this.userName !== '' && 
               this.userName !== 'Aventurero' && 
               this.userName !== 'Anónimo';
    }

    async setUserName(name) {
        if (name && name.trim() && name.trim() !== 'Aventurero') {
            const newName = name.trim();
            this.userName = newName;
            localStorage.setItem('jugadorNombre', this.userName);
            
            // Registrar en el servidor
            const result = await this.api.registrarUsuario(this.userName);
            if (result.success) {
                console.log('✅ Usuario registrado en servidor:', this.userName);
            } else {
                console.warn('⚠️ No se pudo registrar usuario en servidor:', result.error);
            }
            
            return true;
        }
        return false;
    }

    showUserPrompt() {
        return new Promise((resolve) => {
            // Crear modal de bienvenida
            const modal = document.createElement('div');
            modal.id = 'userNameModal';
            modal.className = 'modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                backdrop-filter: blur(5px);
            `;
            
            modal.innerHTML = `
                <div class="modal-content" style="
                    max-width: 450px;
                    background: linear-gradient(135deg, var(--parchment-light, #f5e6d3), var(--parchment-dark, #e8d4b5));
                    border: 3px solid var(--accent-gold, #d4af37);
                    border-radius: 20px;
                    padding: 30px;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                ">
                    <div style="margin-bottom: 20px;">
                        <i class="fas fa-user-astronaut" style="font-size: 60px; color: var(--accent-gold, #d4af37);"></i>
                    </div>
                    <h2 style="color: var(--ink-dark, #2c1810); margin-bottom: 10px; font-family: 'Cinzel', serif;">
                        ¡Bienvenido Aventurero!
                    </h2>
                    <p style="color: var(--ink-light, #5c4033); margin-bottom: 20px;">
                        Por favor, ingresa tu nombre para identificarte en la sesión
                    </p>
                    <div class="form-group" style="margin-bottom: 20px;">
                        <input type="text" 
                               id="userNameInput" 
                               placeholder="Tu nombre de jugador" 
                               autocomplete="off"
                               style="
                                   width: 100%;
                                   padding: 12px;
                                   font-size: 16px;
                                   border: 2px solid var(--accent-gold, #d4af37);
                                   border-radius: 8px;
                                   background: white;
                                   font-family: 'Cinzel', serif;
                                   text-align: center;
                               ">
                    </div>
                    <div class="modal-actions" style="display: flex; gap: 15px; justify-content: center;">
                        <button id="confirmUserNameBtn" style="
                            background: linear-gradient(135deg, var(--accent-gold, #d4af37), #b8860b);
                            color: #2c1810;
                            border: none;
                            padding: 10px 30px;
                            border-radius: 30px;
                            font-weight: bold;
                            cursor: pointer;
                            font-family: 'Cinzel', serif;
                            transition: transform 0.2s;
                        ">
                            <i class="fas fa-check"></i> Comenzar Aventura
                        </button>
                    </div>
                    <p style="font-size: 12px; color: #888; margin-top: 15px;">
                        Este nombre se usará para identificar tus personajes
                    </p>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            const input = document.getElementById('userNameInput');
            const confirmBtn = document.getElementById('confirmUserNameBtn');
            
            // Si ya hay un nombre en localStorage, precargarlo
            const savedName = localStorage.getItem('jugadorNombre');
            if (savedName && savedName !== 'Aventurero' && savedName !== 'Anónimo') {
                input.value = savedName;
            }
            
            const handleConfirm = async () => {
                const name = input.value.trim();
                if (name && name.length >= 2 && name !== 'Aventurero') {
                    // Mostrar indicador de carga
                    confirmBtn.disabled = true;
                    confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registrando...';
                    
                    const success = await this.setUserName(name);
                    
                    if (success) {
                        modal.remove();
                        resolve(true);
                    } else {
                        confirmBtn.disabled = false;
                        confirmBtn.innerHTML = '<i class="fas fa-check"></i> Comenzar Aventura';
                        
                        const errorMsg = document.createElement('div');
                        errorMsg.textContent = 'Error al registrar usuario. Intenta nuevamente.';
                        errorMsg.style.color = '#ff4444';
                        errorMsg.style.fontSize = '12px';
                        errorMsg.style.marginTop = '5px';
                        
                        const existingError = modal.querySelector('.error-message');
                        if (existingError) existingError.remove();
                        errorMsg.className = 'error-message';
                        input.parentNode.appendChild(errorMsg);
                        
                        setTimeout(() => {
                            if (errorMsg.parentNode) errorMsg.remove();
                        }, 3000);
                    }
                } else {
                    input.style.borderColor = '#ff4444';
                    input.style.animation = 'shake 0.3s ease';
                    setTimeout(() => {
                        input.style.borderColor = '';
                        input.style.animation = '';
                    }, 300);
                    
                    const errorMsg = document.createElement('div');
                    errorMsg.textContent = 'Por favor ingresa un nombre válido (mínimo 2 caracteres, no puede ser "Aventurero")';
                    errorMsg.style.color = '#ff4444';
                    errorMsg.style.fontSize = '12px';
                    errorMsg.style.marginTop = '5px';
                    
                    const existingError = modal.querySelector('.error-message');
                    if (existingError) existingError.remove();
                    errorMsg.className = 'error-message';
                    input.parentNode.appendChild(errorMsg);
                    
                    setTimeout(() => {
                        if (errorMsg.parentNode) errorMsg.remove();
                    }, 2000);
                }
            };
            
            confirmBtn.addEventListener('click', handleConfirm);
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleConfirm();
            });
            
            input.focus();
        });
    }
}