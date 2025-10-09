import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { KafkaService } from './kafka.service';

@Controller()
export class KafkaController {
  constructor(private readonly kafkaService: KafkaService) {}

  @MessagePattern('SessionStartingSoon')
  handleSessionStartingSoon(@Payload() payload: any) {
    const { userIds, message } = payload;
    this.kafkaService.sendSessionStartSoonNotification(userIds, message);
  }

  @MessagePattern('ConceptMastered')
  handleConceptMastered(@Payload() payload: any) {
    const { userIds, message } = payload;
    this.kafkaService.sendConceptMasteredNotification(userIds, message);
  }
}
