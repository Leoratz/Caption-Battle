const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve memes directory
app.use('/memes', express.static(path.join(__dirname, 'memes')));

io.on('connection', (socket) => {
    console.log('A user connected : ', socket.id);

    socket.on('join-room', ({pseudo, room}) => {
        socket.join(room);
        console.log(`${pseudo} a rejoint la salle ${room} (socket ${socket.id})`);

        socket.to(room).emit('system-message', `${pseudo} a rejoint la salle.`);
    });
    socket.on('disconnect', () => {
        console.log('A user disconnected : ', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});