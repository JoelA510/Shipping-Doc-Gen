const fs = require('fs');
const path = require('path');
const { validateEnv } = require('../config/env');

let storagePath;

try {
    const config = validateEnv();
    storagePath = config.storagePath;
    if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
    }
} catch (e) {
    // Fallback or handle error during startup
    console.warn('Storage path not configured or invalid');
}

async function saveFile(buffer, filename) {
    if (!storagePath) throw new Error('Storage not configured');
    const filePath = path.join(storagePath, filename);
    await fs.promises.writeFile(filePath, buffer);
    return filePath;
}

async function getFile(filename) {
    if (!storagePath) throw new Error('Storage not configured');
    const filePath = path.join(storagePath, filename);
    return fs.promises.readFile(filePath);
}

module.exports = {
    saveFile,
    getFile
};
