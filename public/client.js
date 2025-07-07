const socket = io();

// Variables globales du jeu
let currentPlayer = null;
let currentRoom = null;
let players = [];
let currentMeme = null;
let captions = [];
let hasSubmittedCaption = false;
let hasVoted = false;

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
