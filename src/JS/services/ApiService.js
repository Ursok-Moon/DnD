export class ApiService {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
    }

    async saveCharacter(characterData) {
        try {
            console.log('📤 Enviando personaje al servidor:', characterData.nombre);
            
            const response = await fetch(`${this.baseUrl}/personajes/guardar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(characterData)
            });
            
            console.log('📥 Respuesta del servidor - Status:', response.status);
            
            const data = await response.json();
            console.log('📦 Datos de respuesta:', data);
            
            if (!response.ok) {
                console.error('❌ Error en respuesta del servidor:', data);
                return { success: false, error: data.error || 'Error desconocido' };
            }
            
            return { success: true, data };
            
        } catch (error) {
            console.error('❌ Error saving character:', error);
            return { success: false, error: error.message };
        }
    }

    // NUEVO: Registrar usuario en el servidor
    async registrarUsuario(nombre, socketId = null) {
        try {
            const response = await fetch(`${this.baseUrl}/usuario/registrar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    nombre: nombre,
                    socketId: socketId,
                    ip: window.location.hostname
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                console.error('❌ Error registrando usuario:', data);
                return { success: false, error: data.error };
            }
            
            console.log('✅ Usuario registrado:', data.usuario.nombre);
            return { success: true, usuario: data.usuario };
            
        } catch (error) {
            console.error('❌ Error registrando usuario:', error);
            return { success: false, error: error.message };
        }
    }

    async uploadImage(file) {
        const formData = new FormData();
        formData.append('imagen', file);
        
        try {
            const response = await fetch(`${this.baseUrl}/imagenes/subir`, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                const data = await response.json();
                return data.imagenUrl;
            }
            return null;
        } catch (error) {
            console.error('Error uploading image:', error);
            return null;
        }
    }

    async getTodaysCharacters() {
        try {
            const response = await fetch(`${this.baseUrl}/personajes/hoy`);
            if (response.ok) {
                const data = await response.json();
                return data.personajes || [];
            }
            return [];
        } catch (error) {
            console.error('Error fetching characters:', error);
            return [];
        }
    }

    async getUsuarios() {
        try {
            const response = await fetch(`${this.baseUrl}/usuarios`);
            if (response.ok) {
                const data = await response.json();
                return data.usuarios || [];
            }
            return [];
        } catch (error) {
            console.error('Error fetching usuarios:', error);
            return [];
        }
    }
}