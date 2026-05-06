/**
 * Resistors Extraction
 *
 * Pairs lead-component rows by component device ID and shared endpoint device.
 */

import { getBaseDeviceId, isInternalLocation, parseDeviceId } from "./device-parser";
import type { ParsedDeviceId, PatternExtractionContext, PatternMatchRow } from "./types";

const MAX_TERMINAL_JUMP = 3;
const CAUTION_DESCRIPTION = "Caution, please report to a team lead for further review";

interface ResistorCandidate {
  match: PatternMatchRow;
  index: number;
  wireNo: string;
  fromBase: string;
  toBase: string;
  resistorDeviceId: string;
  counterpartDeviceId: string;
  fromParsed: ParsedDeviceId;
  toParsed: ParsedDeviceId;
  isExternal: boolean;
}

interface SharedEndpointMatch {
  side: "from" | "to";
  deviceId: string;
  terminalDistance: number;
  duplicateCounterpartTermination: boolean;
}

interface PairAssignment {
  candidates: ResistorCandidate[];
  sharedMatch: SharedEndpointMatch | null;
  warning: boolean;
  warningDescription: string;
}

/**
 * Check if a row is a resistor connection (Wire ID = "LEAD").
 */
export function isResistorWireId(wireId: string): boolean {
  const normalized = (wireId || "").trim().toUpperCase();
  return normalized === "LEAD";
}

/**
 * Check if a device ID is a supported lead-component family.
 */
export function isResistorDevice(deviceId: string): boolean {
  const normalized = (deviceId || "").trim().toUpperCase();
  return normalized.startsWith("RR") || normalized.startsWith("VD");
}

/**
 * Check if a row is a supported lead-component connection.
 * Matches rows where Wire ID = "LEAD" OR either device has an RR/VD prefix.
 */
export function isResistorRow(wireId: string, fromDeviceId: string, toDeviceId: string): boolean {
  if (isResistorWireId(wireId)) return true;

  return isResistorDevice(fromDeviceId) || isResistorDevice(toDeviceId);
}

function normalizeWireNo(wireNo: string): string {
  return (wireNo || "").trim().toUpperCase();
}

function getResistorDeviceId(fromBase: string, toBase: string): string {
  if (isResistorDevice(fromBase)) {
    return fromBase;
  }

  if (isResistorDevice(toBase)) {
    return toBase;
  }

  return "";
}

function getCounterpartDeviceId(fromBase: string, toBase: string): string {
  if (isResistorDevice(fromBase)) {
    return toBase;
  }

  if (isResistorDevice(toBase)) {
    return fromBase;
  }

  return toBase || fromBase;
}

function getEffectiveLocation(context: PatternExtractionContext, row: PatternMatchRow["row"]): string {
  return row.toLocation || row.fromLocation || row.location || context.currentSheetName || "";
}

function getTerminalDistance(left: ParsedDeviceId, right: ParsedDeviceId): number | null {
  if (left.terminalNumeric !== null && right.terminalNumeric !== null) {
    return Math.abs(left.terminalNumeric - right.terminalNumeric);
  }

  const leftTerminal = (left.terminal || "").trim().toUpperCase();
  const rightTerminal = (right.terminal || "").trim().toUpperCase();

  if (leftTerminal && rightTerminal && leftTerminal === rightTerminal) {
    return 0;
  }

  // Diode-style polarity terminals: "--1N4007" paired with "+-1N4007"
  // Strip leading polarity markers (-- or +-) and compare the part number.
  const polarityPattern = /^[+\-]{1,2}(.+)$/;
  const leftPolarityMatch = leftTerminal.match(polarityPattern);
  const rightPolarityMatch = rightTerminal.match(polarityPattern);
  if (
    leftPolarityMatch &&
    rightPolarityMatch &&
    leftPolarityMatch[1] === rightPolarityMatch[1] &&
    leftTerminal !== rightTerminal
  ) {
    return 1;
  }

  return null;
}

function buildSharedEndpointMatch(left: ResistorCandidate, right: ResistorCandidate): SharedEndpointMatch | null {
  const matches: SharedEndpointMatch[] = [];

  if (left.fromBase && left.fromBase === right.fromBase) {
    const terminalDistance = getTerminalDistance(left.fromParsed, right.fromParsed);
    if (terminalDistance !== null && terminalDistance <= MAX_TERMINAL_JUMP) {
      matches.push({
        side: "from",
        deviceId: left.fromBase,
        terminalDistance,
        duplicateCounterpartTermination:
          left.toBase === right.toBase &&
          getTerminalDistance(left.toParsed, right.toParsed) === 0,
      });
    }
  }

  if (left.toBase && left.toBase === right.toBase) {
    const terminalDistance = getTerminalDistance(left.toParsed, right.toParsed);
    if (terminalDistance !== null && terminalDistance <= MAX_TERMINAL_JUMP) {
      matches.push({
        side: "to",
        deviceId: left.toBase,
        terminalDistance,
        duplicateCounterpartTermination:
          left.fromBase === right.fromBase &&
          getTerminalDistance(left.fromParsed, right.fromParsed) === 0,
      });
    }
  }

  if (matches.length === 0) {
    return null;
  }

  matches.sort((leftMatch, rightMatch) => {
    if (leftMatch.terminalDistance !== rightMatch.terminalDistance) {
      return leftMatch.terminalDistance - rightMatch.terminalDistance;
    }

    if (leftMatch.duplicateCounterpartTermination !== rightMatch.duplicateCounterpartTermination) {
      return leftMatch.duplicateCounterpartTermination ? 1 : -1;
    }

    return leftMatch.side.localeCompare(rightMatch.side);
  });

  return matches[0] ?? null;
}

function buildPairLabel(sharedMatch: SharedEndpointMatch | null, candidates: ResistorCandidate[]): string {
  const firstCandidate = candidates[0]!;
  const resistorDevice = firstCandidate.resistorDeviceId;
  const sharedDevice = sharedMatch?.deviceId || firstCandidate.counterpartDeviceId;

  if (!resistorDevice && !sharedDevice) {
    return "Resistor Pair";
  }

  // Collect the shared-side terminals from each candidate to build "XT0087:1 - XT0087:2"
  if (sharedMatch && candidates.length >= 2) {
    const sharedTerminals = candidates.map((c) => {
      const deviceId = sharedMatch.side === "from" ? c.match.row.fromDeviceId : c.match.row.toDeviceId;
      return (deviceId || "").trim();
    }).filter(Boolean);

    if (sharedTerminals.length >= 2) {
      return `${resistorDevice} / ${sharedTerminals.join(" - ")}`;
    }
  }

  if (resistorDevice && sharedDevice) {
    return `${resistorDevice} / ${sharedDevice}`;
  }

  return resistorDevice || sharedDevice || "Resistor Pair";
}

function buildPairAssignment(candidates: ResistorCandidate[], sharedMatch: SharedEndpointMatch | null): PairAssignment {
  const warning =
    candidates.length !== 2 ||
    candidates.some((candidate) => candidate.isExternal) ||
    Boolean(sharedMatch?.duplicateCounterpartTermination);

  return {
    candidates,
    sharedMatch,
    warning,
    warningDescription: warning ? CAUTION_DESCRIPTION : "",
  };
}

/**
 * Extract resistor rows from the wire list.
 */
export function extractResistors(context: PatternExtractionContext): PatternMatchRow[] {
  const { rows } = context;

  const matches: PatternMatchRow[] = [];
  const candidates: ResistorCandidate[] = [];

  rows.forEach((row, index) => {
    const wireId = (row.wireId || "").trim().toUpperCase();
    const fromDevice = (row.fromDeviceId || "").trim().toUpperCase();
    const toDevice = (row.toDeviceId || "").trim().toUpperCase();

    if (!isResistorRow(wireId, fromDevice, toDevice)) {
      return;
    }

    const fromBase = getBaseDeviceId(fromDevice).toUpperCase();
    const toBase = getBaseDeviceId(toDevice).toUpperCase();
    const resistorDeviceId = getResistorDeviceId(fromBase, toBase);
    const counterpartDeviceId = getCounterpartDeviceId(fromBase, toBase);
    const match: PatternMatchRow = {
      row,
      metadata: {
        matchType: "resistors",
        badge: "LEAD",
        meta: {
          baseDevice: fromBase,
          fromDevice: row.fromDeviceId,
          toDevice: row.toDeviceId,
          wireNo: normalizeWireNo(row.wireNo || ""),
          hasRRPrefix: isResistorDevice(fromDevice) || isResistorDevice(toDevice),
          gaugeSize: row.gaugeSize || "",
          resistorDeviceId: resistorDeviceId,
        },
      },
    };

    matches.push(match);

    candidates.push({
      match,
      index,
      wireNo: normalizeWireNo(row.wireNo || ""),
      fromBase,
      toBase,
      resistorDeviceId,
      counterpartDeviceId,
      fromParsed: parseDeviceId(fromDevice),
      toParsed: parseDeviceId(toDevice),
      isExternal: Boolean(context.currentSheetName) && !isInternalLocation(getEffectiveLocation(context, row), context.currentSheetName),
    });
  });

  const used = new Set<number>();
  let pairOrder = 0;

  for (let index = 0; index < candidates.length; index++) {
    if (used.has(index)) {
      continue;
    }

    const candidate = candidates[index]!;
    let bestMatchIndex = -1;
    let bestSharedMatch: SharedEndpointMatch | null = null;

    for (let nextIndex = index + 1; nextIndex < candidates.length; nextIndex++) {
      if (used.has(nextIndex)) {
        continue;
      }

      const nextCandidate = candidates[nextIndex]!;
      if (!candidate.resistorDeviceId || nextCandidate.resistorDeviceId !== candidate.resistorDeviceId) {
        continue;
      }

      const sharedMatch = buildSharedEndpointMatch(candidate, nextCandidate);
      if (!sharedMatch) {
        continue;
      }

      if (
        !bestSharedMatch ||
        sharedMatch.terminalDistance < bestSharedMatch.terminalDistance ||
        (
          sharedMatch.terminalDistance === bestSharedMatch.terminalDistance &&
          bestSharedMatch.duplicateCounterpartTermination &&
          !sharedMatch.duplicateCounterpartTermination
        )
      ) {
        bestMatchIndex = nextIndex;
        bestSharedMatch = sharedMatch;
      }
    }

    const pairedCandidates = bestMatchIndex >= 0
      ? [candidate, candidates[bestMatchIndex]!]
      : [candidate];

    used.add(index);
    if (bestMatchIndex >= 0) {
      used.add(bestMatchIndex);
    }

    const assignment = buildPairAssignment(pairedCandidates, bestSharedMatch);
    const pairId = `resistor:${candidate.resistorDeviceId || candidate.wireNo || "UNNUMBERED"}:${pairOrder}`;
    const pairLabel = buildPairLabel(assignment.sharedMatch, pairedCandidates);

    assignment.candidates.forEach((entry, rowOrder) => {
      entry.match.metadata.meta.pairId = pairId;
      entry.match.metadata.meta.pairLabel = pairLabel;
      entry.match.metadata.meta.pairOrder = pairOrder;
      entry.match.metadata.meta.rowOrder = rowOrder;
      entry.match.metadata.meta.groupSize = assignment.candidates.length;
      entry.match.metadata.meta.runId = pairId;
      entry.match.metadata.meta.runOrder = pairOrder;
      entry.match.metadata.meta.sharedDevice = assignment.sharedMatch?.deviceId ?? "";
      entry.match.metadata.meta.sharedSide = assignment.sharedMatch?.side ?? "";
      entry.match.metadata.meta.pairTone = assignment.warning ? "warning" : "muted";
      entry.match.metadata.meta.pairWarning = assignment.warning;
      entry.match.metadata.meta.pairDescription = assignment.warningDescription;
      entry.match.metadata.meta.hasExternalPairMember = assignment.candidates.some((member) => member.isExternal);
      entry.match.metadata.meta.hasMissingPair = assignment.candidates.length !== 2;
      entry.match.metadata.meta.hasDuplicateDestination = Boolean(assignment.sharedMatch?.duplicateCounterpartTermination);
    });

    pairOrder++;
  }

  return matches;
}

/**
 * Count resistor rows without full extraction.
 */
export function countResistors(context: PatternExtractionContext): number {
  return extractResistors(context).length;
}
