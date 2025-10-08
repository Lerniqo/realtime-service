import { Injectable, Logger } from '@nestjs/common';
import { Socket } from 'socket.io';
import { RedisService } from 'src/redis/redis.service';
import { InMemoryRoomStore } from './rooms.store';
import { PinoLogger } from 'nestjs-pino/PinoLogger';
import { LoggerUtil } from 'src/common/utils/logger.util';

/**
 * RealtimeRoomsService
 *  - Redis-backed room membership (horizontal scaling)
 *  - Fallback in-memory mirror (optional, can be removed)
 *  - Private user room pattern: user:{userId}
 */
@Injectable()
export class RealtimeRoomsService {
  // private readonly logger = new Logger(RealtimeRoomsService.name);
  private readonly memory = new InMemoryRoomStore(); // optional

  constructor(
    private readonly redisService: RedisService,
    private readonly logger: PinoLogger,
  ) {}

  private redisKeyRoom(room: string) {
    return `room:${room}`;
  }
  private redisKeySocket(socketId: string) {
    return `socket:${socketId}:rooms`;
  }

  /**
   * Auto-join pattern for authenticated user
   */
  async ensureUserPrivateRoom(socket: Socket): Promise<void> {
    const userId = socket.data?.user?.userId;
    if (!userId) return;
    await this.joinRoom(socket, `user:${userId}`);
    LoggerUtil.logInfo(
      this.logger,
      'RoomsService',
      `Socket ${socket.id} joined private room user:${userId}`,
    );
  }

  async joinRoom(socket: Socket, roomName: string): Promise<void> {
    const client = this.redisService.getClient();
    const socketId = socket.id;

    // 1. Join Socket.IO internal room (works with redis-adapter)
    socket.join(roomName);

    // 2. Persist in Redis
    await client
      .multi()
      .sadd(this.redisKeyRoom(roomName), socketId)
      .sadd(this.redisKeySocket(socketId), roomName)
      .exec();

    // 3. Mirror (optional)
    this.memory.addSocketToRoom(socketId, roomName);

    LoggerUtil.logInfo(
      this.logger,
      'RoomsService',
      `Socket ${socketId} joined room ${roomName}`,
    );
  }

  async leaveRoom(socket: Socket, roomName: string): Promise<void> {
    const client = this.redisService.getClient();
    const socketId = socket.id;

    socket.leave(roomName);

    await client
      .multi()
      .srem(this.redisKeyRoom(roomName), socketId)
      .srem(this.redisKeySocket(socketId), roomName)
      .exec();

    this.memory.removeSocketFromRoom(socketId, roomName);
    LoggerUtil.logInfo(
      this.logger,
      'RoomsService',
      `Socket ${socketId} left room ${roomName}`,
    );
  }

  /**
   * Remove socket from every room it was in (called on disconnect)
   */
  async removeSocketFromAllRooms(socketId: string): Promise<void> {
    const client = this.redisService.getClient();
    const roomNames = await client.smembers(this.redisKeySocket(socketId));
    if (roomNames.length) {
      const multi = client.multi();
      for (const r of roomNames) {
        multi.srem(this.redisKeyRoom(r), socketId);
      }
      multi.del(this.redisKeySocket(socketId));
      await multi.exec();
    }
    this.memory.removeSocket(socketId);
    LoggerUtil.logInfo(
      this.logger,
      'RoomsService',
      `Cleaned up socket ${socketId}`,
    );
  }

  /**
   * Broadcast a message to a room (all instances via adapter)
   */
  async emitToRoom(
    server: import('socket.io').Server,
    roomName: string,
    event: string,
    payload: any,
  ) {
    server.to(roomName).emit(event, payload);
  }

  /**
   * Get all rooms a socket is currently in
   */
  async getSocketRooms(socketId: string): Promise<string[]> {
    try {
      const client = this.redisService.getClient();
      if (client.status === 'ready') {
        return await client.smembers(this.redisKeySocket(socketId));
      }
      return Array.from(this.memory.getRoomsForSocket(socketId));
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeRoomsService',
        'Failed to get socket rooms',
        error,
      );
      return Array.from(this.memory.getRoomsForSocket(socketId));
    }
  }

  /**
   * Get all sockets in a specific room
   */
  async getRoomSockets(roomName: string): Promise<string[]> {
    try {
      const client = this.redisService.getClient();
      if (client.status === 'ready') {
        return await client.smembers(this.redisKeyRoom(roomName));
      }
      return Array.from(this.memory.getSocketsInRoom(roomName));
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeRoomsService',
        'Failed to get room sockets',
        error,
      );
      return Array.from(this.memory.getSocketsInRoom(roomName));
    }
  }

  /**
   * Get all active rooms
   */
  async getAllRooms(): Promise<string[]> {
    try {
      const client = this.redisService.getClient();
      if (client.status === 'ready') {
        const keys = await client.keys('room:*');
        return keys.map((key) => key.replace('room:', ''));
      }
      return this.memory.getAllRooms();
    } catch (error) {
      LoggerUtil.logError(
        this.logger,
        'RealtimeRoomsService',
        'Failed to get all rooms',
        error,
      );
      return this.memory.getAllRooms();
    }
  }

  /**
   * Check if a user is online (has any active connections)
   */
  async isUserOnline(userId: string): Promise<boolean> {
    const userRoom = `user:${userId}`;
    const sockets = await this.getRoomSockets(userRoom);
    return sockets.length > 0;
  }

  /**
   * Get count of users in a room
   */
  async getRoomUserCount(roomName: string): Promise<number> {
    const sockets = await this.getRoomSockets(roomName);
    return sockets.length;
  }

  /**
   * Find all rooms for a specific user across all their connections
   */
  async getUserRooms(userId: string): Promise<string[]> {
    // Get all sockets for this user from their private room
    const userRoom = `user:${userId}`;
    const userSockets = await this.getRoomSockets(userRoom);

    // Get all rooms for all user's sockets
    const allRooms = new Set<string>();
    for (const socketId of userSockets) {
      const socketRooms = await this.getSocketRooms(socketId);
      socketRooms.forEach((room) => allRooms.add(room));
    }

    return Array.from(allRooms);
  }
}
