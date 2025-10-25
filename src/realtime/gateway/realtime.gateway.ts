import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { ConnectionService } from './connection.service';
import { LoggerUtil } from 'src/common/utils/logger.util';
import { PinoLogger } from 'nestjs-pino';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { RedisService } from 'src/redis/redis.service';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { ConfigService } from '@nestjs/config';
import { SecretCodeService } from 'src/auth/secret-code.service';
import { AiServiceClient } from 'src/ai-service/ai-service.client';
import { SendChatMessageDto } from 'src/ai-service/dto/chat-message.dto';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: process.env.SOCKET_CORS_ORIGIN?.split(',') || '*',
    credentials: process.env.SOCKET_CORS_CREDENTIALS === 'true',
    methods: process.env.SOCKET_CORS_METHODS?.split(',') || ['GET', 'POST'],
    allowedHeaders: process.env.SOCKET_CORS_ALLOWED_HEADERS?.split(',') || [
      'Content-Type',
      'Authorization',
    ],
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private subClient: Redis;

  constructor(
    private secretCodeService: SecretCodeService,
    private connectionService: ConnectionService,
    private readonly logger: PinoLogger,
    private readonly roomsService: RealtimeRoomsService,
    private readonly redisService: RedisService,
    private readonly matchmakingService: MatchmakingService,
    private readonly configService: ConfigService,
    private readonly aiServiceClient: AiServiceClient,
  ) {}

  // ...existing code...
  // Add after init hook
  async afterInit() {
    try {
      // Wait for Redis to be ready
      await this.redisService.waitUntilReady();

      const pubClient = this.redisService.getClient();
      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        'Got Redis pub client',
        { status: pubClient.status },
      );

      this.subClient = pubClient.duplicate();
      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        'Created Redis sub client',
        { status: this.subClient.status },
      );

      // Ensure pub/sub clients are connected and add error handlers so failures
      // are visible (helps diagnose "WebSocket closed before the connection is established").
      try {
        // If the clients have a connect() method (ioredis), await it.
        // If they are already connected, connect() will noop or resolve immediately.
        if (typeof (pubClient as any).connect === 'function') {
          await (pubClient as any).connect();
        }
      } catch (err) {
        // Log but continue — adapter may still work depending on client state
        LoggerUtil.logWarn(
          this.logger,
          'RealtimeGateway',
          'pubClient.connect() threw an error (continuing)',
          { error: (err as Error).message },
        );
      }

      try {
        if (typeof (this.subClient as any).connect === 'function') {
          await (this.subClient as any).connect();
        }
      } catch (err) {
        LoggerUtil.logWarn(
          this.logger,
          'RealtimeGateway',
          'subClient.connect() threw an error (continuing)',
          { error: (err as Error).message },
        );
      }

      // Attach basic error/connect logs to both clients to make Redis-level problems visible
      try {
        pubClient.on?.('error', (e: any) =>
          LoggerUtil.logError(
            this.logger,
            'RealtimeGateway',
            'Redis pubClient error',
            e,
          ),
        );
        this.subClient.on?.('error', (e: any) =>
          LoggerUtil.logError(
            this.logger,
            'RealtimeGateway',
            'Redis subClient error',
            e,
          ),
        );

        pubClient.on?.('connect', () =>
          LoggerUtil.logInfo(
            this.logger,
            'RealtimeGateway',
            'Redis pubClient connected',
            {},
          ),
        );
        this.subClient.on?.('connect', () =>
          LoggerUtil.logInfo(
            this.logger,
            'RealtimeGateway',
            'Redis subClient connected',
            {},
          ),
        );
      } catch (err) {
        // Non-fatal logging setup error
        LoggerUtil.logWarn(
          this.logger,
          'RealtimeGateway',
          'Failed to attach Redis event handlers',
          { error: (err as Error).message },
        );
      }

      // Initialize the socket.io Redis adapter
      this.server.adapter(createAdapter(pubClient, this.subClient));
      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        'Redis adapter initialized successfully',
      );

      // Add server-level error logging to diagnose WebSocket handshake/upgrade failures
      this.server.engine.on('connection_error', (err: any) => {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'Socket.IO engine connection error',
          {
            error: err.message,
            context: err.context,
            type: err.type,
            description: err.description,
          },
        );
      });

      this.server.on('connect_error', (err: any) => {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'Socket.IO server connect error',
          { error: err.message },
        );
      });

      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        'Server-level error logging initialized',
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeGateway',
        'Failed to initialize Redis adapter',
        error,
      );
      throw error;
    }
  }
  // ...existing code...

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        LoggerUtil.logWarn(
          this.logger,
          'RealtimeGateway',
          `Connection rejected: No token provided - client id ${client.id}`,
        );
        // Immediately disconnect the client
        setImmediate(() => client.disconnect(true));
        return;
      }

      // Validate session code using SecretCodeService
      const userData = this.secretCodeService.validateSessionCode(token);

      // Set user data from the decoded session code
      client.data.user = {
        userId: userData.userId,
        role: userData.role,
        email: userData.email,
      };

      // Add connection tracking if service exists
      if (this.connectionService) {
        this.connectionService.addConnections(client);
      }

      // Auto-subscribe to private room
      await this.roomsService.ensureUserPrivateRoom(client);

      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        'Client authenticated and connected',
        {
          client_id: client.id,
          user_id: client.data.user.userId,
          total_user_connections: this.connectionService.getUserConnections(
            client.data.user.userId,
          ).length,
        },
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeGateway',
        `Authentication failed for ${client.id}`,
        error,
      );
      // Disconnect the client immediately using setImmediate to avoid framework issues
      setImmediate(() => client.disconnect(true));
    }
  }

  async handleDisconnect(client: Socket) {
    this.connectionService.removeConnection(client);
    const userId =
      client.data.user?.userId || client.handshake.auth?.userId || 'unknown';

    // Remove from matchmaking queues if present
    await this.removeFromAllMatchmakingQueues(client.id, userId).catch(
      () => {},
    );

    // Cleanup room state
    this.roomsService.removeSocketFromAllRooms(client.id).catch(() => {});

    LoggerUtil.logInfo(
      this.logger,
      'RealtimeGateway',
      `Client disconnected: ${client.id}`,
      {
        client_id: client.id,
        user_id: userId,
        total_user_connections:
          this.connectionService.getUserConnections(userId).length,
      },
    );
  }

  /**
   * Remove a client from all matchmaking queues
   */
  private async removeFromAllMatchmakingQueues(
    clientId: string,
    userId: string,
  ) {
    try {
      const redisClient = this.redisService.getClient();
      const queueEntry = JSON.stringify({ clientId, userId });

      // Remove from all game type queues
      const queues = [
        'matchmaking:queue:1v1_rapid_quiz',
        // Add more queue types here as they are added
      ];

      for (const queueKey of queues) {
        await redisClient.lrem(queueKey, 0, queueEntry); // Remove all occurrences
      }

      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        `Removed client from matchmaking queues on disconnect`,
        {
          clientId,
          userId,
        },
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeGateway',
        'Error removing client from matchmaking queues',
        error,
      );
    }
  }

  @SubscribeMessage('joinRoom')
  async onJoinRoom(client: Socket, roomName: string) {
    if (!roomName) return;
    await this.roomsService.joinRoom(client, roomName);
    LoggerUtil.logInfo(
      this.logger,
      'RealtimeGateway',
      `Client ${client.id} joined room ${roomName}`,
    );
  }

  @SubscribeMessage('leaveRoom')
  async onLeaveRoom(client: Socket, roomName: string) {
    if (!roomName) return;
    await this.roomsService.leaveRoom(client, roomName);
    LoggerUtil.logInfo(
      this.logger,
      'RealtimeGateway',
      `Client ${client.id} left room ${roomName}`,
    );
  }

  @SubscribeMessage('broadcastToRoom')
  async onBroadcast(
    client: Socket,
    data: { room: string; event: string; payload: any },
  ) {
    if (!data?.room || !data?.event) return;
    await this.roomsService.emitToRoom(
      this.server,
      data.room,
      data.event,
      data.payload,
    );
  }

  @SubscribeMessage('matchmaking:join')
  async onJoinMatchmakingQueue(
    client: Socket,
    payload: { userId: string; gameType: string },
  ) {
    try {
      await this.matchmakingService.addToMatchingQueue(
        client.id,
        payload.userId,
        payload.gameType,
      );
      LoggerUtil.logInfo(
        this.logger,
        'RealtimeService',
        `Client ${client.id} added to matchmaking queue for ${payload.gameType}`,
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeService',
        `Error adding client ${client.id} to matchmaking queue for ${payload.gameType}: ${error}`,
        { error },
      );
    }
  }

  @SubscribeMessage('matchmaking:leave')
  async onLeaveMatchmakingQueue(client: Socket, payload: { userId: string }) {
    try {
      const userId = payload.userId || client.data.user?.userId;
      if (!userId) {
        LoggerUtil.logWarn(
          this.logger,
          'RealtimeService',
          `Cannot leave matchmaking queue: userId not provided`,
          { clientId: client.id },
        );
        return;
      }

      await this.removeFromAllMatchmakingQueues(client.id, userId);
      LoggerUtil.logInfo(
        this.logger,
        'RealtimeService',
        `Client ${client.id} removed from matchmaking queues`,
        { userId },
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeService',
        `Error removing client ${client.id} from matchmaking queues`,
        { error },
      );
    }
  }

  /**
   * Handle incoming chat messages from authenticated students for AI Tutor
   * @param client - The authenticated WebSocket client
   * @param payload - The chat message payload
   */
  @SubscribeMessage('chat:sendMessage')
  async onChatSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendChatMessageDto,
  ) {
    try {
      // Ensure user is authenticated
      if (!client.data.user?.userId) {
        LoggerUtil.logWarn(
          this.logger,
          'RealtimeGateway',
          'Unauthenticated chat message attempt',
          { clientId: client.id },
        );
        client.emit('chat:error', {
          message: 'Authentication required',
          code: 'AUTH_REQUIRED',
        });
        return;
      }

      const userId = client.data.user.userId;

      // Validate payload
      if (!payload?.message || typeof payload.message !== 'string') {
        LoggerUtil.logWarn(
          this.logger,
          'RealtimeGateway',
          'Invalid chat message payload',
          { clientId: client.id, userId, payload },
        );
        client.emit('chat:error', {
          message: 'Invalid message format',
          code: 'INVALID_PAYLOAD',
        });
        return;
      }

      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        'Received chat message from student',
        {
          clientId: client.id,
          userId,
          messageLength: payload.message.length,
          sessionId: payload.sessionId,
        },
      );

      // Forward the message to AI Service
      try {
        const aiResponse = await this.aiServiceClient.sendChatMessage({
          message: payload.message,
          sessionId: payload.sessionId,
          detailed: payload.detailed || false,
        });

        // Send the AI response back to the specific student
        client.emit('chat:newMessage', {
          message: aiResponse.message,
          sessionId: payload.sessionId,
          metadata: aiResponse.metadata,
          timestamp: new Date().toISOString(),
        });

        LoggerUtil.logInfo(
          this.logger,
          'RealtimeGateway',
          'AI response sent to student',
          {
            clientId: client.id,
            userId,
            sessionId: aiResponse.sessionId,
            responseLength: aiResponse.message?.length || 0,
          },
        );
      } catch (error) {
        // Handle AI Service errors gracefully
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'Error getting response from AI Service',
          {
            error: error.message,
            clientId: client.id,
            userId,
            sessionId: payload.sessionId,
          },
        );

        // Send error notification to the client
        client.emit('chat:error', {
          message: 'Failed to get response from AI tutor. Please try again.',
          code: 'AI_SERVICE_ERROR',
          details: error.message,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeGateway',
        'Unexpected error in chat:sendMessage handler',
        {
          error: error.message,
          clientId: client.id,
          userId: client.data.user?.userId,
        },
      );

      client.emit('chat:error', {
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  @SubscribeMessage('match:submitAnswer')
  async onSubmitAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    payload: {
      matchId?: string;
      questionId?: string | number;
      answer: string;
      timer?: number;
    },
  ) {
    try {
      const redisClient = this.redisService.getClient();

      // Basic payload validation
      if (!payload || typeof payload.answer === 'undefined') {
        LoggerUtil.logWarn(
          this.logger,
          'RealtimeGateway',
          'Invalid payload for match:submitAnswer',
          { clientId: client.id, payload },
        );
        return;
      }

      // Resolve matchId: prefer payload.matchId, otherwise derive from client's rooms
      let matchId: string | null = payload.matchId
        ? String(payload.matchId)
        : null;
      if (matchId && !matchId.startsWith('match:')) {
        matchId = `match:${matchId}`;
      }

      if (!matchId) {
        // Get all rooms this socket is in
        const socketRooms = await this.roomsService.getSocketRooms(client.id);

        // Find the match room (room that starts with 'match:')
        const matchRoom = socketRooms.find((room) =>
          room?.startsWith('match:'),
        );

        if (!matchRoom) {
          LoggerUtil.logError(
            this.logger,
            'RealtimeGateway',
            'No match room found for socket and no matchId provided in payload',
            {
              clientId: client.id,
              userId: client.data.user?.userId,
              socketRooms,
              payload,
            },
          );
          return;
        }

        matchId = matchRoom;
      }

      // Get player socket IDs from Redis
      const playerASocketId = await redisClient.get(
        `${matchId}:playerASocketId`,
      );
      const playerBSocketId = await redisClient.get(
        `${matchId}:playerBSocketId`,
      );

      let playerKey = '';

      // Determine which player this socket corresponds to
      if (playerASocketId === client.id) {
        playerKey = 'playerA';
      } else if (playerBSocketId === client.id) {
        playerKey = 'playerB';
      } else {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'Socket is not a valid player in this match',
          {
            clientId: client.id,
            userId: client.data.user?.userId,
            matchId,
            playerASocketId,
            playerBSocketId,
            socketIdMatches: {
              matchesPlayerA: playerASocketId === client.id,
              matchesPlayerB: playerBSocketId === client.id,
            },
            payload,
          },
        );
        return;
      }

      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        `Identified player for answer submission`,
        {
          clientId: client.id,
          userId: client.data.user?.userId,
          matchId,
          playerKey,
          playerASocketId,
          playerBSocketId,
        },
      );

      // Get current player status from Redis
      const playerStatusJson = await redisClient.get(
        `${matchId}:${playerKey}Status`,
      );
      if (!playerStatusJson) {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'Player status not found in Redis',
          {
            clientId: client.id,
            matchId,
            playerKey,
          },
        );
        return;
      }

      const playerStatus = JSON.parse(playerStatusJson);

      // Update timer if provided
      if (typeof payload.timer === 'number') {
        playerStatus.timer = payload.timer;
      }

      // Get answers from Redis
      const answersJson = await redisClient.get(`${matchId}:answers`);
      if (!answersJson) {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'Match answers not found in Redis',
          {
            clientId: client.id,
            matchId,
          },
        );
        return;
      }

      const answers = JSON.parse(answersJson);
      const activeQuestionIndex = playerStatus.activeQuestionIndex ?? 0;

      // Get questions to find the correct question ID
      const questionsJson = await redisClient.get(`${matchId}:questions`);
      if (!questionsJson) {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'Match questions not found in Redis',
          {
            clientId: client.id,
            matchId,
          },
        );
        return;
      }

      const questions = JSON.parse(questionsJson);
      if (activeQuestionIndex >= questions.length) {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'Active question index out of bounds',
          {
            clientId: client.id,
            matchId,
            activeQuestionIndex,
            questionsLength: questions.length,
          },
        );
        return;
      }

      const currentQuestion = questions[activeQuestionIndex];

      // If payload.questionId provided, validate it against the server's current question
      if (
        typeof payload.questionId !== 'undefined' &&
        String(payload.questionId) !== String(currentQuestion.id)
      ) {
        LoggerUtil.logWarn(
          this.logger,
          'RealtimeGateway',
          'Submitted questionId does not match server active question. Using server active question.',
          {
            clientId: client.id,
            matchId,
            clientQuestionId: payload.questionId,
            serverQuestionId: currentQuestion.id,
            payload,
          },
        );
      }

      const correctAnswer = answers[String(currentQuestion.id)];

      // Check if answer is correct and update score safely
      playerStatus.score =
        typeof playerStatus.score === 'number' ? playerStatus.score : 0;
      if (payload.answer === correctAnswer) {
        playerStatus.score += 1;
        LoggerUtil.logInfo(
          this.logger,
          'RealtimeGateway',
          'Correct answer submitted',
          {
            clientId: client.id,
            matchId,
            playerKey,
            questionIndex: activeQuestionIndex,
            submittedAnswer: payload.answer,
            correctAnswer,
            newScore: playerStatus.score,
            payload,
          },
        );
      } else {
        LoggerUtil.logInfo(
          this.logger,
          'RealtimeGateway',
          'Incorrect answer submitted',
          {
            clientId: client.id,
            matchId,
            playerKey,
            questionIndex: activeQuestionIndex,
            submittedAnswer: payload.answer,
            correctAnswer,
            currentScore: playerStatus.score,
            payload,
          },
        );
      }

      // Move to next question
      playerStatus.activeQuestionIndex = activeQuestionIndex + 1;

      // Store updated player status back to Redis
      await redisClient.set(
        `${matchId}:${playerKey}Status`,
        JSON.stringify(playerStatus),
      );

      // Get both players' statuses for broadcasting
      const playerAStatusJson = await redisClient.get(
        `${matchId}:playerAStatus`,
      );
      const playerBStatusJson = await redisClient.get(
        `${matchId}:playerBStatus`,
      );

      const playerAStatus = playerAStatusJson
        ? JSON.parse(playerAStatusJson)
        : null;
      const playerBStatus = playerBStatusJson
        ? JSON.parse(playerBStatusJson)
        : null;

      // Determine next question
      const nextQuestionIndex = playerStatus.activeQuestionIndex;

      // Broadcast updated game state to all players in the match room
      const gameStatePayload = {
        matchId,
        playerA: {
          score: playerAStatus?.score || 0,
          activeQuestionIndex: playerAStatus?.activeQuestionIndex || 0,
          timer: playerAStatus?.timer || 0,
        },
        playerB: {
          score: playerBStatus?.score || 0,
          activeQuestionIndex: playerBStatus?.activeQuestionIndex || 0,
          timer: playerBStatus?.timer || 0,
        },
        isMatchComplete: nextQuestionIndex >= questions.length,
        totalQuestions: questions.length,
      };

      this.server.to(matchId).emit('match:stateUpdate', gameStatePayload);

      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        `Broadcasted game state update for match ${matchId}`,
        {
          matchId,
          gameStatePayload,
          playersInRoom: [playerASocketId, playerBSocketId],
          payload,
        },
      );

      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        `Updated ${playerKey} status in match ${matchId}`,
        {
          clientId: client.id,
          userId: client.data.user?.userId,
          matchId,
          playerKey,
          updatedStatus: playerStatus,
          timer: payload.timer,
        },
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeGateway',
        'Error processing submitted answer',
        {
          error,
          clientId: client.id,
          userId: client.data.user?.userId,
          payload,
        },
      );
    }
  }

  /**
   * Send a notification to a specific user's private room
   */
  sendNotification(userId: string, payload: any) {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
    LoggerUtil.logInfo(
      this.logger,
      'RealtimeGateway',
      `Sent notification to user ${userId}`,
      { payload },
    );
  }

  /**
   * Send notifications to multiple users
   */
  sendNotificationToUsers(userIds: string[], payload: any) {
    userIds.forEach((userId) => {
      this.sendNotification(userId, payload);
    });
  }

  /**
   * Notify both players that a match has been found
   */
  notifyMatchFound(
    matchId: string,
    clientAId: string,
    clientBId: string,
    userAId: string,
    userBId: string,
    questions: Array<{ id: number; question: string; options: string[] }>,
  ) {
    try {
      // Validate input parameters
      if (
        !matchId ||
        !clientAId ||
        !clientBId ||
        !userAId ||
        !userBId ||
        !questions
      ) {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'Invalid parameters for notifyMatchFound',
          {
            matchId,
            clientAId,
            clientBId,
            userAId,
            userBId,
            questionsCount: questions?.length || 0,
          },
        );
        return;
      }

      // Ensure the server is available
      if (!this.server) {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'WebSocket server is not available',
          { matchId, clientAId, clientBId },
        );
        return;
      }

      const matchFoundPayload = {
        matchId,
        questions: questions,
      };

      // Send match found event to client A with opponent's ID and player role
      try {
        this.server.to(clientAId).emit('match:found', {
          ...matchFoundPayload,
          playerRole: 'playerA',
          yourUserId: userAId,
          opponentClientId: clientBId,
          opponentUserId: userBId,
        });
        LoggerUtil.logInfo(
          this.logger,
          'RealtimeGateway',
          `Match found notification sent to client A`,
          {
            matchId,
            clientId: clientAId,
            userId: userAId,
            playerRole: 'playerA',
            opponentClientId: clientBId,
            opponentUserId: userBId,
            questionsCount: questions.length,
          },
        );
      } catch (error) {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          `Failed to send match found notification to client A`,
          { error, matchId, clientId: clientAId },
        );
      }

      // Send match found event to client B with opponent's ID and player role
      try {
        this.server.to(clientBId).emit('match:found', {
          ...matchFoundPayload,
          playerRole: 'playerB',
          yourUserId: userBId,
          opponentClientId: clientAId,
          opponentUserId: userAId,
        });
        LoggerUtil.logInfo(
          this.logger,
          'RealtimeGateway',
          `Match found notification sent to client B`,
          {
            matchId,
            clientId: clientBId,
            userId: userBId,
            playerRole: 'playerB',
            opponentClientId: clientAId,
            opponentUserId: userAId,
            questionsCount: questions.length,
          },
        );
      } catch (error) {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          `Failed to send match found notification to client B`,
          { error, matchId, clientId: clientBId },
        );
      }

      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        `Match found notification process completed`,
        {
          matchId,
          clientAId,
          clientBId,
          userAId,
          userBId,
          questionsCount: questions.length,
        },
      );
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeGateway',
        'Unexpected error in notifyMatchFound',
        {
          error,
          matchId,
          clientAId,
          clientBId,
          userAId,
          userBId,
          questionsCount: questions?.length || 0,
        },
      );
    }
  }
}
