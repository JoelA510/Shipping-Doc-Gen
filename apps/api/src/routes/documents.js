const express = require('express');
const router = express.Router();
const { getJob, getDocument, updateDocument } = require('../queue');

// ... (existing code)

// Update document
router.put('/:id', async (req, res) => {
    const updated = updateDocument(req.params.id, req.body);
    if (!updated) {
        return res.status(404).json({ error: 'Document not found' });
    }
    console.log(`Updated document ${req.params.id}`);
    res.json(updated);
});

const { generatePDF } = require('../services/generator');
const { saveFile } = require('../services/storage');

// Trigger export
router.post('/:id/export', async (req, res) => {
    const { type, template } = req.body;
    try {
        const doc = await getDocument(req.params.id);
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // Map template names
        const templateMap = {
            'sli': 'sli',
            'dhl': 'dhl-invoice',
            'dhl-invoice': 'dhl-invoice',
            'bol': 'generic-bol',
            'generic-bol': 'generic-bol'
        };

        const templateName = templateMap[template] || 'sli'; // Default to SLI
        console.log(`Generating PDF for document ${req.params.id} as ${type} using template ${templateName}`);

        const pdfBuffer = await generatePDF(doc, templateName);

        const filename = `${req.params.id}-${type}-${Date.now()}.pdf`;
        const savedFile = await saveFile(pdfBuffer, filename);

        res.status(200).json({
            message: 'Export complete',
            url: savedFile.url,
            path: savedFile.path,
            template: templateName
        });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get history
router.get('/:id/history', async (req, res) => {
    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc.history || []);
});

// Get comments
router.get('/:id/comments', async (req, res) => {
    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    res.json(doc.comments || []);
});

// Add comment
router.post('/:id/comments', async (req, res) => {
    const doc = await getDocument(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const { text, user } = req.body;
    if (!text) return res.status(400).json({ error: 'Comment text required' });

    const comment = {
        id: Date.now().toString(),
        text,
        user: user || 'anonymous',
        timestamp: new Date().toISOString()
    };

    if (!doc.comments) doc.comments = [];
    doc.comments.push(comment);

    // Also add to history
    if (!doc.history) doc.history = [];
    doc.history.push({
        action: 'comment_added',
        timestamp: new Date().toISOString(),
        user: user || 'anonymous'
    });

    res.status(201).json(comment);
});

module.exports = router;
