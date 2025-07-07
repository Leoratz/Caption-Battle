const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

const memes = [
    './memes/bibble.jpeg',
    './memes/dingdong.jpeg',
    './memes/dylan_bratz.jpeg',
    './memes/harry.jpg',
    './memes/justbieber.jpeg',
    './memes/lazytown.jpeg',
    './memes/nez.jpeg',
    './memes/rat.jpeg',
    './memes/shrek.jpeg',
    './memes/thisisfine.jpg',
]

const rooms = {};
const captions = {};

io.on('connection', (socket) => {
    console.log('A user connected : ', socket.id);

    socket.on('join-room', ({pseudo, room}) => {
        socket.join(room);
        if (!rooms[room]) {
            rooms[room] = [];
        }

        rooms[room][socket.id] = pseudo;

        console.log(`${pseudo} a rejoint la salle ${room} (socket ${socket.id})`);

        io.to(room).emit('player-list', Object.values(rooms[room]));
        socket.to(room).emit('system-message', `${pseudo} a rejoint la salle.`);

        const nbPlayers = Object.keys(rooms[room]).length;
        if (nbPlayers === 3) {
            console.log(`La salle ${room} atteint 3 joueurs, lancement du jeu.`);
            io.to(room).emit('game-start', {
                room,
                players: Object.values(rooms[room])
            });

            setTimeout(() => {
                startRound(room, 1);
            }, 2000);
        }
    });
    socket.on('disconnect', () => {
        for (const room in rooms) {
            if (rooms[room][socket.id]) {
                const pseudo = rooms[room][socket.id];
                delete rooms[room][socket.id];
                console.log(`${pseudo} a quitté la salle ${room} (socket ${socket.id})`);

                io.to(room).emit('system-message', `${pseudo} a quitté la salle.`);
                io.to(room).emit('player-list', Object.values(rooms[room]));

                if (Object.keys(rooms[room]).length === 0) {
                    delete rooms[room];
                    console.log(`La salle ${room} est vide et a été supprimée.`);
                }
                break;
            }
        }
    });
});

function startRound(room, roundNumber){
    const img = memes[Math.floor(Math.random() * memes.length)];
    console.log(`Démarrage de la manche ${roundNumber} dans la salle ${room}.`);

    io.to(room).emit('round-start', {
        round: roundNumber,
        imageUrl: img,
        duration: 30
    });

    if (!captions[room]) captions[room] = {};
    captions[room][roundNumber] = {};
};

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});