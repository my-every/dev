/**
 * Presence Detection
 * 
 * Scans the current sheet to determine which identification filters have matches.
 * Used to conditionally show filter options in the dropdown.
 * 
 * Important: The counts must reflect the refined logic:
 * - Jumpers = AF + XT + KA + KT jumpers (NOT clips)
 * - Clips = all clip-like rows
 * - XT Jumpers must pass strict same-device + terminal +1 + location rules
 * - Cable rows are excluded from jumper counts
 */

import type { 
  IdentificationFilterKind, 
  IdentificationPresenceMap, 
  PatternExtractionContext,
  BlueLabelSequenceMap 
} from "./types";
import type { PartNumberLookupResult } from "@/lib/part-number-list";
import type { SemanticWireListRow } from "@/lib/workbook/types";

import { countGrounds } from "./extract-grounds";
import { countClips } from "./extract-clips";
import { countAfJumpers } from "./extract-af-jumpers";
import { countXtJumpers } from "./extract-xt-jumpers";
import { countXtClips } from "./extract-xt-clips";
import { countKaJumpers } from "./extract-ka-jumpers";
import { countKaTwinFerrules } from "./extract-ka-twin-ferrules";
import { countKtJumpers } from "./extract-kt-jumpers";
import { countKaRelayPluginJumpers } from "./extract-ka-relay-plugin-jumpers";
import { countFuJumpers } from "./extract-fu-jumpers";
import { countCables } from "./extract-cables";
import { countSingleConnections } from "./extract-single-connections";
import { countVioJumpers } from "./extract-vio-jumpers";
import { countResistors } from "./extract-resistors";
import { hasBlueLabelData, normalizeSheetName } from "./blue-label-sequence";

/**
 * Build a presence map showing which filters have matches.
 * 
 * @param rows - Semantic wire list rows
 * @param blueLabels - Blue Labels sequence map (if available)
 * @param currentSheetName - Current sheet name
 * @returns Presence map with counts for each filter
 */
export function buildIdentificationPresenceMap(
  rows: SemanticWireListRow[],
  blueLabels: BlueLabelSequenceMap | null,
  currentSheetName: string,
  partNumberMap: Map<string, PartNumberLookupResult> | null = null,
): IdentificationPresenceMap {
  const normalizedSheetName = normalizeSheetName(currentSheetName);
  
  // Build extraction context
  const context: PatternExtractionContext = {
    rows,
    blueLabels,
    currentSheetName,
    normalizedSheetName,
    partNumberMap,
  };
  
  // Get counts for each filter
  const groundsCount = countGrounds(context);
  const clipsCount = countClips(context);
  const afJumpersCount = countAfJumpers(context);
  const xtJumpersCount = countXtJumpers(context);
  const xtClipsCount = countXtClips(context);
  const kaJumpersCount = countKaJumpers(context);
  const kaTwinFerruleCount = countKaTwinFerrules(context);
  const ktJumpersCount = countKtJumpers(context);
  const kaRelayPluginJumpersCount = countKaRelayPluginJumpers(context);
  const fuJumpersCount = countFuJumpers(context);
  const cablesCount = countCables(context);
  const singleConnectionsCount = countSingleConnections(context);
  const vioJumpersCount = countVioJumpers(context);
  const resistorsCount = countResistors(context);
  
  // Jumpers is the union of actual jumper types (NOT clips)
  // This ensures clips don't inflate the jumper count
  const jumpersCount = afJumpersCount + xtJumpersCount + kaJumpersCount + ktJumpersCount + fuJumpersCount;
  
  const counts: Record<IdentificationFilterKind, number> = {
    default: rows.length,
    grounds: groundsCount,
    jumpers: jumpersCount,
    clips: clipsCount,
    cables: cablesCount,
    single_connections: singleConnectionsCount,
    af_jumpers: afJumpersCount,
    xt_jumpers: xtJumpersCount,
    xt_clips: xtClipsCount,
    ka_jumpers: kaJumpersCount,
    ka_relay_plugin_jumpers: kaRelayPluginJumpersCount,
    ka_twin_ferrules: kaTwinFerruleCount,
    kt_jumpers: ktJumpersCount,
    fu_jumpers: fuJumpersCount,
    vio_jumpers: vioJumpersCount,
    resistors: resistorsCount,
  };
  
  return {
    counts,
    hasBlueLabels: hasBlueLabelData(blueLabels),
    currentSheetName,
  };
}

/**
 * Check if a specific filter has any matches.
 * 
 * @param presenceMap - The presence map
 * @param kind - The filter kind to check
 * @returns True if the filter has matches
 */
export function filterHasMatches(
  presenceMap: IdentificationPresenceMap,
  kind: IdentificationFilterKind
): boolean {
  return presenceMap.counts[kind] > 0;
}

/**
 * Get the count for a specific filter.
 * 
 * @param presenceMap - The presence map
 * @param kind - The filter kind
 * @returns Count of matches
 */
export function getFilterCount(
  presenceMap: IdentificationPresenceMap,
  kind: IdentificationFilterKind
): number {
  return presenceMap.counts[kind];
}
