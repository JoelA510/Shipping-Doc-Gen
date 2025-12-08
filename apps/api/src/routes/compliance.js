const express = require('express');
const router = express.Router();
const complianceService = require('../services/compliance/complianceService');

/**
 * GET /api/compliance/dg/lookup/:unNumber
 * Lookup Dangerous Goods info by UN Number.
 */
router.get('/dg/lookup/:unNumber', async (req, res) => {
    try {
        const { unNumber } = req.params;
        const result = await complianceService.lookupUnNumber(unNumber);
        if (!result) return res.status(404).json({ error: 'UN Number not found' });
        res.json(result);
    } catch (error) {
        console.error('DG Lookup Error:', error);
        res.status(500).json({ error: 'Failed to lookup UN number' });
    }
});

/**
 * POST /api/compliance/aes/assess
 * Assess if AES filing is required for a shipment.
 */
router.post('/aes/assess', async (req, res) => {
    try {
        const { shipment } = req.body; // Expects partial shipment object
        if (!shipment) return res.status(400).json({ error: 'Shipment data required' });

        const isRequired = complianceService.determineAesRequirement(shipment);
        res.json({ aesRequired: isRequired });
    } catch (error) {
        console.error('AES Assessment Error:', error);
        res.status(500).json({ error: 'Failed to assess AES requirement' });
    }
});

/**
 * POST /api/compliance/sanctions/screen
 * Screen parties of a shipment against denied party lists.
 */
router.post('/sanctions/screen', async (req, res) => {
    try {
        const { shipmentId } = req.body;
        if (!shipmentId) return res.status(400).json({ error: 'shipmentId required' });

        const result = await complianceService.screenParties(shipmentId);
        res.json(result);
    } catch (error) {
        console.error('Sanctions Check Error:', error);
        res.status(500).json({ error: 'Failed to perform sanctions check' });
    }
});

module.exports = router;
