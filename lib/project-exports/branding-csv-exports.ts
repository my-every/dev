import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import XLSX from "xlsx-js-style";

import {
  readProjectManifest,
  readSheetSchema,
} from "@/lib/project-state/share-project-state-handlers";
import { buildProjectSheetPrintDocument } from "@/lib/wire-list-print/build-project-sheet-print-document";
import { buildBrandingCsvContent } from "@/lib/wire-list-print/model";
import { buildBrandingFilename } from "@/lib/project-exports/branding-filename";
import {
  BRANDING_EXPORTS_DIRECTORY,
  EXPORTS_DIRECTORY,
  UNITS_DIRECTORY,
  resolveUnitExportsRoot,
  sanitizeExportFileSegment,
} from "@/lib/project-exports/project-exports-paths";
import { appendBrandWorkbookSupportSheets } from "@/lib/project-exports/branding-workbook-helpers";
import { readWireBrandListSchema } from "@/lib/project-state/share-print-schema-handlers";
import type { BrandListExportSchema } from "@/lib/wire-brand-list/schema";

const BRANDING_EXPORTS_MANIFEST = "branding-exports.json";

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export interface BrandingCsvSheetExportRecord {
  sheetSlug: string;
  sheetName: string;
  rowCount: number;
  fileName: string;
  relativePath: string;
}

export interface BrandingCsvExportResult {
  projectId: string;
  projectName: string;
  generatedAt: string;
  sheetExports: BrandingCsvSheetExportRecord[];
  skippedSheets: Array<{ sheetSlug: string; sheetName: string; reason: string }>;
  /** Combined multi-sheet workbook filename (if multiple sheets exported). */
  combinedFileName?: string;
  /** Combined workbook relative path for download. */
  combinedRelativePath?: string;
}

export async function readBrandingCsvExports(projectId: string): Promise<BrandingCsvExportResult | null> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return null;
  }

  const unitNumber = manifest.unitNumber ?? "";
  const unitExportsRoot = await resolveUnitExportsRoot(projectId, unitNumber);
  if (!unitExportsRoot) {
    return null;
  }

  return readJsonFile<BrandingCsvExportResult>(
    path.join(unitExportsRoot, BRANDING_EXPORTS_DIRECTORY, BRANDING_EXPORTS_MANIFEST),
  );
}

export async function generateBrandingCsvExports(projectId: string): Promise<BrandingCsvExportResult> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    throw new Error("Project not found");
  }

  const unitNumber = manifest.unitNumber ?? "";
  const unitExportsRoot = await resolveUnitExportsRoot(projectId, unitNumber);
  if (!unitExportsRoot) {
    throw new Error("Project exports directory not found");
  }

  const sanitizedUnit = sanitizeExportFileSegment(unitNumber);
  const brandingExportsDirectory = path.join(unitExportsRoot, BRANDING_EXPORTS_DIRECTORY);
  await fs.mkdir(brandingExportsDirectory, { recursive: true });

  const result: BrandingCsvExportResult = {
    projectId,
    projectName: manifest.name,
    generatedAt: new Date().toISOString(),
    sheetExports: [],
    skippedSheets: [],
  };

  const operationalSheets = manifest.sheets.filter(sheet => sheet.kind === "operational");

  // Collect CSV content per sheet for combined workbook
  const combinedSheets: Array<{ sheetName: string; csvContent: string }> = [];
  const combinedSchemas: BrandListExportSchema[] = [];

  for (const sheet of operationalSheets) {
    const documentData = await buildProjectSheetPrintDocument({
      projectId,
      sheetSlug: sheet.slug,
      settings: {
        mode: "branding",
        showCoverPage: false,
        showTableOfContents: false,
        showIPVCodes: false,
      },
    });

    if (!documentData) {
      result.skippedSheets.push({
        sheetSlug: sheet.slug,
        sheetName: sheet.name,
        reason: "Unable to build branding document",
      });
      continue;
    }
    if (!documentData.sheetDocument) {
      result.skippedSheets.push({
        sheetSlug: sheet.slug,
        sheetName: sheet.name,
        reason: "Branding document missing shared sheet document",
      });
      continue;
    }

    const brandingVisibleSections = documentData.sheetDocument.brandingSections;

    if (brandingVisibleSections.length === 0) {
      result.skippedSheets.push({
        sheetSlug: sheet.slug,
        sheetName: sheet.name,
        reason: "No branding rows after filtering",
      });
      continue;
    }

    const partNumberMap = new Map(documentData.partNumberEntries ?? []);

    // Extract controlsDE from sheet schema metadata
    const sheetSchema = await readSheetSchema(projectId, sheet.slug);
    const controlsDE = sheetSchema?.metadata?.controlsDE;

    const csvContent = buildBrandingCsvContent({
      brandingVisibleSections,
      currentSheetName: documentData.currentSheetName,
      sectionColumnVisibility: documentData.settings.sectionColumnVisibility,
      partNumberMap,
      brandingSortMode: documentData.settings.brandingSortMode,
      projectInfo: {
        pdNumber: manifest.pdNumber,
        projectName: manifest.name,
        revision: manifest.revision,
        controlsDE,
      },
    });

    if (!csvContent) {
      result.skippedSheets.push({
        sheetSlug: sheet.slug,
        sheetName: sheet.name,
        reason: "No branding rows after filtering",
      });
      continue;
    }

    // Count data rows (subtract 13 header rows: 11 metadata + from/to + column headers)
    const rowCount = Math.max(csvContent.split("\n").length - 13, 0);

    // Write Excel (.xlsx) as the primary export format
    const fileName = buildBrandingFilename({
      pdNumber: manifest.pdNumber,
      projectName: manifest.name,
      revision: manifest.revision,
      unitNumber: manifest.unitNumber,
      sheetName: sheet.name,
      extension: "xlsx",
    });
    const absoluteFilePath = path.join(brandingExportsDirectory, fileName);
    const relativePath = path.posix.join(EXPORTS_DIRECTORY, UNITS_DIRECTORY, sanitizedUnit, BRANDING_EXPORTS_DIRECTORY, fileName);

    const workbook = buildBrandingXlsxWorkbook(csvContent);
    const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
    await fs.writeFile(absoluteFilePath, Buffer.from(xlsxBuffer));

    // Also write CSV backup
    const csvFileName = buildBrandingFilename({
      pdNumber: manifest.pdNumber,
      projectName: manifest.name,
      revision: manifest.revision,
      unitNumber: manifest.unitNumber,
      sheetName: sheet.name,
      extension: "csv",
    });
    await fs.writeFile(path.join(brandingExportsDirectory, csvFileName), csvContent, "utf-8");

    result.sheetExports.push({
      sheetSlug: sheet.slug,
      sheetName: sheet.name,
      rowCount,
      fileName,
      relativePath,
    });

    combinedSheets.push({ sheetName: sheet.name, csvContent });
    const savedSchema = await readWireBrandListSchema(projectId, sheet.slug);
    if (savedSchema) {
      combinedSchemas.push(savedSchema);
    }
  }

  // Build combined multi-sheet workbook when there are multiple sheets
  if (combinedSheets.length > 0) {
    const combinedFileName = buildBrandingFilename({
      pdNumber: manifest.pdNumber,
      projectName: manifest.name,
      revision: manifest.revision,
      unitNumber: manifest.unitNumber,
      extension: "xlsx",
    });
    const combinedAbsolutePath = path.join(brandingExportsDirectory, combinedFileName);
    const combinedRelativePath = path.posix.join(EXPORTS_DIRECTORY, UNITS_DIRECTORY, sanitizedUnit, BRANDING_EXPORTS_DIRECTORY, combinedFileName);

    const combinedWorkbook = buildCombinedBrandingXlsxWorkbook(combinedSheets, combinedSchemas);
    const combinedBuffer = XLSX.write(combinedWorkbook, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
    await fs.writeFile(combinedAbsolutePath, Buffer.from(combinedBuffer));

    result.combinedFileName = combinedFileName;
    result.combinedRelativePath = combinedRelativePath;
  }

  await fs.writeFile(
    path.join(brandingExportsDirectory, BRANDING_EXPORTS_MANIFEST),
    JSON.stringify(result, null, 2),
    "utf-8",
  );

  return result;
}

// Style definitions for xlsx-js-style
const HEADER_STYLE = {
  font: { bold: true },
  alignment: { wrapText: true, vertical: "center" as const },
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

/**
 * Convert branding CSV content into an xlsx workbook with styling.
 * Parses the CSV string and creates a worksheet preserving
 * the 13-row metadata header layout with bold headers and text wrap.
 */
function buildBrandingXlsxWorkbook(csvContent: string): XLSX.WorkBook {
  const rows = csvContent.split("\n").map((line) => parseSimpleCsvLine(line));
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  applyBrandingStyles(worksheet, rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Brandlist");
  return workbook;
}

/**
 * Build a combined xlsx workbook with one worksheet per sheet.
 * Each worksheet tab is named after the sheet (truncated to 31 chars for Excel limits).
 */
function buildCombinedBrandingXlsxWorkbook(
  sheets: Array<{ sheetName: string; csvContent: string }>,
  schemas: BrandListExportSchema[],
): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const usedNames = new Set<string>();

  for (const { sheetName, csvContent } of sheets) {
    const rows = csvContent.split("\n").map((line) => parseSimpleCsvLine(line));
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    applyBrandingStyles(worksheet, rows);

    // Excel worksheet names: max 31 chars, no []:*?/\
    let tabName = sheetName
      .replace(/[[\]:*?/\\]/g, "")
      .slice(0, 31)
      .trim() || "Sheet";

    // Deduplicate tab names
    let dedupeIndex = 2;
    const baseName = tabName;
    while (usedNames.has(tabName)) {
      const suffix = ` (${dedupeIndex++})`;
      tabName = baseName.slice(0, 31 - suffix.length) + suffix;
    }
    usedNames.add(tabName);

    XLSX.utils.book_append_sheet(workbook, worksheet, tabName);
  }

  return appendBrandWorkbookSupportSheets(workbook, schemas);
}

/**
 * Apply styling to the branding worksheet:
 * - Bold and text wrap for column headers (row 13, 0-indexed row 12)
 * - Bold for metadata labels in column A (rows 1-11)
 * - Text wrap for all data cells
 * - Force text format for cells starting with -, =, +, @
 * - Set column widths
 */
function applyBrandingStyles(worksheet: XLSX.WorkSheet, rows: string[][]): void {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  
  // Set column widths (in characters)
  // Columns: Device ID (From), Wire No., Wire ID, Gauge/Size, Length, Device ID (To), To Location, Bundle Name
  worksheet["!cols"] = [
    { wch: 18 }, // A - Device ID (From)
    { wch: 14 }, // B - Wire No.
    { wch: 12 }, // C - Wire ID
    { wch: 10 }, // D - Gauge/Size
    { wch: 10 }, // E - Length
    { wch: 18 }, // F - Device ID (To)
    { wch: 20 }, // G - To Location
    { wch: 25 }, // H - Bundle Name
  ];

  for (let r = range.s.r; r <= range.e.r; r++) {
    const row = rows[r] ?? [];
    const isBundleHeaderRow = r > 12 && String(row[7] ?? "").trim().length > 0;

    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = worksheet[addr];
      
      if (!cell) continue;

      // Force string type for all text cells
      if (typeof cell.v === "string") {
        cell.t = "s";
        
        // For values starting with special characters (like -0V),
        // we need to ensure Excel treats them as text, not formulas
        if (/^[-=+@]/.test(cell.v)) {
          // Set number format to text (@) to prevent formula interpretation
          cell.z = "@";
        }
      }

      // Apply styles based on row position
      if (r < 11 && c === 0) {
        // Metadata labels (rows 1-11, column A) - bold
        cell.s = METADATA_BOLD_STYLE;
      } else if (r === 12) {
        // Column headers row (row 13, 0-indexed as 12) - bold + wrap
        cell.s = HEADER_STYLE;
      } else if (isBundleHeaderRow) {
        cell.s = BUNDLE_HEADER_STYLE;
      } else if (r > 12) {
        // Data rows - text wrap
        cell.s = DATA_CELL_STYLE;
      }
    }
  }
}

/** Minimal CSV line parser that handles quoted fields with commas/newlines. */
function parseSimpleCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
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
