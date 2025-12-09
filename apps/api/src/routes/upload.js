const express = require('express');
const multer = require('multer');
const { createJob } = require('../queue');
const { saveFile } = require('../services/storage');
const { validateFileSignature } = require('../utils/fileValidation');
const yauzl = require('yauzl');
const path = require('path');

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

        const jobs = [];
        const isZip = req.file.mimetype === 'application/zip' ||
            req.file.mimetype === 'application/x-zip-compressed' ||
            req.file.originalname.toLowerCase().endsWith('.zip');

        if (isZip) {
            // 2. Secure ZIP Processing with yauzl
            await new Promise((resolve, reject) => {
                yauzl.fromBuffer(req.file.buffer, { lazyEntries: true }, (err, zipfile) => {
                    if (err) return reject(err);

                    zipfile.readEntry();

                    zipfile.on('entry', (entry) => {
                        // Zip Slip Protection
                        if (entry.fileName.includes('..') || path.isAbsolute(entry.fileName)) {
                            // Dangerous path detected, abort processing this file
                            // We could reject the whole upload, or just skip this entry.
                            // For security, rejecting the whole upload is often safer to warn the user.
                            return reject(new Error('Malicious zip entry detected (Zip Slip)'));
                        }

                        if (/\/$/.test(entry.fileName)) {
                            // Directory entry, skip
                            zipfile.readEntry();
                        } else {
                            // File entry
                            zipfile.openReadStream(entry, async (err, readStream) => {
                                if (err) return reject(err);

                                const chunks = [];
                                readStream.on('data', chunk => chunks.push(chunk));
                                readStream.on('end', async () => {
                                    const fileBuffer = Buffer.concat(chunks);

                                    try {
                                        const savedFile = await saveFile(fileBuffer, entry.fileName);
                                        const jobData = {
                                            originalname: entry.fileName,
                                            storagePath: savedFile.path,
                                            filename: savedFile.filename
                                        };
                                        const job = await createJob(jobData);
                                        jobs.push(job);
                                        zipfile.readEntry(); // Next
                                    } catch (saveErr) {
                                        reject(saveErr);
                                    }
                                });
                            });
                        }
                    });

                    zipfile.on('end', resolve);
                    zipfile.on('error', reject);
                });
            });

        } else {
            // Save uploaded file to storage (Direct file)
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
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
