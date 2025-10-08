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
});
