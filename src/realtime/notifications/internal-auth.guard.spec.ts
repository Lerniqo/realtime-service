import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { InternalAuthGuard } from './internal-auth.guard';
import { LoggerUtil } from 'src/common/utils/logger.util';

// Mock LoggerUtil
jest.mock('src/common/utils/logger.util');

describe('InternalAuthGuard', () => {
  let guard: InternalAuthGuard;
  let mockLogger: jest.Mocked<PinoLogger>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: any;

  const VALID_API_KEY = 'test-internal-api-key';
  const INVALID_API_KEY = 'invalid-api-key';

  beforeEach(async () => {
    // Reset environment variable
    process.env.INTERNAL_API_KEY = VALID_API_KEY;

    // Create mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create mock request object
    mockRequest = {
      headers: {},
      url: '/api/test',
      method: 'POST',
      ip: '127.0.0.1',
      connection: {
        remoteAddress: '127.0.0.1',
      },
    };

    // Create mock execution context
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalAuthGuard,
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    guard = module.get<InternalAuthGuard>(InternalAuthGuard);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up environment variable
    delete process.env.INTERNAL_API_KEY;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should return true when valid API key is provided', () => {
      // Arrange
      mockRequest.headers['internal-api-key'] = VALID_API_KEY;

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication successful',
        {
          requestPath: '/api/test',
          requestMethod: 'POST',
        },
      );
      expect(LoggerUtil.logError).not.toHaveBeenCalled();
    });

    it('should return false when invalid API key is provided', () => {
      // Arrange
      mockRequest.headers['internal-api-key'] = INVALID_API_KEY;

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(false);
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication failed: Invalid API key',
        {
          receivedApiKey: 'provided',
          expectedKeyExists: true,
          requestPath: '/api/test',
          requestMethod: 'POST',
          userAgent: undefined,
          ip: '127.0.0.1',
        },
      );
      expect(LoggerUtil.logInfo).not.toHaveBeenCalled();
    });

    it('should return false when no API key is provided', () => {
      // Arrange
      // mockRequest.headers is already empty

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(false);
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication failed: Missing API key',
        {
          receivedApiKey: 'missing',
          expectedKeyExists: true,
          requestPath: '/api/test',
          requestMethod: 'POST',
          userAgent: undefined,
          ip: '127.0.0.1',
        },
      );
      expect(LoggerUtil.logInfo).not.toHaveBeenCalled();
    });

    it('should return false when environment variable INTERNAL_API_KEY is not set', () => {
      // Arrange
      delete process.env.INTERNAL_API_KEY;
      mockRequest.headers['internal-api-key'] = VALID_API_KEY;

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(false);
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication failed: Invalid API key',
        {
          receivedApiKey: 'provided',
          expectedKeyExists: false,
          requestPath: '/api/test',
          requestMethod: 'POST',
          userAgent: undefined,
          ip: '127.0.0.1',
        },
      );
      expect(LoggerUtil.logInfo).not.toHaveBeenCalled();
    });

    it('should handle empty string API key', () => {
      // Arrange
      mockRequest.headers['internal-api-key'] = '';

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(false);
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication failed: Missing API key',
        {
          receivedApiKey: 'missing',
          expectedKeyExists: true,
          requestPath: '/api/test',
          requestMethod: 'POST',
          userAgent: undefined,
          ip: '127.0.0.1',
        },
      );
    });

    it('should handle request with user-agent header', () => {
      // Arrange
      mockRequest.headers['user-agent'] = 'Test-Client/1.0';
      mockRequest.headers['internal-api-key'] = INVALID_API_KEY;

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(false);
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication failed: Invalid API key',
        {
          receivedApiKey: 'provided',
          expectedKeyExists: true,
          requestPath: '/api/test',
          requestMethod: 'POST',
          userAgent: 'Test-Client/1.0',
          ip: '127.0.0.1',
        },
      );
    });

    it('should handle request without ip and connection.remoteAddress', () => {
      // Arrange
      mockRequest.ip = undefined;
      mockRequest.connection = undefined;
      mockRequest.headers['internal-api-key'] = INVALID_API_KEY;

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(false);
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication failed: Invalid API key',
        {
          receivedApiKey: 'provided',
          expectedKeyExists: true,
          requestPath: '/api/test',
          requestMethod: 'POST',
          userAgent: undefined,
          ip: undefined,
        },
      );
    });

    it('should prioritize req.ip over connection.remoteAddress', () => {
      // Arrange
      mockRequest.ip = '192.168.1.1';
      mockRequest.connection = { remoteAddress: '127.0.0.1' };
      mockRequest.headers['internal-api-key'] = INVALID_API_KEY;

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(false);
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication failed: Invalid API key',
        expect.objectContaining({
          ip: '192.168.1.1',
        }),
      );
    });

    it('should use connection.remoteAddress when req.ip is not available', () => {
      // Arrange
      mockRequest.ip = undefined;
      mockRequest.connection = { remoteAddress: '192.168.1.100' };
      mockRequest.headers['internal-api-key'] = INVALID_API_KEY;

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(false);
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication failed: Invalid API key',
        expect.objectContaining({
          ip: '192.168.1.100',
        }),
      );
    });

    it('should handle different request methods and paths', () => {
      // Arrange
      mockRequest.method = 'GET';
      mockRequest.url = '/api/different/endpoint';
      mockRequest.headers['internal-api-key'] = VALID_API_KEY;

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication successful',
        {
          requestPath: '/api/different/endpoint',
          requestMethod: 'GET',
        },
      );
    });
  });

  describe('edge cases', () => {
    it('should handle when environment variable is empty string', () => {
      // Arrange
      process.env.INTERNAL_API_KEY = '';
      mockRequest.headers['internal-api-key'] = '';

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(LoggerUtil.logInfo).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication successful',
        {
          requestPath: '/api/test',
          requestMethod: 'POST',
        },
      );
    });

    it('should handle whitespace in API keys', () => {
      // Arrange
      process.env.INTERNAL_API_KEY = ' whitespace-key ';
      mockRequest.headers['internal-api-key'] = ' whitespace-key ';

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
    });

    it('should be case-sensitive for API key comparison', () => {
      // Arrange
      process.env.INTERNAL_API_KEY = 'CaseSensitiveKey';
      mockRequest.headers['internal-api-key'] = 'casesensitivekey';

      // Act
      const result = guard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(false);
      expect(LoggerUtil.logError).toHaveBeenCalledWith(
        mockLogger,
        'InternalAuthGuard',
        'Internal API authentication failed: Invalid API key',
        expect.any(Object),
      );
    });
  });
});
