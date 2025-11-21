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

  // 1. Precise Field Extraction via Regex
  const invoiceMatch = textBlock.match(/(?:INVOICE\s*(?:NO|NUMBER)|K77082OD)[:\s]+([A-Z0-9]+)/i);
  if (invoiceMatch) header.id = invoiceMatch[1];

  const dateMatch = textBlock.match(/DATE[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (dateMatch) header.invoiceDate = dateMatch[1];

  // Improved Incoterm extraction: Stop before "COUNTRY" or "UNITED"
  // Looks for "TERMS: FOB..." up to newline or next label
  const incotermMatch = textBlock.match(/(?:TERMS|INCOTERM)[^:]*[:\s]+(.*?)(?=\s+(?:COUNTRY|UNITED|TOTAL)|$)/im);
  if (incotermMatch) {
    let term = incotermMatch[1].trim();
    // Cleanup common noise if lines merged
    term = term.replace(/[-–]\s*COLLECT.*$/i, 'COLLECT'); // Normalize "FOB Origin - Collect"
    term = term.replace(/UNITED\s*KINGDOM/i, '');
    header.incoterm = term.trim();
  }

  // Currency
  if (textBlock.includes('USD') || textBlock.includes('$')) header.currency = 'USD';
  else if (textBlock.includes('EUR') || textBlock.includes('€')) header.currency = 'EUR';

  // 2. Address Extraction
  let captureMode = null;

  for (let i = 0; i < Math.min(headerLines.length, 40); i++) {
    let line = headerLines[i];
    const lower = line.toLowerCase();

    // Remove "FC " prefix if present (common PDF artifact)
    line = line.replace(/^FC\s+/, '');

    // Shipper
    if (i < 8 && line.includes('Omron') && !lower.includes('sold to') && !header.shipper) {
      header.shipper = line;
      // Capture next line if it looks like an address (no label)
      if (headerLines[i + 1] && !headerLines[i + 1].includes(':')) {
        header.shipper += ', ' + headerLines[i + 1];
      }
    }

    // Consignee
    if (lower.startsWith('sold to:') || lower.startsWith('consigned to:')) {
      const val = line.replace(/^(sold to|consigned to):/i, '').trim();
      if (val) header.consignee = val;
      captureMode = 'consignee';
    } else if (captureMode === 'consignee') {
      if (line.includes(':')) captureMode = null;
      else header.consignee += ', ' + line;
    }
  }

  return header;
}

function parseLines(textBlock) {
  const rows = textBlock.split('\n').map(l => l.trim()).filter(l => l && !/^#/.test(l));
  const lines = [];

  let pendingHts = '';
  let pendingCountry = '';

  // Sliding Window Loop
  // We check the current line, then current + next, then current + next + next2
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. Context Capture (HTS / Country)
    const htsMatch = row.match(/\b(\d{4}\.\d{2}\.\d{4})\b/);
    if (htsMatch) {
      pendingHts = htsMatch[1];
      if (/United Kingdom|China|USA|Japan/i.test(row)) {
        const cooMatch = row.match(/(United Kingdom|China|USA|Japan)/i);
        if (cooMatch) pendingCountry = cooMatch[0];
      }
      // Don't 'continue' here, as this line might ALSO contain part data
    }

    // 2. Look for Data Pattern using Windowing
    // Pattern: ... Number ... Number ... Number ... (Qty, Price, Total)
    // We clean commas to make regex simpler: 1,000.00 -> 1000.00

    // Try window sizes 1, 2, 3
    let foundMatch = false;
    for (let w = 0; w < 3; w++) {
      if (i + w >= rows.length) break;

      // Join lines in window
      let combinedText = "";
      for (let k = 0; k <= w; k++) combinedText += " " + rows[i + k];
      combinedText = combinedText.trim();

      // Clean for matching (keep spaces, remove commas in numbers)
      const cleanText = combinedText.replace(/(\d),(\d)/g, '$1$2');

      // Regex: Find last 3 numbers
      // Group 1: Qty, Group 2: Price, Group 3: Total
      // Matches: "Desc 5 95.28 476.40" OR "Desc 5 95.28 476.40 USD"
      const match = cleanText.match(/([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)(?:\s*[A-Za-z]+)?$/);

      if (match) {
        const qty = parseFloat(match[1]);
        const price = parseFloat(match[2]);
        const total = parseFloat(match[3]);

        // Validation: Math check (fuzzy for rounding)
        // This avoids matching dates like "20 11 2025"
        if (!isNaN(qty) && !isNaN(price) && !isNaN(total)) {
          const calcTotal = qty * price;
          // Check if math works out (within 1.0 margin)
          // OR if total is clearly a large number relative to qty
          if (Math.abs(calcTotal - total) < 2.0 || (total > 0 && qty > 0 && total / qty === price)) {

            // Valid Match Found!

            // Extract Description: Everything before the match
            const rawDesc = combinedText.substring(0, combinedText.indexOf(match[0])).trim();

            // Split Part # from Description
            // Logic: Part# is usually first token, unless it contains "Omron" or "Switch"
            const tokens = rawDesc.split(/\s+/);
            let partNumber = tokens[0];
            let description = rawDesc.substring(partNumber.length).trim();

            if (!description) { description = partNumber; partNumber = "N/A"; }

            // Filter Summary Lines
            if (description.toLowerCase().includes('total')) {
              // It's a footer line
              break;
            }

            lines.push({
              partNumber: partNumber,
              description: description,
              quantity: qty,
              netWeightKg: 0, // Derived later if available
              valueUsd: total,
              unitPrice: price,
              htsCode: pendingHts || '',
              countryOfOrigin: pendingCountry || ''
            });

            // Success: Advance index by window size
            i += w;
            pendingHts = '';
            foundMatch = true;
            break; // Stop windowing for this line
          }
        }
      }
    }

    if (foundMatch) continue;
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
  } catch (error) {
    console.error("Local PDF Parse Failed:", error.message);
  }

  let rawDoc = {
    header: parseHeader(text),
    lines: parseLines(text),
    meta
  };

  // OCR Fallback (Strict: Only if 0 lines found locally)
  if (rawDoc.lines.length === 0) {
    console.log("0 lines found. Triggering OCR...");
    const ocrUrl = process.env.OCR_SERVICE_URL || 'http://ocr:5000';
    try {
      const formData = new FormData();
      const blob = new Blob([buffer], { type: 'application/pdf' });
      formData.append('file', blob, 'document.pdf');

      const response = await fetch(`${ocrUrl}/extract`, { method: 'POST', body: formData });
      if (response.ok) {
        const data = await response.json();
        if (data.text) {
          text = data.text;
          rawDoc = {
            header: parseHeader(text),
            lines: parseLines(text),
            meta: { ...meta, ocrUsed: true }
          };
        }
      }
    } catch (e) {
      console.error("OCR Failed:", e.message);
    }
  }

  // Safety Net
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
