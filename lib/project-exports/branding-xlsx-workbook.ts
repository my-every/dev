import XLSX from "xlsx-js-style";

const HEADER_STYLE = {
  font: { bold: true },
  alignment: { wrapText: true, vertical: "center" as const },
  fill: { fgColor: { rgb: "E2E8F0" } },
};

const TITLE_STYLE = {
  font: { bold: true, sz: 13 },
  alignment: { wrapText: true, vertical: "center" as const },
  fill: { fgColor: { rgb: "F8FAFC" } },
};

const SUBHEADER_STYLE = {
  font: { bold: true },
  alignment: { wrapText: true, vertical: "center" as const },
  fill: { fgColor: { rgb: "EEF2FF" } },
};

const PREFIX_GROUP_STYLE = {
  font: { bold: true },
  alignment: { wrapText: true, vertical: "center" as const },
  fill: { fgColor: { rgb: "F8FAFC" } },
};

const BUNDLE_HEADER_STYLE = {
  font: { bold: true },
  alignment: { wrapText: true, vertical: "center" as const },
  fill: { fgColor: { rgb: "EEF2FF" } },
};

const DATA_CELL_STYLE = {
  alignment: { wrapText: true, vertical: "center" as const },
};

const METADATA_BOLD_STYLE = {
  font: { bold: true },
};

function isPrefixGroupRow(row: string[]): boolean {
  if (!row.length) return false;
  const first = String(row[0] ?? "").trim();
  if (!first) return false;
  for (let i = 1; i < row.length; i += 1) {
    if (String(row[i] ?? "").trim().length > 0) {
      return false;
    }
  }
  return true;
}

function parseSimpleCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function sanitizeSheetName(sheetName: string, usedNames: Set<string>) {
  let tabName = sheetName
    .replace(/[[\]:*?/\\]/g, "")
    .slice(0, 31)
    .trim() || "Sheet";

  let dedupeIndex = 2;
  const baseName = tabName;
  while (usedNames.has(tabName)) {
    const suffix = ` (${dedupeIndex++})`;
    tabName = baseName.slice(0, 31 - suffix.length) + suffix;
  }

  usedNames.add(tabName);
  return tabName;
}

function applyBrandingStyles(worksheet: XLSX.WorkSheet, rows: string[][]): void {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

  worksheet["!cols"] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 10 },
    { wch: 18 },
    { wch: 20 },
    { wch: 25 },
  ];

  for (let r = range.s.r; r <= range.e.r; r += 1) {
    const row = rows[r] ?? [];
    const isTitleRow = r === 0;
    const isFromToRow = r === 11;
    const isColumnHeaderRow = r === 12;
    const isPrefixHeaderRow = r > 12 && isPrefixGroupRow(row);
    const isBundleHeaderRow = r > 12 && String(row[7] ?? "").trim().length > 0;

    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[addr];
      if (!cell) continue;

      if (typeof cell.v === "string") {
        cell.t = "s";
        if (/^[-=+@]/.test(cell.v)) {
          cell.z = "@";
        }
      }

      if (isTitleRow) {
        cell.s = TITLE_STYLE;
      } else if (r < 11 && c === 0) {
        cell.s = METADATA_BOLD_STYLE;
      } else if (isFromToRow) {
        cell.s = SUBHEADER_STYLE;
      } else if (isColumnHeaderRow) {
        cell.s = HEADER_STYLE;
      } else if (isPrefixHeaderRow && c === 0) {
        cell.s = PREFIX_GROUP_STYLE;
      } else if (isBundleHeaderRow) {
        cell.s = BUNDLE_HEADER_STYLE;
      } else if (r > 12) {
        cell.s = DATA_CELL_STYLE;
      }
    }
  }
}

export function buildBrandingWorkbookFromCsv(
  csvContent: string,
  sheetName = "Brandlist",
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  appendBrandingCsvSheetToWorkbook(workbook, sheetName, csvContent, usedNames);
  return workbook;
}

export function appendBrandingCsvSheetToWorkbook(
  workbook: XLSX.WorkBook,
  sheetName: string,
  csvContent: string,
  usedNames: Set<string>,
) {
  const rows = csvContent.split("\n").map((line) => parseSimpleCsvLine(line));
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  applyBrandingStyles(worksheet, rows);
  const tabName = sanitizeSheetName(sheetName, usedNames);
  XLSX.utils.book_append_sheet(workbook, worksheet, tabName);
}
