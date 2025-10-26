import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { HealthCheckService } from '@nestjs/terminus';
import { KafkaHealthIndicator } from './kafka-health.indicator';
import { RedisHealthIndicator } from './redis-health.indicator';

describe('HealthController', () => {
  let controller: HealthController;
  let _service: HealthService;

  const mockHealthCheckService = {
    check: jest.fn().mockResolvedValue({
      status: 'ok',
      info: {},
      error: {},
      details: {},
    }),
  };

  const mockKafkaHealthIndicator = {
    isHealthy: jest.fn().mockResolvedValue({
      kafka: {
        status: 'up',
      },
    }),
  };

  const mockRedisHealthIndicator = {
    isHealthy: jest.fn().mockResolvedValue({
      redis: {
        status: 'up',
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: HealthCheckService,
          useValue: mockHealthCheckService,
        },
        {
          provide: KafkaHealthIndicator,
          useValue: mockKafkaHealthIndicator,
        },
        {
          provide: RedisHealthIndicator,
          useValue: mockRedisHealthIndicator,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    _service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
