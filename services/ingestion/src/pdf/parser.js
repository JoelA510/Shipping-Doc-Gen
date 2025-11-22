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
            let afterMatch = combinedText.substring(match.index + match[0].length);

            // CRITICAL FIX: Recover the part of the "Quantity" that was actually the Part Number prefix
            // match[3] is the full captured "Qty" string (e.g. "544506")
            // rawQtyString is match[3]
            // qtyCandidate is the valid qty (e.g. 5)
            // The remainder "44506" belongs to the Part Number!
            const qtyStr = qtyCandidate.toString();
            if (rawQtyString.length > qtyStr.length) {
              const remainder = rawQtyString.substring(qtyStr.length);
              afterMatch = remainder + afterMatch;
            }

            // 1. Extract HTS
            let hts = "";
            const htsMatch = combinedText.match(htsRegex);
            if (htsMatch) hts = htsMatch[1];

            // 2. Extract Part Number (FROM SUFFIX)
            let partNumber = afterMatch.trim();

            // Cleanup Part Number
            // It might be "44506-4010" or "44506-4010 ER5018..."
            // Take the first token that looks like a part number
            const partTokenMatch = partNumber.match(/^([A-Z0-9\-\.]+)/);
            if (partTokenMatch) {
              partNumber = partTokenMatch[1];
            }

            // 3. Extract Description (From Next Line)
            let description = "";

            // Check if the suffix contained more than just the part number
            if (afterMatch.length > partNumber.length + 2) {
              description = afterMatch.substring(partNumber.length).trim();
            }

            // If description is empty/short, check the next row
            if ((!description || description.length < 3) && i + w + 1 < rows.length) {
              const nextRow = rows[i + w + 1];
              // The next row often starts with the Part Number again
              if (nextRow.startsWith(partNumber)) {
                description = nextRow.substring(partNumber.length).trim();
                i++; // Consume next line
              } else if (nextRow.includes(partNumber)) {
                // Sometimes it's "44506-4010 ER..."
                description = nextRow.substring(nextRow.indexOf(partNumber) + partNumber.length).trim();
                i++;
              } else {
                description = nextRow;
                i++;
              }
            }

            // Cleanup Description
            // 1. Remove leading non-alphanumeric garbage
            description = description.replace(/^[^A-Z0-9]+/, '');

            // 2. Remove repeating patterns "ER5018-021MER5018-021M"
            // Split by space and check for duplicate tokens
            const tokens = description.split(/\s+/);
            const uniqueTokens = [];
            for (const t of tokens) {
              // If this token is a substring of the previous one (concatenation artifact), skip it
              // e.g. "ER5018-021M" followed by "ER5018-021M,"
              const cleanT = t.replace(/[,;]$/, '');
              if (uniqueTokens.length > 0) {
                const last = uniqueTokens[uniqueTokens.length - 1];
                if (last.includes(cleanT) || cleanT.includes(last)) {
                  // Keep the longer one
                  if (cleanT.length > last.length) uniqueTokens[uniqueTokens.length - 1] = cleanT;
                  continue;
                }
              }
              uniqueTokens.push(t);
            }
            description = uniqueTokens.join(' ');

            // 3. Hard dedup for the specific "ER5018-021MER5018-021M" case
            if (description.length > 10) {
              const mid = Math.floor(description.length / 2);
              const first = description.substring(0, mid);
              const second = description.substring(mid);
              // If the second half starts with the start of the first half
              if (second.startsWith(first.substring(0, 5))) {
                // It's likely a repeat. Try to find the split point.
                // Look for the Part Number inside the description?
              }
              // Regex for "TextText"
              const repeatMatch = description.match(/^(.+?)\1/);
              if (repeatMatch && repeatMatch[1].length > 3) {
                description = repeatMatch[1];
              }
            }

            // 4. Extract PO Number
            // Look backwards for "OP..." pattern
            let poNumber = "";
            for (let back = 1; back < 15; back++) {
              if (i - back >= 0) {
                const prevRow = rows[i - back];

                // Look for PO starting with 00, containing OP, and digits
                // Raw text has repeated PO: "00143043OP006000143043OP00605"
                // We capture the first instance: 00...OP...4digits
                const poMatch = prevRow.match(/(00\d+OP\d{4})/);
                if (poMatch) {
                  poNumber = poMatch[1];
                  break;
                }
              }
            }

            // Dedupe Key
            const lineKey = `${partNumber}-${qtyCandidate}-${total}`;
            if (!seenLines.has(lineKey)) {
              seenLines.add(lineKey);
              lines.push({
                partNumber: partNumber,
                description: description || "Description",
                quantity: qtyCandidate,
                netWeightKg: 0,
                valueUsd: total,
                unitPrice: price,
                htsCode: hts || '',
                countryOfOrigin: 'GB',
                purchaseOrderNumber: poNumber || ''
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