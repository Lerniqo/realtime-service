import { IsArray, IsObject, ArrayNotEmpty } from 'class-validator';

export class NotifyDto {
  @IsArray()
  @ArrayNotEmpty()
  userIds: string[];

  @IsObject()
  payload: Record<string, any>;
}
