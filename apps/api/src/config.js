// Centralized configuration module
// Fail fast on startup if critical environment variables are missing

function validateEnv() {
    // In test environment, allow sloppy config to keep tests easy to run
    if (process.env.NODE_ENV === 'test') {
        return {
            authSecret: process.env.AUTH_SECRET || 'test-secret-key-12345',
            port: process.env.PORT || 3001,
            nodeEnv: 'test'
        };
    }

    // Critical variables for Production/Development
    if (!process.env.AUTH_SECRET) {
        console.error('FATAL ERROR: AUTH_SECRET is not defined in environment variables.');
        console.error('Please set AUTH_SECRET in your .env file.');
        process.exit(1);
    }

    return {
        authSecret: process.env.AUTH_SECRET,
        port: process.env.PORT || 3001,
        nodeEnv: process.env.NODE_ENV || 'development'
    };
}

const config = validateEnv();

module.exports = config;
