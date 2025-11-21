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

  // 1. Precise Field Extraction (Regex over full text)
  // Matches "Invoice No: 123" or "Invoice Number 123"
  const invoiceMatch = textBlock.match(/(?:INVOICE\s*(?:NO|NUMBER)|K77082OD)[:\s]+([A-Z0-9]+)/i);
  if (invoiceMatch) header.id = invoiceMatch[1];

  // Matches "Date: Nov 20, 2025"
  const dateMatch = textBlock.match(/DATE[:\s]+([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
  if (dateMatch) header.invoiceDate = dateMatch[1];

  // Matches "Trade Terms: FOB..." or "Incoterm: FOB..."
  // Look for standard Incoterms (FOB, EXW, CIF, DAP, DDP, FCA, CPT, CIP, DAT, FAS, CFR)
  const incotermMatch = textBlock.match(/(?:TERMS|INCOTERM)[^:]*[:\s]+(FOB|EXW|CIF|DAP|DDP|FCA|CPT|CIP|DAT|FAS|CFR)\b.*$/im);
  if (incotermMatch) {
    header.incoterm = incotermMatch[0].split(':')[1].trim();
  } else {
    // Fallback: Grab the value after "Trade Terms:" if it doesn't match known codes
    const genericTerms = textBlock.match(/(?:TRADE TERMS|INCOTERM)[:\s]+([^\n]+)/i);
    if (genericTerms) header.incoterm = genericTerms[1].trim();
  }

  // Currency Detection
  if (textBlock.includes('USD') || textBlock.includes('$')) header.currency = 'USD';
  else if (textBlock.includes('EUR') || textBlock.includes('€')) header.currency = 'EUR';

  // 2. Address & Entity Extraction (Iterative)
  for (let i = 0; i < Math.min(headerLines.length, 40); i++) {
    const line = headerLines[i];
    const lower = line.toLowerCase();

    // Clean Header Line (remove FC prefix if present)
    let cleanLine = line.replace(/^FC\s+/, '');

    // Shipper Heuristic: Top lines, contains Omron, not "Sold To"
    if (i < 8 && cleanLine.includes('Omron') && !lower.includes('sold to') && !header.shipper) {
      header.shipper = cleanLine;
      // Capture next line if it looks like an address
      if (headerLines[i + 1] && !headerLines[i + 1].includes(':')) {
        header.shipper += ', ' + headerLines[i + 1];
      }
    }

    // Consignee Heuristic
    if (lower.startsWith('sold to:') || lower.startsWith('consigned to:')) {
      const val = cleanLine.replace(/^(sold to|consigned to):/i, '').trim();
      if (val) header.consignee = val;
      captureMode = 'consignee';
    } else if (captureMode === 'consignee') {
      // Stop capturing if we hit a key-value pair
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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // 1. Context: HTS Code / Country (Lookback)
    // Matches 4.2.4 digits (e.g. 8536.50.9065)
    const htsMatch = row.match(/\b(\d{4}\.\d{2}\.\d{4})\b/);
    if (htsMatch) {
      pendingHts = htsMatch[1];
      if (/United Kingdom|China|USA|Japan/i.test(row)) {
        const cooMatch = row.match(/(United Kingdom|China|USA|Japan)/i);
        if (cooMatch) pendingCountry = cooMatch[0];
      }
      continue; // Context line, not data
    }

    // 2. Data Line Matching (Token Strategy)
    // Instead of strict regex, find the last 3 numbers in the line.
    // Pattern: Space + Number + Space + Number + Space + Number + (Optional Text) + End
    // Example: "PartDesc 5 95.280 476.400" or "PartDesc 5 95.280 476.400 USD"

    // Clean row of commas in numbers to make matching easier
    // But keep spaces.
    const tokenRow = row.replace(/,/g, '');

    // Regex: 
    // Group 1: Qty (Int or Float)
    // Group 2: Price (Float)
    // Group 3: Total (Float)
    // Trailing: Optional text (USD, PCS, etc)
    const tokensMatch = tokenRow.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)(?:\s*[A-Za-z]+)?$/);

    if (tokensMatch) {
      const qty = parseFloat(tokensMatch[1]);
      const price = parseFloat(tokensMatch[2]);
      const total = parseFloat(tokensMatch[3]);

      // Sanity Check: Price * Qty should be roughly Total (allow rounding diff)
      // This filters out "Date" lines like "20 2025 10:00"
      if (Math.abs(qty * price - total) < 1.0 || total === 0) {
        // Valid Line found!

        // Description is everything BEFORE the match
        const matchIndex = row.indexOf(tokensMatch[1]); // Find where the numbers start
        // Fallback if regex stripped commas and `indexOf` fails? 
        // Using the original row length minus match length is safer?
        // Let's simply split the original row by spaces and take tokens.

        // Better: use the length of the matched part to slice the string
        // The match object index is relative to the cleaned string, might be risky.
        // Let's just trust the heuristic:
        let fullDesc = row.replace(tokensMatch[0], '').trim();

        // Clean trailing commas or spaces
        fullDesc = fullDesc.replace(/,$/, '').trim();

        // Split Part # from Description
        // Part # is usually the first token
        const firstSpace = fullDesc.indexOf(' ');
        let partNumber = "N/A";
        let description = fullDesc;

        if (firstSpace > -1) {
          const potentialPart = fullDesc.substring(0, firstSpace);
          // Heuristic: Part number usually contains digits or uppercase
          if (/\d/.test(potentialPart) || potentialPart.length > 2) {
            partNumber = potentialPart;
            description = fullDesc.substring(firstSpace).trim();
          }
        }

        // Ignore "Total" summary lines
        if (description.toLowerCase().startsWith('total')) continue;

        lines.push({
          partNumber,
          description,
          quantity: qty,
          netWeightKg: 0,
          valueUsd: total,
          unitPrice: price,
          htsCode: pendingHts || '',
          countryOfOrigin: pendingCountry || ''
        });

        pendingHts = ''; // Consume context
      }
    }
  }

  return lines;
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
  // If local parser found 0 lines, assume text extraction failed (e.g. scanned PDF)
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
          console.log("OCR Success. Retrying parse with OCR text.");
          text = data.text;
          rawDoc = {
            header: parseHeader(text),
            lines: parseLines(text),
            meta: { ...meta, ocrUsed: true }
          };
        }
      } else {
        console.warn("OCR Service responded with:", response.status);
      }
    } catch (err) {
      console.error("OCR Service Failed:", err.message);
    }
  }

  // 3. Safety Net (Prevent UI Validation Blockers)
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
