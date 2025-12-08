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

const BaseCarrierGateway = require('./baseCarrierGateway');

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

module.exports = {
    getCarrierGateway,
    BaseCarrierGateway,
    CARRIER_PROVIDERS
};
