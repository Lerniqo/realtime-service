import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { RealtimeGateway } from './realtime.gateway';
import { ConnectionService } from './connection.service';
import { PinoLogger } from 'nestjs-pino';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { RedisService } from '../../redis/redis.service';
import { MatchmakingService } from '../matchmaking/matchmaking.service';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let jwtService: JwtService;
  let roomsService: RealtimeRoomsService;
  let connectionService: ConnectionService;
  let matchmakingService: MatchmakingService;

  const mockSocket = {
    id: 'test-socket-id',
    handshake: {
      auth: { token: 'test-token' },
      headers: {},
    },
    data: { user: undefined } as any,
    disconnect: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: ConnectionService,
          useValue: {
            addConnections: jest.fn(),
            removeConnection: jest.fn(),
            getUserConnections: jest.fn().mockReturnValue([]),
          },
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
        {
          provide: RealtimeRoomsService,
          useValue: {
            ensureUserPrivateRoom: jest.fn().mockResolvedValue(undefined),
            joinRoom: jest.fn().mockResolvedValue(undefined),
            leaveRoom: jest.fn().mockResolvedValue(undefined),
            removeSocketFromAllRooms: jest.fn().mockResolvedValue(undefined),
            emitToRoom: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RedisService,
          useValue: {
            getClient: jest.fn().mockReturnValue({
              status: 'ready',
              duplicate: jest.fn().mockReturnValue({
                status: 'ready',
                psubscribe: jest.fn(),
                subscribe: jest.fn(),
                on: jest.fn(),
                removeAllListeners: jest.fn(),
              }),
              psubscribe: jest.fn(),
              subscribe: jest.fn(),
              on: jest.fn(),
              removeAllListeners: jest.fn(),
            }),
            waitUntilReady: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: MatchmakingService,
          useValue: {
            addToMatchingQueue: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    jwtService = module.get<JwtService>(JwtService);
    roomsService = module.get<RealtimeRoomsService>(RealtimeRoomsService);
    connectionService = module.get<ConnectionService>(ConnectionService);
    matchmakingService = module.get<MatchmakingService>(MatchmakingService);

    // Mock the server property
    gateway.server = {
      adapter: jest.fn(),
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as any;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should handle valid JWT token on connection', async () => {
    const mockPayload = {
      sub: 'user123',
      role: 'user',
      email: 'test@example.com',
    };

    jest.spyOn(jwtService, 'verify').mockReturnValue(mockPayload);

    await gateway.handleConnection(mockSocket as any);

    expect(jwtService.verify).toHaveBeenCalledWith('test-token');
    expect(mockSocket.data.user).toEqual({
      userId: 'user123',
      role: 'user',
      email: 'test@example.com',
    });
    expect(connectionService.addConnections).toHaveBeenCalledWith(mockSocket);
    expect(roomsService.ensureUserPrivateRoom).toHaveBeenCalledWith(mockSocket);
  });

  it('should reject connection without token', async () => {
    const socketWithoutToken = {
      ...mockSocket,
      handshake: {
        auth: {},
        headers: {},
      },
      disconnect: jest.fn(),
    };

    await gateway.handleConnection(socketWithoutToken as any);

    // Wait for setImmediate to execute
    await new Promise((resolve) => setImmediate(resolve));

    expect(socketWithoutToken.disconnect).toHaveBeenCalledWith(true);
  });

  it('should reject connection with invalid token', async () => {
    jest.spyOn(jwtService, 'verify').mockImplementation(() => {
      throw new Error('Invalid token');
    });

    await gateway.handleConnection(mockSocket as any);

    // Wait for setImmediate to execute
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
  });

  it('should handle disconnect properly', () => {
    mockSocket.data.user = { userId: 'user123' };

    gateway.handleDisconnect(mockSocket as any);

    expect(connectionService.removeConnection).toHaveBeenCalledWith(mockSocket);
    expect(roomsService.removeSocketFromAllRooms).toHaveBeenCalledWith(
      'test-socket-id',
    );
  });

  it('should join room on message', async () => {
    await gateway.onJoinRoom(mockSocket as any, 'test-room');

    expect(roomsService.joinRoom).toHaveBeenCalledWith(mockSocket, 'test-room');
  });

  it('should leave room on message', async () => {
    await gateway.onLeaveRoom(mockSocket as any, 'test-room');

    expect(roomsService.leaveRoom).toHaveBeenCalledWith(
      mockSocket,
      'test-room',
    );
  });

  it('should broadcast to room', async () => {
    const broadcastData = {
      room: 'test-room',
      event: 'test-event',
      payload: { message: 'hello' },
    };

    await gateway.onBroadcast(mockSocket as any, broadcastData);

    expect(roomsService.emitToRoom).toHaveBeenCalledWith(
      gateway.server,
      'test-room',
      'test-event',
      { message: 'hello' },
    );
  });

  it('should ignore empty room name in join', async () => {
    await gateway.onJoinRoom(mockSocket as any, '');

    expect(roomsService.joinRoom).not.toHaveBeenCalled();
  });

  it('should ignore empty room name in leave', async () => {
    await gateway.onLeaveRoom(mockSocket as any, '');

    expect(roomsService.leaveRoom).not.toHaveBeenCalled();
  });

  it('should ignore invalid broadcast data', async () => {
    await gateway.onBroadcast(mockSocket as any, {
      room: '',
      event: 'test',
      payload: null,
    });

    expect(roomsService.emitToRoom).not.toHaveBeenCalled();
  });

  describe('sendNotification', () => {
    it('should send notification to specific user', () => {
      const userId = 'user123';
      const payload = { message: 'Test notification', type: 'info' };
      const mockEmit = jest.fn();

      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      gateway.sendNotification(userId, payload);

      expect(gateway.server.to).toHaveBeenCalledWith('user:user123');
      expect(mockEmit).toHaveBeenCalledWith('notification:new', payload);
    });

    it('should handle notification with different payload types', () => {
      const userId = 'user456';
      const payload = { id: 1, title: 'New Message', data: { count: 5 } };
      const mockEmit = jest.fn();

      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      gateway.sendNotification(userId, payload);

      expect(gateway.server.to).toHaveBeenCalledWith('user:user456');
      expect(mockEmit).toHaveBeenCalledWith('notification:new', payload);
    });
  });

  describe('sendNotificationToUsers', () => {
    it('should send notification to multiple users', () => {
      const userIds = ['user1', 'user2', 'user3'];
      const payload = { message: 'Broadcast notification' };
      const mockEmit = jest.fn();

      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      // Spy on sendNotification to verify it's called for each user
      const sendNotificationSpy = jest.spyOn(gateway, 'sendNotification');

      gateway.sendNotificationToUsers(userIds, payload);

      expect(sendNotificationSpy).toHaveBeenCalledTimes(3);
      expect(sendNotificationSpy).toHaveBeenNthCalledWith(1, 'user1', payload);
      expect(sendNotificationSpy).toHaveBeenNthCalledWith(2, 'user2', payload);
      expect(sendNotificationSpy).toHaveBeenNthCalledWith(3, 'user3', payload);
    });

    it('should handle empty user list', () => {
      const userIds: string[] = [];
      const payload = { message: 'No recipients' };

      // Spy on sendNotification to verify it's not called
      const sendNotificationSpy = jest.spyOn(gateway, 'sendNotification');

      gateway.sendNotificationToUsers(userIds, payload);

      expect(sendNotificationSpy).not.toHaveBeenCalled();
    });

    it('should handle single user in array', () => {
      const userIds = ['user-single'];
      const payload = { message: 'Single user notification' };
      const mockEmit = jest.fn();

      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      // Spy on sendNotification
      const sendNotificationSpy = jest.spyOn(gateway, 'sendNotification');

      gateway.sendNotificationToUsers(userIds, payload);

      expect(sendNotificationSpy).toHaveBeenCalledTimes(1);
      expect(sendNotificationSpy).toHaveBeenCalledWith('user-single', payload);
    });
  });

  describe('onJoinMatchmakingQueue', () => {
    const mockSocket1 = {
      id: 'socket-1',
      handshake: { auth: { token: 'token1' } },
      data: { user: { userId: 'user1' } },
    };

    const mockSocket2 = {
      id: 'socket-2',
      handshake: { auth: { token: 'token2' } },
      data: { user: { userId: 'user2' } },
    };

    it('should successfully add user to matchmaking queue with correct game type', async () => {
      const payload = { gameType: '1v1_rapid_quiz' };

      jest.spyOn(matchmakingService, 'addToMatchingQueue').mockResolvedValue();

      await gateway.onJoinMatchmakingQueue(mockSocket1 as any, payload);

      expect(matchmakingService.addToMatchingQueue).toHaveBeenCalledWith(
        'socket-1',
        '1v1_rapid_quiz',
      );
    });

    it('should handle error when user tries to join with incorrect game type', async () => {
      const payload = { gameType: 'invalid_game_type' };

      jest
        .spyOn(matchmakingService, 'addToMatchingQueue')
        .mockRejectedValue(new Error('Unsupported game type'));

      // Spy on console methods to avoid actual console output during tests
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await gateway.onJoinMatchmakingQueue(mockSocket1 as any, payload);

      expect(matchmakingService.addToMatchingQueue).toHaveBeenCalledWith(
        'socket-1',
        'invalid_game_type',
      );

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it('should handle multiple users trying to join matchmaking queue', async () => {
      const payload = { gameType: '1v1_rapid_quiz' };

      jest.spyOn(matchmakingService, 'addToMatchingQueue').mockResolvedValue();

      // First user joins queue
      await gateway.onJoinMatchmakingQueue(mockSocket1 as any, payload);

      // Second user joins queue
      await gateway.onJoinMatchmakingQueue(mockSocket2 as any, payload);

      expect(matchmakingService.addToMatchingQueue).toHaveBeenCalledTimes(2);
      expect(matchmakingService.addToMatchingQueue).toHaveBeenNthCalledWith(
        1,
        'socket-1',
        '1v1_rapid_quiz',
      );
      expect(matchmakingService.addToMatchingQueue).toHaveBeenNthCalledWith(
        2,
        'socket-2',
        '1v1_rapid_quiz',
      );
    });

    it('should handle mixed scenario - one user with correct type, one with incorrect type', async () => {
      const correctPayload = { gameType: '1v1_rapid_quiz' };
      const incorrectPayload = { gameType: 'invalid_type' };

      jest
        .spyOn(matchmakingService, 'addToMatchingQueue')
        .mockImplementation((clientId, gameType) => {
          if (gameType === '1v1_rapid_quiz') {
            return Promise.resolve();
          } else {
            return Promise.reject(new Error('Unsupported game type'));
          }
        });

      // Spy on console methods to avoid actual console output during tests
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // First user with correct game type
      await gateway.onJoinMatchmakingQueue(mockSocket1 as any, correctPayload);

      // Second user with incorrect game type
      await gateway.onJoinMatchmakingQueue(
        mockSocket2 as any,
        incorrectPayload,
      );

      expect(matchmakingService.addToMatchingQueue).toHaveBeenCalledTimes(2);
      expect(matchmakingService.addToMatchingQueue).toHaveBeenNthCalledWith(
        1,
        'socket-1',
        '1v1_rapid_quiz',
      );
      expect(matchmakingService.addToMatchingQueue).toHaveBeenNthCalledWith(
        2,
        'socket-2',
        'invalid_type',
      );

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });

  describe('notifyMatchFound', () => {
    const matchId = 'match:123456-abc789';
    const clientAId = 'socket-client-a';
    const clientBId = 'socket-client-b';

    beforeEach(() => {
      // Reset server mock
      gateway.server = {
        to: jest.fn().mockReturnValue({
          emit: jest.fn(),
        }),
      } as any;
    });

    it('should successfully notify both players when match is found', () => {
      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      gateway.notifyMatchFound(matchId, clientAId, clientBId);

      // Verify that server.to was called for both clients
      expect(gateway.server.to).toHaveBeenCalledTimes(2);
      expect(gateway.server.to).toHaveBeenNthCalledWith(1, clientAId);
      expect(gateway.server.to).toHaveBeenNthCalledWith(2, clientBId);

      // Verify emit was called with correct data for both clients
      expect(mockEmit).toHaveBeenCalledTimes(2);
      expect(mockEmit).toHaveBeenNthCalledWith(1, 'match:found', {
        matchId,
        opponentClientId: clientBId,
      });
      expect(mockEmit).toHaveBeenNthCalledWith(2, 'match:found', {
        matchId,
        opponentClientId: clientAId,
      });
    });

    it('should handle missing matchId parameter', () => {
      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      gateway.notifyMatchFound('', clientAId, clientBId);

      // Should not attempt to send notifications with invalid parameters
      expect(gateway.server.to).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should handle missing clientAId parameter', () => {
      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      gateway.notifyMatchFound(matchId, '', clientBId);

      // Should not attempt to send notifications with invalid parameters
      expect(gateway.server.to).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should handle missing clientBId parameter', () => {
      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      gateway.notifyMatchFound(matchId, clientAId, '');

      // Should not attempt to send notifications with invalid parameters
      expect(gateway.server.to).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should handle null/undefined parameters gracefully', () => {
      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      // Test with null values
      gateway.notifyMatchFound(null as any, clientAId, clientBId);
      gateway.notifyMatchFound(matchId, null as any, clientBId);
      gateway.notifyMatchFound(matchId, clientAId, null as any);

      // Test with undefined values
      gateway.notifyMatchFound(undefined as any, clientAId, clientBId);
      gateway.notifyMatchFound(matchId, undefined as any, clientBId);
      gateway.notifyMatchFound(matchId, clientAId, undefined as any);

      // Should not attempt to send notifications with invalid parameters
      expect(gateway.server.to).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should handle server unavailable scenario', () => {
      // Set server to null to simulate unavailable server
      gateway.server = null as any;

      // Should not throw error when server is unavailable
      expect(() => {
        gateway.notifyMatchFound(matchId, clientAId, clientBId);
      }).not.toThrow();
    });

    it('should handle server undefined scenario', () => {
      // Set server to undefined
      gateway.server = undefined as any;

      // Should not throw error when server is undefined
      expect(() => {
        gateway.notifyMatchFound(matchId, clientAId, clientBId);
      }).not.toThrow();
    });

    it('should handle error when emitting to client A but continue with client B', () => {
      const mockEmitA = jest.fn().mockImplementation(() => {
        throw new Error('Failed to emit to client A');
      });
      const mockEmitB = jest.fn();

      gateway.server.to = jest.fn().mockImplementation((clientId) => {
        if (clientId === clientAId) {
          return { emit: mockEmitA };
        } else if (clientId === clientBId) {
          return { emit: mockEmitB };
        }
      });

      // Should not throw error even if one client emission fails
      expect(() => {
        gateway.notifyMatchFound(matchId, clientAId, clientBId);
      }).not.toThrow();

      // Verify both clients were attempted
      expect(gateway.server.to).toHaveBeenCalledTimes(2);
      expect(gateway.server.to).toHaveBeenNthCalledWith(1, clientAId);
      expect(gateway.server.to).toHaveBeenNthCalledWith(2, clientBId);

      // Verify client A emission was attempted and failed
      expect(mockEmitA).toHaveBeenCalledWith('match:found', {
        matchId,
        opponentClientId: clientBId,
      });

      // Verify client B emission succeeded
      expect(mockEmitB).toHaveBeenCalledWith('match:found', {
        matchId,
        opponentClientId: clientAId,
      });
    });

    it('should handle error when emitting to client B but continue normally', () => {
      const mockEmitA = jest.fn();
      const mockEmitB = jest.fn().mockImplementation(() => {
        throw new Error('Failed to emit to client B');
      });

      gateway.server.to = jest.fn().mockImplementation((clientId) => {
        if (clientId === clientAId) {
          return { emit: mockEmitA };
        } else if (clientId === clientBId) {
          return { emit: mockEmitB };
        }
      });

      // Should not throw error even if one client emission fails
      expect(() => {
        gateway.notifyMatchFound(matchId, clientAId, clientBId);
      }).not.toThrow();

      // Verify both clients were attempted
      expect(gateway.server.to).toHaveBeenCalledTimes(2);

      // Verify client A emission succeeded
      expect(mockEmitA).toHaveBeenCalledWith('match:found', {
        matchId,
        opponentClientId: clientBId,
      });

      // Verify client B emission was attempted and failed
      expect(mockEmitB).toHaveBeenCalledWith('match:found', {
        matchId,
        opponentClientId: clientAId,
      });
    });

    it('should handle errors when emitting to both clients', () => {
      const mockEmitA = jest.fn().mockImplementation(() => {
        throw new Error('Failed to emit to client A');
      });
      const mockEmitB = jest.fn().mockImplementation(() => {
        throw new Error('Failed to emit to client B');
      });

      gateway.server.to = jest.fn().mockImplementation((clientId) => {
        if (clientId === clientAId) {
          return { emit: mockEmitA };
        } else if (clientId === clientBId) {
          return { emit: mockEmitB };
        }
      });

      // Should not throw error even if both client emissions fail
      expect(() => {
        gateway.notifyMatchFound(matchId, clientAId, clientBId);
      }).not.toThrow();

      // Verify both clients were attempted
      expect(gateway.server.to).toHaveBeenCalledTimes(2);
      expect(mockEmitA).toHaveBeenCalled();
      expect(mockEmitB).toHaveBeenCalled();
    });

    it('should handle server.to method throwing error', () => {
      gateway.server.to = jest.fn().mockImplementation(() => {
        throw new Error('Server.to method failed');
      });

      // Should not throw error even if server.to fails
      expect(() => {
        gateway.notifyMatchFound(matchId, clientAId, clientBId);
      }).not.toThrow();

      // Verify server.to was attempted
      expect(gateway.server.to).toHaveBeenCalled();
    });

    it('should work with different match ID formats', () => {
      const differentMatchIds = [
        'match:1234567890-abcdef',
        'game-session-uuid-123',
        'rapid-quiz-match-456',
        'tournament:finals:789',
      ];

      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      differentMatchIds.forEach((testMatchId) => {
        gateway.notifyMatchFound(testMatchId, clientAId, clientBId);

        expect(mockEmit).toHaveBeenCalledWith('match:found', {
          matchId: testMatchId,
          opponentClientId: expect.any(String),
        });
      });

      expect(mockEmit).toHaveBeenCalledTimes(differentMatchIds.length * 2); // 2 calls per match
    });

    it('should work with different client ID formats', () => {
      const clientPairs = [
        ['socket-123', 'socket-456'],
        ['user:abc:socket:def', 'user:ghi:socket:jkl'],
        ['client_session_789', 'client_session_012'],
        ['ws-connection-345', 'ws-connection-678'],
      ];

      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      clientPairs.forEach(([clientA, clientB]) => {
        gateway.notifyMatchFound(matchId, clientA, clientB);

        expect(gateway.server.to).toHaveBeenCalledWith(clientA);
        expect(gateway.server.to).toHaveBeenCalledWith(clientB);
      });

      expect(gateway.server.to).toHaveBeenCalledTimes(clientPairs.length * 2);
    });
  });
});
