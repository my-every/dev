/**
 * Wiring Domain - Canonical Utility Functions
 * 
 * Pure functions for parsing and manipulating wiring identifiers.
 * These utilities have no UI dependencies and can be used anywhere.
 * 
 * Re-exports from specialized modules for a unified API.
 */

// Re-export device parsing utilities
export {
  parseDeviceId,
  parseDevicePrefix,
  parseTerminal,
  parseDeviceNumeric,
  getBaseDeviceId,
  areSameBaseDevice,
  areIncrementalNumericTerminals,
  isIncrementalDeviceSequence,
  isIncrementalTerminalSequence,
  terminalsMatch,
  isCableLikeRow,
  isClipLikeRow,
  isSameLocationContext,
  parseGaugeNumeric,
  isGroundColor,
  isInternalLocation,
  enrichSemanticRow,
  enrichAllRows,
  isAfFamilyPrefix,
  normalizeAfFamilyTerminationIdentity,
  areSameAfFamilyIdentityTermination,
  areAfFamilyCompatible,
} from "@/lib/wiring-identification/device-parser";

// ============================================================================
// Additional Domain Utilities
// ============================================================================

/**
 * Known device family prefixes and their descriptions.
 */
export const DEVICE_FAMILIES: Record<string, string> = {
  AF: "Analog Field Device",
  AU: "Analog Utility Device",
  AT: "Analog Transmitter",
  XT: "Terminal Block",
  KA: "Relay",
  KT: "Timer Relay",
  GR: "Ground Reference",
  FU: "Fuse",
  TB: "Terminal Block",
  UA: "Utility Analog",
  UJA: "Utility Junction Analog",
  PB: "Pushbutton",
  HL: "Indicating Light",
  SS: "Selector Switch",
  CB: "Circuit Breaker",
  CR: "Control Relay",
};

/**
 * Extract the device family from a prefix.
 * 
 * @param prefix - The device prefix (e.g., "AF", "XT")
 * @returns Device family description or "Unknown"
 */
export function extractDeviceFamily(prefix: string): string {
  const normalized = prefix.toUpperCase().trim();
  return DEVICE_FAMILIES[normalized] || "Unknown Device";
}

/**
 * Normalize a device ID to a canonical form.
 * - Uppercase all letters
 * - Trim whitespace
 * - Normalize terminal separator
 * 
 * @param deviceId - The device ID to normalize
 * @returns Normalized device ID
 */
export function normalizeDeviceId(deviceId: string): string {
  if (!deviceId) return "";
  
  // Uppercase and trim
  let normalized = deviceId.toUpperCase().trim();
  
  // Normalize terminal separators (accept both : and -)
  normalized = normalized.replace(/-(?=\d+$|[A-Z]+\d*$)/, ":");
  
  return normalized;
}

/**
 * Format a device ID for display without changing its stored identity.
 *
 * Some workbook rows contain a trailing colon with no terminal value
 * (for example "GR0181:"). The UI should display the base device only.
 */
export function formatDeviceIdForDisplay(deviceId: string): string {
  if (!deviceId) return "";

  return deviceId.trim().replace(/:\s*$/, "");
}

/**
 * Extract terminal ID from a device ID.
 * 
 * @param deviceId - Full device ID (e.g., "AF0500:12")
 * @returns Terminal ID (e.g., "12") or empty string
 */
export function parseTerminalId(deviceId: string): string {
  const colonIndex = deviceId.indexOf(":");
  if (colonIndex === -1) return "";
  return deviceId.substring(colonIndex + 1).trim();
}

/**
 * Check if a wire number follows the cable pattern.
 * Cable wire numbers typically start with "WC" followed by digits.
 * 
 * @param wireNo - The wire number
 * @returns True if this is a cable wire number
 */
export function isCableWireNumber(wireNo: string): boolean {
  if (!wireNo) return false;
  const normalized = wireNo.toUpperCase().trim();
  return /^WC\d+/.test(normalized);
}

/**
 * Check if a gauge indicates a cable (not a wire).
 * 
 * @param gauge - The gauge/size value
 * @returns True if this is a cable gauge
 */
export function isCableGauge(gauge: string): boolean {
  if (!gauge) return false;
  const normalized = gauge.toUpperCase().trim();
  
  // Cable gauges often include conductor counts like "2C" or sizes like "16/2"
  return /^\d+C$/.test(normalized) || /^\d+\/\d+/.test(normalized);
}

/**
 * Parse a wire number to extract components.
 * 
 * @param wireNo - The wire number
 * @returns Parsed wire number components
 */
export function parseWireNumber(wireNo: string): {
  original: string;
  numeric: number | null;
  prefix: string;
  suffix: string;
  isCable: boolean;
} {
  const original = (wireNo || "").trim();
  
  if (!original) {
    return { original: "", numeric: null, prefix: "", suffix: "", isCable: false };
  }
  
  // Check for cable pattern
  const isCable = isCableWireNumber(original);
  
  // Extract numeric portion
  const numericMatch = original.match(/(\d+)/);
  const numeric = numericMatch ? parseInt(numericMatch[1], 10) : null;
  
  // Extract prefix (letters before number)
  const prefixMatch = original.match(/^([A-Z]+)/i);
  const prefix = prefixMatch ? prefixMatch[1].toUpperCase() : "";
  
  // Extract suffix (anything after the number)
  const suffixMatch = original.match(/\d+([A-Z]+)$/i);
  const suffix = suffixMatch ? suffixMatch[1].toUpperCase() : "";
  
  return { original, numeric, prefix, suffix, isCable };
}

/**
 * Check if two wire numbers are sequential.
 * 
 * @param wireNoA - First wire number
 * @param wireNoB - Second wire number
 * @returns True if wire numbers are sequential
 */
export function areSequentialWireNumbers(wireNoA: string, wireNoB: string): boolean {
  const parsedA = parseWireNumber(wireNoA);
  const parsedB = parseWireNumber(wireNoB);
  
  if (parsedA.numeric === null || parsedB.numeric === null) return false;
  if (parsedA.prefix !== parsedB.prefix) return false;
  
  const diff = Math.abs(parsedA.numeric - parsedB.numeric);
  return diff === 1;
}

/**
 * Check if a location string indicates an external connection.
 * External locations typically reference different panels or locations.
 * 
 * @param location - The location string
 * @param currentLocation - The current context location
 * @returns True if this is an external location
 */
export function isExternalLocation(location: string, currentLocation: string): boolean {
  if (!location || !currentLocation) return false;
  
  const normalizedLoc = location.toUpperCase().trim();
  const normalizedCurrent = currentLocation.toUpperCase().trim();
  
  // Same location is internal
  if (normalizedLoc === normalizedCurrent) return false;
  
  // Check for explicit external markers
  if (normalizedLoc.includes("EXT") || normalizedLoc.includes("FIELD")) return true;
  
  // Different locations are external
  return normalizedLoc !== normalizedCurrent;
}

/**
 * Get a display-friendly location from raw location data.
 * Handles fallback logic for empty locations.
 * 
 * @param toLocation - To location field
 * @param fromLocation - From location field  
 * @param location - Legacy location field
 * @returns Best available location string
 */
export function getDisplayLocation(
  toLocation?: string,
  fromLocation?: string,
  location?: string
): string {
  return (
    (toLocation || "").trim() ||
    (fromLocation || "").trim() ||
    (location || "").trim() ||
    ""
  );
}

/**
 * Format a length value for display.
 * 
 * @param inches - Length in inches
 * @param precision - Decimal precision (default 1)
 * @returns Formatted length string
 */
export function formatLength(inches: number, precision: number = 1): string {
  if (inches === null || inches === undefined || isNaN(inches)) return "-";
  return `${inches.toFixed(precision)} in`;
}

/**
 * Round a length to the nearest increment.
 * 
 * @param inches - Length in inches
 * @param increment - Rounding increment (default 0.5)
 * @returns Rounded length
 */
export function roundLength(inches: number, increment: number = 0.5): number {
  return Math.round(inches / increment) * increment;
}
