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
                password: await bcrypt.hash('password', 10),
                role: 'user'
            };

            prisma.user.findUnique.mockResolvedValue(mockUser);

            const result = await authService.login('test', 'password');

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
                password: await bcrypt.hash('password', 10)
            };

            prisma.user.findUnique.mockResolvedValue(mockUser);

            await expect(authService.login('test', 'wrong')).rejects.toThrow('Invalid credentials');
        });

        it('should throw error for non-existent user', async () => {
            prisma.user.findUnique.mockResolvedValue(null);

            await expect(authService.login('test', 'password')).rejects.toThrow('Invalid credentials');
        });
    });
});
