# Kafka Configuration Environment Variables

This document describes the environment variables used to configure the Kafka client in the realtime-service.

## Required Variables

### KAFKA_BROKERS
- **Description**: Comma-separated list of Kafka broker addresses
- **Default**: `localhost:9092`
- **Example**: `localhost:9092,localhost:9093,localhost:9094`

## Optional Variables

### KAFKA_CLIENT_ID
- **Description**: Unique identifier for this Kafka client
- **Default**: `realtime-service`
- **Example**: `realtime-service-prod`

### KAFKA_CONNECTION_TIMEOUT
- **Description**: Connection timeout in milliseconds
- **Default**: `30000` (30 seconds)
- **Example**: `60000`

### KAFKA_REQUEST_TIMEOUT
- **Description**: Request timeout in milliseconds
- **Default**: `30000` (30 seconds)
- **Example**: `45000`

### KAFKA_RETRY_DELAY
- **Description**: Initial retry delay in milliseconds
- **Default**: `300`
- **Example**: `500`

### KAFKA_RETRY_ATTEMPTS
- **Description**: Number of retry attempts
- **Default**: `8`
- **Example**: `5`

### KAFKA_LOG_LEVEL
- **Description**: Kafka client log level (0=NOTHING, 1=ERROR, 2=WARN, 3=INFO, 4=DEBUG)
- **Default**: `2` (WARN)
- **Example**: `3`

### KAFKA_CONSUMER_GROUP_ID
- **Description**: Consumer group ID for this service
- **Default**: `realtime-service-group`
- **Example**: `realtime-service-group-prod`

## Example .env file

```env
# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=realtime-service
KAFKA_CONNECTION_TIMEOUT=30000
KAFKA_REQUEST_TIMEOUT=30000
KAFKA_RETRY_DELAY=300
KAFKA_RETRY_ATTEMPTS=8
KAFKA_LOG_LEVEL=2
KAFKA_CONSUMER_GROUP_ID=realtime-service-group
```

## Production Considerations

1. **KAFKA_BROKERS**: Use multiple brokers for high availability
2. **KAFKA_CLIENT_ID**: Include environment suffix (e.g., `-prod`, `-staging`)
3. **KAFKA_CONSUMER_GROUP_ID**: Use unique group IDs per environment
4. **Timeouts**: Increase timeouts in production for stability
5. **Log Level**: Use ERROR (1) or WARN (2) in production to reduce noise