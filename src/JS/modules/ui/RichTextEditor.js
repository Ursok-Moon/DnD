// js/modules/ui/RichTextEditor.js

export class RichTextEditor {
    constructor() {
        this.textareas = new Map();
        this.activeEditor = null;
        this.toolbarVisible = false;
        this.toolbarElement = null;
        this.isPinned = false;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.toolbarPosition = null;
        this.isMinimized = false;
    }

    initRichTextAreas() {
        const textareaIds = ['personality', 'ideals', 'bonds', 'flaws', 'features'];
        
        textareaIds.forEach(id => {
            const textarea = document.getElementById(id);
            if (textarea && !this.textareas.has(id)) {
                this.convertToRichText(textarea, id);
            }
        });
        
        this.createGlobalToolbar();
        this.setupGlobalEvents();
        this.loadToolbarPosition();
        
        console.log('✅ Editor de texto enriquecido inicializado');
    }

    convertToRichText(textarea, id) {
        const container = document.createElement('div');
        container.className = 'rich-editor-container';
        container.dataset.id = id;
        container.style.position = 'relative';
        
        const editor = document.createElement('div');
        editor.className = 'rich-editor-content';
        editor.setAttribute('contenteditable', 'true');
        editor.innerHTML = textarea.value || '';
        
        editor.style.cssText = `
            min-height: 80px;
            max-height: 200px;
            overflow-y: auto;
            background: var(--parchment-light, #f5e6d3);
            border: 2px solid var(--accent-gold, #d4af37);
            border-radius: 8px;
            padding: 12px;
            font-family: 'Cinzel', serif;
            font-size: 0.9rem;
            line-height: 1.6;
            color: var(--ink-dark, #2c1810);
            transition: all 0.3s ease;
            outline: none;
        `;
        
        // Evento focus - mostrar toolbar
        editor.addEventListener('focus', () => {
            this.activeEditor = { id, editor, textarea };
            if (!this.isPinned) {
                this.showToolbar(editor);
            }
            editor.style.borderColor = 'var(--accent-purple, #6a0dad)';
            editor.style.boxShadow = '0 0 0 3px rgba(106, 13, 173, 0.2)';
        });
        
        // Evento blur - ocultar toolbar (con delay)
        editor.addEventListener('blur', () => {
            setTimeout(() => {
                if (this.activeEditor?.id === id && !this.isPinned) {
                    // Solo ocultar si no estamos en la toolbar
                    if (!this.toolbarElement?.contains(document.activeElement)) {
                        this.hideToolbar();
                        this.activeEditor = null;
                    }
                }
            }, 300);
            editor.style.borderColor = 'var(--accent-gold, #d4af37)';
            editor.style.boxShadow = 'none';
        });
        
        // Evento input - sincronizar con textarea
        editor.addEventListener('input', () => {
            textarea.value = editor.innerHTML;
            const changeEvent = new Event('change', { bubbles: true });
            textarea.dispatchEvent(changeEvent);
        });
        
        // Guardar referencia al editor en el textarea
        textarea._editor = editor;
        textarea._container = container;
        
        // Reemplazar textarea con el contenedor
        textarea.style.display = 'none';
        textarea.parentNode.insertBefore(container, textarea);
        container.appendChild(editor);
        container.appendChild(textarea);
        
        this.textareas.set(id, { editor, textarea, container });
    }

    createGlobalToolbar() {
        if (this.toolbarElement) {
            // Si ya existe, solo mostrar
            this.toolbarElement.style.display = 'none';
            return;
        }
        
        this.toolbarElement = document.createElement('div');
        this.toolbarElement.className = 'rich-text-toolbar';
        
        // ===== CABECERA (arrastrable) =====
        const toolbarHeader = document.createElement('div');
        toolbarHeader.className = 'toolbar-header';
        toolbarHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 12px;
            background: linear-gradient(135deg, #6a0dad, #5d3a9b);
            border-radius: 10px 10px 0 0;
            cursor: move;
            user-select: none;
            min-height: 36px;
        `;
        
        // Título
        const title = document.createElement('span');
        title.innerHTML = '<i class="fas fa-paint-brush"></i> Editor de Texto';
        title.style.cssText = `
            color: white;
            font-size: 0.8rem;
            font-weight: bold;
            font-family: 'Cinzel', serif;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        // Controles
        const controls = document.createElement('div');
        controls.style.cssText = `display: flex; gap: 4px; align-items: center;`;
        
        // Botón fijar
        const pinBtn = this.createControlButton('fa-thumbtack', 'Fijar barra', 'toolbar-pin-btn');
        pinBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePin();
        });
        
        // Botón minimizar
        const minBtn = this.createControlButton('fa-minus', 'Minimizar barra', 'toolbar-minimize-btn');
        minBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMinimize();
        });
        
        // Botón cerrar
        const closeBtn = this.createControlButton('fa-times', 'Cerrar barra', 'toolbar-close-btn');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideToolbar();
        });
        
        controls.appendChild(pinBtn);
        controls.appendChild(minBtn);
        controls.appendChild(closeBtn);
        
        toolbarHeader.appendChild(title);
        toolbarHeader.appendChild(controls);
        
        // ===== BOTONES DE FORMATO =====
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'toolbar-buttons';
        buttonsContainer.style.cssText = `
            padding: 8px 12px;
            display: flex;
            gap: 6px;
            flex-wrap: wrap;
            background: linear-gradient(135deg, #e6d0b5, #f5e6d3);
            border-radius: 0 0 10px 10px;
            border-top: 1px solid var(--accent-gold, #d4af37);
        `;
        
        // Definir botones
        const buttonGroups = [
            // Grupo 1: Negrita, Cursiva, Subrayado
            [
                { command: 'bold', icon: 'fa-bold', title: 'Negrita (Ctrl+B)' },
                { command: 'italic', icon: 'fa-italic', title: 'Cursiva (Ctrl+I)' },
                { command: 'underline', icon: 'fa-underline', title: 'Subrayado (Ctrl+U)' },
            ],
            // Separador
            null,
            // Grupo 2: Títulos
            [
                { command: 'h1', icon: 'fa-heading', title: 'Título 1', text: 'H1' },
                { command: 'h2', icon: 'fa-heading', title: 'Título 2', text: 'H2' },
                { command: 'h3', icon: 'fa-heading', title: 'Título 3', text: 'H3' },
            ],
            // Separador
            null,
            // Grupo 3: Listas
            [
                { command: 'insertUnorderedList', icon: 'fa-list-ul', title: 'Lista con viñetas' },
                { command: 'insertOrderedList', icon: 'fa-list-ol', title: 'Lista numerada' },
            ],
            // Separador
            null,
            // Grupo 4: Alineación
            [
                { command: 'justifyLeft', icon: 'fa-align-left', title: 'Alinear izquierda' },
                { command: 'justifyCenter', icon: 'fa-align-center', title: 'Centrar' },
                { command: 'justifyRight', icon: 'fa-align-right', title: 'Alinear derecha' },
            ],
            // Separador
            null,
            // Grupo 5: Limpiar y Ayuda
            [
                { command: 'removeFormat', icon: 'fa-eraser', title: 'Limpiar formato' },
            ]
        ];
        
        buttonGroups.forEach((group, index) => {
            if (group === null) {
                // Separador
                const sep = document.createElement('span');
                sep.style.cssText = `
                    width: 1px;
                    height: 28px;
                    background: var(--accent-gold, #d4af37);
                    margin: 0 2px;
                    opacity: 0.5;
                `;
                buttonsContainer.appendChild(sep);
                return;
            }
            
            group.forEach(btnDef => {
                const btn = document.createElement('button');
                btn.className = 'toolbar-btn';
                btn.dataset.command = btnDef.command;
                
                if (btnDef.text) {
                    btn.textContent = btnDef.text;
                    btn.style.fontSize = '11px';
                    btn.style.fontWeight = 'bold';
                } else {
                    btn.innerHTML = `<i class="fas ${btnDef.icon}"></i>`;
                }
                
                btn.title = btnDef.title;
                btn.style.cssText = `
                    background: var(--parchment, #ecdcc8);
                    border: 1px solid var(--accent-gold, #d4af37);
                    border-radius: 6px;
                    padding: 5px 10px;
                    cursor: pointer;
                    color: var(--ink-dark, #2c1810);
                    transition: all 0.2s ease;
                    font-size: 13px;
                    min-width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                `;
                
                btn.addEventListener('mouseenter', () => {
                    btn.style.background = 'var(--accent-gold, #d4af37)';
                    btn.style.color = '#1a0f0a';
                    btn.style.transform = 'scale(1.05)';
                });
                
                btn.addEventListener('mouseleave', () => {
                    btn.style.background = 'var(--parchment, #ecdcc8)';
                    btn.style.color = 'var(--ink-dark, #2c1810)';
                    btn.style.transform = 'scale(1)';
                });
                
                btn.addEventListener('mousedown', (e) => {
                    e.preventDefault(); // Evitar que el editor pierda foco
                });
                
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.applyFormat(btnDef.command);
                });
                
                buttonsContainer.appendChild(btn);
            });
        });
        
        // Botón de ayuda (al final)
        const helpBtn = document.createElement('button');
        helpBtn.className = 'toolbar-btn';
        helpBtn.innerHTML = '<i class="fas fa-question-circle"></i>';
        helpBtn.title = 'Ayuda de formato';
        helpBtn.style.cssText = `
            background: var(--accent-purple, #6a0dad);
            border: 1px solid var(--accent-gold, #d4af37);
            border-radius: 6px;
            padding: 5px 10px;
            cursor: pointer;
            color: white;
            transition: all 0.2s ease;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        helpBtn.addEventListener('click', () => this.showFormatHelp());
        buttonsContainer.appendChild(helpBtn);
        
        // Ensamblar toolbar
        this.toolbarElement.appendChild(toolbarHeader);
        this.toolbarElement.appendChild(buttonsContainer);
        
        // Estilos de la barra
        this.toolbarElement.style.cssText = `
            position: fixed;
            background: linear-gradient(135deg, #e6d0b5, #f5e6d3);
            border: 2px solid var(--accent-gold, #d4af37);
            border-radius: 12px;
            z-index: 10000;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(8px);
            min-width: 320px;
            max-width: 90vw;
            display: none;
            transition: box-shadow 0.2s ease;
        `;
        
        // Configurar arrastre
        this.setupDragEvents(toolbarHeader);
        
        document.body.appendChild(this.toolbarElement);
    }

    createControlButton(icon, title, className) {
        const btn = document.createElement('button');
        btn.className = className;
        btn.innerHTML = `<i class="fas ${icon}"></i>`;
        btn.title = title;
        btn.style.cssText = `
            background: none;
            border: none;
            color: rgba(255,255,255,0.8);
            cursor: pointer;
            font-size: 14px;
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.2s ease;
        `;
        
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(255,255,255,0.2)';
        });
        
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'none';
        });
        
        return btn;
    }

    setupDragEvents(dragHandle) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        
        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            
            let newLeft = initialLeft + (e.clientX - startX);
            let newTop = initialTop + (e.clientY - startY);
            
            const maxX = window.innerWidth - this.toolbarElement.offsetWidth;
            const maxY = window.innerHeight - this.toolbarElement.offsetHeight;
            
            newLeft = Math.max(5, Math.min(maxX - 5, newLeft));
            newTop = Math.max(5, Math.min(maxY - 5, newTop));
            
            this.toolbarElement.style.left = `${newLeft}px`;
            this.toolbarElement.style.top = `${newTop}px`;
            
            if (this.isPinned) {
                this.saveToolbarPosition(newLeft, newTop);
            }
        };
        
        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            if (this.isPinned) {
                const left = parseInt(this.toolbarElement.style.left);
                const top = parseInt(this.toolbarElement.style.top);
                if (!isNaN(left) && !isNaN(top)) {
                    this.saveToolbarPosition(left, top);
                }
            }
            
            dragHandle.style.cursor = 'move';
            dragHandle.style.opacity = '1';
        };
        
        dragHandle.addEventListener('mousedown', (e) => {
            if (e.target.closest('button')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            const left = this.toolbarElement.style.left;
            const top = this.toolbarElement.style.top;
            
            initialLeft = left ? parseInt(left) : 100;
            initialTop = top ? parseInt(top) : 100;
            
            dragHandle.style.cursor = 'grabbing';
            dragHandle.style.opacity = '0.8';
            
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
            e.preventDefault();
        });
    }

    togglePin() {
        this.isPinned = !this.isPinned;
        
        const pinBtn = this.toolbarElement?.querySelector('.toolbar-pin-btn');
        if (pinBtn) {
            pinBtn.innerHTML = this.isPinned ? '<i class="fas fa-thumbtack fa-rotate-45"></i>' : '<i class="fas fa-thumbtack"></i>';
            pinBtn.title = this.isPinned ? 'Desfijar barra' : 'Fijar barra';
            pinBtn.style.color = this.isPinned ? '#ffd700' : 'rgba(255,255,255,0.8)';
        }
        
        if (this.isPinned) {
            const left = this.toolbarElement.style.left;
            const top = this.toolbarElement.style.top;
            if (left && top && left !== 'auto' && top !== 'auto') {
                this.saveToolbarPosition(parseInt(left), parseInt(top));
            }
        }
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        const buttonsContainer = this.toolbarElement?.querySelector('.toolbar-buttons');
        const minBtn = this.toolbarElement?.querySelector('.toolbar-minimize-btn');
        
        if (!buttonsContainer) return;
        
        if (this.isMinimized) {
            buttonsContainer.style.display = 'none';
            if (minBtn) {
                minBtn.innerHTML = '<i class="fas fa-plus"></i>';
                minBtn.title = 'Expandir barra';
            }
            this.toolbarElement.style.minWidth = 'auto';
            this.toolbarElement.style.width = 'auto';
        } else {
            buttonsContainer.style.display = 'flex';
            if (minBtn) {
                minBtn.innerHTML = '<i class="fas fa-minus"></i>';
                minBtn.title = 'Minimizar barra';
            }
            this.toolbarElement.style.minWidth = '320px';
            this.toolbarElement.style.width = '';
        }
    }

    saveToolbarPosition(left, top) {
        this.toolbarPosition = { left, top };
        localStorage.setItem('richTextToolbarPosition', JSON.stringify(this.toolbarPosition));
    }

    loadToolbarPosition() {
        const saved = localStorage.getItem('richTextToolbarPosition');
        if (saved) {
            try {
                const pos = JSON.parse(saved);
                this.toolbarPosition = pos;
                if (this.toolbarElement) {
                    this.toolbarElement.style.left = `${pos.left}px`;
                    this.toolbarElement.style.top = `${pos.top}px`;
                }
            } catch (e) {
                console.warn('Error cargando posición de la barra:', e);
            }
        }
    }

    showToolbar(editor) {
        if (!this.toolbarElement) return;
        
        // Si está fijada y tiene posición guardada
        if (this.isPinned && this.toolbarPosition) {
            this.toolbarElement.style.left = `${this.toolbarPosition.left}px`;
            this.toolbarElement.style.top = `${this.toolbarPosition.top}px`;
            this.toolbarElement.style.display = 'block';
            this.toolbarVisible = true;
            return;
        }
        
        // Posicionar cerca del editor
        const rect = editor.getBoundingClientRect();
        const toolbarHeight = this.toolbarElement.offsetHeight || 200;
        
        let top = rect.top - toolbarHeight - 10;
        let left = rect.left;
        
        if (top < 10) {
            top = rect.bottom + 10;
        }
        
        if (left + this.toolbarElement.offsetWidth > window.innerWidth - 10) {
            left = window.innerWidth - this.toolbarElement.offsetWidth - 10;
        }
        
        if (left < 10) left = 10;
        
        this.toolbarElement.style.top = `${top}px`;
        this.toolbarElement.style.left = `${left}px`;
        this.toolbarElement.style.display = 'block';
        this.toolbarVisible = true;
    }

    hideToolbar() {
        if (this.toolbarElement && !this.isPinned) {
            this.toolbarElement.style.display = 'none';
            this.toolbarVisible = false;
        }
    }

    // ===== NUEVO: APLICAR FORMATO USANDO API MODERNA =====
    applyFormat(command) {
        if (!this.activeEditor) {
            console.warn('No hay editor activo');
            return;
        }
        
        const editor = this.activeEditor.editor;
        editor.focus();
        
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        // Si no hay selección, insertar placeholder
        if (range.collapsed) {
            this.insertPlaceholder(command);
            return;
        }
        
        switch(command) {
            case 'bold':
                this.applyInlineFormat('strong', 'font-weight: bold;');
                break;
            case 'italic':
                this.applyInlineFormat('em', 'font-style: italic;');
                break;
            case 'underline':
                this.applyInlineFormat('u', 'text-decoration: underline;');
                break;
            case 'h1':
                this.applyBlockFormat('h1', 'H1', `
                    font-size: 1.8rem;
                    font-weight: bold;
                    color: #6a0dad;
                    margin: 15px 0 10px;
                    font-family: 'Cinzel', serif;
                    border-left: 4px solid #d4af37;
                    padding-left: 12px;
                `);
                break;
            case 'h2':
                this.applyBlockFormat('h2', 'H2', `
                    font-size: 1.4rem;
                    font-weight: bold;
                    color: #1e3a5f;
                    margin: 12px 0 8px;
                    font-family: 'Cinzel', serif;
                `);
                break;
            case 'h3':
                this.applyBlockFormat('h3', 'H3', `
                    font-size: 1.1rem;
                    font-weight: bold;
                    color: #2c7a6b;
                    margin: 10px 0 6px;
                    font-style: italic;
                `);
                break;
            case 'insertUnorderedList':
                this.applyList('ul');
                break;
            case 'insertOrderedList':
                this.applyList('ol');
                break;
            case 'justifyLeft':
            case 'justifyCenter':
            case 'justifyRight':
                this.applyAlignment(command.replace('justify', '').toLowerCase());
                break;
            case 'removeFormat':
                this.removeFormat();
                break;
            default:
                console.warn('Comando no soportado:', command);
        }
        
        // Sincronizar con textarea
        this.syncToTextarea();
    }

    applyInlineFormat(tag, styles) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        
        const fragment = range.extractContents();
        const wrapper = document.createElement(tag);
        wrapper.style.cssText = styles;
        wrapper.appendChild(fragment);
        range.insertNode(wrapper);
        
        // Restaurar selección
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        selection.addRange(newRange);
    }

    applyBlockFormat(tag, placeholder, styles) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        let wrapper;
        
        if (range.collapsed) {
            // Insertar nuevo elemento
            wrapper = document.createElement(tag);
            wrapper.textContent = placeholder;
            wrapper.style.cssText = styles;
            range.insertNode(wrapper);
            
            // Seleccionar el texto
            const textNode = wrapper.firstChild;
            if (textNode) {
                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(textNode);
                selection.addRange(newRange);
            }
        } else {
            // Envolver selección
            const fragment = range.extractContents();
            wrapper = document.createElement(tag);
            wrapper.style.cssText = styles;
            wrapper.appendChild(fragment);
            range.insertNode(wrapper);
            
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(wrapper);
            selection.addRange(newRange);
        }
    }

    applyList(type) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const list = document.createElement(type);
        list.style.cssText = `
            margin: 10px 0;
            padding-left: 20px;
            color: var(--ink-dark, #2c1810);
        `;
        
        let text = range.toString().trim();
        if (!text) {
            // Si no hay selección, crear lista con items placeholder
            const items = ['Item 1', 'Item 2', 'Item 3'];
            items.forEach(itemText => {
                const li = document.createElement('li');
                li.textContent = itemText;
                li.style.cssText = `margin: 4px 0; line-height: 1.6;`;
                list.appendChild(li);
            });
            range.deleteContents();
            range.insertNode(list);
        } else {
            // Dividir por líneas
            const lines = text.split('\n').filter(l => l.trim());
            lines.forEach(line => {
                const li = document.createElement('li');
                li.textContent = line.trim();
                li.style.cssText = `margin: 4px 0; line-height: 1.6;`;
                list.appendChild(li);
            });
            range.deleteContents();
            range.insertNode(list);
        }
        
        // Seleccionar todo el contenido de la lista
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(list);
        selection.addRange(newRange);
    }

    applyAlignment(alignment) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        
        // Obtener el bloque contenedor
        let container = range.commonAncestorContainer;
        while (container && container.nodeType !== 1) {
            container = container.parentNode;
        }
        
        if (container) {
            container.style.textAlign = alignment;
        }
    }

    removeFormat() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        if (range.collapsed) return;
        
        const fragment = range.extractContents();
        const text = fragment.textContent || '';
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        
        // Seleccionar el texto
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(textNode);
        selection.addRange(newRange);
    }

    insertPlaceholder(command) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        let text = '';
        
        switch(command) {
            case 'bold': text = 'texto en negrita'; break;
            case 'italic': text = 'texto en cursiva'; break;
            case 'underline': text = 'texto subrayado'; break;
            case 'h1': text = 'Título Principal'; break;
            case 'h2': text = 'Subtítulo'; break;
            case 'h3': text = 'Sub-subtítulo'; break;
            default: text = 'texto';
        }
        
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        
        // Seleccionar el texto insertado
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.setStart(textNode, 0);
        newRange.setEnd(textNode, text.length);
        selection.addRange(newRange);
        
        this.syncToTextarea();
    }

    syncToTextarea() {
        if (!this.activeEditor) return;
        
        const editor = this.activeEditor.editor;
        const textarea = this.activeEditor.textarea;
        textarea.value = editor.innerHTML;
        
        const changeEvent = new Event('change', { bubbles: true });
        textarea.dispatchEvent(changeEvent);
    }

    showFormatHelp() {
        const helpModal = document.createElement('div');
        helpModal.className = 'modal';
        helpModal.style.display = 'flex';
        helpModal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <div class="modal-header">
                    <h3><i class="fas fa-question-circle"></i> Formato de Texto</h3>
                    <button class="modal-close" id="closeHelpModal">&times;</button>
                </div>
                <div class="modal-body">
                    <h4>Controles de la barra:</h4>
                    <ul style="list-style: none; padding: 0;">
                        <li><strong><i class="fas fa-thumbtack"></i></strong> - Fijar/Desfijar barra</li>
                        <li><strong><i class="fas fa-minus"></i>/<i class="fas fa-plus"></i></strong> - Minimizar/Expandir</li>
                        <li><strong><i class="fas fa-times"></i></strong> - Cerrar barra</li>
                        <li><strong>Arrastrar cabecera</strong> - Mover barra (solo si está fijada)</li>
                    </ul>
                    <h4>Atajos de teclado:</h4>
                    <ul style="list-style: none; padding: 0;">
                        <li><strong>Ctrl+B</strong> - Negrita</li>
                        <li><strong>Ctrl+I</strong> - Cursiva</li>
                        <li><strong>Ctrl+U</strong> - Subrayado</li>
                        <li><strong>Ctrl+Z</strong> - Deshacer</li>
                        <li><strong>Ctrl+Y</strong> - Rehacer</li>
                    </ul>
                    <h4>Formatos disponibles:</h4>
                    <ul style="list-style: none; padding: 0;">
                        <li><strong>Negrita</strong> - Resalta texto importante</li>
                        <li><strong>Cursiva</strong> - Énfasis en texto</li>
                        <li><strong>Subrayado</strong> - Subraya texto</li>
                        <li><strong>H1, H2, H3</strong> - Títulos jerárquicos</li>
                        <li><strong>Listas</strong> - Viñetas o numeradas</li>
                        <li><strong>Alineación</strong> - Izquierda, Centro, Derecha</li>
                        <li><strong>Limpiar</strong> - Elimina todo el formato</li>
                    </ul>
                </div>
            </div>
        `;
        
        document.body.appendChild(helpModal);
        
        helpModal.querySelector('.modal-close').addEventListener('click', () => {
            helpModal.remove();
        });
        
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) helpModal.remove();
        });
    }

    setupGlobalEvents() {
        // Atajos de teclado
        document.addEventListener('keydown', (e) => {
            if (!this.activeEditor) return;
            
            if ((e.ctrlKey || e.metaKey)) {
                switch(e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.applyFormat('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.applyFormat('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.applyFormat('underline');
                        break;
                }
            }
        });
        
        // Clic fuera del editor - ocultar toolbar (solo si no está fijada)
        document.addEventListener('mousedown', (e) => {
            if (!this.isPinned && this.toolbarElement && this.activeEditor) {
                const isInToolbar = this.toolbarElement.contains(e.target);
                const isInEditor = this.activeEditor.editor.contains(e.target);
                
                if (!isInToolbar && !isInEditor) {
                    this.hideToolbar();
                    this.activeEditor = null;
                }
            }
        });
    }

    getContent(id) {
        const editor = this.textareas.get(id);
        return editor ? editor.editor.innerHTML : '';
    }

    setContent(id, html) {
        const editor = this.textareas.get(id);
        if (editor) {
            editor.editor.innerHTML = html || '';
            editor.textarea.value = html || '';
        }
    }

    parseMarkdown(text) {
        if (!text) return '';
        
        let html = text;
        
        // Escapar HTML
        html = html.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
        
        // Títulos
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        
        // Negrita y cursiva
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        // Listas
        html = html.replace(/^\s*[\-\*]\s+(.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // Saltos de línea
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }
}