import type { AssignmentWorkspaceBrandingEdits as SheetBrandingEdits } from "@/types/d380-assignment-sws";
import type { BrandingExclusionConfig, BrandingRow } from "@/lib/branding-list/types";
import { DEFAULT_BRANDING_EXCLUSIONS } from "@/lib/branding-list/types";
import { aggregateBrandingRows } from "@/lib/branding-list/filter";
import { normalizeSheetName } from "@/lib/workbook/normalize-sheet-name";
import type { SemanticWireListRow } from "@/lib/workbook/types";

const EXTERNAL_BRANDING_ALLOWANCE = 60;

function getDeviceBase(deviceId: string | undefined | null): string {
  if (!deviceId) return "";

  const colonIndex = deviceId.indexOf(":");
  if (colonIndex !== -1) {
    return deviceId.substring(0, colonIndex);
  }

  return deviceId;
}

function getDevicePrefix(deviceId: string | undefined | null): string {
  if (!deviceId) return "";
  const base = getDeviceBase(deviceId);
  const match = base.match(/^([A-Z]+)/i);
  return match ? match[1].toUpperCase() : "";
}

export function isExternalBrandingRow(
  row: Pick<SemanticWireListRow, "toLocation" | "fromLocation" | "location">,
  sheetName: string,
): boolean {
  const normalizedSheet = normalizeSheetName(sheetName);
  const normalizedToLocation = normalizeSheetName(row.toLocation || "");
  const normalizedFromLocation = normalizeSheetName(row.fromLocation || "");

  if (normalizedToLocation && normalizedSheet && normalizedToLocation !== normalizedSheet) {
    return true;
  }

  if (normalizedFromLocation && normalizedToLocation && normalizedFromLocation !== normalizedToLocation) {
    return true;
  }

  return false;
}

export function calculateBrandingLength(
  row: Pick<SemanticWireListRow, "fromDeviceId" | "toDeviceId" | "toLocation" | "fromLocation" | "location">,
  sheetName: string,
  externalAllowance: number = EXTERNAL_BRANDING_ALLOWANCE,
): number {
  const fromBase = getDeviceBase(row.fromDeviceId);
  const toBase = getDeviceBase(row.toDeviceId);
  const fromTerminal = row.fromDeviceId?.split(":")?.[1]?.toUpperCase() || "";
  const fromPrefix = getDevicePrefix(row.fromDeviceId);
  const toPrefix = getDevicePrefix(row.toDeviceId);
  const crossLocationAllowance = isExternalBrandingRow(row, sheetName) ? externalAllowance : 0;

  if (fromBase === toBase) {
    return 6 + crossLocationAllowance;
  }

  if (fromPrefix === "KA" && (fromTerminal === "A1" || fromTerminal === "A2")) {
    return 40 + crossLocationAllowance;
  }

  return 40 + crossLocationAllowance;
}

export function buildBaseBrandingLengths(
  rows: SemanticWireListRow[],
  sheetName: string,
): Map<string, number> {
  const map = new Map<string, number>();

  for (const row of rows) {
    map.set(row.__rowId, calculateBrandingLength(row, sheetName));
  }

  return map;
}

export function applyBrandingEdits(
  rows: BrandingRow[],
  edits: SheetBrandingEdits = {},
): BrandingRow[] {
  return rows.flatMap((row) => {
    const edit = edits[row.__rowId] ?? (row.__originalRowId ? edits[row.__originalRowId] : undefined);

    if (edit?.excluded) {
      return [];
    }

    const baseLength = row.brandingLength;
    const overrideLength = edit?.length;
    const lengthAdjustment = edit?.lengthAdjustment ?? 0;
    const nextLength = typeof overrideLength === "number"
      ? overrideLength
      : typeof baseLength === "number"
        ? Math.max(0, baseLength + lengthAdjustment)
        : undefined;
    const hasManualLengthChange = typeof overrideLength === "number" || lengthAdjustment !== 0;

    return [{
      ...row,
      brandingLength: nextLength,
      finalLength: nextLength,
      brandingLengthManual: hasManualLengthChange,
      brandingNotes: edit?.notes,
    }];
  });
}

export function buildBrandingRowsForSheet(options: {
  sheetSlug: string;
  sheetName: string;
  rows: SemanticWireListRow[];
  exclusionConfig?: BrandingExclusionConfig;
  edits?: SheetBrandingEdits;
}): BrandingRow[] {
  const computedBaseLengths = buildBaseBrandingLengths(options.rows, options.sheetName);
  const baseRows = aggregateBrandingRows(
    [{ slug: options.sheetSlug, name: options.sheetName, rows: options.rows }],
    options.exclusionConfig ?? DEFAULT_BRANDING_EXCLUSIONS,
    computedBaseLengths,
  );

  return applyBrandingEdits(baseRows, options.edits ?? {});
}
