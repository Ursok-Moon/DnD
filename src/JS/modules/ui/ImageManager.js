// js/modules/ui/ImageManager.js
export class ImageManager {
    constructor(apiService, eventBus, storage = null, container = null) { 
        this.api = apiService;
        this.eventBus = eventBus;
        this.storage = storage || null;
        this.container = container || document;
        
        // Buscar elementos dentro del contenedor usando CLASES
        this.uploadArea = this.container.querySelector('.image-upload-area');
        this.imageUpload = this.container.querySelector('.image-upload');
        this.changeImageBtn = this.container.querySelector('.btn-change-image');
        this.characterImage = this.container.querySelector('.character-image');
        this.imagePreview = this.container.querySelector('.image-preview');
        this.imageContainer = this.container.querySelector('.image-container');
        
        // Si no se encuentran por clase, buscar por ID como fallback
        if (!this.uploadArea) {
            this.uploadArea = this.container.querySelector('#imageUploadArea');
        }
        if (!this.imageUpload) {
            this.imageUpload = this.container.querySelector('#imageUpload');
        }
        if (!this.changeImageBtn) {
            this.changeImageBtn = this.container.querySelector('#changeImageBtn');
        }
        if (!this.characterImage) {
            this.characterImage = this.container.querySelector('#characterImage');
        }
        if (!this.imagePreview) {
            this.imagePreview = this.container.querySelector('#imagePreview');
        }
        if (!this.imageContainer) {
            this.imageContainer = this.container.querySelector('#imageContainer');
        }
        
        // Cargar imagen del storage
        this.currentImageUrl = this.storage ? 
            this.storage.load('imagenUrl') : 
            localStorage.getItem('imagenUrl') || null;
        
        this.init();
    }

    init() {
        // IMPORTANTE: Si no se encuentra el uploadArea, puede que el DOM no esté listo
        if (!this.uploadArea) {
            console.warn('⚠️ ImageManager: No se encontró el área de subida de imágenes en el contenedor', this.container);
            // Intentar buscar después de un breve delay
            setTimeout(() => {
                this.uploadArea = this.container.querySelector('.image-upload-area') || this.container.querySelector('#imageUploadArea');
                this.imageUpload = this.container.querySelector('.image-upload') || this.container.querySelector('#imageUpload');
                this.changeImageBtn = this.container.querySelector('.btn-change-image') || this.container.querySelector('#changeImageBtn');
                this.characterImage = this.container.querySelector('.character-image') || this.container.querySelector('#characterImage');
                this.imagePreview = this.container.querySelector('.image-preview') || this.container.querySelector('#imagePreview');
                this.imageContainer = this.container.querySelector('.image-container') || this.container.querySelector('#imageContainer');
                this.setupUpload();
                this.loadSavedImage();
            }, 200);
            return;
        }
        
        this.setupUpload();
        this.loadSavedImage();
    }

    setupUpload() {
        if (!this.uploadArea || !this.imageUpload) return;
        
        // Remover event listeners anteriores
        const newUploadArea = this.uploadArea.cloneNode(true);
        this.uploadArea.parentNode.replaceChild(newUploadArea, this.uploadArea);
        this.uploadArea = newUploadArea;
        
        const newImageUpload = this.imageUpload.cloneNode(true);
        this.imageUpload.parentNode.replaceChild(newImageUpload, this.imageUpload);
        this.imageUpload = newImageUpload;
        
        this.uploadArea.addEventListener('click', () => this.imageUpload.click());
        
        this.imageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Mostrar preview local
            const reader = new FileReader();
            reader.onload = (event) => {
                this.displayImage(event.target.result);
                if (this.eventBus) {
                    this.eventBus.emit('imageChanged', event.target.result);
                }
            };
            reader.readAsDataURL(file);
            
            // Subir al servidor
            const imagenUrl = await this.api.uploadImage(file);
            if (imagenUrl) {
                this.currentImageUrl = imagenUrl;
                if (this.storage) {
                    this.storage.save('imagenUrl', imagenUrl);
                } else {
                    localStorage.setItem('imagenUrl', imagenUrl);
                }
                if (this.eventBus) {
                    this.eventBus.emit('imageChanged', imagenUrl);
                }
            }
        });
        
        if (this.changeImageBtn) {
            const newChangeBtn = this.changeImageBtn.cloneNode(true);
            this.changeImageBtn.parentNode.replaceChild(newChangeBtn, this.changeImageBtn);
            this.changeImageBtn = newChangeBtn;
            
            this.changeImageBtn.addEventListener('click', () => {
                this.imageUpload.click();
            });
        }
    }

    displayImage(url) {
        if (this.characterImage) {
            this.characterImage.src = url;
            if (this.uploadArea) this.uploadArea.style.display = 'none';
            if (this.imagePreview) this.imagePreview.style.display = 'flex';
            if (this.imageContainer) this.imageContainer.classList.add('has-image');
        }
    }

    loadSavedImage() {
        if (this.currentImageUrl) {
            this.displayImage(this.currentImageUrl);
        }
    }

    getImageUrl() {
        return this.currentImageUrl;
    }
}