/**
 * KA Wire Jumper Extraction
 * 
 * KA Wire Jumpers are device-to-device WIRE connections between KA (Relay) devices.
 * 
 * Rules:
 * - Both endpoints must be KA relays
 * - Terminals must match exactly (same-identity: A1->A1, A2->A2, 11->11, etc.)
 * - Terminal must be in the allow list
 * - Devices MUST be sequential in Blue Labels
 * - Must NOT be a cable row
 * - Must NOT be a clip row
 * - Must be in same location context
 * - Must NOT be a relay plugin jumper row (A1 ESTOP or A2 0V plugin bars)
 * 
 * KA Side Map:
 * - Coil side: A1, A2
 * - Contact side: 11, 12, 14, 21, 22, 24, 31, 32, 34, 41, 42, 44
 * 
 * This filter is for WIRE jumpers only, not plugin jumper bars.
 */

import type { PatternExtractionContext, PatternMatchRow, JumperMatch } from "./types";
import { 
  enrichSemanticRow, 
  terminalsMatch,
  isCableLikeRow,
  isClipLikeRow,
  isSameLocationContext,
} from "./device-parser";
import { areDevicesAdjacentInSheet, getSheetDeviceSequence, hasBlueLabelData } from "./blue-label-sequence";
import { KA_JUMPER_TERMINALS, getKaSide } from "./constants";
import { isMechanicalKaJumperRow } from "./extract-ka-relay-plugin-jumpers";
import { haveCompatibleJumperPartNumbers } from "./jumper-part-number";

interface ProvisionalKaJumperMatch extends JumperMatch {
  metadata: JumperMatch["metadata"] & {
    meta: JumperMatch["metadata"]["meta"] & {
      fromBaseDevice: string;
      toBaseDevice: string;
      location: string;
    };
  };
}

interface KaJumperCandidate {
  row: SemanticWireListRow;
  fromBaseDevice: string;
  toBaseDevice: string;
  terminal: string;
  location: string;
  enriched: ReturnType<typeof enrichSemanticRow>;
}

function getBaseDeviceId(deviceId: string): string {
  return deviceId.split(":")[0]?.trim() || deviceId.trim();
}

function buildKaRunBucketKey(match: ProvisionalKaJumperMatch): string {
  return [
    String(match.metadata.meta.location ?? ""),
    String(match.metadata.meta.terminal ?? ""),
  ].join("|");
}

function buildKaCandidateBucketKey(candidate: KaJumperCandidate): string {
  return [candidate.location, candidate.terminal].join("|");
}

function getPairKey(deviceA: string, deviceB: string): string {
  return deviceA.localeCompare(deviceB) <= 0 ? `${deviceA}::${deviceB}` : `${deviceB}::${deviceA}`;
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

function buildValidKaDevices(
  candidates: KaJumperCandidate[],
  currentSheetName: string,
  blueLabels: NonNullable<PatternExtractionContext["blueLabels"]>,
): Set<string> {
  const sequence = getSheetDeviceSequence(currentSheetName, blueLabels);
  if (sequence.length === 0) return new Set<string>();

  const partnerMap = new Map<string, Set<string>>();

  for (const candidate of candidates) {
    if (!partnerMap.has(candidate.fromBaseDevice)) {
      partnerMap.set(candidate.fromBaseDevice, new Set());
    }
    if (!partnerMap.has(candidate.toBaseDevice)) {
      partnerMap.set(candidate.toBaseDevice, new Set());
    }

    partnerMap.get(candidate.fromBaseDevice)!.add(candidate.toBaseDevice);
    partnerMap.get(candidate.toBaseDevice)!.add(candidate.fromBaseDevice);
  }

  const validDevices = new Set<string>();

  for (const [deviceId, partners] of partnerMap.entries()) {
    const immediateNeighbors = getImmediateSequenceNeighbors(sequence, deviceId);
    const isValid = Array.from(partners).every((partner) => immediateNeighbors.has(partner));

    if (isValid) {
      validDevices.add(deviceId);
    }
  }

  return validDevices;
}

function orderKaDevices(devices: string[]): string[] {
  return Array.from(new Set(devices)).sort((left, right) => {
    const leftNumber = Number.parseInt(left.replace(/^[A-Z]+/i, ""), 10);
    const rightNumber = Number.parseInt(right.replace(/^[A-Z]+/i, ""), 10);

    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return left.localeCompare(right);
  });
}

function applyKaRunMetadata(matches: ProvisionalKaJumperMatch[]): PatternMatchRow[] {
  const matchesByBucket = new Map<string, ProvisionalKaJumperMatch[]>();

  for (const match of matches) {
    const bucketKey = buildKaRunBucketKey(match);
    const bucket = matchesByBucket.get(bucketKey) ?? [];
    bucket.push(match);
    matchesByBucket.set(bucketKey, bucket);
  }

  const enrichedMatches: Array<{ match: PatternMatchRow; runOrder: number; rowOrder: number }> = [];
  let nextRunOrder = 0;

  for (const bucketMatches of matchesByBucket.values()) {
    const deviceGraph = new Map<string, Set<string>>();

    for (const match of bucketMatches) {
      const fromBaseDevice = String(match.metadata.meta.fromBaseDevice);
      const toBaseDevice = String(match.metadata.meta.toBaseDevice);

      if (!deviceGraph.has(fromBaseDevice)) deviceGraph.set(fromBaseDevice, new Set());
      if (!deviceGraph.has(toBaseDevice)) deviceGraph.set(toBaseDevice, new Set());

      deviceGraph.get(fromBaseDevice)!.add(toBaseDevice);
      deviceGraph.get(toBaseDevice)!.add(fromBaseDevice);
    }

    const visited = new Set<string>();
    const components: string[][] = [];

    for (const startDevice of deviceGraph.keys()) {
      if (visited.has(startDevice)) continue;

      const component: string[] = [];
      const stack = [startDevice];

      while (stack.length > 0) {
        const device = stack.pop()!;
        if (visited.has(device)) continue;

        visited.add(device);
        component.push(device);

        for (const neighbor of deviceGraph.get(device) ?? []) {
          if (!visited.has(neighbor)) {
            stack.push(neighbor);
          }
        }
      }

      components.push(component);
    }

    const orderedComponents = components
      .map((componentDevices) => {
        const orderedDevices = orderKaDevices(componentDevices);
        const componentRows = bucketMatches.filter((match) => {
          const fromBaseDevice = String(match.metadata.meta.fromBaseDevice);
          const toBaseDevice = String(match.metadata.meta.toBaseDevice);
          return orderedDevices.includes(fromBaseDevice) && orderedDevices.includes(toBaseDevice);
        });

        return { orderedDevices, componentRows };
      })
      .sort((left, right) => {
        const leftStart = left.orderedDevices[0] ?? "";
        const rightStart = right.orderedDevices[0] ?? "";
        return orderKaDevices([leftStart, rightStart])[0] === leftStart ? -1 : 1;
      });

    for (const component of orderedComponents) {
      const runOrder = nextRunOrder++;
      const startDevice = component.orderedDevices[0] ?? "";
      const endDevice = component.orderedDevices[component.orderedDevices.length - 1] ?? startDevice;
      const componentRowOrder = [...component.componentRows].sort((left, right) => {
        const leftNumeric = Number(left.metadata.meta.fromDeviceNumeric ?? left.row.__rowIndex);
        const rightNumeric = Number(right.metadata.meta.fromDeviceNumeric ?? right.row.__rowIndex);
        if (leftNumeric !== rightNumeric) {
          return leftNumeric - rightNumeric;
        }

        return left.row.__rowIndex - right.row.__rowIndex;
      });

      componentRowOrder.forEach((match, rowOrder) => {
        enrichedMatches.push({
          runOrder,
          rowOrder,
          match: {
            ...match,
            metadata: {
              ...match.metadata,
              meta: {
                ...match.metadata.meta,
                runId: `${buildKaRunBucketKey(match)}::${startDevice}::${endDevice}`,
                runOrder,
                rowOrder,
                startDevice,
                endDevice,
                runDeviceCount: component.orderedDevices.length,
                runSegmentCount: component.componentRows.length,
              },
            },
          },
        });
      });
    }
  }

  return enrichedMatches
    .sort((left, right) => {
      if (left.runOrder !== right.runOrder) {
        return left.runOrder - right.runOrder;
      }

      return left.rowOrder - right.rowOrder;
    })
    .map(({ match }) => match);
}

/**
 * Check if a terminal is a valid KA jumper terminal.
 */
function isKaJumperTerminal(terminal: string): boolean {
  const normalized = terminal.toUpperCase().trim();
  return KA_JUMPER_TERMINALS.has(normalized);
}

/**
 * Extract KA wire jumper matches from the sheet.
 * 
 * @param context - Pattern extraction context
 * @returns Array of KA wire jumper matches
 */
export function extractKaJumpers(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows, currentSheetName, blueLabels } = context;
  const matches: ProvisionalKaJumperMatch[] = [];
  const candidates: KaJumperCandidate[] = [];
  
  for (const row of rows) {
    // Exclude cable rows
    if (isCableLikeRow(row)) continue;
    
    // Exclude clip rows
    if (isClipLikeRow(row)) continue;
    
    // Require same location context
    if (!isSameLocationContext(row, currentSheetName)) continue;
    
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    // Both endpoints must be KA devices
    if (enriched.fromParsed.prefix !== "KA") continue;
    if (enriched.toParsed.prefix !== "KA") continue;

    if (!haveCompatibleJumperPartNumbers(row.fromDeviceId, row.toDeviceId, context)) continue;
    
    // Terminals must match exactly (same-identity)
    if (!terminalsMatch(enriched.fromParsed.terminal, enriched.toParsed.terminal)) continue;
    
    // Terminal must be in the allow list
    if (!isKaJumperTerminal(enriched.fromParsed.terminal)) continue;

    candidates.push({
      row,
      fromBaseDevice: getBaseDeviceId(row.fromDeviceId),
      toBaseDevice: getBaseDeviceId(row.toDeviceId),
      terminal: enriched.fromParsed.terminal,
      location: row.toLocation || row.fromLocation || row.location || "",
      enriched,
    });
  }

  const validDevicesByBucket = new Map<string, Set<string>>();
  if (hasBlueLabelData(blueLabels)) {
    const candidatesByBucket = new Map<string, KaJumperCandidate[]>();

    for (const candidate of candidates) {
      const bucketKey = buildKaCandidateBucketKey(candidate);
      const bucket = candidatesByBucket.get(bucketKey) ?? [];
      bucket.push(candidate);
      candidatesByBucket.set(bucketKey, bucket);
    }

    for (const [bucketKey, bucketCandidates] of candidatesByBucket.entries()) {
      validDevicesByBucket.set(bucketKey, buildValidKaDevices(bucketCandidates, currentSheetName, blueLabels!));
    }
  }

  for (const candidate of candidates) {
    const { row, enriched, fromBaseDevice, toBaseDevice, terminal, location } = candidate;

    const bucketKey = buildKaCandidateBucketKey(candidate);
    const validDevices = validDevicesByBucket.get(bucketKey) ?? new Set<string>();
    if (hasBlueLabelData(blueLabels) && (!validDevices.has(fromBaseDevice) || !validDevices.has(toBaseDevice))) {
      continue;
    }
    
    // KA wire jumpers must be proven by the current sheet's Blue Labels order.
    const isSequential = hasBlueLabelData(blueLabels)
      ? areDevicesAdjacentInSheet(row.fromDeviceId, row.toDeviceId, currentSheetName, blueLabels!)
      : false;
    
    // Must be sequential to qualify as a wire jumper
    if (!isSequential) continue;

    // Sequential A1/A2 KA rows are mechanical jumpers and belong in that filter,
    // whether they are ESTOP/0V or another sequential coil-side signal.
    if (isMechanicalKaJumperRow(row, context)) continue;
    
    const side = getKaSide(enriched.fromParsed.terminal);
    
    const match: JumperMatch = {
      row,
      metadata: {
        matchType: "ka_jumpers",
        badge: "KA Wire Jumper",
        meta: {
          fromDevice: enriched.fromParsed.original,
          toDevice: enriched.toParsed.original,
          fromBaseDevice,
          toBaseDevice,
          terminal,
          side: side || "unknown",
          isSequential,
          fromDeviceNumeric: enriched.fromParsed.deviceNumeric ?? 0,
          toDeviceNumeric: enriched.toParsed.deviceNumeric ?? 0,
          location,
        },
      },
      jumperType: "ka",
      fromPrefix: "KA",
      toPrefix: "KA",
      fromTerminal: enriched.fromParsed.terminal,
      toTerminal: enriched.toParsed.terminal,
      isSequential,
    };
    
    matches.push(match as ProvisionalKaJumperMatch);
  }

  return applyKaRunMetadata(matches);
}

/**
 * Count KA wire jumper matches.
 * 
 * @param context - Pattern extraction context
 * @returns Count of KA wire jumper matches
 */
export function countKaJumpers(context: PatternExtractionContext): number {
  return extractKaJumpers(context).length;
}
