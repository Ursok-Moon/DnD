class TutorialSystem {
    constructor() {
        this.isActive = false;
        this.currentModal = null;
        this.tutorialElements = [];
        this.init();
    }

    init() {
        // Añadir toggle switch al sidebar
        this.addTutorialToggleToSidebar();
        
        // Crear el contenedor del modal
        this.createModalContainer();
        
        // Inicializar elementos tutoriales (excluyendo sidebar)
        this.initTutorialElements();
        
        // Escuchar cambios en el sidebar (colapsar/expandir)
        this.listenToSidebarChanges();
        
        // Cargar estado guardado
        this.loadState();
    }

    addTutorialToggleToSidebar() {
        // Esperar a que el sidebar esté disponible
        const sidebar = document.querySelector('.sidebar');
        if (!sidebar) {
            console.log('Sidebar no encontrado, esperando...');
            setTimeout(() => this.addTutorialToggleToSidebar(), 500);
            return;
        }

        // Buscar el footer del sidebar o crear uno nuevo
        let sidebarFooter = sidebar.querySelector('.sidebar-footer');
        
        // Crear el wrapper para el toggle
        const toggleWrapper = document.createElement('div');
        toggleWrapper.className = 'tutorial-toggle-wrapper';
        
        toggleWrapper.innerHTML = `
            <label class="tutorial-toggle-label">
                <i class="fas fa-graduation-cap"></i>
                <span>Tutorial</span>
                <div class="tutorial-switch">
                    <input type="checkbox" id="tutorialSwitch">
                    <span class="tutorial-switch-slider"></span>
                </div>
            </label>
        `;
        
        // Si hay footer, añadir antes, si no, añadir al final del sidebar
        if (sidebarFooter) {
            sidebar.insertBefore(toggleWrapper, sidebarFooter);
        } else {
            sidebar.appendChild(toggleWrapper);
        }
        
        // Añadir event listener al switch
        const tutorialSwitch = document.getElementById('tutorialSwitch');
        if (tutorialSwitch) {
            tutorialSwitch.addEventListener('change', (e) => {
                this.toggleTutorial(e.target.checked);
            });
        }
    }

    listenToSidebarChanges() {
        // Observar cambios en el sidebar para ajustar el toggle
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.attributeName === 'class') {
                        // El sidebar cambió de estado (colapsado/expandido)
                        // No necesitamos hacer nada especial, el CSS maneja esto
                    }
                });
            });
            
            observer.observe(sidebar, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    }

    createModalContainer() {
        // Verificar si ya existe
        if (document.getElementById('tutorialModal')) {
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'tutorial-modal';
        modal.id = 'tutorialModal';
        
        modal.innerHTML = `
            <div class="tutorial-modal-content">
                <button class="tutorial-close-btn" id="tutorialCloseBtn">
                    <i class="fas fa-times"></i>
                </button>
                <div class="tutorial-modal-header">
                    <i class="fas fa-question-circle"></i>
                    <h2 id="tutorialModalTitle">Ayuda</h2>
                </div>
                <div class="tutorial-modal-body" id="tutorialModalBody">
                    <!-- Contenido dinámico -->
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Cerrar modal al hacer clic fuera
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
        
        // Botón de cerrar
        const closeBtn = document.getElementById('tutorialCloseBtn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }
    }

    initTutorialElements() {
        // Definir todos los elementos que tendrán tutorial
        const elements = [
            // Menú superior estático
            { selector: '.static-menu-btn[data-section="initiative"]', title: 'Gestión de Iniciativa', content: this.getInitiativeHelp(), excludeSidebar: true },
            { selector: '.static-menu-btn[data-section="manual"]', title: 'Manual del DM', content: this.getManualHelp(), excludeSidebar: true },
            { selector: '.static-menu-btn[data-section="bestiary"]', title: 'Bestiario', content: this.getBestiaryHelp(), excludeSidebar: true },
            { selector: '.static-menu-btn[data-section="campaign"]', title: 'Campaña', content: this.getCampaignHelp(), excludeSidebar: true },
            { selector: '.static-menu-btn[data-section="notes"]', title: 'Notas', content: this.getNotesHelp(), excludeSidebar: true },
            { selector: '.static-menu-btn[data-section="tools"]', title: 'Herramientas', content: this.getToolsHelp(), excludeSidebar: true },
            
            // Header
            { selector: '#newSessionBtn', title: 'Nueva Sesión', content: this.getNewSessionHelp(), excludeSidebar: true },
            { selector: '#saveSessionBtn', title: 'Guardar Sesión', content: this.getSaveSessionHelp(), excludeSidebar: true },
            { selector: '#loadSessionBtn', title: 'Cargar Sesión', content: this.getLoadSessionHelp(), excludeSidebar: true },
            { selector: '#toggleCombatBtn', title: 'Modo Combate', content: this.getCombatHelp(), excludeSidebar: true },
            
            // Sección de Iniciativa
            { selector: '#rollAllInitiative', title: 'Tirar Iniciativa Enemigos', content: this.getRollInitiativeHelp(), excludeSidebar: true },
            { selector: '#addPlayerBtn', title: 'Añadir Jugador', content: this.getAddPlayerHelp(), excludeSidebar: true },
            { selector: '#addEnemyBtn', title: 'Añadir Enemigo', content: this.getAddEnemyHelp(), excludeSidebar: true },
            { selector: '#sortInitiative', title: 'Ordenar Iniciativa', content: this.getSortInitiativeHelp(), excludeSidebar: true },
            { selector: '#clearOrder', title: 'Limpiar Orden', content: this.getClearOrderHelp(), excludeSidebar: true },
            { selector: '#nextTurnBtn', title: 'Siguiente Turno', content: this.getNextTurnHelp(), excludeSidebar: true },
            
            // Sección de PDFs
            { selector: '#loadManualBtn, #loadBestiaryBtn, #loadCampaignBtn', title: 'Cargar PDF', content: this.getPdfHelp(), excludeSidebar: true, multiple: true },
            { selector: '#loadBestiaryJsonBtn', title: 'Cargar Bestiario JSON', content: this.getJsonHelp(), excludeSidebar: true },
            { selector: '#resetBestiaryJsonBtn', title: 'Restaurar Bestiario', content: this.getResetJsonHelp(), excludeSidebar: true },
            
            // Sección de Notas
            { selector: '#formatBold', title: 'Negrita', content: this.getBoldHelp(), excludeSidebar: true },
            { selector: '#formatItalic', title: 'Cursiva', content: this.getItalicHelp(), excludeSidebar: true },
            { selector: '#formatUnderline', title: 'Subrayado', content: this.getUnderlineHelp(), excludeSidebar: true },
            { selector: '#formatH1', title: 'Título Principal', content: this.getH1Help(), excludeSidebar: true },
            { selector: '#formatH2', title: 'Subtítulo', content: this.getH2Help(), excludeSidebar: true },
            { selector: '#formatH3', title: 'Sub-subtítulo', content: this.getH3Help(), excludeSidebar: true },
            
            // Sección de Herramientas
            { selector: '#rollDiceBtn', title: 'Lanzar Dado', content: this.getDiceHelp(), excludeSidebar: true },
        ];
        
        this.tutorialElements = elements;
        
        // Añadir botones de información a cada elemento
        elements.forEach(element => {
            this.addInfoButtonsToElements(element.selector, element.title, element.content, element.multiple);
        });
    }

    // Métodos de ayuda para obtener contenido de los modales
    getInitiativeHelp() {
        return `
            <h3><i class="fas fa-swords"></i> Gestión de Iniciativa</h3>
            <p>Controla el orden de combate de forma sencilla y eficiente.</p>
            <ul>
                <li><i class="fas fa-user-plus"></i> Añade jugadores con su iniciativa, CA y vida</li>
                <li><i class="fas fa-skull"></i> Añade enemigos manualmente o buscando en el bestiario</li>
                <li><i class="fas fa-sort-amount-down"></i> Ordena automáticamente por iniciativa</li>
                <li><i class="fas fa-forward"></i> Avanza turnos y rondas automáticamente</li>
            </ul>
            <div class="tutorial-tip">
                <i class="fas fa-lightbulb"></i>
                <strong>Consejo:</strong> Usa "Tirar Enemigos" para generar iniciativas aleatorias para todos los monstruos.
            </div>
        `;
    }

    getManualHelp() {
        return `
            <h3><i class="fas fa-book"></i> Manual del DM</h3>
            <p>Accede al Manual del Dungeon Master en formato PDF.</p>
            <ul>
                <li><i class="fas fa-file-upload"></i> Carga tu propio manual en PDF</li>
                <li><i class="fas fa-chevron-left"></i> <i class="fas fa-chevron-right"></i> Navega entre páginas</li>
                <li><i class="fas fa-search-plus"></i> <i class="fas fa-search-minus"></i> Ajusta el zoom</li>
                <li><i class="fas fa-file-pdf"></i> Compatible con la mayoría de PDFs</li>
            </ul>
        `;
    }

    getBestiaryHelp() {
        return `
            <h3><i class="fas fa-dragon"></i> Bestiario</h3>
            <p>Consulta y gestiona tu colección de criaturas.</p>
            <ul>
                <li><i class="fas fa-file-pdf"></i> Carga bestiarios en PDF</li>
                <li><i class="fas fa-file-code"></i> Importa bestiarios personalizados en JSON</li>
                <li><i class="fas fa-undo-alt"></i> Restaura el bestiario por defecto</li>
                <li><i class="fas fa-search"></i> Busca criaturas directamente al añadir enemigos</li>
            </ul>
        `;
    }

    getCampaignHelp() {
        return `
            <h3><i class="fas fa-scroll"></i> Campaña</h3>
            <p>Gestiona todos los documentos de tu campaña.</p>
            <ul>
                <li><i class="fas fa-map"></i> Mapas y planos</li>
                <li><i class="fas fa-scroll"></i> Notas de campaña</li>
                <li><i class="fas fa-treasure-chest"></i> Tesoros y recompensas</li>
                <li><i class="fas fa-dungeon"></i> Descripciones de mazmorras</li>
            </ul>
        `;
    }

    getNotesHelp() {
        return `
            <h3><i class="fas fa-feather-alt"></i> Notas del DM</h3>
            <p>Editor de notas enriquecido para organizar tus ideas.</p>
            <ul>
                <li><i class="fas fa-bold"></i> <i class="fas fa-italic"></i> <i class="fas fa-underline"></i> Formato de texto</li>
                <li><i class="fas fa-heading"></i> Títulos y subtítulos (H1, H2, H3)</li>
                <li><i class="fas fa-folder"></i> Pestañas organizadas por categorías</li>
                <li><i class="fas fa-save"></i> Guardado automático</li>
            </ul>
        `;
    }

    getToolsHelp() {
        return `
            <h3><i class="fas fa-tools"></i> Herramientas del DM</h3>
            <p>Utilidades rápidas para tus sesiones.</p>
            <ul>
                <li><i class="fas fa-dice"></i> Lanzador de dados (d4 a d100)</li>
                <li><i class="fas fa-clock"></i> Temporizador para efectos y habilidades</li>
                <li><i class="fas fa-paint-brush"></i> Dibujar tus ideas</li>
            </ul>
        `;
    }

    getNewSessionHelp() {
        return `
            <h3><i class="fas fa-plus"></i> Nueva Sesión</h3>
            <p>Prepara una nueva sesión de juego.</p>
            <ul>
                <li>Reinicia la iniciativa y el orden de combate</li>
                <li>Limpia las notas temporales</li>
                <li>Prepara el escenario para una nueva aventura</li>
            </ul>
        `;
    }

    getSaveSessionHelp() {
        return `
            <h3><i class="fas fa-save"></i> Guardar Sesión</h3>
            <p>Guarda el estado actual de tu partida.</p>
            <ul>
                <li>Incluye orden de iniciativa, turno y ronda</li>
                <li>Guarda las notas actuales</li>
                <li>Configuración de la sesión</li>
            </ul>
        `;
    }

    getLoadSessionHelp() {
        return `
            <h3><i class="fas fa-folder-open"></i> Cargar Sesión</h3>
            <p>Recupera una sesión guardada anteriormente.</p>
            <ul>
                <li>Carga toda la información de la partida</li>
                <li>Continúa exactamente donde lo dejaste</li>
                <li>Soporte para múltiples sesiones guardadas</li>
            </ul>
        `;
    }

    getCombatHelp() {
        return `
            <h3><i class="fas fa-fist-raised"></i> Modo Combate</h3>
            <ul>
                <li>Cambia el estado visual de la sesión</li>
            </ul>
        `;
    }

    getRollInitiativeHelp() {
        return `
            <h3><i class="fas fa-dice"></i> Tirar Iniciativa Enemigos</h3>
            <p>Ahorra tiempo en encuentros grandes.</p>
            <ul>
                <li>Tira iniciativa automática para todos los enemigos</li>
                <li>Usa dados justos y aleatorios</li>
                <li>Actualiza el orden de iniciativa automáticamente</li>
            </ul>
        `;
    }

    getAddPlayerHelp() {
        return `
            <h3><i class="fas fa-user-plus"></i> Añadir Jugador</h3>
            <p>Incorporar un jugador a la iniciativa.</p>
            <ul>
                <li><strong>Nombre:</strong> Identificador del jugador</li>
                <li><strong>Iniciativa:</strong> Valor numérico</li>
                <li><strong>CA:</strong> Clase de Armadura o defensa, depeniendo de tu edicion</li>
                <li><strong>Vida:</strong> Puntos de golpe o hp maximo</li>
            </ul>
        `;
    }

    getAddEnemyHelp() {
        return `
            <h3><i class="fas fa-skull"></i> Añadir Enemigo</h3>
            <p>Incorporar un enemigo a la iniciativa.</p>
            <ul>
                <li><strong>Nombre:</strong> Identificador del enemigo</li>
                <li><strong>Campo de búsqueda:</strong> Busca en el bestiario cargado</li>
                <li><strong>CA:</strong> Clase de Armadura</li>
                <li><strong>Vida:</strong> Puntos de golpe actuales</li>
                <li><strong>Iniciativa:</strong>Su destreza será tomada en cuenta al tirar los dados</li>
            </ul>
            <div class="tutorial-tip">
                <i class="fas fa-lightbulb"></i>
                <strong>Consejo:</strong> Si tienes un bestiario JSON cargado, aparecerán sugerencias mientras escribes.
            </div>
            <div class="tutorial-tip">
                <i class="fas fa-lightbulb"></i>
                <strong>Consejo:</strong> Al escribir el nombre de un enemigo agrega "* (X Cantidad)" para agregar grupos. ej:"Fulano*3"
            </div>
        `;
    }

    getSortInitiativeHelp() {
        return `
            <h3><i class="fas fa-sort-amount-down"></i> Ordenar Iniciativa</h3>
            <p>Organiza el orden de combate automáticamente.</p>
            <ul>
                <li>Ordena de mayor a menor iniciativa</li>
                <li>Combina jugadores y enemigos</li>
                <li>Prepara el orden para el combate</li>
            </ul>
        `;
    }

    getClearOrderHelp() {
        return `
            <h3><i class="fas fa-trash"></i> Limpiar Orden</h3>
            <p>Reinicia el orden de iniciativa.</p>
            <ul>
                <li>Elimina todos los participantes del orden</li>
                <li>Reinicia el contador de rondas a 1</li>
                <li>Prepara para un nuevo encuentro</li>
            </ul>
        `;
    }

    getNextTurnHelp() {
        return `
            <h3><i class="fas fa-forward"></i> Siguiente Turno</h3>
            <p>Avanza al siguiente turno en combate.</p>
            <ul>
                <li>Pasa al siguiente participante en la iniciativa</li>
                <li>Aumenta la ronda cuando llegas al final</li>
                <li>El participante activo se resalta visualmente</li>
            </ul>
        `;
    }

    getPdfHelp() {
        return `
            <h3><i class="fas fa-file-pdf"></i> Cargar PDF</h3>
            <p>Carga y visualiza documentos PDF directamente en la aplicación.</p>
            <ul>
                <li>Soporte para archivos PDF locales</li>
                <li>Navegación entre páginas</li>
                <li>Zoom ajustable</li>
                <li>Perfecto para manuales, bestiarios y documentos de campaña</li>
            </ul>
        `;
    }

    getJsonHelp() {
        return `
            <h3><i class="fas fa-file-code"></i> Cargar Bestiario JSON</h3>
            <p>Importa tu propio bestiario personalizado.</p>
            <ul>
                <li>el json debe tener el siguiente formato para que sea funcional</li>
                <a href="https://tse4.mm.bing.net/th/id/OIP.OFV6FdyHeLvsQf8r5ooSDwHaFj?rs=1&pid=ImgDetMain&o=7&rm=3" target="_blank" rel="noopener noreferrer">revisar</a>

            </ul>
        `;
    }

    getResetJsonHelp() {
        return `
            <h3><i class="fas fa-undo-alt"></i> Restaurar Bestiario</h3>
            <p>Vuelve al bestiario original por defecto.</p>
            <ul>
                <li>Elimina cualquier bestiario personalizado</li>
                <li>Restaura las criaturas por defecto</li>
                <li>Útil si quieres empezar de nuevo</li>
            </ul>
        `;
    }

    getBoldHelp() {
        return `
            <h3><i class="fas fa-bold"></i> Negrita</h3>
            <p>Aplica formato de negrita al texto seleccionado.</p>
            <ul>
                <li>Atajo de teclado: <kbd>Ctrl</kbd> + <kbd>B</kbd></li>
                <li>Resalta palabras o frases importantes</li>
                <li>Ideal para nombres y términos clave</li>
            </ul>
        `;
    }

    getItalicHelp() {
        return `
            <h3><i class="fas fa-italic"></i> Cursiva</h3>
            <p>Aplica formato de cursiva al texto seleccionado.</p>
            <ul>
                <li>Atajo de teclado: <kbd>Ctrl</kbd> + <kbd>I</kbd></li>
                <li>Para énfasis suave</li>
                <li>Títulos de libros, hechizos, etc.</li>
            </ul>
        `;
    }

    getUnderlineHelp() {
        return `
            <h3><i class="fas fa-underline"></i> Subrayado</h3>
            <p>Aplica formato de subrayado al texto seleccionado.</p>
            <ul>
                <li>Atajo de teclado: <kbd>Ctrl</kbd> + <kbd>U</kbd></li>
                <li>Para resaltar información importante</li>
                <li>Notas especiales o advertencias</li>
            </ul>
        `;
    }

    getH1Help() {
        return `
            <h3><i class="fas fa-heading"></i> H1 - Título Principal</h3>
            <p>Crea un título de nivel 1 para organizar tus notas.</p>
            <ul>
                <li>Para secciones principales</li>
                <li>Formato grande y llamativo</li>
                <li>Ideal para comenzar un tema nuevo</li>
            </ul>
        `;
    }

    getH2Help() {
        return `
            <h3><i class="fas fa-heading"></i> H2 - Subtítulo</h3>
            <p>Crea un subtítulo para jerarquizar tu contenido.</p>
            <ul>
                <li>Para subsecciones dentro de un tema</li>
                <li>Menor tamaño que H1</li>
                <li>Organización visual clara</li>
            </ul>
        `;
    }

    getH3Help() {
        return `
            <h3><i class="fas fa-heading"></i> H3 - Sub-subtítulo</h3>
            <p>Un nivel adicional de organización.</p>
            <ul>
                <li>Para detalles específicos</li>
                <li>Tamaño más pequeño</li>
                <li>Máximo nivel de jerarquía</li>
            </ul>
        `;
    }

    getDiceHelp() {
        return `
            <h3><i class="fas fa-dice"></i> Lanzador de Dados</h3>
            <p>Realiza tiradas de dados rápidas.</p>
            <ul>
                <li><strong>d4, d6, d8, d10, d12, d20, d100</strong> - Todos los tipos disponibles</li>
                <li>Resultados aleatorios y justos</li>
                <li>Perfecto para tiradas improvisadas</li>
            </ul>
        `;
    }

    addInfoButtonsToElements(selector, title, content, multiple = false) {
        try {
            const elements = multiple ? document.querySelectorAll(selector) : [document.querySelector(selector)];
            
            elements.forEach(element => {
                if (element && !element.querySelector('.tutorial-info-btn')) {
                    // Verificar si el elemento está en el sidebar (doble seguridad)
                    if (element.closest('.sidebar')) {
                        return; // Saltar elementos del sidebar
                    }
                    
                    // Crear contenedor si es necesario
                    if (!element.classList.contains('tutorial-element')) {
                        element.classList.add('tutorial-element');
                    }
                    
                    // Crear botón de información
                    const infoBtn = document.createElement('button');
                    infoBtn.className = 'tutorial-info-btn';
                    infoBtn.innerHTML = '<i class="fas fa-info"></i>';
                    infoBtn.setAttribute('data-tutorial-title', title);
                    infoBtn.setAttribute('data-tutorial-content', content);
                    
                    infoBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        this.showModal(title, content, element);
                    });
                    
                    element.appendChild(infoBtn);
                }
            });
        } catch (error) {
            console.log('Error adding info button for selector:', selector, error);
        }
    }

    toggleTutorial(active) {
        this.isActive = active;
        
        if (this.isActive) {
            document.body.classList.add('tutorial-mode');
            this.showWelcomeMessage();
        } else {
            document.body.classList.remove('tutorial-mode');
            this.closeModal();
        }
        
        // Guardar estado
        localStorage.setItem('tutorialMode', this.isActive);
    }

    showWelcomeMessage() {
        // Solo mostrar si no se ha mostrado antes en esta sesión
        if (!sessionStorage.getItem('tutorialWelcomeShown')) {
            const welcomeContent = `
                <h3><i class="fas fa-info-circle"></i> Modo Tutorial Activado</h3>
                <p>¡Bienvenido al modo tutorial! Ahora verás pequeños botones de información <i class="fas fa-info" style="color: #d4af37;"></i> junto a los elementos interactivos.</p>
                
                <div class="tutorial-tip">
                    <i class="fas fa-lightbulb"></i>
                    <strong>Consejo:</strong> Haz clic en cualquier botón de información para obtener una explicación detallada de esa función.
                </div>
                
                <h4>Cómo usar el tutorial:</h4>
                <ul>
                    <li><i class="fas fa-mouse-pointer"></i> Pasa el cursor sobre los botones de información</li>
                    <li><i class="fas fa-click"></i> Haz clic para ver la explicación completa</li>
                    <li><i class="fas fa-toggle-on"></i> Desactiva el tutorial desde el sidebar cuando quieras</li>
                </ul>
                
                <p>¡Explora todas las funciones y conviértete en un master de la aventura!</p>
            `;
            
            this.showModal('🎮 Tutorial Activado', welcomeContent);
            sessionStorage.setItem('tutorialWelcomeShown', 'true');
        }
    }

    showModal(title, content, element = null) {
        const modal = document.getElementById('tutorialModal');
        if (!modal) return;
        
        const modalTitle = document.getElementById('tutorialModalTitle');
        const modalBody = document.getElementById('tutorialModalBody');
        
        if (modalTitle) modalTitle.textContent = title;
        if (modalBody) modalBody.innerHTML = content;
        
        modal.classList.add('active');
        this.currentModal = modal;
        
        // Resaltar elemento relacionado
        if (element) {
            this.highlightElement(element);
        }
    }

    closeModal() {
        if (this.currentModal) {
            this.currentModal.classList.remove('active');
            this.currentModal = null;
            
            // Quitar resaltados
            document.querySelectorAll('.tutorial-highlight').forEach(el => {
                el.classList.remove('tutorial-highlight');
            });
        }
    }

    highlightElement(element) {
        // Quitar resaltados anteriores
        document.querySelectorAll('.tutorial-highlight').forEach(el => {
            el.classList.remove('tutorial-highlight');
        });
        
        // Añadir resaltado al elemento
        if (element) {
            element.classList.add('tutorial-highlight');
        }
    }

    loadState() {
        // Cargar estado guardado del tutorial
        const savedState = localStorage.getItem('tutorialMode');
        const tutorialSwitch = document.getElementById('tutorialSwitch');
        
        if (savedState === 'true') {
            this.isActive = true;
            document.body.classList.add('tutorial-mode');
            if (tutorialSwitch) tutorialSwitch.checked = true;
        } else {
            this.isActive = false;
            document.body.classList.remove('tutorial-mode');
            if (tutorialSwitch) tutorialSwitch.checked = false;
        }
    }

    // Método para añadir tutoriales dinámicamente
    addTutorialElement(selector, title, content) {
        this.addInfoButtonsToElements(selector, title, content);
    }

    // Método para actualizar tutoriales cuando se añaden elementos dinámicamente
    refreshTutorials() {
        if (this.isActive) {
            this.tutorialElements.forEach(element => {
                this.addInfoButtonsToElements(element.selector, element.title, element.content, element.multiple);
            });
        }
    }
}

// Inicializar el sistema de tutorial cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Pequeño retraso para asegurar que el sidebar está cargado
    setTimeout(() => {
        window.tutorialSystem = new TutorialSystem();
        
        // Observar cambios en el DOM para añadir tutoriales a elementos dinámicos
        const observer = new MutationObserver((mutations) => {
            if (window.tutorialSystem && window.tutorialSystem.isActive) {
                window.tutorialSystem.refreshTutorials();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }, 500);
});

// Exportar para uso en otros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TutorialSystem;
}