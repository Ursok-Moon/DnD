// Módulo de chat IA para la Pantalla del DM
class DMChat {
    constructor() {
        this.apiUrl = '/api/ai';
        this.conversationHistory = [];
        this.maxHistoryLength = 10;
        this.isConnected = false;
        this.isStreaming = true;
        this.init();
    }

    async init() {
        await this.checkConnection();
        this.attachEventListeners();
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
                console.log('IA conectado para DM Screen');
                this.enableChat(true);
                this.addSystemMessage(' Pregúntame sobre reglas, encuentros, NPCs y más.');
            } else {
                this.isConnected = false;
                if (statusDiv) {
                    statusDiv.innerHTML = '<i class="fas fa-exclamation-triangle"></i> no disponible';
                    statusDiv.style.color = '#fbbf24';
                }
                this.enableChat(false);
                this.addSystemMessage('⚠️ No se pudo conectar. Verifica tu API key.');
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
    }

    async sendMessage() {
        const input = document.getElementById('aiChatInputInline');
        const message = input.value.trim();
        
        if (!message) return;
        
        if (!this.isConnected) {
            this.addSystemMessage('No hay conexión con Groq. Por favor, recarga la página.');
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
            const history = this.conversationHistory.slice(-this.maxHistoryLength);
            
            if (this.isStreaming) {
                // Crear elemento para la respuesta
                const messageElement = this.createMessageElement('', 'assistant-message');
                const messagesContainer = document.getElementById('aiChatMessagesInline');
                messagesContainer.appendChild(messageElement);
                
                const response = await fetch(`${this.apiUrl}/chat/stream`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, history })
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
            } else {
                const response = await fetch(`${this.apiUrl}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message, history })
                });
                
                const data = await response.json();
                typingIndicator.remove();
                
                if (data.success) {
                    this.addMessage(data.response, 'assistant-message');
                    this.conversationHistory.push(
                        { role: 'user', content: message },
                        { role: 'assistant', content: data.response }
                    );
                } else {
                    throw new Error(data.error || 'Error en la respuesta');
                }
            }
        } catch (error) {
            console.error('Error:', error);
            typingIndicator.remove();
            this.addSystemMessage(`Error: ${error.message}`);
        } finally {
            // Re-habilitar input
            input.disabled = false;
            if (sendBtn) sendBtn.disabled = false;
            input.focus();
            this.scrollToBottom();
        }
    }

    addMessage(content, type) {
        const messagesContainer = document.getElementById('aiChatMessagesInline');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${type}`;
        
        if (type === 'assistant-message' && content) {
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
        messageDiv.className = `ai-message ${type}`;
        messageDiv.innerHTML = content.replace(/\n/g, '<br>');
        return messageDiv;
    }

    formatMessageElement(element) {
        if (element.textContent) {
            element.innerHTML = this.formatMessage(element.textContent).replace(/\n/g, '<br>');
        }
    }

    addTypingIndicator() {
        const messagesContainer = document.getElementById('aiChatMessagesInline');
        const indicator = document.createElement('div');
        indicator.className = 'ai-message typing-indicator';
        indicator.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(indicator);
        this.scrollToBottom();
        return indicator;
    }

    formatMessage(text) {
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
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.dmChat = new DMChat();
});