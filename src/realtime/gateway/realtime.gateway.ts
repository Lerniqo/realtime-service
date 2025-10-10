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
