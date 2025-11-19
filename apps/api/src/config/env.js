require('dotenv').config();

function validateEnv() {
    const required = ['PORT', 'STORAGE_PATH', 'AUTH_SECRET', 'REDIS_HOST', 'REDIS_PORT'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return {
        port: process.env.PORT,
        storagePath: process.env.STORAGE_PATH,
        authSecret: process.env.AUTH_SECRET,
        redis: {
            host: process.env.REDIS_HOST,
            port: parseInt(process.env.REDIS_PORT, 10)
        },
        nodeEnv: process.env.NODE_ENV || 'development'
    };
}

module.exports = {
    validateEnv
};
