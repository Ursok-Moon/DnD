class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.currentPage = this.getCurrentPage();
        
        this.init();
    }
    
    init() {
        if (!this.sidebar) return;
        
        // Añadir clase al body
        document.body.classList.add('with-sidebar');
        
        // Marcar página activa
        this.setActivePage();
        
        // Configurar hover listeners
        this.setupHoverListeners();
        
        // Configurar tutorial toggle - esperar a que tutorialSystem esté disponible
        this.setupTutorialToggle();
        
        // Cargar estado inicial
        this.loadInitialState();
        
        console.log('Sidebar inicializado correctamente');
    }
    
    setupHoverListeners() {
        if (!this.sidebar) return;
        
        // Abrir sidebar al hacer hover
        this.sidebar.addEventListener('mouseenter', () => {
            if (window.innerWidth > 768) {
                this.expandSidebar();
            }
        });
        
        // Cerrar sidebar al salir el cursor
        this.sidebar.addEventListener('mouseleave', () => {
            if (window.innerWidth > 768) {
                this.collapseSidebar();
            }
        });
        
        // Manejo táctil para móvil
        if (window.innerWidth <= 768) {
            let touchTimeout;
            this.sidebar.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                touchTimeout = setTimeout(() => {
                    this.expandSidebar();
                }, 300);
            });
            
            document.body.addEventListener('touchstart', (e) => {
                if (!this.sidebar.contains(e.target)) {
                    clearTimeout(touchTimeout);
                    this.collapseSidebar();
                }
            });
        }
    }
    
    setupTutorialToggle() {
        // Esperar un poco para que tutorialSystem se inicialice
        const checkTutorialSystem = () => {
            if (window.tutorialSystem) {
                const tutorialToggle = document.getElementById('tutorialSwitch');
                if (tutorialToggle) {
                    // Cargar estado guardado
                    const tutorialEnabled = localStorage.getItem('tutorialMode') === 'true';
                    tutorialToggle.checked = tutorialEnabled;
                    
                    // Aplicar estado inicial
                    if (tutorialEnabled && window.tutorialSystem) {
                        window.tutorialSystem.toggleTutorial(true);
                    } else if (window.tutorialSystem) {
                        window.tutorialSystem.toggleTutorial(false);
                    }
                    
                    // Event listener
                    tutorialToggle.addEventListener('change', (e) => {
                        if (window.tutorialSystem) {
                            window.tutorialSystem.toggleTutorial(e.target.checked);
                        }
                    });
                }
            } else {
                // Si no está disponible, esperar y reintentar
                setTimeout(checkTutorialSystem, 100);
            }
        };
        
        checkTutorialSystem();
    }
    
    expandSidebar() {
        if (!this.sidebar) return;
        this.sidebar.classList.add('expanded');
        this.sidebar.style.width = '220px';
        
        // Mostrar textos con animación
        const texts = this.sidebar.querySelectorAll('span');
        texts.forEach(text => {
            text.style.opacity = '1';
            text.style.visibility = 'visible';
        });
        
        // Notificar al sistema de tutorial
        if (window.tutorialSystem) {
            window.tutorialSystem.handleSidebarStateChange(true);
        }
    }
    
    collapseSidebar() {
        if (!this.sidebar) return;
        
        // No colapsar si estamos en móvil y está expandido manualmente
        if (window.innerWidth <= 768 && this.sidebar.classList.contains('manually-expanded')) {
            return;
        }
        
        this.sidebar.classList.remove('expanded');
        this.sidebar.style.width = '70px';
        
        // Ocultar textos
        const texts = this.sidebar.querySelectorAll('span');
        texts.forEach(text => {
            text.style.opacity = '0';
            text.style.visibility = 'hidden';
        });
        
        // Notificar al sistema de tutorial
        if (window.tutorialSystem) {
            window.tutorialSystem.handleSidebarStateChange(false);
        }
    }
    
    loadInitialState() {
        if (!this.sidebar) return;
        
        if (window.innerWidth > 768) {
            this.sidebar.style.width = '70px';
            // Asegurar que los textos estén ocultos inicialmente
            const texts = this.sidebar.querySelectorAll('span');
            texts.forEach(text => {
                text.style.opacity = '0';
                text.style.visibility = 'hidden';
            });
        } else {
            this.sidebar.style.width = '0';
            this.sidebar.classList.remove('expanded');
        }
    }
    
    setActivePage() {
        if (!this.sidebar) return;
        
        // Remover activo de todos
        const links = this.sidebar.querySelectorAll('.sidebar-link');
        links.forEach(link => {
            link.classList.remove('active');
        });
        
        // Activar el actual
        const currentLink = document.getElementById(`nav-${this.currentPage}`);
        if (currentLink) {
            currentLink.classList.add('active');
        }
    }
    
    getCurrentPage() {
        const path = window.location.pathname;
        
        if (path.includes('hoja.html')) return 'hoja';
        if (path.includes('Cartas.html')) return 'cartas';
        if (path.includes('DMS.html')) return 'bestias';
        if (path.includes('mapa.html')) return 'mapa';
        if (path.includes('dados.html')) return 'dados';
        if (path.includes('admin.html')) return 'ajustes';
        
        return 'hoja'; // Por defecto
    }
    
    // Método para abrir/cerrar sidebar manualmente
    toggleSidebar() {
        if (this.sidebar.style.width === '220px' || 
            (window.innerWidth > 768 && this.sidebar.style.width === '70px')) {
            this.collapseSidebar();
        } else {
            this.expandSidebar();
        }
    }
}

// Esperar a que el DOM esté completamente cargado
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.sidebarManager = new SidebarManager();
    });
} else {
    window.sidebarManager = new SidebarManager();
}

// Exportar para uso en otros módulos
export default SidebarManager;