/** Safe CSV serialization: quoting, escaping, and formula-injection guarding. */

function escapeCell(value) {
  if (value == null) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // CSV-injection guard: neutralize leading formula triggers (=, +, -, @, tab, CR).
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  // Quote if the value contains a comma, quote, or newline; double up embedded quotes.
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Convert an array of flat objects to a CSV string.
 * @param {object[]} rows
 * @param {string[]} [columns] explicit column order; defaults to keys of the first row
 */
export function toCsv(rows, columns) {
  if (!Array.isArray(rows) || rows.length === 0) return '';
  const cols = columns && columns.length ? columns : Object.keys(rows[0]);
  const header = cols.map(escapeCell).join(',');
  const body = rows.map((row) => cols.map((c) => escapeCell(row[c])).join(',')).join('\n');
  return `${header}\n${body}`;
}
