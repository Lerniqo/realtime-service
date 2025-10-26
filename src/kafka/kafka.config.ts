import { KafkaConfig } from 'kafkajs';

export const getKafkaConfig = (): KafkaConfig => ({
  clientId: process.env.KAFKA_CLIENT_ID || 'realtime-service',
  brokers: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  connectionTimeout: parseInt(
    process.env.KAFKA_CONNECTION_TIMEOUT || '30000',
    10,
  ),
  requestTimeout: parseInt(process.env.KAFKA_REQUEST_TIMEOUT || '30000', 10),
  retry: {
    initialRetryTime: parseInt(process.env.KAFKA_RETRY_DELAY || '300', 10),
    retries: parseInt(process.env.KAFKA_RETRY_ATTEMPTS || '8', 10),
  },
  logLevel: parseInt(process.env.KAFKA_LOG_LEVEL || '2', 10), // 0=NOTHING, 1=ERROR, 2=WARN, 3=INFO, 4=DEBUG
});
