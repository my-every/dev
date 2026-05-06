/**
 * FU (Fuse) Jumper Extractor
 * 
 * Identifies fuse jumpers: connections between fuse devices (FU*****) 
 * where both endpoints have the :LI terminal (Line Input) and the 
 * devices are sequential in the Blue Labels reference.
 * 
 * Pattern: FU*****:LI -> FU*****:LI where devices are adjacent in sequence
 */

import type {
  PatternExtractionContext,
  PatternMatchRow,
} from "./types";
import { parseDeviceId, isCableLikeRow, isClipLikeRow } from "./device-parser";
import { areDevicesAdjacent, areDevicesSequential, getDeviceSequenceIndex } from "./blue-label-sequence";
import { haveCompatibleJumperPartNumbers } from "./jumper-part-number";

interface ProvisionalFuJumperMatch extends PatternMatchRow {
  metadata: PatternMatchRow["metadata"] & {
    meta: PatternMatchRow["metadata"]["meta"] & {
      fromBaseDevice: string;
      toBaseDevice: string;
      location: string;
      wireNo: string;
    };
  };
}

function getBaseDeviceId(deviceId: string): string {
  return deviceId.split(":")[0]?.trim() || deviceId.trim();
}

function buildFuRunBucketKey(match: ProvisionalFuJumperMatch): string {
  return [
    String(match.metadata.meta.location ?? ""),
    String(match.metadata.meta.fromTerminal ?? ""),
    String(match.metadata.meta.wireNo ?? ""),
  ].join("|");
}

function orderFuDevices(
  devices: string[],
  context: PatternExtractionContext,
): string[] {
  const uniqueDevices = Array.from(new Set(devices));

  return uniqueDevices.sort((left, right) => {
    if (context.blueLabels?.isValid) {
      const leftIndex = getDeviceSequenceIndex(left, context.blueLabels);
      const rightIndex = getDeviceSequenceIndex(right, context.blueLabels);

      if (leftIndex !== null || rightIndex !== null) {
        return (leftIndex ?? Number.MAX_SAFE_INTEGER) - (rightIndex ?? Number.MAX_SAFE_INTEGER);
      }
    }

    const leftParsed = parseDeviceId(left);
    const rightParsed = parseDeviceId(right);
    const numericDiff = (leftParsed.deviceNumeric ?? 0) - (rightParsed.deviceNumeric ?? 0);
    if (numericDiff !== 0) {
      return numericDiff;
    }

    return left.localeCompare(right);
  });
}

function applyFuRunMetadata(
  matches: ProvisionalFuJumperMatch[],
  context: PatternExtractionContext,
): PatternMatchRow[] {
  const matchesByBucket = new Map<string, ProvisionalFuJumperMatch[]>();

  for (const match of matches) {
    const bucketKey = buildFuRunBucketKey(match);
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
        const orderedDevices = orderFuDevices(componentDevices, context);
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
        return orderFuDevices([leftStart, rightStart], context)[0] === leftStart ? -1 : 1;
      });

    for (const component of orderedComponents) {
      const runOrder = nextRunOrder++;
      const startDevice = component.orderedDevices[0] ?? "";
      const endDevice = component.orderedDevices[component.orderedDevices.length - 1] ?? startDevice;
      const componentRowOrder = [...component.componentRows].sort((left, right) => {
        const leftNumeric = Number(left.metadata.meta.fromNumeric ?? left.row.__rowIndex);
        const rightNumeric = Number(right.metadata.meta.fromNumeric ?? right.row.__rowIndex);
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
            row: match.row,
            metadata: {
              ...match.metadata,
              meta: {
                ...match.metadata.meta,
                runId: `${buildFuRunBucketKey(match)}::${startDevice}::${endDevice}`,
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
 * Fuse terminal patterns for jumper detection.
 * LI = Line Input (common fuse jumper terminal)
 * Also allow LOAD and LINE terminals
 */
const FU_JUMPER_TERMINALS = new Set(["LI", "LOAD", "LINE", "L", "LD"]);

/**
 * Check if a terminal is a valid fuse jumper terminal.
 */
function isFuseJumperTerminal(terminal: string): boolean {
  const normalized = (terminal || "").toUpperCase().trim();
  return FU_JUMPER_TERMINALS.has(normalized);
}

function isPotentialFuJumperRow(row: PatternExtractionContext["rows"][number]): boolean {
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);

  if (fromParsed.prefix !== "FU" || toParsed.prefix !== "FU") {
    return false;
  }

  if (!isFuseJumperTerminal(fromParsed.terminal) || !isFuseJumperTerminal(toParsed.terminal)) {
    return false;
  }

  return terminalsMatch(fromParsed.terminal, toParsed.terminal);
}

/**
 * Check if a row is a FU bus bar connection.
 * FU device with gaugeSize "BUS" — e.g. FU0007:LI -> 524POS with BUS gauge.
 */
export function isFuBusBarRow(row: { fromDeviceId: string; toDeviceId: string; gaugeSize: string }): boolean {
  const gauge = (row.gaugeSize || "").toUpperCase().trim();
  if (gauge !== "BUS") return false;

  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);

  return fromParsed.prefix === "FU" || toParsed.prefix === "FU";
}

/**
 * Check if two terminals are the same (for identity jumper matching).
 * FU jumpers must connect same terminal types: LI -> LI, LD -> LD, etc.
 */
function terminalsMatch(fromTerminal: string, toTerminal: string): boolean {
  const from = (fromTerminal || "").toUpperCase().trim();
  const to = (toTerminal || "").toUpperCase().trim();
  return from === to;
}

/**
 * Extract FU jumper rows.
 * 
 * Criteria for FU Jumpers:
 * 1. Both from and to devices have "FU" prefix
 * 2. Both terminals are :LI (or other fuse jumper terminals)
 * 3. Devices are sequential/adjacent in Blue Labels (if available)
 * 4. Not a cable or clip connection
 * 
 * @param context - Extraction context with rows and Blue Labels
 * @returns Array of pattern match rows
 */
export function extractFuJumpers(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows, blueLabels } = context;
  const matches: ProvisionalFuJumperMatch[] = [];

  for (const row of rows) {
    const isPotentialJumper = isPotentialFuJumperRow(row);

    // Skip cables and clips
    if (isCableLikeRow(row) && !isPotentialJumper) continue;
    if (isClipLikeRow(row)) continue;

    // Parse device IDs
    const fromParsed = parseDeviceId(row.fromDeviceId);
    const toParsed = parseDeviceId(row.toDeviceId);

    // Both must be FU devices
    if (fromParsed.prefix !== "FU") continue;
    if (toParsed.prefix !== "FU") continue;

    if (!haveCompatibleJumperPartNumbers(row.fromDeviceId, row.toDeviceId, context)) continue;

    // Both must have valid fuse jumper terminals
    if (!isFuseJumperTerminal(fromParsed.terminal)) continue;
    if (!isFuseJumperTerminal(toParsed.terminal)) continue;

    // Terminals must match: LI -> LI, LD -> LD, etc.
    // FU0340:LI -> FU0580:LD is NOT a valid fuse jumper
    if (!terminalsMatch(fromParsed.terminal, toParsed.terminal)) continue;

    // Check if devices are different (not same fuse)
    const fromBase = getBaseDeviceId(row.fromDeviceId);
    const toBase = getBaseDeviceId(row.toDeviceId);
    if (fromBase === toBase) continue;

    // Determine sequence operationship
    let isSequential = false;
    let isAdjacent = false;
    let sequenceInfo = "unverified";

    if (blueLabels && blueLabels.isValid) {
      isSequential = areDevicesSequential(row.fromDeviceId, row.toDeviceId, blueLabels);
      isAdjacent = areDevicesAdjacent(row.fromDeviceId, row.toDeviceId, blueLabels);

      if (isSequential) {
        sequenceInfo = "sequential";
      } else if (isAdjacent) {
        sequenceInfo = "adjacent";
      } else {
        // If Blue Labels exists but devices aren't adjacent, still include 
        // but mark as non-sequential for reference
        sequenceInfo = "non-adjacent";
      }
    }

    // Build match metadata
    const terminalDisplay = `${fromParsed.terminal}-${toParsed.terminal}`;
    const badge = isSequential || isAdjacent
      ? `FU SEQ ${terminalDisplay}`
      : `FU ${terminalDisplay}`;

    matches.push({
      row,
      metadata: {
        matchType: "fu_jumpers",
        badge,
        meta: {
          fromDevice: row.fromDeviceId,
          toDevice: row.toDeviceId,
          fromBaseDevice: fromBase,
          toBaseDevice: toBase,
          fromTerminal: fromParsed.terminal,
          toTerminal: toParsed.terminal,
          isSequential,
          isAdjacent,
          sequenceInfo,
          fromNumeric: fromParsed.deviceNumeric ?? 0,
          toNumeric: toParsed.deviceNumeric ?? 0,
          location: row.toLocation || row.fromLocation || row.location || "",
          wireNo: row.wireNo,
        },
      },
    });
  }

  const fuToFuResults = applyFuRunMetadata(matches, context);

  // Also capture FU bus bar rows (FU device + BUS gauge)
  const fuToFuRowIds = new Set(fuToFuResults.map(m => m.row.__rowId));
  const busBarMatches: PatternMatchRow[] = [];

  for (const row of rows) {
    if (fuToFuRowIds.has(row.__rowId)) continue;
    if (!isFuBusBarRow(row)) continue;

    const fromParsed = parseDeviceId(row.fromDeviceId);
    const toParsed = parseDeviceId(row.toDeviceId);

    busBarMatches.push({
      row,
      metadata: {
        matchType: "fu_jumpers",
        badge: "FU BUS",
        meta: {
          fromDevice: row.fromDeviceId,
          toDevice: row.toDeviceId,
          fromBaseDevice: getBaseDeviceId(row.fromDeviceId),
          toBaseDevice: getBaseDeviceId(row.toDeviceId),
          fromTerminal: fromParsed.terminal,
          toTerminal: toParsed.terminal,
          isBusBar: true,
          location: row.toLocation || row.fromLocation || row.location || "",
          wireNo: row.wireNo,
        },
      },
    });
  }

  return [...fuToFuResults, ...busBarMatches];
}

/**
 * Count FU jumper matches.
 * 
 * @param context - Pattern extraction context
 * @returns Count of FU jumper matches
 */
export function countFuJumpers(context: PatternExtractionContext): number {
  return extractFuJumpers(context).length;
}
