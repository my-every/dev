/**
 * Wire List Print Schema Builder
 *
 * Generates a JSON-serializable schema that mirrors the exact page order
 * of the wire list print output, including:
 *   1. Cover page metadata
 *   2. Table of Contents with per-section time estimates
 *   3. IPV Codes reference
 *   4. Wire list sections (location groups → subsections → rows)
 *   5. Feedback section
 *
 * This schema is consumed by the /api/wire-list-print-schema route.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";
import type { IdentificationFilterKind } from "@/lib/wiring-identification/types";
import type { PrintFormatMode, PrintSettings, ProjectInfo } from "@/lib/wire-list-print/defaults";
import { createDefaultPrintSettings, createDefaultProjectInfo } from "@/lib/wire-list-print/defaults";
import {
  buildProcessedPrintLocationGroups,
  buildPrintPreviewPageCount,
  type PrintLocationGroup,
  type PrintSubsection,
} from "@/lib/wire-list-print/model";
import { shouldSwapForTargetPair } from "@/lib/wire-list-sections";
import { estimateWireTime, formatEstTime, summarizeSectionTime, type SectionTimeSummary } from "@/lib/wire-list-print/time-estimation";
import type { PartNumberLookupResult } from "@/lib/part-number-list";
import type { BlueLabelSequenceMap } from "@/lib/wiring-identification/types";
import { detectDeviceChange } from "@/lib/wiring-identification/device-change-pattern";
import { getSheetDeviceSequence } from "@/lib/wiring-identification/blue-label-sequence";
import type { VisiblePreviewSection } from "@/lib/wire-list-print/model";
import type { WireListSheetDocument } from "@/lib/wire-list-sheet-document/types";
import { normalizeWireListWireNo } from "@/lib/wire-list-print/normalize-wire-no";

// ============================================================================
// Schema Types
// ============================================================================

export interface WireListPrintSchemaRow {
  rowId: string;
  rowIndex: number;
  fromDeviceId: string;
  toDeviceId: string;
  wireType: string;
  wireNo: string;
  wireId: string;
  gaugeSize: string;
  fromLocation: string;
  toLocation: string;
  fromPageZone: string;
  toPageZone: string;
  partNumber?: string;
  partDescription?: string;
  lengthDisplay?: string;
  lengthInches?: number;
  estFrom?: string;
  estTo?: string;
  estTotalMinutes?: number;
}

export interface WireListPrintSchemaSubsection {
  label: string;
  sectionKind?: string;
  rowCount: number;
  rows: WireListPrintSchemaRow[];
  deviceToDeviceSubsections?: {
    label: string;
    rowCount: number;
    estTime?: string;
  }[];
  timeSummary?: {
    fromTotal: string;
    toTotal: string;
    grandTotal: string;
    phases: { preparing: string; locating: string; terminating: string };
    rowCount: number;
  };
}

export interface WireListPrintSchemaLocationGroup {
  location: string;
  isExternal: boolean;
  /** Normalized display title for location, mainly for external sections. */
  normalizedTitle?: string;
  /** Box side token derived from assignment mappings, mainly for external sections. */
  boxSide?: string;
  totalRows: number;
  subsections: WireListPrintSchemaSubsection[];
}

export interface WireListPrintSchemaTocEntry {
  index: number;
  label: string;
  rowCount: number;
  estTime?: string;
  estimatedPage: number;
  subEntries?: {
    label: string;
    rowCount: number;
    estTime?: string;
  }[];
}

export interface WireListPrintSchemaTocGroup {
  location: string;
  isExternal: boolean;
  sections: WireListPrintSchemaTocEntry[];
}

export interface WireListPrintSchemaPage {
  pageType: "cover" | "toc" | "ipv-codes" | "wire-list" | "feedback";
  pageNumber: number;
}

export interface WireListPrintSchemaCoverPage extends WireListPrintSchemaPage {
  pageType: "cover";
  projectInfo: ProjectInfo;
  sheetTitle: string;
}

export interface WireListPrintSchemaTocPage extends WireListPrintSchemaPage {
  pageType: "toc";
  locationGroups: WireListPrintSchemaTocGroup[];
  summary: {
    locations: number;
    sections: number;
    rows: number;
    estTotalTime?: string;
    pages: number;
  };
}

export interface WireListPrintSchemaWireListPage extends WireListPrintSchemaPage {
  pageType: "wire-list";
  locationGroups: WireListPrintSchemaLocationGroup[];
}

export interface WireListPrintSchemaFeedbackPage extends WireListPrintSchemaPage {
  pageType: "feedback";
}

export interface WireListPrintSchemaIpvCodesPage extends WireListPrintSchemaPage {
  pageType: "ipv-codes";
}

export type WireListPrintSchemaPageUnion =
  | WireListPrintSchemaCoverPage
  | WireListPrintSchemaTocPage
  | WireListPrintSchemaIpvCodesPage
  | WireListPrintSchemaWireListPage
  | WireListPrintSchemaFeedbackPage;

export interface WireListPrintSchema {
  generatedAt: string;
  sheetName: string;
  mode: PrintFormatMode;
  totalPages: number;
  totalRows: number;
  settings: {
    showEstTime: boolean;
    showFromCheckbox: boolean;
    showToCheckbox: boolean;
    showIPV: boolean;
    showComments: boolean;
    showLength: boolean;
    showCoverPage: boolean;
    showTableOfContents: boolean;
    showIPVCodes: boolean;
    showFeedbackSection: boolean;
    showDeviceSubheaders?: boolean;
    enableBlueDeviceIDColumns?: boolean;
    sectionColumnVisibility?: Record<string, Record<string, boolean>>;
    feedbackRenderMode?: string;
    feedbackSections?: string[];
    customQuestions?: string[];
    crossWireSections?: string[];
    hiddenRows?: string[];
    hiddenSections?: string[];
    brandingSortMode?: PrintSettings["brandingSortMode"];
    wireListSortMode?: PrintSettings["wireListSortMode"];
  };
  ipvChecklist?: {
    totalRows: number;
    groups: Array<{
      deviceId: string;
      rows: WireListPrintSchemaRow[];
    }>;
  };
  pages: WireListPrintSchemaPageUnion[];
}

// ============================================================================
// Helpers
// ============================================================================

function isPrintableConnectionRow(row: SemanticWireListRow): boolean {
  if (detectDeviceChange(row).isDeviceChange) return false;
  const from = (row.fromDeviceId || "").trim();
  const to = (row.toDeviceId || "").trim();
  return from.length > 0 || to.length > 0;
}

function getDisplayEndpoints(row: SemanticWireListRow) {
  const shouldSwap = shouldSwapForTargetPair(row.fromDeviceId, row.toDeviceId);
  const rawFromLocation = row.fromLocation || "";
  const rawToLocation = row.toLocation || row.location || rawFromLocation || "";

  return {
    fromDeviceId: shouldSwap ? (row.toDeviceId || "") : (row.fromDeviceId || ""),
    toDeviceId: shouldSwap ? (row.fromDeviceId || "") : (row.toDeviceId || ""),
    fromLocation: shouldSwap
      ? (rawToLocation || rawFromLocation)
      : (rawFromLocation || rawToLocation),
    toLocation: shouldSwap
      ? (rawFromLocation || rawToLocation)
      : (rawToLocation || rawFromLocation),
    fromPageZone: shouldSwap ? (row.toPageZone || "") : (row.fromPageZone || ""),
    toPageZone: shouldSwap ? (row.fromPageZone || "") : (row.toPageZone || ""),
  };
}

function buildSchemaRow(
  row: SemanticWireListRow,
  sectionKind: IdentificationFilterKind | undefined,
  showEstTime: boolean,
  currentSheetName: string,
  isExternalSection: boolean,
  getLengthForRow: ((rowId: string) => { display: string; roundedInches: number } | null) | undefined,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
): WireListPrintSchemaRow {
  const endpoints = getDisplayEndpoints(row);
  const resolvedFromLocation = isExternalSection
    ? (currentSheetName || endpoints.fromLocation || endpoints.toLocation)
    : endpoints.fromLocation;
  const est = showEstTime ? estimateWireTime(sectionKind, row.gaugeSize) : null;

  const result: WireListPrintSchemaRow = {
    rowId: row.__rowId,
    rowIndex: row.__rowIndex,
    fromDeviceId: endpoints.fromDeviceId.trim().replace(/:$/, ""),
    toDeviceId: endpoints.toDeviceId.trim().replace(/:$/, ""),
    wireType: row.wireType || "",
    wireNo: normalizeWireListWireNo(row.wireNo),
    wireId: row.wireId || "",
    gaugeSize: row.gaugeSize || "",
    fromLocation: resolvedFromLocation,
    toLocation: endpoints.toLocation,
    fromPageZone: endpoints.fromPageZone,
    toPageZone: endpoints.toPageZone,
  };

  if (partNumberMap) {
    const pn = partNumberMap.get(endpoints.fromDeviceId.trim().replace(/:.*$/, ""));
    if (pn) {
      result.partNumber = pn.partNumber;
      result.partDescription = pn.description;
    }
  }

  if (getLengthForRow) {
    const length = getLengthForRow(row.__rowId);
    if (length) {
      result.lengthDisplay = length.display;
      result.lengthInches = length.roundedInches;
    }
  }

  if (est) {
    result.estFrom = formatEstTime(est.fromMinutes);
    result.estTo = formatEstTime(est.toMinutes);
    result.estTotalMinutes = est.totalMinutes;
  }

  return result;
}

function buildSchemaSubsection(
  group: PrintLocationGroup,
  currentSheetName: string,
  subsection: PrintSubsection,
  showEstTime: boolean,
  getLengthForRow: ((rowId: string) => { display: string; roundedInches: number } | null) | undefined,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
): WireListPrintSchemaSubsection {
  const printableRows = subsection.rows.filter(isPrintableConnectionRow);
  const rows = printableRows.map((row) =>
    buildSchemaRow(
      row,
      subsection.sectionKind,
      showEstTime,
      currentSheetName,
      group.isExternal,
      getLengthForRow,
      partNumberMap,
    ),
  );

  const result: WireListPrintSchemaSubsection = {
    label: subsection.label,
    sectionKind: subsection.sectionKind,
    rowCount: printableRows.length,
    rows,
  };

  if (subsection.deviceToDeviceSubsections) {
    result.deviceToDeviceSubsections = subsection.deviceToDeviceSubsections.map((d2d) => {
      const d2dPrintable = d2d.rows.filter(isPrintableConnectionRow);
      const entry: { label: string; rowCount: number; estTime?: string } = {
        label: d2d.label,
        rowCount: d2dPrintable.length,
      };
      if (showEstTime && d2dPrintable.length > 0) {
        const summary = summarizeSectionTime(d2dPrintable, subsection.sectionKind);
        entry.estTime = formatEstTime(summary.grandTotal);
      }
      return entry;
    });
  }

  if (showEstTime && printableRows.length > 0) {
    const summary = summarizeSectionTime(printableRows, subsection.sectionKind);
    result.timeSummary = {
      fromTotal: formatEstTime(summary.fromTotal),
      toTotal: formatEstTime(summary.toTotal),
      grandTotal: formatEstTime(summary.grandTotal),
      phases: {
        preparing: formatEstTime(summary.phases.preparing),
        locating: formatEstTime(summary.phases.locating),
        terminating: formatEstTime(summary.phases.terminating),
      },
      rowCount: summary.rowCount,
    };
  }

  return result;
}

function getBaseDeviceIdValue(deviceId: string | undefined): string {
  return deviceId?.split(":")[0]?.trim() || "";
}

type IPVRowEntry = {
  row: SemanticWireListRow;
  sectionKind: IdentificationFilterKind | undefined;
  isExternalSection: boolean;
};

function buildIpvChecklistSchema(
  processedLocationGroups: PrintLocationGroup[],
  currentSheetName: string,
  blueLabels: BlueLabelSequenceMap | null,
  getLengthForRow: ((rowId: string) => { display: string; roundedInches: number } | null) | undefined,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  assignmentBlueLabels?: string[] | null,
): NonNullable<WireListPrintSchema["ipvChecklist"]> {
  const directSequence = assignmentBlueLabels?.length
    ? assignmentBlueLabels
    : blueLabels?.isValid
      ? getSheetDeviceSequence(currentSheetName, blueLabels)
      : [];

  const normalizedSequence = directSequence
    .map((deviceId) => getBaseDeviceIdValue(deviceId).trim().toUpperCase())
    .filter(Boolean);
  const useStrictBlueLabelWhitelist = normalizedSequence.length > 0;
  const allowedDeviceIds = new Set(normalizedSequence);

  const entries: IPVRowEntry[] = [];
  for (const group of processedLocationGroups) {
    for (const subsection of group.subsections) {
      for (const row of subsection.rows) {
        if (!isPrintableConnectionRow(row)) continue;

        if (useStrictBlueLabelWhitelist) {
          const endpoints = getDisplayEndpoints(row);
          const fromDeviceBase = getBaseDeviceIdValue(endpoints.fromDeviceId)
            .trim()
            .toUpperCase();
          if (!fromDeviceBase || !allowedDeviceIds.has(fromDeviceBase)) {
            continue;
          }
        }

        entries.push({
          row,
          sectionKind: subsection.sectionKind,
          isExternalSection: group.isExternal,
        });
      }
    }
  }

  const rowsByDevice = new Map<string, IPVRowEntry[]>();
  const deviceOrder: string[] = [];
  for (const entry of entries) {
    const endpoints = getDisplayEndpoints(entry.row);
    const deviceBase =
      getBaseDeviceIdValue(endpoints.fromDeviceId).trim().toUpperCase() ||
      "__UNKNOWN__";

    if (!rowsByDevice.has(deviceBase)) {
      rowsByDevice.set(deviceBase, []);
      deviceOrder.push(deviceBase);
    }
    rowsByDevice.get(deviceBase)!.push(entry);
  }

  const groups: NonNullable<WireListPrintSchema["ipvChecklist"]>["groups"] = [];
  const visited = new Set<string>();

  if (directSequence.length > 0) {
    for (const deviceId of directSequence) {
      const key = getBaseDeviceIdValue(deviceId).trim().toUpperCase();
      if (!key || visited.has(key)) continue;
      const deviceEntries = rowsByDevice.get(key);
      if (deviceEntries?.length) {
        groups.push({
          deviceId: getBaseDeviceIdValue(deviceId).trim(),
          rows: deviceEntries.map((entry) =>
            buildSchemaRow(
              entry.row,
              entry.sectionKind,
              false,
              currentSheetName,
              entry.isExternalSection,
              getLengthForRow,
              partNumberMap,
            ),
          ),
        });
      }
      visited.add(key);
    }
  }

  if (!useStrictBlueLabelWhitelist) {
    for (const key of deviceOrder) {
      if (visited.has(key)) continue;
      const deviceEntries = rowsByDevice.get(key);
      if (!deviceEntries?.length) continue;

      groups.push({
        deviceId: key === "__UNKNOWN__" ? "—" : key,
        rows: deviceEntries.map((entry) =>
          buildSchemaRow(
            entry.row,
            entry.sectionKind,
            false,
            currentSheetName,
            entry.isExternalSection,
            getLengthForRow,
            partNumberMap,
          ),
        ),
      });
    }
  }

  return {
    totalRows: entries.length,
    groups,
  };
}

// ============================================================================
// Main Builder
// ============================================================================

export interface BuildPrintSchemaOptions {
  rows?: SemanticWireListRow[];
  processedLocationGroups?: PrintLocationGroup[];
  sheetDocument?: WireListSheetDocument;
  visibleSections?: VisiblePreviewSection[];
  totalPagesOverride?: number;
  currentSheetName: string;
  settings?: Partial<PrintSettings>;
  getLengthForRow?: (rowId: string) => { display: string; roundedInches: number } | null;
  /** Destination sheet name (uppercase) -> box side mapping for external groups. */
  locationBoxSideByName?: Record<string, string>;
  /** Destination sheet name (uppercase) -> normalized title mapping for display. */
  locationNormalizedTitleByName?: Record<string, string>;
  /** Blue label sequence map for sorting single connections */
  blueLabels?: BlueLabelSequenceMap | null;
  /** Assignment-level blue label device sequence (takes priority over blueLabels sheet sequence for IPV ordering) */
  assignmentBlueLabels?: string[] | null;
  /** Part number lookup map */
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
}

function getLocationLookupKeys(location: string | undefined): string[] {
  const raw = String(location ?? "").trim();
  if (!raw) return [];

  const keys = new Set<string>();
  keys.add(raw.toUpperCase());
  keys.add(raw.toUpperCase().replace(/[\s,_-]+/g, " ").trim());

  return Array.from(keys).filter(Boolean);
}

function resolveLocationMetadata(
  location: string,
  locationBoxSideByName?: Record<string, string>,
  locationNormalizedTitleByName?: Record<string, string>,
): { boxSide?: string; normalizedTitle?: string } {
  let resolvedBoxSide: string | undefined;
  let resolvedNormalizedTitle: string | undefined;

  for (const key of getLocationLookupKeys(location)) {
    if (!resolvedBoxSide) {
      const maybeBoxSide = locationBoxSideByName?.[key];
      if (maybeBoxSide && maybeBoxSide.trim()) {
        resolvedBoxSide = maybeBoxSide;
      }
    }

    if (!resolvedNormalizedTitle) {
      const maybeTitle = locationNormalizedTitleByName?.[key];
      if (maybeTitle && maybeTitle.trim()) {
        resolvedNormalizedTitle = maybeTitle;
      }
    }

    if (resolvedBoxSide && resolvedNormalizedTitle) {
      break;
    }
  }

  return {
    boxSide: resolvedBoxSide,
    normalizedTitle: resolvedNormalizedTitle,
  };
}

function buildLocationGroupsFromVisibleSections(
  visibleSections: VisiblePreviewSection[],
): PrintLocationGroup[] {
  const groups = new Map<string, PrintLocationGroup>();

  for (const section of visibleSections) {
    const key = `${section.group.location}:${section.group.isExternal ? "external" : "internal"}`;
    const existing = groups.get(key);
    const subsection: PrintSubsection = {
      ...section.subsection,
      rows: section.visibleRows,
    };

    if (existing) {
      existing.subsections.push(subsection);
      existing.totalRows += section.visibleRows.length;
      continue;
    }

    groups.set(key, {
      location: section.group.location,
      isExternal: section.group.isExternal,
      totalRows: section.visibleRows.length,
      subsections: [subsection],
    });
  }

  return Array.from(groups.values());
}

export function buildWireListPrintSchema(options: BuildPrintSchemaOptions): WireListPrintSchema {
  const defaultSettings = createDefaultPrintSettings();
  const settings: PrintSettings = {
    ...defaultSettings,
    ...options.settings,
    // Safely reconstitute Set fields that may arrive as arrays from JSON
    standardHiddenSections: options.settings?.standardHiddenSections instanceof Set
      ? options.settings.standardHiddenSections
      : new Set(Array.isArray(options.settings?.standardHiddenSections) ? options.settings.standardHiddenSections as unknown as string[] : []),
    brandingHiddenSections: options.settings?.brandingHiddenSections instanceof Set
      ? options.settings.brandingHiddenSections
      : new Set(Array.isArray(options.settings?.brandingHiddenSections) ? options.settings.brandingHiddenSections as unknown as string[] : []),
    hiddenRows: options.settings?.hiddenRows instanceof Set
      ? options.settings.hiddenRows
      : new Set(Array.isArray(options.settings?.hiddenRows) ? options.settings.hiddenRows as unknown as string[] : []),
    crossWireSections: options.settings?.crossWireSections instanceof Set
      ? options.settings.crossWireSections
      : new Set(Array.isArray(options.settings?.crossWireSections) ? options.settings.crossWireSections as unknown as string[] : []),
  };
  const projectInfo = options.projectInfo ?? createDefaultProjectInfo();
  const sheetTitle = options.sheetTitle ?? options.currentSheetName;
  const hiddenSections = options.hiddenSections ?? (
    settings.mode === "branding"
      ? settings.brandingHiddenSections
      : settings.standardHiddenSections
  );

  const resolvedVisibleSections =
    options.visibleSections
    ?? options.sheetDocument?.wireListSections
    ?? null;

  // Build location groups (same logic as print modal)
  const processedLocationGroups = options.processedLocationGroups
    ?? (resolvedVisibleSections
      ? buildLocationGroupsFromVisibleSections(resolvedVisibleSections)
      : buildProcessedPrintLocationGroups({
          rows: options.rows ?? [],
          mode: settings.mode,
          enabledSections: settings.enabledSections,
          sectionOrder: settings.sectionOrder,
          currentSheetName: options.currentSheetName,
          blueLabels: options.blueLabels ?? null,
          partNumberMap: options.partNumberMap,
          sortMode: settings.mode === "branding"
            ? settings.brandingSortMode
            : settings.wireListSortMode,
          locationBoxSideByName: options.locationBoxSideByName,
          locationNormalizedTitleByName: options.locationNormalizedTitleByName,
        }));

  // Compute page count
  const totalPages = options.totalPagesOverride ?? buildPrintPreviewPageCount({
    mode: settings.mode,
    processedLocationGroups,
    showFeedbackSection: settings.showFeedbackSection,
    showCoverPage: settings.showCoverPage,
    showTableOfContents: settings.showTableOfContents,
    showIPVCodes: settings.showIPVCodes,
  });

  const totalRows = processedLocationGroups.reduce((sum, g) => sum + g.totalRows, 0);
  const ipvChecklist = buildIpvChecklistSchema(
    processedLocationGroups,
    options.currentSheetName,
    options.blueLabels ?? null,
    options.getLengthForRow,
    options.partNumberMap,
    options.assignmentBlueLabels ?? null,
  );

  // Build pages in order
  const pages: WireListPrintSchemaPageUnion[] = [];
  let pageNumber = 1;

  // 1. Cover page
  if (settings.showCoverPage) {
    pages.push({
      pageType: "cover",
      pageNumber: pageNumber++,
      projectInfo,
      sheetTitle,
    });
  }

  // 2. Table of Contents
  if (settings.showTableOfContents && processedLocationGroups.length > 0) {
    const pageOffset = (settings.showCoverPage ? 1 : 0)
      + (settings.showTableOfContents ? 1 : 0)
      + (settings.showIPVCodes ? 1 : 0);

    let runningRowCount = 0;
    let visibleLocationCount = 0;
    let visibleSectionCount = 0;
    let visibleRowCount = 0;
    let visibleTotalTime = 0;

    const tocGroups: WireListPrintSchemaTocGroup[] = [];

    for (const [groupIndex, group] of processedLocationGroups.entries()) {
      const locationKey = `loc-${groupIndex}`;
      if (hiddenSections.has(locationKey)) continue;

      const sections: WireListPrintSchemaTocEntry[] = [];
      let sectionCounter = 0;

      for (const [subIndex, subsection] of group.subsections.entries()) {
        const sectionKey = `${groupIndex}-${subIndex}`;
        if (hiddenSections.has(sectionKey)) continue;

        sectionCounter++;
        const printableRows = subsection.rows.filter(isPrintableConnectionRow);
        const estimatedPage = pageOffset + 1 + Math.floor(runningRowCount / 30);
        runningRowCount += printableRows.length;

        const entry: WireListPrintSchemaTocEntry = {
          index: sectionCounter,
          label: subsection.label,
          rowCount: printableRows.length,
          estimatedPage,
        };

        if (settings.showEstTime && printableRows.length > 0) {
          const summary = summarizeSectionTime(printableRows, subsection.sectionKind);
          entry.estTime = formatEstTime(summary.grandTotal);
          visibleTotalTime += summary.grandTotal;
        }

        if (subsection.deviceToDeviceSubsections) {
          entry.subEntries = subsection.deviceToDeviceSubsections.map((d2d) => {
            const d2dPrintable = d2d.rows.filter(isPrintableConnectionRow);
            const sub: { label: string; rowCount: number; estTime?: string } = {
              label: d2d.label,
              rowCount: d2dPrintable.length,
            };
            if (settings.showEstTime && d2dPrintable.length > 0) {
              const s = summarizeSectionTime(d2dPrintable, subsection.sectionKind);
              sub.estTime = formatEstTime(s.grandTotal);
            }
            return sub;
          });
        }

        sections.push(entry);
        visibleSectionCount += 1 + (subsection.deviceToDeviceSubsections?.length ?? 0);
        visibleRowCount += printableRows.length;
      }

      if (sections.length > 0) {
        visibleLocationCount++;
        tocGroups.push({
          location: group.location,
          isExternal: group.isExternal,
          sections,
        });
      }
    }

    pages.push({
      pageType: "toc",
      pageNumber: pageNumber++,
      locationGroups: tocGroups,
      summary: {
        locations: visibleLocationCount,
        sections: visibleSectionCount,
        rows: visibleRowCount,
        ...(settings.showEstTime ? { estTotalTime: formatEstTime(visibleTotalTime) } : {}),
        pages: totalPages,
      },
    });
  }

  // 3. IPV Codes
  if (settings.showIPVCodes) {
    pages.push({
      pageType: "ipv-codes",
      pageNumber: pageNumber++,
    });
  }

  // 4. Wire list sections
  const schemaLocationGroups: WireListPrintSchemaLocationGroup[] = [];

  for (const [groupIndex, group] of processedLocationGroups.entries()) {
    const locationKey = `loc-${groupIndex}`;
    if (hiddenSections.has(locationKey)) continue;

    const schemaSubsections: WireListPrintSchemaSubsection[] = [];

    for (const [subIndex, subsection] of group.subsections.entries()) {
      const sectionKey = `${groupIndex}-${subIndex}`;
      if (hiddenSections.has(sectionKey)) continue;

      schemaSubsections.push(
        buildSchemaSubsection(
          group,
          options.currentSheetName,
          subsection,
          settings.showEstTime,
          options.getLengthForRow,
          options.partNumberMap,
        ),
      );
    }

    if (schemaSubsections.length > 0) {
      const locationMetadata = group.isExternal
        ? resolveLocationMetadata(
            group.location,
            options.locationBoxSideByName,
            options.locationNormalizedTitleByName,
          )
        : {};

      schemaLocationGroups.push({
        location: group.location,
        isExternal: group.isExternal,
        normalizedTitle: locationMetadata.normalizedTitle,
        boxSide: locationMetadata.boxSide ?? group.boxSide,
        totalRows: schemaSubsections.reduce((s, sub) => s + sub.rowCount, 0),
        subsections: schemaSubsections,
      });
    }
  }

  if (schemaLocationGroups.length > 0) {
    pages.push({
      pageType: "wire-list",
      pageNumber: pageNumber++,
      locationGroups: schemaLocationGroups,
    });
  }

  // 5. Feedback section
  if (settings.showFeedbackSection) {
    pages.push({
      pageType: "feedback",
      pageNumber: pageNumber++,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    sheetName: options.currentSheetName,
    mode: settings.mode,
    totalPages,
    totalRows,
    settings: {
      showEstTime: settings.showEstTime,
      showFromCheckbox: settings.showFromCheckbox,
      showToCheckbox: settings.showToCheckbox,
      showIPV: settings.showIPV,
      showComments: settings.showComments,
      showLength: settings.showLength,
      showCoverPage: settings.showCoverPage,
      showTableOfContents: settings.showTableOfContents,
      showIPVCodes: settings.showIPVCodes,
      showFeedbackSection: settings.showFeedbackSection,
      showDeviceSubheaders: settings.showDeviceSubheaders,
      enableBlueDeviceIDColumns: settings.enableBlueDeviceIDColumns,
      sectionColumnVisibility: Object.fromEntries(
        Object.entries(settings.sectionColumnVisibility).map(([key, value]) => [key, { ...value }]),
      ),
      feedbackRenderMode: settings.feedbackRenderMode as string | undefined,
      feedbackSections: settings.feedbackSections.map((section) => section.title),
      customQuestions: Object.keys(settings.customQuestions),
      crossWireSections: Array.from(settings.crossWireSections),
      hiddenRows: Array.from(settings.hiddenRows),
      hiddenSections: hiddenSections ? Array.from(hiddenSections) : undefined,
      brandingSortMode: settings.brandingSortMode,
      wireListSortMode: settings.wireListSortMode,
    },
    ipvChecklist,
    pages,
  };
}

// ============================================================================
// Schema → Component Props Mapper
// ============================================================================

/**
 * Convert a schema row back to a SemanticWireListRow for component rendering.
 */
function schemaRowToSemantic(row: WireListPrintSchemaRow): SemanticWireListRow {
  return {
    __rowId: row.rowId,
    __rowIndex: row.rowIndex,
    fromDeviceId: row.fromDeviceId,
    toDeviceId: row.toDeviceId,
    wireType: row.wireType,
    wireNo: normalizeWireListWireNo(row.wireNo),
    wireId: row.wireId,
    gaugeSize: row.gaugeSize,
    fromLocation: row.fromLocation,
    toLocation: row.toLocation,
    fromPageZone: row.fromPageZone,
    toPageZone: row.toPageZone,
  };
}

/**
 * Convert a schema subsection back to a PrintSubsection for component rendering.
 */
function schemaSubsectionToPrint(sub: WireListPrintSchemaSubsection): PrintSubsection {
  const result: PrintSubsection = {
    label: sub.label,
    rows: sub.rows.map(schemaRowToSemantic),
    sectionKind: sub.sectionKind as IdentificationFilterKind | undefined,
  };
  if (sub.deviceToDeviceSubsections) {
    result.deviceToDeviceSubsections = sub.deviceToDeviceSubsections.map((d2d) => ({
      label: d2d.label,
      rows: [], // d2d subsections in schema only carry counts; rows live in the parent
    }));
  }
  return result;
}

export interface SchemaHydrationResult {
  processedLocationGroups: PrintLocationGroup[];
  settings: {
    showEstTime: boolean;
    showFromCheckbox: boolean;
    showToCheckbox: boolean;
    showIPV: boolean;
    showComments: boolean;
    showLength: boolean;
    showCoverPage: boolean;
    showTableOfContents: boolean;
    showIPVCodes: boolean;
    showFeedbackSection: boolean;
    brandingSortMode?: PrintSettings["brandingSortMode"];
    wireListSortMode?: PrintSettings["wireListSortMode"];
  };
  mode: PrintFormatMode;
  sheetName: string;
  totalPages: number;
  totalRows: number;
  projectInfo?: ProjectInfo;
  sheetTitle?: string;
  partNumberMap?: Map<string, PartNumberLookupResult>;
  rowLengthsById?: Record<string, { display: string; roundedInches: number; confidence: string }>;
  ipvChecklistGroups?: Array<{
    deviceId: string;
    rows: SemanticWireListRow[];
  }>;
}

/**
 * Hydrate a saved WireListPrintSchema into the data structures the print
 * components expect, allowing schema-driven rendering without raw rows.
 */
export function hydrateSchemaForRender(schema: WireListPrintSchema): SchemaHydrationResult {
  // Extract wire-list page (there should be exactly one)
  const wireListPage = schema.pages.find(
    (p): p is WireListPrintSchemaWireListPage => p.pageType === "wire-list",
  );

  const processedLocationGroups: PrintLocationGroup[] = wireListPage
    ? wireListPage.locationGroups.map((g) => ({
      location: g.location,
      isExternal: g.isExternal,
      boxSide: g.boxSide,
      totalRows: g.totalRows,
      subsections: g.subsections.map(schemaSubsectionToPrint),
    }))
    : [];

  // Build a part number map from schema rows that have part numbers
  const partNumberMap = new Map<string, PartNumberLookupResult>();
  const rowLengthsById: NonNullable<SchemaHydrationResult["rowLengthsById"]> = {};
  if (wireListPage) {
    for (const group of wireListPage.locationGroups) {
      for (const sub of group.subsections) {
        for (const row of sub.rows) {
          if (row.partNumber) {
            const key = row.fromDeviceId.replace(/:.*$/, "");
            if (!partNumberMap.has(key)) {
              partNumberMap.set(key, {
                partNumber: row.partNumber,
                description: row.partDescription || "",
                location: row.fromLocation || "",
              });
            }
          }

          if (row.lengthDisplay && typeof row.lengthInches === "number") {
            rowLengthsById[row.rowId] = {
              display: row.lengthDisplay,
              roundedInches: row.lengthInches,
              confidence: "schema",
            };
          }
        }
      }
    }
  }

  // Extract project info from cover page if present
  const coverPage = schema.pages.find(
    (p): p is WireListPrintSchemaCoverPage => p.pageType === "cover",
  );

  return {
    processedLocationGroups,
    settings: schema.settings,
    mode: schema.mode,
    sheetName: schema.sheetName,
    totalPages: schema.totalPages,
    totalRows: schema.totalRows,
    projectInfo: coverPage?.projectInfo,
    sheetTitle: coverPage?.sheetTitle,
    partNumberMap: partNumberMap.size > 0 ? partNumberMap : undefined,
    rowLengthsById: Object.keys(rowLengthsById).length > 0 ? rowLengthsById : undefined,
    ipvChecklistGroups: schema.ipvChecklist?.groups?.map((group) => ({
      deviceId: group.deviceId,
      rows: group.rows.map(schemaRowToSemantic),
    })),
  };
}
