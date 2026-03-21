class DMScreen {
    constructor() {
        this.players = [];
        this.enemies = [];
        this.initiativeOrder = [];
        this.currentTurn = 0;
        this.currentRound = 1;
        this.combatMode = false;
        
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
        
        this.bestiarioData = [];
        this.bestiarioOriginal = null;
        this.bestiaryDenominaciones = [];
        this.currentBestiaryEntry = null;
        this.bestiaryCustomLoaded = false;

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
        this.setupEventListeners();
        this.setupPDFJS();
        this.setupRichTextEditor();
        this.setupDrawingCanvas();
        this.updateUI();
        this.updateTime();
        
        setInterval(() => this.updateTime(), 60000);
        setInterval(() => {this.actualizarPersonajesPeriodicamente();}, 3000);    
        console.log('DM Screen inicializada');
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
                stats: pj.stats,
                ataques: pj.ataques,
                conjuros: pj.conjuros,
                inventario: pj.inventario,
                notas: pj.notas,
                imagen: pj.imagen,
                colores_personalizados: pj.colores_personalizados
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

    async actualizarPersonajesPeriodicamente() {
        try {
            const response = await fetch(`${this.baseUrl}/api/personajes/hoy`);
            const data = await response.json();
            const nuevosPersonajes = data.personajes || [];
            
            const hayCambios = JSON.stringify(nuevosPersonajes) !== JSON.stringify(this.personajesHoy);
            
            if (hayCambios) {
                console.log('🔄 Cambios detectados en personajes');
                
                const personajesAnteriores = this.personajesHoy;
                this.personajesHoy = nuevosPersonajes;
                
                this.jugadoresDenominaciones = this.personajesHoy.map(pj => ({
                    text: pj.nombre,
                    value: pj.nombre,
                    jugador: pj.jugador,
                    clase: pj.clase,
                    nivel: pj.nivel,
                    raza: pj.raza,
                    stats: pj.stats,
                    ataques: pj.ataques,
                    conjuros: pj.conjuros,
                    inventario: pj.inventario,
                    notas: pj.notas,
                    imagen: pj.imagen,
                    colores_personalizados: pj.colores_personalizados
                }));
                
                if (nuevosPersonajes.length > personajesAnteriores.length) {
                    this.showNotification(`Nuevo personaje: ${nuevosPersonajes[nuevosPersonajes.length-1].nombre}`, 'info');
                }
                
                if (this.modalAbierto) {
                    await this.verificarCambiosPersonaje();
                }
            }
            
        } catch (error) {
            console.error('Error actualizando personajes:', error);
        }
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
        
        if (personaje.colores_personalizados) {
            this.aplicarColoresPersonaje(modal, personaje.colores_personalizados);
        }
        
        modalBody.innerHTML = this.generarHTMLModal(personaje);
        
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
        
        if (personaje.stats?.hp || personaje.stats?.mana) {
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
            
            html += `</div>`;
            html += `</div>`;
        }
        
        if (personaje.savingThrows && personaje.savingThrows.length > 0) {
            html += `<div class="jugador-seccion">`;
            html += `<h3><i class="fas fa-shield-alt"></i> Tiradas de Salvación</h3>`;
            html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">`;
            
            personaje.savingThrows.sort((a, b) => a.name.localeCompare(b.name)).forEach(st => {
                const valorClass = st.value > 0 ? 'positivo' : (st.value < 0 ? 'negativo' : '');
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
            html += `<label style="display: block; margin-bottom: 10px; font-weight: bold;"><i class="fas fa-check-circle" style="color: #4CAF50;"></i> Éxitos (${successCount}/3)</label>`;
            html += `<div style="display: flex; gap: 10px; justify-content: center;">`;
            successes.forEach(() => {
                html += `<span style="width: 40px; height: 40px; border: 3px solid var(--accent-gold); border-radius: 8px; display: flex; align-items: center; justify-content: center; background: ${successes ? 'rgba(255,255,255,0.5)' : ''}"></span>`;
            });
            html += `</div></div>`;
            
            html += `<div style="text-align: center;">`;
            html += `<label style="display: block; margin-bottom: 10px; font-weight: bold;"><i class="fas fa-times-circle" style="color: #ff4444;"></i> Fallos (${failCount}/3)</label>`;
            html += `<div style="display: flex; gap: 10px; justify-content: center;">`;
            fails.forEach(() => {
                html += `<span style="width: 40px; height: 40px; border: 3px solid var(--accent-gold); border-radius: 8px; display: flex; align-items: center; justify-content: center; background: ${fails ? 'rgba(255,255,255,0.5)' : ''}"></span>`;
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

    async loadBestiarioOriginal() {
        try {
            const url = `${this.baseUrl}${this.apiEndpoints.BESTIARIO}`;
            console.log('📡 Cargando bestiario desde:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Error al cargar desde servidor');
            }
            
            const data = await response.json();
            this.bestiarioOriginal = data;
            this.bestiarioData = data;
            console.log('✅ Bestiario cargado desde servidor');
            
        } catch (error) {
            console.warn('⚠️ Error cargando desde servidor:', error);
            
            try {
                const fallbackResponse = await fetch('/data/bestiario.json');
                const data = await fallbackResponse.json();
                this.bestiarioOriginal = data;
                this.bestiarioData = data;
                console.log(' Bestiario cargado en modo fallback');
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
                
                this.bestiarioData = customData;
                this.bestiaryCustomLoaded = true;
                
                try {
                    const url = `${this.baseUrl}${this.apiEndpoints.BESTIARIO}`;
                    await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(customData)
                    });
                    console.log('✅ Bestiario guardado en servidor');
                } catch (serverError) {
                    console.warn('⚠️ No se pudo guardar en servidor:', serverError);
                    localStorage.setItem('customBestiary', JSON.stringify(customData));
                    localStorage.setItem('customBestiaryName', file.name);
                }
                
                this.generateBestiaryDenominaciones();
                this.setupBestiaryAutocomplete();
                this.updateBestiaryStatus('custom', file.name);
                this.showNotification(`Bestiario cargado: ${customData.length} criaturas`, 'success');
                
            } catch (error) {
                console.error('❌ Error:', error);
                this.showNotification(`Error: ${error.message}`, 'error');
            }
        };
        
        reader.readAsText(file);
    }    
    
    restaurarBestiarioOriginal() {
        if (this.bestiarioOriginal) {
            this.bestiarioData = [...this.bestiarioOriginal];
            this.bestiaryCustomLoaded = false;
            this.generateBestiaryDenominaciones();
            this.setupBestiaryAutocomplete();
            this.updateBestiaryStatus('original');
            
            localStorage.removeItem('customBestiary');
            localStorage.removeItem('customBestiaryName');
            
            this.showNotification('Bestiario original restaurado', 'info');
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
        this.bestiaryDenominaciones = this.bestiarioData.map(entry => ({
            text: entry.nombre,
            value: entry.nombre
        }));
        console.log('Denominaciones generadas:', this.bestiaryDenominaciones.length);
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
        
        let bestiaryEntry = this.bestiarioData.find(entry => 
            entry.nombre === searchTerm
        );
        
        if (!bestiaryEntry) {
            bestiaryEntry = this.bestiarioData.find(entry => 
                entry.nombre.startsWith(searchTerm)
            );
        }
        
        if (!bestiaryEntry) {
            const searchWords = searchTerm.split(/\s+/);
            bestiaryEntry = this.bestiarioData.find(entry => {
                const entryWords = entry.nombre.split(/\s+/);
                return searchWords.some(searchWord => 
                    entryWords.some(entryWord => entryWord === searchWord)
                );
            });
        }
        
        if (!bestiaryEntry && searchTerm.length >= 4) {
            bestiaryEntry = this.bestiarioData.find(entry => 
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
            
            const bestiaryType = this.bestiaryCustomLoaded ? 'personalizado' : 'original';
            this.showNotification(`Datos de ${bestiaryEntry.nombre} precargados (bestiario ${bestiaryType})`, 'success');
        }
    }
    
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
        
        setTimeout(() => {
            this.setupJugadoresAutocomplete();
        }, 500);
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
                
                let bestiaryEntry = this.bestiarioData.find(entry => 
                    entry.nombre === searchTerm
                );
                
                if (!bestiaryEntry) {
                    bestiaryEntry = this.bestiarioData.find(entry => 
                        entry.nombre.startsWith(searchTerm)
                    );
                }
                
                if (!bestiaryEntry) {
                    const searchWords = searchTerm.split(/\s+/);
                    bestiaryEntry = this.bestiarioData.find(entry => {
                        const entryWords = entry.nombre.split(/\s+/);
                        return searchWords.some(searchWord => 
                            entryWords.some(entryWord => entryWord === searchWord)
                        );
                    });
                }
                
                if (!bestiaryEntry && searchTerm.length >= 4) {
                    bestiaryEntry = this.bestiarioData.find(entry => 
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
        
        const avatarText = entity.type === 'player' ? `P${number}` : `E${number}`;
        const hpColor = entity.hp > entity.maxHp * 0.5 ? 'green' : entity.hp > entity.maxHp * 0.25 ? 'orange' : 'red';
        
        const raceDisplay = entity.type === 'enemy' && entity.race ? 
            `<span><i class="fas fa-paw"></i> ${entity.race}</span>` : '';
        
        const personajeInfo = entity.type === 'player' ? 
            this.personajesHoy.find(p => p.nombre === entity.name) : null;
        
        div.innerHTML = `
            <div class="entity-avatar ${entity.type}">${avatarText}</div>
            <div class="entity-info">
                <div class="entity-name">${entity.name}</div>
                <div class="entity-details">
                    <span>CA: ${entity.ca}</span>
                    <span style="color: ${hpColor};">❤ ${entity.hp}/${entity.maxHp}</span>
                    <span class="initiative-score">${entity.initiative || '?'}</span>
                    ${raceDisplay}
                    ${personajeInfo ? `<span><i class="fas fa-user"></i> ${personajeInfo.jugador}</span>` : ''}
                </div>
            </div>
            <div class="entity-controls">
                ${entity.type === 'enemy' ? `
                    <button class="entity-btn info-btn" title="Ver información de ${entity.race || entity.name}" data-action="info">
                        <i class="fas fa-info-circle"></i>
                    </button>
                ` : personajeInfo ? `
                    <button class="entity-btn info-btn" title="Ver información de ${entity.name}" data-action="playerInfo">
                        <i class="fas fa-info-circle"></i>
                    </button>
                ` : ''}
                <button class="entity-btn" title="${entity.type === 'player' ? 'Cambiar iniciativa' : 'Tirar iniciativa'}" data-action="roll">
                    <i class="fas fa-${entity.type === 'player' ? 'edit' : 'dice'}"></i>
                </button>
                <button class="entity-btn" title="Editar vida" data-action="editHP">
                    <i class="fas fa-heart"></i>
                </button>
                <button class="entity-btn" title="Editar" data-action="edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="entity-btn" title="Eliminar" data-action="remove">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        return div;
    }
    
    handleEntityClick(event, type) {
        const button = event.target.closest('.entity-btn');
        if (!button) return;
        
        const entityCard = event.target.closest('.entity-card');
        if (!entityCard) return;
        
        const entityId = entityCard.dataset.id;
        const action = button.dataset.action;
        
        const entity = type === 'player' 
            ? this.players.find(p => p.id === entityId)
            : this.enemies.find(e => e.id === entityId);
        
        if (!entity) return;
        
        switch (action) {
            case 'roll':
                this.rollInitiativeForEntity(entity);
                break;
            case 'editHP':
                this.editHPForEntity(entity);
                break;
            case 'edit':
                this.editEntity(entity, type);
                break;
            case 'remove':
                this.removeEntity(entityId, type);
                break;
            case 'info':
                this.showBestiaryInfo(entity);
                break;
            case 'playerInfo':
                const personaje = this.personajesHoy.find(p => p.nombre === entity.name);
                if (personaje) this.mostrarInfoJugador(personaje);
                break;
        }
    }
    
    async showBestiaryInfo(entity) {
        if (!entity.race && !entity.name) {
            this.showNotification('No hay información de raza disponible', 'warning');
            return;
        }
        
        const searchTerm = (entity.race || entity.name).toUpperCase().trim();
        
        let bestiaryEntry = this.bestiarioData.find(entry => 
            entry.nombre === searchTerm
        );
        
        if (!bestiaryEntry) {
            bestiaryEntry = this.bestiarioData.find(entry => 
                entry.nombre.startsWith(searchTerm)
            );
        }
        
        if (!bestiaryEntry) {
            const searchWords = searchTerm.split(/\s+/);
            bestiaryEntry = this.bestiarioData.find(entry => {
                const entryWords = entry.nombre.split(/\s+/);
                return searchWords.some(searchWord => 
                    entryWords.some(entryWord => entryWord === searchWord)
                );
            });
        }
        
        if (!bestiaryEntry) {
            this.showNotification(`No se encontró información para: ${entity.race || entity.name}`, 'error');
            return;
        }
        
        this.currentBestiaryEntry = bestiaryEntry;
        this.renderBestiaryModal(bestiaryEntry, entity);
    }
    
    getBestiaryImage(creatureName) {
        const searchTerm = creatureName.toUpperCase().trim();
        
        let bestiaryEntry = this.bestiarioData.find(entry => 
            entry.nombre === searchTerm
        );
        
        if (!bestiaryEntry) {
            bestiaryEntry = this.bestiarioData.find(entry => 
                entry.nombre.startsWith(searchTerm)
            );
        }
        
        if (!bestiaryEntry) {
            const searchWords = searchTerm.split(/\s+/);
            bestiaryEntry = this.bestiarioData.find(entry => {
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
        let imageError = false;
        
        let html = '';
        
        html += `<div style="display: flex; flex-direction: column; align-items: center; margin-bottom: 20px;">`;
        if (imageUrl) {
            html += `
                <div style="width: 100%; max-height: 300px; overflow: hidden; border-radius: 8px; border: 2px solid var(--accent-gold); margin-bottom: 10px;">
                    <img src="${imageUrl}" alt="${entry.nombre}" style="width: 100%; height: auto; object-fit: contain; max-height: 300px;">
                </div>
            `;
            if (imageSource) imageSource.textContent = 'Imagen desde el archivo JSON';
        } else {
            html += `
                <div style="width: 100%; height: 200px; background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple)); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: white; margin-bottom: 10px; border: 2px solid var(--accent-gold);">
                    <i class="fas fa-dragon" style="font-size: 4rem; margin-bottom: 10px; opacity: 0.8;"></i>
                    <p style="font-family: 'MedievalSharp', cursive;">${entry.nombre}</p>
                    <p style="font-size: 0.9rem; opacity: 0.7;">Imagen no disponible en el JSON</p>
                </div>
            `;
            if (imageSource) imageSource.textContent = 'No se encontró imagen en el JSON';
        }
        html += `</div>`;
        
        html += `<h2>${entry.nombre}</h2>`;
        
        if (entry.descripcion) {
            html += `<p><em>${entry.descripcion}</em></p>`;
        }
        
        if (entry.estadisticas && Object.keys(entry.estadisticas).length > 0) {
            const stats = entry.estadisticas;
            
            html += `<div class="stat-block">`;
            html += `<h3>Estadísticas</h3>`;
            
            if (stats.tipo) html += `<p><strong>Tipo:</strong> ${stats.tipo}</p>`;
            if (stats.ca) html += `<p><strong>CA:</strong> ${stats.ca}</p>`;
            if (stats.pg) html += `<p><strong>PG:</strong> ${stats.pg}</p>`;
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
                
                let bestiaryEntry = this.bestiarioData.find(entry => 
                    entry.nombre === searchTerm
                );
                
                if (!bestiaryEntry) {
                    bestiaryEntry = this.bestiarioData.find(entry => 
                        entry.nombre.startsWith(searchTerm)
                    );
                }
                
                if (!bestiaryEntry) {
                    const searchWords = searchTerm.split(/\s+/);
                    bestiaryEntry = this.bestiarioData.find(entry => {
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
        const currentHP = prompt(`Introduce la vida actual para ${entity.name} (Vida máxima: ${entity.maxHp}):`, entity.hp);
        if (currentHP !== null) {
            const hpValue = parseInt(currentHP);
            if (!isNaN(hpValue)) {
                entity.hp = hpValue;
                
                if (entity.type === 'player') {
                    this.updatePlayersList();
                } else {
                    this.updateEnemiesList();
                }
                
                this.showNotification(`${entity.name}: Vida cambiada a ${hpValue}/${entity.maxHp}`, 'info');
            }
        }
    }
    
    rollAllEnemiesInitiative() {
        let updated = false;
        this.enemies.forEach(enemy => {
            if (enemy.type === 'enemy') {
                let dexBonus = 0;
                if (enemy.race) {
                    const searchTerm = enemy.race.toUpperCase().trim();
                    
                    let bestiaryEntry = this.bestiarioData.find(entry => 
                        entry.nombre === searchTerm
                    );
                    
                    if (!bestiaryEntry) {
                        bestiaryEntry = this.bestiarioData.find(entry => 
                            entry.nombre.startsWith(searchTerm)
                        );
                    }
                    
                    if (!bestiaryEntry) {
                        const searchWords = searchTerm.split(/\s+/);
                        bestiaryEntry = this.bestiarioData.find(entry => {
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
            const bestiaryType = this.bestiaryCustomLoaded ? 'personalizado' : 'original';
            this.showNotification(`Iniciativa tirada para todos los enemigos (usando bestiario ${bestiaryType})`, 'success');
        } else {
            this.showNotification('No hay enemigos para tirar iniciativa', 'warning');
        }
    }
    
    editEntity(entity, type) {
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
        }
    }
    
    removeEntity(id, type) {
        if (!confirm(`¿Eliminar este ${type === 'player' ? 'jugador' : 'enemigo'}?`)) return;
        
        const currentEntityId = this.initiativeOrder[this.currentTurn]?.id;
        
        if (type === 'player') {
            this.players = this.players.filter(p => p.id !== id);
            this.updatePlayersList();
        } else {
            this.enemies = this.enemies.filter(e => e.id !== id);
            this.updateEnemiesList();
        }
        
        this.updateInitiativeOrderAfterRemoval(id, currentEntityId);
        
        this.showNotification(`${type === 'player' ? 'Jugador' : 'Enemigo'} eliminado`, 'warning');
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
        
        if (this.bestiarioOriginal) {
            this.bestiarioData = [...this.bestiarioOriginal];
            this.bestiaryCustomLoaded = false;
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
            bestiaryCustomLoaded: this.bestiaryCustomLoaded,
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