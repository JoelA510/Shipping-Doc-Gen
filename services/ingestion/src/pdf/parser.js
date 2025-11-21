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

  let captureMode = null; // 'shipper' | 'consignee'

  // 1. Address & Entity Extraction
  for (let i = 0; i < Math.min(headerLines.length, 30); i++) {
    const line = headerLines[i];
    const lower = line.toLowerCase();

    // Shipper Heuristic: The top lines usually contain the Shipper (Omron)
    // Stop if we hit "SOLD TO" or "INVOICE"
    if (i < 5 && line.includes('Omron') && !lower.includes('sold to') && !header.shipper) {
      header.shipper = line; // Capture first line as name
      // Capture next 2 lines as address context
      if (headerLines[i + 1]) header.shipper += ', ' + headerLines[i + 1];
      if (headerLines[i + 2]) header.shipper += ', ' + headerLines[i + 2];
    }

    // Consignee Heuristic: "SOLD TO" or "CONSIGNED TO"
    if (lower.startsWith('sold to:') || lower.startsWith('consigned to:')) {
      // Clean the label
      const val = line.replace(/^(sold to|consigned to):/i, '').trim();
      if (val) header.consignee = val;
      captureMode = 'consignee';
    } else if (captureMode === 'consignee') {
      // Stop capturing if we hit a new label
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

  // Default Currency Fallback
  if (!header.currency) {
    if (textBlock.includes('USD') || textBlock.includes('$')) header.currency = 'USD';
    else if (textBlock.includes('EUR')) header.currency = 'EUR';
  }

  return header;
}

function parseLines(textBlock) {
  console.log("--- STARTING NEW STRICT PARSER ---"); // Proof of life
  const rows = textBlock.split('\n').map(l => l.trim()).filter(l => l && !/^#/.test(l));
  const lines = [];

  let pendingHts = '';
  let pendingCountry = '';

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. Look for HTS Codes (Context for next line)
    // Pattern: 4 digits . 2 digits . 4 digits (e.g. 8536.50.9065)
    const htsMatch = row.match(/\b(\d{4}\.\d{2}\.\d{4})\b/);
    if (htsMatch) {
      pendingHts = htsMatch[1];
      // Look for Country on the same line
      if (/United Kingdom|China|USA|Japan/i.test(row)) {
        const cooMatch = row.match(/(United Kingdom|China|USA|Japan)/i);
        if (cooMatch) pendingCountry = cooMatch[0];
      }
      continue; // Don't treat this as a data line
    }

    // 2. Look for Data Lines (Strict 3-number suffix)
    // Format: [Description Text] [Qty] [Price] [Total]
    // Regex: Ends with space + Int + space + Float + space + Float
    // Example: "... 5 95.280 476.400"
    const dataLineRegex = /^(.+?)\s+(\d+)\s+([\d,.]+)\s+([\d,.]+)$/;
    const match = row.match(dataLineRegex);

    if (match) {
      const rawPartDesc = match[1].trim();
      const quantity = parseFloat(match[2]);
      const unitPrice = parseFloat(match[3].replace(/,/g, ''));
      const totalValue = parseFloat(match[4].replace(/,/g, ''));

      // Skip if the "Description" looks like a date line or noise
      if (rawPartDesc.includes('DATE:') || rawPartDesc.includes('TOTALS')) continue;

      // Attempt to split Part Number from Description
      // Heuristic: Part Number is usually the first "word", but sometimes separated by spaces
      // We'll take the first token as part number if it contains digits
      const tokens = rawPartDesc.split(/\s+/);
      let partNumber = tokens[0];
      let description = rawPartDesc.substring(partNumber.length).trim();

      // If description is empty, the whole thing might be the part number or description
      if (!description) {
        description = partNumber;
        partNumber = "N/A";
      }

      lines.push({
        partNumber: partNumber,
        description: description,
        quantity: quantity,
        netWeightKg: 0, // Weight often on separate line in this format
        valueUsd: totalValue,
        unitPrice: unitPrice,
        htsCode: pendingHts,
        countryOfOrigin: pendingCountry || ''
      });

      // Clear HTS context after using it
      pendingHts = '';
    }
  }

  return lines;
}

async function parsePdf(buffer) {
  let text = '';
  const meta = {
    sourceType: 'pdf',
    raw: {}
  };

  try {
    const result = await pdf(buffer);
    text = result.text;
    meta.raw.textLength = text.length;
    meta.raw.numpages = result.numpages;
  } catch (error) {
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

  // In this specific layout, header/body/footer are mixed in the text stream
  // We pass the full text to both parsers, but parsers are strict about what they extract.
  const rawDoc = {
    header: parseHeader(text),
    lines: parseLines(text),
    meta
  };

  if (!rawDoc.lines.length) {
    // If strict parsing failed completely, we might want to throw or return empty
    // This prevents "garbage" lines from appearing
    console.warn("Strict parser found no lines. Returning empty line array to avoid garbage.");
  }

  return normalizeDocument(rawDoc);
}

module.exports = {
  parsePdf
};
