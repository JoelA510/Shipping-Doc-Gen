const express = require('express');
const path = require('path');
const fs = require('fs');
const { validateEnv } = require('../config/env');

const router = express.Router();
const config = validateEnv();

router.get('/:filename', (req, res) => {
    const { filename } = req.params;

    // Basic path traversal protection
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename' });
    }

    const filePath = path.join(config.storagePath, filename);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }

    // Stream the file
    res.sendFile(filePath);
});

module.exports = router;
