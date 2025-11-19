const express = require('express');
const multer = require('multer');
const { createJob } = require('../queue');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

const AdmZip = require('adm-zip');
const { v4: uuidv4 } = require('uuid');

router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const jobs = [];
        const isZip = req.file.mimetype === 'application/zip' || req.file.originalname.toLowerCase().endsWith('.zip');

        if (isZip) {
            const zip = new AdmZip(req.file.buffer);
            const zipEntries = zip.getEntries();

            for (const entry of zipEntries) {
                if (!entry.isDirectory && !entry.entryName.startsWith('__MACOSX') && !entry.entryName.startsWith('.')) {
                    // Create a pseudo-file object for the queue
                    const fileData = {
                        originalname: entry.name,
                        buffer: entry.getData()
                    };
                    const job = await createJob(fileData);
                    jobs.push(job);
                }
            }
        } else {
            const job = await createJob(req.file);
            jobs.push(job);
        }

        res.status(202).json({
            message: `Enqueued ${jobs.length} document(s)`,
            jobs
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
