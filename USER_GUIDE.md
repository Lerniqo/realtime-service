# Realtime Service - Comprehensive User Guide

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Getting Started](#getting-started)
4. [API Documentation](#api-documentation)
   - [HTTP REST Endpoints](#http-rest-endpoints)
   - [WebSocket Events](#websocket-events)
   - [Kafka Message Patterns](#kafka-message-patterns)
5. [Authentication](#authentication)
6. [Examples](#examples)
7. [Error Handling](#error-handling)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The Realtime Service is a NestJS-based application that provides real-time communication capabilities for multiplayer gaming, matchmaking, notifications, and room management. It leverages WebSocket connections for instant bidirectional communication and integrates with Redis for state management and Kafka for event-driven messaging.

### Key Features
- **Real-time WebSocket Communication**: Persistent bidirectional connections for instant updates
- **Matchmaking System**: Queue-based matchmaking for 1v1 rapid quiz games
- **Room Management**: Dynamic room creation, joining, and leaving capabilities
- **Notification System**: User-specific and broadcast notifications
- **Kafka Integration**: Event-driven architecture for external service communication
- **Redis Adapter**: Scalable WebSocket adapter for horizontal scaling
- **JWT Authentication**: Secure token-based authentication for WebSocket connections
- **Health Monitoring**: Health check endpoints for service monitoring

### Tech Stack
- **Framework**: NestJS 11.x
- **WebSocket**: Socket.IO 4.8.x
- **Real-time Scaling**: Redis Adapter for Socket.IO
- **Message Queue**: Kafka (KafkaJS 2.2.x)
- **State Management**: Redis (ioredis 5.8.x)
- **Authentication**: JWT (jsonwebtoken 9.0.x)
- **Logging**: Pino (nestjs-pino 4.4.x)

---

## Architecture

### Service Components

```
┌─────────────────────────────────────────────────────┐
│                  Realtime Service                    │
├─────────────────────────────────────────────────────┤
│                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   WebSocket  │  │     HTTP     │  │   Kafka   │ │
│  │   Gateway    │  │  Controllers │  │ Consumer  │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │        │
│  ┌──────▼─────────────────▼─────────────────▼────┐ │
│  │              Business Services                 │ │
│  │  • Matchmaking  • Rooms  • Notifications      │ │
│  └──────┬─────────────────────────────────────────┘ │
│         │                                            │
│  ┌──────▼──────────────────────────────────────┐   │
│  │           Redis (State & Adapter)            │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Dependencies
- **Redis**: State management, WebSocket adapter, matchmaking queues
- **Kafka**: Event-driven communication with external services
- **Content Service**: Quiz questions and answers (internal service)

---

## Getting Started

### Prerequisites
- Node.js 20.x or higher
- pnpm package manager
- Docker and Docker Compose (for dependencies)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd realtime-service
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Set up environment variables**
Create a `.env` file in the root directory:
```env
# Server Configuration
PORT=3000

# JWT Configuration
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=3600s

# Internal API Security
INTERNAL_API_KEY=your-internal-api-key-here

# Redis Configuration (if not using default)
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka Configuration (if not using default)
KAFKA_BROKERS=localhost:9092
```

4. **Start infrastructure services**
```bash
docker-compose up -d
```

This starts:
- Redis on port `6379`
- Kafka broker on port `9092`

5. **Start the application**

**Development mode:**
```bash
pnpm start:dev
```

**Production mode:**
```bash
pnpm build
pnpm start:prod
```

### Verification

Check if the service is running:
```bash
curl http://localhost:3000/health
```

Expected response: `"Realtime service is healthy"`

---

## API Documentation

### HTTP REST Endpoints

#### 1. Root Endpoint
**Purpose**: Basic service verification

**Endpoint**: `GET /`

**Authentication**: None

**Request**:
```bash
curl http://localhost:3000/
```

**Response**:
```json
"Hello World!"
```

---

#### 2. Health Check
**Purpose**: Service health monitoring

**Endpoint**: `GET /health`

**Authentication**: None

**Request**:
```bash
curl http://localhost:3000/health
```

**Response**:
```json
"Realtime service is healthy"
```

**Use Cases**:
- Load balancer health checks
- Monitoring systems
- Deployment verification

---

#### 3. Internal Notification Endpoint
**Purpose**: Send notifications to multiple users from internal services

**Endpoint**: `POST /api/realtime/internal/notify`

**Authentication**: Internal API Key (header)

**Headers**:
```
Content-Type: application/json
internal-api-key: <your-internal-api-key>
```

**Request Body**:
```json
{
  "userIds": ["user123", "user456", "user789"],
  "payload": {
    "type": "session_reminder",
    "title": "Session Starting Soon",
    "message": "Your tutoring session starts in 5 minutes",
    "sessionId": "session-123",
    "timestamp": "2025-10-15T10:00:00Z"
  }
}
```

**Request Schema**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `userIds` | string[] | Yes | Array of user IDs to notify |
| `payload` | object | Yes | Notification data (flexible structure) |

**Response** (202 Accepted):
```json
{
  "status": "queued"
}
```

**Example Request**:
```bash
curl -X POST http://localhost:3000/api/realtime/internal/notify \
  -H "Content-Type: application/json" \
  -H "internal-api-key: your-api-key" \
  -d '{
    "userIds": ["user123"],
    "payload": {
      "type": "achievement",
      "message": "You earned a new badge!"
    }
  }'
```

**Error Responses**:
- `401 Unauthorized`: Missing or invalid API key
- `400 Bad Request`: Invalid request body (missing required fields)

---

### WebSocket Events

#### Connection Setup

**WebSocket URL**: `ws://localhost:3000` or `wss://your-domain.com`

**Authentication**: JWT token required

**Connection Options**:

**Option 1: Auth object**
```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token-here'
  }
});
```

**Option 2: Authorization header**
```javascript
const socket = io('http://localhost:3000', {
  extraHeaders: {
    Authorization: 'Bearer your-jwt-token-here'
  }
});
```

**JWT Token Payload**:
```json
{
  "sub": "user123",        // or "userId"
  "email": "user@example.com",
  "role": "student",
  "iat": 1697356800,
  "exp": 1697360400
}
```

**Connection Events**:
```javascript
socket.on('connect', () => {
  console.log('Connected:', socket.id);
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('Connection error:', error.message);
});
```

---

#### 1. Join Room
**Event**: `joinRoom`

**Purpose**: Join a named room for group communication

**Payload**: `string` (room name)

**Emit**:
```javascript
socket.emit('joinRoom', 'game-lobby-1');
```

**Server Response**: None (silent success)

**Auto-Join**: Users are automatically joined to their private room `user:{userId}` on connection

**Use Cases**:
- Join game lobbies
- Subscribe to topic-based updates
- Group chat rooms

---

#### 2. Leave Room
**Event**: `leaveRoom`

**Purpose**: Leave a previously joined room

**Payload**: `string` (room name)

**Emit**:
```javascript
socket.emit('leaveRoom', 'game-lobby-1');
```

**Server Response**: None (silent success)

**Notes**:
- Users are automatically removed from all rooms on disconnect
- Cannot leave the private user room

---

#### 3. Broadcast to Room
**Event**: `broadcastToRoom`

**Purpose**: Send a message to all users in a specific room

**Payload**:
```typescript
{
  room: string;      // Room name
  event: string;     // Event name to emit
  payload: any;      // Data to send
}
```

**Emit**:
```javascript
socket.emit('broadcastToRoom', {
  room: 'game-lobby-1',
  event: 'chat:message',
  payload: {
    userId: 'user123',
    message: 'Hello everyone!',
    timestamp: Date.now()
  }
});
```

**All users in room receive**:
```javascript
socket.on('chat:message', (data) => {
  console.log(data);
  // { userId: 'user123', message: 'Hello everyone!', timestamp: 1697356800000 }
});
```

**Use Cases**:
- In-game chat
- Real-time collaboration
- Live updates to room members

---

#### 4. Join Matchmaking Queue
**Event**: `matchmaking:join`

**Purpose**: Add user to matchmaking queue for a specific game type

**Payload**:
```typescript
{
  userId: string;
  gameType: string;  // Currently supports: "1v1_rapid_quiz"
}
```

**Emit**:
```javascript
socket.emit('matchmaking:join', {
  userId: 'user123',
  gameType: '1v1_rapid_quiz'
});
```

**Server Response**: None (queuing is asynchronous)

**Matchmaking Process**:
1. User added to Redis queue for the game type
2. Background worker processes queue every 5 seconds
3. When a match is found, both players receive `match:found` event

**Supported Game Types**:
- `1v1_rapid_quiz`: One-vs-one rapid quiz game

---

#### 5. Match Found (Server → Client)
**Event**: `match:found`

**Purpose**: Notify players that a match has been found

**Payload Received**:
```typescript
{
  matchId: string;           // Unique match identifier
  opponentClientId: string;  // Opponent's socket ID
  opponentUserId: string;    // Opponent's user ID
  questions: Array<{
    id: number;
    question: string;
    options: string[];
  }>;
}
```

**Listen**:
```javascript
socket.on('match:found', (data) => {
  console.log('Match found!');
  console.log('Match ID:', data.matchId);
  console.log('Opponent:', data.opponentUserId);
  console.log('Questions:', data.questions);
  
  // Auto-join match room
  socket.emit('joinRoom', data.matchId);
});
```

**Match Room**: Both players are automatically joined to room `match:{matchId}`

**Game Questions Example**:
```json
{
  "matchId": "match:1697356800000",
  "opponentUserId": "user456",
  "questions": [
    {
      "id": 1,
      "question": "Simplify: 3x + 5x - 2",
      "options": ["5x - 2", "8x - 2", "8x + 2", "2x + 5"]
    },
    {
      "id": 2,
      "question": "What is the value of (2² + 3²)?",
      "options": ["9", "10", "12", "13"]
    }
  ]
}
```

---

#### 6. Submit Answer
**Event**: `match:submitAnswer`

**Purpose**: Submit an answer for the current question

**Payload**:
```typescript
{
  answer: string;   // Selected answer
  timer: number;    // Time taken in milliseconds
}
```

**Emit**:
```javascript
socket.emit('match:submitAnswer', {
  answer: '8x - 2',
  timer: 3500  // 3.5 seconds
});
```

**Server Logic**:
1. Validates the answer against correct answer in Redis
2. Updates player's score if correct
3. Advances to next question
4. Broadcasts updated game state to both players

**All players in match receive**: `match:stateUpdate` event

---

#### 7. Match State Update (Server → Client)
**Event**: `match:stateUpdate`

**Purpose**: Broadcast updated game state to all players in a match

**Payload Received**:
```typescript
{
  matchId: string;
  playerA: {
    score: number;
    activeQuestionIndex: number;
    timer: number;
  };
  playerB: {
    score: number;
    activeQuestionIndex: number;
    timer: number;
  };
  isMatchComplete: boolean;
  totalQuestions: number;
}
```

**Listen**:
```javascript
socket.on('match:stateUpdate', (data) => {
  console.log('Game state updated:');
  console.log('Player A Score:', data.playerA.score);
  console.log('Player B Score:', data.playerB.score);
  console.log('Match Complete:', data.isMatchComplete);
  
  if (data.isMatchComplete) {
    // Handle game end
    const winner = data.playerA.score > data.playerB.score ? 'A' : 'B';
    console.log(`Player ${winner} wins!`);
  }
});
```

**Update Triggers**:
- When any player submits an answer
- After answer validation and score calculation

---

#### 8. Receive Notification (Server → Client)
**Event**: `notification:new`

**Purpose**: Receive notifications sent to the user

**Payload Received**: Any object sent via the internal notify endpoint

**Listen**:
```javascript
socket.on('notification:new', (notification) => {
  console.log('New notification:', notification);
  
  // Example notification structure:
  // {
  //   type: 'session_reminder',
  //   title: 'Session Starting Soon',
  //   message: 'Your tutoring session starts in 5 minutes',
  //   sessionId: 'session-123',
  //   timestamp: '2025-10-15T10:00:00Z'
  // }
  
  // Show notification to user
  showNotification(notification.title, notification.message);
});
```

**Notification Sources**:
1. Internal services via `/api/realtime/internal/notify` endpoint
2. Kafka events (SessionStartingSoon, ConceptMastered)

**Private Room**: Notifications are sent to user's private room `user:{userId}`

---

### Kafka Message Patterns

The service consumes Kafka messages as a microservice consumer.

**Consumer Group**: `realtime-service-group`

**Kafka Broker**: `localhost:9092` (configurable)

---

#### 1. Session Starting Soon
**Topic/Pattern**: `SessionStartingSoon`

**Purpose**: Notify users when their tutoring session is about to start

**Message Payload**:
```json
{
  "userIds": ["user123", "user456"],
  "message": {
    "type": "session_reminder",
    "title": "Session Starting Soon",
    "body": "Your tutoring session starts in 5 minutes",
    "sessionId": "session-789",
    "startTime": "2025-10-15T10:00:00Z"
  }
}
```

**Processing**:
- Service receives message from Kafka
- Sends notification to each user via WebSocket
- Users receive `notification:new` event

**Producer Example** (from external service):
```javascript
await kafka.send({
  topic: 'SessionStartingSoon',
  messages: [{
    value: JSON.stringify({
      userIds: ['user123'],
      message: {
        type: 'session_reminder',
        title: 'Session Starting Soon',
        body: 'Your session starts in 5 minutes'
      }
    })
  }]
});
```

---

#### 2. Concept Mastered
**Topic/Pattern**: `ConceptMastered`

**Purpose**: Notify users when they have mastered a learning concept

**Message Payload**:
```json
{
  "userIds": ["user123"],
  "message": {
    "type": "achievement",
    "title": "Concept Mastered!",
    "body": "You've mastered Quadratic Equations",
    "conceptId": "concept-456",
    "conceptName": "Quadratic Equations",
    "masteryLevel": 100,
    "badgeEarned": "algebra-master"
  }
}
```

**Processing**:
- Service receives message from Kafka
- Sends achievement notification to user via WebSocket
- Users receive `notification:new` event

**Producer Example** (from external service):
```javascript
await kafka.send({
  topic: 'ConceptMastered',
  messages: [{
    value: JSON.stringify({
      userIds: ['user123'],
      message: {
        type: 'achievement',
        title: 'Concept Mastered!',
        body: "You've mastered Quadratic Equations"
      }
    })
  }]
});
```

---

## Authentication

### JWT Token Requirements

**WebSocket Authentication**: Required for all WebSocket connections

**Token Location**:
- Auth object: `socket.auth.token`
- Authorization header: `Bearer <token>`

**Required Token Claims**:
```json
{
  "sub": "user-id",           // User identifier (or userId)
  "email": "user@example.com",
  "role": "student",          // User role
  "iat": 1697356800,          // Issued at
  "exp": 1697360400           // Expiration
}
```

**Token Verification**:
- Secret key from `JWT_SECRET` environment variable
- Tokens are verified on connection
- Invalid tokens result in immediate disconnection

**Generating Tokens** (example using Node.js):
```javascript
const jwt = require('jsonwebtoken');

const token = jwt.sign(
  {
    sub: 'user123',
    email: 'user@example.com',
    role: 'student'
  },
  process.env.JWT_SECRET,
  { expiresIn: '1h' }
);
```

---

### Internal API Key

**Purpose**: Secure internal service-to-service communication

**Required For**: `/api/realtime/internal/notify` endpoint

**Configuration**:
Set in environment variable:
```env
INTERNAL_API_KEY=your-secure-api-key-here
```

**Usage**:
```bash
curl -X POST http://localhost:3000/api/realtime/internal/notify \
  -H "internal-api-key: your-secure-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"userIds": ["user123"], "payload": {...}}'
```

**Security Best Practices**:
- Use strong, random API keys (32+ characters)
- Rotate keys periodically
- Never commit keys to version control
- Use environment variables or secret management systems

---

## Examples

### Example 1: Complete WebSocket Client (JavaScript)

```javascript
const io = require('socket.io-client');

// Connect with authentication
const socket = io('http://localhost:3000', {
  auth: {
    token: 'your-jwt-token-here'
  }
});

// Connection handlers
socket.on('connect', () => {
  console.log('✅ Connected:', socket.id);
  
  // Join a room
  socket.emit('joinRoom', 'game-lobby-1');
});

socket.on('disconnect', (reason) => {
  console.log('❌ Disconnected:', reason);
});

socket.on('connect_error', (error) => {
  console.error('⚠️ Connection error:', error.message);
});

// Listen for notifications
socket.on('notification:new', (notification) => {
  console.log('🔔 New notification:', notification);
});

// Join matchmaking
function joinMatchmaking(userId) {
  socket.emit('matchmaking:join', {
    userId: userId,
    gameType: '1v1_rapid_quiz'
  });
  console.log('🎮 Joined matchmaking queue...');
}

// Handle match found
socket.on('match:found', (data) => {
  console.log('🎯 Match found!');
  console.log('Match ID:', data.matchId);
  console.log('Opponent:', data.opponentUserId);
  console.log('Questions:', data.questions.length);
  
  // Join match room
  socket.emit('joinRoom', data.matchId);
  
  // Start game
  startGame(data);
});

// Handle game state updates
socket.on('match:stateUpdate', (state) => {
  console.log('📊 Game state updated:');
  console.log('Your score:', state.playerA.score);
  console.log('Opponent score:', state.playerB.score);
  console.log('Match complete:', state.isMatchComplete);
});

// Submit answer
function submitAnswer(answer, timeTaken) {
  socket.emit('match:submitAnswer', {
    answer: answer,
    timer: timeTaken
  });
}

// Example: Start matchmaking
joinMatchmaking('user123');
```

---

### Example 2: React Integration

```javascript
import { useEffect, useState } from 'react';
import io from 'socket.io-client';

function useRealtimeService(token) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Connect to WebSocket
    const newSocket = io('http://localhost:3000', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to realtime service');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Disconnected from realtime service');
      setConnected(false);
    });

    // Listen for notifications
    newSocket.on('notification:new', (notification) => {
      setNotifications(prev => [...prev, notification]);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.close();
    };
  }, [token]);

  const joinMatchmaking = (userId, gameType) => {
    socket?.emit('matchmaking:join', { userId, gameType });
  };

  const joinRoom = (roomName) => {
    socket?.emit('joinRoom', roomName);
  };

  const leaveRoom = (roomName) => {
    socket?.emit('leaveRoom', roomName);
  };

  return {
    socket,
    connected,
    notifications,
    joinMatchmaking,
    joinRoom,
    leaveRoom
  };
}

// Usage in component
function GameComponent() {
  const { socket, connected, joinMatchmaking } = useRealtimeService(userToken);
  const [matchData, setMatchData] = useState(null);

  useEffect(() => {
    if (!socket) return;

    socket.on('match:found', (data) => {
      setMatchData(data);
    });

    return () => {
      socket.off('match:found');
    };
  }, [socket]);

  const handleFindMatch = () => {
    joinMatchmaking('user123', '1v1_rapid_quiz');
  };

  return (
    <div>
      <p>Status: {connected ? 'Connected' : 'Disconnected'}</p>
      <button onClick={handleFindMatch}>Find Match</button>
      {matchData && <GameView matchData={matchData} socket={socket} />}
    </div>
  );
}
```

---

### Example 3: Sending Notifications from Backend Service

```javascript
// Using axios or fetch
const axios = require('axios');

async function notifyUsers(userIds, payload) {
  try {
    const response = await axios.post(
      'http://localhost:3000/api/realtime/internal/notify',
      {
        userIds: userIds,
        payload: payload
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'internal-api-key': process.env.INTERNAL_API_KEY
        }
      }
    );
    
    console.log('Notification queued:', response.data);
  } catch (error) {
    console.error('Failed to send notification:', error.message);
  }
}

// Usage
notifyUsers(
  ['user123', 'user456'],
  {
    type: 'session_reminder',
    title: 'Session Starting Soon',
    message: 'Your tutoring session starts in 5 minutes',
    sessionId: 'session-789'
  }
);
```

---

### Example 4: Kafka Producer (External Service)

```javascript
const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'my-service',
  brokers: ['localhost:9092']
});

const producer = kafka.producer();

async function sendSessionReminder(userIds, sessionDetails) {
  await producer.connect();
  
  await producer.send({
    topic: 'SessionStartingSoon',
    messages: [{
      value: JSON.stringify({
        userIds: userIds,
        message: {
          type: 'session_reminder',
          title: 'Session Starting Soon',
          body: `Your session starts in ${sessionDetails.minutesUntil} minutes`,
          sessionId: sessionDetails.sessionId,
          startTime: sessionDetails.startTime
        }
      })
    }]
  });
  
  console.log('Session reminder sent via Kafka');
  await producer.disconnect();
}

// Usage
sendSessionReminder(
  ['user123'],
  {
    minutesUntil: 5,
    sessionId: 'session-789',
    startTime: '2025-10-15T10:00:00Z'
  }
);
```

---

## Error Handling

### WebSocket Connection Errors

**1. Authentication Failure**
```javascript
socket.on('connect_error', (error) => {
  // Error: "Authentication failed" or "No token provided"
  console.error('Authentication error:', error.message);
  // Action: Verify JWT token is valid and not expired
});
```

**Common causes**:
- Missing token
- Invalid token format
- Expired token
- Invalid JWT secret

**Solution**: Refresh the JWT token and reconnect

---

**2. Connection Refused**
```javascript
socket.on('connect_error', (error) => {
  // Error: "xhr poll error" or "websocket error"
  console.error('Connection refused:', error.message);
  // Action: Check if service is running
});
```

**Common causes**:
- Service is down
- Wrong URL
- Firewall blocking connection
- CORS issues

**Solution**: Verify service status and network connectivity

---

### HTTP Endpoint Errors

**1. Invalid API Key (401 Unauthorized)**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**Cause**: Missing or incorrect `internal-api-key` header

**Solution**: Provide correct API key in request header

---

**2. Invalid Request Body (400 Bad Request)**
```json
{
  "statusCode": 400,
  "message": ["userIds should not be empty", "payload must be an object"],
  "error": "Bad Request"
}
```

**Cause**: Request body doesn't match DTO schema

**Solution**: Ensure request includes required fields with correct types

---

### Game Logic Errors

**1. No Match Room Found**
- Occurs when submitting answer but not in a match
- Check that you received `match:found` event
- Ensure you're in the correct match room

**2. Invalid Player in Match**
- Socket ID doesn't match any player in the match
- May occur if reconnecting mid-game
- Current limitation: reconnection not fully supported

**3. Question Index Out of Bounds**
- Attempting to submit answer after game completion
- Check `isMatchComplete` flag in `match:stateUpdate`

---

## Deployment

### Docker Deployment

**Build the Docker image**:
```bash
docker build -t realtime-service:latest .
```

**Run with Docker Compose**:
```bash
docker-compose up -d
```

**Environment Variables for Production**:
```env
NODE_ENV=production
PORT=3000
JWT_SECRET=<strong-secret-key>
INTERNAL_API_KEY=<strong-api-key>
REDIS_HOST=redis
REDIS_PORT=6379
KAFKA_BROKERS=broker:9092
```

---

### Kubernetes Deployment

**Deployment YAML** (example):
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: realtime-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: realtime-service
  template:
    metadata:
      labels:
        app: realtime-service
    spec:
      containers:
      - name: realtime-service
        image: realtime-service:latest
        ports:
        - containerPort: 3000
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: realtime-secrets
              key: jwt-secret
        - name: INTERNAL_API_KEY
          valueFrom:
            secretKeyRef:
              name: realtime-secrets
              key: internal-api-key
        - name: REDIS_HOST
          value: "redis-service"
        - name: KAFKA_BROKERS
          value: "kafka-service:9092"
```

---

### Scaling Considerations

**Horizontal Scaling**:
- Redis adapter enables horizontal scaling of WebSocket connections
- Multiple instances can run simultaneously
- Shared state via Redis ensures consistency

**Load Balancing**:
- Use sticky sessions for WebSocket connections
- Configure load balancer to support WebSocket upgrades
- Example (Nginx):
```nginx
upstream realtime_backend {
    ip_hash;  # Sticky sessions
    server realtime-1:3000;
    server realtime-2:3000;
    server realtime-3:3000;
}

server {
    location / {
        proxy_pass http://realtime_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Troubleshooting

### Common Issues

**1. Redis Connection Failed**
```
Error: Redis connection failed: ECONNREFUSED
```
**Solution**:
- Verify Redis is running: `docker ps`
- Check Redis connection settings in environment
- Test Redis connectivity: `redis-cli ping`

---

**2. Kafka Consumer Not Receiving Messages**
```
Warning: No messages received from Kafka
```
**Solution**:
- Verify Kafka broker is running
- Check consumer group ID is correct
- Ensure topics exist: `kafka-topics --list --bootstrap-server localhost:9092`
- Check producer is sending to correct topic

---

**3. WebSocket Clients Not Receiving Broadcasts**
```
Message sent but clients not receiving
```
**Solution**:
- Verify Redis adapter is initialized (check logs)
- Ensure all instances connected to same Redis
- Check room membership with logging
- Verify event names match on client and server

---

**4. Matchmaking Not Finding Matches**
```
Stuck in matchmaking queue
```
**Solution**:
- Check matchmaking worker is running (logs every 5 seconds)
- Verify Redis queue has entries: `redis-cli LRANGE matchmaking:queue:1v1_rapid_quiz 0 -1`
- Ensure at least 2 players in queue
- Check game type matches exactly

---

**5. Authentication Keeps Failing**
```
connect_error: Authentication failed
```
**Solution**:
- Verify JWT secret matches between token issuer and service
- Check token hasn't expired
- Ensure token includes required claims (sub/userId)
- Test token at https://jwt.io

---

### Logging and Debugging

**Enable Debug Logs**:
```bash
LOG_LEVEL=debug pnpm start:dev
```

**Check Service Logs**:
```bash
# Docker
docker logs -f realtime-service

# PM2
pm2 logs realtime-service

# Kubernetes
kubectl logs -f deployment/realtime-service
```

**Redis Debugging**:
```bash
# Connect to Redis CLI
redis-cli

# Check keys
KEYS *

# Check matchmaking queue
LRANGE matchmaking:queue:1v1_rapid_quiz 0 -1

# Check match data
GET match:1697356800000:playerAStatus
```

---

### Performance Monitoring

**Metrics to Monitor**:
- Active WebSocket connections
- Redis memory usage
- Kafka consumer lag
- Message processing rate
- Room counts
- Matchmaking queue length

**Health Check**:
```bash
# Simple check
curl http://localhost:3000/health

# With monitoring system (Prometheus example)
curl http://localhost:3000/metrics
```

---

## Additional Resources

### API Testing Tools

**Postman Collection**: Test HTTP endpoints
```bash
# Health check
GET http://localhost:3000/health

# Internal notify
POST http://localhost:3000/api/realtime/internal/notify
Headers: internal-api-key: your-key
Body: {"userIds": ["user123"], "payload": {...}}
```

**WebSocket Testing**:
- Use browser console with Socket.IO client
- Use tools like Postman WebSocket feature
- Test clients in `test/integration/` directory

---

### Development Scripts

```bash
# Start with watch mode
pnpm start:dev

# Run tests
pnpm test

# Run e2e tests
pnpm test:e2e

# Lint code
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build
```

---

### Architecture Diagrams

**Matchmaking Flow**:
```
┌─────────┐                  ┌──────────────┐
│ Client A│───join queue────▶│MatchmakingService│
└─────────┘                  │    (Redis)   │
                             └──────┬───────┘
┌─────────┐                         │
│ Client B│───join queue────────────┤
└─────────┘                         │
                          ┌─────────▼────────┐
                          │ Matchmaking Worker│
                          │  (Every 5 sec)   │
                          └─────────┬────────┘
                                    │
                          ┌─────────▼────────┐
                          │  Create Match    │
                          │  Store in Redis  │
                          └─────────┬────────┘
                                    │
                          ┌─────────▼────────┐
                          │ RealtimeGateway  │
                          │ notifyMatchFound │
                          └─────────┬────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                │                                       │
          ┌─────▼─────┐                         ┌─────▼─────┐
          │ Client A  │◀───match:found event───│ Client B  │
          │ receives  │                         │ receives  │
          └───────────┘                         └───────────┘
```

---

## Support and Contact

For issues, questions, or contributions:
- **GitHub Issues**: [Repository Issues Page]
- **Documentation**: This guide
- **Code Examples**: See `test/integration/` directory

---

## Changelog

### Version 0.0.1 (Current)
- Initial release
- WebSocket gateway with JWT authentication
- Matchmaking system for 1v1 rapid quiz
- Room management
- Internal notification endpoint
- Kafka integration for external events
- Redis adapter for horizontal scaling
- Health check endpoint

---

## License

UNLICENSED - Private project

---

**Last Updated**: October 15, 2025
