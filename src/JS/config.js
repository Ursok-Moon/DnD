// js/config.js
const CONFIG = {
    // Configuración del servidor
    SERVER_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000' 
        : '',
    PATHS: {
        API: '/api',
        UPLOADS: '/uploads'
    },
    
    // Endpoints específicos
    API_ENDPOINTS: {
        BESTIARIO: '/api/json/bestiario',
        BESTIARIO_ENG: '/api/json/bestiario-eng',
        DEMO: '/api/json/demo',
        BUSCAR: '/api/bestiario/buscar',
        PERSONAJES_GUARDAR: '/api/personajes/guardar',
        PERSONAJES_HOY: '/api/personajes/hoy',
        IMAGENES_SUBIR: '/api/imagenes/subir'
    },
    
    APP: {
        NOMBRE: 'Bestiario DM',
        VERSION: '1.0.0',
        TIEMPO_NOTIFICACION: 3000
    }
};

window.CONFIG = CONFIG;