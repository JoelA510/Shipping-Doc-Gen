/**
 * OCR stub module for extracting text from PDFs.
 * This is a placeholder until the full OCR microservice is implemented.
 */

/**
 * OCR stub module for extracting text from PDFs.
 * This is a placeholder until the full OCR microservice is implemented.
 */

/**
 * Extract text from a PDF buffer using OCR.
 * @param {Buffer} buffer - PDF file buffer
 * @returns {Promise<string>} Extracted text
 */
async function extractTextFromPdf(buffer) {
    // Check if OCR is enabled via environment variable
    const ocrEnabled = process.env.OCR_ENABLED === 'true';

    if (!ocrEnabled) {
        const error = new Error('OCR is not enabled. Set OCR_ENABLED=true to use OCR fallback.');
        error.code = 'OCR_DISABLED';
        throw error;
    }

    // TODO: Implement actual OCR integration with Tesseract/PaddleOCR
    // For now, throw an error indicating OCR service is not yet implemented
    const error = new Error('OCR microservice not yet implemented. See services/ocr/README.md for Phase 3 implementation plan.');
    error.code = 'OCR_NOT_IMPLEMENTED';
    throw error;
}

module.exports = {
    extractTextFromPdf
};
