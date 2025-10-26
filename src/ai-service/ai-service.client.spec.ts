import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PinoLogger } from 'nestjs-pino';
import { of, throwError } from 'rxjs';
import { AiServiceClient } from './ai-service.client';
import { AiChatRequestDto } from './dto/chat-message.dto';
import { AxiosResponse, AxiosError } from 'axios';

describe('AiServiceClient', () => {
  let service: AiServiceClient;
  let _httpService: HttpService;
  let _configService: ConfigService;
  let _logger: PinoLogger;

  const mockHttpService = {
    post: jest.fn(),
    get: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue: any) => {
      if (key === 'AI_SERVICE_URL') return 'http://localhost:3001';
      if (key === 'AI_SERVICE_TIMEOUT') return 30000;
      return defaultValue;
    }),
  };

  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiServiceClient,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: PinoLogger,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<AiServiceClient>(AiServiceClient);
    _httpService = module.get<HttpService>(HttpService);
    _configService = module.get<ConfigService>(ConfigService);
    _logger = module.get<PinoLogger>(PinoLogger);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendChatMessage', () => {
    const mockRequest: AiChatRequestDto = {
      message: 'Hello, AI!',
      sessionId: 'session456',
      detailed: true,
    };

    const mockAiResponse = {
      message: 'Hello! How can I help you with math today?',
      sessionId: 'session456',
      metadata: { confidence: 0.95 },
    };

    it('should successfully send a chat message and return AI response', async () => {
      const axiosResponse: AxiosResponse = {
        data: mockAiResponse,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.post.mockReturnValue(of(axiosResponse));

      const result = await service.sendChatMessage(mockRequest);

      expect(result).toEqual(mockAiResponse);
      expect(mockHttpService.post).toHaveBeenCalledWith(
        'http://localhost:3001/llm/chat',
        mockRequest,
      );
    });

    it('should handle timeout errors gracefully', async () => {
      const timeoutError = new Error('Timeout');
      timeoutError.name = 'TimeoutError';

      mockHttpService.post.mockReturnValue(throwError(() => timeoutError));

      await expect(service.sendChatMessage(mockRequest)).rejects.toThrow(
        'AI Service request timed out after 30000ms',
      );
    });

    it('should handle HTTP error responses', async () => {
      const axiosError: Partial<AxiosError> = {
        message: 'Request failed',
        response: {
          status: 500,
          statusText: 'Internal Server Error',
          data: {},
          headers: {},
          config: {} as any,
        },
      };

      mockHttpService.post.mockReturnValue(throwError(() => axiosError));

      await expect(service.sendChatMessage(mockRequest)).rejects.toThrow(
        'AI Service returned error: 500 - Internal Server Error',
      );
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');

      mockHttpService.post.mockReturnValue(throwError(() => networkError));

      await expect(service.sendChatMessage(mockRequest)).rejects.toThrow(
        'Failed to communicate with AI Service: Network error',
      );
    });
  });

  describe('healthCheck', () => {
    it('should return true when AI Service is healthy', async () => {
      const axiosResponse: AxiosResponse = {
        data: { status: 'ok' },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      mockHttpService.get.mockReturnValue(of(axiosResponse));

      const result = await service.healthCheck();

      expect(result).toBe(true);
      expect(mockHttpService.get).toHaveBeenCalledWith(
        'http://localhost:3001/health',
      );
    });

    it('should return false when AI Service is unhealthy', async () => {
      mockHttpService.get.mockReturnValue(
        throwError(() => new Error('Service unavailable')),
      );

      const result = await service.healthCheck();

      expect(result).toBe(false);
    });
  });
});
