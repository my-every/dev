/**
 * Ground Wire Extraction
 * 
 * Extracts ground wires based on wire color (GRN, GRN/YEL, GRN/YLW).
 * Classifies each as internal or external based on location vs current sheet.
 */

import type { PatternExtractionContext, PatternMatchRow, GroundMatch } from "./types";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import { enrichSemanticRow, isGroundColor } from "./device-parser";

/**
 * Extract all ground wire matches from the sheet.
 * 
 * @param context - Pattern extraction context
 * @returns Array of ground wire matches
 */
export function extractGrounds(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows, currentSheetName } = context;
  const matches: GroundMatch[] = [];
  
  for (const row of rows) {
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    if (!enriched.isGroundCandidate) continue;
    
    const groundColor = enriched.wireIdNormalized;
    const isInternal = enriched.isInternal;
    
    const match: GroundMatch = {
      row,
      metadata: {
        matchType: "grounds",
        badge: isInternal ? "Ground" : "External Ground",
        meta: {
          groundColor,
          isInternal,
          isExternal: !isInternal,
          location: row.location,
        },
      },
      isInternal,
      groundColor,
    };
    
    matches.push(match);
  }
  
  return matches;
}

/**
 * Count ground wire matches without full extraction.
 * 
 * @param context - Pattern extraction context
 * @returns Count of ground matches
 */
export function countGrounds(context: PatternExtractionContext): number {
  return context.rows.filter(row => isGroundColor(row.wireId)).length;
}

/**
 * Get ground summary statistics.
 * 
 * @param context - Pattern extraction context
 * @returns Summary with internal/external counts
 */
export function getGroundSummary(context: PatternExtractionContext): {
  total: number;
  internal: number;
  external: number;
} {
  const { rows, currentSheetName } = context;
  let internal = 0;
  let external = 0;
  
  for (const row of rows) {
    if (!isGroundColor(row.wireId)) continue;
    
    const enriched = enrichSemanticRow(row, currentSheetName);
    if (enriched.isInternal) {
      internal++;
    } else {
      external++;
    }
  }
  
  return {
    total: internal + external,
    internal,
    external,
  };
}

/**
 * Split semantic rows into ground rows and all remaining rows.
 * Preserves the input row order in both partitions.
 */
export function splitGroundRows(
  rows: SemanticWireListRow[],
  currentSheetName: string,
): {
  groundRows: SemanticWireListRow[];
  nonGroundRows: SemanticWireListRow[];
} {
  const matches = extractGrounds({
    rows,
    blueLabels: null,
    currentSheetName,
    normalizedSheetName: currentSheetName.trim().toUpperCase(),
  });

  const groundRowIds = new Set(matches.map((match) => match.row.__rowId));

  return {
    groundRows: rows.filter((row) => groundRowIds.has(row.__rowId)),
    nonGroundRows: rows.filter((row) => !groundRowIds.has(row.__rowId)),
  };
}
