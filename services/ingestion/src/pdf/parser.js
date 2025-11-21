const pdf = require('pdf-parse');
const { normalizeDocument } = require('../utils');

function parseHeader(textBlock) {
  const headerLines = textBlock
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const header = {};
  for (const line of headerLines) {
    const [key, ...rest] = line.split(':');
    if (!key || rest.length === 0) continue;
    header[key.trim().toLowerCase()] = rest.join(':').trim();
  }
  return {
    shipper: header.shipper || '',
    consignee: header.consignee || '',
    incoterm: header.incoterm || '',
    currency: header.currency || '',
    reference: header.reference
  };
}

function parseLines(textBlock) {
  const rows = textBlock
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^#/.test(line));
  const lines = [];

  for (const row of rows) {
    // Filter out separator lines
    if (/^[-_=*]+$/.test(row.replace(/\s/g, ''))) continue;

    // Filter out common table headers and footer noise
    const noiseRegex = /^(?:DESCRIPTION|QUANTITY|ORIGIN|MARKS|NOS|UNIT|PRICE|TOTAL|WEIGHT|MEASUREMENT|PCSTOTAL|PAGE|INVOICE|PACKING LIST|OMRON|BANKSTOWN|AUSTRALIA|KYOTO|SHIOKOJI|TEL:|CORP NO|AEO CODE|DATE:|PAYMENT|CONSIGNED|VESSEL|SHIPPED|DISCHARGE|NOTIFY|NETGROSS|FOB|TERMS|SHIPPER|SOLD TO|P\/O NUMBER|VOYAGE|PORT|DETAILS AS PER)/i;
    if (noiseRegex.test(row)) continue;

    // Strategy 1: Pipe separated
    let parts = row.split('|').map((value) => value.trim()).filter(Boolean);

    // Strategy 2: Whitespace separated (if pipes failed)
    if (parts.length < 2) {
      // Split by 2 or more spaces to avoid splitting single spaces in descriptions
      parts = row.split(/\s{2,}/).map(value => value.trim()).filter(Boolean);
    }

    // If we still don't have enough parts, try to extract what we can
    // We need at least a description or part number
    if (parts.length < 1) continue;

    if (parts.length === 1) {
      // Single part checks
      const part = parts[0];
      // Skip if it's just a short number or "Empty"
      if (part === 'Empty' || part.length < 3) continue;
      // Skip if it looks like a total or value only
      if (/^(?:TOTAL|USD|EUR|JPY)/i.test(part)) continue;
      // Skip if it's just a number
      if (/^\d+$/.test(part)) continue;
    }

    // Smart Column Mapping
    // Instead of relying on fixed positions, we'll try to identify columns by their content

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
    const valueRegex = /(?:USD|\$)\s*(\d+(?:\.\d+)?)/i;
    const countryRegex = /\b(?:US|CN|MX|CA|DE|JP|KR|GB|IN|China|USA|Mexico|Canada|Germany|Japan|UNITED KINGDOM)\b/i;

    // First pass: Look for specific formats in the remaining parts
    // We assume parts[0] and parts[1] are PartNo and Desc for now, but we can refine that too

    for (let i = 2; i < parts.length; i++) {
      const part = parts[i];

      // Check for HTS Code
      if (!htsCode && htsRegex.test(part)) {
        htsCode = part.match(htsRegex)[0];
        continue;
      }

      // Check for Country
      if (!country && countryRegex.test(part)) {
        country = part;
        continue;
      }

      // Check for Weight (explicit units)
      if (weight === 0 && weightRegex.test(part)) {
        const match = part.match(weightRegex);
        weight = parseFloat(match[1]);
        // Convert lbs to kg if needed
        if (/lb/i.test(match[0])) weight *= 0.453592;
        continue;
      }

      // Check for Value (explicit currency)
      if (value === 0 && valueRegex.test(part)) {
        value = parseFloat(part.match(valueRegex)[1]);
        continue;
      }

      // If it's just a number, it could be Qty, Weight, or Value
      // We'll assign based on order if not already found
      const num = parseFloat(part.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) {
        if (quantity === 1 && i === 2) quantity = num;
        else if (weight === 0) weight = num;
        else if (value === 0) value = num;
      }
    }

    // Post-processing validation
    // If partNumber looks like a value/weight/HTS, shift it
    if (valueRegex.test(partNumber) && value === 0) {
      value = parseFloat(partNumber.match(valueRegex)[1]);
      partNumber = '';
    }
    if (weightRegex.test(partNumber) && weight === 0) {
      const match = partNumber.match(weightRegex);
      weight = parseFloat(match[1]);
      if (/lb/i.test(match[0])) weight *= 0.453592;
      partNumber = '';
    }

    // STRICTER VALIDATION:
    // 1. If we only have a part number, it must look like a part number (no spaces, or specific format)
    //    If it's a long sentence, it's garbage.
    if (partNumber && !description && !htsCode && value === 0 && weight === 0) {
      if (partNumber.includes(' ') && partNumber.length > 20) continue; // Likely a footer sentence
      if (partNumber.length < 3) continue; // Too short
      // If it's just digits, it might be a quantity or line number floating around
      if (/^\d+$/.test(partNumber)) continue;
    }

    // 2. If we have a description, it shouldn't be just a number or "Empty"
    if (description && (description === 'Empty' || /^\d+$/.test(description))) {
      description = '';
    }

    // 3. Must have at least one meaningful field besides just quantity
    if (!partNumber && !description && !htsCode && value === 0 && weight === 0) continue;

    lines.push({
      partNumber,
      description,
      quantity: isNaN(quantity) ? 1 : quantity,
      netWeightKg: isNaN(weight) ? 0 : weight,
      valueUsd: isNaN(value) ? 0 : value,
      htsCode,
      countryOfOrigin: country
    });
  }
  return lines;
}

function extractSections(text) {
  // Try to split by explicit "Lines:" marker
  const sections = text.split(/\n\s*Lines:\s*/i);

  let headerSection = text;
  let linesSection = text;

  if (sections.length >= 2) {
    const [headerBlock, linesBlock] = sections;
    headerSection = headerBlock.replace(/Header:\s*/i, '').trim();
    linesSection = linesBlock.trim();
  } else {
    // Fallback: If no "Lines:" marker, try to find common table headers
    const tableStartRegex = /(?:Part\s*Number|Description|Qty|Quantity|Weight|Value)/i;
    const match = text.match(tableStartRegex);

    if (match) {
      const index = match.index;
      headerSection = text.substring(0, index).trim();
      linesSection = text.substring(index).trim();
    }
  }

  // IMPROVEMENT: Cut off the lines section at the footer/totals
  // Look for common footer markers that appear AFTER the table
  const footerRegex = /\n\s*(?:Total|Subtotal|Page\s+\d|Invoice\s+No|Signed|Manager|Authorized|FOB\s+Origin|Trade\s+Terms)/i;
  const footerMatch = linesSection.match(footerRegex);
  if (footerMatch) {
    linesSection = linesSection.substring(0, footerMatch.index).trim();
  }

  return { headerSection, linesSection };
}

async function parsePdf(buffer) {
  let text = '';
  const meta = {
    sourceType: 'pdf',
    raw: {}
  };
  try {
    try {
      const result = await pdf(buffer);
      text = result.text;
      meta.raw.textLength = text.length;
      meta.raw.details = result.info || {};
    } catch (parseError) {
      // Fallback to OCR extraction for scanned PDFs
      try {
        // Check if OCR is enabled
        if (process.env.OCR_ENABLED !== 'true') {
          throw new Error('OCR disabled');
        }

        // Check if OCR service is available (via env or default)
        const ocrUrl = process.env.OCR_SERVICE_URL || 'http://ocr:5000';

        // Create form data for upload
        const formData = new FormData();
        const blob = new Blob([buffer], { type: 'application/pdf' });
        formData.append('file', blob, 'document.pdf');

        const response = await fetch(`${ocrUrl}/extract`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`OCR Service responded with ${response.status}`);
        }

        const data = await response.json();
        text = data.text;

        meta.raw.fallback = true;
        meta.raw.ocr = true;
      } catch (ocrError) {
        // If OCR also fails, rethrow original parse error with additional context
        parseError.message += ` | OCR fallback also failed: ${ocrError.message}`;
        throw parseError;
      }
    }
  } catch (error) {
    const fallbackText = buffer.toString('utf8');
    if (/^%PDF/.test(fallbackText)) {
      error.code = 'PDF_PARSE_FAILED';
      throw error;
    }
    text = fallbackText;
    meta.raw.fallback = true;
    meta.raw.error = error.message;
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
