class AdminPanel {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
            
        this.currentFile = null;
        this.currentImage = null;
        this.operationLog = [];
        this.images = [];
        
        this.init();
    }
    
    init() {
        console.log('🚀 Inicializando panel de administración...');
        this.loadFileList();
        this.loadImages();
        this.updateStats();
        this.setupEventListeners();
        this.setupImageUpload();
        this.addToLog('Panel de administración iniciado', 'info');
    }
    
    setupEventListeners() {
        // Botones de archivos JSON
        document.getElementById('refreshFilesBtn')?.addEventListener('click', () => this.loadFileList());
        document.getElementById('uploadJsonBtn')?.addEventListener('click', () => this.uploadJsonFile());
        
        // Botones de imágenes
        document.getElementById('refreshImagesBtn')?.addEventListener('click', () => this.loadImages());
        document.getElementById('uploadImageBtn')?.addEventListener('click', () => this.triggerImageUpload());
        
        // Botones del editor JSON
        document.getElementById('saveJsonBtn')?.addEventListener('click', () => this.saveJsonFile());
        document.getElementById('formatJsonBtn')?.addEventListener('click', () => this.formatJson());
        document.getElementById('validateJsonBtn')?.addEventListener('click', () => this.validateJson());
        document.getElementById('closeEditorBtn')?.addEventListener('click', () => this.closeEditor());
        
        // Botones de mantenimiento
        document.getElementById('cleanDatabaseBtn')?.addEventListener('click', () => this.cleanDatabase());
        document.getElementById('restoreBestiaryBtn')?.addEventListener('click', () => this.restoreBestiary());
        document.getElementById('exportAllBtn')?.addEventListener('click', () => this.exportAll());
        document.getElementById('showStatsBtn')?.addEventListener('click', () => this.showDetailedStats());
        document.getElementById('clearLogBtn')?.addEventListener('click', () => this.clearLog());
        
        // Modal de imagen
        document.querySelector('.close-modal')?.addEventListener('click', () => this.closeImageModal());
        document.getElementById('downloadPreviewBtn')?.addEventListener('click', () => this.downloadCurrentImage());
        document.getElementById('deletePreviewBtn')?.addEventListener('click', () => this.deleteCurrentImage());
        
        // Cerrar modal al hacer clic fuera
        document.getElementById('imageModal')?.addEventListener('click', (e) => {
            if (e.target === document.getElementById('imageModal')) {
                this.closeImageModal();
            }
        });
    }
    
    // ===== MÉTODOS PARA JSON =====
    
    async loadFileList() {
        const tbody = document.getElementById('jsonFileList');
        if (!tbody) return;
        
        tbody.innerHTML = `
            <tr class="loading-row">
                <td colspan="5">
                    <i class="fas fa-spinner fa-spin"></i>
                    <p>Cargando archivos...</p>
                </td>
            </tr>
        `;
        
        try {
            const response = await fetch(`${this.baseUrl}/api/json/list`);
            if (!response.ok) throw new Error('Error al cargar');
            
            const data = await response.json();
            this.renderFileList(data.files || []);
            this.addToLog('Lista de archivos actualizada', 'success');
        } catch (error) {
            console.error('Error loading files:', error);
            tbody.innerHTML = `
                <tr class="loading-row">
                    <td colspan="5">
                        <i class="fas fa-exclamation-circle" style="color: var(--accent-red);"></i>
                        <p>Error al cargar archivos</p>
                        <small>${error.message}</small>
                    </td>
                </tr>
            `;
            this.addToLog('Error al cargar archivos', 'error');
        }
    }
    
    renderFileList(files) {
        const tbody = document.getElementById('jsonFileList');
        if (!tbody) return;
        
        if (files.length === 0) {
            tbody.innerHTML = `
                <tr class="loading-row">
                    <td colspan="5">
                        <i class="fas fa-folder-open"></i>
                        <p>No hay archivos JSON disponibles</p>
                        <small>Los archivos del sistema están ocultos</small>
                    </td>
                </tr>
            `;
            return;
        }
        
        tbody.innerHTML = files.map(file => {
            return `
            <tr data-filename="${file.name}">
                <td>
                    <i class="fas fa-file-code" style="color: var(--accent-gold); margin-right: 8px;"></i>
                    ${file.name}
                </td>
                <td>${this.formatSize(file.size)}</td>
                <td>${new Date(file.modified).toLocaleString()}</td>
                <td>
                    <span class="file-type ${this.getFileTypeClass(file.name)}">
                        ${this.getFileType(file.name)}
                    </span>
                </td>
                <td>
                    <div class="file-actions">
                        <button class="file-action-btn edit" onclick="adminPanel.editFile('${file.name}')" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="file-action-btn download" onclick="adminPanel.downloadFile('${file.name}')" title="Descargar">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="file-action-btn delete" onclick="adminPanel.deleteFile('${file.name}')" title="Eliminar">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `}).join('');
    }
    
    async editFile(filepath) {
        try {
            console.log('📁 Intentando cargar:', filepath);
            const url = `${this.baseUrl}/data/${filepath}`;
            
            const response = await fetch(url);
            
            if (!response.ok) {
                if (response.status === 404) {
                    throw new Error(`Archivo no encontrado: ${filepath}`);
                }
                throw new Error(`Error HTTP ${response.status}`);
            }
            
            const content = await response.text();
            
            document.getElementById('currentFileName').textContent = filepath;
            document.getElementById('jsonEditor').value = content;
            
            const saveBtn = document.getElementById('saveJsonBtn');
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.style.opacity = '1';
                saveBtn.title = 'Guardar cambios';
            }
            
            document.getElementById('editorPanel').style.display = 'block';
            
            this.currentFile = filepath;
            this.addToLog(`Editando: ${filepath}`, 'info');
            
        } catch (error) {
            console.error('Error editing file:', error);
            this.showNotification(`Error al cargar: ${error.message}`, 'error');
        }
    }

    async saveJsonFile() {
        if (!this.currentFile) return;
        
        try {
            const content = document.getElementById('jsonEditor').value;
            
            // Validar JSON
            JSON.parse(content);
            
            const response = await fetch(`${this.baseUrl}/api/json/upload`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: this.currentFile,
                    content: content
                })
            });
            
            if (!response.ok) throw new Error('Error al guardar');
            
            this.showEditorStatus('✅ Archivo guardado correctamente', 'success');
            this.addToLog(`Archivo guardado: ${this.currentFile}`, 'success');
            this.loadFileList();
            this.updateStats();
            
        } catch (error) {
            console.error('Error saving file:', error);
            this.showEditorStatus('❌ Error: ' + error.message, 'error');
        }
    }

    async downloadFile(filepath) {
        try {
            const response = await fetch(`${this.baseUrl}/data/${filepath}`);
            const blob = await response.blob();
            
            // Extraer solo el nombre del archivo para la descarga
            const filename = filepath.split('/').pop();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            window.URL.revokeObjectURL(url);
            this.addToLog(`Descargado: ${filename}`, 'info');
        } catch (error) {
            console.error('Error downloading file:', error);
            this.showNotification('Error al descargar', 'error');
        }
    }

    async deleteFile(filepath) {
        if (!confirm(`¿Eliminar ${filepath}?`)) return;
        
        try {
            const response = await fetch(`${this.baseUrl}/api/json/delete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: filepath })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Error al eliminar');
            }
            
            this.loadFileList();
            this.updateStats();
            this.addToLog(`Archivo eliminado: ${filepath}`, 'warning');
            this.showNotification('Archivo eliminado', 'warning');
            
            if (this.currentFile === filepath) {
                this.closeEditor();
            }
        } catch (error) {
            console.error('Error deleting file:', error);
            this.showNotification(error.message, 'error');
        }
    }
    
    uploadJsonFile() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.handleJsonUpload(file);
        });
        
        input.click();
    }
    
    async handleJsonUpload(file) {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                // Validar JSON
                JSON.parse(e.target.result);
                
                const response = await fetch(`${this.baseUrl}/api/json/upload`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename: file.name,
                        content: e.target.result
                    })
                });
                
                if (!response.ok) throw new Error('Error al subir');
                
                this.loadFileList();
                this.updateStats();
                this.addToLog(`Archivo subido: ${file.name}`, 'success');
                this.showNotification('Archivo subido correctamente', 'success');
            } catch (error) {
                console.error('Error uploading file:', error);
                this.showNotification('Error al subir archivo', 'error');
            }
        };
        
        reader.readAsText(file);
    }
    
    // ===== MÉTODOS PARA IMÁGENES =====
    
    setupImageUpload() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.style.display = 'none';
        input.id = 'imageFileInput';
        
        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) this.uploadImage(file);
        });
        
        document.body.appendChild(input);
    }
    
    triggerImageUpload() {
        document.getElementById('imageFileInput').click();
    }
    
    async loadImages() {
        const gallery = document.getElementById('imageGallery');
        if (!gallery) return;
        
        gallery.innerHTML = `
            <div class="loading-images">
                <i class="fas fa-spinner fa-spin"></i>
                <p>Cargando imágenes...</p>
            </div>
        `;
        
        try {
            const response = await fetch(`${this.baseUrl}/api/imagenes/listar`);
            if (!response.ok) throw new Error('Error al cargar');
            
            const data = await response.json();
            this.images = data.images || [];
            this.renderImageGallery();
            this.updateImageStats();
            this.addToLog(`Galería actualizada: ${this.images.length} imágenes`, 'info');
        } catch (error) {
            console.error('Error loading images:', error);
            gallery.innerHTML = `
                <div class="loading-images">
                    <i class="fas fa-exclamation-circle" style="color: var(--accent-red);"></i>
                    <p>Error al cargar imágenes</p>
                    <small>${error.message}</small>
                </div>
            `;
            this.addToLog('Error al cargar imágenes', 'error');
        }
    }
    
    renderImageGallery() {
        const gallery = document.getElementById('imageGallery');
        if (!gallery) return;
        
        if (this.images.length === 0) {
            gallery.innerHTML = `
                <div class="loading-images">
                    <i class="fas fa-images"></i>
                    <p>No hay imágenes en la galería</p>
                    <small>Sube imágenes usando el botón "Subir imagen"</small>
                </div>
            `;
            return;
        }
        
        gallery.innerHTML = this.images.map(img => `
            <div class="image-card" data-filename="${img.filename}">
                <img src="${this.baseUrl}${img.url}" class="image-thumb" alt="${img.filename}" loading="lazy">
                <div class="image-info">
                    <div class="image-name">${img.filename}</div>
                    <div class="image-size">${this.formatSize(img.size)}</div>
                </div>
                <div class="file-actions">
                    <button class="file-action-btn edit" onclick="adminPanel.previewImage('${img.filename}')" title="Ver">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="file-action-btn download" onclick="adminPanel.downloadImage('${img.filename}')" title="Descargar">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="file-action-btn delete" onclick="adminPanel.deleteImage('${img.filename}')" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    async uploadImage(file) {
        if (file.size > 5 * 1024 * 1024) {
            this.showNotification('La imagen no puede superar los 5MB', 'error');
            return;
        }
        
        if (!file.type.startsWith('image/')) {
            this.showNotification('Solo se permiten imágenes', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('imagen', file);
        
        try {
            const response = await fetch(`${this.baseUrl}/api/imagenes/subir`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) throw new Error('Error al subir');
            
            const data = await response.json();
            
            this.addToLog(`Imagen subida: ${file.name}`, 'success');
            this.showNotification('Imagen subida correctamente', 'success');
            this.loadImages();
            this.updateStats();
            
        } catch (error) {
            console.error('Error uploading image:', error);
            this.addToLog(`Error al subir ${file.name}`, 'error');
            this.showNotification('Error al subir la imagen', 'error');
        }
    }
    
    previewImage(filename) {
        const image = this.images.find(img => img.filename === filename);
        if (!image) return;
        
        this.currentImage = image;
        
        const modal = document.getElementById('imageModal');
        const preview = document.getElementById('previewImage');
        const filenameEl = document.getElementById('previewFilename');
        const detailsEl = document.getElementById('previewDetails');
        
        preview.src = `${this.baseUrl}${image.url}`;
        filenameEl.textContent = image.filename;
        detailsEl.textContent = `Tamaño: ${this.formatSize(image.size)} • Modificado: ${new Date(image.modified).toLocaleString()}`;
        
        modal.classList.add('active');
    }
    
    closeImageModal() {
        document.getElementById('imageModal').classList.remove('active');
        this.currentImage = null;
    }
    
    async downloadImage(filename) {
        try {
            const response = await fetch(`${this.baseUrl}/data/imagenes/${filename}`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            
            window.URL.revokeObjectURL(url);
            this.addToLog(`Imagen descargada: ${filename}`, 'info');
        } catch (error) {
            console.error('Error downloading image:', error);
            this.showNotification('Error al descargar', 'error');
        }
    }
    
    downloadCurrentImage() {
        if (this.currentImage) {
            this.downloadImage(this.currentImage.filename);
        }
    }
    
    async deleteImage(filename) {
        if (!confirm(`¿Eliminar la imagen ${filename}?`)) return;
        
        try {
            const response = await fetch(`${this.baseUrl}/api/imagenes/eliminar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename })
            });
            
            if (!response.ok) throw new Error('Error al eliminar');
            
            this.addToLog(`Imagen eliminada: ${filename}`, 'warning');
            this.showNotification('Imagen eliminada', 'warning');
            this.loadImages();
            this.updateStats();
            
            if (this.currentImage?.filename === filename) {
                this.closeImageModal();
            }
        } catch (error) {
            console.error('Error deleting image:', error);
            this.showNotification('Error al eliminar', 'error');
        }
    }
    
    deleteCurrentImage() {
        if (this.currentImage) {
            this.deleteImage(this.currentImage.filename);
        }
    }
    
    updateImageStats() {
        const statsContainer = document.getElementById('imageStats');
        if (!statsContainer) return;
        
        const totalSize = this.images.reduce((acc, img) => acc + img.size, 0);
        const avgSize = this.images.length > 0 ? totalSize / this.images.length : 0;
        
        statsContainer.innerHTML = `
            <div class="stat-badge">
                <i class="fas fa-images"></i>
                <span>${this.images.length}</span> imágenes
            </div>
            <div class="stat-badge">
                <i class="fas fa-hdd"></i>
                <span>${this.formatSize(totalSize)}</span> total
            </div>
            <div class="stat-badge">
                <i class="fas fa-chart-line"></i>
                <span>${this.formatSize(avgSize)}</span> promedio
            </div>
        `;
    }
    
    // ===== MÉTODOS DE ESTADÍSTICAS =====
    
    async updateStats() {
        try {
            console.log('📊 Actualizando estadísticas...');
            const response = await fetch(`${this.baseUrl}/api/json/stats`);
            if (!response.ok) throw new Error('Error al cargar stats');
            
            const stats = await response.json();
            console.log('📊 Estadísticas recibidas:', stats);
            
            document.getElementById('bestiaryCount').textContent = stats.bestiary || 0;
            document.getElementById('playersCount').textContent = stats.players || 0;
            document.getElementById('sessionsCount').textContent = stats.sessions || 0;
            document.getElementById('totalSize').textContent = this.formatSize(stats.totalSize || 0);
            
        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }
    
    // ===== MÉTODOS DE MANTENIMIENTO =====
    
    async cleanDatabase() {
        if (!confirm('⚠️ ¿Eliminar TODOS los archivos JSON visibles?\n\nLos archivos del sistema están protegidos y no se eliminarán.\nEsta acción NO se puede deshacer.')) return;
        
        try {
            const response = await fetch(`${this.baseUrl}/api/json/clean-all`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error('Error al limpiar');
            
            this.loadFileList();
            this.updateStats();
            this.addToLog('⚠️ ARCHIVOS ELIMINADOS', 'warning');
            this.showNotification('Archivos eliminados', 'warning');
            this.closeEditor();
        } catch (error) {
            console.error('Error cleaning database:', error);
            this.showNotification('Error al limpiar', 'error');
        }
    }
    
    restoreBestiary() {
        this.showNotification('Los bestiarios están protegidos y no se pueden modificar', 'info');
    }
    
    async exportAll() {
        try {
            const response = await fetch(`${this.baseUrl}/api/json/export-all`);
            const blob = await response.blob();
            
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup-${new Date().toISOString().split('T')[0]}.zip`;
            a.click();
            
            window.URL.revokeObjectURL(url);
            this.addToLog('Exportación completa', 'success');
            this.showNotification('Exportación completada', 'success');
        } catch (error) {
            console.error('Error exporting:', error);
            this.showNotification('Error al exportar', 'error');
        }
    }
    
    showDetailedStats() {
        const bestiary = document.getElementById('bestiaryCount').textContent;
        const players = document.getElementById('playersCount').textContent;
        const sessions = document.getElementById('sessionsCount').textContent;
        const space = document.getElementById('totalSize').textContent;
        const images = this.images.length;
        const imagesSize = this.formatSize(this.images.reduce((acc, img) => acc + img.size, 0));
        
        alert(`
📊 ESTADÍSTICAS DETALLADAS:
        
📁 ARCHIVOS JSON VISIBLES:
  • Bestiarios: ${bestiary}
  • Personajes: ${players}
  • Sesiones: ${sessions}
  • Espacio total: ${space}

🖼️ IMÁGENES:
  • Cantidad: ${images}
  • Espacio: ${imagesSize}

🔒 Archivos del sistema protegidos (no visibles)
        `);
    }
    
    // ===== MÉTODOS DEL EDITOR =====
    
    formatJson() {
        try {
            const editor = document.getElementById('jsonEditor');
            const json = JSON.parse(editor.value);
            editor.value = JSON.stringify(json, null, 2);
            this.showEditorStatus('✅ JSON formateado', 'success');
        } catch (error) {
            this.showEditorStatus('❌ JSON inválido', 'error');
        }
    }
    
    validateJson() {
        try {
            const editor = document.getElementById('jsonEditor');
            JSON.parse(editor.value);
            this.showEditorStatus('✅ JSON válido', 'success');
        } catch (error) {
            this.showEditorStatus('❌ Error: ' + error.message, 'error');
        }
    }
    
    closeEditor() {
        document.getElementById('editorPanel').style.display = 'none';
        this.currentFile = null;
        document.getElementById('jsonEditor').value = '';
    }
    
    showEditorStatus(message, type) {
        const status = document.getElementById('editorStatus');
        status.className = `editor-status ${type}`;
        status.textContent = message;
        
        setTimeout(() => {
            status.className = 'editor-status';
            status.textContent = '';
        }, 3000);
    }
    
    // ===== MÉTODOS DEL LOG =====
    
    addToLog(message, type = 'info') {
        const logContainer = document.getElementById('operationLog');
        if (!logContainer) return;
        
        const time = new Date().toLocaleTimeString();
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerHTML = `
            <i class="fas ${icons[type] || 'fa-info-circle'}"></i>
            <span class="log-time">${time}</span>
            <span class="log-message">${message}</span>
        `;
        
        logContainer.appendChild(entry);
        logContainer.scrollTop = logContainer.scrollHeight;
        
        while (logContainer.children.length > 100) {
            logContainer.removeChild(logContainer.firstChild);
        }
        
        this.operationLog.push({ time, message, type });
    }
    
    clearLog() {
        document.getElementById('operationLog').innerHTML = '';
        this.operationLog = [];
        this.addToLog('Log limpiado', 'info');
    }
    
    // ===== MÉTODOS UTILITARIOS =====
    
    formatSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1048576).toFixed(1) + ' MB';
    }
    
    getFileType(filename) {
        if (filename.includes('personajes')) return 'Personajes';
        if (filename.includes('session')) return 'Sesión';
        if (filename.includes('jugadores')) return 'Jugadores';
        return 'Configuración';
    }
    
    getFileTypeClass(filename) {
        if (filename.includes('personajes')) return 'players';
        if (filename.includes('session')) return 'session';
        return 'config';
    }
    
    showNotification(message, type) {
        if (window.dmScreen && window.dmScreen.showNotification) {
            window.dmScreen.showNotification(message, type);
        } else {
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
                color: white;
                border-radius: 8px;
                z-index: 10000;
                font-family: 'Cinzel', serif;
                animation: slideIn 0.3s ease;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => {
                notification.remove();
            }, 3000);
        }
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    console.log('Inicializando admin panel...');
    window.adminPanel = new AdminPanel();
});