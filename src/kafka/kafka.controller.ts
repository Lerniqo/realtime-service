import { Controller, ValidationPipe, UsePipes } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { KafkaService } from './kafka.service';
import {
  SessionStartingSoonDto,
  ConceptMasteredDto,
} from './dto/notification.dto';

@Controller()
export class KafkaController {
  constructor(private readonly kafkaService: KafkaService) {}

  @EventPattern('SessionStartingSoon')
  @UsePipes(new ValidationPipe({ transform: true }))
  handleSessionStartingSoon(@Payload() payload: SessionStartingSoonDto) {
    const { userIds, message } = payload;
    this.kafkaService.sendSessionStartSoonNotification(userIds, message);
  }

  @EventPattern('ConceptMastered')
  @UsePipes(new ValidationPipe({ transform: true }))
  handleConceptMastered(@Payload() payload: ConceptMasteredDto) {
    const { userIds, message } = payload;
    this.kafkaService.sendConceptMasteredNotification(userIds, message);
  }
}
