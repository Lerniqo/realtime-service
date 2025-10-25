import { Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import { PinoLogger } from 'nestjs-pino';
import { LoggerUtil } from 'src/common/utils/logger.util';
import { AiChatRequestDto, AiChatResponseDto } from './dto/chat-message.dto';

@Injectable()
export class AiServiceClient {
  private readonly aiServiceUrl: string;
  private readonly requestTimeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.aiServiceUrl = this.configService.get<string>(
      'AI_SERVICE_URL',
      'http://localhost:3001',
    );
    this.requestTimeout = this.configService.get<number>(
      'AI_SERVICE_TIMEOUT',
      30000,
    );
  }

  /**
   * Send a chat message to the AI Service and get a response
   * @param request - The chat message request
   * @returns Promise with the AI's response
   * @throws Error if the request fails or times out
   */
  async sendChatMessage(request: AiChatRequestDto): Promise<AiChatResponseDto> {
    const startTime = Date.now();

    try {
      LoggerUtil.logInfo(
        this.logger,
        'AiServiceClient',
        'Sending chat message to AI Service',
        {
          sessionId: request.sessionId,
          messageLength: request.message.length,
          detailed: request.detailed || false,
        },
      );

      const response = await firstValueFrom(
        this.httpService
          .post<AiChatResponseDto>(`${this.aiServiceUrl}/llm/chat`, request)
          .pipe(
            timeout(this.requestTimeout),
            catchError((error) => {
              LoggerUtil.logError(
                this.logger,
                'AiServiceClient',
                'Error calling AI Service',
                error,
              );
              throw error;
            }),
          ),
      );

      const duration = Date.now() - startTime;

      LoggerUtil.logInfo(
        this.logger,
        'AiServiceClient',
        'Received response from AI Service',
        {
          sessionId: request.sessionId,
          duration,
          responseLength: response.data.message?.length || 0,
        },
      );

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;

      LoggerUtil.logError(
        this.logger,
        'AiServiceClient',
        'Failed to get response from AI Service',
        {
          error: error.message,
          sessionId: request.sessionId,
          duration,
        },
      );

      // Re-throw with a more descriptive error
      if (error.name === 'TimeoutError') {
        throw new Error(
          `AI Service request timed out after ${this.requestTimeout}ms`,
        );
      }

      if (error.response) {
        throw new Error(
          `AI Service returned error: ${error.response.status} - ${error.response.statusText}`,
        );
      }

      throw new Error(
        `Failed to communicate with AI Service: ${error.message}`,
      );
    }
  }

  /**
   * Health check for the AI Service
   * @returns Promise<boolean> - true if the service is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.aiServiceUrl}/health`).pipe(timeout(5000)),
      );
      return response.status === 200;
    } catch (error) {
      LoggerUtil.logWarn(
        this.logger,
        'AiServiceClient',
        'AI Service health check failed',
        { error: error.message },
      );
      return false;
    }
  }
}
