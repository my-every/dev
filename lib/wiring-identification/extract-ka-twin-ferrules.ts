/**
 * KA Twin Ferrule Extraction
 * 
 * Twin ferrules occur when the same KA terminal has multiple wires with the SAME WIRE NUMBER.
 * 
 * Rules:
 * - Device must be KA
 * - Group rows by (device ID, terminal, wireNo) - NOT wireId
 * - If group size >= 2, it's a twin ferrule candidate
 * - MUST EXCLUDE:
 *   - A1 terminal with wireNo containing "ESTOP" (these are plugin jumpers)
 *   - A2 terminal with wireNo containing "0V" (these are plugin jumpers)
 * - Twin ferrules share the SAME wire number (e.g., multiple wires labeled "456")
 * - Plugin jumpers (A1/ESTOP, A2/0V) are handled separately by extract-ka-relay-plugin-jumpers
 */

import type { PatternExtractionContext, PatternMatchRow, TwinFerruleMatch } from "./types";
import { enrichSemanticRow, getBaseDeviceId, terminalsMatch } from "./device-parser";
import { hasBlueLabelData, areDevicesAdjacent } from "./blue-label-sequence";
import type { SemanticWireListRow } from "@/lib/workbook/types";

/**
 * Check if a row is a relay plugin jumper (A1/ESTOP or A2/0V).
 * These are excluded from twin ferrule detection.
 */
function isStandardRelayPluginJumperRow(terminal: string, wireNo: string): boolean {
  const normalizedTerminal = (terminal || "").toUpperCase().trim();
  const normalizedWireNo = (wireNo || "").toUpperCase().trim();
  
  // A1 with ESTOP is a relay plugin jumper
  if (normalizedTerminal === "A1" && normalizedWireNo.includes("ESTOP")) {
    return true;
  }
  
  // A2 with 0V is a relay plugin jumper
  if (normalizedTerminal === "A2" && normalizedWireNo === "0V") {
    return true;
  }
  
  return false;
}

/**
 * Valid terminals for generic plugin jumper detection (coil-side terminals).
 */
const GENERIC_PLUGIN_TERMINALS = new Set(["A1", "A2"]);

/**
 * Check if a row is a generic relay plugin jumper.
 * Generic plugin jumpers are KA→KA connections with:
 * - Same coil-side terminal (A1 or A2)
 * - Sequential/adjacent devices
 * - NOT ESTOP or 0V (those are standard patterns)
 */
function isGenericRelayPluginJumperRow(
  row: SemanticWireListRow,
  context: PatternExtractionContext
): boolean {
  const { currentSheetName, blueLabels } = context;
  const enriched = enrichSemanticRow(row, currentSheetName);
  
  // Both endpoints must be KA devices
  if (enriched.fromParsed.prefix !== "KA") return false;
  if (enriched.toParsed.prefix !== "KA") return false;
  
  // Terminals must match
  if (!terminalsMatch(enriched.fromParsed.terminal, enriched.toParsed.terminal)) return false;
  
  const terminal = enriched.fromParsed.terminal.toUpperCase().trim();
  
  // Must be a coil-side terminal (A1 or A2)
  if (!GENERIC_PLUGIN_TERMINALS.has(terminal)) return false;
  
  // Must be adjacent in Blue Labels sequence
  if (!hasBlueLabelData(blueLabels)) return false;
  if (!areDevicesAdjacent(row.fromDeviceId, row.toDeviceId, blueLabels!)) return false;
  
  return true;
}

/**
 * Normalize wire number for grouping.
 */
function normalizeWireNo(wireNo: string): string {
  return (wireNo || "").toUpperCase().trim();
}

/**
 * Key for grouping twin ferrule candidates.
 * Groups by: device prefix, device number, terminal, and WIRE NUMBER (not wire ID).
 */
function getTwinFerruleKey(row: SemanticWireListRow): string {
  const enriched = enrichSemanticRow(row, "");
  const wireNoNorm = normalizeWireNo(row.wireNo);
  return `${enriched.fromParsed.prefix}|${enriched.fromParsed.deviceNumeric}|${enriched.fromParsed.terminal}|${wireNoNorm}`;
}

/**
 * Extract KA twin ferrule matches from the sheet.
 * Returns rows that are part of twin ferrule groups.
 * 
 * @param context - Pattern extraction context
 * @returns Array of pattern matches for rows in twin ferrule groups
 */
export function extractKaTwinFerrules(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows, currentSheetName } = context;
  const matches: PatternMatchRow[] = [];
  
  // First pass: group KA rows by (device, terminal, wireNo)
  // IMPORTANT: We group by WIRE NUMBER, not wire ID, as twin ferrules share the same wire number
  const groups = new Map<string, SemanticWireListRow[]>();
  
  for (const row of rows) {
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    // Only KA devices
    if (enriched.fromParsed.prefix !== "KA") continue;
    
    // Must have a terminal
    if (!enriched.fromParsed.terminal) continue;
    
    // Must have a wire number
    const wireNo = normalizeWireNo(row.wireNo);
    if (!wireNo) continue;
    
    // EXCLUDE standard relay plugin jumpers (A1/ESTOP, A2/0V) - these are handled separately
    if (isStandardRelayPluginJumperRow(enriched.fromParsed.terminal, row.wireNo)) continue;
    
    // EXCLUDE generic relay plugin jumpers (KA→KA, same A1/A2 terminal, sequential devices)
    if (isGenericRelayPluginJumperRow(row, context)) continue;
    
    const key = getTwinFerruleKey(row);
    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  }
  
  // Second pass: create matches for groups with 2+ rows (twin ferrules)
  for (const [key, groupRows] of groups) {
    if (groupRows.length < 2) continue;
    
    // Parse the key to get components
    const [prefix, deviceNumericStr, terminal, wireNo] = key.split("|");
    const deviceNumeric = parseInt(deviceNumericStr, 10);
    
    // Get unique gauges, wire IDs, and destinations
    const gauges = [...new Set(groupRows.map(r => r.gaugeSize || "---"))];
    const wireIds = [...new Set(groupRows.map(r => r.wireId || "---"))];
    const destinations = [...new Set(groupRows.map(r => r.toDeviceId))];
    
    // Create a match for each row in the group
    for (const row of groupRows) {
      const match: PatternMatchRow = {
        row,
        metadata: {
          matchType: "ka_twin_ferrules",
          badge: "Twin Ferrule",
          meta: {
            deviceId: `${prefix}${String(deviceNumeric).padStart(4, "0")}`,
            terminal,
            wireNo, // Use wire number, not wire ID
            wireIds: wireIds.join(", "), // Include wire IDs for reference
            wireCount: groupRows.length,
            gauges: gauges.join(", "),
            destinations: destinations.join(", "),
            groupKey: key,
          },
        },
      };
      
      matches.push(match);
    }
  }
  
  return matches;
}

/**
 * Get twin ferrule groups (for summary display).
 * 
 * @param context - Pattern extraction context
 * @returns Array of twin ferrule match groups
 */
export function getKaTwinFerruleGroups(context: PatternExtractionContext): TwinFerruleMatch[] {
  const { rows, currentSheetName } = context;
  const groups = new Map<string, SemanticWireListRow[]>();
  
  // Group KA rows by wire NUMBER (not wire ID)
  for (const row of rows) {
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    if (enriched.fromParsed.prefix !== "KA") continue;
    if (!enriched.fromParsed.terminal) continue;
    
    const wireNo = normalizeWireNo(row.wireNo);
    if (!wireNo) continue;
    
    // Exclude standard relay plugin jumpers (A1/ESTOP, A2/0V)
    if (isStandardRelayPluginJumperRow(enriched.fromParsed.terminal, row.wireNo)) continue;
    
    // Exclude generic relay plugin jumpers (KA→KA, same A1/A2 terminal, sequential devices)
    if (isGenericRelayPluginJumperRow(row, context)) continue;
    
    const key = getTwinFerruleKey(row);
    const existing = groups.get(key) || [];
    existing.push(row);
    groups.set(key, existing);
  }
  
  // Build match objects for groups with 2+ rows
  const ferruleMatches: TwinFerruleMatch[] = [];
  
  for (const [key, groupRows] of groups) {
    if (groupRows.length < 2) continue;
    
    const [, deviceNumericStr, terminal, wireNo] = key.split("|");
    const deviceNumeric = parseInt(deviceNumericStr, 10);
    const gauges = [...new Set(groupRows.map(r => r.gaugeSize || "---"))];
    
    ferruleMatches.push({
      deviceId: `KA${String(deviceNumeric).padStart(4, "0")}`,
      terminal,
      wireId: wireNo, // Note: wireId field stores wireNo for twin ferrules
      rows: groupRows,
      wireCount: groupRows.length,
      gauges,
    });
  }
  
  return ferruleMatches;
}

/**
 * Count rows that are part of twin ferrule groups.
 * 
 * @param context - Pattern extraction context
 * @returns Count of rows in twin ferrule groups
 */
export function countKaTwinFerrules(context: PatternExtractionContext): number {
  const { rows, currentSheetName } = context;
  const groups = new Map<string, number>();
  
  for (const row of rows) {
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    if (enriched.fromParsed.prefix !== "KA") continue;
    if (!enriched.fromParsed.terminal) continue;
    
    const wireNo = normalizeWireNo(row.wireNo);
    if (!wireNo) continue;
    
    // Exclude standard relay plugin jumpers (A1/ESTOP, A2/0V)
    if (isStandardRelayPluginJumperRow(enriched.fromParsed.terminal, row.wireNo)) continue;
    
    // Exclude generic relay plugin jumpers (KA→KA, same A1/A2 terminal, sequential devices)
    if (isGenericRelayPluginJumperRow(row, context)) continue;
    
    const key = getTwinFerruleKey(row);
    groups.set(key, (groups.get(key) || 0) + 1);
  }
  
  // Sum rows in groups with 2+ members
  let count = 0;
  for (const groupSize of groups.values()) {
    if (groupSize >= 2) {
      count += groupSize;
    }
  }
  
  return count;
}

// ============================================================================
// KA Termination Grouping Utilities
// ============================================================================

/**
 * Group structure for KA device terminations by terminal type.
 */
export interface KaTerminationGroup {
  /** Terminal type (A1, A2, 11, 12, 14, etc.) */
  terminal: string;
  /** Devices in sequence order (based on Blue Labels or numeric order) */
  devicesInSequence: string[];
  /** Rows for this terminal group */
  rows: SemanticWireListRow[];
  /** Wire numbers in this group */
  wireNumbers: string[];
  /** Whether all rows have the same wire number */
  sameWireNo: boolean;
  /** Count of unique wire numbers */
  uniqueWireNoCount: number;
}

/**
 * Result of KA termination grouping.
 */
export interface KaTerminationGroupingResult {
  /** A1 termination groups */
  a1Groups: KaTerminationGroup[];
  /** A2 termination groups */
  a2Groups: KaTerminationGroup[];
  /** Contact side groups (11, 12, 14, etc.) */
  contactGroups: KaTerminationGroup[];
  /** All groups combined */
  allGroups: KaTerminationGroup[];
}

/**
 * Get numeric device value for sorting.
 */
function getDeviceNumeric(deviceId: string): number {
  const match = deviceId.match(/KA(\d+)/i);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Group all KA device terminations by terminal type (A1, A2, contact side).
 * Groups are sorted by device sequence (Blue Labels or numeric).
 * 
 * @param context - Pattern extraction context
 * @returns Grouped KA terminations
 */
export function groupKaTerminationsByTerminal(
  context: PatternExtractionContext
): KaTerminationGroupingResult {
  const { rows, currentSheetName, blueLabels } = context;
  
  // Group by terminal
  const terminalGroups = new Map<string, SemanticWireListRow[]>();
  
  for (const row of rows) {
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    // Only KA devices
    if (enriched.fromParsed.prefix !== "KA") continue;
    if (!enriched.fromParsed.terminal) continue;
    
    const terminal = enriched.fromParsed.terminal.toUpperCase().trim();
    const existing = terminalGroups.get(terminal) || [];
    existing.push(row);
    terminalGroups.set(terminal, existing);
  }
  
  // Build grouped result
  const buildGroup = (terminal: string, groupRows: SemanticWireListRow[]): KaTerminationGroup => {
    // Get unique devices
    const devices = [...new Set(groupRows.map(r => {
      const enriched = enrichSemanticRow(r, currentSheetName);
      return `KA${String(enriched.fromParsed.deviceNumeric ?? 0).padStart(4, "0")}`;
    }))];
    
    // Sort devices by Blue Labels sequence or numeric order
    let sortedDevices: string[];
    if (blueLabels?.isValid) {
      sortedDevices = devices.sort((a, b) => {
        const indexA = blueLabels.deviceMap.get(a)?.sequenceIndex ?? Infinity;
        const indexB = blueLabels.deviceMap.get(b)?.sequenceIndex ?? Infinity;
        if (indexA !== Infinity && indexB !== Infinity) {
          return indexA - indexB;
        }
        return getDeviceNumeric(a) - getDeviceNumeric(b);
      });
    } else {
      sortedDevices = devices.sort((a, b) => getDeviceNumeric(a) - getDeviceNumeric(b));
    }
    
    // Get wire numbers
    const wireNumbers = [...new Set(groupRows.map(r => normalizeWireNo(r.wireNo)).filter(Boolean))];
    
    return {
      terminal,
      devicesInSequence: sortedDevices,
      rows: groupRows,
      wireNumbers,
      sameWireNo: wireNumbers.length <= 1,
      uniqueWireNoCount: wireNumbers.length,
    };
  };
  
  const a1Groups: KaTerminationGroup[] = [];
  const a2Groups: KaTerminationGroup[] = [];
  const contactGroups: KaTerminationGroup[] = [];
  
  for (const [terminal, groupRows] of terminalGroups) {
    const group = buildGroup(terminal, groupRows);
    
    if (terminal === "A1") {
      a1Groups.push(group);
    } else if (terminal === "A2") {
      a2Groups.push(group);
    } else {
      contactGroups.push(group);
    }
  }
  
  // Sort contact groups by terminal number
  contactGroups.sort((a, b) => {
    const numA = parseInt(a.terminal, 10) || 0;
    const numB = parseInt(b.terminal, 10) || 0;
    return numA - numB;
  });
  
  return {
    a1Groups,
    a2Groups,
    contactGroups,
    allGroups: [...a1Groups, ...a2Groups, ...contactGroups],
  };
}

/**
 * Check if a KA termination group qualifies for twin ferrule.
 * Twin ferrule requires:
 * - Same wire number (not ESTOP or 0V)
 * - Multiple rows (2+)
 * 
 * @param group - KA termination group
 * @returns True if this is a valid twin ferrule group
 */
export function isValidTwinFerruleGroup(group: KaTerminationGroup): boolean {
  // Must have multiple rows
  if (group.rows.length < 2) return false;
  
  // Must have same wire number
  if (!group.sameWireNo) return false;
  
  // Exclude ESTOP (A1) and 0V (A2) - these are plugin jumpers
  const wireNo = group.wireNumbers[0] || "";
  if (wireNo === "ESTOP" || wireNo === "0V") return false;
  
  // Check terminal - A1 with ESTOP or A2 with 0V are plugin jumpers
  if (group.terminal === "A1" && wireNo.includes("ESTOP")) return false;
  if (group.terminal === "A2" && wireNo === "0V") return false;
  
  return true;
}
