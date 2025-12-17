const CarrierAdapter = require('./base');

class EasyPostAdapter extends CarrierAdapter {
    constructor(credentials) {
        super(credentials);
        this.apiKey = credentials.apiKey;
    }

    async getRates(shipment) {
        console.log('EasyPost getRates', shipment);
        // Implement EasyPost API call
        return [];
    }

    async createShipment(shipment) {
        console.log('EasyPost createShipment', shipment);
        // Implement EasyPost create shipment
        return {
            trackingNumber: 'EP_TRACK_123',
            labelUrl: '#',
            cost: 0
        };
    }

    async trackShipment(trackingNumber) {
        console.log('EasyPost track', trackingNumber);
        return {
            status: 'UNKNOWN'
        };
    }

    async validateAddress(address) {
        console.log('EasyPost validate', address);
        return {
            isValid: true,
            normalizedAddress: address
        };
    }
}

module.exports = EasyPostAdapter;
