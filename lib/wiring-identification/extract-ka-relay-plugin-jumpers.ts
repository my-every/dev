/**
 * Relay Mechanical Jumper Extraction
 * 
 * Identifies and groups KA relay mechanical jumper runs based on Blue Labels sequence.
 * 
 * Rules:
 * - A1 / ESTOP: terminal = A1, wireNo = ESTOP
 * - A2 / 0V: terminal = A2, wireNo = 0V
 * - Both endpoints must be KA devices
 * - Devices must be adjacent in Blue Labels sequence
 * - Blue Labels is the only valid source of device sequence order
 * - Both devices must share the same Part Number List part number
 * - Mechanical jumpers only apply to allowed relay part numbers
 * - A device is disqualified if it has a relay-jumper row to any device that is
 *   not its immediate Blue Labels neighbor for the current sheet
 * - Runs are built only from contiguous valid Blue Labels blocks
 * - Must be in the same location as current sheet
 * - Identity links are treated as undirected for grouping
 * - Minimum run length = 2 devices (1 link)
 */

import type { 
  PatternExtractionContext, 
  PatternMatchRow,
  RelayPluginJumperRun,
  RelayPluginJumperResult,
  RelayPluginSignalType,
  RelayPluginTerminal,
  BlueLabelSequenceMap,
} from "./types";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import { 
  enrichSemanticRow, 
  terminalsMatch,
  isCableLikeRow,
  isClipLikeRow,
  getBaseDeviceId,
} from "./device-parser";
import { 
  hasBlueLabelData, 
  areDevicesAdjacentInSheet,
  getSheetDeviceSequence,
} from "./blue-label-sequence";
import {
  getDevicePartNumberTokens,
  haveCompatibleJumperPartNumbers,
  isAllowedMechanicalRelayPartNumber,
  isMechanicalRelayFamilyDevice,
} from "./jumper-part-number";

// ============================================================================
// Configuration
// ============================================================================

/**
 * Relay plugin jumper signal configurations for standard patterns.
 */
const RELAY_PLUGIN_CONFIGS: Array<{
  terminal: RelayPluginTerminal;
  wireNo: string;
  signalType: RelayPluginSignalType;
}> = [
  { terminal: "A1", wireNo: "ESTOP", signalType: "ESTOP" },
  { terminal: "A2", wireNo: "0V", signalType: "0V" },
];

/**
 * Valid terminals for generic plugin jumper detection.
 * These are the coil-side terminals where plugin jumpers are typically used.
 */
const GENERIC_PLUGIN_TERMINALS: RelayPluginTerminal[] = ["A1", "A2"];

/**
 * Wire numbers to exclude from generic detection (already handled by standard configs).
 */
const EXCLUDED_WIRE_NOS = new Set(["ESTOP", "0V"]);

// ============================================================================
// Candidate Extraction
// ============================================================================

/**
 * A relay plugin jumper candidate row with parsed info.
 */
interface RelayPluginCandidate {
  row: SemanticWireListRow;
  fromDevice: string;
  toDevice: string;
  terminal: RelayPluginTerminal;
  signalType: RelayPluginSignalType;
  wireNo: string;
  location: string;
}

/**
 * Normalize a wire number for comparison.
 */
function normalizeWireNo(wireNo: string): string {
  return (wireNo || "").toUpperCase().trim();
}

/**
 * Check if a row's location matches the current sheet location.
 * Used to ensure relay mechanical jumpers are in the same location as the current sheet.
 */
function isInCurrentSheetLocation(
  rowLocation: string,
  currentSheetName: string
): boolean {
  if (!currentSheetName) return true; // If no sheet name, allow all
  
  const normalizedRow = (rowLocation || "").toUpperCase().trim();
  const normalizedSheet = currentSheetName.toUpperCase().trim();
  
  if (!normalizedRow || !normalizedSheet) return true;
  
  // Exact match
  if (normalizedRow === normalizedSheet) return true;
  
  // Location contains sheet name
  if (normalizedRow.includes(normalizedSheet)) return true;
  
  // Sheet name contains location
  if (normalizedSheet.includes(normalizedRow)) return true;
  
  // Word-based matching
  const sheetWords = normalizedSheet.split(/[\s,]+/).filter(w => w.length > 0);
  const locWords = normalizedRow.split(/[\s,]+/).filter(w => w.length > 0);
  
  // If all sheet name words appear in location
  const allSheetWordsInLoc = sheetWords.every(sw => 
    locWords.some(lw => lw.includes(sw) || sw.includes(lw))
  );
  if (allSheetWordsInLoc && sheetWords.length > 0) return true;
  
  return false;
}

/**
 * Normalize wire ID for comparison.
 */
function normalizeWireId(wireId: string): string {
  return (wireId || "").toUpperCase().trim();
}

/**
 * Check if a row qualifies as a relay plugin jumper candidate.
 * Handles both standard (ESTOP/0V) and generic (same wireId) patterns.
 */
function isRelayPluginJumperCandidate(
  row: SemanticWireListRow,
  context: PatternExtractionContext
): RelayPluginCandidate | null {
  const { currentSheetName, blueLabels } = context;

  // Mechanical relay jumper classification must be proven by both Blue Labels
  // order and Part Number List identity. If either source is unavailable, fail closed.
  if (!hasBlueLabelData(blueLabels)) return null;
  if (!context.partNumberMap || context.partNumberMap.size === 0) return null;
  
  // Exclude cable rows
  if (isCableLikeRow(row)) return null;
  
  // Exclude clip rows
  if (isClipLikeRow(row)) return null;
  
  // Must be in the same location as the current sheet
  const rowLocation = row.location || row.fromLocation || row.toLocation || "";
  if (!isInCurrentSheetLocation(rowLocation, currentSheetName)) return null;
  
  const enriched = enrichSemanticRow(row, currentSheetName);
  
  // Identify relay family by part number when available, with KA prefix as fallback
  // when part numbers are unavailable outside the strict extractor path.
  if (!isMechanicalRelayFamilyDevice(row.fromDeviceId, context.partNumberMap)) return null;
  if (!isMechanicalRelayFamilyDevice(row.toDeviceId, context.partNumberMap)) return null;

  if (!haveCompatibleJumperPartNumbers(row.fromDeviceId, row.toDeviceId, context)) return null;

  if (!isAllowedMechanicalRelayPartNumber(row.fromDeviceId, context)) return null;
  if (!isAllowedMechanicalRelayPartNumber(row.toDeviceId, context)) return null;
  
  // Terminals must match
  if (!terminalsMatch(enriched.fromParsed.terminal, enriched.toParsed.terminal)) return null;
  
  const terminal = enriched.fromParsed.terminal.toUpperCase().trim() as RelayPluginTerminal;
  const wireNo = normalizeWireNo(row.wireNo);
  
  // Check against standard configured rules first (ESTOP/0V)
  for (const config of RELAY_PLUGIN_CONFIGS) {
    if (terminal === config.terminal && wireNo === config.wireNo) {
      if (!areDevicesAdjacentInSheet(row.fromDeviceId, row.toDeviceId, currentSheetName, blueLabels!)) {
        return null;
      }
      
      return {
        row,
        fromDevice: getBaseDeviceId(row.fromDeviceId),
        toDevice: getBaseDeviceId(row.toDeviceId),
        terminal: config.terminal,
        signalType: config.signalType,
        wireNo: config.wireNo,
        location: row.location || "",
      };
    }
  }
  
  // Check for generic plugin jumper pattern:
  // - A1 to A1 or A2 to A2 (valid coil terminal)
  // - NOT ESTOP or 0V wire number
  // - Same wireNo on both sides (the wire number links the sequential devices)
  // - Adjacent devices in sequence
  if (GENERIC_PLUGIN_TERMINALS.includes(terminal)) {
    // Skip if this is a standard ESTOP/0V pattern (already handled above)
    if (EXCLUDED_WIRE_NOS.has(wireNo)) return null;

    if (!areDevicesAdjacentInSheet(row.fromDeviceId, row.toDeviceId, currentSheetName, blueLabels!)) return null;
    
    return {
      row,
      fromDevice: getBaseDeviceId(row.fromDeviceId),
      toDevice: getBaseDeviceId(row.toDeviceId),
      terminal,
      signalType: "GENERIC",
      wireNo: wireNo || terminal,
      location: row.location || "",
    };
  }
  
  return null;
}

/**
 * Extract all relay plugin jumper candidates from rows.
 */
function extractRelayPluginCandidates(
  context: PatternExtractionContext
): RelayPluginCandidate[] {
  const candidates: RelayPluginCandidate[] = [];
  
  for (const row of context.rows) {
    const candidate = isRelayPluginJumperCandidate(row, context);
    if (candidate) {
      candidates.push(candidate);
    }
  }
  
  return candidates;
}

// ============================================================================
// Grouping Logic
// ============================================================================

function getPairKey(deviceA: string, deviceB: string): string {
  return deviceA.localeCompare(deviceB) <= 0 ? `${deviceA}::${deviceB}` : `${deviceB}::${deviceA}`;
}

function getNormalizedMechanicalPartNumber(
  deviceId: string,
  context: PatternExtractionContext,
): string | null {
  const partNumber = getDevicePartNumberTokens(deviceId, context).find(
    (token) => token === "1061979-1" || token === "1061979-2",
  );

  return partNumber ?? null;
}

function buildCandidateRowMap(candidates: RelayPluginCandidate[]): Map<string, SemanticWireListRow[]> {
  const rowMap = new Map<string, SemanticWireListRow[]>();

  for (const candidate of candidates) {
    const key = getPairKey(candidate.fromDevice, candidate.toDevice);
    const rows = rowMap.get(key) ?? [];
    rows.push(candidate.row);
    rowMap.set(key, rows);
  }

  return rowMap;
}

function buildCandidatePartnerMap(candidates: RelayPluginCandidate[]): Map<string, Set<string>> {
  const partnerMap = new Map<string, Set<string>>();

  for (const candidate of candidates) {
    if (!partnerMap.has(candidate.fromDevice)) {
      partnerMap.set(candidate.fromDevice, new Set());
    }
    if (!partnerMap.has(candidate.toDevice)) {
      partnerMap.set(candidate.toDevice, new Set());
    }

    partnerMap.get(candidate.fromDevice)!.add(candidate.toDevice);
    partnerMap.get(candidate.toDevice)!.add(candidate.fromDevice);
  }

  return partnerMap;
}

function getImmediateSequenceNeighbors(sequence: string[], deviceId: string): Set<string> {
  const index = sequence.indexOf(deviceId);
  if (index === -1) return new Set<string>();

  const neighbors = new Set<string>();
  const previous = sequence[index - 1];
  const next = sequence[index + 1];

  if (previous) neighbors.add(previous);
  if (next) neighbors.add(next);

  return neighbors;
}

function buildValidMechanicalDeviceSet(
  candidates: RelayPluginCandidate[],
  sequence: string[],
  context: PatternExtractionContext,
): Set<string> {
  const validDevices = new Set<string>();
  const partnerMap = buildCandidatePartnerMap(candidates);

  for (const [deviceId, partners] of partnerMap.entries()) {
    const ownPartNumber = getNormalizedMechanicalPartNumber(deviceId, context);
    if (!ownPartNumber) {
      continue;
    }

    const immediateNeighbors = getImmediateSequenceNeighbors(sequence, deviceId);
    let isValid = true;

    for (const partner of partners) {
      if (!immediateNeighbors.has(partner)) {
        isValid = false;
        break;
      }

      if (getNormalizedMechanicalPartNumber(partner, context) !== ownPartNumber) {
        isValid = false;
        break;
      }
    }

    if (isValid) {
      validDevices.add(deviceId);
    }
  }

  return validDevices;
}

/**
 * Group candidates by terminal and signal type.
 * For generic patterns, also group by wireNo (wireId) to separate different wire runs.
 */
function groupCandidatesByTerminalAndSignal(
  candidates: RelayPluginCandidate[]
): Map<string, { terminal: RelayPluginTerminal; signalType: RelayPluginSignalType; wireNo: string; candidates: RelayPluginCandidate[] }> {
  const grouped = new Map<string, { terminal: RelayPluginTerminal; signalType: RelayPluginSignalType; wireNo: string; candidates: RelayPluginCandidate[] }>();
  
  for (const candidate of candidates) {
    const key = candidate.signalType === "GENERIC"
      ? `${candidate.terminal}-${candidate.signalType}-${candidate.wireNo}`
      : `${candidate.terminal}-${candidate.signalType}`;
    
    const existing = grouped.get(key);
    if (existing) {
      existing.candidates.push(candidate);
    } else {
      grouped.set(key, {
        terminal: candidate.terminal,
        signalType: candidate.signalType,
        wireNo: candidate.wireNo,
        candidates: [candidate],
      });
    }
  }
  
  return grouped;
}

export function isMechanicalKaJumperRow(
  row: SemanticWireListRow,
  context: PatternExtractionContext,
): boolean {
  return extractKaRelayPluginJumperRows(context).some((match) => match.row.__rowId === row.__rowId);
}

/**
 * Get rows for a specific device pair from candidates.
 */
function getRowsForDevices(
  deviceA: string,
  deviceB: string,
  candidates: RelayPluginCandidate[]
): SemanticWireListRow[] {
  return candidates
    .filter(c => 
      (c.fromDevice === deviceA && c.toDevice === deviceB) ||
      (c.fromDevice === deviceB && c.toDevice === deviceA)
    )
    .map(c => c.row);
}

// ============================================================================
// Run Building
// ============================================================================

/**
 * Build relay plugin jumper runs from candidates.
 */
function buildRelayPluginJumperRuns(
  candidates: RelayPluginCandidate[],
  context: PatternExtractionContext,
  currentSheetName: string,
  blueLabels: BlueLabelSequenceMap | null,
  terminal: RelayPluginTerminal,
  signalType: RelayPluginSignalType,
  wireNo: string,
): RelayPluginJumperRun[] {
  const runs: RelayPluginJumperRun[] = [];
  const sequence = hasBlueLabelData(blueLabels) ? getSheetDeviceSequence(currentSheetName, blueLabels!) : [];
  if (sequence.length === 0) {
    return runs;
  }

  const candidateRowMap = buildCandidateRowMap(candidates);
  const validDevices = buildValidMechanicalDeviceSet(candidates, sequence, context);

  let currentDevices: string[] = [];
  let currentRows: SemanticWireListRow[] = [];
  let currentRowIds = new Set<string>();

  const flushRun = () => {
    if (currentDevices.length < 2 || currentRows.length === 0) {
      currentDevices = [];
      currentRows = [];
      currentRowIds = new Set<string>();
      return;
    }

    runs.push({
      id: signalType === "GENERIC"
        ? `${terminal}-${signalType}-${wireNo}-${currentDevices[0]}-${currentDevices[currentDevices.length - 1]}`
        : `${terminal}-${signalType}-${currentDevices[0]}-${currentDevices[currentDevices.length - 1]}`,
      signalType,
      terminal,
      rowIds: Array.from(currentRowIds),
      devices: [...currentDevices],
      orderedDevices: [...currentDevices],
      startDeviceId: currentDevices[0],
      endDeviceId: currentDevices[currentDevices.length - 1],
      deviceCount: currentDevices.length,
      segmentCount: currentRows.length,
      location: currentRows[0]?.location || "",
      suggestedCutLengthLabel: `${currentDevices.length}`,
      rows: [...currentRows],
    });

    currentDevices = [];
    currentRows = [];
    currentRowIds = new Set<string>();
  };

  for (let index = 0; index < sequence.length - 1; index++) {
    const deviceA = sequence[index];
    const deviceB = sequence[index + 1];
    const pairRows = candidateRowMap.get(getPairKey(deviceA, deviceB)) ?? [];
    const pairIsValid = pairRows.length > 0 && validDevices.has(deviceA) && validDevices.has(deviceB);

    if (!pairIsValid) {
      flushRun();
      continue;
    }

    if (currentDevices.length === 0) {
      currentDevices = [deviceA, deviceB];
    } else if (currentDevices[currentDevices.length - 1] === deviceA) {
      currentDevices.push(deviceB);
    } else {
      flushRun();
      currentDevices = [deviceA, deviceB];
    }

    for (const row of pairRows) {
      if (!currentRowIds.has(row.__rowId)) {
        currentRowIds.add(row.__rowId);
        currentRows.push(row);
      }
    }
  }

  flushRun();
  
  return runs;
}

// ============================================================================
// Main Extraction
// ============================================================================

/**
 * Extract and group KA relay plugin jumper runs.
 * 
 * @param context - Pattern extraction context
 * @returns Relay plugin jumper result with runs and summary
 */
export function extractKaRelayPluginJumpers(
  context: PatternExtractionContext
): RelayPluginJumperResult {
  const { blueLabels, currentSheetName } = context;
  
  // Extract all candidates (includes both standard and generic patterns)
  const allCandidates = extractRelayPluginCandidates(context);
  
  // Group by terminal and signal type (generic patterns also group by wireNo)
  const groupedByTerminalAndSignal = groupCandidatesByTerminalAndSignal(allCandidates);
  
  // Build runs for each group
  const allRuns: RelayPluginJumperRun[] = [];
  
  for (const group of groupedByTerminalAndSignal.values()) {
    const runs = buildRelayPluginJumperRuns(
      group.candidates,
      context,
      currentSheetName,
      blueLabels,
      group.terminal,
      group.signalType,
      group.wireNo,
    );
    allRuns.push(...runs);
  }
  
  // Sort runs by terminal (A1 first, then A2) then by start device
  const sortedRuns = [...allRuns].sort((a, b) => {
    // A1 runs come before A2 runs
    if (a.terminal !== b.terminal) {
      return a.terminal === "A1" ? -1 : 1;
    }
    // Within same terminal, sort by start device
    return a.startDeviceId.localeCompare(b.startDeviceId);
  });
  
  // Convert runs to pattern match rows for filtering
  // Add runOrder for subsection grouping between each jumper run
  const patternMatchRows: PatternMatchRow[] = [];
  let runOrder = 0;
  
  for (const run of sortedRuns) {
    let rowOrder = 0;
    for (const row of run.rows) {
      // For generic patterns, show the wireNo in the badge
      const badge = run.signalType === "GENERIC" 
        ? `${run.terminal} (${row.wireNo || "Generic"})`
        : `${run.terminal} ${run.signalType}`;
      
      patternMatchRows.push({
        row,
        metadata: {
          matchType: "ka_relay_plugin_jumpers",
          badge,
          meta: {
            runId: run.id,
            terminal: run.terminal,
            signalType: run.signalType,
            deviceCount: run.deviceCount,
            segmentCount: run.segmentCount,
            startDevice: run.startDeviceId,
            endDevice: run.endDeviceId,
            cutLengthLabel: run.suggestedCutLengthLabel,
            // Add run ordering for subsection grouping
            runOrder,
            rowOrder,
            runDeviceCount: run.deviceCount,
            runSegmentCount: run.segmentCount,
          },
        },
      });
      rowOrder++;
    }
    runOrder++;
  }
  
  // Build summary
  const summary = {
    totalRuns: allRuns.length,
    a1Runs: allRuns.filter(r => r.terminal === "A1" && r.signalType !== "GENERIC").length,
    a2Runs: allRuns.filter(r => r.terminal === "A2" && r.signalType !== "GENERIC").length,
    genericRuns: allRuns.filter(r => r.signalType === "GENERIC").length,
    totalDevices: allRuns.reduce((sum, r) => sum + r.deviceCount, 0),
    totalSegments: allRuns.reduce((sum, r) => sum + r.segmentCount, 0),
  };
  
  return {
    runs: allRuns,
    rows: patternMatchRows,
    summary,
  };
}

/**
 * Extract relay plugin jumper rows for filter registry.
 * 
 * @param context - Pattern extraction context
 * @returns Array of pattern match rows
 */
export function extractKaRelayPluginJumperRows(
  context: PatternExtractionContext
): PatternMatchRow[] {
  const result = extractKaRelayPluginJumpers(context);
  return result.rows;
}

/**
 * Count relay plugin jumper matches.
 * Only count if there's at least one valid run (min 2 devices).
 * 
 * @param context - Pattern extraction context
 * @returns Count of rows in valid runs
 */
export function countKaRelayPluginJumpers(
  context: PatternExtractionContext
): number {
  const result = extractKaRelayPluginJumpers(context);
  // Only count if there are valid runs
  if (result.runs.length === 0) return 0;
  return result.rows.length;
}

/**
 * Check if relay plugin jumpers should be shown in dropdown.
 * Only show if at least one valid grouped run exists.
 * 
 * @param context - Pattern extraction context
 * @returns True if there are valid relay plugin jumper runs
 */
export function hasRelayPluginJumperRuns(
  context: PatternExtractionContext
): boolean {
  const result = extractKaRelayPluginJumpers(context);
  return result.runs.length > 0;
}
