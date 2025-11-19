const request = require('supertest');
const app = require('../src/index');
const path = require('path');

describe('API Integration', () => {
    it('should upload a file, process it, and retrieve the result', async () => {
        // 1. Upload File
        const uploadRes = await request(app)
            .post('/upload')
            .attach('file', path.join(__dirname, '../../../services/ingestion/tests/golden/pdf/sample.pdf'));

        expect(uploadRes.statusCode).toBe(202);
        expect(uploadRes.body.id).toBeDefined();
        expect(uploadRes.body.status).toBe('pending');

        const jobId = uploadRes.body.id;

        // 2. Poll for Status (wait for processing)
        let jobStatus = 'pending';
        let jobRes;
        let attempts = 0;
        while (jobStatus !== 'completed' && jobStatus !== 'failed' && attempts < 10) {
            await new Promise(resolve => setTimeout(resolve, 100)); // Wait 100ms
            jobRes = await request(app).get(`/jobs/${jobId}`);
            jobStatus = jobRes.body.status;
            attempts++;
        }

        expect(jobStatus).toBe('completed');
        expect(jobRes.body.documentId).toBeDefined();

        const docId = jobRes.body.documentId;

        // 3. Get Document
        const docRes = await request(app).get(`/documents/${docId}`);
        expect(docRes.statusCode).toBe(200);
        expect(docRes.body.header).toBeDefined();
        expect(docRes.body.lines).toBeDefined();
        expect(docRes.body.lines.length).toBeGreaterThan(0);
    });
});
