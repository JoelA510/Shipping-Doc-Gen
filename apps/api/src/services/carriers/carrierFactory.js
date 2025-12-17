const prisma = require('../../db');
const FedExAdapter = require('./fedex');
const EasyPostAdapter = require('./easyPostAdapter');
const UPSAdapter = require('./ups');

class CarrierFactory {
    /**
     * Get a carrier adapter instance for a specific account
     * @param {string} carrierAccountId 
     * @returns {Promise<import('./base')>}
     */
    static async getAdapter(carrierAccountId) {
        const account = await prisma.carrierAccount.findUnique({
            where: { id: carrierAccountId }
        });

        if (!account) {
            throw new Error(`Carrier Account ${carrierAccountId} not found`);
        }

        // Decrypt credentials if necessary (assuming stored as plain JSON or handling global decrypt helper)
        // For now parsing JSON
        let credentials = {};
        try {
            credentials = JSON.parse(account.credentials);
        } catch (e) {
            console.error('Failed to parse carrier credentials', e);
        }

        switch (account.provider.toLowerCase()) {
            case 'fedex':
                return new FedExAdapter(credentials, account.accountNumber);
            case 'easypost':
                return new EasyPostAdapter(credentials);
            case 'ups':
                return new UPSAdapter(credentials, account.accountNumber);
            default:
                throw new Error(`Provider ${account.provider} not supported`);
        }
    }

    /**
     * Get adapter based on carrier code (e.g. for rating across all accounts?)
     * Or specific logic to find "default" account for a carrier.
     */
}

module.exports = CarrierFactory;
