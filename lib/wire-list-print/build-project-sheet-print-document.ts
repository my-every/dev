import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import type { WireListPrintDocumentData } from "@/lib/wire-list-sheet-document/types";
import { buildCablePartNumberMap, buildPartNumberMap, type CablePartNumberLookupResult, type PartNumberLookupResult } from "@/lib/part-number-list";
import { deserializeSheetPatches, applyPatchesToRows } from "@/lib/row-patches";
import { readProjectManifest, readAssignmentMappings, readSheetSchema } from "@/lib/project-state/share-project-state-handlers";
import { readDevicePartNumbersMap } from "@/lib/project-state/device-part-numbers-generator";
import { resolveProjectRootDirectory } from "@/lib/project-state/share-project-state-handlers";
import { readAssignmentSwsConfig } from "@/lib/project-state/share-assignment-sws-handlers";
import { parseBlueLabelSheet } from "@/lib/wiring-identification/blue-label-sequence";
import {
  createDefaultProjectInfo,
  createDefaultPrintSettings,
  type PrintSettings,
} from "@/lib/wire-list-print/defaults";
import { shouldSwapForTargetPair } from "@/lib/wire-list-sections";
import {
  buildDefaultBrandingHiddenSections,
  buildDefaultStandardHiddenSections,
  buildPrintPreviewPageCount,
  buildProcessedPrintLocationGroups,
  resolveActiveHiddenSections,
} from "@/lib/wire-list-print/model";
import { normalizeWireListWireNo } from "@/lib/wire-list-print/normalize-wire-no";
import { buildWireListSheetWorkspaceDocument } from "@/lib/wire-list-sheet-document/build-sheet-document";
import { buildWireLengthEstimatesFromSheets, estimateToRowLength } from "@/lib/wire-length";
import type { ParsedWorkbookSheet } from "@/lib/workbook/types";
import type { SheetSchema } from "@/types/sheet-schema";

/** Minimum branding length in inches — any computed or persisted value below this floor is raised to it. */
const BRANDING_MINIMUM_LENGTH_INCHES = 60;

function applyBrandingMinimumLength(length: number | undefined): number | undefined {
  if (typeof length !== "number") return undefined;
  return Math.max(length, BRANDING_MINIMUM_LENGTH_INCHES);
}

interface RawBrandingLengthEntry {
  devicePrefix?: string;
  gaugeSize?: string;
  wireId?: string;
  minLength?: number;
  maxLength?: number;
  medianLength?: number;
  minLengthCount?: number;
  maxLengthCount?: number;
  sampleCount?: number;
}

interface RawReferenceAssignment {
  value?: string;
  brandingLengths?: RawBrandingLengthEntry[];
}

interface RawReferenceUnitTypeEntry {
  unitType?: string;
  assignments?: RawReferenceAssignment[];
}

interface RawLayoutReferenceDocument {
  mappings?: {
    unitTypeToBoxNumber?: RawReferenceUnitTypeEntry[];
  };
}

function normalizeToken(value: string | undefined | null): string {
  return (value ?? "").trim();
}

function normalizeUpperToken(value: string | undefined | null): string {
  return normalizeToken(value).toUpperCase();
}

function normalizeMatchToken(value: string | undefined | null): string {
  return normalizeUpperToken(value)
    .replace(/\(SHT\s*\d+\)/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDevicePrefixFromDeviceId(deviceId: string | undefined): string {
  const baseDeviceId = normalizeToken(deviceId).split(":")[0] ?? "";
  const match = baseDeviceId.match(/^([A-Za-z]+)/);
  return (match ? match[1] : baseDeviceId).toUpperCase();
}

function toBrandingLengthKey(devicePrefix: string, gaugeSize: string, wireId: string): string {
  return `${normalizeUpperToken(devicePrefix)}||${normalizeUpperToken(gaugeSize)}||${normalizeUpperToken(wireId)}`;
}

async function readLayoutReferenceDocument(): Promise<RawLayoutReferenceDocument | null> {
  try {
    const filePath = path.join(process.cwd(), "Share", "References", "layout-unit-box-panel-reference.json");
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as RawLayoutReferenceDocument;
  } catch {
    return null;
  }
}

function buildAssignmentBrandingMedianMap(
  reference: RawLayoutReferenceDocument | null,
  unitType: string | undefined,
  assignmentName: string,
): Map<string, number> {
  const result = new Map<string, number>();
  const unitTypeRows = reference?.mappings?.unitTypeToBoxNumber ?? [];
  if (!Array.isArray(unitTypeRows) || unitTypeRows.length === 0) return result;

  const targetUnitType = normalizeUpperToken(unitType);
  const targetAssignmentName = normalizeToken(assignmentName);
  const targetAssignmentMatch = normalizeMatchToken(assignmentName);

  const matchingUnitRows = targetUnitType
    ? unitTypeRows.filter((row) => normalizeUpperToken(row.unitType) === targetUnitType)
    : unitTypeRows;

  let matchedAssignment: RawReferenceAssignment | null = null;

  for (const unitRow of matchingUnitRows) {
    for (const candidate of unitRow.assignments ?? []) {
      const candidateName = normalizeToken(candidate.value);
      if (candidateName && candidateName === targetAssignmentName) {
        matchedAssignment = candidate;
        break;
      }
    }
    if (matchedAssignment) break;
  }

  if (!matchedAssignment) {
    for (const unitRow of matchingUnitRows) {
      for (const candidate of unitRow.assignments ?? []) {
        const candidateMatch = normalizeMatchToken(candidate.value);
        if (candidateMatch && candidateMatch === targetAssignmentMatch) {
          matchedAssignment = candidate;
          break;
        }
      }
      if (matchedAssignment) break;
    }
  }

  const lengths = matchedAssignment?.brandingLengths ?? [];
  for (const entry of lengths) {
    const devicePrefix = normalizeUpperToken(entry.devicePrefix);
    const gaugeSize = normalizeUpperToken(entry.gaugeSize);
    const wireId = normalizeUpperToken(entry.wireId);
    if (!devicePrefix || !gaugeSize || !wireId) continue;

    const medianCandidate = typeof entry.medianLength === "number"
      ? entry.medianLength
      : typeof entry.minLength === "number" && typeof entry.maxLength === "number"
        ? Math.round((entry.minLength + entry.maxLength) / 2)
        : null;

    if (typeof medianCandidate !== "number" || !Number.isFinite(medianCandidate) || medianCandidate <= 0) {
      continue;
    }

    result.set(toBrandingLengthKey(devicePrefix, gaugeSize, wireId), medianCandidate);
  }

  return result;
}

function resolveMedianBrandingLength(
  row: SheetSchema["rows"][number],
  medianByKey: Map<string, number>,
): number | undefined {
  if (medianByKey.size === 0) return undefined;

  const swap = shouldSwapForTargetPair(row.fromDeviceId, row.toDeviceId);
  const fromDeviceId = swap ? (row.toDeviceId || "") : (row.fromDeviceId || "");
  const devicePrefix = extractDevicePrefixFromDeviceId(fromDeviceId);
  const gaugeSize = normalizeUpperToken(row.gaugeSize);
  const wireId = normalizeUpperToken(row.wireId);
  if (!devicePrefix || !gaugeSize || !wireId) return undefined;

  const key = toBrandingLengthKey(devicePrefix, gaugeSize, wireId);
  return medianByKey.get(key);
}

function sheetSchemaToWorkbookSheet(schema: SheetSchema | null): ParsedWorkbookSheet | null {
  if (!schema) return null;

  return {
    originalName: schema.name,
    slug: schema.slug,
    headers: schema.headers,
    rows: (schema.rawRows ?? []) as ParsedWorkbookSheet["rows"],
    semanticRows: schema.rows,
    rowCount: schema.rowCount,
    columnCount: schema.headers.length,
    sheetIndex: schema.sheetIndex,
    warnings: schema.warnings ?? [],
    metadata: schema.metadata,
  };
}

export async function buildProjectSheetPrintDocument(options: {
  projectId: string;
  sheetSlug: string;
  settings?: Partial<PrintSettings>;
}): Promise<WireListPrintDocumentData | null> {
  const manifest = await readProjectManifest(options.projectId);
  if (!manifest) {
    return null;
  }

  const sheetEntry = manifest.sheets.find(s => s.slug === options.sheetSlug);
  if (!sheetEntry || sheetEntry.kind !== "operational") {
    return null;
  }

  const schema = await readSheetSchema(options.projectId, options.sheetSlug);
  if (!schema) {
    return null;
  }

  const assignmentNode = manifest.assignments?.[options.sheetSlug];
  const assignmentName = normalizeToken(assignmentNode?.sheetName) || schema.name;
  const assignmentUnitType = normalizeToken(assignmentNode?.unitType);
  const layoutReference = await readLayoutReferenceDocument();
  const brandingMedianByKey = buildAssignmentBrandingMedianMap(
    layoutReference,
    assignmentUnitType,
    assignmentName,
  );

  const settings: PrintSettings = {
    ...createDefaultPrintSettings(),
    ...options.settings,
    // Safely reconstitute Set fields that may arrive as arrays from JSON
    standardHiddenSections: options.settings?.standardHiddenSections instanceof Set
      ? options.settings.standardHiddenSections
      : new Set(Array.isArray(options.settings?.standardHiddenSections) ? options.settings.standardHiddenSections as unknown as string[] : []),
    brandingHiddenSections: options.settings?.brandingHiddenSections instanceof Set
      ? options.settings.brandingHiddenSections
      : new Set(Array.isArray(options.settings?.brandingHiddenSections) ? options.settings.brandingHiddenSections as unknown as string[] : []),
    hiddenRows: options.settings?.hiddenRows instanceof Set
      ? options.settings.hiddenRows
      : new Set(Array.isArray(options.settings?.hiddenRows) ? options.settings.hiddenRows as unknown as string[] : []),
    crossWireSections: options.settings?.crossWireSections instanceof Set
      ? options.settings.crossWireSections
      : new Set(Array.isArray(options.settings?.crossWireSections) ? options.settings.crossWireSections as unknown as string[] : []),
  };
  const projectInfo = createDefaultProjectInfo({
    projectNumber: manifest.pdNumber,
    projectName: manifest.name,
    revision: manifest.revision,
    pdNumber: manifest.pdNumber,
    unitNumber: manifest.unitNumber,
  });
  const swsConfig = await readAssignmentSwsConfig(options.projectId, options.sheetSlug);
  const workspaceState = swsConfig?.workspaceState;

  // Read pre-computed reference data from project state
  const projectRoot = await resolveProjectRootDirectory(options.projectId, {
    pdNumber: manifest.pdNumber,
    projectName: manifest.name,
  });
  const partNumberMap: Map<string, PartNumberLookupResult> = projectRoot
    ? await readDevicePartNumbersMap(projectRoot).then(map => {
      if (!map) return new Map<string, PartNumberLookupResult>();
      return new Map(Object.entries(map.devices).map(([id, entry]) => [id, {
        partNumber: entry.partNumber,
        description: entry.description ?? "",
        location: "",
      }]));
    })
    : new Map<string, PartNumberLookupResult>();

  // Load reference sheets for wire length estimation
  const [blueLabelsSheetSchema, partListSheetSchema] = await Promise.all([
    readSheetSchema(options.projectId, "blue-labels"),
    readSheetSchema(options.projectId, "part-number-list"),
  ]);

  const blueLabelsSheet = sheetSchemaToWorkbookSheet(blueLabelsSheetSchema);
  const partListSheet = sheetSchemaToWorkbookSheet(partListSheetSchema);
  const blueLabels = parseBlueLabelSheet(blueLabelsSheet ?? null);
  const cablePartNumberMap: Map<string, CablePartNumberLookupResult> = buildCablePartNumberMap(partListSheet ?? undefined);

  const semanticRows = (schema.rows ?? []).map((row) => ({
    ...row,
    wireNo: normalizeWireListWireNo(row.wireNo),
  }));
  const computedLengths = new Map<string, number>();
  const rowLengthsById: NonNullable<WireListPrintDocumentData["rowLengthsById"]> = {};

  // Compute wire length estimates from reference sheets
  if (blueLabelsSheet) {
    const estimationResult = buildWireLengthEstimatesFromSheets(
      semanticRows,
      blueLabelsSheet,
      partListSheet,
      schema.name,
    );
    for (const [rowId, estimate] of estimationResult.estimates) {
      const rowLength = estimateToRowLength(estimate);
      if (rowLength) {
        computedLengths.set(rowId, rowLength.roundedInches);
        rowLengthsById[rowId] = {
          display: rowLength.display,
          roundedInches: rowLength.roundedInches,
          confidence: rowLength.confidence,
        };
      }
    }
  }

  const patchedRows = applyPatchesToRows(
    semanticRows,
    deserializeSheetPatches(workspaceState?.rowPatches ?? []),
    { computedLengths },
  );
  // Compute locationBoxSideByName first so it can be passed to processedLocationGroups
  const assignmentMappings = await readAssignmentMappings(options.projectId);
  const locationBoxSideByName = assignmentMappings.reduce<Record<string, string>>((acc, mapping) => {
    const sheetNameKey = mapping.sheetName?.trim().toUpperCase();
    const mappedBoxSide = manifest.assignments?.[mapping.sheetSlug]?.boxSide;
    if (sheetNameKey && mappedBoxSide) {
      acc[sheetNameKey] = mappedBoxSide;
    }
    return acc;
  }, {});
  // Also compute normalizedTitle mapping for display in location columns
  const locationNormalizedTitleByName = assignmentMappings.reduce<Record<string, string>>((acc, mapping) => {
    const sheetNameKey = mapping.sheetName?.trim().toUpperCase();
    const normalizedTitle = manifest.assignments?.[mapping.sheetSlug]?.normalizedTitle;
    if (sheetNameKey && normalizedTitle) {
      acc[sheetNameKey] = normalizedTitle;
    }
    return acc;
  }, {});
  const processedLocationGroups = buildProcessedPrintLocationGroups({
    rows: patchedRows,
    mode: settings.mode,
    enabledSections: settings.enabledSections,
    sectionOrder: settings.sectionOrder,
    currentSheetName: schema.name,
    blueLabels,
    partNumberMap,
    sortMode: settings.mode === "branding" ? settings.brandingSortMode : settings.wireListSortMode,
    locationBoxSideByName,
    locationNormalizedTitleByName,
  });
  const externalSectionContext = {
    locationBoxSideByName,
    locationNormalizedTitleByName,
    currentBoxSide: assignmentNode?.boxSide,
    assignmentMappings,
    currentSheetName: schema.name,
    internalRows: patchedRows,
    partNumberMap,
    externalLocationConfig: assignmentNode?.externalLocations ?? undefined,
  };
  const defaultBrandingHiddenSections = buildDefaultBrandingHiddenSections(processedLocationGroups, externalSectionContext);
  const defaultStandardHiddenSections = buildDefaultStandardHiddenSections(processedLocationGroups, externalSectionContext);
  const activeHiddenSections = resolveActiveHiddenSections({
    mode: settings.mode,
    standardHiddenSections: settings.standardHiddenSections,
    standardHiddenSectionsCustomized: settings.standardHiddenSectionsCustomized,
    brandingHiddenSections: settings.brandingHiddenSections,
    brandingHiddenSectionsCustomized: settings.brandingHiddenSectionsCustomized,
    defaultBrandingHiddenSections,
    defaultStandardHiddenSections,
  });
  const previewPageCount = buildPrintPreviewPageCount(
    {
      mode: settings.mode,
      processedLocationGroups,
      showFeedbackSection: settings.showFeedbackSection,
      showCoverPage: settings.showCoverPage,
      showTableOfContents: settings.showTableOfContents,
      showIPVCodes: settings.showIPVCodes,
    },
  );
  const comments = Object.fromEntries(
    Object.entries(workspaceState?.workflow ?? {})
      .map(([rowId, state]) => [rowId, state.comment ?? ""])
      .filter(([, comment]) => comment.length > 0),
  );
  const brandingPreviewRowMap = new Map(
    patchedRows.map((row) => {
      const baseLength = rowLengthsById[row.__rowId]?.roundedInches;
      const persistedEdit = workspaceState?.brandingEdits?.[row.__rowId];
      const persistedLength = typeof persistedEdit?.length === "number"
        ? persistedEdit.length
        : typeof persistedEdit?.lengthAdjustment === "number" && typeof baseLength === "number"
          ? Math.max(0, baseLength + persistedEdit.lengthAdjustment)
          : undefined;
      const medianFallbackLength = resolveMedianBrandingLength(row, brandingMedianByKey);
      const location = row.toLocation || row.fromLocation || row.location || "-";

      return [
        row.__rowId,
        {
          row,
          baseLength,
          measurement: applyBrandingMinimumLength(
            typeof persistedLength === "number"
              ? persistedLength
              : typeof medianFallbackLength === "number"
                ? medianFallbackLength
                : baseLength,
          ),
          isManual: typeof persistedLength === "number",
          location,
          isExternal: Boolean(schema.name.trim()) && !location.toUpperCase().includes(schema.name.toUpperCase().trim()),
        },
      ] as const;
    }),
  );
  const sheetDocument = buildWireListSheetWorkspaceDocument({
    sheetTitle: "Wire List",
    currentSheetName: schema.name,
    previewPageCount,
    processedLocationGroups,
    activeHiddenSections,
    sectionColumnVisibility: settings.sectionColumnVisibility,
    hiddenRows: settings.hiddenRows,
    crossWireSections: settings.crossWireSections,
    rowLengthsById,
    includeFeedbackPage: settings.mode !== "branding",
    brandingPreviewRowMap,
    partNumberMap,
  });
  const brandingVisibleSections = sheetDocument.brandingSections;
  const standardVisibleSections = sheetDocument.standardSections;

  return {
    settings,
    projectInfo,
    sheetTitle: "Wire List",
    currentSheetName: schema.name,
    previewPageCount,
    processedLocationGroups,
    hiddenSectionKeys: Array.from(activeHiddenSections),
    hiddenRowIds: Array.from(settings.hiddenRows),
    crossWireSectionKeys: Array.from(settings.crossWireSections),
    comments,
    partNumberEntries: Array.from(partNumberMap.entries()),
    cablePartNumberEntries: Array.from(cablePartNumberMap.entries()),
    rowLengthsById,
    brandingVisibleSections,
    standardVisibleSections,
    includeFeedbackPage: settings.mode !== "branding",
    sheetDocument,
    locationNormalizedTitleByName,
  };
}
