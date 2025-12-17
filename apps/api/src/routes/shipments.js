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

        const where = {};
        if (req.query.status) {
            where.status = req.query.status;
        }

        const shipments = await prisma.shipment.findMany({
            where,
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

const { generateDocument } = require('../services/documents/generator');
const historian = require('../services/history/historian');

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
            assignedTo,
            dueDate,
            status
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
                // Lifecycle
                status: status || 'draft',
                assignedTo: assignedTo || userId,
                dueDate: dueDate ? new Date(dueDate) : null,

                // Snapshots
                shipperSnapshot,
                consigneeSnapshot,
                forwarderSnapshot,
                brokerSnapshot
            }
        });

        // Audit Log
        await historian.logShipmentEvent(shipment.id, 'created', userId, { origin: 'api' });

        res.status(201).json(shipment);
    } catch (error) {
        console.error('Shipment create error:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /shipments/:id
router.put('/:id', async (req, res) => {
    try {
        const userId = req.user?.id || 'unknown';
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
            status,
            assignedTo,
            dueDate
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
            status,
            assignedTo,
            dueDate: dueDate ? new Date(dueDate) : undefined
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
        if (forwarderId !== undefined) {
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

        // Audit Log
        await historian.logShipmentEvent(updated.id, 'updated', userId, { fields: Object.keys(req.body) });

        res.json(updated);

    } catch (error) {
        console.error('Shipment update error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /shipments/:id/link-party
router.post('/:id/link-party', async (req, res) => {
    try {
        const userId = req.user?.id || 'unknown';
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

        // Audit Log
        await historian.logShipmentEvent(updated.id, 'party_linked', userId, { role, partyId });

        res.json(updated);
    } catch (error) {
        console.error('Link party error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ... GET handlers ...

const { validateShipment } = require('../services/validation/engine');

// GET /shipments/:id/validation
router.get('/:id/validation', async (req, res) => {
    try {
        const shipment = await prisma.shipment.findUnique({
            where: { id: req.params.id },
            include: { lineItems: true }
        });

        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        const result = await validateShipment(shipment, shipment.lineItems || []);

        // Filter dismissed codes
        // Parse meta if string, or use empty object
        const meta = shipment.meta ? JSON.parse(shipment.meta) : {};
        const dismissed = meta.dismissedValidationCodes || [];

        if (dismissed.length > 0) {
            result.issues = result.issues.filter(issue => !dismissed.includes(issue.code));
        }

        res.json(result);
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /shipments/:id/validation/dismiss
router.post('/:id/validation/dismiss', async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Code required' });

        const shipment = await prisma.shipment.findUnique({ where: { id: req.params.id } });
        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        const meta = shipment.meta ? JSON.parse(shipment.meta) : {};
        if (!meta.dismissedValidationCodes) meta.dismissedValidationCodes = [];

        if (!meta.dismissedValidationCodes.includes(code)) {
            meta.dismissedValidationCodes.push(code);

            await prisma.shipment.update({
                where: { id: req.params.id },
                data: { meta: JSON.stringify(meta) }
            });
        }

        res.json({ success: true, dismissedCodes: meta.dismissedValidationCodes });
    } catch (error) {
        console.error('Dismiss error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ... Validation handler ...

// POST /shipments/:id/documents
router.post('/:id/documents', async (req, res) => {
    try {
        const userId = req.user?.id || 'unknown';
        const { type } = req.body; // 'commercial-invoice' or 'packing-list'
        if (!type) return res.status(400).json({ error: 'Document type required' });

        const result = await generateDocument(req.params.id, type, { userId });
        res.status(201).json(result);
    } catch (error) {
        console.error('Document generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /shipments/:id/history
router.get('/:id/history', async (req, res) => {
    try {
        const logs = await prisma.auditLog.findMany({
            where: { shipmentId: req.params.id },
            orderBy: { timestamp: 'desc' },
            include: { user: { select: { username: true } } }
        });
        res.json(logs);
    } catch (error) {
        console.error('History error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ... History handler ...

const importExportService = require('../services/portability/importExportService');

// GET /shipments/:id/export
router.get('/:id/export', async (req, res) => {
    try {
        const data = await importExportService.exportShipment(req.params.id);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=shipment-${req.params.id}-export.json`);
        res.json(data);
    } catch (error) {
        console.error('Export error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /shipments/import (Note: Not under /:id)
router.post('/import', async (req, res) => {
    try {
        const userId = req.user?.id || 'unknown';
        const payload = req.body;

        if (!payload || typeof payload !== 'object') {
            return res.status(400).json({ error: 'Invalid payload' });
        }

        const newShipment = await importExportService.importShipment(payload, userId);

        // Audit
        await historian.logShipmentEvent(newShipment.id, 'imported', userId, { originalId: payload.data?.id });

        res.status(201).json(newShipment);
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ... Import Export ...

const rateShoppingService = require('../services/rating/rateShoppingService');
const queue = require('../queue');

// POST /shipments/:id/rates
router.post('/:id/rates', async (req, res) => {
    try {
        const shipment = await prisma.shipment.findUnique({
            where: { id: req.params.id },
            include: {
                shipper: true,
                consignee: true,
                lineItems: true
            }
        });

        if (!shipment) return res.status(404).json({ error: 'Shipment not found' });

        const rates = await rateShoppingService.getRates(shipment);

        // Update meta with rate quote for history
        // Note: avoiding full update if just shopping, but useful to cache last quote
        await prisma.shipmentCarrierMeta.upsert({
            where: { shipmentId: shipment.id },
            create: {
                shipmentId: shipment.id,
                rateQuoteJson: JSON.stringify(rates)
            },
            update: {
                rateQuoteJson: JSON.stringify(rates)
            }
        });

        res.json(rates);
    } catch (error) {
        console.error('Rate shopping error:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /shipments/:id/book
router.post('/:id/book', async (req, res) => {
    try {
        const { carrierAccountId, serviceCode } = req.body;
        if (!carrierAccountId || !serviceCode) {
            return res.status(400).json({ error: 'carrierAccountId and serviceCode are required' });
        }

        const job = await queue.addJob('GENERATE_LABEL', {
            shipmentId: req.params.id,
            carrierAccountId,
            serviceCode
        });

        res.json({ success: true, jobId: job.id, status: 'queued' });

    } catch (error) {
        console.error('Booking error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
