import { Helpers } from '../../utils/Helpers.js';

export class DragDropManager {
    constructor(storageService) {
        this.storage = storageService;
        this.init();
    }

    init() {
        setTimeout(() => {
            this.setupDraggableCards();
            this.setupDroppableColumns();
        }, 500);
    }

    setupDraggableCards() {
        const cards = document.querySelectorAll('.card');
        
        cards.forEach(card => {
            this.makeCardDraggable(card);
        });
    }

    makeCardDraggable(card) {
        const title = card.querySelector('.card-title');
        if (!title) return;
        
        // Asegurar ID único
        if (!card.id) {
            card.id = `card-${Helpers.generateId()}`;
        }
        
        title.style.cursor = 'grab';
        title.setAttribute('draggable', 'true');
        
        // Evitar duplicados de eventos
        const newTitle = title.cloneNode(true);
        title.parentNode.replaceChild(newTitle, title);
        
        newTitle.style.cursor = 'grab';
        newTitle.setAttribute('draggable', 'true');
        
        newTitle.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            card.classList.add('dragging');
            e.dataTransfer.setData('text/plain', card.id);
            e.dataTransfer.setData('card-id', card.id);
            e.dataTransfer.effectAllowed = 'move';
            newTitle.style.cursor = 'grabbing';
            document.body.classList.add('dragging-active');
        });
        
        newTitle.addEventListener('dragend', (e) => {
            card.classList.remove('dragging');
            newTitle.style.cursor = 'grab';
            document.body.classList.remove('dragging-active');
        });
        
        // Prevenir drag en elementos interactivos
        const inputs = card.querySelectorAll('input, textarea, select, button');
        inputs.forEach(input => {
            input.setAttribute('draggable', 'false');
            input.addEventListener('dragstart', (e) => e.preventDefault());
        });
    }

    setupDroppableColumns() {
        const columns = document.querySelectorAll('.left-column, .center-column, .right-column');
        
        columns.forEach(column => {
            column.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                column.classList.add('drag-over');
            });
            
            column.addEventListener('dragleave', () => {
                column.classList.remove('drag-over');
            });
            
            column.addEventListener('drop', (e) => {
                e.preventDefault();
                column.classList.remove('drag-over');
                
                const draggedCardId = e.dataTransfer.getData('card-id');
                const draggedCard = document.getElementById(draggedCardId);
                
                if (!draggedCard) return;
                
                const dropTarget = e.target.closest('.card');
                
                if (dropTarget && dropTarget !== draggedCard) {
                    this.swapCards(draggedCard, dropTarget);
                } else if (!dropTarget) {
                    column.appendChild(draggedCard);
                }
                
                this.saveLayout();
            });
        });
    }

    swapCards(cardA, cardB) {
        const parentA = cardA.parentNode;
        const parentB = cardB.parentNode;
        const idA = cardA.id;
        const idB = cardB.id;
        
        const placeholderA = document.createElement('div');
        const placeholderB = document.createElement('div');
        
        parentA.insertBefore(placeholderA, cardA);
        parentB.insertBefore(placeholderB, cardB);
        
        parentA.insertBefore(cardB, placeholderA);
        parentB.insertBefore(cardA, placeholderB);
        
        placeholderA.remove();
        placeholderB.remove();
        
        cardA.id = idA;
        cardB.id = idB;
        
        cardA.classList.add('swap-animation');
        cardB.classList.add('swap-animation');
        
        setTimeout(() => {
            cardA.classList.remove('swap-animation');
            cardB.classList.remove('swap-animation');
        }, 300);
    }

    saveLayout() {
        const layout = {};
        const cards = document.querySelectorAll('.card');
        
        cards.forEach(card => {
            layout[card.id] = {
                parentId: card.parentNode.id || card.parentNode.className,
                index: Array.from(card.parentNode.children).indexOf(card)
            };
        });
        
        this.storage.save('cardLayout', layout);
    }
}