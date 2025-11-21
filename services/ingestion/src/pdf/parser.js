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

  // 1. Address & Entity Extraction
  for (let i = 0; i < Math.min(headerLines.length, 40); i++) {
    const line = headerLines[i];
    const lower = line.toLowerCase();

    // Clean Header Line (remove FC prefix if present)
    let cleanLine = line;
    if (cleanLine.startsWith("FC ")) cleanLine = cleanLine.substring(3);

    // Shipper Heuristic
    if (i < 8 && cleanLine.includes('Omron') && !lower.includes('sold to') && !header.shipper) {
      header.shipper = cleanLine;
      if (headerLines[i + 1]) header.shipper += ', ' + headerLines[i + 1];
    }

    // Consignee Heuristic
    if (lower.startsWith('sold to:') || lower.startsWith('consigned to:')) {
      const val = line.replace(/^(sold to|consigned to):/i, '').trim();
      if (val) header.consignee = val;
      captureMode = 'consignee';
    } else if (captureMode === 'consignee') {
      if (line.includes(':')) captureMode = null;
      else header.consignee += ', ' + line;
    }

    // Key-Value Extraction
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

    // 1. Context: HTS Code / Country
    // Pattern: 4.2.4 digits
    const htsMatch = row.match(/\b(\d{4}\.\d{2}\.\d{4})\b/);
    if (htsMatch) {
      pendingHts = htsMatch[1];
      if (/United Kingdom|China|USA|Japan/i.test(row)) {
        const cooMatch = row.match(/(United Kingdom|China|USA|Japan)/i);
        if (cooMatch) pendingCountry = cooMatch[0];
      }
      continue;
    }

    // 2. Strategy A: Single Line Match (Strict)
    // [Desc] [Qty] [Price] [Total]
    const singleLineRegex = /^(.+?)\s+([\d,.]+)\s+([\d,.]+)\s+([\d,.]+)\s*$/;
    const match = row.match(singleLineRegex);

    if (match) {
      // Sanity check: Qty must be a valid number
      const q = parseFloat(match[2].replace(/,/g, ''));
      if (!isNaN(q)) {
        lines.push(formatLine(match[1], match[2], match[3], match[4], pendingHts, pendingCountry));
        pendingHts = '';
        continue;
      }
    }

    // 3. Strategy B: Multi-line Lookahead
    // Common in PDFs: Desc on Line 1, Qty on Line 2, Price on Line 3...
    if (i + 1 < rows.length) {
      const nextRow = rows[i + 1];

      // If next row is strictly a number (Qty)
      if (/^\d+(\.\d+)?$/.test(nextRow)) {

        // Check i+2 (Price) and i+3 (Total)
        if (i + 3 < rows.length) {
          const priceRow = rows[i + 2];
          const totalRow = rows[i + 3];

          // Check if Price and Total look numeric
          if (/^[\d,.]+$/.test(priceRow) && /^[\d,.]+$/.test(totalRow)) {
            // Found a split block!
            lines.push(formatLine(row, nextRow, priceRow, totalRow, pendingHts, pendingCountry));

            pendingHts = '';
            i += 3; // Skip the consumed lines
            continue;
          }
        }
      }
    }
  }

  return lines;
}

function formatLine(rawDesc, rawQty, rawPrice, rawTotal, hts, country) {
  const rawPartDesc = rawDesc.trim();
  const quantity = parseFloat(rawQty.replace(/,/g, ''));
  const unitPrice = parseFloat(rawPrice.replace(/,/g, ''));
  const totalValue = parseFloat(rawTotal.replace(/,/g, ''));

  // Split Part # from Description
  const tokens = rawPartDesc.split(/\s+/);
  let partNumber = tokens[0];
  let description = rawPartDesc.substring(partNumber.length).trim();

  if (!description) {
    description = partNumber;
    partNumber = "N/A";
  }

  return {
    partNumber,
    description,
    quantity,
    netWeightKg: 0,
    valueUsd: totalValue,
    unitPrice,
    htsCode: hts || '',
    countryOfOrigin: country || ''
  };
}

async function parsePdf(buffer) {
  let text = '';
  const meta = { sourceType: 'pdf', raw: {} };

  // 1. Local Parsing
  try {
    const result = await pdf(buffer);
    text = result.text;
    meta.raw.textLength = text.length;
    meta.raw.numpages = result.numpages;
  } catch (error) {
    console.error("Local Parse Failed:", error.message);
  }

  let rawDoc = {
    header: parseHeader(text),
    lines: parseLines(text),
    meta
  };

  // 2. OCR Fallback
  // If local regex found nothing, try the OCR service
  if (rawDoc.lines.length === 0) {
    console.log("Local parsing found 0 lines. Attempting OCR Service...");
    const ocrUrl = process.env.OCR_SERVICE_URL || 'http://ocr:5000';

    try {
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      formData.append('file', blob, 'document.pdf');

      const response = await fetch(`${ocrUrl}/extract`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (data.text) {
          console.log("OCR Success. Retrying parse.");
          text = data.text;
          rawDoc = {
            header: parseHeader(text),
            lines: parseLines(text), // Retry parsing on OCR text
            meta: { ...meta, ocrUsed: true }
          };
        }
      }
    } catch (err) {
      console.error("OCR Service Failed:", err.message);
    }
  }

  // 3. Safety Net
  if (rawDoc.lines.length === 0) {
    rawDoc.lines.push({
      partNumber: "PARSING_CHECK",
      description: "Could not auto-extract lines. Please edit manually.",
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
