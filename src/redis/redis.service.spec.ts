import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';
import { PinoLogger } from 'nestjs-pino';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest
              .fn()
              .mockImplementation((key: string, defaultValue?: any) => {
                const config = {
                  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
                  REDIS_PORT: process.env.REDIS_PORT
                    ? parseInt(process.env.REDIS_PORT)
                    : 6379,
                  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
                };
                return config[key] || defaultValue;
              }),
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
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return Redis client', async () => {
    await service.onModuleInit();
    const client = service.getClient();
    expect(client).toBeDefined();
    // Clean up the connection to avoid test warnings
    await service.onModuleDestroy();
  });
});
