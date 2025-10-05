import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisService } from './redis.service';

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
                  REDIS_HOST: 'localhost',
                  REDIS_PORT: 6379,
                  REDIS_PASSWORD: undefined,
                };
                return config[key] || defaultValue;
              }),
          },
        },
      ],
    }).compile();

    service = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return Redis client', () => {
    const client = service.getClient();
    expect(client).toBeDefined();
  });
});
