// js/modules/attributes/AttributeUI.js
import { Helpers } from '../../utils/Helpers.js';

export class AttributeUI {
    constructor(attributeManager, colorManager, eventBus, container = null) {
        this.attributeManager = attributeManager;
        this.colorManager = colorManager;
        this.eventBus = eventBus;
        
        // Usar el contenedor proporcionado o buscar por defecto
        this.container = container || document;
        this.containerElement = this.container.querySelector ? this.container : document;
        
        // Buscar el contenedor de atributos dentro del contexto
        this.attributesContainer = this.containerElement.querySelector('#attributesContainer');
        
        if (!this.attributesContainer) {
            console.error('❌ attributesContainer no encontrado en el contexto proporcionado');
            // Intentar buscar en todo el documento como fallback
            this.attributesContainer = document.getElementById('attributesContainer');
        }
        
        if (this.attributesContainer) {
            this.attributeManager.subscribe((attributes) => {
                this.render(attributes);
            });
        } else {
            console.error('❌ No se pudo encontrar attributesContainer');
        }
        
        this.setupAddButton();
    }

    setupAddButton() {
        const addBtn = this.containerElement.querySelector('#addAttributeBtn');
        if (addBtn) {
            // Remover event listeners anteriores
            const newBtn = addBtn.cloneNode(true);
            addBtn.parentNode.replaceChild(newBtn, addBtn);
            
            newBtn.addEventListener('click', () => {
                this.attributeManager.add();
                Helpers.showMessage('Atributo añadido', 'info');
            });
        }
    }

    render(attributes) {
        if (!this.attributesContainer) return;
        
        this.attributesContainer.innerHTML = '';
        
        attributes.forEach(attr => {
            const element = this.createAttributeElement(attr);
            this.attributesContainer.appendChild(element);
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

        valueInput.addEventListener('change', () => {
            const value = Helpers.validateNumber(valueInput.value, 1, 30, 10);
            if (this.attributeManager.update(attribute.id, { value })) {
                const modifier = Helpers.calculateModifier(value);
                modifierEl.textContent = Helpers.formatModifier(modifier);
                this.eventBus.emit('attributeChanged', { id: attribute.id, value, modifier });
            }
        });

        valueInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                valueInput.blur();
            }
        });

        removeBtn.addEventListener('click', () => {
            const totalAttributes = this.attributesContainer.querySelectorAll('.attribute-item').length;
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