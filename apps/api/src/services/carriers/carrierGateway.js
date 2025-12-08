/**
 * Carrier Gateway Interface / Factory
 * 
 * Provides a unified way to get a carrier instance based on account settings.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const MockAggregator = require('./mockAggregator');

const CARRIER_PROVIDERS = {
    MOCK: 'mock',
    EASYPOST: 'easypost', // Future
    FEDEX: 'fedex'        // Future
};

/**
 * Factory to get the correct gateway implementation.
 * @param {string} carrierAccountId 
 */
async function getCarrierGateway(carrierAccountId) {
    const account = await prisma.carrierAccount.findUnique({
        where: { id: carrierAccountId }
    });

    if (!account) {
        throw new Error(`Carrier account not found: ${carrierAccountId}`);
    }

    if (!account.isActive) {
        throw new Error(`Carrier account is inactive: ${account.provider}`);
    }

    switch (account.provider.toLowerCase()) {
        case CARRIER_PROVIDERS.MOCK:
            return new MockAggregator(account);
        default:
            throw new Error(`Unsupported carrier provider: ${account.provider}`);
    }
}

/**
 * Base class for Carrier Gateways to ensure interface compliance.
 */
class BaseCarrierGateway {
    constructor(account) {
        this.account = account;
    }

    async getRates(shipment, lineItems) {
        throw new Error('Method "getRates" not implemented');
    }

    async bookShipment(bookingRequest) {
        throw new Error('Method "bookShipment" not implemented');
    }

    async trackShipment(trackingNumber) {
        throw new Error('Method "trackShipment" not implemented');
    }
}

module.exports = {
    getCarrierGateway,
    BaseCarrierGateway,
    CARRIER_PROVIDERS
};
