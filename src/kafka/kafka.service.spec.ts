import { Test, TestingModule } from '@nestjs/testing';
import { KafkaService } from './kafka.service';
import { RealtimeGateway } from 'src/realtime/gateway/realtime.gateway';
import { PinoLogger } from 'nestjs-pino';
import { LoggerUtil } from 'src/common/utils/logger.util';

describe('KafkaService', () => {
  let service: KafkaService;
  let mockRealtimeGateway: jest.Mocked<RealtimeGateway>;
  let mockLogger: jest.Mocked<PinoLogger>;

  beforeEach(async () => {
    // Create mock objects
    mockRealtimeGateway = {
      sendNotificationToUsers: jest.fn(),
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Spy on LoggerUtil static methods
    jest.spyOn(LoggerUtil, 'logInfo').mockImplementation();
    jest.spyOn(LoggerUtil, 'logError').mockImplementation();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KafkaService,
        {
          provide: RealtimeGateway,
          useValue: mockRealtimeGateway,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<KafkaService>(KafkaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendSessionStartSoonNotification', () => {
    const userIds = ['user1', 'user2', 'user3'];
    const message = 'Your session is starting soon!';

    it('should send notification to users successfully', () => {
      // Act
      service.sendSessionStartSoonNotification(userIds, message);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        userIds,
        message,
      );
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledTimes(
        1,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Send session start soon notification',
        {
          userIds,
          message,
        },
      );
    });

    it('should handle empty userIds array', () => {
      const emptyUserIds: string[] = [];

      // Act
      service.sendSessionStartSoonNotification(emptyUserIds, message);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        emptyUserIds,
        message,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Send session start soon notification',
        {
          userIds: emptyUserIds,
          message,
        },
      );
    });

    it('should handle empty message', () => {
      const emptyMessage = '';

      // Act
      service.sendSessionStartSoonNotification(userIds, emptyMessage);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        userIds,
        emptyMessage,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Send session start soon notification',
        {
          userIds,
          message: emptyMessage,
        },
      );
    });

    it('should log error when realtimeGateway throws exception', () => {
      const error = new Error('Gateway connection failed');
      mockRealtimeGateway.sendNotificationToUsers.mockImplementation(() => {
        throw error;
      });

      // Act
      service.sendSessionStartSoonNotification(userIds, message);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        userIds,
        message,
      );
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Error while sending session start soon notification',
        error,
      );
      expect(LoggerUtil.logInfo).not.toHaveBeenCalled();
    });

    it('should handle single user notification', () => {
      const singleUserIds = ['user1'];

      // Act
      service.sendSessionStartSoonNotification(singleUserIds, message);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        singleUserIds,
        message,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Send session start soon notification',
        {
          userIds: singleUserIds,
          message,
        },
      );
    });
  });

  describe('sendConceptMasteredNotification', () => {
    const userIds = ['user1', 'user2', 'user3'];
    const message = 'Congratulations! You have mastered this concept!';

    it('should send notification to users successfully', () => {
      // Act
      service.sendConceptMasteredNotification(userIds, message);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        userIds,
        message,
      );
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledTimes(
        1,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Send concept mastered notification',
        {
          userIds,
          message,
        },
      );
    });

    it('should handle empty userIds array', () => {
      const emptyUserIds: string[] = [];

      // Act
      service.sendConceptMasteredNotification(emptyUserIds, message);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        emptyUserIds,
        message,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Send concept mastered notification',
        {
          userIds: emptyUserIds,
          message,
        },
      );
    });

    it('should handle empty message', () => {
      const emptyMessage = '';

      // Act
      service.sendConceptMasteredNotification(userIds, emptyMessage);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        userIds,
        emptyMessage,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Send concept mastered notification',
        {
          userIds,
          message: emptyMessage,
        },
      );
    });

    it('should log error when realtimeGateway throws exception', () => {
      const error = new Error('Gateway connection failed');
      mockRealtimeGateway.sendNotificationToUsers.mockImplementation(() => {
        throw error;
      });

      // Act
      service.sendConceptMasteredNotification(userIds, message);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        userIds,
        message,
      );
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Error while sending concept mastered notification',
        error,
      );
      expect(LoggerUtil.logInfo).not.toHaveBeenCalled();
    });

    it('should handle single user notification', () => {
      const singleUserIds = ['user1'];

      // Act
      service.sendConceptMasteredNotification(singleUserIds, message);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        singleUserIds,
        message,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Send concept mastered notification',
        {
          userIds: singleUserIds,
          message,
        },
      );
    });

    it('should handle large array of userIds', () => {
      const largeUserIds = Array.from(
        { length: 100 },
        (_, i) => `user${i + 1}`,
      );

      // Act
      service.sendConceptMasteredNotification(largeUserIds, message);

      // Assert
      expect(mockRealtimeGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        largeUserIds,
        message,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Send concept mastered notification',
        {
          userIds: largeUserIds,
          message,
        },
      );
    });
  });

  describe('error handling', () => {
    it('should handle network timeout errors', () => {
      const timeoutError = new Error('Network timeout');
      timeoutError.name = 'TimeoutError';
      mockRealtimeGateway.sendNotificationToUsers.mockImplementation(() => {
        throw timeoutError;
      });

      // Act
      service.sendSessionStartSoonNotification(['user1'], 'test message');

      // Assert
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'KafkaNotificationService',
        'Error while sending session start soon notification',
        timeoutError,
      );
    });

    it('should handle null/undefined parameters gracefully', () => {
      // Act & Assert - should not throw
      expect(() => {
        service.sendSessionStartSoonNotification(null as any, null as any);
      }).not.toThrow();

      expect(() => {
        service.sendConceptMasteredNotification(
          undefined as any,
          undefined as any,
        );
      }).not.toThrow();
    });
  });
});
