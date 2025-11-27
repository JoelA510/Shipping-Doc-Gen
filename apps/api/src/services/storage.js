const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { validateEnv } = require('../config/env');

const config = validateEnv();

// Storage Provider Interface
class StorageProvider {
    async saveFile(buffer, originalName) { throw new Error('Not implemented'); }
    getFilePath(filename) { throw new Error('Not implemented'); }
}

// Local File System Provider
class LocalProvider extends StorageProvider {
    constructor() {
        super();
        if (!fs.existsSync(config.storagePath)) {
            fs.mkdirSync(config.storagePath, { recursive: true });
        }
    }

    async saveFile(buffer, originalName) {
        const fileId = uuidv4();
        const ext = path.extname(originalName);
        const filename = `${fileId}${ext}`;
        const filePath = path.join(config.storagePath, filename);

        await fs.promises.writeFile(filePath, buffer);

        return {
            path: filePath,
            url: `/files/${filename}`,
            filename
        };
    }

    getFilePath(filename) {
        return path.join(config.storagePath, filename);
    }
}

// S3 Cloud Provider
class S3Provider extends StorageProvider {
    constructor() {
        super();
        this.client = new S3Client({
            region: process.env.AWS_REGION || 'us-east-1',
            credentials: {
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            },
            endpoint: process.env.S3_ENDPOINT // Optional: for R2/MinIO
        });
        this.bucket = process.env.S3_BUCKET_NAME;
    }

    async saveFile(buffer, originalName) {
        const fileId = uuidv4();
        const ext = path.extname(originalName);
        const filename = `${fileId}${ext}`;

        await this.client.send(new PutObjectCommand({
            Bucket: this.bucket,
            Key: filename,
            Body: buffer,
            ContentType: 'application/octet-stream' // Should ideally detect mime type
        }));

        // If using Cloudflare R2 or public S3 bucket
        const publicUrl = process.env.S3_PUBLIC_URL
            ? `${process.env.S3_PUBLIC_URL}/${filename}`
            : `https://${this.bucket}.s3.amazonaws.com/${filename}`;

        return {
            path: filename, // S3 Key
            url: publicUrl,
            filename
        };
    }

    getFilePath(filename) {
        // For S3, this might return a signed URL or just the key
        // Current usage in app expects a local path for some operations (like PDF generation)
        // This is a limitation: PDF generation needs to be updated to handle streams if using S3
        // For now, we'll throw if trying to access local path
        throw new Error('Cannot get local file path for S3 storage');
    }
}

// Factory
const provider = process.env.STORAGE_PROVIDER === 's3'
    ? new S3Provider()
    : new LocalProvider();

module.exports = {
    saveFile: (buffer, name) => provider.saveFile(buffer, name),
    getFilePath: (filename) => provider.getFilePath(filename)
};
