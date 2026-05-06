/**
 * Device Change Pattern Detection
 * 
 * Identifies rows where the device ID suffix indicates a device change,
 * typically seen as :J -> :P patterns (or similar letter progressions).
 * 
 * Example patterns:
 * - AF0341:J -> AF0342:P (device changed)
 * - AF0345:J -> AF0346:P (device changed)
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";

/**
 * Pattern to match device IDs with suffix (e.g., "AF0341:J", "AF0342:P")
 * Captures: base ID, separator, suffix letter
 */
const DEVICE_SUFFIX_PATTERN = /^([A-Z]{2}\d+):([A-Z])$/i;

/**
 * Known device change suffix pairs
 * J -> P is the most common, indicating a device boundary change
 */
const DEVICE_CHANGE_PAIRS = [
  { from: "J", to: "P" },
  { from: "K", to: "Q" },
  { from: "L", to: "R" },
] as const;

export interface DeviceChangeInfo {
  /** Whether this row represents a device change */
  isDeviceChange: boolean;
  /** The from device base ID (without suffix) */
  fromBase: string | null;
  /** The from device suffix */
  fromSuffix: string | null;
  /** The to device base ID (without suffix) */
  toBase: string | null;
  /** The to device suffix */
  toSuffix: string | null;
  /** Human-readable description of the change */
  description: string | null;
}

/**
 * Parse a device ID into its base and suffix components.
 * 
 * @param deviceId - The device ID to parse (e.g., "AF0341:J")
 * @returns Parsed components or null if not matching pattern
 */
export function parseDeviceSuffix(deviceId: string | undefined | null): { base: string; suffix: string } | null {
  if (!deviceId) return null;
  
  const match = deviceId.trim().match(DEVICE_SUFFIX_PATTERN);
  if (!match) return null;
  
  return {
    base: match[1].toUpperCase(),
    suffix: match[2].toUpperCase(),
  };
}

/**
 * Check if a row represents a device change based on :J -> :P (or similar) pattern.
 * 
 * @param row - The wire list row to check
 * @returns Device change information
 */
export function detectDeviceChange(row: SemanticWireListRow): DeviceChangeInfo {
  const fromParsed = parseDeviceSuffix(row.fromDeviceId);
  const toParsed = parseDeviceSuffix(row.toDeviceId);
  
  const result: DeviceChangeInfo = {
    isDeviceChange: false,
    fromBase: fromParsed?.base ?? null,
    fromSuffix: fromParsed?.suffix ?? null,
    toBase: toParsed?.base ?? null,
    toSuffix: toParsed?.suffix ?? null,
    description: null,
  };
  
  if (!fromParsed || !toParsed) {
    return result;
  }
  
  // Check if the suffix pair matches known device change patterns
  for (const pair of DEVICE_CHANGE_PAIRS) {
    if (fromParsed.suffix === pair.from && toParsed.suffix === pair.to) {
      result.isDeviceChange = true;
      result.description = `Device change: ${fromParsed.base}:${fromParsed.suffix} → ${toParsed.base}:${toParsed.suffix}`;
      break;
    }
  }
  
  return result;
}

/**
 * Check if a row is a device change row (simple boolean check).
 * 
 * @param row - The wire list row to check
 * @returns True if the row represents a device change
 */
export function isDeviceChangeRow(row: SemanticWireListRow): boolean {
  return detectDeviceChange(row).isDeviceChange;
}

export function filterDeviceChangeRows(rows: SemanticWireListRow[]): SemanticWireListRow[] {
  return rows.filter((row) => !isDeviceChangeRow(row));
}

export function countNonDeviceChangeRows(rows: SemanticWireListRow[]): number {
  return rows.reduce((count, row) => count + (isDeviceChangeRow(row) ? 0 : 1), 0);
}

/**
 * Group rows by device change boundaries.
 * Device change rows can be used as subheaders to separate wire groups.
 * 
 * @param rows - Array of wire list rows
 * @returns Array of groups, each with an optional device change header and wire rows
 */
export interface DeviceGroup {
  /** Device change row that acts as header (null for first group) */
  header: SemanticWireListRow | null;
  /** Device change info for the header */
  headerInfo: DeviceChangeInfo | null;
  /** Wire rows in this group (non-device-change rows) */
  wires: SemanticWireListRow[];
}

export function groupByDeviceChange(rows: SemanticWireListRow[]): DeviceGroup[] {
  const groups: DeviceGroup[] = [];
  let currentGroup: DeviceGroup = {
    header: null,
    headerInfo: null,
    wires: [],
  };
  
  for (const row of rows) {
    const changeInfo = detectDeviceChange(row);
    
    if (changeInfo.isDeviceChange) {
      // Start a new group if current has wires or is the first
      if (currentGroup.wires.length > 0 || groups.length === 0) {
        groups.push(currentGroup);
      }
      
      currentGroup = {
        header: row,
        headerInfo: changeInfo,
        wires: [],
      };
    } else {
      currentGroup.wires.push(row);
    }
  }
  
  // Push the last group if it has content
  if (currentGroup.wires.length > 0 || currentGroup.header) {
    groups.push(currentGroup);
  }
  
  return groups;
}

/**
 * Filter out device change rows that have no wires following them.
 * Useful for print views where empty sections should be hidden.
 * 
 * @param rows - Array of wire list rows
 * @returns Filtered array with empty device change sections removed
 */
export function filterEmptyDeviceChangeSections(rows: SemanticWireListRow[]): SemanticWireListRow[] {
  const groups = groupByDeviceChange(rows);
  const result: SemanticWireListRow[] = [];
  
  for (const group of groups) {
    // Only include device change header if it has wires following
    if (group.header && group.wires.length > 0) {
      result.push(group.header);
    }
    result.push(...group.wires);
  }
  
  return result;
}

/**
 * Get statistics about device changes in a set of rows.
 * 
 * @param rows - Array of wire list rows
 * @returns Statistics object
 */
export function getDeviceChangeStats(rows: SemanticWireListRow[]): {
  totalRows: number;
  deviceChangeRows: number;
  wireRows: number;
  emptyDeviceChanges: number;
} {
  const groups = groupByDeviceChange(rows);
  
  let deviceChangeRows = 0;
  let emptyDeviceChanges = 0;
  
  for (const group of groups) {
    if (group.header) {
      deviceChangeRows++;
      if (group.wires.length === 0) {
        emptyDeviceChanges++;
      }
    }
  }
  
  return {
    totalRows: rows.length,
    deviceChangeRows,
    wireRows: rows.length - deviceChangeRows,
    emptyDeviceChanges,
  };
}
