import type { SemanticWireListRow } from "@/lib/workbook/types";
import type { PartNumberLookupResult } from "@/lib/part-number-list";
import { lookupPartNumber } from "@/lib/part-number-list";
import type { BlueLabelSequenceMap, IdentificationFilterKind, PatternMatchMetadata } from "@/lib/wiring-identification/types";
import type { MappedAssignment } from "@/lib/assignment/mapped-assignment";
import type { ExternalLocationConfig } from "@/lib/layout-matching/ubp-reference-index";
import { BoxSideConfig, type BoxSideName } from "@/boxSide";
import { sortRowsByGaugeSize } from "@/lib/wiring-identification/gauge-filter";
import {
  detectDeviceChange,
  filterEmptyDeviceChangeSections,
} from "@/lib/wiring-identification/device-change-pattern";
import { getSheetDeviceSequence } from "@/lib/wiring-identification/blue-label-sequence";
import { hasMechanicalRelayPartNumber } from "@/lib/wiring-identification/jumper-part-number";
import {
  buildRenderableSectionSubgroups,
  buildSubgroupStartMap,
  buildWireListRenderPlan,
  compileWireListSections,
  groupCompiledSectionsByLocation,
  shouldSwapForTargetPair,
  type WireListCompiledSectionKind,
} from "@/lib/wire-list-sections";
import type { WireListRenderPlanItem } from "@/lib/wire-list-sections";
import type { BrandingSortMode, JumperSection, PrintFormatMode, PrintSettings, SectionColumnVisibility } from "@/lib/wire-list-print/defaults";
import { getEffectiveSectionColumns } from "@/lib/wire-list-print/defaults";

export interface PrintSubsection {
  label: string;
  rows: SemanticWireListRow[];
  sectionKind?: IdentificationFilterKind;
  matchMetadata?: Record<string, PatternMatchMetadata>;
  deviceToDeviceSubsections?: { label: string; rows: SemanticWireListRow[] }[];
}

export interface PrintLocationGroup {
  location: string;
  isExternal: boolean;
  /** Box side value from assignment (e.g., "LEFT DOOR", "CENTER BACK") */
  boxSide?: string;
  subsections: PrintSubsection[];
  totalRows: number;
}

export interface BrandingPreviewRow {
  row: SemanticWireListRow;
  baseLength?: number;
  measurement?: number;
  isManual: boolean;
  location: string;
  isExternal: boolean;
}

export interface BrandingVisibleSection {
  group: PrintLocationGroup;
  subsection: PrintSubsection;
  rows: BrandingPreviewRow[];
}

export interface VisiblePreviewSection {
  group: PrintLocationGroup;
  subsection: PrintSubsection;
  sectionColumns: SectionColumnVisibility;
  visibleRows: SemanticWireListRow[];
}

function getDeviceTerminalValue(deviceId: string | undefined): string {
  return deviceId?.split(":")[1]?.trim().toUpperCase() || "";
}

function getBaseDeviceIdValue(deviceId: string | undefined): string {
  return deviceId?.split(":")[0]?.trim() || "";
}

function getDevicePrefixValue(deviceId: string | undefined): string {
  const baseDeviceId = getBaseDeviceIdValue(deviceId);
  const match = baseDeviceId.match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : baseDeviceId.toUpperCase() || "Unknown";
}

function hasBrandingTerminationDetail(label: string): boolean {
  return /[:/]/.test(label);
}

function normalizeBrandingBundleColor(value: string | null | undefined): "RED" | "BLU" | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "RED") {
    return "RED";
  }
  if (normalized === "BLU" || normalized === "BLUE") {
    return "BLU";
  }
  return null;
}

function resolveBrandingBundleNameForRow(
  subgroupLabel: string,
  row: SemanticWireListRow,
  baseDeviceRowCounts: Map<string, number>,
  includeWireColor = true,
): string {
  const normalizedLabel = subgroupLabel.trim();
  const baseDeviceId = getBaseDeviceIdValue(getDisplayEndpoints(row).fromDeviceId);
  const bundleColor = includeWireColor ? normalizeBrandingBundleColor(row.wireId) : null;

  if (baseDeviceId && bundleColor && (baseDeviceRowCounts.get(baseDeviceId) ?? 0) > 1) {
    return `${baseDeviceId} - ${bundleColor}`;
  }

  if (baseDeviceId && (baseDeviceRowCounts.get(baseDeviceId) ?? 0) > 1 && (!normalizedLabel || hasBrandingTerminationDetail(normalizedLabel))) {
    return baseDeviceId;
  }

  return normalizedLabel || getDevicePrefixValue(baseDeviceId);
}

function getEffectiveBrandingSubgroupLabel(subgroupLabel: string, row: SemanticWireListRow): string {
  const normalizedLabel = subgroupLabel.trim();
  if (!normalizedLabel) {
    return "";
  }

  const baseDeviceId = getBaseDeviceIdValue(getDisplayEndpoints(row).fromDeviceId);
  const labelBaseDevice = normalizedLabel.split(/[:/]/)[0]?.trim() ?? "";

  if (/^[A-Z]+[0-9]+$/i.test(labelBaseDevice) && baseDeviceId && labelBaseDevice.toUpperCase() !== baseDeviceId.toUpperCase()) {
    return "";
  }

  return normalizedLabel;
}

function getBlueLabelSequenceIndex(
  row: SemanticWireListRow,
  sequenceIndexMap: Map<string, number>,
): number | null {
  const endpoints = getDisplayEndpoints(row);
  const candidates = [
    getBaseDeviceIdValue(endpoints.fromDeviceId),
    getBaseDeviceIdValue(endpoints.toDeviceId),
  ];

  for (const candidate of candidates) {
    const normalized = candidate.trim().toUpperCase();
    if (!normalized) continue;
    const index = sequenceIndexMap.get(normalized);
    if (index !== undefined) {
      return index;
    }
  }

  return null;
}

function getBlueLabelSequenceDeviceId(
  row: SemanticWireListRow,
  sequenceIndexMap: Map<string, { index: number; label: string }>,
): string | null {
  const endpoints = getDisplayEndpoints(row);
  const candidates = [
    getBaseDeviceIdValue(endpoints.fromDeviceId),
    getBaseDeviceIdValue(endpoints.toDeviceId),
  ];

  for (const candidate of candidates) {
    const normalized = candidate.trim().toUpperCase();
    if (!normalized) continue;
    const match = sequenceIndexMap.get(normalized);
    if (match) {
      return match.label;
    }
  }

  return null;
}

export function buildBlueLabelDeviceSubsections(
  rows: SemanticWireListRow[],
  currentSheetName: string,
  blueLabels: BlueLabelSequenceMap | null,
): { label: string; rows: SemanticWireListRow[] }[] | null {
  if (!blueLabels?.isValid) {
    return null;
  }

  const sequence = getSheetDeviceSequence(currentSheetName, blueLabels);
  if (sequence.length === 0) {
    return null;
  }

  const sequenceIndexMap = new Map(
    sequence.map((deviceId, index) => [
      deviceId.trim().toUpperCase(),
      { index, label: deviceId.trim() },
    ]),
  );
  const groups = new Map<string, { label: string; rows: SemanticWireListRow[]; order: number }>();
  let fallbackOrder = sequence.length;

  for (const row of rows) {
    const label = getBlueLabelSequenceDeviceId(row, sequenceIndexMap)
      ?? getBaseDeviceIdValue(getDisplayEndpoints(row).fromDeviceId)
      ?? "Unsequenced";
    const normalizedLabel = label.trim() || "Unsequenced";
    const sequenceEntry = sequenceIndexMap.get(normalizedLabel.toUpperCase());
    const existing = groups.get(normalizedLabel);

    if (existing) {
      existing.rows.push(row);
      continue;
    }

    groups.set(normalizedLabel, {
      label: normalizedLabel,
      rows: [row],
      order: sequenceEntry?.index ?? fallbackOrder++,
    });
  }

  if (groups.size === 0) {
    return null;
  }

  return Array.from(groups.values())
    .sort((left, right) => left.order - right.order)
    .map(({ label, rows }) => ({ label, rows }));
}

function sortSingleConnectionsByBlueLabelSequence(
  rows: SemanticWireListRow[],
  currentSheetName: string,
  blueLabels: BlueLabelSequenceMap | null,
): SemanticWireListRow[] | null {
  if (!blueLabels?.isValid) {
    return null;
  }

  const sequence = getSheetDeviceSequence(currentSheetName, blueLabels);
  if (sequence.length === 0) {
    return null;
  }

  const sequenceIndexMap = new Map(
    sequence.map((deviceId, index) => [deviceId.trim().toUpperCase(), index]),
  );
  const indexedRows = rows.map((row, index) => ({
    row,
    index,
    sequenceIndex: getBlueLabelSequenceIndex(row, sequenceIndexMap),
  }));

  if (indexedRows.every((entry) => entry.sequenceIndex === null)) {
    return null;
  }

  return indexedRows
    .sort((left, right) => {
      const leftSequence = left.sequenceIndex;
      const rightSequence = right.sequenceIndex;

      if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence) {
        return leftSequence - rightSequence;
      }
      if (leftSequence !== null && rightSequence === null) {
        return -1;
      }
      if (leftSequence === null && rightSequence !== null) {
        return 1;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.row);
}

function getDisplayEndpoints(row: SemanticWireListRow): {
  fromDeviceId: string;
  toDeviceId: string;
  fromLocation: string;
  toLocation: string;
} {
  const shouldSwap = shouldSwapForTargetPair(row.fromDeviceId, row.toDeviceId);
  const fromDeviceId = shouldSwap ? (row.toDeviceId || "") : (row.fromDeviceId || "");
  const toDeviceId = shouldSwap ? (row.fromDeviceId || "") : (row.toDeviceId || "");

  // Prefer explicit endpoint fields; row.location is legacy fallback only.
  const rawFromLocation = row.fromLocation || "";
  const rawToLocation = row.toLocation || row.location || rawFromLocation || "";

  const fromLocation = shouldSwap ? rawToLocation || rawFromLocation : rawFromLocation || rawToLocation;
  const toLocation = shouldSwap ? rawFromLocation || rawToLocation : rawToLocation || rawFromLocation;

  return { fromDeviceId, toDeviceId, fromLocation, toLocation };
}

export function isPrintableConnectionRow(row: SemanticWireListRow): boolean {
  if (detectDeviceChange(row).isDeviceChange) {
    return false;
  }

  const wireNo = (row.wireNo || "").trim();
  const wireId = (row.wireId || "").trim();
  const gaugeSize = (row.gaugeSize || "").trim();

  // Remove placeholder transition rows like: AF0022:J,*,,,60.0,AF0023:P
  return !(wireNo === "*" && !wireId && !gaugeSize);
}

function getAfTerminalGroupOrder(terminal: string): number {
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
}

function compareAfTerminalsDescending(leftTerminal: string, rightTerminal: string): number {
  const leftGroup = getAfTerminalGroupOrder(leftTerminal);
  const rightGroup = getAfTerminalGroupOrder(rightTerminal);

  // First, sort by group (lower group number comes first)
  if (leftGroup !== rightGroup) {
    return leftGroup - rightGroup;
  }

  // Within same group, sort numerically descending
  const isLeftNumeric = /^\d+$/.test(leftTerminal);
  const isRightNumeric = /^\d+$/.test(rightTerminal);

  if (isLeftNumeric && isRightNumeric) {
    const leftValue = Number.parseInt(leftTerminal, 10);
    const rightValue = Number.parseInt(rightTerminal, 10);
    if (leftValue !== rightValue) {
      return rightValue - leftValue;
    }
  }

  return rightTerminal.localeCompare(leftTerminal, undefined, { numeric: true });
}

function compareAtTerminalsAscending(leftTerminal: string, rightTerminal: string): number {
  const isLeftNumeric = /^\d+$/.test(leftTerminal);
  const isRightNumeric = /^\d+$/.test(rightTerminal);

  if (isLeftNumeric && isRightNumeric) {
    const leftValue = Number.parseInt(leftTerminal, 10);
    const rightValue = Number.parseInt(rightTerminal, 10);
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return leftTerminal.localeCompare(rightTerminal, undefined, { numeric: true });
}

const KA_RELAY_TERMINAL_ORDER: Record<string, number> = {
  "12": 0,
  "22": 1,
  "14": 2,
  "24": 3,
  "11": 4,
  "21": 5,
};

const KA_RELAY_PART_NUMBERS = new Set(["1061979-1", "1061979-2"]);

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

function normalizePartNumberForSort(partNumber: string | undefined): string {
  return String(partNumber ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function hasMatchingSortPartNumber(partNumber: string | undefined, allowedPartNumbers: Set<string>): boolean {
  return String(partNumber ?? "")
    .split(/[\n,;]+/)
    .map(value => normalizePartNumberForSort(value))
    .some(value => value.length > 0 && allowedPartNumbers.has(value));
}

function getKaRelayTerminalRank(
  row: SemanticWireListRow,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
): number | null {
  if (!partNumberMap) {
    return null;
  }

  const prefix = getDevicePrefixValue(row.fromDeviceId);
  if (prefix !== "KA") {
    return null;
  }

  const partNumber = lookupPartNumber(partNumberMap, row.fromDeviceId)?.partNumber;
  if (!partNumber || !KA_RELAY_PART_NUMBERS.has(partNumber)) {
    return null;
  }

  const terminal = getDeviceTerminalValue(row.fromDeviceId);
  return terminal in KA_RELAY_TERMINAL_ORDER ? KA_RELAY_TERMINAL_ORDER[terminal] : null;
}

function getQfTerminalRank(
  row: SemanticWireListRow,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
): number | null {
  if (!partNumberMap) {
    return null;
  }

  const prefix = getDevicePrefixValue(row.fromDeviceId);
  if (prefix !== "QF") {
    return null;
  }

  const partNumber = lookupPartNumber(partNumberMap, row.fromDeviceId)?.partNumber;
  if (!hasMatchingSortPartNumber(partNumber, QF_PART_NUMBERS)) {
    return null;
  }

  const terminal = getDeviceTerminalValue(row.fromDeviceId);
  return terminal in QF_TERMINAL_ORDER ? QF_TERMINAL_ORDER[terminal] : null;
}

function compareClipRowsByTerminal(
  left: SemanticWireListRow,
  right: SemanticWireListRow,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
): number {
  const leftKaRank = getKaRelayTerminalRank(left, partNumberMap);
  const rightKaRank = getKaRelayTerminalRank(right, partNumberMap);

  if (leftKaRank !== null && rightKaRank !== null && leftKaRank !== rightKaRank) {
    return leftKaRank - rightKaRank;
  }

  const leftQfRank = getQfTerminalRank(left, partNumberMap);
  const rightQfRank = getQfTerminalRank(right, partNumberMap);

  if (leftQfRank !== null && rightQfRank !== null && leftQfRank !== rightQfRank) {
    return leftQfRank - rightQfRank;
  }

  const leftTerminal = getDeviceTerminalValue(left.fromDeviceId);
  const rightTerminal = getDeviceTerminalValue(right.fromDeviceId);
  const leftIsNumeric = /^\d+$/.test(leftTerminal);
  const rightIsNumeric = /^\d+$/.test(rightTerminal);

  if (leftIsNumeric && rightIsNumeric) {
    const leftValue = Number.parseInt(leftTerminal, 10);
    const rightValue = Number.parseInt(rightTerminal, 10);
    if (leftValue !== rightValue) {
      return leftValue - rightValue;
    }
  }

  return leftTerminal.localeCompare(rightTerminal, undefined, { numeric: true });
}

function getSingleConnectionDeviceGroup(
  deviceId: string | undefined,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
): string {
  const prefix = getDevicePrefixValue(deviceId);
  const terminal = getDeviceTerminalValue(deviceId);

  if (
    prefix === "KA" &&
    (terminal === "A1" || terminal === "A2") &&
    hasMechanicalRelayPartNumber(deviceId || "", partNumberMap)
  ) {
    return `${prefix}:${terminal}`;
  }

  return prefix;
}

export function buildSingleConnectionTocSubsections(
  rows: SemanticWireListRow[],
  matchMetadata: Record<string, PatternMatchMetadata> = {},
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  skipSingletonMerge = false,
): { label: string; rows: SemanticWireListRow[] }[] {
  return buildTocSubsections("single_connections", rows, matchMetadata, partNumberMap, skipSingletonMerge);
}

export function buildTocSubsections(
  sectionKind: IdentificationFilterKind,
  rows: SemanticWireListRow[],
  matchMetadata: Record<string, PatternMatchMetadata> = {},
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  skipSingletonMerge = false,
): { label: string; rows: SemanticWireListRow[] }[] {
  const subgroups = buildRenderableSectionSubgroups(sectionKind, rows, matchMetadata, partNumberMap, skipSingletonMerge);
  const rowsById = new Map(rows.map((row) => [row.__rowId, row]));

  // Sort subgroups by device prefix when singleton merge is skipped
  if (skipSingletonMerge) {
    subgroups.sort((a, b) => {
      // Prioritize target device pair groups (SB, HL, SA)
      const aIsTarget = a.id.startsWith("single-target-pair:");
      const bIsTarget = b.id.startsWith("single-target-pair:");
      if (aIsTarget !== bIsTarget) {
        return aIsTarget ? -1 : 1;
      }

      const aFirstRow = a.rowIds.length > 0 ? rowsById.get(a.rowIds[0]) : undefined;
      const bFirstRow = b.rowIds.length > 0 ? rowsById.get(b.rowIds[0]) : undefined;
      const aPrefix = aIsTarget
        ? getDevicePrefixValue(a.label)
        : getDevicePrefixValue(aFirstRow ? getDisplayEndpoints(aFirstRow).fromDeviceId : undefined);
      const bPrefix = bIsTarget
        ? getDevicePrefixValue(b.label)
        : getDevicePrefixValue(bFirstRow ? getDisplayEndpoints(bFirstRow).fromDeviceId : undefined);
      const prefixCompare = aPrefix.localeCompare(bPrefix, undefined, { numeric: true });
      if (prefixCompare !== 0) return prefixCompare;
      return a.order - b.order;
    });
  }

  return subgroups.map((subgroup) => ({
    label: subgroup.label,
    rows: subgroup.rowIds
      .map((rowId) => rowsById.get(rowId))
      .filter((row): row is SemanticWireListRow => Boolean(row)),
  }));
}

export function shouldPreservePrintSubsectionOrder(sectionKind?: IdentificationFilterKind): boolean {
  return Boolean(sectionKind && [
    "cables",
    "fu_jumpers",
    "ka_jumpers",
    "kt_jumpers",
    "vio_jumpers",
    "resistors",
    "ka_twin_ferrules",
    "ka_relay_plugin_jumpers",
  ].includes(sectionKind));
}

export function sortRowsForDeviceGroupedPreview(
  rows: SemanticWireListRow[],
  currentSheetName: string,
  isCablesSection: boolean,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  sectionKind?: IdentificationFilterKind,
): SemanticWireListRow[] {
  const normalizedSheetName = currentSheetName.toUpperCase().trim();
  const indexedRows = rows.map((row, index) => ({ row, index }));
  const getDisplayFromDeviceId = (row: SemanticWireListRow) => getDisplayEndpoints(row).fromDeviceId;
  const getDisplayToDeviceId = (row: SemanticWireListRow) => getDisplayEndpoints(row).toDeviceId;
  const getFromDeviceGroup = (row: SemanticWireListRow) => getSingleConnectionDeviceGroup(getDisplayFromDeviceId(row), partNumberMap);
  const getToDeviceGroup = (row: SemanticWireListRow) => getDevicePrefixValue(getDisplayToDeviceId(row));
  const getBaseDeviceId = (row: SemanticWireListRow) => getBaseDeviceIdValue(getDisplayFromDeviceId(row));
  const getLocation = (row: SemanticWireListRow) => getDisplayEndpoints(row).fromLocation || row.location || "";
  const sourceCounts = new Map<string, Map<string, number>>();
  const pairCounts = new Map<string, Map<string, number>>();
  const fallbackPrefixCounts = new Map<string, Map<string, number>>();

  rows.forEach((row) => {
    const sourceGroup = getFromDeviceGroup(row);
    const pairGroup = getToDeviceGroup(row);
    const location = getLocation(row);

    const sourceLocationCounts = sourceCounts.get(sourceGroup) ?? new Map<string, number>();
    sourceLocationCounts.set(location, (sourceLocationCounts.get(location) ?? 0) + 1);
    sourceCounts.set(sourceGroup, sourceLocationCounts);

    const pairLocationCounts = pairCounts.get(`${sourceGroup}|${pairGroup}`) ?? new Map<string, number>();
    pairLocationCounts.set(location, (pairLocationCounts.get(location) ?? 0) + 1);
    pairCounts.set(`${sourceGroup}|${pairGroup}`, pairLocationCounts);

    const fallbackCounts = fallbackPrefixCounts.get(pairGroup) ?? new Map<string, number>();
    fallbackCounts.set(location, (fallbackCounts.get(location) ?? 0) + 1);
    fallbackPrefixCounts.set(pairGroup, fallbackCounts);
  });

  const compareGauge = (left: SemanticWireListRow, right: SemanticWireListRow) => {
    const leftGauge = left.gaugeSize ? Number.parseFloat(left.gaugeSize) : Number.NaN;
    const rightGauge = right.gaugeSize ? Number.parseFloat(right.gaugeSize) : Number.NaN;

    if (Number.isNaN(leftGauge) && Number.isNaN(rightGauge)) return 0;
    if (Number.isNaN(leftGauge)) return 1;
    if (Number.isNaN(rightGauge)) return -1;
    return leftGauge - rightGauge;
  };

  return indexedRows
    .sort((left, right) => {
      const leftSourceGroup = getFromDeviceGroup(left.row);
      const rightSourceGroup = getFromDeviceGroup(right.row);

      const leftSourceIsCurrent = (sourceCounts.get(leftSourceGroup)?.get(normalizedSheetName) ?? 0) > 0;
      const rightSourceIsCurrent = (sourceCounts.get(rightSourceGroup)?.get(normalizedSheetName) ?? 0) > 0;
      if (leftSourceIsCurrent !== rightSourceIsCurrent) {
        return leftSourceIsCurrent ? -1 : 1;
      }

      if (leftSourceGroup !== rightSourceGroup) {
        return leftSourceGroup.localeCompare(rightSourceGroup, undefined, { numeric: true });
      }

      const leftPairGroup = getToDeviceGroup(left.row);
      const rightPairGroup = getToDeviceGroup(right.row);
      const leftPairKey = `${leftSourceGroup}|${leftPairGroup}`;
      const rightPairKey = `${rightSourceGroup}|${rightPairGroup}`;
      const leftPairIsCurrent = (pairCounts.get(leftPairKey)?.get(normalizedSheetName) ?? 0) > 0;
      const rightPairIsCurrent = (pairCounts.get(rightPairKey)?.get(normalizedSheetName) ?? 0) > 0;
      if (leftPairIsCurrent !== rightPairIsCurrent) {
        return leftPairIsCurrent ? -1 : 1;
      }

      if (leftPairGroup !== rightPairGroup) {
        return leftPairGroup.localeCompare(rightPairGroup, undefined, { numeric: true });
      }

      const leftLocation = getLocation(left.row);
      const rightLocation = getLocation(right.row);
      const leftLocationIsCurrent = leftLocation.toUpperCase().includes(normalizedSheetName);
      const rightLocationIsCurrent = rightLocation.toUpperCase().includes(normalizedSheetName);
      if (leftLocationIsCurrent !== rightLocationIsCurrent) {
        return leftLocationIsCurrent ? -1 : 1;
      }

      const locationCompare = leftLocation.localeCompare(rightLocation, undefined, { numeric: true });
      if (locationCompare !== 0) {
        return locationCompare;
      }

      // For AF rows on the same base device, enforce terminal ordering high -> low
      // before any subgroup/category comparisons can reorder them.
      const leftFromPrefix = getDevicePrefixValue(getDisplayFromDeviceId(left.row));
      const rightFromPrefix = getDevicePrefixValue(getDisplayFromDeviceId(right.row));
      const leftBaseDevice = getBaseDeviceId(left.row);
      const rightBaseDevice = getBaseDeviceId(right.row);
      if (
        leftFromPrefix === "AF" &&
        rightFromPrefix === "AF" &&
        leftBaseDevice === rightBaseDevice
      ) {
        const terminalCompare = compareAfTerminalsDescending(
          getDeviceTerminalValue(getDisplayFromDeviceId(left.row)),
          getDeviceTerminalValue(getDisplayFromDeviceId(right.row)),
        );
        if (terminalCompare !== 0) {
          return terminalCompare;
        }
      }

      if (
        leftFromPrefix === "AT" &&
        rightFromPrefix === "AT" &&
        leftBaseDevice === rightBaseDevice
      ) {
        const terminalCompare = compareAtTerminalsAscending(
          getDeviceTerminalValue(getDisplayFromDeviceId(left.row)),
          getDeviceTerminalValue(getDisplayFromDeviceId(right.row)),
        );
        if (terminalCompare !== 0) {
          return terminalCompare;
        }
      }

      const baseCompare = leftBaseDevice.localeCompare(rightBaseDevice, undefined, { numeric: true });
      if (baseCompare !== 0) {
        return baseCompare;
      }

      if (sectionKind === "clips") {
        const clipTerminalCompare = compareClipRowsByTerminal(left.row, right.row, partNumberMap);
        if (clipTerminalCompare !== 0) {
          return clipTerminalCompare;
        }
      }

      if (leftFromPrefix === "AF" && rightFromPrefix === "AF") {
        const terminalCompare = compareAfTerminalsDescending(
          getDeviceTerminalValue(getDisplayFromDeviceId(left.row)),
          getDeviceTerminalValue(getDisplayFromDeviceId(right.row)),
        );
        if (terminalCompare !== 0) {
          return terminalCompare;
        }
      }

      const gaugeCompare = compareGauge(left.row, right.row);
      if (gaugeCompare !== 0) {
        return gaugeCompare;
      }

      if (isCablesSection) {
        const leftType = (left.row.wireType || "").toUpperCase().trim();
        const rightType = (right.row.wireType || "").toUpperCase().trim();
        const typeCompare = leftType.localeCompare(rightType, undefined, { numeric: true });
        if (typeCompare !== 0) {
          return typeCompare;
        }
      }

      const wireNumberCompare = (left.row.wireNo || "").localeCompare(right.row.wireNo || "", undefined, { numeric: true });
      if (wireNumberCompare !== 0) {
        return wireNumberCompare;
      }

      return left.index - right.index;
    })
    .map(({ row }) => row);
}

export function sortRowsForPrintSubsection(
  rows: SemanticWireListRow[],
  currentSheetName: string,
  sectionKind?: IdentificationFilterKind,
  matchMetadata: Record<string, PatternMatchMetadata> = {},
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  blueLabels?: BlueLabelSequenceMap | null,
  sortMode: BrandingSortMode = "default",
): SemanticWireListRow[] {
  if (sectionKind === "single_connections" && sortMode === "blue-label-sequence") {
    const blueLabelSortedRows = sortSingleConnectionsByBlueLabelSequence(rows, currentSheetName, blueLabels ?? null);
    if (blueLabelSortedRows) {
      return blueLabelSortedRows;
    }
  }

  if (sectionKind === "ka_twin_ferrules") {
    // Sort by location first (same-location-first), then groupKey to keep pairs together
    return [...rows].sort((left, right) => {
      const leftLocation = left.fromLocation || left.location || "";
      const rightLocation = right.fromLocation || right.location || "";
      const leftCurrent = currentSheetName ? leftLocation.toUpperCase().includes(currentSheetName.toUpperCase()) : false;
      const rightCurrent = currentSheetName ? rightLocation.toUpperCase().includes(currentSheetName.toUpperCase()) : false;
      if (leftCurrent !== rightCurrent) {
        return leftCurrent ? -1 : 1;
      }
      const locationCompare = leftLocation.localeCompare(rightLocation);
      if (locationCompare !== 0) {
        return locationCompare;
      }

      const leftKey = String(matchMetadata[left.__rowId]?.meta.groupKey ?? "");
      const rightKey = String(matchMetadata[right.__rowId]?.meta.groupKey ?? "");
      const keyCompare = leftKey.localeCompare(rightKey, undefined, { numeric: true });
      if (keyCompare !== 0) {
        return keyCompare;
      }

      const leftTo = getBaseDeviceIdValue(left.toDeviceId);
      const rightTo = getBaseDeviceIdValue(right.toDeviceId);
      const toCompare = leftTo.localeCompare(rightTo, undefined, { numeric: true });
      if (toCompare !== 0) {
        return toCompare;
      }

      const leftFrom = getBaseDeviceIdValue(left.fromDeviceId);
      const rightFrom = getBaseDeviceIdValue(right.fromDeviceId);
      return leftFrom.localeCompare(rightFrom, undefined, { numeric: true });
    });
  }

  if (sectionKind === "resistors") {
    return [...rows].sort((left, right) => {
      const leftLocation = left.toLocation || left.fromLocation || left.location || "";
      const rightLocation = right.toLocation || right.fromLocation || right.location || "";
      const leftCurrent = leftLocation.toUpperCase().includes(currentSheetName.toUpperCase());
      const rightCurrent = rightLocation.toUpperCase().includes(currentSheetName.toUpperCase());

      if (leftCurrent !== rightCurrent) {
        return leftCurrent ? -1 : 1;
      }

      return (left.wireNo || "").localeCompare(right.wireNo || "", undefined, { numeric: true });
    });
  }

  if (sectionKind === "clips") {
    const normalizedSheetName = currentSheetName.toUpperCase().trim();
    return [...rows].sort((left, right) => {
      const leftLocation = left.fromLocation || left.location || "";
      const rightLocation = right.fromLocation || right.location || "";
      const leftCurrent = normalizedSheetName
        ? leftLocation.toUpperCase().includes(normalizedSheetName)
        : false;
      const rightCurrent = normalizedSheetName
        ? rightLocation.toUpperCase().includes(normalizedSheetName)
        : false;

      if (leftCurrent !== rightCurrent) {
        return leftCurrent ? -1 : 1;
      }

      const locationCompare = leftLocation.localeCompare(rightLocation, undefined, { numeric: true });
      if (locationCompare !== 0) {
        return locationCompare;
      }

      const baseCompare = getBaseDeviceIdValue(left.fromDeviceId).localeCompare(
        getBaseDeviceIdValue(right.fromDeviceId),
        undefined,
        { numeric: true },
      );
      if (baseCompare !== 0) {
        return baseCompare;
      }

      const terminalCompare = compareClipRowsByTerminal(left, right, partNumberMap);
      if (terminalCompare !== 0) {
        return terminalCompare;
      }

      return left.__rowIndex - right.__rowIndex;
    });
  }

  return sortRowsByGaugeSize([...rows], "smallest-first");
}

export function buildProcessedPrintLocationGroups(options: {
  rows: SemanticWireListRow[];
  mode: PrintFormatMode;
  enabledSections: JumperSection[];
  sectionOrder: JumperSection[];
  currentSheetName: string;
  blueLabels: BlueLabelSequenceMap | null;
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  sortMode?: BrandingSortMode;
  /** Destination sheet name (uppercase) -> box side mapping for external groups. */
  locationBoxSideByName?: Record<string, string>;
  /** Destination sheet name (uppercase) -> normalized title mapping for display. */
  locationNormalizedTitleByName?: Record<string, string>;
}): PrintLocationGroup[] {
  const sortMode = options.sortMode ?? "device-prefix";
  const skipSingletonMerge = sortMode === "device-prefix" || sortMode === "device-prefix-part-number";
  const enabledKinds = options.sectionOrder
    .filter((kind) => options.enabledSections.includes(kind))
    .map((kind) => kind === "ka_twin_ferrule" ? "ka_twin_ferrules" : kind) as WireListCompiledSectionKind[];

  const compiledSections = compileWireListSections({
    rows: options.rows,
    blueLabels: options.blueLabels,
    currentSheetName: options.currentSheetName,
    partNumberMap: options.partNumberMap,
    enabledKinds,
    surface: "print",
  });

  if (sortMode === "blue-label-sequence") {
    const subsections = compiledSections.sections.flatMap<PrintSubsection>((section) => {
      const sortedRows = sortRowsForPrintSubsection(
        [...section.rows],
        options.currentSheetName,
        section.baseKind,
        section.matchMetadata,
        options.partNumberMap,
        options.blueLabels,
        sortMode,
      ).filter(isPrintableConnectionRow);

      if (sortedRows.length === 0) {
        return [];
      }

      return [{
        label: section.label,
        rows: sortedRows,
        sectionKind: section.baseKind,
        matchMetadata: section.matchMetadata,
        deviceToDeviceSubsections: section.baseKind === "single_connections"
          ? buildBlueLabelDeviceSubsections(sortedRows, options.currentSheetName, options.blueLabels)
            ?? buildTocSubsections(section.baseKind, sortedRows, section.matchMetadata, options.partNumberMap, skipSingletonMerge)
          : buildTocSubsections(section.baseKind, sortedRows, section.matchMetadata, options.partNumberMap, skipSingletonMerge),
      }];
    });

    return subsections.length > 0
      ? [{
        location: options.currentSheetName || "Blue Label Sequence",
        isExternal: false,
        subsections,
        totalRows: subsections.reduce(
          (sum, subsection) => sum + subsection.rows.filter(isPrintableConnectionRow).length,
          0,
        ),
      }]
      : [];
  }

  return groupCompiledSectionsByLocation(compiledSections)
    .map((group) => {
      const subsections: PrintSubsection[] = group.sections.flatMap<PrintSubsection>((section) => {
        const sortedRows = sortRowsForPrintSubsection(
          [...section.rows],
          options.currentSheetName,
          section.baseKind,
          section.matchMetadata,
          options.partNumberMap,
          options.blueLabels,
          options.sortMode,
        ).filter(isPrintableConnectionRow);

        if (sortedRows.length === 0) {
          return [];
        }

        return [{
          label: section.label,
          rows: sortedRows,
          sectionKind: section.baseKind,
          matchMetadata: section.matchMetadata,
          deviceToDeviceSubsections: section.baseKind
            ? options.sortMode === "blue-label-sequence" && section.baseKind === "single_connections"
              ? buildBlueLabelDeviceSubsections(sortedRows, options.currentSheetName, options.blueLabels)
                ?? buildTocSubsections(section.baseKind, sortedRows, section.matchMetadata, options.partNumberMap, skipSingletonMerge)
              : buildTocSubsections(section.baseKind, sortedRows, section.matchMetadata, options.partNumberMap, skipSingletonMerge)
            : undefined,
        }];
      });

      // Lookup boxSide from the mapping using uppercase location name
      const boxSide = options.locationBoxSideByName?.[group.label.toUpperCase()];
      // Lookup normalizedTitle for display - use as location label if available
      const normalizedTitle = options.locationNormalizedTitleByName?.[group.label.toUpperCase()];

      return {
        location: normalizedTitle || group.label,
        isExternal: group.isExternal,
        boxSide,
        subsections,
        totalRows: subsections.reduce(
          (sum, subsection) => sum + subsection.rows.filter(isPrintableConnectionRow).length,
          0,
        ),
      };
    })
    .filter((group) => group.subsections.length > 0);
}

export interface ExternalSectionContext {
  assignmentMappings?: MappedAssignment[];
  currentSheetName?: string;
  /** Internal rows of the current sheet — used for PLC detection via part number */
  internalRows?: SemanticWireListRow[];
  /** Part number lookup map */
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  /**
   * Per-location visibility config for the CURRENT assignment, sourced from the UBP
   * reference JSON.  When present, these flags take precedence over the code-based
   * SWS-type rules, enabling system-wide defaults to be managed via the reference API.
   */
  externalLocationConfig?: ExternalLocationConfig[];
  /** Current assignment box side, used as a fallback default when per-location flags are missing. */
  currentBoxSide?: string;
  /** Destination sheet name (uppercase) -> box side mapping for external groups. */
  locationBoxSideByName?: Record<string, string>;
  /** Destination sheet name (uppercase) -> normalized title mapping for display. */
  locationNormalizedTitleByName?: Record<string, string>;
}

/** PLC part number used to detect PLC sheets */
const PLC_PART_NUMBER = "1089241-42";

/** Panel part numbers that indicate no external wiring (hide all external sections) */
const EXTERNAL_HIDDEN_PART_NUMBERS = new Set(["2769310-1", "2769310-4"]);

/**
 * Determine whether an external location group should be hidden based on SWS
 * type rules.  Returns `true` when the group should be **hidden**.
 *
 * Rules (applied in order):
 *
 * 1. **No mappings** → hide all externals (safe fallback).
 * 2. **Non-PANEL current sheet** (RAIL / BOX / COMPONENT / BLANK) → show all externals.
 * 3. **Panel B** → hide ALL externals.
 * 4. **Current sheet is PLC** → keep all Panel-to-Panel externals.
 * 5. **External destination is PLC** → hide it.
 * 6. **Panel A ↔ Panel B sibling rule** → keep only sibling panel externals.
 * 7. **PANEL → non-PANEL destination** → hide.
 */
function shouldHideExternalGroup(
  group: PrintLocationGroup,
  ctx: ExternalSectionContext,
  mode: 'wireList' | 'branding' = 'wireList',
): boolean {
  // Reference-driven override — takes precedence over code rules when present
  if (ctx.externalLocationConfig && ctx.externalLocationConfig.length > 0) {
    const locationNorm = group.location.trim().toUpperCase();
    const entry = ctx.externalLocationConfig.find(
      (e) => e.location.trim().toUpperCase() === locationNorm,
    );
    if (entry) {
      return mode === 'branding' ? !entry.brandingVisible : !entry.wireListVisible;
    }
  }

  // Box-side matrix fallback when explicit per-location config is unavailable.
  const currentBoxSide = normalizeBoxSideToken(ctx.currentBoxSide);
  const destinationBoxSide = resolveLocationBoxSide(group.location, ctx.locationBoxSideByName);
  if (currentBoxSide && destinationBoxSide) {
    const visible = BoxSideConfig[currentBoxSide]?.externalLocations?.[destinationBoxSide];
    if (typeof visible === "boolean") {
      return !visible;
    }
  }

  const { assignmentMappings: mappings, currentSheetName } = ctx;

  // Rule 1 – no mappings → show all externals (matches print-modal default)
  if (!mappings || mappings.length === 0) return false;

  const currentMapping = currentSheetName
    ? findMappingForLocation(currentSheetName, mappings)
    : undefined;
  const currentSwsType = currentMapping?.selectedSwsType;

  // Rule 2 – non-PANEL → show all externals
  if (currentSwsType !== "PANEL") return false;

  // Rule 3 – Panel B → hide ALL externals
  if (currentSheetName && isBPanelSheet(currentSheetName)) return true;

  // Rule 3b – GEN CTRL / GEN PANEL / GEN PNL / GEN COMPNT → hide ALL externals
  if (currentSheetName && isGenPanelSheet(currentSheetName)) return true;

  // Rule 3c – Panel with external-hidden part number → hide ALL externals
  if (hasExternalHiddenPartNumber(ctx.internalRows, ctx.partNumberMap)) return true;

  const destMapping = findMappingForLocation(group.location, mappings);
  const destSwsType = destMapping?.selectedSwsType;

  // Rule 7 – PANEL → non-PANEL destination → hide
  if (!destSwsType || destSwsType !== "PANEL") return true;

  // Both PANEL — apply PLC & sibling rules

  // Rule 4 – current is PLC → keep all Panel-to-Panel
  if (isPlcSheet(currentSheetName ?? "", ctx.internalRows, ctx.partNumberMap)) return false;

  // Rule 5 – destination is PLC → hide
  if (isPlcSheet(group.location, undefined, undefined)) return true;

  // Rule 6 – Panel A keeps only Panel B (and vice-versa)
  if (currentSheetName && isPanelLetterSheet(currentSheetName)) {
    return !isSiblingPanel(currentSheetName, group.location);
  }

  // Default PANEL→PANEL: show
  return false;
}

export function buildDefaultBrandingHiddenSections(
  processedLocationGroups: PrintLocationGroup[],
  options?: ExternalSectionContext,
): Set<string> {
  const nextHiddenSections = new Set<string>();
  const BRANDING_VISIBLE_SECTIONS = new Set(["Single Connections", "KA Twin Ferrules"]);

  processedLocationGroups.forEach((group, groupIndex) => {
    if (group.isExternal) {
      if (shouldHideExternalGroup(group, options ?? {}, 'branding')) {
        nextHiddenSections.add(`loc-${groupIndex}`);
        return;
      }

      // External group is visible — still hide non-branding subsections
      group.subsections.forEach((subsection, subIndex) => {
        if (!BRANDING_VISIBLE_SECTIONS.has(subsection.label)) {
          nextHiddenSections.add(`${groupIndex}-${subIndex}`);
        }
      });
      return;
    }

    // Internal group — hide non-branding subsections
    group.subsections.forEach((subsection, subIndex) => {
      if (!BRANDING_VISIBLE_SECTIONS.has(subsection.label)) {
        nextHiddenSections.add(`${groupIndex}-${subIndex}`);
      }
    });
  });

  return nextHiddenSections;
}

/**
 * Build default hidden sections for the standardize (wire list) mode.
 *
 * Same external-group hiding rules as branding but no subsection filtering
 * (all section kinds remain visible within a visible group).
 */
export function buildDefaultStandardHiddenSections(
  processedLocationGroups: PrintLocationGroup[],
  options?: ExternalSectionContext,
): Set<string> {
  const nextHiddenSections = new Set<string>();

  processedLocationGroups.forEach((group, groupIndex) => {
    if (group.isExternal && shouldHideExternalGroup(group, options ?? {}, 'wireList')) {
      nextHiddenSections.add(`loc-${groupIndex}`);
    }
  });

  return nextHiddenSections;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Detect if a sheet name indicates a "B" panel (e.g., "Panel B", "PNL B", "Control B") */
function isBPanelSheet(sheetName: string): boolean {
  const name = sheetName.trim();
  return /\b(?:PNL|PANEL|CONTROL|CTRL|CNTRL)\s*B\b/i.test(name) || /^PB$/i.test(name);
}

/** Detect if a sheet name is a lettered panel (A or B) */
function isPanelLetterSheet(sheetName: string): boolean {
  const name = sheetName.trim();
  return /\b(?:PNL|PANEL|CONTROL|CTRL|CNTRL)\s*[AB]\b/i.test(name) || /^P[AB]$/i.test(name);
}

/** Check whether two sheet names are A↔B sibling panels */
function isSiblingPanel(current: string, other: string): boolean {
  const letterA = extractPanelLetter(current);
  const letterB = extractPanelLetter(other);
  if (!letterA || !letterB) return false;
  return (letterA === "A" && letterB === "B") || (letterA === "B" && letterB === "A");
}

function normalizeBoxSideToken(value: string | undefined): BoxSideName | null {
  const token = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "");

  if (!token) return null;

  const normalized = token === "backside" ? "topbackside" : token;

  switch (normalized) {
    case "leftdoor":
      return "leftDoor";
    case "rightdoor":
      return "rightDoor";
    case "leftside":
      return "leftSide";
    case "rightside":
      return "rightSide";
    case "leftbackside":
      return "leftBackSide";
    case "topbackside":
      return "topBackSide";
    case "rightbackside":
      return "rightBackSide";
    default:
      return null;
  }
}

function resolveLocationBoxSide(
  locationName: string,
  locationBoxSideByName: Record<string, string> | undefined,
): BoxSideName | null {
  const key = locationName.trim().toUpperCase();
  if (!key || !locationBoxSideByName) return null;
  return normalizeBoxSideToken(locationBoxSideByName[key]);
}

function extractPanelLetter(name: string): string | null {
  const match = name.trim().match(/\b(?:PNL|PANEL|CONTROL|CTRL|CNTRL)\s*([AB])\b/i)
    ?? name.trim().match(/^P([AB])$/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Detect PLC sheets.
 * A sheet is PLC if:
 *  1. Its name contains "PLC", OR
 *  2. Any of its internal rows reference a device with part number 1089241-42
 */
function isPlcSheet(
  sheetName: string,
  internalRows?: SemanticWireListRow[],
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
): boolean {
  if (/\bPLC\b/i.test(sheetName)) return true;

  if (internalRows && partNumberMap && partNumberMap.size > 0) {
    for (const row of internalRows) {
      const fromResult = lookupPartNumber(partNumberMap, row.fromDeviceId);
      if (fromResult?.partNumber === PLC_PART_NUMBER) return true;
      const toResult = lookupPartNumber(partNumberMap, row.toDeviceId);
      if (toResult?.partNumber === PLC_PART_NUMBER) return true;
    }
  }

  return false;
}

/**
 * Detect GEN-prefixed panel sheets (GEN CTRL, GEN PANEL, GEN PNL, GEN COMPNT)
 * that do not require external sections.
 */
function isGenPanelSheet(sheetName: string): boolean {
  return /\bGEN\s+(?:CTRL|CONTROL|CNTRL|PANEL|PNL|COMPNT|COMPONENT)\b/i.test(sheetName.trim());
}

/**
 * Check whether a part number string (which may be comma-separated) contains
 * any of the external-hidden part numbers.
 */
function containsExternalHiddenPartNumber(partNumberField: string): boolean {
  return partNumberField
    .split(/[,;]/)
    .some((pn) => EXTERNAL_HIDDEN_PART_NUMBERS.has(pn.trim()));
}

/**
 * Check whether any device on the current sheet has a part number that
 * indicates external sections should be hidden (e.g. 2769310-1, 2769310-4).
 * Handles comma-separated part number fields.
 */
function hasExternalHiddenPartNumber(
  internalRows?: SemanticWireListRow[],
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
): boolean {
  if (!internalRows || !partNumberMap || partNumberMap.size === 0) return false;

  for (const row of internalRows) {
    const fromResult = lookupPartNumber(partNumberMap, row.fromDeviceId);
    if (fromResult?.partNumber && containsExternalHiddenPartNumber(fromResult.partNumber)) return true;
    const toResult = lookupPartNumber(partNumberMap, row.toDeviceId);
    if (toResult?.partNumber && containsExternalHiddenPartNumber(toResult.partNumber)) return true;
  }

  return false;
}

/** Find the assignment mapping that best matches a location or sheet name */
function findMappingForLocation(
  location: string,
  mappings?: MappedAssignment[],
): MappedAssignment | undefined {
  if (!mappings || mappings.length === 0) return undefined;

  const normalized = location.trim().toUpperCase();

  // Exact match first
  const exact = mappings.find(
    (m) => m.sheetName.trim().toUpperCase() === normalized,
  );
  if (exact) return exact;

  // Containment match — prefer longest matching sheet name
  let bestMatch: MappedAssignment | undefined;
  let bestLength = 0;

  for (const mapping of mappings) {
    const sheetUpper = mapping.sheetName.trim().toUpperCase();
    if (
      normalized.includes(sheetUpper) ||
      sheetUpper.includes(normalized)
    ) {
      if (sheetUpper.length > bestLength) {
        bestMatch = mapping;
        bestLength = sheetUpper.length;
      }
    }
  }

  return bestMatch;
}

export function resolveActiveHiddenSections(options: {
  mode: PrintFormatMode;
  standardHiddenSections: Set<string>;
  standardHiddenSectionsCustomized?: boolean;
  brandingHiddenSections: Set<string>;
  brandingHiddenSectionsCustomized: boolean;
  defaultBrandingHiddenSections: Set<string>;
  defaultStandardHiddenSections?: Set<string>;
}): Set<string> {
  if (options.mode !== "branding") {
    // If the user has customized, use their selection directly
    if (options.standardHiddenSectionsCustomized) {
      return options.standardHiddenSections;
    }
    // Otherwise use the auto-computed defaults
    if (options.defaultStandardHiddenSections && options.defaultStandardHiddenSections.size > 0) {
      return options.defaultStandardHiddenSections;
    }
    return options.standardHiddenSections;
  }

  return options.brandingHiddenSectionsCustomized
    ? options.brandingHiddenSections
    : options.defaultBrandingHiddenSections;
}

export function buildVisiblePreviewSections(
  processedLocationGroups: PrintLocationGroup[],
  activeHiddenSections: Set<string>,
  sectionColumnVisibility: Record<string, SectionColumnVisibility>,
  hiddenRows?: Set<string>,
): VisiblePreviewSection[] {
  return processedLocationGroups.flatMap((group, groupIndex) => {
    const locationKey = `loc-${groupIndex}`;
    if (activeHiddenSections.has(locationKey)) {
      return [];
    }

    return group.subsections.flatMap((subsection, subIndex) => {
      const sectionKey = `${groupIndex}-${subIndex}`;
      if (activeHiddenSections.has(sectionKey)) {
        return [];
      }

      const sectionColumns = getEffectiveSectionColumns(
        sectionColumnVisibility,
        subsection.label,
        subsection.sectionKind,
      );
      let visibleRows = filterEmptyDeviceChangeSections(subsection.rows).filter(
        (row) => isPrintableConnectionRow(row),
      );

      // Filter out individually hidden rows
      if (hiddenRows && hiddenRows.size > 0) {
        visibleRows = visibleRows.filter((row) => !hiddenRows.has(row.__rowId));
      }

      if (visibleRows.length === 0) {
        return [];
      }

      return [{ group, subsection, sectionColumns, visibleRows }];
    });
  });
}

export function buildBrandingVisibleSections(options: {
  processedLocationGroups: PrintLocationGroup[];
  activeHiddenSections: Set<string>;
  brandingPreviewRowMap: Map<string, BrandingPreviewRow>;
  currentSheetName: string;
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  hiddenRows?: Set<string>;
}): BrandingVisibleSection[] {
  return options.processedLocationGroups.flatMap((group, groupIndex) => {
    const locationKey = `loc-${groupIndex}`;
    if (options.activeHiddenSections.has(locationKey)) {
      return [];
    }

    return group.subsections.flatMap((subsection, subIndex) => {
      const sectionKey = `${groupIndex}-${subIndex}`;
      if (options.activeHiddenSections.has(sectionKey)) {
        return [];
      }

      const orderedRows = shouldPreservePrintSubsectionOrder(subsection.sectionKind)
        ? filterEmptyDeviceChangeSections(subsection.rows).filter(isPrintableConnectionRow)
        : sortRowsForDeviceGroupedPreview(
          subsection.rows.filter(isPrintableConnectionRow),
          options.currentSheetName,
          subsection.sectionKind === "cables",
          options.partNumberMap,
          subsection.sectionKind,
        );
      let brandingRows = orderedRows
        .map((row) => options.brandingPreviewRowMap.get(row.__rowId))
        .filter((row): row is BrandingPreviewRow => Boolean(row))
        .filter((row) => row.row.gaugeSize !== "10");

      // Filter out individually hidden rows
      if (options.hiddenRows && options.hiddenRows.size > 0) {
        brandingRows = brandingRows.filter((row) => !options.hiddenRows!.has(row.row.__rowId));
      }

      if (brandingRows.length === 0) {
        return [];
      }

      return [{ group, subsection, rows: brandingRows }];
    });
  });
}

export function buildPrintPreviewPageCount(options: {
  mode: PrintFormatMode;
  processedLocationGroups: PrintLocationGroup[];
  showFeedbackSection: boolean;
  showCoverPage: boolean;
  showTableOfContents: boolean;
  showIPVCodes: boolean;
  showIPVWireList?: boolean;
}): number {
  if (options.mode === "branding") {
    return 1;
  }

  const totalRows = options.processedLocationGroups.reduce((sum, group) => sum + group.totalRows, 0);
  const wireListPageCount = Math.max(Math.ceil(totalRows / 30), 1);
  const coverPageCount = options.showCoverPage ? 1 : 0;
  const tocPageCount = options.showTableOfContents && options.processedLocationGroups.length > 0 ? 1 : 0;
  const ipvCodesPageCount = options.showIPVCodes ? 1 : 0;
  const feedbackPageCount = options.showFeedbackSection ? 1 : 0;
  const ipvWireListPageCount = options.showIPVWireList ? 3 : 0;

  return coverPageCount + tocPageCount + ipvCodesPageCount + wireListPageCount + feedbackPageCount + ipvWireListPageCount;
}

export function buildBrandingSectionRenderPlan(
  rows: SemanticWireListRow[],
  currentSheetName: string,
  sectionKind?: IdentificationFilterKind,
  matchMetadata: Record<string, PatternMatchMetadata> = {},
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  brandingSortMode: BrandingSortMode = "default",
): WireListRenderPlanItem[] {
  const isCablesSection = sectionKind === "cables";
  const orderedRows = shouldPreservePrintSubsectionOrder(sectionKind)
    ? filterEmptyDeviceChangeSections(rows).filter(isPrintableConnectionRow)
    : sortRowsForDeviceGroupedPreview(
      filterEmptyDeviceChangeSections(rows).filter(isPrintableConnectionRow),
      currentSheetName,
      isCablesSection,
      partNumberMap,
      sectionKind,
    );
  const usesDevicePrefixGrouping =
    brandingSortMode === "device-prefix" ||
    brandingSortMode === "device-prefix-part-number";
  const skipSingletonMerge = usesDevicePrefixGrouping;
  const effectiveSubgroups = !sectionKind
    ? []
    : buildRenderableSectionSubgroups(sectionKind, orderedRows, matchMetadata, partNumberMap, skipSingletonMerge);

  // For single_connections branding, sort subgroups by device prefix (and optionally part number)
  if (sectionKind === "single_connections" && usesDevicePrefixGrouping && effectiveSubgroups.length > 0) {
    const rowsById = new Map(orderedRows.map((row) => [row.__rowId, row]));

    effectiveSubgroups.sort((a, b) => {
      // Prioritize target device pair groups (SB, HL, SA)
      const aIsTarget = a.id.startsWith("single-target-pair:");
      const bIsTarget = b.id.startsWith("single-target-pair:");
      if (aIsTarget !== bIsTarget) {
        return aIsTarget ? -1 : 1;
      }

      // Extract the device prefix from the first row of each subgroup
      const aFirstRow = a.rowIds.length > 0 ? rowsById.get(a.rowIds[0]) : undefined;
      const bFirstRow = b.rowIds.length > 0 ? rowsById.get(b.rowIds[0]) : undefined;
      const aDisplayFrom = aFirstRow ? getDisplayEndpoints(aFirstRow).fromDeviceId : undefined;
      const bDisplayFrom = bFirstRow ? getDisplayEndpoints(bFirstRow).fromDeviceId : undefined;

      // For target groups, derive prefix from the subgroup label (device base)
      const aPrefix = aIsTarget ? getDevicePrefixValue(a.label) : getDevicePrefixValue(aDisplayFrom);
      const bPrefix = bIsTarget ? getDevicePrefixValue(b.label) : getDevicePrefixValue(bDisplayFrom);

      // 1) Sort by device prefix
      const prefixCompare = aPrefix.localeCompare(bPrefix, undefined, { numeric: true });
      if (prefixCompare !== 0) return prefixCompare;

      // 2) Within same prefix, sort by part number (only for device-prefix-part-number mode)
      if (brandingSortMode === "device-prefix-part-number" && partNumberMap) {
        const aPartNumber = lookupPartNumber(partNumberMap, aDisplayFrom)?.partNumber ?? "";
        const bPartNumber = lookupPartNumber(partNumberMap, bDisplayFrom)?.partNumber ?? "";

        const partCompare = aPartNumber.localeCompare(bPartNumber, undefined, { numeric: true });
        if (partCompare !== 0) return partCompare;
      }

      // 3) Fallback: preserve original order
      return a.order - b.order;
    });
  }

  // Reorder rows so subgroup members are contiguous for correct CSV bundling.
  // Build rowId → subgroup index mapping, then stable-sort rows by subgroup.
  const rowSubgroupIndex = new Map<string, number>();
  effectiveSubgroups.forEach((sg, sgIndex) => {
    for (const rowId of sg.rowIds) {
      if (!rowSubgroupIndex.has(rowId)) {
        rowSubgroupIndex.set(rowId, sgIndex);
      }
    }
  });
  const reorderedRows = [...orderedRows].sort((a, b) => {
    const aGroup = rowSubgroupIndex.get(a.__rowId) ?? effectiveSubgroups.length;
    const bGroup = rowSubgroupIndex.get(b.__rowId) ?? effectiveSubgroups.length;
    return aGroup - bGroup;
  });

  // Update each subgroup's startRowId to the first member in the new order
  for (const sg of effectiveSubgroups) {
    const memberSet = new Set(sg.rowIds);
    const first = reorderedRows.find(r => memberSet.has(r.__rowId));
    if (first) {
      sg.startRowId = first.__rowId;
    }
  }

  const subgroupHeaderMap = buildSubgroupStartMap(effectiveSubgroups);

  const plan = buildWireListRenderPlan({
    rows: reorderedRows,
    currentSheetName,
    sectionKind,
    matchMetadata,
    subgroupHeaderMap,
    showDeviceGroupHeader: false,
    hideDeviceSubheaders: true,
    forceDeviceSeparator: sectionKind === "grounds",
    getLocationHeaderLabel: () => null,
  });

  // Inject prefix-category headers when sorting by device prefix
  if (sectionKind === "single_connections" && usesDevicePrefixGrouping && plan.length > 0) {
    const rowsById = new Map(reorderedRows.map((row) => [row.__rowId, row]));
    const enriched: WireListRenderPlanItem[] = [];
    let lastPrefix = "";

    for (const item of plan) {
      if (item.type === "group-header" && item.group.groupKind === "subgroup") {
        // Find the first row after this header to determine its prefix
        const nextRowItem = plan.find(
          (p) => p.type === "row" && item.group.key && p.rowId !== undefined,
        );
        // Use the subgroup data to determine prefix — find the matching subgroup
        const matchingSg = effectiveSubgroups.find((sg) => `subgroup-${sg.id}` === item.group.key || sg.label === item.group.label);
        const firstRowId = matchingSg?.rowIds[0];
        const firstRow = firstRowId ? rowsById.get(firstRowId) : undefined;
        // For target device pair groups, derive prefix from the subgroup label
        const prefix = matchingSg?.id.startsWith("single-target-pair:")
          ? getDevicePrefixValue(matchingSg.label)
          : getDevicePrefixValue(firstRow ? getDisplayEndpoints(firstRow).fromDeviceId : undefined);

        if (prefix && prefix !== lastPrefix) {
          enriched.push({
            type: "group-header",
            key: `prefix-category-${prefix}`,
            group: {
              key: `prefix-category-${prefix}`,
              label: prefix,
              groupKind: "prefix-category",
            },
          });
          lastPrefix = prefix;
        }
      }
      enriched.push(item);
    }

    return enriched;
  }

  return plan;
}

function escapeCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const stringValue = String(value);
  // Values starting with -, =, +, @ must be quoted to prevent Excel formula
  // injection and to preserve leading symbols (e.g. "-0V" wire numbers).
  if (
    stringValue.includes(",") ||
    stringValue.includes("\"") ||
    stringValue.includes("\n") ||
    /^[-=+@]/.test(stringValue)
  ) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

/**
 * Build branding CSV content matching the brandlist CSV format:
 *
 * Row 1:    Location name (e.g. "CONTROL B")
 * Row 2:    (empty)
 * Row 3:    Project #, <pdNumber>
 * Row 4:    Project Name, <projectName>
 * Row 5:    Revision, <revision>
 * Row 6:    (empty)
 * Row 7:    Controls DE, <controlsDE>
 * Row 8:    Phone:
 * Row 9:    Controls ME, <controlsME>
 * Row 10:   Phone:
 * Row 11:   (empty)
 * Row 12:   From,,,,,,To,
 * Row 13:   Device ID,Wire No.,Wire ID,Gauge/Size,Length,Device ID,Location,Bundle Name
 * Row 14+:  Data rows per device group, separated by blank rows
 *
 * Bundle Name column: subgroup label on the first row of each device group only.
 * A blank separator row is inserted between device subgroups.
 */
export function buildBrandingCsvContent(options: {
  brandingVisibleSections: BrandingVisibleSection[];
  currentSheetName: string;
  sectionColumnVisibility: Record<string, SectionColumnVisibility>;
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  brandingSortMode?: BrandingSortMode;
  projectInfo?: {
    pdNumber?: string;
    projectName?: string;
    revision?: string;
    controlsDE?: string;
    controlsME?: string;
  };
}): string {
  const { brandingVisibleSections, currentSheetName, sectionColumnVisibility, partNumberMap, brandingSortMode = "default", projectInfo } = options;

  if (brandingVisibleSections.length === 0) {
    return "";
  }

  // -- Column count: 8 base --
  const COL_COUNT = 8;
  const emptyRow = ",".repeat(COL_COUNT - 1);

  // -- Rows 1-11: Metadata header --
  const locationName = currentSheetName || "";
  const metadataRows = [
    `${escapeCsvValue(locationName)}${",".repeat(COL_COUNT - 1)}`,                          // Row 1: Location
    emptyRow,                                                                                // Row 2: Empty
    `Project #,${escapeCsvValue(projectInfo?.pdNumber ?? "")}${",".repeat(COL_COUNT - 2)}`,  // Row 3
    `Project Name,${escapeCsvValue(projectInfo?.projectName ?? "")}${",".repeat(COL_COUNT - 2)}`, // Row 4
    `Revision,${escapeCsvValue(projectInfo?.revision ?? "")}${",".repeat(COL_COUNT - 2)}`,   // Row 5
    emptyRow,                                                                                // Row 6: Empty
    `Controls DE,${escapeCsvValue(projectInfo?.controlsDE ?? "")}${",".repeat(COL_COUNT - 2)}`, // Row 7
    `Phone:${",".repeat(COL_COUNT - 1)}`,                                                   // Row 8
    `Controls ME,${escapeCsvValue(projectInfo?.controlsME ?? "")}${",".repeat(COL_COUNT - 2)}`, // Row 9
    `Phone:${",".repeat(COL_COUNT - 1)}`,                                                   // Row 10
    emptyRow,                                                                                // Row 11: Empty
  ];

  // -- Row 12: From / To spanning header --
  const fromToRow = `From,,,,,,To,`;

  // -- Row 13: Column headers --
  const columnHeaders = `Device ID,Wire No.,Wire ID,Gauge/Size,Length,Device ID,To Location,Bundle Name`;

  // -- Data rows grouped by section, separated by empty rows between device subgroups --
  const sectionBlocks: string[][] = [];

  for (const { subsection, rows } of brandingVisibleSections) {
    const sectionColumns = getEffectiveSectionColumns(
      sectionColumnVisibility,
      subsection.label,
      subsection.sectionKind,
    );
    const rowMap = new Map(rows.map((entry) => [entry.row.__rowId, entry]));
    const renderPlan = buildBrandingSectionRenderPlan(
      rows.map((entry) => entry.row),
      currentSheetName,
      subsection.sectionKind,
      subsection.matchMetadata ?? {},
      partNumberMap,
      brandingSortMode,
    );
    const baseDeviceRowCounts = new Map<string, number>();
    for (const entry of rows) {
      const baseDeviceId = getBaseDeviceIdValue(getDisplayEndpoints(entry.row).fromDeviceId);
      if (!baseDeviceId) {
        continue;
      }
      baseDeviceRowCounts.set(baseDeviceId, (baseDeviceRowCounts.get(baseDeviceId) ?? 0) + 1);
    }

    // Track the current subgroup label so rows without explicit subgroup headers still
    // get a derived device bundle and only print that bundle once.
    let currentSubgroupLabel = "";
    let lastBundleKey = "";
    const emittedBundleKeys = new Set<string>();
    const dataRows: string[] = [];

    for (let itemIndex = 0; itemIndex < renderPlan.length; itemIndex++) {
      const item = renderPlan[itemIndex];

      // Detect subgroup header changes and insert blank separator rows
      if (item.type === "group-header" && item.group.groupKind === "prefix-category") {
        if (dataRows.length > 0) {
          dataRows.push(emptyRow);
        }
        // Insert prefix category label row spanning the first column
        dataRows.push(`${escapeCsvValue(item.group.label)}${",".repeat(COL_COUNT - 1)}`);
        lastBundleKey = "";
        continue;
      }

      if (item.type === "group-header" && item.group.groupKind === "subgroup") {
        currentSubgroupLabel = item.group.label || "";
        continue;
      }

      if (item.type !== "row") continue;

      const entry = rowMap.get(item.rowId);
      if (!entry) continue;

      // Bundle Name column: derived bundle label on the first row of each device group only.
      // Keep the location in the To Location column instead of folding it into the bundle label.
      let bundleDisplay = "";
      const bundleName = resolveBrandingBundleNameForRow(
        getEffectiveBrandingSubgroupLabel(currentSubgroupLabel, entry.row),
        entry.row,
        baseDeviceRowCounts,
        sectionColumns.wireId,
      );
      const bundleKey = [
        bundleName.toUpperCase(),
        (entry.location || "").toUpperCase(),
        sectionColumns.gaugeSize ? (entry.row.gaugeSize || "").toUpperCase() : "",
        sectionColumns.wireId ? ((normalizeBrandingBundleColor(entry.row.wireId) ?? entry.row.wireId) || "").toUpperCase() : "",
      ].join("|");

      if (dataRows.length > 0 && bundleKey !== lastBundleKey) {
        dataRows.push(emptyRow);
      }
      if (!emittedBundleKeys.has(bundleKey)) {
        bundleDisplay = bundleName;
        emittedBundleKeys.add(bundleKey);
      }
      lastBundleKey = bundleKey;

      // Swap FROM/TO when the target pair device (SB, HL, SA, SH) is in the TO column
      const swap = shouldSwapForTargetPair(entry.row.fromDeviceId, entry.row.toDeviceId);
      const displayFrom = swap ? (entry.row.toDeviceId || "") : (entry.row.fromDeviceId || "");
      const displayTo = swap ? (entry.row.fromDeviceId || "") : (entry.row.toDeviceId || "");

      // Get the To Location - use the entry.location which is already set from toLocation || fromLocation || location
      const toLocation = entry.location || "";

      const csvColumns = [
        displayFrom,                                                                 // Device ID (From)
        sectionColumns.wireNo ? (entry.row.wireNo || "") : "",                       // Wire No.
        sectionColumns.wireId ? (entry.row.wireId || "") : "",                       // Wire ID
        sectionColumns.gaugeSize ? (entry.row.gaugeSize || "") : "",                 // Gauge/Size
        typeof entry.measurement === "number" ? entry.measurement.toFixed(1) : "",   // Length
        displayTo,                                                                   // Device ID (To)
        toLocation,                                                                  // To Location
        bundleDisplay,                                                               // Bundle Name
      ];

      const csvRow = csvColumns.map((v) => escapeCsvValue(v)).join(",");

      dataRows.push(csvRow);
    }

    if (dataRows.length > 0) {
      sectionBlocks.push(dataRows);
    }
  }

  // Join sections with empty row separators
  const allDataRows: string[] = [];
  for (let i = 0; i < sectionBlocks.length; i++) {
    allDataRows.push(...sectionBlocks[i]);
    if (i < sectionBlocks.length - 1) {
      allDataRows.push(emptyRow);
    }
  }

  return [
    ...metadataRows,
    fromToRow,
    columnHeaders,
    ...allDataRows,
  ].join("\n");
}
