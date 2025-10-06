import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkHealth', () => {
    it('should return health status from service', () => {
      const mockHealthData = JSON.stringify({
        status: 'ok',
        timestamp: '2025-08-07T12:00:00.000Z',
        service: 'realtime-service',
      });

      jest.spyOn(service, 'checkHealth').mockReturnValue(mockHealthData);

      const result = controller.checkHealth();

      expect(service.checkHealth).toHaveBeenCalled();
      expect(result).toBe(mockHealthData);
    });

    it('should delegate to health service', () => {
      const serviceMethodSpy = jest.spyOn(service, 'checkHealth');

      controller.checkHealth();

      expect(serviceMethodSpy).toHaveBeenCalledWith();
    });
  });
});
