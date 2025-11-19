const express = require('express');
const multer = require('multer');
const { createJob } = require('../queue');

const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
});

router.post('/', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const job = createJob(req.file);
        res.status(202).json(job);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
