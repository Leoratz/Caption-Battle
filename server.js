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

io.on('connection', (socket) => {
    console.log('✅ Nouveau joueur connecté :', socket.id);

    socket.on('join-room', ({ pseudo, room }) => {
        socket.join(room);
        socket.data.room = room;
        socket.data.pseudo = pseudo;

        if (!rooms[room]) {
            rooms[room] = { players: {}, scores: {} };
        }

        rooms[room].players[socket.id] = pseudo;
        rooms[room].scores[pseudo] = 0;

        console.log(`${pseudo} a rejoint la salle ${room} (socket ${socket.id})`);

        io.to(room).emit('player-list', Object.values(rooms[room].players));
        socket.to(room).emit('system-message', `${pseudo} a rejoint la salle.`);

        const nbPlayers = Object.keys(rooms[room].players).length;
        if (nbPlayers === 4) {
            console.log(`🎮 La salle ${room} atteint 4 joueurs, lancement du jeu.`);
            io.to(room).emit('game-start', {
                room,
                players: Object.values(rooms[room].players)
            });

            setTimeout(() => {
                startRound(room, 1);
            }, 2000);
        }
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
        console.log(`📝 ${pseudo} a soumis une légende: "${caption}" pour le round ${round}`);

        const totalPlayers = Object.keys(rooms[room].players).length;
        const submitted = Object.keys(captions[room][round]).length;

        console.log(`📊 Salle ${room}, round ${round}: ${submitted}/${totalPlayers} légendes soumises`);

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

        console.log(`📊 Salle ${room}, round ${round}: ${totalVotes}/${totalPlayers} votes soumis`);

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
            console.log(`❌ La salle ${room} est vide et a été supprimée.`);
        }
    });
});

function startRound(room, roundNumber) {
    const img = memes[Math.floor(Math.random() * memes.length)];
    console.log(`🕒 Démarrage de la manche ${roundNumber} dans la salle ${room}.`);

    // NETTOYER TOUS LES TIMERS EXISTANTS AVANT DE COMMENCER
    if (timers[room]) {
        if (timers[room].captionTimer) {
            clearTimeout(timers[room].captionTimer);
            console.log(`🧹 Timer de légendes précédent nettoyé pour la salle ${room}`);
        }
        if (timers[room].voteTimer) {
            clearTimeout(timers[room].voteTimer);
            console.log(`🧹 Timer de votes précédent nettoyé pour la salle ${room}`);
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
    
    console.log(`⏰ Démarrage du timer de 30 secondes pour les légendes dans la salle ${room}, round ${roundNumber}`);
    
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
            if (!submittedPlayers.includes(playerName)) {
                captions[room][roundNumber][playerName] = "Temps écoulé !";
                console.log(`📝 Légende par défaut ajoutée pour ${playerName}`);
            }
        });
        
        startVoting(room, roundNumber);
    }, 32000); // 32 secondes pour laisser un peu de marge
}

function startVoting(room, round) {
    console.log(`🗳️ Début de la phase de vote pour la salle ${room}, round ${round}`);
    
    // Nettoyer le timer de légendes maintenant qu'on passe au vote
    if (timers[room]?.captionTimer) {
        clearTimeout(timers[room].captionTimer);
        timers[room].captionTimer = null;
        console.log(`🧹 Timer de légendes nettoyé pour la salle ${room}`);
    }
    
    // Vérifier que les données du round existent
    if (!captions[room] || !captions[room][round]) {
        console.log(`⚠️ Données de légendes manquantes pour la salle ${room}, round ${round}`);
        return;
    }
    
    const captionsArray = Object.entries(captions[room][round]).map(([pseudo, caption]) => ({
        pseudo, caption
    }));
    
    console.log(`📝 Légendes pour le vote dans la salle ${room}:`, captionsArray);
    
    io.to(room).emit('vote-start', captionsArray);
    
    console.log(`⏰ Démarrage du timer de 20 secondes pour les votes dans la salle ${room}, round ${round}`);
    
    // Timer automatique: après 20 secondes, terminer le round même si tout le monde n'a pas voté
    timers[room].voteTimer = setTimeout(() => {
        console.log(`⏰ Temps écoulé pour les votes dans la salle ${room}, round ${round}`);
        
        // Vérifier que ce round est toujours actif
        if (!votes[room] || !votes[room][round]) {
            console.log(`⚠️ Round ${round} déjà terminé ou inexistant dans la salle ${room}`);
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
                    console.log(`🗳️ Vote par défaut ajouté: ${playerName} vote pour ${otherCaptions[0]}`);
                }
            }
        });
        
        endRound(room, round);
    }, 22000); // 22 secondes pour laisser un peu de marge
}

function endRound(room, round) {
    console.log(`🏆 Fin du round ${round} pour la salle ${room}`);
    
    // Nettoyer le timer de votes maintenant que le round se termine
    if (timers[room]?.voteTimer) {
        clearTimeout(timers[room].voteTimer);
        timers[room].voteTimer = null;
        console.log(`🧹 Timer de votes nettoyé pour la salle ${room}`);
    }
    
    const scoreMap = {};
    
    // Compter les votes pour chaque joueur
    console.log(`📊 Votes pour la salle ${room}, round ${round}:`, votes[room][round]);
    
    for (const vote of Object.values(votes[room][round])) {
        scoreMap[vote] = (scoreMap[vote] || 0) + 1;
    }
    
    console.log(`📊 Scores du round ${round}:`, scoreMap);

    // Mise à jour des scores globaux
    for (const [pseudo, pts] of Object.entries(scoreMap)) {
        if (rooms[room].scores[pseudo] !== undefined) {
            rooms[room].scores[pseudo] += pts;
            console.log(`📈 ${pseudo}: +${pts} points (total: ${rooms[room].scores[pseudo]})`);
        } else {
            console.log(`⚠️ Joueur ${pseudo} introuvable dans les scores globaux`);
        }
    }
    
    console.log(`📊 Scores totaux après round ${round}:`, rooms[room].scores);

    io.to(room).emit('round-end', {
        round,
        roundScores: scoreMap,
        totalScores: rooms[room].scores
    });

    if (round < 3) {
        console.log(`🔄 Programmation du round ${round + 1} dans 5 secondes pour la salle ${room}`);
        setTimeout(() => {
            // Vérifier que la salle existe encore
            if (rooms[room]) {
                startRound(room, round + 1);
            } else {
                console.log(`⚠️ Salle ${room} supprimée avant le démarrage du round ${round + 1}`);
            }
        }, 5000);
    } else {
        console.log(`🏁 Fin de partie programmée dans 5 secondes pour la salle ${room}`);
        setTimeout(() => {
            // Vérifier que la salle existe encore
            if (rooms[room]) {
                io.to(room).emit('game-end', {
                    scores: rooms[room].scores
                });
                console.log(`🎯 Fin de partie envoyée pour la salle ${room}`);
            } else {
                console.log(`⚠️ Salle ${room} supprimée avant la fin de partie`);
            }
        }, 5000);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});