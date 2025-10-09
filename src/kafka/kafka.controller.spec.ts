import { Test, TestingModule } from '@nestjs/testing';
import { KafkaController } from './kafka.controller';
import { KafkaService } from './kafka.service';

describe('KafkaController', () => {
  let controller: KafkaController;
  let mockKafkaService: jest.Mocked<KafkaService>;

  beforeEach(async () => {
    // Create mock KafkaService
    mockKafkaService = {
      sendSessionStartSoonNotification: jest.fn(),
      sendConceptMasteredNotification: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [KafkaController],
      providers: [
        {
          provide: KafkaService,
          useValue: mockKafkaService,
        },
      ],
    }).compile();

    controller = module.get<KafkaController>(KafkaController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('handleSessionStartingSoon', () => {
    it('should handle SessionStartingSoon message pattern with valid payload', () => {
      // Arrange
      const payload = {
        userIds: ['user1', 'user2', 'user3'],
        message: 'Your session is starting in 5 minutes!',
      };

      // Act
      controller.handleSessionStartingSoon(payload);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledTimes(1);
    });

    it('should handle payload with empty userIds array', () => {
      // Arrange
      const payload = {
        userIds: [],
        message: 'Session starting soon',
      };

      // Act
      controller.handleSessionStartingSoon(payload);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });

    it('should handle payload with single user', () => {
      // Arrange
      const payload = {
        userIds: ['user1'],
        message: 'Your personal session is starting soon!',
      };

      // Act
      controller.handleSessionStartingSoon(payload);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });

    it('should handle payload with empty message', () => {
      // Arrange
      const payload = {
        userIds: ['user1', 'user2'],
        message: '',
      };

      // Act
      controller.handleSessionStartingSoon(payload);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });

    it('should handle payload with long message', () => {
      // Arrange
      const longMessage = 'A'.repeat(1000);
      const payload = {
        userIds: ['user1'],
        message: longMessage,
      };

      // Act
      controller.handleSessionStartingSoon(payload);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledWith(payload.userIds, longMessage);
    });

    it('should handle payload with special characters in message', () => {
      // Arrange
      const payload = {
        userIds: ['user1'],
        message: 'Session starting soon! 🚀 Ready? 中文 العربية',
      };

      // Act
      controller.handleSessionStartingSoon(payload);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });

    it('should handle payload with undefined userIds', () => {
      // Arrange
      const payload = {
        userIds: undefined,
        message: 'Session starting soon',
      };

      // Act
      controller.handleSessionStartingSoon(payload);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledWith(undefined, payload.message);
    });

    it('should handle payload with undefined message', () => {
      // Arrange
      const payload = {
        userIds: ['user1'],
        message: undefined,
      };

      // Act
      controller.handleSessionStartingSoon(payload);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledWith(payload.userIds, undefined);
    });

    it('should throw when payload is completely undefined', () => {
      // Act & Assert - should throw when trying to destructure undefined
      expect(() => {
        controller.handleSessionStartingSoon(undefined);
      }).toThrow(
        "Cannot destructure property 'userIds' of 'payload' as it is undefined.",
      );
    });

    it('should handle payload with extra properties', () => {
      // Arrange
      const payload = {
        userIds: ['user1', 'user2'],
        message: 'Session starting soon',
        extraProperty: 'should be ignored',
        timestamp: new Date(),
      };

      // Act
      controller.handleSessionStartingSoon(payload);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });
  });

  describe('handleConceptMastered', () => {
    it('should handle ConceptMastered message pattern with valid payload', () => {
      // Arrange
      const payload = {
        userIds: ['user1', 'user2', 'user3'],
        message: 'Congratulations! You have mastered Linear Algebra!',
      };

      // Act
      controller.handleConceptMastered(payload);

      // Assert
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledTimes(1);
    });

    it('should handle payload with empty userIds array', () => {
      // Arrange
      const payload = {
        userIds: [],
        message: 'Concept mastered',
      };

      // Act
      controller.handleConceptMastered(payload);

      // Assert
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });

    it('should handle payload with single user', () => {
      // Arrange
      const payload = {
        userIds: ['user1'],
        message: 'Great job mastering this concept!',
      };

      // Act
      controller.handleConceptMastered(payload);

      // Assert
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });

    it('should handle payload with empty message', () => {
      // Arrange
      const payload = {
        userIds: ['user1', 'user2'],
        message: '',
      };

      // Act
      controller.handleConceptMastered(payload);

      // Assert
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });

    it('should handle payload with HTML content in message', () => {
      // Arrange
      const payload = {
        userIds: ['user1'],
        message:
          '<strong>Congratulations!</strong> You mastered <em>Advanced Calculus</em>',
      };

      // Act
      controller.handleConceptMastered(payload);

      // Assert
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });

    it('should handle payload with JSON string in message', () => {
      // Arrange
      const payload = {
        userIds: ['user1'],
        message: JSON.stringify({
          title: 'Concept Mastered',
          concept: 'Machine Learning',
          level: 'Advanced',
        }),
      };

      // Act
      controller.handleConceptMastered(payload);

      // Assert
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });

    it('should handle payload with large number of userIds', () => {
      // Arrange
      const largeUserIds = Array.from(
        { length: 1000 },
        (_, i) => `user${i + 1}`,
      );
      const payload = {
        userIds: largeUserIds,
        message: 'Congratulations to all students!',
      };

      // Act
      controller.handleConceptMastered(payload);

      // Assert
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(largeUserIds, payload.message);
    });

    it('should handle payload with undefined userIds', () => {
      // Arrange
      const payload = {
        userIds: undefined,
        message: 'Concept mastered',
      };

      // Act
      controller.handleConceptMastered(payload);

      // Assert
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(undefined, payload.message);
    });

    it('should handle payload with undefined message', () => {
      // Arrange
      const payload = {
        userIds: ['user1'],
        message: undefined,
      };

      // Act
      controller.handleConceptMastered(payload);

      // Assert
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(payload.userIds, undefined);
    });

    it('should throw when payload is completely undefined', () => {
      // Act & Assert - should throw when trying to destructure undefined
      expect(() => {
        controller.handleConceptMastered(undefined);
      }).toThrow(
        "Cannot destructure property 'userIds' of 'payload' as it is undefined.",
      );
    });

    it('should handle payload with extra properties', () => {
      // Arrange
      const payload = {
        userIds: ['user1', 'user2'],
        message: 'Concept mastered',
        conceptId: 'calc-101',
        difficulty: 'hard',
        timestamp: Date.now(),
      };

      // Act
      controller.handleConceptMastered(payload);

      // Assert
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(payload.userIds, payload.message);
    });
  });

  describe('integration scenarios', () => {
    it('should handle both message patterns in sequence', () => {
      // Arrange
      const sessionPayload = {
        userIds: ['user1', 'user2'],
        message: 'Session starting soon',
      };
      const conceptPayload = {
        userIds: ['user1', 'user3'],
        message: 'Concept mastered',
      };

      // Act
      controller.handleSessionStartingSoon(sessionPayload);
      controller.handleConceptMastered(conceptPayload);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledWith(sessionPayload.userIds, sessionPayload.message);
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledWith(conceptPayload.userIds, conceptPayload.message);
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockKafkaService.sendConceptMasteredNotification,
      ).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple calls to the same message pattern', () => {
      // Arrange
      const payload1 = {
        userIds: ['user1'],
        message: 'First notification',
      };
      const payload2 = {
        userIds: ['user2'],
        message: 'Second notification',
      };

      // Act
      controller.handleSessionStartingSoon(payload1);
      controller.handleSessionStartingSoon(payload2);

      // Assert
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenNthCalledWith(1, payload1.userIds, payload1.message);
      expect(
        mockKafkaService.sendSessionStartSoonNotification,
      ).toHaveBeenNthCalledWith(2, payload2.userIds, payload2.message);
    });
  });

  describe('error handling', () => {
    it('should throw when service throws error for SessionStartingSoon', () => {
      // Arrange
      mockKafkaService.sendSessionStartSoonNotification.mockImplementation(
        () => {
          throw new Error('Service error');
        },
      );
      const payload = {
        userIds: ['user1'],
        message: 'Session starting soon',
      };

      // Act & Assert - controller doesn't handle service errors
      expect(() => {
        controller.handleSessionStartingSoon(payload);
      }).toThrow('Service error');
    });

    it('should throw when service throws error for ConceptMastered', () => {
      // Arrange
      mockKafkaService.sendConceptMasteredNotification.mockImplementation(
        () => {
          throw new Error('Service error');
        },
      );
      const payload = {
        userIds: ['user1'],
        message: 'Concept mastered',
      };

      // Act & Assert - controller doesn't handle service errors
      expect(() => {
        controller.handleConceptMastered(payload);
      }).toThrow('Service error');
    });
  });
});
