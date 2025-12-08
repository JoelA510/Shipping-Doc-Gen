const express = require('express');
const router = express.Router();
const templateService = require('../services/templates/templateService');

// GET /templates
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const result = await templateService.listTemplates({
            search: req.query.search,
            limit,
            offset
        });

        res.json({
            data: result.data,
            pagination: {
                page,
                limit,
                total: result.total,
                pages: Math.ceil(result.total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /templates - Already handled partially in `routes/templates.js` (DocumentTemplate), 
// but we are adding ShipmentTemplate. Ideally we merge or replace?
// Wait, previous `routes/templates.js` was for `DocumentTemplate`.
// Let's check `apps/api/src/routes/templates.js` content first.
// If it exists, we might need to separate them or upgrade it.
// Assuming "Shipment Templates" are a new distinct thing or the evolution.
// Let's create `shipmentTemplates.js` router instead to avoid collision if needed.
// Actually, looking at previous file view of `index.js`, there is `app.use('/templates', require('./routes/templates'));`
// I better check existing `routes/templates.js` before overwriting.

// RE-READING previous turn: `index.js` line 12: `const templatesRouter = require('./routes/templates');`
// `model DocumentTemplate` exists in schema line 86.
// `model ShipmentTemplate` is new.
// I should probably create `routes/shipmentTemplates.js` and mount it at `/api/shipment-templates` OR
// modify `routes/templates.js` to handle both or pivot.

// Decision: Let's create `routes/shipmentTemplates.js` to avoid breaking existing Document Templates logic (if any).
// Mounting at `/api/shipment-templates`.

router.post('/', async (req, res) => {
    try {
        const userId = req.user?.id;
        const template = await templateService.createTemplate(req.body, userId);
        res.status(201).json(template);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const template = await templateService.getTemplate(req.params.id);
        if (!template) return res.status(404).json({ error: 'Template not found' });

        // Parse JSON fields if needed for convenient API consumption?
        // Let's return raw for now or parsed. Parsed is better.
        const parsed = {
            ...template,
            lineItems: template.lineItems ? JSON.parse(template.lineItems) : []
        };
        res.json(parsed);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const template = await templateService.updateTemplate(req.params.id, req.body);
        res.json(template);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await templateService.deleteTemplate(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
