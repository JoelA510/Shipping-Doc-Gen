const express = require('express');
const router = express.Router();
const { prisma } = require('../queue');

// Search HTS codes by code or description
router.get('/hts', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({ error: 'Query must be at least 2 characters' });
        }

        const searchTerm = q.trim();

        // Search by code (exact or prefix match) or description (contains)
        const codes = await prisma.htsCode.findMany({
            where: {
                OR: [
                    { code: { contains: searchTerm } },
                    { description: { contains: searchTerm } }
                ]
            },
            take: 20, // Limit results
            orderBy: { code: 'asc' }
        });

        res.json({
            query: searchTerm,
            count: codes.length,
            results: codes
        });
    } catch (error) {
        console.error('HTS search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get single HTS code by exact code
router.get('/hts/:code', async (req, res) => {
    try {
        const code = await prisma.htsCode.findUnique({
            where: { code: req.params.code }
        });

        if (!code) {
            return res.status(404).json({ error: 'HTS code not found' });
        }

        res.json(code);
    } catch (error) {
        console.error('HTS lookup error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
