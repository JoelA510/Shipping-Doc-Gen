const express = require('express');
const router = express.Router();
const { getJob, getDocument } = require('../queue');

// Get document by ID
router.get('/:id', async (req, res) => {
    try {
        const doc = await getDocument(req.params.id);
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        res.json(doc);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update document (Stub)
router.put('/:id', async (req, res) => {
    // In a real implementation, this would update the document in storage/DB
    // For now, we just echo back the data to simulate a successful update
    console.log(`Updating document ${req.params.id}`, req.body);
    res.json({ ...req.body, id: req.params.id });
});

const { generatePDF } = require('../services/generator');
const { saveFile } = require('../services/storage');

// Trigger export
router.post('/:id/export', async (req, res) => {
    const { type } = req.body;
    try {
        const doc = await getDocument(req.params.id);
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        console.log(`Generating PDF for document ${req.params.id} as ${type}`);
        const pdfBuffer = await generatePDF(doc, 'sli'); // Default to SLI for now

        const filename = `${req.params.id}-${type}-${Date.now()}.pdf`;
        const savedFile = await saveFile(pdfBuffer, filename);

        res.status(200).json({
            message: 'Export complete',
            url: savedFile.url,
            path: savedFile.path
        });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
