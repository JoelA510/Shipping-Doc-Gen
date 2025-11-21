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

  // 1. Regex Extraction
  const invoiceMatch = textBlock.match(/(?:INVOICE\s*(?:NO|NUMBER)|K77082OD)[:\s]+([A-Z0-9]+)/i);
  if (invoiceMatch) header.id = invoiceMatch[1];

  const dateMatch = textBlock.match(/DATE[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (dateMatch) header.invoiceDate = dateMatch[1];

  const incotermMatch = textBlock.match(/(?:TERMS|INCOTERM)[^:]*[:\s]+(.*?)(?=\s+(?:COUNTRY|UNITED|TOTAL)|$)/im);
  if (incotermMatch) {
    let term = incotermMatch[1].trim();
    term = term.replace(/[-–]\s*COLLECT.*$/i, 'COLLECT');
    term = term.replace(/UNITED\s*KINGDOM/i, '');
    header.incoterm = term.trim();
  }

  if (textBlock.includes('USD') || textBlock.includes('$')) header.currency = 'USD';
  else if (textBlock.includes('EUR') || textBlock.includes('€')) header.currency = 'EUR';

  // 2. Address Extraction
  let captureMode = null;
  for (let i = 0; i < Math.min(headerLines.length, 40); i++) {
    let line = headerLines[i];
    const lower = line.toLowerCase();
    line = line.replace(/^FC\s+/, '');

    if (i < 8 && line.includes('Omron') && !lower.includes('sold to') && !header.shipper) {
      header.shipper = line;
      if (headerLines[i + 1] && !headerLines[i + 1].includes(':')) {
        header.shipper += ', ' + headerLines[i + 1];
      }
    }

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

  // Regex to find the "Total Price Qty" cluster inside smashed text
  // Looks for: 123.456 (Total) 12.345 (Price) 123 (Qty)
  // The decimals are usually 3 digits in this specific PDF output
  const smashedMathRegex = /(\d+\.\d{3})(\d+\.\d{3})(\d+)/g;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. Context (HTS/Country)
    const htsMatch = row.match(/\b(\d{4}\.\d{2}\.\d{4})\b/);
    if (htsMatch) {
      pendingHts = htsMatch[1];
      if (/United Kingdom|China|USA|Japan/i.test(row)) {
        const cooMatch = row.match(/(United Kingdom|China|USA|Japan)/i);
        if (cooMatch) pendingCountry = cooMatch[0];
      }
    }

    // 2. Smashed Line Detection
    // We check windows because the "Part Number" might be on the previous line 
    // merged with the "Total/Price/Qty" block
    let foundMatch = false;

    for (let w = 0; w < 4; w++) {
      if (i + w >= rows.length) break;

      // Join lines without spaces to detect smashed sequences
      let combinedText = "";
      for (let k = 0; k <= w; k++) combinedText += rows[i + k];

      // Reset regex state
      smashedMathRegex.lastIndex = 0;
      let match;

      // Iterate all potential matches in the line
      while ((match = smashedMathRegex.exec(combinedText)) !== null) {
        const total = parseFloat(match[1]);
        const price = parseFloat(match[2]);
        const qty = parseInt(match[3], 10);

        // Math Check: Price * Qty == Total
        if (Math.abs(price * qty - total) < 1.0) {

          // MATCH FOUND
          // Everything BEFORE the match is the Part Number / Description
          const beforeMatch = combinedText.substring(0, match.index);

          // Heuristic to clean up Part Number
          // 1. Remove "3709" prefix (Line Item Index)
          // 2. Remove trailing noise
          let cleanPart = beforeMatch.replace(/^\d{3,4}/, '').trim();

          // Further cleanup: If it contains "United Kingdom", remove it
          cleanPart = cleanPart.replace(/United\s*Kingdom/gi, '').trim();
          cleanPart = cleanPart.replace(/USD|PCS/g, '').trim();

          // If empty, fallback
          if (!cleanPart) cleanPart = "Unidentified Part";

          lines.push({
            partNumber: cleanPart, // In smashed text, Part/Desc are merged
            description: cleanPart,
            quantity: qty,
            netWeightKg: 0,
            valueUsd: total,
            unitPrice: price,
            htsCode: pendingHts || '',
            countryOfOrigin: pendingCountry || ''
          });

          pendingHts = '';
          foundMatch = true;
          i += w; // Advance loop
          break; // Stop checking matches in this window
        }
      }
      if (foundMatch) break;
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
  } catch (error) {
    console.error("Local PDF Parse Failed:", error.message);
  }

  let rawDoc = {
    header: parseHeader(text),
    lines: parseLines(text),
    meta
  };

  // OCR Fallback
  if (rawDoc.lines.length === 0) {
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
            lines: parseLines(text), // Retry parsing on OCR text
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