import { Module } from '@nestjs/common';
import { KafkaController } from './kafka.controller';

@Module({
    imports: [],
    controllers: [KafkaController],
    providers: [],
})
export class KafkaModule {}
