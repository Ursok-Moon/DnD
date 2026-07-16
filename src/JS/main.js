import './config.js';

// Importar clases principales
import { CharacterSheet } from './core/CharacterSheet.js';
import { TabManager } from './core/TabManager.js';
import { NewCharacterModal } from './core/NewCharacterModal.js';

// Estilos para el sistema de pestañas
const tabStyles = document.createElement('style');
tabStyles.textContent = `
    .tab-system {
        display: flex;
        flex-direction: column;
        height: 100%;
        width: 100%;
        margin-top: 10px;
    }

    .tab-bar {
        display: flex;
        align-items: center;
        background: var(--tab-bar-bg, var(--parchment-dark, #e6d0b5));
        border-bottom: 3px solid var(--accent-gold, #d4af37);
        padding: 5px 10px 0 10px;
        flex-shrink: 0;
        min-height: 45px;
        gap: 5px;
        flex-wrap: wrap;
        border-radius: 8px 8px 0 0;
        transition: background 0.3s ease;
    }

    .tab-list {
        display: flex;
        list-style: none;
        padding: 0;
        margin: 0;
        gap: 3px;
        flex: 1;
        overflow-x: auto;
        align-items: flex-end;
    }

    .tab-item {
        background: var(--parchment-light, #f5e6d3);
        border: 2px solid var(--accent-gold, #d4af37);
        border-bottom: none;
        border-radius: 8px 8px 0 0;
        padding: 8px 12px 6px 12px;
        font-family: 'Cinzel', serif;
        font-size: 0.85rem;
        color: var(--ink-dark, #2c1810);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 10px;
        white-space: nowrap;
        transition: all 0.2s ease;
        flex-shrink: 0;
        max-width: 200px;
    }

    .tab-item:hover {
        background: var(--parchment, #ecdcc8);
    }

    .tab-item.active {
        background: white;
        border-bottom: 2px solid white;
        font-weight: bold;
        color: var(--accent-blue, #1e3a5f);
        box-shadow: 0 -2px 8px rgba(0,0,0,0.1);
        position: relative;
        z-index: 2;
    }

    .tab-item .tab-name {
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 120px;
    }

    .tab-item .tab-close-btn {
        background: none;
        border: none;
        color: var(--ink-light, #5c4033);
        font-size: 1.2rem;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
        border-radius: 4px;
        transition: all 0.2s ease;
    }

    .tab-item .tab-close-btn:hover {
        background: var(--accent-red, #8b0000);
        color: white;
        transform: scale(1.2);
    }

    .tab-new-btn {
        background: linear-gradient(145deg, var(--accent-gold, #d4af37), #f4c542);
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        color: white;
        font-size: 1.2rem;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.3s ease;
        box-shadow: 0 2px 6px rgba(0,0,0,0.2);
    }

    .tab-new-btn:hover {
        transform: scale(1.1) rotate(90deg);
        background: var(--accent-purple, #6a0dad);
    }

    .tab-content-area {
        flex: 1;
        background: var(--parchment-light, #f5e6d3);
        border: 2px solid var(--accent-gold, #d4af37);
        border-top: none;
        border-radius: 0 0 8px 8px;
        padding: 20px;
        overflow-y: auto;
        position: relative;
        min-height: 400px;
    }

    .tab-content {
        display: none;
        height: 100%;
        animation: fadeIn 0.3s ease;
    }

    .tab-content.active {
        display: block;
    }

    #newCharacterModal .form-group {
        margin-bottom: 15px;
    }

    #newCharacterModal .form-group label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: bold;
        color: var(--ink-dark, #2c1810);
        margin-bottom: 5px;
        font-size: 0.9rem;
    }

    #newCharacterModal .form-group input {
        width: 100%;
        padding: 10px 12px;
        border: 2px solid var(--accent-gold, #d4af37);
        border-radius: 6px;
        font-family: 'Cinzel', serif;
        font-size: 0.95rem;
        background: white;
        transition: border-color 0.3s ease;
    }

    #newCharacterModal .form-group input:focus {
        outline: none;
        border-color: var(--accent-purple, #6a0dad);
        box-shadow: 0 0 0 3px rgba(106, 13, 173, 0.2);
    }

    .search-results {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        max-height: 200px;
        overflow-y: auto;
        background: white;
        border: 2px solid var(--accent-gold, #d4af37);
        border-radius: 4px;
        list-style: none;
        padding: 0;
        margin: 0;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    .search-results li {
        padding: 10px 15px;
        cursor: pointer;
        border-bottom: 1px solid var(--parchment-dark, #e6d0b5);
        font-family: 'Cinzel', serif;
        transition: background 0.2s ease;
    }

    .search-results li:hover {
        background: var(--parchment-light, #f5e6d3);
    }

    .search-results .highlight {
        background: var(--accent-gold, #d4af37);
        color: var(--ink-black, #1a0f0a);
        font-weight: bold;
        padding: 0 2px;
        border-radius: 2px;
    }

    @media (max-width: 768px) {
        .tab-bar {
            flex-wrap: wrap;
            padding: 5px;
            min-height: auto;
        }
        .tab-item {
            font-size: 0.75rem;
            padding: 5px 8px;
            max-width: 140px;
        }
        .tab-item .tab-name {
            max-width: 80px;
        }
        .tab-new-btn {
            width: 28px;
            height: 28px;
            font-size: 1rem;
        }
        .tab-content-area {
            padding: 10px;
        }
        #newCharacterModal .modal-content {
            margin: 20px;
            max-width: 95%;
        }
    }
`;
document.head.appendChild(tabStyles);

// Función para esperar a que el DOM esté listo
function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const check = () => {
            const element = document.querySelector(selector);
            if (element) {
                resolve(element);
            } else if (Date.now() - startTime > timeout) {
                reject(new Error(`Elemento "${selector}" no encontrado después de ${timeout}ms`));
            } else {
                setTimeout(check, 100);
            }
        };
        check();
    });
}

// ============================================================
// FUNCIÓN PARA OBTENER EL CHARACTERSHEET ACTIVO
// ============================================================
function getActiveCharacterSheet() {
    // 1. Intentar desde window.characterSheet
    if (window.characterSheet && typeof window.characterSheet.saveCharacter === 'function') {
        return window.characterSheet;
    }
    
    // 2. Intentar desde tabManager
    if (window.tabManager) {
        const activeTab = window.tabManager.getActiveTabData();
        if (activeTab && activeTab.characterSheet) {
            return activeTab.characterSheet;
        }
    }
    
    // 3. Buscar en todas las pestañas
    if (window.tabManager && window.tabManager.tabs) {
        for (const tab of window.tabManager.tabs) {
            if (tab.characterSheet && typeof tab.characterSheet.saveCharacter === 'function') {
                return tab.characterSheet;
            }
        }
    }
    
    return null;
}

// ============================================================
// FUNCIÓN PARA ESPERAR CHARACTERSHEET CON VERIFICACIÓN PERIÓDICA
// ============================================================
function waitForCharacterSheet(maxAttempts = 30, interval = 300) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            
            // Verificar si hay un CharacterSheet disponible
            const sheet = getActiveCharacterSheet();
            if (sheet) {
                clearInterval(checkInterval);
                console.log(`✅ CharacterSheet disponible después de ${attempts} intentos`);
                resolve(sheet);
                return;
            }
            
            if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                reject(new Error(`CharacterSheet no disponible después de ${maxAttempts} intentos`));
            }
        }, interval);
    });
}

// ============================================================
// FUNCIÓN PARA INICIALIZAR BOTONES DEL FOOTER
// ============================================================
async function setupFooterButtons() {
    try {
        // Esperar a que CharacterSheet esté disponible
        const sheet = await waitForCharacterSheet();
        console.log('🔧 Configurando botones del footer...');

        // Botón Guardar
        const saveBtn = document.querySelector('#saveBtn');
        if (saveBtn) {
            const newSave = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSave, saveBtn);
            newSave.addEventListener('click', () => {
                console.log('💾 Guardando desde footer...');
                sheet.saveCharacter();
            });
        }

        // Botón Exportar
        const exportBtn = document.querySelector('#exportBtn');
        if (exportBtn) {
            const newExport = exportBtn.cloneNode(true);
            exportBtn.parentNode.replaceChild(newExport, exportBtn);
            newExport.addEventListener('click', () => {
                console.log('📤 Exportando desde footer...');
                sheet.exportCharacter();
            });
        }

        // Botón Importar
        const importBtn = document.querySelector('#importBtn');
        if (importBtn) {
            const newImport = importBtn.cloneNode(true);
            importBtn.parentNode.replaceChild(newImport, importBtn);
            newImport.addEventListener('click', () => {
                console.log('📥 Importando desde footer...');
                sheet.importCharacter();
            });
        }

        // Botón Restablecer
        const resetBtn = document.querySelector('#resetBtn');
        if (resetBtn) {
            const newReset = resetBtn.cloneNode(true);
            resetBtn.parentNode.replaceChild(newReset, resetBtn);
            newReset.addEventListener('click', () => {
                console.log('🔄 Restableciendo desde footer...');
                if (confirm('¿Restablecer toda la hoja? Se perderán los cambios no guardados.')) {
                    sheet.resetAll();
                }
            });
        }

        // Botón Personalizar Colores
        const colorBtn = document.querySelector('#colorCustomizerBtn');
        if (colorBtn) {
            const newColor = colorBtn.cloneNode(true);
            colorBtn.parentNode.replaceChild(newColor, colorBtn);
            newColor.addEventListener('click', () => {
                console.log('🎨 Abriendo personalizador de colores...');
                sheet.showColorCustomizer();
            });
        }

        // Botón Personalizar Colores de Texto
        const textBtn = document.querySelector('#textCustomizerBtn');
        if (textBtn) {
            const newText = textBtn.cloneNode(true);
            textBtn.parentNode.replaceChild(newText, textBtn);
            newText.addEventListener('click', () => {
                console.log('🔤 Abriendo personalizador de colores de texto...');
                sheet.showTextColorCustomizer();
            });
        }

        console.log('✅ Botones del footer configurados correctamente');
    } catch (error) {
        console.error('❌ Error configurando botones del footer:', error);
        // Reintentar después de 2 segundos
        setTimeout(setupFooterButtons, 2000);
    }
}

// ============================================================
// FUNCIÓN PARA INICIALIZAR WEBSOCKET
// ============================================================
function setupWebSocket() {
    // Si ya existe un WebSocket global, no hacer nada
    if (window.wsClient) return;

    // Esperar a que el script de websocket se cargue
    if (typeof io !== 'undefined') {
        try {
            window.wsClient = io();
            window.wsClient.on('connect', () => {
                console.log('🔌 WebSocket conectado');
            });
            window.wsClient.on('disconnect', () => {
                console.log('🔌 WebSocket desconectado');
            });
        } catch (error) {
            console.warn('⚠️ Error conectando WebSocket:', error);
        }
    } else {
        console.warn('⚠️ Socket.io no disponible, esperando...');
        setTimeout(setupWebSocket, 1000);
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('🚀 Iniciando La Libreta del Escriba con sistema de pestañas...');

        // Esperar a que el DOM esté listo
        await waitForElement('.parchment', 10000);
        console.log('✅ DOM listo');

        // Configurar el sistema de pestañas
        let tabSystem = document.getElementById('tabSystemContainer');
        const parchment = document.querySelector('.parchment');
        
        if (!tabSystem && parchment) {
            console.log('📦 Creando sistema de pestañas...');
            
            let mainContent = document.querySelector('.character-sheet');
            const footer = document.querySelector('.footer');
            
            if (!mainContent) {
                mainContent = document.getElementById('hojaPrincipal');
            }
            
            if (!mainContent) {
                console.warn('⚠️ No se encontró .character-sheet, creando estructura básica...');
                mainContent = document.createElement('main');
                mainContent.className = 'character-sheet';
                mainContent.id = 'hojaPrincipal';
                mainContent.innerHTML = `
                    <div class="left-column">
                        <section class="card basic-info">
                            <h3 class="card-title">INFORMACIÓN DEL PERSONAJE</h3>
                            <div class="form-row">
                                <label>Nombre</label>
                                <input type="text" id="char-name" placeholder="...">
                            </div>
                        </section>
                    </div>
                    <div class="center-column"></div>
                    <div class="right-column"></div>
                    <div class="full-width"></div>
                `;
                if (footer) {
                    parchment.insertBefore(mainContent, footer);
                } else {
                    parchment.appendChild(mainContent);
                }
            }
            
            tabSystem = document.createElement('div');
            tabSystem.id = 'tabSystemContainer';
            tabSystem.className = 'tab-system';
            
            tabSystem.innerHTML = `
                <nav class="tab-bar" id="tabBar">
                    <ul class="tab-list" id="tabList"></ul>
                    <button class="tab-new-btn" id="newTabBtn" title="Nueva Hoja de Personaje">
                        <i class="fas fa-plus"></i>
                    </button>
                </nav>
                <div class="tab-content-area" id="tabContentArea"></div>
            `;
            
            const contentArea = tabSystem.querySelector('#tabContentArea');
            if (mainContent && contentArea) {
                if (mainContent.id !== 'hojaPrincipal') {
                    mainContent.id = 'hojaPrincipal';
                }
                mainContent.className = 'tab-content active';
                contentArea.appendChild(mainContent);
            }
            
            if (footer) {
                parchment.insertBefore(tabSystem, footer);
            } else {
                parchment.appendChild(tabSystem);
            }
            
            console.log('✅ Sistema de pestañas insertado en el DOM');
        }

        // Inicializar Tab Manager
        const tabManager = new TabManager({
            containerId: 'tabSystemContainer',
            CharacterSheetClass: CharacterSheet
        });

        // Exponer tabManager globalmente para que getActiveCharacterSheet pueda usarlo
        window.tabManager = tabManager;

        // RESTAURAR ÚLTIMA PESTAÑA ACTIVA
        const lastTabId = localStorage.getItem('lastActiveTabId');
        if (lastTabId && tabManager.getTabData(lastTabId)) {
            tabManager.activateTab(lastTabId);
        } else if (tabManager.tabs.length > 0) {
            tabManager.activateTab(tabManager.tabs[0].id);
        }

        // Guardar pestaña activa al cambiar
        tabManager.onTabChange((tabId) => {
            localStorage.setItem('lastActiveTabId', tabId);
        });

        // Inicializar Modal de nueva hoja
        const newCharModalInstance = new NewCharacterModal(tabManager, CharacterSheet);

        tabManager.onNewTabClick = () => {
            newCharModalInstance.show();
        };

        // ============================================================
        // INICIALIZAR CHARACTERSHEET PRINCIPAL
        // ============================================================
        const mainContent = document.getElementById('hojaPrincipal');
        if (mainContent) {
            try {
                // Verificar si ya hay una instancia
                if (!window.characterSheet) {
                    window.characterSheet = new CharacterSheet('hojaPrincipal', 'tab-main');
                    console.log('✅ CharacterSheet principal inicializado');
                }
            } catch (error) {
                console.error('❌ Error inicializando CharacterSheet principal:', error);
                try {
                    window.characterSheet = new CharacterSheet();
                } catch (e) {
                    console.error('❌ Fallback también falló:', e);
                }
            }
        }

        // ============================================================
        // CONFIGURAR BOTONES DEL FOOTER - AHORA CON ESPERA INTELIGENTE
        // ============================================================
        // Iniciar la configuración de botones, con reintentos automáticos
        setTimeout(() => {
            setupFooterButtons().catch(err => {
                console.warn('⚠️ Error en setupFooterButtons:', err);
            });
        }, 500);

        // También configurar cuando se crean nuevas pestañas
        tabManager.onTabCreate(() => {
            setTimeout(() => {
                setupFooterButtons().catch(err => {
                    console.warn('⚠️ Error en setupFooterButtons (tab):', err);
                });
            }, 500);
        });

        // ============================================================
        // CARGAR ÚLTIMO PERSONAJE GUARDADO
        // ============================================================
        setTimeout(() => {
            const sheet = getActiveCharacterSheet();
            if (sheet && sheet.loadSavedCharacterData) {
                console.log('📂 Cargando último personaje guardado...');
                sheet.loadSavedCharacterData();
            }
        }, 500);

        // ============================================================
        // GUARDAR AL CERRAR LA PÁGINA
        // ============================================================
        window.addEventListener('beforeunload', () => {
            const sheet = getActiveCharacterSheet();
            if (sheet && sheet.saveCharacter) {
                console.log('💾 Guardando personaje antes de cerrar...');
                sheet.saveCharacter();
            }
        });

        // ============================================================
        // CONFIGURAR WEBSOCKET
        // ============================================================
        setupWebSocket();

        // Exponer para debug
        window.newCharModal = newCharModalInstance;
        window.getActiveCharacterSheet = getActiveCharacterSheet;
        window.setupFooterButtons = setupFooterButtons;

        console.log('✅ Aplicación iniciada correctamente con sistema de pestañas');
        
    } catch (error) {
        console.error('❌ Error fatal al iniciar:', error);
    }
});