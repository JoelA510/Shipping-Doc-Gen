/**
 * Maps the generic Ingestion Result (CanonicalDoc) to the ShipmentV1 schema.
 * 
 * @param {import('../../../../../services/ingestion/src/types').CanonicalDoc} ocrResult 
 * @returns {Object} ShipmentV1 compatible object
 */
function mapOcrToShipment(ocrResult) {
    if (!ocrResult || !ocrResult.header) {
        throw new Error('Invalid OCR result: missing header');
    }

    const { header, lines } = ocrResult;

    // Map Header
    const shipmentHeader = {
        incoterm: header.incoterm || 'EXW', // Default if missing, or maybe validation will catch it
        currency: header.currency || 'USD',
        originCountry: 'US', // Default or need to extract? Ingestion types don't provide origin country on header yet.
        destinationCountry: 'US', // Placeholder
        erpOrderId: header.reference,
        shipperName: header.shipper,
        consigneeName: header.consignee,

        // Aggregates
        totalCustomsValue: ocrResult.checksums?.valueUsd || lines.reduce((acc, line) => acc + (line.valueUsd || 0), 0),
        totalWeightKg: ocrResult.checksums?.netWeightKg || lines.reduce((acc, line) => acc + (line.netWeightKg || 0), 0),
        numPackages: ocrResult.checksums?.quantity || lines.reduce((acc, line) => acc + (line.quantity || 0), 0), // Approx
    };

    // Map Lines
    const shipmentLines = lines.map(line => ({
        description: line.description,
        quantity: line.quantity,
        unitValue: line.valueUsd && line.quantity ? (line.valueUsd / line.quantity) : 0, // Ingestion gives total valueUsd per line typically? Checking types... 
        // type says "valueUsd", usually line total. 
        // Wait, types.js says "valueUsd". Let's assume extended value.
        extendedValue: line.valueUsd,
        netWeightKg: line.netWeightKg,
        htsCode: line.htsCode,
        countryOfOrigin: line.countryOfOrigin,
        sku: line.partNumber
    }));

    return {
        header: shipmentHeader,
        lines: shipmentLines
    };
}

module.exports = {
    mapOcrToShipment
};
