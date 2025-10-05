import {
  WebSocketGateway,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { Logger, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConnectionService } from './connection.service';

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger: Logger = new Logger(RealtimeGateway.name);

  constructor(
    private jwtService: JwtService,
    private connectionService: ConnectionService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(
          `Connection rejected: No token provided - ${client.id}`,
        );
        client.disconnect(true);
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

      this.logger.log({
        message: 'Client authenticated and connected',
        service_name: 'realtime-service',
        client_id: client.id,
        user_id: client.data.user.userId,
        total_user_connections: this.connectionService.getUserConnections(
          client.data.user.userId,
        ).length,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(
        `Authentication failed for ${client.id}: ${error.message}`,
      );
      client.emit('connect_error', { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    this.connectionService.removeConnection(client);
    const userId = client.data.user?.userId || 'unknown';
    this.logger.log({
      message: 'Client disconnected',
      service_name: 'realtime-service',
      client_id: client.id,
      user_id: userId,
      timestamp: new Date().toISOString(),
    });
  }
}
