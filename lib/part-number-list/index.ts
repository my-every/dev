/**
 * Part Number List Utilities
 * 
 * Handles parsing and lookup of device part numbers from the Part Number List
 * reference sheet. The sheet has a specific structure:
 * - Header metadata rows (project info)
 * - Column headers: "Device ID", "Part Number", "Description", "Location"
 * - Data rows with device-to-part-number mappings
 */

import type { ParsedSheetRow, ParsedWorkbookSheet } from "@/lib/workbook/types";

export interface PartNumberEntry {
  deviceId: string;
  partNumber: string;
  description: string;
  location: string;
}

export interface PartNumberLookupResult {
  partNumber: string;
  description: string;
  location: string;
}

export interface CablePartNumberLookupResult {
  partNumber: string;
  description: string;
  location: string;
}

/**
 * Build a lookup map from Part Number List sheet.
 * Handles various column name formats and normalizes device IDs.
 */
export function buildPartNumberMap(
  partListSheet: ParsedWorkbookSheet | null | undefined
): Map<string, PartNumberLookupResult> {
  const map = new Map<string, PartNumberLookupResult>();
  
  const columns = resolvePartListColumns(partListSheet);
  if (!columns) {
    return map;
  }

  const { deviceIdKey, partNumberKey, descriptionKey, locationKey, dataRows } = columns;

  for (const row of dataRows) {
    const deviceId = normalizeDeviceId(String(row[deviceIdKey] ?? ""));
    if (!deviceId) continue;
    
    const rawPartNumber = String(row[partNumberKey] ?? "").trim();
    // Filter out non-part-number entries
    if (!rawPartNumber || rawPartNumber.toLowerCase() === "part of assembly") {
      continue;
    }
    
    // Clean up part numbers (may be comma-separated list)
    const partNumber = rawPartNumber
      .split(/[\n,;]/)
      .map(p => p.trim())
      .filter(p => p.length > 0 && !p.toLowerCase().includes("part of assembly"))
      .join(", ");
    
    if (partNumber) {
      map.set(deviceId, {
        partNumber,
        description: String(row[descriptionKey ?? ""] ?? "").trim(),
        location: String(row[locationKey ?? ""] ?? "").trim(),
      });
    }
  }

  return map;
}

/**
 * Build a lookup map from Cable Part Numbers sheet.
 * Supports sheets keyed by either "Wire ID" or "Device ID" for cable codes like WC0020.
 */
export function buildCablePartNumberMap(
  cablePartSheet: ParsedWorkbookSheet | null | undefined
): Map<string, CablePartNumberLookupResult> {
  const map = new Map<string, CablePartNumberLookupResult>();

  const columns = resolveCablePartColumns(cablePartSheet);
  if (!columns) {
    return map;
  }

  const { cableKey, partNumberKey, descriptionKey, locationKey, dataRows } = columns;

  for (const row of dataRows) {
    const normalizedCableKey = normalizeDeviceId(String(row[cableKey] ?? ""));
    if (!normalizedCableKey) continue;

    const rawPartNumber = String(row[partNumberKey] ?? "").trim();
    if (!rawPartNumber || rawPartNumber.toLowerCase() === "part of assembly") {
      continue;
    }

    const partNumber = rawPartNumber
      .split(/[\n,;]/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && !part.toLowerCase().includes("part of assembly"))
      .join(", ");

    if (!partNumber) continue;

    map.set(normalizedCableKey, {
      partNumber,
      description: String(row[descriptionKey ?? ""] ?? "").trim(),
      location: String(row[locationKey ?? ""] ?? "").trim(),
    });
  }

  return map;
}

/**
 * Find a column key from available keys using flexible matching
 */
function findColumnKey(availableKeys: string[], possibleNames: string[]): string | undefined {
  // First try exact match (case-insensitive)
  for (const name of possibleNames) {
    const found = availableKeys.find(k => k.toLowerCase() === name.toLowerCase());
    if (found) return found;
  }
  
  // Then try partial match (contains)
  for (const name of possibleNames) {
    const found = availableKeys.find(k => k.toLowerCase().includes(name.toLowerCase()));
    if (found) return found;
  }
  
  return undefined;
}

/**
 * Resolve column keys and the correct data rows even when the sheet includes preamble rows.
 */
function resolvePartListColumns(
  partListSheet: ParsedWorkbookSheet | null | undefined
): {
  deviceIdKey: string;
  partNumberKey: string;
  descriptionKey?: string;
  locationKey?: string;
  dataRows: ParsedSheetRow[];
} | null {
  if (!partListSheet?.rows || partListSheet.rows.length === 0) {
    return null;
  }

  const candidateHeaderKeys = (partListSheet.headers?.length ? partListSheet.headers : Object.keys(partListSheet.rows[0])) ?? [];

  const deviceIdKeyFromHeaders = findColumnKey(candidateHeaderKeys, ["device id", "deviceid", "device_id", "device"]);
  const partNumberKeyFromHeaders = findColumnKey(candidateHeaderKeys, ["part number", "partnumber", "part_number", "part no", "partno", "part"]);
  const descriptionKeyFromHeaders = findColumnKey(candidateHeaderKeys, ["description", "desc", "item description"]);
  const locationKeyFromHeaders = findColumnKey(candidateHeaderKeys, ["location", "loc", "panel"]);

  if (deviceIdKeyFromHeaders && partNumberKeyFromHeaders) {
    return {
      deviceIdKey: deviceIdKeyFromHeaders,
      partNumberKey: partNumberKeyFromHeaders,
      descriptionKey: descriptionKeyFromHeaders,
      locationKey: locationKeyFromHeaders,
      dataRows: partListSheet.rows,
    };
  }

  // Fallback: scan values to find the header row (e.g., when intro rows precede column headers).
  const searchRows: ParsedSheetRow[] = [
    ...(partListSheet.introRows ?? []),
    ...partListSheet.rows,
  ];

  for (let i = 0; i < searchRows.length; i++) {
    const row = searchRows[i];
    const deviceIdKey = findColumnKeyByValue(row, ["device id", "deviceid", "device_id", "device"]);
    const partNumberKey = findColumnKeyByValue(row, ["part number", "partnumber", "part_number", "part no", "partno", "part"]);
    const descriptionKey = findColumnKeyByValue(row, ["description", "desc", "item description"]);
    const locationKey = findColumnKeyByValue(row, ["location", "loc", "panel"]);

    if (deviceIdKey && partNumberKey) {
      return {
        deviceIdKey,
        partNumberKey,
        descriptionKey,
        locationKey,
        dataRows: searchRows.slice(i + 1),
      };
    }
  }

  return null;
}

function resolveCablePartColumns(
  cablePartSheet: ParsedWorkbookSheet | null | undefined
): {
  cableKey: string;
  partNumberKey: string;
  descriptionKey?: string;
  locationKey?: string;
  dataRows: ParsedSheetRow[];
} | null {
  if (!cablePartSheet?.rows || cablePartSheet.rows.length === 0) {
    return null;
  }

  const candidateHeaderKeys = (cablePartSheet.headers?.length ? cablePartSheet.headers : Object.keys(cablePartSheet.rows[0])) ?? [];

  const cableKeyFromHeaders =
    findColumnKey(candidateHeaderKeys, ["wire id", "wireid", "wire_id", "cable id", "cable", "device id", "deviceid", "device_id", "device"]);
  const partNumberKeyFromHeaders = findColumnKey(candidateHeaderKeys, ["part number", "partnumber", "part_number", "part no", "partno", "part"]);
  const descriptionKeyFromHeaders = findColumnKey(candidateHeaderKeys, ["description", "desc", "item description"]);
  const locationKeyFromHeaders = findColumnKey(candidateHeaderKeys, ["location", "loc", "panel"]);

  if (cableKeyFromHeaders && partNumberKeyFromHeaders) {
    return {
      cableKey: cableKeyFromHeaders,
      partNumberKey: partNumberKeyFromHeaders,
      descriptionKey: descriptionKeyFromHeaders,
      locationKey: locationKeyFromHeaders,
      dataRows: cablePartSheet.rows,
    };
  }

  const searchRows: ParsedSheetRow[] = [
    ...(cablePartSheet.introRows ?? []),
    ...cablePartSheet.rows,
  ];

  for (let i = 0; i < searchRows.length; i++) {
    const row = searchRows[i];
    const cableKey =
      findColumnKeyByValue(row, ["wire id", "wireid", "wire_id", "cable id", "cable", "device id", "deviceid", "device_id", "device"]);
    const partNumberKey = findColumnKeyByValue(row, ["part number", "partnumber", "part_number", "part no", "partno", "part"]);
    const descriptionKey = findColumnKeyByValue(row, ["description", "desc", "item description"]);
    const locationKey = findColumnKeyByValue(row, ["location", "loc", "panel"]);

    if (cableKey && partNumberKey) {
      return {
        cableKey,
        partNumberKey,
        descriptionKey,
        locationKey,
        dataRows: searchRows.slice(i + 1),
      };
    }
  }

  return null;
}

// Detect column key when header text is in the row values (common after metadata rows)
function findColumnKeyByValue(row: ParsedSheetRow, possibleNames: string[]): string | undefined {
  for (const [key, value] of Object.entries(row)) {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) continue;

    for (const name of possibleNames) {
      const target = name.toLowerCase();
      if (normalized === target || normalized.includes(target)) {
        return key;
      }
    }
  }

  return undefined;
}

/**
 * Normalize device ID for consistent lookup:
 * - Uppercase
 * - Trim whitespace
 * - Strip terminal suffix (e.g., "AF0123:05" → "AF0123")
 */
export function normalizeDeviceId(deviceId: string): string {
  return deviceId
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .split(":")[0]
    .trim();
}

/**
 * Look up part number for a device ID
 */
export function lookupPartNumber(
  map: Map<string, PartNumberLookupResult>,
  deviceId: string | null | undefined
): PartNumberLookupResult | undefined {
  if (!deviceId) return undefined;
  const normalized = normalizeDeviceId(deviceId);
  return map.get(normalized);
}

export function lookupCablePartNumber(
  map: Map<string, CablePartNumberLookupResult>,
  cableKey: string | null | undefined
): CablePartNumberLookupResult | undefined {
  if (!cableKey) return undefined;
  const normalized = normalizeDeviceId(cableKey);
  return map.get(normalized);
}

/**
 * Get all part number entries as an array (useful for display/export)
 */
export function getPartNumberEntries(
  partListSheet: ParsedWorkbookSheet | null | undefined
): PartNumberEntry[] {
  const entries: PartNumberEntry[] = [];
  
  const columns = resolvePartListColumns(partListSheet);
  if (!columns) return entries;

  const { deviceIdKey, partNumberKey, descriptionKey, locationKey, dataRows } = columns;

  for (const row of dataRows) {
    const deviceId = String(row[deviceIdKey] ?? "").trim();
    if (!deviceId) continue;
    
    const rawPartNumber = String(row[partNumberKey] ?? "").trim();
    if (!rawPartNumber || rawPartNumber.toLowerCase() === "part of assembly") continue;

    entries.push({
      deviceId,
      partNumber: rawPartNumber,
      description: String(row[descriptionKey ?? ""] ?? "").trim(),
      location: String(row[locationKey ?? ""] ?? "").trim(),
    });
  }

  return entries;
}

/**
 * Group part number entries by location
 */
export function groupPartNumbersByLocation(
  entries: PartNumberEntry[]
): Map<string, PartNumberEntry[]> {
  const groups = new Map<string, PartNumberEntry[]>();
  
  for (const entry of entries) {
    const location = entry.location || "Unknown";
    const existing = groups.get(location) || [];
    existing.push(entry);
    groups.set(location, existing);
  }
  
  return groups;
}
