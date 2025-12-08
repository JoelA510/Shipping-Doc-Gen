const { validateShipment } = require('../src/services/validation/engine');

describe('Validation Engine', () => {

    const validShipment = {
        id: 'ship-1',
        shipperName: 'Acme',
        consigneeName: 'Globex',
        totalCustomsValue: 100,
        totalWeightKg: 10
    };

    const validLines = [
        { description: 'Item 1', quantity: 10, unitValue: 10, extendedValue: 100, netWeightKg: 10, htsCode: '1234.56' }
    ];

    it('should pass valid shipment', () => {
        const result = validateShipment(validShipment, validLines);
        expect(result.issues).toHaveLength(0);
    });

    it('should detect missing parties (R1)', () => {
        const badShipment = { ...validShipment, shipperName: null };
        const result = validateShipment(badShipment, validLines);

        expect(result.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'MISSING_SHIPPER', severity: 'error' })
        ]));
    });

    it('should detect bad line items (R2)', () => {
        const badLines = [{ description: '', quantity: 0, unitValue: -5 }];
        const result = validateShipment(validShipment, badLines);

        expect(result.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'MISSING_DESCRIPTION' }),
            expect.objectContaining({ code: 'INVALID_QUANTITY' }),
            expect.objectContaining({ code: 'INVALID_VALUE' })
        ]));
    });

    it('should detect numeric mismatch (R3)', () => {
        const mismatchShipment = { ...validShipment, totalCustomsValue: 200 }; // Lines total is 100
        const result = validateShipment(mismatchShipment, validLines);

        expect(result.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'VALUE_MISMATCH', severity: 'warning' })
        ]));
    });

    it('should detect invalid HTS (R4)', () => {
        const badHtsLines = [{ ...validLines[0], htsCode: '123' }];
        const result = validateShipment(validShipment, badHtsLines);

        expect(result.issues).toEqual(expect.arrayContaining([
            expect.objectContaining({ code: 'INVALID_HTS' })
        ]));
    });
});
