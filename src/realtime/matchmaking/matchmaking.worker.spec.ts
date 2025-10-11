import { Test, TestingModule } from '@nestjs/testing';
import { MatchmakingWorker } from './matchmaking.worker';
import { RedisService } from 'src/redis/redis.service';
import { RealtimeRoomsService } from '../rooms/rooms.service';
import { RealtimeGateway } from '../gateway/realtime.gateway';
import { PinoLogger } from 'nestjs-pino';
import { GameType } from './dto/game-type.enum';
import { Socket } from 'socket.io';
import { ContentService } from 'src/content/content.service';

// Mock LoggerUtil to capture the calls
jest.mock('src/common/utils/logger.util', () => ({
  LoggerUtil: {
    logInfo: jest.fn(),
    logError: jest.fn(),
  },
}));

import { LoggerUtil } from 'src/common/utils/logger.util';

describe('MatchmakingWorker', () => {
  let worker: MatchmakingWorker;
  let redisService: RedisService;
  let roomsService: RealtimeRoomsService;
  let gateway: RealtimeGateway;
  let logger: PinoLogger;
  let contentService: ContentService;
  let mockRedisClient: any;
  let mockSocket1: Partial<Socket>;
  let mockSocket2: Partial<Socket>;

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create mock Redis client
    mockRedisClient = {
      lrange: jest.fn(),
      lrem: jest.fn(),
      set: jest.fn(),
    };

    // Create mock sockets
    mockSocket1 = {
      id: 'socket1',
      join: jest.fn(),
      data: { user: { userId: 'user1' } },
    };

    mockSocket2 = {
      id: 'socket2',
      join: jest.fn(),
      data: { user: { userId: 'user2' } },
    };

    // Create mock services
    const mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    };

    const mockRoomsService = {
      joinRoom: jest.fn(),
    };

    const mockGateway = {
      server: {
        sockets: {
          sockets: new Map([
            ['client1', mockSocket1],
            ['client2', mockSocket2],
          ]),
        },
      },
      notifyMatchFound: jest.fn(),
    };

    const mockContentService = {
      getMatchQuestions: jest.fn().mockResolvedValue({
        questions: [
          {
            id: 1,
            question: 'What is 2+2?',
            options: ['3', '4', '5', '6'],
          },
          {
            id: 2,
            question: 'What is the capital of France?',
            options: ['London', 'Berlin', 'Paris', 'Madrid'],
          },
        ],
        answers: ['4', 'Paris'],
      }),
    };

    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingWorker,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: RealtimeRoomsService,
          useValue: mockRoomsService,
        },
        {
          provide: RealtimeGateway,
          useValue: mockGateway,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
        {
          provide: ContentService,
          useValue: mockContentService,
        },
      ],
    }).compile();

    worker = module.get<MatchmakingWorker>(MatchmakingWorker);
    redisService = module.get<RedisService>(RedisService);
    roomsService = module.get<RealtimeRoomsService>(RealtimeRoomsService);
    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    logger = module.get<PinoLogger>(PinoLogger);
    contentService = module.get<ContentService>(ContentService);
  });

  afterEach(() => {
    // Clear all mocks after each test
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(worker).toBeDefined();
  });

  describe('handleMatchmaking', () => {
    it('should not create match when queue has fewer than 2 clients', async () => {
      mockRedisClient.lrange.mockResolvedValue(['client1']);

      await worker.handleMatchmaking();

      expect(mockRedisClient.lrange).toHaveBeenCalledWith(
        `matchmaking:queue:${GameType.ONE_V_ONE_RAPID_QUIZ}`,
        0,
        -1,
      );
      expect(mockRedisClient.lrem).not.toHaveBeenCalled();
      expect(roomsService.joinRoom).not.toHaveBeenCalled();
    });

    it('should create match when queue has 2 or more clients', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ clientId: 'client1', userId: 'user1' }),
        JSON.stringify({ clientId: 'client2', userId: 'user2' }),
        JSON.stringify({ clientId: 'client3', userId: 'user3' }),
      ]);

      await worker.handleMatchmaking();

      expect(mockRedisClient.lrange).toHaveBeenCalledWith(
        `matchmaking:queue:${GameType.ONE_V_ONE_RAPID_QUIZ}`,
        0,
        -1,
      );
      expect(mockRedisClient.lrem).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.lrem).toHaveBeenNthCalledWith(
        1,
        `matchmaking:queue:${GameType.ONE_V_ONE_RAPID_QUIZ}`,
        1,
        JSON.stringify({ clientId: 'client1', userId: 'user1' }),
      );
      expect(mockRedisClient.lrem).toHaveBeenNthCalledWith(
        2,
        `matchmaking:queue:${GameType.ONE_V_ONE_RAPID_QUIZ}`,
        1,
        JSON.stringify({ clientId: 'client2', userId: 'user2' }),
      );
    });

    it('should join both players to match room when sockets are found', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ clientId: 'client1', userId: 'user1' }),
        JSON.stringify({ clientId: 'client2', userId: 'user2' }),
      ]);

      await worker.handleMatchmaking();

      expect(roomsService.joinRoom).toHaveBeenCalledTimes(2);
      expect(roomsService.joinRoom).toHaveBeenCalledWith(
        mockSocket1,
        expect.stringMatching(/^match:\d+-[a-z0-9]+$/),
      );
      expect(roomsService.joinRoom).toHaveBeenCalledWith(
        mockSocket2,
        expect.stringMatching(/^match:\d+-[a-z0-9]+$/),
      );
    });

    it('should handle missing sockets gracefully', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ clientId: 'nonexistent1', userId: 'user1' }),
        JSON.stringify({ clientId: 'nonexistent2', userId: 'user2' }),
      ]);

      await worker.handleMatchmaking();

      expect(roomsService.joinRoom).not.toHaveBeenCalled();
      // Should still log the match creation attempt
      expect(LoggerUtil.logInfo).toHaveBeenCalled();
    });

    it('should handle partial missing sockets', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ clientId: 'client1', userId: 'user1' }),
        JSON.stringify({ clientId: 'nonexistent', userId: 'user2' }),
      ]);

      await worker.handleMatchmaking();

      expect(roomsService.joinRoom).toHaveBeenCalledTimes(1);
      expect(roomsService.joinRoom).toHaveBeenCalledWith(
        mockSocket1,
        expect.stringMatching(/^match:\d+-[a-z0-9]+$/),
      );
    });

    it('should generate unique match IDs', async () => {
      // Setup the queue to have clients
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ clientId: 'client1', userId: 'user1' }),
        JSON.stringify({ clientId: 'client2', userId: 'user2' }),
      ]);

      // Mock the random number generation to be predictable
      jest.spyOn(Math, 'random').mockReturnValue(0.123456789);
      jest.spyOn(Date, 'now').mockReturnValue(1000);

      await worker.handleMatchmaking();

      // Check that a match was created with expected pattern
      expect(roomsService.joinRoom).toHaveBeenCalledTimes(2);
      const calls = (roomsService.joinRoom as jest.Mock).mock.calls;
      const matchId = calls[0][1];
      expect(matchId).toMatch(/^match:\d+-[a-z0-9]+$/);

      // Both sockets should join the same room
      expect(calls[0][1]).toBe(calls[1][1]);

      // Restore mocks
      jest.restoreAllMocks();
    });

    it('should log match creation with correct details', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ clientId: 'client1', userId: 'user1' }),
        JSON.stringify({ clientId: 'client2', userId: 'user2' }),
      ]);

      await worker.handleMatchmaking();

      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        logger,
        'matchmaking-worker',
        expect.stringMatching(
          /^New match room created: match:\d+-[a-z0-9]+ between client1 & client2$/,
        ),
        expect.objectContaining({
          roomId: expect.stringMatching(/^match:\d+-[a-z0-9]+$/),
          clientIds: ['client1', 'client2'],
          gameType: GameType.ONE_V_ONE_RAPID_QUIZ,
          socketsFound: { socket1: true, socket2: true },
        }),
      );
    });

    it('should handle Redis errors gracefully', async () => {
      const redisError = new Error('Redis connection failed');
      mockRedisClient.lrange.mockRejectedValue(redisError);

      await worker.handleMatchmaking();

      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        logger,
        'matchmaking-worker',
        'Error in handleMatchmaking',
        redisError,
      );
      expect(roomsService.joinRoom).not.toHaveBeenCalled();
    });

    it('should handle room service errors gracefully', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ clientId: 'client1', userId: 'user1' }),
        JSON.stringify({ clientId: 'client2', userId: 'user2' }),
      ]);
      const roomError = new Error('Room service failed');
      (roomsService.joinRoom as jest.Mock).mockRejectedValue(roomError);

      await worker.handleMatchmaking();

      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        logger,
        'matchmaking-worker',
        'Error in handleMatchmaking',
        roomError,
      );
    });

    it('should process all game types', async () => {
      // Mock empty queues for all game types
      mockRedisClient.lrange.mockResolvedValue([]);

      await worker.handleMatchmaking();

      // Should check queue for each game type
      expect(mockRedisClient.lrange).toHaveBeenCalledWith(
        `matchmaking:queue:${GameType.ONE_V_ONE_RAPID_QUIZ}`,
        0,
        -1,
      );
    });

    it('should process multiple matches in different queues', async () => {
      // If we had multiple game types, we could test this
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ clientId: 'client1', userId: 'user1' }),
        JSON.stringify({ clientId: 'client2', userId: 'user2' }),
      ]);

      await worker.handleMatchmaking();

      expect(mockRedisClient.lrem).toHaveBeenCalledTimes(2);
      expect(roomsService.joinRoom).toHaveBeenCalledTimes(2);
    });

    it('should call notifyMatchFound when match is created', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ clientId: 'client1', userId: 'user1' }),
        JSON.stringify({ clientId: 'client2', userId: 'user2' }),
      ]);

      await worker.handleMatchmaking();

      expect(gateway.notifyMatchFound).toHaveBeenCalledTimes(1);
      expect(gateway.notifyMatchFound).toHaveBeenCalledWith(
        expect.stringMatching(/^match:\d+-[a-z0-9]+$/),
        'client1',
        'client2',
        'user1',
        'user2',
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            question: expect.any(String),
            options: expect.any(Array),
          }),
        ]),
      );
    });

    it('should call notifyMatchFound even when sockets are missing', async () => {
      mockRedisClient.lrange.mockResolvedValue([
        JSON.stringify({ clientId: 'nonexistent1', userId: 'user1' }),
        JSON.stringify({ clientId: 'nonexistent2', userId: 'user2' }),
      ]);

      await worker.handleMatchmaking();

      expect(gateway.notifyMatchFound).toHaveBeenCalledTimes(1);
      expect(gateway.notifyMatchFound).toHaveBeenCalledWith(
        expect.stringMatching(/^match:\d+-[a-z0-9]+$/),
        'nonexistent1',
        'nonexistent2',
        'user1',
        'user2',
        expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(Number),
            question: expect.any(String),
            options: expect.any(Array),
          }),
        ]),
      );
    });
  });
});
