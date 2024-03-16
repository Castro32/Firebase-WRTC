// Initialize Material Design Components
mdc.ripple.MDCRipple.attachTo(document.querySelector('.mdc-button'));

// Default configuration for ICE servers
const configuration = {
  iceServers: [
    {
      urls: [
        'stun:stun1.l.google.com:19302',
        'stun:stun2.l.google.com:19302',
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

let peerConnection = null; // PeerConnection instance
let localStream = null; // Local stream (user's camera and microphone)
let remoteStream = null; // Remote stream (stream received from another peer)
let roomDialog = null; // Dialog for room joining
let roomId = null; // Current room ID

// Function to initialize the application
function init() {
  // Event listeners for buttons
  document.querySelector('#cameraBtn').addEventListener('click', openUserMedia);
  document.querySelector('#hangupBtn').addEventListener('click', hangUp);
  document.querySelector('#createBtn').addEventListener('click', createRoom);
  document.querySelector('#joinBtn').addEventListener('click', joinRoom);
  // Initialize room dialog
  roomDialog = new mdc.dialog.MDCDialog(document.querySelector('#room-dialog'));
}

// Function to create a new room
async function createRoom() {
  // Disable create and join buttons while creating the room
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;
  const db = firebase.firestore(); // Firestore instance

  // Create a new PeerConnection with default configuration
  peerConnection = new RTCPeerConnection(configuration);
  // Register event listeners for PeerConnection
  registerPeerConnectionListeners();

  // Create an offer to establish a connection
  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  // Store the offer in Firestore to share with the other peer
  const roomWithOffer = {
    offer: {
      type: offer.type,
      sdp: offer.sdp
    }
  }
  const roomRef = await db.collection('rooms').add(roomWithOffer);
  roomId = roomRef.id; 
  
  console.log("Room ID:", roomId);
 
  // Store the room ID
  // Display the room ID to the user
  document.querySelector('#currentRoom').innerText = `Current room is ${roomId} - You are the caller!`;


  // Add tracks from local stream to the PeerConnection
  localStream.getTracks().forEach(track => {
    peerConnection.addTrack(track, localStream);
  });

  // Listen for remote tracks
  peerConnection.addEventListener('track', event => {
    event.streams[0].getTracks().forEach(track => {
      remoteStream.addTrack(track);
    });
  });
}

// Function to join an existing room
function joinRoom() {
  // Disable create and join buttons while joining the room
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = true;

  // Show room dialog to get the room ID from the user
  document.querySelector('#confirmJoinBtn').addEventListener('click', async () => {
    roomId = document.querySelector('#room-id').value;
    document.querySelector('#currentRoom').innerText = `Current room is ${roomId} - You are the callee!`;
    await joinRoomById(roomId);
  }, {once: true});
  roomDialog.open();
}

// Function to join a room by ID
async function joinRoomById(roomId) {
  const db = firebase.firestore();
  const roomRef = db.collection('rooms').doc(roomId);
  const roomSnapshot = await roomRef.get();

  if (roomSnapshot.exists) {
    // Create a new PeerConnection with default configuration
    peerConnection = new RTCPeerConnection(configuration);
    // Register event listeners for PeerConnection
    registerPeerConnectionListeners();
    // Add tracks from local stream to the PeerConnection
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    // Listen for remote tracks
    peerConnection.addEventListener('track', event => {
      event.streams[0].getTracks().forEach(track => {
        remoteStream.addTrack(track);
      });
    });
  }
}

// Function to open user's camera and microphone
async function openUserMedia() {
  const stream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
  localStream = stream;
  remoteStream = new MediaStream();

  // Display local video feed
  document.querySelector('#localVideo').srcObject = localStream;
  // Enable/disable buttons
  document.querySelector('#cameraBtn').disabled = true;
  document.querySelector('#joinBtn').disabled = false;
  document.querySelector('#createBtn').disabled = false;
  document.querySelector('#hangupBtn').disabled = false;
}

// Function to hang up the call and reset the application
async function hangUp() {
  // Stop all media tracks
  localStream.getTracks().forEach(track => track.stop());
  if (remoteStream) {
    remoteStream.getTracks().forEach(track => track.stop());
  }
  // Close the PeerConnection
  if (peerConnection) {
    peerConnection.close();
  }
  // Reset UI elements
  document.querySelector('#localVideo').srcObject = null;
  document.querySelector('#remoteVideo').srcObject = null;
  document.querySelector('#cameraBtn').disabled = false;
  document.querySelector('#joinBtn').disabled = true;
  document.querySelector('#createBtn').disabled = true;
  document.querySelector('#hangupBtn').disabled = true;
  document.querySelector('#currentRoom').innerText = '';
  // Delete room if it exists
  if (roomId) {
    const db = firebase.firestore();
    const roomRef = db.collection('rooms').doc(roomId);
    const calleeCandidates = await roomRef.collection('calleeCandidates').get();
    calleeCandidates.forEach(async candidate => {
      await candidate.delete();
    });
    const callerCandidates = await roomRef.collection('callerCandidates').get();
    callerCandidates.forEach(async candidate => {
      await candidate.delete();
    });
    await roomRef.delete();
  }
  // Reload the page
  document.location.reload(true);
}

// Function to register event listeners for PeerConnection events
function registerPeerConnectionListeners() {
  peerConnection.addEventListener('icegatheringstatechange', () => {
    console.log(`ICE gathering state changed: ${peerConnection.iceGatheringState}`);
  });
  peerConnection.addEventListener('connectionstatechange', () => {
    console.log(`Connection state change: ${peerConnection.connectionState}`);
  });
  peerConnection.addEventListener('signalingstatechange', () => {
    console.log(`Signaling state change: ${peerConnection.signalingState}`);
  });
  peerConnection.addEventListener('iceconnectionstatechange', () => {
    console.log(`ICE connection state change: ${peerConnection.iceConnectionState}`);
  });
}

// Event listener for screen sharing button
document.querySelector('#screenShareBtn').addEventListener('click', startScreenSharing);

// Function to start screen sharing
async function startScreenSharing() {
  try {
    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    screenStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, screenStream);
    });
  } catch (error) {
    console.error('Error accessing screen:', error);
  }
}

// Initialize the application
init();
