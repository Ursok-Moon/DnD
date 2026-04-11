import AIService from './AIService.js';

class AIChatUI {
    constructor() {
        this.aiService = null;
        this.isStreaming = true;
        this.isConnected = false;
        this.initialized = false;
    }

    async init() {
        if (this.initialized) return;
        
        // Inicializar el servicio
        this.aiService = new AIService();
        this.attachEventListeners();
        await this.checkConnection();
        this.initialized = true;
    }

    async checkConnection() {
        const statusDiv = document.getElementById('aiStatus');
        
        try {
            const response = await fetch('/api/ai/status');
            const data = await response.json();
            
            if (data.available) {
                this.isConnected = true;
                if (statusDiv) {
                    statusDiv.innerHTML = `✅ Groq (${data.model})`;
                    statusDiv.style.color = '#4ade80';
                }
                this.addSystemMessage(`✅ Asistente Groq conectado correctamente (${data.model})`);
                console.log('✅ Groq conectado correctamente');
            } else {
                this.isConnected = false;
                if (statusDiv) {
                    statusDiv.innerHTML = '⚠️ Groq no disponible';
                    statusDiv.style.color = '#fbbf24';
                }
                this.addSystemMessage('⚠️ No se pudo conectar con Groq. Verifica tu API key.');
                console.warn('⚠️ Groq no disponible');
            }
        } catch (error) {
            this.isConnected = false;
            if (statusDiv) {
                statusDiv.innerHTML = '❌ Error de conexión';
                statusDiv.style.color = '#f87171';
            }
            this.addSystemMessage('❌ Error de conexión con el servidor de IA');
            console.error('Error checking connection:', error);
        }
        
        // Habilitar/deshabilitar input según conexión
        const userInput = document.getElementById('userInput');
        const sendBtn = document.getElementById('sendMessage');
        
        if (userInput) userInput.disabled = !this.isConnected;
        if (sendBtn) sendBtn.disabled = !this.isConnected;
    }

    attachEventListeners() {
        // Botón de enviar
        const sendBtn = document.getElementById('sendMessage');
        if (sendBtn) {
            sendBtn.addEventListener('click', () => this.sendMessage());
        }

        // Input con Enter
        const userInput = document.getElementById('userInput');
        if (userInput) {
            userInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && !e.shiftKey && !userInput.disabled) {
                    e.preventDefault();
                    this.sendMessage();
                }
            });
        }

        // Botón de generar encuentro
        const generateEncounterBtn = document.getElementById('generateEncounter');
        if (generateEncounterBtn) {
            generateEncounterBtn.addEventListener('click', () => this.generateEncounter());
        }

        // Botón de mejorar bestiario
        const analyzeBestiaryBtn = document.getElementById('analyzeBestiary');
        if (analyzeBestiaryBtn) {
            analyzeBestiaryBtn.addEventListener('click', () => this.analyzeBestiary());
        }

        // Botón para abrir/cerrar chat (si existe)
        const openChatBtn = document.getElementById('open-ai-chat');
        if (openChatBtn) {
            openChatBtn.addEventListener('click', () => this.toggleChat());
        }
    }

    toggleChat() {
        const container = document.querySelector('.ai-chat-container');
        if (container) {
            container.classList.toggle('active');
            // Si no tiene la clase active, la agregamos (por defecto visible)
            if (!container.classList.contains('active')) {
                container.style.display = 'flex';
                container.classList.add('active');
            } else {
                container.style.display = container.style.display === 'none' ? 'flex' : 'none';
            }
        }
    }

    async sendMessage() {
        const userInput = document.getElementById('userInput');
        const message = userInput.value.trim();
        
        if (!message) return;
        
        if (!this.isConnected) {
            this.addMessage('No hay conexión con el servidor de IA. Por favor, recarga la página.', 'system-message');
            return;
        }
        
        if (!this.aiService) {
            this.addMessage('Servicio de IA no inicializado. Por favor, espera un momento.', 'system-message');
            return;
        }

        // Mostrar mensaje del usuario
        this.addMessage(message, 'user-message');
        userInput.value = '';

        // Deshabilitar input mientras se procesa
        userInput.disabled = true;
        const sendBtn = document.getElementById('sendMessage');
        if (sendBtn) sendBtn.disabled = true;

        // Mostrar indicador de escritura
        const typingIndicator = this.addTypingIndicator();

        try {
            // Obtener contexto de la sesión
            const location = document.getElementById('location')?.value || '';
            const environment = document.getElementById('environment')?.value || '';
            
            const context = {
                location: location,
                environment: environment
            };

            // Usar streaming por defecto
            const messageElement = this.createMessageElement('', 'ai-message');
            const messagesContainer = document.getElementById('chatMessages');
            messagesContainer.appendChild(messageElement);
            
            await this.aiService.sendMessageStream(
                message,
                (chunk) => {
                    // Actualizar mensaje con cada chunk
                    messageElement.textContent += chunk;
                    this.scrollToBottom();
                },
                () => {
                    // Completado
                    typingIndicator.remove();
                    this.formatMessageElement(messageElement);
                    // Re-habilitar input
                    userInput.disabled = false;
                    if (sendBtn) sendBtn.disabled = false;
                    userInput.focus();
                },
                (error) => {
                    console.error('Error en streaming:', error);
                    typingIndicator.remove();
                    messageElement.remove();
                    this.addMessage('Error al procesar tu mensaje. Por favor, intenta de nuevo.', 'system-message');
                    userInput.disabled = false;
                    if (sendBtn) sendBtn.disabled = false;
                }
            );
        } catch (error) {
            console.error('Error:', error);
            typingIndicator.remove();
            this.addMessage('Error al procesar tu mensaje. Por favor, intenta de nuevo.', 'system-message');
            userInput.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
        }
    }

    async generateEncounter() {
        const location = document.getElementById('location')?.value || 'genérica';
        const environment = document.getElementById('environment')?.value || 'variado';
        
        this.addMessage(`Generando encuentro en ${location} (${environment})...`, 'system-message');
        
        try {
            const response = await fetch('/api/ai/generate-encounter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partyLevel: 3,
                    location: location,
                    environment: environment,
                    partySize: 4
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const encounter = data.encounter;
                let message = `✨ **Encuentro: ${encounter.name || 'Encuentro generado'}** ✨\n\n`;
                message += `📖 ${encounter.description || 'Descripción no disponible'}\n\n`;
                
                if (encounter.creatures) {
                    message += `**Criaturas:**\n`;
                    encounter.creatures.forEach(c => {
                        message += `• ${c.name} (x${c.count}, CR ${c.cr})\n`;
                    });
                    message += `\n`;
                }
                
                if (encounter.difficulty) {
                    message += `**Dificultad:** ${encounter.difficulty}\n\n`;
                }
                
                if (encounter.rewards) {
                    message += `**Recompensa:** ${encounter.rewards}\n\n`;
                }
                
                if (encounter.dm_tips) {
                    message += `💡 **Consejos DM:** ${encounter.dm_tips}`;
                }
                
                this.addMessage(message, 'ai-message');
            } else {
                this.addMessage(`Error generando encuentro: ${data.error}`, 'system-message');
            }
        } catch (error) {
            console.error('Error generando encuentro:', error);
            this.addMessage(`Error: ${error.message}`, 'system-message');
        }
    }

    async analyzeBestiary() {
        const creatureName = prompt('¿Qué criatura del bestiario quieres mejorar?');
        if (!creatureName) return;
        
        this.addMessage(`Mejorando información de: ${creatureName}...`, 'system-message');
        
        try {
            const response = await fetch('/api/ai/query-bestiary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    creatureName: creatureName,
                    query: 'Información detallada'
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.addMessage(`📖 **${creatureName}**\n\n${data.response}`, 'ai-message');
            } else {
                this.addMessage(`Error: ${data.error}`, 'system-message');
            }
        } catch (error) {
            console.error('Error mejorando bestiario:', error);
            this.addMessage(`Error: ${error.message}`, 'system-message');
        }
    }

    addMessage(content, type) {
        const messagesContainer = document.getElementById('chatMessages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        
        if (type === 'ai-message' && content) {
            content = this.formatMessage(content);
        }
        
        messageDiv.innerHTML = content.replace(/\n/g, '<br>');
        messagesContainer.appendChild(messageDiv);
        this.scrollToBottom();
        
        return messageDiv;
    }

    addSystemMessage(content) {
        this.addMessage(content, 'system-message');
    }

    createMessageElement(content, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.innerHTML = content.replace(/\n/g, '<br>');
        return messageDiv;
    }

    formatMessageElement(element) {
        if (element.textContent) {
            element.innerHTML = this.formatMessage(element.textContent).replace(/\n/g, '<br>');
        }
    }

    addTypingIndicator() {
        const messagesContainer = document.getElementById('chatMessages');
        const indicator = document.createElement('div');
        indicator.className = 'message ai-message typing';
        indicator.innerHTML = '<span>.</span><span>.</span><span>.</span>';
        messagesContainer.appendChild(indicator);
        this.scrollToBottom();
        return indicator;
    }

    formatMessage(text) {
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        text = text.replace(/`(.*?)`/g, '<code>$1</code>');
        text = text.replace(/^# (.*$)/gm, '<h4>$1</h4>');
        return text;
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatMessages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    showChat() {
        const container = document.querySelector('.ai-chat-container');
        if (container) {
            container.style.display = 'flex';
            container.classList.add('active');
        }
    }

    hideChat() {
        const container = document.querySelector('.ai-chat-container');
        if (container) {
            container.style.display = 'none';
            container.classList.remove('active');
        }
    }
}

// Inicializar cuando el DOM esté listo
let aiChatInstance = null;

document.addEventListener('DOMContentLoaded', async () => {
    aiChatInstance = new AIChatUI();
    await aiChatInstance.init();
    window.aiChat = aiChatInstance;
    
    // Mostrar el chat por defecto (ya está visible en el HTML)
    console.log('AIChatUI inicializado correctamente');
});

export default AIChatUI;