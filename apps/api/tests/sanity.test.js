// Mock env validation
jest.mock('../src/config/env', () => ({
    validateEnv: () => ({
        port: 3003,
        storagePath: '/tmp/storage',
        authSecret: 'test-secret',
        redis: { host: 'localhost', port: 6379 },
        nodeEnv: 'test'
    })
}));

// Mock queue
jest.mock('../src/queue', () => ({
    prisma: {
        $connect: jest.fn(),
        $disconnect: jest.fn()
    }
}));

// Mock nodemailer
jest.mock('nodemailer', () => ({
    createTransporter: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue(true)
    })
}));

describe('Sanity Check', () => {
    it('should import app without crashing', () => {
        const app = require('../src/index');
        expect(app).toBeDefined();
    });
});
