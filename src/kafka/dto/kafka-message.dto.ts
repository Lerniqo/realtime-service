import { IsString, IsOptional, IsNumber } from 'class-validator';

export class KafkaMessageDto {
  @IsOptional()
  @IsString()
  key?: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsNumber()
  partition?: number;

  @IsOptional()
  timestamp?: Date;
}

export class TopicConfigDto {
  @IsString()
  topic: string;

  @IsOptional()
  @IsNumber()
  numPartitions?: number;

  @IsOptional()
  @IsNumber()
  replicationFactor?: number;
}
