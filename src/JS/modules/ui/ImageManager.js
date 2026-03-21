export class ImageManager {
    constructor(apiService, eventBus) { 
        this.api = apiService;
        this.eventBus = eventBus;
        this.currentImageUrl = localStorage.getItem('imagenUrl') || null;
        this.init();
    }

    init() {
        this.setupUpload();
        this.loadSavedImage();
    }

    setupUpload() {
        const uploadArea = document.getElementById('imageUploadArea');
        const imageUpload = document.getElementById('imageUpload');
        
        if (!uploadArea || !imageUpload) return;
        
        uploadArea.addEventListener('click', () => imageUpload.click());
        
        imageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Preview local
            const reader = new FileReader();
            reader.onload = (event) => {
                this.displayImage(event.target.result);
                // EMITIR EVENTO después de mostrar preview
                if (this.eventBus) {
                    this.eventBus.emit('imageChanged', event.target.result);
                }
            };
            reader.readAsDataURL(file);
            
            // Subir al servidor
            const imagenUrl = await this.api.uploadImage(file);
            if (imagenUrl) {
                this.currentImageUrl = imagenUrl;
                localStorage.setItem('imagenUrl', imagenUrl);
                // EMITIR EVENTO después de subir al servidor
                if (this.eventBus) {
                    this.eventBus.emit('imageChanged', imagenUrl);
                }
            }
        });
        
        const changeImageBtn = document.getElementById('changeImageBtn');
        if (changeImageBtn) {
            changeImageBtn.addEventListener('click', () => {
                imageUpload.click();
            });
        }
    }

    displayImage(url) {
        const characterImage = document.getElementById('characterImage');
        const uploadArea = document.getElementById('imageUploadArea');
        const imagePreview = document.getElementById('imagePreview');
        const imageContainer = document.getElementById('imageContainer');
        
        if (characterImage) {
            characterImage.src = url;
            if (uploadArea) uploadArea.style.display = 'none';
            if (imagePreview) imagePreview.style.display = 'flex';
            if (imageContainer) imageContainer.classList.add('has-image');
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