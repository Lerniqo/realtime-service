import { Injectable } from '@nestjs/common';
import { Socket } from 'socket.io';

interface UserConnection {
  userId: string;
  socketId: string;
  connectedAt: Date;
  role: string;
}

@Injectable()
export class ConnectionService {
  private connections = new Map<string, UserConnection[]>();

  addConnections(socket: Socket) {
    const user = socket.data.user;
    if (!user) return;

    const userConnections = this.connections.get(user.userId) || [];
    userConnections.push({
      userId: user.userId,
      socketId: socket.id,
      connectedAt: new Date(),
      role: user.role,
    });
    this.connections.set(user.userId, userConnections);
  }

  removeConnection(socket: Socket) {
    const user = socket.data.user;
    if (!user) return;
    const userConnections = this.connections.get(user.userId) || [];
    const updatedConnections = userConnections.filter(
      (conn) => conn.socketId !== socket.id,
    );
    if (updatedConnections.length > 0) {
      this.connections.set(user.userId, updatedConnections);
    } else {
      this.connections.delete(user.userId);
    }
  }
  getUserConnections(userId: string): UserConnection[] {
    return this.connections.get(userId) || [];
  }
  getAllConnections(): Map<string, UserConnection[]> {
    return this.connections;
  }
}
