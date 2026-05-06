/**
 * Wire List Row Grouping Utilities
 * 
 * Groups wire list rows by location, device prefix, or other criteria
 * for displaying section dividers in the table.
 */

import type { SemanticWireListRow } from "./types";

// ============================================================================
// Types
// ============================================================================

export interface WireListGroupConfig {
  /** Group by location value */
  groupByLocation?: boolean;
  /** Group by From device prefix */
  groupByFromDevice?: boolean;
  /** Group by To device prefix */
  groupByToDevice?: boolean;
  /** Custom group key function */
  customGroupKey?: (row: SemanticWireListRow) => string;
}

export interface GroupedRow {
  /** The row type */
  type: "row" | "group-header";
  /** The row data (only for type="row") */
  row?: SemanticWireListRow;
  /** The group key (only for type="group-header") */
  groupKey?: string;
  /** Display label for the group header */
  groupLabel?: string;
  /** Number of rows in this group */
  groupCount?: number;
}

export interface WireListGroupResult {
  /** Flattened array with group headers interspersed */
  groupedRows: GroupedRow[];
  /** Map of group key to row indices */
  groupMap: Map<string, number[]>;
  /** Unique group keys in order */
  groupKeys: string[];
}

// ============================================================================
// Grouping Functions
// ============================================================================

/**
 * Extract device prefix from device ID.
 * E.g., "XT0170:1" -> "XT"
 */
export function extractDevicePrefix(deviceId: string): string {
  if (!deviceId) return "Unknown";
  const match = deviceId.match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : "Unknown";
}

/**
 * Get location from row using fallback logic.
 * Checks toLocation first, then fromLocation, then deprecated location field.
 */
function getRowLocation(row: SemanticWireListRow): string {
  return row.toLocation || row.fromLocation || row.location || "Unknown Location";
}

/**
 * Generate group key for a row based on config.
 */
export function generateGroupKey(
  row: SemanticWireListRow,
  config: WireListGroupConfig
): string {
  const parts: string[] = [];

  if (config.customGroupKey) {
    return config.customGroupKey(row);
  }

  if (config.groupByLocation) {
    // Use consistent location fallback: toLocation -> fromLocation -> location
    parts.push(getRowLocation(row));
  }

  if (config.groupByFromDevice) {
    parts.push(`From: ${extractDevicePrefix(row.fromDeviceId)}`);
  }

  if (config.groupByToDevice) {
    parts.push(`To: ${extractDevicePrefix(row.toDeviceId)}`);
  }

  if (parts.length === 0) {
    // Default to location if no config specified
    return getRowLocation(row);
  }

  return parts.join(" | ");
}

/**
 * Generate display label for a group header.
 */
export function generateGroupLabel(
  groupKey: string,
  config: WireListGroupConfig
): string {
  // For location-only grouping, prefix with "Location:"
  if (config.groupByLocation && !config.groupByFromDevice && !config.groupByToDevice) {
    return `Location: ${groupKey}`;
  }
  
  return groupKey;
}

/**
 * Group wire list rows by the specified criteria.
 * Returns a flattened array with group headers interspersed.
 */
export function groupWireListRows(
  rows: SemanticWireListRow[],
  config: WireListGroupConfig
): WireListGroupResult {
  const groupMap = new Map<string, number[]>();
  const groupKeys: string[] = [];
  let currentGroupKey: string | null = null;

  // First pass: build group map and track order
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const groupKey = generateGroupKey(row, config);

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, []);
      groupKeys.push(groupKey);
    }
    groupMap.get(groupKey)!.push(i);
  }

  // Second pass: build flattened array with group headers
  const groupedRows: GroupedRow[] = [];
  currentGroupKey = null;

  for (const row of rows) {
    const groupKey = generateGroupKey(row, config);

    // Insert group header if group changed
    if (groupKey !== currentGroupKey) {
      groupedRows.push({
        type: "group-header",
        groupKey,
        groupLabel: generateGroupLabel(groupKey, config),
        groupCount: groupMap.get(groupKey)?.length || 0,
      });
      currentGroupKey = groupKey;
    }

    groupedRows.push({
      type: "row",
      row,
    });
  }

  return {
    groupedRows,
    groupMap,
    groupKeys,
  };
}

/**
 * Get just the group boundaries without flattening.
 * Useful for rendering group dividers in virtualized lists.
 */
export function getGroupBoundaries(
  rows: SemanticWireListRow[],
  config: WireListGroupConfig
): Map<number, { groupKey: string; groupLabel: string; groupCount: number }> {
  const boundaries = new Map<number, { groupKey: string; groupLabel: string; groupCount: number }>();
  let currentGroupKey: string | null = null;
  let currentGroupStart = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const groupKey = generateGroupKey(row, config);

    if (groupKey !== currentGroupKey) {
      // Count rows in this group
      let groupCount = 0;
      for (let j = i; j < rows.length; j++) {
        if (generateGroupKey(rows[j], config) === groupKey) {
          groupCount++;
        } else {
          break;
        }
      }

      boundaries.set(i, {
        groupKey,
        groupLabel: generateGroupLabel(groupKey, config),
        groupCount,
      });
      currentGroupKey = groupKey;
      currentGroupStart = i;
    }
  }

  return boundaries;
}

/**
 * Check if a row index is the first row of a new group.
 */
export function isGroupStart(
  rows: SemanticWireListRow[],
  index: number,
  config: WireListGroupConfig
): boolean {
  if (index === 0) return true;
  
  const currentKey = generateGroupKey(rows[index], config);
  const previousKey = generateGroupKey(rows[index - 1], config);
  
  return currentKey !== previousKey;
}

/**
 * Get the group info for a specific row index.
 */
export function getGroupInfoForRow(
  rows: SemanticWireListRow[],
  index: number,
  config: WireListGroupConfig
): { groupKey: string; groupLabel: string; isFirst: boolean } {
  const row = rows[index];
  const groupKey = generateGroupKey(row, config);
  const groupLabel = generateGroupLabel(groupKey, config);
  const isFirst = isGroupStart(rows, index, config);

  return { groupKey, groupLabel, isFirst };
}
