class MapaDND {
    constructor() {
        this.currentColor = '#f5e6d3';
        this.ancho = 5;
        this.alto = 5;
        this.init();
    }

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.cargarEstadoInicial();
    }

    cacheDOM() {
        this.grid = document.getElementById('mapa-grid');
        this.widthInput = document.getElementById('map-width');
        this.heightInput = document.getElementById('map-height');
        this.generateBtn = document.getElementById('generate-map');
        this.resetBtn = document.getElementById('reset-map');
        this.clearBtn = document.getElementById('clear-map');
        this.colorBtns = document.querySelectorAll('.color-btn');
        this.exportBtn = document.getElementById('export-map');
        this.notesTextarea = document.getElementById('map-notes');
        this.lastEditedSpan = document.getElementById('last-edited');
        this.wordsCountSpan = document.getElementById('words-count');
        this.inventoryContainer = document.getElementById('token-inventory-container');
        this.loadingOverlay = document.getElementById('loading-overlay');
        // Nuevo: elemento para la advertencia de dimensiones
        this.dimensionWarning = document.getElementById('dimension-warning');
    }

    bindEvents() {
        this.generateBtn?.addEventListener('click', () => this.generarMapa());
        this.resetBtn?.addEventListener('click', () => this.resetMapa());
        this.clearBtn?.addEventListener('click', () => this.limpiarColores());
        
        this.colorBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.colorBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentColor = window.getComputedStyle(btn).backgroundColor;
            });
        });

        [this.widthInput, this.heightInput].forEach(input => {
            input?.addEventListener('change', () => {
                this.validarInputs();
                this.actualizarAdvertenciaDimensiones();
            });
            input?.addEventListener('input', () => this.actualizarAdvertenciaDimensiones());
        });

        this.exportBtn?.addEventListener('click', () => this.exportarMapa());
        
        this.notesTextarea?.addEventListener('input', () => {
            this.guardarNotas();
            this.actualizarMetadataNotas();
        });

        document.addEventListener('dragover', (e) => e.preventDefault());
        document.addEventListener('drop', (e) => e.preventDefault());
    }

    // ===== NUEVA: ADVERTENCIA DE DIMENSIONES =====
    actualizarAdvertenciaDimensiones() {
        if (!this.dimensionWarning) {
            // Crear el elemento de advertencia si no existe
            this.dimensionWarning = document.createElement('div');
            this.dimensionWarning.id = 'dimension-warning';
            this.dimensionWarning.style.marginTop = '10px';
            this.dimensionWarning.style.padding = '8px 15px';
            this.dimensionWarning.style.borderRadius = '5px';
            this.dimensionWarning.style.fontSize = '0.9rem';
            this.dimensionWarning.style.fontWeight = 'bold';
            this.dimensionWarning.style.display = 'none';
            
            // Insertarlo después de los inputs
            const controlGroup = this.widthInput?.closest('.control-group')?.parentNode;
            if (controlGroup) {
                controlGroup.appendChild(this.dimensionWarning);
            }
        }

        const ancho = parseInt(this.widthInput?.value) || 5;
        const alto = parseInt(this.heightInput?.value) || 5;
        
        // Calcular total de celdas
        const totalCeldas = ancho * alto;
        
        if (ancho > 20 || alto > 20) {
            this.dimensionWarning.style.display = 'block';
            this.dimensionWarning.style.background = '#ffcccb';
            this.dimensionWarning.style.color = '#8b0000';
            this.dimensionWarning.style.border = '2px solid #8b0000';
            this.dimensionWarning.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ¡Máximo 20x20! (400 celdas)';
        } 
        else if (totalCeldas > 300) {
            this.dimensionWarning.style.display = 'block';
            this.dimensionWarning.style.background = '#fff3cd';
            this.dimensionWarning.style.color = '#856404';
            this.dimensionWarning.style.border = '2px solid #ffc107';
            this.dimensionWarning.innerHTML = '<i class="fas fa-info-circle"></i> Mapa grande (' + totalCeldas + ' celdas). Puede afectar el rendimiento.';
        }
        else {
            this.dimensionWarning.style.display = 'none';
        }
    }

    // ===== INDICADOR DE CARGA =====
    mostrarCargando() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'flex';
        }
    }

    ocultarCargando() {
        if (this.loadingOverlay) {
            this.loadingOverlay.style.display = 'none';
        }
    }

    // ===== CARGA / GUARDADO =====
    cargarEstadoInicial() {
        const savedState = localStorage.getItem('dnd_mapa_actual_opt');
        if (savedState) {
            try {
                const estado = JSON.parse(savedState);
                this.ancho = estado.ancho || 5;
                this.alto = estado.alto || 5;
                this.widthInput.value = this.ancho;
                this.heightInput.value = this.alto;
                
                if (this.notesTextarea && estado.notas) {
                    this.notesTextarea.value = estado.notas;
                    this.actualizarMetadataNotas();
                }
                
                this.generarMapa(this.ancho, this.alto, false);

                if (estado.celdas) {
                    estado.celdas.forEach(cellData => {
                        const cell = document.querySelector(`[data-fila="${cellData.fila}"][data-columna="${cellData.columna}"]`);
                        if (cell) {
                            if (cellData.color && cellData.color !== '#f5e6d3' && cellData.color !== 'rgb(245, 230, 211)') {
                                cell.style.backgroundColor = cellData.color;
                                cell.classList.add('painted');
                            }
                            if (cellData.tokens && cellData.tokens.length > 0) {
                                const tokenContainer = cell.querySelector('.cell-token-container');
                                if (tokenContainer) {
                                    cellData.tokens.forEach(tokenData => {
                                        this._crearElementoToken(
                                            tokenData.tipo, 
                                            tokenData.valor, 
                                            tokenContainer,
                                            tokenData.nombre || '',
                                            tokenData.vida || '',
                                            tokenData.ca || ''
                                        );
                                    });
                                }
                            }
                        }
                    });
                }

            } catch (e) {
                console.error('Error cargando mapa guardado:', e);
                this.generarMapaPorDefecto();
            }
        } else {
            this.generarMapaPorDefecto();
        }
        this.crearInventarioFichas();
        this.actualizarContadores();
        this.actualizarAdvertenciaDimensiones();
    }

    guardarEstado() {
        const estado = {
            ancho: this.ancho,
            alto: this.alto,
            notas: this.notesTextarea?.value || '',
            ultimaEdicion: new Date().toISOString(),
            celdas: []
        };
        
        const cells = document.querySelectorAll('.mapa-cell');
        cells.forEach(cell => {
            const fila = cell.dataset.fila;
            const columna = cell.dataset.columna;
            const tokenContainer = cell.querySelector('.cell-token-container');
            
            const cellData = {
                fila: parseInt(fila),
                columna: parseInt(columna),
                color: cell.style.backgroundColor || '#f5e6d3',
                painted: cell.classList.contains('painted'),
                tokens: []
            };
            
            if (tokenContainer) {
                tokenContainer.querySelectorAll('.token').forEach(token => {
                    cellData.tokens.push({
                        tipo: token.dataset.tokenType || this._getTokenClassFromText(token.textContent),
                        valor: token.textContent,
                        nombre: token.dataset.nombre || '',
                        vida: token.dataset.vida || '',
                        ca: token.dataset.ca || ''
                    });
                });
            }
            
            estado.celdas.push(cellData);
        });
        
        localStorage.setItem('dnd_mapa_actual_opt', JSON.stringify(estado));
    }

    guardarNotas() {
        const estado = JSON.parse(localStorage.getItem('dnd_mapa_actual_opt') || '{}');
        estado.notas = this.notesTextarea?.value || '';
        estado.ultimaEdicion = new Date().toISOString();
        localStorage.setItem('dnd_mapa_actual_opt', JSON.stringify(estado));
        this.actualizarMetadataNotas();
    }

    // ===== GENERACIÓN DEL MAPA =====
    generarMapaPorDefecto() {
        this.generarMapa(5, 5);
    }

    async generarMapa(ancho = null, alto = null, guardarEstado = true) {
        this.mostrarCargando();
        
        await new Promise(resolve => setTimeout(resolve, 100));

        this.ancho = ancho || parseInt(this.widthInput?.value) || 5;
        this.alto = alto || parseInt(this.heightInput?.value) || 5;
        
        this.validarInputs();
        this.actualizarAdvertenciaDimensiones();
        
        if (this.grid) {
            this.grid.innerHTML = '';
            this.grid.style.gridTemplateColumns = `repeat(${this.ancho}, 1fr)`;
            
            for (let i = 0; i < this.ancho * this.alto; i++) {
                const fila = Math.floor(i / this.ancho);
                const columna = i % this.ancho;
                const cell = this._crearCelda(fila, columna);
                this.grid.appendChild(cell);
            }
            
            this.actualizarContadores();
            if (guardarEstado) {
                this.guardarEstado();
            }
        }

        this.ocultarCargando();
    }

    _crearCelda(fila, columna) {
        const cell = document.createElement('div');
        cell.className = 'mapa-cell';
        cell.dataset.fila = fila;
        cell.dataset.columna = columna;
        cell.dataset.id = `cell-${fila}-${columna}`;
        
        const tokenContainer = document.createElement('div');
        tokenContainer.className = 'cell-token-container';
        
        const controls = document.createElement('div');
        controls.className = 'cell-controls';
        
        const clearBtn = document.createElement('button');
        clearBtn.className = 'cell-control-btn';
        clearBtn.innerHTML = '<i class="fas fa-eraser"></i>';
        clearBtn.title = 'Limpiar celda';
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._limpiarCelda(fila, columna);
        });
        
        const colorBtn = document.createElement('button');
        colorBtn.className = 'cell-control-btn';
        colorBtn.innerHTML = '<i class="fas fa-palette"></i>';
        colorBtn.title = 'Cambiar color';
        colorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._cambiarColorCelda(fila, columna);
        });
        
        controls.appendChild(clearBtn);
        controls.appendChild(colorBtn);
        
        cell.appendChild(tokenContainer);
        cell.appendChild(controls);
        
        cell.addEventListener('click', (e) => {
            if (e.target === cell || e.target.classList.contains('mapa-cell')) {
                this._pintarCelda(cell);
            }
        });

        cell.addEventListener('dragover', (e) => e.preventDefault());
        cell.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this._manejarDropEnCelda(e, fila, columna);
        });
        
        return cell;
    }

    _pintarCelda(cell) {
        if (cell && this.currentColor) {
            cell.style.backgroundColor = this.currentColor;
            cell.classList.add('painted');
            this.guardarEstado();
        }
    }

    _limpiarCelda(fila, columna) {
        const cell = document.querySelector(`[data-fila="${fila}"][data-columna="${columna}"]`);
        if (cell) {
            cell.style.backgroundColor = '#f5e6d3';
            cell.classList.remove('painted');
            
            const tokenContainer = cell.querySelector('.cell-token-container');
            if (tokenContainer) {
                tokenContainer.innerHTML = '';
            }
            
            this.actualizarContadores();
            this.guardarEstado();
        }
    }

    _cambiarColorCelda(fila, columna) {
        const cell = document.querySelector(`[data-fila="${fila}"][data-columna="${columna}"]`);
        if (cell) {
            const colorPicker = document.createElement('input');
            colorPicker.type = 'color';
            colorPicker.value = this._rgbToHex(cell.style.backgroundColor) || '#f5e6d3';
            colorPicker.addEventListener('change', () => {
                cell.style.backgroundColor = colorPicker.value;
                cell.classList.add('painted');
                this.guardarEstado();
            });
            colorPicker.click();
        }
    }

    // ===== INVENTARIO DE FICHAS =====
    crearInventarioFichas() {
        if (!this.inventoryContainer) return;
        this.inventoryContainer.innerHTML = '';

        const tiposFicha = [
            { tipo: 'player', label: 'Jugador', valor: 'P' },
            { tipo: 'enemy', label: 'Enemigo', valor: 'E' },
            { tipo: 'npc', label: 'NPC', valor: 'N' },
            { tipo: 'boss', label: 'Jefe', valor: 'B' },
            { tipo: 'neutral', label: 'Neutral', valor: '?' }
        ];

        tiposFicha.forEach(tipo => {
            const itemDiv = document.createElement('div');
            itemDiv.className = 'inventory-item';
            
            const labelSpan = document.createElement('span');
            labelSpan.className = 'inventory-label';
            labelSpan.textContent = tipo.label;
            
            const token = document.createElement('div');
            token.className = `token ${tipo.tipo} inventory-token`;
            token.textContent = tipo.valor;
            token.draggable = true;
            token.dataset.tokenType = tipo.tipo;
            token.dataset.tokenValue = tipo.valor;
            
            token.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    tipo: 'token',
                    tokenType: tipo.tipo,
                    tokenValue: tipo.valor,
                    fromInventory: true
                }));
            });
            
            itemDiv.appendChild(labelSpan);
            itemDiv.appendChild(token);
            this.inventoryContainer.appendChild(itemDiv);
        });
    }

    // ===== MANEJO DE TOKENS (CORREGIDO) =====
    _crearElementoToken(tipo, valorInicial, contenedor, nombre = '', vida = '', ca = '') {
        const token = document.createElement('div');
        token.className = `token ${tipo}`;
        
        // Determinar la inicial a mostrar
        let inicial = valorInicial;
        if (nombre && nombre.trim() !== '') {
            inicial = nombre.trim().charAt(0).toUpperCase();
        }
        token.textContent = inicial;
        
        token.draggable = true;
        token.dataset.tokenType = tipo;
        token.dataset.tokenValue = valorInicial;
        token.dataset.nombre = nombre;
        token.dataset.vida = vida;
        token.dataset.ca = ca;
        
        // Añadir botón de menú (3 puntos)
        const menuBtn = document.createElement('span');
        menuBtn.className = 'token-menu-btn';
        menuBtn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            this._abrirPopupEdicionToken(token);
        });
        token.appendChild(menuBtn);
        
        token.addEventListener('dragstart', (e) => {
            const celdaPadre = e.target.closest('.mapa-cell');
            if (celdaPadre) {
                const fila = celdaPadre.dataset.fila;
                const columna = celdaPadre.dataset.columna;
                // Incluir todos los datos personalizados en la transferencia
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    tipo: 'token',
                    tokenType: tipo,
                    tokenValue: token.textContent, // Usar el texto actual (que puede ser la inicial del nombre)
                    origenFila: parseInt(fila),
                    origenColumna: parseInt(columna),
                    // ¡NUEVO! Incluir los datos personalizados
                    nombre: token.dataset.nombre || '',
                    vida: token.dataset.vida || '',
                    ca: token.dataset.ca || ''
                }));
            }
        });
        
        contenedor.appendChild(token);
        return token;
    }

    _abrirPopupEdicionToken(token) {
        // Crear overlay
        const overlay = document.createElement('div');
        overlay.className = 'popup-overlay';
        overlay.id = 'token-popup-overlay';
        
        // Crear popup
        const popup = document.createElement('div');
        popup.className = 'token-popup';
        popup.id = 'token-popup';
        
        const tipoToken = token.dataset.tokenType;
        const tipoTexto = {
            'player': 'Jugador',
            'enemy': 'Enemigo',
            'npc': 'NPC',
            'boss': 'Jefe',
            'neutral': 'Neutral'
        }[tipoToken] || 'Ficha';
        
        popup.innerHTML = `
            <h3><i class="fas fa-chess-piece"></i> Editar ${tipoTexto}</h3>
            <div class="popup-field">
                <label>Nombre:</label>
                <input type="text" id="popup-nombre" value="${token.dataset.nombre || ''}" placeholder="...">
            </div>
            <div class="popup-field">
                <label>Vida (PG):</label>
                <input type="text" id="popup-vida" value="${token.dataset.vida || ''}" placeholder="...">
            </div>
            <div class="popup-field">
                <label>Clase de Armadura (CA):</label>
                <input type="text" id="popup-ca" value="${token.dataset.ca || ''}" placeholder="..">
            </div>
            <div class="popup-buttons">
                <button class="popup-btn cancel" id="popup-cancel">Cancelar</button>
                <button class="popup-btn save" id="popup-save">Guardar</button>
            </div>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(popup);
        
        // Eventos
        const cancelar = () => {
            overlay.remove();
            popup.remove();
        };
        
        document.getElementById('popup-cancel').addEventListener('click', cancelar);
        
        document.getElementById('popup-save').addEventListener('click', () => {
            const nombre = document.getElementById('popup-nombre').value.trim();
            const vida = document.getElementById('popup-vida').value.trim();
            const ca = document.getElementById('popup-ca').value.trim();
            
            // ACTUALIZAR EL TOKEN EXISTENTE (NO CREAR UNO NUEVO)
            token.dataset.nombre = nombre;
            token.dataset.vida = vida;
            token.dataset.ca = ca;
            
            // Actualizar el texto del token
            if (nombre) {
                token.textContent = nombre.charAt(0).toUpperCase();
            } else {
                // Si no hay nombre, usar el valor por defecto del tipo
                const valorDefault = {
                    'player': 'P',
                    'enemy': 'E',
                    'npc': 'N',
                    'boss': 'B',
                    'neutral': '?'
                }[tipoToken] || '?';
                token.textContent = valorDefault;
            }
            
            // RE-ADJUNTAR EL BOTÓN DE MENÚ (porque al cambiar textContent se pierde)
            // Pero como NO estamos reemplazando el token, podemos verificar si ya tiene el botón
            let menuBtn = token.querySelector('.token-menu-btn');
            if (!menuBtn) {
                menuBtn = document.createElement('span');
                menuBtn.className = 'token-menu-btn';
                menuBtn.innerHTML = '<i class="fas fa-ellipsis-v"></i>';
                menuBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    this._abrirPopupEdicionToken(token);
                });
                token.appendChild(menuBtn);
            }
            
            this.guardarEstado();
            cancelar();
        });
        
        overlay.addEventListener('click', cancelar);
    }

    _manejarDropEnCelda(e, filaDestino, columnaDestino) {
        try {
            const data = JSON.parse(e.dataTransfer.getData('text/plain'));
            
            if (data.tipo === 'token') {
                const cell = document.querySelector(`[data-fila="${filaDestino}"][data-columna="${columnaDestino}"]`);
                if (!cell) return;

                const tokenContainer = cell.querySelector('.cell-token-container');
                if (!tokenContainer) return;

                if (tokenContainer.children.length >= 3) {
                    alert('¡Máximo 3 fichas por casilla!');
                    return;
                }

                if (data.fromInventory) {
                    // Crear nueva ficha desde inventario
                    this._crearElementoToken(data.tokenType, data.tokenValue, tokenContainer);
                } 
                else if (data.origenFila !== undefined && data.origenColumna !== undefined) {
                    const celdaOrigen = document.querySelector(`[data-fila="${data.origenFila}"][data-columna="${data.origenColumna}"]`);
                    if (celdaOrigen) {
                        const tokenOrigenContainer = celdaOrigen.querySelector('.cell-token-container');
                        const tokensOrigen = tokenOrigenContainer.querySelectorAll('.token');
                        
                        for (let token of tokensOrigen) {
                            // Comparar por tipo y texto (inicial)
                            if (token.classList.contains(data.tokenType) && token.textContent === data.tokenValue) {
                                // Guardar datos antes de eliminar
                                const nombre = data.nombre || token.dataset.nombre || '';
                                const vida = data.vida || token.dataset.vida || '';
                                const ca = data.ca || token.dataset.ca || '';
                                
                                token.remove();
                                
                                // Crear nuevo token con los mismos datos personalizados
                                this._crearElementoToken(data.tokenType, data.tokenValue, tokenContainer, nombre, vida, ca);
                                break;
                            }
                        }
                    }
                }
                this.actualizarContadores();
                this.guardarEstado();
            }
        } catch (error) {
            console.error('Error en drop:', error);
        }
    }

    // ===== UTILIDADES =====
    limpiarColores() {
        const cells = document.querySelectorAll('.mapa-cell');
        cells.forEach(cell => {
            cell.style.backgroundColor = '#f5e6d3';
            cell.classList.remove('painted');
        });
        this.guardarEstado();
    }

    resetMapa() {
        if (confirm('¿Estás seguro de que quieres resetear el mapa? Se perderán todos los cambios.')) {
            this.limpiarColores();
            
            const cells = document.querySelectorAll('.mapa-cell .cell-token-container');
            cells.forEach(container => {
                container.innerHTML = '';
            });
            
            if (this.notesTextarea) {
                this.notesTextarea.value = '';
                this.actualizarMetadataNotas();
            }
            
            this.actualizarContadores();
            this.guardarEstado();
        }
    }

    validarInputs() {
        if (this.widthInput) {
            let val = parseInt(this.widthInput.value);
            if (isNaN(val) || val < 1) this.widthInput.value = 1;
            if (val > 20) this.widthInput.value = 20;
            this.ancho = parseInt(this.widthInput.value);
        }
        if (this.heightInput) {
            let val = parseInt(this.heightInput.value);
            if (isNaN(val) || val < 1) this.heightInput.value = 1;
            if (val > 20) this.heightInput.value = 20;
            this.alto = parseInt(this.heightInput.value);
        }
    }

    actualizarMetadataNotas() {
        if (this.notesTextarea) {
            if (this.wordsCountSpan) {
                const texto = this.notesTextarea.value.trim();
                const palabras = texto ? texto.split(/\s+/).length : 0;
                this.wordsCountSpan.textContent = `${palabras} palabras`;
            }
            if (this.lastEditedSpan) {
                const ahora = new Date();
                const horas = ahora.getHours().toString().padStart(2, '0');
                const minutos = ahora.getMinutes().toString().padStart(2, '0');
                this.lastEditedSpan.textContent = `${horas}:${minutos}`;
            }
        }
    }

        actualizarContadores() {
            let jugadores = 0;
            let enemigos = 0;
            let npcYNeutral = 0; // Nuevo contador para NPC + Neutral
            
            const tokens = document.querySelectorAll('.mapa-cell .token');
            tokens.forEach(token => {
                if (token.classList.contains('player')) {
                    jugadores++;
                } else if (token.classList.contains('enemy') || token.classList.contains('boss')) {
                    enemigos++;
                } else if (token.classList.contains('npc') || token.classList.contains('neutral')) {
                    npcYNeutral++; // Contar NPCs y Neutrales
                }
            });
            
            const playerCount = document.getElementById('player-count');
            const enemyCount = document.getElementById('enemy-count');
            const notesCount = document.getElementById('notes-count');
            
            if (playerCount) playerCount.textContent = jugadores;
            if (enemyCount) enemyCount.textContent = enemigos;
            if (notesCount) {
                // AHORA MUESTRA LA SUMA DE NPC + NEUTRAL
                notesCount.textContent = npcYNeutral;
            }
        }

    exportarMapa() {
        const estado = JSON.parse(localStorage.getItem('dnd_mapa_actual_opt') || '{}');
        estado.nombre = `Mapa D&D ${this.ancho}x${this.alto}`;
        estado.fechaExportacion = new Date().toLocaleString();
        
        const dataStr = JSON.stringify(estado, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = `mapa-dnd-${this.ancho}x${this.alto}-${new Date().getTime()}.json`;
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    }

    _getTokenClassFromText(texto) {
        const tipo = texto.toLowerCase();
        if (tipo.includes('p')) return 'player';
        if (tipo.includes('e')) return 'enemy';
        if (tipo.includes('b')) return 'boss';
        if (tipo.includes('n')) return 'npc';
        return 'neutral';
    }

    _rgbToHex(rgb) {
        if (!rgb || rgb === 'transparent' || rgb === '') return '#f5e6d3';
        if (rgb.startsWith('#')) return rgb;
        
        const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
        if (!match) return '#f5e6d3';
        
        return '#' + ((1 << 24) + (parseInt(match[1]) << 16) + (parseInt(match[2]) << 8) + parseInt(match[3])).toString(16).slice(1);
    }
}

// Inicializar
document.addEventListener('DOMContentLoaded', () => {
    window.mapaDND = new MapaDND();
});