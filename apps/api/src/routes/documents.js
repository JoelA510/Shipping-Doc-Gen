const express = require('express');
const router = express.Router();
const { getJob, getDocument, updateDocument, prisma } = require('../queue');

// Get all documents (with pagination and filters)
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Build filter conditions
        const where = {};

        // Date range filter
        if (req.query.startDate || req.query.endDate) {
            where.createdAt = {};
            if (req.query.startDate) {
                where.createdAt.gte = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                const endDate = new Date(req.query.endDate);
                endDate.setHours(23, 59, 59, 999); // End of day
                where.createdAt.lte = endDate;
            }
        }

        // Status filter
        if (req.query.status) {
            where.status = req.query.status;
        }

        // Filename search (simple text contains)
        if (req.query.search) {
            where.filename = {
                contains: req.query.search
            };
        }

        const [docs, total] = await Promise.all([
            prisma.document.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' }
            }),
            prisma.document.count({ where })
        ]);

        // Parse JSON fields and apply post-query filters
        let parsedDocs = docs.map(doc => ({
            ...doc,
            header: doc.header ? JSON.parse(doc.header) : null,
            lines: doc.lines ? JSON.parse(doc.lines) : [],
            checksums: doc.checksums ? JSON.parse(doc.checksums) : null,
            references: doc.references ? JSON.parse(doc.references) : [],
            meta: doc.meta ? JSON.parse(doc.meta) : null,
        }));

        // Value range filter (post-query since totalValue is in JSON)
        if (req.query.minValue || req.query.maxValue) {
            parsedDocs = parsedDocs.filter(doc => {
                const totalValue = doc.header?.totalValue || 0;
                const min = req.query.minValue ? parseFloat(req.query.minValue) : -Infinity;
                const max = req.query.maxValue ? parseFloat(req.query.maxValue) : Infinity;
                return totalValue >= min && totalValue <= max;
            });
        }

        // Carrier filter (post-query based on meta)
        if (req.query.carrier) {
            parsedDocs = parsedDocs.filter(doc => {
                return doc.meta?.carrier === req.query.carrier;
            });
        }

        res.json({
            data: parsedDocs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            },
            filters: {
                search: req.query.search,
                status: req.query.status,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
                minValue: req.query.minValue,
                maxValue: req.query.maxValue,
                carrier: req.query.carrier
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single document
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

// Update document
router.put('/:id', async (req, res) => {
    try {
        const updated = await updateDocument(req.params.id, req.body);
        if (!updated) {
            return res.status(404).json({ error: 'Document not found' });
        }
        console.log(`Updated document ${req.params.id}`);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
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

        const { TEMPLATE_MAP } = require('../config/templates');
        const templateName = TEMPLATE_MAP[template] || 'sli'; // Default to SLI

        const { addJob } = require('../queue'); // Lazy load or move to top
        const job = await addJob('GENERATE_PDF', {
            data: doc, // Passing full doc data
            templateName,
            documentId: req.params.id,
            type
        });

        res.status(202).json({
            message: 'Export started',
            jobId: job.id,
            statusUrl: `/jobs/${job.id}`
        });
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get history (Audit Logs)
router.get('/:id/history', async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            where: { documentId: req.params.id },
            orderBy: { timestamp: 'desc' },
            include: { user: { select: { username: true } } }
        });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get comments
router.get('/:id/comments', async (req, res) => {
    try {
        const comments = await prisma.comment.findMany({
            where: { documentId: req.params.id },
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { username: true } } }
        });
        res.json(comments);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add comment
router.post('/:id/comments', async (req, res) => {
    try {
        const { text, user } = req.body; // user is currently just a string from frontend, need to map to real user ID
        // In a real app with auth middleware, we'd get req.user.id

        // For now, find the user by username or create a dummy one if not exists (migration path)
        // Ideally we should use req.user.id from the token
        let userId;
        if (req.user && req.user.id) {
            userId = req.user.id;
        } else {
            // Fallback for now: find user by username 'admin' or create one
            const admin = await prisma.user.upsert({
                where: { username: 'admin' },
                update: {},
                create: { username: 'admin', password: 'hashed_password_placeholder' }
            });
            userId = admin.id;
        }

        if (!text) return res.status(400).json({ error: 'Comment text required' });

        const comment = await prisma.comment.create({
            data: {
                text,
                documentId: req.params.id,
                userId: userId
            },
            include: { user: { select: { username: true } } }
        });

        // Add audit log
        await prisma.auditLog.create({
            data: {
                action: 'comment_added',
                documentId: req.params.id,
                userId: userId,
                details: JSON.stringify({ text })
            }
        });

        res.status(201).json(comment);
    } catch (error) {
        console.error('Comment error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
