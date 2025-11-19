const pdf = require('pdf-parse');
const { normalizeDocument } = require('../utils');

function parseHeader(textBlock) {
  const headerLines = textBlock
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const header = {};
  for (const line of headerLines) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    header[key.trim().toLowerCase()] = rest.join(':').trim();
  }
  return {
    shipper: header.shipper || '',
    consignee: header.consignee || '',
    incoterm: header.incoterm || '',
    currency: header.currency || '',
    reference: header.reference
  };
}

function parseLines(textBlock) {
  const rows = textBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^#/.test(line));
  const lines = [];
  for (const row of rows) {
    const parts = row.split('|').map((value) => value.trim());
    if (parts.length < 7) continue;
    const [partNumber, description, quantity, weight, value, htsCode, country] = parts;
    lines.push({
      partNumber,
      description,
      quantity,
      netWeightKg: weight,
      valueUsd: value,
      htsCode,
      countryOfOrigin: country
    });
  }
  return lines;
}

function extractSections(text) {
  const sections = text.split(/\n\s*Lines:\s*/i);
  if (sections.length < 2) {
    throw new Error('PDF is missing lines section');
  }
  const [headerBlock, linesBlock] = sections;
  const headerSection = headerBlock.replace(/Header:\s*/i, '').trim();
  const linesSection = linesBlock.trim();
  return { headerSection, linesSection };
}

async function parsePdf(buffer) {
  let text = '';
  const meta = {
    sourceType: 'pdf',
    raw: {}
  };
  try {
    try {
      const result = await pdf(buffer);
      text = result.text;
      meta.raw.textLength = text.length;
      meta.raw.details = result.info || {};
    } catch (parseError) {
      // Fallback to OCR extraction for scanned PDFs
      const { extractTextFromPdf } = require('../../ocr/ocr');
      try {
        text = await extractTextFromPdf(buffer);
        meta.raw.fallback = true;
        meta.raw.ocr = true;
      } catch (ocrError) {
        // If OCR also fails, rethrow original parse error with additional context
        parseError.message += ' | OCR fallback also failed.';
        throw parseError;
      }
    }
  } catch (error) {
    const fallbackText = buffer.toString('utf8');
    if (/^%PDF/.test(fallbackText)) {
      error.code = 'PDF_PARSE_FAILED';
      throw error;
    }
    text = fallbackText;
    meta.raw.fallback = true;
    meta.raw.error = error.message;
  }

  const { headerSection, linesSection } = extractSections(text);

  const rawDoc = {
    header: parseHeader(headerSection),
    lines: parseLines(linesSection),
    meta
  };

  if (!rawDoc.lines.length) {
    throw new Error('No line items could be extracted from PDF');
  }

  return normalizeDocument(rawDoc);
}

module.exports = {
  parsePdf
};
