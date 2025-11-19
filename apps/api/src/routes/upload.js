const express = require('express');
const multer = require('multer');
const { createJob } = require('../queue');
const AdmZip = require('adm-zip');
const { v4: uuidv4 } = require('uuid');
const { saveFile } = require('../services/storage');

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
        const jobs = [];
        const isZip = req.file.mimetype === 'application/zip' || req.file.originalname.toLowerCase().endsWith('.zip');

        if (isZip) {
            const zip = new AdmZip(req.file.buffer);
            const zipEntries = zip.getEntries();

            for (const entry of zipEntries) {
                if (!entry.isDirectory && !entry.entryName.startsWith('__MACOSX') && !entry.entryName.startsWith('.')) {
                    // Save extracted file to storage
                    const savedFile = await saveFile(entry.getData(), entry.name);

                    const jobData = {
                        originalname: entry.name,
                        storagePath: savedFile.path,
                        filename: savedFile.filename
                    };
                    const job = await createJob(jobData);
                    jobs.push(job);
                }
            }
        } else {
            // Save uploaded file to storage
            const savedFile = await saveFile(req.file.buffer, req.file.originalname);

            const jobData = {
                originalname: req.file.originalname,
                storagePath: savedFile.path,
                filename: savedFile.filename
            };
            const job = await createJob(jobData);
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
