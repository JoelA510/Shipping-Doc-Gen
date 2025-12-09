const request = require('supertest');
const yauzl = require('yauzl');
const EventEmitter = require('events');

jest.mock('nodemailer', () => ({
    createTransporter: jest.fn().mockReturnValue({
        sendMail: jest.fn().mockResolvedValue(true)
    })
}));

jest.mock('../src/config/env', () => ({
    validateEnv: jest.fn(),
    config: {
        env: 'test',
        port: 3000
    }
}));

// Mock dependencies
jest.mock('../src/middleware/auth', () => ({
    requireAuth: (req, res, next) => {
        req.user = { id: 'test-user' };
        next();
    }
}));

jest.mock('../src/services/storage', () => ({
    saveFile: jest.fn().mockResolvedValue({ path: '/tmp/mock', filename: 'mock-file' })
}));

jest.mock('../src/queue', () => ({
    createJob: jest.fn().mockResolvedValue({ id: 'job-123' })
}));

jest.mock('yauzl');

// Import app AFTER mocking
const app = require('../src/index');

describe('POST /upload Security Tests', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should upload a valid PDF file (checking signature)', async () => {
        // Construct a minimal PDF buffer
        const pdfBuffer = Buffer.from('%PDF-1.4\n%RW');

        const res = await request(app)
            .post('/upload')
            .attach('file', pdfBuffer, { filename: 'test.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(202);
        expect(res.body.message).toMatch(/Enqueued 1 document/);
    });

    it('should reject a fake PDF (signature mismatch)', async () => {
        const textBuffer = Buffer.from('Just text');

        const res = await request(app)
            .post('/upload')
            .attach('file', textBuffer, { filename: 'fake.pdf', contentType: 'application/pdf' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/File signature mismatch|Could not detect file type/);
    });

    it('should reject execution of malware.exe', async () => {
        const exeBuffer = Buffer.from('MZxxxxx'); // PE header magic

        const res = await request(app)
            .post('/upload')
            .attach('file', exeBuffer, { filename: 'malware.exe', contentType: 'application/x-msdownload' });

        expect(res.status).toBe(400);
        // Either FileType disallowed OR signature mismatch (if file-type detects 'application/x-dosexec')
        expect(res.body.error).toMatch(/is not allowed|signature mismatch/);
    });

    it('should reject a ZIP entry with Zip Slip paths', async () => {
        // Mock yauzl behavior for this test
        const mockZipFile = new EventEmitter();
        mockZipFile.readEntry = jest.fn();
        mockZipFile.openReadStream = jest.fn();

        yauzl.fromBuffer.mockImplementation((buffer, options, callback) => {
            callback(null, mockZipFile);
            // Simulate reading an entry
            process.nextTick(() => {
                mockZipFile.emit('entry', { fileName: '../../etc/passwd' });
            });
        });

        // We need a buffer that looks like a zip signature-wise, 
        // otherwise validateFileSignature will fail before yauzl is called.
        // PK\x03\x04 is zip signature
        const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00]);

        const res = await request(app)
            .post('/upload')
            .attach('file', zipBuffer, { filename: 'malicious.zip', contentType: 'application/zip' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Malicious zip entry/);
    });

    it('should process a valid ZIP file', async () => {
        // Mock yauzl behavior for valid zip
        const mockZipFile = new EventEmitter();
        mockZipFile.readEntry = jest.fn();
        mockZipFile.openReadStream = jest.fn((entry, cb) => {
            const stream = new EventEmitter(); // mock read stream
            cb(null, stream);
            process.nextTick(() => {
                stream.emit('data', Buffer.from('content'));
                stream.emit('end');
            });
        });

        yauzl.fromBuffer.mockImplementation((buffer, options, callback) => {
            callback(null, mockZipFile);

            // Emit one valid entry then end
            process.nextTick(() => {
                mockZipFile.emit('entry', { fileName: 'safe.txt' });
                // We need to trigger "end" after the entry is processed.
                // In the real code, we call readEntry() again.
                // But tests update the mocks before readEntry is called? No.
                // Simplified: The code calls readEntry(). We don't need to simulate the loop perfectly 
                // just that it passed the first one.
                // Actually, the code waits for 'end' on zipfile.
                setTimeout(() => {
                    mockZipFile.emit('end');
                }, 50);
            });
        });

        const zipBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x00]);

        const res = await request(app)
            .post('/upload')
            .attach('file', zipBuffer, { filename: 'good.zip', contentType: 'application/zip' });

        expect(res.status).toBe(202);
    });

});
