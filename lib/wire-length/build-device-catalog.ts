/**
 * Device Catalog Builder
 * 
 * Builds a normalized device catalog from the Part List sheet.
 * Maps device IDs to part numbers, families, and dimensions.
 */

import type { ParsedWorkbookSheet, ParsedSheetRow } from "@/lib/workbook/types";
import type { DeviceCatalog, DeviceCatalogEntry, DeviceFamily, DeviceDimensions } from "./types";
import { DEVICE_FAMILY_DEFAULTS, getDeviceFamilyFromPrefix } from "./constants";
import { parseDevicePrefix } from "@/lib/wiring-identification/device-parser";

// ============================================================================
// Part List Column Detection
// ============================================================================

/**
 * Common column headers in Part List sheets.
 */
const PART_LIST_COLUMN_PATTERNS = {
  deviceId: [/^device\s*id$/i, /^device$/i, /^tag$/i, /^item$/i],
  partNumber: [/^part\s*(?:no\.?|number)$/i, /^p\/n$/i, /^catalog$/i, /^model$/i],
  description: [/^description$/i, /^desc\.?$/i, /^name$/i],
  quantity: [/^qty\.?$/i, /^quantity$/i, /^count$/i],
  manufacturer: [/^mfr\.?$/i, /^manufacturer$/i, /^make$/i],
};

/**
 * Find a column in the headers that matches any of the patterns.
 */
function findColumnByPatterns(headers: string[], patterns: RegExp[]): string | null {
  for (const header of headers) {
    const trimmed = (header || "").trim();
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return header;
      }
    }
  }
  return null;
}

// ============================================================================
// Device Catalog Building
// ============================================================================

/**
 * Build a device catalog from a Part List sheet.
 * 
 * @param partListSheet - The parsed Part List sheet
 * @returns Device catalog with entries and family defaults
 */
export function buildDeviceCatalog(
  partListSheet: ParsedWorkbookSheet | null
): DeviceCatalog {
  const entries = new Map<string, DeviceCatalogEntry>();
  const familyDefaults = new Map<DeviceFamily, DeviceDimensions>();
  
  // Initialize family defaults
  for (const [family, dims] of Object.entries(DEVICE_FAMILY_DEFAULTS)) {
    familyDefaults.set(family as DeviceFamily, dims);
  }
  
  if (!partListSheet || !partListSheet.rows || partListSheet.rows.length === 0) {
    return { entries, familyDefaults };
  }
  
  const { headers, rows } = partListSheet;
  
  // Find relevant columns
  const deviceIdCol = findColumnByPatterns(headers, PART_LIST_COLUMN_PATTERNS.deviceId);
  const partNumberCol = findColumnByPatterns(headers, PART_LIST_COLUMN_PATTERNS.partNumber);
  const descriptionCol = findColumnByPatterns(headers, PART_LIST_COLUMN_PATTERNS.description);
  
  if (!deviceIdCol && !partNumberCol) {
    // Cannot build catalog without at least one key column
    return { entries, familyDefaults };
  }
  
  // Process each row
  for (const row of rows) {
    const deviceId = deviceIdCol ? String(row[deviceIdCol] || "").trim() : "";
    const partNumber = partNumberCol ? String(row[partNumberCol] || "").trim() : undefined;
    
    if (!deviceId) continue;
    
    const prefix = parseDevicePrefix(deviceId);
    const family = getDeviceFamilyFromPrefix(prefix);
    const dimensions = resolveDeviceDimensions(family, partNumber);
    
    const entry: DeviceCatalogEntry = {
      deviceId,
      prefix,
      family,
      partNumber,
      dimensions,
    };
    
    entries.set(deviceId, entry);
  }
  
  return { entries, familyDefaults };
}

/**
 * Resolve device dimensions from part number or family defaults.
 * 
 * @param family - Device family
 * @param partNumber - Optional part number for exact lookup
 * @returns Device dimensions
 */
export function resolveDeviceDimensions(
  family: DeviceFamily,
  partNumber?: string
): DeviceDimensions {
  // For now, use family defaults
  // In the future, this could look up exact dimensions by part number
  return DEVICE_FAMILY_DEFAULTS[family] || DEVICE_FAMILY_DEFAULTS.unknown;
}

/**
 * Get a device entry from the catalog, or create a default entry.
 * 
 * @param catalog - The device catalog
 * @param deviceId - The device ID to look up
 * @returns Device catalog entry
 */
export function getDeviceEntry(
  catalog: DeviceCatalog,
  deviceId: string
): DeviceCatalogEntry {
  const existing = catalog.entries.get(deviceId);
  if (existing) {
    return existing;
  }
  
  // Create a default entry based on prefix
  const prefix = parseDevicePrefix(deviceId);
  const family = getDeviceFamilyFromPrefix(prefix);
  const dimensions = catalog.familyDefaults.get(family) || DEVICE_FAMILY_DEFAULTS.unknown;
  
  return {
    deviceId,
    prefix,
    family,
    dimensions,
  };
}

/**
 * Get the base device ID (without terminal suffix).
 * 
 * @param fullDeviceId - Full device ID like "KA0561:A1"
 * @returns Base device ID like "KA0561"
 */
export function getBaseDeviceId(fullDeviceId: string): string {
  const colonIndex = fullDeviceId.indexOf(":");
  if (colonIndex === -1) {
    return fullDeviceId;
  }
  return fullDeviceId.substring(0, colonIndex);
}

/**
 * Extract the terminal from a device ID.
 * 
 * @param fullDeviceId - Full device ID like "KA0561:A1"
 * @returns Terminal like "A1" or null if not present
 */
export function extractTerminal(fullDeviceId: string): string | null {
  const colonIndex = fullDeviceId.indexOf(":");
  if (colonIndex === -1 || colonIndex === fullDeviceId.length - 1) {
    return null;
  }
  return fullDeviceId.substring(colonIndex + 1);
}
