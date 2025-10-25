import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeGateway } from './realtime.gateway';
import { ConnectionService } from './connection.service';
import { PinoLogger } from 'nestjs-pino';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { RedisService } from '../../redis/redis.service';
import { MatchmakingService } from '../matchmaking/matchmaking.service';
import { SecretCodeService } from 'src/auth/secret-code.service';
import { ConfigService } from '@nestjs/config';
import { AiServiceClient } from 'src/ai-service/ai-service.client';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let secretCodeService: SecretCodeService;
  let roomsService: RealtimeRoomsService;
  let connectionService: ConnectionService;
  let matchmakingService: MatchmakingService;
  let redisService: RedisService;
  let aiServiceClient: AiServiceClient;

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
          provide: SecretCodeService,
          useValue: {
            validateSessionCode: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-secret-key'),
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
            getSocketRooms: jest.fn().mockResolvedValue([]),
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
              get: jest.fn(),
              set: jest.fn(),
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
        {
          provide: AiServiceClient,
          useValue: {
            sendChatMessage: jest.fn(),
            healthCheck: jest.fn(),
          },
        },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    secretCodeService = module.get<SecretCodeService>(SecretCodeService);
    roomsService = module.get<RealtimeRoomsService>(RealtimeRoomsService);
    connectionService = module.get<ConnectionService>(ConnectionService);
    matchmakingService = module.get<MatchmakingService>(MatchmakingService);
    redisService = module.get<RedisService>(RedisService);
    aiServiceClient = module.get<AiServiceClient>(AiServiceClient);

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

  it('should handle valid session code on connection', async () => {
    const mockUserData = {
      userId: 'user123',
      role: 'user',
      email: 'test@example.com',
    };

    jest
      .spyOn(secretCodeService, 'validateSessionCode')
      .mockReturnValue(mockUserData);

    await gateway.handleConnection(mockSocket as any);

    expect(secretCodeService.validateSessionCode).toHaveBeenCalledWith(
      'test-token',
    );
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
    jest
      .spyOn(secretCodeService, 'validateSessionCode')
      .mockImplementation(() => {
        throw new Error('Invalid session code');
      });

    await gateway.handleConnection(mockSocket as any);

    // Wait for setImmediate to execute
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockSocket.disconnect).toHaveBeenCalledWith(true);
  });

  it('should handle disconnect properly', async () => {
    mockSocket.data.user = { userId: 'user123' };

    await gateway.handleDisconnect(mockSocket as any);

    // Wait for async operations to complete
    await new Promise((resolve) => setImmediate(resolve));

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
      const payload = { userId: 'user1', gameType: '1v1_rapid_quiz' };

      jest.spyOn(matchmakingService, 'addToMatchingQueue').mockResolvedValue();

      await gateway.onJoinMatchmakingQueue(mockSocket1 as any, payload);

      expect(matchmakingService.addToMatchingQueue).toHaveBeenCalledWith(
        'socket-1',
        'user1',
        '1v1_rapid_quiz',
      );
    });

    it('should handle error when user tries to join with incorrect game type', async () => {
      const payload = { userId: 'user1', gameType: 'invalid_game_type' };

      jest
        .spyOn(matchmakingService, 'addToMatchingQueue')
        .mockRejectedValue(new Error('Unsupported game type'));

      // Spy on console methods to avoid actual console output during tests
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await gateway.onJoinMatchmakingQueue(mockSocket1 as any, payload);

      expect(matchmakingService.addToMatchingQueue).toHaveBeenCalledWith(
        'socket-1',
        'user1',
        'invalid_game_type',
      );

      // Restore console.error
      consoleErrorSpy.mockRestore();
    });

    it('should handle multiple users trying to join matchmaking queue', async () => {
      const payload = { userId: 'user1', gameType: '1v1_rapid_quiz' };

      jest.spyOn(matchmakingService, 'addToMatchingQueue').mockResolvedValue();

      // First user joins queue
      await gateway.onJoinMatchmakingQueue(mockSocket1 as any, payload);

      // Second user joins queue
      const payload2 = { userId: 'user2', gameType: '1v1_rapid_quiz' };
      await gateway.onJoinMatchmakingQueue(mockSocket2 as any, payload2);

      expect(matchmakingService.addToMatchingQueue).toHaveBeenCalledTimes(2);
      expect(matchmakingService.addToMatchingQueue).toHaveBeenNthCalledWith(
        1,
        'socket-1',
        'user1',
        '1v1_rapid_quiz',
      );
      expect(matchmakingService.addToMatchingQueue).toHaveBeenNthCalledWith(
        2,
        'socket-2',
        'user2',
        '1v1_rapid_quiz',
      );
    });

    it('should handle mixed scenario - one user with correct type, one with incorrect type', async () => {
      const correctPayload = { userId: 'user1', gameType: '1v1_rapid_quiz' };
      const incorrectPayload = { userId: 'user2', gameType: 'invalid_type' };

      jest
        .spyOn(matchmakingService, 'addToMatchingQueue')
        .mockImplementation((clientId, userId, gameType) => {
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
        'user1',
        '1v1_rapid_quiz',
      );
      expect(matchmakingService.addToMatchingQueue).toHaveBeenNthCalledWith(
        2,
        'socket-2',
        'user2',
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
    const userAId = 'user-a-123';
    const userBId = 'user-b-456';
    const mockQuestions = [
      { id: 1, question: 'Test Question 1', options: ['A', 'B', 'C'] },
      { id: 2, question: 'Test Question 2', options: ['A', 'B', 'C'] },
    ];

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

      gateway.notifyMatchFound(
        matchId,
        clientAId,
        clientBId,
        userAId,
        userBId,
        mockQuestions,
      );

      // Verify that server.to was called for both clients
      expect(gateway.server.to).toHaveBeenCalledTimes(2);
      expect(gateway.server.to).toHaveBeenNthCalledWith(1, clientAId);
      expect(gateway.server.to).toHaveBeenNthCalledWith(2, clientBId);

      // Verify emit was called with correct data for both clients
      expect(mockEmit).toHaveBeenCalledTimes(2);
      expect(mockEmit).toHaveBeenNthCalledWith(1, 'match:found', {
        matchId,
        questions: mockQuestions,
        playerRole: 'playerA',
        yourUserId: userAId,
        opponentClientId: clientBId,
        opponentUserId: userBId,
      });
      expect(mockEmit).toHaveBeenNthCalledWith(2, 'match:found', {
        matchId,
        questions: mockQuestions,
        playerRole: 'playerB',
        yourUserId: userBId,
        opponentClientId: clientAId,
        opponentUserId: userAId,
      });
    });

    it('should handle missing matchId parameter', () => {
      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      gateway.notifyMatchFound(
        '',
        clientAId,
        clientBId,
        userAId,
        userBId,
        mockQuestions,
      );

      // Should not attempt to send notifications with invalid parameters
      expect(gateway.server.to).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should handle missing clientAId parameter', () => {
      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      gateway.notifyMatchFound(
        matchId,
        '',
        clientBId,
        userAId,
        userBId,
        mockQuestions,
      );

      // Should not attempt to send notifications with invalid parameters
      expect(gateway.server.to).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should handle missing clientBId parameter', () => {
      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      gateway.notifyMatchFound(
        matchId,
        clientAId,
        '',
        userAId,
        userBId,
        mockQuestions,
      );

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
      gateway.notifyMatchFound(
        null as any,
        clientAId,
        clientBId,
        userAId,
        userBId,
        mockQuestions,
      );
      gateway.notifyMatchFound(
        matchId,
        null as any,
        clientBId,
        userAId,
        userBId,
        mockQuestions,
      );
      gateway.notifyMatchFound(
        matchId,
        clientAId,
        null as any,
        userAId,
        userBId,
        mockQuestions,
      );

      // Test with undefined values
      gateway.notifyMatchFound(
        undefined as any,
        clientAId,
        clientBId,
        userAId,
        userBId,
        mockQuestions,
      );
      gateway.notifyMatchFound(
        matchId,
        undefined as any,
        clientBId,
        userAId,
        userBId,
        mockQuestions,
      );
      gateway.notifyMatchFound(
        matchId,
        clientAId,
        undefined as any,
        userAId,
        userBId,
        mockQuestions,
      );

      // Should not attempt to send notifications with invalid parameters
      expect(gateway.server.to).not.toHaveBeenCalled();
      expect(mockEmit).not.toHaveBeenCalled();
    });

    it('should handle server unavailable scenario', () => {
      // Set server to null to simulate unavailable server
      gateway.server = null as any;

      // Should not throw error when server is unavailable
      expect(() => {
        gateway.notifyMatchFound(
          matchId,
          clientAId,
          clientBId,
          userAId,
          userBId,
          mockQuestions,
        );
      }).not.toThrow();
    });

    it('should handle server undefined scenario', () => {
      // Set server to undefined
      gateway.server = undefined as any;

      // Should not throw error when server is undefined
      expect(() => {
        gateway.notifyMatchFound(
          matchId,
          clientAId,
          clientBId,
          userAId,
          userBId,
          mockQuestions,
        );
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
        gateway.notifyMatchFound(
          matchId,
          clientAId,
          clientBId,
          userAId,
          userBId,
          mockQuestions,
        );
      }).not.toThrow();

      // Verify both clients were attempted
      expect(gateway.server.to).toHaveBeenCalledTimes(2);
      expect(gateway.server.to).toHaveBeenNthCalledWith(1, clientAId);
      expect(gateway.server.to).toHaveBeenNthCalledWith(2, clientBId);

      // Verify client A emission was attempted and failed
      expect(mockEmitA).toHaveBeenCalledWith('match:found', {
        matchId,
        questions: mockQuestions,
        playerRole: 'playerA',
        yourUserId: userAId,
        opponentClientId: clientBId,
        opponentUserId: userBId,
      });

      // Verify client B emission succeeded
      expect(mockEmitB).toHaveBeenCalledWith('match:found', {
        matchId,
        questions: mockQuestions,
        playerRole: 'playerB',
        yourUserId: userBId,
        opponentClientId: clientAId,
        opponentUserId: userAId,
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
        gateway.notifyMatchFound(
          matchId,
          clientAId,
          clientBId,
          userAId,
          userBId,
          mockQuestions,
        );
      }).not.toThrow();

      // Verify both clients were attempted
      expect(gateway.server.to).toHaveBeenCalledTimes(2);

      // Verify client A emission succeeded
      expect(mockEmitA).toHaveBeenCalledWith('match:found', {
        matchId,
        questions: mockQuestions,
        playerRole: 'playerA',
        yourUserId: userAId,
        opponentClientId: clientBId,
        opponentUserId: userBId,
      });

      // Verify client B emission was attempted and failed
      expect(mockEmitB).toHaveBeenCalledWith('match:found', {
        matchId,
        questions: mockQuestions,
        playerRole: 'playerB',
        yourUserId: userBId,
        opponentClientId: clientAId,
        opponentUserId: userAId,
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
        gateway.notifyMatchFound(
          matchId,
          clientAId,
          clientBId,
          userAId,
          userBId,
          mockQuestions,
        );
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
        gateway.notifyMatchFound(
          matchId,
          clientAId,
          clientBId,
          userAId,
          userBId,
          mockQuestions,
        );
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
        gateway.notifyMatchFound(
          testMatchId,
          clientAId,
          clientBId,
          userAId,
          userBId,
          mockQuestions,
        );

        // Check calls for both playerA and playerB
        expect(mockEmit).toHaveBeenCalledWith('match:found', {
          matchId: testMatchId,
          questions: mockQuestions,
          playerRole: 'playerA',
          yourUserId: userAId,
          opponentClientId: clientBId,
          opponentUserId: userBId,
        });

        expect(mockEmit).toHaveBeenCalledWith('match:found', {
          matchId: testMatchId,
          questions: mockQuestions,
          playerRole: 'playerB',
          yourUserId: userBId,
          opponentClientId: clientAId,
          opponentUserId: userAId,
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
        gateway.notifyMatchFound(
          matchId,
          clientA,
          clientB,
          userAId,
          userBId,
          mockQuestions,
        );

        expect(gateway.server.to).toHaveBeenCalledWith(clientA);
        expect(gateway.server.to).toHaveBeenCalledWith(clientB);
      });

      expect(gateway.server.to).toHaveBeenCalledTimes(clientPairs.length * 2);
    });
  });

  describe('onSubmitAnswer', () => {
    const mockMatchSocket = {
      id: 'player-socket-id',
      data: {
        user: {
          userId: 'user123',
          role: 'user',
          email: 'test@example.com',
        },
      },
    };

    const matchId = 'match:1234567890-abcdef';
    const mockPayload = {
      answer: 'A',
      timer: 15,
    };

    let mockRedisClient: any;

    beforeEach(() => {
      mockRedisClient = {
        get: jest.fn(),
        set: jest.fn(),
      };

      (redisService.getClient as jest.Mock).mockReturnValue(mockRedisClient);
      (roomsService.getSocketRooms as jest.Mock).mockResolvedValue([
        matchId,
        'user:user123',
      ]);

      // Mock server.to for state updates
      gateway.server.to = jest.fn().mockReturnValue({
        emit: jest.fn(),
      });
    });

    it('should successfully process correct answer for player A', async () => {
      // Setup Redis responses
      mockRedisClient.get
        .mockResolvedValueOnce('player-socket-id') // playerASocketId
        .mockResolvedValueOnce('other-socket-id') // playerBSocketId
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 2,
            activeQuestionIndex: 1,
            timer: 20,
          }),
        ) // playerAStatus
        .mockResolvedValueOnce(
          JSON.stringify({
            1: 'A',
            2: 'B',
            3: 'C',
          }),
        ) // answers
        .mockResolvedValueOnce(
          JSON.stringify([
            { id: 1, question: 'Question 1', options: ['A', 'B', 'C'] },
            { id: 2, question: 'Question 2', options: ['A', 'B', 'C'] },
            { id: 3, question: 'Question 3', options: ['A', 'B', 'C'] },
          ]),
        ) // questions
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 3,
            activeQuestionIndex: 2,
            timer: 15,
          }),
        ) // updated playerAStatus
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 1,
            activeQuestionIndex: 1,
            timer: 25,
          }),
        ); // playerBStatus

      const correctAnswerPayload = {
        answer: 'B', // Correct answer for question ID 2 (activeQuestionIndex 1)
        timer: 15,
      };

      await gateway.onSubmitAnswer(
        mockMatchSocket as any,
        correctAnswerPayload,
      );

      // Verify Redis operations
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `${matchId}:playerASocketId`,
      );
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `${matchId}:playerBSocketId`,
      );
      expect(mockRedisClient.get).toHaveBeenCalledWith(
        `${matchId}:playerAStatus`,
      );
      expect(mockRedisClient.get).toHaveBeenCalledWith(`${matchId}:answers`);
      expect(mockRedisClient.get).toHaveBeenCalledWith(`${matchId}:questions`);

      // Verify player status update
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${matchId}:playerAStatus`,
        JSON.stringify({
          score: 3, // Incremented from 2 to 3 (correct answer)
          activeQuestionIndex: 2, // Incremented from 1 to 2
          timer: 15, // Updated from payload
        }),
      );

      // Verify state update broadcast
      expect(gateway.server.to).toHaveBeenCalledWith(matchId);
    });

    it('should successfully process incorrect answer for player B', async () => {
      const playerBSocket = {
        ...mockMatchSocket,
        id: 'player-b-socket-id',
      };

      // Setup Redis responses for player B
      mockRedisClient.get
        .mockResolvedValueOnce('other-socket-id') // playerASocketId
        .mockResolvedValueOnce('player-b-socket-id') // playerBSocketId
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 1,
            activeQuestionIndex: 0,
            timer: 30,
          }),
        ) // playerBStatus
        .mockResolvedValueOnce(
          JSON.stringify({
            1: 'A',
            2: 'B',
            3: 'C',
          }),
        ) // answers
        .mockResolvedValueOnce(
          JSON.stringify([
            { id: 1, question: 'Question 1', options: ['A', 'B', 'C'] },
            { id: 2, question: 'Question 2', options: ['A', 'B', 'C'] },
          ]),
        ) // questions
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 2,
            activeQuestionIndex: 1,
            timer: 15,
          }),
        ) // playerAStatus
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 1, // No increment (incorrect answer)
            activeQuestionIndex: 1, // Incremented from 0 to 1
            timer: 10, // Updated from payload
          }),
        ); // updated playerBStatus

      const incorrectPayload = {
        answer: 'B', // Incorrect answer (correct is 'A')
        timer: 10,
      };

      await gateway.onSubmitAnswer(playerBSocket as any, incorrectPayload);

      // Verify player B status update
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${matchId}:playerBStatus`,
        JSON.stringify({
          score: 1, // No increment (incorrect answer)
          activeQuestionIndex: 1, // Incremented from 0 to 1
          timer: 10, // Updated from payload
        }),
      );

      // Verify state update broadcast
      expect(gateway.server.to).toHaveBeenCalledWith(matchId);
    });

    it('should handle no match room found', async () => {
      (roomsService.getSocketRooms as jest.Mock).mockResolvedValue([
        'user:user123',
        'general-room',
      ]);

      await gateway.onSubmitAnswer(mockMatchSocket as any, mockPayload);

      // Should not call Redis operations
      expect(mockRedisClient.get).not.toHaveBeenCalled();
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('should handle invalid player (socket not in match)', async () => {
      // Setup Redis responses
      mockRedisClient.get
        .mockResolvedValueOnce('different-socket-id') // playerASocketId
        .mockResolvedValueOnce('another-socket-id'); // playerBSocketId

      await gateway.onSubmitAnswer(mockMatchSocket as any, mockPayload);

      // Should not proceed with status update
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('should handle missing player status in Redis', async () => {
      // Setup Redis responses
      mockRedisClient.get
        .mockResolvedValueOnce('player-socket-id') // playerASocketId
        .mockResolvedValueOnce('other-socket-id') // playerBSocketId
        .mockResolvedValueOnce(null); // playerAStatus (missing)

      await gateway.onSubmitAnswer(mockMatchSocket as any, mockPayload);

      // Should not proceed with status update
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('should handle missing answers in Redis', async () => {
      // Setup Redis responses
      mockRedisClient.get
        .mockResolvedValueOnce('player-socket-id') // playerASocketId
        .mockResolvedValueOnce('other-socket-id') // playerBSocketId
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 0,
            activeQuestionIndex: 0,
            timer: 30,
          }),
        ) // playerAStatus
        .mockResolvedValueOnce(null); // answers (missing)

      await gateway.onSubmitAnswer(mockMatchSocket as any, mockPayload);

      // Should not proceed with status update
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('should handle missing questions in Redis', async () => {
      // Setup Redis responses
      mockRedisClient.get
        .mockResolvedValueOnce('player-socket-id') // playerASocketId
        .mockResolvedValueOnce('other-socket-id') // playerBSocketId
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 0,
            activeQuestionIndex: 0,
            timer: 30,
          }),
        ) // playerAStatus
        .mockResolvedValueOnce(
          JSON.stringify({
            1: 'A',
            2: 'B',
          }),
        ) // answers
        .mockResolvedValueOnce(null); // questions (missing)

      await gateway.onSubmitAnswer(mockMatchSocket as any, mockPayload);

      // Should not proceed with status update
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('should handle question index out of bounds', async () => {
      // Setup Redis responses
      mockRedisClient.get
        .mockResolvedValueOnce('player-socket-id') // playerASocketId
        .mockResolvedValueOnce('other-socket-id') // playerBSocketId
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 5,
            activeQuestionIndex: 10, // Out of bounds
            timer: 0,
          }),
        ) // playerAStatus
        .mockResolvedValueOnce(
          JSON.stringify({
            1: 'A',
            2: 'B',
          }),
        ) // answers
        .mockResolvedValueOnce(
          JSON.stringify([
            { id: 1, question: 'Question 1', options: ['A', 'B'] },
            { id: 2, question: 'Question 2', options: ['A', 'B'] },
          ]),
        ); // questions (only 2 questions, but activeQuestionIndex is 10)

      await gateway.onSubmitAnswer(mockMatchSocket as any, mockPayload);

      // Should not proceed with status update
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      mockRedisClient.get.mockRejectedValue(
        new Error('Redis connection error'),
      );

      await gateway.onSubmitAnswer(mockMatchSocket as any, mockPayload);

      // Should not proceed with status update
      expect(mockRedisClient.set).not.toHaveBeenCalled();
      expect(gateway.server.to).not.toHaveBeenCalled();
    });

    it('should broadcast game state with match completion flag', async () => {
      // Setup for last question (match completion)
      mockRedisClient.get
        .mockResolvedValueOnce('player-socket-id') // playerASocketId
        .mockResolvedValueOnce('other-socket-id') // playerBSocketId
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 4,
            activeQuestionIndex: 4, // Last question (index 4 of 5 questions)
            timer: 5,
          }),
        ) // playerAStatus
        .mockResolvedValueOnce(
          JSON.stringify({
            1: 'A',
            2: 'B',
            3: 'C',
            4: 'D',
            5: 'A',
          }),
        ) // answers
        .mockResolvedValueOnce(
          JSON.stringify([
            { id: 1, question: 'Q1', options: ['A', 'B'] },
            { id: 2, question: 'Q2', options: ['A', 'B'] },
            { id: 3, question: 'Q3', options: ['A', 'B'] },
            { id: 4, question: 'Q4', options: ['A', 'B'] },
            { id: 5, question: 'Q5', options: ['A', 'B'] },
          ]),
        ) // questions (5 total)
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 5, // Updated score
            activeQuestionIndex: 5, // Beyond last question
            timer: 5,
          }),
        ) // updated playerAStatus
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 3,
            activeQuestionIndex: 4,
            timer: 10,
          }),
        ); // playerBStatus

      const finalAnswerPayload = {
        answer: 'A', // Correct answer for question 5
        timer: 5,
      };

      const mockEmit = jest.fn();
      gateway.server.to = jest.fn().mockReturnValue({
        emit: mockEmit,
      });

      await gateway.onSubmitAnswer(mockMatchSocket as any, finalAnswerPayload);

      // Verify state update includes match completion
      expect(mockEmit).toHaveBeenCalledWith('match:stateUpdate', {
        matchId,
        playerA: {
          score: 5,
          activeQuestionIndex: 5,
          timer: 5,
        },
        playerB: {
          score: 3,
          activeQuestionIndex: 4,
          timer: 10,
        },
        isMatchComplete: true, // Should be true since activeQuestionIndex (5) >= questions.length (5)
        totalQuestions: 5,
      });
    });

    it('should update timer correctly for both players', async () => {
      // Setup Redis responses
      mockRedisClient.get
        .mockResolvedValueOnce('player-socket-id') // playerASocketId
        .mockResolvedValueOnce('other-socket-id') // playerBSocketId
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 1,
            activeQuestionIndex: 1,
            timer: 30, // Original timer
          }),
        ) // playerAStatus
        .mockResolvedValueOnce(
          JSON.stringify({
            1: 'B',
            2: 'A',
          }),
        ) // answers
        .mockResolvedValueOnce(
          JSON.stringify([
            { id: 1, question: 'Question 1', options: ['A', 'B'] },
            { id: 2, question: 'Question 2', options: ['A', 'B'] },
          ]),
        ) // questions
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 2, // Updated score
            activeQuestionIndex: 2, // Updated index
            timer: 7, // Updated timer from payload
          }),
        ) // updated playerAStatus
        .mockResolvedValueOnce(
          JSON.stringify({
            score: 0,
            activeQuestionIndex: 0,
            timer: 25,
          }),
        ); // playerBStatus

      const timerTestPayload = {
        answer: 'A',
        timer: 7, // Specific timer value
      };

      await gateway.onSubmitAnswer(mockMatchSocket as any, timerTestPayload);

      // Verify timer was updated correctly in player status
      expect(mockRedisClient.set).toHaveBeenCalledWith(
        `${matchId}:playerAStatus`,
        JSON.stringify({
          score: 2,
          activeQuestionIndex: 2,
          timer: 7, // Should be updated to payload timer
        }),
      );
    });
  });

  describe('AI Tutor Chat Integration', () => {
    const mockAuthenticatedSocket = {
      id: 'test-socket-id',
      data: {
        user: {
          userId: 'user123',
          role: 'student',
          email: 'student@example.com',
        },
      },
      emit: jest.fn(),
    };

    beforeEach(() => {
      jest.clearAllMocks();
    });

    describe('chat:sendMessage', () => {
      it('should successfully handle a chat message and return AI response', async () => {
        const chatPayload = {
          message: 'Can you help me with calculus?',
          sessionId: 'session123',
          context: { topic: 'math' },
        };

        const aiResponse = {
          message:
            'Of course! What specific calculus topic would you like help with?',
          sessionId: 'session123',
          metadata: { confidence: 0.95 },
        };

        jest
          .spyOn(aiServiceClient, 'sendChatMessage')
          .mockResolvedValue(aiResponse);

        await gateway.onChatSendMessage(
          mockAuthenticatedSocket as any,
          chatPayload,
        );

        expect(aiServiceClient.sendChatMessage).toHaveBeenCalledWith({
          message: chatPayload.message,
          userId: 'user123',
          sessionId: chatPayload.sessionId,
          context: chatPayload.context,
        });

        expect(mockAuthenticatedSocket.emit).toHaveBeenCalledWith(
          'chat:newMessage',
          expect.objectContaining({
            message: aiResponse.message,
            sessionId: aiResponse.sessionId,
            metadata: aiResponse.metadata,
            timestamp: expect.any(String),
          }),
        );
      });

      it('should reject unauthenticated chat attempts', async () => {
        const unauthenticatedSocket = {
          id: 'test-socket-id',
          data: {},
          emit: jest.fn(),
        };

        const chatPayload = {
          message: 'Hello',
        };

        await gateway.onChatSendMessage(
          unauthenticatedSocket as any,
          chatPayload,
        );

        expect(aiServiceClient.sendChatMessage).not.toHaveBeenCalled();
        expect(unauthenticatedSocket.emit).toHaveBeenCalledWith(
          'chat:error',
          expect.objectContaining({
            message: 'Authentication required',
            code: 'AUTH_REQUIRED',
          }),
        );
      });

      it('should reject invalid message payloads', async () => {
        const invalidPayload = {
          message: '', // Empty message
        };

        await gateway.onChatSendMessage(
          mockAuthenticatedSocket as any,
          invalidPayload,
        );

        expect(aiServiceClient.sendChatMessage).not.toHaveBeenCalled();
        expect(mockAuthenticatedSocket.emit).toHaveBeenCalledWith(
          'chat:error',
          expect.objectContaining({
            message: 'Invalid message format',
            code: 'INVALID_PAYLOAD',
          }),
        );
      });

      it('should handle AI Service errors gracefully', async () => {
        const chatPayload = {
          message: 'Test message',
          sessionId: 'session123',
        };

        const aiError = new Error('AI Service timeout');
        jest
          .spyOn(aiServiceClient, 'sendChatMessage')
          .mockRejectedValue(aiError);

        await gateway.onChatSendMessage(
          mockAuthenticatedSocket as any,
          chatPayload,
        );

        expect(mockAuthenticatedSocket.emit).toHaveBeenCalledWith(
          'chat:error',
          expect.objectContaining({
            message: 'Failed to get response from AI tutor. Please try again.',
            code: 'AI_SERVICE_ERROR',
            details: aiError.message,
            timestamp: expect.any(String),
          }),
        );
      });

      it('should handle missing message field', async () => {
        const invalidPayload = {} as any;

        await gateway.onChatSendMessage(
          mockAuthenticatedSocket as any,
          invalidPayload,
        );

        expect(aiServiceClient.sendChatMessage).not.toHaveBeenCalled();
        expect(mockAuthenticatedSocket.emit).toHaveBeenCalledWith(
          'chat:error',
          expect.objectContaining({
            message: 'Invalid message format',
            code: 'INVALID_PAYLOAD',
          }),
        );
      });

      it('should handle AI Service response with optional fields', async () => {
        const chatPayload = {
          message: 'Simple question',
        };

        const aiResponse = {
          message: 'Simple answer',
          sessionId: undefined,
          metadata: undefined,
        };

        jest
          .spyOn(aiServiceClient, 'sendChatMessage')
          .mockResolvedValue(aiResponse);

        await gateway.onChatSendMessage(
          mockAuthenticatedSocket as any,
          chatPayload,
        );

        expect(mockAuthenticatedSocket.emit).toHaveBeenCalledWith(
          'chat:newMessage',
          expect.objectContaining({
            message: aiResponse.message,
            timestamp: expect.any(String),
          }),
        );
      });
    });
  });
});
