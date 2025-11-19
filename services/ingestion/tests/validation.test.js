const assert = require('assert');
const { validateHts, validateCoo, validateCompliance } = require('../src/validation/validators');
const { ErrorCatalog } = require('../src/validation/catalog');

describe('Compliance Validators', () => {
    describe('HTS Validation', () => {
        it('should pass for valid known HTS codes', () => {
            assert.strictEqual(validateHts('847150'), null);
            assert.strictEqual(validateHts('8471.50'), null); // Should handle dots
        });

        it('should return INVALID_FORMAT for short codes', () => {
            const error = validateHts('123');
            assert.strictEqual(error.code, ErrorCatalog.HTS_INVALID_FORMAT.code);
        });

        it('should return UNKNOWN for unknown codes', () => {
            const error = validateHts('123456');
            assert.strictEqual(error.code, ErrorCatalog.HTS_UNKNOWN.code);
        });
    });

    describe('COO Validation', () => {
        it('should pass for valid ISO codes', () => {
            assert.strictEqual(validateCoo('US'), null);
            assert.strictEqual(validateCoo('cn'), null); // Should handle lowercase
        });

        it('should return INVALID for invalid codes', () => {
            const error = validateCoo('USA');
            assert.strictEqual(error.code, ErrorCatalog.COO_INVALID.code);
        });
    });

    describe('Full Compliance Validation', () => {
        it('should collect errors from all lines', () => {
            const doc = {
                lines: [
                    { htsCode: '847150', countryOfOrigin: 'US' }, // Valid
                    { htsCode: '000000', countryOfOrigin: 'XX' }  // Invalid HTS and COO
                ]
            };

            const errors = validateCompliance(doc);
            assert.strictEqual(errors.length, 2);

            const htsError = errors.find(e => e.field === 'htsCode');
            assert.strictEqual(htsError.lineIndex, 1);
            assert.strictEqual(htsError.code, ErrorCatalog.HTS_UNKNOWN.code);

            const cooError = errors.find(e => e.field === 'countryOfOrigin');
            assert.strictEqual(cooError.lineIndex, 1);
            assert.strictEqual(cooError.code, ErrorCatalog.COO_INVALID.code);
        });
    });
});
