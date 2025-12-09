const express = require('express');
const multer = require('multer');
const { addJob } = require('../queue');
const { saveFile } = require('../services/storage');
const { validateFileSignature } = require('../utils/fileValidation');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // 1. Validate File Signature
        await validateFileSignature(req.file.buffer, req.file.mimetype);

        // 2. Save file to disk (temp or permanent storage) so worker can access it
        // We use saveFile service which likely puts it in 'storage/uploads'
        const savedFile = await saveFile(req.file.buffer, req.file.originalname);

        const isZip = req.file.mimetype === 'application/zip' ||
            req.file.mimetype === 'application/x-zip-compressed' ||
            req.file.originalname.toLowerCase().endsWith('.zip');

        // 3. Enqueue Job
        const jobName = isZip ? 'PROCESS_UPLOAD' : 'PROCESS_SINGLE_FILE';
        const job = await addJob(jobName, {
            filePath: savedFile.path,
            filename: savedFile.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype
        });

        res.status(202).json({
            message: 'File upload accepted for processing',
            jobId: job.id,
            statusUrl: `/jobs/${job.id}`
        });

    } catch (error) {
        console.error('Upload error:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
