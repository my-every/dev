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
  fill: { fgColor: { rgb: "E3E3E3" } },
};

const PREFIX_GROUP_STYLE = {
  font: { bold: true },
  alignment: { wrapText: true, vertical: "center" as const },
  fill: { fgColor: { rgb: "F8FAFC" } },
};

const BUNDLE_HEADER_STYLE = {
  font: { bold: true },
  alignment: { wrapText: true, vertical: "center" as const },
  fill: { fgColor: { rgb: "E3E3E3" } },
};

const DATA_CELL_STYLE = {
  alignment: { wrapText: true, vertical: "center" as const },
};

const CELL_BORDER = {
  top: { style: "thin" as const, color: { rgb: "E2E8F0" } },
  bottom: { style: "thin" as const, color: { rgb: "E2E8F0" } },
  left: { style: "thin" as const, color: { rgb: "E2E8F0" } },
  right: { style: "thin" as const, color: { rgb: "E2E8F0" } },
};

const BASE_CELL_STYLE = {
  alignment: { wrapText: true, vertical: "center" as const },
  border: CELL_BORDER,
};

const ROW_SPLIT_STYLE = {
  ...BASE_CELL_STYLE,
  fill: { fgColor: { rgb: "F8FAFC" } },
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

function isBlankRow(row: string[]): boolean {
  if (!row.length) return true;
  return row.every((value) => String(value ?? "").trim().length === 0);
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
    const isSeparatorRow = r > 12 && isBlankRow(row);

    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      let cell = worksheet[addr];
      if (!cell) {
        cell = { t: "s", v: "" } as XLSX.CellObject;
        worksheet[addr] = cell;
      }

      cell.s = BASE_CELL_STYLE;

      if (typeof cell.v === "string") {
        cell.t = "s";
        if (/^[-=+@]/.test(cell.v)) {
          cell.z = "@";
        }
      }

      if (isTitleRow) {
        cell.s = { ...TITLE_STYLE, border: CELL_BORDER };
      } else if (r < 11 && c === 0) {
        cell.s = { ...BASE_CELL_STYLE, ...METADATA_BOLD_STYLE };
      } else if (isFromToRow) {
        cell.s = { ...SUBHEADER_STYLE, border: CELL_BORDER };
      } else if (isColumnHeaderRow) {
        cell.s = { ...HEADER_STYLE, border: CELL_BORDER };
      } else if (isPrefixHeaderRow) {
        cell.s = { ...PREFIX_GROUP_STYLE, border: CELL_BORDER };
      } else if (isBundleHeaderRow) {
        cell.s = { ...BUNDLE_HEADER_STYLE, border: CELL_BORDER };
      } else if (isSeparatorRow) {
        cell.s = ROW_SPLIT_STYLE;
      } else if (r > 12) {
        cell.s = { ...DATA_CELL_STYLE, border: CELL_BORDER };
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
