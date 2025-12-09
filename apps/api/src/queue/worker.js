const { Worker } = require('bullmq');
const { connection } = require('./index');
const { generatePDF } = require('../services/generator');
const { saveFile } = require('../services/storage'); // You might need to adjust this depending on how upload logic is moved
// Note: secure zip uploading logic is currently inside the route. 
// Ideally we move the "processing" logic (parsing ZIP, saving entries) here.
// But for Step 1, let's assume we pass the file path or similar.

// Actually, looking at the route, it processes the buffer in memory. 
// For a true async queue, we should save the raw upload to a temp location FIRST, 
// then pass the path to the worker.
// However, yauzl works on buffers or files. 
// Let's implement the worker to handle "GENERATE_PDF" first as it's cleaner, 
// and "PROCESS_UPLOAD" might need more refactoring of the upload route to save-then-process.

const processor = async (job) => {
    switch (job.name) {
        case 'GENERATE_PDF':
            console.log(`[Worker] Processing PDF generation for job ${job.id}`);
            // job.data should contain { templateName, data }
            const result = await generatePDF(job.data.data, job.data.templateName);
            // We might want to save the result to storage/db instead of just returning buffer
            // For now, let's assuming generatePDF might need to change to save the file.
            // OR we return the path?
            // "generatePDF" currently returns a buffer.
            // We should save it.
            const fs = require('fs');
            const path = require('path');
            const outputPath = path.join(__dirname, '../../storage/outputs', `job-${job.id}.pdf`);

            // Ensure dir exists
            if (!fs.existsSync(path.dirname(outputPath))) {
                fs.mkdirSync(path.dirname(outputPath), { recursive: true });
            }

            fs.writeFileSync(outputPath, result);
            return { path: outputPath, filename: `job-${job.id}.pdf` };

        case 'PROCESS_UPLOAD':
            // Placeholder for now as refactoring the ZIP stream logic is complex
            // and might require saving the temp file first.
            console.log(`[Worker] Processing Upload for job ${job.id}`);
            return { status: 'processed' };

        default:
            throw new Error(`Unknown job name: ${job.name}`);
    }
};

const worker = new Worker('shipping-doc-gen-queue', processor, {
    connection,
    concurrency: 5 // Process 5 jobs at a time
});

worker.on('completed', (job, returnvalue) => {
    console.log(`[Worker] Job ${job.id} completed! Result:`, returnvalue);
});

worker.on('failed', (job, error) => {
    console.error(`[Worker] Job ${job.id} failed:`, error);
});

console.log('[Worker] Queue worker started');

module.exports = {
    worker
};
