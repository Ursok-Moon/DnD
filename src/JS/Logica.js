let deck = [];
let drawnCards = [];
let deck2 = [];
let drawnCards2 = [];

const deckContainer = document.getElementById('deckContainer');
const drawnCardsContainer = document.getElementById('drawnCards');
const deckContainer2 = document.getElementById('deckContainer2');
const drawnCardsContainer2 = document.getElementById('drawnCards2');
const shuffleBtn = document.getElementById('shuffleBtn');
const resetBtn = document.getElementById('resetBtn');
const shuffleBtn2 = document.getElementById('shuffleBtn2');
const resetBtn2 = document.getElementById('resetBtn2');
const deckCountEl = document.getElementById('deckCount');
const deckCountEl2 = document.getElementById('deckCount2');

const cardDescriptionModal = document.getElementById('cardDescriptionModal');
const closeDescription = document.getElementById('closeDescription');
const descriptionImage = document.getElementById('descriptionImage');
const descriptionName = document.getElementById('descriptionName');
const descriptionType = document.getElementById('descriptionType');
const descriptionText = document.getElementById('descriptionText');

// MODIFICADO: Mejor manejo de la URL base
const BASE_URL = (typeof CONFIG !== 'undefined' && CONFIG.SERVER_URL) 
    ? CONFIG.SERVER_URL 
    : ''; // Vacío = usar rutas relativas

const API_ENDPOINTS = (typeof CONFIG !== 'undefined' && CONFIG.API)
    ? CONFIG.API
    : { DEMO: '/api/json/demo' };

// NUEVA FUNCIÓN: Construir URL correctamente
function construirUrl(endpoint) {
    // Si hay BASE_URL, usarlo
    if (BASE_URL) {
        return `${BASE_URL}${endpoint}`;
    }
    // Si no, usar ruta relativa (funciona desde cualquier IP)
    return endpoint;
}

function procesarRutaImagen(ruta) {
    if (!ruta) {
        return 'https://via.placeholder.com/150x210/8B4513/FFFFFF?text=CARTA';
    }
   
    if (ruta.startsWith('http')) {
        return ruta;
    }
    
    let rutaLimpia = ruta.replace(/\/+/g, '/');
    
    if (!rutaLimpia.startsWith('/')) {
        rutaLimpia = '/' + rutaLimpia;
    }
    
    return rutaLimpia;
}

function shuffleDeck(deckToShuffle) {
    const newDeck = [...deckToShuffle];
    for (let i = newDeck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
    }
    return newDeck;
}

async function loadDecks() {
    try {
        // MODIFICADO: Usar construirUrl()
        const url = construirUrl(API_ENDPOINTS.DEMO);
        console.log('📡 Cargando mazos desde:', url);
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.cartas || !data.cartas2) {
            throw new Error('Formato JSON inválido');
        }
        
        deck = shuffleDeck(data.cartas.map(card => ({
            ...card,
            imagen: procesarRutaImagen(card.imagen)
        })));
        
        deck2 = shuffleDeck(data.cartas2.map(card => ({
            ...card,
            imagen: procesarRutaImagen(card.imagen)
        })));
        
        updateUI();
        enableButtons();
        
    } catch (error) {
        console.error('❌ Error cargando desde servidor:', error);
        cargarMazosEmergencia();
    }
}

function cargarMazosEmergencia() {
    console.warn('⚠️ Usando mazos de emergencia');
    
    deck = shuffleDeck([
        {
            id: 1,
            nombre: "Grial Sagrado",
            tipo: "Artefacto Divino",
            descripcion: "El Santo Grial otorga bendiciones divinas.",
            imagen: "https://via.placeholder.com/150x210/8B4513/FFFFFF?text=GRIAL"
        },
        {
            id: 2,
            nombre: "Lazarus",
            tipo: "Reliquia",
            descripcion: "Permite resucitar a un compañero caído.",
            imagen: "https://via.placeholder.com/150x210/8B0000/FFFFFF?text=LAZARUS"
        }
    ]);
    
    deck2 = shuffleDeck([
        {
            id: 1,
            nombre: "Daga Maldita",
            tipo: "Arma Maldita",
            descripcion: "Daga que consume la vitalidad de su portador.",
            imagen: "https://via.placeholder.com/150x210/2F4F4F/FFFFFF?text=DAGA"
        },
        {
            id: 2,
            nombre: "Poción de Veneno",
            tipo: "Consumible",
            descripcion: "Poción que parece de curación pero en realidad es veneno.",
            imagen: "https://via.placeholder.com/150x210/006400/FFFFFF?text=VENENO"
        }
    ]);
    
    updateUI();
    enableButtons();
}

function enableButtons() {
    shuffleBtn.disabled = false;
    resetBtn.disabled = false;
    shuffleBtn2.disabled = false;
    resetBtn2.disabled = false;
    
    [shuffleBtn, resetBtn, shuffleBtn2, resetBtn2].forEach(btn => {
        if (!btn.disabled) {
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    });
}

function showCardDescription(card) {
    descriptionImage.src = card.imagen;
    descriptionImage.alt = card.nombre;
    descriptionName.textContent = card.nombre;
    descriptionType.textContent = card.tipo || 'Sin tipo';
    descriptionText.textContent = card.descripcion || 'Esta carta no tiene descripción disponible.';
    
    cardDescriptionModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCardDescription() {
    cardDescriptionModal.style.display = 'none';
    document.body.style.overflow = 'auto';
}

function handleCardClick(card, isFromDeck = false, deckType = 'deck1') {
    if (isFromDeck) {
        drawCardFromDeck(deckType);
    } else if (card) {
        showCardDescription(card);
    }
}

function drawCardFromDeck(deckType) {
    let deckToDrawFrom, drawnCardsArray, container;
    
    if (deckType === 'deck2') {
        deckToDrawFrom = deck2;
        drawnCardsArray = drawnCards2;
        container = drawnCardsContainer2;
    } else {
        deckToDrawFrom = deck;
        drawnCardsArray = drawnCards;
        container = drawnCardsContainer;
    }
    
    if (deckToDrawFrom.length === 0) {
        return;
    }
    
    const card = deckToDrawFrom.pop();
    drawnCardsArray.push(card);
    
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.cardId = card.id;
    cardEl.innerHTML = `
        <div class="card-front">
            <img src="${card.imagen}" alt="${card.nombre}" loading="lazy" 
                 onerror="this.src='https://via.placeholder.com/150x210/8B4513/FFFFFF?text=CARTA'">
        </div>
        <div class="card-back"></div>
    `;
    
    cardEl.addEventListener('click', (e) => {
        e.stopPropagation();
        handleCardClick(card, false);
    });
    
    container.appendChild(cardEl);
    
    setTimeout(() => {
        cardEl.classList.add('flipped');
    }, 50);
    
    updateUI();
}

function resetDeck(deckType) {
    let deckToReset, drawnCardsArray, container, originalDeck;
    
    if (deckType === 'deck2') {
        deckToReset = deck2;
        drawnCardsArray = drawnCards2;
        container = drawnCardsContainer2;
        originalDeck = [...deck2, ...drawnCards2];
    } else {
        deckToReset = deck;
        drawnCardsArray = drawnCards;
        container = drawnCardsContainer;
        originalDeck = [...deck, ...drawnCards];
    }
    
    drawnCardsArray.length = 0;
    container.innerHTML = '';
    
    deckToReset.length = 0;
    deckToReset.push(...originalDeck);
    
    if (deckType === 'deck2') {
        deck2 = shuffleDeck(deckToReset);
    } else {
        deck = shuffleDeck(deckToReset);
    }
    
    updateUI();
}

function updateUI() {
    deckCountEl.textContent = deck.length;
    deckCountEl2.textContent = deck2.length;
    
    deckContainer.innerHTML = '';
    if (deck.length > 0) {
        const deckPile = document.createElement('div');
        deckPile.className = 'deck-pile';
        deckPile.title = `Click para sacar carta (${deck.length} restantes)`;
        deckPile.addEventListener('click', () => {
            handleCardClick(null, true, 'deck1');
        });
        deckContainer.appendChild(deckPile);
    }
    
    deckContainer2.innerHTML = '';
    if (deck2.length > 0) {
        const deckPile = document.createElement('div');
        deckPile.className = 'deck-pile dark';
        deckPile.title = `Click para sacar carta (${deck2.length} restantes)`;
        deckPile.addEventListener('click', () => {
            handleCardClick(null, true, 'deck2');
        });
        deckContainer2.appendChild(deckPile);
    }
}

function init() {
    loadDecks();
    
    closeDescription.addEventListener('click', closeCardDescription);
    cardDescriptionModal.addEventListener('click', (e) => {
        if (e.target === cardDescriptionModal) {
            closeCardDescription();
        }
    });
    
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeCardDescription();
        }
    });
}

shuffleBtn.addEventListener('click', () => {
    deck = shuffleDeck(deck);
    updateUI();
});

resetBtn.addEventListener('click', () => {
    resetDeck('deck1');
});

shuffleBtn2.addEventListener('click', () => {
    deck2 = shuffleDeck(deck2);
    updateUI();
});

resetBtn2.addEventListener('click', () => {
    resetDeck('deck2');
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}