const { parseFile } = require('@shipping-doc-gen/ingestion');
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const { v4: uuidv4 } = require('uuid');

// Redis connection
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
});

// Create Queue
const ingestionQueue = new Queue('ingestion', { connection });

// In-memory store for job status (for simple polling) and documents
// In a real app, this would be in Redis or a DB
const jobs = new Map();
const documents = new Map();

// Worker processor
const worker = new Worker('ingestion', async job => {
    const { fileBuffer, fileName, jobId } = job.data;
    
    // Update local job status (simulating DB update)
    const localJob = jobs.get(jobId);
    if (localJob) {
        localJob.status = 'processing';
        localJob.updatedAt = new Date().toISOString();
    }

    try {
        const ext = fileName.split('.').pop().toLowerCase();
        
        // Map mimetype/extension to ingestion types
        let type = 'pdf';
        if (ext === 'xlsx') type = 'xlsx';
        if (ext === 'csv') type = 'csv';
        if (ext === 'docx') type = 'docx';

        // Convert buffer back from JSON/base64 if needed (BullMQ serializes args)
        // But here we are passing buffer directly? BullMQ handles JSON.
        // Buffer needs to be reconstructed from the serialized object if passed as object
        const buffer = Buffer.from(fileBuffer.data);

        const result = await parseFile(buffer, type);

        // Store result
        const docId = uuidv4();
        const doc = {
            id: docId,
            jobId: jobId,
            ...result,
            createdAt: new Date().toISOString()
        };
        documents.set(docId, doc);

        if (localJob) {
            localJob.status = 'completed';
            localJob.documentId = docId;
            localJob.updatedAt = new Date().toISOString();
        }

        return { documentId: docId };
    } catch (error) {
        if (localJob) {
            localJob.status = 'failed';
            localJob.error = error.message;
            localJob.updatedAt = new Date().toISOString();
        }
        throw error;
    }
}, { connection });

worker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    console.log(`Job ${job.id} has failed with ${err.message}`);
});

async function createJob(file) {
    const id = uuidv4();
    const jobData = {
        id,
        status: 'pending',
        fileName: file.originalname,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    jobs.set(id, jobData);

    // Add to BullMQ
    await ingestionQueue.add('parse', {
        jobId: id,
        fileName: file.originalname,
        fileBuffer: file.buffer // BullMQ will serialize this
    });

    return jobData;
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
