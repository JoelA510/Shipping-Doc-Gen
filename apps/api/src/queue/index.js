const { parseFile } = require('@formwaypoint/ingestion');
const { Queue, Worker } = require('bullmq');
const IORedis = require('ioredis');
const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Redis connection
const connection = new IORedis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
});

// Create Queue
const ingestionQueue = new Queue('ingestion', { connection });

// In-memory store for job status (still useful for immediate feedback, but DB is source of truth for docs)
const jobs = new Map();

// Worker processor
const worker = new Worker('ingestion', async job => {
    const { storagePath, filename, jobId } = job.data;

    // Update local job status
    const localJob = jobs.get(jobId);
    if (localJob) {
        localJob.status = 'processing';
        localJob.updatedAt = new Date().toISOString();
    }

    try {
        // Create initial document record
        const docRecord = await prisma.document.create({
            data: {
                filename,
                status: 'processing'
            }
        });

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

        // Update document with results
        const updatedDoc = await prisma.document.update({
            where: { id: docRecord.id },
            data: {
                status: 'completed',
                header: JSON.stringify(result.header),
                lines: JSON.stringify(result.lines),
                checksums: JSON.stringify(result.checksums),
                references: JSON.stringify(result.references),
                meta: JSON.stringify(result.meta)
            }
        });

        console.log('[Queue] Stored document:', updatedDoc.id);

        // Update job with document ID
        if (localJob) {
            localJob.status = 'completed';
            localJob.documentId = updatedDoc.id;
            localJob.updatedAt = new Date().toISOString();
        }

        // Track analytics
        const analytics = require('../services/analytics');
        analytics.trackEvent('document_processed', {
            fileName: filename,
            type,
            documentId: updatedDoc.id
        });

        return { documentId: updatedDoc.id };
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

async function getDocument(id) {
    const doc = await prisma.document.findUnique({
        where: { id },
        include: { comments: true, auditLogs: true }
    });

    if (doc) {
        // Parse JSON fields back to objects
        return {
            ...doc,
            header: doc.header ? JSON.parse(doc.header) : null,
            lines: doc.lines ? JSON.parse(doc.lines) : [],
            checksums: doc.checksums ? JSON.parse(doc.checksums) : null,
            references: doc.references ? JSON.parse(doc.references) : [],
            meta: doc.meta ? JSON.parse(doc.meta) : null,
            createdAt: doc.createdAt.toISOString(),
            updatedAt: doc.updatedAt.toISOString()
        };
    }
    return null;
}

async function updateDocument(id, data) {
    try {
        // Prepare data for update (stringify JSON fields if present)
        const updateData = {};
        if (data.status) updateData.status = data.status;
        if (data.header) updateData.header = JSON.stringify(data.header);
        if (data.lines) updateData.lines = JSON.stringify(data.lines);

        const doc = await prisma.document.update({
            where: { id },
            data: updateData
        });

        return {
            ...doc,
            header: doc.header ? JSON.parse(doc.header) : null,
            lines: doc.lines ? JSON.parse(doc.lines) : [],
            createdAt: doc.createdAt.toISOString(),
            updatedAt: doc.updatedAt.toISOString()
        };
    } catch (error) {
        console.error('Error updating document:', error);
        return null;
    }
}

module.exports = {
    createJob,
    getJob,
    getDocument,
    updateDocument,
    prisma // Export prisma for other modules
};
