import * as XLSX from "xlsx";

import type { ImportedBrandListRow, ImportedBrandSheetData, ImportedBrandSheetMetadata } from "@/lib/wire-brand-list/multi-sheet-review";
import { buildBrandImportMatchKey } from "@/lib/wire-brand-list/multi-sheet-review";
import { normalizeSheetName } from "@/lib/workbook/normalize-sheet-name";

const BRANDLIST_METADATA_SHEET = "__BRANDLIST_META__";
const IGNORED_IMPORTED_SHEET_SLUGS = new Set([
  "all",
  "panel-errors",
  "bundle-tag-info",
  "bundle-tags",
  "bundle-tags2",
  normalizeSheetName(BRANDLIST_METADATA_SHEET),
]);

interface WorkbookSheetMetadata extends ImportedBrandSheetMetadata {
  sheetName: string;
}

export async function parseImportedBrandWorkbook(file: File): Promise<ImportedBrandSheetData[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array", raw: false, dense: true });
  const metadataLookup = readWorkbookMetadata(workbook);
  const importedSheets: ImportedBrandSheetData[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheetSlug = normalizeSheetName(sheetName);
    if (IGNORED_IMPORTED_SHEET_SLUGS.has(sheetSlug)) {
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) {
      continue;
    }

    const rawRows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(worksheet, {
      header: 1,
      defval: null,
      blankrows: true,
    });

    const parsedSheet = buildImportedBrandSheet(sheetName, rawRows, metadataLookup.get(sheetName) ?? metadataLookup.get(sheetSlug));
    if (parsedSheet) {
      importedSheets.push(parsedSheet);
    }
  }

  return importedSheets;
}

function buildImportedBrandSheet(
  sourceSheetName: string,
  rawRows: Array<Array<string | number | boolean | Date | null>>,
  metadata?: WorkbookSheetMetadata,
): ImportedBrandSheetData | null {
  const headerRowIndex = rawRows.findIndex(isBrandSheetHeaderRow);
  if (headerRowIndex < 0) {
    return null;
  }

  const rows: ImportedBrandListRow[] = [];
  let currentBundleName = "";
  let currentBundleDisplay = "";

  for (let index = headerRowIndex + 1; index < rawRows.length; index += 1) {
    const rawRow = rawRows[index] ?? [];
    const cells = rawRow.map(toCellString);
    const nonEmptyCount = cells.filter(Boolean).length;

    if (nonEmptyCount === 0) {
      currentBundleName = "";
      currentBundleDisplay = "";
      continue;
    }

    if (looksLikePrefixHeader(cells)) {
      continue;
    }

    const fromDeviceId = cells[0];
    const wireNo = cells[1];
    const wireId = cells[2];
    const gaugeSize = cells[3];
    const length = parseLengthValue(rawRow[4]);
    const toDeviceId = cells[5];
    const toLocation = cells[6];
    const bundleDisplay = cells[7];

    if (!fromDeviceId && !toDeviceId && !toLocation) {
      continue;
    }

    if (bundleDisplay) {
      currentBundleDisplay = bundleDisplay;
      currentBundleName = deriveBundleName(bundleDisplay, toLocation);
    }

    const effectiveBundleName = currentBundleName || deriveBundleName("", toLocation, fromDeviceId);
    const effectiveBundleDisplay = bundleDisplay || currentBundleDisplay || effectiveBundleName;

    rows.push({
      importedRowId: `${normalizeSheetName(sourceSheetName)}-${index}`,
      rowIndex: index,
      matchKey: buildBrandImportMatchKey({
        fromDeviceId,
        wireNo,
        wireId,
        gaugeSize,
        toDeviceId,
        toLocation,
      }),
      fromDeviceId,
      wireNo,
      wireId,
      gaugeSize,
      length,
      toDeviceId,
      toLocation,
      devicePrefix: deriveDevicePrefix(fromDeviceId),
      bundleName: effectiveBundleName,
      bundleDisplay: effectiveBundleDisplay,
    });
  }

  if (!rows.length) {
    return null;
  }

  const bundleNames = Array.from(new Set(rows.map((row) => row.bundleName).filter(Boolean)));

  return {
    sheetSlug: metadata?.sourceSheetSlug || normalizeSheetName(sourceSheetName),
    sheetName: metadata?.sheetName || sourceSheetName,
    sourceSheetName,
    metadata: {
      sourceSheetSlug: metadata?.sourceSheetSlug || null,
      sourceSchemaHash: metadata?.sourceSchemaHash || null,
      normalizedSheetName: metadata?.normalizedSheetName || normalizeSheetName(sourceSheetName),
      bundleNames,
    },
    rows,
  };
}

function readWorkbookMetadata(workbook: XLSX.WorkBook) {
  const lookup = new Map<string, WorkbookSheetMetadata>();
  const worksheet = workbook.Sheets[BRANDLIST_METADATA_SHEET];
  if (!worksheet) {
    return lookup;
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(worksheet, {
    header: 1,
    defval: null,
    blankrows: false,
  });

  for (const row of rows.slice(1)) {
    const sheetName = toCellString(row?.[0]);
    const sourceSheetSlug = toCellString(row?.[1]);
    const sourceSchemaHash = toCellString(row?.[2]);
    const normalizedSheetName = toCellString(row?.[3]);
    const bundleNames = toCellString(row?.[4])
      .split("||")
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (!sheetName) {
      continue;
    }

    const metadata: WorkbookSheetMetadata = {
      sheetName,
      sourceSheetSlug: sourceSheetSlug || null,
      sourceSchemaHash: sourceSchemaHash || null,
      normalizedSheetName: normalizedSheetName || normalizeSheetName(sheetName),
      bundleNames,
    };

    lookup.set(sheetName, metadata);
    lookup.set(normalizeSheetName(sheetName), metadata);
    if (sourceSheetSlug) {
      lookup.set(sourceSheetSlug, metadata);
    }
  }

  return lookup;
}

function isBrandSheetHeaderRow(row: Array<string | number | boolean | Date | null>) {
  const normalized = row.map((cell) => toCellString(cell).toUpperCase());
  return normalized[0] === "DEVICE ID"
    && normalized[1] === "WIRE NO."
    && normalized[2] === "WIRE ID"
    && normalized[3] === "GAUGE/SIZE"
    && normalized[4] === "LENGTH"
    && normalized[5] === "DEVICE ID"
    && (normalized[6] === "LOCATION" || normalized[6] === "TO LOCATION")
    && normalized[7] === "BUNDLE NAME";
}

function looksLikePrefixHeader(cells: string[]) {
  const first = cells[0];
  const remainder = cells.slice(1).filter(Boolean);
  return Boolean(first) && remainder.length === 0 && first.length <= 8 && /^[A-Z0-9/ -]+$/i.test(first);
}

function deriveBundleName(bundleDisplay: string, toLocation: string, fromDeviceId?: string) {
  const normalizedDisplay = bundleDisplay.trim();
  if (normalizedDisplay) {
    const locationSuffix = toLocation.trim();
    if (locationSuffix) {
      const suffixPattern = new RegExp(`\\s*-\\s*${escapeRegExp(locationSuffix)}$`, "i");
      return normalizedDisplay.replace(suffixPattern, "").trim() || normalizedDisplay;
    }
    return normalizedDisplay;
  }

  return deriveDevicePrefix(fromDeviceId ?? "");
}

function deriveDevicePrefix(deviceId: string) {
  const baseDeviceId = deviceId.split(":")[0]?.trim() ?? "";
  const match = baseDeviceId.match(/^([A-Za-z]+[0-9]+)/);
  if (match) {
    return match[1].toUpperCase();
  }
  const alphaMatch = baseDeviceId.match(/^([A-Za-z]+)/);
  return alphaMatch ? alphaMatch[1].toUpperCase() : baseDeviceId.toUpperCase() || "UNKNOWN";
}

function parseLengthValue(value: string | number | boolean | Date | null | undefined) {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isNaN(numeric) ? null : numeric;
  }
  return null;
}

function toCellString(value: string | number | boolean | Date | null | undefined) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    return String(value).trim();
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
