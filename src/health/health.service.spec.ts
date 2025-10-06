import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkHealth', () => {
    it('should return a JSON string with health status', () => {
      const result = service.checkHealth();

      // Parse the JSON string to validate structure
      const healthData = JSON.parse(result);

      expect(healthData).toHaveProperty('status', 'ok');
      expect(healthData).toHaveProperty('service', 'realtime-service');
      expect(healthData).toHaveProperty('timestamp');
      expect(healthData.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
    it('should return current timestamp', () => {
      const beforeCall = new Date();
      const result = service.checkHealth();
      const afterCall = new Date();

      const healthData = JSON.parse(result);
      const timestamp = new Date(healthData.timestamp);

      expect(timestamp.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(timestamp.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should return valid JSON string', () => {
      const result = service.checkHealth();

      expect(() => JSON.parse(result)).not.toThrow();
      expect(typeof result).toBe('string');
    });
  });
});
