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

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  // private readonly logger: Logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private jwtService: JwtService,
    private connectionService: ConnectionService,
    private readonly logger: PinoLogger,
  ) {}

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

  @SubscribeMessage('message')
  handleMessage(client: Socket, payload: any) {
    const userId = client.handshake.auth?.userId || 'anonymous';
    LoggerUtil.logInfo(
      this.logger,
      'RealtimeGateway',
      `Message received from ${userId}: ${JSON.stringify(payload)}`,
    );
    // Your message handling logic here
  }
}
