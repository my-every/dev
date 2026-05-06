/**
 * Clip Extraction
 * 
 * Clips are clip-based connections identified by:
 * - Wire ID = "CLIP"
 * - Wire Type = "JC" (Jumper Clip)
 * 
 * This is the broad "Clips" filter that includes all clip rows.
 * XT Clips is a more specific subset.
 */

import type { PatternExtractionContext, PatternMatchRow } from "./types";
import { enrichSemanticRow, isClipLikeRow } from "./device-parser";

/**
 * Extract all clip matches from the sheet.
 * 
 * @param context - Pattern extraction context
 * @returns Array of clip matches
 */
export function extractClips(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows, currentSheetName } = context;
  const matches: PatternMatchRow[] = [];
  
  for (const row of rows) {
    // Must be a clip-like row
    if (!isClipLikeRow(row)) continue;
    
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    // Determine clip subtype based on device prefix
    let clipType = "generic";
    if (enriched.fromParsed.prefix === "XT" && enriched.toParsed.prefix === "XT") {
      clipType = "xt_clip";
    }
    
    const match: PatternMatchRow = {
      row,
      metadata: {
        matchType: "clips",
        badge: "Clip",
        meta: {
          clipType,
          fromDevice: enriched.fromParsed.original,
          toDevice: enriched.toParsed.original,
          wireId: row.wireId,
          wireType: row.wireType,
        },
      },
    };
    
    matches.push(match);
  }
  
  return matches;
}

/**
 * Count all clip matches.
 * 
 * @param context - Pattern extraction context
 * @returns Count of clip matches
 */
export function countClips(context: PatternExtractionContext): number {
  const { rows } = context;
  let count = 0;
  
  for (const row of rows) {
    if (isClipLikeRow(row)) count++;
  }
  
  return count;
}
