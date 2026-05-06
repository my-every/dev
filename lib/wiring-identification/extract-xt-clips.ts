/**
 * XT Clip Extraction
 * 
 * XT Clips are clip-based connections (CLIP wire ID) between XT terminals.
 * Rules:
 * - Wire ID is "CLIP"
 * - Wire type may be "JC" (Jumper Clip)
 * - Both endpoints are XT devices
 * - Same device preferred
 * - Terminals differ by 1
 */

import type { PatternExtractionContext, PatternMatchRow, JumperMatch } from "./types";
import { enrichSemanticRow, isIncrementalTerminalSequence } from "./device-parser";
import { CLIP_WIRE_IDS, JUMPER_CLIP_TYPES } from "./constants";

/**
 * Check if a wire ID indicates a clip.
 */
function isClipWireId(wireId: string): boolean {
  const normalized = (wireId || "").toUpperCase().trim();
  return CLIP_WIRE_IDS.has(normalized);
}

/**
 * Check if a wire type indicates a jumper clip.
 */
function isJumperClipType(wireType: string): boolean {
  const normalized = (wireType || "").toUpperCase().trim();
  return JUMPER_CLIP_TYPES.has(normalized);
}

/**
 * Extract XT clip matches from the sheet.
 * 
 * @param context - Pattern extraction context
 * @returns Array of XT clip matches
 */
export function extractXtClips(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows, currentSheetName } = context;
  const matches: JumperMatch[] = [];
  
  for (const row of rows) {
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    // Wire ID must be CLIP
    if (!isClipWireId(row.wireId)) continue;
    
    // Both endpoints should be XT devices
    if (enriched.fromParsed.prefix !== "XT") continue;
    if (enriched.toParsed.prefix !== "XT") continue;
    
    // Check terminals are numeric
    const hasNumericTerminals = 
      enriched.fromParsed.terminalNumeric !== null &&
      enriched.toParsed.terminalNumeric !== null;
    
    // Check if terminals differ by 1
    const isIncremental = hasNumericTerminals && isIncrementalTerminalSequence(
      enriched.fromParsed.terminal,
      enriched.toParsed.terminal
    );
    
    // Same device is preferred
    const sameDevice = enriched.fromParsed.deviceNumeric === enriched.toParsed.deviceNumeric;
    
    // Determine clip pole count based on terminal difference
    let poleHint = "";
    if (hasNumericTerminals && enriched.fromParsed.terminalNumeric !== null && enriched.toParsed.terminalNumeric !== null) {
      const diff = Math.abs(enriched.toParsed.terminalNumeric - enriched.fromParsed.terminalNumeric);
      if (diff === 1) poleHint = "2-pole";
    }
    
    const match: JumperMatch = {
      row,
      metadata: {
        matchType: "xt_clips",
        badge: "XT Clip",
        meta: {
          fromDevice: enriched.fromParsed.original,
          toDevice: enriched.toParsed.original,
          fromTerminal: enriched.fromParsed.terminal,
          toTerminal: enriched.toParsed.terminal,
          sameDevice,
          isIncremental,
          isJumperClipType: isJumperClipType(row.wireType),
          poleHint,
        },
      },
      jumperType: "xt_clip",
      fromPrefix: "XT",
      toPrefix: "XT",
      fromTerminal: enriched.fromParsed.terminal,
      toTerminal: enriched.toParsed.terminal,
      isSequential: sameDevice,
    };
    
    matches.push(match);
  }
  
  return matches;
}

/**
 * Count XT clip matches.
 * 
 * @param context - Pattern extraction context
 * @returns Count of XT clip matches
 */
export function countXtClips(context: PatternExtractionContext): number {
  const { rows, currentSheetName } = context;
  let count = 0;
  
  for (const row of rows) {
    if (!isClipWireId(row.wireId)) continue;
    
    const enriched = enrichSemanticRow(row, currentSheetName);
    if (enriched.fromParsed.prefix !== "XT") continue;
    if (enriched.toParsed.prefix !== "XT") continue;
    
    count++;
  }
  
  return count;
}
