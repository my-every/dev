/**
 * Device ID Parsing Utilities
 * 
 * This module provides robust parsing of device IDs into their components:
 * - Prefix (device family: AF, XT, KA, etc.)
 * - Numeric portion (device number)
 * - Terminal (connection point)
 */

import type { ParsedDeviceId, EnrichedSemanticRow } from "./types";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import { 
  GROUND_COLORS, 
  normalizeWireIdForGroundCheck, 
  NON_NUMERIC_GAUGE_VALUES,
  CLIP_WIRE_IDS,
  JUMPER_CLIP_TYPES,
  isCableWireNumber,
  isCableGauge,
  isCableDevicePrefix,
} from "./constants";

// ============================================================================
// Device ID Parsing
// ============================================================================

/**
 * Regular expression for parsing device IDs.
 * Matches patterns like:
 * - AF0500:12
 * - XT0170:1
 * - KA0461:A1
 * - AT0190:GND
 * - XTFGA (no terminal)
 * - GR0170 (no terminal)
 */
const DEVICE_ID_PATTERN = /^([A-Z]+)(\d+)?(?::(.+))?$/i;

/**
 * Parse a device ID into its components.
 * 
 * @param deviceId - The full device ID (e.g., "AF0500:12", "KA0461:A1")
 * @returns Parsed device ID components
 */
export function parseDeviceId(deviceId: string): ParsedDeviceId {
  const trimmed = (deviceId || "").trim();
  
  if (!trimmed) {
    return {
      original: "",
      prefix: "",
      deviceNumeric: null,
      terminal: "",
      terminalNumeric: null,
      isValid: false,
    };
  }
  
  const match = trimmed.match(DEVICE_ID_PATTERN);
  
  if (!match) {
    // Try to extract what we can
    const prefixMatch = trimmed.match(/^([A-Z]+)/i);
    return {
      original: trimmed,
      prefix: prefixMatch ? prefixMatch[1].toUpperCase() : "",
      deviceNumeric: null,
      terminal: "",
      terminalNumeric: null,
      isValid: false,
    };
  }
  
  const [, prefix, numericPart, terminal] = match;
  
  // Parse terminal numeric value
  let terminalNumeric: number | null = null;
  if (terminal) {
    const termNum = parseInt(terminal, 10);
    if (!isNaN(termNum)) {
      terminalNumeric = termNum;
    }
  }
  
  return {
    original: trimmed,
    prefix: prefix.toUpperCase(),
    deviceNumeric: numericPart ? parseInt(numericPart, 10) : null,
    terminal: terminal || "",
    terminalNumeric,
    isValid: true,
  };
}

/**
 * Extract just the device prefix from a device ID.
 * 
 * @param deviceId - The device ID
 * @returns The prefix (e.g., "AF", "XT", "KA")
 */
export function parseDevicePrefix(deviceId: string): string {
  const parsed = parseDeviceId(deviceId);
  return parsed.prefix;
}

/**
 * Extract just the terminal from a device ID.
 * 
 * @param deviceId - The device ID
 * @returns The terminal (e.g., "12", "A1", "GND")
 */
export function parseTerminal(deviceId: string): string {
  const parsed = parseDeviceId(deviceId);
  return parsed.terminal;
}

/**
 * Extract the numeric device number from a device ID.
 * 
 * @param deviceId - The device ID
 * @returns The numeric portion, or null if not found
 */
export function parseDeviceNumeric(deviceId: string): number | null {
  const parsed = parseDeviceId(deviceId);
  return parsed.deviceNumeric;
}

/**
 * Get the base device ID without terminal.
 * 
 * @param deviceId - The full device ID
 * @returns Device ID without terminal (e.g., "AF0500" from "AF0500:12")
 */
export function getBaseDeviceId(deviceId: string): string {
  const colonIndex = deviceId.indexOf(":");
  if (colonIndex === -1) return deviceId;
  return deviceId.substring(0, colonIndex);
}

/**
 * Check if two device IDs have the same base (prefix + numeric).
 * 
 * @param deviceIdA - First device ID
 * @param deviceIdB - Second device ID
 * @returns True if both have the same base device
 */
export function areSameBaseDevice(deviceIdA: string, deviceIdB: string): boolean {
  const baseA = getBaseDeviceId(deviceIdA).toUpperCase();
  const baseB = getBaseDeviceId(deviceIdB).toUpperCase();
  return baseA === baseB;
}

/**
 * Check if two numeric terminals are incremental (differ by exactly 1).
 * 
 * @param terminalA - First terminal
 * @param terminalB - Second terminal
 * @returns True if terminals differ by exactly 1
 */
export function areIncrementalNumericTerminals(terminalA: string, terminalB: string): boolean {
  const numA = parseInt(terminalA, 10);
  const numB = parseInt(terminalB, 10);
  
  if (isNaN(numA) || isNaN(numB)) return false;
  
  return Math.abs(numA - numB) === 1;
}

// ============================================================================
// Sequence Detection
// ============================================================================

/**
 * Check if two device IDs are incrementally sequential.
 * Sequential means same prefix and numeric differs by 1.
 * 
 * @param deviceA - First device ID
 * @param deviceB - Second device ID
 * @returns True if devices are sequential
 */
export function isIncrementalDeviceSequence(deviceA: string, deviceB: string): boolean {
  const parsedA = parseDeviceId(deviceA);
  const parsedB = parseDeviceId(deviceB);
  
  // Must have same prefix
  if (parsedA.prefix !== parsedB.prefix) return false;
  
  // Both must have valid numeric portions
  if (parsedA.deviceNumeric === null || parsedB.deviceNumeric === null) return false;
  
  // Check if they differ by 1
  const diff = Math.abs(parsedA.deviceNumeric - parsedB.deviceNumeric);
  return diff === 1;
}

/**
 * Check if two terminals are incrementally sequential.
 * 
 * @param terminalA - First terminal
 * @param terminalB - Second terminal
 * @returns True if terminals are sequential (differ by 1)
 */
export function isIncrementalTerminalSequence(terminalA: string, terminalB: string): boolean {
  const numA = parseInt(terminalA, 10);
  const numB = parseInt(terminalB, 10);
  
  if (isNaN(numA) || isNaN(numB)) return false;
  
  const diff = Math.abs(numA - numB);
  return diff === 1;
}

/**
 * Check if terminals match exactly.
 * 
 * @param terminalA - First terminal
 * @param terminalB - Second terminal
 * @returns True if terminals are identical (case-insensitive)
 */
export function terminalsMatch(terminalA: string, terminalB: string): boolean {
  return terminalA.toUpperCase().trim() === terminalB.toUpperCase().trim();
}

// ============================================================================
// Cable and Clip Detection
// ============================================================================

/**
 * Check if a row represents a cable connection (not a jumper).
 * Cable rows should be excluded from all jumper filters.
 * 
 * @param row - The semantic row to check
 * @returns True if this is a cable-like row
 */
export function isCableLikeRow(row: SemanticWireListRow): boolean {
  const wireIdNormalized = (row.wireId || "").trim().toUpperCase();

  if (wireIdNormalized === "CABLE") return true;

  // Check wire number for cable pattern (WC1242, WC8066, etc.)
  if (isCableWireNumber(row.wireNo)) return true;
  
  // Check gauge for cable value
  if (isCableGauge(row.gaugeSize)) return true;
  
  // Check device prefixes for cable
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);
  
  if (isCableDevicePrefix(fromParsed.prefix)) return true;
  if (isCableDevicePrefix(toParsed.prefix)) return true;
  
  return false;
}

/**
 * Check if a row represents a clip connection.
 * Clip rows should be shown in Clips filter but excluded from Jumpers filter.
 * 
 * @param row - The semantic row to check
 * @returns True if this is a clip-like row
 */
export function isClipLikeRow(row: SemanticWireListRow): boolean {
  // Check wire ID for CLIP
  const wireIdNormalized = (row.wireId || "").trim().toUpperCase();
  if (CLIP_WIRE_IDS.has(wireIdNormalized)) return true;
  
  // Check wire type for JC (Jumper Clip)
  const wireTypeNormalized = (row.wireType || "").trim().toUpperCase();
  if (JUMPER_CLIP_TYPES.has(wireTypeNormalized)) return true;
  
  return false;
}

/**
 * Check if a row is in the same location context.
 * For jumper detection, both endpoints should be in the same effective location.
 * 
 * @param row - The semantic row
 * @param currentSheetName - Current sheet name (optional, for additional context)
 * @returns True if the row represents a same-location connection
 */
export function isSameLocationContext(row: SemanticWireListRow, currentSheetName?: string): boolean {
  // The row has a single 'location' field representing the destination.
  // For jumpers within the same location, the row should exist on a sheet
  // that matches or is related to that location.
  
  // If location is empty, assume same location (internal wiring)
  if (!row.location || row.location.trim() === "" || row.location.trim() === "-") {
    return true;
  }
  
  // If we have a current sheet name, check if location matches
  if (currentSheetName) {
    return isInternalLocation(row.location, currentSheetName);
  }
  
  // Without sheet context, accept the row
  return true;
}

// ============================================================================
// Row Enrichment
// ============================================================================

/**
 * Parse gauge value to numeric.
 * 
 * @param gaugeSize - The gauge/size string
 * @returns Numeric gauge value or null
 */
export function parseGaugeNumeric(gaugeSize: string): number | null {
  const trimmed = (gaugeSize || "").trim();
  
  if (NON_NUMERIC_GAUGE_VALUES.has(trimmed.toUpperCase())) {
    return null;
  }
  
  const num = parseFloat(trimmed);
  return isNaN(num) ? null : num;
}

/**
 * Check if a wire ID indicates a ground wire.
 * 
 * @param wireId - The wire ID / color code
 * @returns True if this is a ground color
 */
export function isGroundColor(wireId: string): boolean {
  const normalized = normalizeWireIdForGroundCheck(wireId);
  return GROUND_COLORS.has(normalized);
}

/**
 * Check if a location matches the current sheet (internal).
 * 
 * @param location - The destination location
 * @param currentSheetName - The current sheet name
 * @returns True if the location is internal
 */
export function isInternalLocation(location: string, currentSheetName: string): boolean {
  if (!location || !currentSheetName) return false;
  
  // Normalize both for comparison
  const normalizedLocation = location.toUpperCase().trim().replace(/\s+/g, " ");
  const normalizedSheet = currentSheetName.toUpperCase().trim().replace(/\s+/g, " ");
  
  // Check for exact match or if one contains the other
  if (normalizedLocation === normalizedSheet) return true;
  if (normalizedLocation.includes(normalizedSheet)) return true;
  if (normalizedSheet.includes(normalizedLocation)) return true;
  
  // Try matching without sheet number prefix like "(SHT 10)"
  const locationWithoutPrefix = normalizedLocation.replace(/^\(SHT\s*\d+\)\s*/i, "");
  const sheetWithoutPrefix = normalizedSheet.replace(/^\(SHT\s*\d+\)\s*/i, "");
  
  return locationWithoutPrefix === sheetWithoutPrefix;
}

/**
 * Enrich a semantic row with parsed device info.
 * 
 * @param row - The semantic row
 * @param currentSheetName - The current sheet name
 * @returns Enriched row with parsed device info
 */
export function enrichSemanticRow(
  row: SemanticWireListRow,
  currentSheetName: string
): EnrichedSemanticRow {
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);
  const wireIdNormalized = (row.wireId || "").toUpperCase().trim();
  const gaugeNumeric = parseGaugeNumeric(row.gaugeSize);
  const isGroundCandidate = isGroundColor(row.wireId);
  const isInternal = isInternalLocation(row.location, currentSheetName);
  
  return {
    ...row,
    fromParsed,
    toParsed,
    wireIdNormalized,
    gaugeNumeric,
    isGroundCandidate,
    isInternal,
    isExternal: !isInternal,
  };
}

/**
 * Enrich all rows in a list.
 * 
 * @param rows - Array of semantic rows
 * @param currentSheetName - The current sheet name
 * @returns Array of enriched rows
 */
export function enrichAllRows(
  rows: SemanticWireListRow[],
  currentSheetName: string
): EnrichedSemanticRow[] {
  return rows.map(row => enrichSemanticRow(row, currentSheetName));
}

// ============================================================================
// AF-Family Identity Jumper Utilities
// ============================================================================

/**
 * Set of prefixes that belong to the AF (Analog Field) device family.
 * These devices can form identity jumpers between each other.
 */
const AF_FAMILY_PREFIXES = new Set(["AF", "AU"]);

/**
 * Set of valid identity terminations for AF-family jumpers.
 * Only these terminal types qualify for identity jumper matching.
 */
const AF_FAMILY_IDENTITY_TERMINATIONS = new Set(["COM", "SH", "V+"]);

/**
 * Check if a device prefix belongs to the AF device family.
 * AF-family includes AF and AU devices.
 * 
 * @param prefix - The device prefix (e.g., "AF", "AU", "XT")
 * @returns True if the prefix is an AF-family device
 */
export function isAfFamilyPrefix(prefix: string): boolean {
  return AF_FAMILY_PREFIXES.has(prefix.toUpperCase().trim());
}

/**
 * Normalize an AF-family terminal to its identity form.
 * Only recognized identity terminations are normalized; others return null.
 * 
 * @param terminal - The terminal string (e.g., "COM", "V+", "SH")
 * @returns Normalized termination identity or null if not a valid identity terminal
 */
export function normalizeAfFamilyTerminationIdentity(terminal: string): string | null {
  const normalized = terminal.toUpperCase().trim();
  
  if (AF_FAMILY_IDENTITY_TERMINATIONS.has(normalized)) {
    return normalized;
  }
  
  return null;
}

/**
 * Check if two terminals represent the same AF-family identity termination.
 * Both terminals must be valid identity terminations and match exactly.
 * 
 * @param fromTerminal - The from device terminal
 * @param toTerminal - The to device terminal  
 * @returns True if both terminals are the same valid identity termination
 */
export function areSameAfFamilyIdentityTermination(
  fromTerminal: string, 
  toTerminal: string
): boolean {
  const normalizedFrom = normalizeAfFamilyTerminationIdentity(fromTerminal);
  const normalizedTo = normalizeAfFamilyTerminationIdentity(toTerminal);
  
  // Both must be valid identity terminations
  if (normalizedFrom === null || normalizedTo === null) {
    return false;
  }
  
  // They must match
  return normalizedFrom === normalizedTo;
}

/**
 * Check if two devices are AF-family compatible for identity jumper detection.
 * Valid combinations:
 * - AF ↔ AF
 * - AU ↔ AF
 * - AF ↔ AU
 * - AU ↔ AU
 * 
 * @param prefixA - First device prefix
 * @param prefixB - Second device prefix
 * @returns True if both devices are AF-family compatible
 */
export function areAfFamilyCompatible(prefixA: string, prefixB: string): boolean {
  return isAfFamilyPrefix(prefixA) && isAfFamilyPrefix(prefixB);
}
