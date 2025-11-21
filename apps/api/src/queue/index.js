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
    const { storagePath, filename, jobId } = job.data;

    // Update local job status (simulating DB update)
    const localJob = jobs.get(jobId);
    if (localJob) {
        localJob.status = 'processing';
        localJob.updatedAt = new Date().toISOString();
    }

    try {
        const ext = filename.split('.').pop().toLowerCase();

        // Map mimetype/extension to ingestion types
        let type = 'pdf';
        if (ext === 'xlsx') type = 'xlsx';
        if (ext === 'csv') type = 'csv';
        if (ext === 'docx') type = 'docx';

        // Read file from storage
        const fs = require('fs').promises;
        const buffer = await fs.readFile(storagePath);

        const result = await parseFile(buffer, type);

        // Store result
        const docId = uuidv4();
        const doc = {
            id: docId,
            fileName: filename,
            header: result.header,
            lines: result.lines,
            checksums: result.checksums,
            meta: result.meta,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        documents.set(docId, doc);

        // Update job with document ID
        if (localJob) {
            localJob.status = 'completed';
            localJob.documentId = docId;
            localJob.updatedAt = new Date().toISOString();
        }

        // Track analytics
        const analytics = require('../services/analytics');
        analytics.trackEvent('document_processed', {
            fileName: filename,
            type,
            documentId: docId
        });

        return { documentId: docId };
    } catch (error) {
        console.error('Processing error:', error);
        if (localJob) {
            localJob.status = 'failed';
            localJob.error = error.message;
            localJob.updatedAt = new Date().toISOString();
        }

        // Track analytics
        const analytics = require('../services/analytics');
        analytics.trackEvent('processing_failed', {
            fileName: filename,
            error: error.message
        });

        throw error;
    }
}, { connection });

worker.on('completed', (job) => {
    console.log(`Job ${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    console.log(`Job ${job.id} has failed with ${err.message}`);
});

async function createJob(jobData) {
    const id = uuidv4();
    const job = {
        id,
        status: 'pending',
        fileName: jobData.originalname,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    jobs.set(id, job);

    // Add to BullMQ
    await ingestionQueue.add('parse', {
        jobId: id,
        filename: jobData.filename,
        storagePath: jobData.storagePath
    });

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
