const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

// Generate test JWT tokens for two different users
const token1 = jwt.sign(
  {
    sub: 'user123',
    role: 'user',
    email: 'test1@example.com',
  },
  'defaultSecret', // Use the default JWT_SECRET from server
  { expiresIn: '1h' },
);

const token2 = jwt.sign(
  {
    sub: 'user456',
    role: 'user',
    email: 'test2@example.com',
  },
  'SunimalSirgeThatte', // Use the default JWT_SECRET from server
  { expiresIn: '1h' },
);

// Create first socket connection
const socket1 = io('http://localhost:3000', {
  auth: {
    token: token1,
  },
});

// Create second socket connection
const socket2 = io('http://localhost:3000', {
  auth: {
    token: token2,
  },
});

socket1.on('connect', () => {
  console.log('✅ Player 1 successfully connected with ID:', socket1.id);

  // Test the matchmaking:join event for player 1
  console.log('📤 Player 1 sending matchmaking:join event...');
  socket1.emit('matchmaking:join', {
    userId: 'user123',
    gameType: '1v1_rapid_quiz',
  });

  // Wait for 3 seconds and send match:submitAnswer event
  setTimeout(() => {
    console.log('📤 Player 1 sending match:submitAnswer event...');
    socket1.emit('match:submitAnswer', { answer: 'A', timer: 10 });

    // Wait for another 2 seconds and send the event again
    setTimeout(() => {
      console.log('📤 Player 1 sending match:submitAnswer event again...');
      socket1.emit('match:submitAnswer', { answer: 'B', timer: 8 });
    }, 2000);
  }, 3000);
});

socket2.on('connect', () => {
  console.log('✅ Player 2 successfully connected with ID:', socket2.id);

  // Test the matchmaking:join event for player 2 (slight delay to see the effect)
  setTimeout(() => {
    console.log('📤 Player 2 sending matchmaking:join event...');
    socket2.emit('matchmaking:join', {
      userId: 'user456',
      gameType: '1v1_rapid_quiz',
    });

    // Wait for 3 seconds and send match:submitAnswer event
    setTimeout(() => {
      console.log('📤 Player 2 sending match:submitAnswer event...');
      socket2.emit('match:submitAnswer', { answer: 'C', timer: 9 });

      // Wait for another 2 seconds and send the event again
      setTimeout(() => {
        console.log('📤 Player 2 sending match:submitAnswer event again...');
        socket2.emit('match:submitAnswer', { answer: 'D', timer: 7 });
      }, 2000);
    }, 3000);
  }, 1000);
});

// Listen for any events that might indicate a match was found
socket1.on('matchFound', (data) => {
  console.log('🎯 Player 1 received matchFound:', data);
});

socket2.on('matchFound', (data) => {
  console.log('🎯 Player 2 received matchFound:', data);
});

socket1.on('connect_error', (error) => {
  console.log('❌ Player 1 connection error:', error.message);
});

socket2.on('connect_error', (error) => {
  console.log('❌ Player 2 connection error:', error.message);
});

// Adjust the keep-alive duration to 10 seconds after the last event
setTimeout(() => {
  console.log('🔌 Disconnecting both players...');
  socket1.disconnect();
  socket2.disconnect();
  console.log('Disconnected both players');
}, 10000);
