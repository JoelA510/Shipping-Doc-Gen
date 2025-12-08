const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Mock Sanctions List
const DENIED_PARTIES = ['Bad Guys Ltd', 'Embargoed Entity', 'Evil Corp'];

class ComplianceService {

    // --- AES / EEI ---

    /**
     * Determines if AES filing is likely required based on value and destination.
     * @param {object} shipment 
     */
    determineAesRequirement(shipment) {
        // Rule 1: Value > $2500 per Schedule B number (Simplified to total value for now)
        // In real world, we'd sum valid line items.
        const totalValue = shipment.lineItems?.reduce((sum, item) => sum + (item.valueUsd || 0), 0) || 0;

        // Rule 2: Destination Country (e.g., Iran, Sudan, etc. - simplified)
        // Note: Canada is usually exempt.
        const isCanada = shipment.destinationCountry?.toUpperCase() === 'CA';
        const isHighValue = totalValue > 2500;

        return isHighValue && !isCanada;
    }

    /**
     * Generates a mock AES payload for review.
     */
    async generateAesPayload(shipmentId) {
        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            include: { lineItems: true, shipper: true, consignee: true }
        });
        if (!shipment) throw new Error('Shipment not found');

        return {
            filingType: 'AESDirect',
            shipmentRef: shipment.referenceNumber || shipment.id,
            exporter: {
                name: shipment.shipper.name,
                taxId: shipment.shipper.taxId
            },
            consignee: {
                name: shipment.consignee.name,
                country: shipment.destinationCountry
            },
            lineItems: shipment.lineItems.map(l => ({
                description: l.description,
                scheduleB: l.htsCode,
                value: l.valueUsd,
                quantity: l.quantity
            }))
        };
    }

    // --- Dangerous Goods ---

    async lookupUnNumber(unNumber) {
        // Find exact or partial match
        return prisma.dgUnReference.findFirst({
            where: { unNumber: { contains: unNumber } }
        });
    }

    // --- Sanctions ---

    async screenParties(shipmentId) {
        const shipment = await prisma.shipment.findUnique({
            where: { id: shipmentId },
            include: { shipper: true, consignee: true, forwarder: true }
        });
        if (!shipment) throw new Error('Shipment not found');

        const parties = [shipment.shipper, shipment.consignee, shipment.forwarder].filter(Boolean);
        const results = parties.map(p => {
            const isMatch = DENIED_PARTIES.some(dp => p.name.toLowerCase().includes(dp.toLowerCase()));
            return {
                partyId: p.id,
                name: p.name,
                status: isMatch ? 'MATCH' : 'CLEAR',
                details: isMatch ? 'Potentially matches denied party list' : null
            };
        });

        const status = results.some(r => r.status === 'MATCH') ? 'MATCH' : 'CLEAR';

        // Log result
        await prisma.sanctionsCheckResult.create({
            data: {
                shipmentId,
                status,
                responseJson: JSON.stringify(results)
            }
        });

        return { status, results };
    }
}

module.exports = new ComplianceService();
