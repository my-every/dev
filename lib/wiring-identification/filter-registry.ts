/**
 * Filter Registry
 * 
 * Central registry of all identification filters with their extractors.
 * This module provides the main API for applying filters.
 * 
 * Filter Hierarchy:
 * - Default: All rows
 * - Grounds: Ground wires (GRN, GRN/YEL, GRN/YLW)
 * - Jumpers: Union of AF, XT, KA, KT jumpers (excludes clips)
 * - Clips: All clip-based rows (CLIP wire ID, JC type)
 * - AF Jumpers: AF device-to-device with matching terminals
 * - XT Jumpers: XT same-device, terminal +1, excludes clips
 * - XT Clips: XT-specific clips
 * - KA Jumpers: KA relay jumpers
 * - KA Twin Ferrules: Multiple wires on same KA terminal
 * - KT Jumpers: KT timer relay jumpers
 */

import type {
  IdentificationFilterKind,
  IdentificationFilterOption,
  IdentificationFilterResult,
  PatternExtractionContext,
  PatternMatchRow,
  FilterDefinition,
  BlueLabelSequenceMap,
  IdentificationSummary,
} from "./types";
import type { PartNumberLookupResult } from "@/lib/part-number-list";
import type { SemanticWireListRow } from "@/lib/workbook/types";

import { FILTER_METADATA } from "./constants";
import { hasBlueLabelData, normalizeSheetName } from "./blue-label-sequence";
import { buildIdentificationPresenceMap, filterHasMatches, getFilterCount } from "./presence-detection";
import { parseGaugeNumeric } from "./device-parser";
import { hasMechanicalRelayPartNumber } from "./jumper-part-number";

// Import extractors
import { extractGrounds, getGroundSummary } from "./extract-grounds";
import { extractClips } from "./extract-clips";
import { extractAfJumpers } from "./extract-af-jumpers";
import { extractXtJumpers } from "./extract-xt-jumpers";
import { extractXtClips } from "./extract-xt-clips";
import { extractKaJumpers } from "./extract-ka-jumpers";
import { extractKaTwinFerrules } from "./extract-ka-twin-ferrules";
import { extractKtJumpers } from "./extract-kt-jumpers";
import { extractFuJumpers } from "./extract-fu-jumpers";
import { extractKaRelayPluginJumperRows } from "./extract-ka-relay-plugin-jumpers";
import { extractCables } from "./extract-cables";
import { extractSingleConnections } from "./extract-single-connections";
import { extractVioJumpers } from "./extract-vio-jumpers";
import { extractResistors } from "./extract-resistors";

// ============================================================================
// Filter Registry
// ============================================================================

/**
 * Registry of all filter definitions.
 */
const FILTER_REGISTRY: Record<IdentificationFilterKind, FilterDefinition> = {
  default: {
    kind: "default",
    label: FILTER_METADATA.default.label,
    description: FILTER_METADATA.default.description,
    requiresBlueLabels: false,
    extractor: (ctx) => ctx.rows.map(row => ({
      row,
      metadata: {
        matchType: "default" as const,
        badge: "",
        meta: {},
      },
    })),
  },
  grounds: {
    kind: "grounds",
    label: FILTER_METADATA.grounds.label,
    description: FILTER_METADATA.grounds.description,
    requiresBlueLabels: false,
    extractor: extractGrounds,
  },
  jumpers: {
    kind: "jumpers",
    label: FILTER_METADATA.jumpers.label,
    description: FILTER_METADATA.jumpers.description,
    requiresBlueLabels: false,
    extractor: (ctx) => {
      // Union of actual jumper types (NOT clips)
      // Clips are separate and should not appear in Jumpers filter
      return [
        ...extractAfJumpers(ctx),
        ...extractXtJumpers(ctx),
        ...extractKaJumpers(ctx),
        ...extractKtJumpers(ctx),
        ...extractFuJumpers(ctx),
      ];
    },
  },
  clips: {
    kind: "clips",
    label: FILTER_METADATA.clips.label,
    description: FILTER_METADATA.clips.description,
    requiresBlueLabels: false,
    extractor: extractClips,
  },
  cables: {
    kind: "cables",
    label: FILTER_METADATA.cables.label,
    description: FILTER_METADATA.cables.description,
    requiresBlueLabels: false,
    extractor: extractCables,
  },
  single_connections: {
    kind: "single_connections",
    label: FILTER_METADATA.single_connections.label,
    description: FILTER_METADATA.single_connections.description,
    requiresBlueLabels: false,
    extractor: extractSingleConnections,
  },
  af_jumpers: {
    kind: "af_jumpers",
    label: FILTER_METADATA.af_jumpers.label,
    description: FILTER_METADATA.af_jumpers.description,
    requiresBlueLabels: false,
    extractor: extractAfJumpers,
  },
  xt_jumpers: {
    kind: "xt_jumpers",
    label: FILTER_METADATA.xt_jumpers.label,
    description: FILTER_METADATA.xt_jumpers.description,
    requiresBlueLabels: false,
    extractor: extractXtJumpers,
  },
  xt_clips: {
    kind: "xt_clips",
    label: FILTER_METADATA.xt_clips.label,
    description: FILTER_METADATA.xt_clips.description,
    requiresBlueLabels: false,
    extractor: extractXtClips,
  },
  ka_jumpers: {
    kind: "ka_jumpers",
    label: FILTER_METADATA.ka_jumpers.label,
    description: FILTER_METADATA.ka_jumpers.description,
    requiresBlueLabels: false,
    extractor: extractKaJumpers,
  },
  ka_relay_plugin_jumpers: {
    kind: "ka_relay_plugin_jumpers",
    label: FILTER_METADATA.ka_relay_plugin_jumpers.label,
    description: FILTER_METADATA.ka_relay_plugin_jumpers.description,
    requiresBlueLabels: true,
    extractor: extractKaRelayPluginJumperRows,
  },
  ka_twin_ferrules: {
    kind: "ka_twin_ferrules",
    label: FILTER_METADATA.ka_twin_ferrules.label,
    description: FILTER_METADATA.ka_twin_ferrules.description,
    requiresBlueLabels: false,
    extractor: extractKaTwinFerrules,
  },
  kt_jumpers: {
    kind: "kt_jumpers",
    label: FILTER_METADATA.kt_jumpers.label,
    description: FILTER_METADATA.kt_jumpers.description,
    requiresBlueLabels: false,
    extractor: extractKtJumpers,
  },
  fu_jumpers: {
    kind: "fu_jumpers",
    label: FILTER_METADATA.fu_jumpers.label,
    description: FILTER_METADATA.fu_jumpers.description,
    requiresBlueLabels: false,
    extractor: extractFuJumpers,
  },
  vio_jumpers: {
    kind: "vio_jumpers",
    label: FILTER_METADATA.vio_jumpers.label,
    description: FILTER_METADATA.vio_jumpers.description,
    requiresBlueLabels: false,
    extractor: extractVioJumpers,
  },
  resistors: {
    kind: "resistors",
    label: FILTER_METADATA.resistors.label,
    description: FILTER_METADATA.resistors.description,
    requiresBlueLabels: false,
    extractor: extractResistors,
  },
};

// ============================================================================
// Build Available Options
// ============================================================================

/**
 * Build the list of available identification filter options.
 * Only includes filters that have matches in the current data.
 * 
 * @param rows - Semantic wire list rows
 * @param blueLabels - Blue Labels sequence map (if available)
 * @param currentSheetName - Current sheet name
 * @returns Array of available filter options
 */
export function buildIdentificationOptions(
  rows: SemanticWireListRow[],
  blueLabels: BlueLabelSequenceMap | null,
  currentSheetName: string,
  partNumberMap: Map<string, PartNumberLookupResult> | null = null,
): IdentificationFilterOption[] {
  const presenceMap = buildIdentificationPresenceMap(rows, blueLabels, currentSheetName, partNumberMap);
  const hasBlueLabels = hasBlueLabelData(blueLabels);

  const options: IdentificationFilterOption[] = [];

  // Always include default
  options.push({
    kind: "default",
    label: FILTER_METADATA.default.label,
    count: rows.length,
    available: true,
    requiresBlueLabels: false,
    description: FILTER_METADATA.default.description,
  });

  // Add other filters in sort order
  const sortedKinds = (Object.keys(FILTER_METADATA) as IdentificationFilterKind[])
    .filter(k => k !== "default")
    .sort((a, b) => FILTER_METADATA[a].sortOrder - FILTER_METADATA[b].sortOrder);

  for (const kind of sortedKinds) {
    const meta = FILTER_METADATA[kind];
    const count = getFilterCount(presenceMap, kind);
    const hasMatches = filterHasMatches(presenceMap, kind);

    // Skip if requires Blue Labels and we don't have it
    if (meta.requiresBlueLabels && !hasBlueLabels) continue;

    // Skip if no matches
    if (!hasMatches) continue;

    options.push({
      kind,
      label: meta.label,
      count,
      available: true,
      requiresBlueLabels: meta.requiresBlueLabels,
      description: meta.description,
    });
  }

  return options;
}

// ============================================================================
// Apply Filter
// ============================================================================

/**
 * Sort comparison for gauge values.
 * Larger gauge number = smaller wire size, so we sort descending (16 before 14 before 12).
 * Non-numeric values sort after numeric values.
 */
function compareGauge(a: string, b: string): number {
  const numA = parseGaugeNumeric(a);
  const numB = parseGaugeNumeric(b);

  // Both numeric: sort descending (larger number = smaller wire = first)
  if (numA !== null && numB !== null) {
    return numB - numA;
  }

  // A numeric, B non-numeric: A comes first
  if (numA !== null && numB === null) {
    return -1;
  }

  // A non-numeric, B numeric: B comes first
  if (numA === null && numB !== null) {
    return 1;
  }

  // Both non-numeric: sort alphabetically
  return a.localeCompare(b);
}

/**
 * Sort rows by location first (prioritizing current sheet location), 
 * then gauge (larger number = smaller wire = first), 
 * then by fromDeviceId, then by row index.
 * 
 * @param rows - Rows to sort
 * @param currentSheetName - Current sheet name to prioritize its location first
 */
/**
 * Check if a location matches the current sheet name.
 * Uses flexible matching to handle variations in naming.
 */
function locationMatchesCurrentSheet(location: string, currentSheetName: string): boolean {
  if (!currentSheetName || !location) return false;

  const loc = location.toUpperCase().trim();
  const sheet = currentSheetName.toUpperCase().trim();

  // Exact match
  if (loc === sheet) return true;

  // Location contains sheet name (e.g., location "PANEL A MAIN" matches sheet "PANEL A")
  if (loc.includes(sheet)) return true;

  // Sheet name contains location (e.g., sheet "PANEL A" matches location "PANEL A")
  if (sheet.includes(loc)) return true;

  // Word-based matching: check if all words in sheet name appear in location
  const sheetWords = sheet.split(/[\s,]+/).filter(w => w.length > 0);
  const locWords = loc.split(/[\s,]+/).filter(w => w.length > 0);

  // If sheet name words are a subset of location words
  const allSheetWordsInLoc = sheetWords.every(sw => locWords.some(lw => lw.includes(sw) || sw.includes(lw)));
  if (allSheetWordsInLoc && sheetWords.length > 0) return true;

  return false;
}

/**
 * Check if a wire type represents a cable (WC followed by alphanumeric).
 * Cables should always be grouped together and rendered last.
 */
function isCableRow(row: SemanticWireListRow): boolean {
  const normalized = (row.wireType || "").trim().toUpperCase();
  if (!normalized || normalized === "W" || normalized === "SC" || normalized === "JC") return false;
  if (/^WC[A-Z0-9]+$/i.test(normalized)) return true;

  return (row.wireId || "").trim().toUpperCase() === "CABLE";
}

function sortRowsByLocationAndGauge(
  rows: SemanticWireListRow[],
  currentSheetName?: string
): SemanticWireListRow[] {
  const normalizedSheet = (currentSheetName || "").toUpperCase().trim();

  return [...rows].sort((a, b) => {
    const locA = a.location || "";
    const locB = b.location || "";

    // First: Cables always go LAST (grouped together at the end)
    const aIsCable = isCableRow(a);
    const bIsCable = isCableRow(b);

    if (aIsCable && !bIsCable) return 1;  // a is cable, b is not: a goes after b
    if (!aIsCable && bIsCable) return -1; // b is cable, a is not: a goes before b

    // If both are cables, group by cable type (WC####), then by device, then row index
    if (aIsCable && bIsCable) {
      const cableTypeA = ((a.wireType || "").toUpperCase().trim() || (a.wireId || "").toUpperCase().trim());
      const cableTypeB = ((b.wireType || "").toUpperCase().trim() || (b.wireId || "").toUpperCase().trim());

      // Group by cable type first
      const cableTypeCompare = cableTypeA.localeCompare(cableTypeB);
      if (cableTypeCompare !== 0) return cableTypeCompare;

      // Within same cable type, sort by fromDeviceId
      const deviceCompare = a.fromDeviceId.localeCompare(b.fromDeviceId);
      if (deviceCompare !== 0) return deviceCompare;

      // Then by original row order
      return a.__rowIndex - b.__rowIndex;
    }

    // For non-cables: prioritize rows matching current sheet location
    if (normalizedSheet) {
      const aMatchesCurrent = locationMatchesCurrentSheet(locA, normalizedSheet);
      const bMatchesCurrent = locationMatchesCurrentSheet(locB, normalizedSheet);

      if (aMatchesCurrent && !bMatchesCurrent) return -1;
      if (!aMatchesCurrent && bMatchesCurrent) return 1;
    }

    // Secondary: location (alphabetical)
    const normalizedLocA = locA.toUpperCase().trim();
    const normalizedLocB = locB.toUpperCase().trim();
    const locationCompare = normalizedLocA.localeCompare(normalizedLocB);
    if (locationCompare !== 0) return locationCompare;

    // Tertiary: gauge (larger number = smaller wire = first)
    const gaugeCompare = compareGauge(a.gaugeSize, b.gaugeSize);
    if (gaugeCompare !== 0) return gaugeCompare;

    // Quaternary: fromDeviceId
    const deviceCompare = a.fromDeviceId.localeCompare(b.fromDeviceId);
    if (deviceCompare !== 0) return deviceCompare;

    // Quinary: original row order
    return a.__rowIndex - b.__rowIndex;
  });
}

function sortSingleConnectionRows(
  rows: SemanticWireListRow[],
  currentSheetName?: string,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
): SemanticWireListRow[] {
  const normalizedSheet = (currentSheetName || "").toUpperCase().trim();
  const getLocation = (row: SemanticWireListRow) => row.toLocation || row.fromLocation || row.location || "";
  const getBaseDeviceId = (deviceId: string | undefined) => deviceId?.split(":")[0]?.trim().toUpperCase() || "";
  const getDeviceTerminal = (deviceId: string | undefined) => deviceId?.split(":")[1]?.trim().toUpperCase() || "";
  const getAfTerminalGroupOrder = (terminal: string): number => {
    // AF terminals grouped by ranges: 63-48, 47-32, 31-16, 15-0
    // Non-numeric terminals are mapped to their ranges
    const terminalMap: Record<string, number> = {
      SH: 0,     // 63-48 range
      "V+": 1,   // 47-32 range
      COM: 2,    // 31-16 range
    };

    if (terminalMap[terminal] !== undefined) {
      return terminalMap[terminal];
    }

    const isNumeric = /^\d+$/.test(terminal);
    if (isNumeric) {
      const value = Number.parseInt(terminal, 10);
      if (value >= 48 && value <= 63) return 0;    // 63-48 group
      if (value >= 32 && value <= 47) return 1;    // 47-32 group
      if (value >= 16 && value <= 31) return 2;    // 31-16 group
      if (value >= 0 && value <= 15) return 3;     // 15-0 group
    }

    return 4; // Unknown terminals go last
  };

  const compareAfTerminalsDescending = (leftTerminal: string, rightTerminal: string) => {
    const leftGroup = getAfTerminalGroupOrder(leftTerminal);
    const rightGroup = getAfTerminalGroupOrder(rightTerminal);

    // First, sort by group (lower group number comes first)
    if (leftGroup !== rightGroup) {
      return leftGroup - rightGroup;
    }

    // Within same group, sort numerically descending
    const leftIsNumeric = /^\d+$/.test(leftTerminal);
    const rightIsNumeric = /^\d+$/.test(rightTerminal);

    if (leftIsNumeric && rightIsNumeric) {
      const leftValue = Number.parseInt(leftTerminal, 10);
      const rightValue = Number.parseInt(rightTerminal, 10);
      if (leftValue !== rightValue) {
        return rightValue - leftValue;
      }
    }

    return rightTerminal.localeCompare(leftTerminal, undefined, { numeric: true, sensitivity: "base" });
  };
  const compareAtTerminalsAscending = (leftTerminal: string, rightTerminal: string) => {
    const leftIsNumeric = /^\d+$/.test(leftTerminal);
    const rightIsNumeric = /^\d+$/.test(rightTerminal);

    if (leftIsNumeric && rightIsNumeric) {
      const leftValue = Number.parseInt(leftTerminal, 10);
      const rightValue = Number.parseInt(rightTerminal, 10);
      if (leftValue !== rightValue) {
        return leftValue - rightValue;
      }
    }

    return leftTerminal.localeCompare(rightTerminal, undefined, { numeric: true, sensitivity: "base" });
  };
  const lookupPartNumberFromRegistry = (deviceId: string | undefined): any => {
    if (!partNumberMap || !deviceId) return undefined;
    const baseDeviceId = getBaseDeviceId(deviceId);
    return partNumberMap.get(baseDeviceId);
  };
  const QF_TERMINAL_ORDER: Record<string, number> = {
    "1": 0,
    "3": 1,
    "5": 2,
    "14": 3,
    "12": 4,
    "2": 5,
    "4": 6,
    "6": 7,
    "11": 8,
  };
  const QF_PART_NUMBERS = new Set(["1503050-2", "1503050-3"]);
  const normalizePartNumberForSort = (partNumber: string | undefined): string => {
    return String(partNumber ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
  };
  const hasMatchingSortPartNumber = (partNumber: string | undefined, allowedPartNumbers: Set<string>): boolean => {
    return String(partNumber ?? "")
      .split(/[\n,;]+/)
      .map(value => normalizePartNumberForSort(value))
      .some(value => value.length > 0 && allowedPartNumbers.has(value));
  };
  const getQfTerminalRank = (row: SemanticWireListRow): number | null => {
    if (!partNumberMap) return null;
    const prefix = getDevicePrefix(row.fromDeviceId);
    if (prefix !== "QF") return null;
    const partNumber = lookupPartNumberFromRegistry(row.fromDeviceId)?.partNumber;
    if (!hasMatchingSortPartNumber(partNumber, QF_PART_NUMBERS)) return null;
    const terminal = getDeviceTerminal(row.fromDeviceId);
    return terminal in QF_TERMINAL_ORDER ? QF_TERMINAL_ORDER[terminal] : null;
  };
  const getDevicePrefix = (deviceId: string | undefined) => {
    const baseDeviceId = getBaseDeviceId(deviceId);
    const match = baseDeviceId.match(/^([A-Z]+)/);
    return match?.[1] ?? baseDeviceId;
  };
  const getPrefix = (deviceId: string | undefined) => {
    const baseDeviceId = getBaseDeviceId(deviceId);
    const match = baseDeviceId.match(/^([A-Z]+)/);
    const prefix = match?.[1] ?? baseDeviceId;
    const terminal = deviceId?.split(":")[1]?.trim().toUpperCase() || "";

    if (
      prefix === "KA" &&
      (terminal === "A1" || terminal === "A2") &&
      hasMechanicalRelayPartNumber(deviceId || "", partNumberMap)
    ) {
      return `${prefix}:${terminal}`;
    }

    return prefix;
  };

  const sourceCounts = new Map<string, Map<string, number>>();
  const pairCounts = new Map<string, Map<string, number>>();
  const fallbackPrefixCounts = new Map<string, Map<string, number>>();

  rows.forEach((row) => {
    const location = getLocation(row).toUpperCase();
    const fromBase = getBaseDeviceId(row.fromDeviceId);
    const toBase = getBaseDeviceId(row.toDeviceId);
    const fromPrefix = getPrefix(row.fromDeviceId);
    const toPrefix = getDevicePrefix(row.toDeviceId);

    const locationSourceCounts = sourceCounts.get(location) ?? new Map<string, number>();
    locationSourceCounts.set(fromBase, (locationSourceCounts.get(fromBase) ?? 0) + 1);
    sourceCounts.set(location, locationSourceCounts);

    const locationPairCounts = pairCounts.get(location) ?? new Map<string, number>();
    const pairKey = `${fromBase}->${toBase}`;
    locationPairCounts.set(pairKey, (locationPairCounts.get(pairKey) ?? 0) + 1);
    pairCounts.set(location, locationPairCounts);

    const locationFallbackCounts = fallbackPrefixCounts.get(location) ?? new Map<string, number>();
    const fallbackKey = `${fromPrefix}->${toPrefix}`;
    locationFallbackCounts.set(fallbackKey, (locationFallbackCounts.get(fallbackKey) ?? 0) + 1);
    fallbackPrefixCounts.set(location, locationFallbackCounts);
  });

  const getGroupMeta = (row: SemanticWireListRow) => {
    const location = getLocation(row).toUpperCase();
    const fromBase = getBaseDeviceId(row.fromDeviceId);
    const toBase = getBaseDeviceId(row.toDeviceId);
    const fromPrefix = getPrefix(row.fromDeviceId);
    const toPrefix = getDevicePrefix(row.toDeviceId);
    const sourceCount = sourceCounts.get(location)?.get(fromBase) ?? 0;
    const pairCount = pairCounts.get(location)?.get(`${fromBase}->${toBase}`) ?? 0;
    const fallbackCount = fallbackPrefixCounts.get(location)?.get(`${fromPrefix}->${toPrefix}`) ?? 0;

    if (sourceCount > 2) {
      return { category: 0, primary: fromBase, secondary: "", tertiary: "", quaternary: "" };
    }

    if (pairCount >= 2) {
      return { category: 1, primary: fromBase, secondary: toBase, tertiary: "", quaternary: "" };
    }

    return fallbackCount === 1
      ? { category: 2, primary: fromPrefix, secondary: "", tertiary: toPrefix, quaternary: fromBase }
      : { category: 2, primary: fromPrefix, secondary: toPrefix, tertiary: fromBase, quaternary: "" };
  };

  return [...rows].sort((left, right) => {
    const leftLocation = getLocation(left);
    const rightLocation = getLocation(right);

    if (normalizedSheet) {
      const leftMatchesCurrent = locationMatchesCurrentSheet(leftLocation, normalizedSheet);
      const rightMatchesCurrent = locationMatchesCurrentSheet(rightLocation, normalizedSheet);

      if (leftMatchesCurrent !== rightMatchesCurrent) {
        return leftMatchesCurrent ? -1 : 1;
      }
    }

    const locationCompare = leftLocation.localeCompare(rightLocation, undefined, { numeric: true, sensitivity: "base" });
    if (locationCompare !== 0) {
      return locationCompare;
    }

    const leftFromBase = getBaseDeviceId(left.fromDeviceId);
    const rightFromBase = getBaseDeviceId(right.fromDeviceId);
    const leftFromPrefix = getDevicePrefix(left.fromDeviceId);
    const rightFromPrefix = getDevicePrefix(right.fromDeviceId);

    // For AF single-connections on the same base device, force terminal ordering high -> low.
    if (
      leftFromPrefix === "AF" &&
      rightFromPrefix === "AF" &&
      leftFromBase === rightFromBase
    ) {
      const terminalCompare = compareAfTerminalsDescending(
        getDeviceTerminal(left.fromDeviceId),
        getDeviceTerminal(right.fromDeviceId),
      );
      if (terminalCompare !== 0) {
        return terminalCompare;
      }
    }

    // For AT single-connections on the same base device, force terminal ordering low -> high.
    if (
      leftFromPrefix === "AT" &&
      rightFromPrefix === "AT" &&
      leftFromBase === rightFromBase
    ) {
      const terminalCompare = compareAtTerminalsAscending(
        getDeviceTerminal(left.fromDeviceId),
        getDeviceTerminal(right.fromDeviceId),
      );
      if (terminalCompare !== 0) {
        return terminalCompare;
      }
    }

    // For QF single-connections with custom part numbers, force custom terminal ordering.
    if (
      leftFromPrefix === "QF" &&
      rightFromPrefix === "QF" &&
      leftFromBase === rightFromBase
    ) {
      const leftQfRank = getQfTerminalRank(left);
      const rightQfRank = getQfTerminalRank(right);
      if (leftQfRank !== null && rightQfRank !== null && leftQfRank !== rightQfRank) {
        return leftQfRank - rightQfRank;
      }
    }

    const leftMeta = getGroupMeta(left);
    const rightMeta = getGroupMeta(right);
    if (leftMeta.category !== rightMeta.category) {
      return leftMeta.category - rightMeta.category;
    }

    const primaryCompare = leftMeta.primary.localeCompare(rightMeta.primary, undefined, { numeric: true, sensitivity: "base" });
    if (primaryCompare !== 0) {
      return primaryCompare;
    }

    const secondaryCompare = leftMeta.secondary.localeCompare(rightMeta.secondary, undefined, { numeric: true, sensitivity: "base" });
    if (secondaryCompare !== 0) {
      return secondaryCompare;
    }

    const tertiaryCompare = leftMeta.tertiary.localeCompare(rightMeta.tertiary, undefined, { numeric: true, sensitivity: "base" });
    if (tertiaryCompare !== 0) {
      return tertiaryCompare;
    }

    const quaternaryCompare = leftMeta.quaternary.localeCompare(rightMeta.quaternary, undefined, { numeric: true, sensitivity: "base" });
    if (quaternaryCompare !== 0) {
      return quaternaryCompare;
    }

    const gaugeCompare = compareGauge(left.gaugeSize, right.gaugeSize);
    if (gaugeCompare !== 0) {
      return gaugeCompare;
    }

    const fromDeviceCompare = left.fromDeviceId.localeCompare(right.fromDeviceId, undefined, { numeric: true, sensitivity: "base" });
    if (fromDeviceCompare !== 0) {
      return fromDeviceCompare;
    }

    const toDeviceCompare = left.toDeviceId.localeCompare(right.toDeviceId, undefined, { numeric: true, sensitivity: "base" });
    if (toDeviceCompare !== 0) {
      return toDeviceCompare;
    }

    return left.__rowIndex - right.__rowIndex;
  });
}

function sortKaTwinFerruleMatches(matches: PatternMatchRow[]): PatternMatchRow[] {
  return [...matches].sort((left, right) => {
    const leftGroupKey = String(left.metadata.meta.groupKey ?? "");
    const rightGroupKey = String(right.metadata.meta.groupKey ?? "");

    if (leftGroupKey !== rightGroupKey) {
      return leftGroupKey.localeCompare(rightGroupKey);
    }

    const leftDestination = left.row.toDeviceId.toUpperCase().trim();
    const rightDestination = right.row.toDeviceId.toUpperCase().trim();
    const destinationCompare = leftDestination.localeCompare(rightDestination);
    if (destinationCompare !== 0) {
      return destinationCompare;
    }

    return left.row.__rowIndex - right.row.__rowIndex;
  });
}

function sortSequentialRunMatches(matches: PatternMatchRow[], currentSheetName: string): PatternMatchRow[] {
  return [...matches].sort((left, right) => {
    const leftLocation = left.row.toLocation || left.row.fromLocation || left.row.location || "";
    const rightLocation = right.row.toLocation || right.row.fromLocation || right.row.location || "";
    const leftMatchesCurrentSheet = locationMatchesCurrentSheet(leftLocation, currentSheetName);
    const rightMatchesCurrentSheet = locationMatchesCurrentSheet(rightLocation, currentSheetName);

    if (leftMatchesCurrentSheet !== rightMatchesCurrentSheet) {
      return leftMatchesCurrentSheet ? -1 : 1;
    }

    const locationCompare = leftLocation.localeCompare(rightLocation);
    if (locationCompare !== 0) {
      return locationCompare;
    }

    const leftRunOrder = Number(left.metadata.meta.runOrder ?? Number.MAX_SAFE_INTEGER);
    const rightRunOrder = Number(right.metadata.meta.runOrder ?? Number.MAX_SAFE_INTEGER);
    if (leftRunOrder !== rightRunOrder) {
      return leftRunOrder - rightRunOrder;
    }

    const leftRowOrder = Number(left.metadata.meta.rowOrder ?? left.row.__rowIndex);
    const rightRowOrder = Number(right.metadata.meta.rowOrder ?? right.row.__rowIndex);
    if (leftRowOrder !== rightRowOrder) {
      return leftRowOrder - rightRowOrder;
    }

    return left.row.__rowIndex - right.row.__rowIndex;
  });
}

function sortGroundMatches(matches: PatternMatchRow[], currentSheetName: string): PatternMatchRow[] {
  return [...matches].sort((left, right) => {
    const leftInternal = Boolean(left.metadata.meta.isInternal);
    const rightInternal = Boolean(right.metadata.meta.isInternal);

    if (leftInternal !== rightInternal) {
      return leftInternal ? -1 : 1;
    }

    const leftLocation = left.row.toLocation || left.row.fromLocation || left.row.location || "";
    const rightLocation = right.row.toLocation || right.row.fromLocation || right.row.location || "";
    const leftMatchesCurrentSheet = locationMatchesCurrentSheet(leftLocation, currentSheetName);
    const rightMatchesCurrentSheet = locationMatchesCurrentSheet(rightLocation, currentSheetName);

    if (leftMatchesCurrentSheet !== rightMatchesCurrentSheet) {
      return leftMatchesCurrentSheet ? -1 : 1;
    }

    const locationCompare = leftLocation.localeCompare(rightLocation, undefined, { numeric: true, sensitivity: "base" });
    if (locationCompare !== 0) {
      return locationCompare;
    }

    const fromDeviceCompare = left.row.fromDeviceId.localeCompare(right.row.fromDeviceId, undefined, { numeric: true, sensitivity: "base" });
    if (fromDeviceCompare !== 0) {
      return fromDeviceCompare;
    }

    return left.row.__rowIndex - right.row.__rowIndex;
  });
}

/**
 * Apply an identification filter to the rows.
 * 
 * @param rows - Semantic wire list rows
 * @param filterKind - The filter to apply
 * @param blueLabels - Blue Labels sequence map (if available)
 * @param currentSheetName - Current sheet name
 * @returns Filter result with filtered rows and metadata
 */
export function applyIdentificationFilter(
  rows: SemanticWireListRow[],
  filterKind: IdentificationFilterKind,
  blueLabels: BlueLabelSequenceMap | null,
  currentSheetName: string,
  partNumberMap: Map<string, PartNumberLookupResult> | null = null,
): IdentificationFilterResult {
  const normalizedSheetName = normalizeSheetName(currentSheetName);

  const context: PatternExtractionContext = {
    rows,
    blueLabels,
    currentSheetName,
    normalizedSheetName,
    partNumberMap,
  };

  // Get filter definition
  const filterDef = FILTER_REGISTRY[filterKind];

  // Extract matches
  let matches = filterDef.extractor(context);

  if (filterKind === "grounds") {
    matches = sortGroundMatches(matches, currentSheetName);
  } else if (filterKind === "ka_twin_ferrules") {
    matches = sortKaTwinFerruleMatches(matches);
  } else if (["fu_jumpers", "ka_jumpers", "kt_jumpers", "cables", "vio_jumpers", "resistors", "ka_relay_plugin_jumpers"].includes(filterKind)) {
    matches = sortSequentialRunMatches(matches, currentSheetName);
  }

  // Build match metadata map
  const matchMetadata: Record<string, PatternMatchRow["metadata"]> = {};
  for (const match of matches) {
    matchMetadata[match.row.__rowId] = match.metadata;
  }

  // Get filtered rows
  let filteredRows = matches.map(m => m.row);

  if (filterKind === "single_connections") {
    filteredRows = sortSingleConnectionRows(filteredRows, currentSheetName, partNumberMap);
  } else if (filterKind !== "grounds" && filterKind !== "ka_twin_ferrules" && !["fu_jumpers", "ka_jumpers", "kt_jumpers", "cables", "vio_jumpers", "resistors", "ka_relay_plugin_jumpers"].includes(filterKind)) {
    // Sort by location first (prioritizing current sheet), then gauge (larger number = smaller wire = first)
    filteredRows = sortRowsByLocationAndGauge(filteredRows, currentSheetName);
  }

  // Build summary
  const summary = buildFilterSummary(filterKind, matches, context);

  return {
    kind: filterKind,
    rows: filteredRows,
    matchMetadata,
    summary,
  };
}

/**
 * Build summary statistics for a filter result.
 */
function buildFilterSummary(
  kind: IdentificationFilterKind,
  matches: PatternMatchRow[],
  context: PatternExtractionContext
): IdentificationSummary {
  const summary: IdentificationSummary = {
    totalMatched: matches.length,
    breakdown: {},
  };

  // Special handling for grounds
  if (kind === "grounds") {
    const groundSummary = getGroundSummary(context);
    summary.internalCount = groundSummary.internal;
    summary.externalCount = groundSummary.external;
  }

  // Special handling for jumpers (breakdown by type)
  if (kind === "jumpers") {
    const breakdown: Record<string, number> = {};
    for (const match of matches) {
      const type = match.metadata.matchType;
      breakdown[type] = (breakdown[type] || 0) + 1;
    }
    summary.breakdown = breakdown;
  }

  // Special handling for clips (breakdown by clip type)
  if (kind === "clips") {
    const breakdown: Record<string, number> = {};
    for (const match of matches) {
      const clipType = match.metadata.meta.clipType as string || "generic";
      breakdown[clipType] = (breakdown[clipType] || 0) + 1;
    }
    summary.breakdown = breakdown;
  }

  if (kind === "ka_twin_ferrules") {
    const uniqueGroups = new Set(matches.map(match => String(match.metadata.meta.groupKey ?? ""))).size;
    summary.groupCount = uniqueGroups;
  }

  if (["fu_jumpers", "ka_jumpers", "kt_jumpers", "cables", "vio_jumpers", "resistors", "ka_relay_plugin_jumpers"].includes(kind)) {
    summary.groupCount = new Set(matches.map(match => String(match.metadata.meta.runId ?? ""))).size;
  }

  return summary;
}

// ============================================================================
// Exports
// ============================================================================

export { FILTER_REGISTRY, FILTER_METADATA };
