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
import {
  appendBrandingCsvSheetToWorkbook,
  buildBrandingWorkbookFromCsv,
} from "@/lib/project-exports/branding-xlsx-workbook";
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

export interface EnsuredBrandingCsvSheetExport {
  record: BrandingCsvSheetExportRecord;
  absoluteFilePath: string;
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

    const workbook = buildBrandingWorkbookFromCsv(csvContent, "Brandlist");
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

export async function ensureBrandingCsvSheetExport(
  projectId: string,
  sheetSlug: string,
): Promise<EnsuredBrandingCsvSheetExport> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    throw new Error("Project not found");
  }

  const sheet = manifest.sheets.find(
    (entry) => entry.kind === "operational" && entry.slug === sheetSlug,
  );
  if (!sheet) {
    throw new Error("Operational sheet not found");
  }

  const unitNumber = manifest.unitNumber ?? "";
  const unitExportsRoot = await resolveUnitExportsRoot(projectId, unitNumber);
  if (!unitExportsRoot) {
    throw new Error("Project exports directory not found");
  }

  const sanitizedUnit = sanitizeExportFileSegment(unitNumber);
  const brandingExportsDirectory = path.join(unitExportsRoot, BRANDING_EXPORTS_DIRECTORY);
  const exportsManifestPath = path.join(brandingExportsDirectory, BRANDING_EXPORTS_MANIFEST);
  await fs.mkdir(brandingExportsDirectory, { recursive: true });

  const exportsManifest =
    await readJsonFile<BrandingCsvExportResult>(exportsManifestPath) ??
    {
      projectId,
      projectName: manifest.name,
      generatedAt: new Date().toISOString(),
      sheetExports: [],
      skippedSheets: [],
    };

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

  if (!documentData || !documentData.sheetDocument) {
    throw new Error("Unable to build branding document");
  }

  const brandingVisibleSections = documentData.sheetDocument.brandingSections;
  if (brandingVisibleSections.length === 0) {
    throw new Error("No branding rows after filtering");
  }

  const partNumberMap = new Map(documentData.partNumberEntries ?? []);
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
    throw new Error("No branding rows after filtering");
  }

  const rowCount = Math.max(csvContent.split("\n").length - 13, 0);
  const fileName = buildBrandingFilename({
    pdNumber: manifest.pdNumber,
    projectName: manifest.name,
    revision: manifest.revision,
    unitNumber: manifest.unitNumber,
    sheetName: sheet.name,
    extension: "xlsx",
  });
  const absoluteFilePath = path.join(brandingExportsDirectory, fileName);
  const relativePath = path.posix.join(
    EXPORTS_DIRECTORY,
    UNITS_DIRECTORY,
    sanitizedUnit,
    BRANDING_EXPORTS_DIRECTORY,
    fileName,
  );

  const workbook = buildBrandingWorkbookFromCsv(csvContent, "Brandlist");
  const xlsxBuffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  await fs.writeFile(absoluteFilePath, Buffer.from(xlsxBuffer));

  const csvFileName = buildBrandingFilename({
    pdNumber: manifest.pdNumber,
    projectName: manifest.name,
    revision: manifest.revision,
    unitNumber: manifest.unitNumber,
    sheetName: sheet.name,
    extension: "csv",
  });
  await fs.writeFile(path.join(brandingExportsDirectory, csvFileName), csvContent, "utf-8");

  const record: BrandingCsvSheetExportRecord = {
    sheetSlug: sheet.slug,
    sheetName: sheet.name,
    rowCount,
    fileName,
    relativePath,
  };

  exportsManifest.generatedAt = new Date().toISOString();
  exportsManifest.projectId = projectId;
  exportsManifest.projectName = manifest.name;
  exportsManifest.sheetExports = [
    ...exportsManifest.sheetExports.filter((entry) => entry.sheetSlug !== sheetSlug),
    record,
  ];
  exportsManifest.skippedSheets = exportsManifest.skippedSheets.filter(
    (entry) => entry.sheetSlug !== sheetSlug,
  );

  // Combined workbook is a full-project artifact and may be stale after single-sheet regeneration.
  delete exportsManifest.combinedFileName;
  delete exportsManifest.combinedRelativePath;

  await fs.writeFile(exportsManifestPath, JSON.stringify(exportsManifest, null, 2), "utf-8");

  return {
    record,
    absoluteFilePath,
  };
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
    appendBrandingCsvSheetToWorkbook(workbook, sheetName, csvContent, usedNames);
  }

  return appendBrandWorkbookSupportSheets(workbook, schemas);
}
