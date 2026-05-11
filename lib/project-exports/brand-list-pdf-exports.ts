import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { renderWireListPdfFromRoute } from "@/lib/project-exports/render-wire-list-pdf";
import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import {
  EXPORTS_DIRECTORY,
  UNITS_DIRECTORY,
  BRAND_LIST_EXPORTS_DIRECTORY,
  resolveUnitExportsRoot,
  sanitizeExportFileSegment,
} from "@/lib/project-exports/project-exports-paths";
import { buildBrandingFilename } from "@/lib/project-exports/branding-filename";
import { buildProjectSheetPrintDocument } from "@/lib/wire-list-print/build-project-sheet-print-document";
import type { BrandingSortMode } from "@/lib/wire-list-print/defaults";

const BRAND_LIST_EXPORTS_MANIFEST = "brand-list-exports.json";

export interface BrandListPdfSheetExportRecord {
  sheetSlug: string;
  sheetName: string;
  rowCount: number;
  fileName: string;
  relativePath: string;
}

export interface BrandListPdfExportResult {
  projectId: string;
  projectName: string;
  generatedAt: string;
  sheetExports: BrandListPdfSheetExportRecord[];
  skippedSheets: Array<{ sheetSlug: string; sheetName: string; reason: string }>;
}

export interface EnsuredBrandListPdfSheetExport {
  record: BrandListPdfSheetExportRecord;
  absoluteFilePath: string;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function readBrandListPdfExports(projectId: string): Promise<BrandListPdfExportResult | null> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return null;
  }

  const unitNumber = manifest.unitNumber ?? "";
  const unitExportsRoot = await resolveUnitExportsRoot(projectId, unitNumber);
  if (!unitExportsRoot) {
    return null;
  }

  return readJsonFile<BrandListPdfExportResult>(
    path.join(unitExportsRoot, BRAND_LIST_EXPORTS_DIRECTORY, BRAND_LIST_EXPORTS_MANIFEST),
  );
}

export interface BrandListPdfExportOptions {
  grouping?: BrandingSortMode;
}

export async function generateBrandListPdfExports(
  projectId: string,
  origin: string,
  options?: BrandListPdfExportOptions,
): Promise<BrandListPdfExportResult> {
  const grouping = options?.grouping ?? "default";
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
  const brandListExportsDirectory = path.join(unitExportsRoot, BRAND_LIST_EXPORTS_DIRECTORY);
  await fs.mkdir(brandListExportsDirectory, { recursive: true });

  const result: BrandListPdfExportResult = {
    projectId,
    projectName: manifest.name,
    generatedAt: new Date().toISOString(),
    sheetExports: [],
    skippedSheets: [],
  };

  for (const sheet of manifest.sheets.filter(entry => entry.kind === "operational")) {
    const documentData = await buildProjectSheetPrintDocument({
      projectId,
      sheetSlug: sheet.slug,
      settings: {
        wireListSortMode: grouping,
      },
    });

    if (!documentData) {
      result.skippedSheets.push({
        sheetSlug: sheet.slug,
        sheetName: sheet.name,
        reason: "Unable to build print document",
      });
      continue;
    }

    const visibleRowCount = documentData.sheetDocument?.standardTable.totalRows ?? 0;

    if (visibleRowCount === 0) {
      result.skippedSheets.push({
        sheetSlug: sheet.slug,
        sheetName: sheet.name,
        reason: "No semantic wire rows",
      });
      continue;
    }

    const fileName = buildBrandingFilename({
      pdNumber: manifest.pdNumber,
      projectName: manifest.name,
      revision: manifest.revision,
      unitNumber: manifest.unitNumber,
      sheetName: sheet.name,
      extension: "pdf",
    });
    const absoluteFilePath = path.join(brandListExportsDirectory, fileName);
    const relativePath = path.posix.join(EXPORTS_DIRECTORY, UNITS_DIRECTORY, sanitizedUnit, BRAND_LIST_EXPORTS_DIRECTORY, fileName);
    
    // Render as branding mode PDF
    const pdfBytes = await renderWireListPdfFromRoute({
      origin,
      projectId,
      sheetSlug: sheet.slug,
      grouping,
      mode: "branding",
    });

    await fs.writeFile(absoluteFilePath, pdfBytes);

    result.sheetExports.push({
      sheetSlug: sheet.slug,
      sheetName: sheet.name,
      rowCount: visibleRowCount,
      fileName,
      relativePath,
    });
  }

  await fs.writeFile(
    path.join(brandListExportsDirectory, BRAND_LIST_EXPORTS_MANIFEST),
    JSON.stringify(result, null, 2),
    "utf-8",
  );

  return result;
}
