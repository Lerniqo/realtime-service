const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Generate test JWT token
const token = jwt.sign(
  {
    sub: 'user999',
    role: 'user',
    email: 'test999@example.com',
  },
  'defaultSecret', // Use the default JWT_SECRET from server
  { expiresIn: '1h' },
);

// Create socket connection with auth token
const socket = io('http://localhost:3000', {
  auth: {
    token: token,
  },
});

socket.on('connect', () => {
  console.log('✅ Single client connected with ID:', socket.id);

  // Test the matchmaking:join event
  console.log('📤 Sending matchmaking:join event...');
  socket.emit('matchmaking:join', { gameType: '1v1_rapid_quiz' });

  console.log('⏳ Waiting in queue... (will stay connected for 30 seconds)');
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

// Keep alive for 30 seconds
setTimeout(() => {
  console.log('🔌 Disconnecting...');
  socket.disconnect();
  console.log('Disconnected');
}, 30000);
