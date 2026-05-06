/**
 * KT Wire Jumper Extraction
 * 
 * KT Wire Jumpers are device-to-device WIRE connections between KT (Timer Relay) devices.
 * 
 * Rules:
 * - Both endpoints must be KT timer relays
 * - Terminals must match exactly (same-identity: A1->A1, 15->15, etc.)
 * - Terminal must be in the allow list
 * - Jumpers must be on the same physical side
 * - Devices MUST be sequential in Blue Labels
 * - Must NOT be a cable row
 * - Must NOT be a clip row
 * - Must be in same location context
 * 
 * KT Side Map:
 * - Top side: A1, 15, B1
 * - Bottom side: 18, 16, A2
 * 
 * Note: KT supports 2 connections per terminal (metadata only).
 */

import type { PatternExtractionContext, PatternMatchRow, JumperMatch } from "./types";
import { 
  enrichSemanticRow, 
  terminalsMatch,
  isCableLikeRow,
  isClipLikeRow,
  isSameLocationContext,
} from "./device-parser";
import { areDevicesAdjacent, hasBlueLabelData } from "./blue-label-sequence";
import { KT_ALL_TERMINALS, getKtSide } from "./constants";
import { haveCompatibleJumperPartNumbers } from "./jumper-part-number";

interface ProvisionalKtJumperMatch extends JumperMatch {
  metadata: JumperMatch["metadata"] & {
    meta: JumperMatch["metadata"]["meta"] & {
      fromBaseDevice: string;
      toBaseDevice: string;
      location: string;
    };
  };
}

function getBaseDeviceId(deviceId: string): string {
  return deviceId.split(":")[0]?.trim() || deviceId.trim();
}

function buildKtRunBucketKey(match: ProvisionalKtJumperMatch): string {
  return [
    String(match.metadata.meta.location ?? ""),
    String(match.metadata.meta.terminal ?? ""),
  ].join("|");
}

function orderKtDevices(devices: string[]): string[] {
  return Array.from(new Set(devices)).sort((left, right) => {
    const leftNumber = Number.parseInt(left.replace(/^[A-Z]+/i, ""), 10);
    const rightNumber = Number.parseInt(right.replace(/^[A-Z]+/i, ""), 10);

    if (!Number.isNaN(leftNumber) && !Number.isNaN(rightNumber) && leftNumber !== rightNumber) {
      return leftNumber - rightNumber;
    }

    return left.localeCompare(right);
  });
}

function applyKtRunMetadata(matches: ProvisionalKtJumperMatch[]): PatternMatchRow[] {
  const matchesByBucket = new Map<string, ProvisionalKtJumperMatch[]>();

  for (const match of matches) {
    const bucketKey = buildKtRunBucketKey(match);
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
        const orderedDevices = orderKtDevices(componentDevices);
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
        return orderKtDevices([leftStart, rightStart])[0] === leftStart ? -1 : 1;
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
                runId: `${buildKtRunBucketKey(match)}::${startDevice}::${endDevice}`,
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
 * Check if a terminal is a valid KT terminal.
 */
function isKtTerminal(terminal: string): boolean {
  const normalized = terminal.toUpperCase().trim();
  return KT_ALL_TERMINALS.has(normalized);
}

/**
 * Check if two devices are numerically sequential (+1 apart).
 */
function areNumericallySequential(fromNumeric: number | null, toNumeric: number | null): boolean {
  if (fromNumeric === null || toNumeric === null) return false;
  const diff = Math.abs(toNumeric - fromNumeric);
  return diff === 1;
}

/**
 * Extract KT wire jumper matches from the sheet.
 * 
 * @param context - Pattern extraction context
 * @returns Array of KT wire jumper matches
 */
export function extractKtJumpers(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows, currentSheetName, blueLabels } = context;
  const matches: ProvisionalKtJumperMatch[] = [];
  
  for (const row of rows) {
    // Exclude cable rows
    if (isCableLikeRow(row)) continue;
    
    // Exclude clip rows
    if (isClipLikeRow(row)) continue;
    
    // Require same location context
    if (!isSameLocationContext(row, currentSheetName)) continue;
    
    const enriched = enrichSemanticRow(row, currentSheetName);
    
    // Both endpoints must be KT devices
    if (enriched.fromParsed.prefix !== "KT") continue;
    if (enriched.toParsed.prefix !== "KT") continue;

    if (!haveCompatibleJumperPartNumbers(row.fromDeviceId, row.toDeviceId, context)) continue;
    
    // Terminals must match exactly (same-identity)
    if (!terminalsMatch(enriched.fromParsed.terminal, enriched.toParsed.terminal)) continue;
    
    // Terminal must be in the allow list
    if (!isKtTerminal(enriched.fromParsed.terminal)) continue;
    
    // Get terminal side
    const side = getKtSide(enriched.fromParsed.terminal);
    
    // Check Blue Labels sequence - REQUIRED for KT wire jumpers
    let isSequential = false;
    
    if (hasBlueLabelData(blueLabels)) {
      isSequential = areDevicesAdjacent(row.fromDeviceId, row.toDeviceId, blueLabels!);
    }
    
    // Fallback: check numeric adjacency if Blue Labels not available
    if (!isSequential) {
      isSequential = areNumericallySequential(
        enriched.fromParsed.deviceNumeric,
        enriched.toParsed.deviceNumeric
      );
    }
    
    // Must be sequential to qualify as a wire jumper
    if (!isSequential) continue;
    
    const match: JumperMatch = {
      row,
      metadata: {
        matchType: "kt_jumpers",
        badge: "KT Wire Jumper",
        meta: {
          fromDevice: enriched.fromParsed.original,
          toDevice: enriched.toParsed.original,
          fromBaseDevice: getBaseDeviceId(row.fromDeviceId),
          toBaseDevice: getBaseDeviceId(row.toDeviceId),
          terminal: enriched.fromParsed.terminal,
          side: side || "unknown",
          isSequential,
          note: "KT supports 2 connections per terminal",
          fromDeviceNumeric: enriched.fromParsed.deviceNumeric ?? 0,
          toDeviceNumeric: enriched.toParsed.deviceNumeric ?? 0,
          location: row.toLocation || row.fromLocation || row.location || "",
        },
      },
      jumperType: "kt",
      fromPrefix: "KT",
      toPrefix: "KT",
      fromTerminal: enriched.fromParsed.terminal,
      toTerminal: enriched.toParsed.terminal,
      isSequential,
    };
    
    matches.push(match as ProvisionalKtJumperMatch);
  }

  return applyKtRunMetadata(matches);
}

/**
 * Count KT wire jumper matches.
 * 
 * @param context - Pattern extraction context
 * @returns Count of KT wire jumper matches
 */
export function countKtJumpers(context: PatternExtractionContext): number {
  return extractKtJumpers(context).length;
}
