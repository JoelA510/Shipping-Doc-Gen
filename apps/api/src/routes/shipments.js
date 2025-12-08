const express = require('express');
const router = express.Router();
const { prisma } = require('../queue'); // Assuming this re-exports prisma client

// Helper to snapshot a party
async function getPartySnapshot(partyId) {
    if (!partyId) return null;
    const party = await prisma.party.findUnique({ where: { id: partyId } });
    return party ? JSON.stringify(party) : null;
}

// GET /shipments
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const shipments = await prisma.shipment.findMany({
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                shipper: true,
                consignee: true,
                forwarder: true,
                broker: true
            }
        });

        const total = await prisma.shipment.count();

        res.json({
            data: shipments,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Shipments list error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /shipments/:id
router.get('/:id', async (req, res) => {
    try {
        const shipment = await prisma.shipment.findUnique({
            where: { id: req.params.id },
            include: {
                shipper: true,
                consignee: true,
                forwarder: true,
                broker: true,
                lineItems: true,
                documents: true
            }
        });

        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });
        res.json(shipment);
    } catch (error) {
        console.error('Shipment get error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /shipments
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.id || 'unknown'; // Should come from middleware
        const {
            shipperId,
            consigneeId,
            forwarderId,
            brokerId,
            incoterm,
            currency,
            totalCustomsValue,
            totalWeightKg,
            numPackages,
            originCountry,
            destinationCountry,
            // ... other fields
        } = req.body;

        // Validation for required fields (can be enhanced with Zod later)
        if (!shipperId || !consigneeId || !incoterm || !destinationCountry) {
            return res.status(400).json({ error: 'Missing required fields: shipperId, consigneeId, incoterm, destinationCountry' });
        }

        // Snapshot Parties
        const [shipperSnapshot, consigneeSnapshot, forwarderSnapshot, brokerSnapshot] = await Promise.all([
            getPartySnapshot(shipperId),
            getPartySnapshot(consigneeId),
            getPartySnapshot(forwarderId),
            getPartySnapshot(brokerId)
        ]);

        const shipment = await prisma.shipment.create({
            data: {
                schemaVersion: 'shipment.v1',
                shipperId,
                consigneeId,
                forwarderId,
                brokerId,
                incoterm,
                currency: currency || 'USD',
                totalCustomsValue: totalCustomsValue || 0,
                totalWeightKg: totalWeightKg || 0,
                numPackages: numPackages || 1,
                originCountry: originCountry || 'US',
                destinationCountry,
                createdByUserId: userId,
                // Snapshots
                shipperSnapshot,
                consigneeSnapshot,
                forwarderSnapshot,
                brokerSnapshot
            }
        });

        res.status(201).json(shipment);
    } catch (error) {
        console.error('Shipment create error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /shipments/:id
router.put('/:id', async (req, res) => {
    try {
        const {
            shipperId,
            consigneeId,
            forwarderId,
            brokerId,
            incoterm,
            currency,
            totalCustomsValue,
            totalWeightKg,
            numPackages,
            originCountry,
            destinationCountry,
            status
        } = req.body;

        // Fetch current to see if parties changed
        const currentShipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
        if (!currentShipment) return res.status(404).json({ error: 'Shipment not found' });

        const updateData = {
            incoterm,
            currency,
            totalCustomsValue,
            totalWeightKg,
            numPackages,
            originCountry,
            destinationCountry,
            status
        };

        // Handle Party Changes (re-snapshot)
        if (shipperId && shipperId !== currentShipment.shipperId) {
            updateData.shipperId = shipperId;
            updateData.shipperSnapshot = await getPartySnapshot(shipperId);
        }
        if (consigneeId && consigneeId !== currentShipment.consigneeId) {
            updateData.consigneeId = consigneeId;
            updateData.consigneeSnapshot = await getPartySnapshot(consigneeId);
        }
        if (forwarderId !== undefined) { // forwarderId can be null/undefined logic depends on update style. Simplified here.
            if (forwarderId !== currentShipment.forwarderId) {
                updateData.forwarderId = forwarderId;
                updateData.forwarderSnapshot = await getPartySnapshot(forwarderId);
            }
        }
        if (brokerId !== undefined) {
            if (brokerId !== currentShipment.brokerId) {
                updateData.brokerId = brokerId;
                updateData.brokerSnapshot = await getPartySnapshot(brokerId);
            }
        }

        const updated = await prisma.shipment.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.json(updated);

    } catch (error) {
        console.error('Shipment update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /shipments/:id/link-party
router.post('/:id/link-party', async (req, res) => {
    try {
        const { role, partyId } = req.body;
        if (!['shipper', 'consignee', 'forwarder', 'broker'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }
        if (!partyId) return res.status(400).json({ error: 'Party ID required' });

        const snapshot = await getPartySnapshot(partyId);
        if (!snapshot && partyId) return res.status(404).json({ error: 'Party not found' });

        const updateData = {};
        updateData[`${role}Id`] = partyId;
        updateData[`${role}Snapshot`] = snapshot;

        const updated = await prisma.shipment.update({
            where: { id: req.params.id },
            data: updateData
        });

        res.json(updated);
    } catch (error) {
        console.error('Link party error:', error);
        res.status(500).json({ error: error.message });
    }
});

const { validateShipment } = require('../services/validation/engine');

// GET /shipments/:id/validation
router.get('/:id/validation', async (req, res) => {
    try {
        const shipment = await prisma.shipment.findUnique({
            where: { id: req.params.id },
            include: { lineItems: true } // Line items required for validation
        });

        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        const validationResult = validateShipment(shipment, shipment.lineItems);
        res.json(validationResult);

    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
