import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectionService } from './connection.service';
import { LoggerUtil } from 'src/common/utils/logger.util';
import { PinoLogger } from 'nestjs-pino';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { RedisService } from 'src/redis/redis.service';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { MatchmakingService } from '../matchmaking/matchmaking.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server: Server;

  private subClient: Redis;

  constructor(
    private jwtService: JwtService,
    private connectionService: ConnectionService,
    private readonly logger: PinoLogger,
    private readonly roomsService: RealtimeRoomsService,
    private readonly redisService: RedisService,
    private readonly matchmakingService: MatchmakingService,
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

      // For Socket.IO Redis adapter, we don't need to manually connect the duplicate
      // The adapter will handle the connection
      this.server.adapter(createAdapter(pubClient, this.subClient));
      LoggerUtil.logInfo(
        this.logger,
        'RealtimeGateway',
        'Redis adapter initialized successfully',
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

      const payload = this.jwtService.verify(token);

      // To-Do.Have to look at what will be the things that will came with the token
      client.data.user = {
        userId: payload.sub || payload.userId,
        role: payload.role,
        email: payload.email,
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

      const userId = client.handshake.auth?.userId || 'anonymous';
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

  handleDisconnect(client: Socket) {
    this.connectionService.removeConnection(client);
    const userId =
      client.data.user?.userId || client.handshake.auth?.userId || 'unknown';

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

  @SubscribeMessage('match:submitAnswer')
  async onSubmitAnswer(
    client: Socket,
    payload: { answer: string; timer: number },
  ) {
    try {
      const redisClient = this.redisService.getClient();

      // Get all rooms this socket is in
      const socketRooms = await this.roomsService.getSocketRooms(client.id);

      // Find the match room (room that starts with 'match:')
      const matchRoom = socketRooms.find((room) => room.startsWith('match:'));

      if (!matchRoom) {
        LoggerUtil.logError(
          this.logger,
          'RealtimeGateway',
          'No match room found for socket',
          {
            clientId: client.id,
            userId: client.data.user?.userId,
            socketRooms,
          },
        );
        return;
      }

      const matchId = matchRoom;

      // Get player socket IDs from Redis
      const playerASocketId = await redisClient.get(
        `${matchId}:playerASocketId`,
      );
      const playerBSocketId = await redisClient.get(
        `${matchId}:playerBSocketId`,
      );

      let isPlayerA = false;
      let isPlayerB = false;
      let playerKey = '';

      // Check if this socket is player A
      if (playerASocketId === client.id) {
        isPlayerA = true;
        playerKey = 'playerA';
      }
      // Check if this socket is player B
      else if (playerBSocketId === client.id) {
        isPlayerB = true;
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
          },
        );
        return;
      }

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

      // Update timer
      playerStatus.timer = payload.timer;

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
      const activeQuestionIndex = playerStatus.activeQuestionIndex;

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
      const correctAnswer = answers[currentQuestion.id];

      // Check if answer is correct
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
          },
        );
      }

      // Move to next question
      playerStatus.activeQuestionIndex += 1;

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

      // Send match found event to client A with opponent's ID
      try {
        this.server.to(clientAId).emit('match:found', {
          ...matchFoundPayload,
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

      // Send match found event to client B with opponent's ID
      try {
        this.server.to(clientBId).emit('match:found', {
          ...matchFoundPayload,
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
