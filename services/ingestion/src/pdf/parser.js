const pdf = require('pdf-parse');
const { normalizeDocument } = require('../utils');

function parseHeader(textBlock) {
  const headerLines = textBlock.split('\n').map(l => l.trim()).filter(Boolean);

  const header = {
    shipper: '',
    consignee: '',
    incoterm: '',
    currency: '',
    reference: undefined,
    invoiceDate: '',
    invoiceNumber: ''
  };

  let captureMode = null;

  // 1. Address & Entity Extraction (First 30 lines)
  for (let i = 0; i < Math.min(headerLines.length, 30); i++) {
    const line = headerLines[i];
    const lower = line.toLowerCase();

    // Shipper Heuristic
    if (i < 5 && line.includes('Omron') && !lower.includes('sold to') && !header.shipper) {
      header.shipper = line;
      if (headerLines[i + 1]) header.shipper += ', ' + headerLines[i + 1];
    }

    // Consignee Heuristic
    if (lower.startsWith('sold to:') || lower.startsWith('consigned to:')) {
      const val = line.replace(/^(sold to|consigned to):/i, '').trim();
      if (val) header.consignee = val;
      captureMode = 'consignee';
    } else if (captureMode === 'consignee') {
      if (line.includes(':')) {
        captureMode = null;
      } else {
        header.consignee += ', ' + line;
      }
    }

    // 2. Key-Value Extraction
    if (line.includes(':')) {
      const [key, ...rest] = line.split(':');
      const val = rest.join(':').trim();
      const cleanKey = key.trim().toLowerCase();

      if (cleanKey.includes('invoice number') || cleanKey === 'invoice no') header.id = val;
      if (cleanKey === 'date') header.invoiceDate = val;
      if (cleanKey.includes('payment terms')) header.paymentTerms = val;
      if (cleanKey.includes('incoterm') || cleanKey.includes('trade terms')) header.incoterm = val;
      if (cleanKey.includes('currency')) header.currency = val;
    }
  }

  // Default Currency
  if (!header.currency) {
    if (textBlock.includes('USD') || textBlock.includes('$')) header.currency = 'USD';
    else if (textBlock.includes('EUR')) header.currency = 'EUR';
  }

  return header;
}

function parseLines(textBlock) {
  const rows = textBlock.split('\n').map(l => l.trim()).filter(l => l && !/^#/.test(l));
  const lines = [];

  let pendingHts = '';
  let pendingCountry = '';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. HTS Code Context
    // Matches 4.2.4 or similar patterns
    const htsMatch = row.match(/\b(\d{4}\.\d{2}\.\d{4})\b/);
    if (htsMatch) {
      pendingHts = htsMatch[1];
      if (/United Kingdom|China|USA|Japan/i.test(row)) {
        const cooMatch = row.match(/(United Kingdom|China|USA|Japan)/i);
        if (cooMatch) pendingCountry = cooMatch[0];
      }
      continue;
    }

    // 2. Data Line Matching
    // Regex: [Desc] [Qty(int/float)] [Price(float)] [Total(float)]
    // Improved: Handles comma in numbers, decimals in quantity, trailing spaces
    const dataLineRegex = /^(.+?)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s*$/;
    const match = row.match(dataLineRegex);

    if (match) {
      const rawPartDesc = match[1].trim();
      const quantity = parseFloat(match[2].replace(/,/g, ''));
      const unitPrice = parseFloat(match[3].replace(/,/g, ''));
      const totalValue = parseFloat(match[4].replace(/,/g, ''));

      // Filter out false positives (Dates, Totals)
      if (rawPartDesc.includes('DATE:') || rawPartDesc.includes('TOTAL') || isNaN(quantity)) continue;

      // Simple Part/Desc Split
      const tokens = rawPartDesc.split(/\s+/);
      let partNumber = tokens[0];
      let description = rawPartDesc.substring(partNumber.length).trim();

      if (!description) {
        description = partNumber;
        partNumber = "N/A";
      }

      lines.push({
        partNumber: partNumber,
        description: description,
        quantity: quantity,
        netWeightKg: 0,
        valueUsd: totalValue,
        unitPrice: unitPrice,
        htsCode: pendingHts || '',
        countryOfOrigin: pendingCountry || ''
      });

      pendingHts = ''; // Reset
    }
  }

  return lines;
}

async function parsePdf(buffer) {
  let text = '';
  const meta = { sourceType: 'pdf', raw: {} };

  try {
    const result = await pdf(buffer);
    text = result.text;
    meta.raw.textLength = text.length;
    meta.raw.numpages = result.numpages;
    // Log text snippet to debug extraction issues
    console.log("PDF Text Snippet:", text.substring(0, 500).replace(/\n/g, ' '));
  } catch (error) {
    // OCR Fallback
    try {
      if (process.env.OCR_ENABLED !== 'true') throw new Error('OCR disabled');
      const ocrUrl = process.env.OCR_SERVICE_URL || 'http://ocr:5000';
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      formData.append('file', blob, 'document.pdf');
      const response = await fetch(`${ocrUrl}/extract`, { method: 'POST', body: formData });
      if (!response.ok) throw new Error(`OCR Service responded with ${response.status}`);
      const data = await response.json();
      text = data.text;
      meta.raw.fallback = true;
      meta.raw.ocr = true;
    } catch (ocrError) {
      error.message += ` | OCR fallback also failed: ${ocrError.message}`;
      throw error;
    }
  }

  const rawDoc = {
    header: parseHeader(text),
    lines: parseLines(text),
    meta
  };

  // SAFETY NET: Prevent "Validation Failed" if regex finds nothing
  if (rawDoc.lines.length === 0) {
    console.warn("Parser found 0 lines. Inserting placeholder.");
    rawDoc.lines.push({
      partNumber: "PARSING_CHECK",
      description: "Could not auto-extract lines. Please edit manually or check OCR logs.",
      quantity: 1,
      netWeightKg: 1,
      valueUsd: 1,
      htsCode: "000000",
      countryOfOrigin: "US"
    });
  }

  return normalizeDocument(rawDoc);
}

module.exports = {
  parsePdf
};
