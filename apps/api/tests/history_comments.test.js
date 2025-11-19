// Set env vars before requiring app
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.STORAGE_PATH = '/tmp/storage';
process.env.AUTH_SECRET = 'test-secret';
process.env.PORT = '3003';

const request = require('supertest');
const app = require('../src/index');
const { createJob } = require('../src/queue');

// Mock queue to avoid Redis connection
jest.mock('../src/queue', () => ({
    createJob: jest.fn(),
    getJob: jest.fn(),
    getDocument: jest.fn(),
    documents: new Map()
}));

// Mock storage
jest.mock('../src/services/storage', () => ({
    saveFile: jest.fn().mockResolvedValue('/tmp/mock-file'),
    getFilePath: jest.fn().mockReturnValue('/tmp/mock-file')
}));

describe('Document History and Comments', () => {
    let token;
    let docId = 'test-doc-id';

    beforeAll(async () => {
        // Register and login to get token
        await request(app)
            .post('/auth/register')
            .send({ username: 'testuser', password: 'password' });

        const res = await request(app)
            .post('/auth/login')
            .send({ username: 'testuser', password: 'password' });

        token = res.body.token;

        // Manually seed a document in the mocked queue module
        // Since we mocked the module, we need to access the mocked implementation or just rely on the route using the mocked getDocument
        // But wait, the route uses `getDocument` from `../queue/index`.
        // If we mocked `../queue`, we need to make `getDocument` return something.

        const { documents } = require('../src/queue');
        documents.set(docId, {
            id: docId,
            header: { shipper: 'Test Shipper' },
            lines: [],
            history: [],
            comments: []
        });

        const queue = require('../src/queue');
        queue.getDocument.mockImplementation(async (id) => documents.get(id));
    });

    it('should add a comment to a document', async () => {
        const res = await request(app)
            .post(`/documents/${docId}/comments`)
            .set('Authorization', `Bearer ${token}`)
            .send({ text: 'This is a test comment', user: 'testuser' });

        expect(res.statusCode).toBe(201);
        expect(res.body.text).toBe('This is a test comment');
        expect(res.body.user).toBe('testuser');
    });

    it('should retrieve comments for a document', async () => {
        const res = await request(app)
            .get(`/documents/${docId}/comments`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(1);
        expect(res.body[0].text).toBe('This is a test comment');
    });

    it('should retrieve history for a document', async () => {
        const res = await request(app)
            .get(`/documents/${docId}/history`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        // Should have at least the comment_added event
        const commentEvent = res.body.find(h => h.action === 'comment_added');
        expect(commentEvent).toBeDefined();
        expect(commentEvent.user).toBe('testuser');
    });
});
