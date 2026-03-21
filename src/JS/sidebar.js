// js/sidebar.js - Versión módulo
export class SidebarManager {
    constructor() {
        this.sidebar = document.getElementById('sidebar');
        this.currentPage = this.getCurrentPage();
        
        this.init();
    }
    
    init() {
        // Añadir clase al body
        document.body.classList.add('with-sidebar');
        
        // Marcar página activa
        this.setActivePage();
        
        // Event listeners para hover
        this.setupHoverListeners();
        
        // Cargar estado inicial
        this.loadInitialState();
    }
    
    setupHoverListeners() {
        // Abrir sidebar al hacer hover
        this.sidebar.addEventListener('mouseenter', () => {
            this.expandSidebar();
        });
        
        // Cerrar sidebar al salir el cursor
        this.sidebar.addEventListener('mouseleave', () => {
            this.collapseSidebar();
        });
        
        // Prevenir cierre si el cursor está sobre el sidebar en móvil
        if (window.innerWidth <= 768) {
            this.sidebar.addEventListener('touchstart', (e) => {
                e.stopPropagation();
                this.expandSidebar();
            });
        }
    }
    
    expandSidebar() {
        this.sidebar.classList.add('expanded');
        this.sidebar.style.width = '220px';
        
        // Mostrar textos con animación
        const texts = this.sidebar.querySelectorAll('span');
        texts.forEach(text => {
            text.style.opacity = '1';
            text.style.visibility = 'visible';
        });
        
        // Notificar al sistema de tutorial si existe
        if (window.tutorialSystem) {
            window.tutorialSystem.handleSidebarStateChange(true);
        }
    }
    
    collapseSidebar() {
        // No colapsar si estamos en móvil
        if (window.innerWidth <= 768) {
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
        
        // Notificar al sistema de tutorial si existe
        if (window.tutorialSystem) {
            window.tutorialSystem.handleSidebarStateChange(false);
        }
    }
    
    loadInitialState() {
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
        }
    }
    
    setActivePage() {
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
        if (path.includes('bestias')) return 'bestias';
        if (path.includes('mapa')) return 'mapa';
        if (path.includes('dados')) return 'dados';
        if (path.includes('ajustes')) return 'ajustes';
        
        return 'hoja'; // Por defecto
    }
    
    // Método para cerrar sidebar manualmente (para móvil)
    closeSidebar() {
        if (window.innerWidth <= 768) {
            this.sidebar.style.width = '0';
            this.sidebar.classList.remove('expanded');
        }
    }
}
