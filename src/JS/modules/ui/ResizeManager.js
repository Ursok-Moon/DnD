export class ResizeManager {
    constructor(storageService) {
        this.storage = storageService;
        this.init();
    }

    init() {
        setTimeout(() => {
            const cards = document.querySelectorAll('.card');
            cards.forEach(card => {
                this.addResizeHandle(card);
            });
            this.loadSavedSizes();
        }, 500);
    }

    addResizeHandle(card) {
        if (card.querySelector('.resize-handle')) return;
        
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        card.appendChild(resizeHandle);
        
        let isResizing = false;
        let startWidth, startHeight, startX, startY;
        
        const startResize = (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            isResizing = true;
            startWidth = parseInt(getComputedStyle(card).width, 10);
            startHeight = parseInt(getComputedStyle(card).height, 10);
            
            if (e.type === 'mousedown') {
                startX = e.clientX;
                startY = e.clientY;
            } else if (e.type === 'touchstart') {
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
            }
            
            document.addEventListener('mousemove', resize);
            document.addEventListener('touchmove', resize);
            document.addEventListener('mouseup', stopResize);
            document.addEventListener('touchend', stopResize);
        };
        
        const resize = (e) => {
            if (!isResizing) return;
            e.preventDefault();
            
            let clientX, clientY;
            
            if (e.type === 'mousemove') {
                clientX = e.clientX;
                clientY = e.clientY;
            } else if (e.type === 'touchmove') {
                const touch = e.touches[0];
                clientX = touch.clientX;
                clientY = touch.clientY;
            }
            
            const deltaX = clientX - startX;
            const deltaY = clientY - startY;
            
            const newWidth = Math.max(200, Math.min(800, startWidth + deltaX));
            const newHeight = Math.max(150, Math.min(600, startHeight + deltaY));
            
            card.style.width = `${newWidth}px`;
            card.style.height = `${newHeight}px`;
        };
        
        const stopResize = () => {
            isResizing = false;
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('touchmove', resize);
            document.removeEventListener('mouseup', stopResize);
            document.removeEventListener('touchend', stopResize);
            this.saveSize(card);
        };
        
        resizeHandle.addEventListener('mousedown', startResize);
        resizeHandle.addEventListener('touchstart', startResize);
    }

    saveSize(card) {
        const sizes = this.storage.load('cardSizes') || {};
        sizes[card.id] = {
            width: card.style.width,
            height: card.style.height
        };
        this.storage.save('cardSizes', sizes);
    }

    loadSavedSizes() {
        const sizes = this.storage.load('cardSizes');
        if (sizes) {
            Object.entries(sizes).forEach(([cardId, size]) => {
                const card = document.getElementById(cardId);
                if (card) {
                    if (size.width) card.style.width = size.width;
                    if (size.height) card.style.height = size.height;
                }
            });
        }
    }
}