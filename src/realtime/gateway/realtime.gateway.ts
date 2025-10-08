import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
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

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
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
  }

  @SubscribeMessage('leaveRoom')
  async onLeaveRoom(client: Socket, roomName: string) {
    if (!roomName) return;
    await this.roomsService.leaveRoom(client, roomName);
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
}
