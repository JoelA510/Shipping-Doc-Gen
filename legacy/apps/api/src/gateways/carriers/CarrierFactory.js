const prisma = require('../../db');
const FedExAdapter = require('./adapters/FedExAdapter');
const { decryptString } = require('../../services/security/fieldEncryption');
// const UPSAdapter = require('./adapters/UPSAdapter');

const ENCRYPTED_SEGMENT_REGEX = /^[A-Za-z0-9+/=]+$/;

function isEncryptedPayload(payload) {
    if (payload === null || payload === undefined) return false;

    const parts = String(payload).split('.');
    if (parts.length !== 3) return false;

    return parts.every(part => part.length % 4 === 0 && ENCRYPTED_SEGMENT_REGEX.test(part));
}

class CarrierFactory {

    /**
     * @param {string} carrierAccountId 
     * @returns {Promise<import('./CarrierGateway')>}
     */
    static async getGateway(carrierAccountId) {
        if (carrierAccountId === 'mock') {
            const MockAdapter = require('./adapters/MockAdapter');
            return new MockAdapter({});
        }

        const account = await prisma.carrierAccount.findUnique({
            where: { id: carrierAccountId }
        });

        if (!account) throw new Error(`Carrier Account ${carrierAccountId} not found`);

        const rawCredentials = isEncryptedPayload(account.credentials)
            ? decryptString(account.credentials)
            : account.credentials;
        const credentials = typeof rawCredentials === 'string'
            ? JSON.parse(rawCredentials || '{}')
            : (rawCredentials || {});

        switch (account.provider.toLowerCase()) {
            case 'fedex':
                return new FedExAdapter(credentials);
            default:
                throw new Error(`Provider ${account.provider} not supported`);
        }
    }

    static getProviderSchema(provider) {
        switch (provider.toLowerCase()) {
            case 'fedex': return FedExAdapter.getCredentialSchema();
            default: return [];
        }
    }
}

module.exports = CarrierFactory;
