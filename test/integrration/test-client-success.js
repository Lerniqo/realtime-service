const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Generate test JWT token
const token = jwt.sign(
  {
    sub: 'user123',
    role: 'user',
    email: 'test@example.com',
  },
  'SunimalSirgeThatte', // Use your JWT_SECRET
  { expiresIn: '1h' },
);

// Create socket connection with auth token
const socket = io('http://localhost:3000', {
  auth: {
    token: token,
  },
});

socket.on('connect', () => {
  console.log('✅ Successfully connected with ID:', socket.id);

  // Test the matchmaking:join event
  console.log('📤 Sending matchmaking:join event...');
  socket.emit('matchmaking:join', { gameType: '1v1' });
});

// Join a room
socket.emit('joinRoom', 'room1');
socket.emit('leaveRoom', 'room1'); // Leave private room

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

// Keep alive for 5 seconds then disconnect
setTimeout(() => {
  socket.disconnect();
  console.log('Disconnected');
}, 10000);
