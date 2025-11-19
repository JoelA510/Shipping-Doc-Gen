/**
 * Error Catalog for Compliance Validation
 */
const ErrorCatalog = {
    HTS_INVALID_FORMAT: {
        code: 'HTS_INVALID_FORMAT',
        severity: 'warning',
        message: 'HTS code must be 6 to 10 digits',
        suggestion: 'Check the HTS code format.'
    },
    HTS_UNKNOWN: {
        code: 'HTS_UNKNOWN',
        severity: 'warning',
        message: 'HTS code not found in standard list',
        suggestion: 'Verify the HTS code against the official schedule.'
    },
    COO_INVALID: {
        code: 'COO_INVALID',
        severity: 'error',
        message: 'Country of Origin must be a valid 2-letter ISO code',
        suggestion: 'Use a valid ISO 3166-1 alpha-2 code (e.g., US, CN).'
    }
};

module.exports = {
    ErrorCatalog
};
