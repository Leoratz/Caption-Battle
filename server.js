const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/memes', express.static(path.join(__dirname, 'memes')));

// Load memes
const memesDir = path.join(__dirname, 'memes');
const memes = fs.readdirSync(memesDir).map(filename => `/memes/${filename}`);

const rooms = {};
const captions = {};
const votes = {};
const timers = {}; // Pour gérer les timers automatiques
const usedMemes = {}; // Pour éviter la répétition des memes par salle

io.on('connection', (socket) => {

    socket.on('join-room', ({ pseudo, room }) => {
        socket.join(room);
        socket.data.room = room;
        socket.data.pseudo = pseudo;

        if (!rooms[room]) {
            rooms[room] = { players: {}, scores: {} };
        }

        rooms[room].players[socket.id] = pseudo;
        rooms[room].scores[pseudo] = 0;

        io.to(room).emit('player-list', Object.values(rooms[room].players));
        socket.to(room).emit('system-message', `${pseudo} a rejoint la salle.`);

        // Le premier joueur devient le host
        const isHost = Object.keys(rooms[room].players).length === 1;
        socket.emit('host-status', { isHost });
    });

    socket.on('start-game', () => {
        const room = socket.data.room;
        const pseudo = socket.data.pseudo;
        if (!room || !pseudo) return;

        // Vérifier que c'est le host (premier joueur)
        const playerIds = Object.keys(rooms[room].players);
        const hostId = playerIds[0];
        
        if (socket.id !== hostId) {
            socket.emit('error-message', 'Seul le host peut démarrer la partie');
            return;
        }

        // Vérifier qu'il y a au moins 2 joueurs
        const nbPlayers = playerIds.length;
        if (nbPlayers < 2) {
            socket.emit('error-message', 'Il faut au moins 2 joueurs pour commencer');
            return;
        }

        console.log(`🎮 Le host ${pseudo} démarre le jeu dans la salle ${room} avec ${nbPlayers} joueurs`);
        
        io.to(room).emit('game-start', {
            room,
            players: Object.values(rooms[room].players)
        });

        setTimeout(() => {
            startRound(room, 1);
        }, 2000);
    });

    socket.on('submit-caption', ({ round, caption }) => {
        const room = socket.data.room;
        const pseudo = socket.data.pseudo;
        if (!room || !pseudo) return;

        // Vérifier que le round est actif
        if (!captions[room] || !captions[room][round]) {
            console.log(`⚠️ ${pseudo} essaie de soumettre une légende pour un round inexistant: ${round} dans la salle ${room}`);
            return;
        }

        // Vérifier que le joueur n'a pas déjà soumis
        if (captions[room][round][pseudo]) {
            console.log(`⚠️ ${pseudo} essaie de soumettre une seconde légende pour le round ${round}`);
            return;
        }

        captions[room][round][pseudo] = caption;
        console.log(`📝 ${pseudo} a soumis une légende pour le round ${round}`);

        const totalPlayers = Object.keys(rooms[room].players).length;
        const submitted = Object.keys(captions[room][round]).length;

        if (submitted === totalPlayers) {
            // Tous les joueurs ont soumis, on peut passer au vote immédiatement
            console.log(`✅ Toutes les légendes soumises pour le round ${round}, passage au vote`);
            clearTimeout(timers[room]?.captionTimer);
            startVoting(room, round);
        }
    });

    socket.on('submit-vote', ({ round, votedPseudo }) => {
        const room = socket.data.room;
        const voter = socket.data.pseudo;
        if (!room || !voter) return;

        // Vérifier que le round est actif
        if (!votes[room] || !votes[room][round]) {
            console.log(`⚠️ ${voter} essaie de voter pour un round inexistant: ${round} dans la salle ${room}`);
            return;
        }

        // Vérifier que le joueur n'a pas déjà voté
        if (votes[room][round][voter]) {
            console.log(`⚠️ ${voter} essaie de voter une seconde fois pour le round ${round}`);
            return;
        }

        // Vérifier qu'on ne vote pas pour soi-même
        if (voter === votedPseudo) {
            console.log(`⚠️ ${voter} essaie de voter pour lui-même`);
            return;
        }

        votes[room][round][voter] = votedPseudo;
        console.log(`🗳️ ${voter} a voté pour ${votedPseudo} dans le round ${round}`);

        const totalPlayers = Object.keys(rooms[room].players).length;
        const totalVotes = Object.keys(votes[room][round]).length;

        if (totalVotes === totalPlayers) {
            // Tous les joueurs ont voté, on peut terminer le round immédiatement
            console.log(`✅ Tous les votes soumis pour le round ${round}, fin du round`);
            clearTimeout(timers[room]?.voteTimer);
            endRound(room, round);
        }
    });

    socket.on('disconnect', () => {
        const room = socket.data.room;
        const pseudo = socket.data.pseudo;
        if (!room || !rooms[room]) return;

        delete rooms[room].players[socket.id];
        delete rooms[room].scores[pseudo];

        io.to(room).emit('system-message', `${pseudo} a quitté la salle.`);
        io.to(room).emit('player-list', Object.values(rooms[room].players));

        if (Object.keys(rooms[room].players).length === 0) {
            // Nettoyer les timers quand la salle est vide
            if (timers[room]) {
                clearTimeout(timers[room].captionTimer);
                clearTimeout(timers[room].voteTimer);
                delete timers[room];
            }
            
            delete rooms[room];
            delete usedMemes[room]; // Nettoyer aussi les memes utilisés
            console.log(`❌ La salle ${room} est vide et a été supprimée.`);
        }
    });
});

function startRound(room, roundNumber) {
    // Initialiser la liste des memes utilisés pour cette salle si nécessaire
    if (!usedMemes[room]) {
        usedMemes[room] = [];
    }
    
    // Sélectionner un meme qui n'a pas encore été utilisé
    let availableMemes = memes.filter(meme => !usedMemes[room].includes(meme));
    
    // Si tous les memes ont été utilisés, réinitialiser la liste
    if (availableMemes.length === 0) {
        console.log(`🔄 Tous les memes utilisés dans la salle ${room}, réinitialisation de la liste`);
        usedMemes[room] = [];
        availableMemes = [...memes];
    }
    
    // Choisir un meme aléatoire parmi ceux disponibles
    const img = availableMemes[Math.floor(Math.random() * availableMemes.length)];
    usedMemes[room].push(img);
    
    console.log(`🕒 Démarrage de la manche ${roundNumber} dans la salle ${room} - Meme: ${img}`);

    // Nettoyer tous les timers existants avant de commencer
    if (timers[room]) {
        if (timers[room].captionTimer) {
            clearTimeout(timers[room].captionTimer);
        }
        if (timers[room].voteTimer) {
            clearTimeout(timers[room].voteTimer);
        }
    }

    io.to(room).emit('round-start', {
        round: roundNumber,
        imageUrl: img,
        duration: 30
    });

    // Réinitialiser complètement les données du round
    if (!captions[room]) captions[room] = {};
    captions[room][roundNumber] = {};
    if (!votes[room]) votes[room] = {};
    votes[room][roundNumber] = {};
    
    // Initialiser les timers pour cette salle si nécessaire
    if (!timers[room]) timers[room] = {};
    
    // Timer automatique: après 30 secondes, passer au vote même si tout le monde n'a pas soumis
    timers[room].captionTimer = setTimeout(() => {
        console.log(`⏰ Temps écoulé pour les légendes dans la salle ${room}, round ${roundNumber}`);
        
        // Vérifier que ce round est toujours actif
        if (!captions[room] || !captions[room][roundNumber]) {
            console.log(`⚠️ Round ${roundNumber} déjà terminé ou inexistant dans la salle ${room}`);
            return;
        }
        
        // Ajouter des légendes par défaut pour les joueurs qui n'ont pas soumis
        const allPlayers = Object.keys(rooms[room].players);
        const submittedPlayers = Object.keys(captions[room][roundNumber]);
        
        allPlayers.forEach(playerId => {
            const playerName = rooms[room].players[playerId];
            if (!playerName) {
                return; // Joueur déconnecté
            }

            if (!submittedPlayers.includes(playerName)) {
                captions[room][roundNumber][playerName] = "Temps écoulé !";
            }
        });

        startVoting(room, roundNumber);
    }, 35000);
}

function startVoting(room, round) {
    console.log(`🗳️ Début de la phase de vote pour la salle ${room}, round ${round}`);
    
    // Nettoyer le timer de légendes maintenant qu'on passe au vote
    if (timers[room]?.captionTimer) {
        clearTimeout(timers[room].captionTimer);
        timers[room].captionTimer = null;
    }
    
    // Vérifier que les données du round existent
    if (!captions[room] || !captions[room][round]) {
        console.log(`⚠️ Données de légendes manquantes pour la salle ${room}, round ${round}`);
        return;
    }
    
    const captionsArray = Object.entries(captions[room][round]).map(([pseudo, caption]) => ({
        pseudo, caption
    }));
    
    io.to(room).emit('vote-start', captionsArray);
    
    // Timer automatique: après 20 secondes, terminer le round même si tout le monde n'a pas voté
    timers[room].voteTimer = setTimeout(() => {
        // Vérifier que ce round est toujours actif
        if (!votes[room] || !votes[room][round]) {
            return;
        }
        
        // Ajouter des votes par défaut pour les joueurs qui n'ont pas voté
        const allPlayers = Object.keys(rooms[room].players);
        const votedPlayers = Object.keys(votes[room][round]);
        const availableCaptions = Object.keys(captions[room][round]);
        
        allPlayers.forEach(playerId => {
            const playerName = rooms[room].players[playerId];
            if (!votedPlayers.includes(playerName)) {
                // Voter pour la première légende qui n'est pas la sienne
                const otherCaptions = availableCaptions.filter(pseudo => pseudo !== playerName);
                if (otherCaptions.length > 0) {
                    votes[room][round][playerName] = otherCaptions[0];
                }
            }
        });
        
        endRound(room, round);
    }, 22000);
}

function endRound(room, round) {
    console.log(`🏆 Fin du round ${round} pour la salle ${room}`);
    
    // Nettoyer le timer de votes maintenant que le round se termine
    if (timers[room]?.voteTimer) {
        clearTimeout(timers[room].voteTimer);
        timers[room].voteTimer = null;
    }
    
    const scoreMap = {};
    
    // Compter les votes pour chaque joueur
    for (const vote of Object.values(votes[room][round])) {
        scoreMap[vote] = (scoreMap[vote] || 0) + 1;
    }

    // Mise à jour des scores globaux
    for (const [pseudo, pts] of Object.entries(scoreMap)) {
        if (rooms[room].scores[pseudo] !== undefined) {
            rooms[room].scores[pseudo] += pts;
        }
    }

    io.to(room).emit('round-end', {
        round,
        roundScores: scoreMap,
        totalScores: rooms[room].scores
    });

    if (round < 3) {
        setTimeout(() => {
            if (rooms[room]) {
                startRound(room, round + 1);
            }
        }, 5000);
    } else {
        setTimeout(() => {
            if (rooms[room]) {
                io.to(room).emit('game-end', {
                    scores: rooms[room].scores
                });
                console.log(`🎯 Fin de partie pour la salle ${room}`);
            }
        }, 5000);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});