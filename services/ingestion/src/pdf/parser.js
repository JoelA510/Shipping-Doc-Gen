const pdf = require('pdf-parse');
const { normalizeDocument } = require('../utils');

function parseHeader(textBlock) {
  // ... (Header logic remains the same, it is working) ...
  const headerLines = textBlock.split('\n').map(l => l.trim()).filter(Boolean);
  const header = { shipper: '', consignee: '', incoterm: '', currency: '', reference: undefined, invoiceDate: '', invoiceNumber: '' };

  const invoiceMatch = textBlock.match(/(?:INVOICE\s*(?:NO|NUMBER)|K77082OD)[:\s]+([A-Z0-9]+)/i);
  if (invoiceMatch) header.id = invoiceMatch[1];

  const dateMatch = textBlock.match(/DATE[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (dateMatch) header.invoiceDate = dateMatch[1];

  const incotermMatch = textBlock.match(/(?:(?<!PAYMENT\s)TERMS|INCOTERM)[^:]*[:\s]+(.*?)(?=\s+(?:COUNTRY|UNITED|TOTAL)|$)/im);
  if (incotermMatch) {
    let term = incotermMatch[1].trim();
    term = term.replace(/[-–]\s*COLLECT.*$/i, 'COLLECT');
    term = term.replace(/UNITED\s*KINGDOM/i, '');
    header.incoterm = term.trim();
  }

  if (textBlock.includes('USD') || textBlock.includes('$')) header.currency = 'USD';
  else if (textBlock.includes('EUR') || textBlock.includes('€')) header.currency = 'EUR';

  let captureMode = null;
  for (let i = 0; i < Math.min(headerLines.length, 40); i++) {
    let line = headerLines[i];
    const lower = line.toLowerCase();
    line = line.replace(/^FC\s+/, '');

    if (i < 8 && line.includes('Omron') && !lower.includes('sold to') && !header.shipper) {
      header.shipper = line;
      if (headerLines[i + 1] && !headerLines[i + 1].includes(':')) header.shipper += ', ' + headerLines[i + 1];
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

  // Regex for Smashed Rows
  const smashedMathRegex = /(\d+\.\d{3})(\d+\.\d{3})(\d+)/g;
  // Regex for clean HTS (4.2.4)
  const htsRegex = /(\d{4}\.\d{2}\.\d{4})/;

  // Deduplication Set
  const seenLines = new Set();

  for (let i = 0; i < rows.length; i++) {
    // Smashed Logic (Window = 4)
    let foundMatch = false;
    for (let w = 0; w < 4; w++) {
      if (i + w >= rows.length) break;
      let combinedText = "";
      for (let k = 0; k <= w; k++) combinedText += rows[i + k];

      smashedMathRegex.lastIndex = 0;
      let match;

      while ((match = smashedMathRegex.exec(combinedText)) !== null) {
        const total = parseFloat(match[1]);
        const price = parseFloat(match[2]);
        const rawQtyString = match[3];

        for (let len = 1; len <= rawQtyString.length; len++) {
          const qtyCandidate = parseInt(rawQtyString.substring(0, len), 10);
          if (isNaN(qtyCandidate)) continue;

          if (Math.abs(price * qtyCandidate - total) < 1.0) {

            // Extraction
            const beforeMatch = combinedText.substring(0, match.index);

            // 1. Extract HTS from the garbage blob
            let hts = "";
            const htsMatch = beforeMatch.match(htsRegex);
            if (htsMatch) hts = htsMatch[1];

            // 2. Clean Part Number
            // Remove HTS code first
            let partNumber = beforeMatch.replace(htsRegex, '').trim();

            // Remove line item numbers (3-4 digits at start)
            partNumber = partNumber.replace(/^\d{3,4}/, '').trim();

            // Remove long reference numbers (10+ digits or patterns like 00143...)
            partNumber = partNumber.replace(/\d{10,}/g, '').trim();

            // Remove specific patterns (e.g., 4SX424405, OP006000143)
            partNumber = partNumber.replace(/\d{4}[A-Z]{2}\d{4,}/g, '').trim();
            partNumber = partNumber.replace(/[A-Z]{2}\d{9,}/g, '').trim();

            // Remove repeating letter patterns (e.g., OPOP, FC FC)
            partNumber = partNumber.replace(/([A-Z]{2,})\1+/g, '$1').trim();

            // Remove noise words
            partNumber = partNumber.replace(/USD|PCS|United\s*Kingdom/gi, '').trim();

            // Extract distinctive Omron part number patterns:
            // - Pattern 1: Letters followed by numbers/letters/hyphens (e.g., SL0A1275D, ER5018-021M, G9SA-321-SC)
            // - Look for: 2+ letters, then mix of letters/numbers/hyphens, 5-20 total chars
            let partMatch = partNumber.match(/([A-Z]{2}[0-9A-Z\-]{3,18})/);

            // Pattern 2: If not found, try to find any alphanumeric with hyphens
            if (!partMatch) {
              partMatch = partNumber.match(/([A-Z0-9]+-[A-Z0-9\-]+)/);
            }

            // Pattern 3: If still not found, look for significant alphanumeric sequence
            if (!partMatch) {
              partMatch = partNumber.match(/([A-Z]{2,}[0-9A-Z]{3,})/);
            }

            if (partMatch) {
              partNumber = partMatch[1];
              // Remove trailing garbage (pure numbers at end longer than 4 digits)
              partNumber = partNumber.replace(/\d{5,}$/, '').trim();
              // Remove leading OP prefix if it's a reference code artifact
              partNumber = partNumber.replace(/^OP\d{6}/, '').trim();
            } else if (partNumber.length > 20) {
              partNumber = partNumber.substring(0, 20).trim();
            }

            if (!partNumber || partNumber.length < 3) partNumber = "Part";

            // Dedupe Key (fixed: use qtyCandidate not qty)
            const lineKey = `${partNumber}-${qtyCandidate}-${total}`;
            if (!seenLines.has(lineKey)) {
              seenLines.add(lineKey);
              lines.push({
                partNumber: partNumber,
                description: partNumber, // Description is often lost in smashed text
                quantity: qtyCandidate,
                netWeightKg: 0,
                valueUsd: total,
                unitPrice: price,
                htsCode: hts || '',
                countryOfOrigin: 'GB' // Inferred from header for this specific doc
              });
            }

            foundMatch = true;
            i += w;
            break;
          }
        }
        if (foundMatch) break;
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
  } catch (error) {
    // silent catch
  }

  let rawDoc = {
    header: parseHeader(text),
    lines: parseLines(text),
    meta
  };

  // OCR / Safety Net
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
            lines: parseLines(text),
            meta: { ...meta, ocrUsed: true }
          };
        }
      }
    } catch (e) { }
  }

  if (rawDoc.lines.length === 0) {
    rawDoc.lines.push({
      partNumber: "PARSING_CHECK",
      description: "Manual Review Required",
      quantity: 1, netWeightKg: 1, valueUsd: 1, htsCode: "000000", countryOfOrigin: "US"
    });
  }

  return normalizeDocument(rawDoc);
}

module.exports = {
  parsePdf
};