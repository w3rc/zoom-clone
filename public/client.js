// Global variables
const socket = io('/');
let myPeer;
let myStream;
let myVideo;
let peers = {};
let participants = new Map();
let isAudioEnabled = true;
let isVideoEnabled = true;
let isScreenSharing = false;
let userName = '';

// DOM elements
const joinScreen = document.getElementById('joinScreen');
const mainApp = document.getElementById('mainApp');
const videoGrid = document.getElementById('videoGrid');
const previewVideo = document.getElementById('previewVideo');
const userNameInput = document.getElementById('userName');
const cameraSelect = document.getElementById('cameraSelect');
const micSelect = document.getElementById('micSelect');
const joinBtn = document.getElementById('joinBtn');

// Control buttons
const micBtn = document.getElementById('micBtn');
const cameraBtn = document.getElementById('cameraBtn');
const screenBtn = document.getElementById('screenBtn');
const leaveBtn = document.getElementById('leaveBtn');
const copyRoomBtn = document.getElementById('copyRoomBtn');
const participantsBtn = document.getElementById('participantsBtn');
const sidebar = document.getElementById('sidebar');
const participantsList = document.getElementById('participantsList');
const participantCount = document.getElementById('participantCount');

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
	setupEventListeners();
	loadDevices();
	initializePreview();
});

// Setup all event listeners
function setupEventListeners() {
	joinBtn.addEventListener('click', joinMeeting);
	micBtn.addEventListener('click', toggleAudio);
	cameraBtn.addEventListener('click', toggleVideo);
	screenBtn.addEventListener('click', toggleScreenShare);
	leaveBtn.addEventListener('click', leaveMeeting);
	copyRoomBtn.addEventListener('click', copyRoomLink);
	participantsBtn.addEventListener('click', toggleSidebar);
	
	// Keyboard shortcuts
	document.addEventListener('keydown', handleKeyboard);
}

// Load available devices
async function loadDevices() {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		
		// Clear existing options
		cameraSelect.innerHTML = '';
		micSelect.innerHTML = '';
		
		devices.forEach(device => {
			const option = document.createElement('option');
			option.value = device.deviceId;
			option.text = device.label || `${device.kind} ${cameraSelect.length + micSelect.length + 1}`;
			
			if (device.kind === 'videoinput') {
				cameraSelect.appendChild(option);
			} else if (device.kind === 'audioinput') {
				micSelect.appendChild(option);
			}
		});
	} catch (error) {
		console.error('Error loading devices:', error);
	}
}

// Initialize preview video
async function initializePreview() {
	try {
		const stream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true
		});
		previewVideo.srcObject = stream;
		
		// Stop preview stream
		setTimeout(() => {
			stream.getTracks().forEach(track => track.stop());
		}, 1000);
	} catch (error) {
		console.error('Error initializing preview:', error);
	}
}

// Join meeting
async function joinMeeting() {
	userName = userNameInput.value.trim() || 'Anonymous';
	
	try {
		// Get user media with selected devices
		const constraints = {
			video: cameraSelect.value ? { deviceId: cameraSelect.value } : true,
			audio: micSelect.value ? { deviceId: micSelect.value } : true
		};
		
		myStream = await navigator.mediaDevices.getUserMedia(constraints);
		
		// Initialize PeerJS
		myPeer = new Peer(undefined, {
			host: 'localhost',
			port: 7001,
			path: '/'
		});
		
		// Setup peer events
		setupPeerEvents();
		
		// Create my video element
		myVideo = document.createElement('video');
		myVideo.muted = true;
		
		// Show main app
		joinScreen.classList.add('hidden');
		mainApp.classList.remove('hidden');
		
		// Add my video to grid
		addVideoStream(myVideo, myStream, userName + ' (You)', true);
		
		// Add myself to participants
		participants.set('self', { name: userName, isMe: true });
		updateParticipantsList();
		
	} catch (error) {
		console.error('Error joining meeting:', error);
		alert('Could not access camera/microphone. Please check permissions and try again.');
	}
}

// Setup peer events
function setupPeerEvents() {
	myPeer.on('open', (id) => {
		socket.emit('join-room', ROOM_ID, id, userName);
	});
	
	myPeer.on('call', (call) => {
		call.answer(myStream);
		const video = document.createElement('video');
		
		call.on('stream', (userVideoStream) => {
			const participant = participants.get(call.peer);
			const name = participant ? participant.name : 'Unknown User';
			addVideoStream(video, userVideoStream, name);
		});
		
		call.on('close', () => {
			removeVideoStream(video);
		});
		
		peers[call.peer] = call;
	});
	
	myPeer.on('error', (error) => {
		console.error('PeerJS error:', error);
	});
}

// Socket events
socket.on('user-connected', (userId, participantName) => {
	console.log(`User ${participantName} connected`);
	participants.set(userId, { name: participantName, isMe: false });
	updateParticipantsList();
	
	setTimeout(() => {
		connectToNewUser(userId, myStream);
	}, 1000);
});

socket.on('user-disconnected', (userId) => {
	console.log(`User disconnected: ${userId}`);
	if (peers[userId]) {
		peers[userId].close();
		delete peers[userId];
	}
	participants.delete(userId);
	updateParticipantsList();
});

// Connect to new user
function connectToNewUser(userId, stream) {
	const call = myPeer.call(userId, stream);
	const video = document.createElement('video');
	
	call.on('stream', (userVideoStream) => {
		const participant = participants.get(userId);
		const name = participant ? participant.name : 'Unknown User';
		addVideoStream(video, userVideoStream, name);
	});
	
	call.on('close', () => {
		removeVideoStream(video);
	});
	
	call.on('error', (error) => {
		console.error('Call error:', error);
	});
	
	peers[userId] = call;
}

// Add video stream to grid
function addVideoStream(video, stream, participantName, isMe = false) {
	const videoContainer = document.createElement('div');
	videoContainer.className = 'video-container';
	
	video.srcObject = stream;
	video.addEventListener('loadedmetadata', () => {
		video.play().catch(e => console.error('Error playing video:', e));
	});
	
	// Add video overlay with name
	const overlay = document.createElement('div');
	overlay.className = 'video-overlay';
	overlay.textContent = participantName;
	
	// Add connection status indicator
	const statusIndicator = document.createElement('div');
	statusIndicator.className = 'connection-status';
	
	videoContainer.appendChild(video);
	videoContainer.appendChild(overlay);
	videoContainer.appendChild(statusIndicator);
	
	videoGrid.appendChild(videoContainer);
	
	// Store reference for removal
	video.parentContainer = videoContainer;
}

// Remove video stream
function removeVideoStream(video) {
	if (video.parentContainer) {
		video.parentContainer.remove();
	}
}

// Toggle audio
function toggleAudio() {
	isAudioEnabled = !isAudioEnabled;
	
	if (myStream) {
		myStream.getAudioTracks().forEach(track => {
			track.enabled = isAudioEnabled;
		});
	}
	
	micBtn.classList.toggle('muted', !isAudioEnabled);
	micBtn.innerHTML = isAudioEnabled ? 
		'<i class="fas fa-microphone"></i>' : 
		'<i class="fas fa-microphone-slash"></i>';
}

// Toggle video
function toggleVideo() {
	isVideoEnabled = !isVideoEnabled;
	
	if (myStream) {
		myStream.getVideoTracks().forEach(track => {
			track.enabled = isVideoEnabled;
		});
	}
	
	cameraBtn.classList.toggle('disabled', !isVideoEnabled);
	cameraBtn.innerHTML = isVideoEnabled ? 
		'<i class="fas fa-video"></i>' : 
		'<i class="fas fa-video-slash"></i>';
}

// Toggle screen share
async function toggleScreenShare() {
	if (!isScreenSharing) {
		try {
			const screenStream = await navigator.mediaDevices.getDisplayMedia({
				video: true,
				audio: true
			});
			
			// Replace video track in all peer connections
			const videoTrack = screenStream.getVideoTracks()[0];
			
			Object.values(peers).forEach(peer => {
				const sender = peer.peerConnection.getSenders().find(s =>
					s.track && s.track.kind === 'video'
				);
				if (sender) {
					sender.replaceTrack(videoTrack);
				}
			});
			
			// Update my video
			myVideo.srcObject = screenStream;
			
			// Handle screen share end
			videoTrack.onended = () => {
				stopScreenShare();
			};
			
			isScreenSharing = true;
			screenBtn.classList.add('active');
			screenBtn.innerHTML = '<i class="fas fa-stop"></i>';
			
		} catch (error) {
			console.error('Error sharing screen:', error);
		}
	} else {
		stopScreenShare();
	}
}

// Stop screen share
async function stopScreenShare() {
	try {
		// Get camera stream back
		const cameraStream = await navigator.mediaDevices.getUserMedia({
			video: true,
			audio: true
		});
		
		// Replace video track back to camera
		const videoTrack = cameraStream.getVideoTracks()[0];
		
		Object.values(peers).forEach(peer => {
			const sender = peer.peerConnection.getSenders().find(s =>
				s.track && s.track.kind === 'video'
			);
			if (sender) {
				sender.replaceTrack(videoTrack);
			}
		});
		
		// Update my video
		myVideo.srcObject = cameraStream;
		myStream = cameraStream;
		
		isScreenSharing = false;
		screenBtn.classList.remove('active');
		screenBtn.innerHTML = '<i class="fas fa-desktop"></i>';
		
	} catch (error) {
		console.error('Error stopping screen share:', error);
	}
}

// Leave meeting
function leaveMeeting() {
	if (confirm('Are you sure you want to leave the meeting?')) {
		// Stop all tracks
		if (myStream) {
			myStream.getTracks().forEach(track => track.stop());
		}
		
		// Close all peer connections
		Object.values(peers).forEach(peer => peer.close());
		
		// Disconnect socket
		socket.disconnect();
		
		// Redirect to home
		window.location.href = '/';
	}
}

// Copy room link
function copyRoomLink() {
	const roomLink = window.location.href;
	navigator.clipboard.writeText(roomLink).then(() => {
		copyRoomBtn.innerHTML = '<i class="fas fa-check"></i> Copied!';
		setTimeout(() => {
			copyRoomBtn.innerHTML = '<i class="fas fa-copy"></i> Copy Room Link';
		}, 2000);
	}).catch(err => {
		console.error('Error copying to clipboard:', err);
	});
}

// Toggle sidebar
function toggleSidebar() {
	sidebar.classList.toggle('open');
}

// Update participants list
function updateParticipantsList() {
	participantsList.innerHTML = '';
	participantCount.textContent = participants.size;
	
	participants.forEach((participant, id) => {
		const participantDiv = document.createElement('div');
		participantDiv.className = 'participant';
		
		const avatar = document.createElement('div');
		avatar.className = 'participant-avatar';
		avatar.textContent = participant.name.charAt(0).toUpperCase();
		
		const name = document.createElement('span');
		name.textContent = participant.name;
		
		participantDiv.appendChild(avatar);
		participantDiv.appendChild(name);
		
		participantsList.appendChild(participantDiv);
	});
}

// Keyboard shortcuts
function handleKeyboard(event) {
	if (event.target.tagName === 'INPUT') return;
	
	switch (event.key.toLowerCase()) {
		case 'm':
			event.preventDefault();
			toggleAudio();
			break;
		case 'c':
			event.preventDefault();
			toggleVideo();
			break;
		case 's':
			event.preventDefault();
			toggleScreenShare();
			break;
		case 'l':
			event.preventDefault();
			leaveMeeting();
			break;
	}
}
