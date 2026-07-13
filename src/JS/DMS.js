class DMScreen {
    constructor() {
        this.players = [];
        this.enemies = [];
        this.initiativeOrder = [];
        this.currentTurn = 0;
        this.currentRound = 1;
        this.combatMode = false;
        
        // Para actualización en tiempo real del modal
        this.modalAbierto = null;
        this.intervaloActualizacionModal = null;
        this.ultimaVersionPersonaje = null;
        
        this.notes = {
            session: '',
            plot: '',
            npcs: '',
            locations: ''
        };

        this.jugadoresData = [];
        this.jugadoresDenominaciones = [];
        this.personajesHoy = [];
        
        // PDF viewers
        this.pdfData = {
            manual: null,
            bestiary: null,
            campaign: null
        };
        
        this.pdfPages = {
            manual: { current: 1, total: 1 },
            bestiary: { current: 1, total: 1 },
            campaign: { current: 1, total: 1 }
        };
        
        this.zoomLevels = {
            manual: 100,
            bestiary: 100,
            campaign: 100
        };
        
        this.timerInterval = null;
        this.timerSeconds = 0;

        this.enemyCustomSheets = {};
        
        // Propiedades para el bestiario - MODIFICADO
        this.bestiarioOriginal = null;      // Referencia original, nunca se modifica
        this.bestiarioPersonalizado = null; // Bestiario cargado por el usuario
        this.bestiarioActual = null;        // Fuente activa actual
        this.fuenteBestiarioActual = 'original'; // 'original' o 'personalizado'
        this.bestiaryDenominaciones = [];
        this.currentBestiaryEntry = null;

        this.baseUrl = (typeof CONFIG !== 'undefined' && CONFIG.SERVER_URL) 
            ? CONFIG.SERVER_URL 
            : 'http://localhost:3000';
        
        this.apiEndpoints = (typeof CONFIG !== 'undefined' && CONFIG.API)
            ? CONFIG.API
            : { BESTIARIO: '/api/json/bestiario' };
        
        this.init();
    }
    
    init() {
        this.loadSession();
        this.loadBestiarioOriginal();
        this.cargarPersonajesHoy();
        this.loadCustomSheetsFromStorage(); 
        this.setupEventListeners();
        this.setupPDFJS();
        this.setupRichTextEditor();
        this.setupDrawingCanvas();
        this.updateUI();
        this.updateTime();
        
        setInterval(() => this.updateTime(), 60000);
        setInterval(() => {this.actualizarPersonajesPeriodicamente();}, 3000); 
        this.setupWebSocketHandlers();   
        console.log('DM Screen inicializada');
    }

    setupWebSocketHandlers() {
        if (window.wsClient) {
            window.wsClient.on('personaje-actualizado', (data) => {
                console.log('📥 Personaje actualizado vía WebSocket:', data);
                this.manejarActualizacionPersonaje(data.personaje);
            });
            
            window.wsClient.on('personaje-guardado', (data) => {
                console.log('💾 Personaje guardado vía WebSocket:', data);
                this.cargarPersonajesHoy();
            });
            
            window.wsClient.on('connect', () => {
                console.log('🔄 WebSocket reconectado, sincronizando...');
                this.cargarPersonajesHoy();
            });
        }
    }

    manejarActualizacionPersonaje(personajeActualizado) {
        if (!personajeActualizado || !personajeActualizado.nombre) return;
        
        const index = this.personajesHoy.findIndex(p => 
            p.nombre === personajeActualizado.nombre || p.id === personajeActualizado.id
        );
        
        if (index !== -1) {
            this.personajesHoy[index] = {
                ...this.personajesHoy[index],
                ...personajeActualizado,
                trasfondo: personajeActualizado.trasfondo || this.personajesHoy[index].trasfondo,
                alineamiento: personajeActualizado.alineamiento || this.personajesHoy[index].alineamiento,
                stats: personajeActualizado.stats || this.personajesHoy[index].stats,
                spellSlots: personajeActualizado.spellSlots || this.personajesHoy[index].spellSlots,
                spellStats: personajeActualizado.spellStats || this.personajesHoy[index].spellStats,
                savingThrows: personajeActualizado.savingThrows || this.personajesHoy[index].savingThrows,
                passivePerception: personajeActualizado.passivePerception || this.personajesHoy[index].passivePerception,
                deathSaves: personajeActualizado.deathSaves || this.personajesHoy[index].deathSaves,
                inventario: personajeActualizado.inventario || this.personajesHoy[index].inventario, 
                ataques: personajeActualizado.ataques || this.personajesHoy[index].ataques,          
                conjuros: personajeActualizado.conjuros || this.personajesHoy[index].conjuros,        
                notas: personajeActualizado.notas || this.personajesHoy[index].notas              
            };
        } else {
            this.personajesHoy.push(personajeActualizado);
        }
        
        this.jugadoresDenominaciones = this.personajesHoy.map(pj => ({
            text: pj.nombre,
            value: pj.nombre,
            jugador: pj.jugador,
            clase: pj.clase,
            nivel: pj.nivel,
            raza: pj.raza,
            trasfondo: pj.trasfondo,
            alineamiento: pj.alineamiento,
            stats: pj.stats,
            spellSlots: pj.spellSlots,
            spellStats: pj.spellStats,
            ataques: pj.ataques,
            conjuros: pj.conjuros,
            inventario: pj.inventario,
            notas: pj.notas,    
            imagen: pj.imagen,
            colores_personalizados: pj.colores_personalizados,
            savingThrows: pj.savingThrows,
            passivePerception: pj.passivePerception,
            deathSaves: pj.deathSaves  
        }));
        
        if (this.modalAbierto && (this.modalAbierto.nombre === personajeActualizado.nombre)) {
            console.log(`🔄 Actualizando modal para ${personajeActualizado.nombre} por WebSocket`);
            this.modalAbierto = personajeActualizado;
            this.actualizarModalConDatos(personajeActualizado);
        }
        
        this.actualizarJugadoresEnListas();
    }

    actualizarJugadoresEnListas() {
        this.players.forEach(player => {
            const personaje = this.personajesHoy.find(p => p.nombre === player.name);
            if (personaje) {
                if (personaje.stats?.ca) player.ca = personaje.stats.ca;
                if (personaje.stats?.hp?.max) {
                    player.maxHp = personaje.stats.hp.max;
                    player.hp = Math.min(player.hp, player.maxHp);
                }
            }
        });
        
        this.updatePlayersList();
        this.updateInitiativeOrder();
    }
    
    async cargarPersonajesHoy() {
        try {
            const url = `${this.baseUrl}/api/personajes/hoy`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Error al cargar personajes');
            }
            
            const data = await response.json();
            this.personajesHoy = data.personajes || [];
            
            this.jugadoresDenominaciones = this.personajesHoy.map(pj => ({
                text: pj.nombre,
                value: pj.nombre,
                jugador: pj.jugador,
                clase: pj.clase,
                nivel: pj.nivel,
                raza: pj.raza,
                trasfondo: pj.trasfondo,
                alineamiento: pj.alineamiento,
                stats: pj.stats,
                spellSlots: pj.spellSlots,
                spellStats: pj.spellStats,
                ataques: pj.ataques,
                conjuros: pj.conjuros,
                inventario: pj.inventario,    
                notas: pj.notas,              
                imagen: pj.imagen,
                colores_personalizados: pj.colores_personalizados,
                savingThrows: pj.savingThrows,
                passivePerception: pj.passivePerception,
                deathSaves: pj.deathSaves
            }));
            
        } catch (error) {
            console.warn('Error cargando personajes:', error);
            this.personajesHoy = [];
            this.jugadoresDenominaciones = [];
        }
    }

    setupJugadoresAutocomplete() {
        const playerNameInput = document.getElementById('playerNameInput');
        if (!playerNameInput) return;
        
        let resultsList = document.getElementById('jugadoresSearchResults');
        if (!resultsList) {
            resultsList = document.createElement('ul');
            resultsList.id = 'jugadoresSearchResults';
            resultsList.className = 'search-results';
            
            resultsList.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                max-height: 200px;
                overflow-y: auto;
                background: white;
                border: 2px solid var(--accent-gold);
                border-radius: 4px;
                list-style: none;
                padding: 0;
                margin: 0;
                z-index: 10000;
                display: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            
            if (playerNameInput.parentNode) {
                playerNameInput.parentNode.style.position = 'relative';
                playerNameInput.parentNode.appendChild(resultsList);
            }
        }
        
        const inputHandler = (e) => {
            const searchTerm = playerNameInput.value.toLowerCase().trim();
            resultsList.innerHTML = '';
            
            if (searchTerm.length === 0) {
                resultsList.style.display = 'none';
                return;
            }
            
            const filtered = this.jugadoresDenominaciones.filter(item => {
                const itemText = item.text.toLowerCase();
                const jugadorText = item.jugador?.toLowerCase() || '';
                
                return itemText.includes(searchTerm) || 
                       jugadorText.includes(searchTerm) ||
                       item.clase?.toLowerCase().includes(searchTerm) ||
                       item.raza?.toLowerCase().includes(searchTerm);
            }).slice(0, 10);
            
            if (filtered.length > 0) {
                filtered.forEach(item => {
                    const li = document.createElement('li');
                    
                    let highlightedText = item.text;
                    const regex = new RegExp(`(${searchTerm})`, 'gi');
                    highlightedText = item.text.replace(regex, '<span class="highlight">$1</span>');
                    
                    li.innerHTML = `
                        <div style="display: flex; flex-direction: column;">
                            <span>${highlightedText}</span>
                            <small style="color: var(--ink-light);">
                                ${item.clase || ''} (nivel ${item.nivel || '?'}) - ${item.jugador || ''}
                            </small>
                        </div>
                    `;
                    
                    li.style.cssText = `
                        padding: 10px 15px;
                        cursor: pointer;
                        border-bottom: 1px solid var(--parchment-dark);
                        font-family: 'Cinzel', serif;
                        transition: background 0.2s ease;
                    `;
                    
                    li.addEventListener('mouseover', () => {
                        li.style.background = 'var(--parchment-light)';
                    });
                    
                    li.addEventListener('mouseout', () => {
                        li.style.background = 'white';
                    });
                    
                    li.addEventListener('click', () => {
                        playerNameInput.value = item.text;
                        this.cargarDatosJugador(item);
                        resultsList.style.display = 'none';
                    });
                    
                    resultsList.appendChild(li);
                });
                resultsList.style.display = 'block';
            } else {
                resultsList.style.display = 'none';
            }
        };
        
        playerNameInput.removeEventListener('input', this._boundJugadorInputHandler);
        this._boundJugadorInputHandler = inputHandler;
        playerNameInput.addEventListener('input', this._boundJugadorInputHandler);
        
        const documentClickHandler = (e) => {
            if (e.target !== playerNameInput && !resultsList.contains(e.target)) {
                resultsList.style.display = 'none';
            }
        };
        
        document.removeEventListener('click', this._boundJugadorDocumentClickHandler);
        this._boundJugadorDocumentClickHandler = documentClickHandler;
        document.addEventListener('click', this._boundJugadorDocumentClickHandler);
    }

    cargarDatosJugador(personaje) {
        const playerNameInput = document.getElementById('playerNameInput');
        const playerCAInput = document.getElementById('playerCAInput');
        const playerHPInput = document.getElementById('playerHPInput');
        const playerInitiativeInput = document.getElementById('playerInitiativeInput');
        
        if (playerNameInput) playerNameInput.value = personaje.text;
        if (playerCAInput && personaje.stats?.ca) playerCAInput.value = personaje.stats.ca;
        if (playerHPInput && personaje.stats?.hp?.max) playerHPInput.value = personaje.stats.hp.max;
        if (playerInitiativeInput && personaje.stats?.iniciativa) {
            playerInitiativeInput.value = personaje.stats.iniciativa;
        }
        
        this.showNotification(`Datos de ${personaje.text} precargados`, 'success');
    }

    async actualizarPersonajesPeriodicamente() {
        try {
            const response = await fetch(`${this.baseUrl}/api/personajes/hoy`);
            const data = await response.json();
            const nuevosPersonajes = data.personajes || [];
            
            const cambios = this.detectarCambiosPersonajes(nuevosPersonajes, this.personajesHoy);
            
            if (cambios.hayCambios) {
                console.log('🔄 Cambios detectados en personajes:', cambios);
                
                this.personajesHoy = nuevosPersonajes;
                
                this.jugadoresDenominaciones = this.personajesHoy.map(pj => ({
                    text: pj.nombre,
                    value: pj.nombre,
                    jugador: pj.jugador,
                    clase: pj.clase,
                    nivel: pj.nivel,
                    raza: pj.raza,
                    trasfondo: pj.trasfondo,
                    alineamiento: pj.alineamiento,
                    stats: pj.stats,
                    spellStats: pj.spellStats,
                    ataques: pj.ataques,
                    conjuros: pj.conjuros,
                    inventario: pj.inventario,
                    notas: pj.notas,
                    imagen: pj.imagen,
                    colores_personalizados: pj.colores_personalizados,
                    savingThrows: pj.savingThrows,
                    passivePerception: pj.passivePerception,
                    deathSaves: pj.deathSaves 
                }));
                
                if (cambios.nuevos.length > 0) {
                    cambios.nuevos.forEach(pj => {
                        this.showNotification(`✨ Nuevo personaje: ${pj.nombre}`, 'info');
                    });
                }
                
                if (cambios.modificados.length > 0 && this.modalAbierto) {
                    await this.verificarCambiosPersonaje();
                }
            }
            
        } catch (error) {
            console.error('Error actualizando personajes:', error);
        }
    }

    detectarCambiosPersonajes(nuevos, viejos) {
        const resultado = {
            hayCambios: false,
            nuevos: [],
            modificados: [],
            eliminados: []
        };
        
        nuevos.forEach(nuevo => {
            const viejo = viejos.find(v => v.nombre === nuevo.nombre || v.id === nuevo.id);
            
            if (!viejo) {
                resultado.nuevos.push(nuevo);
                resultado.hayCambios = true;
            } else if (JSON.stringify(nuevo) !== JSON.stringify(viejo)) {
                resultado.modificados.push(nuevo);
                resultado.hayCambios = true;
            }
        });
        
        viejos.forEach(viejo => {
            const existe = nuevos.find(n => n.nombre === viejo.nombre || n.id === viejo.id);
            if (!existe) {
                resultado.eliminados.push(viejo);
                resultado.hayCambios = true;
            }
        });
        
        return resultado;
    }

    iniciarSeguimientoModal(personaje) {
        this.detenerSeguimientoModal();
        
        this.modalAbierto = personaje;
        this.ultimaVersionPersonaje = JSON.stringify(personaje);
        
        console.log(`🔄 Iniciando seguimiento de ${personaje.nombre}`);
        
        this.intervaloActualizacionModal = setInterval(async () => {
            await this.verificarCambiosPersonaje();
        }, 1500);
    }

    detenerSeguimientoModal() {
        if (this.intervaloActualizacionModal) {
            clearInterval(this.intervaloActualizacionModal);
            this.intervaloActualizacionModal = null;
        }
        this.modalAbierto = null;
        this.ultimaVersionPersonaje = null;
    }

    async verificarCambiosPersonaje() {
        if (!this.modalAbierto) return;
        
        try {
            const personajeActualizado = this.personajesHoy.find(p => 
                p.id === this.modalAbierto.id || p.nombre === this.modalAbierto.nombre
            );
            
            if (!personajeActualizado) return;
            
            const versionActual = JSON.stringify(personajeActualizado);
            if (versionActual !== this.ultimaVersionPersonaje) {
                console.log(`🔄 Actualizando modal para ${personajeActualizado.nombre}`);
                this.ultimaVersionPersonaje = versionActual;
                this.modalAbierto = personajeActualizado;
                await this.actualizarModalConDatos(personajeActualizado);
            }
        } catch (error) {
            console.error('Error verificando cambios:', error);
        }
    }

    async actualizarModalConDatos(personaje) {
        const modal = document.getElementById('jugadorModal');
        if (!modal || modal.style.display !== 'block') return;
        
        const modalBody = document.getElementById('jugadorModalBody');
        if (!modalBody) return;
        
        const tituloActual = modalBody.querySelector('h2')?.textContent;
        if (tituloActual && tituloActual !== personaje.nombre) {
            console.log('⚠️ El modal muestra otro personaje, ignorando actualización');
            return;
        }
        
        if (personaje.colores_personalizados) {
            this.aplicarColoresPersonaje(modal, personaje.colores_personalizados);
        }
        
        const scrollPos = modalBody.scrollTop;
        
        modalBody.innerHTML = this.generarHTMLModal(personaje);
        
        modalBody.scrollTop = scrollPos;
        this.setupDeathSavesClickEvents(personaje);
        this.mostrarNotificacionActualizacion(modal);
    }

    mostrarNotificacionActualizacion(modal) {
        const content = modal.querySelector('.jugador-modal-content');
        if (!content) return;
        
        const notificacion = document.createElement('div');
        notificacion.className = 'modal-actualizacion';
        notificacion.innerHTML = `
            <i class="fas fa-sync-alt fa-spin"></i>
            <span>Actualizado</span>
        `;
        notificacion.style.cssText = `
            position: absolute;
            top: 10px;
            right: 50px;
            background: var(--accent-gold);
            color: var(--ink-black);
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 0.8rem;
            display: flex;
            align-items: center;
            gap: 5px;
            z-index: 10001;
            animation: fadeOut 2s ease forwards;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        `;
        
        content.appendChild(notificacion);
        
        setTimeout(() => {
            if (notificacion.parentNode) {
                notificacion.remove();
            }
        }, 2000);
    }

    setupDeathSavesClickEvents(personaje) {
        const modalBody = document.getElementById('jugadorModalBody');
        if (!modalBody) return;
        
        const successChecks = modalBody.querySelectorAll('.success-check');
        const failChecks = modalBody.querySelectorAll('.fail-check');
        
        successChecks.forEach(check => {
            check.addEventListener('click', async (e) => {
                e.stopPropagation();
                const index = parseInt(check.dataset.index);
                
                const personajeActual = this.personajesHoy.find(p => p.nombre === personaje.nombre);
                if (!personajeActual) return;
                
                const nuevosDeathSaves = { ...personajeActual.deathSaves };
                if (!nuevosDeathSaves.successes) nuevosDeathSaves.successes = [false, false, false];
                
                nuevosDeathSaves.successes[index] = !nuevosDeathSaves.successes[index];
                
                if (nuevosDeathSaves.successes.filter(Boolean).length >= 3) {
                    nuevosDeathSaves.successes = [true, true, true];
                    nuevosDeathSaves.fails = [false, false, false];
                }
                
                const idx = this.personajesHoy.findIndex(p => p.nombre === personaje.nombre);
                if (idx !== -1) {
                    this.personajesHoy[idx].deathSaves = nuevosDeathSaves;
                }
                
                await this.actualizarDeathSavesEnServidor(personaje.nombre, nuevosDeathSaves);
                
                this.modalAbierto = { ...personajeActual, deathSaves: nuevosDeathSaves };
                this.actualizarModalConDatos(this.modalAbierto);
            });
        });
        
        failChecks.forEach(check => {
            check.addEventListener('click', async (e) => {
                e.stopPropagation();
                const index = parseInt(check.dataset.index);
                
                const personajeActual = this.personajesHoy.find(p => p.nombre === personaje.nombre);
                if (!personajeActual) return;
                
                const nuevosDeathSaves = { ...personajeActual.deathSaves };
                if (!nuevosDeathSaves.fails) nuevosDeathSaves.fails = [false, false, false];
                
                nuevosDeathSaves.fails[index] = !nuevosDeathSaves.fails[index];
                
                if (nuevosDeathSaves.fails.filter(Boolean).length >= 3) {
                    nuevosDeathSaves.fails = [true, true, true];
                    nuevosDeathSaves.successes = [false, false, false];
                }
                
                const idx = this.personajesHoy.findIndex(p => p.nombre === personaje.nombre);
                if (idx !== -1) {
                    this.personajesHoy[idx].deathSaves = nuevosDeathSaves;
                }
                
                await this.actualizarDeathSavesEnServidor(personaje.nombre, nuevosDeathSaves);
                
                this.modalAbierto = { ...personajeActual, deathSaves: nuevosDeathSaves };
                this.actualizarModalConDatos(this.modalAbierto);
            });
        });
    }

    async actualizarDeathSavesEnServidor(nombrePersonaje, deathSaves) {
        try {
            const personaje = this.personajesHoy.find(p => p.nombre === nombrePersonaje);
            if (!personaje) return;
            
            const updatedPersonaje = { ...personaje, deathSaves };
            
            const response = await fetch(`${this.baseUrl}/api/personajes/guardar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedPersonaje)
            });
            
            if (response.ok) {
                console.log(`✅ Salvaciones de muerte actualizadas para ${nombrePersonaje}`);
                
                if (window.wsClient && window.wsClient.isConectado()) {
                    window.wsClient.emit('personaje-guardado', {
                        personaje: updatedPersonaje
                    });
                }
            }
        } catch (error) {
            console.error('Error actualizando death saves:', error);
        }
    }

    async mostrarInfoJugador(personaje) {
        let modal = document.getElementById('jugadorModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'jugadorModal';
            modal.className = 'jugador-modal';
            modal.innerHTML = `
                <div class="jugador-modal-content">
                    <span class="close-modal">&times;</span>
                    <div id="jugadorModalBody"></div>
                </div>
            `;
            document.body.appendChild(modal);
            
            modal.querySelector('.close-modal').addEventListener('click', () => {
                modal.style.display = 'none';
                this.detenerSeguimientoModal();
            });
            
            window.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                    this.detenerSeguimientoModal();
                }
            });
        }
        
        const modalBody = document.getElementById('jugadorModalBody');
        if (!modalBody) return;
        
        if (personaje.colores_personalizados) {
            this.aplicarColoresPersonaje(modal, personaje.colores_personalizados);
        }
        
        modalBody.innerHTML = this.generarHTMLModal(personaje);
        modal.style.display = 'block';
        
        this.iniciarSeguimientoModal(personaje);
    }

    generarHTMLModal(personaje) {
        let html = '';
        
        html += `<div class="jugador-imagen-container">`;
        if (personaje.imagen) {
            let imagenUrl = personaje.imagen;
            if (!imagenUrl.startsWith('http') && !imagenUrl.startsWith('/')) {
                imagenUrl = '/' + imagenUrl;
            }
            html += `
                <div class="jugador-imagen-wrapper">
                    <img src="${imagenUrl}" alt="${personaje.nombre || 'Personaje'}" class="jugador-imagen"
                         onerror="this.onerror=null; this.src=''; this.parentElement.innerHTML='<div class=\\'jugador-imagen-placeholder\\'><i class=\\'fas fa-user\\'></i><span>${personaje.nombre || '?'}</span></div>';">
                </div>
            `;
        } else {
            html += `
                <div class="jugador-imagen-placeholder">
                    <i class="fas fa-user"></i>
                    <span>${personaje.nombre || 'Personaje'}</span>
                </div>
            `;
        }
        html += `</div>`;
        
        html += `<h2 class="jugador-titulo">${personaje.nombre || 'Sin nombre'}</h2>`;
        
        html += `<div class="jugador-seccion">`;
        html += `<h3><i class="fas fa-info-circle"></i> Información</h3>`;
        html += `<div class="jugador-info-grid">`;
        html += `<div class="jugador-info-item"><span class="info-label">Clase:</span> <span class="info-valor">${personaje.clase || '?'}</span></div>`;
        html += `<div class="jugador-info-item"><span class="info-label">Raza:</span> <span class="info-valor">${personaje.raza || '?'}</span></div>`;
        html += `<div class="jugador-info-item"><span class="info-label">Nivel:</span> <span class="info-valor">${personaje.nivel || '?'}</span></div>`;
        html += `<div class="jugador-info-item"><span class="info-label">Jugador:</span> <span class="info-valor">${personaje.jugador || '?'}</span></div>`;
        
        if (personaje.stats?.velocidad) {
            html += `<div class="jugador-info-item"><span class="info-label">Velocidad:</span> <span class="info-valor">${personaje.stats.velocidad} pies</span></div>`;
        }
        
        const trasfondo = personaje.notas?.trasfondo || personaje.trasfondo || personaje.background || '?';
        html += `<div class="jugador-info-item"><span class="info-label">Trasfondo:</span> <span class="info-valor">${trasfondo}</span></div>`;
        
        const alineamiento = personaje.alineamiento || personaje.alignment || '?';
        html += `<div class="jugador-info-item"><span class="info-label">Alineamiento:</span> <span class="info-valor">${alineamiento}</span></div>`;
        
        if (personaje.stats) {
            html += `<div class="jugador-info-item"><span class="info-label">CA:</span> <span class="info-valor">${personaje.stats.ca || '?'}</span></div>`;
            html += `<div class="jugador-info-item"><span class="info-label">Iniciativa:</span> <span class="info-valor">${personaje.stats.iniciativa || '?'}</span></div>`;
        }
        html += `</div>`;
        html += `</div>`;
        
        if (personaje.stats?.atributos?.length > 0) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-dumbbell"></i> Atributos</h3>`;
            html += `<div class="atributos-grid">`;
            personaje.stats.atributos.forEach(attr => {
                let modificador = attr.modificador ?? Math.floor((attr.valor - 10) / 2);
                const signo = modificador >= 0 ? '+' : '';
                html += `
                    <div class="atributo-card">
                        <div class="atributo-nombre">${attr.nombre || 'ATRIBUTO'}</div>
                        <div class="atributo-valor">${attr.valor || 10}</div>
                        <div class="atributo-modificador ${modificador >= 0 ? 'positivo' : 'negativo'}">${signo}${modificador}</div>
                    </div>
                `;
            });
            html += `</div>`;
            html += `</div>`;
        }
        
        if (personaje.stats?.hp || personaje.stats?.mana || personaje.spellSlots) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-heart"></i> Combate</h3>`;
            html += `<div class="stats-combate-grid">`;
            
            if (personaje.stats?.hp) {
                const hp = personaje.stats.hp;
                const porcentajeVida = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
                const colorVida = porcentajeVida < 25 ? '#f44336' : porcentajeVida < 50 ? '#ff9800' : '#4CAF50';
                
                html += `
                    <div class="stat-combate-card">
                        <div class="stat-icon"><i class="fas fa-heart" style="color: ${colorVida};"></i></div>
                        <div class="stat-contenido">
                            <div class="stat-label">Puntos de Golpe</div>
                            <div class="stat-valor-principal">${hp.current || 0}/${hp.max || 0}</div>
                            ${hp.temp ? `<div class="stat-temp">+${hp.temp} temporal</div>` : ''}
                            <div class="stat-barra">
                                <div class="stat-barra-fill" style="width: ${porcentajeVida}%; background: ${colorVida};"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            if (personaje.stats?.mana) {
                const mana = personaje.stats.mana;
                const porcentajeMana = mana.max > 0 ? (mana.current / mana.max) * 100 : 0;
                html += `
                    <div class="stat-combate-card">
                        <div class="stat-icon"><i class="fas fa-bolt" style="color: #4169e1;"></i></div>
                        <div class="stat-contenido">
                            <div class="stat-label">Maná</div>
                            <div class="stat-valor-principal">${mana.current || 0}/${mana.max || 0}</div>
                            <div class="stat-barra">
                                <div class="stat-barra-fill" style="width: ${porcentajeMana}%; background: #4169e1;"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            if (personaje.spellSlots) {
                const slots = personaje.spellSlots;
                const nivel = slots.level || 1;
                const total = slots.total || 0;
                const usados = slots.used || 0;
                const disponibles = total - usados;
                const porcentajeUsados = total > 0 ? (usados / total) * 100 : 0;
                const colorSlots = porcentajeUsados > 75 ? '#ff4444' : porcentajeUsados > 50 ? '#ffaa00' : '#4CAF50';
                
                html += `
                    <div class="stat-combate-card">
                        <div class="stat-icon"><i class="fas fa-gem" style="color: var(--accent-gold);"></i></div>
                        <div class="stat-contenido">
                            <div class="stat-label">Slots de Conjuros (Nivel ${nivel})</div>
                            <div class="stat-valor-principal">${usados}/${total}</div>
                            <div class="stat-temp" style="color: ${colorSlots};">${disponibles} disponibles</div>
                            <div class="stat-barra">
                                <div class="stat-barra-fill" style="width: ${porcentajeUsados}%; background: var(--slot-color, #9370db);"></div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            html += `</div>`;
            html += `</div>`;
        }
        
        if (personaje.savingThrows && personaje.savingThrows.length > 0) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-shield-alt"></i> Tiradas de Salvación</h3>`;
            html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">`;
            
            personaje.savingThrows.sort((a, b) => a.name.localeCompare(b.name)).forEach(st => {
                const profIcon = st.proficient ? 'fa-check-circle' : 'fa-circle';
                html += `
                    <div style="background: rgba(255,255,255,0.5); border: 1px solid var(--accent-gold); border-radius: 6px; padding: 8px; display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: bold; color: var(--accent-purple); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${st.name}">${st.name}</span>
                        <span style="font-weight: bold; ${st.value > 0 ? 'color: #4CAF50;' : st.value < 0 ? 'color: #ff4444;' : ''}">${st.value > 0 ? '+' : ''}${st.value}</span>
                        <span style="color: ${st.proficient ? '#4CAF50' : 'var(--accent-gold)'};"><i class="fas ${profIcon}"></i></span>
                    </div>
                `;
            });
            
            html += `</div>`;
            html += `</div>`;
        }
        
        if (personaje.skills && personaje.skills.length > 0) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-brain"></i> Habilidades</h3>`;
            html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px;">`;
            
            personaje.skills.sort((a, b) => a.name.localeCompare(b.name)).forEach(skill => {
                html += `
                    <div style="background: white; border: 1px solid var(--parchment-dark); border-radius: 6px; padding: 8px 12px; display: flex; align-items: center; justify-content: space-between;">
                        <span style="color: var(--ink-dark);">${skill.name}</span>
                        <span style="font-weight: bold; ${skill.bonus > 0 ? 'color: #4CAF50;' : skill.bonus < 0 ? 'color: #ff4444;' : ''}">${skill.bonus > 0 ? '+' : ''}${skill.bonus}</span>
                    </div>
                `;
            });
            
            html += `</div>`;
            html += `</div>`;
        }
        
        if (personaje.proficiencies && personaje.proficiencies.length > 0) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-language"></i> Competencias & Idiomas</h3>`;
            
            const armaduras = personaje.proficiencies.filter(p => p.type === 'armor');
            const armas = personaje.proficiencies.filter(p => p.type === 'weapon');
            const herramientas = personaje.proficiencies.filter(p => p.type === 'tool');
            const idiomas = personaje.proficiencies.filter(p => p.type === 'language');
            const otros = personaje.proficiencies.filter(p => !['armor', 'weapon', 'tool', 'language'].includes(p.type));
            
            if (armaduras.length > 0) {
                html += `<h4 style="color: var(--accent-purple); margin: 10px 0 5px;"><i class="fas fa-shield-alt"></i> Armaduras</h4>`;
                html += `<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">`;
                armaduras.forEach(p => {
                    html += `<span style="background: linear-gradient(135deg, var(--accent-purple), #5d3a9b); color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.85rem; border: 1px solid var(--accent-gold);">${p.name}</span>`;
                });
                html += `</div>`;
            }
            
            if (armas.length > 0) {
                html += `<h4 style="color: var(--accent-purple); margin: 10px 0 5px;"><i class="fas fa-crosshairs"></i> Armas</h4>`;
                html += `<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">`;
                armas.forEach(p => {
                    html += `<span style="background: linear-gradient(135deg, #B22222, #8B0000); color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.85rem; border: 1px solid var(--accent-gold);">${p.name}</span>`;
                });
                html += `</div>`;
            }
            
            if (herramientas.length > 0) {
                html += `<h4 style="color: var(--accent-purple); margin: 10px 0 5px;"><i class="fas fa-tools"></i> Herramientas</h4>`;
                html += `<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">`;
                herramientas.forEach(p => {
                    html += `<span style="background: linear-gradient(135deg, #2F4F4F, #1C3A3A); color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.85rem; border: 1px solid var(--accent-gold);">${p.name}</span>`;
                });
                html += `</div>`;
            }
            
            if (idiomas.length > 0) {
                html += `<h4 style="color: var(--accent-purple); margin: 10px 0 5px;"><i class="fas fa-language"></i> Idiomas</h4>`;
                html += `<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">`;
                idiomas.forEach(p => {
                    html += `<span style="background: linear-gradient(135deg, var(--accent-purple), #4B0082); color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.85rem; border: 1px solid var(--accent-gold);">${p.name}</span>`;
                });
                html += `</div>`;
            }
            
            if (otros.length > 0) {
                html += `<h4 style="color: var(--accent-purple); margin: 10px 0 5px;"><i class="fas fa-tag"></i> Otros</h4>`;
                html += `<div style="display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px;">`;
                otros.forEach(p => {
                    html += `<span style="background: linear-gradient(135deg, #666, #444); color: white; padding: 3px 10px; border-radius: 20px; font-size: 0.85rem; border: 1px solid var(--accent-gold);">${p.name}</span>`;
                });
                html += `</div>`;
            }
            
            html += `</div>`;
        }
        
        if (personaje.passivePerception !== undefined) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-eye"></i> Percepción Pasiva</h3>`;
            html += `<div style="text-align: center;">`;
            html += `<div style="font-size: 3rem; font-weight: bold; color: var(--accent-blue); width: 100px; height: 100px; border: 4px solid var(--accent-gold); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto; background: white;">${personaje.passivePerception}</div>`;
            html += `<div style="font-size: 0.9rem; color: var(--ink-light); margin-top: 10px;">10 + Mod. Sabiduría + Bonif. Competencia</div>`;
            html += `</div>`;
            html += `</div>`;
        }
        
        if (personaje.deathSaves) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-skull"></i> Salvaciones de Muerte</h3>`;
            html += `<div style="display: flex; gap: 30px; justify-content: center;">`;
            
            const successes = personaje.deathSaves.successes || [false, false, false];
            const fails = personaje.deathSaves.fails || [false, false, false];
            const successCount = successes.filter(Boolean).length;
            const failCount = fails.filter(Boolean).length;
            
            html += `<div style="text-align: center;">`;
            html += `<label style="display: block; margin-bottom: 10px; font-weight: bold;"><i class="fas fa-check-circle" style="color: #4CAF50;"></i> Éxitos</label>`;
            html += `<div style="display: flex; gap: 10px; justify-content: center;">`;
            
            successes.forEach((checked, index) => {
                const bgColor = checked ? '#4CAF50' : 'rgba(255, 255, 255, 0.2)';
                const icon = checked ? '<i class="fas fa-check"></i>' : '';
                html += `
                    <div class="death-save-check success-check"
                        data-type="success" 
                        data-index="${index}" 
                        style="
                            width: 40px; 
                            height: 40px; 
                            border: 3px solid var(--accent-gold, #d4af37); 
                            border-radius: 8px; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            background: ${bgColor};
                            transition: all 0.2s ease;
                            color: white;
                            font-size: 18px;
                        ">
                        ${icon}
                    </div>
                `;
            });
            
            html += `</div></div>`;
            
            html += `<div style="text-align: center;">`;
            html += `<label style="display: block; margin-bottom: 10px; font-weight: bold;"><i class="fas fa-times-circle" style="color: #ff4444;"></i> Fallos</label>`;
            html += `<div style="display: flex; gap: 10px; justify-content: center;">`;
            
            fails.forEach((checked, index) => {
                const bgColor = checked ? '#ff4444' : 'rgba(254, 254, 254, 0.2)';
                const icon = checked ? '<i class="fas fa-times"></i>' : '';
                html += `
                    <div class="death-save-check fail-check"
                        data-type="fail" 
                        data-index="${index}" 
                        style="
                            width: 40px; 
                            height: 40px; 
                            border: 3px solid var(--accent-gold, #d4af37); 
                            border-radius: 8px; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            background: ${bgColor};
                            transition: all 0.2s ease;
                            color: white;
                            font-size: 18px;
                        ">
                        ${icon}
                    </div>
                `;
            });
            
            html += `</div></div>`;
            html += `</div>`;
            
            if (successCount >= 3) {
                html += `<div style="text-align: center; margin-top: 15px; padding: 8px; background: rgba(76, 175, 80, 0.2); color: #4CAF50; border: 1px solid #4CAF50; border-radius: 8px;"><i class="fas fa-check-circle"></i> ¡Personaje estable!</div>`;
            } else if (failCount >= 3) {
                html += `<div style="text-align: center; margin-top: 15px; padding: 8px; background: rgba(255, 68, 68, 0.2); color: #ff4444; border: 1px solid #ff4444; border-radius: 8px;"><i class="fas fa-skull-crossbones"></i> ¡Personaje ha muerto!</div>`;
            }
            
            html += `</div>`;
        }
        
        if (personaje.inventario) {
            const inv = personaje.inventario;
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-box-open"></i> Inventario</h3>`;
            
            if (inv.monedas) {
                const monedas = inv.monedas;
                html += `
                    <div class="inventario-subseccion">
                        <h4><i class="fas fa-coins"></i> ${monedas.name || 'Monedas'}</h4>
                        <div class="monedas-grid">
                            <div class="moneda-item" style="background: linear-gradient(135deg, #ffd700, #b8860b);">
                                <i class="fas fa-circle"></i> <span class="moneda-tipo">${monedas.goldName || 'Oro'}</span>
                                <span class="moneda-cantidad">${monedas.gold || 0}</span>
                            </div>
                            <div class="moneda-item" style="background: linear-gradient(135deg, #c0c0c0, #808080);">
                                <i class="fas fa-circle"></i> <span class="moneda-tipo">${monedas.silverName || 'Plata'}</span>
                                <span class="moneda-cantidad">${monedas.silver || 0}</span>
                            </div>
                            <div class="moneda-item" style="background: linear-gradient(135deg, #b87333, #8b4513);">
                                <i class="fas fa-circle"></i> <span class="moneda-tipo">${monedas.copperName || 'Cobre'}</span>
                                <span class="moneda-cantidad">${monedas.copper || 0}</span>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            if (inv.tesoros?.length > 0) {
                html += `<div class="inventario-subseccion"><h4><i class="fas fa-gem"></i> Tesoros</h4><div class="items-lista">`;
                inv.tesoros.forEach(tesoro => {
                    const icono = this.getTreasureIcon(tesoro.type);
                    html += `
                        <div class="item-card tesoro-item">
                            <div class="item-icono"><i class="fas ${icono}" style="color: var(--accent-gold);"></i></div>
                            <div class="item-info">
                                <div class="item-nombre">${tesoro.name || 'Tesoro'}</div>
                                <div class="item-detalle">Valor: ${tesoro.value || 0} ${inv.monedas?.name || 'monedas'}</div>
                            </div>
                        </div>
                    `;
                });
                html += `</div></div>`;
            }
            
            if (inv.pociones?.length > 0) {
                html += `<div class="inventario-subseccion"><h4><i class="fas fa-flask"></i> Pociones</h4><div class="items-lista">`;
                inv.pociones.forEach(pocion => {
                    const icono = pocion.type === 'life' ? 'fa-heart' : 'fa-bolt';
                    const color = pocion.type === 'life' ? '#dc143c' : '#4169e1';
                    html += `
                        <div class="item-card pocion-item">
                            <div class="item-icono" style="color: ${color};"><i class="fas ${icono}"></i></div>
                            <div class="item-info">
                                <div class="item-nombre">${pocion.name || 'Poción'}</div>
                                <div class="item-detalle">+${pocion.amount || 0} • ${pocion.value || 0}</div>
                            </div>
                        </div>
                    `;
                });
                html += `</div></div>`;
            }
            
            if (inv.equipo?.length > 0) {
                html += `<div class="inventario-subseccion"><h4><i class="fas fa-chess-board"></i> Equipo</h4><div class="items-lista">`;
                inv.equipo.forEach(item => {
                    let bonusHtml = '';
                    if (item.attribute && item.bonus !== 0) {
                        bonusHtml = `<span class="item-bonus" style="color: ${item.bonus > 0 ? '#4CAF50' : '#ff4444'};">${item.bonus > 0 ? '+' : ''}${item.bonus} a ${item.attribute}</span>`;
                    }
                    
                    html += `
                        <div class="item-card equipo-item">
                            <div class="item-icono"><i class="fas fa-shield-alt" style="color: var(--accent-purple);"></i></div>
                            <div class="item-info">
                                <div class="item-nombre">${item.name || 'Equipo'}</div>
                                <div class="item-detalle">
                                    <span><i class="fas fa-coins"></i> ${item.cost || 0}</span>
                                    <span><i class="fas fa-weight-hanging"></i> ${item.weight || 0}</span>
                                    ${bonusHtml}
                                </div>
                                ${item.description ? `<div class="item-descripcion">${item.description}</div>` : ''}
                            </div>
                        </div>
                    `;
                });
                html += `</div></div>`;
            }
            
            html += `</div>`;
        }
        
        if (personaje.ataques?.length > 0) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-crosshairs"></i> Ataques</h3>`;
            html += `<div class="ataques-lista">`;
            personaje.ataques.forEach(atk => {
                if (atk.name) {
                    html += `
                        <div class="ataque-item">
                            <div class="ataque-nombre">${atk.name}</div>
                            <div class="ataque-detalle">
                                <span class="ataque-bonus">${atk.bonus || '?'}</span>
                                <span class="ataque-dano">${atk.damage || '?'}</span>
                            </div>
                        </div>
                    `;
                }
            });
            html += `</div>`;
            html += `</div>`;
        }
        
        if (personaje.spellStats) {
            const stats = personaje.spellStats;
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-book-spells"></i> Estadísticas de Conjuros</h3>`;
            html += `<div class="spell-stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">`;
            
            html += `
                <div class="spell-stat-card" style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 10px; text-align: center; border: 1px solid var(--accent-gold);">
                    <div style="font-size: 0.8rem; color: var(--accent-gold); margin-bottom: 5px;">
                        <i class="fas fa-magic"></i> Característica Mágica
                    </div>
                    <div style="font-size: 1.3rem; font-weight: bold; color: var(--accent-purple);">
                        ${stats.spellcastingAbility || 'Sabiduría'}
                    </div>
                </div>
            `;
            
            html += `
                <div class="spell-stat-card" style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 10px; text-align: center; border: 1px solid var(--accent-gold);">
                    <div style="font-size: 0.8rem; color: var(--accent-gold); margin-bottom: 5px;">
                        <i class="fas fa-shield-alt"></i> CD Salvación
                    </div>
                    <div style="font-size: 1.3rem; font-weight: bold; color: #4CAF50;">
                        ${stats.spellSaveDC || 10}
                    </div>
                </div>
            `;
            
            const attackBonus = stats.spellAttackBonus || 0;
            html += `
                <div class="spell-stat-card" style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 10px; text-align: center; border: 1px solid var(--accent-gold);">
                    <div style="font-size: 0.8rem; color: var(--accent-gold); margin-bottom: 5px;">
                        <i class="fas fa-crosshairs"></i> Ataque Conjuros
                    </div>
                    <div style="font-size: 1.3rem; font-weight: bold; ${attackBonus >= 0 ? 'color: #4CAF50;' : 'color: #ff4444;'}">
                        ${attackBonus >= 0 ? '+' : ''}${attackBonus}
                    </div>
                </div>
            `;
            
            html += `
                <div class="spell-stat-card" style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 10px; text-align: center; border: 1px solid var(--accent-gold);">
                    <div style="font-size: 0.8rem; color: var(--accent-gold); margin-bottom: 5px;">
                        <i class="fas fa-book"></i> Conjuros Preparados
                    </div>
                    <div style="font-size: 1.3rem; font-weight: bold; color: var(--accent-purple);">
                        ${stats.preparedSpells || 0} / ${stats.maxPreparedSpells || 0}
                    </div>
                </div>
            `;
            
            html += `
                <div class="spell-stat-card" style="background: rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 10px; text-align: center; border: 1px solid var(--accent-gold);">
                    <div style="font-size: 0.8rem; color: var(--accent-gold); margin-bottom: 5px;">
                        <i class="fas fa-star"></i> Trucos Conocidos
                    </div>
                    <div style="font-size: 1.3rem; font-weight: bold; color: var(--accent-purple);">
                        ${stats.cantripsKnown || 0}
                    </div>
                </div>
            `;
            
            html += `</div>`;
            html += `</div>`;
        }
        
        if (personaje.conjuros?.length > 0) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-magic"></i> Conjuros</h3>`;
            html += `<div class="conjuros-lista">`;
            personaje.conjuros.forEach(spell => {
                if (spell.name) {
                    html += `
                        <div class="conjuro-item">
                            <div class="conjuro-header">
                                <span class="conjuro-nombre">${spell.name}</span>
                                <span class="conjuro-nivel">${spell.level || '?'}</span>
                            </div>
                            ${spell.description ? `<div class="conjuro-descripcion">${spell.description}</div>` : ''}
                        </div>
                    `;
                }
            });
            html += `</div>`;
            html += `</div>`;
        }
        
        if (personaje.notas && Object.values(personaje.notas).some(v => v)) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-feather-alt"></i> Notas</h3>`;
            html += `<div class="notas-grid">`;
            
            if (personaje.notas.personalidad) html += `<div class="nota-item"><span class="nota-label">Personalidad:</span> ${personaje.notas.personalidad}</div>`;
            if (personaje.notas.ideales) html += `<div class="nota-item"><span class="nota-label">Ideales:</span> ${personaje.notas.ideales}</div>`;
            if (personaje.notas.vinculos) html += `<div class="nota-item"><span class="nota-label">Vínculos:</span> ${personaje.notas.vinculos}</div>`;
            if (personaje.notas.defectos) html += `<div class="nota-item"><span class="nota-label">Defectos:</span> ${personaje.notas.defectos}</div>`;
            if (personaje.notas.rasgos) html += `<div class="nota-item"><span class="nota-label">Rasgos:</span> ${personaje.notas.rasgos}</div>`;
            
            html += `</div>`;
            html += `</div>`;
        }
        
        return html;
    }

    getTreasureIcon(type) {
        switch(type) {
            case 'gem': return 'fa-gem';
            case 'jewelry': return 'fa-crown';
            case 'artifact': return 'fa-archway';
            default: return 'fa-box';
        }
    }

    aplicarColoresPersonaje(modal, colores) {
        const content = modal.querySelector('.jugador-modal-content');
        if (!content) return;
        
        let style = document.getElementById('colores-personaje-temp');
        if (!style) {
            style = document.createElement('style');
            style.id = 'colores-personaje-temp';
            document.head.appendChild(style);
        }
        
        let css = `.jugador-modal-content {`;
        if (colores.background) css += `--body-bg: ${colores.background};`;
        if (colores.parchment) css += `--parchment-light: ${colores.parchment};`;
        if (colores.accent) css += `--accent-gold: ${colores.accent};`;
        if (colores.mana) css += `--mana-color: ${colores.mana};`;
        if (colores.hp) css += `--hp-color: ${colores.hp};`;
        if (colores.gems) css += `--slot-color: ${colores.gems};`;
        css += `}`;
        
        style.textContent = css;
        
        if (colores.textColors) {
            css += `
                .jugador-modal-content {
                    --text-title-color: ${colores.textColors.title || '#1e3a5f'};
                    --text-subtitle-color: ${colores.textColors.subtitle || '#5c4033'};
                    --text-label-color: ${colores.textColors.label || '#5c4033'};
                    --text-input-color: ${colores.textColors.input || '#2c1810'};
                    --text-number-color: ${colores.textColors.number || '#2c1810'};
                    --text-modifier-color: ${colores.textColors.modifier || '#2a4a7a'};
                }
                
                .jugador-modal-content .atributo-valor,
                .jugador-modal-content .stat-valor-principal {
                    color: var(--text-number-color);
                }
                
                .jugador-modal-content .info-label,
                .jugador-modal-content .stat-label {
                    color: var(--text-label-color);
                }
                
                .jugador-modal-content h2,
                .jugador-modal-content h3 {
                    color: var(--text-title-color);
                }
            `;
        }
        
        style.textContent = css;
    }

    ajustarColor(hex, percent) {
        if (!hex || !hex.startsWith('#')) return hex;
        
        let R = parseInt(hex.substring(1,3), 16);
        let G = parseInt(hex.substring(3,5), 16);
        let B = parseInt(hex.substring(5,7), 16);
        
        R = Math.max(0, Math.min(255, R + percent));
        G = Math.max(0, Math.min(255, G + percent));
        B = Math.max(0, Math.min(255, B + percent));
        
        return `#${(R < 16 ? '0' : '') + R.toString(16)}${(G < 16 ? '0' : '') + G.toString(16)}${(B < 16 ? '0' : '') + B.toString(16)}`;
    }
    
    setupRichTextEditor() {
        const editor = document.getElementById('dmNotesEditor');
        if (!editor) return;
        
        editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.formatText('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.formatText('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.formatText('underline');
                        break;
                }
            }
        });
        
        editor.addEventListener('input', () => {
            this.updateNotes(editor.innerHTML);
            this.updateNotesStats();
        });
        
        const formatBold = document.getElementById('formatBold');
        if (formatBold) formatBold.addEventListener('click', () => this.formatText('bold'));
        
        const formatItalic = document.getElementById('formatItalic');
        if (formatItalic) formatItalic.addEventListener('click', () => this.formatText('italic'));
        
        const formatUnderline = document.getElementById('formatUnderline');
        if (formatUnderline) formatUnderline.addEventListener('click', () => this.formatText('underline'));
        
        const formatH1 = document.getElementById('formatH1');
        if (formatH1) formatH1.addEventListener('click', () => this.formatText('h1'));
        
        const formatH2 = document.getElementById('formatH2');
        if (formatH2) formatH2.addEventListener('click', () => this.formatText('h2'));
        
        const formatH3 = document.getElementById('formatH3');
        if (formatH3) formatH3.addEventListener('click', () => this.formatText('h3'));
    }

    formatText(command) {
        const editor = document.getElementById('dmNotesEditor');
        if (!editor) return;
        
        editor.focus();
        
        if (command === 'h1' || command === 'h2' || command === 'h3') {
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
            
            const range = selection.getRangeAt(0);
            
            let element;
            switch(command) {
                case 'h1': element = document.createElement('h1'); break;
                case 'h2': element = document.createElement('h2'); break;
                case 'h3': element = document.createElement('h3'); break;
            }
            
            if (!range.collapsed) {
                const selectedText = range.extractContents();
                element.appendChild(selectedText);
                range.insertNode(element);
            } else {
                element.innerHTML = 'Título';
                range.insertNode(element);
                
                const newRange = document.createRange();
                newRange.setStart(element.firstChild, 0);
                newRange.setEnd(element.firstChild, 0);
                selection.removeAllRanges();
                selection.addRange(newRange);
            }
        } else {
            document.execCommand(command, false, null);
        }
        
        this.updateNotes(editor.innerHTML);
        this.updateNotesStats();
    }

    // ========== MÉTODOS MODIFICADOS DEL BESTIARIO ==========
    
    async loadBestiarioOriginal() {
        try {
            const url = `${this.baseUrl}${this.apiEndpoints.BESTIARIO}`;
            console.log('📡 Cargando bestiario desde:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Error al cargar desde servidor');
            }
            
            const data = await response.json();
            // Guardar el original como referencia que nunca se modifica
            this.bestiarioOriginal = data;
            // La fuente activa es el original por defecto
            this.bestiarioActual = data;
            this.fuenteBestiarioActual = 'original';
            console.log('✅ Bestiario original cargado desde servidor');
            
        } catch (error) {
            console.warn('⚠️ Error cargando desde servidor:', error);
            
            try {
                const fallbackResponse = await fetch('/data/bestiario.json');
                const data = await fallbackResponse.json();
                this.bestiarioOriginal = data;
                this.bestiarioActual = data;
                this.fuenteBestiarioActual = 'original';
                console.log('✅ Bestiario cargado en modo fallback');
            } catch (fallbackError) {
                console.error('Error al cargar bestiario:', fallbackError);
                this.showNotification('Error al cargar el bestiario original', 'error');
            }
        }
        
        this.generateBestiaryDenominaciones();
        this.setupBestiaryAutocomplete();
    }

    async cargarBestiarioPersonalizado(file) {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const customData = JSON.parse(e.target.result);
                
                if (!Array.isArray(customData)) {
                    throw new Error('El archivo debe contener un array');
                }
                
                // Guardar el bestiario personalizado en una variable separada
                // NO se modifica el original
                this.bestiarioPersonalizado = customData;
                // Cambiar la fuente activa al personalizado
                this.bestiarioActual = customData;
                this.fuenteBestiarioActual = 'personalizado';
                
                try {
                    // Opcional: guardar en servidor como respaldo
                    const url = `${this.baseUrl}/api/json/bestiario-personalizado`;
                    await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(customData)
                    });
                    console.log('✅ Bestiario personalizado guardado en servidor');
                } catch (serverError) {
                    console.warn('⚠️ No se pudo guardar en servidor:', serverError);
                    localStorage.setItem('customBestiary', JSON.stringify(customData));
                    localStorage.setItem('customBestiaryName', file.name);
                }
                
                this.generateBestiaryDenominaciones();
                this.setupBestiaryAutocomplete();
                this.updateBestiaryStatus('custom', file.name);
                this.showNotification(`Bestiario personalizado cargado: ${customData.length} criaturas`, 'success');
                
            } catch (error) {
                console.error('❌ Error:', error);
                this.showNotification(`Error: ${error.message}`, 'error');
            }
        };
        
        reader.readAsText(file);
    }
    
    restaurarBestiarioOriginal() {
        if (this.bestiarioOriginal) {
            // Restaurar desde la copia original (hacer copia para no modificar la referencia)
            this.bestiarioActual = JSON.parse(JSON.stringify(this.bestiarioOriginal));
            this.bestiarioPersonalizado = null;
            this.fuenteBestiarioActual = 'original';
            this.generateBestiaryDenominaciones();
            this.setupBestiaryAutocomplete();
            this.updateBestiaryStatus('original');
            
            localStorage.removeItem('customBestiary');
            localStorage.removeItem('customBestiaryName');
            
            this.showNotification('Bestiario original restaurado', 'info');
        } else {
            this.loadBestiarioOriginal();
        }
    }
    
    // Método para cambiar entre fuentes sin perder datos
    cambiarFuenteBestiario(fuente) {
        if (fuente === 'original' && this.bestiarioOriginal) {
            this.bestiarioActual = JSON.parse(JSON.stringify(this.bestiarioOriginal));
            this.fuenteBestiarioActual = 'original';
            this.generateBestiaryDenominaciones();
            this.setupBestiaryAutocomplete();
            this.updateBestiaryStatus('original');
            this.showNotification('Cambiado a bestiario original', 'info');
        } else if (fuente === 'personalizado' && this.bestiarioPersonalizado) {
            this.bestiarioActual = JSON.parse(JSON.stringify(this.bestiarioPersonalizado));
            this.fuenteBestiarioActual = 'personalizado';
            this.generateBestiaryDenominaciones();
            this.setupBestiaryAutocomplete();
            this.updateBestiaryStatus('custom', 'Bestiario personalizado');
            this.showNotification('Cambiado a bestiario personalizado', 'info');
        } else {
            this.showNotification('Fuente de bestiario no disponible', 'warning');
        }
    }
    
    updateBestiaryStatus(type, customName = '') {
        const titleElement = document.getElementById('bestiaryTitle');
        if (!titleElement) return;
        
        if (type === 'original') {
            titleElement.innerHTML = '<i class="fas fa-dragon"></i> Bestiario Original (D&D)';
            titleElement.style.color = 'white';
        } else {
            titleElement.innerHTML = `<i class="fas fa-star" style="color: var(--accent-gold);"></i> Personalizado: ${customName || 'Bestiario cargado'}`;
            titleElement.style.color = 'var(--accent-gold)';
        }
    }
    
    generateBestiaryDenominaciones() {
        // Usar la fuente actual para generar denominaciones
        if (!this.bestiarioActual) {
            this.bestiaryDenominaciones = [];
            return;
        }
        
        this.bestiaryDenominaciones = this.bestiarioActual.map(entry => ({
            text: entry.nombre,
            value: entry.nombre,
            entry: entry
        }));
        console.log(`Denominaciones generadas desde fuente: ${this.fuenteBestiarioActual} - ${this.bestiaryDenominaciones.length} criaturas`);
    }
    
    setupBestiaryAutocomplete() {
        const enemyRaceInput = document.getElementById('enemyRaceInput');
        if (!enemyRaceInput) return;
        
        let resultsList = document.getElementById('bestiarySearchResults');
        if (!resultsList) {
            resultsList = document.createElement('ul');
            resultsList.id = 'bestiarySearchResults';
            resultsList.className = 'search-results';
            
            resultsList.style.cssText = `
                position: absolute;
                top: 100%;
                left: 0;
                right: 0;
                max-height: 200px;
                overflow-y: auto;
                background: white;
                border: 2px solid var(--accent-gold);
                border-radius: 4px;
                list-style: none;
                padding: 0;
                margin: 0;
                z-index: 10000;
                display: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            
            if (enemyRaceInput.parentNode) {
                enemyRaceInput.parentNode.style.position = 'relative';
                enemyRaceInput.parentNode.appendChild(resultsList);
            }
        }
        
        const newInputHandler = (e) => {
            const searchTerm = enemyRaceInput.value.toLowerCase().trim();
            resultsList.innerHTML = '';
            
            if (searchTerm.length === 0) {
                resultsList.style.display = 'none';
                return;
            }
            
            const filteredDenominaciones = this.bestiaryDenominaciones.filter(item => {
                const itemText = item.text.toLowerCase();
                
                if (itemText === searchTerm) return true;
                if (itemText.startsWith(searchTerm)) return true;
                
                const words = itemText.split(/\s+/);
                if (words.some(word => word === searchTerm)) return true;
                if (words.some(word => word.startsWith(searchTerm))) return true;
                
                if (searchTerm.length >= 4 && itemText.includes(searchTerm)) return true;
                
                return false;
            });
            
            const limitedResults = filteredDenominaciones.slice(0, 10);
            
            if (limitedResults.length > 0) {
                limitedResults.forEach(item => {
                    const li = document.createElement('li');
                    
                    let highlightedText = item.text;
                    const regex = new RegExp(`(${searchTerm})`, 'gi');
                    highlightedText = item.text.replace(regex, '<span class="highlight">$1</span>');
                    
                    li.innerHTML = highlightedText;
                    li.style.cssText = `
                        padding: 10px 15px;
                        cursor: pointer;
                        border-bottom: 1px solid var(--parchment-dark);
                        font-family: 'Cinzel', serif;
                        transition: background 0.2s ease;
                    `;
                    
                    li.addEventListener('mouseover', () => {
                        li.style.background = 'var(--parchment-light)';
                    });
                    
                    li.addEventListener('mouseout', () => {
                        li.style.background = 'white';
                    });
                    
                    li.addEventListener('click', () => {
                        enemyRaceInput.value = item.text;
                        this.loadBestiaryDataForInput(item.value);
                        resultsList.style.display = 'none';
                    });
                    
                    resultsList.appendChild(li);
                });
                resultsList.style.display = 'block';
            } else {
                const li = document.createElement('li');
                li.textContent = 'No se encontraron resultados';
                li.style.cssText = `
                    padding: 10px 15px;
                    color: #999;
                    cursor: default;
                    font-style: italic;
                    font-family: 'Cinzel', serif;
                `;
                resultsList.appendChild(li);
                resultsList.style.display = 'block';
            }
        };
        
        enemyRaceInput.removeEventListener('input', this._boundInputHandler);
        this._boundInputHandler = newInputHandler;
        enemyRaceInput.addEventListener('input', this._boundInputHandler);
        
        const documentClickHandler = (e) => {
            if (e.target !== enemyRaceInput && !resultsList.contains(e.target)) {
                resultsList.style.display = 'none';
            }
        };
        
        document.removeEventListener('click', this._boundDocumentClickHandler);
        this._boundDocumentClickHandler = documentClickHandler;
        document.addEventListener('click', this._boundDocumentClickHandler);
        
        const keydownHandler = (e) => {
            const items = resultsList.getElementsByTagName('li');
            let selectedIndex = -1;
            
            for (let i = 0; i < items.length; i++) {
                if (items[i].classList.contains('selected')) {
                    selectedIndex = i;
                    items[i].classList.remove('selected');
                    items[i].style.background = 'white';
                    break;
                }
            }
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const nextIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
                items[nextIndex].classList.add('selected');
                items[nextIndex].style.background = 'var(--parchment-light)';
                items[nextIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
                items[prevIndex].classList.add('selected');
                items[prevIndex].style.background = 'var(--parchment-light)';
                items[prevIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && selectedIndex >= 0) {
                e.preventDefault();
                items[selectedIndex].click();
            }
        };
        
        enemyRaceInput.removeEventListener('keydown', this._boundKeydownHandler);
        this._boundKeydownHandler = keydownHandler;
        enemyRaceInput.addEventListener('keydown', this._boundKeydownHandler);
    }
    
    loadBestiaryDataForInput(creatureName) {
        const searchTerm = creatureName.toUpperCase().trim();
        
        // Buscar en la fuente actual del bestiario
        let bestiaryEntry = this.bestiarioActual.find(entry => 
            entry.nombre === searchTerm
        );
        
        if (!bestiaryEntry) {
            bestiaryEntry = this.bestiarioActual.find(entry => 
                entry.nombre.startsWith(searchTerm)
            );
        }
        
        if (!bestiaryEntry) {
            const searchWords = searchTerm.split(/\s+/);
            bestiaryEntry = this.bestiarioActual.find(entry => {
                const entryWords = entry.nombre.split(/\s+/);
                return searchWords.some(searchWord => 
                    entryWords.some(entryWord => entryWord === searchWord)
                );
            });
        }
        
        if (!bestiaryEntry && searchTerm.length >= 4) {
            bestiaryEntry = this.bestiarioActual.find(entry => 
                entry.nombre.includes(searchTerm)
            );
        }
        
        if (bestiaryEntry && bestiaryEntry.estadisticas) {
            const stats = bestiaryEntry.estadisticas;
            const enemyCAInput = document.getElementById('enemyCAInput');
            const enemyHPInput = document.getElementById('enemyHPInput');
            
            if (stats.ca && enemyCAInput && enemyCAInput.value === '') {
                const caMatch = stats.ca.toString().match(/\d+/);
                if (caMatch) {
                    enemyCAInput.value = caMatch[0];
                }
            }
            
            if (stats.pg && enemyHPInput && enemyHPInput.value === '') {
                const pgMatch = stats.pg.toString().match(/\d+/);
                if (pgMatch) {
                    enemyHPInput.value = pgMatch[0];
                }
            }
            
            const fuenteLabel = this.fuenteBestiarioActual === 'original' ? 'original' : 'personalizado';
            this.showNotification(`Datos de ${bestiaryEntry.nombre} precargados (bestiario ${fuenteLabel})`, 'success');
        }
    }
    
    getBestiaryImage(creatureName) {
        const searchTerm = creatureName.toUpperCase().trim();
        
        // Buscar en la fuente actual del bestiario
        let bestiaryEntry = this.bestiarioActual.find(entry => 
            entry.nombre === searchTerm
        );
        
        if (!bestiaryEntry) {
            bestiaryEntry = this.bestiarioActual.find(entry => 
                entry.nombre.startsWith(searchTerm)
            );
        }
        
        if (!bestiaryEntry) {
            const searchWords = searchTerm.split(/\s+/);
            bestiaryEntry = this.bestiarioActual.find(entry => {
                const entryWords = entry.nombre.split(/\s+/);
                return searchWords.some(searchWord => 
                    entryWords.some(entryWord => entryWord === searchWord)
                );
            });
        }
        
        if (bestiaryEntry && bestiaryEntry.img_url) {
            return bestiaryEntry.img_url;
        }
        
        return null;
    }
    
    async renderBestiaryModal(entry, entity = null) {
        let modal = document.getElementById('bestiaryModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'bestiaryModal';
            modal.className = 'bestiary-modal';
            modal.innerHTML = `
                <div class="bestiary-modal-content">
                    <span class="close-modal">&times;</span>
                    <div id="bestiaryModalBody"></div>
                    <div class="modal-footer" style="margin-top: 20px; display: flex; justify-content: space-between; align-items: center; gap: 10px;">
                        <div class="image-credit" style="font-size: 0.8rem; color: var(--ink-light); opacity: 0.7;">
                            <span id="imageSource"></span>
                        </div>
                        <div>
                            <button class="control-btn" id="applyBestiaryDataBtn" style="display: none;">
                                <i class="fas fa-check"></i> Aplicar a este enemigo
                            </button>
                        </div>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
            
            modal.querySelector('.close-modal').addEventListener('click', () => {
                modal.style.display = 'none';
            });
            
            window.addEventListener('click', (event) => {
                if (event.target === modal) {
                    modal.style.display = 'none';
                }
            });
        }
        
        const modalBody = document.getElementById('bestiaryModalBody');
        const applyBtn = document.getElementById('applyBestiaryDataBtn');
        const imageSource = document.getElementById('imageSource');
        
        if (!modalBody) return;
        
        modalBody.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 3rem; color: var(--accent-gold);"></i>
                <p>Cargando información...</p>
            </div>
        `;
        
        let imageUrl = this.getBestiaryImage(entry.nombre);
        
        let html = '';
        
        html += `<div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px;">`;
        if (imageUrl) {
            html += `
                <div style="width: 100%; max-height: 300px; overflow: hidden; border-radius: 8px; border: 2px solid var(--accent-gold); margin-bottom: 10px;">
                    <img src="${imageUrl}" alt="${entry.nombre}" style="width: 100%; height: auto; object-fit: contain; max-height: 300px;">
                </div>
            `;
        } else {
            html += `
                <div style="width: 100%; height: 200px; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; margin-bottom: 10px; border: 2px solid var(--accent-gold);">
                    <i class="fas fa-dragon" style="font-size: 4rem; margin-bottom: 10px; opacity: 0.8;"></i>
                    <p style="font-family: 'MedievalSharp', cursive;">${entry.nombre}</p>
                </div>
            `;
        }
        html += `</div>`;
        
        // Indicador de fuente del bestiario
        
        html += `<h2>${entry.nombre}</h2>`;
        
        if (entry.descripcion) {
        // Dividir por saltos de línea dobles (\n\n) para crear párrafos
        const parrafos = entry.descripcion.split(/\n\n/);
        html += `<div class="descripcion-container">`;
        parrafos.forEach(parrafo => {
            // Reemplazar saltos de línea simples con <br>
            const textoFormateado = parrafo.replace(/\n/g, '<br>');
            html += `<p><em>${textoFormateado}</em></p>`;
        });
        html += `</div>`;
    }

        if (entry.estadisticas && Object.keys(entry.estadisticas).length > 0) {
            const stats = entry.estadisticas;
            
            html += `<div class="stat-block">`;
            html += `<h3>Estadísticas</h3>`;
            
            if (stats.tipo) html += `<p><strong>Tipo:</strong> ${stats.tipo}</p>`;
            if (stats.ca) html += `<p><strong>CA:</strong> ${stats.ca}</p>`;
            if (stats.pg) html += `<p><strong>PG:</strong> ${stats.pg}</p>`;
            if (stats.pm) html += `<p><strong>PM:</strong> ${stats.pm}</p>`;
            if (stats.velocidad) html += `<p><strong>Velocidad:</strong> ${stats.velocidad}</p>`;
            
            html += `<div class="stat-grid">`;
            if (stats.FUE) html += `<div class="stat-item"><strong>FUE:</strong> ${stats.FUE}</div>`;
            if (stats.DES) html += `<div class="stat-item"><strong>DES:</strong> ${stats.DES}</div>`;
            if (stats.CON) html += `<div class="stat-item"><strong>CON:</strong> ${stats.CON}</div>`;
            if (stats.INT) html += `<div class="stat-item"><strong>INT:</strong> ${stats.INT}</div>`;
            if (stats.SAB) html += `<div class="stat-item"><strong>SAB:</strong> ${stats.SAB}</div>`;
            if (stats.CAR) html += `<div class="stat-item"><strong>CAR:</strong> ${stats.CAR}</div>`;
            html += `</div>`;
            
            if (stats.habilidades) html += `<p><strong>Habilidades:</strong> ${stats.habilidades}</p>`;
            if (stats.resistencias) html += `<p><strong>Resistencias:</strong> ${stats.resistencias}</p>`;
            if (stats.inmunidades_daño) html += `<p><strong>Inmunidades al daño:</strong> ${stats.inmunidades_daño}</p>`;
            if (stats.inmunidades_estados) html += `<p><strong>Inmunidades a estados:</strong> ${stats.inmunidades_estados}</p>`;
            if (stats.sentidos) html += `<p><strong>Sentidos:</strong> ${stats.sentidos}</p>`;
            if (stats.idiomas) html += `<p><strong>Idiomas:</strong> ${stats.idiomas}</p>`;
            if (stats.desafio) html += `<p><strong>Desafío:</strong> ${stats.desafio}</p>`;
            
            if (stats.atributos_especiales && stats.atributos_especiales.length > 0) {
                html += `<h4>Atributos Especiales</h4>`;
                stats.atributos_especiales.forEach(attr => {
                    html += `<p><strong>${attr.nombre}:</strong> ${attr.descripcion}</p>`;
                });
            }
            
            if (stats.acciones && stats.acciones.length > 0) {
                html += `<h4>Acciones</h4>`;
                stats.acciones.forEach(action => {
                    html += `<p><strong>${action.nombre}:</strong> ${action.descripcion}</p>`;
                });
            }
            
            if (stats.acciones_legendarias && stats.acciones_legendarias.length > 0) {
                html += `<h4>Acciones Legendarias</h4>`;
                stats.acciones_legendarias.forEach(action => {
                    html += `<p><strong>${action.nombre}:</strong> ${action.descripcion}</p>`;
                });
            }

            if (stats.reacciones && stats.reacciones.length > 0) {
                html += `<h4>reacciones</h4>`;
                stats.reacciones.forEach(attr => {
                    html += `<p><strong>${attr.nombre}:</strong> ${attr.descripcion}</p>`;
                });
            }
            
            if (stats.variantes && stats.variantes.length > 0) {
                html += `<div class="variants-section">`;
                html += `<h3 style="color: var(--accent-black); margin-top: 20px; border-top: 2px solid var(--accent-gold); padding-top: 15px;">Variantes</h3>`;
                
                stats.variantes.forEach((variante, index) => {
                    html += `<div class="variant-block" style="margin-bottom: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 8px; border-left: 3px solid var(--accent-gold);">`;
                    html += `<h4 style="color: var(--accent-black); margin-top: 0;">${variante.nombre}</h4>`;
                    if (variante.descripcion) {
                        html += `<p><em>${variante.descripcion}</em></p>`;
                    }
                    
                    if (variante.atributos_especiales && variante.atributos_especiales.length > 0) {
                        variante.atributos_especiales.forEach(attr => {
                            html += `<p><strong>${attr.nombre}:</strong> ${attr.descripcion}</p>`;
                        });
                    }
                    
                    if (variante.acciones && variante.acciones.length > 0) {
                        html += `<h5 style="margin-top: 10px;">Acciones</h5>`;
                        variante.acciones.forEach(action => {
                            html += `<p><strong>${action.nombre}:</strong> ${action.descripcion}</p>`;
                        });
                    }

                    if (variante.reacciones && variante.reacciones.length > 0) {
                        variante.reacciones.forEach(attr => {
                            html += `<p><strong>${attr.nombre}:</strong> ${attr.descripcion}</p>`;
                        });
                    }
                    
                    html += `</div>`;
                });
                
                html += `</div>`;
            }
            
            html += `</div>`;
        } else {
            html += `<p class="not-found"><i class="fas fa-dragon"></i><br>No hay estadísticas detalladas para esta criatura</p>`;
        }
        
        modalBody.innerHTML = html;
        
        if (entity && entity.type === 'enemy' && applyBtn) {
            applyBtn.style.display = 'inline-flex';
            
            const newApplyBtn = applyBtn.cloneNode(true);
            applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
            
            newApplyBtn.addEventListener('click', () => {
                this.applyBestiaryDataToEntity(entry, entity);
                modal.style.display = 'none';
            });
        } else if (applyBtn) {
            applyBtn.style.display = 'none';
        }
        
        modal.style.display = 'block';
    }
    
    applyBestiaryDataToEntity(bestiaryEntry, entity) {
        const stats = bestiaryEntry.estadisticas;
        if (!stats) {
            this.showNotification('El bestiario no tiene estadísticas para esta criatura', 'warning');
            return;
        }
        
        if (stats.ca) {
            const caMatch = stats.ca.toString().match(/\d+/);
            if (caMatch) {
                entity.ca = parseInt(caMatch[0]);
            }
        }
        
        if (stats.pg) {
            const pgMatch = stats.pg.toString().match(/\d+/);
            if (pgMatch) {
                entity.maxHp = parseInt(pgMatch[0]);
                entity.hp = entity.maxHp;
            }
        }
        
        if (stats.DES) {
            const dexMatch = stats.DES.toString().match(/\(([+-]\d+)\)/);
            if (dexMatch) {
                const dexBonus = parseInt(dexMatch[1]);
                entity.initiative = Math.floor(Math.random() * 20) + 1 + dexBonus;
            } else {
                const dexBaseMatch = stats.DES.toString().match(/\d+/);
                if (dexBaseMatch) {
                    const dexBase = parseInt(dexBaseMatch[0]);
                    const dexBonus = Math.floor((dexBase - 10) / 2);
                    entity.initiative = Math.floor(Math.random() * 20) + 1 + dexBonus;
                }
            }
        }
        
        this.updateEnemiesList();
        this.updateInitiativeOrder();
        
        this.showNotification(`Datos de ${bestiaryEntry.nombre} aplicados a ${entity.name}`, 'success');
    }
    
    async showBestiaryInfo(entity) {
        if (!entity.race && !entity.name) {
            this.showNotification('No hay información de raza disponible', 'warning');
            return;
        }
        
        const searchTerm = (entity.race || entity.name).toUpperCase().trim();
        
        // Buscar en la fuente actual del bestiario
        let bestiaryEntry = this.bestiarioActual.find(entry => 
            entry.nombre === searchTerm
        );
        
        if (!bestiaryEntry) {
            bestiaryEntry = this.bestiarioActual.find(entry => 
                entry.nombre.startsWith(searchTerm)
            );
        }
        
        if (!bestiaryEntry) {
            const searchWords = searchTerm.split(/\s+/);
            bestiaryEntry = this.bestiarioActual.find(entry => {
                const entryWords = entry.nombre.split(/\s+/);
                return searchWords.some(searchWord => 
                    entryWords.some(entryWord => entryWord === searchWord)
                );
            });
        }
        
        if (!bestiaryEntry) {
            this.showCustomSheetModal(entity);
            return;
        }
        
        this.currentBestiaryEntry = bestiaryEntry;
        this.renderBestiaryModal(bestiaryEntry, entity);
    }

    // ===== MÉTODO: Calcular HP desde bestiario =====
calcularHpDesdeBestiario(enemy) {
    if (!enemy.race) {
        console.warn(`⚠️ ${enemy.name} no tiene raza especificada`);
        return null;
    }
    
    const searchTerm = enemy.race.toUpperCase().trim();
    
    // Buscar en la fuente actual del bestiario
    let bestiaryEntry = this.bestiarioActual.find(entry => 
        entry.nombre === searchTerm
    );
    
    if (!bestiaryEntry) {
        bestiaryEntry = this.bestiarioActual.find(entry => 
            entry.nombre.startsWith(searchTerm)
        );
    }
    
    if (!bestiaryEntry) {
        const searchWords = searchTerm.split(/\s+/);
        bestiaryEntry = this.bestiarioActual.find(entry => {
            const entryWords = entry.nombre.split(/\s+/);
            return searchWords.some(searchWord => 
                entryWords.some(entryWord => entryWord === searchWord)
            );
        });
    }
    
    if (bestiaryEntry && bestiaryEntry.estadisticas && bestiaryEntry.estadisticas.pg) {
        const pgString = bestiaryEntry.estadisticas.pg.toString();
        console.log(`📖 Buscando HP para ${enemy.race}: "${pgString}"`);
        
        // Buscar patrón como "39 (6d10+6)" o "45 (4d8+2)" o "22 (5d8)"
        const diceMatch = pgString.match(/(\d+)d(\d+)(?:\s*\+\s*(\d+))?/i);
        
        if (diceMatch) {
            const numDice = parseInt(diceMatch[1]);
            const diceSides = parseInt(diceMatch[2]);
            const bonus = diceMatch[3] ? parseInt(diceMatch[3]) : 0;
            
            let total = 0;
            const rolls = [];
            for (let i = 0; i < numDice; i++) {
                const roll = Math.floor(Math.random() * diceSides) + 1;
                rolls.push(roll);
                total += roll;
            }
            total += bonus;
            
            console.log(`🎲 ${enemy.name} (${enemy.race}): ${numDice}d${diceSides}+${bonus} = [${rolls.join(' + ')}] + ${bonus} = ${total} PG`);
            return total;
        } else {
            // Si hay un número fijo (ej: "45" sin dados)
            const fixedMatch = pgString.match(/(\d+)/);
            if (fixedMatch) {
                const fixedValue = parseInt(fixedMatch[1]);
                console.log(`📊 ${enemy.name} (${enemy.race}): HP fijo = ${fixedValue} PG`);
                return fixedValue;
            }
        }
    } else {
        console.warn(`⚠️ No se encontró entrada en bestiario para: ${enemy.race}`);
    }
    
    return null;
}

// ===== MÉTODO: Tirar PG para todos los enemigos =====
rollAllEnemiesHp() {
    if (this.enemies.length === 0) {
        this.showNotification('No hay enemigos para tirar PG', 'warning');
        return;
    }
    
    let updatedCount = 0;
    const results = [];
    
    this.enemies.forEach(enemy => {
        if (enemy.type === 'enemy') {
            const newHp = this.calcularHpDesdeBestiario(enemy);
            
            if (newHp !== null && newHp > 0) {
                const oldHp = enemy.hp;
                const oldMaxHp = enemy.maxHp;
                
                enemy.maxHp = newHp;
                enemy.hp = newHp; // El HP actual también se actualiza al nuevo máximo
                
                results.push({
                    name: enemy.name,
                    race: enemy.race,
                    oldHp: oldMaxHp,
                    newHp: newHp
                });
                
                updatedCount++;
                console.log(`💚 ${enemy.name}: ${oldMaxHp} → ${newHp} PG`);
            } else {
                console.warn(`⚠️ No se pudo calcular HP para ${enemy.name} (raza: ${enemy.race || 'no especificada'})`);
            }
        }
    });
    
    if (updatedCount > 0) {
        // Actualizar las listas visuales
        this.updateEnemiesList();
        this.updateInitiativeOrder(); // Por si algún enemigo tenía HP modificado manualmente
        
        // Mostrar resumen
        let summary = `${updatedCount}/${this.enemies.length} enemigos actualizados:\n`;
        results.forEach(r => {
            summary += `• ${r.name}: ${r.oldHp} → ${r.newHp} PG\n`;
        });
        console.log(summary);
        
        const fuenteLabel = this.fuenteBestiarioActual === 'original' ? 'original' : 'personalizado';
        this.showNotification(`✅ ${updatedCount} enemigos con PG recalculados (bestiario ${fuenteLabel})`, 'success');
    } else {
        this.showNotification('No se pudo calcular HP para ningún enemigo. Verifica que tengan raza especificada y exista en el bestiario.', 'error');
    }
}
    
    rollAllEnemiesInitiative() {
        let updated = false;
        this.enemies.forEach(enemy => {
            if (enemy.type === 'enemy') {
                let dexBonus = 0;
                if (enemy.race) {
                    const searchTerm = enemy.race.toUpperCase().trim();
                    
                    // Buscar en la fuente actual del bestiario
                    let bestiaryEntry = this.bestiarioActual.find(entry => 
                        entry.nombre === searchTerm
                    );
                    
                    if (!bestiaryEntry) {
                        bestiaryEntry = this.bestiarioActual.find(entry => 
                            entry.nombre.startsWith(searchTerm)
                        );
                    }
                    
                    if (!bestiaryEntry) {
                        const searchWords = searchTerm.split(/\s+/);
                        bestiaryEntry = this.bestiarioActual.find(entry => {
                            const entryWords = entry.nombre.split(/\s+/);
                            return searchWords.some(searchWord => 
                                entryWords.some(entryWord => entryWord === searchWord)
                            );
                        });
                    }
                    
                    if (bestiaryEntry && bestiaryEntry.estadisticas && bestiaryEntry.estadisticas.DES) {
                        const stats = bestiaryEntry.estadisticas;
                        const dexMatch = stats.DES.toString().match(/\(([+-]\d+)\)/);
                        if (dexMatch) {
                            dexBonus = parseInt(dexMatch[1]);
                        } else {
                            const dexBaseMatch = stats.DES.toString().match(/\d+/);
                            if (dexBaseMatch) {
                                const dexBase = parseInt(dexBaseMatch[0]);
                                dexBonus = Math.floor((dexBase - 10) / 2);
                            }
                        }
                    }
                }
                
                enemy.initiative = Math.floor(Math.random() * 20) + 1 + dexBonus;
                updated = true;
            }
        });
        
        if (updated) {
            this.updateEnemiesList();
            this.updateInitiativeOrder();
            const fuenteLabel = this.fuenteBestiarioActual === 'original' ? 'original' : 'personalizado';
            this.showNotification(`Iniciativa tirada para todos los enemigos (usando bestiario ${fuenteLabel})`, 'success');
        } else {
            this.showNotification('No hay enemigos para tirar iniciativa', 'warning');
        }
    }
    
    // ========== FIN MÉTODOS MODIFICADOS DEL BESTIARIO ==========
    
    setupEventListeners() {
        document.querySelectorAll('.static-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchSection(e.target.closest('.static-menu-btn').dataset.section));
        });
        
        const newSessionBtn = document.getElementById('newSessionBtn');
        if (newSessionBtn) newSessionBtn.addEventListener('click', () => this.newSession());
        
        const saveSessionBtn = document.getElementById('saveSessionBtn');
        if (saveSessionBtn) saveSessionBtn.addEventListener('click', () => this.saveSession());
        
        const loadSessionBtn = document.getElementById('loadSessionBtn');
        if (loadSessionBtn) loadSessionBtn.addEventListener('click', () => this.loadSessionFromFile());
        
        const toggleCombatBtn = document.getElementById('toggleCombatBtn');
        if (toggleCombatBtn) toggleCombatBtn.addEventListener('click', () => this.toggleCombatMode());
        
        const addPlayerBtn = document.getElementById('addPlayerBtn');
        if (addPlayerBtn) addPlayerBtn.addEventListener('click', () => this.addPlayer());
        
        const playerNameInput = document.getElementById('playerNameInput');
        if (playerNameInput) {
            playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addPlayer();
            });
        }
        
        const addEnemyBtn = document.getElementById('addEnemyBtn');
        if (addEnemyBtn) addEnemyBtn.addEventListener('click', () => this.addEnemy());
        
        const enemyNameInput = document.getElementById('enemyNameInput');
        if (enemyNameInput) {
            enemyNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.addEnemy();
            });
        }
        
        const rollAllInitiative = document.getElementById('rollAllInitiative');
        if (rollAllInitiative) rollAllInitiative.addEventListener('click', () => this.rollAllEnemiesInitiative());

        const rollAllHpBtn = document.getElementById('rollAllHpBtn');
        if (rollAllHpBtn) rollAllHpBtn.addEventListener('click', () => this.rollAllEnemiesHp());

        
        const nextTurnBtn = document.getElementById('nextTurnBtn');
        if (nextTurnBtn) nextTurnBtn.addEventListener('click', () => this.nextTurn());
        
        const sortInitiative = document.getElementById('sortInitiative');
        if (sortInitiative) sortInitiative.addEventListener('click', () => this.sortInitiative());
        
        const clearOrder = document.getElementById('clearOrder');
        if (clearOrder) clearOrder.addEventListener('click', () => this.clearInitiativeOrder());
        
        const loadManualBtn = document.getElementById('loadManualBtn');
        if (loadManualBtn) {
            loadManualBtn.addEventListener('click', () => {
                document.getElementById('manualUpload').click();
            });
        }
        
        const uploadManualBtn = document.getElementById('uploadManualBtn');
        if (uploadManualBtn) {
            uploadManualBtn.addEventListener('click', () => {
                document.getElementById('manualUpload').click();
            });
        }
        
        const manualUpload = document.getElementById('manualUpload');
        if (manualUpload) {
            manualUpload.addEventListener('change', (e) => {
                this.loadPDF(e.target.files[0], 'manual');
            });
        }
        
        const clearManualBtn = document.getElementById('clearManualBtn');
        if (clearManualBtn) clearManualBtn.addEventListener('click', () => this.clearPDF('manual'));
        
        const loadBestiaryBtn = document.getElementById('loadBestiaryBtn');
        if (loadBestiaryBtn) {
            loadBestiaryBtn.addEventListener('click', () => {
                document.getElementById('bestiaryUpload').click();
            });
        }
        
        const uploadBestiaryBtn = document.getElementById('uploadBestiaryBtn');
        if (uploadBestiaryBtn) {
            uploadBestiaryBtn.addEventListener('click', () => {
                document.getElementById('bestiaryUpload').click();
            });
        }
        
        const bestiaryUpload = document.getElementById('bestiaryUpload');
        if (bestiaryUpload) {
            bestiaryUpload.addEventListener('change', (e) => {
                this.loadPDF(e.target.files[0], 'bestiary');
            });
        }
        
        const clearBestiaryBtn = document.getElementById('clearBestiaryBtn');
        if (clearBestiaryBtn) clearBestiaryBtn.addEventListener('click', () => this.clearPDF('bestiary'));
        
        const loadBestiaryJsonBtn = document.getElementById('loadBestiaryJsonBtn');
        if (loadBestiaryJsonBtn) {
            loadBestiaryJsonBtn.addEventListener('click', () => {
                document.getElementById('bestiaryJsonUpload').click();
            });
        }
        
        const bestiaryJsonUpload = document.getElementById('bestiaryJsonUpload');
        if (bestiaryJsonUpload) {
            bestiaryJsonUpload.addEventListener('change', (e) => {
                this.cargarBestiarioPersonalizado(e.target.files[0]);
                e.target.value = '';
            });
        }
        
        const resetBestiaryJsonBtn = document.getElementById('resetBestiaryJsonBtn');
        if (resetBestiaryJsonBtn) {
            resetBestiaryJsonBtn.addEventListener('click', () => {
                this.restaurarBestiarioOriginal();
            });
        }
        
        const loadCampaignBtn = document.getElementById('loadCampaignBtn');
        if (loadCampaignBtn) {
            loadCampaignBtn.addEventListener('click', () => {
                document.getElementById('campaignUpload').click();
            });
        }
        
        const uploadCampaignBtn = document.getElementById('uploadCampaignBtn');
        if (uploadCampaignBtn) {
            uploadCampaignBtn.addEventListener('click', () => {
                document.getElementById('campaignUpload').click();
            });
        }
        
        const campaignUpload = document.getElementById('campaignUpload');
        if (campaignUpload) {
            campaignUpload.addEventListener('change', (e) => {
                this.loadPDF(e.target.files[0], 'campaign');
            });
        }
        
        const clearCampaignBtn = document.getElementById('clearCampaignBtn');
        if (clearCampaignBtn) clearCampaignBtn.addEventListener('click', () => this.clearPDF('campaign'));
        
        const prevPageBtn = document.getElementById('prevPageBtn');
        if (prevPageBtn) prevPageBtn.addEventListener('click', () => this.changePDFPage('manual', -1));
        
        const nextPageBtn = document.getElementById('nextPageBtn');
        if (nextPageBtn) nextPageBtn.addEventListener('click', () => this.changePDFPage('manual', 1));
        
        const manualZoomInBtn = document.getElementById('manualZoomInBtn');
        if (manualZoomInBtn) manualZoomInBtn.addEventListener('click', () => this.zoomPDF('manual', 10));
        
        const manualZoomOutBtn = document.getElementById('manualZoomOutBtn');
        if (manualZoomOutBtn) manualZoomOutBtn.addEventListener('click', () => this.zoomPDF('manual', -10));
        
        const manualPageInput = document.getElementById('manualPageInput');
        if (manualPageInput) {
            manualPageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.goToPage('manual');
            });
        }
        
        const bestiaryPrevBtn = document.getElementById('bestiaryPrevBtn');
        if (bestiaryPrevBtn) bestiaryPrevBtn.addEventListener('click', () => this.changePDFPage('bestiary', -1));
        
        const bestiaryNextBtn = document.getElementById('bestiaryNextBtn');
        if (bestiaryNextBtn) bestiaryNextBtn.addEventListener('click', () => this.changePDFPage('bestiary', 1));
        
        const bestiaryZoomInBtn = document.getElementById('bestiaryZoomInBtn');
        if (bestiaryZoomInBtn) bestiaryZoomInBtn.addEventListener('click', () => this.zoomPDF('bestiary', 10));
        
        const bestiaryZoomOutBtn = document.getElementById('bestiaryZoomOutBtn');
        if (bestiaryZoomOutBtn) bestiaryZoomOutBtn.addEventListener('click', () => this.zoomPDF('bestiary', -10));
        
        const bestiaryPageInput = document.getElementById('bestiaryPageInput');
        if (bestiaryPageInput) {
            bestiaryPageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.goToPage('bestiary');
            });
        }
        
        const campaignPrevBtn = document.getElementById('campaignPrevBtn');
        if (campaignPrevBtn) campaignPrevBtn.addEventListener('click', () => this.changePDFPage('campaign', -1));
        
        const campaignNextBtn = document.getElementById('campaignNextBtn');
        if (campaignNextBtn) campaignNextBtn.addEventListener('click', () => this.changePDFPage('campaign', 1));
        
        const campaignZoomInBtn = document.getElementById('campaignZoomInBtn');
        if (campaignZoomInBtn) campaignZoomInBtn.addEventListener('click', () => this.zoomPDF('campaign', 10));
        
        const campaignZoomOutBtn = document.getElementById('campaignZoomOutBtn');
        if (campaignZoomOutBtn) campaignZoomOutBtn.addEventListener('click', () => this.zoomPDF('campaign', -10));
        
        const campaignPageInput = document.getElementById('campaignPageInput');
        if (campaignPageInput) {
            campaignPageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.goToPage('campaign');
            });
        }
        
        document.querySelectorAll('.notes-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchNotesTab(e.target.closest('.notes-tab').dataset.tab));
        });
        
        const dmNotesEditor = document.getElementById('dmNotesEditor');
        if (dmNotesEditor) {
            dmNotesEditor.addEventListener('input', (e) => {
                this.updateNotes(e.target.innerHTML);
                this.updateNotesStats();
            });
        }
        
        const saveNotesBtn = document.getElementById('saveNotesBtn');
        if (saveNotesBtn) saveNotesBtn.addEventListener('click', () => this.saveNotes());
        
        const exportNotesBtn = document.getElementById('exportNotesBtn');
        if (exportNotesBtn) exportNotesBtn.addEventListener('click', () => this.exportNotes());
        
        const rollDiceBtn = document.getElementById('rollDiceBtn');
        if (rollDiceBtn) rollDiceBtn.addEventListener('click', () => this.rollDice());
        
        const startTimerBtn = document.getElementById('startTimerBtn');
        if (startTimerBtn) startTimerBtn.addEventListener('click', () => this.startTimer());
        
        const pauseTimerBtn = document.getElementById('pauseTimerBtn');
        if (pauseTimerBtn) pauseTimerBtn.addEventListener('click', () => this.pauseTimer());
        
        const resetTimerBtn = document.getElementById('resetTimerBtn');
        if (resetTimerBtn) resetTimerBtn.addEventListener('click', () => this.resetTimer());
        
        const playersList = document.getElementById('playersList');
        if (playersList) playersList.addEventListener('click', (e) => this.handleEntityClick(e, 'player'));
        
        const enemiesList = document.getElementById('enemiesList');
        if (enemiesList) enemiesList.addEventListener('click', (e) => this.handleEntityClick(e, 'enemy'));
        
        const initiativeOrder = document.getElementById('initiativeOrder');
        if (initiativeOrder) initiativeOrder.addEventListener('click', (e) => this.handleInitiativeClick(e));

        const addSummonBtn = document.getElementById('addSummonBtn');
        if (addSummonBtn) {
            addSummonBtn.addEventListener('click', () => this.addSummon());
        }

        // Actualizar la lista de invocadores cuando cambien los jugadores
        this.updateSummonInvocadoresList();
        
        setTimeout(() => {
            this.setupJugadoresAutocomplete();
        }, 500);
    }

    updateSummonInvocadoresList() {
    const select = document.getElementById('summonInvocadorSelect');
    if (!select) return;
    
    // Guardar valor seleccionado actual
    const currentValue = select.value;
    
    // Limpiar opciones
    select.innerHTML = '<option value="">Seleccionar invocador</option>';
    
    // Agregar jugadores (excluyendo invocaciones)
    this.players
        .filter(p => p.type === 'player')
        .forEach(player => {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = `${player.name} (Iniciativa: ${player.initiative})`;
            select.appendChild(option);
        });
    
    // Restaurar selección si existe
    if (currentValue && this.players.some(p => p.id === currentValue)) {
        select.value = currentValue;
    }
}
    
    setupDrawingCanvas() {
        const canvas = document.getElementById('dmCanvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        let drawing = false;
        let lastX = 0;
        let lastY = 0;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        const colorPicker = document.getElementById('canvasColorPicker');
        if (colorPicker) {
            colorPicker.addEventListener('input', (e) => {
                ctx.strokeStyle = e.target.value;
            });
        }

        const colorBtn = document.getElementById('canvasColorBtn');
        if (colorBtn) {
            colorBtn.addEventListener('click', () => {
                if (colorPicker) colorPicker.click();
            });
        }

        const getCoordinates = (e) => {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            
            let clientX, clientY;
            
            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            
            let x = (clientX - rect.left) * scaleX;
            let y = (clientY - rect.top) * scaleY;
            
            x = Math.max(0, Math.min(canvas.width, x));
            y = Math.max(0, Math.min(canvas.height, y));
            
            return { x, y };
        };

        const startDrawing = (e) => {
            e.preventDefault();
            drawing = true;
            
            const coords = getCoordinates(e);
            lastX = coords.x;
            lastY = coords.y;
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
        };

        const draw = (e) => {
            if (!drawing) return;
            e.preventDefault();

            const coords = getCoordinates(e);
            
            ctx.beginPath();
            ctx.moveTo(lastX, lastY);
            ctx.lineTo(coords.x, coords.y);
            ctx.stroke();

            lastX = coords.x;
            lastY = coords.y;
        };

        const stopDrawing = (e) => {
            if (e) e.preventDefault();
            drawing = false;
            ctx.beginPath();
        };

        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);

        canvas.addEventListener('touchstart', startDrawing, { passive: false });
        canvas.addEventListener('touchmove', draw, { passive: false });
        canvas.addEventListener('touchend', stopDrawing);
        canvas.addEventListener('touchcancel', stopDrawing);

        canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        const clearBtn = document.getElementById('canvasClearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            });
        }

        const saveBtn = document.getElementById('canvasSaveBtn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const link = document.createElement('a');
                link.download = `dm-drawing-${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                
                this.showNotification('Dibujo guardado como PNG', 'success');
            });
        }
    }
    
    loadSessionFromFile() {
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json';
        fileInput.style.display = 'none';
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const sessionData = JSON.parse(event.target.result);
                    this.loadSessionData(sessionData);
                    this.showNotification('Sesión cargada desde archivo', 'success');
                } catch (error) {
                    console.error('Error al cargar archivo:', error);
                    this.showNotification('Error al cargar el archivo de sesión', 'error');
                }
            };
            reader.readAsText(file);
            
            document.body.removeChild(fileInput);
        });
        
        document.body.appendChild(fileInput);
        fileInput.click();
    }
    
    setupPDFJS() {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    
    switchSection(sectionId) {
        document.querySelectorAll('.dm-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const targetSection = document.getElementById(`${sectionId}Section`);
        if (targetSection) targetSection.classList.add('active');
        
        document.querySelectorAll('.static-menu-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`.static-menu-btn[data-section="${sectionId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
    }
    
    addPlayer() {
        const name = document.getElementById('playerNameInput')?.value.trim();
        const initiative = parseInt(document.getElementById('playerInitiativeInput')?.value) || 0;
        const ca = parseInt(document.getElementById('playerCAInput')?.value) || 0;
        const hp = parseInt(document.getElementById('playerHPInput')?.value) || 0;
        
        if (!name) {
            this.showNotification('Introduce un nombre para el jugador', 'warning');
            return;
        }
        
        const playerNameInput = document.getElementById('playerNameInput');
        const playerInitiativeInput = document.getElementById('playerInitiativeInput');
        const playerCAInput = document.getElementById('playerCAInput');
        const playerHPInput = document.getElementById('playerHPInput');
        
        if (playerNameInput) playerNameInput.value = '';
        if (playerInitiativeInput) playerInitiativeInput.value = '';
        if (playerCAInput) playerCAInput.value = '';
        if (playerHPInput) playerHPInput.value = '';
        
        const player = {
            id: `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            initiative: initiative,
            ca: ca,
            hp: hp,
            maxHp: hp,
            type: 'player'
        };
        
        this.players.push(player);
        this.updatePlayersList();
        this.updateFooter();
        this.updateInitiativeOrder();
        
        this.showNotification(`Jugador "${name}" añadido`, 'success');
    }
    
    addEnemy() {
        const nameInput = document.getElementById('enemyNameInput')?.value.trim();
        const race = document.getElementById('enemyRaceInput')?.value.trim();
        const ca = parseInt(document.getElementById('enemyCAInput')?.value) || 0;
        const hp = parseInt(document.getElementById('enemyHPInput')?.value) || 0;
        
        if (!nameInput) {
            this.showNotification('Introduce un nombre para el enemigo', 'warning');
            return;
        }
        
        let baseName = nameInput;
        let quantity = 1;
        
        const asteriskIndex = nameInput.indexOf('*');
        if (asteriskIndex !== -1) {
            baseName = nameInput.substring(0, asteriskIndex).trim();
            const quantityStr = nameInput.substring(asteriskIndex + 1).trim();
            const parsedQuantity = parseInt(quantityStr);
            
            if (!isNaN(parsedQuantity) && parsedQuantity > 0 && parsedQuantity <= 50) {
                quantity = parsedQuantity;
            } else {
                this.showNotification('Cantidad inválida (debe ser un número entre 1 y 50). Se usará 1.', 'warning');
            }
        }
        
        if (!baseName) {
            this.showNotification('Introduce un nombre válido para el enemigo', 'warning');
            return;
        }
        
        let enemiesCreated = 0;
        
        for (let i = 0; i < quantity; i++) {
            let initiative = Math.floor(Math.random() * 20) + 1;
            let finalCA = ca;
            let finalHP = hp;
            let finalMaxHp = hp;
            
            if (race && i === 0) {
                const searchTerm = race.toUpperCase().trim();
                
                // Buscar en la fuente actual del bestiario
                let bestiaryEntry = this.bestiarioActual.find(entry => 
                    entry.nombre === searchTerm
                );
                
                if (!bestiaryEntry) {
                    bestiaryEntry = this.bestiarioActual.find(entry => 
                        entry.nombre.startsWith(searchTerm)
                    );
                }
                
                if (!bestiaryEntry) {
                    const searchWords = searchTerm.split(/\s+/);
                    bestiaryEntry = this.bestiarioActual.find(entry => {
                        const entryWords = entry.nombre.split(/\s+/);
                        return searchWords.some(searchWord => 
                            entryWords.some(entryWord => entryWord === searchWord)
                        );
                    });
                }
                
                if (!bestiaryEntry && searchTerm.length >= 4) {
                    bestiaryEntry = this.bestiarioActual.find(entry => 
                        entry.nombre.includes(searchTerm)
                    );
                }
                
                if (bestiaryEntry && bestiaryEntry.estadisticas) {
                    const stats = bestiaryEntry.estadisticas;
                    
                    const enemyCAInput = document.getElementById('enemyCAInput');
                    const enemyHPInput = document.getElementById('enemyHPInput');
                    
                    if (enemyCAInput && enemyCAInput.value === '') {
                        if (stats.ca) {
                            const caMatch = stats.ca.toString().match(/\d+/);
                            if (caMatch) finalCA = parseInt(caMatch[0]);
                        }
                    }
                    
                    if (enemyHPInput && enemyHPInput.value === '') {
                        if (stats.pg) {
                            const pgMatch = stats.pg.toString().match(/\d+/);
                            if (pgMatch) {
                                finalHP = parseInt(pgMatch[0]);
                                finalMaxHp = finalHP;
                            }
                        }
                    }
                    
                    if (stats.DES) {
                        const dexMatch = stats.DES.toString().match(/\(([+-]\d+)\)/);
                        if (dexMatch) {
                            const dexBonus = parseInt(dexMatch[1]);
                            initiative = Math.floor(Math.random() * 20) + 1 + dexBonus;
                        } else {
                            const dexBaseMatch = stats.DES.toString().match(/\d+/);
                            if (dexBaseMatch) {
                                const dexBase = parseInt(dexBaseMatch[0]);
                                const dexBonus = Math.floor((dexBase - 10) / 2);
                                initiative = Math.floor(Math.random() * 20) + 1 + dexBonus;
                            }
                        }
                    }
                }
            }
            
            let enemyName = baseName;
            if (quantity > 1) {
                enemyName = `${baseName} ${i + 1}`;
            }
            
            const enemy = {
                id: `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}_${i}`,
                name: enemyName,
                race: race,
                initiative: initiative,
                ca: finalCA,
                hp: finalHP || 10,
                maxHp: finalMaxHp || 10,
                tempHp: 0,
                type: 'enemy'
            };
            
            this.enemies.push(enemy);
            enemiesCreated++;
        }
        
        const enemyNameInput = document.getElementById('enemyNameInput');
        const enemyRaceInput = document.getElementById('enemyRaceInput');
        const enemyCAInput = document.getElementById('enemyCAInput');
        const enemyHPInput = document.getElementById('enemyHPInput');
        
        if (enemyNameInput) enemyNameInput.value = '';
        if (enemyRaceInput) enemyRaceInput.value = '';
        if (enemyCAInput) enemyCAInput.value = '';
        if (enemyHPInput) enemyHPInput.value = '';
        
        this.updateEnemiesList();
        this.updateFooter();
        this.updateInitiativeOrder();
        
        if (enemiesCreated > 1) {
            this.showNotification(`${enemiesCreated} enemigos "${baseName}" añadidos`, 'success');
        } else {
            this.showNotification(`Enemigo "${baseName}" añadido (Iniciativa: ${this.enemies[this.enemies.length - 1].initiative})`, 'success');
        }
    }

    showCustomSheetModal(entity) {
    let modal = document.getElementById('customSheetModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customSheetModal';
        modal.className = 'custom-sheet-modal';
        modal.innerHTML = `
            <div class="custom-sheet-modal-content">
                <span class="close-modal">&times;</span>
                <div class="section-header" style="background: linear-gradient(90deg, var(--accent-gold), var(--accent-blue)); padding: 15px 25px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--accent-gold); border-radius: 8px 8px 0 0;">
                    <h2 id="customSheetTitle" style="font-family: 'MedievalSharp', cursive; color: white; font-size: 1.4rem; display: flex; align-items: center; gap: 10px; text-shadow: 1px 1px 3px rgba(0, 0, 0, 0.3); margin: 0;">
                        <i class="fas fa-file-pdf"></i> Ficha Personalizada
                    </h2>
                    <div class="section-controls" style="display: flex; gap: 10px;">
                        <input type="file" id="customSheetFileInput" accept=".pdf" style="display: none;">
                        <button class="section-btn" id="customSheetUploadBtn" style="padding: 8px 16px; background: var(--accent-blue); color: white; border: none; border-radius: 4px; font-family: 'Cinzel', serif; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; transition: all 0.3s ease;">
                            <i class="fas fa-file-upload"></i> Cargar PDF
                        </button>
                        <button class="section-btn" id="customSheetRemovePdf" style="padding: 8px 16px; background: var(--accent-red); color: white; border: none; border-radius: 4px; font-family: 'Cinzel', serif; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; transition: all 0.3s ease;">
                            <i class="fas fa-trash"></i> Limpiar
                        </button>
                        <button class="section-btn" id="customSheetCloseBtn" style="padding: 8px 16px; background: #666; color: white; border: none; border-radius: 4px; font-family: 'Cinzel', serif; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.9rem; transition: all 0.3s ease;">
                            <i class="fas fa-times"></i> Cerrar
                        </button>
                    </div>
                </div>
                
                <div class="custom-sheet-info" style="text-align: center; padding: 15px; background: rgba(212, 175, 55, 0.1); border-bottom: 1px solid var(--accent-gold);">
                    <p style="color: var(--ink-dark); margin: 8px 0;">
                        <i class="fas fa-info-circle" style="color: var(--accent-gold); margin-right: 8px;"></i> 
                        No se encontró información para: <strong id="customSheetEntityName" style="color: var(--accent-purple);"></strong>
                    </p>
                </div>
                
                <div class="pdf-container" style="flex: 1; display: flex; flex-direction: column; overflow: hidden; background: var(--parchment-light);">
                    <!-- Barra de herramientas del PDF -->
                    <div class="pdf-toolbar" style="background: linear-gradient(90deg, var(--accent-blue), var(--accent-purple)); padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid var(--accent-gold);">
                        <div class="pdf-info" style="display: flex; align-items: center; gap: 30px; color: white;">
                            <span id="customSheetPdfTitle" style="font-weight: bold; font-size: 1.1rem;">No hay PDF cargado</span>
                            <div class="page-input-group" style="display: flex; align-items: center; gap: 5px;">
                                <span class="page-info" style="background: rgba(255, 255, 255, 0.2); padding: 5px 15px; border-radius: 20px; font-size: 0.9rem;">Página: </span>
                                <input type="number" id="customSheetPageInput" class="page-input" min="1" value="1" disabled style="width: 50px; padding: 3px 5px; border: 1px solid white; border-radius: 4px; background: rgba(255, 255, 255, 0.2); color: white; text-align: center; font-family: 'Cinzel', serif;">
                                <span class="page-info" style="background: rgba(255, 255, 255, 0.2); padding: 5px 15px; border-radius: 20px; font-size: 0.9rem;">/ <span id="customSheetTotalPages">-</span></span>
                            </div>
                        </div>
                        <div class="pdf-controls" style="display: flex; align-items: center; gap: 15px;">
                            <button class="pdf-control-btn" id="customSheetPrevBtn" disabled style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: 1px solid white; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;">
                                <i class="fas fa-chevron-left"></i>
                            </button>
                            <button class="pdf-control-btn" id="customSheetNextBtn" disabled style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: 1px solid white; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;">
                                <i class="fas fa-chevron-right"></i>
                            </button>
                            <div class="zoom-controls" style="display: flex; align-items: center; gap: 10px;">
                                <button class="pdf-control-btn" id="customSheetZoomOutBtn" disabled style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: 1px solid white; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;">
                                    <i class="fas fa-search-minus"></i>
                                </button>
                                <span class="zoom-level" id="customSheetZoomLevel" style="color: white; font-weight: bold; min-width: 50px; text-align: center;">100%</span>
                                <button class="pdf-control-btn" id="customSheetZoomInBtn" disabled style="width: 40px; height: 40px; border-radius: 50%; background: rgba(255, 255, 255, 0.2); border: 1px solid white; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;">
                                    <i class="fas fa-search-plus"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Visor PDF -->
                    <div class="pdf-viewer" id="customSheetPdfViewer" style="flex: 1; background: var(--parchment-light); overflow: auto; padding: 20px; display: flex; justify-content: center; align-items: center;">
                        <div class="pdf-placeholder" id="customSheetPlaceholder" style="text-align: center; color: var(--ink-light); max-width: 400px;">
                            <i class="fas fa-file-pdf" style="font-size: 4rem; color: var(--accent-gold); opacity: 0.7; margin-bottom: 20px;"></i>
                            <h3 style="color: var(--accent-blue); margin-bottom: 15px; font-family: 'MedievalSharp', cursive;">Ficha Personalizada</h3>
                            <p style="margin-bottom: 20px; font-size: 1.1rem;">Carga un PDF con la ficha de esta criatura</p>
                            <button class="upload-btn" id="customSheetPlaceholderUploadBtn" style="padding: 12px 30px; background: linear-gradient(145deg, var(--accent-blue), var(--accent-purple)); color: white; border: none; border-radius: 6px; font-family: 'Cinzel', serif; font-size: 1rem; cursor: pointer; display: inline-flex; align-items: center; gap: 10px; margin-bottom: 15px;">
                                <i class="fas fa-cloud-upload-alt"></i> Seleccionar PDF
                            </button>
                            <p class="placeholder-hint" style="font-size: 0.9rem; opacity: 0.7;">Formatos soportados: .pdf</p>
                        </div>
                        <canvas id="customSheetCanvas" style="display: none; max-width: 100%; border: 1px solid var(--accent-gold); border-radius: 8px; background: white; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);"></canvas>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Eventos de cierre
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    // Actualizar título y nombre
    const title = document.getElementById('customSheetTitle');
    const entityName = document.getElementById('customSheetEntityName');
    const pdfTitle = document.getElementById('customSheetPdfTitle');
    if (title) title.innerHTML = `<i class="fas fa-file-pdf"></i> Ficha Personalizada - ${entity.name}`;
    if (entityName) entityName.textContent = entity.race || entity.name;
    if (pdfTitle) pdfTitle.textContent = 'No hay PDF cargado';
    
    // Guardar referencia al enemigo
    modal._entity = entity;
    modal._entityId = entity.id;
    modal._customSheetPdfData = null; // Para almacenar datos del PDF
    
    // Verificar si ya hay un PDF cargado para este enemigo
    const entityKey = entity.id || entity.name;
    if (this.enemyCustomSheets[entityKey]) {
        this.loadCustomSheetPdf(entityKey);
    } else {
        // Mostrar placeholder
        this.showCustomSheetPlaceholder();
    }
    
    // Configurar eventos
    this.setupCustomSheetEvents(entity);
    
    // Mostrar el modal
    modal.style.display = 'block';
}

showCustomSheetPlaceholder() {
    const placeholder = document.getElementById('customSheetPlaceholder');
    const canvas = document.getElementById('customSheetCanvas');
    const pdfTitle = document.getElementById('customSheetPdfTitle');
    const pageInput = document.getElementById('customSheetPageInput');
    const totalPages = document.getElementById('customSheetTotalPages');
    const zoomLevel = document.getElementById('customSheetZoomLevel');
    
    if (placeholder) placeholder.style.display = 'block';
    if (canvas) canvas.style.display = 'none';
    if (pdfTitle) pdfTitle.textContent = 'No hay PDF cargado';
    if (pageInput) {
        pageInput.value = '1';
        pageInput.disabled = true;
    }
    if (totalPages) totalPages.textContent = '-';
    if (zoomLevel) zoomLevel.textContent = '100%';
    
    // Deshabilitar controles
    this.toggleCustomSheetControls(false);
}

toggleCustomSheetControls(enabled) {
    const controls = [
        'customSheetPrevBtn',
        'customSheetNextBtn',
        'customSheetZoomInBtn',
        'customSheetZoomOutBtn',
        'customSheetPageInput'
    ];
    
    controls.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.disabled = !enabled;
            if (id === 'customSheetPageInput') {
                el.readOnly = !enabled;
            }
        }
    });
}
setupCustomSheetEvents(entity) {
    const entityKey = entity.id || entity.name;
    
    // Botón de carga desde el placeholder
    const placeholderUploadBtn = document.getElementById('customSheetPlaceholderUploadBtn');
    if (placeholderUploadBtn) {
        const newBtn = placeholderUploadBtn.cloneNode(true);
        placeholderUploadBtn.parentNode.replaceChild(newBtn, placeholderUploadBtn);
        newBtn.addEventListener('click', () => {
            document.getElementById('customSheetFileInput').click();
        });
    }
    
    // Botón de carga desde la barra de herramientas
    const uploadBtn = document.getElementById('customSheetUploadBtn');
    if (uploadBtn) {
        const newUploadBtn = uploadBtn.cloneNode(true);
        uploadBtn.parentNode.replaceChild(newUploadBtn, uploadBtn);
        newUploadBtn.addEventListener('click', () => {
            document.getElementById('customSheetFileInput').click();
        });
    }
    
    // Input file
    const fileInput = document.getElementById('customSheetFileInput');
    if (fileInput) {
        const newFileInput = fileInput.cloneNode(true);
        fileInput.parentNode.replaceChild(newFileInput, fileInput);
        newFileInput.addEventListener('change', (e) => {
            this.loadCustomSheetPdfFromFile(e.target.files[0], entity);
            e.target.value = '';
        });
    }
    
    // Botón eliminar
    const removeBtn = document.getElementById('customSheetRemovePdf');
    if (removeBtn) {
        const newRemoveBtn = removeBtn.cloneNode(true);
        removeBtn.parentNode.replaceChild(newRemoveBtn, removeBtn);
        newRemoveBtn.addEventListener('click', () => {
            if (confirm('¿Eliminar esta ficha personalizada?')) {
                delete this.enemyCustomSheets[entityKey];
                this.saveCustomSheetsToStorage();
                this.showCustomSheetPlaceholder();
                this.showNotification('Ficha eliminada', 'warning');
            }
        });
    }
    
    // Botón cerrar
    const closeBtn = document.getElementById('customSheetCloseBtn');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        newCloseBtn.addEventListener('click', () => {
            document.getElementById('customSheetModal').style.display = 'none';
        });
    }
    
    // Controles de página
    this.setupCustomSheetPdfControls(entity);
    
    // Controles de zoom
    const zoomInBtn = document.getElementById('customSheetZoomInBtn');
    if (zoomInBtn) {
        const newZoomIn = zoomInBtn.cloneNode(true);
        zoomInBtn.parentNode.replaceChild(newZoomIn, zoomInBtn);
        newZoomIn.addEventListener('click', () => {
            const sheetData = this.enemyCustomSheets[entityKey];
            if (!sheetData) return;
            sheetData.zoom = Math.min(300, (sheetData.zoom || 100) + 10);
            this.renderCustomSheetPdf(entityKey);
            this.saveCustomSheetsToStorage();
            const zoomLevel = document.getElementById('customSheetZoomLevel');
            if (zoomLevel) zoomLevel.textContent = `${sheetData.zoom}%`;
        });
    }
    
    const zoomOutBtn = document.getElementById('customSheetZoomOutBtn');
    if (zoomOutBtn) {
        const newZoomOut = zoomOutBtn.cloneNode(true);
        zoomOutBtn.parentNode.replaceChild(newZoomOut, zoomOutBtn);
        newZoomOut.addEventListener('click', () => {
            const sheetData = this.enemyCustomSheets[entityKey];
            if (!sheetData) return;
            sheetData.zoom = Math.max(50, (sheetData.zoom || 100) - 10);
            this.renderCustomSheetPdf(entityKey);
            this.saveCustomSheetsToStorage();
            const zoomLevel = document.getElementById('customSheetZoomLevel');
            if (zoomLevel) zoomLevel.textContent = `${sheetData.zoom}%`;
        });
    }
    
    // Input de página
    const pageInput = document.getElementById('customSheetPageInput');
    if (pageInput) {
        const newPageInput = pageInput.cloneNode(true);
        pageInput.parentNode.replaceChild(newPageInput, pageInput);
        newPageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const sheetData = this.enemyCustomSheets[entityKey];
                if (!sheetData) return;
                const pageNum = parseInt(newPageInput.value);
                if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= sheetData.totalPages) {
                    sheetData.currentPage = pageNum;
                    this.renderCustomSheetPdf(entityKey);
                    this.saveCustomSheetsToStorage();
                } else {
                    newPageInput.value = sheetData.currentPage;
                    this.showNotification(`Página válida: 1-${sheetData.totalPages}`, 'warning');
                }
            }
        });
    }
}

async loadCustomSheetPdfFromFile(file, entity) {
    if (!file || !file.type.includes('pdf')) {
        this.showNotification('Por favor, selecciona un archivo PDF válido', 'error');
        return;
    }
    
    try {
        this.showNotification(`Cargando ficha: ${file.name}...`, 'info');
        
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        // Guardar en el almacenamiento del enemigo
        const entityKey = entity.id || entity.name;
        this.enemyCustomSheets[entityKey] = {
            data: arrayBuffer,
            name: file.name,
            totalPages: pdf.numPages,
            currentPage: 1,
            zoom: 100,
            pdf: pdf
        };
        
        // Actualizar UI
        const pdfTitle = document.getElementById('customSheetPdfTitle');
        if (pdfTitle) pdfTitle.textContent = file.name;
        
        const placeholder = document.getElementById('customSheetPlaceholder');
        const canvas = document.getElementById('customSheetCanvas');
        if (placeholder) placeholder.style.display = 'none';
        if (canvas) canvas.style.display = 'block';
        
        const totalPages = document.getElementById('customSheetTotalPages');
        if (totalPages) totalPages.textContent = pdf.numPages;
        
        const pageInput = document.getElementById('customSheetPageInput');
        if (pageInput) {
            pageInput.value = 1;
            pageInput.disabled = false;
            pageInput.max = pdf.numPages;
        }
        
        const zoomLevel = document.getElementById('customSheetZoomLevel');
        if (zoomLevel) zoomLevel.textContent = '100%';
        
        // Habilitar controles
        this.toggleCustomSheetControls(true);
        
        // Renderizar primera página
        await this.renderCustomSheetPdf(entityKey);
        
        this.showNotification(`Ficha cargada: ${file.name}`, 'success');
        
        // Guardar en localStorage para persistencia
        this.saveCustomSheetsToStorage();
        
    } catch (error) {
        console.error('Error al cargar ficha:', error);
        this.showNotification('Error al cargar el PDF', 'error');
    }
}

async loadCustomSheetPdf(entityKey) {
    const sheetData = this.enemyCustomSheets[entityKey];
    if (!sheetData) return;
    
    try {
        // Si tenemos el arrayBuffer guardado
        if (sheetData.data) {
            // Actualizar UI
            const pdfTitle = document.getElementById('customSheetPdfTitle');
            if (pdfTitle) pdfTitle.textContent = sheetData.name || 'Ficha personalizada';
            
            const placeholder = document.getElementById('customSheetPlaceholder');
            const canvas = document.getElementById('customSheetCanvas');
            if (placeholder) placeholder.style.display = 'none';
            if (canvas) canvas.style.display = 'block';
            
            const totalPages = document.getElementById('customSheetTotalPages');
            if (totalPages) totalPages.textContent = sheetData.totalPages || 1;
            
            const pageInput = document.getElementById('customSheetPageInput');
            if (pageInput) {
                pageInput.value = sheetData.currentPage || 1;
                pageInput.disabled = false;
                pageInput.max = sheetData.totalPages || 1;
            }
            
            const zoomLevel = document.getElementById('customSheetZoomLevel');
            if (zoomLevel) zoomLevel.textContent = `${sheetData.zoom || 100}%`;
            
            // Habilitar controles
            this.toggleCustomSheetControls(true);
            
            // Cargar el PDF
            const pdf = await pdfjsLib.getDocument({ data: sheetData.data }).promise;
            sheetData.pdf = pdf;
            sheetData.totalPages = pdf.numPages;
            this.enemyCustomSheets[entityKey] = sheetData;
            
            await this.renderCustomSheetPdf(entityKey);
        }
    } catch (error) {
        console.error('Error al cargar PDF guardado:', error);
    }
}

async renderCustomSheetPdf(entityKey) {
    const sheetData = this.enemyCustomSheets[entityKey];
    if (!sheetData || !sheetData.pdf) {
        // Si no hay pdf, intentar cargar desde datos
        if (sheetData && sheetData.data) {
            try {
                const pdf = await pdfjsLib.getDocument({ data: sheetData.data }).promise;
                sheetData.pdf = pdf;
                sheetData.totalPages = pdf.numPages;
                this.enemyCustomSheets[entityKey] = sheetData;
            } catch (error) {
                console.error('Error al cargar PDF desde datos:', error);
                return;
            }
        } else {
            return;
        }
    }
    
    try {
        const page = await sheetData.pdf.getPage(sheetData.currentPage || 1);
        const canvas = document.getElementById('customSheetCanvas');
        
        if (!canvas) return;
        
        const context = canvas.getContext('2d');
        const scale = (sheetData.zoom || 100) / 100;
        const viewport = page.getViewport({ scale: scale });
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;
        
        // Actualizar info de página
        const pageInfo = document.getElementById('customSheetPageInput');
        if (pageInfo) {
            pageInfo.value = sheetData.currentPage || 1;
        }
        
        const totalPages = document.getElementById('customSheetTotalPages');
        if (totalPages) {
            totalPages.textContent = sheetData.totalPages || 1;
        }
        
        const zoomLevel = document.getElementById('customSheetZoomLevel');
        if (zoomLevel) {
            zoomLevel.textContent = `${sheetData.zoom || 100}%`;
        }
        
    } catch (error) {
        console.error('Error al renderizar ficha:', error);
    }
}
setupCustomSheetPdfControls(entity) {
    const entityKey = entity.id || entity.name;
    
    // Botón anterior
    const prevBtn = document.getElementById('customSheetPrevBtn');
    if (prevBtn) {
        const newPrevBtn = prevBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
        newPrevBtn.addEventListener('click', () => {
            const sheetData = this.enemyCustomSheets[entityKey];
            if (!sheetData) return;
            if (sheetData.currentPage > 1) {
                sheetData.currentPage--;
                this.renderCustomSheetPdf(entityKey);
                this.saveCustomSheetsToStorage();
            }
        });
    }
    
    // Botón siguiente
    const nextBtn = document.getElementById('customSheetNextBtn');
    if (nextBtn) {
        const newNextBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
        newNextBtn.addEventListener('click', () => {
            const sheetData = this.enemyCustomSheets[entityKey];
            if (!sheetData) return;
            if (sheetData.currentPage < sheetData.totalPages) {
                sheetData.currentPage++;
                this.renderCustomSheetPdf(entityKey);
                this.saveCustomSheetsToStorage();
            }
        });
    }
}
saveCustomSheetsToStorage() {
    try {
        // Convertir ArrayBuffers a base64 para almacenar
        const serializable = {};
        for (const [key, value] of Object.entries(this.enemyCustomSheets)) {
            if (value.data) {
                const uint8Array = new Uint8Array(value.data);
                const binary = String.fromCharCode.apply(null, uint8Array);
                const base64 = btoa(binary);
                serializable[key] = {
                    data: base64,
                    name: value.name,
                    totalPages: value.totalPages,
                    currentPage: value.currentPage || 1,
                    zoom: value.zoom || 100
                };
            }
        }
        localStorage.setItem('enemyCustomSheets', JSON.stringify(serializable));
    } catch (error) {
        console.warn('Error guardando fichas personalizadas:', error);
    }
}

loadCustomSheetsFromStorage() {
    try {
        const stored = localStorage.getItem('enemyCustomSheets');
        if (!stored) return;
        
        const parsed = JSON.parse(stored);
        for (const [key, value] of Object.entries(parsed)) {
            if (value.data) {
                const binary = atob(value.data);
                const uint8Array = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    uint8Array[i] = binary.charCodeAt(i);
                }
                this.enemyCustomSheets[key] = {
                    data: uint8Array.buffer,
                    name: value.name,
                    totalPages: value.totalPages,
                    currentPage: value.currentPage || 1,
                    zoom: value.zoom || 100
                };
            }
        }
        console.log(`✅ ${Object.keys(this.enemyCustomSheets).length} fichas personalizadas cargadas`);
    } catch (error) {
        console.warn('Error cargando fichas personalizadas:', error);
    }
}
    
    updatePlayersList() {
        const container = document.getElementById('playersList');
        const badge = document.getElementById('playerBadge');
        
        if (!container) return;
        
        container.innerHTML = '';
        if (badge) badge.textContent = this.players.length;
        
        this.players.forEach((player, index) => {
            const playerElement = this.createEntityCard(player, index + 1);
            container.appendChild(playerElement);
        });
        const summonBadge = document.getElementById('summonBadge');
        if (summonBadge) {
            const totalSummons = this.players.filter(p => p.type === 'summon').length;
            summonBadge.textContent = totalSummons;
        }
        this.updateSummonInvocadoresList();
    }
    
    updateEnemiesList() {
        const container = document.getElementById('enemiesList');
        const badge = document.getElementById('enemyBadge');
        
        if (!container) return;
        
        container.innerHTML = '';
        if (badge) badge.textContent = this.enemies.length;
        
        this.enemies.forEach((enemy, index) => {
            const enemyElement = this.createEntityCard(enemy, index + 1);
            container.appendChild(enemyElement);
        });
    }
        
createEntityCard(entity, number) {
    const div = document.createElement('div');
    div.className = `entity-card ${entity.type}`;
    div.dataset.id = entity.id;
    
    // Determinar si es invocación
    const esInvocacion = this.esInvocacion(entity);
    const invocador = esInvocacion ? this.getInvocadorForSummon(entity.id) : null;
    
    // Estilo especial para invocaciones
    if (esInvocacion) {
        div.style.borderColor = 'var(--accent-purple)';
        div.style.borderWidth = '3px';
        div.style.background = 'linear-gradient(135deg, rgba(106, 13, 173, 0.05), rgba(255, 255, 255, 0.9))';
        `.entity-btn.summon-btn {
            background: var(--accent-gold);
            color: var(--ink-dark);
        }
        .entity-btn.summon-btn:hover {
            background: #f4c542;
            transform: scale(1.1);
}`
    }
    
    const avatarText = esInvocacion ? `I${number}` : 
                       (entity.type === 'player' ? `P${number}` : `E${number}`);
    const hpColor = entity.hp > entity.maxHp * 0.5 ? 'green' : 
                    entity.hp > entity.maxHp * 0.25 ? 'orange' : 'red';
    
    const raceDisplay = (entity.type === 'enemy' || entity.type === 'summon') && entity.race ? 
        `<span><i class="fas fa-paw"></i> ${entity.race}</span>` : '';
    
    const personajeInfo = entity.type === 'player' || entity.type === 'summon' ? 
        this.personajesHoy.find(p => p.nombre === entity.name) : null;
    
    // Mostrar vida temporal si existe
    const tempDisplay = entity.tempHp && entity.tempHp > 0 ? 
        `<span style="color: var(--accent-teal); font-size: 0.8rem;">🛡️+${entity.tempHp}</span>` : '';
    
    // Indicador de invocación
    let invocacionIndicator = '';
    if (esInvocacion && invocador) {
        invocacionIndicator = `
            <div style="display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: var(--accent-purple);">
                <i class="fas fa-arrow-right"></i>
                <span>Invocado por: ${invocador.name}</span>
            </div>
        `;
    }
    
    // Botón de información según el tipo
    let infoButton = '';
    if (entity.type === 'enemy') {
        infoButton = `
            <button class="entity-btn info-btn" title="Ver información de ${entity.race || entity.name}" data-action="info">
                <i class="fas fa-info-circle"></i>
            </button>
        `;
    } else if (personajeInfo && (entity.type === 'player' || entity.type === 'summon')) {
        infoButton = `
            <button class="entity-btn info-btn" title="Ver información de ${entity.name}" data-action="playerInfo">
                <i class="fas fa-info-circle"></i>
            </button>
        `;
    } else if (entity.type === 'summon' && !personajeInfo) {
        // Si es invocación sin personaje registrado, mostrar bestiario si tiene raza
        infoButton = entity.race ? `
            <button class="entity-btn info-btn" title="Ver información de ${entity.race}" data-action="info">
                <i class="fas fa-info-circle"></i>
            </button>
        ` : '';
    }
    
    div.innerHTML = `
        <div class="entity-avatar ${entity.type}">${avatarText}</div>
        <div class="entity-info">
            <div class="entity-name" style="${esInvocacion ? 'color: var(--accent-purple);' : ''}">
                ${entity.name}
                ${esInvocacion ? '<i class="fas fa-star" style="color: var(--accent-gold); font-size: 0.8rem; margin-left: 5px;"></i>' : ''}
            </div>
            <div class="entity-details">
                <span>CA: ${entity.ca}</span>
                <span style="color: ${hpColor};">❤ ${entity.hp}/${entity.maxHp} ${tempDisplay}</span>
                <span class="initiative-score">${entity.initiative || '?'}</span>
                ${raceDisplay}
                ${personajeInfo ? `<span><i class="fas fa-user"></i> ${personajeInfo.jugador}</span>` : ''}
                ${invocacionIndicator}
            </div>
        </div>
        <div class="entity-controls">
            ${entity.type === 'player' ? `
            <button class="entity-btn summon-btn" title="Invocar aliado" data-action="summon">
                <i class="fas fa-star"></i>
            </button>
        ` : ''}
            ${infoButton}
            <button class="entity-btn" title="${entity.type === 'player' || entity.type === 'summon' ? 'Cambiar iniciativa' : 'Tirar iniciativa'}" data-action="roll">
                <i class="fas fa-${entity.type === 'player' || entity.type === 'summon' ? 'sort' : 'dice'}"></i>
            </button>
            <button class="entity-btn" title="Editar vida" data-action="editHP">
                <i class="fas fa-heart"></i>
            </button>
            <button class="entity-btn" title="Editar" data-action="edit">
                <i class="fas fa-pen-fancy"></i>
            </button>
            ${esInvocacion ? `
                <button class="entity-btn" title="Eliminar invocación" data-action="remove" style="background: var(--accent-purple);">
                    <i class="fas fa-times"></i>
                </button>
            ` : `
                <button class="entity-btn" title="Eliminar" data-action="remove">
                    <i class="fas fa-trash"></i>
                </button>
            `}
        </div>
    `;
    
    return div;
}

    /**
 * Abre el modal para invocar un aliado desde un jugador
 */
openSummonModal(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
        this.showNotification('Jugador no encontrado', 'error');
        return;
    }
    
    // Crear o obtener el modal
    let modal = document.getElementById('summonModal');
    if (!modal) {
        modal = this.createSummonModal();
    }
    
    // Guardar el invocador en el modal
    modal.dataset.invocadorId = player.id;
    modal.dataset.invocadorName = player.name;
    
    // Actualizar título del modal
    const title = modal.querySelector('.summon-modal-title');
    if (title) {
        title.innerHTML = `<i class="fas fa-star" style="color: var(--accent-gold);"></i> Invocar Aliado - ${player.name}`;
    }
    
    // Limpiar campos
    const nameInput = document.getElementById('summonNameInput');
    const raceInput = document.getElementById('summonRaceInput');
    const caInput = document.getElementById('summonCAInput');
    const hpInput = document.getElementById('summonHPInput');
    const resultsList = document.getElementById('summonSearchResults');
    
    if (nameInput) nameInput.value = '';
    if (raceInput) raceInput.value = '';
    if (caInput) caInput.value = '';
    if (hpInput) hpInput.value = '';
    if (resultsList) resultsList.style.display = 'none';
    
    // Mostrar el modal
    modal.style.display = 'block';
    
    // Enfocar el primer campo
    if (nameInput) setTimeout(() => nameInput.focus(), 100);
}

/**
 * Crea el modal de invocación
 */
createSummonModal() {
    const modal = document.createElement('div');
    modal.id = 'summonModal';
    modal.className = 'summon-modal';
    modal.innerHTML = `
        <div class="summon-modal-content">
            <span class="close-modal">&times;</span>
            <h2 class="summon-modal-title">
                <i class="fas fa-star" style="color: var(--accent-gold);"></i> Invocar Aliado
            </h2>
            
            <div class="summon-form">
                <div class="summon-field">
                    <label for="summonNameInput">
                        <i class="fas fa-user"></i> Nombre del aliado
                    </label>
                    <input type="text" id="summonNameInput" autocomplete="off">
                </div>
                
                <div class="summon-field">
                    <label for="summonRaceInput">
                        <i class="fas fa-paw"></i> Raza / Especie
                    </label>
                    <div class="summon-race-input-wrapper">
                        <input type="text" id="summonRaceInput" autocomplete="off">
                        <ul id="summonSearchResults" class="search-results" style="display: none;"></ul>
                    </div>
                </div>
                
                <div class="summon-stats-row">
                    <div class="summon-field half">
                        <label for="summonCAInput">
                            <i class="fas fa-shield-alt"></i> CA
                        </label>
                        <input type="number" id="summonCAInput"  min="1" max="30">
                    </div>
                    <div class="summon-field half">
                        <label for="summonHPInput">
                            <i class="fas fa-heart"></i> Vida
                        </label>
                        <input type="number" id="summonHPInput" min="1" max="999">
                    </div>
                </div>
                
                <div class="summon-actions">
                    <button class="summon-btn-primary" id="summonConfirmBtn">
                        <i class="fas fa-star"></i> Invocar Aliado
                    </button>
                    <button class="summon-btn-secondary" id="summonCancelBtn">
                        <i class="fas fa-times"></i> Cancelar
                    </button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Eventos del modal
    modal.querySelector('.close-modal').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    modal.querySelector('#summonCancelBtn').addEventListener('click', () => {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // Configurar autocompletado de razas
    this.setupSummonNameAutocomplete();
    this.setupSummonRaceAutocomplete();
    
    // Configurar el botón de confirmación
    const confirmBtn = document.getElementById('summonConfirmBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
            this.confirmSummon();
        });
    }
    
    // Enter en campos
    const nameInput = document.getElementById('summonNameInput');
    if (nameInput) {
        nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('summonRaceInput')?.focus();
            }
        });
    }
    
    const raceInput = document.getElementById('summonRaceInput');
    if (raceInput) {
        raceInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('summonCAInput')?.focus();
            }
        });
    }
    
    const caInput = document.getElementById('summonCAInput');
    if (caInput) {
        caInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('summonHPInput')?.focus();
            }
        });
    }
    
    const hpInput = document.getElementById('summonHPInput');
    if (hpInput) {
        hpInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                confirmBtn?.click();
            }
        });
    }
    
    return modal;
}

/**
 * Configura el autocompletado para el nombre del aliado en el modal de invocación
 */
setupSummonNameAutocomplete() {
    const nameInput = document.getElementById('summonNameInput');
    if (!nameInput) return;
    
    let resultsList = document.getElementById('summonNameSearchResults');
    if (!resultsList) {
        resultsList = document.createElement('ul');
        resultsList.id = 'summonNameSearchResults';
        resultsList.className = 'search-results';
        resultsList.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            background: white;
            border: 2px solid var(--accent-gold);
            border-radius: 4px;
            list-style: none;
            padding: 0;
            margin: 0;
            z-index: 10001;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        
        const parent = nameInput.parentElement;
        if (parent) {
            parent.style.position = 'relative';
            parent.appendChild(resultsList);
        }
    }
    
    // Eliminar event listeners anteriores
    if (this._summonNameInputHandler) {
        nameInput.removeEventListener('input', this._summonNameInputHandler);
    }
    if (this._summonNameKeydownHandler) {
        nameInput.removeEventListener('keydown', this._summonNameKeydownHandler);
    }
    
    this._summonNameInputHandler = (e) => {
        const searchTerm = nameInput.value.toLowerCase().trim();
        resultsList.innerHTML = '';
        
        if (searchTerm.length === 0) {
            resultsList.style.display = 'none';
            return;
        }
        
        // ✅ SOLO buscar en jugadoresDenominaciones (personajes registrados)
        const filtered = this.jugadoresDenominaciones.filter(item => {
            const itemText = item.text.toLowerCase();
            const jugadorText = item.jugador?.toLowerCase() || '';
            
            return itemText.includes(searchTerm) || 
                   jugadorText.includes(searchTerm) ||
                   item.clase?.toLowerCase().includes(searchTerm) ||
                   item.raza?.toLowerCase().includes(searchTerm);
        }).slice(0, 10);
        
        if (filtered.length > 0) {
            filtered.forEach(item => {
                const li = document.createElement('li');
                
                let highlightedText = item.text;
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                highlightedText = item.text.replace(regex, '<span class="highlight">$1</span>');
                
                li.innerHTML = `
                    <div style="display: flex; flex-direction: column;">
                        <span>${highlightedText}</span>
                        <small style="color: var(--ink-light);">
                            ${item.clase || ''} (nivel ${item.nivel || '?'}) - ${item.jugador || ''}
                        </small>
                    </div>
                `;
                
                li.style.cssText = `
                    padding: 10px 15px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--parchment-dark);
                    font-family: 'Cinzel', serif;
                    transition: background 0.2s ease;
                `;
                
                li.addEventListener('mouseover', () => {
                    li.style.background = 'var(--parchment-light)';
                });
                
                li.addEventListener('mouseout', () => {
                    li.style.background = 'white';
                });
                
                li.addEventListener('click', () => {
                    nameInput.value = item.text;
                    resultsList.style.display = 'none';
                    this.cargarDatosAliado(item);
                    this.showNotification(`Personaje "${item.text}" encontrado en el registro`, 'success');
                });
                
                resultsList.appendChild(li);
            });
            resultsList.style.display = 'block';
        } else {
            // ❌ ELIMINADO: Ya no busca en bestiario
            resultsList.style.display = 'none';
        }
    };
    
    this._summonNameKeydownHandler = (e) => {
        const items = resultsList.getElementsByTagName('li');
        let selectedIndex = -1;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].classList.contains('selected')) {
                selectedIndex = i;
                items[i].classList.remove('selected');
                items[i].style.background = 'white';
                break;
            }
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (items.length > 0) {
                const nextIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
                items[nextIndex].classList.add('selected');
                items[nextIndex].style.background = 'var(--parchment-light)';
                items[nextIndex].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (items.length > 0) {
                const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
                items[prevIndex].classList.add('selected');
                items[prevIndex].style.background = 'var(--parchment-light)';
                items[prevIndex].scrollIntoView({ block: 'nearest' });
            }
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            items[selectedIndex].click();
        } else if (e.key === 'Escape') {
            resultsList.style.display = 'none';
        }
    };
    
    nameInput.addEventListener('input', this._summonNameInputHandler);
    nameInput.addEventListener('keydown', this._summonNameKeydownHandler);
    
    if (this._summonNameDocumentClickHandler) {
        document.removeEventListener('click', this._summonNameDocumentClickHandler);
    }
    this._summonNameDocumentClickHandler = (e) => {
        if (e.target !== nameInput && !resultsList.contains(e.target)) {
            resultsList.style.display = 'none';
        }
    };
    document.addEventListener('click', this._summonNameDocumentClickHandler);
}

/**
 * Carga los datos de un personaje registrado en el modal de invocación
 */
cargarDatosAliado(personaje) {
    if (!personaje) return;
    
    const caInput = document.getElementById('summonCAInput');
    const hpInput = document.getElementById('summonHPInput');
    const raceInput = document.getElementById('summonRaceInput');
    const invocadorInitiative = document.getElementById('summonInvocadorInitiative');
    
    // Cargar CA
    if (caInput && personaje.stats?.ca) {
        caInput.value = personaje.stats.ca;
    }
    
    // Cargar HP máximo
    if (hpInput && personaje.stats?.hp?.max) {
        hpInput.value = personaje.stats.hp.max;
    }
    
    // Cargar raza
    if (raceInput && personaje.raza) {
        raceInput.value = personaje.raza;
    }
    
    // Guardar referencia al personaje completo para usarlo en la invocación
    const modal = document.getElementById('summonModal');
    if (modal) {
        modal.dataset.personajeRegistrado = JSON.stringify(personaje);
    }
    
    this.showNotification(`Datos de ${personaje.text} precargados`, 'success');
}

confirmSummon() {
    const modal = document.getElementById('summonModal');
    if (!modal) return;
    
    const invocadorId = modal.dataset.invocadorId;
    const invocadorName = modal.dataset.invocadorName;
    
    const nameInput = document.getElementById('summonNameInput');
    const raceInput = document.getElementById('summonRaceInput');
    const caInput = document.getElementById('summonCAInput');
    const hpInput = document.getElementById('summonHPInput');
    
    const name = nameInput?.value.trim();
    const race = raceInput?.value.trim() || '';
    const ca = parseInt(caInput?.value) || 10;
    const hp = parseInt(hpInput?.value) || 10;
    
    if (!invocadorId) {
        this.showNotification('Error: No se encontró el invocador', 'error');
        return;
    }
    
    if (!name) {
        this.showNotification('Introduce un nombre para la invocación', 'warning');
        nameInput?.focus();
        return;
    }
    
    // Buscar el invocador
    const invocador = this.players.find(p => p.id === invocadorId);
    if (!invocador) {
        this.showNotification('Jugador invocador no encontrado', 'error');
        return;
    }
    
    // Verificar si hay un personaje registrado guardado en el modal
    let personajeRegistrado = null;
    if (modal.dataset.personajeRegistrado) {
        try {
            personajeRegistrado = JSON.parse(modal.dataset.personajeRegistrado);
        } catch (e) {
            console.warn('Error al parsear personaje registrado:', e);
        }
    }
    
    // Si no hay personaje registrado, buscar por nombre
    if (!personajeRegistrado) {
        personajeRegistrado = this.personajesHoy.find(p => 
            p.nombre.toLowerCase() === name.toLowerCase()
        );
    }
    
    // Calcular iniciativa (menor que la del invocador)
    let iniciativa = invocador.initiative - 1;
    if (iniciativa < 1) iniciativa = 1;
    
    // Si hay otros summons del mismo invocador, ajustar iniciativa
    const summonsDelInvocador = this.players.filter(p => 
        p.type === 'summon' && p.invocadorId === invocadorId
    );
    
    let initiativeExists = true;
    let intentos = 0;
    while (initiativeExists && intentos < 20) {
        initiativeExists = this.players.some(p => 
            p.initiative === iniciativa && p.type === 'summon' && p.invocadorId === invocadorId
        );
        if (initiativeExists) {
            iniciativa = Math.max(1, iniciativa - 1);
            intentos++;
        }
    }
    
    // Crear la invocación
    const summon = {
        id: `summon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        race: race || (personajeRegistrado?.raza || ''),
        initiative: iniciativa,
        ca: ca || (personajeRegistrado?.stats?.ca || 10),
        hp: hp || (personajeRegistrado?.stats?.hp?.max || 10),
        maxHp: hp || (personajeRegistrado?.stats?.hp?.max || 10),
        tempHp: 0,
        type: 'summon',
        invocadorId: invocador.id,
        invocadorName: invocador.name,
        esPersonajeRegistrado: !!personajeRegistrado,
        personajeData: personajeRegistrado || null
    };
    
    // Si el personaje está registrado, guardar todos sus datos completos
    if (personajeRegistrado) {
        summon.personajeData = { ...personajeRegistrado };
        // Asegurar que tenga todos los campos necesarios
        summon.personajeData.stats = summon.personajeData.stats || {};
        summon.personajeData.stats.ca = summon.personajeData.stats.ca || summon.ca;
        summon.personajeData.stats.hp = summon.personajeData.stats.hp || { max: summon.maxHp, current: summon.hp };
    }
    
    // Agregar a la lista de jugadores (para mantener el orden visual)
    const invocadorIndex = this.players.findIndex(p => p.id === invocador.id);
    
    if (invocadorIndex !== -1) {
        this.players.splice(invocadorIndex + 1, 0, summon);
    } else {
        this.players.push(summon);
    }
    
    // Limpiar datos del modal
    modal.dataset.personajeRegistrado = '';
    
    // Cerrar modal
    modal.style.display = 'none';
    
    // Actualizar UI
    this.updatePlayersList();
    this.updateFooter();
    this.updateInitiativeOrder();
    
    const mensaje = personajeRegistrado 
        ? `✨ ${invocador.name} invoca a ${name} (Personaje registrado - ${personajeRegistrado.clase || ''})`
        : `✨ ${invocador.name} invoca a ${name} (Iniciativa: ${iniciativa})`;
    
    this.showNotification(mensaje, 'success');
}

/**
 * Configura el autocompletado de razas para el modal de invocación
 */
setupSummonRaceAutocomplete() {
    const raceInput = document.getElementById('summonRaceInput');
    if (!raceInput) return;
    
    let resultsList = document.getElementById('summonSearchResults');
    if (!resultsList) {
        const wrapper = raceInput.closest('.summon-race-input-wrapper');
        if (!wrapper) return;
        
        resultsList = document.createElement('ul');
        resultsList.id = 'summonSearchResults';
        resultsList.className = 'search-results';
        resultsList.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            max-height: 200px;
            overflow-y: auto;
            background: white;
            border: 2px solid var(--accent-gold);
            border-radius: 4px;
            list-style: none;
            padding: 0;
            margin: 0;
            z-index: 10000;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        wrapper.style.position = 'relative';
        wrapper.appendChild(resultsList);
    }
    
    // Eliminar event listeners anteriores
    if (this._summonRaceInputHandler) {
        raceInput.removeEventListener('input', this._summonRaceInputHandler);
    }
    if (this._summonRaceKeydownHandler) {
        raceInput.removeEventListener('keydown', this._summonRaceKeydownHandler);
    }
    
    // Input handler
    this._summonRaceInputHandler = (e) => {
        const searchTerm = raceInput.value.toLowerCase().trim();
        resultsList.innerHTML = '';
        
        if (searchTerm.length === 0) {
            resultsList.style.display = 'none';
            return;
        }
        
        // Buscar en el bestiario actual
        const filtered = this.bestiaryDenominaciones.filter(item => {
            const itemText = item.text.toLowerCase();
            if (itemText === searchTerm) return true;
            if (itemText.startsWith(searchTerm)) return true;
            const words = itemText.split(/\s+/);
            if (words.some(word => word === searchTerm)) return true;
            if (words.some(word => word.startsWith(searchTerm))) return true;
            if (searchTerm.length >= 4 && itemText.includes(searchTerm)) return true;
            return false;
        }).slice(0, 10);
        
        if (filtered.length > 0) {
            filtered.forEach(item => {
                const li = document.createElement('li');
                let highlightedText = item.text;
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                highlightedText = item.text.replace(regex, '<span class="highlight">$1</span>');
                li.innerHTML = highlightedText;
                li.style.cssText = `
                    padding: 10px 15px;
                    cursor: pointer;
                    border-bottom: 1px solid var(--parchment-dark);
                    font-family: 'Cinzel', serif;
                    transition: background 0.2s ease;
                `;
                li.addEventListener('mouseover', () => {
                    li.style.background = 'var(--parchment-light)';
                });
                li.addEventListener('mouseout', () => {
                    li.style.background = 'white';
                });
                li.addEventListener('click', () => {
                    raceInput.value = item.text;
                    resultsList.style.display = 'none';
                    // Cargar datos del bestiario si existen
                    this.loadSummonBestiaryData(item.text);
                });
                resultsList.appendChild(li);
            });
            resultsList.style.display = 'block';
        } else {
            resultsList.style.display = 'none';
        }
    };
    
    // Keydown handler para navegación con teclado
    this._summonRaceKeydownHandler = (e) => {
        const items = resultsList.getElementsByTagName('li');
        let selectedIndex = -1;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].classList.contains('selected')) {
                selectedIndex = i;
                items[i].classList.remove('selected');
                items[i].style.background = 'white';
                break;
            }
        }
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = selectedIndex < items.length - 1 ? selectedIndex + 1 : 0;
            items[nextIndex].classList.add('selected');
            items[nextIndex].style.background = 'var(--parchment-light)';
            items[nextIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : items.length - 1;
            items[prevIndex].classList.add('selected');
            items[prevIndex].style.background = 'var(--parchment-light)';
            items[prevIndex].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            items[selectedIndex].click();
        }
    };
    
    raceInput.addEventListener('input', this._summonRaceInputHandler);
    raceInput.addEventListener('keydown', this._summonRaceKeydownHandler);
    
    // Cerrar resultados al hacer clic fuera
    if (this._summonDocumentClickHandler) {
        document.removeEventListener('click', this._summonDocumentClickHandler);
    }
    this._summonDocumentClickHandler = (e) => {
        if (e.target !== raceInput && !resultsList.contains(e.target)) {
            resultsList.style.display = 'none';
        }
    };
    document.addEventListener('click', this._summonDocumentClickHandler);
}

/**
 * Carga datos del bestiario para el campo de raza en el modal de invocación
 */
loadSummonBestiaryData(raceName) {
    const searchTerm = raceName.toUpperCase().trim();
    
    let bestiaryEntry = this.bestiarioActual.find(entry => 
        entry.nombre === searchTerm
    );
    
    if (!bestiaryEntry) {
        bestiaryEntry = this.bestiarioActual.find(entry => 
            entry.nombre.startsWith(searchTerm)
        );
    }
    
    if (!bestiaryEntry) {
        const searchWords = searchTerm.split(/\s+/);
        bestiaryEntry = this.bestiarioActual.find(entry => {
            const entryWords = entry.nombre.split(/\s+/);
            return searchWords.some(searchWord => 
                entryWords.some(entryWord => entryWord === searchWord)
            );
        });
    }
    
    if (bestiaryEntry && bestiaryEntry.estadisticas) {
        const stats = bestiaryEntry.estadisticas;
        const caInput = document.getElementById('summonCAInput');
        const hpInput = document.getElementById('summonHPInput');
        
        if (stats.ca && caInput && caInput.value === '') {
            const caMatch = stats.ca.toString().match(/\d+/);
            if (caMatch) {
                caInput.value = caMatch[0];
            }
        }
        
        if (stats.pg && hpInput && hpInput.value === '') {
            const pgMatch = stats.pg.toString().match(/\d+/);
            if (pgMatch) {
                hpInput.value = pgMatch[0];
            }
        }
        
        const fuenteLabel = this.fuenteBestiarioActual === 'original' ? 'original' : 'personalizado';
        this.showNotification(`Datos de ${bestiaryEntry.nombre} precargados (bestiario ${fuenteLabel})`, 'success');
    }
}

/**
 * Confirma la invocación desde el modal
 */
confirmSummon() {
    const modal = document.getElementById('summonModal');
    if (!modal) return;
    
    const invocadorId = modal.dataset.invocadorId;
    const invocadorName = modal.dataset.invocadorName;
    
    const nameInput = document.getElementById('summonNameInput');
    const raceInput = document.getElementById('summonRaceInput');
    const caInput = document.getElementById('summonCAInput');
    const hpInput = document.getElementById('summonHPInput');
    
    const name = nameInput?.value.trim();
    const race = raceInput?.value.trim() || '';
    const ca = parseInt(caInput?.value) || 10;
    const hp = parseInt(hpInput?.value) || 10;
    
    if (!invocadorId) {
        this.showNotification('Error: No se encontró el invocador', 'error');
        return;
    }
    
    if (!name) {
        this.showNotification('Introduce un nombre para la invocación', 'warning');
        nameInput?.focus();
        return;
    }
    
    // Buscar el invocador
    const invocador = this.players.find(p => p.id === invocadorId);
    if (!invocador) {
        this.showNotification('Jugador invocador no encontrado', 'error');
        return;
    }
    
    // Verificar si el nombre existe como jugador registrado
    const personajeRegistrado = this.personajesHoy.find(p => 
        p.nombre.toLowerCase() === name.toLowerCase()
    );
    
    // Calcular iniciativa (menor que la del invocador)
    let iniciativa = invocador.initiative - 1;
    if (iniciativa < 1) iniciativa = 1;
    
    // Si hay otros summons del mismo invocador, ajustar iniciativa
    const summonsDelInvocador = this.players.filter(p => 
        p.type === 'summon' && p.invocadorId === invocadorId
    );
    
    let initiativeExists = true;
    let intentos = 0;
    while (initiativeExists && intentos < 20) {
        initiativeExists = this.players.some(p => 
            p.initiative === iniciativa && p.type === 'summon' && p.invocadorId === invocadorId
        );
        if (initiativeExists) {
            iniciativa = Math.max(1, iniciativa - 1);
            intentos++;
        }
    }
    
    // Crear la invocación
    const summon = {
        id: `summon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        race: race,
        initiative: iniciativa,
        ca: ca,
        hp: hp,
        maxHp: hp,
        tempHp: 0,
        type: 'summon',
        invocadorId: invocador.id,
        invocadorName: invocador.name,
        esPersonajeRegistrado: !!personajeRegistrado,
        personajeData: personajeRegistrado || null
    };
    
    // Agregar a la lista de jugadores (para mantener el orden visual)
    const invocadorIndex = this.players.findIndex(p => p.id === invocador.id);
    
    if (invocadorIndex !== -1) {
        this.players.splice(invocadorIndex + 1, 0, summon);
    } else {
        this.players.push(summon);
    }
    
    // Cerrar modal
    modal.style.display = 'none';
    
    // Actualizar UI
    this.updatePlayersList();
    this.updateFooter();
    this.updateInitiativeOrder();
    
    this.showNotification(
        `✨ ${invocador.name} invoca a ${name} (Iniciativa: ${iniciativa})`, 
        'success'
    );
}

    removeEntity(id, type) {
    if (!confirm(`¿Eliminar este ${type === 'player' ? 'jugador' : 'enemigo'}?`)) return;
    
    const currentEntityId = this.initiativeOrder[this.currentTurn]?.id;
    
    if (type === 'player') {
        // ✅ Eliminar el jugador y TODAS sus invocaciones
        const playerToRemove = this.players.find(p => p.id === id);
        if (playerToRemove) {
            // Contar invocaciones para el mensaje
            const summonCount = this.players.filter(p => 
                p.type === 'summon' && p.invocadorId === id
            ).length;
            
            // Eliminar jugador y sus invocaciones
            this.players = this.players.filter(p => 
                p.id !== id && !(p.type === 'summon' && p.invocadorId === id)
            );
            
            if (summonCount > 0) {
                this.showNotification(`Jugador "${playerToRemove.name}" y ${summonCount} invocaciones eliminadas`, 'warning');
            } else {
                this.showNotification(`Jugador "${playerToRemove.name}" eliminado`, 'warning');
            }
        }
        this.updatePlayersList();
    } else {
        this.enemies = this.enemies.filter(e => e.id !== id);
        this.updateEnemiesList();
    }
    
    this.updateInitiativeOrderAfterRemoval(id, currentEntityId);
}

editarIniciativaInvocacion(entity) {
    const nuevaIniciativa = prompt(
        `Editar iniciativa de "${entity.name}" (Invocado por ${entity.invocadorName}):`, 
        entity.initiative
    );
    
    if (nuevaIniciativa !== null) {
        const iniciativaValue = parseInt(nuevaIniciativa);
        if (!isNaN(iniciativaValue) && iniciativaValue > 0) {
            entity.initiative = iniciativaValue;
            this.updatePlayersList();
            this.updateInitiativeOrder();
            this.showNotification(`Iniciativa de "${entity.name}" cambiada a ${iniciativaValue}`, 'info');
        } else {
            this.showNotification('Valor de iniciativa inválido', 'warning');
        }
    }
}

    handleEntityClick(event, type) {
    const button = event.target.closest('.entity-btn');
    if (!button) return;
    
    const entityCard = event.target.closest('.entity-card');
    if (!entityCard) return;
    
    const entityId = entityCard.dataset.id;
    const action = button.dataset.action;
    
    // Buscar en players y enemies (las invocaciones están en players)
    let entity = this.players.find(p => p.id === entityId);
    if (!entity) {
        entity = this.enemies.find(e => e.id === entityId);
    }
    if (!entity) return;
    
    // Si es invocación y se quiere eliminar, usar acción especial
    if (this.esInvocacion(entity) && action === 'remove') {
        this.removeSummon(entity.id);
        return;
    }
    
    switch (action) {
        case 'roll':
        if (this.esInvocacion(entity)) {
            this.editarIniciativaInvocacion(entity);
        } else {
            this.rollInitiativeForEntity(entity);
        }
        break;
        case 'editHP':
            this.editHPForEntity(entity);
            break;
        case 'edit':
        // Para invocaciones, usamos el mismo método pero internamente maneja solo nombre
        this.editEntity(entity, type);
        break;
        case 'remove':
            this.removeEntity(entityId, type);
            break;
        case 'info':
            // Para invocaciones sin personaje registrado, usar bestiario
            if (this.esInvocacion(entity) && !entity.personajeData && entity.race) {
                this.showBestiaryInfo({ id: entity.id, name: entity.name, race: entity.race });
            } else {
                this.showBestiaryInfo(entity);
            }
            break;
        case 'playerInfo':
        // Buscar primero en personajes registrados
        let personaje = this.personajesHoy.find(p => p.nombre === entity.name);
        if (personaje) {
            this.mostrarInfoJugador(personaje);
        } else if (entity.personajeData) {
            // Si la invocación tiene datos de personaje guardados
            this.mostrarInfoJugador(entity.personajeData);
        } else {
            this.showNotification(`No se encontró ficha para "${entity.name}"`, 'warning');
        }
        break;
        case 'summon':
        this.openSummonModal(entityId);
        break;
        }
}

/**
 * Elimina una invocación específica
 */
removeSummon(summonId) {
    const summon = this.players.find(p => p.id === summonId);
    if (!summon) return;
    
    if (!confirm(`¿Eliminar la invocación "${summon.name}" de ${summon.invocadorName}?`)) return;
    
    this.players = this.players.filter(p => p.id !== summonId);
    
    this.updatePlayersList();
    this.updateInitiativeOrder();
    this.updateFooter();
    
    this.showNotification(`Invocación "${summon.name}" eliminada`, 'warning');
    this.updateSummonInvocadoresList();
}

addSummon() {
    // Obtener el jugador invocador seleccionado
    const invocadorSelect = document.getElementById('summonInvocadorSelect');
    const summonNameInput = document.getElementById('summonNameInput');
    const summonRaceInput = document.getElementById('summonRaceInput');
    const summonCAInput = document.getElementById('summonCAInput');
    const summonHPInput = document.getElementById('summonHPInput');
    
    if (!invocadorSelect || !summonNameInput) {
        this.showNotification('Error: Faltan campos para la invocación', 'error');
        return;
    }
    
    const invocadorId = invocadorSelect.value;
    const name = summonNameInput.value.trim();
    const race = summonRaceInput ? summonRaceInput.value.trim() : '';
    const ca = parseInt(summonCAInput?.value) || 10;
    const hp = parseInt(summonHPInput?.value) || 10;
    
    if (!invocadorId) {
        this.showNotification('Selecciona un jugador invocador', 'warning');
        return;
    }
    
    if (!name) {
        this.showNotification('Introduce un nombre para la invocación', 'warning');
        return;
    }
    
    // Buscar el invocador
    const invocador = this.players.find(p => p.id === invocadorId);
    if (!invocador) {
        this.showNotification('Jugador invocador no encontrado', 'error');
        return;
    }
    
    // Verificar si el nombre existe como jugador registrado
    const personajeRegistrado = this.personajesHoy.find(p => 
        p.nombre.toLowerCase() === name.toLowerCase()
    );
    
    // Calcular iniciativa (menor que la del invocador)
    let iniciativa = invocador.initiative - 1;
    if (iniciativa < 1) iniciativa = 1;
    
    // Si hay otros summons del mismo invocador, ajustar iniciativa
    const summonsDelInvocador = this.players.filter(p => 
        p.type === 'summon' && p.invocadorId === invocadorId
    );
    
    // Asegurar que la iniciativa sea única entre summons del mismo invocador
    let initiativeExists = true;
    let intentos = 0;
    while (initiativeExists && intentos < 20) {
        initiativeExists = this.players.some(p => 
            p.initiative === iniciativa && p.type === 'summon' && p.invocadorId === invocadorId
        );
        if (initiativeExists) {
            iniciativa = Math.max(1, iniciativa - 1);
            intentos++;
        }
    }
    
    // Crear la invocación
    const summon = {
        id: `summon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        race: race,
        initiative: iniciativa,
        ca: ca,
        hp: hp,
        maxHp: hp,
        tempHp: 0,
        type: 'summon',
        invocadorId: invocador.id,
        invocadorName: invocador.name,
        esPersonajeRegistrado: !!personajeRegistrado,
        personajeData: personajeRegistrado || null
    };
    
    // Agregar a la lista de jugadores (para mantener el orden visual)
    // Buscar la posición del invocador
    const invocadorIndex = this.players.findIndex(p => p.id === invocador.id);
    
    if (invocadorIndex !== -1) {
        // Insertar después del invocador
        this.players.splice(invocadorIndex + 1, 0, summon);
    } else {
        this.players.push(summon);
    }
    
    // Limpiar campos
    if (summonNameInput) summonNameInput.value = '';
    if (summonRaceInput) summonRaceInput.value = '';
    if (summonCAInput) summonCAInput.value = '';
    if (summonHPInput) summonHPInput.value = '';
    if (invocadorSelect) invocadorSelect.value = '';
    
    // Actualizar UI
    this.updatePlayersList();
    this.updateFooter();
    this.updateInitiativeOrder();
    
    this.showNotification(
        `✨ ${invocador.name} invoca a ${name} (Iniciativa: ${iniciativa})`, 
        'success'
    );
}

getSummonsForPlayer(playerId) {
    return this.players.filter(p => 
        p.type === 'summon' && p.invocadorId === playerId
    );
}

/**
 * Verifica si un nombre es una invocación
 */
esInvocacion(entity) {
    return entity && entity.type === 'summon';
}

/**
 * Obtiene el invocador de una invocación
 */
getInvocadorForSummon(summonId) {
    const summon = this.players.find(p => p.id === summonId);
    if (!summon || summon.type !== 'summon') return null;
    return this.players.find(p => p.id === summon.invocadorId);
}


    
    rollInitiativeForEntity(entity) {
        if (entity.type === 'player') {
            const newInitiative = prompt(`Introduce nueva iniciativa para ${entity.name}:`, entity.initiative);
            if (newInitiative !== null) {
                const initiativeValue = parseInt(newInitiative);
                if (!isNaN(initiativeValue)) {
                    entity.initiative = initiativeValue;
                    this.updatePlayersList();
                    this.updateInitiativeOrder();
                    this.showNotification(`${entity.name}: Iniciativa cambiada a ${initiativeValue}`, 'info');
                }
            }
        } else {
            let dexBonus = 0;
            if (entity.race) {
                const searchTerm = entity.race.toUpperCase().trim();
                
                // Buscar en la fuente actual del bestiario
                let bestiaryEntry = this.bestiarioActual.find(entry => 
                    entry.nombre === searchTerm
                );
                
                if (!bestiaryEntry) {
                    bestiaryEntry = this.bestiarioActual.find(entry => 
                        entry.nombre.startsWith(searchTerm)
                    );
                }
                
                if (!bestiaryEntry) {
                    const searchWords = searchTerm.split(/\s+/);
                    bestiaryEntry = this.bestiarioActual.find(entry => {
                        const entryWords = entry.nombre.split(/\s+/);
                        return searchWords.some(searchWord => 
                            entryWords.some(entryWord => entryWord === searchWord)
                        );
                    });
                }
                
                if (bestiaryEntry && bestiaryEntry.estadisticas && bestiaryEntry.estadisticas.DES) {
                    const stats = bestiaryEntry.estadisticas;
                    const dexMatch = stats.DES.toString().match(/\(([+-]\d+)\)/);
                    if (dexMatch) {
                        dexBonus = parseInt(dexMatch[1]);
                    } else {
                        const dexBaseMatch = stats.DES.toString().match(/\d+/);
                        if (dexBaseMatch) {
                            const dexBase = parseInt(dexBaseMatch[0]);
                            dexBonus = Math.floor((dexBase - 10) / 2);
                        }
                    }
                }
            }
            
            entity.initiative = Math.floor(Math.random() * 20) + 1 + dexBonus;
            this.updateEnemiesList();
            this.updateInitiativeOrder();
            this.showNotification(`${entity.name} tira iniciativa: ${entity.initiative} (bonificador DEX: ${dexBonus >= 0 ? '+' : ''}${dexBonus})`, 'info');
        }
    }
    
    editHPForEntity(entity) {
    let modal = document.getElementById('hpEditModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'hpEditModal';
        modal.className = 'hp-modal';
        modal.innerHTML = `
            <div class="hp-modal-content">
                <span class="close-modal">&times;</span>
                <h2 id="hpModalTitle">Editar Estadísticas</h2>
                
                <div class="hp-display">
                    <div class="hp-current" id="hpCurrentDisplay">0</div>
                    <div class="hp-max">/ <span id="hpMaxDisplay">0</span> PG</div>
                    <div class="hp-temp" id="hpTempDisplay">🛡️ Temporal: 0</div>
                    <div class="hp-ca-display" style="margin-top: 8px; font-size: 1.1rem;">
                        <i class="fas fa-shield-alt"></i> CA: <span id="hpCADisplay">0</span>
                    </div>
                </div>
                
                <div class="hp-input-row">
                    <div class="hp-input-group damage-group">
                        <label for="hpDamageInput">
                            <i class="fas fa-skull" style="color: #f44336;"></i> Daño
                        </label>
                        <input type="number" id="hpDamageInput" min="0" step="1" value="">
                    </div>
                    
                    <div class="hp-input-group heal-group">
                        <label for="hpHealInput">
                            <i class="fas fa-heart" style="color: #4CAF50;"></i> Curación
                        </label>
                        <input type="number" id="hpHealInput" min="0" step="1" value="">
                    </div>
                </div>
                
                <div class="hp-input-group">
                    <label for="hpMaxInput">Vida Máxima:</label>
                    <input type="number" id="hpMaxInput" placeholder="Nueva vida máxima" step="1">
                </div>
                
                <div class="hp-input-group" style="margin-top: 10px;">
                    <label for="hpCAInput">
                        <i class="fas fa-shield-alt"></i> Clase de Armadura (CA):
                    </label>
                    <input type="number" id="hpCAInput" placeholder="Nueva CA" min="1" max="30" step="1">
                </div>
                
                <div class="hp-quick-buttons">
                    <button class="hp-quick-btn temp" data-value="temp">🛡️ Temp</button>
                </div>
                
                <div class="hp-error" id="hpError">Error</div>
                
                <div class="hp-actions">
                    <button class="hp-apply-btn" id="hpApplyBtn">Aplicar</button>
                    <button class="hp-close-btn" id="hpCloseBtn">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        modal.querySelector('.close-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        modal.querySelector('#hpCloseBtn').addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
    
    modal._entity = entity;
    modal._entityType = entity.type;
    
    // Actualizar display
    const currentDisplay = document.getElementById('hpCurrentDisplay');
    const maxDisplay = document.getElementById('hpMaxDisplay');
    const tempDisplay = document.getElementById('hpTempDisplay');
    const caDisplay = document.getElementById('hpCADisplay');
    const title = document.getElementById('hpModalTitle');
    const damageInput = document.getElementById('hpDamageInput');
    const healInput = document.getElementById('hpHealInput');
    const hpMaxInput = document.getElementById('hpMaxInput');
    const hpCAInput = document.getElementById('hpCAInput');
    const errorDiv = document.getElementById('hpError');
    
    if (currentDisplay) currentDisplay.textContent = entity.hp;
    if (maxDisplay) maxDisplay.textContent = entity.maxHp;
    if (caDisplay) caDisplay.textContent = entity.ca || 0;
    if (tempDisplay) {
        const tempHp = entity.tempHp || 0;
        tempDisplay.textContent = `🛡️ Temporal: ${tempHp}`;
    }
    if (title) {
        const tipo = this.esInvocacion(entity) ? 'Invocación' : 
                     entity.type === 'player' ? 'Jugador' : 'Enemigo';
        title.textContent = `Editar Estadísticas - ${entity.name} (${tipo})`;
    }
    if (damageInput) damageInput.value = '';
    if (healInput) healInput.value = '';
    if (hpMaxInput) hpMaxInput.value = '';
    if (hpCAInput) hpCAInput.value = '';
    if (errorDiv) errorDiv.classList.remove('show');
    
    // Botón de aplicar
    const applyBtn = document.getElementById('hpApplyBtn');
    const newApplyBtn = applyBtn.cloneNode(true);
    applyBtn.parentNode.replaceChild(newApplyBtn, applyBtn);
    
    // Botones rápidos
    document.querySelectorAll('.hp-quick-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        
        newBtn.addEventListener('click', () => {
            const value = newBtn.dataset.value;
            if (value === 'temp') {
                const tempValue = prompt('Introduce la cantidad de vida temporal:');
                if (tempValue !== null) {
                    const tempNum = parseInt(tempValue);
                    if (!isNaN(tempNum) && tempNum > 0) {
                        entity.tempHp = (entity.tempHp || 0) + tempNum;
                        if (entity.tempHp < 0) entity.tempHp = 0;
                        if (currentDisplay) currentDisplay.textContent = entity.hp;
                        if (tempDisplay) tempDisplay.textContent = `🛡️ Temporal: ${entity.tempHp}`;
                        if (errorDiv) errorDiv.classList.remove('show');
                    }
                }
            }
        });
    });
    
    // Evento aplicar
    newApplyBtn.addEventListener('click', () => {
        const damageValue = parseInt(damageInput.value);
        const healValue = parseInt(healInput.value);
        const newMaxHp = parseInt(hpMaxInput.value);
        const newCA = parseInt(hpCAInput.value);
        
        if (isNaN(damageValue) && isNaN(healValue) && isNaN(newMaxHp) && isNaN(newCA)) {
            if (errorDiv) {
                errorDiv.textContent = '⚠️ Introduce un valor en al menos un campo';
                errorDiv.classList.add('show');
            }
            return;
        }
        
        let changes = [];
        
        // Aplicar nueva CA
        if (!isNaN(newCA) && newCA > 0) {
            entity.ca = newCA;
            if (caDisplay) caDisplay.textContent = newCA;
            changes.push(`CA: ${newCA}`);
        }
        
        // Aplicar nuevo máximo de vida
        if (!isNaN(newMaxHp) && newMaxHp > 0) {
            entity.maxHp = newMaxHp;
            if (entity.hp > entity.maxHp) {
                entity.hp = entity.maxHp;
            }
            changes.push(`Máximo: ${newMaxHp}`);
        }
        
        // Aplicar daño
        if (!isNaN(damageValue) && damageValue > 0) {
            let remainingDamage = damageValue;
            let tempUsed = 0;
            let normalDamage = 0;
            
            if (entity.tempHp && entity.tempHp > 0) {
                tempUsed = Math.min(entity.tempHp, remainingDamage);
                entity.tempHp -= tempUsed;
                remainingDamage -= tempUsed;
                if (entity.tempHp < 0) entity.tempHp = 0;
            }
            
            if (remainingDamage > 0) {
                normalDamage = remainingDamage;
                entity.hp = Math.max(0, entity.hp - normalDamage);
            }
            
            if (tempUsed > 0 && normalDamage > 0) {
                changes.push(`Daño: ${damageValue} (${tempUsed} temp + ${normalDamage} vida)`);
            } else if (tempUsed > 0) {
                changes.push(`Daño a temp: ${tempUsed}`);
            } else {
                changes.push(`Daño: ${damageValue}`);
            }
            this.showNotification(`${entity.name} recibe ${damageValue} de daño`, 'error');
        }
        
        // Aplicar curación
        if (!isNaN(healValue) && healValue > 0) {
            const oldHp = entity.hp;
            entity.hp = Math.min(entity.maxHp, entity.hp + healValue);
            const actualHeal = entity.hp - oldHp;
            changes.push(`Curado: ${actualHeal}`);
            this.showNotification(`${entity.name} se cura ${actualHeal} PG`, 'success');
        }
        
        // Actualizar UI
        if (currentDisplay) currentDisplay.textContent = entity.hp;
        if (maxDisplay) maxDisplay.textContent = entity.maxHp;
        if (caDisplay) caDisplay.textContent = entity.ca || 0;
        if (tempDisplay) tempDisplay.textContent = `🛡️ Temporal: ${entity.tempHp || 0}`;
        if (errorDiv) errorDiv.classList.remove('show');
        
        if (damageInput) damageInput.value = '';
        if (healInput) healInput.value = '';
        if (hpMaxInput) hpMaxInput.value = '';
        if (hpCAInput) hpCAInput.value = '';
        
        // Actualizar listas
        if (entity.type === 'player' || this.esInvocacion(entity)) {
            this.updatePlayersList();
        } else {
            this.updateEnemiesList();
        }
        
        if (changes.length > 0) {
            this.showNotification(`${entity.name}: ${changes.join(', ')}`, 'info');
        }
    });
    
    // Enter en inputs
    damageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') newApplyBtn.click();
    });
    healInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') newApplyBtn.click();
    });
    hpMaxInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') newApplyBtn.click();
    });
    hpCAInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') newApplyBtn.click();
    });
    
    modal.style.display = 'block';
    damageInput.focus();
}

    editEntity(entity, type) {
    // ✅ Para invocaciones: solo editar nombre
    if (this.esInvocacion(entity)) {
        const newName = prompt(`Editar nombre de la invocación "${entity.name}":`, entity.name);
        if (newName && newName.trim()) {
            entity.name = newName.trim();
            this.updatePlayersList();
            this.updateInitiativeOrder();
            this.showNotification(`Invocación renombrada a "${entity.name}"`, 'success');
        }
        return;
    }
    
    // ✅ Para jugadores y enemigos: edición completa
    const newName = prompt(`Editar nombre de ${type === 'player' ? 'jugador' : 'enemigo'}:`, entity.name);
    if (newName && newName.trim()) {
        entity.name = newName.trim();
        
        if (type === 'enemy') {
            const newRace = prompt(`Editar raza/especie de ${entity.name}:`, entity.race || '');
            if (newRace !== null) {
                entity.race = newRace.trim() || '';
            }
        }
        
        const newCA = prompt(`Editar CA de ${entity.name}:`, entity.ca);
        if (newCA !== null) {
            const caValue = parseInt(newCA);
            if (!isNaN(caValue)) {
                entity.ca = caValue;
            }
        }
        
        const newMaxHP = prompt(`Editar vida máxima de ${entity.name}:`, entity.maxHp);
        if (newMaxHP !== null) {
            const maxHPValue = parseInt(newMaxHP);
            if (!isNaN(maxHPValue)) {
                entity.maxHp = maxHPValue;
                if (entity.hp > maxHPValue) {
                    entity.hp = maxHPValue;
                }
            }
        }
        
        if (type === 'player') {
            this.updatePlayersList();
        } else {
            this.updateEnemiesList();
        }
        
        this.updateInitiativeOrder();
        this.showNotification(`${type === 'player' ? 'Jugador' : 'Enemigo'} actualizado`, 'success');
    }
}
    
    updateInitiativeOrderAfterRemoval(removedId, previousCurrentId) {
        const allEntities = [...this.players, ...this.enemies];
        const entitiesWithInitiative = allEntities.filter(e => e.initiative > 0);
        entitiesWithInitiative.sort((a, b) => b.initiative - a.initiative);
        
        this.initiativeOrder = entitiesWithInitiative;
        
        if (this.initiativeOrder.length === 0) {
            this.currentTurn = 0;
            this.currentRound = 1;
            this.updateInitiativeOrderDisplay();
            return;
        }
        
        const currentEntityStillExists = this.initiativeOrder.some(e => e.id === previousCurrentId);
        
        if (currentEntityStillExists) {
            const newIndex = this.initiativeOrder.findIndex(e => e.id === previousCurrentId);
            if (newIndex !== -1) {
                this.currentTurn = newIndex;
            }
        } else {
            if (this.currentTurn >= this.initiativeOrder.length) {
                this.currentTurn = Math.max(0, this.initiativeOrder.length - 1);
            }
        }
        
        this.updateInitiativeOrderDisplay();
    }
    
    updateInitiativeOrderDisplay() {
        const container = document.getElementById('initiativeOrder');
        if (!container) return;
        
        if (this.initiativeOrder.length === 0) {
            container.innerHTML = `
                <div class="empty-order">
                    <i class="fas fa-list"></i>
                    <p>No hay entidades en el orden de iniciativa</p>
                    <small>Añade jugadores/enemigos</small>
                </div>
            `;
        } else {
            container.innerHTML = '';
            
            this.initiativeOrder.forEach((entity, index) => {
                const orderItem = document.createElement('div');
                orderItem.className = `order-item ${entity.type} ${index === this.currentTurn ? 'active' : ''}`;
                orderItem.dataset.id = entity.id;
                orderItem.dataset.type = entity.type;
                
                const turnIndicator = index === this.currentTurn ? '▶' : index + 1;
                
                orderItem.innerHTML = `
                    <span class="order-turn">${turnIndicator}</span>
                    <span class="order-name">${entity.name}</span>
                    <span class="order-initiative">${entity.initiative}</span>
                `;
                
                container.appendChild(orderItem);
            });
            
            this.scrollToActiveTurn();
        }
        
        const currentTurn = document.getElementById('currentTurn');
        const currentRound = document.getElementById('currentRound');
        
        if (currentTurn) currentTurn.textContent = this.currentTurn + 1;
        if (currentRound) currentRound.textContent = this.currentRound;
    }
    
    scrollToActiveTurn() {
        const container = document.getElementById('initiativeOrder');
        if (!container) return;
        
        const activeItem = container.querySelector('.order-item.active');
        
        if (activeItem) {
            setTimeout(() => {
                activeItem.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                    inline: 'start'
                });
            }, 100);
        }
    }
    
    updateInitiativeOrder() {
        const allEntities = [...this.players, ...this.enemies];
        const entitiesWithInitiative = allEntities.filter(e => e.initiative > 0);
        entitiesWithInitiative.sort((a, b) => b.initiative - a.initiative);
        
        this.initiativeOrder = entitiesWithInitiative;
        
        if (this.currentTurn >= this.initiativeOrder.length && this.initiativeOrder.length > 0) {
            this.currentTurn = this.initiativeOrder.length - 1;
        } else if (this.initiativeOrder.length === 0) {
            this.currentTurn = 0;
        }
        
        this.updateInitiativeOrderDisplay();
    }
    
    sortInitiative() {
        this.updateInitiativeOrder();
        this.showNotification('Orden de iniciativa actualizado', 'info');
    }
    
    clearInitiativeOrder() {
        if (!confirm('¿Limpiar todo el orden de iniciativa?')) return;
        
        this.players.forEach(player => player.initiative = 0);
        this.enemies.forEach(enemy => enemy.initiative = 0);
        
        this.currentTurn = 0;
        this.currentRound = 1;
        
        this.updatePlayersList();
        this.updateEnemiesList();
        this.updateInitiativeOrder();
        
        this.showNotification('Orden de iniciativa limpiado', 'warning');
    }
    
    nextTurn() {
        if (this.initiativeOrder.length === 0) {
            this.showNotification('No hay entidades en el orden de iniciativa', 'warning');
            return;
        }
        
        this.currentTurn++;
        
        if (this.currentTurn >= this.initiativeOrder.length) {
            this.currentTurn = 0;
            this.currentRound++;
        }
        
        this.updateInitiativeOrderDisplay();
        
        const currentEntity = this.initiativeOrder[this.currentTurn];
        if (currentEntity) {
            this.showNotification(`Turno de: ${currentEntity.name}`, 'info');
        }
    }
    
    handleInitiativeClick(event) {
        const orderItem = event.target.closest('.order-item');
        if (!orderItem) return;
        
        const index = Array.from(orderItem.parentNode.children).indexOf(orderItem);
        this.currentTurn = index;
        this.updateInitiativeOrderDisplay();
        
        const entity = this.initiativeOrder[index];
        if (entity) {
            this.showNotification(`Turno cambiado a: ${entity.name}`, 'info');
        }
    }
    
    toggleCombatMode() {
        this.combatMode = !this.combatMode;
        const button = document.getElementById('toggleCombatBtn');
        const status = document.getElementById('combatStatus');
        
        if (this.combatMode) {
            if (button) {
                button.innerHTML = '<i class="fas fa-compass"></i> Exploración';
                button.classList.add('combat-active');
            }
            if (status) {
                status.textContent = 'Combate';
                status.classList.add('combat');
            }
        } else {
            if (button) {
                button.innerHTML = '<i class="fas fa-fist-raised"></i> Combate';
                button.classList.remove('combat-active');
            }
            if (status) {
                status.textContent = 'Exploración';
                status.classList.remove('combat');
            }
        }
        
        this.showNotification(`Modo ${this.combatMode ? 'Combate' : 'Exploración'} activado`, 'info');
    }
    
    async loadPDF(file, type) {
        if (!file || !file.type.includes('pdf')) {
            this.showNotification('Por favor, selecciona un archivo PDF válido', 'error');
            return;
        }
        
        try {
            this.showNotification(`Cargando PDF: ${file.name}...`, 'info');
            
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            this.pdfData[type] = pdf;
            this.pdfPages[type].total = pdf.numPages;
            this.pdfPages[type].current = 1;
            
            const titleElement = document.getElementById(`${type}Title`);
            if (titleElement) titleElement.textContent = file.name;
            
            const currentPageElement = document.getElementById(`${type}CurrentPage`);
            const totalPagesElement = document.getElementById(`${type}TotalPages`);
            const pageInputElement = document.getElementById(`${type}PageInput`);
            
            if (currentPageElement) currentPageElement.textContent = this.pdfPages[type].current;
            if (totalPagesElement) totalPagesElement.textContent = this.pdfPages[type].total;
            if (pageInputElement) {
                pageInputElement.value = this.pdfPages[type].current;
                pageInputElement.max = this.pdfPages[type].total;
            }
            
            this.togglePDFControls(type, true);
            await this.renderPDFPage(type);
            
            this.showNotification(`PDF cargado: ${file.name}`, 'success');
            
        } catch (error) {
            console.error('Error al cargar PDF:', error);
            this.showNotification('Error al cargar el PDF', 'error');
        }
    }
    
    async renderPDFPage(type) {
        if (!this.pdfData[type]) return;
        
        try {
            const page = await this.pdfData[type].getPage(this.pdfPages[type].current);
            const viewer = document.getElementById(`${type}Viewer`);
            
            if (!viewer) return;
            
            viewer.innerHTML = '';
            
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            viewer.appendChild(canvas);
            
            const viewport = page.getViewport({ scale: this.zoomLevels[type] / 100 });
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            const currentPageElement = document.getElementById(`${type}CurrentPage`);
            const totalPagesElement = document.getElementById(`${type}TotalPages`);
            const pageInputElement = document.getElementById(`${type}PageInput`);
            const zoomElement = document.getElementById(`${type}ZoomLevel`);
            
            if (currentPageElement) currentPageElement.textContent = this.pdfPages[type].current;
            if (totalPagesElement) totalPagesElement.textContent = this.pdfPages[type].total;
            if (pageInputElement) {
                pageInputElement.value = this.pdfPages[type].current;
                pageInputElement.max = this.pdfPages[type].total;
            }
            if (zoomElement) zoomElement.textContent = `${this.zoomLevels[type]}%`;
            
        } catch (error) {
            console.error('Error al renderizar página:', error);
            this.showNotification('Error al mostrar la página', 'error');
        }
    }
    
    async changePDFPage(type, delta) {
        if (!this.pdfData[type]) return;
        
        const newPage = this.pdfPages[type].current + delta;
        
        if (newPage < 1 || newPage > this.pdfPages[type].total) {
            return;
        }
        
        this.pdfPages[type].current = newPage;
        await this.renderPDFPage(type);
    }
    
    async goToPage(type) {
        if (!this.pdfData[type]) return;
        
        const pageInput = document.getElementById(`${type}PageInput`);
        if (!pageInput) return;
        
        const pageNumber = parseInt(pageInput.value);
        
        if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > this.pdfPages[type].total) {
            this.showNotification(`Por favor, introduce un número de página válido (1-${this.pdfPages[type].total})`, 'warning');
            pageInput.value = this.pdfPages[type].current;
            return;
        }
        
        this.pdfPages[type].current = pageNumber;
        await this.renderPDFPage(type);
        this.showNotification(`Página cambiada a: ${pageNumber}`, 'info');
    }

    sincronizarConIA() {
    if (!window.dmScreen) return;
    
    const combatData = {
        enemies: this.enemies,
        players: this.players,
        initiativeOrder: this.initiativeOrder,
        currentRound: this.currentRound,
        currentTurn: this.currentTurn,
        combatActive: this.combatMode
    };
    
    // Enviar al servidor
    fetch('/api/ai/dm/combat/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(combatData)
    }).catch(err => console.error('Error sincronizando combate:', err));
    
    // Si hay bestiario personalizado, sincronizarlo también
    if (this.bestiarioActual && this.fuenteBestiarioActual !== 'original') {
        fetch('/api/ai/dm/bestiary/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                bestiary: this.bestiarioActual,
                source: this.fuenteBestiarioActual
            })
        }).catch(err => console.error('Error sincronizando bestiario:', err));
    }
}
    
    async zoomPDF(type, delta) {
        const zoomElement = document.getElementById(`${type}ZoomLevel`);
        if (!zoomElement) return;
        
        const newZoom = this.zoomLevels[type] + delta;
        
        if (newZoom < 50 || newZoom > 300) {
            return;
        }
        
        this.zoomLevels[type] = newZoom;
        zoomElement.textContent = `${newZoom}%`;
        
        if (this.pdfData[type]) {
            await this.renderPDFPage(type);
        }
    }
    
    clearPDF(type) {
        const typeNames = {
            'manual': 'manual',
            'bestiary': 'bestiario',
            'campaign': 'campaña'
        };
        
        if (!confirm(`¿Eliminar el PDF de ${typeNames[type]}?`)) return;
        
        this.pdfData[type] = null;
        this.pdfPages[type] = { current: 1, total: 1 };
        this.zoomLevels[type] = 100;
        
        const viewer = document.getElementById(`${type}Viewer`);
        
        if (!viewer) return;
        
        const icons = {
            'manual': 'book-open',
            'bestiary': 'dragon',
            'campaign': 'scroll'
        };
        
        const titles = {
            'manual': 'Manual del Dungeon Master',
            'bestiary': 'Bestiario de Criaturas',
            'campaign': 'Documentos de Campaña'
        };
        
        viewer.innerHTML = `
            <div class="pdf-placeholder">
                <i class="fas fa-${icons[type]}"></i>
                <h3>${titles[type]}</h3>
                <p>Carga un archivo PDF para comenzar</p>
                <button class="upload-btn" id="upload${type.charAt(0).toUpperCase() + type.slice(1)}Btn">
                    <i class="fas fa-cloud-upload-alt"></i> Seleccionar PDF
                </button>
                <p class="placeholder-hint">Formatos soportados: .pdf</p>
            </div>
        `;
        
        const uploadBtn = document.getElementById(`upload${type.charAt(0).toUpperCase() + type.slice(1)}Btn`);
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                document.getElementById(`${type}Upload`).click();
            });
        }
        
        const titleElement = document.getElementById(`${type}Title`);
        if (titleElement) titleElement.textContent = `No hay PDF cargado`;
        
        const currentPageElement = document.getElementById(`${type}CurrentPage`);
        const totalPagesElement = document.getElementById(`${type}TotalPages`);
        const pageInputElement = document.getElementById(`${type}PageInput`);
        const zoomElement = document.getElementById(`${type}ZoomLevel`);
        
        if (currentPageElement) currentPageElement.textContent = '-';
        if (totalPagesElement) totalPagesElement.textContent = '-';
        if (zoomElement) zoomElement.textContent = '100%';
        if (pageInputElement) {
            pageInputElement.value = '';
            pageInputElement.max = 1;
        }
        
        this.togglePDFControls(type, false);
        
        this.showNotification(`PDF de ${typeNames[type]} eliminado`, 'warning');
    }
    
    togglePDFControls(type, enabled) {
        const controls = [];
        
        if (type === 'manual') {
            controls.push('prevPageBtn', 'nextPageBtn', 'manualZoomInBtn', 'manualZoomOutBtn', 'manualPageInput');
        } else if (type === 'bestiary') {
            controls.push('bestiaryPrevBtn', 'bestiaryNextBtn', 'bestiaryZoomInBtn', 'bestiaryZoomOutBtn', 'bestiaryPageInput');
        } else if (type === 'campaign') {
            controls.push('campaignPrevBtn', 'campaignNextBtn', 'campaignZoomInBtn', 'campaignZoomOutBtn', 'campaignPageInput');
        }
        
        controls.forEach(controlId => {
            const control = document.getElementById(controlId);
            if (control) {
                control.disabled = !enabled;
                if (controlId.includes('PageInput')) {
                    control.readOnly = !enabled;
                }
            }
        });
    }
    
    switchNotesTab(tab) {
        document.querySelectorAll('.notes-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.tab === tab);
        });
        
        const editor = document.getElementById('dmNotesEditor');
        if (editor) {
            editor.innerHTML = this.notes[tab] || '';
            this.updateNotesStats();
        }
    }
    
    updateNotes(content) {
        const activeTab = document.querySelector('.notes-tab.active');
        if (!activeTab) return;
        
        const tab = activeTab.dataset.tab;
        this.notes[tab] = content;
    }
    
    updateNotesStats() {
        const editor = document.getElementById('dmNotesEditor');
        if (!editor) return;
        
        const content = editor.textContent || editor.innerText || '';
        const charCount = content.length;
        const wordCount = content.trim() === '' ? 0 : content.trim().split(/\s+/).length;
        
        const notesCharCount = document.getElementById('notesCharCount');
        const notesWordCount = document.getElementById('notesWordCount');
        
        if (notesCharCount) notesCharCount.textContent = `${charCount} caracteres`;
        if (notesWordCount) notesWordCount.textContent = `${wordCount} palabras`;
    }
    
    saveNotes() {
        const activeTab = document.querySelector('.notes-tab.active');
        if (!activeTab) return;
        
        const tab = activeTab.dataset.tab;
        const editor = document.getElementById('dmNotesEditor');
        if (editor) {
            this.notes[tab] = editor.innerHTML;
        }
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const notesLastSaved = document.getElementById('notesLastSaved');
        if (notesLastSaved) notesLastSaved.textContent = `Guardado: ${timeString}`;
        
        this.showNotification('Notas guardadas', 'success');
    }
    
    exportNotes() {
        let exportContent = '<h1>=== NOTAS DEL DM ===</h1>\n\n';
        
        for (const [tab, content] of Object.entries(this.notes)) {
            if (content && content.trim()) {
                const tabName = {
                    'session': 'SESIÓN',
                    'plot': 'TRAMA',
                    'npcs': 'NPCs',
                    'locations': 'LOCACIONES'
                }[tab] || tab.toUpperCase();
                
                exportContent += `<h2>--- ${tabName} ---</h2>\n${content}\n\n`;
            }
        }
        
        const blob = new Blob([exportContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dm-notes-${new Date().toISOString().split('T')[0]}.html`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Notas exportadas como HTML', 'success');
    }
    
    rollDice() {
        const diceType = document.getElementById('diceType');
        if (!diceType) return;
        
        const diceTypeValue = diceType.value;
        const diceValue = parseInt(diceTypeValue.substring(1));
        
        if (isNaN(diceValue)) {
            const result = Math.floor(Math.random() * 100) + 1;
            const diceResult = document.getElementById('diceResult');
            if (diceResult) {
                diceResult.innerHTML = `
                    <span class="result-label">Resultado (d100):</span>
                    <span class="result-value">${result}</span>
                `;
            }
            this.showNotification(`d100: ${result}`, 'info');
            return;
        }
        
        const result = Math.floor(Math.random() * diceValue) + 1;
        const diceResult = document.getElementById('diceResult');
        if (diceResult) {
            diceResult.innerHTML = `
                <span class="result-label">Resultado (${diceTypeValue}):</span>
                <span class="result-value">${result}</span>
            `;
        }
        
        this.showNotification(`${diceTypeValue}: ${result}`, 'info');
    }
    
    startTimer() {
        if (this.timerInterval) return;
        
        this.timerInterval = setInterval(() => {
            this.timerSeconds++;
            this.updateTimerDisplay();
        }, 1000);
        
        const startTimerBtn = document.getElementById('startTimerBtn');
        const pauseTimerBtn = document.getElementById('pauseTimerBtn');
        
        if (startTimerBtn) startTimerBtn.disabled = true;
        if (pauseTimerBtn) pauseTimerBtn.disabled = false;
        
        this.showNotification('Temporizador iniciado', 'info');
    }
    
    pauseTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
            
            const startTimerBtn = document.getElementById('startTimerBtn');
            const pauseTimerBtn = document.getElementById('pauseTimerBtn');
            
            if (startTimerBtn) startTimerBtn.disabled = false;
            if (pauseTimerBtn) pauseTimerBtn.disabled = true;
            
            this.showNotification('Temporizador pausado', 'warning');
        }
    }
    
    resetTimer() {
        this.pauseTimer();
        this.timerSeconds = 0;
        this.updateTimerDisplay();
        
        const startTimerBtn = document.getElementById('startTimerBtn');
        const pauseTimerBtn = document.getElementById('pauseTimerBtn');
        
        if (startTimerBtn) startTimerBtn.disabled = false;
        if (pauseTimerBtn) pauseTimerBtn.disabled = true;
        
        this.showNotification('Temporizador reiniciado', 'warning');
    }
    
    updateTimerDisplay() {
        const minutes = Math.floor(this.timerSeconds / 60);
        const seconds = this.timerSeconds % 60;
        const display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        const timerDisplay = document.getElementById('timerDisplay');
        if (timerDisplay) timerDisplay.textContent = display;
    }
    
    newSession() {
        if (!confirm('¿Crear una nueva sesión? Se perderán los datos no guardados.')) return;
        
        this.players = [];
        this.enemies = [];
        this.initiativeOrder = [];
        this.currentTurn = 0;
        this.currentRound = 1;
        this.combatMode = false;
        this.notes = {
            session: '',
            plot: '',
            npcs: '',
            locations: ''
        };
        
        this.pdfData = {
            manual: null,
            bestiary: null,
            campaign: null
        };
        
        this.pdfPages = {
            manual: { current: 1, total: 1 },
            bestiary: { current: 1, total: 1 },
            campaign: { current: 1, total: 1 }
        };
        
        this.zoomLevels = {
            manual: 100,
            bestiary: 100,
            campaign: 100
        };
        
        // Restaurar bestiario original si existe
        if (this.bestiarioOriginal) {
            this.bestiarioActual = JSON.parse(JSON.stringify(this.bestiarioOriginal));
            this.bestiarioPersonalizado = null;
            this.fuenteBestiarioActual = 'original';
            this.generateBestiaryDenominaciones();
            this.setupBestiaryAutocomplete();
            this.updateBestiaryStatus('original');
        }
        
        localStorage.removeItem('customBestiary');
        localStorage.removeItem('customBestiaryName');
        
        this.updateUI();
        
        this.clearPDF('manual');
        this.clearPDF('bestiary');
        this.clearPDF('campaign');
        
        this.showNotification('Nueva sesión creada', 'success');
    }
    
    saveSession() {
        const sessionData = {
            players: this.players,
            enemies: this.enemies,
            initiativeOrder: this.initiativeOrder,
            currentTurn: this.currentTurn,
            currentRound: this.currentRound,
            combatMode: this.combatMode,
            notes: this.notes,
            bestiaryCustomLoaded: !!this.bestiarioPersonalizado,
            timestamp: new Date().toISOString(),
            version: '2.1'
        };
        
        const jsonData = JSON.stringify(sessionData, null, 2);
        localStorage.setItem('dmSessionData', jsonData);
        
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `dm-session-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showNotification('Sesión guardada y descargada', 'success');
    }
    
    loadSession() {
        const savedData = localStorage.getItem('dmSessionData');
        
        if (savedData) {
            try {
                const sessionData = JSON.parse(savedData);
                this.loadSessionData(sessionData);
                this.showNotification('Sesión cargada desde almacenamiento local', 'success');
                return;
            } catch (error) {
                console.error('Error al cargar sesión:', error);
            }
        }
        
        this.generateDefaultSession();
    }
    
    loadSessionData(sessionData) {
        this.players = sessionData.players || [];
        this.enemies = sessionData.enemies || [];
        this.initiativeOrder = sessionData.initiativeOrder || [];
        this.currentTurn = sessionData.currentTurn || 0;
        this.currentRound = sessionData.currentRound || 1;
        this.combatMode = sessionData.combatMode || false;
        this.notes = sessionData.notes || {
            session: '',
            plot: '',
            npcs: '',
            locations: ''
        };
        
        this.updateUI();
    }
    
    generateDefaultSession() {
        this.players = [];
        this.enemies = [];
        
        this.currentTurn = 0;
        this.currentRound = 1;
        this.combatMode = false;
        
        this.notes = {
            session: '',
            plot: '',
            npcs: '',
            locations: ''
        };
        
        this.updateUI();
        this.showNotification('Sesión nueva lista para usar', 'info');
    }
    
    updateUI() {
        this.updatePlayersList();
        this.updateEnemiesList();
        this.updateInitiativeOrder();
        this.updateFooter();
        this.updateNotesStats();
        
        const activeTab = document.querySelector('.notes-tab.active')?.dataset.tab || 'session';
        const editor = document.getElementById('dmNotesEditor');
        if (editor) {
            editor.innerHTML = this.notes[activeTab] || '';
        }
    }
    
    updateFooter() {
        const footerPlayers = document.getElementById('footerPlayers');
        const footerEnemies = document.getElementById('footerEnemies');
        const footerRound = document.getElementById('footerRound');
        
        if (footerPlayers) footerPlayers.textContent = this.players.length;
        if (footerEnemies) footerEnemies.textContent = this.enemies.length;
        if (footerRound) footerRound.textContent = this.currentRound;
    }
    
    updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const currentTime = document.getElementById('currentTime');
        if (currentTime) currentTime.textContent = timeString;
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : 
                        type === 'error' ? '#f44336' : 
                        type === 'warning' ? '#ff9800' : '#2196F3'};
            color: white;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 15px;
            z-index: 10000;
            animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            font-family: 'Cinzel', serif;
            font-weight: bold;
            max-width: 400px;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
        
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}

window.toggleSeccion = function(seccionId) {
    const seccion = document.getElementById(`seccion-${seccionId}`);
    if (!seccion) return;
    
    const contenido = document.getElementById(`contenido-${seccionId}`);
    const icono = seccion.querySelector('.desplegable-icon');
    
    if (seccion.classList.contains('collapsed')) {
        seccion.classList.remove('collapsed');
        if (icono) icono.className = 'fas fa-chevron-down desplegable-icon';
        if (contenido) contenido.style.display = 'block';
    } else {
        seccion.classList.add('collapsed');
        if (icono) icono.className = 'fas fa-chevron-right desplegable-icon';
        if (contenido) contenido.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.dmScreen = new DMScreen();
});
import('./ai/DMChat.js').then(module => {
    // El chat se inicializa solo con DOMContentLoaded
    console.log('Módulo de chat IA cargado');
}).catch(err => {
    console.error('Error cargando chat IA:', err);
});