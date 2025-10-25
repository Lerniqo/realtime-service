import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
} from 'class-validator';

/**
 * DTO for incoming chat messages from students via WebSocket
 */
export class SendChatMessageDto {
  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  detailed?: boolean;
}

/**
 * DTO for the chat message response from AI Service
 */
export class AiChatResponseDto {
  message: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

/**
 * DTO for sending chat message to AI Service REST API
 */
export class AiChatRequestDto {
  @IsNotEmpty()
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  @IsBoolean()
  detailed: boolean;
}
