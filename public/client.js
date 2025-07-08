const socket = io();

// Variables globales du jeu
let currentPlayer = null;
let currentRoom = null;
let players = [];
let playerScores = {}; // Pour suivre les scores de tous les joueurs
let currentMeme = null;
let captions = [];
let hasSubmittedCaption = false;
let hasVoted = false;
let currentRound = 1;
let currentTimer = null; // Pour gérer les timers côté client

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
        
        // Bouton démarrer le jeu - Le jeu démarre automatiquement avec 4 joueurs
        if (event.target.id === 'start-game-btn') {
            event.preventDefault();
            console.log('⚠️ Le jeu démarre automatiquement quand 4 joueurs sont connectés');
            showMessage('Attendez que 4 joueurs rejoignent la salle pour commencer');
        }
        
        // Bouton soumettre légende
        if (event.target.id === 'submit-caption') {
            event.preventDefault();
            const captionText = document.getElementById('caption-text').value.trim();
            
            if (captionText && !hasSubmittedCaption) {
                submitCaptionToServer(captionText);
                event.target.disabled = true;
                event.target.textContent = '✅ Envoyé !';
                document.getElementById('caption-text').disabled = true;
            }
        }
        
        // Bouton round suivant - Le serveur gère automatiquement
        if (event.target.id === 'next-round-btn') {
            event.preventDefault();
            console.log('⚠️ Le round suivant démarre automatiquement');
        }
        
        // Boutons de vote
        if (event.target.classList.contains('vote-btn')) {
            event.preventDefault();
            const votedPseudo = event.target.getAttribute('data-pseudo');
            if (votedPseudo && !hasVoted) {
                voteForCaptionOnServer(votedPseudo);
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
                    <h3>🚀 En attente d'autres joueurs...</h3>
                    <p>Le jeu commence automatiquement quand 4 joueurs sont connectés</p>
                    <div id="status-message">Attendez que vos amis rejoignent avec le même nom de salle</div>
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
                    <div id="next-round-info">Le round suivant démarre automatiquement...</div>
                </div>
            </div>
        </div>
    `;
    
    console.log('✅ Interface créée avec succès !');
}

// Fonctions pour gérer la communication avec le serveur
function submitCaptionToServer(caption) {
    if (hasSubmittedCaption) {
        console.log('⚠️ Légende déjà soumise pour ce round');
        return;
    }
    
    console.log('📝 Envoi de la légende au serveur:', caption);
    console.log(`🎯 CAPTION SOUMISE - Joueur: ${currentPlayer} | Round: ${currentRound} | Texte: "${caption}"`);
    hasSubmittedCaption = true;
    
    socket.emit('submit-caption', { 
        round: currentRound, 
        caption: caption 
    });
}

function voteForCaptionOnServer(votedPseudo) {
    if (hasVoted) return;
    
    console.log('🗳️ Vote envoyé au serveur pour:', votedPseudo);
    hasVoted = true;
    
    // Désactiver tous les boutons de vote
    document.querySelectorAll('.vote-btn').forEach(btn => {
        btn.disabled = true;
        if (btn.getAttribute('data-pseudo') === votedPseudo) {
            btn.textContent = '✅ Voté !';
        }
    });
    
    socket.emit('submit-vote', { 
        round: currentRound, 
        votedPseudo: votedPseudo 
    });
}

function updatePlayersList(playersList) {
    console.log('👥 Mise à jour de la liste des joueurs:', playersList);
    players = playersList;
    
    // Initialiser les scores pour les nouveaux joueurs
    playersList.forEach(player => {
        if (!(player in playerScores)) {
            playerScores[player] = 0;
        }
    });
    
    const playersContainer = document.getElementById('players-container');
    if (playersContainer) {
        playersContainer.innerHTML = playersList.map(player => `
            <div class="player-item">
                <span class="player-name">${player}</span>
                <span class="player-score" id="score-${player}">Score: ${playerScores[player] || 0}</span>
                ${player === currentPlayer ? '<span class="host-badge">VOUS</span>' : ''}
            </div>
        `).join('');
    }
    
    // Mettre à jour le statut
    const statusMessage = document.getElementById('status-message');
    if (statusMessage) {
        const remaining = 4 - playersList.length;
        if (remaining > 0) {
            statusMessage.textContent = `En attente de ${remaining} joueur(s) supplémentaire(s)`;
        } else {
            statusMessage.textContent = 'Tous les joueurs sont connectés ! Le jeu va commencer...';
        }
    }
}

function showMessage(message) {
    console.log('📢 Message:', message);
    
    // Afficher une notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed; top: 20px; right: 20px; background: #2196F3; color: white; 
        padding: 15px; border-radius: 8px; z-index: 1000; max-width: 300px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
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

function clearAllTimers() {
    console.log('🧹 Nettoyage de tous les timers côté client');
    if (currentTimer) {
        clearInterval(currentTimer);
        currentTimer = null;
        console.log('✅ Timer courant nettoyé');
    }
}

function updatePlayerScores(totalScores) {
    console.log('📊 Mise à jour des scores:', totalScores);
    
    // Mettre à jour les scores globaux
    playerScores = { ...totalScores };
    
    // Mettre à jour l'affichage des scores dans la liste des joueurs
    Object.entries(totalScores).forEach(([player, score]) => {
        const scoreElement = document.getElementById(`score-${player}`);
        if (scoreElement) {
            scoreElement.textContent = `Score: ${score}`;
        }
    });
    
    // Mettre à jour le score personnel
    const personalScoreElement = document.getElementById('score');
    if (personalScoreElement && totalScores[currentPlayer] !== undefined) {
        personalScoreElement.textContent = `🏆 Score: ${totalScores[currentPlayer]}`;
    }
}

// Événements Socket.IO - Intégration avec le serveur
socket.on('connect', function() {
    console.log('🔗 Connecté au serveur : ' + socket.id);
});

socket.on('player-list', function(playersList) {
    console.log('👥 Liste des joueurs reçue:', playersList);
    updatePlayersList(playersList);
});

socket.on('game-start', function(data) {
    console.log('🎮 Le jeu commence !', data);
    showMessage('Le jeu commence ! Préparez-vous...');
});

socket.on('round-start', function(data) {
    console.log('🕒 Nouveau round:', data);
    
    // Nettoyer le timer précédent s'il existe
    if (currentTimer) {
        clearInterval(currentTimer);
        currentTimer = null;
        console.log('🧹 Timer précédent nettoyé');
    }
    
    // Réinitialiser l'état du round
    currentRound = data.round;
    hasSubmittedCaption = false;
    hasVoted = false;
    
    console.log(`🎮 Démarrage du round ${currentRound} - État réinitialisé`);
    
    // Passer en phase meme
    switchPhase('meme-display');
    
    // Afficher le meme
    const memeImg = document.getElementById('current-meme');
    const votingMeme = document.getElementById('voting-meme');
    
    if (memeImg) {
        memeImg.src = data.imageUrl;
        memeImg.onload = () => console.log('✅ Meme chargé !');
        memeImg.onerror = () => console.error('❌ Erreur chargement meme');
        
        if (votingMeme) {
            votingMeme.src = data.imageUrl;
        }
    }
    
    // Reset des champs
    const captionInput = document.getElementById('caption-text');
    const submitBtn = document.getElementById('submit-caption');
    
    if (captionInput) {
        captionInput.value = '';
        captionInput.disabled = false;
        captionInput.placeholder = 'Entrez votre légende drôle...';
    }
    
    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = '📝 Soumettre';
    }
    
    // Timer avec gestion améliorée
    currentTimer = startTimer(data.duration, 'time-left', () => {
        if (!hasSubmittedCaption) {
            console.log('⏰ Temps écoulé ! Le serveur va gérer la soumission automatique...');
            
            // Désactiver l'interface sans soumettre - le serveur s'en charge
            const captionInput = document.getElementById('caption-text');
            const submitBtn = document.getElementById('submit-caption');
            
            if (captionInput) {
                captionInput.disabled = true;
                captionInput.placeholder = 'Temps écoulé';
            }
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = '⏰ Temps écoulé';
            }
        }
    });
    
    showMessage(`Round ${data.round} commence ! Créez votre légende !`);
});

socket.on('vote-start', function(captionsData) {
    console.log('🗳️ Phase de vote commencée:', captionsData);
    captions = captionsData;
    
    // Nettoyer le timer précédent s'il existe
    if (currentTimer) {
        clearInterval(currentTimer);
        currentTimer = null;
        console.log('🧹 Timer de légendes nettoyé pour passer au vote');
    }
    
    switchPhase('voting-phase');
    
    const captionsList = document.getElementById('captions-list');
    if (captionsList) {
        captionsList.innerHTML = captionsData.map(caption => `
            <div class="caption-option">
                <div class="caption-text">"${caption.caption}"</div>
                <div class="caption-author">- ${caption.pseudo}</div>
                <button class="vote-btn" data-pseudo="${caption.pseudo}" 
                        ${caption.pseudo === currentPlayer ? 'disabled' : ''}>
                    ${caption.pseudo === currentPlayer ? '❌ Votre légende' : '👍 Voter'}
                </button>
            </div>
        `).join('');
    }
    
    // Reset hasVoted pour le nouveau round
    hasVoted = false;
    console.log(`🗳️ État de vote réinitialisé pour le round ${currentRound}`);
    
    // Timer de vote - le serveur gère les votes automatiques
    currentTimer = startTimer(20, 'vote-time-left', () => {
        if (!hasVoted) {
            console.log('⏰ Temps de vote écoulé ! Le serveur va gérer le vote automatique...');
            // Le serveur gère automatiquement les votes manqués
            showMessage('⏰ Temps écoulé ! En attente de la fin du vote...');
        }
    });
    
    showMessage('Votez pour la meilleure légende !');
});

socket.on('round-end', function(data) {
    console.log('🏆 Fin du round:', data);
    console.log('📊 Scores du round reçus:', data.roundScores);
    console.log('📊 Scores totaux reçus:', data.totalScores);
    
    // 🔧 Nettoyer tous les timers pour éviter les votes en retard
    clearAllTimers();
    
    switchPhase('results-phase');
    
    const roundScores = data.roundScores;
    const totalScores = data.totalScores;
    
    // Trouver le gagnant du round
    const winner = Object.entries(roundScores).reduce((max, [pseudo, score]) => 
        score > max.score ? { pseudo, score } : max, { pseudo: 'Aucun gagnant', score: 0 });
    
    const resultsDiv = document.getElementById('round-results');
    if (resultsDiv) {
        resultsDiv.innerHTML = `
            <div class="winning-caption">
                <h4>🏆 Gagnant du round ${data.round} :</h4>
                <div class="winner-info">
                    <p class="winner-name">${winner.pseudo}</p>
                    <p class="winner-score">${winner.score} vote(s)</p>
                </div>
            </div>
            <div class="round-scores">
                <h4>Scores du round :</h4>
                ${players.map(player => {
                    const score = roundScores[player] || 0;
                    return `
                        <div class="score-item ${player === currentPlayer ? 'my-score' : ''}">
                            <span class="player-name">${player}</span>
                            <span class="round-score">+${score}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    
    // Mettre à jour le classement total
    const scoresListDiv = document.getElementById('scores-list');
    if (scoresListDiv) {
        const sortedScores = Object.entries(totalScores).sort(([,a], [,b]) => b - a);
        scoresListDiv.innerHTML = sortedScores.map(([pseudo, score], index) => `
            <div class="leaderboard-item ${pseudo === currentPlayer ? 'my-score' : ''}">
                <span class="rank">#${index + 1}</span>
                <span class="player-name">${pseudo}</span>
                <span class="total-score">${score} pts</span>
            </div>
        `).join('');
    }
    
    // Mettre à jour tous les scores des joueurs
    updatePlayerScores(totalScores);
    
    showMessage(`Round ${data.round} terminé ! ${winner.pseudo} gagne !`);
});

socket.on('game-end', function(data) {
    console.log('🎯 Fin de partie !', data);
    
    const finalScores = Object.entries(data.scores).sort(([,a], [,b]) => b - a);
    const champion = finalScores[0];
    
    showMessage(`🏆 Partie terminée ! ${champion[0]} remporte la victoire avec ${champion[1]} points !`);
    
    // Optionnel: retourner à l'écran d'attente pour une nouvelle partie
    setTimeout(() => {
        switchPhase('waiting-area');
        const statusMessage = document.getElementById('status-message');
        if (statusMessage) {
            statusMessage.textContent = 'Partie terminée ! Attendez qu\'un nouveau jeu commence...';
        }
    }, 10000);
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
    showMessage('⚠️ Connexion perdue avec le serveur');
});

socket.on('error', function(error) {
    console.error('❌ Erreur:', error);
    alert('Erreur: ' + error);
});
