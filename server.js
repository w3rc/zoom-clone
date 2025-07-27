const express = require('express');
const app = express();
const server = require('http').Server(app);
const io = require('socket.io')(server, {
	cors: {
		origin: "*",
		methods: ["GET", "POST"]
	}
});
const { v4: uuidV4 } = require('uuid');
const { PeerServer } = require('peer');

const peerServer = PeerServer({ 
	port: 7001, 
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
	socket.on('join-room', (roomID, userID) => {
		console.log(`User ${userID} joined room ${roomID}`);
		socket.join(roomID);
		socket.to(roomID).emit('user-connected', userID);

		socket.on('disconnect', () => {
			socket.to(roomID).emit('user-disconnected', userID);
		});
	});
});

server.listen(7000, () => {
	console.log('Server listening on http://localhost:7000');
	console.log('PeerJS server running on port 7001');
});
