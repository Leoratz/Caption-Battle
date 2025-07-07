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
            console.log(`🎮 La salle ${room} atteint 3 joueurs, lancement du jeu.`);
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

        if (!captions[room]) captions[room] = {};
        if (!captions[room][round]) captions[room][round] = {};

        captions[room][round][pseudo] = caption;
        console.log(`📝 ${pseudo} a soumis une légende: "${caption}"`);

        const totalPlayers = Object.keys(rooms[room].players).length;
        const submitted = Object.keys(captions[room][round]).length;

        console.log(`📊 Salle ${room}: ${submitted}/${totalPlayers} légendes soumises`);

        if (submitted === totalPlayers) {
            // Tous les joueurs ont soumis, on peut passer au vote immédiatement
            clearTimeout(timers[room]?.captionTimer);
            startVoting(room, round);
        }
    });

    socket.on('submit-vote', ({ round, votedPseudo }) => {
        const room = socket.data.room;
        const voter = socket.data.pseudo;
        if (!room || !voter) return;

        if (!votes[room]) votes[room] = {};
        if (!votes[room][round]) votes[room][round] = {};

        votes[room][round][voter] = votedPseudo;
        console.log(`🗳️ ${voter} a voté pour ${votedPseudo}`);

        const totalPlayers = Object.keys(rooms[room].players).length;
        const totalVotes = Object.keys(votes[room][round]).length;

        console.log(`📊 Salle ${room}: ${totalVotes}/${totalPlayers} votes soumis`);

        if (totalVotes === totalPlayers) {
            // Tous les joueurs ont voté, on peut terminer le round immédiatement
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

    io.to(room).emit('round-start', {
        round: roundNumber,
        imageUrl: img,
        duration: 30
    });

    if (!captions[room]) captions[room] = {};
    captions[room][roundNumber] = {};
    if (!votes[room]) votes[room] = {};
    votes[room][roundNumber] = {};
    
    // Initialiser les timers pour cette salle si nécessaire
    if (!timers[room]) timers[room] = {};
    
    // Timer automatique: après 30 secondes, passer au vote même si tout le monde n'a pas soumis
    timers[room].captionTimer = setTimeout(() => {
        console.log(`⏰ Temps écoulé pour les légendes dans la salle ${room}`);
        
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
    
    const captionsArray = Object.entries(captions[room][round]).map(([pseudo, caption]) => ({
        pseudo, caption
    }));
    
    io.to(room).emit('vote-start', captionsArray);
    
    // Timer automatique: après 20 secondes, terminer le round même si tout le monde n'a pas voté
    timers[room].voteTimer = setTimeout(() => {
        console.log(`⏰ Temps écoulé pour les votes dans la salle ${room}`);
        
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
    
    const scoreMap = {};
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
            startRound(room, round + 1);
        }, 5000);
    } else {
        setTimeout(() => {
            io.to(room).emit('game-end', {
                scores: rooms[room].scores
            });
        }, 5000);
    }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});