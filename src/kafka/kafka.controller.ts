import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KafkaService } from './kafka.service';

@Controller()
export class KafkaController {
  constructor(private readonly kafkaService: KafkaService) {}

  @EventPattern('SessionStartingSoon')
  handleSessionStartingSoon(@Payload() payload: any) {
    const { userIds, message } = payload;
    this.kafkaService.sendSessionStartSoonNotification(userIds, message);
  }

  @EventPattern('ConceptMastered')
  handleConceptMastered(@Payload() payload: any) {
    const { userIds, message } = payload;
    this.kafkaService.sendConceptMasteredNotification(userIds, message);
  }
}
