const express = require('express');
const router = express.Router();
const CarrierService = require('../services/carriers');
const { prisma } = require('../queue');

// Get active carrier accounts
router.get('/accounts', async (req, res) => {
    try {
        const userId = req.user?.id;
        const accounts = await prisma.carrierAccount.findMany({
            where: { userId, isActive: true },
            select: {
                id: true,
                provider: true,
                accountNumber: true, // In real app, mask this
                createdAt: true
            }
        });
        res.json({ data: accounts });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add carrier account
router.post('/accounts', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { provider, accountNumber, credentials } = req.body;

        // Validate credentials with carrier
        // In a real app, we'd instantiate the adapter and call validateAccount()
        // const adapter = new FedExAdapter(credentials, accountNumber);
        // await adapter.validateAccount();

        const account = await prisma.carrierAccount.create({
            data: {
                userId,
                provider: provider.toLowerCase(),
                accountNumber,
                credentials: JSON.stringify(credentials) // Encrypt this in production!
            }
        });

        res.status(201).json({
            id: account.id,
            provider: account.provider,
            accountNumber: account.accountNumber
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Shop for rates
router.post('/rates', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { shipment } = req.body;

        if (!shipment) {
            return res.status(400).json({ error: 'Shipment details required' });
        }

        const rates = await CarrierService.shopRates(userId, shipment);
        res.json({ data: rates });
    } catch (error) {
        console.error('Rate shopping error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create shipment (generate label)
router.post('/shipments', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { provider, shipment, documentId } = req.body;

        const adapter = await CarrierService.getAdapter(provider, userId);
        const result = await adapter.createShipment(shipment);

        // Save shipment record
        const savedShipment = await prisma.shipment.create({
            data: {
                documentId,
                carrier: provider,
                serviceType: result.serviceType,
                trackingNumber: result.trackingNumber,
                labelUrl: result.labelUrl,
                cost: result.cost,
                status: 'created'
            }
        });

        res.status(201).json(savedShipment);
    } catch (error) {
        console.error('Create shipment error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Schedule pickup
router.post('/pickups', async (req, res) => {
    try {
        const userId = req.user?.id;
        const { provider, pickupRequest } = req.body;

        const adapter = await CarrierService.getAdapter(provider, userId);
        const result = await adapter.schedulePickup(pickupRequest);

        const savedPickup = await prisma.pickupRequest.create({
            data: {
                carrier: provider,
                confirmation: result.confirmationNumber,
                scheduledDate: new Date(pickupRequest.date),
                windowStart: pickupRequest.windowStart,
                windowEnd: pickupRequest.windowEnd,
                status: result.status
            }
        });

        res.status(201).json(savedPickup);
    } catch (error) {
        console.error('Schedule pickup error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
