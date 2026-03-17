const CONFIG = {
    SERVER_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000' 
        : '',
    
    API: {
        BESTIARIO: '/api/json/bestiario',
        BESTIARIO_ENG: '/api/json/bestiario-eng',
        DEMO: '/api/json/demo',
        BUSCAR: '/api/bestiario/buscar'
    },
    
    APP: {
        NOMBRE: 'Bestiario DM',
        VERSION: '1.0.0',
        TIEMPO_NOTIFICACION: 3000
    }
};

window.CONFIG = CONFIG;