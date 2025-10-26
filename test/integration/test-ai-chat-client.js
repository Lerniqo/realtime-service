/**
 * Integration test client for AI Tutor Chat via WebSocket
 * 
 * This script demonstrates how to:
 * 1. Connect to the WebSocket server with authentication
 * 2. Send chat messages to the AI Tutor
 * 3. Receive responses from the AI
 * 4. Handle errors gracefully
 * 
 * Usage:
 *   node test/integration/test-ai-chat-client.js
 */

const io = require('socket.io-client');

// Configuration
const SOCKET_URL = process.env.SOCKET_URL || 'http://localhost:3000';
const AUTH_TOKEN = process.env.AUTH_TOKEN || 'your-test-session-token';

// Create a socket connection with authentication
const socket = io(SOCKET_URL, {
  auth: {
    token: AUTH_TOKEN,
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
});

// Connection event handlers
socket.on('connect', () => {
  console.log('✅ Connected to WebSocket server');
  console.log('Socket ID:', socket.id);
  
  // Send a test chat message
  sendChatMessage('Hello! Can you help me understand calculus?');
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error.message);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log('📡 Disconnected:', reason);
  if (reason === 'io server disconnect') {
    // Server disconnected the socket (e.g., authentication failure)
    console.log('⚠️  Server disconnected the socket. Check authentication.');
    process.exit(1);
  }
});

// Chat event handlers
socket.on('chat:newMessage', (data) => {
  console.log('\n📨 Received AI response:');
  console.log('Message:', data.message);
  console.log('Session ID:', data.sessionId);
  console.log('Metadata:', JSON.stringify(data.metadata, null, 2));
  console.log('Timestamp:', data.timestamp);
  
  // For demonstration, send another message after a delay
  setTimeout(() => {
    sendChatMessage('That was helpful! Can you explain derivatives?');
  }, 2000);
});

socket.on('chat:error', (error) => {
  console.error('\n❌ Chat error:');
  console.error('Code:', error.code);
  console.error('Message:', error.message);
  console.error('Details:', error.details);
  console.error('Timestamp:', error.timestamp);
  
  if (error.code === 'AUTH_REQUIRED') {
    console.log('⚠️  Authentication required. Please provide a valid token.');
    socket.disconnect();
    process.exit(1);
  }
});

// Helper function to send chat messages
function sendChatMessage(message, sessionId = null, context = null) {
  console.log(`\n📤 Sending message: "${message}"`);
  
  const payload = {
    message,
    sessionId,
    context,
  };
  
  socket.emit('chat:sendMessage', payload);
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down...');
  socket.disconnect();
  process.exit(0);
});

// Keep the process alive
console.log('🚀 AI Tutor Chat Test Client');
console.log('Connecting to:', SOCKET_URL);
console.log('Press Ctrl+C to exit\n');
