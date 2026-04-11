class GroqClient {
  constructor() {
    this.apiKey = null;
    this.model = 'mixtral-8x7b-32768';
  }
  
  async initialize() {
    try {
      // Verificar estado de Groq
      const response = await fetch('/api/ai/status');
      const data = await response.json();
      
      if (data.available) {
        console.log('✅ Groq inicializado correctamente');
        this.model = data.model;
        return true;
      } else {
        console.warn('⚠️ Groq no disponible');
        return false;
      }
    } catch (error) {
      console.error('❌ Error inicializando Groq:', error);
      return false;
    }
  }
  
  async generate(prompt, options = {}) {
    try {
      // Llamar al endpoint de chat del servidor
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: prompt,
          context: options.context || {},
          history: options.history || []
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        return { success: true, response: data.response };
      } else {
        throw new Error(data.error || 'Error en la respuesta');
      }
    } catch (error) {
      console.error('Error en generate:', error);
      return { success: false, error: error.message };
    }
  }
  
  async generateStream(prompt, onChunk, options = {}) {
    try {
      const response = await fetch('/api/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: prompt,
          context: options.context || {},
          history: options.history || []
        })
      });
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        if (onChunk) onChunk(chunk);
      }
      
      return { success: true };
    } catch (error) {
      console.error('Error en generateStream:', error);
      return { success: false, error: error.message };
    }
  }
  
  async enhanceBestiary(entry) {
    try {
      const response = await fetch('/api/ai/enhance-bestiary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ entry })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error en enhanceBestiary:', error);
      return { success: false, error: error.message };
    }
  }
  
  async generateEncounter(partyLevel, location, environment, partySize) {
    try {
      const response = await fetch('/api/ai/generate-encounter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          partyLevel,
          location,
          environment,
          partySize
        })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error en generateEncounter:', error);
      return { success: false, error: error.message };
    }
  }
  
  async analyzeCharacter(characterData) {
    try {
      const response = await fetch('/api/ai/analyze-character', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ characterData })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error en analyzeCharacter:', error);
      return { success: false, error: error.message };
    }
  }
  
  async generateDialogue(npc, situation, playerAction) {
    try {
      const response = await fetch('/api/ai/generate-dialogue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ npc, situation, playerAction })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error en generateDialogue:', error);
      return { success: false, error: error.message };
    }
  }
  
  async suggestActions(situation, character) {
    try {
      const response = await fetch('/api/ai/suggest-actions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ situation, character })
      });
      
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error en suggestActions:', error);
      return { success: false, error: error.message };
    }
  }
}

export default GroqClient;