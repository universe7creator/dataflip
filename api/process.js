module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-License-Key');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { data, mode } = req.body || {};

  // Mode: 'csv2json' or 'json2csv', default csv2json
  const conversionMode = mode || 'csv2json';

  if (!data || typeof data !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "data" parameter (string required)' });
  }

  try {
    let result;
    if (conversionMode === 'csv2json') {
      result = csvToJson(data);
    } else if (conversionMode === 'json2csv') {
      result = jsonToCsv(data);
    } else {
      return res.status(400).json({ error: 'Invalid mode. Use "csv2json" or "json2csv"' });
    }

    return res.status(200).json({
      success: true,
      mode: conversionMode,
      result: result,
      originalLength: data.length,
      resultLength: typeof result === 'string' ? result.length : 0
    });
  } catch (error) {
    return res.status(500).json({ error: 'Conversion failed', details: error.message });
  }
};

// CSV to JSON conversion
function csvToJson(csv) {
  const lines = csv.trim().split('\n').filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    // Handle CSV with quoted values
    const values = parseCSVLine(lines[i]);
    const obj = {};
    headers.forEach((header, j) => {
      let value = values[j] || '';
      // Try to parse numbers
      if (/^\d+$/.test(value)) {
        value = parseInt(value, 10);
      } else if (/^\d+\.\d+$/.test(value)) {
        value = parseFloat(value);
      }
      obj[header] = value;
    });
    result.push(obj);
  }

  return result;
}

// Parse CSV line handling quoted values
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim().replace(/^["']|["']$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^["']|["']$/g, ''));

  return result;
}

// JSON to CSV conversion
function jsonToCsv(jsonString) {
  let arr;
  try {
    arr = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Invalid JSON');
  }

  if (!Array.isArray(arr)) {
    arr = [arr];
  }

  if (arr.length === 0) return '';

  // Flatten nested objects
  const flattenObject = (obj, prefix = '') => {
    const result = {};
    for (const key in obj) {
      const newKey = prefix ? `${prefix}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        Object.assign(result, flattenObject(obj[key], newKey));
      } else {
        result[newKey] = obj[key];
      }
    }
    return result;
  };

  const flattened = arr.map(item => flattenObject(item));
  const headers = [...new Set(flattened.flatMap(obj => Object.keys(obj)))];

  const csvLines = [headers.join(',')];

  flattened.forEach(obj => {
    const values = headers.map(h => {
      const value = obj[h] === undefined ? '' : String(obj[h]);
      // Quote values that contain comma or quote
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvLines.push(values.join(','));
  });

  return csvLines.join('\n');
}