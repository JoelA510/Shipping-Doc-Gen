const { mapOcrToShipment } = require('../src/services/import/ocrMapper');

describe('OCR Mapper', () => {
    it('should map valid CanonicalDoc to Shipment structure', () => {
        const mockOcrResult = {
            header: {
                shipper: 'Acme Corp',
                consignee: 'Globex',
                incoterm: 'CIF',
                currency: 'EUR',
                reference: 'PO-123'
            },
            lines: [
                {
                    partNumber: 'SKU-1',
                    description: 'Widget',
                    quantity: 10,
                    netWeightKg: 5,
                    valueUsd: 100,
                    htsCode: '1234.56',
                    countryOfOrigin: 'CN'
                }
            ],
            checksums: {
                quantity: 10,
                netWeightKg: 5,
                valueUsd: 100
            }
        };

        const result = mapOcrToShipment(mockOcrResult);

        expect(result.header.shipperName).toBe('Acme Corp');
        expect(result.header.incoterm).toBe('CIF');
        expect(result.header.currency).toBe('EUR');
        expect(result.header.erpOrderId).toBe('PO-123');

        expect(result.header.totalCustomsValue).toBe(100);

        expect(result.lines).toHaveLength(1);
        expect(result.lines[0].sku).toBe('SKU-1');
        expect(result.lines[0].extendedValue).toBe(100);
        expect(result.lines[0].unitValue).toBe(10); // 100 / 10
    });

    it('should throw error if header is missing', () => {
        expect(() => mapOcrToShipment({})).toThrow('Invalid OCR result');
    });
});
