require('dotenv').config();

function validateEnv() {
    const required = ['PORT', 'STORAGE_PATH', 'AUTH_SECRET'];
    const missing = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    return {
        port: process.env.PORT,
        storagePath: process.env.STORAGE_PATH,
        authSecret: process.env.AUTH_SECRET,
        nodeEnv: process.env.NODE_ENV || 'development'
    };
}

module.exports = {
    validateEnv
};
