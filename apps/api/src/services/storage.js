const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { validateEnv } = require('../config/env');

const config = validateEnv();

// Ensure storage directory exists
if (!fs.existsSync(config.storagePath)) {
    fs.mkdirSync(config.storagePath, { recursive: true });
}

/**
 * Save a buffer to disk
 * @param {Buffer} buffer - File content
 * @param {string} originalName - Original filename
 * @returns {Promise<{path: string, url: string, filename: string}>}
 */
async function saveFile(buffer, originalName) {
    const fileId = uuidv4();
    const ext = path.extname(originalName);
    const filename = `${fileId}${ext}`;
    const filePath = path.join(config.storagePath, filename);

    await fs.promises.writeFile(filePath, buffer);

    // In a real app, this would generate a signed URL.
    // For now, we return a local file path URI or a mock URL.
    const url = `/files/${filename}`;

    return {
        path: filePath,
        url,
        filename
    };
}

/**
 * Get file path from filename
 * @param {string} filename 
 * @returns {string}
 */
function getFilePath(filename) {
    return path.join(config.storagePath, filename);
}

module.exports = {
    saveFile,
    getFilePath
};
