const { parseFile } = require('@shipping-doc-gen/ingestion');
const { v4: uuidv4 } = require('uuid');

// In-memory store for jobs
const jobs = new Map();
const documents = new Map();

async function processJob(jobId, file) {
    const job = jobs.get(jobId);
    if (!job) return;

    try {
        job.status = 'processing';
        job.updatedAt = new Date().toISOString();

        // Simulate some processing time if needed, or just call directly
        const ext = file.originalname.split('.').pop().toLowerCase();

        // Map mimetype/extension to ingestion types
        let type = 'pdf';
        if (ext === 'xlsx') type = 'xlsx';
        if (ext === 'csv') type = 'csv';
        if (ext === 'docx') type = 'docx';

        const result = await parseFile(file.buffer, type);

        // Store result
        const docId = uuidv4();
        documents.set(docId, {
            id: docId,
            jobId: jobId,
            ...result,
            createdAt: new Date().toISOString()
        });

        job.status = 'completed';
        job.documentId = docId;
        job.updatedAt = new Date().toISOString();
    } catch (error) {
        job.status = 'failed';
        job.error = error.message;
        job.updatedAt = new Date().toISOString();
    }
}

function createJob(file) {
    const id = uuidv4();
    const job = {
        id,
        status: 'pending',
        fileName: file.originalname,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    jobs.set(id, job);

    // Start processing asynchronously
    processJob(id, file);

    return job;
}

function getJob(id) {
    return jobs.get(id);
}

function getDocument(id) {
    return documents.get(id);
}

module.exports = {
    createJob,
    getJob,
    getDocument
};
