const pdf = require('pdf-parse');
const { normalizeDocument } = require('../utils');

function parseHeader(textBlock) {
  // Same robust header logic as before
  const headerLines = textBlock.split('\n').map(l => l.trim()).filter(Boolean);
  const header = { shipper: '', consignee: '', incoterm: '', currency: '', reference: undefined, invoiceDate: '', invoiceNumber: '' };

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
  let pendingHts = '';
  let pendingCountry = '';

  // Regex for "Smashed" Rows (Omron PDF quirk)
  // Matches: PartNumber ending in char/digit, followed immediately by Total(float), Price(float), Qty(int)
  // Example: SL0A1275D476.40095.2805 -> Part:SL0A1275D Total:476.400 Price:95.280 Qty:5
  const smashedRegex = /([A-Z0-9\-]+)(\d+\.\d{3})(\d+\.\d{3})(\d+)$/;

  // Regex for "Clean" Rows (Standard space-separated)
  const cleanRegex = /([\d\.]+)\s+([\d\.]+)\s+([\d\.]+)(?:\s*[A-Za-z]+)?$/;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. Context Capture
    const htsMatch = row.match(/\b(\d{4}\.\d{2}\.\d{4})\b/);
    if (htsMatch) {
      pendingHts = htsMatch[1];
      if (/United Kingdom|China|USA|Japan/i.test(row)) {
        const cooMatch = row.match(/(United Kingdom|China|USA|Japan)/i);
        if (cooMatch) pendingCountry = cooMatch[0];
      }
    }

    // 2. Try Smashed Match (Priority for this bad PDF)
    // We scan the windows because the smashed content might be on the same line or joined
    let foundMatch = false;

    for (let w = 0; w < 4; w++) {
      if (i + w >= rows.length) break;
      let combinedText = "";
      for (let k = 0; k <= w; k++) combinedText += rows[i + k]; // No spaces for smashed check!

      const smashMatch = combinedText.match(smashedRegex);
      if (smashMatch) {
        // Extract
        const partNumber = smashMatch[1];
        const total = parseFloat(smashMatch[2]);
        const price = parseFloat(smashMatch[3]);
        const qty = parseInt(smashMatch[4], 10);

        // Math Check
        if (Math.abs(qty * price - total) < 1.0) {
          lines.push({
            partNumber: partNumber,
            description: "Extracted Part", // Description is often lost in smashed text
            quantity: qty,
            netWeightKg: 0,
            valueUsd: total,
            unitPrice: price,
            htsCode: pendingHts || '',
            countryOfOrigin: pendingCountry || ''
          });
          pendingHts = '';
          foundMatch = true;
          i += w; // Advance
          break;
        }
      }
    }
    if (foundMatch) continue;

    // 3. Try Clean Match (Fallback for normal lines)
    for (let w = 0; w < 3; w++) {
      if (i + w >= rows.length) break;
      let combinedText = "";
      for (let k = 0; k <= w; k++) combinedText += " " + rows[i + k]; // Spaces for clean check
      combinedText = combinedText.trim().replace(/(\d),(\d)/g, '$1$2');

      const match = combinedText.match(cleanRegex);
      if (match) {
        const qty = parseFloat(match[1]);
        const price = parseFloat(match[2]);
        const total = parseFloat(match[3]);

        if (!isNaN(qty) && !isNaN(price) && !isNaN(total)) {
          if (Math.abs(qty * price - total) < 2.0) {
            // Extract Description
            const rawDesc = combinedText.substring(0, combinedText.indexOf(match[0])).trim();
            const tokens = rawDesc.split(/\s+/);
            let partNumber = tokens[0];
            let description = rawDesc.substring(partNumber.length).trim();
            if (!description) { description = partNumber; partNumber = "N/A"; }

            if (description.toLowerCase().includes('total')) break;

            lines.push({
              partNumber: partNumber,
              description: description,
              quantity: qty,
              netWeightKg: 0,
              valueUsd: total,
              unitPrice: price,
              htsCode: pendingHts || '',
              countryOfOrigin: pendingCountry || ''
            });
            pendingHts = '';
            foundMatch = true;
            i += w;
            break;
          }
        }
      }
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