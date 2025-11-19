const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });
const PORT = process.env.PORT || 5000;

app.post('/extract', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // In a real implementation, this would use Tesseract or similar.
        // For now, we use pdf-parse as a "better than nothing" stub, 
        // or we could return dummy text if we want to simulate OCR on images.
        // But since the goal is "OCR stub", let's just try to extract text 
        // using pdf-parse again (which might be redundant if the caller already tried it,
        // but this service is supposed to handle "scanned" PDFs, so maybe we should 
        // simulate OCR by just returning some text or using a real OCR lib if available).
        // Given we don't have tesseract installed in the environment, we'll stick to pdf-parse
        // but maybe add a note or a "simulated" delay.

        const data = await pdf(req.file.buffer);

        res.json({
            text: data.text,
            info: data.info,
            metadata: data.metadata,
            version: data.version,
            numpages: data.numpages
        });
    } catch (error) {
        console.error('OCR Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.listen(PORT, () => {
    console.log(`OCR Service running on port ${PORT}`);
});
