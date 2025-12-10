const authService = require('../src/services/auth');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

// Mock dependencies
jest.mock('../src/queue/index', () => ({
    prisma: {
        user: {
            findUnique: jest.fn(),
            create: jest.fn()
        }
    }
}));

jest.mock('../src/config', () => ({
    authSecret: 'test-secret',
    nodeEnv: 'test'
}));

const { prisma } = require('../src/queue/index');

describe('Auth Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.AUTH_SECRET = 'test-secret';
    });

    describe('login', () => {
        it('should return token for valid credentials', async () => {
            const mockUser = {
                id: '1',
                username: 'test',
                password: await bcrypt.hash('Password123', 10),
                role: 'user'
            };

            prisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await authService.login('test', 'Password123');

            expect(result).toHaveProperty('token');
            expect(result.user).toEqual({
                id: '1',
                username: 'test',
                role: 'user'
            });

            const decoded = jwt.verify(result.token, 'test-secret');
            expect(decoded.id).toBe('1');
        });

        it('should throw error for invalid password', async () => {
            const mockUser = {
                id: '1',
                username: 'test',
                password: await bcrypt.hash('Password123', 10)
            };

            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(authService.login('test', 'wrong')).rejects.toThrow('Invalid credentials');
        });

        it('should throw error for non-existent user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(authService.login('test', 'password')).rejects.toThrow('Invalid credentials');
        });
    });

    describe('register', () => {
        it('should throw error for short password', async () => {
            await expect(authService.register('newuser', 'short')).rejects.toThrow('Password must be at least 8 characters long');
        });

        it('should throw error for password without letters', async () => {
            await expect(authService.register('newuser', '12345678')).rejects.toThrow('Password must contain at least one letter');
        });

        it('should throw error for password without numbers', async () => {
            await expect(authService.register('newuser', 'password')).rejects.toThrow('Password must contain at least one number');
        });

        it('should register user with valid strong password', async () => {
            const mockUser = {
                id: '2',
                username: 'newuser',
                password: 'hashedpassword',
                role: 'user'
            };

            prisma.user.findUnique.mockResolvedValue(null);
            prisma.user.create.mockResolvedValue(mockUser);

            const result = await authService.register('newuser', 'StrongPass123');

            expect(result).toHaveProperty('token');
            expect(result.user.username).toBe('newuser');
        });
    });
});
