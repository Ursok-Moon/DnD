// js/modules/ui/RichTextEditor.js

export class RichTextEditor {
    constructor() {
        this.textareas = new Map();
        this.activeEditor = null;
        this.toolbarVisible = false;
        this.toolbarElement = null;
        this.isPinned = false;        // Estado de fijación
        this.isDragging = false;      // Estado de arrastre
        this.dragOffsetX = 0;         // Offset X del drag
        this.dragOffsetY = 0;         // Offset Y del drag
        this.toolbarPosition = null;   // Posición guardada
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
        
        const editor = document.createElement('div');
        editor.className = 'rich-editor-content';
        editor.setAttribute('contenteditable', 'true');
        editor.innerHTML = textarea.value || '';
        
        editor.style.cssText = `
            min-height: 80px;
            max-height: 200px;
            overflow-y: auto;
            background: var(--parchment-light);
            border: 1px solid var(--accent-gold);
            border-radius: 8px;
            padding: 12px;
            font-family: 'Cinzel', serif;
            font-size: 0.9rem;
            line-height: 1.6;
            color: var(--ink-dark);
            transition: all 0.3s ease;
        `;
        
        editor.addEventListener('focus', () => {
            this.activeEditor = { id, editor, textarea };
            if (!this.isPinned) {
                this.showToolbar(editor);
            }
            editor.style.borderColor = 'var(--accent-purple)';
            editor.style.boxShadow = '0 0 0 2px rgba(106, 13, 173, 0.2)';
        });
        
        editor.addEventListener('blur', () => {
            setTimeout(() => {
                if (this.activeEditor?.id === id && !this.isPinned) {
                    this.hideToolbar();
                    this.activeEditor = null;
                }
            }, 200);
            editor.style.borderColor = 'var(--accent-gold)';
            editor.style.boxShadow = 'none';
        });
        
        editor.addEventListener('input', () => {
            textarea.value = editor.innerHTML;
            const changeEvent = new Event('change', { bubbles: true });
            textarea.dispatchEvent(changeEvent);
        });
        
        textarea.style.display = 'none';
        textarea.parentNode.insertBefore(container, textarea);
        container.appendChild(editor);
        container.appendChild(textarea);
        
        this.textareas.set(id, { editor, textarea, container });
    }

    createGlobalToolbar() {
        if (this.toolbarElement) return;
        
        this.toolbarElement = document.createElement('div');
        this.toolbarElement.className = 'rich-text-toolbar';
        
        // Cabecera de la barra (para arrastrar)
        const toolbarHeader = document.createElement('div');
        toolbarHeader.className = 'toolbar-header';
        toolbarHeader.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 6px 10px;
            background: linear-gradient(135deg, var(--accent-purple), #5d3a9b);
            border-radius: 10px 10px 0 0;
            cursor: move;
            user-select: none;
        `;
        
        // Título
        const title = document.createElement('span');
        title.innerHTML = '<i class="fas fa-paint-brush"></i> Editor de Texto';
        title.style.cssText = `
            color: white;
            font-size: 0.8rem;
            font-weight: bold;
            font-family: 'Cinzel', serif;
        `;
        
        // Botones de control
        const controls = document.createElement('div');
        controls.style.cssText = `
            display: flex;
            gap: 8px;
        `;
        
        // Botón fijar/desfijar
        const pinBtn = document.createElement('button');
        pinBtn.className = 'toolbar-pin-btn';
        pinBtn.innerHTML = '<i class="fas fa-thumbtack"></i>';
        pinBtn.title = this.isPinned ? 'Desfijar barra (dejar de seguir al editor)' : 'Fijar barra (mantener en posición actual)';
        pinBtn.style.cssText = `
            background: none;
            border: none;
            color: ${this.isPinned ? 'var(--accent-gold)' : 'rgba(255,255,255,0.7)'};
            cursor: pointer;
            font-size: 14px;
            padding: 4px 6px;
            border-radius: 4px;
            transition: all 0.2s ease;
        `;
        
        pinBtn.addEventListener('mouseenter', () => {
            pinBtn.style.background = 'rgba(255,255,255,0.2)';
        });
        
        pinBtn.addEventListener('mouseleave', () => {
            pinBtn.style.background = 'none';
        });
        
        pinBtn.addEventListener('click', () => this.togglePin());
        
        // Botón minimizar
        const minimizeBtn = document.createElement('button');
        minimizeBtn.className = 'toolbar-minimize-btn';
        minimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
        minimizeBtn.title = 'Minimizar barra';
        minimizeBtn.style.cssText = `
            background: none;
            border: none;
            color: rgba(255,255,255,0.7);
            cursor: pointer;
            font-size: 14px;
            padding: 4px 6px;
            border-radius: 4px;
            transition: all 0.2s ease;
        `;
        
        minimizeBtn.addEventListener('mouseenter', () => {
            minimizeBtn.style.background = 'rgba(255,255,255,0.2)';
        });
        
        minimizeBtn.addEventListener('mouseleave', () => {
            minimizeBtn.style.background = 'none';
        });
        
        minimizeBtn.addEventListener('click', () => this.toggleMinimize());
        
        // Botón cerrar
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toolbar-close-btn';
        closeBtn.innerHTML = '<i class="fas fa-times"></i>';
        closeBtn.title = 'Cerrar barra';
        closeBtn.style.cssText = `
            background: none;
            border: none;
            color: rgba(255,255,255,0.7);
            cursor: pointer;
            font-size: 14px;
            padding: 4px 6px;
            border-radius: 4px;
            transition: all 0.2s ease;
        `;
        
        closeBtn.addEventListener('mouseenter', () => {
            closeBtn.style.background = 'rgba(255,255,255,0.2)';
        });
        
        closeBtn.addEventListener('mouseleave', () => {
            closeBtn.style.background = 'none';
        });
        
        closeBtn.addEventListener('click', () => this.hideToolbar());
        
        controls.appendChild(pinBtn);
        controls.appendChild(minimizeBtn);
        controls.appendChild(closeBtn);
        toolbarHeader.appendChild(title);
        toolbarHeader.appendChild(controls);
        
        // Contenedor de botones de formato
        const buttonsContainer = document.createElement('div');
        buttonsContainer.className = 'toolbar-buttons';
        buttonsContainer.style.cssText = `
            padding: 8px 12px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            background: linear-gradient(135deg, var(--parchment-dark), var(--parchment-light));
            border-radius: 0 0 10px 10px;
        `;
        
        // Botones de formato
        const buttons = [
            { command: 'bold', icon: 'fa-bold', title: 'Negrita (Ctrl+B)' },
            { command: 'italic', icon: 'fa-italic', title: 'Cursiva (Ctrl+I)' },
            { command: 'underline', icon: 'fa-underline', title: 'Subrayado (Ctrl+U)' },
            { type: 'separator' },
            { command: 'h1', icon: 'fa-heading', title: 'Título Principal', custom: true, sub: '1', text: 'H1' },
            { command: 'h2', icon: 'fa-heading', title: 'Subtítulo', custom: true, sub: '2', text: 'H2' },
            { command: 'h3', icon: 'fa-heading', title: 'Sub-subtítulo', custom: true, sub: '3', text: 'H3' },
            { type: 'separator' },
            { command: 'insertUnorderedList', icon: 'fa-list-ul', title: 'Lista con viñetas' },
            { command: 'insertOrderedList', icon: 'fa-list-ol', title: 'Lista numerada' },
            { type: 'separator' },
            { command: 'justifyLeft', icon: 'fa-align-left', title: 'Alinear izquierda' },
            { command: 'justifyCenter', icon: 'fa-align-center', title: 'Centrar' },
            { command: 'justifyRight', icon: 'fa-align-right', title: 'Alinear derecha' },
            { type: 'separator' },
            { command: 'removeFormat', icon: 'fa-eraser', title: 'Limpiar formato' }
        ];
        
        buttons.forEach(btn => {
            if (btn.type === 'separator') {
                const separator = document.createElement('span');
                separator.style.cssText = `
                    width: 1px;
                    height: 24px;
                    background: var(--accent-gold);
                    margin: 0 4px;
                `;
                buttonsContainer.appendChild(separator);
                return;
            }
            
            const button = document.createElement('button');
            button.className = 'toolbar-btn';
            
            if (btn.text) {
                button.textContent = btn.text;
            } else {
                button.innerHTML = `<i class="fas ${btn.icon}"></i>`;
            }
            
            button.title = btn.title;
            button.style.cssText = `
                background: var(--parchment);
                border: 1px solid var(--accent-gold);
                border-radius: 6px;
                padding: 6px 10px;
                cursor: pointer;
                color: var(--ink-dark);
                transition: all 0.2s ease;
                font-size: 12px;
                font-weight: bold;
            `;
            
            button.addEventListener('mouseenter', () => {
                button.style.background = 'var(--accent-gold)';
                button.style.color = 'var(--ink-black)';
            });
            
            button.addEventListener('mouseleave', () => {
                button.style.background = 'var(--parchment)';
                button.style.color = 'var(--ink-dark)';
            });
            
            if (btn.custom) {
                button.addEventListener('click', () => {
                    this.applyCustomFormat(btn.command, btn.sub);
                });
            } else {
                button.addEventListener('click', () => {
                    this.formatDocument(btn.command);
                });
            }
            
            buttonsContainer.appendChild(button);
        });
        
        // Botón de ayuda
        const helpBtn = document.createElement('button');
        helpBtn.className = 'toolbar-btn';
        helpBtn.innerHTML = '<i class="fas fa-question"></i>';
        helpBtn.title = 'Ayuda de formato';
        helpBtn.style.cssText = `
            background: var(--accent-purple);
            border: 1px solid var(--accent-gold);
            border-radius: 6px;
            padding: 6px 10px;
            cursor: pointer;
            color: white;
            transition: all 0.2s ease;
        `;
        helpBtn.addEventListener('click', () => this.showFormatHelp());
        buttonsContainer.appendChild(helpBtn);
        
        this.toolbarElement.appendChild(toolbarHeader);
        this.toolbarElement.appendChild(buttonsContainer);
        
        // Estilos principales de la barra
        this.toolbarElement.style.cssText = `
            position: fixed;
            background: linear-gradient(135deg, var(--parchment-dark), var(--parchment-light));
            border: 2px solid var(--accent-gold);
            border-radius: 12px;
            z-index: 10000;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            backdrop-filter: blur(8px);
            min-width: 320px;
            transition: box-shadow 0.2s ease;
        `;
        
        // Configurar arrastre
        this.setupDragEvents(toolbarHeader);
        
        document.body.appendChild(this.toolbarElement);
    }

    setupDragEvents(dragHandle) {
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        
        const onMouseMove = (e) => {
            if (!isDragging) return;
            
            e.preventDefault();
            
            let newLeft = initialLeft + (e.clientX - startX);
            let newTop = initialTop + (e.clientY - startY);
            
            // Limitar dentro de la ventana
            const maxX = window.innerWidth - this.toolbarElement.offsetWidth;
            const maxY = window.innerHeight - this.toolbarElement.offsetHeight;
            
            newLeft = Math.max(5, Math.min(maxX - 5, newLeft));
            newTop = Math.max(5, Math.min(maxY - 5, newTop));
            
            this.toolbarElement.style.left = `${newLeft}px`;
            this.toolbarElement.style.top = `${newTop}px`;
            
            // Guardar posición si está fijada
            if (this.isPinned) {
                this.saveToolbarPosition(newLeft, newTop);
            }
        };
        
        const onMouseUp = () => {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            
            // Guardar posición final
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
            if (e.target.closest('.toolbar-pin-btn') || 
                e.target.closest('.toolbar-minimize-btn') || 
                e.target.closest('.toolbar-close-btn')) {
                return;
            }
            
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
            pinBtn.title = this.isPinned ? 'Desfijar barra (dejar de seguir al editor)' : 'Fijar barra (mantener en posición actual)';
            pinBtn.style.color = this.isPinned ? 'var(--accent-gold)' : 'rgba(255,255,255,0.7)';
        }
        
        if (this.isPinned) {
            // Guardar posición actual
            const left = this.toolbarElement.style.left;
            const top = this.toolbarElement.style.top;
            if (left && top) {
                this.saveToolbarPosition(parseInt(left), parseInt(top));
            }
        } else {
            // Al desfijar, mover cerca del editor activo
            if (this.activeEditor) {
                this.showToolbar(this.activeEditor.editor);
            }
        }
        
        console.log(`Barra de herramientas ${this.isPinned ? 'fijada' : 'desfijada'}`);
    }

    toggleMinimize() {
        const buttonsContainer = this.toolbarElement?.querySelector('.toolbar-buttons');
        const minimizeBtn = this.toolbarElement?.querySelector('.toolbar-minimize-btn');
        
        if (!buttonsContainer) return;
        
        const isMinimized = buttonsContainer.style.display === 'none';
        
        if (isMinimized) {
            buttonsContainer.style.display = 'flex';
            minimizeBtn.innerHTML = '<i class="fas fa-minus"></i>';
            minimizeBtn.title = 'Minimizar barra';
            this.toolbarElement.style.minWidth = '320px';
        } else {
            buttonsContainer.style.display = 'none';
            minimizeBtn.innerHTML = '<i class="fas fa-plus"></i>';
            minimizeBtn.title = 'Expandir barra';
            this.toolbarElement.style.minWidth = 'auto';
            this.toolbarElement.style.width = 'auto';
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
        
        // Si está fijada y tiene posición guardada, usarla
        if (this.isPinned && this.toolbarPosition) {
            this.toolbarElement.style.left = `${this.toolbarPosition.left}px`;
            this.toolbarElement.style.top = `${this.toolbarPosition.top}px`;
            this.toolbarElement.style.display = 'block';
            this.toolbarVisible = true;
            return;
        }
        
        // Posicionar cerca del editor
        const rect = editor.getBoundingClientRect();
        const toolbarHeight = this.toolbarElement.offsetHeight;
        
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

    formatDocument(command) {
        if (!this.activeEditor) return;
        
        this.activeEditor.editor.focus();
        document.execCommand(command, false, null);
        
        this.activeEditor.textarea.value = this.activeEditor.editor.innerHTML;
        const changeEvent = new Event('change', { bubbles: true });
        this.activeEditor.textarea.dispatchEvent(changeEvent);
    }

    applyCustomFormat(command, level = '1') {
        if (!this.activeEditor) return;
        
        const editor = this.activeEditor.editor;
        const selection = window.getSelection();
        
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        
        if (command === 'h1' || command === 'h2' || command === 'h3') {
            let tagName = command.toUpperCase();
            
            if (!range.collapsed) {
                const selectedContent = range.extractContents();
                const wrapper = document.createElement(tagName);
                wrapper.appendChild(selectedContent);
                range.insertNode(wrapper);
                
                if (tagName === 'H1') {
                    wrapper.style.cssText = `
                        font-size: 1.8rem;
                        font-weight: bold;
                        color: var(--accent-purple);
                        margin: 15px 0 10px;
                        font-family: 'Cinzel', serif;
                        border-left: 4px solid var(--accent-gold);
                        padding-left: 12px;
                    `;
                } else if (tagName === 'H2') {
                    wrapper.style.cssText = `
                        font-size: 1.4rem;
                        font-weight: bold;
                        color: var(--accent-blue);
                        margin: 12px 0 8px;
                        font-family: 'Cinzel', serif;
                    `;
                } else if (tagName === 'H3') {
                    wrapper.style.cssText = `
                        font-size: 1.1rem;
                        font-weight: bold;
                        color: var(--accent-teal);
                        margin: 10px 0 6px;
                        font-style: italic;
                    `;
                }
                
                range.setStartAfter(wrapper);
                range.setEndAfter(wrapper);
                selection.removeAllRanges();
                selection.addRange(range);
            } else {
                const wrapper = document.createElement(tagName);
                wrapper.textContent = `Título ${level}`;
                wrapper.style.cssText = tagName === 'H1' 
                    ? `font-size: 1.8rem; font-weight: bold; color: var(--accent-purple); margin: 15px 0 10px; font-family: 'Cinzel', serif; border-left: 4px solid var(--accent-gold); padding-left: 12px;`
                    : tagName === 'H2'
                    ? `font-size: 1.4rem; font-weight: bold; color: var(--accent-blue); margin: 12px 0 8px; font-family: 'Cinzel', serif;`
                    : `font-size: 1.1rem; font-weight: bold; color: var(--accent-teal); margin: 10px 0 6px; font-style: italic;`;
                
                range.insertNode(wrapper);
                
                const textNode = wrapper.firstChild;
                const newRange = document.createRange();
                newRange.setStart(textNode, 0);
                newRange.setEnd(textNode, textNode.length);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        }
        
        this.activeEditor.textarea.value = editor.innerHTML;
        const changeEvent = new Event('change', { bubbles: true });
        this.activeEditor.textarea.dispatchEvent(changeEvent);
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
                        <li><strong><i class="fas fa-thumbtack"></i></strong> - Fijar/Desfijar barra en posición</li>
                        <li><strong><i class="fas fa-minus"></i>/<i class="fas fa-plus"></i></strong> - Minimizar/Expandir barra</li>
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
                    <h4>Formato con Markdown:</h4>
                    <ul style="list-style: none; padding: 0;">
                        <li><strong>**texto**</strong> - Negrita</li>
                        <li><strong>*texto*</strong> - Cursiva</li>
                        <li><strong># Título</strong> - Título principal</li>
                        <li><strong>## Subtítulo</strong> - Subtítulo</li>
                        <li><strong>### Sub-subtítulo</strong> - Sub-subtítulo</li>
                    </ul>
                    <p style="margin-top: 15px; font-size: 0.8rem; color: var(--ink-light);">
                        <i class="fas fa-info-circle"></i> La barra recuerda su posición cuando está fijada.
                    </p>
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
        document.addEventListener('keydown', (e) => {
            if (!this.activeEditor) return;
            
            if ((e.ctrlKey || e.metaKey)) {
                switch(e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.formatDocument('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.formatDocument('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.formatDocument('underline');
                        break;
                }
            }
        });
        
        document.addEventListener('click', (e) => {
            if (this.toolbarElement && this.activeEditor && !this.isPinned) {
                if (!this.toolbarElement.contains(e.target) && 
                    !this.activeEditor.editor.contains(e.target)) {
                    this.hideToolbar();
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
        
        html = html.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
        
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
        html = html.replace(/^\s*[\-\*]\s+(.*$)/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        html = html.replace(/\n/g, '<br>');
        
        return html;
    }
}