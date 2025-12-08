const express = require('express');
const router = express.Router();
const reportService = require('../services/reports/reportService');

/**
 * GET /api/reports/shipments-summary
 * Query: from, to (ISO dates)
 */
router.get('/shipments-summary', async (req, res) => {
    try {
        const { from, to } = req.query;
        const result = await reportService.getShipmentSummary({ from, to });
        res.json(result);
    } catch (error) {
        console.error('Shipment summary chart error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/reports/validation-summary
 */
router.get('/validation-summary', async (req, res) => {
    try {
        const { from, to } = req.query;
        const result = await reportService.getValidationSummary({ from, to });
        res.json(result);
    } catch (error) {
        console.error('Validation summary error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/reports/overrides
 */
router.get('/overrides', async (req, res) => {
    try {
        const { from, to } = req.query;
        const result = await reportService.getOverrides({ from, to });
        res.json(result);
    } catch (error) {
        console.error('Overrides report error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
