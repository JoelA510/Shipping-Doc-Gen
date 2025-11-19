process.env.AUTH_SECRET = 'test-secret';
process.env.STORAGE_PATH = './test-storage';
process.env.PORT = '3003';

const request = require('supertest');
// Mock queue BEFORE requiring app
jest.mock('../src/queue/index', () => ({
    createJob: jest.fn((file) => ({
        id: 'mock-job-id',
        status: 'pending',
        fileName: file.originalname,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    })),
    getJob: jest.fn((id) => ({
        id,
        status: 'completed',
        documentId: 'mock-doc-id',
        updatedAt: new Date().toISOString()
    })),
    getDocument: jest.fn((id) => ({
        id,
        header: { shipper: 'Mock Shipper' },
        lines: [{ partNumber: '123', description: 'Mock Item' }]
    }))
}));

const app = require('../src/index');
const path = require('path');

describe('API Integration', () => {
    it('should upload a file, process it, and retrieve the result', async () => {
        // 1. Upload File
        const uploadRes = await request(app)
            .post('/upload')
            .set('Authorization', 'Bearer test-secret')
            .attach('file', path.join(__dirname, '../../../services/ingestion/tests/golden/pdf/sample.pdf'));

        expect(uploadRes.statusCode).toBe(202);
        expect(uploadRes.body.jobs).toBeDefined();
        expect(uploadRes.body.jobs.length).toBe(1);
        expect(uploadRes.body.jobs[0].status).toBe('pending');

        const jobId = uploadRes.body.jobs[0].id;

        // 2. Poll for Status (wait for processing)
        let jobStatus = 'pending';
        let jobRes;
        let attempts = 0;
        while (jobStatus !== 'completed' && jobStatus !== 'failed' && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
            jobRes = await request(app)
                .get(`/jobs/${jobId}`)
                .set('Authorization', 'Bearer test-secret');
            jobStatus = jobRes.body.status;
            attempts++;
        }

        expect(jobStatus).toBe('completed');
        expect(jobRes.body.documentId).toBeDefined();

        const docId = jobRes.body.documentId;

        // 3. Get Document
        const docRes = await request(app)
            .get(`/documents/${docId}`)
            .set('Authorization', 'Bearer test-secret');
        expect(docRes.statusCode).toBe(200);
        expect(docRes.body.header).toBeDefined();
        expect(docRes.body.lines).toBeDefined();
        expect(docRes.body.lines.length).toBeGreaterThan(0);
    });
});
