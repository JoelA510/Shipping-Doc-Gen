const express = require('express');
const router = express.Router();
const itemService = require('../services/items/itemService');

// GET /items
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const result = await itemService.listItems({
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

// POST /items
router.post('/', async (req, res) => {
    try {
        const userId = req.user?.id;
        const item = await itemService.createItem(req.body, userId);
        res.status(201).json(item);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// GET /items/:id
router.get('/:id', async (req, res) => {
    try {
        const item = await itemService.getItem(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /items/:id
router.put('/:id', async (req, res) => {
    try {
        const item = await itemService.updateItem(req.params.id, req.body);
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /items/:id
router.delete('/:id', async (req, res) => {
    try {
        await itemService.deleteItem(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
