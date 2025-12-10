const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getCarrierGateway } = require('../services/carriers/carrierGateway');
const { generateDocument } = require('../services/documents/generator');

/**
 * GET /api/shipments/:id/rates
 * Trigger a rate shop for a shipment.
 */
const crypto = require('crypto');
const { connection: redis } = require('../services/redis');
const logger = require('../utils/logger');

// ...

router.post('/:id/rates', async (req, res) => {
    try {
        const { id } = req.params;
        const shipment = await prisma.shipment.findUnique({
            where: { id },
            include: { lineItems: true }
        });

        if (!shipment) {
            return res.status(404).json({ error: 'Shipment not found' });
        }

        // Security Check: Shipment Ownership
        if (shipment.createdByUserId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied to shipment' });
        }

        const carrierAccounts = await prisma.carrierAccount.findMany({
            where: {
                isActive: true,
                userId: req.user.id // SCOPED
            }
        });

        if (carrierAccounts.length === 0) {
            return res.status(400).json({ error: 'No active carrier accounts found. Please contact admin.' });
        }

        // Cache Key Generation
        // We hash critical rate-affecting fields to ensure uniqueness
        const dataToHash = JSON.stringify({
            origin: shipment.originCountry,
            dest: shipment.destinationCountry,
            weight: shipment.totalWeightKg,
            items: shipment.lineItems.map(i => i.id).sort(), // Simplified item dependency
            carriers: carrierAccounts.map(c => c.id).sort()
        });
        const hash = crypto.createHash('md5').update(dataToHash).digest('hex');
        const cacheKey = `rates:${id}:${hash}`;

        // 1. Check Cache
        const cachedRates = await redis.get(cacheKey);
        if (cachedRates) {
            logger.info('Cache HIT for rates', { cacheKey });
            return res.json(JSON.parse(cachedRates));
        }

        logger.info('Cache MISS for rates', { cacheKey });

        const ratesPromises = carrierAccounts.map(async (account) => {
            try {
                const gateway = await getCarrierGateway(account.id);
                const rates = await gateway.getRates(shipment, shipment.lineItems);
                // Tag rates with the account ID so we know which one to book with
                return rates.map(r => ({ ...r, carrierAccountId: account.id }));
            } catch (err) {
                logger.error('Failed to get rates from account', { accountId: account.id, error: err.message });
                return [];
            }
        });

        const nestedRates = await Promise.all(ratesPromises);
        const allRates = nestedRates.flat();

        // 2. Store in Cache (TTL: 10 minutes)
        if (allRates.length > 0) {
            await redis.setex(cacheKey, 600, JSON.stringify(allRates));
        }

        // Update meta
        await prisma.shipmentCarrierMeta.upsert({
            where: { shipmentId: id },
            update: { rateQuoteJson: JSON.stringify(allRates) },
            create: { shipmentId: id, rateQuoteJson: JSON.stringify(allRates) }
        });

        res.json(allRates);
    } catch (error) {
        logger.error('Rate shop error', { error: error.message, stack: error.stack, shipmentId: req.params.id });
        res.status(500).json({ error: 'Failed to retrieve rates' });
    }
});

/**
 * POST /api/shipments/:id/book
 * Book a specific rate.
 */
router.post('/:id/book', async (req, res) => {
    try {
        const { id } = req.params;
        const { carrierAccountId, serviceCode, rateId } = req.body;

        if (!carrierAccountId || !serviceCode) {
            return res.status(400).json({ error: 'Missing carrierAccountId or serviceCode' });
        }

        // Verify Carrier Account Ownership
        const account = await prisma.carrierAccount.findUnique({
            where: { id: carrierAccountId }
        });

        if (!account || account.userId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied to carrier account' });
        }

        const gateway = await getCarrierGateway(carrierAccountId);

        // 1. Book with Carrier
        const bookingResult = await gateway.bookShipment({
            shipmentId: id,
            serviceCode,
            rateId // unique ID from quote if available
        });

        // 2. Generate Label Document (if we got raw data or need to generate one)
        // For Mock, we assume we generate a generic "Label" PDF using our doc engine or store what we got.
        // If bookingResult.labelData is null (Mock), let's generate a placeholder directly here or call generator.

        // A real implementation would save the buffer to disk/S3.
        // Here, we'll create a dummy document record.
        const labelFilename = `LABEL-${bookingResult.trackingNumber}.pdf`;

        // Save metadata
        const meta = await prisma.shipmentCarrierMeta.upsert({
            where: { shipmentId: id },
            update: {
                carrierCode: 'MOCK', // simplified
                serviceLevelCode: serviceCode,
                trackingNumber: bookingResult.trackingNumber,
                bookedAt: new Date(),
                bookingResponseJson: JSON.stringify(bookingResult)
            },
            create: {
                shipmentId: id,
                carrierCode: 'MOCK',
                serviceLevelCode: serviceCode,
                trackingNumber: bookingResult.trackingNumber,
                bookedAt: new Date(),
                bookingResponseJson: JSON.stringify(bookingResult)
            }
        });

        // Update main shipment status
        await prisma.shipment.update({
            where: { id },
            data: {
                status: 'booked',
                trackingNumber: bookingResult.trackingNumber,
                carrierCode: 'MOCK',
                serviceLevelCode: serviceCode
            }
        });

        res.json({
            success: true,
            trackingNumber: bookingResult.trackingNumber,
            labelUrl: null // TODO: return document URL once created
        });

    } catch (error) {
        logger.error('Booking error', { error: error.message, stack: error.stack, shipmentId: req.params.id });
        res.status(500).json({ error: 'Failed to book shipment' });
    }
});

module.exports = router;
