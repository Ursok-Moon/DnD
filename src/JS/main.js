// js/main.js
// Importar configuración
import './config.js';

// Importar clases principales
import { CharacterSheet } from './core/CharacterSheet.js';
import { SidebarManager } from './sidebar.js';
import { TutorialSystem } from './tutorial.js';

// NO inicialices WebSocket aquí, ya se inicializa en websocket.js

// Estilos globales
const style = document.createElement('style');
style.textContent = `/* tus estilos */`;
document.head.appendChild(style);

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Iniciando La Libreta del Escriba...');
        
        // EL WEBSOCKET YA SE INICIALIZA SOLO EN websocket.js
        
        // Inicializar Sidebar
        const sidebarManager = new SidebarManager();
        window.sidebarManager = sidebarManager;
        
        // Inicializar Tutorial
        const tutorialSystem = new TutorialSystem();
        tutorialSystem.init();
        window.tutorialSystem = tutorialSystem;
        
        // Inicializar CharacterSheet (esto usará window.wsClient)
        window.characterSheet = new CharacterSheet();
        
        console.log('✅ Aplicación iniciada correctamente');
    } catch (error) {
        console.error('❌ Error fatal al iniciar:', error);
    }
});