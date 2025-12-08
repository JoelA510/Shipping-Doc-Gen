const express = require('express');
const router = express.Router();
const { prisma } = require('../queue'); // Assuming this re-exports prisma client

// GET /parties - List all parties (optional search)
router.get('/', async (req, res) => {
    try {
        const { query } = req.query;

        const where = {};
        if (query) {
            where.OR = [
                { name: { contains: query } }, // Case-insensitive depends on DB collation
                { city: { contains: query } },
                { countryCode: { contains: query } }
            ];
        }

        const parties = await prisma.party.findMany({
            where,
            orderBy: { name: 'asc' },
            take: 50 // Limit results
        });

        res.json({ data: parties });
    } catch (error) {
        console.error('Parties list error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /parties/:id - Get single party
router.get('/:id', async (req, res) => {
    try {
        const party = await prisma.party.findUnique({
            where: { id: req.params.id }
        });

        if (!party) {
            return res.status(404).json({ error: 'Party not found' });
        }

        res.json(party);
    } catch (error) {
        console.error('Party get error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /parties - Create party
router.post('/', async (req, res) => {
    try {
        const {
            name,
            addressLine1,
            addressLine2,
            city,
            stateOrProvince,
            postalCode,
            countryCode,
            contactName,
            phone,
            email,
            taxIdOrEori
        } = req.body;

        if (!name || !addressLine1 || !city || !postalCode || !countryCode) {
            return res.status(400).json({ error: 'Missing required fields (name, addressLine1, city, postalCode, countryCode)' });
        }

        const party = await prisma.party.create({
            data: {
                name,
                addressLine1,
                addressLine2,
                city,
                stateOrProvince,
                postalCode,
                countryCode,
                contactName,
                phone,
                email,
                taxIdOrEori
            }
        });

        res.status(201).json(party);
    } catch (error) {
        console.error('Party create error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /parties/:id - Update party
router.put('/:id', async (req, res) => {
    try {
        const {
            name,
            addressLine1,
            addressLine2,
            city,
            stateOrProvince,
            postalCode,
            countryCode,
            contactName,
            phone,
            email,
            taxIdOrEori
        } = req.body;

        const party = await prisma.party.update({
            where: { id: req.params.id },
            data: {
                name,
                addressLine1,
                addressLine2,
                city,
                stateOrProvince,
                postalCode,
                countryCode,
                contactName,
                phone,
                email,
                taxIdOrEori
            }
        });

        res.json(party);
    } catch (error) {
        console.error('Party update error:', error);
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Party not found' });
        }
        res.status(500).json({ error: error.message });
    }
});

// DELETE /parties/:id - Delete party
router.delete('/:id', async (req, res) => {
    try {
        // Check for usage before delete?
        // Phase 2 MVP: Just try delete, FK constraints will block if used in Shipments
        await prisma.party.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'Party deleted successfully' });
    } catch (error) {
        console.error('Party delete error:', error);
        if (error.code === 'P2003') { // Foreign key constraint failed
            return res.status(400).json({ error: 'Cannot delete party because it is linked to shipments' });
        }
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
