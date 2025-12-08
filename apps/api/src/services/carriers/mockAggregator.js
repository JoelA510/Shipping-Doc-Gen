const { BaseCarrierGateway } = require('./carrierGateway');
const { v4: uuidv4 } = require('uuid');

class MockAggregator extends BaseCarrierGateway {
    constructor(account) {
        // Resolve circular dependency by not extending if imported, but BaseCarrierGateway is in same file usually 
        // or just plain class if we handle imports carefully. 
        // Here we assume BaseCarrierGateway is passed or available.
        // Actually, let's just implement the methods directly to avoid complexity in this file structure for now 
        // or ensure correct require order.
        super(account);
    }

    /**
     * Generates dummy rates based on weight and destination.
     */
    async getRates(shipment, lineItems) {
        const weight = shipment.totalWeightKg || 1;
        const isIntl = shipment.destinationCountry !== shipment.originCountry;

        // Simulate API latency
        await new Promise(resolve => setTimeout(resolve, 500));

        const rates = [
            {
                carrierCode: 'MOCK_UPS',
                serviceCode: 'GROUND',
                serviceName: 'Mock UPS Ground',
                totalCharge: (10 + weight * 0.5).toFixed(2),
                currency: 'USD',
                estimatedDays: isIntl ? 5 : 3
            },
            {
                carrierCode: 'MOCK_FEDEX',
                serviceCode: 'EXPRESS',
                serviceName: 'Mock FedEx Express',
                totalCharge: (25 + weight * 1.2).toFixed(2),
                currency: 'USD',
                estimatedDays: isIntl ? 2 : 1
            }
        ];

        return rates;
    }

    /**
     * "Books" the shipment by returning a tracking number and a fake label PDF.
     */
    async bookShipment(bookingRequest) {
        const { serviceCode, rateId } = bookingRequest;

        // Simulate API latency
        await new Promise(resolve => setTimeout(resolve, 800));

        const trackingNumber = `1Z${uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase()}`;

        // Return Mock Label Data (we would generate a real PDF or return base64 in a real app)
        // For the pilot, we will rely on the calling service to generate a "Label Document" 
        // from this response or we return a buffer here.
        // Let's return a simple structure.

        return {
            trackingNumber,
            labelData: null, // "Real" gateway would return PDF buffer. We might generate a generic label in the doc service.
            carrierTransactionId: uuidv4(),
            status: 'success'
        };
    }

    async trackShipment(trackingNumber) {
        return {
            status: 'In Transit',
            location: 'Mock Sort Facility, KS',
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = MockAggregator;
