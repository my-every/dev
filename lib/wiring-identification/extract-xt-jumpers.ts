/**
 * XT Jumper Extraction
 * 
 * XT Jumpers are wire-based jumpers between XT (Terminal Block) devices.
 * Strict rules:
 * - Both endpoints must be XT devices
 * - Must be SAME base device (XT0352:4 -> XT0352:5, not XT0351:2 -> XT7720:3)
 * - Terminal must increment by exactly +1
 * - Must NOT be a clip row (wireId = CLIP)
 * - Must NOT be a cable row (WC patterns, CABLE gauge)
 * - Must be in same location context
 */

import type { PatternExtractionContext, PatternMatchRow, JumperMatch } from "./types";
import { 
  enrichSemanticRow, 
  areSameBaseDevice, 
  areIncrementalNumericTerminals,
  isCableLikeRow,
  isClipLikeRow,
  isSameLocationContext,
} from "./device-parser";
import { haveCompatibleJumperPartNumbers } from "./jumper-part-number";

/**
 * Extract XT jumper matches from the sheet.
 * 
 * @param context - Pattern extraction context
 * @returns Array of XT jumper matches
 */
export function extractXtJumpers(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows, currentSheetName } = context;
  const matches: JumperMatch[] = [];
  
  for (const row of rows) {
    // Exclude cable rows
    if (isCableLikeRow(row)) continue;
    
    // Exclude clip rows (these go to XT Clips filter)
    if (isClipLikeRow(row)) continue;
    
    // Require same location context
    if (!isSameLocationContext(row, currentSheetName)) continue;
    
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    // Both endpoints must be XT devices
    if (enriched.fromParsed.prefix !== "XT") continue;
    if (enriched.toParsed.prefix !== "XT") continue;
    
    // Both must have numeric terminals
    if (enriched.fromParsed.terminalNumeric === null) continue;
    if (enriched.toParsed.terminalNumeric === null) continue;
    
    // STRICT: Must be same base device (e.g., XT0352 from both endpoints)
    if (!areSameBaseDevice(row.fromDeviceId, row.toDeviceId)) continue;

    if (!haveCompatibleJumperPartNumbers(row.fromDeviceId, row.toDeviceId, context)) continue;
    
    // STRICT: Terminal must increment by exactly +1
    if (!areIncrementalNumericTerminals(
      enriched.fromParsed.terminal,
      enriched.toParsed.terminal
    )) continue;
    
    const match: JumperMatch = {
      row,
      metadata: {
        matchType: "xt_jumpers",
        badge: "XT Jumper",
        meta: {
          fromDevice: enriched.fromParsed.original,
          toDevice: enriched.toParsed.original,
          fromTerminal: enriched.fromParsed.terminal,
          toTerminal: enriched.toParsed.terminal,
          sameDevice: true,
          fromDeviceNumeric: enriched.fromParsed.deviceNumeric ?? 0,
          toDeviceNumeric: enriched.toParsed.deviceNumeric ?? 0,
        },
      },
      jumperType: "xt",
      fromPrefix: "XT",
      toPrefix: "XT",
      fromTerminal: enriched.fromParsed.terminal,
      toTerminal: enriched.toParsed.terminal,
      isSequential: true,
    };
    
    matches.push(match);
  }
  
  return matches;
}

/**
 * Count XT jumper matches.
 * 
 * @param context - Pattern extraction context
 * @returns Count of XT jumper matches
 */
export function countXtJumpers(context: PatternExtractionContext): number {
  const { rows, currentSheetName } = context;
  let count = 0;
  
  for (const row of rows) {
    // Exclude cable rows
    if (isCableLikeRow(row)) continue;
    
    // Exclude clip rows
    if (isClipLikeRow(row)) continue;
    
    // Require same location context
    if (!isSameLocationContext(row, currentSheetName)) continue;
    
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    if (enriched.fromParsed.prefix !== "XT") continue;
    if (enriched.toParsed.prefix !== "XT") continue;
    if (enriched.fromParsed.terminalNumeric === null) continue;
    if (enriched.toParsed.terminalNumeric === null) continue;
    
    // Must be same base device
    if (!areSameBaseDevice(row.fromDeviceId, row.toDeviceId)) continue;

    if (!haveCompatibleJumperPartNumbers(row.fromDeviceId, row.toDeviceId, context)) continue;
    
    // Terminal must increment by +1
    if (!areIncrementalNumericTerminals(
      enriched.fromParsed.terminal,
      enriched.toParsed.terminal
    )) continue;
    
    count++;
  }
  
  return count;
}
