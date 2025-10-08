import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeRoomsService } from './rooms.service';
import { RedisService } from 'src/redis/redis.service';
import { PinoLogger } from 'nestjs-pino';
import { Socket } from 'socket.io';

describe('RealtimeRoomsService', () => {
  let service: RealtimeRoomsService;
  let mockRedisService: any;
  let mockSocket: Partial<Socket>;

  beforeEach(async () => {
    mockRedisService = {
      getClient: jest.fn().mockReturnValue({
        multi: jest.fn().mockReturnValue({
          sadd: jest.fn().mockReturnThis(),
          srem: jest.fn().mockReturnThis(),
          del: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([]),
        }),
        smembers: jest.fn().mockResolvedValue([]),
      }),
    };

    mockSocket = {
      id: 'test-socket-id',
      join: jest.fn(),
      leave: jest.fn(),
      data: {
        user: {
          userId: 'test-user-123',
          role: 'user',
          email: 'test@example.com',
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeRoomsService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: PinoLogger,
          useValue: {
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            setContext: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RealtimeRoomsService>(RealtimeRoomsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should auto-join user to private room', async () => {
    await service.ensureUserPrivateRoom(mockSocket as Socket);

    expect(mockSocket.join).toHaveBeenCalledWith('user:test-user-123');
  });

  it('should join socket to specified room', async () => {
    await service.joinRoom(mockSocket as Socket, 'test-room');

    expect(mockSocket.join).toHaveBeenCalledWith('test-room');
  });

  it('should leave socket from specified room', async () => {
    await service.leaveRoom(mockSocket as Socket, 'test-room');

    expect(mockSocket.leave).toHaveBeenCalledWith('test-room');
  });

  it('should remove socket from all rooms on disconnect', async () => {
    // Setup: socket is in multiple rooms
    mockRedisService.getClient.mockReturnValue({
      smembers: jest
        .fn()
        .mockResolvedValue(['room1', 'room2', 'user:test-user-123']),
      multi: jest.fn().mockReturnValue({
        srem: jest.fn().mockReturnThis(),
        del: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    });

    await service.removeSocketFromAllRooms('test-socket-id');

    const mockClient = mockRedisService.getClient();
    expect(mockClient.smembers).toHaveBeenCalledWith(
      'socket:test-socket-id:rooms',
    );
    expect(mockClient.multi().del).toHaveBeenCalledWith(
      'socket:test-socket-id:rooms',
    );
  });

  it('should emit message to room', async () => {
    const mockServer = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as any;

    await service.emitToRoom(mockServer, 'test-room', 'test-event', {
      message: 'hello',
    });

    expect(mockServer.to).toHaveBeenCalledWith('test-room');
    expect(mockServer.to().emit).toHaveBeenCalledWith('test-event', {
      message: 'hello',
    });
  });

  it('should get all rooms for a socket', async () => {
    mockRedisService.getClient.mockReturnValue({
      status: 'ready',
      smembers: jest
        .fn()
        .mockResolvedValue(['room1', 'room2', 'user:test-user-123']),
    });

    const result = await service.getSocketRooms('test-socket-id');

    expect(result).toEqual(['room1', 'room2', 'user:test-user-123']);
    expect(mockRedisService.getClient().smembers).toHaveBeenCalledWith(
      'socket:test-socket-id:rooms',
    );
  });

  it('should get all sockets in a room', async () => {
    mockRedisService.getClient.mockReturnValue({
      status: 'ready',
      smembers: jest.fn().mockResolvedValue(['socket1', 'socket2', 'socket3']),
    });

    const result = await service.getRoomSockets('test-room');

    expect(result).toEqual(['socket1', 'socket2', 'socket3']);
    expect(mockRedisService.getClient().smembers).toHaveBeenCalledWith(
      'room:test-room',
    );
  });

  it('should get all active rooms', async () => {
    mockRedisService.getClient.mockReturnValue({
      status: 'ready',
      keys: jest
        .fn()
        .mockResolvedValue(['room:lobby', 'room:match:123', 'room:user:456']),
    });

    const result = await service.getAllRooms();

    expect(result).toEqual(['lobby', 'match:123', 'user:456']);
    expect(mockRedisService.getClient().keys).toHaveBeenCalledWith('room:*');
  });

  it('should check if user is online', async () => {
    // Mock user has active connections
    mockRedisService.getClient.mockReturnValue({
      status: 'ready',
      smembers: jest.fn().mockResolvedValue(['socket1', 'socket2']),
    });

    const result = await service.isUserOnline('test-user-123');

    expect(result).toBe(true);
    expect(mockRedisService.getClient().smembers).toHaveBeenCalledWith(
      'room:user:test-user-123',
    );
  });

  it('should return false when user is offline', async () => {
    // Mock user has no active connections
    mockRedisService.getClient.mockReturnValue({
      status: 'ready',
      smembers: jest.fn().mockResolvedValue([]),
    });

    const result = await service.isUserOnline('offline-user');

    expect(result).toBe(false);
  });

  it('should get room user count', async () => {
    mockRedisService.getClient.mockReturnValue({
      status: 'ready',
      smembers: jest.fn().mockResolvedValue(['socket1', 'socket2', 'socket3']),
    });

    const result = await service.getRoomUserCount('busy-room');

    expect(result).toBe(3);
  });

  it('should get all rooms for a user across multiple connections', async () => {
    const mockClient = {
      status: 'ready',
      smembers: jest
        .fn()
        .mockResolvedValueOnce(['socket1', 'socket2']) // user's sockets
        .mockResolvedValueOnce(['user:test-user-123', 'match:456']) // socket1 rooms
        .mockResolvedValueOnce(['user:test-user-123', 'lobby', 'tutoring:789']), // socket2 rooms
    };
    mockRedisService.getClient.mockReturnValue(mockClient);

    const result = await service.getUserRooms('test-user-123');

    expect(result).toEqual([
      'user:test-user-123',
      'match:456',
      'lobby',
      'tutoring:789',
    ]);
    expect(mockClient.smembers).toHaveBeenCalledWith('room:user:test-user-123');
    expect(mockClient.smembers).toHaveBeenCalledWith('socket:socket1:rooms');
    expect(mockClient.smembers).toHaveBeenCalledWith('socket:socket2:rooms');
  });

  // Error handling and edge cases
  describe('Error Handling', () => {
    it('should fallback to in-memory store when Redis is not ready', async () => {
      mockRedisService.getClient.mockReturnValue({
        status: 'connecting', // Not ready
        smembers: jest.fn(),
      });

      const result = await service.getSocketRooms('test-socket-id');

      expect(result).toEqual([]); // Empty set from in-memory store
    });

    it('should handle Redis errors gracefully in getSocketRooms', async () => {
      mockRedisService.getClient.mockReturnValue({
        status: 'ready',
        smembers: jest
          .fn()
          .mockRejectedValue(new Error('Redis connection lost')),
      });

      const result = await service.getSocketRooms('test-socket-id');

      expect(result).toEqual([]); // Falls back to in-memory store
    });

    it('should handle Redis errors gracefully in getRoomSockets', async () => {
      mockRedisService.getClient.mockReturnValue({
        status: 'ready',
        smembers: jest.fn().mockRejectedValue(new Error('Redis timeout')),
      });

      const result = await service.getRoomSockets('test-room');

      expect(result).toEqual([]); // Falls back to in-memory store
    });

    it('should handle Redis errors gracefully in getAllRooms', async () => {
      mockRedisService.getClient.mockReturnValue({
        status: 'ready',
        keys: jest.fn().mockRejectedValue(new Error('Redis error')),
      });

      const result = await service.getAllRooms();

      expect(result).toEqual([]); // Falls back to in-memory store
    });

    it('should handle socket without user data in ensureUserPrivateRoom', async () => {
      const socketWithoutUser = {
        id: 'test-socket-id',
        join: jest.fn(),
        data: {}, // No user data
      };

      await service.ensureUserPrivateRoom(socketWithoutUser as any);

      expect(socketWithoutUser.join).not.toHaveBeenCalled();
    });

    it('should handle empty room name gracefully', async () => {
      await service.joinRoom(mockSocket as Socket, '');

      expect(mockSocket.join).toHaveBeenCalledWith('');
    });

    it('should handle removeSocketFromAllRooms with no rooms', async () => {
      mockRedisService.getClient.mockReturnValue({
        smembers: jest.fn().mockResolvedValue([]), // No rooms
        multi: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      await expect(
        service.removeSocketFromAllRooms('empty-socket'),
      ).resolves.not.toThrow();
    });
  });

  // Integration-like tests
  describe('Integration Scenarios', () => {
    it('should handle multiple users in same room', async () => {
      mockRedisService.getClient.mockReturnValue({
        status: 'ready',
        smembers: jest
          .fn()
          .mockResolvedValue(['socket1', 'socket2', 'socket3']),
      });

      const count = await service.getRoomUserCount('popular-room');
      expect(count).toBe(3);

      const isOnline1 = await service.isUserOnline('user1');
      expect(isOnline1).toBe(true);
    });

    it('should handle user with multiple connections', async () => {
      const mockClient = {
        status: 'ready',
        smembers: jest
          .fn()
          .mockResolvedValueOnce(['socket1', 'socket2', 'socket3']) // Multiple connections
          .mockResolvedValueOnce(['user:multi-user', 'room1'])
          .mockResolvedValueOnce(['user:multi-user', 'room2'])
          .mockResolvedValueOnce(['user:multi-user', 'room3']),
      };
      mockRedisService.getClient.mockReturnValue(mockClient);

      const rooms = await service.getUserRooms('multi-user');
      expect(rooms).toContain('user:multi-user');
      expect(rooms).toContain('room1');
      expect(rooms).toContain('room2');
      expect(rooms).toContain('room3');
    });

    it('should handle room cleanup on user disconnect', async () => {
      // Setup: user was in multiple rooms
      mockRedisService.getClient.mockReturnValue({
        smembers: jest
          .fn()
          .mockResolvedValue(['user:test-user', 'match:123', 'lobby']),
        multi: jest.fn().mockReturnValue({
          srem: jest.fn().mockReturnThis(),
          del: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([]),
        }),
      });

      await service.removeSocketFromAllRooms('disconnected-socket');

      const mockClient = mockRedisService.getClient();
      const multi = mockClient.multi();
      expect(multi.srem).toHaveBeenCalledWith(
        'room:user:test-user',
        'disconnected-socket',
      );
      expect(multi.srem).toHaveBeenCalledWith(
        'room:match:123',
        'disconnected-socket',
      );
      expect(multi.srem).toHaveBeenCalledWith(
        'room:lobby',
        'disconnected-socket',
      );
      expect(multi.del).toHaveBeenCalledWith(
        'socket:disconnected-socket:rooms',
      );
    });

    it('should handle concurrent join/leave operations', async () => {
      const promises = [
        service.joinRoom(mockSocket as Socket, 'room1'),
        service.joinRoom(mockSocket as Socket, 'room2'),
        service.leaveRoom(mockSocket as Socket, 'room1'),
      ];

      await expect(Promise.all(promises)).resolves.not.toThrow();
    });

    it('should handle special characters in room names', async () => {
      const specialRoomName = 'room:with:colons-and-dashes_and_underscores!@#';

      await service.joinRoom(mockSocket as Socket, specialRoomName);

      expect(mockSocket.join).toHaveBeenCalledWith(specialRoomName);
    });
  });

  // Performance and limits tests
  describe('Performance & Limits', () => {
    it('should handle large number of rooms for a socket', async () => {
      const manyRooms = Array.from({ length: 100 }, (_, i) => `room${i}`);
      mockRedisService.getClient.mockReturnValue({
        status: 'ready',
        smembers: jest.fn().mockResolvedValue(manyRooms),
      });

      const result = await service.getSocketRooms('busy-socket');

      expect(result).toHaveLength(100);
      expect(result).toEqual(manyRooms);
    });

    it('should handle large number of sockets in a room', async () => {
      const manySockets = Array.from({ length: 1000 }, (_, i) => `socket${i}`);
      mockRedisService.getClient.mockReturnValue({
        status: 'ready',
        smembers: jest.fn().mockResolvedValue(manySockets),
      });

      const count = await service.getRoomUserCount('massive-room');

      expect(count).toBe(1000);
    });
  });
});
