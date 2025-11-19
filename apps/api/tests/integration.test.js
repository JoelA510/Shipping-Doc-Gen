// Set env vars before requiring app
process.env.REDIS_HOST = 'localhost';
process.env.REDIS_PORT = '6379';
process.env.STORAGE_PATH = '/tmp/storage';
process.env.AUTH_SECRET = 'test-secret';
process.env.PORT = '3003';

const request = require('supertest');

// Mock queue to avoid Redis connection
jest.mock('../src/queue', () => ({
    createJob: jest.fn().mockResolvedValue({ id: 'mock-job-id', status: 'pending' }),
    getJob: jest.fn().mockResolvedValue({ id: 'mock-job-id', status: 'complete', docId: 'mock-doc-id' }),
    getDocument: jest.fn().mockResolvedValue({
        id: 'mock-doc-id',
        header: { shipper: 'Test Company' },
        lines: [],
        meta: {}
    }),
    ingestionQueue: {
        getJobCounts: jest.fn().mockResolvedValue({ waiting: 0, active: 0, completed: 0, failed: 0 })
    }
}));

// Mock storage
jest.mock('../src/services/storage', () => ({
    saveFile: jest.fn().mockResolvedValue('/tmp/mock-file'),
    getFilePath: jest.fn().mockReturnValue('/tmp/mock-file')
}));

// Mock generator
jest.mock('../src/services/generator', () => ({
    generatePDF: jest.fn(() => Promise.resolve(Buffer.from('mock-pdf-content')))
}));

const app = require('../src/index');
const path = require('path');

describe('API Integration', () => {
    let testToken;

    beforeAll(async () => {
        // Register and login to get a valid JWT token
        await request(app)
            .post('/auth/register')
            .send({ username: 'testuser', password: 'testpass' });

        const res = await request(app)
            .post('/auth/login')
            .send({ username: 'testuser', password: 'testpass' });

        testToken = res.body.token;
    });

    it('should upload a file, process it, and retrieve the result', async () => {
        const uploadRes = await request(app)
            .post('/upload')
            .set('Authorization', `Bearer ${testToken}`)
            .attach('file', path.join(__dirname, '../../../services/ingestion/tests/golden/pdf/sample.pdf'));

        expect(uploadRes.statusCode).toBe(202);
        expect(uploadRes.body.jobs).toBeDefined();
        expect(uploadRes.body.jobs.length).toBe(1);
        expect(uploadRes.body.jobs[0].status).toBe('pending');

        const jobId = uploadRes.body.jobs[0].id;
        const docId = uploadRes.body.jobs[0].docId || 'mock-doc-id';

        const statusRes = await request(app)
            .get(`/jobs/${jobId}`)
            .set('Authorization', `Bearer ${testToken}`);

        expect(statusRes.statusCode).toBe(200);
        expect(statusRes.body.status).toBeDefined();

        const docRes = await request(app)
            .get(`/documents/${docId}`)
            .set('Authorization', `Bearer ${testToken}`);

        expect(docRes.statusCode).toBe(200);
        expect(docRes.body.header).toBeDefined();
    });

    it('should update a document', async () => {
        const docId = 'mock-doc-id';
        const updateData = {
            header: { shipper: 'Updated Shipper' },
            lines: []
        };

        const res = await request(app)
            .put(`/documents/${docId}`)
            .set('Authorization', `Bearer ${testToken}`)
            .send(updateData);

        expect(res.statusCode).toBe(200);
        expect(res.body.header.shipper).toBe('Updated Shipper');
    });

    it('should trigger an export', async () => {
        const docId = 'mock-doc-id';
        const res = await request(app)
            .post(`/documents/${docId}/export`)
            .set('Authorization', `Bearer ${testToken}`)
            .send({ type: 'sli' });

        expect(res.statusCode).toBe(200);
        expect(res.body.message).toBe('Export complete');
        expect(res.body.url).toBeDefined();
    });
});
