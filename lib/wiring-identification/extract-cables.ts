/**
 * Cable Extraction
 * 
 * Extracts rows that represent cable connections (WC#### wire type).
 * These are rows where the Type column contains a cable part number
 * like WC0019, WC7024, WC5540 instead of standard W/SC/JC types.
 * 
 * Cables are grouped together by their cable part number (WC####).
 */

import type { PatternExtractionContext, PatternMatchRow } from "./types";

// Common/standard wire types that are NOT cables
const STANDARD_WIRE_TYPES = new Set(["W", "SC", "JC", "JUMPER CLIP", "CLIP", ""]);

// Pattern for cable part numbers (WC followed by alphanumeric characters)
// Examples: WC0019, WC7024, WCCC7582, WCPDT6210, WC5540
const CABLE_TYPE_PATTERN = /^WC[A-Z0-9]+$/i;

/**
 * Check if a wire type represents a cable (WC#### pattern).
 * Matches WC followed by any combination of letters and numbers.
 */
export function isCableType(wireType: string): boolean {
  const normalized = (wireType || "").trim().toUpperCase();
  
  // Skip empty or standard types
  if (STANDARD_WIRE_TYPES.has(normalized)) return false;
  
  // Check for WC[alphanumeric] pattern
  return CABLE_TYPE_PATTERN.test(normalized);
}

/**
 * Check if a wire ID indicates a cable connection.
 * Wire ID = "CABLE" should be grouped with cables.
 */
export function isCableWireId(wireId: string): boolean {
  const normalized = (wireId || "").trim().toUpperCase();
  return normalized === "CABLE";
}

/**
 * Extract cable rows from the wire list.
 * Groups rows by their cable part number (WC####).
 */
export function extractCables(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows } = context;
  
  const matches: PatternMatchRow[] = [];
  
  // Group rows by cable type for run tracking
  const cableGroups = new Map<string, PatternMatchRow[]>();
  
  for (const row of rows) {
    const wireType = (row.wireType || "").trim().toUpperCase();
    const wireId = (row.wireId || "").trim().toUpperCase();
    
    // Match either WC#### type OR Wire ID = "CABLE"
    const isCableByType = isCableType(wireType);
    const isCableByWireId = isCableWireId(wireId);
    
    if (!isCableByType && !isCableByWireId) continue;
    
    // Use wire type as group key, or "CABLE" for Wire ID matches
    const groupKey = isCableByType ? wireType : "CABLE";
    
    const match: PatternMatchRow = {
      row,
      metadata: {
        matchType: "cables",
        badge: groupKey,
        meta: {
          cablePartNumber: groupKey,
          isEnetCable: wireId.includes("ENET"),
          isCableByWireId: isCableByWireId,
          gaugeSize: row.gaugeSize || "",
        },
      },
    };
    
    matches.push(match);
    
    // Track by group key for grouping
    if (!cableGroups.has(groupKey)) {
      cableGroups.set(groupKey, []);
    }
    cableGroups.get(groupKey)!.push(match);
  }
  
  // Add group metadata
  let runOrder = 0;
  for (const [cableType, groupMatches] of cableGroups) {
    for (let i = 0; i < groupMatches.length; i++) {
      const match = groupMatches[i]!;
      match.metadata.meta.runId = cableType;
      match.metadata.meta.runOrder = runOrder;
      match.metadata.meta.rowOrder = i;
      match.metadata.meta.groupSize = groupMatches.length;
    }
    runOrder++;
  }
  
  return matches;
}

/**
 * Count cable rows without full extraction.
 */
export function countCables(context: PatternExtractionContext): number {
  const { rows } = context;
  
  let count = 0;
  for (const row of rows) {
    const isCableByType = isCableType(row.wireType || "");
    const isCableByWireId = isCableWireId(row.wireId || "");
    
    if (isCableByType || isCableByWireId) {
      count++;
    }
  }
  
  return count;
}
