/**
 * VIO Jumpers Extraction
 * 
 * Extracts rows where Wire ID is "VIO".
 * These are typically identity jumpers for VIO (Violet) connections.
 */

import type { PatternExtractionContext, PatternMatchRow } from "./types";

/**
 * Check if a row is a VIO jumper (Wire ID = "VIO").
 */
export function isVioJumper(wireId: string): boolean {
  const normalized = (wireId || "").trim().toUpperCase();
  return normalized === "VIO";
}

/**
 * Extract VIO jumper rows from the wire list.
 * Groups by base device ID (e.g. "XT0089") for pairing.
 */
export function extractVioJumpers(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows } = context;

  const matches: PatternMatchRow[] = [];

  // Group by fromDeviceId base (e.g. "XT0089") for run tracking
  const deviceGroups = new Map<string, PatternMatchRow[]>();

  for (const row of rows) {
    const wireId = (row.wireId || "").trim().toUpperCase();

    if (!isVioJumper(wireId)) continue;

    // Extract base device ID for grouping (e.g. "XT0089" from "XT0089:13")
    const fromDevice = (row.fromDeviceId || "").trim().toUpperCase();
    const baseDevice = fromDevice.split(":")[0]?.trim() || "UNKNOWN";

    const match: PatternMatchRow = {
      row,
      metadata: {
        matchType: "vio_jumpers",
        badge: "VIO",
        meta: {
          devicePrefix: baseDevice,
          fromDevice: row.fromDeviceId,
          toDevice: row.toDeviceId,
          gaugeSize: row.gaugeSize || "",
        },
      },
    };

    matches.push(match);

    // Track by base device ID for grouping
    if (!deviceGroups.has(baseDevice)) {
      deviceGroups.set(baseDevice, []);
    }
    deviceGroups.get(baseDevice)!.push(match);
  }

  // Add run metadata — group by base device ID
  let runOrder = 0;
  for (const [baseDevice, groupMatches] of deviceGroups) {
    for (let i = 0; i < groupMatches.length; i++) {
      const match = groupMatches[i]!;
      match.metadata.meta.runId = baseDevice;
      match.metadata.meta.runOrder = runOrder;
      match.metadata.meta.rowOrder = i;
      match.metadata.meta.groupSize = groupMatches.length;
    }
    runOrder++;
  }

  return matches;
}

/**
 * Count VIO jumper rows without full extraction.
 */
export function countVioJumpers(context: PatternExtractionContext): number {
  const { rows } = context;

  let count = 0;
  for (const row of rows) {
    if (isVioJumper(row.wireId || "")) {
      count++;
    }
  }

  return count;
}
