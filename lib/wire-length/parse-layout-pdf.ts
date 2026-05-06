/**
 * Layout PDF Parser
 *
 * Persists grouped layouts as the source of truth and derives flat totals on demand.
 */

import type {
  PanelTopology,
  PanductNode,
  PlacedDevice,
  PlacedRail,
  Point,
} from "./types";
import { DEVICE_FAMILY_DEFAULTS, getDeviceFamily } from "./constants";

const RAIL_PATTERN = /(\d+(?:\.\d+)?)[""]\s*RAIL|RAIL\s*(\d+(?:\.\d+)?)[""]/gi;
const LOW_PROFILE_RAIL_PATTERN = /(\d+(?:\.\d+)?)[""]\s*LOW\s*PROFLE?/gi;
const PANDUCT_PATTERN = /(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)/g;
const DEVICE_ID_PATTERN = /\b([A-Z]{2})(\d{4})\b/g;
const COORDINATE_PATTERN = /^(\d+(?:\.\d+)?)$/;
const PANEL_INFO_PATTERN = /\bPANEL:?\s*([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/i;
const BOX_INFO_PATTERN = /\bBOX:?\s*([A-Z0-9]+(?:-[A-Z0-9]+)+)\b/i;
const DRAWING_TITLE_PATTERN = /^(PNL\s*[A-Z]|CONTROL|TCP|PLC|MCC|GEN|FG&E|PROX|POWERDIST|BECKWITH)/i;
const PANEL_NAME_EXCLUDE_PATTERN = /\b(STAMP|CONTROL\s+STAMP|APPROVAL|TITLE\s+BLOCK|DRAWING\s+TITLE|SHEET\s+TITLE|NOTES?)\b/i;
const SHEET_PATTERN = /SHEETOF\s*(\d+)(\d+)/;
const LINE_GROUP_TOLERANCE = 2;

export interface LayoutPdfTextItem {
  text: string;
  pageNumber: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface LayoutPdfTextSource {
  text: string;
  items: LayoutPdfTextItem[];
  totalPages?: number;
}

interface WithPosition {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  sourceText?: string;
}

export interface ExtractedRail extends WithPosition {
  lengthInches: number;
  lineNumber: number;
  isLowProfile: boolean;
  pageNumber?: number;
}

export interface ExtractedPanduct extends WithPosition {
  width: number;
  height: number;
  length: number;
  lineNumber: number;
  label: string;
  pageNumber?: number;
}

export interface ExtractedDevice extends WithPosition {
  deviceId: string;
  prefix: string;
  number: string;
  lineNumber: number;
  pageNumber?: number;
}

export interface ExtractedCoordinate extends WithPosition {
  value: number;
  lineNumber: number;
  pageNumber?: number;
}

export interface ExtractedMeasurement extends WithPosition {
  kind: "rail" | "low-profile-rail" | "panduct";
  label: string;
  lineNumber: number;
  pageNumber?: number;
  lengthInches?: number;
  widthInches?: number;
  heightInches?: number;
}

export interface ExtractedPartReference extends WithPosition {
  kind: "panel" | "box";
  partNumber: string;
  label: string;
  lineNumber: number;
  pageNumber?: number;
}

export interface ParsedRailGroup {
  rail: ExtractedRail | null;
  devices: ExtractedDevice[];
  adjacentPanducts: ExtractedPanduct[];
  measurements: ExtractedMeasurement[];
}

export interface ParsedPdfLayout {
  pageNumber: number;
  sheetNumber: number;
  totalSheets: number;
  panelName: string;
  railGroups: ParsedRailGroup[];
  unassignedDevices: ExtractedDevice[];
  unassignedPanducts: ExtractedPanduct[];
  unassignedMeasurements: ExtractedMeasurement[];
  panelPartNumbers: ExtractedPartReference[];
  boxPartNumbers: ExtractedPartReference[];
  coordinates: ExtractedCoordinate[];
}

export type ParsedPdfPage = ParsedPdfLayout;

export interface ParsedLayoutPdf {
  layouts: ParsedPdfLayout[];
  panelNames: string[];
  totalSheets: number;
}

export interface LayoutPartListCandidate {
  category: "rail" | "low-profile-rail" | "panduct" | "panel" | "box";
  description: string;
  quantity: number;
  partNumber?: string;
  measurementLabel?: string;
}

export interface LayoutPartListRow {
  "Device ID": string;
  "Part Number": string;
  Description: string;
  Location: string;
  Quantity: number;
  Category: string;
  Source: string;
}

export interface LayoutAssetSummary {
  totalPages: number;
  totalDevices: number;
  totalRails: number;
  totalLowProfileRails: number;
  totalPanducts: number;
  totalMeasurements: number;
  panelPartNumbers: string[];
  boxPartNumbers: string[];
  uniquePanductSizes: string[];
  railLengths: number[];
}

interface ParsedLineResult {
  rails: ExtractedRail[];
  panducts: ExtractedPanduct[];
  devices: ExtractedDevice[];
  measurements: ExtractedMeasurement[];
  panelPartNumbers: ExtractedPartReference[];
  boxPartNumbers: ExtractedPartReference[];
  coordinates: ExtractedCoordinate[];
  panelName?: string;
  sheetInfo?: { sheet: number; total: number };
}

interface ParsedTextLine {
  text: string;
  lineNumber: number;
  pageNumber: number;
  items: LayoutPdfTextItem[];
}

interface MutableLayoutCollections {
  pageNumber: number;
  sheetNumber: number;
  totalSheets: number;
  panelName: string;
  rails: ExtractedRail[];
  panducts: ExtractedPanduct[];
  devices: ExtractedDevice[];
  measurements: ExtractedMeasurement[];
  panelPartNumbers: ExtractedPartReference[];
  boxPartNumbers: ExtractedPartReference[];
  coordinates: ExtractedCoordinate[];
}

type LegacyParsedLayoutPdf = ParsedLayoutPdf & {
  pages?: ParsedPdfLayout[];
  panelPartNumbers?: ExtractedPartReference[];
  boxPartNumbers?: ExtractedPartReference[];
  allRails?: ExtractedRail[];
  allPanducts?: ExtractedPanduct[];
  allDevices?: ExtractedDevice[];
  allMeasurements?: ExtractedMeasurement[];
};

function normalizePanelNameCandidate(value: string): string {
  return value.replace(/,SMT\d+/i, "").replace(/\s+/g, " ").trim();
}

function isLikelyPanelNameCandidate(value: string): boolean {
  const normalized = normalizePanelNameCandidate(value);
  if (!normalized) {
    return false;
  }

  if (PANEL_NAME_EXCLUDE_PATTERN.test(normalized)) {
    return false;
  }

  if (!DRAWING_TITLE_PATTERN.test(normalized)) {
    return false;
  }

  return /[,;:]|\bJB\d+\b|\bTT\d+\b|\bPANEL\b|\bDOOR\b|\bTURB\b|\bHPC\b|\bPLC\b|\bTCP\b|\bMCC\b|\bGEN\b|\bPROX\b/i.test(normalized);
}

function scorePanelNameCandidate(value: string): number {
  const normalized = normalizePanelNameCandidate(value).toUpperCase();
  if (!isLikelyPanelNameCandidate(normalized)) {
    return -1;
  }

  let score = 0;
  if (/[,;:]/.test(normalized)) {
    score += 4;
  }
  if (/\bJB\d+\b/.test(normalized)) {
    score += 5;
  }
  if (/\bTT\d+\b/.test(normalized)) {
    score += 4;
  }
  if (/\bPANEL\b|\bDOOR\b|\bTURB\b|\bHPC\b|\bPLC\b|\bTCP\b|\bMCC\b|\bGEN\b|\bPROX\b/i.test(normalized)) {
    score += 3;
  }
  if (normalized.length >= 10) {
    score += 1;
  }

  return score;
}

function selectPreferredPanelName(currentName: string, nextCandidate?: string): string {
  if (!nextCandidate) {
    return currentName;
  }

  const normalizedCandidate = normalizePanelNameCandidate(nextCandidate);
  const candidateScore = scorePanelNameCandidate(normalizedCandidate);
  if (candidateScore < 0) {
    return currentName;
  }

  if (!currentName) {
    return normalizedCandidate;
  }

  const currentScore = scorePanelNameCandidate(currentName);
  return candidateScore > currentScore ? normalizedCandidate : currentName;
}

function getAnchor(items: LayoutPdfTextItem[], matchedText?: string): WithPosition {
  if (items.length === 0) {
    return {};
  }

  const normalizedMatch = matchedText?.trim().toUpperCase();
  const anchoredItem = normalizedMatch
    ? items.find((item) => {
        const itemText = item.text.trim().toUpperCase();
        return itemText.includes(normalizedMatch) || normalizedMatch.includes(itemText);
      })
    : items[0];

  const item = anchoredItem ?? items[0];
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    sourceText: item.text,
  };
}

function parseLine(line: string, lineNumber: number, items: LayoutPdfTextItem[] = []): ParsedLineResult {
  const result: ParsedLineResult = {
    rails: [],
    panducts: [],
    devices: [],
    measurements: [],
    panelPartNumbers: [],
    boxPartNumbers: [],
    coordinates: [],
  };

  const trimmed = line.trim();
  if (!trimmed) {
    return result;
  }

  let railMatch: RegExpExecArray | null;
  RAIL_PATTERN.lastIndex = 0;
  while ((railMatch = RAIL_PATTERN.exec(trimmed)) !== null) {
    const length = parseFloat(railMatch[1] || railMatch[2]);
    if (length <= 0) {
      continue;
    }

    const anchor = getAnchor(items, railMatch[0]);
    result.rails.push({
      lengthInches: length,
      lineNumber,
      isLowProfile: false,
      ...anchor,
    });
    result.measurements.push({
      kind: "rail",
      label: `${length}\" RAIL`,
      lineNumber,
      lengthInches: length,
      ...anchor,
    });
  }

  let lowProfileMatch: RegExpExecArray | null;
  LOW_PROFILE_RAIL_PATTERN.lastIndex = 0;
  while ((lowProfileMatch = LOW_PROFILE_RAIL_PATTERN.exec(trimmed)) !== null) {
    const length = parseFloat(lowProfileMatch[1]);
    if (length <= 0) {
      continue;
    }

    const anchor = getAnchor(items, lowProfileMatch[0]);
    result.rails.push({
      lengthInches: length,
      lineNumber,
      isLowProfile: true,
      ...anchor,
    });
    result.measurements.push({
      kind: "low-profile-rail",
      label: `${length}\" LOW PROFILE`,
      lineNumber,
      lengthInches: length,
      ...anchor,
    });
  }

  let panductMatch: RegExpExecArray | null;
  PANDUCT_PATTERN.lastIndex = 0;
  while ((panductMatch = PANDUCT_PATTERN.exec(trimmed)) !== null) {
    const width = parseFloat(panductMatch[1]);
    const height = parseFloat(panductMatch[2]);
    const length = parseFloat(panductMatch[3]);
    if (width <= 0 || height <= 0 || length <= 0) {
      continue;
    }

    const anchor = getAnchor(items, panductMatch[0]);
    result.panducts.push({
      width,
      height,
      length,
      lineNumber,
      label: panductMatch[0],
      ...anchor,
    });
    result.measurements.push({
      kind: "panduct",
      label: panductMatch[0],
      lineNumber,
      lengthInches: length,
      widthInches: width,
      heightInches: height,
      ...anchor,
    });
  }

  let deviceMatch: RegExpExecArray | null;
  DEVICE_ID_PATTERN.lastIndex = 0;
  while ((deviceMatch = DEVICE_ID_PATTERN.exec(trimmed)) !== null) {
    const prefix = deviceMatch[1];
    const number = deviceMatch[2];
    if (["OF", "TO", "NO", "IN", "ON", "AT", "BY", "OR", "IF", "AN", "AS", "IT", "IS", "BE", "WE", "US", "UP", "SO", "GO", "DO", "MY", "ME", "HE", "BO"].includes(prefix)) {
      continue;
    }

    const deviceId = `${prefix}${number}`;
    result.devices.push({
      deviceId,
      prefix,
      number,
      lineNumber,
      ...getAnchor(items, deviceId),
    });
  }

  if (COORDINATE_PATTERN.test(trimmed)) {
    const value = parseFloat(trimmed);
    if (!Number.isNaN(value) && value >= 0 && value <= 100) {
      result.coordinates.push({
        value,
        lineNumber,
        ...getAnchor(items, trimmed),
      });
    }
  }

  if (isLikelyPanelNameCandidate(trimmed)) {
    result.panelName = normalizePanelNameCandidate(trimmed);
  }

  const panelMatch = trimmed.match(PANEL_INFO_PATTERN);
  if (panelMatch?.[1]) {
    result.panelPartNumbers.push({
      kind: "panel",
      partNumber: panelMatch[1].trim().toUpperCase(),
      label: trimmed,
      lineNumber,
      ...getAnchor(items, panelMatch[0]),
    });
  }

  const boxMatch = trimmed.match(BOX_INFO_PATTERN);
  if (boxMatch?.[1]) {
    result.boxPartNumbers.push({
      kind: "box",
      partNumber: boxMatch[1].trim().toUpperCase(),
      label: trimmed,
      lineNumber,
      ...getAnchor(items, boxMatch[0]),
    });
  }

  SHEET_PATTERN.lastIndex = 0;
  const sheetMatch = SHEET_PATTERN.exec(trimmed);
  if (sheetMatch) {
    const combined = sheetMatch[1] + sheetMatch[2];
    const total = parseInt(sheetMatch[2], 10);
    const sheet = parseInt(combined.slice(0, -sheetMatch[2].length) || "1", 10);
    if (total > 0 && sheet > 0 && sheet <= total) {
      result.sheetInfo = { sheet, total };
    }
  }

  return result;
}

function buildPlainTextLines(text: string): ParsedTextLine[] {
  return text.split("\n").map((line, index) => ({
    text: line,
    lineNumber: index + 1,
    pageNumber: 1,
    items: [],
  }));
}

function buildStructuredLines(items: LayoutPdfTextItem[]): ParsedTextLine[] {
  const byPage = new Map<number, LayoutPdfTextItem[]>();
  for (const item of items) {
    const trimmed = item.text.trim();
    if (!trimmed) {
      continue;
    }

    const pageItems = byPage.get(item.pageNumber) ?? [];
    pageItems.push({ ...item, text: trimmed });
    byPage.set(item.pageNumber, pageItems);
  }

  const pages = Array.from(byPage.keys()).sort((left, right) => left - right);
  const lines: ParsedTextLine[] = [];
  let nextLineNumber = 1;

  for (const pageNumber of pages) {
    const pageItems = (byPage.get(pageNumber) ?? []).sort((left, right) => {
      if (Math.abs(left.y - right.y) > LINE_GROUP_TOLERANCE) {
        return right.y - left.y;
      }
      return left.x - right.x;
    });

    const grouped: { y: number; items: LayoutPdfTextItem[] }[] = [];
    for (const item of pageItems) {
      const current = grouped[grouped.length - 1];
      if (!current || Math.abs(current.y - item.y) > LINE_GROUP_TOLERANCE) {
        grouped.push({ y: item.y, items: [item] });
        continue;
      }

      current.items.push(item);
    }

    for (const group of grouped) {
      const sortedItems = [...group.items].sort((left, right) => left.x - right.x);
      lines.push({
        text: sortedItems.map((item) => item.text).join(" "),
        lineNumber: nextLineNumber++,
        pageNumber,
        items: sortedItems,
      });
    }
  }

  return lines;
}

function createEmptyLayout(pageNumber: number, totalSheets: number): MutableLayoutCollections {
  return {
    pageNumber,
    sheetNumber: pageNumber,
    totalSheets,
    panelName: "",
    rails: [],
    panducts: [],
    devices: [],
    measurements: [],
    panelPartNumbers: [],
    boxPartNumbers: [],
    coordinates: [],
  };
}

function hasLayoutContent(layout: MutableLayoutCollections): boolean {
  return (
    layout.rails.length > 0 ||
    layout.devices.length > 0 ||
    layout.panducts.length > 0 ||
    layout.panelPartNumbers.length > 0 ||
    layout.boxPartNumbers.length > 0
  );
}

function railDistance(item: WithPosition & { lineNumber: number }, rail: ExtractedRail): number {
  const itemY = item.y ?? item.lineNumber;
  const railY = rail.y ?? rail.lineNumber;
  const itemX = item.x ?? 0;
  const railX = rail.x ?? 0;
  return Math.abs(itemY - railY) + Math.abs(itemX - railX) / 100;
}

function buildRailGroupsForLayout(layout: MutableLayoutCollections): {
  railGroups: ParsedRailGroup[];
  unassignedDevices: ExtractedDevice[];
  unassignedPanducts: ExtractedPanduct[];
  unassignedMeasurements: ExtractedMeasurement[];
} {
  const rails = [...layout.rails].sort((left, right) => {
    const leftY = left.y ?? left.lineNumber;
    const rightY = right.y ?? right.lineNumber;
    if (leftY !== rightY) {
      return rightY - leftY;
    }
    return (left.x ?? 0) - (right.x ?? 0);
  });

  if (rails.length === 0) {
    return {
      railGroups: [],
      unassignedDevices: [...layout.devices],
      unassignedPanducts: [...layout.panducts],
      unassignedMeasurements: [...layout.measurements],
    };
  }

  const railGroups: ParsedRailGroup[] = rails.map((rail) => ({
    rail,
    devices: [],
    adjacentPanducts: [],
    measurements: [],
  }));

  const findGroupForRail = (rail: ExtractedRail) => railGroups.find((group) => group.rail === rail) ?? null;

  for (const measurement of layout.measurements) {
    if (measurement.kind === "rail" || measurement.kind === "low-profile-rail") {
      const matchingRail = rails.find((rail) => rail.lineNumber === measurement.lineNumber)
        ?? rails.find((rail) => rail.lengthInches === measurement.lengthInches && rail.isLowProfile === (measurement.kind === "low-profile-rail"))
        ?? rails.slice().sort((left, right) => railDistance(measurement, left) - railDistance(measurement, right))[0];
      const group = matchingRail ? findGroupForRail(matchingRail) : null;
      if (group) {
        group.measurements.push(measurement);
      }
    }
  }

  for (const device of layout.devices) {
    const nearestRail = rails.slice().sort((left, right) => railDistance(device, left) - railDistance(device, right))[0];
    const group = nearestRail ? findGroupForRail(nearestRail) : null;
    if (group) {
      group.devices.push(device);
    }
  }

  for (const panduct of layout.panducts) {
    const nearestRail = rails.slice().sort((left, right) => railDistance(panduct, left) - railDistance(panduct, right))[0];
    const group = nearestRail ? findGroupForRail(nearestRail) : null;
    if (group) {
      group.adjacentPanducts.push(panduct);
    }
  }

  for (const measurement of layout.measurements) {
    if (measurement.kind !== "panduct") {
      continue;
    }

    const nearestRail = rails.slice().sort((left, right) => railDistance(measurement, left) - railDistance(measurement, right))[0];
    const group = nearestRail ? findGroupForRail(nearestRail) : null;
    if (group) {
      group.measurements.push(measurement);
    }
  }

  return {
    railGroups,
    unassignedDevices: [],
    unassignedPanducts: [],
    unassignedMeasurements: [],
  };
}

export function parseLayoutPdfText(pdfInput: string | LayoutPdfTextSource): ParsedLayoutPdf {
  const source = typeof pdfInput === "string"
    ? { text: pdfInput, items: [] as LayoutPdfTextItem[], totalPages: undefined }
    : pdfInput;

  const lines = source.items.length > 0 ? buildStructuredLines(source.items) : buildPlainTextLines(source.text);
  const layouts = new Map<number, MutableLayoutCollections>();
  const panelNames = new Set<string>();
  let totalSheets = Math.max(source.totalPages ?? 1, 1);
  let activePageNumber = 1;

  const ensureLayout = (pageNumber: number) => {
    const existing = layouts.get(pageNumber);
    if (existing) {
      return existing;
    }

    const created = createEmptyLayout(pageNumber, totalSheets);
    layouts.set(pageNumber, created);
    return created;
  };

  for (const line of lines) {
    const parsed = parseLine(line.text.replace(/^\s*\d+\t/, ""), line.lineNumber, line.items);

    if (parsed.sheetInfo) {
      activePageNumber = parsed.sheetInfo.sheet;
      totalSheets = Math.max(totalSheets, parsed.sheetInfo.total);
    } else if (source.items.length > 0) {
      activePageNumber = line.pageNumber;
      totalSheets = Math.max(totalSheets, line.pageNumber);
    }

    const layout = ensureLayout(activePageNumber);
    layout.sheetNumber = activePageNumber;
    layout.totalSheets = totalSheets;

    if (parsed.rails.length > 0) {
      layout.rails.push(...parsed.rails.map((rail) => ({ ...rail, pageNumber: activePageNumber })));
    }
    if (parsed.panducts.length > 0) {
      layout.panducts.push(...parsed.panducts.map((panduct) => ({ ...panduct, pageNumber: activePageNumber })));
    }
    if (parsed.devices.length > 0) {
      layout.devices.push(...parsed.devices.map((device) => ({ ...device, pageNumber: activePageNumber })));
    }
    if (parsed.measurements.length > 0) {
      layout.measurements.push(...parsed.measurements.map((measurement) => ({ ...measurement, pageNumber: activePageNumber })));
    }
    if (parsed.panelPartNumbers.length > 0) {
      layout.panelPartNumbers.push(...parsed.panelPartNumbers.map((part) => ({ ...part, pageNumber: activePageNumber })));
    }
    if (parsed.boxPartNumbers.length > 0) {
      layout.boxPartNumbers.push(...parsed.boxPartNumbers.map((part) => ({ ...part, pageNumber: activePageNumber })));
    }
    if (parsed.coordinates.length > 0) {
      layout.coordinates.push(...parsed.coordinates.map((coordinate) => ({ ...coordinate, pageNumber: activePageNumber })));
    }
    if (parsed.panelName) {
      layout.panelName = selectPreferredPanelName(layout.panelName, parsed.panelName);
      if (layout.panelName) {
        panelNames.add(layout.panelName);
      }
    }
  }

  const parsedLayouts = Array.from(layouts.values())
    .filter(hasLayoutContent)
    .sort((left, right) => left.pageNumber - right.pageNumber)
    .map((layout) => {
      const grouped = buildRailGroupsForLayout(layout);
      return {
        pageNumber: layout.pageNumber,
        sheetNumber: layout.sheetNumber,
        totalSheets: totalSheets,
        panelName: layout.panelName,
        railGroups: grouped.railGroups,
        unassignedDevices: grouped.unassignedDevices,
        unassignedPanducts: grouped.unassignedPanducts,
        unassignedMeasurements: grouped.unassignedMeasurements,
        panelPartNumbers: layout.panelPartNumbers,
        boxPartNumbers: layout.boxPartNumbers,
        coordinates: layout.coordinates,
      } satisfies ParsedPdfLayout;
    });

  return {
    layouts: parsedLayouts,
    panelNames: Array.from(panelNames),
    totalSheets: totalSheets || parsedLayouts.length,
  };
}

function getSafeLayouts(parsedPdf: LegacyParsedLayoutPdf): ParsedPdfLayout[] {
  return parsedPdf.layouts ?? parsedPdf.pages ?? [];
}

function getSafeRails(parsedPdf: LegacyParsedLayoutPdf): ExtractedRail[] {
  return getSafeLayouts(parsedPdf).flatMap((layout) =>
    layout.railGroups.flatMap((group) => (group.rail ? [group.rail] : [])),
  );
}

function getSafePanducts(parsedPdf: LegacyParsedLayoutPdf): ExtractedPanduct[] {
  return getSafeLayouts(parsedPdf).flatMap((layout) => [
    ...layout.railGroups.flatMap((group) => group.adjacentPanducts),
    ...layout.unassignedPanducts,
  ]);
}

function getSafeDevices(parsedPdf: LegacyParsedLayoutPdf): ExtractedDevice[] {
  return getSafeLayouts(parsedPdf).flatMap((layout) => [
    ...layout.railGroups.flatMap((group) => group.devices),
    ...layout.unassignedDevices,
  ]);
}

function getSafeMeasurements(parsedPdf: LegacyParsedLayoutPdf): ExtractedMeasurement[] {
  return getSafeLayouts(parsedPdf).flatMap((layout) => [
    ...layout.railGroups.flatMap((group) => group.measurements),
    ...layout.unassignedMeasurements,
  ]);
}

function getSafePanelPartNumbers(parsedPdf: LegacyParsedLayoutPdf): ExtractedPartReference[] {
  return parsedPdf.panelPartNumbers ?? getSafeLayouts(parsedPdf).flatMap((layout) => layout.panelPartNumbers);
}

function getSafeBoxPartNumbers(parsedPdf: LegacyParsedLayoutPdf): ExtractedPartReference[] {
  return parsedPdf.boxPartNumbers ?? getSafeLayouts(parsedPdf).flatMap((layout) => layout.boxPartNumbers);
}

function getSafePanelNames(parsedPdf: LegacyParsedLayoutPdf): string[] {
  return parsedPdf.panelNames ?? [];
}

function getUniquePartNumbers(parts: ExtractedPartReference[]): string[] {
  return Array.from(new Set(parts.map((part) => part.partNumber)));
}

export function buildTopologyFromPdf(parsedPdf: ParsedLayoutPdf, sheetName: string): PanelTopology {
  const layouts = getSafeLayouts(parsedPdf);
  const matchingLayout = layouts.find((layout) =>
    sheetName.toUpperCase().includes(layout.panelName.toUpperCase()) ||
    layout.panelName.toUpperCase().includes(sheetName.toUpperCase()),
  ) ?? layouts[0];

  if (!matchingLayout) {
    return {
      rails: [],
      panducts: [],
      deviceIndex: new Map(),
      sheetName,
    };
  }

  const rails: PlacedRail[] = [];
  const panducts: PanductNode[] = [];
  const deviceIndex = new Map<string, PlacedDevice>();
  let railY = 0;
  const railSpacing = 6;

  matchingLayout.railGroups.forEach((group, index) => {
    if (!group.rail) {
      return;
    }

    const placedRail: PlacedRail = {
      id: `RAIL_${index + 1}`,
      x: 0,
      y: railY,
      length: group.rail.lengthInches,
      orientation: "horizontal",
      devices: [],
    };
    rails.push(placedRail);

    let xOffset = 0;
    for (const device of group.devices) {
      const family = getDeviceFamily(device.prefix);
      const familyDefaults = DEVICE_FAMILY_DEFAULTS[family] || DEVICE_FAMILY_DEFAULTS.unknown;
      const deviceWidth = familyDefaults.widthMm / 25.4;
      const placed: PlacedDevice = {
        deviceId: device.deviceId,
        prefix: device.prefix,
        family,
        railId: placedRail.id,
        x: placedRail.x + xOffset,
        y: placedRail.y,
        width: deviceWidth,
        height: familyDefaults.heightMm / 25.4,
        sequenceIndex: parseInt(device.number, 10),
        dimensions: familyDefaults,
      };
      placedRail.devices.push(placed);
      deviceIndex.set(device.deviceId, placed);
      xOffset += deviceWidth + 0.25;
    }

    group.adjacentPanducts.forEach((panduct, panductIndex) => {
      panducts.push({
        id: `PANDUCT_${index + 1}_${panductIndex + 1}`,
        x: 0,
        y: placedRail.y - 1.5,
        width: panduct.width,
        height: panduct.height,
        label: panduct.label,
        orientation: panduct.length > panduct.height ? "horizontal" : "vertical",
      });
    });

    railY += railSpacing;
  });

  return {
    rails,
    panducts,
    deviceIndex,
    sheetName,
  };
}

export function calculateDeviceDistance(
  topology: PanelTopology,
  fromDeviceId: string,
  toDeviceId: string,
): { distance: number; path: Point[]; confidence: "high" | "medium" | "low" } {
  const fromDevice = topology.deviceIndex.get(fromDeviceId);
  const toDevice = topology.deviceIndex.get(toDeviceId);

  if (!fromDevice || !toDevice) {
    return { distance: 0, path: [], confidence: "low" };
  }

  const dx = Math.abs(toDevice.x - fromDevice.x);
  const dy = Math.abs(toDevice.y - fromDevice.y);
  const manhattanDistance = dx + dy;
  const fromPoint: Point = { x: fromDevice.x + fromDevice.width / 2, y: fromDevice.y };
  const toPoint: Point = { x: toDevice.x + toDevice.width / 2, y: toDevice.y };
  const midPoint: Point = { x: toPoint.x, y: fromPoint.y };
  const confidence = fromDevice.railId === toDevice.railId
    ? "high"
    : topology.panducts.length > 0
      ? "medium"
      : "low";

  return {
    distance: manhattanDistance,
    path: [fromPoint, midPoint, toPoint],
    confidence,
  };
}

export function getRailSummary(parsedPdf: ParsedLayoutPdf): {
  totalRails: number;
  railLengths: number[];
  averageRailLength: number;
  totalRailLength: number;
} {
  const railLengths = getSafeRails(parsedPdf).map((rail) => rail.lengthInches);
  const totalRailLength = railLengths.reduce((sum, length) => sum + length, 0);
  return {
    totalRails: railLengths.length,
    railLengths,
    averageRailLength: railLengths.length > 0 ? totalRailLength / railLengths.length : 0,
    totalRailLength,
  };
}

export function getPanductSummary(parsedPdf: ParsedLayoutPdf): {
  totalPanducts: number;
  panductDimensions: string[];
  uniqueSizes: Set<string>;
} {
  const dimensions = getSafePanducts(parsedPdf).map((panduct) => panduct.label);
  return {
    totalPanducts: dimensions.length,
    panductDimensions: dimensions,
    uniqueSizes: new Set(dimensions),
  };
}

export function getDeviceSummary(parsedPdf: ParsedLayoutPdf): {
  totalDevices: number;
  devicesByPrefix: Map<string, number>;
  uniqueDeviceIds: string[];
} {
  const devicesByPrefix = new Map<string, number>();
  const uniqueDeviceIds = new Set<string>();

  for (const device of getSafeDevices(parsedPdf)) {
    uniqueDeviceIds.add(device.deviceId);
    devicesByPrefix.set(device.prefix, (devicesByPrefix.get(device.prefix) || 0) + 1);
  }

  return {
    totalDevices: uniqueDeviceIds.size,
    devicesByPrefix,
    uniqueDeviceIds: Array.from(uniqueDeviceIds),
  };
}

export function getLayoutAssetSummary(parsedPdf: ParsedLayoutPdf): LayoutAssetSummary {
  const rails = getSafeRails(parsedPdf);
  const panducts = getSafePanducts(parsedPdf);
  const measurements = getSafeMeasurements(parsedPdf);
  const panels = getSafePanelPartNumbers(parsedPdf);
  const boxes = getSafeBoxPartNumbers(parsedPdf);
  const deviceSummary = getDeviceSummary(parsedPdf);

  return {
    totalPages: parsedPdf.totalSheets || getSafeLayouts(parsedPdf).length,
    totalDevices: deviceSummary.totalDevices,
    totalRails: rails.length,
    totalLowProfileRails: rails.filter((rail) => rail.isLowProfile).length,
    totalPanducts: panducts.length,
    totalMeasurements: measurements.length,
    panelPartNumbers: getUniquePartNumbers(panels),
    boxPartNumbers: getUniquePartNumbers(boxes),
    uniquePanductSizes: Array.from(new Set(panducts.map((panduct) => panduct.label))),
    railLengths: rails.map((rail) => rail.lengthInches),
  };
}

export function buildLayoutPartListCandidates(parsedPdf: ParsedLayoutPdf): LayoutPartListCandidate[] {
  const grouped = new Map<string, LayoutPartListCandidate>();
  const rails = getSafeRails(parsedPdf);
  const panducts = getSafePanducts(parsedPdf);
  const panels = getSafePanelPartNumbers(parsedPdf);
  const boxes = getSafeBoxPartNumbers(parsedPdf);

  const upsert = (candidate: LayoutPartListCandidate, key: string) => {
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += candidate.quantity;
      return;
    }
    grouped.set(key, { ...candidate });
  };

  for (const rail of rails) {
    const category = rail.isLowProfile ? "low-profile-rail" : "rail";
    const measurementLabel = `${rail.lengthInches}\" ${rail.isLowProfile ? "LOW PROFILE" : "RAIL"}`;
    upsert(
      {
        category,
        description: rail.isLowProfile ? `Low profile rail ${rail.lengthInches}\"` : `Rail ${rail.lengthInches}\"`,
        quantity: 1,
        measurementLabel,
      },
      `${category}:${rail.lengthInches}`,
    );
  }

  for (const panduct of panducts) {
    upsert(
      {
        category: "panduct",
        description: `Panduct ${panduct.width}x${panduct.height}x${panduct.length}`,
        quantity: 1,
        measurementLabel: panduct.label,
      },
      `panduct:${panduct.label.toUpperCase()}`,
    );
  }

  for (const panel of panels) {
    upsert(
      {
        category: "panel",
        description: `Panel assembly ${panel.partNumber}`,
        quantity: 1,
        partNumber: panel.partNumber,
      },
      `panel:${panel.partNumber}`,
    );
  }

  for (const box of boxes) {
    upsert(
      {
        category: "box",
        description: `Box assembly ${box.partNumber}`,
        quantity: 1,
        partNumber: box.partNumber,
      },
      `box:${box.partNumber}`,
    );
  }

  return Array.from(grouped.values());
}

export function buildLayoutPartListRows(
  parsedPdf: ParsedLayoutPdf,
  options?: { location?: string },
): LayoutPartListRow[] {
  const location = options?.location ?? getSafePanelNames(parsedPdf)[0] ?? "";

  return buildLayoutPartListCandidates(parsedPdf).map((candidate) => ({
    "Device ID": "",
    "Part Number": candidate.partNumber ?? "",
    Description: candidate.measurementLabel
      ? `${candidate.description} (${candidate.measurementLabel})`
      : candidate.description,
    Location: location,
    Quantity: candidate.quantity,
    Category: candidate.category,
    Source: "Layout PDF",
  }));
}