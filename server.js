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
        if (nbPlayers === 3) {
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

        const totalPlayers = Object.keys(rooms[room].players).length;
        const submitted = Object.keys(captions[room][round]).length;

        if (submitted === totalPlayers) {
            const captionsArray = Object.entries(captions[room][round]).map(([pseudo, caption]) => ({
                pseudo, caption
            }));
            io.to(room).emit('vote-start', captionsArray);
        }
    });

    socket.on('submit-vote', ({ round, votedPseudo }) => {
        const room = socket.data.room;
        const voter = socket.data.pseudo;
        if (!room || !voter) return;

        if (!votes[room]) votes[room] = {};
        if (!votes[room][round]) votes[room][round] = {};

        votes[room][round][voter] = votedPseudo;

        const totalPlayers = Object.keys(rooms[room].players).length;
        const totalVotes = Object.keys(votes[room][round]).length;

        if (totalVotes === totalPlayers) {
            const scoreMap = {};
            for (const vote of Object.values(votes[room][round])) {
                scoreMap[vote] = (scoreMap[vote] || 0) + 1;
            }

            // Mise à jour des scores globaux
            for (const [pseudo, pts] of Object.entries(scoreMap)) {
                rooms[room].scores[pseudo] += pts;
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
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});