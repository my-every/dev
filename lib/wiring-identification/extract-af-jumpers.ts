/**
 * AF-Family Identity Jumper Extraction
 * 
 * AF-family identity jumpers are device-to-device connections between AF and AU devices.
 * 
 * Supported patterns:
 * - AF ↔ AF (e.g., AF0081:COM -> AF0082:COM)
 * - AU ↔ AF (e.g., AU0060:V+ -> AF0064:V+)
 * - AF ↔ AU (e.g., AF0064:COM -> AU0060:COM)
 * 
 * Rules:
 * - Both endpoints must be AF-family devices (AF or AU)
 * - Terminals must be the same identity termination (COM, SH, V+)
 * - Must NOT be a cable row
 * - Must NOT be a clip row
 * - Must be in same location context
 * - Devices MUST be sequential in Blue Labels (required when Blue Labels available)
 */

import type { PatternExtractionContext, PatternMatchRow, JumperMatch } from "./types";
import {
  enrichSemanticRow,
  isCableLikeRow,
  isClipLikeRow,
  isSameLocationContext,
  areSameAfFamilyIdentityTermination,
  areAfFamilyCompatible,
  normalizeAfFamilyTerminationIdentity,
} from "./device-parser";
import { areDevicesAdjacent, hasBlueLabelData } from "./blue-label-sequence";

/**
 * Check if two AF-family devices are numerically sequential.
 * E.g., AF0342 and AF0343 are sequential (+1 difference).
 * 
 * @param fromNumeric - From device numeric
 * @param toNumeric - To device numeric
 * @returns True if devices are numerically sequential
 */
function areNumericallySequential(fromNumeric: number | null, toNumeric: number | null): boolean {
  if (fromNumeric === null || toNumeric === null) return false;
  const diff = Math.abs(toNumeric - fromNumeric);
  return diff === 1;
}

/**
 * Check if a row qualifies as an AF-family identity jumper.
 * This is the core validation function that enforces all rules.
 * 
 * Matching criteria:
 * 1. Both endpoints must be AF-family devices (AF or AU)
 * 2. Terminals must match as identity terminations (COM, SH, V+)
 * 3. Must NOT be a cable or clip row
 * 4. Devices must be sequential - either:
 *    a. Adjacent in Blue Labels (if available), OR
 *    b. Numerically sequential (e.g., AF0342 -> AF0343)
 * 
 * @param context - Pattern extraction context
 * @param row - The semantic row to check
 * @returns Object with isMatch and match details, or null if not a match
 */
function isAfFamilyIdentityJumper(
  context: PatternExtractionContext,
  row: Parameters<typeof enrichSemanticRow>[0]
): {
  isMatch: true;
  enriched: ReturnType<typeof enrichSemanticRow>;
  isSequential: boolean;
  identityTerminal: string;
} | { isMatch: false } {
  const { currentSheetName, blueLabels } = context;

  // Exclude cable rows
  if (isCableLikeRow(row)) return { isMatch: false };

  // Exclude clip rows
  if (isClipLikeRow(row)) return { isMatch: false };

  const enriched = enrichSemanticRow(row, currentSheetName);

  if (!isSameLocationContext(enriched)) {
    return { isMatch: false };
  }

  // Both endpoints must be AF-family devices
  if (!areAfFamilyCompatible(enriched.fromParsed.prefix, enriched.toParsed.prefix)) {
    return { isMatch: false };
  }

  const isSameAfDevice =
    enriched.fromParsed.prefix === "AF" &&
    enriched.toParsed.prefix === "AF" &&
    enriched.fromParsed.deviceNumeric !== null &&
    enriched.fromParsed.deviceNumeric === enriched.toParsed.deviceNumeric;

  let identityTerminal: string = "";

  if (!isSameAfDevice) {
    // Terminals must be the same identity termination (COM, SH, V+)
    if (!areSameAfFamilyIdentityTermination(
      enriched.fromParsed.terminal,
      enriched.toParsed.terminal
    )) {
      return { isMatch: false };
    }

    const normalized = normalizeAfFamilyTerminationIdentity(enriched.fromParsed.terminal);
    if (!normalized) return { isMatch: false };
    identityTerminal = normalized;
  }

  if (isSameAfDevice) {
    return {
      isMatch: true,
      enriched,
      isSequential: true,
      identityTerminal: `${enriched.fromParsed.terminal || ""}→${enriched.toParsed.terminal || ""}`,
    };
  }

  // Check sequence - Blue Labels OR numeric adjacency
  let isSequential = false;

  // AF-family devices must ALWAYS be numerically sequential (±1).
  // A gap in device numbers (e.g., AF0094 → AF0096) means there is an
  // intermediate device (AF0095) even if it lives on another sheet,
  // so it cannot be a valid identity jumper pair.
  const numericallySequential = areNumericallySequential(
    enriched.fromParsed.deviceNumeric,
    enriched.toParsed.deviceNumeric
  );

  if (!numericallySequential) {
    return { isMatch: false };
  }

  // Once numeric adjacency is confirmed, prefer Blue Labels for ordering
  if (hasBlueLabelData(blueLabels)) {
    isSequential = areDevicesAdjacent(row.fromDeviceId, row.toDeviceId, blueLabels!);
  }

  // Accept numeric adjacency if Blue Labels don't cover these devices
  if (!isSequential) {
    isSequential = numericallySequential;
  }

  // Must be sequential (either by Blue Labels or numerically) to qualify
  if (!isSequential) {
    return { isMatch: false };
  }

  return {
    isMatch: true,
    enriched,
    isSequential,
    identityTerminal,
  };
}

/**
 * Generate a badge label for an AF-family identity jumper.
 * 
 * @param fromPrefix - From device prefix
 * @param toPrefix - To device prefix
 * @returns Human-readable badge
 */
function getAfFamilyJumperBadge(fromPrefix: string, toPrefix: string): string {
  const from = fromPrefix.toUpperCase();
  const to = toPrefix.toUpperCase();

  if (from === to) {
    return `${from} Identity Jumper`;
  }

  return `${from}/${to} Identity Jumper`;
}

/**
 * Extract AF-family identity jumper matches from the sheet.
 * 
 * Matches:
 * - AF ↔ AF identity jumpers
 * - AU ↔ AF identity jumpers  
 * - AF ↔ AU identity jumpers
 * 
 * All matches require:
 * - Same identity termination (COM, SH, V+)
 * - Sequential devices in Blue Labels
 * - Same location context
 * - Non-cable, non-clip rows
 * 
 * @param context - Pattern extraction context
 * @returns Array of AF-family identity jumper matches
 */
export function extractAfJumpers(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows } = context;
  const matches: JumperMatch[] = [];

  for (const row of rows) {
    const result = isAfFamilyIdentityJumper(context, row);

    if (!result.isMatch) continue;

    const { enriched, isSequential, identityTerminal } = result;

    const match: JumperMatch = {
      row,
      metadata: {
        matchType: "af_jumpers",
        badge: getAfFamilyJumperBadge(enriched.fromParsed.prefix, enriched.toParsed.prefix),
        meta: {
          fromDevice: enriched.fromParsed.original,
          toDevice: enriched.toParsed.original,
          fromPrefix: enriched.fromParsed.prefix,
          toPrefix: enriched.toParsed.prefix,
          terminal: identityTerminal,
          isSequential,
          isSameDevice: enriched.fromParsed.deviceNumeric !== null && enriched.fromParsed.deviceNumeric === enriched.toParsed.deviceNumeric,
          isAfAfJumper: enriched.fromParsed.prefix === "AF" && enriched.toParsed.prefix === "AF",
          isAuAfJumper: (enriched.fromParsed.prefix === "AU" && enriched.toParsed.prefix === "AF") ||
            (enriched.fromParsed.prefix === "AF" && enriched.toParsed.prefix === "AU"),
          fromDeviceNumeric: enriched.fromParsed.deviceNumeric ?? 0,
          toDeviceNumeric: enriched.toParsed.deviceNumeric ?? 0,
        },
      },
      jumperType: "af",
      fromPrefix: enriched.fromParsed.prefix,
      toPrefix: enriched.toParsed.prefix,
      fromTerminal: enriched.fromParsed.terminal,
      toTerminal: enriched.toParsed.terminal,
      isSequential,
    };

    matches.push(match);
  }

  return matches;
}

/**
 * Count AF-family identity jumper matches.
 * 
 * @param context - Pattern extraction context
 * @returns Count of AF-family identity jumper matches
 */
export function countAfJumpers(context: PatternExtractionContext): number {
  const { rows } = context;
  let count = 0;

  for (const row of rows) {
    const result = isAfFamilyIdentityJumper(context, row);
    if (result.isMatch) count++;
  }

  return count;
}

/**
 * Check if a row is a valid AF-family identity jumper.
 * Exported for use in other modules that need to check AF-family eligibility.
 * 
 * @param row - The row to check
 * @param context - Pattern extraction context
 * @returns True if the row is a valid AF-family identity jumper
 */
export function isSequentialAfFamilyJumper(
  row: Parameters<typeof enrichSemanticRow>[0],
  context: PatternExtractionContext
): boolean {
  const result = isAfFamilyIdentityJumper(context, row);
  return result.isMatch;
}
