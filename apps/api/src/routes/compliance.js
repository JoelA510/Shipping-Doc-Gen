const express = require('express');
const router = express.Router();
const AESService = require('../services/compliance/aes');
const CarrierService = require('../services/carriers');
const { prisma } = require('../queue');

// Validate EEI Data
router.post('/validate', (req, res) => {
    const result = AESService.validateEEI(req.body);
    res.json(result);
});

// File AES via Carrier (FedEx/UPS)
router.post('/file/carrier', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { provider, shipmentId, eeiData } = req.body;

        // Validate first
        const validation = AESService.validateEEI(eeiData);
        if (!validation.isValid) {
            return res.status(400).json({ errors: validation.errors });
        }

        const adapter = await CarrierService.getAdapter(provider, userId);

        // Check if adapter supports AES filing
        if (!adapter.fileAES) {
            return res.status(400).json({ error: `${provider} does not support direct AES filing via this API` });
        }

        const result = await adapter.fileAES(eeiData);

        // Update shipment with ITN if successful
        if (result.itn && shipmentId) {
            await prisma.shipment.update({
                where: { id: shipmentId },
                data: { aesNumber: result.itn }
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Carrier AES filing error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate AES Direct Format (for manual filing)
router.post('/generate/aes-direct', (req, res) => {
    try {
        const { eeiData } = req.body;
        const xml = AESService.formatForAESDirect(eeiData);
        res.json({ format: 'xml', content: xml });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
