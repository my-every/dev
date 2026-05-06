import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { renderWireListPdfFromRoute } from "@/lib/project-exports/render-wire-list-pdf";
import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import {
  EXPORTS_DIRECTORY,
  UNITS_DIRECTORY,
  WIRE_LIST_EXPORTS_DIRECTORY,
  resolveUnitExportsRoot,
  sanitizeExportFileSegment,
} from "@/lib/project-exports/project-exports-paths";
import { buildBrandingFilename } from "@/lib/project-exports/branding-filename";
import { buildProjectSheetPrintDocument } from "@/lib/wire-list-print/build-project-sheet-print-document";
import type { BrandingSortMode } from "@/lib/wire-list-print/defaults";

const WIRE_LIST_EXPORTS_MANIFEST = "wire-list-exports.json";

export interface WireListPdfSheetExportRecord {
  sheetSlug: string;
  sheetName: string;
  rowCount: number;
  fileName: string;
  relativePath: string;
}

export interface WireListPdfExportResult {
  projectId: string;
  projectName: string;
  generatedAt: string;
  sheetExports: WireListPdfSheetExportRecord[];
  skippedSheets: Array<{ sheetSlug: string; sheetName: string; reason: string }>;
}

export interface EnsuredWireListPdfSheetExport {
  record: WireListPdfSheetExportRecord;
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

export async function readWireListPdfExports(projectId: string): Promise<WireListPdfExportResult | null> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return null;
  }

  const unitNumber = manifest.unitNumber ?? "";
  const unitExportsRoot = await resolveUnitExportsRoot(projectId, unitNumber);
  if (!unitExportsRoot) {
    return null;
  }

  return readJsonFile<WireListPdfExportResult>(
    path.join(unitExportsRoot, WIRE_LIST_EXPORTS_DIRECTORY, WIRE_LIST_EXPORTS_MANIFEST),
  );
}

export interface WireListPdfExportOptions {
  grouping?: BrandingSortMode;
}

export async function generateWireListPdfExports(
  projectId: string,
  origin: string,
  options?: WireListPdfExportOptions,
): Promise<WireListPdfExportResult> {
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
  const wireListExportsDirectory = path.join(unitExportsRoot, WIRE_LIST_EXPORTS_DIRECTORY);
  await fs.mkdir(wireListExportsDirectory, { recursive: true });

  const result: WireListPdfExportResult = {
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
    }).replace(/BRANDLIST/i, "WIRELIST");
    const absoluteFilePath = path.join(wireListExportsDirectory, fileName);
    const relativePath = path.posix.join(EXPORTS_DIRECTORY, UNITS_DIRECTORY, sanitizedUnit, WIRE_LIST_EXPORTS_DIRECTORY, fileName);
    const pdfBytes = await renderWireListPdfFromRoute({
      origin,
      projectId,
      sheetSlug: sheet.slug,
      grouping,
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
    path.join(wireListExportsDirectory, WIRE_LIST_EXPORTS_MANIFEST),
    JSON.stringify(result, null, 2),
    "utf-8",
  );

  return result;
}

export async function ensureWireListPdfSheetExport(
  projectId: string,
  sheetSlug: string,
  origin: string,
): Promise<EnsuredWireListPdfSheetExport> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    throw new Error("Project not found");
  }

  const sheet = manifest.sheets.find((entry) => entry.kind === "operational" && entry.slug === sheetSlug);
  if (!sheet) {
    throw new Error("Operational sheet not found");
  }

  const unitNumber = manifest.unitNumber ?? "";
  const unitExportsRoot = await resolveUnitExportsRoot(projectId, unitNumber);
  if (!unitExportsRoot) {
    throw new Error("Project exports directory not found");
  }

  const sanitizedUnit = sanitizeExportFileSegment(unitNumber);
  const wireListExportsDirectory = path.join(unitExportsRoot, WIRE_LIST_EXPORTS_DIRECTORY);
  const exportsManifestPath = path.join(wireListExportsDirectory, WIRE_LIST_EXPORTS_MANIFEST);
  await fs.mkdir(wireListExportsDirectory, { recursive: true });

  const exportsManifest =
    await readJsonFile<WireListPdfExportResult>(exportsManifestPath) ??
    {
      projectId,
      projectName: manifest.name,
      generatedAt: new Date().toISOString(),
      sheetExports: [],
      skippedSheets: [],
    };

  const existingRecord = exportsManifest.sheetExports.find((entry) => entry.sheetSlug === sheetSlug);
  if (existingRecord) {
    const absoluteFilePath = path.join(wireListExportsDirectory, existingRecord.fileName);
    try {
      await fs.access(absoluteFilePath);
      return {
        record: existingRecord,
        absoluteFilePath,
      };
    } catch {
      exportsManifest.sheetExports = exportsManifest.sheetExports.filter((entry) => entry.sheetSlug !== sheetSlug);
    }
  }

  const documentData = await buildProjectSheetPrintDocument({
    projectId,
    sheetSlug: sheet.slug,
  });

  if (!documentData) {
    throw new Error("Unable to build print document");
  }

  const visibleRowCount = documentData.sheetDocument?.standardTable.totalRows ?? 0;

  if (visibleRowCount === 0) {
    throw new Error("No semantic wire rows");
  }

  const fileName = buildBrandingFilename({
    pdNumber: manifest.pdNumber,
    projectName: manifest.name,
    revision: manifest.revision,
    unitNumber: manifest.unitNumber,
    sheetName: sheet.name,
    extension: "pdf",
  }).replace(/BRANDLIST/i, "WIRELIST");
  const absoluteFilePath = path.join(wireListExportsDirectory, fileName);
  const relativePath = path.posix.join(
    EXPORTS_DIRECTORY,
    UNITS_DIRECTORY,
    sanitizedUnit,
    WIRE_LIST_EXPORTS_DIRECTORY,
    fileName,
  );
  const pdfBytes = await renderWireListPdfFromRoute({
    origin,
    projectId,
    sheetSlug: sheet.slug,
  });

  await fs.writeFile(absoluteFilePath, pdfBytes);

  const record: WireListPdfSheetExportRecord = {
    sheetSlug: sheet.slug,
    sheetName: sheet.name,
    rowCount: visibleRowCount,
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
  exportsManifest.skippedSheets = exportsManifest.skippedSheets.filter((entry) => entry.sheetSlug !== sheetSlug);

  await fs.writeFile(exportsManifestPath, JSON.stringify(exportsManifest, null, 2), "utf-8");

  return {
    record,
    absoluteFilePath,
  };
}
