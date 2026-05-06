/**
 * Single Connections Extractor
 * 
 * Extracts rows that are individual connections not part of other identity groups
 * (grounds, jumpers, clips, etc.). These are sorted by location.
 * 
 * Single connections are grouped by TO location, sorted alphabetically.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";
import type { PatternExtractionContext, PatternMatchRow } from "./types";
import { extractGrounds } from "./extract-grounds";
import { extractClips } from "./extract-clips";
import { extractAfJumpers } from "./extract-af-jumpers";
import { extractXtJumpers } from "./extract-xt-jumpers";
import { extractXtClips } from "./extract-xt-clips";
import { extractKaJumpers } from "./extract-ka-jumpers";
import { extractKaRelayPluginJumperRows } from "./extract-ka-relay-plugin-jumpers";
import { extractKaTwinFerrules } from "./extract-ka-twin-ferrules";
import { extractKtJumpers } from "./extract-kt-jumpers";
import { extractFuJumpers } from "./extract-fu-jumpers";
import { extractCables } from "./extract-cables";
import { extractVioJumpers } from "./extract-vio-jumpers";
import { extractResistors } from "./extract-resistors";

function buildExcludedRowIdSet(context: PatternExtractionContext): Set<string> {
  const excluded = new Set<string>();

  const extractionResults = [
    extractGrounds(context),
    extractClips(context),
    extractAfJumpers(context),
    extractXtJumpers(context),
    extractXtClips(context),
    extractKaJumpers(context),
    extractKaRelayPluginJumperRows(context),
    extractKaTwinFerrules(context),
    extractKtJumpers(context),
    extractFuJumpers(context),
    extractCables(context),
    extractVioJumpers(context),
    extractResistors(context),
  ];

  for (const matches of extractionResults) {
    for (const match of matches) {
      excluded.add(match.row.__rowId);
    }
  }

  return excluded;
}

/**
 * Extract rows that are single connections (not part of other identity groups).
 * These are individual wires that don't match ground, jumper, clip, or cable patterns.
 * 
 * Grouped by TO location, sorted alphabetically by location.
 */
export function extractSingleConnections(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows } = context;
  const matches: PatternMatchRow[] = [];
  const excludedRowIds = buildExcludedRowIdSet(context);
  
  for (const row of rows) {
    if (excludedRowIds.has(row.__rowId)) continue;
    
    // This is a single connection - not part of any identity group
    // Use TO location (where the wire goes) as the primary grouping
    const toLocation = row.location || row.fromLocation || "";
    
    matches.push({
      row,
      metadata: {
        matchType: "single_connections",
        badge: "Single",
        meta: {
          location: toLocation,
          toLocation,
        },
      },
    });
  }
  
  // Sort by TO location, then by device ID, then by row index
  // This groups all single connections going to the same location together
  matches.sort((a, b) => {
    const locA = (a.metadata.meta.toLocation as string) || "";
    const locB = (b.metadata.meta.toLocation as string) || "";
    
    const locCompare = locA.localeCompare(locB);
    if (locCompare !== 0) return locCompare;
    
    const deviceCompare = a.row.fromDeviceId.localeCompare(b.row.fromDeviceId);
    if (deviceCompare !== 0) return deviceCompare;
    
    return a.row.__rowIndex - b.row.__rowIndex;
  });
  
  return matches;
}

/**
 * Extract single connections grouped by location.
 * Returns an array of location groups, each containing the location and its rows.
 */
export function extractSingleConnectionsByLocation(context: PatternExtractionContext): { 
  location: string; 
  rows: PatternMatchRow[];
}[] {
  const matches = extractSingleConnections(context);
  
  // Group by location
  const locationMap = new Map<string, PatternMatchRow[]>();
  for (const match of matches) {
    const loc = (match.metadata.meta.toLocation as string) || "Unknown";
    if (!locationMap.has(loc)) {
      locationMap.set(loc, []);
    }
    locationMap.get(loc)!.push(match);
  }
  
  // Convert to array and sort by location
  return Array.from(locationMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([location, rows]) => ({ location, rows }));
}

/**
 * Count single connections without full extraction.
 */
export function countSingleConnections(context: PatternExtractionContext): number {
  return extractSingleConnections(context).length;
}
