import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1️⃣ Create a Kafka microservice
  const _kafkaMicroservice = app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.KAFKA,
    options: {
      client: {
        brokers: process.env.KAFKA_BROKERS?.split(',') ?? ['localhost:9092'], // Kafka broker URL
        connectionTimeout: parseInt(
          process.env.KAFKA_CONNECTION_TIMEOUT || '30000',
          10,
        ),
        requestTimeout: parseInt(
          process.env.KAFKA_REQUEST_TIMEOUT || '30000',
          10,
        ),
        retry: {
          retries: parseInt(process.env.KAFKA_RETRY_ATTEMPTS || '8', 10),
          initialRetryTime: parseInt(
            process.env.KAFKA_RETRY_DELAY || '300',
            10,
          ),
        },
      },
      consumer: {
        groupId: 'realtime-service-group', // unique consumer group id
        sessionTimeout: 30000, // 30 seconds
        heartbeatInterval: 3000, // 3 seconds
        rebalanceTimeout: 60000, // 60 seconds
        metadataMaxAge: 300000, // 5 minutes
      },
      run: {
        autoCommit: true,
        autoCommitInterval: 5000,
        autoCommitThreshold: 100,
        eachBatchAutoResolve: true,
        partitionsConsumedConcurrently: 1,
      },
      producer: {
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
      },
      send: {
        timeout: 30000,
      },
      subscribe: {
        fromBeginning: false,
      },
      postfixId: '-server',
    },
  });

  // 2️⃣ Start microservices and REST API together
  await app.startAllMicroservices(); // starts Kafka microservice
  await app.listen(process.env.PORT ?? 3000); // starts HTTP server

  logger.log(
    '[Bootstrap] | Realtime service is listening on port ' +
      (process.env.PORT ?? 3000),
  );
  logger.log('[Bootstrap] | Realtime Kafka microservice is running...');
}
void bootstrap();
