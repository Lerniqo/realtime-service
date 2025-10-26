import { IsString, IsArray, IsOptional } from 'class-validator';

export class NotificationMessageDto {
  @IsArray()
  @IsString({ each: true })
  userIds: string[];

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  notificationType?: string;

  @IsOptional()
  metadata?: any;
}

export class SessionStartingSoonDto extends NotificationMessageDto {
  @IsOptional()
  @IsString()
  sessionId?: string;

  @IsOptional()
  startTime?: Date;
}

export class ConceptMasteredDto extends NotificationMessageDto {
  @IsOptional()
  @IsString()
  conceptId?: string;

  @IsOptional()
  @IsString()
  userId?: string;
}
