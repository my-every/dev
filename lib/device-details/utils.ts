/**
 * Utility functions for device ID parsing and data gathering.
 */

import type { ParsedDeviceId, DevicePartInfo, TerminationRecord, DeviceFamilyType } from "./types";
import type { SemanticWireListRow, ParsedSheetRow } from "@/lib/workbook/types";
import type { DeviceDetails } from "./types";
import { isDeviceChangeRow } from "@/lib/wiring-identification/device-change-pattern";

/**
 * Parse a device ID string into base ID and optional terminal.
 * Examples:
 *   "AF0123" → { baseId: "AF0123", terminal: null }
 *   "AF0123:13" → { baseId: "AF0123", terminal: "13" }
 */
export function parseDeviceId(deviceIdStr: string): ParsedDeviceId {
  if (!deviceIdStr) {
    return { baseId: "", terminal: null };
  }

  const [base, term] = deviceIdStr.split(":").map(s => s.trim());
  return {
    baseId: base || "",
    terminal: term || null,
  };
}

/**
 * Normalize a device ID for case-insensitive lookup.
 */
export function normalizeDeviceId(deviceId: string): string {
  return deviceId.trim().toUpperCase();
}

function getNormalizedBaseDeviceId(deviceId: string): string {
  return normalizeDeviceId(parseDeviceId(deviceId).baseId);
}

function getTerminationChangeState(row: SemanticWireListRow): "added" | "removed" | undefined {
  const candidateKeys = ["__changeState", "changeState", "terminationChangeState"] as const;
  const rowRecord = row as Record<string, unknown>;

  for (const key of candidateKeys) {
    const value = rowRecord[key];
    if (value === "added" || value === "removed") {
      return value;
    }
  }

  return undefined;
}

/**
 * Extract device family from device ID prefix.
 * Examples: "AF0123" → "i-o-module", "KA0460" → "relay", "FU0171" → "fuse"
 */
export function getDeviceFamily(baseDeviceId: string): DeviceFamilyType {
  const prefix = baseDeviceId.slice(0, 2).toUpperCase();

  if (["KA", "KT"].includes(prefix)) return "relay";
  if (prefix === "FU") return "fuse";
  if (prefix === "XT") return "terminal-block";
  if (prefix === "AF" || prefix === "AU" || prefix === "AP") return "i-o-module";

  return "other";
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
 * Look up device part information from the Part Number List sheet.
 * Returns null if device not found.
 * Uses flexible column matching to handle different header formats.
 */
export function lookupDevicePartNumbers(
  deviceId: string,
  partListSheet: { rows: ParsedSheetRow[] } | null | undefined
): DevicePartInfo | null {
  if (!partListSheet || !partListSheet.rows || partListSheet.rows.length === 0) {
    return null;
  }

  const normalizedLookup = normalizeDeviceId(deviceId);
  
  // Get column keys from first row
  const firstRow = partListSheet.rows[0];
  if (!firstRow) return null;
  
  const rowKeys = Object.keys(firstRow);
  const deviceIdKey = findColumnKey(rowKeys, ["device id", "deviceid", "device_id", "device"]);
  const partNumberKey = findColumnKey(rowKeys, ["part number", "partnumber", "part_number", "part no", "partno", "part"]);
  const descriptionKey = findColumnKey(rowKeys, ["description", "desc", "item description"]);
  const locationKey = findColumnKey(rowKeys, ["location", "loc", "panel"]);
  
  if (!deviceIdKey || !partNumberKey) {
    return null;
  }

  for (const row of partListSheet.rows) {
    const rowDeviceId = String(row[deviceIdKey] ?? "");
    if (!rowDeviceId) continue;

    if (normalizeDeviceId(rowDeviceId) === normalizedLookup) {
      const rawPartNumber = String(row[partNumberKey] ?? "");
      return {
        deviceId: rowDeviceId,
        partNumbers: rawPartNumber
          .split(",")
          .map(p => p.trim())
          .filter(p => p.length > 0 && !p.toLowerCase().includes("part of assembly")),
        description: String(row[descriptionKey ?? ""] ?? ""),
        location: String(row[locationKey ?? ""] ?? ""),
      };
    }
  }

  return null;
}

/**
 * Collect all termination records for a device from the semantic wire list.
 * This finds all wires connected to the device (as either from or to).
 */
export function collectDeviceTerminations(
  baseDeviceId: string,
  semanticRows: SemanticWireListRow[]
): TerminationRecord[] {
  const normalized = getNormalizedBaseDeviceId(baseDeviceId);
  const terminations: TerminationRecord[] = [];

  for (const row of semanticRows) {
    if (isDeviceChangeRow(row)) {
      continue;
    }

    const fromDevice = parseDeviceId(row.fromDeviceId);
    const toDevice = parseDeviceId(row.toDeviceId);
    const isFrom = normalizeDeviceId(fromDevice.baseId) === normalized;
    const isTo = normalizeDeviceId(toDevice.baseId) === normalized;

    if (!isFrom && !isTo) continue;

    const terminal = isFrom
      ? fromDevice.terminal ?? ""
      : isTo
        ? toDevice.terminal ?? ""
        : "";

    terminations.push({
      terminal: terminal || (row.wireId ? extractTerminal(row.wireId) : ""),
      fromDeviceId: row.fromDeviceId,
      wireNo: row.wireNo,
      wireType: row.wireType,
      wireId: row.wireId,
      gaugeSize: row.gaugeSize,
      toDeviceId: row.toDeviceId,
      toLocation: row.toLocation,
      fromLocation: row.fromLocation,
      changeState: getTerminationChangeState(row),
      rowId: row.__rowId,
    });
  }

  return terminations;
}

/**
 * Extract terminal number from wire ID string.
 * Examples:
 *   "1066730-7:13" → "13"
 *   "1066730-7" → ""
 */
function extractTerminal(wireId: string): string {
  const match = wireId.match(/:(\d+)$/);
  return match ? match[1] : "";
}

/**
 * Build a set of used terminals from termination records.
 */
export function buildUsedTerminalsSet(terminations: TerminationRecord[]): Set<string> {
  const used = new Set<string>();
  for (const term of terminations) {
    if (term.terminal) {
      used.add(term.terminal);
    }
  }
  return used;
}

function getTerminalSortValue(terminal: string): [number, number | string] {
  const normalized = terminal.trim().toUpperCase();
  const numericMatch = normalized.match(/^\d+$/);
  if (numericMatch) {
    return [0, Number.parseInt(normalized, 10)];
  }

  const specialOrder: Record<string, number> = {
    "COM": 0,
    "COM-": 1,
    "V+": 2,
    "SH": 3,
  };

  if (normalized in specialOrder) {
    return [1, specialOrder[normalized]];
  }

  return [2, normalized];
}

export function getUsedTerminalList(terminations: TerminationRecord[]): string[] {
  return Array.from(buildUsedTerminalsSet(terminations)).sort((a, b) => {
    const [groupA, valueA] = getTerminalSortValue(a);
    const [groupB, valueB] = getTerminalSortValue(b);

    if (groupA !== groupB) {
      return groupA - groupB;
    }

    if (typeof valueA === "number" && typeof valueB === "number") {
      return valueA - valueB;
    }

    return String(valueA).localeCompare(String(valueB));
  });
}

export function resolveDeviceDetails(
  deviceIdStr: string | null,
  semanticRows: SemanticWireListRow[],
  partListSheet?: { rows: ParsedSheetRow[] } | null,
): DeviceDetails | null {
  if (!deviceIdStr) {
    return null;
  }

  const parsedId = parseDeviceId(deviceIdStr);
  if (!parsedId.baseId) {
    return null;
  }

  const partInfo = lookupDevicePartNumbers(parsedId.baseId, partListSheet);
  const terminations = collectDeviceTerminations(parsedId.baseId, semanticRows ?? []);
  const usedTerminals = buildUsedTerminalsSet(terminations);
  const usedTerminalList = getUsedTerminalList(terminations);

  return {
    parsedId,
    partInfo,
    terminations,
    usedTerminals,
    usedTerminalList,
    totalTerminalsUsed: usedTerminals.size,
  };
}

/**
 * Determine if a terminal number is valid for a given device family.
 * This is a basic check; specific families can override.
 */
export function isValidTerminal(terminal: string, family: DeviceFamilyType): boolean {
  if (!terminal) return false;

  // Parse terminal as number
  const num = parseInt(terminal, 10);
  if (isNaN(num)) return false;

  // Basic range checks by family
  switch (family) {
    case "i-o-module":
      // AF modules typically have 16-32 terminals
      return num >= 0 && num <= 63;
    case "terminal-block":
      return num >= 1 && num <= 32;
    case "relay":
      return num >= 1 && num <= 14;
    case "fuse":
      return num >= 1 && num <= 4;
    default:
      return true;
  }
}
