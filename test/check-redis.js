const Redis = require('ioredis');

const redis = new Redis({
  host: 'localhost',
  port: 6379,
});

async function checkQueue() {
  try {
    console.log('🔍 Checking matchmaking queue and rooms...');

    // Check the queue
    const queueKey = 'matchmaking:queue:1v1_rapid_quiz';
    const queue = await redis.lrange(queueKey, 0, -1);
    console.log(`📊 Queue contents (${queue.length} items):`, queue);

    // Check for room keys
    const roomKeys = await redis.keys('room:*');
    console.log(`🏠 Room keys found (${roomKeys.length}):`, roomKeys);

    // Check for socket keys
    const socketKeys = await redis.keys('socket:*');
    console.log(
      `🔌 Socket keys found (${socketKeys.length}):`,
      socketKeys.slice(0, 5),
    ); // Show first 5

    // Check all keys
    const allKeys = await redis.keys('*');
    console.log(`🔍 All Redis keys (${allKeys.length}):`, allKeys.slice(0, 10)); // Show first 10

    redis.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    redis.disconnect();
  }
}

checkQueue();
