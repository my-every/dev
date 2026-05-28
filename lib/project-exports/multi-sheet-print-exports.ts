import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";
import XLSX from "xlsx-js-style";

import { createDefaultPrintSettings, createDefaultProjectInfo } from "@/lib/wire-list-print/defaults";
import { buildProjectSheetPrintDocument } from "@/lib/wire-list-print/build-project-sheet-print-document";
import { buildWireListPrintSchema } from "@/lib/wire-list-print/schema";
import { buildBrandListExportSchema } from "@/lib/wire-brand-list/schema";
import type { BrandListExportSchema } from "@/lib/wire-brand-list/schema";
import type { WireListPrintSchema } from "@/lib/wire-list-print/schema";
import { readProjectManifest, readSheetSchema, resolveProjectRootDirectory } from "@/lib/project-state/share-project-state-handlers";
import { createProjectPartTerminalResolver } from "@/lib/project-state/part-terminal-schema";
import {
  readWireBrandListSchema,
  readWireListPrintSchema,
  saveWireBrandListSchema,
  saveWireListPrintSchema,
} from "@/lib/project-state/share-print-schema-handlers";
import {
  EXPORTS_DIRECTORY,
  UNITS_DIRECTORY,
  resolveUnitExportsRoot,
  sanitizeExportFileSegment,
} from "@/lib/project-exports/project-exports-paths";
import { appendBrandWorkbookSupportSheets } from "@/lib/project-exports/branding-workbook-helpers";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";

const MULTI_SHEET_PRINT_EXPORTS_DIRECTORY = "multi-sheet-print";

export interface MultiSheetPrintExportFile {
  fileName: string;
  relativePath: string;
}

export interface MultiSheetPrintExportResult {
  projectId: string;
  generatedAt: string;
  approvedSheets: Array<{
    sheetSlug: string;
    sheetName: string;
    brandingRows: number;
    wireRows: number;
  }>;
  skippedSheets: Array<{
    sheetSlug: string;
    reason: string;
  }>;
  brandingWorkbook?: MultiSheetPrintExportFile;
  wireListSchema?: MultiSheetPrintExportFile;
  manifestFile?: MultiSheetPrintExportFile;
}

interface CombinedWireListExportDocument {
  schemaVersion: 1;
  generatedAt: string;
  projectId: string;
  projectName: string;
  approvedSheetOrder: string[];
  sheets: WireListPrintSchema[];
}

function makeRelativeExportPath(unitNumber: string, fileName: string): string {
  return path.posix.join(
    EXPORTS_DIRECTORY,
    UNITS_DIRECTORY,
    sanitizeExportFileSegment(unitNumber),
    MULTI_SHEET_PRINT_EXPORTS_DIRECTORY,
    fileName,
  );
}

function truncateWorksheetName(value: string): string {
  const sanitized = value.replace(/[\\/*?:[\]]/g, " ").trim() || "Sheet";
  return sanitized.slice(0, 31);
}

const METADATA_STYLE = {
  font: { bold: true },
  alignment: { wrapText: true, vertical: "center" as const },
};

const SHEET_TITLE_STYLE = {
  font: { bold: true, sz: 14 },
  alignment: { wrapText: true, vertical: "center" as const },
};

const COLUMN_HEADER_STYLE = {
  font: { bold: true },
  alignment: { wrapText: true, vertical: "center" as const },
  fill: { fgColor: { rgb: "E2E8F0" } },
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

function getVisibleBundleDisplay(bundleName: string, bundleDisplay: string, rowIndex: number) {
  if (!bundleDisplay) {
    return "";
  }

  if (rowIndex > 0 && bundleDisplay.trim() === bundleName.trim()) {
    return "";
  }

  return bundleDisplay;
}

function applyBrandingWorksheetStyles(worksheet: XLSX.WorkSheet, rows: Array<Array<string | number>>) {
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 20 },
    { wch: 16 },
    { wch: 24 },
  ];

  for (let rowIndex = range.s.r; rowIndex <= range.e.r; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    const isMetadataRow = rowIndex === 0;
    const isTitleRow = rowIndex === 1;
    const isColumnHeaderRow = rowIndex === 2;
    const isPrefixGroupRow = row.length === 1 && row[0] !== "";
    const isBundleHeaderRow = row.length >= 8 && String(row[7] ?? "").trim().length > 0;

    for (let columnIndex = range.s.c; columnIndex <= range.e.c; columnIndex += 1) {
      const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
      const cell = worksheet[address];

      if (!cell) {
        continue;
      }

      if (typeof cell.v === "string") {
        cell.t = "s";
        if (/^[-=+@]/.test(cell.v)) {
          cell.z = "@";
        }
      }

      if (isMetadataRow) {
        cell.s = METADATA_STYLE;
      } else if (isTitleRow) {
        cell.s = SHEET_TITLE_STYLE;
      } else if (isColumnHeaderRow) {
        cell.s = COLUMN_HEADER_STYLE;
      } else if (isPrefixGroupRow && columnIndex === 0) {
        cell.s = PREFIX_GROUP_STYLE;
      } else if (isBundleHeaderRow) {
        cell.s = BUNDLE_HEADER_STYLE;
      } else {
        cell.s = DATA_CELL_STYLE;
      }
    }
  }
}

function buildBrandingWorkbook(schemas: BrandListExportSchema[]): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();

  for (const schema of schemas) {
    const rows: Array<Array<string | number>> = [
      [schema.projectInfo.projectNumber ?? "", schema.projectInfo.projectName ?? "", schema.projectInfo.revision ?? ""],
      [schema.sheetName],
      [...schema.header.columns],
    ];

    for (const prefixGroup of schema.prefixGroups) {
      rows.push([prefixGroup.prefix]);
      let hasWrittenBundle = false;

      for (const bundle of prefixGroup.bundles) {
        if (hasWrittenBundle) {
          rows.push([]);
        }

        for (const [rowIndex, row] of bundle.rows.entries()) {
          rows.push([
            row.fromDeviceId,
            row.wireNo,
            row.wireId,
            row.gaugeSize,
            row.length ?? "",
            row.toDeviceId,
            row.toLocation,
            getVisibleBundleDisplay(bundle.bundleName, row.bundleDisplay || "", rowIndex),
          ]);
        }
        hasWrittenBundle = hasWrittenBundle || bundle.rows.length > 0;
      }

      rows.push([]);
    }

    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    applyBrandingWorksheetStyles(worksheet, rows);

    XLSX.utils.book_append_sheet(workbook, worksheet, truncateWorksheetName(schema.sheetName));
  }

  return appendBrandWorkbookSupportSheets(workbook, schemas);
}

async function ensureWireSchemaForSheet(projectId: string, sheetSlug: string): Promise<WireListPrintSchema | null> {
  const existing = await readWireListPrintSchema(projectId, sheetSlug);
  if (existing) {
    existing.sheetName = normalizeDisplayTitle(existing.sheetName);
    return existing;
  }

  const sheet = await readSheetSchema(projectId, sheetSlug);
  if (!sheet) {
    return null;
  }

  const document = await buildProjectSheetPrintDocument({
    projectId,
    sheetSlug,
    settings: {
      ...createDefaultPrintSettings(),
      mode: "standardize",
    },
  });

  if (!document?.sheetDocument) {
    return null;
  }

  const schema = buildWireListPrintSchema({
    currentSheetName: document.currentSheetName,
    sheetDocument: document.sheetDocument,
    visibleSections: document.sheetDocument.wireListSections,
    totalPagesOverride: document.previewPageCount,
    settings: document.settings,
    projectInfo: document.projectInfo,
    sheetTitle: document.sheetTitle,
    hiddenSections: new Set(document.hiddenSectionKeys ?? []),
    getLengthForRow: (rowId) => document.rowLengthsById?.[rowId] ?? null,
    locationBoxSideByName: document.locationBoxSideByName,
    locationNormalizedTitleByName: document.locationNormalizedTitleByName,
  });
  schema.sheetName = normalizeDisplayTitle(schema.sheetName);

  await saveWireListPrintSchema(projectId, sheetSlug, schema);
  return schema;
}

async function ensureBrandingSchemaForSheet(projectId: string, sheetSlug: string): Promise<BrandListExportSchema | null> {
  const existing = await readWireBrandListSchema(projectId, sheetSlug);
  if (existing) {
    existing.sheetName = normalizeDisplayTitle(existing.sheetName);
    existing.header.locationTitle = normalizeDisplayTitle(existing.header.locationTitle);
    return existing;
  }

  const manifest = await readProjectManifest(projectId);
  const sheet = await readSheetSchema(projectId, sheetSlug);
  if (!manifest || !sheet) {
    return null;
  }

  const document = await buildProjectSheetPrintDocument({
    projectId,
    sheetSlug,
    settings: {
      mode: "branding",
      showCoverPage: false,
      showTableOfContents: false,
      showIPVCodes: false,
    },
  });

  if (!document?.sheetDocument) {
    return null;
  }

  const projectRoot = await resolveProjectRootDirectory(projectId, {
    pdNumber: manifest.pdNumber,
    projectName: manifest.name,
  });
  const terminalResolver = projectRoot ? await createProjectPartTerminalResolver(projectRoot) : null;

  const schema = buildBrandListExportSchema({
    sheetSlug,
    sheetName: sheet.name,
    brandingVisibleSections: document.sheetDocument.brandingSections,
    sectionColumnVisibility: document.settings.sectionColumnVisibility,
    brandingSortMode: document.settings.brandingSortMode,
    projectInfo: {
      ...createDefaultProjectInfo({
        projectNumber: manifest.pdNumber,
        projectName: manifest.name,
        revision: manifest.revision,
        pdNumber: manifest.pdNumber,
        unitNumber: manifest.unitNumber,
      }),
      controlsDE: sheet.metadata?.controlsDE,
      controlsME: sheet.metadata?.controlsME,
    },
    resolveTerminalMetadata: terminalResolver
      ? ({ fromDeviceId, toDeviceId, wireNo, wireId }) => {
          const metadata = terminalResolver({ deviceId: fromDeviceId, wireNo, wireId });
          return {
            fromTerminal: metadata?.terminal ?? (fromDeviceId?.split(":")[1]?.trim().toUpperCase() || undefined),
            fromTerminalSide: metadata?.side,
            fromTerminalTier: metadata?.tier,
            fromTerminalOrder: metadata?.order ?? null,
            toTerminal: toDeviceId?.split(":")[1]?.trim().toUpperCase() || undefined,
            isNegative: metadata?.isNegative,
            terminalHardware: metadata?.hardware,
            terminalInstructions: metadata?.instructions,
          };
        }
      : undefined,
  });
  schema.sheetName = normalizeDisplayTitle(schema.sheetName);
  schema.header.locationTitle = normalizeDisplayTitle(schema.header.locationTitle);

  await saveWireBrandListSchema(projectId, sheetSlug, schema);
  return schema;
}

export async function generateMultiSheetPrintExport(
  projectId: string,
  approvedSheetSlugs: string[],
): Promise<MultiSheetPrintExportResult> {
  const startedAt = Date.now();
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    throw new Error("Project not found");
  }

  if (!approvedSheetSlugs.length) {
    throw new Error("No approved sheets provided");
  }

  const unitExportsRoot = await resolveUnitExportsRoot(projectId, manifest.unitNumber ?? "");
  if (!unitExportsRoot) {
    throw new Error("Project exports directory not found");
  }

  const exportDirectory = path.join(unitExportsRoot, MULTI_SHEET_PRINT_EXPORTS_DIRECTORY);
  await fs.mkdir(exportDirectory, { recursive: true });

  const manifestSheets = manifest.sheets.filter((sheet) => sheet.kind === "operational");
  const approvedSet = new Set(approvedSheetSlugs);
  const orderedSheets = manifestSheets.filter((sheet) => approvedSet.has(sheet.slug));

  const brandingSchemas: BrandListExportSchema[] = [];
  const wireSchemas: WireListPrintSchema[] = [];
  const approvedSheets: MultiSheetPrintExportResult["approvedSheets"] = [];
  const skippedSheets: MultiSheetPrintExportResult["skippedSheets"] = [];

  for (const sheet of orderedSheets) {
    const sheetStartedAt = Date.now();
    const [brandingSchema, wireSchema] = await Promise.all([
      ensureBrandingSchemaForSheet(projectId, sheet.slug),
      ensureWireSchemaForSheet(projectId, sheet.slug),
    ]);

    if (!brandingSchema || !wireSchema) {
      skippedSheets.push({
        sheetSlug: sheet.slug,
        reason: !brandingSchema && !wireSchema
          ? "Missing branding and wire-list schemas"
          : !brandingSchema
            ? "Missing branding schema"
            : "Missing wire-list schema",
      });
      continue;
    }

    brandingSchemas.push(brandingSchema);
    wireSchemas.push(wireSchema);
    approvedSheets.push({
      sheetSlug: sheet.slug,
      sheetName: sheet.name,
      brandingRows: brandingSchema.totalRows,
      wireRows: wireSchema.totalRows,
    });
    console.info(
      "[multi-sheet-print/export] prepared sheet",
      JSON.stringify({
        projectId,
        sheetSlug: sheet.slug,
        brandingRows: brandingSchema.totalRows,
        wireRows: wireSchema.totalRows,
        durationMs: Date.now() - sheetStartedAt,
      }),
    );
  }

  if (!approvedSheets.length) {
    throw new Error("None of the approved sheets had both saved branding and wire-list schemas");
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileStem = [
    sanitizeExportFileSegment(manifest.pdNumber ?? manifest.name ?? "project"),
    sanitizeExportFileSegment(manifest.unitNumber ?? "unit"),
    "multi-sheet-print",
    timestamp,
  ].filter(Boolean).join("-");

  const brandingWorkbookFileName = `${fileStem}.xlsx`;
  const wireListSchemaFileName = `${fileStem}.wire-list.json`;
  const manifestFileName = `${fileStem}.manifest.json`;

  const brandingWorkbook = buildBrandingWorkbook(brandingSchemas);
  const brandingBuffer = XLSX.write(brandingWorkbook, { type: "buffer", bookType: "xlsx" }) as Uint8Array;
  await fs.writeFile(path.join(exportDirectory, brandingWorkbookFileName), Buffer.from(brandingBuffer));

  const combinedWireListDocument: CombinedWireListExportDocument = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    projectId,
    projectName: manifest.name,
    approvedSheetOrder: approvedSheets.map((sheet) => sheet.sheetSlug),
    sheets: wireSchemas,
  };
  await fs.writeFile(
    path.join(exportDirectory, wireListSchemaFileName),
    JSON.stringify(combinedWireListDocument, null, 2),
    "utf-8",
  );

  const result: MultiSheetPrintExportResult = {
    projectId,
    generatedAt: new Date().toISOString(),
    approvedSheets,
    skippedSheets,
    brandingWorkbook: {
      fileName: brandingWorkbookFileName,
      relativePath: makeRelativeExportPath(manifest.unitNumber ?? "", brandingWorkbookFileName),
    },
    wireListSchema: {
      fileName: wireListSchemaFileName,
      relativePath: makeRelativeExportPath(manifest.unitNumber ?? "", wireListSchemaFileName),
    },
  };

  await fs.writeFile(
    path.join(exportDirectory, manifestFileName),
    JSON.stringify(result, null, 2),
    "utf-8",
  );

  result.manifestFile = {
    fileName: manifestFileName,
    relativePath: makeRelativeExportPath(manifest.unitNumber ?? "", manifestFileName),
  };

  console.info(
    "[multi-sheet-print/export] completed",
    JSON.stringify({
      projectId,
      approvedSheets: approvedSheets.length,
      skippedSheets: skippedSheets.length,
      brandingWorkbookFileName,
      wireListSchemaFileName,
      durationMs: Date.now() - startedAt,
    }),
  );

  return result;
}
