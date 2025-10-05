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

// Connect with valid token
const socket = io('http://localhost:3000', {
  auth: {
    token: token,
  },
});

socket.on('connect', () => {
  console.log('✅ Successfully connected with ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.log('❌ Connection error:', error.message);
});

// Keep alive for 5 seconds then disconnect
setTimeout(() => {
  socket.disconnect();
  console.log('Disconnected');
}, 5000);
