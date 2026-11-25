/**
 * Small, dependency-free CSV helpers for administration imports and exports.
 *
 * Exported cells are neutralised so spreadsheet applications do not evaluate a
 * catalog value as a formula. Imported values are always treated as plain text
 * and are validated by the domain import service before any database write.
 */

function neutralise(value: string): string {
  const flattened = value.replace(/\r?\n/g, " ").trim();
  return /^[=+\-@\t\r]/.test(flattened) ? `'${flattened}` : flattened;
}

function escapeCell(value: string): string {
  const cell = neutralise(value);
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  if (rows.length === 0) return "";
  return `${rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")}\r\n`;
}

export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  function finishRow() {
    row.push(field);
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row);
    row = [];
    field = "";
  }

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      if (text[index + 1] !== "\n") finishRow();
    } else if (char === "\n") {
      finishRow();
    } else {
      field += char;
    }
  }

  if (quoted) throw new Error("CSV ends with an unterminated quoted value.");
  if (field.length > 0 || row.length > 0) finishRow();
  return rows;
}

export function csvRowsToObjects(
  rows: readonly (readonly string[])[],
): Record<string, string>[] {
  const [header, ...data] = rows;
  if (!header) return [];

  return data.map((cells) => {
    const object: Record<string, string> = {};
    header.forEach((key, index) => {
      const name = key.trim();
      if (name) object[name] = (cells[index] ?? "").trim();
    });
    return object;
  });
}
