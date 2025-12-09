const Redis = require('ioredis');

// Shared Redis connection
// Using lazy initialization or simple global singleton pattern
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    // Add other common config here
});

connection.on('error', (err) => {
    console.error('[Redis] Connection error:', err);
});

connection.on('connect', () => {
    console.log('[Redis] Connected to Redis at', redisUrl);
});

module.exports = {
    connection
};
