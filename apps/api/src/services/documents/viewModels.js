/**
 * Formats a ShipmentV1 object into a view model suitable for Handlebars templates.
 * 
 * @param {Object} shipment ShipmentV1
 * @param {Object[]} lineItems ShipmentLineItemV1[]
 * @returns {Object} invoiceViewModel
 */
function buildInvoiceViewModel(shipment, lineItems) {
    const formatDate = (date) => date ? new Date(date).toLocaleDateString() : '';

    // Parse snapshots if they exist, otherwise fallback to top-level or null
    const parseParty = (snapshot, id) => {
        if (snapshot) {
            try { return typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot; }
            catch (e) { console.error('Error parsing party snapshot', e); }
        }
        return { id }; // Fallback
    };

    const shipper = parseParty(shipment.shipperSnapshot, shipment.shipperId);
    const consignee = parseParty(shipment.consigneeSnapshot, shipment.consigneeId);
    const forwarder = parseParty(shipment.forwarderSnapshot, shipment.forwarderId);

    // Calculate totals if not present (logic can be shared with validation)
    const subTotal = lineItems.reduce((sum, line) => sum + (line.extendedValue || 0), 0);
    const totalWeight = lineItems.reduce((sum, line) => sum + (line.netWeightKg || 0), 0);
    const totalQty = lineItems.reduce((sum, line) => sum + (line.quantity || 0), 0);

    return {
        metadata: {
            title: 'COMMERCIAL INVOICE',
            dateGenerated: new Date().toLocaleDateString(),
            documentNumber: `INV-${shipment.id.slice(0, 8).toUpperCase()}`
        },
        shipment: {
            id: shipment.id,
            erpOrderId: shipment.erpOrderId || 'N/A',
            incoterm: shipment.incoterm,
            currency: shipment.currency,
            origin: shipment.originCountry,
            destination: shipment.destinationCountry,
            date: formatDate(shipment.createdAt),
            references: [] // TODO: Map references if available
        },
        parties: {
            shipper,
            consignee,
            isForwarderSameAsConsignee: !forwarder, // Logic simplification
            forwarder
        },
        lines: lineItems.map(line => ({
            description: line.description,
            quantity: line.quantity,
            uom: 'EA', // TODO: Make dynamic
            unitValue: (line.unitValue || 0).toFixed(2),
            extendedValue: (line.extendedValue || 0).toFixed(2),
            weight: (line.netWeightKg || 0).toFixed(2),
            hts: line.htsCode || '',
            coo: line.countryOfOrigin || ''
        })),
        totals: {
            subTotal: subTotal.toFixed(2),
            totalWeight: totalWeight.toFixed(2),
            totalPackages: shipment.numPackages || 0,
            quantity: totalQty
        }
    };
}

/**
 * Formats a ShipmentV1 object for Packing List.
 */
function buildPackingListViewModel(shipment, lineItems) {
    const invoiceVM = buildInvoiceViewModel(shipment, lineItems);

    // Override title and potentially remove value columns
    return {
        ...invoiceVM,
        metadata: {
            ...invoiceVM.metadata,
            title: 'PACKING LIST',
            documentNumber: `PL-${shipment.id.slice(0, 8).toUpperCase()}`
        },
        // Packing list specific logic could go here (e.g. grouping by package)
    };
}

module.exports = {
    buildInvoiceViewModel,
    buildPackingListViewModel
};
