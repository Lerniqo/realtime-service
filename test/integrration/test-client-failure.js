const { io } = require('socket.io-client');

// Connect with invalid token
const socket = io('http://localhost:3000', {
  auth: {
    token: 'invalid-token',
  },
});

socket.on('connect', () => {
  console.log('This should not happen');
});

socket.on('connect_error', (error) => {
  console.log('✅ Expected connection error:', error.message);
});

setTimeout(() => process.exit(0), 3000);
