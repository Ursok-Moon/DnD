// Servicio para manejar comunicación con la IA
class AIService {
    constructor() {
        this.apiUrl = '/api/ai';
        this.conversationHistory = [];
        this.maxHistoryLength = 10;
    }

    /**
     * Enviar mensaje al asistente
     */
    async sendMessage(message) {
        try {
            // Preparar historial (últimos N mensajes)
            const history = this.conversationHistory.slice(-this.maxHistoryLength);
            
            const response = await fetch(`${this.apiUrl}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    history: history
                })
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }

            const data = await response.json();
            
            // Actualizar historial
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: data.response }
            );
            
            return data.response;
        } catch (error) {
            console.error('Error enviando mensaje:', error);
            throw error;
        }
    }

    /**
     * Enviar mensaje con streaming
     */
    async sendMessageStream(message, onChunk, onComplete, onError) {
        try {
            const history = this.conversationHistory.slice(-this.maxHistoryLength);
            
            const response = await fetch(`${this.apiUrl}/chat/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    history: history
                })
            });

            if (!response.ok) {
                throw new Error(`Error HTTP: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value);
                fullResponse += chunk;
                if (onChunk) onChunk(chunk);
            }

            // Actualizar historial
            this.conversationHistory.push(
                { role: 'user', content: message },
                { role: 'assistant', content: fullResponse }
            );
            
            if (onComplete) onComplete(fullResponse);
        } catch (error) {
            console.error('Error en streaming:', error);
            if (onError) onError(error);
        }
    }

    /**
     * Consultar bestiario
     */
    async queryBestiary(creatureName, query = '') {
        try {
            const response = await fetch(`${this.apiUrl}/bestiary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    creatureName: creatureName,
                    query: query
                })
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }

            const data = await response.json();
            return data.response;
        } catch (error) {
            console.error('Error consultando bestiario:', error);
            throw error;
        }
    }

    /**
     * Generar contenido RPG
     */
    async generateContent(type, parameters = {}) {
        try {
            const response = await fetch(`${this.apiUrl}/generate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: type,
                    parameters: parameters
                })
            });

            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }

            const data = await response.json();
            return data.content;
        } catch (error) {
            console.error('Error generando contenido:', error);
            throw error;
        }
    }

    /**
     * Limpiar historial de conversación
     */
    clearHistory() {
        this.conversationHistory = [];
    }

    /**
     * Obtener historial actual
     */
    getHistory() {
        return [...this.conversationHistory];
    }
}

// Exportar la clase, NO crear una instancia aquí
export default AIService;