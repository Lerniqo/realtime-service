import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsObject,
  IsBoolean,
  IsNumber,
  IsArray,
  Min,
  Max,
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

/**
 * DTO for question generation request to AI Service
 */
export class AiQuestionGenerationDto {
  @IsNotEmpty()
  @IsString()
  topic: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(20)
  num_questions?: number = 5;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  question_types?: string[];

  @IsOptional()
  @IsString()
  difficulty?: string = 'medium';

  @IsOptional()
  @IsString()
  creativity_mode?: string;

  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  top_k?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.0)
  @Max(1.0)
  top_p?: number;
}
