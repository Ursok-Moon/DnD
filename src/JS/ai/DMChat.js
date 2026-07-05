// Módulo de chat IA para la Pantalla del DM
class DMChat {
    constructor() {
        this.apiUrl = '/api/ai';
        this.conversationHistory = [];
        this.maxHistoryLength = 10;
        this.isConnected = false;
        this.isStreaming = true;
        this.combatSyncInterval = null;
        this.lastCombatState = null;
        this.init();
    }

    async init() {
        await this.checkConnection();
        this.attachEventListeners();
        this.startCombatSync();
        
        // Escuchar cambios en el estado de combate desde DMScreen
        this.setupCombatEventListeners();
    }

    setupCombatEventListeners() {
        // Observar cambios en el DMScreen si está disponible
        if (window.dmScreen) {
            // Guardar referencia original de métodos para interceptar cambios
            const originalAddEnemy = window.dmScreen.addEnemy;
            const originalAddPlayer = window.dmScreen.addPlayer;
            const originalNextTurn = window.dmScreen.nextTurn;
            const originalUpdateEnemiesList = window.dmScreen.updateEnemiesList;
            const originalUpdatePlayersList = window.dmScreen.updatePlayersList;
            
            // Interceptar addEnemy
            if (originalAddEnemy) {
                window.dmScreen.addEnemy = (...args) => {
                    const result = originalAddEnemy.apply(window.dmScreen, args);
                    this.syncCombatState();
                    return result;
                };
            }
            
            // Interceptar addPlayer
            if (originalAddPlayer) {
                window.dmScreen.addPlayer = (...args) => {
                    const result = originalAddPlayer.apply(window.dmScreen, args);
                    this.syncCombatState();
                    return result;
                };
            }
            
            // Interceptar nextTurn
            if (originalNextTurn) {
                window.dmScreen.nextTurn = (...args) => {
                    const result = originalNextTurn.apply(window.dmScreen, args);
                    this.syncCombatState();
                    return result;
                };
            }
            
            // Interceptar actualizaciones de listas
            if (originalUpdateEnemiesList) {
                window.dmScreen.updateEnemiesList = (...args) => {
                    const result = originalUpdateEnemiesList.apply(window.dmScreen, args);
                    this.syncCombatState();
                    return result;
                };
            }
            
            if (originalUpdatePlayersList) {
                window.dmScreen.updatePlayersList = (...args) => {
                    const result = originalUpdatePlayersList.apply(window.dmScreen, args);
                    this.syncCombatState();
                    return result;
                };
            }
        }
    }

    startCombatSync() {
        // Sincronizar cada 5 segundos
        if (this.combatSyncInterval) {
            clearInterval(this.combatSyncInterval);
        }
        
        this.combatSyncInterval = setInterval(() => {
            this.syncCombatState();
        }, 5000);
    }

    async syncCombatState() {
        if (!window.dmScreen) return;
        
        try {
            // Obtener estado actual del combate
            const combatState = {
                enemies: (window.dmScreen.enemies || []).map(e => ({
                    id: e.id,
                    name: e.name,
                    race: e.race || '',
                    ca: e.ca || 10,
                    hp: e.hp || 0,
                    maxHp: e.maxHp || 0,
                    initiative: e.initiative || 0,
                    type: 'enemy'
                })),
                players: (window.dmScreen.players || []).map(p => ({
                    id: p.id,
                    name: p.name,
                    ca: p.ca || 10,
                    hp: p.hp || 0,
                    maxHp: p.maxHp || 0,
                    initiative: p.initiative || 0,
                    type: 'player'
                })),
                initiativeOrder: (window.dmScreen.initiativeOrder || []).map(e => ({
                    id: e.id,
                    name: e.name,
                    type: e.type,
                    initiative: e.initiative
                })),
                currentRound: window.dmScreen.currentRound || 1,
                currentTurn: window.dmScreen.currentTurn || 0,
                combatActive: window.dmScreen.combatMode || false
            };
            
            // Verificar si hubo cambios significativos
            const stateChanged = JSON.stringify(this.lastCombatState) !== JSON.stringify(combatState);
            
            if (stateChanged) {
                this.lastCombatState = combatState;
                
                // Enviar al servidor
                const response = await fetch('/api/ai/dm/combat/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(combatState)
                });
                
                if (response.ok) {
                    console.log('⚔️ Estado de combate sincronizado con IA');
                }
                
                // También sincronizar bestiario si está cargado
                await this.syncBestiary();
            }
        } catch (error) {
            console.error('Error sincronizando combate:', error);
        }
    }

    async syncBestiary() {
        if (!window.dmScreen) return;
        
        // Verificar si hay bestiario personalizado cargado
        const bestiaryActual = window.dmScreen.bestiarioActual;
        const fuenteActual = window.dmScreen.fuenteBestiarioActual;
        
        if (bestiaryActual && bestiaryActual.length > 0 && fuenteActual !== 'original') {
            try {
                await fetch('/api/ai/dm/bestiary/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        bestiary: bestiaryActual,
                        source: fuenteActual
                    })
                });
                console.log(`📚 Bestiario sincronizado: ${bestiaryActual.length} criaturas (${fuenteActual})`);
            } catch (error) {
                console.error('Error sincronizando bestiario:', error);
            }
        }
    }

    async checkConnection() {
        const statusDiv = document.getElementById('aiChatStatus');
        
        try {
            const response = await fetch(`${this.apiUrl}/status`);
            const data = await response.json();
            
            if (data.available) {
                this.isConnected = true;
                if (statusDiv) {
                    statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> Groq activo (${data.model})`;
                    statusDiv.style.color = '#4ade80';
                }
                console.log('🤖 IA conectado para DM Screen');
                this.enableChat(true);
                
                // Verificar contexto del DM
                await this.checkDMContext();
                
                this.addSystemMessage('📖 Soy el Erudito. Puedo consultar el bestiario y ayudarte con estrategias de combate.');
            } else {
                this.isConnected = false;
                if (statusDiv) {
                    statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> IA no disponible';
                    statusDiv.style.color = '#fbbf24';
                }
                this.enableChat(false);
                this.addSystemMessage('⚠️ No se pudo conectar con la IA. Verifica tu API key de Groq.');
            }
        } catch (error) {
            this.isConnected = false;
            if (statusDiv) {
                statusDiv.innerHTML = '<i class="fas fa-times-circle"></i> Error de conexión';
                statusDiv.style.color = '#f87171';
            }
            this.enableChat(false);
            this.addSystemMessage('❌ Error de conexión con el servidor de IA');
            console.error('Error checking connection:', error);
        }
    }

    async checkDMContext() {
        try {
            const response = await fetch('/api/ai/dm/context');
            const data = await response.json();
            
            if (data.success) {
                if (data.bestiaryLoaded) {
                    console.log(`📚 Bestiario disponible: ${data.bestiaryCount} criaturas (${data.bestiarySource})`);
                }
                if (data.combatActive) {
                    console.log(`⚔️ Combate activo: ${data.enemies?.length || 0} enemigos, ${data.players?.length || 0} jugadores`);
                    this.addSystemMessage(`⚔️ Combate detectado! ${data.enemies?.length || 0} enemigos, ronda ${data.currentRound}. Pregúntame por estrategias.`);
                }
            }
        } catch (error) {
            console.error('Error obteniendo contexto DM:', error);
        }
    }

    enableChat(enabled) {
        const input = document.getElementById('aiChatInputInline');
        const sendBtn = document.getElementById('aiSendBtnInline');
        
        if (input) input.disabled = !enabled;
        if (sendBtn) sendBtn.disabled = !enabled;
    }

    attachEventListeners() {
        const sendBtn = document.getElementById('aiSendBtnInline');
        const input = document.getElementById('aiChatInputInline');
        const streamToggle = document.getElementById('aiStreamToggle');

        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey && !input.disabled) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        if (streamToggle) {
            streamToggle.addEventListener('change', (e) => {
                this.isStreaming = e.target.checked;
            });
        }
        
        // Botón para limpiar historial (opcional)
        const clearHistoryBtn = document.getElementById('clearChatHistoryBtn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => this.clearHistory());
        }
    }

    async sendMessage() {
        const input = document.getElementById('aiChatInputInline');
        const message = input.value.trim();
        
        if (!message) return;
        
        if (!this.isConnected) {
            this.addSystemMessage('⚠️ No hay conexión con la IA. Por favor, recarga la página.');
            return;
        }

        // Mostrar mensaje del usuario
        this.addMessage(message, 'user-message');
        input.value = '';

        // Deshabilitar input mientras se procesa
        input.disabled = true;
        const sendBtn = document.getElementById('aiSendBtnInline');
        if (sendBtn) sendBtn.disabled = true;

        // Mostrar indicador de escritura
        const typingIndicator = this.addTypingIndicator();

        try {
            // Obtener estado actual del combate para contexto
            const combatData = this.getCurrentCombatData();
            
            const history = this.conversationHistory.slice(-this.maxHistoryLength);
            
            if (this.isStreaming) {
                // Crear elemento para la respuesta
                const messageElement = this.createMessageElement('', 'assistant-message');
                const messagesContainer = document.getElementById('aiChatMessagesInline');
                messagesContainer.appendChild(messageElement);
                
                const response = await fetch(`${this.apiUrl}/chat/stream`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message, 
                        history,
                        combatData // Enviar contexto de combate
                    })
                });

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullResponse = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    fullResponse += chunk;
                    messageElement.textContent = fullResponse;
                    this.formatMessageElement(messageElement);
                    this.scrollToBottom();
                }

                typingIndicator.remove();
                
                // Actualizar historial
                this.conversationHistory.push(
                    { role: 'user', content: message },
                    { role: 'assistant', content: fullResponse }
                );
                
                // Limitar historial
                if (this.conversationHistory.length > this.maxHistoryLength * 2) {
                    this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2);
                }
            } else {
                const response = await fetch(`${this.apiUrl}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        message, 
                        history,
                        combatData
                    })
                });
                
                const data = await response.json();
                typingIndicator.remove();
                
                if (data.success) {
                    this.addMessage(data.response, 'assistant-message');
                    this.conversationHistory.push(
                        { role: 'user', content: message },
                        { role: 'assistant', content: data.response }
                    );
                    
                    // Mostrar información de contexto si está disponible
                    if (data.context) {
                        console.log('📊 Contexto usado:', data.context);
                    }
                } else {
                    throw new Error(data.error || 'Error en la respuesta');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            typingIndicator.remove();
            this.addSystemMessage(`❌ Error: ${error.message}`);
        } finally {
            // Re-habilitar input
            input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            input.focus();
            this.scrollToBottom();
        }
    }

    getCurrentCombatData() {
        if (!window.dmScreen) return null;
        
        return {
            enemies: (window.dmScreen.enemies || []).map(e => ({
                id: e.id,
                name: e.name,
                race: e.race || '',
                ca: e.ca || 10,
                hp: e.hp || 0,
                maxHp: e.maxHp || 0,
                initiative: e.initiative || 0,
                type: 'enemy'
            })),
            players: (window.dmScreen.players || []).map(p => ({
                id: p.id,
                name: p.name,
                ca: p.ca || 10,
                hp: p.hp || 0,
                maxHp: p.maxHp || 0,
                initiative: p.initiative || 0,
                type: 'player'
            })),
            initiativeOrder: (window.dmScreen.initiativeOrder || []).map(e => ({
                id: e.id,
                name: e.name,
                type: e.type,
                initiative: e.initiative
            })),
            currentRound: window.dmScreen.currentRound || 1,
            currentTurn: window.dmScreen.currentTurn || 0,
            combatActive: window.dmScreen.combatMode || false
        };
    }

    addMessage(content, type) {
        const messagesContainer = document.getElementById('aiChatMessagesInline');
        if (!messagesContainer) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${type}`;
        
        let displayContent = content;
        if (type === 'assistant-message' && content) {
            displayContent = this.formatMessage(content);
        }
        
        // Agregar icono según tipo
        if (type === 'assistant-message') {
            messageDiv.innerHTML = `<i class="fas fa-robot" style="margin-right: 8px;"></i> ${displayContent.replace(/\n/g, '<br>')}`;
        } else if (type === 'user-message') {
            messageDiv.innerHTML = `<i class="fas fa-user" style="margin-right: 8px;"></i> ${displayContent.replace(/\n/g, '<br>')}`;
        } else {
            messageDiv.innerHTML = displayContent.replace(/\n/g, '<br>');
        }
        
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageDiv;
    }

    addSystemMessage(content) {
        this.addMessage(content, 'system-message');
    }

    createMessageElement(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${type}`;
        
        if (type === 'assistant-message') {
            messageDiv.innerHTML = `<i class="fas fa-robot" style="margin-right: 8px;"></i> ${content.replace(/\n/g, '<br>')}`;
        } else if (type === 'user-message') {
            messageDiv.innerHTML = `<i class="fas fa-user" style="margin-right: 8px;"></i> ${content.replace(/\n/g, '<br>')}`;
        } else {
            messageDiv.innerHTML = content.replace(/\n/g, '<br>');
        }
        
        return messageDiv;
    }

    formatMessageElement(element) {
        if (element.textContent) {
            let content = element.textContent;
            // Remover el icono si existe para no duplicarlo
            content = content.replace(/^[^\w]*/, '');
            element.innerHTML = `<i class="fas fa-robot" style="margin-right: 8px;"></i> ${this.formatMessage(content).replace(/\n/g, '<br>')}`;
        }
    }

    addTypingIndicator() {
        const messagesContainer = document.getElementById('aiChatMessagesInline');
        if (!messagesContainer) return null;
        
        const indicator = document.createElement('div');
        indicator.className = 'ai-message typing-indicator';
        indicator.innerHTML = '<i class="fas fa-robot" style="margin-right: 8px;"></i> <span></span><span></span><span></span>';
        messagesContainer.appendChild(indicator);
        this.scrollToBottom();
        return indicator;
    }

    formatMessage(text) {
        if (!text) return '';
        
        // Formato markdown básico
        text = text.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');
        
        // Headers
        text = text.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        text = text.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        text = text.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Listas
        text = text.replace(/^[\*\-] (.*$)/gm, '<li>$1</li>');
        text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Resaltar nombres de enemigos si hay combate activo
        if (window.dmScreen && window.dmScreen.combatMode) {
            const enemies = window.dmScreen.enemies || [];
            enemies.forEach(enemy => {
                const regex = new RegExp(`\\b(${enemy.name})\\b`, 'gi');
                text = text.replace(regex, '<span class="enemy-mention">$1</span>');
            });
        }
        
        return text;
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('aiChatMessagesInline');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    clearHistory() {
        this.conversationHistory = [];
        const messagesContainer = document.getElementById('aiChatMessagesInline');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="ai-message system-message">
                    <i class="fas fa-robot"></i> Historial limpiado. ¿En qué puedo ayudarte?
                </div>
            `;
        }
        this.addSystemMessage('📖 Recuerda: Puedo consultar el bestiario y el estado del combate.');
    }
    
    // Método para forzar sincronización manual
    async forceSync() {
        await this.syncCombatState();
        this.addSystemMessage('🔄 Estado sincronizado con el servidor.');
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.dmChat = new DMChat();
    
    // Agregar botón de sincronización manual (opcional)
    const addSyncButton = () => {
        const controlsDiv = document.querySelector('.ai-chat-controls-inline');
        if (controlsDiv && !document.getElementById('forceSyncBtn')) {
            const syncBtn = document.createElement('button');
            syncBtn.id = 'forceSyncBtn';
            syncBtn.className = 'tool-btn small';
            syncBtn.innerHTML = '<i class="fas fa-sync-alt"></i>';
            syncBtn.title = 'Sincronizar estado de combate';
            syncBtn.style.marginRight = '5px';
            syncBtn.addEventListener('click', () => {
                if (window.dmChat) window.dmChat.forceSync();
            });
            controlsDiv.insertBefore(syncBtn, controlsDiv.firstChild);
        }
    };
    
    setTimeout(addSyncButton, 1000);
});