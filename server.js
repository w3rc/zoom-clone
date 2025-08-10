const express = require('express');
const app = express();
const server = require('http').Server(app);
require('dotenv').config();

const SERVER_PORT = process.env.SERVER_PORT || 7000;
const PEER_PORT = process.env.PEER_PORT || 7001;
const ALLOWED_ORIGINS = process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',')
        : [`http://localhost:${SERVER_PORT}`];

const io = require('socket.io')(server, {
        cors: {
                origin: ALLOWED_ORIGINS,
                methods: ["GET", "POST"]
        }
});
const { v4: uuidV4 } = require('uuid');
const { PeerServer } = require('peer');

const peerServer = PeerServer({
        port: PEER_PORT,
        path: '/',
        allow_discovery: true
});

app.set('view engine', 'ejs');
app.use(express.static('public'));

app.get('/', (req, res) => {
	res.redirect(`/${uuidV4()}`);
});

app.get('/:room', (req, res) => {
	res.render('room', { roomID: req.params.room });
});

io.on('connection', (socket) => {
	socket.on('join-room', (roomID, userID, userName = 'Anonymous') => {
		console.log(`User ${userName} (${userID}) joined room ${roomID}`);
		socket.join(roomID);
		socket.to(roomID).emit('user-connected', userID, userName);

		socket.on('disconnect', () => {
			socket.to(roomID).emit('user-disconnected', userID);
		});
	});
});

server.listen(SERVER_PORT, () => {
        console.log(`Server listening on http://localhost:${SERVER_PORT}`);
        console.log(`PeerJS server running on port ${PEER_PORT}`);
});
