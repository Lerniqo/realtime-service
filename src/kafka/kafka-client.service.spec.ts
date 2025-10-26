import { Test, TestingModule } from '@nestjs/testing';
import { LoggerModule } from 'nestjs-pino';
import { KafkaClientService } from './kafka-client.service';

describe('KafkaClientService', () => {
  let service: KafkaClientService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        LoggerModule.forRoot({
          pinoHttp: {
            level: 'silent', // Disable logging in tests
          },
        }),
      ],
      providers: [KafkaClientService],
    }).compile();

    service = module.get<KafkaClientService>(KafkaClientService);
  });

  afterEach(async () => {
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have producer, consumer and admin clients', () => {
    expect(service.getProducer()).toBeDefined();
    expect(service.getConsumer()).toBeDefined();
    expect(service.getAdmin()).toBeDefined();
  });

  // Note: Integration tests require a running Kafka instance
  describe('Integration Tests (requires Kafka)', () => {
    // Skipped by default - run manually when Kafka is available
    it.skip('should connect to Kafka and list topics', async () => {
      await service.onModuleInit();
      const topics = await service.listTopics();
      expect(Array.isArray(topics)).toBe(true);
      await service.onModuleDestroy();
    });

    it.skip('should send a message to a topic', async () => {
      await service.onModuleInit();

      const testTopic = 'test-topic';
      const testMessage = {
        test: 'message',
        timestamp: new Date().toISOString(),
      };

      // Create topic first
      await service.createTopics([{ topic: testTopic, numPartitions: 1 }]);

      // Send message
      const result = await service.sendMessage(testTopic, [
        { value: JSON.stringify(testMessage) },
      ]);

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);

      await service.onModuleDestroy();
    });
  });
});
