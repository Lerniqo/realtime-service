import { Test, TestingModule } from '@nestjs/testing';
import { MatchmakingService } from './matchmaking.service';
import { RedisService } from 'src/redis/redis.service';
import { GameType } from './dto/game-type.enum';

describe('MatchmakingService', () => {
  let service: MatchmakingService;
  let redisService: RedisService;
  let mockRedisClient: {
    lpush: jest.Mock;
    lrange: jest.Mock;
    lrem: jest.Mock;
  };

  beforeEach(async () => {
    // Create mock Redis client
    mockRedisClient = {
      lpush: jest.fn(),
      lrange: jest.fn(),
      lrem: jest.fn(),
    };

    // Create mock RedisService
    const mockRedisService = {
      getClient: jest.fn().mockReturnValue(mockRedisClient),
    } as Partial<RedisService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchmakingService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<MatchmakingService>(MatchmakingService);
    redisService = module.get<RedisService>(RedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addToMatchingQueue', () => {
    it('should add client to queue for valid game type', async () => {
      const clientId = 'test-client-123';
      const userId = 'user-123';
      const gameType = GameType.ONE_V_ONE_RAPID_QUIZ;

      await service.addToMatchingQueue(clientId, userId, gameType);

      expect(redisService.getClient).toHaveBeenCalled();
      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        `matchmaking:queue:${gameType}`,
        JSON.stringify({ clientId, userId }),
      );
    });

    it('should throw error for unsupported game type', async () => {
      const clientId = 'test-client-123';
      const userId = 'user-123';
      const invalidGameType = 'invalid_game_type';

      await expect(
        service.addToMatchingQueue(clientId, userId, invalidGameType),
      ).rejects.toThrow('Unsupported game type');

      expect(mockRedisClient.lpush).not.toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const clientId = 'test-client-123';
      const userId = 'user-123';
      const gameType = GameType.ONE_V_ONE_RAPID_QUIZ;

      mockRedisClient.lpush.mockRejectedValue(
        new Error('Redis connection failed'),
      );

      await expect(
        service.addToMatchingQueue(clientId, userId, gameType),
      ).rejects.toThrow('Redis connection failed');

      expect(redisService.getClient).toHaveBeenCalled();
      expect(mockRedisClient.lpush).toHaveBeenCalledWith(
        `matchmaking:queue:${gameType}`,
        JSON.stringify({ clientId, userId }),
      );
    });

    it('should add multiple clients to the same queue', async () => {
      const clientId1 = 'test-client-1';
      const userId1 = 'user-1';
      const clientId2 = 'test-client-2';
      const userId2 = 'user-2';
      const gameType = GameType.ONE_V_ONE_RAPID_QUIZ;

      await service.addToMatchingQueue(clientId1, userId1, gameType);
      await service.addToMatchingQueue(clientId2, userId2, gameType);

      expect(mockRedisClient.lpush).toHaveBeenCalledTimes(2);
      expect(mockRedisClient.lpush).toHaveBeenNthCalledWith(
        1,
        `matchmaking:queue:${gameType}`,
        JSON.stringify({ clientId: clientId1, userId: userId1 }),
      );
      expect(mockRedisClient.lpush).toHaveBeenNthCalledWith(
        2,
        `matchmaking:queue:${gameType}`,
        JSON.stringify({ clientId: clientId2, userId: userId2 }),
      );
    });
  });
});
