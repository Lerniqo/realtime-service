import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import { NotificationsService } from './notifications.service';
import { RealtimeGateway } from '../gateway/realtime.gateway';
import { LoggerUtil } from 'src/common/utils/logger.util';

// Mock LoggerUtil
jest.mock('src/common/utils/logger.util');

describe('NotificationsService', () => {
  let service: NotificationsService;
  let mockGateway: jest.Mocked<RealtimeGateway>;
  let mockLogger: jest.Mocked<PinoLogger>;

  beforeEach(async () => {
    // Create mock gateway
    mockGateway = {
      sendNotificationToUsers: jest.fn(),
      sendNotification: jest.fn(),
    } as any;

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: RealtimeGateway,
          useValue: mockGateway,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendToUsers', () => {
    it('should call gateway.sendNotificationToUsers with correct parameters', async () => {
      // Arrange
      const userIds = ['user1', 'user2', 'user3'];
      const payload = { message: 'Test notification', type: 'info' };

      // Act
      await service.sendToUsers(userIds, payload);

      // Assert
      expect(mockGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        userIds,
        payload,
      );
      expect(mockGateway.sendNotificationToUsers).toHaveBeenCalledTimes(1);
    });

    it('should log successful sendToUsers operation', async () => {
      // Arrange
      const userIds = ['user1', 'user2'];
      const payload = { message: 'Success test', type: 'success' };

      // Act
      await service.sendToUsers(userIds, payload);

      // Assert
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'NotificationsService',
        'sendToUsers',
        {
          userIds,
          payload,
        },
      );
    });

    it('should handle empty userIds array', async () => {
      // Arrange
      const userIds: string[] = [];
      const payload = { message: 'Empty users test' };

      // Act
      await service.sendToUsers(userIds, payload);

      // Assert
      expect(mockGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        userIds,
        payload,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'NotificationsService',
        'sendToUsers',
        {
          userIds,
          payload,
        },
      );
    });

    it('should handle single user in array', async () => {
      // Arrange
      const userIds = ['single-user'];
      const payload = { message: 'Single user test' };

      // Act
      await service.sendToUsers(userIds, payload);

      // Assert
      expect(mockGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        userIds,
        payload,
      );
    });

    it('should log error when gateway throws exception', async () => {
      // Arrange
      const userIds = ['user1'];
      const payload = { message: 'Error test' };
      const error = new Error('Gateway connection failed');

      mockGateway.sendNotificationToUsers.mockImplementation(() => {
        throw error;
      });

      // Act
      await service.sendToUsers(userIds, payload);

      // Assert
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'NotificationsService',
        'sendToUsers',
        error,
      );
    });

    it('should handle complex payload objects', async () => {
      // Arrange
      const userIds = ['user1', 'user2'];
      const payload = {
        message: 'Complex notification',
        type: 'alert',
        metadata: {
          timestamp: Date.now(),
          source: 'test-service',
          priority: 'high',
        },
        actions: [
          { label: 'View', action: 'view' },
          { label: 'Dismiss', action: 'dismiss' },
        ],
      };

      // Act
      await service.sendToUsers(userIds, payload);

      // Assert
      expect(mockGateway.sendNotificationToUsers).toHaveBeenCalledWith(
        userIds,
        payload,
      );
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'NotificationsService',
        'sendToUsers',
        {
          userIds,
          payload,
        },
      );
    });

    it('should not propagate gateway errors to caller', async () => {
      // Arrange
      const userIds = ['user1'];
      const payload = { message: 'Error test' };

      mockGateway.sendNotificationToUsers.mockImplementation(() => {
        throw new Error('Gateway error');
      });

      // Act & Assert
      await expect(
        service.sendToUsers(userIds, payload),
      ).resolves.not.toThrow();
    });
  });
});
