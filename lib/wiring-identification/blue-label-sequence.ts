/**
 * Blue Label Sequence Utilities
 * 
 * The Blue Labels sheet provides the authoritative device sequence for each sheet/assignment.
 * This module parses Blue Labels data and provides utilities for checking device adjacency.
 * 
 * Blue Labels structure:
 * - Row 1: Column headers (sheet names like "(SHT 1) CONTROL,JB70")
 * - Rows 2+: Device IDs in sequence order (top to bottom = sequence order)
 */

import type { BlueLabelEntry, BlueLabelSequenceMap } from "./types";
import type { ParsedWorkbookSheet, ParsedSheetRow } from "@/lib/workbook/types";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import { lookupPartNumber, type PartNumberLookupResult } from "@/lib/part-number-list";
import {
  areSameBaseDevice,
  getBaseDeviceId,
  isCableLikeRow,
  isClipLikeRow,
  isGroundColor,
  parseDevicePrefix,
} from "./device-parser";

// ============================================================================
// Blue Labels Parsing
// ============================================================================

/**
 * Normalize a sheet name for matching.
 * Removes sheet number prefix and normalizes spacing.
 */
export function normalizeSheetName(sheetName: string): string {
  return sheetName
    .replace(/^\(SHT\s*\d+\)\s*/i, "")
    .toUpperCase()
    .trim()
    .replace(/\s*,\s*/g, ",")
    .replace(/\s+/g, " ");
}

function toSheetLookupKey(sheetName: string): string {
  return normalizeSheetName(sheetName).replace(/[^A-Z0-9]/g, "");
}

function getResolvedSheetSequence(
  sheetName: string,
  blueLabels: BlueLabelSequenceMap,
): string[] {
  if (!blueLabels.isValid) return [];

  const normalized = normalizeSheetName(sheetName);
  const direct = blueLabels.sheetSequences.get(normalized);
  if (direct) {
    return direct;
  }

  const lookupKey = toSheetLookupKey(sheetName);
  for (const [candidateSheetName, sequence] of blueLabels.sheetSequences.entries()) {
    if (toSheetLookupKey(candidateSheetName) === lookupKey) {
      return sequence;
    }
  }

  return [];
}

/**
 * Parse Blue Labels sheet data into a sequence map.
 * 
 * @param blueLabelsSheet - The parsed Blue Labels sheet
 * @returns Blue Label sequence map
 */
export function parseBlueLabelSheet(
  blueLabelsSheet: ParsedWorkbookSheet | null
): BlueLabelSequenceMap {
  const warnings: string[] = [];
  const deviceMap: Map<string, BlueLabelEntry> = new Map();
  const sheetSequences: Map<string, string[]> = new Map();
  
  if (!blueLabelsSheet) {
    return {
      deviceMap,
      sheetSequences,
      isValid: false,
      warnings: ["Blue Labels sheet not found"],
    };
  }
  
  const { headers, rows } = blueLabelsSheet;
  
  if (headers.length === 0) {
    return {
      deviceMap,
      sheetSequences,
      isValid: false,
      warnings: ["Blue Labels sheet has no headers"],
    };
  }
  
  // Parse each column (each column is a sheet's device sequence)
  for (let colIndex = 0; colIndex < headers.length; colIndex++) {
    const rawSheetName = headers[colIndex] || `Column_${colIndex}`;
    const normalizedSheetName = normalizeSheetName(rawSheetName);
    const sequence: string[] = [];
    
    // Walk through rows to get devices in order
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const row = rows[rowIndex];
      const cell = row[rawSheetName] ?? row[headers[colIndex]];
      
      if (cell === null || cell === undefined || cell === "") {
        continue;
      }
      
      const deviceId = String(cell).trim();
      if (!deviceId) continue;
      
      // Get base device ID (without terminal)
      const baseDeviceId = getBaseDeviceId(deviceId);
      const entry: BlueLabelEntry = {
        deviceId: baseDeviceId,
        sheetName: normalizedSheetName,
        sequenceIndex: sequence.length,
      };
      
      // Add to maps
      deviceMap.set(baseDeviceId, entry);
      sequence.push(baseDeviceId);
    }
    
    if (sequence.length > 0) {
      sheetSequences.set(normalizedSheetName, sequence);
    }
  }
  
  const isValid = deviceMap.size > 0;
  
  if (!isValid) {
    warnings.push("No device sequences found in Blue Labels");
  }
  
  return {
    deviceMap,
    sheetSequences,
    isValid,
    warnings,
  };
}

/**
 * Parse Blue Labels from raw rows (when sheet is available as raw data).
 * 
 * @param rawHeaders - Column headers
 * @param rawRows - Raw row data
 * @returns Blue Label sequence map
 */
export function parseBlueLabelRawData(
  rawHeaders: string[],
  rawRows: ParsedSheetRow[]
): BlueLabelSequenceMap {
  const warnings: string[] = [];
  const deviceMap: Map<string, BlueLabelEntry> = new Map();
  const sheetSequences: Map<string, string[]> = new Map();
  
  if (rawHeaders.length === 0 || rawRows.length === 0) {
    return {
      deviceMap,
      sheetSequences,
      isValid: false,
      warnings: ["Blue Labels data is empty"],
    };
  }
  
  // Parse each column
  for (let colIndex = 0; colIndex < rawHeaders.length; colIndex++) {
    const rawSheetName = rawHeaders[colIndex];
    if (!rawSheetName) continue;
    
    const normalizedSheetName = normalizeSheetName(rawSheetName);
    const sequence: string[] = [];
    
    for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
      const row = rawRows[rowIndex];
      const cell = row[rawSheetName];
      
      if (cell === null || cell === undefined || cell === "") {
        continue;
      }
      
      const deviceId = String(cell).trim();
      if (!deviceId) continue;
      
      const baseDeviceId = getBaseDeviceId(deviceId);
      const entry: BlueLabelEntry = {
        deviceId: baseDeviceId,
        sheetName: normalizedSheetName,
        sequenceIndex: sequence.length,
      };
      
      deviceMap.set(baseDeviceId, entry);
      sequence.push(baseDeviceId);
    }
    
    if (sequence.length > 0) {
      sheetSequences.set(normalizedSheetName, sequence);
    }
  }
  
  return {
    deviceMap,
    sheetSequences,
    isValid: deviceMap.size > 0,
    warnings,
  };
}

// ============================================================================
// Sequence Lookup Utilities
// ============================================================================

/**
 * Check if two devices are adjacent in the Blue Labels sequence.
 * Adjacent means they appear consecutively in the same sheet's sequence.
 * 
 * @param deviceA - First device ID
 * @param deviceB - Second device ID
 * @param blueLabels - Blue Label sequence map
 * @returns True if devices are adjacent in sequence
 */
export function areDevicesAdjacent(
  deviceA: string,
  deviceB: string,
  blueLabels: BlueLabelSequenceMap | null | undefined
): boolean {
  if (!blueLabels?.isValid) return false;
  
  const baseA = getBaseDeviceId(deviceA);
  const baseB = getBaseDeviceId(deviceB);
  
  const entryA = blueLabels.deviceMap.get(baseA);
  const entryB = blueLabels.deviceMap.get(baseB);
  
  // Both devices must be in the map
  if (!entryA || !entryB) return false;
  
  // Must be on the same sheet
  if (entryA.sheetName !== entryB.sheetName) return false;
  
  // Check if they are adjacent (differ by 1 in sequence)
  const diff = Math.abs(entryA.sequenceIndex - entryB.sequenceIndex);
  return diff === 1;
}

export function areDevicesAdjacentInSheet(
  deviceA: string,
  deviceB: string,
  sheetName: string,
  blueLabels: BlueLabelSequenceMap | null | undefined,
): boolean {
  if (!blueLabels?.isValid) return false;

  const sequence = getResolvedSheetSequence(sheetName, blueLabels);
  if (sequence.length === 0) return false;

  const baseA = getBaseDeviceId(deviceA);
  const baseB = getBaseDeviceId(deviceB);
  const indexA = sequence.indexOf(baseA);
  const indexB = sequence.indexOf(baseB);

  if (indexA === -1 || indexB === -1) return false;

  return Math.abs(indexA - indexB) === 1;
}

/**
 * Check if two devices are sequential (A comes before B).
 * 
 * @param deviceA - First device ID (should come before)
 * @param deviceB - Second device ID (should come after)
 * @param blueLabels - Blue Label sequence map
 * @returns True if A comes immediately before B in sequence
 */
export function areDevicesSequential(
  deviceA: string,
  deviceB: string,
  blueLabels: BlueLabelSequenceMap | null | undefined
): boolean {
  if (!blueLabels?.isValid) return false;
  
  const baseA = getBaseDeviceId(deviceA);
  const baseB = getBaseDeviceId(deviceB);
  
  const entryA = blueLabels.deviceMap.get(baseA);
  const entryB = blueLabels.deviceMap.get(baseB);
  
  if (!entryA || !entryB) return false;
  if (entryA.sheetName !== entryB.sheetName) return false;
  
  // A should come immediately before B
  return entryB.sequenceIndex === entryA.sequenceIndex + 1;
}

/**
 * Get the sequence index of a device.
 * 
 * @param deviceId - The device ID
 * @param blueLabels - Blue Label sequence map
 * @returns Sequence index or null if not found
 */
export function getDeviceSequenceIndex(
  deviceId: string,
  blueLabels: BlueLabelSequenceMap | null | undefined
): number | null {
  if (!blueLabels?.isValid) return null;
  
  const baseId = getBaseDeviceId(deviceId);
  const entry = blueLabels.deviceMap.get(baseId);
  
  return entry ? entry.sequenceIndex : null;
}

export function getDeviceSequenceIndexInSheet(
  deviceId: string,
  sheetName: string,
  blueLabels: BlueLabelSequenceMap | null | undefined,
): number | null {
  if (!blueLabels?.isValid) return null;

  const sequence = getResolvedSheetSequence(sheetName, blueLabels);
  if (sequence.length === 0) return null;

  const baseId = getBaseDeviceId(deviceId);
  const index = sequence.indexOf(baseId);
  return index === -1 ? null : index;
}

/**
 * Get all devices in a sheet's sequence.
 * 
 * @param sheetName - The sheet name (will be normalized)
 * @param blueLabels - Blue Label sequence map
 * @returns Array of device IDs in sequence order
 */
export function getSheetDeviceSequence(
  sheetName: string,
  blueLabels: BlueLabelSequenceMap | null | undefined
): string[] {
  if (!blueLabels?.isValid) return [];
  return getResolvedSheetSequence(sheetName, blueLabels);
}

/**
 * Check if Blue Labels data is available.
 * 
 * @param blueLabels - Blue Label sequence map or null/undefined
 * @returns True if Blue Labels is available and valid
 */
export function hasBlueLabelData(blueLabels: BlueLabelSequenceMap | null | undefined): boolean {
  return blueLabels != null && blueLabels.isValid;
}

export type BlueLabelSequenceMatrixIdentifierType =
  | "string"
  | "ground"
  | "clip"
  | "cable"
  | "jumper"
  | "resistor"
  | "terminal"
  | "relay"
  | "device"
  | "unknown"
  | (string & {});

export interface BlueLabelSequenceMatrixEntry {
  sequenceIndex: number;
  deviceId: string;
  partNumber: string;
  sheetName: string;
  type: BlueLabelSequenceMatrixIdentifierType;
  location: string;
}

export interface BuildBlueLabelSequenceMatrixOptions {
  rowsBySheet?: Map<string, SemanticWireListRow[]>;
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  fallbackLocation?: string;
}

export interface ReferenceSheetFilterOptions {
  additionalReferenceSheetNames?: string[];
  additionalReferenceSheetPatterns?: RegExp[];
}

export interface BuildRowsByNormalizedSheetNameOptions
  extends ReferenceSheetFilterOptions {
  excludeReferenceSheets?: boolean;
}

const DEFAULT_REFERENCE_SHEET_NAMES = new Set([
  "BLUE LABELS",
  "WHITE LABELS",
  "PART NUMBER LIST",
  "PANEL ERRORS",
]);

const DEFAULT_REFERENCE_SHEET_PATTERNS: RegExp[] = [
  /\b(?:BLUE|WHITE|YELLOW|RED|GREEN|ORANGE|PURPLE|BLACK|BROWN|GRAY|GREY)\s+LABELS?\b/i,
  /\bPART\s+NUMBER\s+LIST\b/i,
  /\bPANEL\s+ERRORS?\b/i,
];

function normalizeSheetNameForReferenceCheck(sheetName: string): string {
  return sheetName.trim().toUpperCase().replace(/\s+/g, " ");
}

export function isReferenceSheetName(
  sheetName: string,
  options: ReferenceSheetFilterOptions = {},
): boolean {
  const normalizedName = normalizeSheetNameForReferenceCheck(sheetName);

  if (DEFAULT_REFERENCE_SHEET_NAMES.has(normalizedName)) {
    return true;
  }

  const additionalNames = options.additionalReferenceSheetNames ?? [];
  if (
    additionalNames
      .map((name) => normalizeSheetNameForReferenceCheck(name))
      .includes(normalizedName)
  ) {
    return true;
  }

  for (const pattern of DEFAULT_REFERENCE_SHEET_PATTERNS) {
    if (pattern.test(sheetName)) {
      return true;
    }
  }

  for (const pattern of options.additionalReferenceSheetPatterns ?? []) {
    if (pattern.test(sheetName)) {
      return true;
    }
  }

  return false;
}

export function filterOperationalWorkbookSheets(
  sheets: Array<Pick<ParsedWorkbookSheet, "originalName" | "semanticRows">>,
  options: ReferenceSheetFilterOptions = {},
): Array<Pick<ParsedWorkbookSheet, "originalName" | "semanticRows">> {
  return sheets.filter((sheet) => !isReferenceSheetName(sheet.originalName, options));
}

export function buildRowsByNormalizedSheetName(
  sheets: Array<Pick<ParsedWorkbookSheet, "originalName" | "semanticRows">>,
  options: BuildRowsByNormalizedSheetNameOptions = {},
): Map<string, SemanticWireListRow[]> {
  const {
    excludeReferenceSheets = true,
    additionalReferenceSheetNames,
    additionalReferenceSheetPatterns,
  } = options;

  const sourceSheets = excludeReferenceSheets
    ? filterOperationalWorkbookSheets(sheets, {
        additionalReferenceSheetNames,
        additionalReferenceSheetPatterns,
      })
    : sheets;

  const result = new Map<string, SemanticWireListRow[]>();

  for (const sheet of sourceSheets) {
    const key = normalizeSheetName(sheet.originalName);
    const rows = sheet.semanticRows ?? [];
    if (rows.length === 0) {
      continue;
    }

    const existing = result.get(key);
    if (existing) {
      existing.push(...rows);
      continue;
    }

    result.set(key, [...rows]);
  }

  return result;
}

function normalizeLocationValue(value: string | undefined): string {
  const normalized = (value ?? "").trim();
  if (!normalized || normalized === "-") {
    return "";
  }
  return normalized;
}

function getRowsForDeviceInSheet(
  deviceId: string,
  sheetRows: SemanticWireListRow[],
): SemanticWireListRow[] {
  const baseDeviceId = getBaseDeviceId(deviceId).toUpperCase();
  return sheetRows.filter((row) => {
    const fromBase = getBaseDeviceId(row.fromDeviceId || "").toUpperCase();
    const toBase = getBaseDeviceId(row.toDeviceId || "").toUpperCase();
    return fromBase === baseDeviceId || toBase === baseDeviceId;
  });
}

export function resolveBlueLabelMatrixLocation(
  candidateRows: SemanticWireListRow[],
  fallbackLocation: string,
): string {
  for (const row of candidateRows) {
    const fromLocation = normalizeLocationValue(row.fromLocation);
    const toLocation = normalizeLocationValue(row.toLocation);
    const rowLocation = normalizeLocationValue(row.location);

    // Preserve legacy behavior first: location column is authoritative.
    if (rowLocation) return rowLocation;
    if (fromLocation) return fromLocation;
    if (toLocation) return toLocation;
  }

  return fallbackLocation;
}

export function resolveBlueLabelMatrixIdentifierType(
  deviceId: string,
  candidateRows: SemanticWireListRow[],
): BlueLabelSequenceMatrixIdentifierType {
  if (candidateRows.length > 0) {
    if (candidateRows.some((row) => isGroundColor(row.wireId))) {
      return "ground";
    }

    if (candidateRows.some((row) => isClipLikeRow(row))) {
      return "clip";
    }

    if (
      candidateRows.some(
        (row) => (row.wireId || "").trim().toUpperCase() === "LEAD",
      )
    ) {
      return "resistor";
    }

    if (candidateRows.some((row) => isCableLikeRow(row))) {
      return "cable";
    }

    if (
      candidateRows.some((row) =>
        areSameBaseDevice(row.fromDeviceId || "", row.toDeviceId || ""),
      )
    ) {
      return "jumper";
    }
  }

  const prefix = parseDevicePrefix(deviceId).toUpperCase();
  if (prefix === "XT") return "terminal";
  if (prefix === "KA") return "relay";
  if (!prefix) return "unknown";

  return "device";
}

export function resolveBlueLabelMatrixPartNumber(
  deviceId: string,
  partNumberMap: Map<string, PartNumberLookupResult> | null | undefined,
): string {
  if (!partNumberMap || partNumberMap.size === 0) {
    return "";
  }

  return lookupPartNumber(partNumberMap, deviceId)?.partNumber ?? "";
}

export function buildBlueLabelSequenceMatrix(
  blueLabels: BlueLabelSequenceMap | null | undefined,
  options: BuildBlueLabelSequenceMatrixOptions = {},
): BlueLabelSequenceMatrixEntry[] {
  if (!blueLabels?.isValid) {
    return [];
  }

  const rowsBySheet = options.rowsBySheet ?? new Map<string, SemanticWireListRow[]>();
  const partNumberMap = options.partNumberMap ?? null;
  const entries: BlueLabelSequenceMatrixEntry[] = [];

  for (const [sheetName, sequence] of blueLabels.sheetSequences.entries()) {
    const normalizedSheetName = normalizeSheetName(sheetName);
    const sheetRows = rowsBySheet.get(normalizedSheetName) ?? [];
    const fallbackLocation = options.fallbackLocation || sheetName;

    sequence.forEach((deviceId, sequenceIndex) => {
      const candidateRows = getRowsForDeviceInSheet(deviceId, sheetRows);

      entries.push({
        sequenceIndex,
        deviceId,
        partNumber: resolveBlueLabelMatrixPartNumber(deviceId, partNumberMap),
        sheetName,
        type: resolveBlueLabelMatrixIdentifierType(deviceId, candidateRows),
        location: resolveBlueLabelMatrixLocation(candidateRows, fallbackLocation),
      });
    });
  }

  return entries;
}