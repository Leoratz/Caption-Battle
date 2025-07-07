const socket = io();

// Variables globales du jeu
let currentPlayer = null;
let currentRoom = null;
let players = [];
let currentMeme = null;
let captions = [];
let hasSubmittedCaption = false;
let hasVoted = false;
let currentTheme = 'light'; // 'light' ou 'dark'

// Thèmes de couleurs
const themes = {
    light: {
        '--bg-gradient-start': '#667eea',
        '--bg-gradient-end': '#764ba2',
        '--primary-bg': 'white',
        '--secondary-bg': '#f8f9fa',
        '--text-primary': '#333',
        '--text-secondary': '#6c757d',
        '--text-light': 'white',
        '--border-color': '#e9ecef',
        '--shadow': 'rgba(0,0,0,0.1)',
        '--shadow-dark': 'rgba(0,0,0,0.3)',
        '--accent-primary': '#4CAF50',
        '--accent-secondary': '#2196F3',
        '--warning': '#ffc107',
        '--danger': '#e74c3c'
    },
    dark: {
        '--bg-gradient-start': '#2c3e50',
        '--bg-gradient-end': '#34495e',
        '--primary-bg': '#2c3e50',
        '--secondary-bg': '#34495e',
        '--text-primary': '#ecf0f1',
        '--text-secondary': '#bdc3c7',
        '--text-light': '#ecf0f1',
        '--border-color': '#4a5f7a',
        '--shadow': 'rgba(0,0,0,0.3)',
        '--shadow-dark': 'rgba(0,0,0,0.5)',
        '--accent-primary': '#27ae60',
        '--accent-secondary': '#3498db',
        '--warning': '#f39c12',
        '--danger': '#e74c3c'
    }
};

console.log('🚀 Script client.js chargé');

// Attendre que la page soit complètement chargée
window.addEventListener('load', function() {
    console.log('=== PAGE CHARGÉE ===');
    console.log('🎯 Initialisation du jeu...');
    
    // Petit délai pour s'assurer que Socket.IO est prêt
    setTimeout(initializeGame, 100);
});

function initializeGame() {
    console.log('🔧 Début de l\'initialisation...');
    
    try {
        // Vérification des éléments HTML de base
        const joinForm = document.getElementById('join-form');
        const gameDiv = document.getElementById('game');
        
        console.log('🔍 Vérification des éléments:');
        console.log('- joinForm:', !!joinForm);
        console.log('- gameDiv:', !!gameDiv);
        
        if (!joinForm || !gameDiv) {
            throw new Error('Éléments HTML de base manquants');
        }
        
        // Ajouter les styles CSS
        console.log('🎨 Ajout des styles...');
        addBasicStyles();
        
        // Configurer les événements
        console.log('⚡ Configuration des événements...');
        setupGame();
        
        console.log('✅ INITIALISATION TERMINÉE');
        console.log('🎮 Jeu prêt !');
        
    } catch (error) {
        console.error('❌ ERREUR LORS DE L\'INITIALISATION:', error);
        alert('Erreur lors de l\'initialisation: ' + error.message);
    }
}

function setupGame() {
    const joinForm = document.getElementById('join-form');
    const gameDiv = document.getElementById('game');
    
    if (!joinForm || !gameDiv) {
        console.error('❌ Éléments manquants pour la configuration');
        return;
    }
    
    // Événement de soumission du formulaire
    joinForm.addEventListener('submit', function(event) {
        event.preventDefault();
        console.log('=== FORMULAIRE SOUMIS ===');
        
        const pseudo = document.getElementById('pseudo').value.trim();
        const room = document.getElementById('room').value.trim();
        
        console.log('📝 Pseudo:', pseudo, 'Room:', room);
        
        if (!pseudo || !room) {
            alert('Veuillez entrer un pseudo et un nom de salle valides.');
            return;
        }
        
        currentPlayer = pseudo;
        currentRoom = room;
        
        // Envoyer au serveur
        console.log('📡 Envoi au serveur...');
        socket.emit('join-room', { pseudo, room });
        
        // Cacher le formulaire et créer l'interface
        joinForm.style.display = 'none';
        createGameInterface(gameDiv);
    });
    
    // Délégation d'événements pour les boutons du jeu
    document.addEventListener('click', function(event) {
        console.log('🖱️ Clic détecté:', event.target.id);
        
        // Boutons de thème
        if (event.target.id === 'light-theme-btn') {
            event.preventDefault();
            switchTheme('light');
        }
        
        if (event.target.id === 'dark-theme-btn') {
            event.preventDefault();
            switchTheme('dark');
        }
        
        // Bouton démarrer le jeu
        if (event.target.id === 'start-game-btn') {
            event.preventDefault();
            console.log('🎮 Démarrage du jeu !');
            startSimulatedGame();
        }
        
        // Bouton soumettre légende
        if (event.target.id === 'submit-caption') {
            event.preventDefault();
            const captionText = document.getElementById('caption-text').value.trim();
            
            if (captionText && !hasSubmittedCaption) {
                hasSubmittedCaption = true;
                handleCaptionSubmission(captionText);
                event.target.disabled = true;
                event.target.textContent = '✅ Envoyé !';
                document.getElementById('caption-text').disabled = true;
            }
        }
        
        // Bouton round suivant
        if (event.target.id === 'next-round-btn') {
            event.preventDefault();
            startSimulatedGame();
        }
        
        // Boutons de vote
        if (event.target.classList.contains('vote-btn')) {
            event.preventDefault();
            const index = parseInt(event.target.getAttribute('data-index'));
            if (!isNaN(index)) {
                voteForCaption(index);
            }
        }
    });
}

function createGameInterface(gameDiv) {
    console.log('🏗️ Création de l\'interface de jeu...');
    
    gameDiv.innerHTML = `
        <div class="theme-switcher">
            <button id="light-theme-btn" class="theme-btn ${currentTheme === 'light' ? 'active' : ''}">☀️ Light</button>
            <button id="dark-theme-btn" class="theme-btn ${currentTheme === 'dark' ? 'active' : ''}">🌙 Dark</button>
        </div>
        
        <div class="game-container">
            <div class="game-header">
                <h2>🎮 Caption Battle - Salle: ${currentRoom}</h2>
                <div class="player-info">
                    <span>👤 Joueur: ${currentPlayer}</span>
                    <span id="score">🏆 Score: 0</span>
                </div>
            </div>
            
            <div class="players-list">
                <h3>🎯 Joueurs connectés:</h3>
                <div id="players-container">
                    <div class="player-item">
                        <span class="player-name">${currentPlayer}</span>
                        <span class="player-score">Score: 0</span>
                        <span class="host-badge">HOST</span>
                    </div>
                </div>
            </div>
            
            <div class="game-content">
                <div id="waiting-area" class="phase-container">
                    <h3>🚀 Prêt à jouer !</h3>
                    <p>Cliquez sur le bouton pour commencer une partie de démonstration</p>
                    <button id="start-game-btn" class="big-button">🎮 Démarrer le jeu</button>
                </div>
                
                <div id="meme-display" class="phase-container" style="display: none;">
                    <h3>💭 Créez une légende pour ce meme !</h3>
                    <div class="meme-container">
                        <img id="current-meme" src="" alt="Meme actuel" />
                    </div>
                    <div class="caption-input">
                        <input type="text" id="caption-text" placeholder="Entrez votre légende drôle..." maxlength="150" />
                        <button id="submit-caption">📝 Soumettre</button>
                    </div>
                    <div id="timer" class="timer">⏰ Temps restant: <span id="time-left">30</span>s</div>
                </div>
                
                <div id="voting-phase" class="phase-container" style="display: none;">
                    <h3>🗳️ Votez pour la meilleure légende !</h3>
                    <div class="meme-container">
                        <img id="voting-meme" src="" alt="Meme pour vote" />
                    </div>
                    <div id="captions-list"></div>
                    <div id="vote-timer" class="timer">⏰ Temps de vote: <span id="vote-time-left">20</span>s</div>
                </div>
                
                <div id="results-phase" class="phase-container" style="display: none;">
                    <h3>🏆 Résultats du round !</h3>
                    <div id="round-results"></div>
                    <div id="leaderboard">
                        <h4>📊 Classement:</h4>
                        <div id="scores-list"></div>
                    </div>
                    <button id="next-round-btn" class="big-button">🔄 Round suivant</button>
                </div>
            </div>
        </div>
    `;
    
    console.log('✅ Interface créée avec succès !');
}

function startSimulatedGame() {
    console.log('🎮 Démarrage du jeu simulé...');
    
    // Réinitialiser les états
    hasSubmittedCaption = false;
    hasVoted = false;
    
    // Passer en phase meme
    switchPhase('meme-display');
    
    // Memes disponibles
    const availableMemes = [
        'bibble.jpeg', 'dingdong.jpeg', 'dylan_bratz.jpeg', 'harry.jpg',
        'justbieber.jpeg', 'lazytown.jpeg', 'nez.jpeg', 'rat.jpeg', 
        'shrek.jpeg', 'thisisfine.jpg'
    ];
    
    // Sélectionner un meme aléatoire
    const randomMeme = availableMemes[Math.floor(Math.random() * availableMemes.length)];
    console.log(`🎯 Meme sélectionné: ${randomMeme}`);
    
    // Afficher le meme
    const memeImg = document.getElementById('current-meme');
    const votingMeme = document.getElementById('voting-meme');
    
    if (memeImg) {
        memeImg.src = `/memes/${randomMeme}`;
        memeImg.onload = () => console.log('✅ Meme chargé !');
        memeImg.onerror = () => console.error('❌ Erreur chargement meme');
        
        if (votingMeme) {
            votingMeme.src = `/memes/${randomMeme}`;
        }
    }
    
    // Reset des champs
    const captionInput = document.getElementById('caption-text');
    const submitBtn = document.getElementById('submit-caption');
    
    if (captionInput) {
        captionInput.value = '';
        captionInput.disabled = false;
    }
    
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '📝 Soumettre';
    }
    
    // Timer
    startTimer(30, 'time-left', () => {
        if (!hasSubmittedCaption) {
            handleCaptionSubmission('Temps écoulé !');
        }
    });
}

function handleCaptionSubmission(caption) {
    console.log('📝 Soumission de légende:', caption);
    
    // Créer des légendes simulées
    captions = [
        { text: caption, author: currentPlayer },
        { text: 'Quand tu réalises que c\'est lundi demain 😭', author: 'Bot1' },
        { text: 'Moi essayant de comprendre les maths', author: 'Bot2' },
        { text: 'Cette expression quand tu vois ton relevé de compte', author: 'Bot3' }
    ];
    
    setTimeout(() => {
        switchPhase('voting-phase');
        displayCaptionsForVoting();
        startTimer(20, 'vote-time-left', () => {
            if (!hasVoted) {
                // Vote automatique
                voteForCaption(1);
            }
        });
    }, 2000);
}

function displayCaptionsForVoting() {
    console.log('🗳️ Affichage des légendes pour vote');
    
    const captionsList = document.getElementById('captions-list');
    
    if (captionsList) {
        captionsList.innerHTML = captions.map((caption, index) => `
            <div class="caption-option">
                <div class="caption-text">"${caption.text}"</div>
                <div class="caption-author">- ${caption.author}</div>
                <button class="vote-btn" data-index="${index}" ${caption.author === currentPlayer ? 'disabled' : ''}>
                    ${caption.author === currentPlayer ? '❌ Votre légende' : '👍 Voter'}
                </button>
            </div>
        `).join('');
    }
}

function voteForCaption(index) {
    if (hasVoted) return;
    
    console.log('🗳️ Vote pour la légende', index);
    hasVoted = true;
    
    // Désactiver tous les boutons
    document.querySelectorAll('.vote-btn').forEach(btn => {
        btn.disabled = true;
        if (parseInt(btn.getAttribute('data-index')) === index) {
            btn.textContent = '✅ Voté !';
        }
    });
    
    // Afficher les résultats
    setTimeout(() => {
        showResults();
    }, 2000);
}

function showResults() {
    console.log('🏆 Affichage des résultats');
    
    switchPhase('results-phase');
    
    // Simuler des votes
    const results = captions.map(caption => ({
        ...caption,
        votes: Math.floor(Math.random() * 4) + 1
    })).sort((a, b) => b.votes - a.votes);
    
    const winner = results[0];
    
    const resultsDiv = document.getElementById('round-results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="winning-caption">
                <h4>🏆 Légende gagnante :</h4>
                <div class="winner-info">
                    <p class="caption">"${winner.text}"</p>
                    <p class="author">Par: ${winner.author} (${winner.votes} votes)</p>
                </div>
            </div>
            <div class="all-captions">
                <h4>Toutes les légendes :</h4>
                ${results.map((caption, index) => `
                    <div class="result-caption ${caption.author === currentPlayer ? 'my-caption' : ''}">
                        <span class="rank">#${index + 1}</span>
                        <span class="caption-text">"${caption.text}"</span>
                        <span class="caption-author">${caption.author}</span>
                        <span class="caption-votes">${caption.votes} vote(s)</span>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Mettre à jour le score du joueur
    const playerResult = results.find(r => r.author === currentPlayer);
    if (playerResult) {
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            const currentScore = parseInt(scoreElement.textContent.split(':')[1] || 0);
            const newScore = currentScore + playerResult.votes;
            scoreElement.textContent = `🏆 Score: ${newScore}`;
        }
    }
}

function switchPhase(phase) {
    console.log('🔄 Changement vers la phase:', phase);
    
    // Cacher toutes les phases
    const phases = ['waiting-area', 'meme-display', 'voting-phase', 'results-phase'];
    phases.forEach(phaseId => {
        const element = document.getElementById(phaseId);
        if (element) {
            element.style.display = 'none';
        }
    });
    
    // Afficher la phase actuelle
    const currentPhase = document.getElementById(phase);
    if (currentPhase) {
        currentPhase.style.display = 'block';
        console.log(`✅ Phase ${phase} affichée`);
    }
}

function startTimer(duration, elementId, callback) {
    let timeLeft = duration;
    const timerElement = document.getElementById(elementId);
    
    const countdown = setInterval(() => {
        if (timerElement) {
            timerElement.textContent = timeLeft;
        }
        
        timeLeft--;
        
        if (timeLeft < 0) {
            clearInterval(countdown);
            if (callback) callback();
        }
    }, 1000);
    
    return countdown;
}

// Fonction pour changer de thème
function switchTheme(themeName) {
    console.log('🎨 Changement de thème vers:', themeName);
    
    if (!themes[themeName]) {
        console.error('❌ Thème inconnu:', themeName);
        return;
    }
    
    currentTheme = themeName;
    
    // Appliquer les variables CSS du thème
    const root = document.documentElement;
    const theme = themes[themeName];
    
    Object.entries(theme).forEach(([property, value]) => {
        root.style.setProperty(property, value);
    });
    
    // Mettre à jour les boutons de thème
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const activeBtn = document.getElementById(`${themeName}-theme-btn`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    // Sauvegarder le thème dans le localStorage
    localStorage.setItem('captionBattleTheme', themeName);
    
    console.log('✅ Thème', themeName, 'appliqué');
}

// Ajouter les styles CSS de base
function addBasicStyles() {
    console.log('🎨 Ajout des styles CSS...');
    
    const style = document.createElement('style');
    style.textContent = `
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            margin: 0; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            min-height: 100vh; 
            color: #333;
        }
        
        h1 { 
            text-align: center; 
            color: white; 
            margin-bottom: 30px; 
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
            font-size: 2.5em;
        }
        
        #join-form { 
            max-width: 400px; 
            margin: 0 auto 30px; 
            background: white; 
            padding: 30px; 
            border-radius: 15px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        #join-form input { 
            width: 100%; 
            padding: 15px; 
            margin: 10px 0; 
            border: 2px solid #ddd; 
            border-radius: 8px; 
            font-size: 16px; 
            box-sizing: border-box;
        }
        
        #join-form button { 
            width: 100%; 
            padding: 15px; 
            background: #4CAF50; 
            color: white; 
            border: none; 
            border-radius: 8px; 
            font-size: 18px; 
            cursor: pointer; 
            margin-top: 15px;
            transition: all 0.3s ease;
        }
        
        #join-form button:hover { 
            background: #45a049; 
            transform: translateY(-2px);
        }
        
        .game-container { 
            max-width: 1000px; 
            margin: 0 auto; 
            padding: 30px; 
            background: rgba(255,255,255,0.95); 
            border-radius: 20px; 
            box-shadow: 0 15px 35px rgba(0,0,0,0.2);
        }
        
        .game-header { 
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
            color: white;
            padding: 20px; 
            border-radius: 12px; 
            margin-bottom: 25px; 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .players-list { 
            background: #f8f9fa; 
            padding: 20px; 
            border-radius: 12px; 
            margin-bottom: 25px; 
            border: 2px solid #e9ecef;
        }
        
        .player-item { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 12px; 
            border-bottom: 1px solid #dee2e6; 
            background: white;
            margin: 5px 0;
            border-radius: 8px;
        }
        
        .host-badge { 
            background: linear-gradient(135deg, #4CAF50, #45a049); 
            color: white; 
            padding: 4px 12px; 
            border-radius: 20px; 
            font-size: 12px; 
            font-weight: bold;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        .phase-container { 
            background: white; 
            padding: 30px; 
            border-radius: 15px; 
            box-shadow: 0 8px 25px rgba(0,0,0,0.1); 
            border: 3px solid #f8f9fa;
        }
        
        .meme-container { 
            text-align: center; 
            margin: 25px 0; 
        }
        
        .meme-container img { 
            max-width: 500px; 
            max-height: 400px; 
            border-radius: 12px; 
            box-shadow: 0 10px 30px rgba(0,0,0,0.3); 
            border: 5px solid white;
        }
        
        .caption-input { 
            margin: 25px 0; 
            text-align: center; 
        }
        
        .caption-input input { 
            width: 70%; 
            padding: 15px; 
            margin-right: 15px; 
            border: 3px solid #e9ecef; 
            border-radius: 12px; 
            font-size: 18px; 
            transition: border-color 0.3s ease;
        }
        
        .caption-input input:focus {
            border-color: #4CAF50;
            outline: none;
            box-shadow: 0 0 10px rgba(76, 175, 80, 0.3);
        }
        
        .big-button, .caption-input button, #start-game-btn, #next-round-btn { 
            background: linear-gradient(135deg, #4CAF50, #45a049); 
            color: white; 
            padding: 15px 30px; 
            border: none; 
            border-radius: 12px; 
            cursor: pointer; 
            font-size: 18px; 
            font-weight: bold;
            margin: 8px; 
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        }
        
        .big-button:hover, .caption-input button:hover, #start-game-btn:hover, #next-round-btn:hover { 
            background: linear-gradient(135deg, #45a049, #4CAF50); 
            transform: translateY(-3px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        }
        
        .caption-input button:disabled { 
            background: #ccc; 
            cursor: not-allowed; 
            transform: none;
            box-shadow: none;
        }
        
        .caption-option { 
            background: #f8f9fa; 
            padding: 20px; 
            margin: 15px 0; 
            border-radius: 12px; 
            border: 3px solid #e9ecef; 
            transition: all 0.3s ease;
        }
        
        .caption-option:hover { 
            background: #e8f5e8; 
            border-color: #4CAF50;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(0,0,0,0.1);
        }
        
        .caption-text { 
            font-size: 20px; 
            font-weight: bold; 
            margin-bottom: 8px; 
            color: #2c3e50;
        }
        
        .caption-author { 
            font-style: italic; 
            color: #6c757d; 
            margin-bottom: 15px; 
        }
        
        .vote-btn { 
            background: linear-gradient(135deg, #2196F3, #1976D2); 
            color: white; 
            padding: 10px 20px; 
            border: none; 
            border-radius: 8px; 
            cursor: pointer; 
            font-weight: bold;
            transition: all 0.3s ease;
        }
        
        .vote-btn:hover { 
            background: linear-gradient(135deg, #1976D2, #2196F3); 
            transform: translateY(-2px);
        }
        
        .vote-btn:disabled { 
            background: #ccc; 
            cursor: not-allowed; 
            transform: none;
        }
        
        .timer { 
            font-weight: bold; 
            color: #e74c3c; 
            text-align: center; 
            margin: 15px 0; 
            font-size: 22px; 
            background: #fff3cd;
            padding: 15px;
            border-radius: 12px;
            border: 2px solid #ffc107;
        }
        
        .winning-caption { 
            background: linear-gradient(135deg, #fff3cd, #ffeaa7); 
            padding: 25px; 
            border-radius: 15px; 
            margin-bottom: 20px; 
            border: 3px solid #ffc107; 
            box-shadow: 0 5px 15px rgba(255, 193, 7, 0.3);
        }
        
        .result-caption { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            padding: 15px; 
            border-bottom: 1px solid #eee; 
            background: white;
            margin: 5px 0;
            border-radius: 8px;
        }
        
        .result-caption.my-caption { 
            background: linear-gradient(135deg, #e3f2fd, #bbdefb); 
            border-left: 5px solid #2196F3; 
            box-shadow: 0 3px 10px rgba(33, 150, 243, 0.2);
        }
        
        .rank { 
            font-weight: bold; 
            color: #e74c3c; 
            margin-right: 15px; 
            font-size: 18px;
        }
        
        h1, h2, h3 { 
            color: #2c3e50; 
            margin-bottom: 15px;
        }
        
        h3 {
            font-size: 1.5em;
            text-align: center;
            margin-bottom: 20px;
        }
        
        /* Responsive */
        @media (max-width: 768px) {
            .game-container { padding: 15px; }
            .caption-input input { width: 100%; margin-bottom: 10px; }
            .meme-container img { max-width: 100%; }
        }
    `;
    document.head.appendChild(style);
    console.log('✅ Styles CSS ajoutés !');
}

// Événements Socket.IO
socket.on('connect', function() {
    console.log('🔗 Connecté au serveur : ' + socket.id);
});

socket.on('system-message', function(message) {
    console.log('📢 Message système:', message);
    
    // Afficher une notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #4CAF50; color: white; 
        padding: 15px; border-radius: 8px; z-index: 1000; max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
});

socket.on('disconnect', function() {
    console.log('🔌 Déconnecté du serveur');
});

socket.on('error', function(error) {
    console.error('❌ Erreur:', error);
    alert('Erreur: ' + error);
});
