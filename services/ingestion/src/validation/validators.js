const { ErrorCatalog } = require('./catalog');

// Mock HTS list for prototype
const KNOWN_HTS_CODES = new Set(['847150', '902710', '851762']);

// Mock Country list
const VALID_COUNTRIES = new Set(['US', 'CN', 'MX', 'CA', 'DE', 'JP']);

function validateHts(code) {
    const cleanCode = String(code).replace(/\./g, '').trim();

    if (!/^\d{6,10}$/.test(cleanCode)) {
        return ErrorCatalog.HTS_INVALID_FORMAT;
    }

    if (!KNOWN_HTS_CODES.has(cleanCode.substring(0, 6))) {
        return ErrorCatalog.HTS_UNKNOWN;
    }

    return null;
}

function validateCoo(code) {
    const cleanCode = String(code).toUpperCase().trim();

    if (!VALID_COUNTRIES.has(cleanCode)) {
        return ErrorCatalog.COO_INVALID;
    }

    return null;
}

function validateCompliance(doc) {
    const validationErrors = [];

    doc.lines.forEach((line, index) => {
        // Validate HTS
        const htsError = validateHts(line.htsCode);
        if (htsError) {
            validationErrors.push({
                ...htsError,
                lineIndex: index,
                field: 'htsCode',
                value: line.htsCode
            });
        }

        // Validate COO
        const cooError = validateCoo(line.countryOfOrigin);
        if (cooError) {
            validationErrors.push({
                ...cooError,
                lineIndex: index,
                field: 'countryOfOrigin',
                value: line.countryOfOrigin
            });
        }
    });

    return validationErrors;
}

module.exports = {
    validateHts,
    validateCoo,
    validateCompliance
};
