import { Helpers } from '../../utils/Helpers.js';

export class AttributeUI {
    constructor(attributeManager, colorManager, eventBus) {
        this.attributeManager = attributeManager;
        this.colorManager = colorManager;
        this.eventBus = eventBus;
        this.container = document.getElementById('attributesContainer');
        
        if (!this.container) {
            console.error('❌ attributesContainer no encontrado');
            return;
        }
        
        this.attributeManager.subscribe((attributes) => {
            this.render(attributes);
        });
        
        this.setupAddButton();
    }

    setupAddButton() {
        const addBtn = document.getElementById('addAttributeBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.attributeManager.add();
                Helpers.showMessage('Atributo añadido', 'info');
            });
        }
    }

    render(attributes) {
        this.container.innerHTML = '';
        
        attributes.forEach(attr => {
            const element = this.createAttributeElement(attr);
            this.container.appendChild(element);
        });
    }

    createAttributeElement(attribute) {
        const div = document.createElement('div');
        div.className = 'attribute-item';
        div.dataset.id = attribute.id;
        
        const modifierText = Helpers.formatModifier(attribute.modifier);
        
        div.innerHTML = `
            <div class="attribute-header">
                <input type="text" class="attribute-name" value="${attribute.name}" 
                       placeholder="Nombre del atributo">
                <button type="button" class="btn-remove" title="Eliminar atributo">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="ability-score">
                <input type="number" class="ability-value" value="${attribute.value}" 
                       min="1" max="30">
                <div class="ability-modifier" style="color: ${this.colorManager.getColor('modifier')}">
                    ${modifierText}
                </div>
            </div>
        `;
        
        this.attachEvents(div, attribute);
        return div;
    }

    attachEvents(element, attribute) {
        const nameInput = element.querySelector('.attribute-name');
        const valueInput = element.querySelector('.ability-value');
        const removeBtn = element.querySelector('.btn-remove');
        const modifierEl = element.querySelector('.ability-modifier');

        nameInput.addEventListener('blur', () => {
            const newName = nameInput.value.trim() || 'ATRIBUTO';
            if (this.attributeManager.update(attribute.id, { name: newName })) {
                this.eventBus.emit('attributeNameChanged', { id: attribute.id, name: newName });
            }
        });

        valueInput.addEventListener('input', () => {
            const value = Helpers.validateNumber(valueInput.value, 1, 30, 10);
            if (this.attributeManager.update(attribute.id, { value })) {
                const modifier = Helpers.calculateModifier(value);
                modifierEl.textContent = Helpers.formatModifier(modifier);
                this.eventBus.emit('attributeChanged', { id: attribute.id, value, modifier });
            }
        });

        removeBtn.addEventListener('click', () => {
            const totalAttributes = document.querySelectorAll('.attribute-item').length;
            if (totalAttributes <= 3) {
                Helpers.showMessage('Debes mantener al menos 3 atributos', 'warning');
                return;
            }
            
            if (confirm('¿Eliminar este atributo?')) {
                if (this.attributeManager.remove(attribute.id)) {
                    Helpers.showMessage('Atributo eliminado', 'info');
                    this.eventBus.emit('attributeRemoved', attribute.id);
                }
            }
        });
    }
}