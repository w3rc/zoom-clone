const socket = io('/');
const videoGrid = document.getElementById('video-grid');
const myPeer = new Peer(undefined, {
	host: 'localhost',
	port: 7001,
	path: '/'
});

const myVideo = document.createElement('video');
myVideo.muted = true;
const peers = {};
let myStream;

navigator.mediaDevices
	.getUserMedia({
		video: true,
		audio: true,
	})
	.then((stream) => {
		myStream = stream;
		addVideoStream(myVideo, stream);

		myPeer.on('call', (call) => {
			call.answer(stream);
			const video = document.createElement('video');
			call.on('stream', (userVideoStream) => {
				addVideoStream(video, userVideoStream);
			});
		});

		socket.on('user-connected', (userId) => {
			setTimeout(() => {
				connectToNewUser(userId, stream);
			}, 1000);
		});
	})
	.catch((error) => {
		console.error('Error accessing media devices:', error);
		alert('Could not access camera/microphone. Please check permissions.');
	});

socket.on('user-disconnected', (userId) => {
	if (peers[userId]) {
		peers[userId].close();
		delete peers[userId];
	}
});

myPeer.on('open', (id) => {
	socket.emit('join-room', ROOM_ID, id);
});

myPeer.on('error', (error) => {
	console.error('PeerJS error:', error);
});

function connectToNewUser(userId, stream) {
	const call = myPeer.call(userId, stream);
	const video = document.createElement('video');
	
	call.on('stream', (userVideoStream) => {
		addVideoStream(video, userVideoStream);
	});
	
	call.on('close', () => {
		video.remove();
	});

	call.on('error', (error) => {
		console.error('Call error:', error);
	});

	peers[userId] = call;
}

function addVideoStream(video, stream) {
	video.srcObject = stream;
	video.addEventListener('loadedmetadata', () => {
		video.play().catch(e => console.error('Error playing video:', e));
	});
	videoGrid.append(video);
}
