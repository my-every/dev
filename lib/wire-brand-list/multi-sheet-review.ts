import type { BrandListExportSchema, BrandListSchemaRow } from "@/lib/wire-brand-list/schema";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import { shouldSwapForTargetPair } from "@/lib/wire-list-sections";

export type MultiSheetReviewEntryMode = "cover" | "import-review" | "review";
export type MultiSheetImportDecision = "pending" | "accept" | "reject";
export type MultiSheetImportDiffChangeType = "unchanged" | "length-changed" | "imported-only" | "current-only";
export type MultiSheetImportMode = "length-only" | "full";

export interface ImportedBrandListRow {
  importedRowId: string;
  rowIndex: number;
  matchKey: string;
  fromDeviceId: string;
  wireNo: string;
  wireId: string;
  gaugeSize: string;
  length: number | null;
  toDeviceId: string;
  toLocation: string;
  devicePrefix: string;
  bundleName: string;
  bundleDisplay: string;
}

export interface ImportedBrandSheetMetadata {
  sourceSheetSlug?: string | null;
  sourceSchemaHash?: string | null;
  normalizedSheetName?: string | null;
  bundleNames?: string[];
}

export interface ImportedBrandSheetData {
  sheetSlug: string;
  sheetName: string;
  sourceSheetName: string;
  metadata?: ImportedBrandSheetMetadata;
  rows: ImportedBrandListRow[];
}

export interface MultiSheetImportRowDiff {
  diffId: string;
  matchKey: string;
  sheetSlug: string;
  sectionKey: string;
  sectionLabel: string;
  changeType: MultiSheetImportDiffChangeType;
  currentRow: BrandListSchemaRow | null;
  importedRow: ImportedBrandListRow | null;
}

export interface MultiSheetImportSheetDiff {
  sheetSlug: string;
  sheetName: string;
  sourceSheetName: string;
  actionableDiffCount: number;
  diffs: MultiSheetImportRowDiff[];
}

export interface MultiSheetImportSession {
  workbookFileName: string;
  importedAt: string;
  importMode: MultiSheetImportMode;
  matchedSheetSlugs: string[];
  unmatchedSheetNames: string[];
  activeSheetSlug: string | null;
  completedSheetSlugs: string[];
  rowDecisions: Record<string, MultiSheetImportDecision>;
  importedSheets: ImportedBrandSheetData[];
  appliedAt?: string | null;
}

export function buildBrandImportRowFromSemanticRow(row: SemanticWireListRow): ImportedBrandListRow {
  const swap = shouldSwapForTargetPair(row.fromDeviceId, row.toDeviceId);
  const fromDeviceId = swap ? (row.toDeviceId || "") : (row.fromDeviceId || "");
  const toDeviceId = swap ? (row.fromDeviceId || "") : (row.toDeviceId || "");
  const toLocation = (row.toLocation || row.location || "").trim();
  const devicePrefix = getDevicePrefix(fromDeviceId);
  const matchKey = buildBrandImportMatchKey({
    fromDeviceId,
    wireNo: row.wireNo,
    wireId: row.wireId,
    gaugeSize: row.gaugeSize,
    toDeviceId,
    toLocation,
  });

  return {
    importedRowId: row.__rowId,
    rowIndex: row.__rowIndex,
    matchKey,
    fromDeviceId,
    wireNo: row.wireNo || "",
    wireId: row.wireId || "",
    gaugeSize: row.gaugeSize || "",
    length: null,
    toDeviceId,
    toLocation,
    devicePrefix,
    bundleName: devicePrefix,
    bundleDisplay: devicePrefix,
  };
}

export function buildBrandImportMatchKey(values: {
  fromDeviceId?: string | null;
  wireNo?: string | null;
  wireId?: string | null;
  gaugeSize?: string | null;
  toDeviceId?: string | null;
  toLocation?: string | null;
}) {
  return [
    normalizeField(values.fromDeviceId),
    normalizeField(values.wireNo),
    normalizeField(values.wireId),
    normalizeField(values.gaugeSize),
    normalizeField(values.toDeviceId),
    normalizeField(values.toLocation),
  ].join("|");
}

export function flattenBrandSchemaRows(schema: BrandListExportSchema) {
  return schema.prefixGroups.flatMap((prefixGroup, prefixIndex) =>
    prefixGroup.bundles.flatMap((bundle, bundleIndex) =>
      bundle.rows.map((row, rowIndex) => ({
        prefixIndex,
        bundleIndex,
        rowIndex,
        sectionKey: `${prefixGroup.prefix}::${bundle.bundleName}::${bundle.toLocation}`,
        sectionLabel: bundle.toLocation ? `${bundle.bundleName} - ${bundle.toLocation}` : bundle.bundleName,
        row,
        matchKey: buildBrandImportMatchKey(row),
      })),
    ),
  );
}

export function buildImportDiffs(options: {
  currentSchema: BrandListExportSchema;
  importedSheet: ImportedBrandSheetData;
}): MultiSheetImportSheetDiff {
  const currentEntries = flattenBrandSchemaRows(options.currentSchema).map((entry) => ({
    ...entry,
    baseMatchKey: buildBrandImportBaseMatchKey(entry.row),
    endpointMatchKey: buildBrandImportEndpointMatchKey(entry.row),
    consumed: false,
  }));
  const importedEntries = options.importedSheet.rows.map((row) => ({
    row,
    matchKey: row.matchKey || buildBrandImportMatchKey(row),
    baseMatchKey: buildBrandImportBaseMatchKey(row),
    endpointMatchKey: buildBrandImportEndpointMatchKey(row),
    consumed: false,
  }));

  const diffs: MultiSheetImportRowDiff[] = [];

  // Pass 1: exact full-key matching (includes location)
  const groupedFullKeys = Array.from(
    new Set([
      ...currentEntries.map((entry) => entry.matchKey),
      ...importedEntries.map((entry) => entry.matchKey),
    ]),
  ).sort();

  for (const matchKey of groupedFullKeys) {
    const currentGroup = currentEntries.filter((entry) => !entry.consumed && entry.matchKey === matchKey);
    const importedGroup = importedEntries.filter((entry) => !entry.consumed && entry.matchKey === matchKey);
    const total = Math.min(currentGroup.length, importedGroup.length);

    for (let index = 0; index < total; index += 1) {
      const current = currentGroup[index];
      const imported = importedGroup[index];
      current.consumed = true;
      imported.consumed = true;
      diffs.push(buildDiffRow(options.importedSheet.sheetSlug, matchKey, index, current, imported));
    }
  }

  // Pass 2: fallback matching by base key (ignores location differences)
  const groupedBaseKeys = Array.from(
    new Set([
      ...currentEntries.filter((entry) => !entry.consumed).map((entry) => entry.baseMatchKey),
      ...importedEntries.filter((entry) => !entry.consumed).map((entry) => entry.baseMatchKey),
    ]),
  ).sort();

  for (const baseKey of groupedBaseKeys) {
    const currentGroup = currentEntries.filter((entry) => !entry.consumed && entry.baseMatchKey === baseKey);
    const importedGroup = importedEntries.filter((entry) => !entry.consumed && entry.baseMatchKey === baseKey);
    const total = Math.min(currentGroup.length, importedGroup.length);

    for (let index = 0; index < total; index += 1) {
      const current = currentGroup[index];
      const imported = importedGroup[index];
      current.consumed = true;
      imported.consumed = true;
      diffs.push(buildDiffRow(options.importedSheet.sheetSlug, `${current.matchKey}::fallback`, index, current, imported));
    }
  }

  // Pass 3: endpoint-only fallback (from/to device IDs) for unique 1:1 pairs
  const groupedEndpointKeys = Array.from(
    new Set([
      ...currentEntries.filter((entry) => !entry.consumed).map((entry) => entry.endpointMatchKey),
      ...importedEntries.filter((entry) => !entry.consumed).map((entry) => entry.endpointMatchKey),
    ]),
  ).sort();

  for (const endpointKey of groupedEndpointKeys) {
    const currentGroup = currentEntries.filter((entry) => !entry.consumed && entry.endpointMatchKey === endpointKey);
    const importedGroup = importedEntries.filter((entry) => !entry.consumed && entry.endpointMatchKey === endpointKey);
    if (currentGroup.length !== 1 || importedGroup.length !== 1) {
      continue;
    }

    const current = currentGroup[0];
    const imported = importedGroup[0];
    current.consumed = true;
    imported.consumed = true;
    diffs.push(buildDiffRow(options.importedSheet.sheetSlug, `${current.matchKey}::endpoint-fallback`, 0, current, imported));
  }

  // Pass 4: remaining unmatched rows
  const remainingCurrent = currentEntries.filter((entry) => !entry.consumed);
  const remainingImported = importedEntries.filter((entry) => !entry.consumed);

  for (const [index, current] of remainingCurrent.entries()) {
    diffs.push(buildDiffRow(options.importedSheet.sheetSlug, current.matchKey, index, current, null));
  }

  for (const [index, imported] of remainingImported.entries()) {
    diffs.push(buildDiffRow(options.importedSheet.sheetSlug, imported.matchKey, index, null, imported));
  }

  diffs.sort((left, right) => left.diffId.localeCompare(right.diffId, undefined, { numeric: true, sensitivity: "base" }));

  return {
    sheetSlug: options.importedSheet.sheetSlug,
    sheetName: options.currentSchema.sheetName,
    sourceSheetName: options.importedSheet.sourceSheetName,
    actionableDiffCount: diffs.filter((diff) => diff.changeType !== "unchanged").length,
    diffs,
  };
}

function buildBrandImportBaseMatchKey(values: {
  fromDeviceId?: string | null;
  wireNo?: string | null;
  wireId?: string | null;
  gaugeSize?: string | null;
  toDeviceId?: string | null;
}) {
  return [
    normalizeField(values.fromDeviceId),
    normalizeField(values.wireNo),
    normalizeField(values.wireId),
    normalizeField(values.gaugeSize),
    normalizeField(values.toDeviceId),
  ].join("|");
}

function buildBrandImportEndpointMatchKey(values: {
  fromDeviceId?: string | null;
  toDeviceId?: string | null;
}) {
  return [
    normalizeField(values.fromDeviceId),
    normalizeField(values.toDeviceId),
  ].join("|");
}

function buildDiffRow(
  sheetSlug: string,
  matchKey: string,
  index: number,
  current:
    | (ReturnType<typeof flattenBrandSchemaRows>[number] & { consumed: boolean; baseMatchKey: string })
    | null,
  imported:
    | { row: ImportedBrandListRow; matchKey: string; baseMatchKey: string; consumed: boolean }
    | null,
): MultiSheetImportRowDiff {
  const changeType = resolveDiffChangeType(current?.row ?? null, imported?.row ?? null);
  const sectionKey = current?.sectionKey ?? `${imported?.row.devicePrefix ?? "UNKNOWN"}::${imported?.row.bundleName ?? "Import"}`;
  const sectionLabel = current?.sectionLabel
    ?? (imported?.row.toLocation
      ? `${imported.row.bundleName} - ${imported.row.toLocation}`
      : imported?.row.bundleName ?? "Imported Rows");

  return {
    diffId: `${sheetSlug}::${matchKey}::${index}`,
    matchKey,
    sheetSlug,
    sectionKey,
    sectionLabel,
    changeType,
    currentRow: current?.row ?? null,
    importedRow: imported?.row ?? null,
  };
}

export function getPendingDiffCount(sheetDiff: MultiSheetImportSheetDiff, rowDecisions: Record<string, MultiSheetImportDecision>) {
  return sheetDiff.diffs.filter((diff) => diff.changeType !== "unchanged" && (rowDecisions[diff.diffId] ?? "pending") === "pending").length;
}

function resolveDiffChangeType(
  currentRow: BrandListSchemaRow | null,
  importedRow: ImportedBrandListRow | null,
): MultiSheetImportDiffChangeType {
  if (currentRow && importedRow) {
    return normalizeLength(currentRow.length) === normalizeLength(importedRow.length) ? "unchanged" : "length-changed";
  }

  if (importedRow) {
    return "imported-only";
  }

  return "current-only";
}

function normalizeLength(value: number | null | undefined) {
  return typeof value === "number" && !Number.isNaN(value) ? value : null;
}

function normalizeField(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function getDevicePrefix(deviceId: string | undefined) {
  const baseDeviceId = (deviceId ?? "").split(":")[0]?.trim() ?? "";
  const match = baseDeviceId.match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : baseDeviceId.toUpperCase() || "UNKNOWN";
}
