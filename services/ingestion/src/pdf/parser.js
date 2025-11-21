const pdf = require('pdf-parse');
const { normalizeDocument } = require('../utils');

function parseHeader(textBlock) {
  const headerLines = textBlock
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const header = {
    shipper: '',
    consignee: '',
    incoterm: '',
    currency: '',
    reference: undefined,
    invoiceDate: '',
    invoiceNumber: ''
  };

  // State to capture multi-line addresses
  let captureMode = null; // 'shipper' | 'consignee'

  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i];
    const lowerLine = line.toLowerCase();

    // 1. Key-Value extraction (Right side of header usually)
    if (line.includes(':')) {
      const [key, ...rest] = line.split(':');
      const val = rest.join(':').trim();
      const cleanKey = key.trim().toLowerCase();

      if (cleanKey.includes('invoice number') || cleanKey === 'invoice no') header.id = val;
      if (cleanKey === 'date') header.invoiceDate = val;
      if (cleanKey.includes('payment terms')) header.paymentTerms = val;
      if (cleanKey.includes('incoterm') || cleanKey.includes('trade terms')) header.incoterm = val;

      // Reset capture mode if we hit a specific key
      captureMode = null;
    }

    // 2. Address Block extraction
    if (lowerLine.startsWith('sold to:') || lowerLine.startsWith('shipper:')) {
      header.consignee = line.replace(/sold to:/i, '').trim();
      captureMode = 'consignee';
    } else if (lowerLine.startsWith('consigned to:')) {
      header.consignee = line.replace(/consigned to:/i, '').trim();
      captureMode = 'consignee';
    } else if (lowerLine.startsWith('omron') && !header.shipper) {
      header.shipper = line;
      captureMode = 'shipper';
    } else if (captureMode && !line.includes(':')) {
      if (captureMode === 'consignee') header.consignee += `, ${line}`;
      if (captureMode === 'shipper') header.shipper += `, ${line}`;
    }
  }

  // Default Currency detection
  if (textBlock.includes('USD') || textBlock.includes('$')) header.currency = 'USD';
  else if (textBlock.includes('EUR') || textBlock.includes('€')) header.currency = 'EUR';

  return header;
}

function parseLines(textBlock) {
  const rows = textBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^#/.test(line));

  // Expanded Noise Regex (Shared)
  const noiseRegex = /^(?:DESCRIPTION|QUANTITY|ORIGIN|MARKS|NOS|UNIT|PRICE|TOTAL|WEIGHT|MEASUREMENT|PCSTOTAL|PAGE|INVOICE|PACKING LIST|OMRON|BANKSTOWN|AUSTRALIA|KYOTO|SHIOKOJI|TEL:|CORP NO|AEO CODE|DATE:|PAYMENT|CONSIGNED|VESSEL|SHIPPED|DISCHARGE|NOTIFY|NETGROSS|FOB|TERMS|SHIPPER|SOLD TO|P\/O NUMBER|VOYAGE|PORT|DETAILS AS PER|ELECTRICAL PARTS|SWITCH|ROPES|CARTONS ONLY|COUNTRY OF ORIGIN)/i;

  // --- STRATEGY 1: OMRON STRICT PATTERN ---
  const omronLines = [];
  let pendingHts = '';
  let pendingCountry = '';

  for (const row of rows) {
    // Noise Filter
    if (/^[-_=*]+$/.test(row.replace(/\s/g, ''))) continue;
    if (noiseRegex.test(row)) {
      // Capture Context (HTS/Country)
      const htsMatch = row.match(/\b\d{4}\.\d{2}\.\d{4}\b/);
      if (htsMatch) pendingHts = htsMatch[0];

      if (/United Kingdom|China|USA|Japan/i.test(row)) {
        const cooMatch = row.match(/(United Kingdom|China|USA|Japan)/i);
        if (cooMatch) pendingCountry = cooMatch[0];
      }
      continue;
    }

    // Omron Regex (Relaxed)
    // (Start) (Anything for Part/Desc) (Space) (Int/Float) (Space) (Float) (Space) (Float) (End)
    const omronLineRegex = /^(.+?)\s+(\d+(?:\.\d+)?)\s+([\d,.]+)\s+([\d,.]+)\s*$/;
    let match = row.match(omronLineRegex);

    // Fallback Heuristic (Ends with 3 numbers)
    if (!match) {
      const tokens = row.split(/\s+/);
      if (tokens.length >= 4) {
        const last3 = tokens.slice(-3);
        const isNum = (s) => !isNaN(parseFloat(s.replace(/,/g, '')));
        if (last3.every(isNum)) {
          match = [row, tokens.slice(0, -3).join(' '), last3[0], last3[1], last3[2]];
        }
      }
    }

    if (match) {
      const rawPartDesc = match[1];
      const quantity = parseFloat(match[2].replace(/,/g, ''));
      const unitPrice = parseFloat(match[3].replace(/,/g, ''));
      const totalValue = parseFloat(match[4].replace(/,/g, ''));

      const descParts = rawPartDesc.split(/\s+/);

      // Heuristic: The longest segment with numbers and letters is likely the Part Number
      let partNumber = descParts[0];
      let description = rawPartDesc;

      const bestPartToken = descParts.find(p => (/\d/.test(p) && /[a-zA-Z]/.test(p)) || (p.includes('-') && /\d/.test(p)));
      if (bestPartToken && bestPartToken.length > 3) {
        partNumber = bestPartToken;
        description = rawPartDesc.replace(partNumber, '').trim();
      }

      omronLines.push({
        partNumber: partNumber,
        description: description || 'Part',
        quantity: quantity,
        netWeightKg: 0,
        valueUsd: totalValue,
        unitPrice: unitPrice,
        htsCode: pendingHts,
        countryOfOrigin: pendingCountry || ''
      });

      pendingHts = '';
      continue;
    } else {
      // Check for isolated HTS to update pendingHts
      const htsMatch = row.match(/\b\d{4}\.\d{2}\.\d{4}\b/);
      if (htsMatch) pendingHts = htsMatch[0];
    }
  }

  if (omronLines.length > 0) return omronLines;

  // --- STRATEGY 2: GENERIC FALLBACK ---
  console.log("Omron parsing yielded 0 lines. Falling back to generic parsing.");
  const genericLines = [];

  for (const row of rows) {
    if (/^[-_=*]+$/.test(row.replace(/\s/g, ''))) continue;
    if (noiseRegex.test(row)) continue;

    // Strategy 1: Pipe separated
    let parts = row.split('|').map((value) => value.trim()).filter(Boolean);

    // Strategy 2: Whitespace separated
    if (parts.length < 2) {
      parts = row.split(/\s{2,}/).map(value => value.trim()).filter(Boolean);
    }

    if (parts.length < 1) continue;

    // Fallback split for single long string
    if (parts.length === 1 && parts[0].length > 10 && parts[0].includes(' ')) {
      const firstSpace = parts[0].indexOf(' ');
      const potentialPartNo = parts[0].substring(0, firstSpace);
      if (/^[\w\d-]+$/.test(potentialPartNo) && potentialPartNo.length > 3) {
        parts = [potentialPartNo, parts[0].substring(firstSpace).trim()];
      }
    }

    if (parts.length === 1) {
      const part = parts[0];
      if (part === 'Empty' || part.length < 3) continue;
      if (/^(?:TOTAL|USD|EUR|JPY)/i.test(part)) continue;
      if (/^\d+$/.test(part)) continue;
    }

    let partNumber = parts[0] || '';
    let description = parts[1] || '';
    let quantity = 1;
    let weight = 0;
    let value = 0;
    let htsCode = '';
    let country = '';

    // Helper regexes
    const htsRegex = /\b\d{4}\.?\d{2}\.?\d{4}\b/;
    const weightRegex = /(\d+(?:\.\d+)?)\s*(?:kg|lb|lbs)/i;
    const valueRegex = /(?:USD|\$)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*USD/i;
    const countryRegex = /\b(?:US|CN|MX|CA|DE|JP|KR|GB|IN|China|USA|Mexico|Canada|Germany|Japan|UNITED KINGDOM)\b/i;

    for (let i = 2; i < parts.length; i++) {
      const part = parts[i];
      if (!htsCode && htsRegex.test(part)) {
        htsCode = part.match(htsRegex)[0];
        continue;
      }
      if (!country && countryRegex.test(part)) {
        country = part;
        continue;
      }
      if (weight === 0 && weightRegex.test(part)) {
        const match = part.match(weightRegex);
        weight = parseFloat(match[1]);
        if (/lb/i.test(match[0])) weight *= 0.453592;
        continue;
      }
      if (value === 0 && valueRegex.test(part)) {
        const match = part.match(valueRegex);
        value = parseFloat(match[1] || match[2]);
        continue;
      }
      const num = parseFloat(part.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) {
        if (quantity === 1 && i === 2) quantity = num;
        else if (weight === 0) weight = num;
        else if (value === 0) value = num;
      }
    }

    // Post-processing
    if (valueRegex.test(partNumber) && value === 0) {
      const match = partNumber.match(valueRegex);
      value = parseFloat(match[1] || match[2]);
      partNumber = '';
    }
    if (weightRegex.test(partNumber) && weight === 0) {
      const match = partNumber.match(weightRegex);
      weight = parseFloat(match[1]);
      if (/lb/i.test(match[0])) weight *= 0.453592;
      partNumber = '';
    }

    // STRICT VALIDATION
    if (partNumber && !description && !htsCode && value === 0 && weight === 0) {
      if (partNumber.includes(' ') && partNumber.length > 20) continue;
      if (partNumber.length < 3) continue;
      if (/^\d+$/.test(partNumber)) continue;
    }
    if (description && (description === 'Empty' || /^\d+$/.test(description))) {
      description = '';
    }
    if (!partNumber && !description) continue;

    const hasData = (value > 0 || weight > 0 || htsCode || country || quantity > 1);
    const isCompleteIdentity = (partNumber && description);
    if (!hasData && !isCompleteIdentity) continue;

    genericLines.push({
      partNumber,
      description,
      quantity: isNaN(quantity) ? 1 : quantity,
      netWeightKg: isNaN(weight) ? 0 : weight,
      valueUsd: isNaN(value) ? 0 : value,
      htsCode,
      countryOfOrigin: country
    });
  }
  return genericLines;
}

function extractSections(text) {
  const sections = text.split(/\n\s*Lines:\s*/i);
  if (sections.length >= 2) {
    const [headerBlock, linesBlock] = sections;
    return {
      headerSection: headerBlock.replace(/Header:\s*/i, '').trim(),
      linesSection: linesBlock.trim()
    };
  }

  const tableStartRegex = /(?:Part\s*Number|Description|Qty|Quantity|Weight|Value)/i;
  const match = text.match(tableStartRegex);
  if (match) {
    const index = match.index;
    return {
      headerSection: text.substring(0, index).trim(),
      linesSection: text.substring(index).trim()
    };
  }

  return { headerSection: text, linesSection: text };
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
