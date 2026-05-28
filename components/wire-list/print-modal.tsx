"use client";

/**
 * Print Modal Component
 *
 * A comprehensive print modal with live preview using Framer Motion that supports:
 * - Standardize Format presets (Smallest to Largest, Same Location First, GRNS, JUMPERS)
 * - Custom sorting/filtering options
 * - Zoomable and scrollable preview area
 * - Project information section
 * - Non-interactive print layout (textarea for comments instead of popovers)
 * - De-duplication of rows when settings change
 */

import React, { useState, useMemo, useCallback, useRef, useEffect, Fragment, type ReactNode } from "react";
import { useReactToPrint } from "react-to-print";
import { motion, AnimatePresence } from "framer-motion";
import {
  Printer,
  X,
  Settings2,
  ChevronDown,
  FileText,
  Zap,
  Link2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Building2,
  Hash,
  Calendar,
  User,
  Clock,
  BadgeCheck,
  GripVertical,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
  MessageSquarePlus,
  ClipboardCheck,
  Pencil,
  Plus,
  Eye,
  EyeOff,
  Trash2,
  Minus,
  ChevronRight,
  Download,
  BookOpen,
  Image,
  ArrowUpDown,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import { normalizeDisplayTitle, normalizeSheetName } from "@/lib/workbook/normalize-sheet-name";
import type { CablePartNumberLookupResult, PartNumberLookupResult } from "@/lib/part-number-list";
import { lookupPartNumber } from "@/lib/part-number-list";
import type { BlueLabelSequenceMap, IdentificationFilterKind, PatternMatchMetadata } from "@/lib/wiring-identification/types";
import { parseGaugeNumeric, sortRowsByGaugeSize } from "@/lib/wiring-identification/gauge-filter";
import { extractGrounds } from "@/lib/wiring-identification/extract-grounds";
import { extractAfJumpers } from "@/lib/wiring-identification/extract-af-jumpers";
import { extractKaJumpers } from "@/lib/wiring-identification/extract-ka-jumpers";
import { extractKaTwinFerrules } from "@/lib/wiring-identification/extract-ka-twin-ferrules";
import { extractKaRelayPluginJumperRows } from "@/lib/wiring-identification/extract-ka-relay-plugin-jumpers";
import { extractKtJumpers } from "@/lib/wiring-identification/extract-kt-jumpers";
import { extractFuJumpers } from "@/lib/wiring-identification/extract-fu-jumpers";
import { extractClips } from "@/lib/wiring-identification/extract-clips";
import { extractCables, isCableType } from "@/lib/wiring-identification/extract-cables";
import { extractSingleConnections } from "@/lib/wiring-identification/extract-single-connections";
import { isResistorRow } from "@/lib/wiring-identification/extract-resistors";
import {
  countNonDeviceChangeRows,
  filterEmptyDeviceChangeSections,
  isDeviceChangeRow,
  detectDeviceChange,
} from "@/lib/wiring-identification/device-change-pattern";
import {
  PrintFeedbackSection,
  PrintFeedbackHeader,
  PrintFeedbackGroup,
  PrintFeedbackSignoff,
  PrintFooter,
} from "@/components/wire-list/print-feedback";
import type { PrintFeedbackConfig, WireListFeedbackSection, WireListFeedbackFormValues, FeedbackQuestion } from "@/lib/wire-list-feedback/types";
import { DEFAULT_WIRE_LIST_FEEDBACK_SECTIONS, FEEDBACK_SECTION_QUESTIONS } from "@/lib/wire-list-feedback/types";
import { useMultiIdentityFilter, type MultiFilterEntry, type FilterGroup } from "@/hooks/use-multi-identity-filter";
import { useProjectLookups, useProjectPartNumbers } from "@/hooks/use-project-lookups";
import { useProjectContext } from "@/contexts/project-context";
import { useCurrentUser } from "@/hooks/use-session";
import { SWS_TYPE_REGISTRY, type SwsTypeId } from "@/lib/assignment/sws-detection";
import {
  buildRenderableSectionSubgroups,
  buildSubgroupStartMap,
  buildWireListRenderPlan,
  compileWireListSections,
  groupCompiledSectionsByLocation,
  shouldSwapForTargetPair,
  type WireListCompiledSectionKind,
  type WireListCompiledSubgroup,
  type WireListRenderPlanItem,
} from "@/lib/wire-list-sections";
import { SectionHeaderBlock, TableSubgroupHeaderRow } from "@/components/wire-list/sections";
import { WiringExecutionMode } from "@/components/wire-list/wiring-execution-mode";
import { DeviceProperty } from "@/components/device/device-property";
import { downloadWireListCSV } from "@/lib/workbook/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  loadBrandingEdits,
  saveBrandingEdits,
  type SheetBrandingEdits,
} from "@/lib/persistence/project-storage";
import { hasMechanicalRelayPartNumber } from "@/lib/wiring-identification/jumper-part-number";
import { getSheetDeviceSequence, parseBlueLabelSheet } from "@/lib/wiring-identification/blue-label-sequence";
import {
  createDefaultPrintSettings,
  createDefaultProjectInfo,
  type BrandingSortMode,
  type JumperSection,
  type PersonnelEntry,
  type PrintFormatMode,
} from "@/lib/wire-list-print/defaults";
import type { ProjectManifest } from "@/types/project-manifest";
import { estimateWireTime, formatEstTime, formatEstTimeLong, summarizeSectionTime } from "@/lib/wire-list-print/time-estimation";
import { hydrateSchemaForRender, type WireListPrintSchema } from "@/lib/wire-list-print/schema";
import {
  buildProcessedPrintLocationGroups,
  type BrandingPreviewRow,
  buildDefaultBrandingHiddenSections,
  buildDefaultStandardHiddenSections,
  resolveActiveHiddenSections,
  buildPrintPreviewPageCount,
  buildBrandingCsvContent,
} from "@/lib/wire-list-print/model";
import { SemanticWireList, type WireListFeatureConfig } from "./semantic-wire-list";
import {
  BrandingPreviewContent,
  CrossWirePreviewDocument,
  CrossWireWorkspacePreviewDocument,
  StandardPreviewBody,
  StandardWireListPreviewDocument,
  StandardWorkspacePreviewDocument,
  WireListPreviewEmptyState,
} from "./print-preview-blocks";
import { FromCheckboxCell } from "./cells/from-checkbox-cell";
import { ToCheckboxCell } from "./cells/to-checkbox-cell";
import { IPVCheckboxCell } from "./cells/ipv-checkbox-cell";
import { CommentsCell } from "./cells/comments-cell";
import { buildBrandingFilename } from "@/lib/project-exports/branding-filename";
import type {
  BrandingSelectionState,
  WireListPrintDocumentData,
} from "@/lib/wire-list-sheet-document/types";
import { buildWireListSheetWorkspaceDocument } from "@/lib/wire-list-sheet-document/build-sheet-document";

interface ProjectInfo {
  projectNumber: string;
  projectName: string;
  revision: string;
  pdNumber: string;
  unitNumber: string;
  preparedBy: string;
  badgeNumber: string;
  date: string;
  time: string;
  personnel: PersonnelEntry[];
}

interface PrintSubsection {
  label: string;
  rows: SemanticWireListRow[];
  sectionKind?: IdentificationFilterKind;
  matchMetadata?: Record<string, PatternMatchMetadata>;
  deviceToDeviceSubsections?: { label: string; rows: SemanticWireListRow[] }[];
}

function buildSingleConnectionTocSubsections(
  rows: SemanticWireListRow[],
  matchMetadata: Record<string, PatternMatchMetadata> = {},
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  skipSingletonMerge = false,
): { label: string; rows: SemanticWireListRow[] }[] {
  return buildTocSubsections("single_connections", rows, matchMetadata, partNumberMap, skipSingletonMerge);
}

function buildTocSubsections(
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
      const aFirstRow = a.rowIds.length > 0 ? rowsById.get(a.rowIds[0]) : undefined;
      const bFirstRow = b.rowIds.length > 0 ? rowsById.get(b.rowIds[0]) : undefined;
      const aPrefix = getDevicePrefixValue(aFirstRow ? getDisplayEndpoints(aFirstRow).fromDeviceId : undefined);
      const bPrefix = getDevicePrefixValue(bFirstRow ? getDisplayEndpoints(bFirstRow).fromDeviceId : undefined);
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

function PersonnelSignoffTable({
  personnel,
  className,
}: {
  personnel: PersonnelEntry[];
  className?: string;
}) {
  return (
    <div className={cn("border border-foreground/30 rounded-md overflow-hidden", className)}>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr className="border-b border-foreground/30 bg-muted/50">
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[9px] border-r border-foreground/20 w-28">Badge #</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[9px] border-r border-foreground/20 w-28">Date</th>
            <th className="px-3 py-2 text-left font-semibold uppercase tracking-wide text-[9px] border-r border-foreground/20 w-24">Time</th>
            <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-[9px] border-r border-foreground/20 w-24">Wirer</th>
            <th className="px-3 py-2 text-center font-semibold uppercase tracking-wide text-[9px] w-24">IPV</th>
          </tr>
        </thead>
        <tbody>
          {personnel.map((entry, index) => (
            <tr key={entry.id} className={index < personnel.length - 1 ? "border-b border-foreground/20" : ""}>
              <td className="px-3 py-3 font-mono border-r border-foreground/20">
                {entry.badgeNumber || <span className="text-foreground/30">_________</span>}
              </td>
              <td className="px-3 py-3 border-r border-foreground/20">
                {entry.date ? (
                  <span>{new Date(entry.date).toLocaleDateString()}</span>
                ) : (
                  <span className="text-foreground/30">__/__/____</span>
                )}
              </td>
              <td className="px-3 py-3 border-r border-foreground/20">
                {entry.time || <span className="text-foreground/30">__:__ __</span>}
              </td>
              <td className="px-3 py-3 text-center border-r border-foreground/20">
                <div className={`w-5 h-5 border-2 border-foreground/50 mx-auto flex items-center justify-center ${entry.isAssembler ? "bg-foreground" : "bg-transparent"}`}>
                  {entry.isAssembler && (
                    <svg className="w-3.5 h-3.5 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </td>
              <td className="px-3 py-3 text-center">
                <div className={`w-5 h-5 border-2 border-foreground/50 mx-auto flex items-center justify-center ${entry.isInspector ? "bg-foreground" : "bg-transparent"}`}>
                  {entry.isInspector && (
                    <svg className="w-3.5 h-3.5 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface PrintLocationGroup {
  location: string;
  isExternal: boolean;
  subsections: PrintSubsection[];
  totalRows: number;
}

interface PrintSection {
  label: string;
  rows: SemanticWireListRow[];
  description?: string;
  locationSubgroups?: { location: string; rows: SemanticWireListRow[] }[];
  sectionKind?: IdentificationFilterKind;
  primaryLocation?: string;
  isExternal?: boolean;
}

interface CustomQuestion {
  key: string;
  label: string;
  type: "boolean" | "text" | "number" | "difficulty" | "quality" | "improvement";
  enabled: boolean;
  sectionId: string;
  isCustom?: boolean;
}

interface SectionColumnVisibility {
  partNumber: boolean;
  description: boolean;
  wireNo: boolean;
  wireId: boolean;
  wireType: boolean;
  gaugeSize: boolean;
  fromLocation: boolean;
  toLocation: boolean;
  swapFromTo: boolean;
}

const DEFAULT_SECTION_COLUMNS: SectionColumnVisibility = {
  partNumber: false,
  description: false,
  wireNo: true,
  wireId: true,
  wireType: false,
  gaugeSize: true,
  fromLocation: true,
  toLocation: true,
  swapFromTo: false,
};

function getDefaultSectionColumns(sectionKind?: IdentificationFilterKind): SectionColumnVisibility {
  if (sectionKind === "cables") {
    return {
      ...DEFAULT_SECTION_COLUMNS,
      wireType: true,
      partNumber: false,
      description: false,
      wireNo: false,
    };
  }

  if (sectionKind === "clips" || sectionKind === "ka_relay_plugin_jumpers") {
    return {
      ...DEFAULT_SECTION_COLUMNS,
      wireNo: false,
      gaugeSize: false,
    };
  }

  return DEFAULT_SECTION_COLUMNS;
}

function getEffectiveSectionColumns(
  sectionColumnVisibility: Record<string, SectionColumnVisibility>,
  sectionLabel?: string,
  sectionKind?: IdentificationFilterKind,
): SectionColumnVisibility {
  if (sectionLabel && sectionColumnVisibility[sectionLabel]) {
    return sectionColumnVisibility[sectionLabel]!;
  }

  if (sectionKind && sectionColumnVisibility[sectionKind]) {
    return sectionColumnVisibility[sectionKind]!;
  }

  return getDefaultSectionColumns(sectionKind);
}

function getSectionColumnVisibilityKey(
  sectionLabel?: string,
  sectionKind?: IdentificationFilterKind,
): string {
  return sectionLabel || sectionKind || "default";
}

function getLocationLookupKeys(location: string | undefined): string[] {
  const raw = String(location ?? "").trim();
  if (!raw) return [];

  const keys = new Set<string>();
  keys.add(raw.toUpperCase());
  keys.add(normalizeDisplayTitle(raw).toUpperCase());
  keys.add(normalizeSheetName(raw).toUpperCase());
  keys.add(raw.toUpperCase().replace(/[\s,_-]+/g, " ").trim());

  return Array.from(keys).filter(Boolean);
}

function resolveLocationDisplayTitle(
  location: string | undefined,
  locationNormalizedTitleByName?: Record<string, string>,
  fallbackTitle?: string,
): string {
  for (const key of getLocationLookupKeys(location)) {
    const mapped = locationNormalizedTitleByName?.[key];
    if (mapped && mapped.trim()) {
      return normalizeDisplayTitle(mapped);
    }
  }

  if (location && location.trim()) {
    return normalizeDisplayTitle(location);
  }

  return fallbackTitle ? normalizeDisplayTitle(fallbackTitle) : "-";
}

function escapePrintPreviewCsvValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";

  const stringValue = String(value);
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/\"/g, '""')}"`;
  }

  return stringValue;
}

function createEmptyBrandingSelection(): BrandingSelectionState {
  return {
    selectedIds: new Set<string>(),
    lastSelectedId: null,
    allSelected: false,
  };
}

function formatBrandingMeasurement(value: number | undefined): string {
  if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
    return "-";
  }

  return value.toFixed(1);
}

function getBaseDeviceIdValue(deviceId: string | undefined): string {
  return deviceId?.split(":")[0]?.trim() || "";
}

function getDeviceTerminalValue(deviceId: string | undefined): string {
  return deviceId?.split(":")[1]?.trim().toUpperCase() || "";
}

function getDevicePrefixValue(deviceId: string | undefined): string {
  const baseDeviceId = getBaseDeviceIdValue(deviceId);
  const match = baseDeviceId.match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : baseDeviceId.toUpperCase() || "Unknown";
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

function buildBlueLabelRenderSubgroups(
  rows: SemanticWireListRow[],
  sectionSwapFromTo = false,
): WireListCompiledSubgroup[] {
  const groups = new Map<string, WireListCompiledSubgroup>();

  rows.forEach((row, index) => {
    const label = getBaseDeviceIdValue(getDisplayEndpoints(row, sectionSwapFromTo).fromDeviceId)
      || getBaseDeviceIdValue(getDisplayEndpoints(row, sectionSwapFromTo).toDeviceId)
      || "Unsequenced";
    const normalizedLabel = label.trim() || "Unsequenced";
    const key = normalizedLabel.toUpperCase();
    const existing = groups.get(key);

    if (existing) {
      existing.rowIds.push(row.__rowId);
      return;
    }

    groups.set(key, {
      id: `blue-label:${key}`,
      kind: "device_family",
      label: normalizedLabel,
      tone: "muted",
      rowIds: [row.__rowId],
      startRowId: row.__rowId,
      order: index,
    });
  });

  return Array.from(groups.values()).sort((left, right) => left.order - right.order);
}

function getDisplayEndpoints(row: SemanticWireListRow, sectionSwapFromTo = false): {
  fromDeviceId: string;
  toDeviceId: string;
  fromLocation: string;
  toLocation: string;
} {
  const autoSwap = shouldSwapForTargetPair(row.fromDeviceId, row.toDeviceId);
  // XOR: if both auto-swap and manual swap are true, they cancel out
  const shouldSwap = sectionSwapFromTo ? !autoSwap : autoSwap;
  const fromDeviceId = shouldSwap ? (row.toDeviceId || "") : (row.fromDeviceId || "");
  const toDeviceId = shouldSwap ? (row.fromDeviceId || "") : (row.toDeviceId || "");

  // Resolve raw locations — row.location is deprecated but may still be the only value
  const rawFromLocation = row.fromLocation || row.location || "";
  const rawToLocation = row.toLocation || "";

  const fromLocation = shouldSwap ? rawToLocation || rawFromLocation : rawFromLocation;
  const toLocation = shouldSwap ? rawFromLocation : rawToLocation || rawFromLocation;

  return { fromDeviceId, toDeviceId, fromLocation, toLocation };
}

function isPrintableConnectionRow(row: SemanticWireListRow): boolean {
  if (detectDeviceChange(row).isDeviceChange) {
    return false;
  }

  const wireNo = (row.wireNo || "").trim();
  const wireId = (row.wireId || "").trim();
  const gaugeSize = (row.gaugeSize || "").trim();
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

/**
 * Derive the TOC prefix group key from a subsection label.
 *
 * For ka_relay_plugin_jumpers labels like "A1: KA0131 → KA0141", the grouping
 * should be "KA:A1" (device prefix + terminal).  For all other section kinds
 * the standard device-prefix extraction is used.
 */
function getTocSubsectionPrefix(label: string, sectionKind?: IdentificationFilterKind): string {
  if (sectionKind === "ka_relay_plugin_jumpers") {
    // label format: "A1: KA0131 → KA0141" or "A2: KA0131 → KA0141"
    const terminalMatch = label.match(/^([A-Za-z0-9]+)\s*:/);
    if (terminalMatch) {
      // Extract device prefix from the first device after the colon
      const afterColon = label.slice(label.indexOf(":") + 1).trim();
      const devicePrefix = getDevicePrefixValue(afterColon.split(/\s/)[0]);
      return `${devicePrefix}:${terminalMatch[1].toUpperCase()}`;
    }
  }
  return getDevicePrefixValue(label.split(" ")[0]);
}

function normalizeReferenceLookupKey(value: string | undefined): string {
  return value
    ?.trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .split(":")[0]
    .trim() || "";
}

function lookupReferenceEntry(
  lookupMap: Map<string, PartNumberLookupResult | CablePartNumberLookupResult> | null | undefined,
  lookupKey: string | undefined,
): PartNumberLookupResult | CablePartNumberLookupResult | undefined {
  const normalizedLookupKey = normalizeReferenceLookupKey(lookupKey);
  if (!normalizedLookupKey) {
    return undefined;
  }

  return lookupMap?.get(normalizedLookupKey);
}

function getPrintPreviewReferences(
  row: SemanticWireListRow,
  isCablesSection: boolean,
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  cablePartNumberMap?: Map<string, CablePartNumberLookupResult> | null,
  swapFromTo = false,
) {
  if (isCablesSection) {
    const cableReference = lookupReferenceEntry(cablePartNumberMap, row.wireType);
    return {
      fromReference: cableReference,
      toReference: cableReference,
    };
  }

  const { fromDeviceId, toDeviceId } = getDisplayEndpoints(row, swapFromTo);

  return {
    fromReference: lookupReferenceEntry(partNumberMap, fromDeviceId),
    toReference: lookupReferenceEntry(partNumberMap, toDeviceId),
  };
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

function createBrandingEditDraft(
  existingEdit: SheetBrandingEdits[string] | undefined,
  row: SemanticWireListRow,
  length: number | undefined,
): SheetBrandingEdits[string] | null {
  const nextEdit = {
    ...existingEdit,
    wireNo: existingEdit?.wireNo ?? row.wireNo ?? "",
    length,
    lengthAdjustment: undefined,
  };

  if (
    typeof nextEdit.length !== "number" &&
    typeof nextEdit.lengthAdjustment !== "number" &&
    !nextEdit.excluded &&
    !nextEdit.notes
  ) {
    return null;
  }

  return nextEdit;
}


function buildBrandingSectionRenderPlan(
  rows: SemanticWireListRow[],
  currentSheetName: string,
  sectionKind?: IdentificationFilterKind,
  matchMetadata: Record<string, PatternMatchMetadata> = {},
  partNumberMap?: Map<string, PartNumberLookupResult> | null,
  brandingSortMode: BrandingSortMode = "default",
) {
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
  const effectiveSubgroups = !sectionKind
    ? []
    : buildRenderableSectionSubgroups(sectionKind, orderedRows, matchMetadata, partNumberMap, brandingSortMode !== "default");

  // For single_connections branding, sort subgroups by device prefix (and optionally part number)
  if (sectionKind === "single_connections" && brandingSortMode !== "default" && effectiveSubgroups.length > 0) {
    const rowsById = new Map(orderedRows.map((row) => [row.__rowId, row]));

    effectiveSubgroups.sort((a, b) => {
      // Prioritize target device pair groups (SB, HL, SA)
      const aIsTarget = a.id.startsWith("single-target-pair:");
      const bIsTarget = b.id.startsWith("single-target-pair:");
      if (aIsTarget !== bIsTarget) {
        return aIsTarget ? -1 : 1;
      }

      const aFirstRow = a.rowIds.length > 0 ? rowsById.get(a.rowIds[0]) : undefined;
      const bFirstRow = b.rowIds.length > 0 ? rowsById.get(b.rowIds[0]) : undefined;
      const aDisplayFrom = aFirstRow ? getDisplayEndpoints(aFirstRow).fromDeviceId : undefined;
      const bDisplayFrom = bFirstRow ? getDisplayEndpoints(bFirstRow).fromDeviceId : undefined;

      // For target groups, derive prefix from the subgroup label (device base)
      const aEffectivePrefix = aIsTarget ? getDevicePrefixValue(a.label) : getDevicePrefixValue(aDisplayFrom);
      const bEffectivePrefix = bIsTarget ? getDevicePrefixValue(b.label) : getDevicePrefixValue(bDisplayFrom);

      // 1) Sort by device prefix
      const prefixCompare = aEffectivePrefix.localeCompare(bEffectivePrefix, undefined, { numeric: true });
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

  // Reorder rows so subgroup members are contiguous
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
  if (sectionKind === "single_connections" && brandingSortMode !== "default" && plan.length > 0) {
    const rowsById = new Map(reorderedRows.map((row) => [row.__rowId, row]));
    const enriched: WireListRenderPlanItem[] = [];
    let lastPrefix = "";

    for (const item of plan) {
      if (item.type === "group-header" && item.group.groupKind === "subgroup") {
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

function sortRowsForDeviceGroupedPreview(
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
    const location = getLocation(row).toUpperCase();
    const fromBase = getBaseDeviceId(row).toUpperCase();
    const toBase = getBaseDeviceIdValue(getDisplayToDeviceId(row)).toUpperCase();
    const fromPrefix = getFromDeviceGroup(row);
    const toPrefix = getToDeviceGroup(row);
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

  const getSingleConnectionGroupMeta = (row: SemanticWireListRow) => {
    const location = getLocation(row).toUpperCase();
    const fromBase = getBaseDeviceId(row).toUpperCase();
    const toBase = (row.toDeviceId?.split(":")[0]?.trim() || "").toUpperCase();
    const fromPrefix = getFromDeviceGroup(row);
    const toPrefix = getToDeviceGroup(row);
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

  const compareGauge = (left: SemanticWireListRow, right: SemanticWireListRow) => {
    const leftGauge = parseGaugeNumeric(left.gaugeSize || "");
    const rightGauge = parseGaugeNumeric(right.gaugeSize || "");

    if (leftGauge !== null && rightGauge !== null && leftGauge !== rightGauge) {
      return rightGauge - leftGauge;
    }

    if (leftGauge !== null && rightGauge === null) return -1;
    if (leftGauge === null && rightGauge !== null) return 1;

    return (left.gaugeSize || "").localeCompare(right.gaugeSize || "");
  };

  return indexedRows
    .sort((left, right) => {
      const leftLocation = getLocation(left.row);
      const rightLocation = getLocation(right.row);
      const leftMatchesSheet = normalizedSheetName ? leftLocation.toUpperCase().includes(normalizedSheetName) : false;
      const rightMatchesSheet = normalizedSheetName ? rightLocation.toUpperCase().includes(normalizedSheetName) : false;

      if (leftMatchesSheet !== rightMatchesSheet) {
        return leftMatchesSheet ? -1 : 1;
      }

      const locationCompare = leftLocation.localeCompare(rightLocation);
      if (locationCompare !== 0) {
        return locationCompare;
      }

      // For AF rows on the same base device, enforce terminal ordering high -> low
      // before subgroup/category logic can shuffle the sequence.
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

      if (isCablesSection) {
        const cableTypeCompare = (left.row.wireType || "").localeCompare(right.row.wireType || "");
        if (cableTypeCompare !== 0) {
          return cableTypeCompare;
        }
      }

      if (!isCablesSection) {
        const leftMeta = getSingleConnectionGroupMeta(left.row);
        const rightMeta = getSingleConnectionGroupMeta(right.row);

        if (leftMeta.category !== rightMeta.category) {
          return leftMeta.category - rightMeta.category;
        }

        const primaryCompare = leftMeta.primary.localeCompare(rightMeta.primary, undefined, { numeric: true });
        if (primaryCompare !== 0) {
          return primaryCompare;
        }

        const secondaryCompare = leftMeta.secondary.localeCompare(rightMeta.secondary, undefined, { numeric: true });
        if (secondaryCompare !== 0) {
          return secondaryCompare;
        }

        const tertiaryCompare = leftMeta.tertiary.localeCompare(rightMeta.tertiary, undefined, { numeric: true });
        if (tertiaryCompare !== 0) {
          return tertiaryCompare;
        }

        const quaternaryCompare = leftMeta.quaternary.localeCompare(rightMeta.quaternary, undefined, { numeric: true });
        if (quaternaryCompare !== 0) {
          return quaternaryCompare;
        }
      }

      const fromDeviceGroupCompare = getFromDeviceGroup(left.row).localeCompare(getFromDeviceGroup(right.row), undefined, { numeric: true });
      if (fromDeviceGroupCompare !== 0) {
        return fromDeviceGroupCompare;
      }

      const toDeviceGroupCompare = getToDeviceGroup(left.row).localeCompare(getToDeviceGroup(right.row), undefined, { numeric: true });
      if (toDeviceGroupCompare !== 0) {
        return toDeviceGroupCompare;
      }

      const deviceCompare = leftBaseDevice.localeCompare(rightBaseDevice);
      if (deviceCompare !== 0) {
        return deviceCompare;
      }

      if (sectionKind === "clips") {
        const clipTerminalCompare = compareClipRowsByTerminal(left.row, right.row, partNumberMap);
        if (clipTerminalCompare !== 0) {
          return clipTerminalCompare;
        }
      }

      const gaugeCompare = compareGauge(left.row, right.row);
      if (gaugeCompare !== 0) {
        return gaugeCompare;
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

      const fullDeviceCompare = getDisplayFromDeviceId(left.row).localeCompare(getDisplayFromDeviceId(right.row));
      if (fullDeviceCompare !== 0) {
        return fullDeviceCompare;
      }

      const wireNoCompare = (left.row.wireNo || "").localeCompare(right.row.wireNo || "");
      if (wireNoCompare !== 0) {
        return wireNoCompare;
      }

      return left.index - right.index;
    })
    .map(({ row }) => row);
}

function locationMatchesCurrentSheet(location: string, currentSheetName: string): boolean {
  if (!location || !currentSheetName) {
    return false;
  }

  return location.toUpperCase().includes(currentSheetName.toUpperCase());
}

function sortRowsForPrintSubsection(
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
    return [...rows].sort((left, right) => {
      const leftGroupKey = String(matchMetadata[left.__rowId]?.meta.groupKey ?? "");
      const rightGroupKey = String(matchMetadata[right.__rowId]?.meta.groupKey ?? "");

      if (leftGroupKey !== rightGroupKey) {
        return leftGroupKey.localeCompare(rightGroupKey);
      }

      const leftDestination = left.toDeviceId.toUpperCase().trim();
      const rightDestination = right.toDeviceId.toUpperCase().trim();
      const destinationCompare = leftDestination.localeCompare(rightDestination);
      if (destinationCompare !== 0) {
        return destinationCompare;
      }

      return left.__rowIndex - right.__rowIndex;
    });
  }

  if (sectionKind === "resistors") {
    return [...rows].sort((left, right) => {
      const leftLocation = left.toLocation || left.fromLocation || left.location || "";
      const rightLocation = right.toLocation || right.fromLocation || right.location || "";
      const leftMatchesCurrentSheet = locationMatchesCurrentSheet(leftLocation, currentSheetName);
      const rightMatchesCurrentSheet = locationMatchesCurrentSheet(rightLocation, currentSheetName);

      if (leftMatchesCurrentSheet !== rightMatchesCurrentSheet) {
        return leftMatchesCurrentSheet ? -1 : 1;
      }

      const locationCompare = leftLocation.localeCompare(rightLocation);
      if (locationCompare !== 0) {
        return locationCompare;
      }

      const leftRunOrder = Number(matchMetadata[left.__rowId]?.meta.runOrder ?? Number.MAX_SAFE_INTEGER);
      const rightRunOrder = Number(matchMetadata[right.__rowId]?.meta.runOrder ?? Number.MAX_SAFE_INTEGER);
      if (leftRunOrder !== rightRunOrder) {
        return leftRunOrder - rightRunOrder;
      }

      const leftRowOrder = Number(matchMetadata[left.__rowId]?.meta.rowOrder ?? left.__rowIndex);
      const rightRowOrder = Number(matchMetadata[right.__rowId]?.meta.rowOrder ?? right.__rowIndex);
      if (leftRowOrder !== rightRowOrder) {
        return leftRowOrder - rightRowOrder;
      }

      return left.__rowIndex - right.__rowIndex;
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

  if (sectionKind === "single_connections") {
    return [...rows].sort((left, right) => {
      const leftRunOrder = Number(matchMetadata[left.__rowId]?.meta.runOrder ?? Number.MAX_SAFE_INTEGER);
      const rightRunOrder = Number(matchMetadata[right.__rowId]?.meta.runOrder ?? Number.MAX_SAFE_INTEGER);
      if (leftRunOrder !== rightRunOrder) {
        return leftRunOrder - rightRunOrder;
      }

      const leftRowOrder = Number(matchMetadata[left.__rowId]?.meta.rowOrder ?? left.__rowIndex);
      const rightRowOrder = Number(matchMetadata[right.__rowId]?.meta.rowOrder ?? right.__rowIndex);
      if (leftRowOrder !== rightRowOrder) {
        return leftRowOrder - rightRowOrder;
      }

      const leftGauge = parseGaugeNumeric(left.gaugeSize);
      const rightGauge = parseGaugeNumeric(right.gaugeSize);
      const leftHasGauge = Number.isFinite(leftGauge);
      const rightHasGauge = Number.isFinite(rightGauge);

      if (leftHasGauge && rightHasGauge && leftGauge !== rightGauge) {
        return leftGauge - rightGauge;
      }

      if (leftHasGauge !== rightHasGauge) {
        return leftHasGauge ? -1 : 1;
      }

      return left.__rowIndex - right.__rowIndex;
    });
  }

  return sortRowsByGaugeSize([...rows], "smallest-first");
}

function shouldPreservePrintSubsectionOrder(sectionKind?: IdentificationFilterKind): boolean {
  return Boolean(sectionKind && [
    "cables",
    "vio_jumpers",
    "resistors",
    "fu_jumpers",
    "ka_jumpers",
    "kt_jumpers",
    "ka_twin_ferrules",
    "ka_relay_plugin_jumpers",
  ].includes(sectionKind));
}

interface PrintSettings {
  mode: PrintFormatMode;
  // Sections to include, in order (always sorted smallest-to-largest, same-location-first by default)
  enabledSections: JumperSection[];
  sectionOrder: JumperSection[];
  customSettings: {
    sortByGauge: "none" | "smallest-first" | "largest-first";
    groupByLocation: boolean;
    includeGrounds: boolean;
    includeJumpers: boolean;
    includeClips: boolean;
  };
  showFromCheckbox: boolean;
  showToCheckbox: boolean;
  showIPV: boolean;
  showComments: boolean;
  showLength: boolean; // Hidden by default for print
  showEstTime: boolean; // Est. Time columns for FROM and TO
  showDeviceSubheaders: boolean;
  enableBlueDeviceIDColumns: boolean;
  // Cover page settings
  showCoverPage: boolean;
  coverImageUrl?: string; // Optional sheet cover image URL
  // Table of Contents settings
  showTableOfContents: boolean;
  // IPV Codes Reference section
  showIPVCodes: boolean;
  // Feedback section settings
  showFeedbackSection: boolean;
  feedbackRenderMode: "PREFILLED" | "BLANK";
  feedbackSections: WireListFeedbackSection[];
  // Custom question configurations - keyed by question.key
  customQuestions: Record<string, CustomQuestion>;
  // Per-section column visibility settings
  sectionColumnVisibility: Record<string, SectionColumnVisibility>;
  // Hidden sections/subsections - keys are location group index + subsection label
  standardHiddenSections: Set<string>;
  standardHiddenSectionsCustomized: boolean;
  brandingHiddenSections: Set<string>;
  brandingHiddenSectionsCustomized: boolean;
  // Individual hidden rows
  hiddenRows: Set<string>;
  // Cross-wire sections
  crossWireSections: Set<string>;
  brandingSortMode: BrandingSortMode;
  wireListSortMode: BrandingSortMode;
}

interface PrintModalProps {
  rows: SemanticWireListRow[];
  blueLabels?: BlueLabelSequenceMap | null;
  currentSheetName?: string;
  projectId?: string;
  sheetSlug?: string;
  sheetTitle?: string;
  metadata?: {
    projectNumber?: string;
    projectName?: string;
    revision?: string;
    pdNumber?: string;
    unitNumber?: string;
    controlsDE?: string;
  };
  getRowLength?: (rowId: string) => { display: string; roundedInches: number; confidence: string } | null;
  /** SWS type for the assignment (Panel, Box, etc.) */
  swsType?: {
    id: string;
    label: string;
    shortLabel: string;
    color?: string;
  };
}

export interface SingleSheetPrintWorkspaceProps extends PrintModalProps {
  workspaceActive?: boolean;
  onRequestClose?: () => void;
  headerTitle?: string;
  hideCloseButton?: boolean;
  extraHeaderActions?: ReactNode;
  initialLoadedSchema?: WireListPrintSchema | null;
  initialMode?: PrintFormatMode;
  reviewModeCompact?: boolean;
  reviewModeShowSettings?: boolean;
}

export type { WireListPrintDocumentData } from "@/lib/wire-list-sheet-document/types";

/** Map SWS color names to compact Tailwind badge classes */
function getSwsBadgeColorClass(color?: string): string {
  const map: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700 border-slate-300',
    cyan: 'bg-cyan-100 text-cyan-700 border-cyan-300',
    amber: 'bg-amber-100 text-amber-700 border-amber-300',
    indigo: 'bg-indigo-100 text-indigo-700 border-indigo-300',
    teal: 'bg-teal-100 text-teal-700 border-teal-300',
    orange: 'bg-orange-100 text-orange-700 border-orange-300',
  };
  return map[color || ''] || 'bg-muted text-muted-foreground border-border';
}

const PRINT_PAGE_WIDTH = 800;
const PRINT_PAGE_MIN_HEIGHT = 1120;
const PRINT_PAGE_FOOTER_TEXT = "Caterpillar: Confidential Green";

export function WireListPrintDocument({
  data,
  onCommentChange,
  onToggleBrandingSelection,
  onSelectBrandingRows,
  onClearBrandingSelection,
  onUpdateBrandingMeasurement,
  onAdjustBrandingMeasurement,
  onResetBrandingMeasurement,
}: {
  data: WireListPrintDocumentData;
  onCommentChange?: (rowId: string, value: string) => void;
  onToggleBrandingSelection?: (rowId: string, shiftKey: boolean) => void;
  onSelectBrandingRows?: (rowIds: string[]) => void;
  onClearBrandingSelection?: (rowIds?: string[]) => void;
  onUpdateBrandingMeasurement?: (rowId: string, value: number) => void;
  onAdjustBrandingMeasurement?: (rowId: string, delta: number) => void;
  onResetBrandingMeasurement?: (rowId: string) => void;
}) {
  const partNumberMap = useMemo(
    () => new Map(data.partNumberEntries ?? []),
    [data.partNumberEntries],
  );
  const cablePartNumberMap = useMemo(
    () => new Map(data.cablePartNumberEntries ?? []),
    [data.cablePartNumberEntries],
  );
  const activeHiddenSections = useMemo(
    () => new Set(data.hiddenSectionKeys ?? []),
    [data.hiddenSectionKeys],
  );
  const comments = data.comments ?? {};
  const brandingVisibleSections = data.sheetDocument?.brandingSections ?? data.brandingVisibleSections ?? [];
  const standardVisibleSections = data.sheetDocument?.wireListSections ?? data.sheetDocument?.standardSections ?? data.standardVisibleSections ?? [];
  const brandingSelection = data.brandingSelection ?? createEmptyBrandingSelection();
  const getRowLength = useCallback(
    (rowId: string) => data.rowLengthsById?.[rowId] ?? null,
    [data.rowLengthsById],
  );
  const handleCommentChange = onCommentChange ?? (() => { });
  const handleToggleBrandingSelection = onToggleBrandingSelection ?? (() => { });
  const handleSelectBrandingRows = onSelectBrandingRows ?? (() => { });
  const handleClearBrandingSelection = onClearBrandingSelection ?? (() => { });
  const handleUpdateBrandingMeasurement = onUpdateBrandingMeasurement ?? (() => { });
  const handleAdjustBrandingMeasurement = onAdjustBrandingMeasurement ?? (() => { });
  const handleResetBrandingMeasurement = onResetBrandingMeasurement ?? (() => { });

  if (data.settings.mode === "branding") {
    const brandingRowCount = brandingVisibleSections.reduce((sum, s) => sum + s.rows.length, 0);
    return (
      <PrintPage
        className="shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
        pageNumber={1}
        totalPages={1}
      >
        <ProjectInfoHeader
          projectInfo={data.projectInfo}
          sheetTitle={`${data.sheetTitle} - Branding`}
          totalRows={brandingRowCount}
          pageNumber={1}
          totalPages={1}
        />
        <BrandingPreviewContent
          sections={brandingVisibleSections}
          renderSection={({ group, subsection, rows }) => (
            <BrandingPreviewTable
              rows={rows}
              currentSheetName={data.currentSheetName}
              location={group.location}
              sectionLabel={subsection.label}
              sectionKind={subsection.sectionKind}
              sectionColumnVisibility={data.settings.sectionColumnVisibility}
              partNumberMap={partNumberMap}
              matchMetadata={subsection.matchMetadata}
              brandingSortMode={data.settings.brandingSortMode}
              selection={brandingSelection}
              onToggleSelection={handleToggleBrandingSelection}
              onSelectAll={handleSelectBrandingRows}
              onClearSelection={handleClearBrandingSelection}
              onUpdateMeasurement={handleUpdateBrandingMeasurement}
              onAdjustMeasurement={handleAdjustBrandingMeasurement}
              onResetMeasurement={handleResetBrandingMeasurement}
            />
          )}
        />
      </PrintPage>
    );
  }

  return (
    <>
      {data.settings.showCoverPage && (
        <CoverPage
          projectInfo={data.projectInfo}
          sheetTitle={data.sheetTitle}
          currentSheetName={data.currentSheetName}
          coverImageUrl={data.settings.coverImageUrl}
          swsType={data.swsType}
          coverSubtitle={data.currentSheetName}
          pageNumber={1}
          totalPages={data.previewPageCount}
        />
      )}

      {data.settings.showTableOfContents && data.processedLocationGroups.length > 0 && (
        <TableOfContentsPage
          locationGroups={data.processedLocationGroups}
          showFeedbackSection={data.settings.showFeedbackSection}
          showCoverPage={data.settings.showCoverPage}
          showTableOfContents={data.settings.showTableOfContents}
          showIPVCodes={data.settings.showIPVCodes}
          totalPages={data.previewPageCount}
          currentSheetName={data.currentSheetName}
          hiddenSections={activeHiddenSections}
          crossWireSections={new Set(data.crossWireSectionKeys ?? [])}
          wireListSortMode={data.settings.wireListSortMode}
        />
      )}

      {data.settings.showIPVCodes && (
        <IPVCodesPage
          pageNumber={(data.settings.showCoverPage ? 1 : 0) + (data.settings.showTableOfContents ? 1 : 0) + 1}
          totalPages={data.previewPageCount}
        />
      )}

      <StandardWireListPreviewDocument
        visibleSections={standardVisibleSections}
        renderPage={(content) => (
          <PrintPage
            className="shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
            pageNumber={(data.settings.showCoverPage ? 1 : 0) + (data.settings.showTableOfContents ? 1 : 0) + (data.settings.showIPVCodes ? 1 : 0) + 1}
            totalPages={data.previewPageCount}
          >
            <ProjectInfoHeader
              projectInfo={data.projectInfo}
              sheetTitle={data.sheetTitle}
              totalRows={data.processedLocationGroups.reduce((sum, group) => sum + group.totalRows, 0)}
              pageNumber={(data.settings.showCoverPage ? 1 : 0) + (data.settings.showTableOfContents ? 1 : 0) + (data.settings.showIPVCodes ? 1 : 0) + 1}
              totalPages={data.previewPageCount}
            />
            {content}
          </PrintPage>
        )}
        renderSection={({ group, subsection, visibleRows }) => (
          <div className="rounded-sm w-full">
            <PrintPreviewTable
              rows={visibleRows}
              settings={data.settings}
              currentSheetName={data.currentSheetName}
              comments={comments}
              onCommentChange={handleCommentChange}
              sectionKind={subsection.sectionKind}
              sectionLabel={subsection.label}
              matchMetadata={subsection.matchMetadata}
              partNumberMap={partNumberMap}
              cablePartNumberMap={cablePartNumberMap}
              getRowLength={getRowLength}
              locationNormalizedTitleByName={data.locationNormalizedTitleByName}
              isExternal={group.isExternal}
            />
          </div>
        )}
        renderEmptyState={() => (
          <WireListPreviewEmptyState
            title="No rows to display"
            description="Adjust your filter settings or switch to Standardize mode"
          />
        )}
      />

      {data.includeFeedbackPage && data.settings.showFeedbackSection && (
        <PrintPage
          className="feedback-page shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
          pageNumber={data.previewPageCount}
          totalPages={data.previewPageCount}
        >
          <div className="pt-4">
            <PrintFeedbackSection
              config={{
                showFeedbackSection: data.settings.showFeedbackSection,
                feedbackSections: data.settings.feedbackSections,
                feedbackRenderMode: data.settings.feedbackRenderMode,
                feedbackValues: {
                  projectName: data.projectInfo.projectName,
                  pdNumber: data.projectInfo.pdNumber,
                  sheetName: data.currentSheetName,
                  revision: data.projectInfo.revision,
                },
                customQuestions: data.settings.customQuestions,
              }}
              sheetName={data.currentSheetName}
              projectName={data.projectInfo.projectName}
              withLeadingPageBreak={false}
            />
          </div>
        </PrintPage>
      )}
    </>
  );
}

function PrintPage({
  children,
  className = "",
  footerText = PRINT_PAGE_FOOTER_TEXT,
  pageNumber,
  totalPages,
}: {
  children: ReactNode;
  className?: string;
  footerText?: string;
  pageNumber?: number;
  totalPages?: number;
}) {
  return (
    <section className={["print-page mx-auto print:w-full border border-black/10 bg-white shadow-md print:shadow-none print:border-0 print:mx-0", className].join(" ")}>
      <div
        className="print-page__inner flex w-full min-h-[1120px] flex-col px-5 py-5 print:w-full print:!min-h-0 print:px-4"
        style={{ minWidth: `${PRINT_PAGE_WIDTH}px`, minHeight: `${PRINT_PAGE_MIN_HEIGHT}px` }}
      >
        <div className="print-page__content flex-1 pb-4">{children}</div>
        <div className="print-footer flex items-center justify-between text-[10px] text-muted-foreground border-t border-foreground/20 pt-3 mt-4">
          <span>{footerText}</span>
          <span className="font-medium text-muted-foreground">
            {pageNumber && totalPages ? `Page ${pageNumber} of ${totalPages}` : ""}
          </span>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Cover Page Component
// ============================================================================

function CoverPage({
  projectInfo,
  sheetTitle,
  currentSheetName,
  coverImageUrl,
  swsType,
  coverSubtitle,
  pageNumber = 1,
  totalPages = 1,
}: {
  projectInfo: ProjectInfo;
  sheetTitle: string;
  currentSheetName: string;
  coverImageUrl?: string;
  swsType?: { id: string; label: string; shortLabel: string; color?: string };
  coverSubtitle?: string;
  pageNumber?: number;
  totalPages?: number;
}) {

  return (
    <PrintPage className="print-cover-page shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]" pageNumber={pageNumber} totalPages={totalPages}>
      <div className="flex flex-col items-center py-12 px-4 w-full">
        {/* Logo - Centered */}
        <div className="mb-6 flex justify-center w-full">
          <img
            src="/SolarTurbines-Light.svg"
            alt="Solar Turbines"
            className="h-20 w-auto"
          />
        </div>

        {/* Cover Image (if provided) - Centered */}
        {coverImageUrl && (
          <div className="mb-10 max-w-[450px] w-full flex justify-center">
            <img
              src={coverImageUrl}
              alt="Sheet Layout"
              className="w-full h-auto rounded-lg border border-border/50 shadow-sm"
            />
          </div>
        )}

        {/* Title Block - Centered */}
        <div className="space-y-3 mb-6 text-center">

          <h2 className="text-2xl font-semibold text-foreground/80">
            {sheetTitle || currentSheetName}
          </h2>
        
          {/* SWS Type Badge */}
          {swsType && swsType.id !== 'UNDECIDED' && (
            <div className="pt-2">
              <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold border`}>
                SWS: {swsType.label}
              </span>
            </div>
          )}
        </div>

        {/* Project Information - Centered */}
        <div className="border border-border  rounded-lg p-8 bg-muted/10 w-full flex-col flex justify-center max-w-[450px] space-y-4">
          {projectInfo.pdNumber && (
            <div className="flex justify-between items-center border-b border-border/30 pb-3">
              <span className="text-sm font-medium text-muted-foreground">PD/Unit Number:</span>
              <span className="text-sm font-semibold">{projectInfo.pdNumber}{projectInfo.unitNumber ? ` / ${projectInfo.unitNumber}` : ""}</span>
            </div>
          )}
          {projectInfo.projectName && (
            <div className="flex justify-between items-center border-b border-border/30 pb-3">
              <span className="text-sm font-medium text-muted-foreground">Project Name:</span>
              <span className="text-sm font-semibold">{projectInfo.projectName}</span>
            </div>
          )}
          <div className="flex justify-between items-center border-b border-border/30 pb-3">
            <span className="text-sm font-medium text-muted-foreground">Sheet Name:</span>
            <span className="text-sm font-semibold">{currentSheetName}</span>
          </div>
          {/* SWS Type row */}
          {swsType && swsType.id !== 'UNDECIDED' && (
            <div className="flex justify-between items-center border-b border-border/30 pb-3">
              <span className="text-sm font-medium text-muted-foreground">SWS Type:</span>
              <span className="text-sm font-semibold">{swsType.label}</span>
            </div>
          )}
          {projectInfo.revision && (
            <div className="flex justify-between items-center border-b border-border/30 pb-3">
              <span className="text-sm font-medium text-muted-foreground">Revision:</span>
              <span className="text-sm font-semibold">{projectInfo.revision}</span>
            </div>
          )}
          {projectInfo.date && (
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-muted-foreground">Date:</span>
              <span className="text-sm font-semibold">{projectInfo.date}</span>
            </div>
          )}
        </div>

        {/* Spacer to push personnel table toward bottom */}
        <div className="flex-1" />

        <div className="mt-5 w-full flex-col flex justify-center self-stretch">
          <div className="mb-2 text-left text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
            PERSONNEL / SWS SIGN-IN
          </div>
          <PersonnelSignoffTable personnel={projectInfo.personnel} />
        </div>
      </div>
    </PrintPage>
  );
}

// ============================================================================
// Table of Contents Component
// ============================================================================

function TableOfContentsPage({
  locationGroups,
  showFeedbackSection,
  showCoverPage,
  showTableOfContents,
  showIPVCodes = false,
  showEstTime = false,
  totalPages = 1,
  currentSheetName = "",
  hiddenSections = new Set<string>(),
  crossWireSections = new Set<string>(),
  wireListSortMode = "default",
}: {
  locationGroups: PrintLocationGroup[];
  showFeedbackSection: boolean;
  showCoverPage: boolean;
  showTableOfContents: boolean;
  showIPVCodes?: boolean;
  showEstTime?: boolean;
  totalPages?: number;
  currentSheetName?: string;
  hiddenSections?: Set<string>;
  crossWireSections?: Set<string>;
  wireListSortMode?: BrandingSortMode;
}) {
  // Page offset: Cover (if enabled) + TOC (if enabled) + IPV Codes (if enabled)
  const pageOffset = (showCoverPage ? 1 : 0) + (showTableOfContents ? 1 : 0) + (showIPVCodes ? 1 : 0);

  // Estimate page numbers based on row count (~30 rows per page)
  let runningRowCount = 0;
  const getEstimatedPage = (additionalRows: number) => {
    const page = pageOffset + 1 + Math.floor(runningRowCount / 30);
    runningRowCount += additionalRows;
    return page;
  };

  // TOC is always page 2 when cover is shown, page 1 otherwise
  const tocPageNumber = showCoverPage ? 2 : 1;

  // Calculate totals (accounting for hidden sections)
  let visibleLocationCount = 0;
  let visibleSubsectionCount = 0;
  let visibleRowCount = 0;
  let visibleTotalTime = 0;

  locationGroups.forEach((group, groupIndex) => {
    const locationKey = `loc-${groupIndex}`;
    if (hiddenSections.has(locationKey)) return;
    // Skip cross-wire sections — they have their own TOC
    if (crossWireSections.has(locationKey)) return;

    const visibleSubs = group.subsections.filter((sub, subIndex) => {
      const sectionKey = `${groupIndex}-${subIndex}`;
      return !hiddenSections.has(sectionKey);
    });

    if (visibleSubs.length > 0) {
      visibleLocationCount++;
      visibleSubsectionCount += visibleSubs.reduce(
        (sum, subsection) => sum + 1 + (subsection.deviceToDeviceSubsections?.length ?? 0),
        0,
      );
      visibleRowCount += visibleSubs.reduce(
        (sum, sub) => sum + sub.rows.filter(isPrintableConnectionRow).length,
        0,
      );
      if (showEstTime) {
        for (const sub of visibleSubs) {
          const printable = sub.rows.filter(isPrintableConnectionRow);
          if (printable.length > 0) {
            visibleTotalTime += summarizeSectionTime(printable, sub.sectionKind).grandTotal;
          }
        }
      }
    }
  });

  return (
    <PrintPage className="print-toc-page shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]" pageNumber={tocPageNumber} totalPages={totalPages}>
      <div className="py-4 w-full">
        {/* Logo */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <h1 className="text-lg font-bold text-foreground">Table of Contents</h1>
          <img
            src="/SolarTurbines-Light.svg"
            alt="Solar Turbines"
            className="h-6 w-auto"
          />
        </div>

        {/* TOC Table */}
        <table className="w-full text-[10px] border-collapse rounded-sm overflow-hidden border border-border/30">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left py-1 px-1.5 font-semibold w-6">#</th>
              <th className="text-left py-1 px-1.5 font-semibold">Section</th>
              <th className="text-right py-1 px-1.5 font-semibold w-12">Rows</th>
              {showEstTime && (
                <th className="text-right py-1 px-1.5 font-semibold w-14">Est. Time</th>
              )}
              <th className="text-right py-1 px-1.5 font-semibold w-10">Page</th>
            </tr>
          </thead>
          <tbody>
            {/* IPV Codes Reference row */}
            {showIPVCodes && (
              <tr className="bg-muted/20 border-b border-border/20">
                <td className="py-1 px-1.5 text-muted-foreground">-</td>
                <td className="py-1 px-1.5 font-medium">IPV Discrepancy Codes Reference</td>
                <td className="py-1 px-1.5 text-right text-muted-foreground">-</td>
                {showEstTime && <td className="py-1 px-1.5 text-right text-muted-foreground">-</td>}
                <td className="py-1 px-1.5 text-right text-muted-foreground">{(showCoverPage ? 1 : 0) + (showTableOfContents ? 1 : 0) + 1}</td>
              </tr>
            )}

            {locationGroups.map((group, groupIndex) => {
              // Skip hidden location groups
              const locationKey = `loc-${groupIndex}`;
              if (hiddenSections.has(locationKey)) return null;
              // Skip cross-wire sections — they have their own TOC
              if (crossWireSections.has(locationKey)) return null;

              // Filter out hidden subsections
              const visibleSubsections = group.subsections.filter((_, subIndex) => {
                const sectionKey = `${groupIndex}-${subIndex}`;
                return !hiddenSections.has(sectionKey);
              });

              // Skip if no visible subsections
              if (visibleSubsections.length === 0) return null;

              let sectionCounter = 0;
              return (
                <React.Fragment key={groupIndex}>
                  {/* Location Group Header */}
                  <tr className="bg-muted/20">
                    <td colSpan={showEstTime ? 5 : 4} className="py-1.5 px-1.5 border-t border-border text-left">
                      <div className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                        Location:
                      </div>
                      <div className="text-xs font-bold text-foreground">
                        {normalizeDisplayTitle(group.location)}
                        {crossWireSections.has(`loc-${groupIndex}`) && (
                          <span className="ml-2 text-[9px] font-semibold text-amber-600 dark:text-amber-400">CrossWire</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Subsections - only visible ones */}
                  {visibleSubsections.map((subsection, subIndex) => {
                    sectionCounter++;
                    const subsectionRows = subsection.rows.filter(isPrintableConnectionRow).length;
                    const page = getEstimatedPage(subsectionRows);

                    return (
                      <React.Fragment key={subIndex}>
                        <tr className="border-b border-border/20 hover:bg-muted/10">
                          <td className="py-0.5 px-1.5 text-muted-foreground">{sectionCounter}</td>
                          <td className="py-0.5 px-1.5">{subsection.label}</td>
                          <td className="py-0.5 px-1.5 text-right text-muted-foreground">
                            {subsectionRows > 0 ? subsectionRows : "-"}
                          </td>
                          {showEstTime && (() => {
                            const printableRows = subsection.rows.filter(isPrintableConnectionRow);
                            if (printableRows.length === 0) return <td className="py-0.5 px-1.5 text-right text-muted-foreground">-</td>;
                            const summary = summarizeSectionTime(printableRows, subsection.sectionKind);
                            return (
                              <td className="py-0.5 px-1.5 text-right text-muted-foreground font-mono text-[9px]">
                                {formatEstTime(summary.grandTotal)}
                              </td>
                            );
                          })()}
                          <td className="py-0.5 px-1.5 text-right text-muted-foreground">{page}</td>
                        </tr>

                        {/* Device-to-Device subsections under sections with prefix grouping */}
                        {subsection.deviceToDeviceSubsections && (() => {
                          const d2ds = subsection.deviceToDeviceSubsections!;
                          let lastPrefix = "";
                          const showGroupedPrefixHeader = wireListSortMode !== "blue-label-sequence";
                          return d2ds.map((d2d, d2dIndex) => {
                            const firstRow = d2d.rows[0];
                            const prefix = firstRow
                              ? getDevicePrefixValue(getDisplayEndpoints(firstRow).fromDeviceId)
                              : getTocSubsectionPrefix(d2d.label, subsection.sectionKind);
                            const showPrefixHeader = showGroupedPrefixHeader && prefix !== lastPrefix;
                            lastPrefix = prefix;
                            return (
                              <React.Fragment key={`d2d-${d2dIndex}`}>
                                {showPrefixHeader && (
                                  <tr className="border-b border-border/10">
                                    <td className="py-0.5 px-1.5"></td>
                                    <td colSpan={showEstTime ? 4 : 3} className="py-0.5 px-1.5 pl-4 text-[10px] font-semibold text-foreground/70 uppercase tracking-wide">
                                      {prefix}
                                    </td>
                                  </tr>
                                )}
                                <tr className="border-b border-border/10 hover:bg-muted/10">
                                  <td className="py-0.5 px-1.5"></td>
                                  <td className="py-0.5 px-1.5 pl-4 text-muted-foreground italic">
                                    <span className="mr-0.5">└</span>{d2d.label}
                                  </td>
                                  <td className="py-0.5 px-1.5 text-right text-muted-foreground">{d2d.rows.filter(isPrintableConnectionRow).length}</td>
                                  {showEstTime && (() => {
                                    const d2dPrintable = d2d.rows.filter(isPrintableConnectionRow);
                                    if (d2dPrintable.length === 0) return <td className="py-0.5 px-1.5 text-right text-muted-foreground">-</td>;
                                    const d2dSummary = summarizeSectionTime(d2dPrintable, subsection.sectionKind);
                                    return (
                                      <td className="py-0.5 px-1.5 text-right text-muted-foreground font-mono text-[9px]">
                                        {formatEstTime(d2dSummary.grandTotal)}
                                      </td>
                                    );
                                  })()}
                                  <td className="py-0.5 px-1.5 text-right text-muted-foreground">{page}</td>
                                </tr>
                              </React.Fragment>
                            );
                          });
                        })()}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              );
            })}

            {/* Feedback Form row */}
            {showFeedbackSection && (
              <tr className="border-t border-border bg-muted/20">
                <td colSpan={2} className="py-1 px-1.5 font-medium">Wire List Feedback Form</td>
                <td className="py-1 px-1.5 text-right text-muted-foreground">-</td>
                {showEstTime && <td className="py-1 px-1.5 text-right text-muted-foreground">-</td>}
                <td className="py-1 px-1.5 text-right text-muted-foreground">{totalPages}</td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Summary */}
        <div className="mt-3 pt-2 border-t border-border flex justify-between text-[10px] text-muted-foreground">
          <span>Locations: <strong className="text-foreground">{visibleLocationCount}</strong></span>
          <span>Sections: <strong className="text-foreground">{visibleSubsectionCount}</strong></span>
          <span>Rows: <strong className="text-foreground">{visibleRowCount}</strong></span>
          {showEstTime && (
            <span>Est. Total: <strong className="text-foreground">{formatEstTime(visibleTotalTime)}</strong></span>
          )}
          <span>Pages: <strong className="text-foreground">{totalPages}</strong></span>
        </div>
      </div>
    </PrintPage>
  );
}

// ============================================================================
// IPV Discrepancy Codes Reference Page
// ============================================================================

// IPV Codes data structure
const IPV_CODES = {
  Component: [
    { code: "CD", description: "Wrong direction, improperly installed, damaged" },
    { code: "CH", description: "Component hardware (i.e. star washer wrong screw etc...)" },
    { code: "CM", description: "Missing Component (not associated with a part shortage)" },
    { code: "CW", description: "Wrong part" },
  ],
  Labels: [
    { code: "LA", description: "Label Misaligned" },
    { code: "LD", description: "Label Damaged" },
    { code: "LI", description: "Incorrect Label, typo, missing information" },
    { code: "LM", description: "Label Missing" },
    { code: "LV", description: "Label Not Visible/covered" },
    { code: "M", description: "Add M for any metal or label lab supplied labels (incl. sugar cubes)" },
    { code: "S", description: "Add S to the end of label code for any shop floor created labels (blue, heat shrink, ground wire labels etc...)" },
  ],
  Process: [
    { code: "PC", description: "Change not stamped off" },
    { code: "PH", description: "Highlight Not used, wrong color" },
    { code: "PP", description: "Pan duct not cut, improperly cut" },
    { code: "PS", description: "SWS not stamped, skipped steps, incorrect sheet used, stamped but not completed" },
    { code: "PT", description: "Torque Paint missing, improper application" },
    { code: "PTW", description: "Tie Wraps excessive, not removed, not properly cut" },
  ],
  Wiring: [
    { code: "WB", description: "Any Belden related wiring" },
    { code: "WC", description: "Wire components (ex diodes, resistors, EOL resistors)" },
    { code: "WE", description: "Exposed Conductor" },
    { code: "WF", description: "Ferrule, improperly crimped, wrong size, improperly installed" },
    { code: "WG", description: "Wrong Gauge/Color Wire" },
    { code: "WI", description: "Insulation cracked damaged, branding issues etc." },
    { code: "WJ", description: "Metal jumper touching, incorrect wire jumper" },
    { code: "WL", description: "Any loose wiring" },
    { code: "WM", description: "Missing Wire" },
    { code: "WP", description: "Crimped, birdcage, circuit # not visible (process)" },
    { code: "WR", description: "Routing -- wire, harness, intertwined, spiral wrap issues" },
    { code: "WT", description: "Mis-termination -- wire, resistor, diode (including wrong direction)" },
  ],
};

function IPVCodesPage({
  pageNumber,
  totalPages,
}: {
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <PrintPage
      className="print-ipv-codes-page shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
      pageNumber={pageNumber}
      totalPages={totalPages}
    >
      <div className="py-4 w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-border">
          <div>
            <h1 className="text-[15px] font-bold text-foreground">IPV Discrepancy Codes</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">REF: WI 5.7.2-01 | Issue No.: 02 | Issue Date: 08/18</p>
          </div>
          <img
            src="/SolarTurbines-Light.svg"
            alt="Solar Turbines"
            className="h-6 w-auto"
          />
        </div>

        {/* IPV Codes Table */}
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(IPV_CODES).map(([category, codes]) => (
            <div key={category} className="border border-foreground/20 rounded-sm overflow-hidden">
              <div className="bg-muted/80 px-2 py-1.5 border-b border-foreground/20">
                <h2 className="text-[12px] font-bold text-foreground">{category}</h2>
              </div>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-foreground/10 bg-muted/40">
                    <th className="px-2 py-1 text-left font-semibold w-12">Code</th>
                    <th className="px-2 py-1 text-left font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((item, idx) => (
                    <tr key={item.code} className={idx < codes.length - 1 ? "border-b border-foreground/5" : ""}>
                      <td className="px-2 py-1 font-mono font-bold text-foreground">{item.code}</td>
                      <td className="px-2 py-1 text-muted-foreground">{item.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </PrintPage>
  );
}

// ============================================================================
// Blue Device ID Display (referenced blue label style)
// ============================================================================

function BlueDeviceID({ deviceId, enabled }: { deviceId: string; enabled: boolean }) {
  // Strip trailing colon with no terminal value (e.g. "GR301:" -> "GR301")
  const cleanDeviceId = deviceId ? deviceId.trim().replace(/:$/, "") : deviceId;

  if (!enabled || !cleanDeviceId) {
    return <span className="font-mono text-[11px] font-semibold">{cleanDeviceId}</span>;
  }

  // Parse device ID - look for pattern like "KA0561:A1" -> base "KA0561" + suffix ":A1"
  const colonIndex = cleanDeviceId.indexOf(":");

  if (colonIndex === -1) {
    // No colon, display entire ID in blue badge
    return (
      <span className="inline-flex items-center gap-0.5">
        <span className="bg-[#1e3a5f] text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-md">
          {cleanDeviceId}
        </span>
      </span>
    );
  }

  const base = cleanDeviceId.substring(0, colonIndex);
  const suffix = cleanDeviceId.substring(colonIndex);

  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="bg-[#1e3a5f] text-white text-[11px] font-semibold px-1.5 py-0.5 rounded-full">
        {base}
      </span>
      <span className="text-[11px] font-semibold text-foreground/80">{suffix}</span>
    </span>
  );
}


// ============================================================================
// Print Table Row
// ============================================================================

function PrintTableRow({
  row,
  showFrom,
  showTo,
  showIPV,
  showComments,
  showLength,
  showEstTime = false,
  sectionKind,
  showPartNumber = false,
  showDescription = false,
  showWireNo = true,
  showWireId = true,
  showWireType = true,
  showGaugeSize = true,
  showFromLocation = false,
  showToLocation = true,
  swapFromTo = false,
  comment,
  totalColumns,
  enableBlueDeviceID,
  isCablesSection,
  currentSheetName = "",
  partNumberMap,
  cablePartNumberMap,
  lengthDisplay,
  rowClassName,
  isRowHidden,
  onToggleRowHidden,
  locationNormalizedTitleByName,
  isExternal = false,
}: {
  row: SemanticWireListRow;
  showFrom: boolean;
  showTo: boolean;
  showIPV: boolean;
  showComments: boolean;
  showLength: boolean;
  showEstTime?: boolean;
  sectionKind?: IdentificationFilterKind;
  showPartNumber?: boolean;
  showDescription?: boolean;
  showWireNo?: boolean;
  showWireId?: boolean;
  showWireType?: boolean;
  showGaugeSize?: boolean;
  showFromLocation?: boolean;
  showToLocation?: boolean;
  swapFromTo?: boolean;
  comment: string;
  totalColumns: number;
  enableBlueDeviceID: boolean;
  isCablesSection: boolean;
  currentSheetName?: string;
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  cablePartNumberMap?: Map<string, CablePartNumberLookupResult> | null;
  lengthDisplay?: string;
  rowClassName?: string;
  isRowHidden?: boolean;
  onToggleRowHidden?: () => void;
  /** Mapping to transform raw location names to normalized titles */
  locationNormalizedTitleByName?: Record<string, string>;
  isExternal?: boolean;
}) {
  // Check if this is a device change row (:J -> :P pattern)
  const deviceChangeInfo = detectDeviceChange(row);

  // Render device change rows as simple section separators (hide the row data)
  if (deviceChangeInfo.isDeviceChange) {
    return (
      <tr>
        <td colSpan={totalColumns} className="p-0">
          <div className="h-1.5 bg-secondary" />
        </td>
      </tr>
    );
  }

  const { fromReference, toReference } = getPrintPreviewReferences(
    row,
    isCablesSection,
    partNumberMap,
    cablePartNumberMap,
    swapFromTo,
  );
  const displayEndpoints = getDisplayEndpoints(row, swapFromTo);

  // Eye button element ��� rendered inside the first visible cell to avoid adding an extra table column
  const eyeButtonEl = onToggleRowHidden ? (
    <button
      type="button"
      onClick={onToggleRowHidden}
      className={cn(
        "absolute -left-5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-sm flex items-center justify-center z-10 transition-opacity print:hidden",
        isRowHidden
          ? "opacity-100 bg-destructive/10 hover:bg-destructive/20"
          : "opacity-0 group-hover/row:opacity-100 hover:bg-muted"
      )}
      title={isRowHidden ? "Unhide row" : "Hide row"}
    >
      <EyeOff className={cn("h-2.5 w-2.5", isRowHidden ? "text-destructive" : "text-muted-foreground")} />
    </button>
  ) : null;

  return (
    <tr className={["border-b w-full border-foreground/10 group/row relative", rowClassName ?? ""].join(" ").trim()}>
      {/* FROM group */}
      {showFrom && (
        <td className="px-0.5 py-1 text-center">
          {showFrom && eyeButtonEl}
          <FromCheckboxCell
            rowId={row.__rowId}
            checked={false}
            onCheckedChange={() => { }}
            printVariant={true}
          />
        </td>
      )}
      {showEstTime && (
        <td className="px-1 py-1 text-center text-[10px] font-mono text-muted-foreground">
          {formatEstTime(estimateWireTime(sectionKind, row.gaugeSize).fromMinutes)}
        </td>
      )}
      {showFromLocation && (
        <td className="px-1 py-1 text-center text-[9px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{resolveLocationDisplayTitle(displayEndpoints.fromLocation, locationNormalizedTitleByName, isExternal ? undefined : currentSheetName)}</td>
      )}
      {showPartNumber && (
        <td className="px-1 py-1 text-center text-[10px] font-medium text-muted-foreground">{fromReference?.partNumber || ""}</td>
      )}
      <td className={cn(
        "px-1 py-1 text-center text-[10px] font-medium",
        !showDescription && "border-r border-foreground/20"
      )}>
        {!showFrom && eyeButtonEl}
        <BlueDeviceID deviceId={displayEndpoints.fromDeviceId} enabled={enableBlueDeviceID} />
      </td>
      {showDescription && (
        <td className="px-1 py-1 text-center text-[10px] text-muted-foreground border-r border-foreground/20">{fromReference?.description || ""}</td>
      )}
      {/* Connection group */}
      {showWireType && (
        <td className={cn(
          "px-1 py-1 text-center text-[10px] font-medium",
          !showWireNo && !showWireId && !showGaugeSize && !showLength && "border-r border-foreground/20"
        )}>{row.wireType}</td>
      )}
      {showWireNo && (
        <td className={cn(
          "px-1 py-1 text-center font-mono text-[10px] font-medium",
          !showWireId && !showGaugeSize && !showLength && "border-r border-foreground/20"
        )}>{row.wireNo}</td>
      )}
      {showWireId && (
        <td className={cn(
          "px-1 py-1 text-center text-[10px] font-medium",
          !showGaugeSize && !showLength && "border-r border-foreground/20"
        )}>{row.wireId}</td>
      )}
      {showGaugeSize && (
        <td className={cn(
          "px-1 py-1 text-center text-[10px] font-medium",
          !showLength && "border-r border-foreground/20"
        )}>{row.gaugeSize}</td>
      )}
      {showLength && (
        <td className="px-1 py-1 text-center text-[10px] font-medium font-mono border-r border-foreground/20">
          {lengthDisplay || "—"}
        </td>
      )}
      {/* TO group */}
      {showTo && (
        <td className="px-0.5 py-1 text-center">
          <ToCheckboxCell
            rowId={row.__rowId}
            checked={false}
            onCheckedChange={() => { }}
            printVariant={true}
          />
        </td>
      )}
      {showEstTime && (
        <td className="px-1 py-1 text-center text-[10px] font-mono text-muted-foreground">
          {formatEstTime(estimateWireTime(sectionKind, row.gaugeSize).toMinutes)}
        </td>
      )}
      {showPartNumber && (
        <td className="px-1 py-1 text-center text-[10px] font-medium text-muted-foreground">{toReference?.partNumber || ""}</td>
      )}
      <td className="px-1 py-1 text-center text-[10px] font-medium">
        <BlueDeviceID deviceId={displayEndpoints.toDeviceId} enabled={enableBlueDeviceID} />
      </td>
      {showDescription && (
        <td className="px-1 py-1 text-center text-[10px] text-muted-foreground">{toReference?.description || ""}</td>
      )}
      {showToLocation && (
        <td className={cn(
          "px-1 py-1 text-center text-[9px] font-medium whitespace-nowrap overflow-hidden text-ellipsis",
          (showIPV || showComments) && "border-r border-foreground/20"
        )}>{resolveLocationDisplayTitle(displayEndpoints.toLocation, locationNormalizedTitleByName, isExternal ? undefined : currentSheetName)}</td>
      )}
      {/* Review group */}
      {showIPV && (
        <td className="px-0.5 py-1 text-center">
          <IPVCheckboxCell
            rowId={row.__rowId}
            checked={false}
            onCheckedChange={() => { }}
            printVariant={true}
          />
        </td>
      )}
      {showComments && (
        <td className="px-1 py-1 text-center">
          <CommentsCell
            rowId={row.__rowId}
            value={comment}
            onChange={() => { }}
            printVariant={true}
          />
        </td>
      )}
    </tr>
  );
}

function CableReferenceFooterRow({
  row,
  totalColumns,
  showPartNumber,
  showDescription,
  cablePartNumberMap,
}: {
  row: SemanticWireListRow;
  totalColumns: number;
  showPartNumber: boolean;
  showDescription: boolean;
  cablePartNumberMap?: Map<string, CablePartNumberLookupResult> | null;
}) {
  const cableReference = lookupReferenceEntry(cablePartNumberMap, row.wireType);

  if (!cableReference || (!showPartNumber && !showDescription)) {
    return null;
  }

  return (
    <tr className="border-b border-foreground/10 ">
      <td colSpan={totalColumns} className="px-2 py-1.5 text-[10px] text-muted-foreground">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {showPartNumber && cableReference.partNumber ? (
            <span>
              <span className="font-semibold uppercase tracking-wide text-foreground/80">Part Number:</span>{" "}
              {cableReference.partNumber}
            </span>
          ) : null}
          {showDescription && cableReference.description ? (
            <span>
              <span className="font-semibold uppercase tracking-wide text-foreground/80">Description:</span>{" "}
              {cableReference.description}
            </span>
          ) : null}
        </div>
      </td>
    </tr>
  );
}

// ============================================================================
// Print Preview Table
// ============================================================================

function PrintPreviewTable({
  rows,
  settings,
  comments,
  onCommentChange,
  groupLabel,
  currentSheetName = "",
  sectionKind,
  sectionLabel,
  matchMetadata = {},
  partNumberMap,
  cablePartNumberMap,
  getRowLength,
  hiddenRows,
  onToggleRowHidden,
  locationNormalizedTitleByName,
  isExternal = false,
}: {
  rows: SemanticWireListRow[];
  settings: PrintSettings;
  comments: Record<string, string>;
  onCommentChange: (rowId: string, value: string) => void;
  groupLabel?: string;
  currentSheetName?: string;
  sectionKind?: IdentificationFilterKind;
  sectionLabel?: string;
  matchMetadata?: Record<string, PatternMatchMetadata>;
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  cablePartNumberMap?: Map<string, CablePartNumberLookupResult> | null;
  getRowLength?: (rowId: string) => { display: string; roundedInches: number; confidence: string } | null;
  hiddenRows?: Set<string>;
  onToggleRowHidden?: (rowId: string) => void;
  locationNormalizedTitleByName?: Record<string, string>;
  isExternal?: boolean;
}) {
  const { showFromCheckbox, showToCheckbox, showIPV, showComments, showLength, showEstTime, showDeviceSubheaders } = settings;

  const sectionColumns = getEffectiveSectionColumns(
    settings.sectionColumnVisibility,
    sectionLabel,
    sectionKind,
  );

  // Check if this is a cables section for type grouping
  const isCablesSection = sectionKind === "cables";

  // Determine which columns are visible based on per-section settings
  const showPartNumber = sectionColumns.partNumber;
  const showDescription = sectionColumns.description;
  const showPartNumberColumn = showPartNumber && !isCablesSection;
  const showDescriptionColumn = showDescription && !isCablesSection;
  const showWireNo = sectionColumns.wireNo;
  const showWireId = sectionColumns.wireId;
  const showWireType = sectionColumns.wireType;
  const showGaugeSize = sectionColumns.gaugeSize;
  // Only show FROM location column for external (cross-wire) sections
  const showFromLocation = isExternal;
  const showToLocation = true;
  const swapFromTo = sectionColumns.swapFromTo ?? false;
  const preserveSequentialRunOrder = shouldPreservePrintSubsectionOrder(sectionKind);
  const wireListSortMode = settings.wireListSortMode;
  const usesDevicePrefixGrouping =
    wireListSortMode === "device-prefix" ||
    wireListSortMode === "device-prefix-part-number";
  const orderedRows = useMemo(
    () => preserveSequentialRunOrder || (sectionKind === "single_connections" && wireListSortMode === "blue-label-sequence")
      ? filterEmptyDeviceChangeSections(rows).filter(isPrintableConnectionRow)
      : sortRowsForDeviceGroupedPreview(
        filterEmptyDeviceChangeSections(rows).filter(isPrintableConnectionRow),
        currentSheetName,
        isCablesSection,
        partNumberMap,
        sectionKind,
      ),
    [rows, currentSheetName, isCablesSection, partNumberMap, preserveSequentialRunOrder, sectionKind, wireListSortMode],
  );
  const effectiveSubgroups = useMemo(
    () => !sectionKind
      ? []
      : buildRenderableSectionSubgroups(sectionKind, orderedRows, matchMetadata, partNumberMap, usesDevicePrefixGrouping),
    [matchMetadata, orderedRows, partNumberMap, sectionKind, usesDevicePrefixGrouping],
  );

  // Sort subgroups by device prefix (and optionally part number) for single_connections
  useMemo(() => {
    if (sectionKind !== "single_connections" || !usesDevicePrefixGrouping || effectiveSubgroups.length === 0) {
      return;
    }
    const rowsById = new Map(orderedRows.map((row) => [row.__rowId, row]));
    effectiveSubgroups.sort((a, b) => {
      const aFirstRow = a.rowIds.length > 0 ? rowsById.get(a.rowIds[0]) : undefined;
      const bFirstRow = b.rowIds.length > 0 ? rowsById.get(b.rowIds[0]) : undefined;
      const aDisplayFrom = aFirstRow ? getDisplayEndpoints(aFirstRow).fromDeviceId : undefined;
      const bDisplayFrom = bFirstRow ? getDisplayEndpoints(bFirstRow).fromDeviceId : undefined;
      const aPrefix = getDevicePrefixValue(aDisplayFrom);
      const bPrefix = getDevicePrefixValue(bDisplayFrom);
      const prefixCompare = aPrefix.localeCompare(bPrefix, undefined, { numeric: true });
      if (prefixCompare !== 0) return prefixCompare;
      if (wireListSortMode === "device-prefix-part-number" && partNumberMap) {
        const aPartNumber = lookupPartNumber(partNumberMap, aDisplayFrom)?.partNumber ?? "";
        const bPartNumber = lookupPartNumber(partNumberMap, bDisplayFrom)?.partNumber ?? "";
        const partCompare = aPartNumber.localeCompare(bPartNumber, undefined, { numeric: true });
        if (partCompare !== 0) return partCompare;
      }
      return a.order - b.order;
    });
  }, [effectiveSubgroups, orderedRows, partNumberMap, sectionKind, usesDevicePrefixGrouping, wireListSortMode]);

  // Reorder rows so subgroup members are contiguous
  const reorderedRows = useMemo(() => {
    if (effectiveSubgroups.length === 0) return orderedRows;
    const rowSubgroupIndex = new Map<string, number>();
    effectiveSubgroups.forEach((sg, sgIndex) => {
      for (const rowId of sg.rowIds) {
        if (!rowSubgroupIndex.has(rowId)) {
          rowSubgroupIndex.set(rowId, sgIndex);
        }
      }
    });
    const sorted = [...orderedRows].sort((a, b) => {
      const aGroup = rowSubgroupIndex.get(a.__rowId) ?? effectiveSubgroups.length;
      const bGroup = rowSubgroupIndex.get(b.__rowId) ?? effectiveSubgroups.length;
      return aGroup - bGroup;
    });
    for (const sg of effectiveSubgroups) {
      const memberSet = new Set(sg.rowIds);
      const first = sorted.find(r => memberSet.has(r.__rowId));
      if (first) {
        sg.startRowId = first.__rowId;
      }
    }
    return sorted;
  }, [orderedRows, effectiveSubgroups]);

  const subgroupHeaderMap = useMemo(
    () => buildSubgroupStartMap(effectiveSubgroups),
    [effectiveSubgroups],
  );
  const renderPlan = useMemo(
    () => {
      const plan = buildWireListRenderPlan({
        rows: reorderedRows,
        currentSheetName,
        sectionKind,
        matchMetadata,
        subgroupHeaderMap,
        showDeviceGroupHeader: showDeviceSubheaders,
        hideDeviceSubheaders:
          sectionKind === "grounds" ||
          sectionKind === "ka_relay_plugin_jumpers" ||
          sectionKind === "ka_jumpers" ||
          sectionKind === "kt_jumpers" ||
          sectionKind === "cables" ||
          sectionKind === "single_connections" ||
          sectionKind === "fu_jumpers" ||
          sectionKind === "vio_jumpers" ||
          sectionKind === "ka_twin_ferrules" ||
          sectionKind === "resistors",
        forceDeviceSeparator: sectionKind === "grounds",
      });

      // Inject prefix-category headers when sorting by device prefix
      if (sectionKind === "single_connections" && usesDevicePrefixGrouping && plan.length > 0) {
        const rowsById = new Map(reorderedRows.map((row) => [row.__rowId, row]));
        const enriched: WireListRenderPlanItem[] = [];
        let lastPrefix = "";

        for (const item of plan) {
          if (item.type === "group-header" && item.group.groupKind === "subgroup") {
            const matchingSg = effectiveSubgroups.find((sg) => `subgroup-${sg.id}` === item.group.key || sg.label === item.group.label);
            const firstRowId = matchingSg?.rowIds[0];
            const firstRow = firstRowId ? rowsById.get(firstRowId) : undefined;
            const prefix = getDevicePrefixValue(firstRow ? getDisplayEndpoints(firstRow).fromDeviceId : undefined);

            if (prefix && prefix !== lastPrefix) {
              // Collect part numbers for this prefix group
              const prefixPartNumbers: string[] = [];
              if (wireListSortMode === "device-prefix-part-number" && partNumberMap) {
                for (const sg of effectiveSubgroups) {
                  const sgFirstRowId = sg.rowIds[0];
                  const sgFirstRow = sgFirstRowId ? rowsById.get(sgFirstRowId) : undefined;
                  if (getDevicePrefixValue(sgFirstRow?.fromDeviceId) === prefix) {
                    const pn = lookupPartNumber(partNumberMap, sgFirstRow?.fromDeviceId)?.partNumber;
                    if (pn && !prefixPartNumbers.includes(pn)) {
                      prefixPartNumbers.push(pn);
                    }
                  }
                }
              }

              enriched.push({
                type: "group-header",
                key: `prefix-category-${prefix}`,
                group: {
                  key: `prefix-category-${prefix}`,
                  label: prefix,
                  groupKind: "prefix-category",
                  description: prefixPartNumbers.length > 0 ? prefixPartNumbers.join(", ") : undefined,
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
    },
    [currentSheetName, effectiveSubgroups, matchMetadata, orderedRows, partNumberMap, reorderedRows, sectionKind, showDeviceSubheaders, subgroupHeaderMap, usesDevicePrefixGrouping, wireListSortMode],
  );

  // Build a map of the last row ID in each subgroup for subtotal injection
  const stdSubgroupLastRowMap = useMemo(() => {
    const map = new Map<string, { label: string; rows: SemanticWireListRow[] }>();
    let currentSubgroup: { key: string; label: string; rowIds: string[] } | null = null;
    for (const item of renderPlan) {
      if (item.type === "group-header" && (item.group.groupKind === "subgroup" || item.group.groupKind === "prefix-category")) {
        if (currentSubgroup && currentSubgroup.rowIds.length > 0) {
          const lastId = currentSubgroup.rowIds[currentSubgroup.rowIds.length - 1];
          const subRows = currentSubgroup.rowIds
            .map((id) => reorderedRows.find((r) => r.__rowId === id))
            .filter((r): r is SemanticWireListRow => Boolean(r));
          map.set(lastId, { label: currentSubgroup.label, rows: subRows });
        }
        currentSubgroup = item.group.groupKind === "subgroup"
          ? { key: item.key, label: item.group.label, rowIds: [] }
          : null;
      } else if (item.type === "row" && currentSubgroup) {
        currentSubgroup.rowIds.push(item.rowId);
      }
    }
    if (currentSubgroup && currentSubgroup.rowIds.length > 0) {
      const lastId = currentSubgroup.rowIds[currentSubgroup.rowIds.length - 1];
      const subRows = currentSubgroup.rowIds
        .map((id) => reorderedRows.find((r) => r.__rowId === id))
        .filter((r): r is SemanticWireListRow => Boolean(r));
      map.set(lastId, { label: currentSubgroup.label, rows: subRows });
    }
    return map;
  }, [renderPlan, reorderedRows]);

  // Base columns: Device ID is always shown, others depend on visibility
  // FROM group: Complete (checkbox) + Est + Location + Part No + Device ID + Desc
  const fromGroupCount = (showFromCheckbox ? 1 : 0) + (showEstTime ? 1 : 0) + (showFromLocation ? 1 : 0) + (showPartNumberColumn ? 1 : 0) + 1 + (showDescriptionColumn ? 1 : 0);
  // Connection group (middle): Type + No + Wire ID + Size + Length
  const connectionGroupCount = (showWireType ? 1 : 0) + (showWireNo ? 1 : 0) + (showWireId ? 1 : 0) + (showGaugeSize ? 1 : 0) + (showLength ? 1 : 0);
  // TO group: Complete (checkbox) + Est + Part No + Device ID + Desc + Location
  const toGroupCount = (showToCheckbox ? 1 : 0) + (showEstTime ? 1 : 0) + (showPartNumberColumn ? 1 : 0) + 1 + (showDescriptionColumn ? 1 : 0) + (showToLocation ? 1 : 0);
  // Review group: IPV + Notes
  const reviewGroupCount = (showIPV ? 1 : 0) + (showComments ? 1 : 0);

  const totalColumns = fromGroupCount + connectionGroupCount + toGroupCount + reviewGroupCount;

  // Calculate column spans for group headers
  // FROM: all FROM columns
  const fromColSpan = fromGroupCount;
  // Connection (no header label): all connection columns
  const connectionColSpan = connectionGroupCount;
  // TO: all TO columns
  const toColSpan = toGroupCount;
  // Review (no header label): IPV + Notes
  const reviewColSpan = reviewGroupCount;

  // Column width definitions (in pixels) for print table
  const colWidths = {
    checkbox: 20,      // Checkmark columns (FROM, TO, IPV)
    estTime: 30,       // Est. time
    location: 72,      // Location names
    partNumber: 52,    // Part number
    deviceId: 74,      // Device ID
    description: 62,   // Description
    wireType: 30,      // Wire type (SC, etc)
    wireNo: 54,        // Wire number
    wireId: 50,        // Wire ID
    gaugeSize: 30,     // Gauge size
    length: 38,        // Length
    notes: 62,         // Notes column
  };

  const colStyles: Array<CSSProperties> = [];
  if (showFromCheckbox) colStyles.push({ width: colWidths.checkbox, minWidth: colWidths.checkbox, maxWidth: colWidths.checkbox });
  if (showEstTime) colStyles.push({ width: colWidths.estTime, minWidth: colWidths.estTime, maxWidth: colWidths.estTime });
  if (showFromLocation) colStyles.push({ width: colWidths.location });
  if (showPartNumberColumn) colStyles.push({ width: colWidths.partNumber });
  colStyles.push({ width: colWidths.deviceId });
  if (showDescriptionColumn) colStyles.push({ width: colWidths.description });
  if (showWireType) colStyles.push({ width: colWidths.wireType, minWidth: colWidths.wireType, maxWidth: colWidths.wireType });
  if (showWireNo) colStyles.push({ width: colWidths.wireNo });
  if (showWireId) colStyles.push({ width: colWidths.wireId });
  if (showGaugeSize) colStyles.push({ width: colWidths.gaugeSize, minWidth: colWidths.gaugeSize, maxWidth: colWidths.gaugeSize });
  if (showLength) colStyles.push({ width: colWidths.length, minWidth: colWidths.length, maxWidth: colWidths.length });
  if (showToCheckbox) colStyles.push({ width: colWidths.checkbox, minWidth: colWidths.checkbox, maxWidth: colWidths.checkbox });
  if (showEstTime) colStyles.push({ width: colWidths.estTime, minWidth: colWidths.estTime, maxWidth: colWidths.estTime });
  if (showPartNumberColumn) colStyles.push({ width: colWidths.partNumber });
  colStyles.push({ width: colWidths.deviceId });
  if (showDescriptionColumn) colStyles.push({ width: colWidths.description });
  if (showToLocation) colStyles.push({ width: colWidths.location });
  if (showIPV) colStyles.push({ width: colWidths.checkbox, minWidth: colWidths.checkbox, maxWidth: colWidths.checkbox });
  if (showComments) colStyles.push({ width: colWidths.notes });

  return (
    <table className="w-full border-collapse rounded-sm border border-foreground/20 text-[11px]" style={{ tableLayout: 'fixed' }}>
      {/* Define column widths */}
      <colgroup>{colStyles.map((style, index) => <col key={`col-${index}`} style={style} />)}</colgroup>
      <thead className="bg-muted/30" style={{ display: 'table-header-group' }}>
        {/* Group header row: From | (no label for connection) | To | (no label for review) */}
        <tr className="border-b border-foreground/10">
          <th
            colSpan={fromColSpan}
            className="px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider border-r border-foreground/20 whitespace-nowrap"
          >
            From
          </th>
          {connectionColSpan > 0 && (
            <th
              colSpan={connectionColSpan}
              className="px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider border-r border-foreground/20 whitespace-nowrap"
            />
          )}
          <th
            colSpan={toColSpan}
            className={cn(
              "px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider whitespace-nowrap",
              reviewColSpan > 0 && "border-r border-foreground/20"
            )}
          >
            To
          </th>
          {reviewColSpan > 0 && (
            <th
              colSpan={reviewColSpan}
              className="px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider whitespace-nowrap"
            />
          )}
        </tr>
        {/* Column header row */}
        <tr className="border-b border-foreground/20">
          {/* FROM group columns */}
          {showFromCheckbox && (
            <th className="px-0.5 py-1 text-center text-[8px] font-normal text-muted-foreground whitespace-nowrap" title="Complete">&#10003;</th>
          )}
          {showEstTime && (
            <th className="px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap">Est.</th>
          )}
          {showFromLocation && (
            <th className="px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap">Location</th>
          )}
          {showPartNumberColumn && (
            <th className="px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap">Part No</th>
          )}
          <th className={cn(
            "px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap",
            !showDescriptionColumn && "border-r border-foreground/20"
          )}>Device ID</th>
          {showDescriptionColumn && (
            <th className="px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap border-r border-foreground/20">Desc</th>
          )}
          {/* Connection group columns (no header label) */}
          {showWireType && (
            <th className={cn(
              "px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap",
              !showWireNo && !showWireId && !showGaugeSize && !showLength && "border-r border-foreground/20"
            )}>Type</th>
          )}
          {showWireNo && (
            <th className={cn(
              "px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap",
              !showWireId && !showGaugeSize && !showLength && "border-r border-foreground/20"
            )}>No.</th>
          )}
          {showWireId && (
            <th className={cn(
              "px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap",
              !showGaugeSize && !showLength && "border-r border-foreground/20"
            )}>Wire ID</th>
          )}
          {showGaugeSize && (
            <th className={cn(
              "px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap",
              !showLength && "border-r border-foreground/20"
            )}>Size</th>
          )}
          {showLength && (
            <th className="px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap border-r border-foreground/20">Length</th>
          )}
          {/* TO group columns */}
          {showToCheckbox && (
            <th className="px-0.5 py-1 text-center text-[8px] font-normal text-muted-foreground whitespace-nowrap" title="Complete">&#10003;</th>
          )}
          {showEstTime && (
            <th className="px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap">Est.</th>
          )}
          {showPartNumberColumn && (
            <th className="px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap">Part No</th>
          )}
          <th className="px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap">Device ID</th>
          {showDescriptionColumn && (
            <th className="px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap">Desc</th>
          )}
          {showToLocation && (
            <th className={cn(
              "px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap",
              (showIPV || showComments) && "border-r border-foreground/20"
            )}>Location</th>
          )}
          {/* Review group columns (no header label) */}
          {showIPV && (
            <th className="px-0.5 py-1 text-center text-[8px] font-normal text-muted-foreground whitespace-nowrap">IPV</th>
          )}
          {showComments && (
            <th className="px-1 py-1 text-center text-[8px] font-semibold uppercase whitespace-nowrap">Notes</th>
          )}
        </tr>
      </thead>
      <tbody>
        {groupLabel && (
          <tr>
            <td
              colSpan={totalColumns}
              className="px-1 py-2 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide"
            >
              {groupLabel}
            </td>
          </tr>
        )}
        {renderPlan.map((item, index) => {
          if (item.type === "location-header") {
            return (
              <TableSubgroupHeaderRow
                key={item.key}
                colSpan={totalColumns}
                label={item.label}
                rowClassName="bg-muted/80 border-t border-foreground/20"
                cellClassName="px-2 py-1.5 text-[11px] font-bold text-foreground uppercase tracking-wide"
              />
            );
          }

          if (item.type === "group-header") {
            if (item.group.groupKind === "prefix-category") {
              const prefixPartNumbers = item.group.description?.split(", ").filter(Boolean) ?? [];
              return (
                <tr
                  key={item.key}
                  className="border-b border-foreground/20 mt-4  border-t-2 border-foreground/15"
                >
                  <td colSpan={totalColumns} className="px-2 py-2 align-middle">
                    <div className="flex flex-wrap justify-between items-center gap-3">
                      <div className="text-[16px] flex font-bold uppercase tracking-wider text-muted-foreground">{item.group.label} </div>

                      {prefixPartNumbers.length > 0 && (
                        <DeviceProperty
                          type="referenceImage"
                          pn={prefixPartNumbers[0]}
                          className="h-16 w-16 shrink-0"
                          imageClassName="p-1"
                          fallback={null}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <TableSubgroupHeaderRow
                key={item.key}
                colSpan={totalColumns}
                label={item.group.label}
                tone={item.group.tone}
                description={item.group.description}
                rowClassName={item.group.groupKind === "device" ? "bg-muted/40" : undefined}
                cellClassName="border-b border-foreground/10 px-2 py-0 text-[10px] font-semibold text-muted-foreground tracking-wide"
              />
            );
          }

          const nextRowItem = renderPlan.slice(index + 1).find((candidate) => candidate.type === "row");
          const isEndOfCableGroup = Boolean(
            isCablesSection && (
              !nextRowItem ||
              String(nextRowItem.row.wireType || "").trim().toUpperCase() !== String(item.row.wireType || "").trim().toUpperCase()
            )
          );

          return (
            <Fragment key={item.key}>
              <PrintTableRow
                row={item.row}
                showFrom={showFromCheckbox}
                showTo={showToCheckbox}
                showIPV={showIPV}
                showComments={showComments}
                showLength={showLength}
                showEstTime={showEstTime}
                sectionKind={sectionKind}
                showPartNumber={showPartNumberColumn}
                showDescription={showDescriptionColumn}
                showWireNo={showWireNo}
                showWireId={showWireId}
                showWireType={showWireType}
                showGaugeSize={showGaugeSize}
                showFromLocation={showFromLocation}
                showToLocation={showToLocation}
                swapFromTo={swapFromTo}
                comment={comments[item.row.__rowId] || ""}
                totalColumns={totalColumns}
                enableBlueDeviceID={settings.enableBlueDeviceIDColumns}
                isCablesSection={isCablesSection}
                currentSheetName={currentSheetName}
                partNumberMap={partNumberMap}
                cablePartNumberMap={cablePartNumberMap}
                lengthDisplay={getRowLength?.(item.row.__rowId)?.display}
                isRowHidden={hiddenRows?.has(item.row.__rowId)}
                onToggleRowHidden={onToggleRowHidden ? () => onToggleRowHidden(item.row.__rowId) : undefined}
                locationNormalizedTitleByName={locationNormalizedTitleByName}
                isExternal={isExternal}
                rowClassName={[
                  item.showDeviceSeparator ? "border-t-[2px] border-t-muted" : "",
                  item.isWarningRow ? "border-x-4 border-x-orange-400 bg-orange-50/30" : "",
                  hiddenRows?.has(item.row.__rowId) ? "opacity-30 line-through" : "",
                ].join(" ").trim() || undefined}
              />
              {isEndOfCableGroup ? (
                <CableReferenceFooterRow
                  row={item.row}
                  totalColumns={totalColumns}
                  showPartNumber={showPartNumber}
                  showDescription={showDescription}
                  cablePartNumberMap={cablePartNumberMap}
                />
              ) : null}
              {showEstTime && (() => {
                const subInfo = stdSubgroupLastRowMap.get(item.row.__rowId);
                if (!subInfo || subInfo.rows.length <= 1) return null;
                const sub = summarizeSectionTime(subInfo.rows, sectionKind);
                const fromEstSkip = showFromCheckbox ? 1 : 0;
                const midCols = fromBaseCount + (showLength ? 1 : 0) + (showToCheckbox ? 1 : 0);
                const trailingCols = toBaseCount + (showIPV ? 1 : 0) + (showComments ? 1 : 0);
                return (
                  <tr key={`subgroup-total-${item.row.__rowId}`} className="border-t border-foreground/30">
                    {fromEstSkip > 0 && <td colSpan={fromEstSkip} />}
                    <td className="px-1.5 py-0.5 text-center text-[9px] font-mono text-muted-foreground">
                      {formatEstTime(sub.fromTotal)}
                    </td>
                    <td colSpan={midCols} />
                    <td className="px-1.5 py-0.5 text-center text-[9px] font-mono text-muted-foreground">
                      {formatEstTime(sub.toTotal)}
                    </td>
                    <td colSpan={trailingCols} className="px-2 py-0.5 text-right text-[9px] text-muted-foreground">
                      <span className="font-mono">
                        {formatEstTime(sub.grandTotal)}
                      </span>
                      <span className="ml-1 font-sans text-[8px] text-muted-foreground/60">({sub.rowCount})</span>
                    </td>
                  </tr>
                );
              })()}
            </Fragment>
          );
        })}
        {showEstTime && reorderedRows.length > 0 && (() => {
          const summary = summarizeSectionTime(reorderedRows, sectionKind);
          // Column order: [FromCheckbox] [FromEst] [fromBase cols] [Length] [ToCheckbox] [ToEst] [toBase cols] [IPV] [Notes]
          const fromEstSkip = showFromCheckbox ? 1 : 0; // cols before FROM Est.
          const midCols = fromBaseCount + (showLength ? 1 : 0) + (showToCheckbox ? 1 : 0); // cols between FROM Est. and TO Est.
          const trailingCols = toBaseCount + (showIPV ? 1 : 0) + (showComments ? 1 : 0); // cols after TO Est.
          return (
            <tr className="border-t border-foreground/20">
              {fromEstSkip > 0 && <td colSpan={fromEstSkip} />}
              <td className="px-1.5 py-0.5 text-center text-[9px] font-mono font-semibold text-muted-foreground whitespace-nowrap">
                {formatEstTime(summary.fromTotal)}
              </td>
              <td colSpan={midCols} />
              <td className="px-1.5 py-0.5 text-center text-[9px] font-mono font-semibold text-muted-foreground whitespace-nowrap">
                {formatEstTime(summary.toTotal)}
              </td>
              <td colSpan={trailingCols} className="px-2 py-0.5 text-right text-[10px] font-mono font-bold text-foreground whitespace-nowrap">
                Section Est. Completion: {formatEstTimeLong(summary.grandTotal)}
              </td>
            </tr>
          );
        })()}
      </tbody>
    </table>
  );
}

function BrandingPreviewTable({
  rows,
  currentSheetName,
  location,
  sectionLabel,
  sectionKind,
  sectionColumnVisibility,
  partNumberMap,
  matchMetadata = {},
  brandingSortMode = "default",
  selection,
  onToggleSelection,
  onSelectAll,
  onClearSelection,
  onUpdateMeasurement,
  onAdjustMeasurement,
  onResetMeasurement,
}: {
  rows: BrandingPreviewRow[];
  currentSheetName: string;
  location: string;
  sectionLabel?: string;
  sectionKind?: IdentificationFilterKind;
  sectionColumnVisibility: Record<string, SectionColumnVisibility>;
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  matchMetadata?: Record<string, PatternMatchMetadata>;
  brandingSortMode?: BrandingSortMode;
  selection: BrandingSelectionState;
  onToggleSelection: (rowId: string, shiftKey: boolean) => void;
  onSelectAll: (rowIds: string[]) => void;
  onClearSelection: (rowIds: string[]) => void;
  onUpdateMeasurement: (rowId: string, value: number) => void;
  onAdjustMeasurement: (rowId: string, delta: number) => void;
  onResetMeasurement: (rowId: string) => void;
}) {
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const sectionColumns = useMemo(
    () => getEffectiveSectionColumns(sectionColumnVisibility, sectionLabel, sectionKind),
    [sectionColumnVisibility, sectionKind, sectionLabel],
  );
  const showWireNo = sectionColumns.wireNo;
  const showWireId = sectionColumns.wireId;
  const showGaugeSize = sectionColumns.gaugeSize;
  const sectionRowIds = useMemo(() => rows.map((entry) => entry.row.__rowId), [rows]);
  const rowsById = useMemo(
    () => new Map(rows.map((entry) => [entry.row.__rowId, entry])),
    [rows],
  );
  const renderPlan = useMemo(
    () => buildBrandingSectionRenderPlan(
      rows.map((entry) => entry.row),
      currentSheetName,
      sectionKind,
      matchMetadata,
      partNumberMap,
      brandingSortMode,
    ),
    [brandingSortMode, currentSheetName, matchMetadata, partNumberMap, rows, sectionKind],
  );
  const selectedCount = useMemo(
    () => sectionRowIds.filter((rowId) => selection.selectedIds.has(rowId)).length,
    [sectionRowIds, selection.selectedIds],
  );
  const allRowsSelected = rows.length > 0 && selectedCount === rows.length;

  // Build a map of the last row ID in each subgroup for subtotal injection
  const subgroupLastRowMap = useMemo(() => {
    const map = new Map<string, { label: string; rowIds: string[] }>();
    let currentSubgroup: { key: string; label: string; rowIds: string[] } | null = null;
    for (const item of renderPlan) {
      if (item.type === "group-header" && (item.group.groupKind === "subgroup" || item.group.groupKind === "prefix-category")) {
        // Finalize previous subgroup
        if (currentSubgroup && currentSubgroup.rowIds.length > 0) {
          const lastId = currentSubgroup.rowIds[currentSubgroup.rowIds.length - 1];
          map.set(lastId, { label: currentSubgroup.label, rowIds: currentSubgroup.rowIds });
        }
        currentSubgroup = item.group.groupKind === "subgroup"
          ? { key: item.key, label: item.group.label, rowIds: [] }
          : null; // prefix-category resets, doesn't start a subgroup
      } else if (item.type === "row" && currentSubgroup) {
        currentSubgroup.rowIds.push(item.rowId);
      }
    }
    // Finalize last subgroup
    if (currentSubgroup && currentSubgroup.rowIds.length > 0) {
      const lastId = currentSubgroup.rowIds[currentSubgroup.rowIds.length - 1];
      map.set(lastId, { label: currentSubgroup.label, rowIds: currentSubgroup.rowIds });
    }
    return map;
  }, [renderPlan]);

  const handleStartEdit = (rowId: string, value: number | undefined) => {
    setEditingRowId(rowId);
    setEditingValue(typeof value === "number" ? value.toFixed(1) : "");
  };

  const handleSaveEdit = (rowId: string) => {
    const parsed = Number.parseFloat(editingValue);
    if (!Number.isNaN(parsed) && parsed >= 0) {
      onUpdateMeasurement(rowId, parsed);
    }
    setEditingRowId(null);
  };

  return (
    <div className="rounded-sm overflow-hidden border border-foreground/30">
      <table className="w-full border-collapse text-[11px]">
        <thead className="bg-muted/80">
          <tr className="border-b border-foreground/20">
            <th className="w-10 px-1.5 py-1.5 text-center text-[9px] font-semibold print:hidden">
              <Checkbox
                checked={allRowsSelected}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onSelectAll(sectionRowIds);
                  } else {
                    onClearSelection(sectionRowIds);
                  }
                }}
                className="mx-auto h-3.5 w-3.5"
              />
            </th>
            <th className="px-1.5 py-1.5 text-left text-[9px] font-semibold">From Device</th>
            {showWireNo && (
              <th className="px-1.5 py-1.5 text-left text-[9px] font-semibold">Wire No.</th>
            )}
            {showGaugeSize && (
              <th className="px-1.5 py-1.5 text-left text-[9px] font-semibold">Gauge</th>
            )}
            {showWireId && (
              <th className="px-1.5 py-1.5 text-left text-[9px] font-semibold">Color</th>
            )}
            <th className="w-[152px] px-1.5 py-1.5 text-center text-[9px] font-semibold">Length</th>
            <th className="px-1.5 py-1.5 text-left text-[9px] font-semibold">To Device</th>
            <th className="px-1.5 py-1.5 text-left text-[9px] font-semibold">To Location</th>
            <th className="w-[120px] px-1.5 py-1.5 text-left text-[9px] font-semibold">Bundle</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={6 + (showWireNo ? 1 : 0) + (showGaugeSize ? 1 : 0) + (showWireId ? 1 : 0)} className="px-3 py-8 text-center text-sm text-muted-foreground">
                No branding rows available.
              </td>
            </tr>
          ) : renderPlan.map((item, index) => {
            if (item.type === "location-header") {
              return null;
            }

            if (item.type === "group-header") {
              if (item.group.groupKind === "prefix-category") {
                return (
                  <tr
                    key={item.key}
                    className={cn(
                      "border-b border-foreground/20 bg-muted/30",
                      index > 0 && "border-t-2 border-foreground/15",
                    )}
                  >
                    <td className="px-1.5 py-1 print:hidden" />
                    <td colSpan={5 + (showWireNo ? 1 : 0) + (showGaugeSize ? 1 : 0) + (showWireId ? 1 : 0)} className="px-1.5 py-1 align-middle">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{item.group.label}</div>
                    </td>
                  </tr>
                );
              }

              if (item.group.groupKind !== "subgroup") {
                return null;
              }

              return (
                <tr
                  key={item.key}
                  className={cn(
                    "border-b border-foreground/10 bg-muted/50",
                    index > 0 && "border-t border-foreground/20",
                  )}
                >
                  <td className="px-1.5 py-1.5 print:hidden" />
                  <td colSpan={5 + (showWireNo ? 1 : 0) + (showGaugeSize ? 1 : 0) + (showWireId ? 1 : 0)} className="px-1.5 py-1.5 align-middle text-right">
                    <div className="text-[11px] font-semibold text-foreground">{item.group.label}</div>
                  </td>
                </tr>
              );
            }

            const entry = rowsById.get(item.rowId);
            if (!entry) {
              return null;
            }

            const { row, measurement, isManual } = entry;
            const isSelected = selection.selectedIds.has(row.__rowId);
            const isEditing = editingRowId === row.__rowId;
            const swap = shouldSwapForTargetPair(row.fromDeviceId, row.toDeviceId);
            const displayFrom = swap ? row.toDeviceId : row.fromDeviceId;
            const displayTo = swap ? row.fromDeviceId : row.toDeviceId;

            return (
              <Fragment key={row.__rowId}>
                <tr
                  className={cn(
                    "border-b border-foreground/10",
                    index % 2 === 0 && "bg-muted/10",
                    item.showDeviceSeparator && "border-t-[2px] border-t-muted",
                    isSelected && "bg-muted/10",
                  )}
                  onClick={(event) => {
                    if (!(event.target as HTMLElement).closest("input, button")) {
                      onToggleSelection(row.__rowId, event.shiftKey);
                    }
                  }}
                >
                  <td className="px-1.5 py-0 text-center print:hidden">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelection(row.__rowId, false)}
                      onClick={(event) => event.stopPropagation()}
                      className="mx-auto h-3.5 w-3.5"
                    />
                  </td>
                  <td className="px-1.5 py-0 font-mono text-[11px] font-semibold">{displayFrom ? displayFrom.trim().replace(/:$/, "") : "-"}</td>
                  {showWireNo && (
                    <td className="px-1.5 py-0 font-mono text-[11px]">{row.wireNo || "-"}</td>
                  )}
                  {showGaugeSize && (
                    <td className="px-1.5 py-0 text-[11px]">{row.gaugeSize || "-"}</td>
                  )}
                  {showWireId && (
                    <td className="px-1.5 py-0 text-[11px]">{row.wireId || "-"}</td>
                  )}
                  <td className="w-[152px] px-1.5 py-0 text-[11px]">
                    <div className="print:hidden">
                      {isEditing ? (
                        <div className="mx-auto inline-grid w-[132px] grid-cols-[20px_56px_20px_24px] items-center gap-1">
                          <span className="h-5 w-5" aria-hidden="true" />
                          <Input
                            type="number"
                            step="0.5"
                            min="0"
                            value={editingValue}
                            onChange={(event) => setEditingValue(event.target.value)}
                            onBlur={() => handleSaveEdit(row.__rowId)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") handleSaveEdit(row.__rowId);
                              if (event.key === "Escape") setEditingRowId(null);
                            }}
                            className="h-7 w-14 text-center font-mono tabular-nums"
                            autoFocus
                            onClick={(event) => event.stopPropagation()}
                          />
                          <span className="h-5 w-5" aria-hidden="true" />
                          <span className="h-5 w-6" aria-hidden="true" />
                        </div>
                      ) : (
                        <div className="group mx-auto inline-grid w-[132px] grid-cols-[20px_56px_20px_24px] items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 rounded-sm border border-border bg-background px-0 text-[10px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              onAdjustMeasurement(row.__rowId, -0.5);
                            }}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <button
                            type="button"
                            className={cn(
                              "w-14 rounded-sm px-1 text-center font-mono tabular-nums hover:bg-muted hover:underline",
                              isManual && "font-semibold text-foreground",
                            )}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleStartEdit(row.__rowId, measurement);
                            }}
                          >
                            {formatBrandingMeasurement(measurement)}
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-5 w-5 rounded-sm border border-border bg-background px-0 text-[10px]"
                            onClick={(event) => {
                              event.stopPropagation();
                              onAdjustMeasurement(row.__rowId, 0.5);
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          {isManual && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-5 w-6 rounded-sm border border-border bg-background px-0 text-[9px] opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={(event) => {
                                event.stopPropagation();
                                onResetMeasurement(row.__rowId);
                              }}
                            >
                              R
                            </Button>
                          )}
                          {!isManual && (
                            <span className="h-5 w-6" aria-hidden="true" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="hidden py-1 text-center font-mono tabular-nums print:block">
                      {formatBrandingMeasurement(measurement)}
                    </div>
                  </td>
                  <td className="px-1.5 py-0 font-mono text-[11px] font-semibold">{displayTo ? displayTo.trim().replace(/:$/, "") : "-"}</td>
                  <td className="px-1.5 py-0 text-[11px]">{normalizeDisplayTitle(row.toLocation || row.fromLocation || "")}</td>
                  <td className="px-1.5 py-0 text-[11px]" />
                </tr>
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ProjectInfoHeader({
  projectInfo,
  sheetTitle,
  totalRows,
  pageNumber,
  totalPages,
}: {
  projectInfo: ProjectInfo;
  sheetTitle: string;
  totalRows: number;
  pageNumber?: number;
  totalPages?: number;
}) {
  return (
    <div className="print-header mb-5">
      {/* Top line: PD# and Project Name - Sheet Name */}
      <div className="flex items-center justify-between border-b-2 border-foreground pb-2 mb-3">
        <div className="flex items-baseline gap-3">
          {projectInfo.pdNumber && (
            <span className="text-lg font-bold tracking-tight">{projectInfo.pdNumber}</span>
          )}
          <span className="text-lg font-bold tracking-tight">
            {projectInfo.projectName ? `${projectInfo.projectName} - ${sheetTitle}` : sheetTitle}
          </span>
        </div>
        {pageNumber && totalPages && (
          <span className="print-header-page-number text-sm text-muted-foreground font-medium">
            Page {pageNumber} of {totalPages}
          </span>
        )}
      </div>

      {/* Secondary info row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 mb-3 text-sm text-muted-foreground">
        {projectInfo.unitNumber && (
          <span className="meta-item">
            <span className="font-semibold text-foreground">Unit:</span> {projectInfo.unitNumber}
          </span>
        )}
        {projectInfo.revision && (
          <span className="meta-item">
            <span className="font-semibold text-foreground">Rev:</span> {projectInfo.revision}
          </span>
        )}
        <span className="meta-item">
          <span className="font-semibold text-foreground">Rows:</span> {totalRows}
        </span>
      </div>

    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function SingleSheetPrintWorkspace({
  rows,
  blueLabels,
  currentSheetName = "",
  projectId,
  sheetSlug,
  sheetTitle = "Wire List",
  metadata,
  getRowLength,
  swsType,
  workspaceActive = true,
  onRequestClose,
  headerTitle = "Print Wire List",
  hideCloseButton = false,
  extraHeaderActions,
  initialLoadedSchema = null,
  initialMode = "standardize",
  reviewModeCompact = false,
  reviewModeShowSettings = false,
}: SingleSheetPrintWorkspaceProps) {
  const { toast } = useToast();
  const [brandingSelection, setBrandingSelection] = useState<BrandingSelectionState>(createEmptyBrandingSelection);
  const [brandingMeasurements, setBrandingMeasurements] = useState<Record<string, number | null>>({});
  const [persistedBrandingEdits, setPersistedBrandingEdits] = useState<SheetBrandingEdits>({});
  const [hasLoadedBrandingEdits, setHasLoadedBrandingEdits] = useState(false);
  const [brandingAdjustmentStep, setBrandingAdjustmentStep] = useState("0.5");
  const [brandingSetValue, setBrandingSetValue] = useState("");
  const canPersistBrandingMeasurements = Boolean(projectId && sheetSlug);
  const { currentProject, assignmentMappings } = useProjectContext();
  const { partNumberMap } = useProjectPartNumbers();
  const { blueLabelsSheet, cablePartNumberMap } = useProjectLookups();

  /** Resolve SWS type badge info for a location group by matching against assignment mappings */
  const resolveLocationSwsType = useCallback((location: string): { id: string; label: string; shortLabel: string; color?: string } | undefined => {
    if (!assignmentMappings || assignmentMappings.length === 0) return undefined;
    const normalized = location.trim().toUpperCase();
    // Exact match first
    let mapping = assignmentMappings.find(m => m.sheetName.trim().toUpperCase() === normalized);
    // Containment match
    if (!mapping) {
      let bestLength = 0;
      for (const m of assignmentMappings) {
        const sn = m.sheetName.trim().toUpperCase();
        if ((normalized.includes(sn) || sn.includes(normalized)) && sn.length > bestLength) {
          mapping = m;
          bestLength = sn.length;
        }
      }
    }
    if (!mapping) return undefined;
    const info = SWS_TYPE_REGISTRY[mapping.selectedSwsType as SwsTypeId];
    if (!info || info.id === 'UNDECIDED') return undefined;
    return { id: info.id, label: info.label, shortLabel: info.shortLabel, color: info.color };
  }, [assignmentMappings]);

  const effectiveBlueLabels = useMemo(() => {
    if (blueLabels?.isValid) {
      return blueLabels;
    }

    const parsed = parseBlueLabelSheet(blueLabelsSheet);
    return parsed.isValid ? parsed : null;
  }, [blueLabels, blueLabelsSheet]);

  // Multi-identity filter hook - manages filter selection and ordering
  const {
    getFilteredGroups,
    hasBlueLabels,
  } = useMultiIdentityFilter({
    rows,
    blueLabels: effectiveBlueLabels,
    currentSheetName,
    partNumberMap,
  });

  const [settings, setSettings] = useState<PrintSettings>(() => ({
    ...(createDefaultPrintSettings() as PrintSettings),
    mode: initialMode,
  }));
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(() => createDefaultProjectInfo({
    // Source from project API/context first. Avoid seeding from extracted sheet metadata.
    projectNumber: currentProject?.pdNumber,
    projectName: currentProject?.name,
    revision: currentProject?.revision,
    pdNumber: currentProject?.pdNumber,
    unitNumber: currentProject?.unitNumber,
  }) as ProjectInfo);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [sectionDescriptions, setSectionDescriptions] = useState<Record<string, string>>({});
  const [projectInfoOpen, setProjectInfoOpen] = useState(true);
  const [feedbackOptionsOpen, setFeedbackOptionsOpen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [printViewTab, setPrintViewTab] = useState<"wire-list" | "cross-wire">("wire-list");
  const [wiringExecutionActive, setWiringExecutionActive] = useState(false);
  const { user } = useCurrentUser();

  // Row map for wiring execution (rowId → SemanticWireListRow)
  const rowMap = useMemo(() => {
    const map = new Map<string, SemanticWireListRow>();
    for (const row of rows) {
      map.set(row.__rowId, row);
    }
    return map;
  }, [rows]);
  // Auto-fill empty project info fields when project data becomes available
  useEffect(() => {
    if (!currentProject) return;
    setProjectInfo((prev) => ({
      ...prev,
      pdNumber: prev.pdNumber || currentProject.pdNumber || "",
      projectName: prev.projectName || currentProject.name || "",
      revision: prev.revision || currentProject.revision || "",
      unitNumber: prev.unitNumber || currentProject.unitNumber || "",
      projectNumber: prev.projectNumber || currentProject.pdNumber || "",
    }));
  }, [currentProject]);

  // API-first hydration for sidebar project fields.
  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    void fetch(`/api/projects/${encodeURIComponent(projectId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        const payload = await response.json() as { manifest?: ProjectManifest };
        return payload.manifest ?? null;
      })
      .then((manifest) => {
        if (cancelled || !manifest) return;
        setProjectInfo((prev) => ({
          ...prev,
          pdNumber: manifest.pdNumber || prev.pdNumber || "",
          projectName: manifest.name || prev.projectName || "",
          revision: manifest.revision || prev.revision || "",
          unitNumber: manifest.unitNumber || prev.unitNumber || "",
          projectNumber: manifest.pdNumber || prev.projectNumber || "",
        }));
      })
      .catch(() => {
        // Keep existing sidebar values when API read fails.
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    let cancelled = false;

    setBrandingMeasurements({});

    if (!canPersistBrandingMeasurements || !projectId || !sheetSlug) {
      setPersistedBrandingEdits({});
      setHasLoadedBrandingEdits(false);
      return () => {
        cancelled = true;
      };
    }

    setHasLoadedBrandingEdits(false);

    void loadBrandingEdits(projectId, sheetSlug).then((edits) => {
      if (cancelled) {
        return;
      }

      setPersistedBrandingEdits(edits);
      setHasLoadedBrandingEdits(true);
    });

    return () => {
      cancelled = true;
    };
  }, [canPersistBrandingMeasurements, projectId, sheetSlug]);

  useEffect(() => {
    let cancelled = false;

    if (
      !canPersistBrandingMeasurements ||
      !projectId ||
      !sheetSlug ||
      !hasLoadedBrandingEdits ||
      Object.keys(brandingMeasurements).length === 0
    ) {
      return () => {
        cancelled = true;
      };
    }

    const rowMap = new Map(rows.map((row) => [row.__rowId, row]));
    const nextEdits: SheetBrandingEdits = { ...persistedBrandingEdits };

    for (const [rowId, measurement] of Object.entries(brandingMeasurements)) {
      const row = rowMap.get(rowId);
      if (!row) {
        continue;
      }

      if (typeof measurement === "number") {
        const nextEdit = createBrandingEditDraft(nextEdits[rowId], row, Math.max(0, measurement));
        if (nextEdit) {
          nextEdits[rowId] = nextEdit;
        }
        continue;
      }

      const nextEdit = createBrandingEditDraft(nextEdits[rowId], row, undefined);
      if (nextEdit) {
        delete nextEdit.length;
        delete nextEdit.lengthAdjustment;
        nextEdits[rowId] = nextEdit;
      } else {
        delete nextEdits[rowId];
      }
    }

    void saveBrandingEdits(projectId, sheetSlug, nextEdits).then((saved) => {
      if (cancelled || !saved) {
        return;
      }

      setPersistedBrandingEdits(nextEdits);
      setBrandingMeasurements({});
    });

    return () => {
      cancelled = true;
    };
  }, [
    brandingMeasurements,
    canPersistBrandingMeasurements,
    hasLoadedBrandingEdits,
    persistedBrandingEdits,
    projectId,
    rows,
    sheetSlug,
  ]);

  // Handle section description change
  const handleDescriptionChange = useCallback((sectionLabel: string, value: string) => {
    setSectionDescriptions(prev => ({ ...prev, [sectionLabel]: value }));
  }, []);
  const printRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const brandingToastShownRef = useRef(false);

  const parsedBrandingAdjustmentStep = useMemo(() => {
    const parsed = Number.parseFloat(brandingAdjustmentStep);
    return !Number.isNaN(parsed) && parsed > 0 ? parsed : 0.5;
  }, [brandingAdjustmentStep]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (workspaceActive) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [workspaceActive]);

  // Handle comment change
  const handleCommentChange = useCallback((rowId: string, value: string) => {
    setComments(prev => ({ ...prev, [rowId]: value }));
  }, []);

  // Toggle section enabled state
  const toggleSection = useCallback((section: JumperSection) => {
    setSettings(prev => {
      const current = prev.enabledSections;
      const newEnabled = current.includes(section)
        ? current.filter(s => s !== section)
        : [...current, section];
      return { ...prev, enabledSections: newEnabled };
    });
  }, []);

  // Move section up in order
  const moveSectionUp = useCallback((section: JumperSection) => {
    setSettings(prev => {
      const order = [...prev.sectionOrder];
      const idx = order.indexOf(section);
      if (idx > 0) {
        [order[idx - 1], order[idx]] = [order[idx], order[idx - 1]];
      }
      return { ...prev, sectionOrder: order };
    });
  }, []);

  // Move section down in order
  const moveSectionDown = useCallback((section: JumperSection) => {
    setSettings(prev => {
      const order = [...prev.sectionOrder];
      const idx = order.indexOf(section);
      if (idx < order.length - 1) {
        [order[idx], order[idx + 1]] = [order[idx + 1], order[idx]];
      }
      return { ...prev, sectionOrder: order };
    });
  }, []);

  // Toggle feedback subsection enabled state
  const toggleFeedbackSection = useCallback((sectionId: string) => {
    setSettings(prev => {
      const newSections = prev.feedbackSections.map(s =>
        s.id === sectionId ? { ...s, enabled: !s.enabled } : s
      );
      return { ...prev, feedbackSections: newSections };
    });
  }, []);

  // Toggle individual question visibility
  const toggleQuestion = useCallback((questionKey: string) => {
    setSettings(prev => {
      const question = prev.customQuestions[questionKey];
      if (!question) return prev;
      return {
        ...prev,
        customQuestions: {
          ...prev.customQuestions,
          [questionKey]: { ...question, enabled: !question.enabled }
        }
      };
    });
  }, []);

  // Update question label
  const updateQuestionLabel = useCallback((questionKey: string, newLabel: string) => {
    setSettings(prev => {
      const question = prev.customQuestions[questionKey];
      if (!question) return prev;
      return {
        ...prev,
        customQuestions: {
          ...prev.customQuestions,
          [questionKey]: { ...question, label: newLabel }
        }
      };
    });
  }, []);

  // Add custom question to a section
  const addCustomQuestion = useCallback((sectionId: string) => {
    const customKey = `custom_${Date.now()}`;
    setSettings(prev => ({
      ...prev,
      customQuestions: {
        ...prev.customQuestions,
        [customKey]: {
          key: customKey,
          label: "New Question?",
          type: "boolean",
          enabled: true,
          sectionId,
          isCustom: true,
        }
      }
    }));
  }, []);

  // Remove custom question
  const removeCustomQuestion = useCallback((questionKey: string) => {
    setSettings(prev => {
      const { [questionKey]: removed, ...rest } = prev.customQuestions;
      return { ...prev, customQuestions: rest };
    });
  }, []);

  // Get questions for a feedback section (built-in + custom)
  const getQuestionsForSection = useCallback((sectionId: string) => {
    return Object.values(settings.customQuestions).filter(q => q.sectionId === sectionId);
  }, [settings.customQuestions]);

  // Track which feedback sections are expanded for question editing
  const [expandedFeedbackSections, setExpandedFeedbackSections] = useState<Set<string>>(new Set());

  const toggleFeedbackSectionExpanded = useCallback((sectionId: string) => {
    setExpandedFeedbackSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  // Build pattern extraction context
  const extractionContext = useMemo(() => ({
    rows,
    blueLabels: effectiveBlueLabels,
    currentSheetName,
    normalizedSheetName: currentSheetName.toUpperCase().trim(),
    partNumberMap,
  }), [rows, effectiveBlueLabels, currentSheetName, partNumberMap]);

  const singleConnectionRowIds = useMemo(
    () => new Set(extractSingleConnections(extractionContext).map((match) => match.row.__rowId)),
    [extractionContext],
  );

  // Section labels for display
  const sectionLabels: Record<JumperSection, string> = {
    grounds: "Ground Wires (GRN/YEL)",
    clips: "Clips",
    ka_relay_plugin_jumpers: "Relay Mechanical Jumpers (A1, A2)",
    vio_jumpers: "VIO Jumpers",
    resistors: "Resistors (LEAD)",
    ka_jumpers: "KA Jumpers",
    ka_twin_ferrule: "KA Twin Ferrule",
    kt_jumpers: "KT Jumpers",
    fu_jumpers: "FU Jumpers",
    af_jumpers: "AF/AU Jumpers",
    single_connections: "Single Connections",
    cables: "Cables",
  };

  // Default section descriptions for instructional content
  const defaultSectionDescriptions: Record<string, string> = {
    "Ground Wires (GRN/YEL)": "Connect ground wires from source to destination. Verify proper gauge and continuity.",
    "Clips": "Install clips according to location specifications. Check for secure fastening.",
    "Relay Mechanical Jumpers (A1/ESTOP, A2/0V)": "Install relay mechanical jumper bars for A1 (ESTOP) and A2 (0V) circuits. Devices in sequence order.",
    "KA Jumpers": "Route KA jumpers as indicated. Maintain proper wire dress.",
    "KA Twin Ferrule": "Install twin ferrule connections per specification. Same wire number, multiple destinations.",
    "KT Jumpers": "Connect KT jumpers between terminal blocks.",
    "FU Jumpers": "Install fuse jumpers. Verify fuse ratings match requirements.",
    "AF Jumpers": "Route AF jumpers as shown. Verify connections.",
    "AU Jumpers": "Connect AU jumpers per wiring diagram.",
    "VIO Jumpers": "Connect VIO identity jumpers per wiring diagram.",
    "Resistors (LEAD)": "Install resistor leads (LEAD wire ID) per wiring diagram. Typically RR device prefix.",
    "Single Connections": "Individual wires not part of other identity groups. Sorted by location.",
    "Cables": "Route cables through designated pathways. Secure with cable ties at intervals.",
  };

  // Detect which sections have matching rows in the data
  const availableSections = useMemo(() => {
    const available = new Set<JumperSection>();

    // Check grounds
    const groundMatches = extractGrounds(extractionContext);
    if (groundMatches.length > 0) available.add("grounds");

    // Check clips
    const clipMatches = extractClips(extractionContext);
    if (clipMatches.length > 0) available.add("clips");

    // Check Relay Mechanical Jumpers (A1/ESTOP, A2/0V) - must be checked BEFORE twin ferrules
    const kaPluginMatches = extractKaRelayPluginJumperRows(extractionContext);
    if (kaPluginMatches.length > 0) available.add("ka_relay_plugin_jumpers");

    // Check KA jumpers (excluding plugin jumpers)
    const kaMatches = extractKaJumpers(extractionContext);
    if (kaMatches.length > 0) available.add("ka_jumpers");

    // Check KA Twin Ferrule (uses proper extraction, excludes ESTOP/0V)
    const kaTwinMatches = extractKaTwinFerrules(extractionContext);
    if (kaTwinMatches.length > 0) available.add("ka_twin_ferrule");

    // Check KT jumpers
    const ktMatches = extractKtJumpers(extractionContext);
    if (ktMatches.length > 0) available.add("kt_jumpers");

    // Check FU jumpers
    const fuMatches = extractFuJumpers(extractionContext);
    if (fuMatches.length > 0) available.add("fu_jumpers");

    // Check AF/AU jumpers
    const afMatches = extractAfJumpers(extractionContext);
    if (afMatches.length > 0) available.add("af_jumpers");

    // Check VIO jumpers (Wire ID = "VIO")
    const hasVIO = rows.some(r => (r.wireId || "").trim().toUpperCase() === "VIO");
    if (hasVIO) available.add("vio_jumpers");

    // Check resistors (Wire ID = "LEAD" or device prefix RR/VD)
    const hasResistors = rows.some(r => isResistorRow(
      (r.wireId || "").trim(),
      (r.fromDeviceId || "").trim(),
      (r.toDeviceId || "").trim(),
    ));
    if (hasResistors) available.add("resistors");

    // Check single connections - rows not matching other identity groups
    const singleMatches = extractSingleConnections(extractionContext);
    if (singleMatches.length > 0) available.add("single_connections");

    // Check cables
    const cableMatches = extractCables(extractionContext);
    if (cableMatches.length > 0) available.add("cables");

    return available;
  }, [extractionContext]);

  // Helper to check if a row is a cable (typically has "CABLE" in wire type or specific identifiers)
  const isCableRow = (row: SemanticWireListRow): boolean => {
    const wireId = (row.wireId || "").toUpperCase();
    const wireNo = (row.wireNo || "").toUpperCase();
    const type = (row.wireType || "").toUpperCase();
    return wireId.includes("CABLE") || wireNo.includes("CABLE") || type === "CABLE" || type === "CBL";
  };

  // Helper to group rows by device family connection (for example KA:A1 -> XT)
  // Enhanced: Groups by location within each device mapping, sorts by gauge (smallest first)
  // Cable rows are separated and rendered last
  const groupByDeviceConnection = (wireRows: SemanticWireListRow[]): PrintSection[] => {
    // Separate cable rows from regular wires
    const regularRows = wireRows.filter(r => !isCableRow(r));
    const cableRows = wireRows.filter(r => isCableRow(r));

    const groups = new Map<string, SemanticWireListRow[]>();

    for (const row of regularRows) {
      const fromDeviceGroup = getSingleConnectionDeviceGroup(row.fromDeviceId);
      const toDeviceGroup = getSingleConnectionDeviceGroup(row.toDeviceId);
      const key = `${fromDeviceGroup} → ${toDeviceGroup}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(row);
    }

    // Sort groups by the from prefix, then to prefix
    const sortedKeys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

    const sections: PrintSection[] = sortedKeys.map(key => {
      const groupRows = groups.get(key)!;

      // Group by location within this device mapping
      const locationMap = new Map<string, SemanticWireListRow[]>();
      for (const row of groupRows) {
        const loc = row.toLocation || row.fromLocation || "Unknown";
        if (!locationMap.has(loc)) {
          locationMap.set(loc, []);
        }
        locationMap.get(loc)!.push(row);
      }

      // Sort locations: current sheet location first, then alphabetically
      const sortedLocations = Array.from(locationMap.keys()).sort((a, b) => {
        const aIsCurrent = a.toUpperCase().includes(currentSheetName.toUpperCase());
        const bIsCurrent = b.toUpperCase().includes(currentSheetName.toUpperCase());
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;
        return a.localeCompare(b);
      });

      // Build location subgroups, each sorted by gauge (smallest first)
      const locationSubgroups = sortedLocations.map(loc => ({
        location: loc,
        rows: sortRowsByGaugeSize([...locationMap.get(loc)!], "smallest-first"),
      }));

      // Flatten for the main rows array (already sorted)
      const allSortedRows = locationSubgroups.flatMap(lg => lg.rows);

      return {
        label: `${key} (${countNonDeviceChangeRows(groupRows)})`,
        rows: allSortedRows,
        locationSubgroups,
        description: "", // Default empty description, editable by user
        primaryLocation: locationSubgroups[0]?.location || "",
      };
    });

    // Add cable rows as a separate section at the end, grouped by location
    if (cableRows.length > 0) {
      const cableLocationMap = new Map<string, SemanticWireListRow[]>();
      for (const row of cableRows) {
        const loc = row.toLocation || row.fromLocation || "Unknown";
        if (!cableLocationMap.has(loc)) {
          cableLocationMap.set(loc, []);
        }
        cableLocationMap.get(loc)!.push(row);
      }

      const sortedCableLocations = Array.from(cableLocationMap.keys()).sort((a, b) => {
        const aIsCurrent = a.toUpperCase().includes(currentSheetName.toUpperCase());
        const bIsCurrent = b.toUpperCase().includes(currentSheetName.toUpperCase());
        if (aIsCurrent && !bIsCurrent) return -1;
        if (!aIsCurrent && bIsCurrent) return 1;
        return a.localeCompare(b);
      });

      // Sort cable rows by type (WC####) first, then by device ID
      const sortCableRowsByType = (rows: SemanticWireListRow[]) => {
        return [...rows].sort((a, b) => {
          const typeA = (a.wireType || "").toUpperCase().trim();
          const typeB = (b.wireType || "").toUpperCase().trim();
          const typeCompare = typeA.localeCompare(typeB);
          if (typeCompare !== 0) return typeCompare;
          return (a.fromDeviceId || "").localeCompare(b.fromDeviceId || "");
        });
      };

      const cableLocationSubgroups = sortedCableLocations.map(loc => ({
        location: loc,
        rows: sortCableRowsByType(cableLocationMap.get(loc)!),
      }));

      sections.push({
        label: `Cables (${countNonDeviceChangeRows(cableRows)})`,
        rows: cableLocationSubgroups.flatMap(lg => lg.rows),
        locationSubgroups: cableLocationSubgroups,
        description: "",
        sectionKind: "cables",
        primaryLocation: cableLocationSubgroups[0]?.location || "",
      });
    }

    return sections;
  };

  // Process rows based on settings - ensure no duplicates
  // Always applies: smallest-to-largest sorting, same-location-first grouping
  const processedRows = useMemo((): PrintSection[] => {
    // Apply default sorting: smallest to largest gauge
    let sorted = sortRowsByGaugeSize([...rows], "smallest-first");

    // Apply default grouping: same location first
    const sameLocationRows = sorted.filter(
      r => r.location?.toUpperCase().includes(currentSheetName.toUpperCase())
    );
    const otherLocationRows = sorted.filter(
      r => !r.location?.toUpperCase().includes(currentSheetName.toUpperCase())
    );
    sorted = [...sameLocationRows, ...otherLocationRows];

    if (settings.mode === "standardize") {
      // Use the multi-identity filter hook to get grouped and ordered sections
      const filterGroups = getFilteredGroups();
      const sections: PrintSection[] = [];
      const usedRowIds = new Set<string>();

      // Process each filter group from the multi-identity filter (in user-defined order)
      for (const group of filterGroups) {
        const sectionRows = group.rows.filter(r => !usedRowIds.has(r.__rowId));
        sectionRows.forEach(r => usedRowIds.add(r.__rowId));

        if (sectionRows.length > 0) {
          // Create location subgroups for each section (use toLocation as primary)
          const locMap = new Map<string, SemanticWireListRow[]>();
          for (const row of sectionRows) {
            const loc = row.toLocation || row.fromLocation || "Unknown";
            if (!locMap.has(loc)) locMap.set(loc, []);
            locMap.get(loc)!.push(row);
          }

          // Sort locations: current sheet location first, then alphabetically
          const sortedLocations = Array.from(locMap.entries())
            .sort(([a], [b]) => {
              const aIsCurrent = a.toUpperCase().includes(currentSheetName.toUpperCase());
              const bIsCurrent = b.toUpperCase().includes(currentSheetName.toUpperCase());
              if (aIsCurrent && !bIsCurrent) return -1;
              if (!aIsCurrent && bIsCurrent) return 1;
              return a.localeCompare(b);
            });

          // Create a separate section for EACH location within this identity group
          for (const [location, locRows] of sortedLocations) {
            const sortedLocRows = sortRowsForPrintSubsection(
              [...locRows],
              currentSheetName,
              group.kind,
              group.matchMetadata,
              partNumberMap,
              effectiveBlueLabels,
              settings.wireListSortMode,
            );
            const rowCount = countNonDeviceChangeRows(sortedLocRows);

            // Determine if this is an external location (doesn't match current sheet)
            const isExternal = !location.toUpperCase().includes(currentSheetName.toUpperCase());

            // Include location in label for unique identification
            const locationSuffix = sortedLocations.length > 1 ? ` - ${location}` : "";

            sections.push({
              label: `${group.label}${locationSuffix} (${rowCount})`,
              rows: sortedLocRows,
              locationSubgroups: [{ location, rows: sortedLocRows }],
              description: "",
              sectionKind: group.kind,
              primaryLocation: location,
              isExternal,
            });
          }
        }
      }

      // Remaining wires that don't match any section - group by device connection
      // Cables are automatically moved to the end by groupByDeviceConnection
      const remaining = sorted.filter(
        (row) => !usedRowIds.has(row.__rowId) && singleConnectionRowIds.has(row.__rowId),
      );
      if (remaining.length > 0) {
        const deviceGroups = groupByDeviceConnection(remaining);
        for (const group of deviceGroups) {
          sections.push(group);
        }
      }

      return sections;
    } else {
      let filtered = sorted;

      if (settings.customSettings.sortByGauge !== "none") {
        filtered = sortRowsByGaugeSize(filtered, settings.customSettings.sortByGauge);
      }

      if (settings.customSettings.groupByLocation) {
        const locationGroups = new Map<string, SemanticWireListRow[]>();
        for (const row of filtered) {
          const loc = row.toLocation || row.fromLocation || "Unknown";
          if (!locationGroups.has(loc)) {
            locationGroups.set(loc, []);
          }
          locationGroups.get(loc)!.push(row);
        }

        const sections: PrintSection[] = [];
        for (const [loc, locRows] of locationGroups) {
          sections.push({
            label: `Location: ${loc}`,
            rows: sortRowsForPrintSubsection([...locRows], currentSheetName, undefined, {}, partNumberMap, effectiveBlueLabels, settings.wireListSortMode),
            description: "",
          });
        }
        return sections;
      }

      // For custom mode without location grouping, just return as single section
      return [{ label: "", rows: filtered, description: "" }];
    }
  }, [rows, settings, extractionContext, currentSheetName, getFilteredGroups, partNumberMap, singleConnectionRowIds]);

  const totalRowCount = useMemo(() =>
    processedRows.reduce((sum, section) => sum + countNonDeviceChangeRows(section.rows), 0),
    [processedRows]
  );

  // ── Schema-driven render mode (state + hydration) ────────────────────
  const [loadedSchema, setLoadedSchema] = useState<WireListPrintSchema | null>(initialLoadedSchema);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);

  const schemaHydration = useMemo(() => {
    if (!loadedSchema) return null;
    return hydrateSchemaForRender(loadedSchema);
  }, [loadedSchema]);

  useEffect(() => {
    setLoadedSchema(initialLoadedSchema);
  }, [initialLoadedSchema]);

  useEffect(() => {
    setSettings((prev) => (prev.mode === initialMode ? prev : { ...prev, mode: initialMode }));
  }, [initialMode]);

  const effectiveGetRowLength = useCallback(
    (rowId: string) => schemaHydration?.rowLengthsById?.[rowId] ?? getRowLength?.(rowId) ?? null,
    [getRowLength, schemaHydration?.rowLengthsById],
  );

  const brandingPreviewRows = useMemo((): BrandingPreviewRow[] => {
    const sorted = sortRowsByGaugeSize([...rows], "smallest-first");
    const sameLocationRows = sorted.filter(
      (row) => row.location?.toUpperCase().includes(currentSheetName.toUpperCase()),
    );
    const otherLocationRows = sorted.filter(
      (row) => !row.location?.toUpperCase().includes(currentSheetName.toUpperCase()),
    );

    return filterEmptyDeviceChangeSections([...sameLocationRows, ...otherLocationRows])
      .filter((row) => !detectDeviceChange(row).isDeviceChange)
      .map((row) => {
        const baseLength = effectiveGetRowLength(row.__rowId)?.roundedInches;
        const localMeasurement = brandingMeasurements[row.__rowId];
        const persistedEdit = persistedBrandingEdits[row.__rowId];
        const persistedLength = typeof persistedEdit?.length === "number"
          ? persistedEdit.length
          : typeof persistedEdit?.lengthAdjustment === "number" && typeof baseLength === "number"
            ? Math.max(0, baseLength + persistedEdit.lengthAdjustment)
            : undefined;
        const overrideLength = Object.prototype.hasOwnProperty.call(brandingMeasurements, row.__rowId)
          ? localMeasurement ?? baseLength
          : persistedLength;
        const location = row.toLocation || row.fromLocation || row.location || "-";
        const normalizedSheetName = currentSheetName.toUpperCase().trim();

        return {
          row,
          baseLength,
          measurement: typeof overrideLength === "number" ? overrideLength : baseLength,
          isManual: Object.prototype.hasOwnProperty.call(brandingMeasurements, row.__rowId)
            ? typeof localMeasurement === "number"
            : typeof persistedLength === "number",
          location,
          isExternal: Boolean(normalizedSheetName) && !location.toUpperCase().includes(normalizedSheetName),
        };
      });
  }, [brandingMeasurements, currentSheetName, effectiveGetRowLength, persistedBrandingEdits, rows]);

  const brandingPreviewRowMap = useMemo(
    () => new Map(brandingPreviewRows.map((entry) => [entry.row.__rowId, entry])),
    [brandingPreviewRows],
  );

  useEffect(() => {
    setBrandingSelection((prev) => {
      const validIds = new Set(brandingPreviewRows.map((entry) => entry.row.__rowId));
      const nextSelectedIds = new Set(
        [...prev.selectedIds].filter((rowId) => validIds.has(rowId)),
      );
      const nextLastSelectedId = prev.lastSelectedId && validIds.has(prev.lastSelectedId)
        ? prev.lastSelectedId
        : null;
      const allSelected = brandingPreviewRows.length > 0 && nextSelectedIds.size === brandingPreviewRows.length;

      if (
        nextSelectedIds.size === prev.selectedIds.size &&
        nextLastSelectedId === prev.lastSelectedId &&
        allSelected === prev.allSelected
      ) {
        return prev;
      }

      return {
        selectedIds: nextSelectedIds,
        lastSelectedId: nextLastSelectedId,
        allSelected,
      };
    });
  }, [brandingPreviewRows]);

  const toggleBrandingSelection = useCallback((rowId: string, shiftKey = false) => {
    setBrandingSelection((prev) => {
      const nextSelectedIds = new Set(prev.selectedIds);

      if (shiftKey && prev.lastSelectedId) {
        const orderedIds = brandingPreviewRows.map((entry) => entry.row.__rowId);
        const lastIndex = orderedIds.indexOf(prev.lastSelectedId);
        const currentIndex = orderedIds.indexOf(rowId);

        if (lastIndex >= 0 && currentIndex >= 0) {
          const start = Math.min(lastIndex, currentIndex);
          const end = Math.max(lastIndex, currentIndex);
          for (let index = start; index <= end; index++) {
            nextSelectedIds.add(orderedIds[index]);
          }
        }
      } else if (nextSelectedIds.has(rowId)) {
        nextSelectedIds.delete(rowId);
      } else {
        nextSelectedIds.add(rowId);
      }

      return {
        selectedIds: nextSelectedIds,
        lastSelectedId: rowId,
        allSelected: brandingPreviewRows.length > 0 && nextSelectedIds.size === brandingPreviewRows.length,
      };
    });
  }, [brandingPreviewRows]);

  const selectAllBrandingRows = useCallback(() => {
    setBrandingSelection({
      selectedIds: new Set(brandingPreviewRows.map((entry) => entry.row.__rowId)),
      lastSelectedId: brandingPreviewRows.at(-1)?.row.__rowId ?? null,
      allSelected: brandingPreviewRows.length > 0,
    });
  }, [brandingPreviewRows]);

  const selectBrandingRows = useCallback((rowIds: string[]) => {
    setBrandingSelection((prev) => {
      const nextSelectedIds = new Set(prev.selectedIds);
      for (const rowId of rowIds) {
        nextSelectedIds.add(rowId);
      }

      const lastSelectedId = rowIds.at(-1) ?? prev.lastSelectedId;

      return {
        selectedIds: nextSelectedIds,
        lastSelectedId,
        allSelected: brandingPreviewRows.length > 0 && nextSelectedIds.size === brandingPreviewRows.length,
      };
    });
  }, [brandingPreviewRows]);

  const clearBrandingSelection = useCallback((rowIds?: string[]) => {
    if (!rowIds || rowIds.length === 0) {
      setBrandingSelection(createEmptyBrandingSelection());
      return;
    }

    setBrandingSelection((prev) => {
      const nextSelectedIds = new Set(prev.selectedIds);
      for (const rowId of rowIds) {
        nextSelectedIds.delete(rowId);
      }

      const lastSelectedId = prev.lastSelectedId && nextSelectedIds.has(prev.lastSelectedId)
        ? prev.lastSelectedId
        : null;

      return {
        selectedIds: nextSelectedIds,
        lastSelectedId,
        allSelected: brandingPreviewRows.length > 0 && nextSelectedIds.size === brandingPreviewRows.length,
      };
    });
  }, [brandingPreviewRows]);

  const updateBrandingMeasurement = useCallback((rowId: string, value: number) => {
    setBrandingMeasurements((prev) => ({
      ...prev,
      [rowId]: Math.max(0, value),
    }));
  }, []);

  const updateBrandingMeasurementWithFeedback = useCallback((rowId: string, value: number) => {
    const nextValue = Math.max(0, value);
    updateBrandingMeasurement(rowId, nextValue);

    const row = brandingPreviewRowMap.get(rowId)?.row;
    toast({
      title: "Measurement updated",
      description: `${row?.fromDeviceId || rowId} set to ${nextValue.toFixed(1)}`,
      duration: 2500,
    });
  }, [brandingPreviewRowMap, toast, updateBrandingMeasurement]);

  const adjustBrandingMeasurementWithFeedback = useCallback((rowId: string, delta: number) => {
    const currentValue = brandingPreviewRowMap.get(rowId)?.measurement ?? 0;
    const nextValue = Math.max(0, currentValue + delta);
    updateBrandingMeasurement(rowId, nextValue);

    const row = brandingPreviewRowMap.get(rowId)?.row;
    toast({
      title: delta >= 0 ? "Measurement increased" : "Measurement decreased",
      description: `${row?.fromDeviceId || rowId} now ${nextValue.toFixed(1)}`,
      duration: 2200,
    });
  }, [brandingPreviewRowMap, toast, updateBrandingMeasurement]);

  const resetBrandingMeasurement = useCallback((rowId: string) => {
    setBrandingMeasurements((prev) => {
      const next = { ...prev };
      if (canPersistBrandingMeasurements) {
        next[rowId] = null;
      } else {
        delete next[rowId];
      }
      return next;
    });
  }, [canPersistBrandingMeasurements]);

  const resetBrandingMeasurementWithFeedback = useCallback((rowId: string) => {
    resetBrandingMeasurement(rowId);
    const row = brandingPreviewRowMap.get(rowId)?.row;
    toast({
      title: "Measurement reset",
      description: `${row?.fromDeviceId || rowId} restored to computed value`,
      duration: 2200,
    });
  }, [brandingPreviewRowMap, resetBrandingMeasurement, toast]);

  const updateSelectedBrandingMeasurements = useCallback((delta: number) => {
    if (brandingSelection.selectedIds.size === 0) {
      return;
    }

    setBrandingMeasurements((prev) => {
      const next = { ...prev };

      for (const rowId of brandingSelection.selectedIds) {
        const currentMeasurement = typeof next[rowId] === "number"
          ? next[rowId]
          : brandingPreviewRowMap.get(rowId)?.measurement;

        next[rowId] = Math.max(0, (currentMeasurement ?? 0) + delta);
      }

      return next;
    });

    toast({
      title: delta >= 0 ? "Measurements increased" : "Measurements decreased",
      description: `${brandingSelection.selectedIds.size} row${brandingSelection.selectedIds.size === 1 ? "" : "s"} updated by ${Math.abs(delta).toFixed(2)}`,
      duration: 2500,
    });
  }, [brandingPreviewRowMap, brandingSelection.selectedIds, toast]);

  const setSelectedBrandingMeasurements = useCallback(() => {
    if (brandingSelection.selectedIds.size === 0) {
      return;
    }

    const parsed = Number.parseFloat(brandingSetValue);
    if (Number.isNaN(parsed) || parsed < 0) {
      return;
    }

    setBrandingMeasurements((prev) => {
      const next = { ...prev };
      for (const rowId of brandingSelection.selectedIds) {
        next[rowId] = parsed;
      }
      return next;
    });

    toast({
      title: "Measurements applied",
      description: `${brandingSelection.selectedIds.size} row${brandingSelection.selectedIds.size === 1 ? "" : "s"} set to ${parsed.toFixed(1)}`,
      duration: 2500,
    });
  }, [brandingSelection.selectedIds, brandingSetValue, toast]);

  const resetSelectedBrandingMeasurements = useCallback(() => {
    if (brandingSelection.selectedIds.size === 0) {
      return;
    }

    setBrandingMeasurements((prev) => {
      const next = { ...prev };
      for (const rowId of brandingSelection.selectedIds) {
        if (canPersistBrandingMeasurements) {
          next[rowId] = null;
        } else {
          delete next[rowId];
        }
      }
      return next;
    });

    toast({
      title: "Measurements reset",
      description: `${brandingSelection.selectedIds.size} row${brandingSelection.selectedIds.size === 1 ? "" : "s"} restored to computed values`,
      duration: 2500,
    });
  }, [brandingSelection.selectedIds, canPersistBrandingMeasurements, toast]);

  const effectivePartNumberMap = schemaHydration?.partNumberMap ?? partNumberMap;

  // Pre-compute locationBoxSideByName for use in both location groups and context
  const locationBoxSideByName = useMemo(() => {
    return assignmentMappings.reduce<Record<string, string>>((acc, mapping) => {
      const sheetNameKey = mapping.sheetName?.trim().toUpperCase();
      const mappedBoxSide = currentProject?.assignments?.[mapping.sheetSlug]?.boxSide;
      if (sheetNameKey && mappedBoxSide) {
        acc[sheetNameKey] = mappedBoxSide;
      }
      return acc;
    }, {});
  }, [assignmentMappings, currentProject?.assignments]);

  // Compute locationNormalizedTitleByName for display in location columns
  const locationNormalizedTitleByName = useMemo(() => {
    return assignmentMappings.reduce<Record<string, string>>((acc, mapping) => {
      const normalizedTitle = currentProject?.assignments?.[mapping.sheetSlug]?.normalizedTitle;
      if (!normalizedTitle) {
        return acc;
      }

      const baseKeys = new Set<string>([
        ...getLocationLookupKeys(mapping.sheetName),
        ...getLocationLookupKeys(mapping.sheetSlug),
      ]);

      const normalizedTitleLabel = normalizeDisplayTitle(normalizedTitle);
      baseKeys.add(normalizedTitleLabel.toUpperCase());

      // Alias short panel locations (e.g. "B") to the assignment normalized title.
      const panelAliasMatch = normalizedTitleLabel.match(/^PNL\s+([A-Z0-9]+)/);
      if (panelAliasMatch?.[1]) {
        baseKeys.add(panelAliasMatch[1].toUpperCase());
      }

      for (const key of baseKeys) {
        if (key) {
          acc[key] = normalizedTitleLabel;
        }
      }

      return acc;
    }, {});
  }, [assignmentMappings, currentProject?.assignments]);

  // Print preview should follow the same section membership as the live identity filter.
  // When a saved schema is loaded, use its hydrated groups instead.
  const processedLocationGroups = useMemo((): PrintLocationGroup[] => {
    if (schemaHydration) return schemaHydration.processedLocationGroups;
    return buildProcessedPrintLocationGroups({
      rows,
      mode: settings.mode,
      enabledSections: settings.enabledSections,
      sectionOrder: settings.sectionOrder,
      currentSheetName,
      blueLabels: effectiveBlueLabels,
      partNumberMap: effectivePartNumberMap,
      sortMode: settings.mode === "branding" ? settings.brandingSortMode : settings.wireListSortMode,
      locationBoxSideByName,
      locationNormalizedTitleByName,
    }) as PrintLocationGroup[];
  }, [schemaHydration, rows, settings.mode, settings.enabledSections, settings.sectionOrder, settings.brandingSortMode, settings.wireListSortMode, currentSheetName, effectiveBlueLabels, effectivePartNumberMap, locationBoxSideByName, locationNormalizedTitleByName]);

  const externalSectionContext = useMemo(() => ({
    locationBoxSideByName,
    locationNormalizedTitleByName,
    currentBoxSide: sheetSlug
      ? currentProject?.assignments?.[sheetSlug]?.boxSide
      : undefined,
    assignmentMappings: assignmentMappings.length > 0 ? assignmentMappings : undefined,
    currentSheetName,
    internalRows: rows,
    partNumberMap: effectivePartNumberMap,
    externalLocationConfig: sheetSlug
      ? (currentProject?.assignments?.[sheetSlug]?.externalLocations ?? undefined)
      : undefined,
  }), [assignmentMappings, currentSheetName, rows, effectivePartNumberMap, sheetSlug, currentProject]);

  const defaultBrandingHiddenSections = useMemo(() => {
    return buildDefaultBrandingHiddenSections(processedLocationGroups as never, externalSectionContext);
  }, [processedLocationGroups, externalSectionContext]);

  const defaultStandardHiddenSections = useMemo(() => {
    return buildDefaultStandardHiddenSections(processedLocationGroups as never, externalSectionContext);
  }, [processedLocationGroups, externalSectionContext]);

  const activeHiddenSections = useMemo(() => {
    return resolveActiveHiddenSections({
      mode: settings.mode,
      standardHiddenSections: settings.standardHiddenSections,
      standardHiddenSectionsCustomized: settings.standardHiddenSectionsCustomized,
      brandingHiddenSections: settings.brandingHiddenSections,
      brandingHiddenSectionsCustomized: settings.brandingHiddenSectionsCustomized,
      defaultBrandingHiddenSections,
      defaultStandardHiddenSections,
    });
  }, [
    defaultBrandingHiddenSections,
    defaultStandardHiddenSections,
    settings.brandingHiddenSections,
    settings.brandingHiddenSectionsCustomized,
    settings.standardHiddenSectionsCustomized,
    settings.mode,
    settings.standardHiddenSections,
  ]);

  const updateActiveHiddenSections = useCallback(
    (nextHiddenSections: Set<string> | ((current: Set<string>) => Set<string>)) => {
      setSettings((prev) => {
        const currentHiddenSections = prev.mode === "branding"
          ? (prev.brandingHiddenSectionsCustomized ? prev.brandingHiddenSections : defaultBrandingHiddenSections)
          : (prev.standardHiddenSectionsCustomized ? prev.standardHiddenSections : defaultStandardHiddenSections);
        const resolvedHiddenSections = nextHiddenSections instanceof Set
          ? nextHiddenSections
          : nextHiddenSections(new Set(currentHiddenSections));

        if (prev.mode === "branding") {
          return {
            ...prev,
            brandingHiddenSections: new Set(resolvedHiddenSections),
            brandingHiddenSectionsCustomized: true,
          };
        }

        return {
          ...prev,
          standardHiddenSections: new Set(resolvedHiddenSections),
          standardHiddenSectionsCustomized: true,
        };
      });
    },
    [defaultBrandingHiddenSections, defaultStandardHiddenSections],
  );

  const updateSectionColumnVisibility = useCallback(
    (
      sectionLabel: string | undefined,
      sectionKind: IdentificationFilterKind | undefined,
      columnKey: keyof SectionColumnVisibility,
      isVisible: boolean,
    ) => {
      setSettings((prev) => {
        const sectionKey = getSectionColumnVisibilityKey(sectionLabel, sectionKind);
        const currentColumns = getEffectiveSectionColumns(prev.sectionColumnVisibility, sectionLabel, sectionKind);
        const nextColumns: SectionColumnVisibility = {
          ...currentColumns,
          [columnKey]: isVisible,
        };
        const defaultColumns = getDefaultSectionColumns(sectionKind);
        const matchesDefaults = (Object.keys(defaultColumns) as Array<keyof SectionColumnVisibility>)
          .every((key) => nextColumns[key] === defaultColumns[key]);
        const nextSectionColumnVisibility = { ...prev.sectionColumnVisibility };

        if (matchesDefaults) {
          delete nextSectionColumnVisibility[sectionKey];
        } else {
          nextSectionColumnVisibility[sectionKey] = nextColumns;
        }

        return {
          ...prev,
          sectionColumnVisibility: nextSectionColumnVisibility,
        };
      });
    },
    [],
  );

  const resetSectionColumnVisibility = useCallback(
    (sectionLabel: string | undefined, sectionKind: IdentificationFilterKind | undefined) => {
      setSettings((prev) => {
        const sectionKey = getSectionColumnVisibilityKey(sectionLabel, sectionKind);
        if (!(sectionKey in prev.sectionColumnVisibility)) {
          return prev;
        }

        const nextSectionColumnVisibility = { ...prev.sectionColumnVisibility };
        delete nextSectionColumnVisibility[sectionKey];

        return {
          ...prev,
          sectionColumnVisibility: nextSectionColumnVisibility,
        };
      });
    },
    [],
  );

  const toggleRowHidden = useCallback(
    (rowId: string) => {
      setSettings((prev) => {
        const nextHiddenRows = new Set(prev.hiddenRows);
        if (nextHiddenRows.has(rowId)) {
          nextHiddenRows.delete(rowId);
        } else {
          nextHiddenRows.add(rowId);
        }
        return { ...prev, hiddenRows: nextHiddenRows };
      });
    },
    [],
  );

  const clearHiddenRows = useCallback(() => {
    setSettings((prev) => ({ ...prev, hiddenRows: new Set<string>() }));
  }, []);

  const toggleCrossWireSection = useCallback(
    (locationKey: string) => {
      setSettings((prev) => {
        const next = new Set(prev.crossWireSections);
        if (next.has(locationKey)) {
          next.delete(locationKey);
        } else {
          next.add(locationKey);
        }
        return { ...prev, crossWireSections: next };
      });
    },
    [],
  );

  const toggleGroupSwapFromTo = useCallback(
    (groupIndex: number) => {
      setSettings((prev) => {
        const group = processedLocationGroups[groupIndex];
        if (!group) return prev;

        // Check current state: are all subsections swapped?
        const allSwapped = group.subsections.every((sub) => {
          const cols = getEffectiveSectionColumns(prev.sectionColumnVisibility, sub.label, sub.sectionKind);
          return cols.swapFromTo === true;
        });

        const nextVisibility = { ...prev.sectionColumnVisibility };
        for (const sub of group.subsections) {
          const key = getSectionColumnVisibilityKey(sub.label, sub.sectionKind);
          const current = getEffectiveSectionColumns(prev.sectionColumnVisibility, sub.label, sub.sectionKind);
          nextVisibility[key] = { ...current, swapFromTo: !allSwapped };
        }
        return { ...prev, sectionColumnVisibility: nextVisibility };
      });
    },
    [processedLocationGroups],
  );

  useEffect(() => {
    if (!workspaceActive) {
      brandingToastShownRef.current = false;
      return;
    }

    if (settings.mode !== "branding" || brandingToastShownRef.current) {
      return;
    }

    brandingToastShownRef.current = true;
    toast({
      title: "Branding mode enabled",
      description: "Click any measurement to edit it, use +/- for quick changes, or use bulk controls for selected rows.",
      duration: 3500,
    });
  }, [workspaceActive, settings.mode, toast]);

  const previewPageCount = useMemo(() => {
    return buildPrintPreviewPageCount({
      mode: settings.mode,
      processedLocationGroups: processedLocationGroups as never,
      showFeedbackSection: settings.showFeedbackSection,
      showCoverPage: settings.showCoverPage,
      showTableOfContents: settings.showTableOfContents,
      showIPVCodes: settings.showIPVCodes,
    });
  }, [processedLocationGroups, settings.showFeedbackSection, settings.showCoverPage, settings.showTableOfContents, settings.showIPVCodes]);

  const workspaceSheetDocument = useMemo(
    () => buildWireListSheetWorkspaceDocument({
      sheetTitle,
      currentSheetName,
      previewPageCount,
      processedLocationGroups,
      activeHiddenSections,
      sectionColumnVisibility: settings.sectionColumnVisibility,
      hiddenRows: settings.hiddenRows,
      crossWireSections: settings.crossWireSections,
      rowLengthsById: Object.fromEntries(
        rows.map((row) => [row.__rowId, effectiveGetRowLength(row.__rowId)]).filter((entry): entry is [string, { display: string; roundedInches: number; confidence: string }] => Boolean(entry[1])),
      ),
      includeFeedbackPage: settings.mode !== "branding",
      brandingPreviewRowMap,
      partNumberMap: effectivePartNumberMap ?? undefined,
    }),
    [
      activeHiddenSections,
      brandingPreviewRowMap,
      currentSheetName,
      effectiveGetRowLength,
      effectivePartNumberMap,
      previewPageCount,
      processedLocationGroups,
      rows,
      settings.hiddenRows,
      settings.mode,
      settings.sectionColumnVisibility,
      sheetTitle,
    ],
  );

  const visiblePreviewSections = workspaceSheetDocument.wireListSections;

  const visiblePreviewRowCount = useMemo(
    () => visiblePreviewSections.reduce((sum, section) => sum + section.visibleRows.length, 0),
    [visiblePreviewSections],
  );

  const brandingVisibleSections = workspaceSheetDocument.brandingSections;

  const brandingVisibleRowCount = useMemo(
    () => brandingVisibleSections.reduce((sum, section) => sum + section.rows.length, 0),
    [brandingVisibleSections],
  );

  const crossWireVisibleSections = workspaceSheetDocument.crossWireSections;

  const crossWireLocationGroups = useMemo(() => {
    if (crossWireVisibleSections.length === 0) return [];

    const seen = new Set<string>();
    return crossWireVisibleSections.flatMap((section) => {
      const locationKey = `${section.group.location}::${section.group.isExternal ? "external" : "internal"}`;
      if (seen.has(locationKey)) {
        return [];
      }
      seen.add(locationKey);
      return [section.group];
    });
  }, [crossWireVisibleSections]);

  const hasCrossWireSections = crossWireVisibleSections.length > 0 && settings.mode === "standardize";

  // Resolve the SWS type for cross-wire sections from the first cross-wire location group
  const crossWireSwsType = useMemo(() => {
    if (!hasCrossWireSections || crossWireLocationGroups.length === 0) return undefined;
    return resolveLocationSwsType(crossWireLocationGroups[0].location);
  }, [hasCrossWireSections, crossWireLocationGroups, resolveLocationSwsType]);

  // Separate page count for cross-wire printout
  const crossWirePageCount = useMemo(() => {
    if (!hasCrossWireSections) return 0;
    const totalRows = crossWireVisibleSections.reduce((sum, s) => sum + s.visibleRows.length, 0);
    const dataPages = Math.max(Math.ceil(totalRows / 30), 1);
    return 1 + 1 + dataPages; // cover + TOC + data pages
  }, [hasCrossWireSections, crossWireVisibleSections]);

  // Auto-switch to wire-list tab if cross-wire sections are removed
  useEffect(() => {
    if (!hasCrossWireSections && printViewTab === "cross-wire") {
      setPrintViewTab("wire-list");
    }
  }, [hasCrossWireSections, printViewTab]);

  // Check if there are any visible non-cross-wire location groups for the main wire list
  const hasNonCrossWireSections = visiblePreviewSections.length > 0;

  const activePreviewRowCount = settings.mode === "branding" ? brandingVisibleRowCount : visiblePreviewRowCount;
  const activePreviewSectionCount = settings.mode === "branding" ? brandingVisibleSections.length : processedRows.length;

  const handleExportPreviewCsv = useCallback(() => {
    if (settings.mode === "branding") {
      if (brandingVisibleSections.length === 0) {
        return;
      }

      const csvContent = buildBrandingCsvContent({
        brandingVisibleSections,
        currentSheetName,
        sectionColumnVisibility: settings.sectionColumnVisibility,
        partNumberMap: effectivePartNumberMap,
        brandingSortMode: settings.brandingSortMode,
        projectInfo: {
          pdNumber: projectInfo.pdNumber,
          projectName: projectInfo.projectName,
          revision: projectInfo.revision,
          controlsDE: metadata?.controlsDE,
        },
      });

      if (!csvContent) return;

      const brandedName = buildBrandingFilename({
        pdNumber: projectInfo.pdNumber,
        projectName: projectInfo.projectName,
        revision: projectInfo.revision,
        unitNumber: projectInfo.unitNumber,
        sheetName: currentSheetName || sheetTitle,
        extension: "csv",
      });

      downloadWireListCSV(csvContent, brandedName);
      return;
    }

    if (visiblePreviewSections.length === 0) {
      return;
    }

    // Use the same 8-column branding CSV shape for wire list exports
    const COL_COUNT = 8;
    const emptyRow = ",".repeat(COL_COUNT - 1);
    const locationName = currentSheetName || "";

    const metadataRows = [
      escapePrintPreviewCsvValue(locationName) + ",".repeat(COL_COUNT - 1),
      emptyRow,
      `Project #,${escapePrintPreviewCsvValue(projectInfo.pdNumber)}${",".repeat(COL_COUNT - 2)}`,
      `Project Name,${escapePrintPreviewCsvValue(projectInfo.projectName)}${",".repeat(COL_COUNT - 2)}`,
      `Revision,${escapePrintPreviewCsvValue(projectInfo.revision)}${",".repeat(COL_COUNT - 2)}`,
      emptyRow,
      `Controls DE,${escapePrintPreviewCsvValue(metadata?.controlsDE ?? "")}${",".repeat(COL_COUNT - 2)}`,
      `Phone:${",".repeat(COL_COUNT - 1)}`,
      `Controls ME,${",".repeat(COL_COUNT - 2)}`,
      `Phone:${",".repeat(COL_COUNT - 1)}`,
      emptyRow,
    ];

    const fromToRow = "From,,,,,,To,";
    const columnHeaders = "Device ID,Wire No.,Wire ID,Gauge/Size,Length,Device ID,Location,Section";

    const sectionBlocks: string[][] = [];

    for (const { group, subsection, visibleRows } of visiblePreviewSections) {
      const dataRows: string[] = [];
      const location = group.location || "";

      for (const row of visibleRows) {
        const lengthDisplay = effectiveGetRowLength(row.__rowId)?.display || "";
        const csvRow = [
          row.fromDeviceId || "",
          row.wireNo || "",
          row.wireId || "",
          row.gaugeSize || "",
          lengthDisplay,
          row.toDeviceId || "",
          location,
          subsection.label,
        ].map(v => escapePrintPreviewCsvValue(v)).join(",");
        dataRows.push(csvRow);
      }

      if (dataRows.length > 0) {
        sectionBlocks.push(dataRows);
      }
    }

    const allDataRows: string[] = [];
    for (let i = 0; i < sectionBlocks.length; i++) {
      allDataRows.push(...sectionBlocks[i]);
      if (i < sectionBlocks.length - 1) {
        allDataRows.push(emptyRow);
      }
    }

    const csvContent = [
      ...metadataRows,
      fromToRow,
      columnHeaders,
      ...allDataRows,
    ].join("\n");

    const brandedName = buildBrandingFilename({
      pdNumber: projectInfo.pdNumber,
      projectName: projectInfo.projectName,
      revision: projectInfo.revision,
      unitNumber: projectInfo.unitNumber,
      sheetName: currentSheetName || sheetTitle,
      extension: "csv",
    });

    downloadWireListCSV(csvContent, brandedName);
  }, [
    brandingVisibleSections,
    currentSheetName,
    effectiveGetRowLength,
    metadata?.controlsDE,
    effectivePartNumberMap,
    projectInfo.pdNumber,
    projectInfo.projectName,
    projectInfo.revision,
    projectInfo.unitNumber,
    settings.brandingSortMode,
    settings.mode,
    settings.sectionColumnVisibility,
    sheetTitle,
    visiblePreviewSections,
  ]);

  const handleExportPreviewXlsx = useCallback(async () => {
    if (settings.mode !== "branding" || brandingVisibleSections.length === 0) {
      return;
    }

    const csvContent = buildBrandingCsvContent({
      brandingVisibleSections,
      currentSheetName,
      sectionColumnVisibility: settings.sectionColumnVisibility,
      partNumberMap: effectivePartNumberMap,
      brandingSortMode: settings.brandingSortMode,
      projectInfo: {
        pdNumber: projectInfo.pdNumber,
        projectName: projectInfo.projectName,
        revision: projectInfo.revision,
        controlsDE: metadata?.controlsDE,
      },
    });

    if (!csvContent) return;

    const [{ buildBrandingWorkbookFromCsv }, XLSX] = await Promise.all([
      import("@/lib/project-exports/branding-xlsx-workbook"),
      import("xlsx-js-style"),
    ]);
    const workbook = buildBrandingWorkbookFromCsv(csvContent, "Brandlist");
    const xlsxBuffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });

    const brandedName = buildBrandingFilename({
      pdNumber: projectInfo.pdNumber,
      projectName: projectInfo.projectName,
      revision: projectInfo.revision,
      unitNumber: projectInfo.unitNumber,
      sheetName: currentSheetName || sheetTitle,
      extension: "xlsx",
    });

    const blob = new Blob([xlsxBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", brandedName);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [
    brandingVisibleSections,
    currentSheetName,
    metadata?.controlsDE,
    effectivePartNumberMap,
    projectInfo.pdNumber,
    projectInfo.projectName,
    projectInfo.revision,
    projectInfo.unitNumber,
    settings.brandingSortMode,
    settings.mode,
    settings.sectionColumnVisibility,
    sheetTitle,
  ]);

  const [isSavingSchema, setIsSavingSchema] = useState(false);

  const handleExportSchema = useCallback(async () => {
    if (!projectId || rows.length === 0) {
      toast({
        title: "Cannot export schema",
        description: projectId ? "No rows to export" : "Project ID is required",
        duration: 3000,
      });
      return;
    }

    setIsSavingSchema(true);
    try {
      const hiddenSectionKeys = Array.from(activeHiddenSections);
      const slug = sheetSlug || currentSheetName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

      const response = await fetch(`/api/projects/${projectId}/wire-list-print-schemas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows,
          currentSheetName,
          sheetSlug: slug,
          settings: {
            mode: settings.mode,
            enabledSections: settings.enabledSections,
            sectionOrder: settings.sectionOrder,
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
            brandingSortMode: settings.brandingSortMode,
            wireListSortMode: settings.wireListSortMode,
            sectionColumnVisibility: settings.sectionColumnVisibility,
            feedbackRenderMode: settings.feedbackRenderMode,
            feedbackSections: settings.feedbackSections,
            customQuestions: settings.customQuestions,
          },
          projectInfo,
          sheetTitle,
          hiddenSections: hiddenSectionKeys,
          hiddenRows: Array.from(settings.hiddenRows),
          crossWireSections: Array.from(settings.crossWireSections),
          save: true,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const schema = result.schema;

      toast({
        title: "Schema exported",
        description: `${schema.totalRows} rows · ${schema.totalPages} pages${schema.settings.showEstTime ? ` · ${schema.pages.find((p: { pageType: string }) => p.pageType === "toc")?.summary?.estTotalTime || ""}` : ""} → ${result.savedPath ? "Saved to project" : "Generated"}`,
        duration: 4000,
      });
    } catch (error) {
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to export print schema",
        duration: 4000,
      });
    } finally {
      setIsSavingSchema(false);
    }
  }, [
    activeHiddenSections,
    currentSheetName,
    projectId,
    projectInfo,
    rows,
    settings.brandingSortMode,
    settings.enabledSections,
    settings.mode,
    settings.sectionOrder,
    settings.showComments,
    settings.showCoverPage,
    settings.showEstTime,
    settings.showFeedbackSection,
    settings.showFromCheckbox,
    settings.showIPV,
    settings.showIPVCodes,
    settings.showLength,
    settings.showTableOfContents,
    settings.showToCheckbox,
    settings.wireListSortMode,
    sheetSlug,
    sheetTitle,
    toast,
  ]);

  // ── Schema-driven render mode (handlers) ────────────────────────────

  const handleLoadSchema = useCallback(async () => {
    if (!projectId) {
      toast({ title: "Project ID required", duration: 3000 });
      return;
    }
    const slug =
      sheetSlug ||
      (currentSheetName || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) {
      toast({ title: "No sheet slug available", duration: 3000 });
      return;
    }

    setIsLoadingSchema(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/wire-list-print-schemas?sheet=${encodeURIComponent(slug)}`,
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const schema: WireListPrintSchema = await res.json();
      setLoadedSchema(schema);
      toast({
        title: "Schema loaded",
        description: `${schema.totalRows} rows · ${schema.totalPages} pages · ${schema.sheetName}`,
        duration: 4000,
      });
    } catch (error) {
      toast({
        title: "Load failed",
        description: error instanceof Error ? error.message : "Failed to load schema",
        duration: 4000,
      });
    } finally {
      setIsLoadingSchema(false);
    }
  }, [currentSheetName, projectId, sheetSlug, toast]);

  const handleClearSchema = useCallback(() => {
    setLoadedSchema(null);
    toast({ title: "Schema cleared — using live data", duration: 2000 });
  }, [toast]);

  // Print handler using react-to-print for identical styling
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${sheetTitle} - Print`,
    pageStyle: `
      @page {
        size: auto;
        margin: 0.4in 0.4in 0.8in 0.4in;
        
        @bottom-left {
          content: "Caterpillar: Confidential Green";
          font-size: 10px;
          color: #666;
        }
        
        @bottom-right {
          content: "Page " counter(page) " of " counter(pages);
          font-size: 10px;
          color: #666;
          font-weight: 500;
        }
      }
      
      @media print {
        html, body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        
        /* Hide screen-only elements (like editable textareas) */
        .print\\:hidden {
          display: none !important;
        }
        
        /* Show print-only elements */
        .hidden.print\\:block {
          display: block !important;
        }
        
        /* Hide footer inside page - use @page footer instead */
        .print-footer {
          display: none !important;
        }
        
        /* Remove page visual styling for print */
        .print-page {
          width: 100% !important;
          min-height: auto !important;
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          margin: 0 !important;
        }
        
        .print-page__inner {
          min-height: auto !important;
          padding: 0 !important;
        }
        
        /* Tables should take full width */
        table {
          width: 100% !important;
          page-break-inside: auto;
        }
        
        tr {
          page-break-inside: avoid;
          break-inside: avoid;
        }
        
        thead {
          display: table-header-group;
        }
        
        /* Section spacing - allow sections to break */
        .section-wrapper { 
          page-break-inside: auto;
          break-inside: auto;
          margin-bottom: 16px;
        }
        
        /* Feedback section page break */
        .feedback-page {
          page-break-before: always;
          break-before: page;
        }
        
        /* Ensure proper checkbox rendering */
        .checkbox-print {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
      }
    `,
  });

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 10, 50));
  const handleZoomReset = () => setZoom(100);

  return (
    <div
      className="bg-background h-full w-full flex flex-col overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      {!reviewModeCompact ? (
      <div className="px-3 sm:px-5 py-3 border-b flex items-center justify-between flex-shrink-0 bg-muted/30 gap-2">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                    <Printer className="h-5 w-5 text-foreground/70 flex-shrink-0 hidden sm:block" />
                    <h2 className="text-base sm:text-lg font-semibold truncate">{headerTitle}</h2>
                    <Badge variant="secondary" className="text-xs flex-shrink-0">
                      {settings.mode === "branding" ? brandingPreviewRows.length : totalRowCount} rows
                    </Badge>
               
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                    <Button
                      onClick={handleExportPreviewCsv}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 sm:gap-2 h-8 px-2 sm:px-3"
                      disabled={activePreviewRowCount === 0}
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Export CSV</span>
                    </Button>
                    {settings.mode === "branding" && (
                      <Button
                        onClick={handleExportPreviewXlsx}
                        size="sm"
                        variant="outline"
                        className="gap-1.5 sm:gap-2 h-8 px-2 sm:px-3"
                        disabled={activePreviewRowCount === 0}
                      >
                        <FileText className="h-4 w-4" />
                        <span className="hidden sm:inline">Export Excel</span>
                      </Button>
                    )}
                    {projectId && (
                      <Button
                        onClick={handleExportSchema}
                        size="sm"
                        variant="outline"
                        className="gap-1.5 sm:gap-2 h-8 px-2 sm:px-3"
                        disabled={isSavingSchema || activePreviewRowCount === 0}
                        title="Export wire list print to project directory"
                      >
                        <Save className="h-4 w-4" />
                        <span className="hidden sm:inline">{isSavingSchema ? "Saving..." : "Save"}</span>
                      </Button>
                    )}
                    {projectId && !loadedSchema && (
                      <Button
                        onClick={handleLoadSchema}
                        size="sm"
                        variant="outline"
                        className="gap-1.5 sm:gap-2 h-8 px-2 sm:px-3"
                        disabled={isLoadingSchema}
                        title="Load saved schema and render from it"
                      >
                        <BookOpen className="h-4 w-4" />
                        <span className="hidden sm:inline">{isLoadingSchema ? "Loading..." : "Load Wire List"}</span>
                      </Button>
                    )}
                    {loadedSchema && (
                      <Button
                        onClick={handleClearSchema}
                        size="sm"
                        variant="outline"
                        className="gap-1.5 sm:gap-2 h-8 px-2 sm:px-3 border-amber-400 text-amber-600 hover:bg-amber-50"
                        title="Clear loaded schema and return to live data"
                      >
                        <X className="h-4 w-4" />
                        <span className="hidden sm:inline">Reset</span>
                      </Button>
                    )}

                    {extraHeaderActions}
                    <Button onClick={handlePrint} size="sm" className="gap-1.5 sm:gap-2 h-8 px-2 sm:px-3">
                      <Printer className="h-4 w-4" />
                      <span className="hidden sm:inline">Print</span>
                    </Button>
                    <Button
                      onClick={handlePrint}
                      size="sm"
                      variant="outline"
                      className="gap-1.5 sm:gap-2 h-8 px-2 sm:px-3"
                      title="Use browser's 'Save as PDF' option in print dialog"
                    >
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Download PDF</span>
                    </Button>
                    {!hideCloseButton && onRequestClose && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onRequestClose}>
                      <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
      </div>
      ) : null}

      {/* Body */}
      {wiringExecutionActive ? (
        <div className="flex-1 overflow-hidden">
          <WiringExecutionMode
            projectId={projectId || ""}
            sheetSlug={sheetSlug || currentSheetName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}
            sheetName={currentSheetName}
            swsType={swsType?.id || "UNDECIDED"}
            badge={user?.badge || "unknown"}
            shift={user?.currentShift || "1st-shift"}
            locationGroups={processedLocationGroups}
            settings={settings}
            rowMap={rowMap}
            onClose={() => setWiringExecutionActive(false)}
          />
        </div>
      ) : (
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    {/* Left: Settings Panel */}
                    {(!reviewModeCompact || reviewModeShowSettings) ? (
                    <div className="w-full md:w-[360px] lg:w-[400px] xl:w-[420px] shrink-0 border-b md:border-b-0 md:border-r bg-muted/20 overflow-y-auto max-h-[45vh] md:max-h-none">
                      <div className="p-4 space-y-5">
                        {/* Project Information */}
                        <Collapsible open={projectInfoOpen} onOpenChange={setProjectInfoOpen}>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" className="w-full justify-between px-0 h-auto py-1">
                              <Label className="text-sm font-semibold cursor-pointer flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                Project Information
                              </Label>
                              <ChevronDown className={`h-4 w-4 transition-transform ${projectInfoOpen ? "rotate-180" : ""}`} />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="space-y-3 pt-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Project Name</Label>
                              <Input
                                value={projectInfo.projectName}
                                onChange={(e) => setProjectInfo(prev => ({ ...prev, projectName: e.target.value }))}
                                placeholder="e.g., Control Panel Assembly"
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">PD Number</Label>
                                <Input
                                  value={projectInfo.pdNumber}
                                  onChange={(e) => setProjectInfo(prev => ({ ...prev, pdNumber: e.target.value }))}
                                  placeholder="e.g., PGMAT03"
                                  className="h-8 text-sm"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Unit Number</Label>
                                <Input
                                  value={projectInfo.unitNumber}
                                  onChange={(e) => setProjectInfo(prev => ({ ...prev, unitNumber: e.target.value }))}
                                  placeholder="e.g., 001"
                                  className="h-8 text-sm"
                                />
                              </div>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Revision</Label>
                              <Input
                                value={projectInfo.revision}
                                onChange={(e) => setProjectInfo(prev => ({ ...prev, revision: e.target.value }))}
                                placeholder="e.g., A"
                                className="h-8 text-sm"
                              />
                            </div>

                            {/* Personnel Sign-off Section */}
                            <div className="space-y-3 pt-3 border-t">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium flex items-center gap-1.5">
                                  <User className="h-3.5 w-3.5" />
                                  Standard Worksheet
                                </Label>
                                <Select
                                  value={String(projectInfo.personnel.length)}
                                  onValueChange={(value) => {
                                    const count = Number(value);
                                    setProjectInfo(prev => {
                                      const current = prev.personnel;
                                      if (count === current.length) return prev;
                                      if (count < current.length) {
                                        return { ...prev, personnel: current.slice(0, count) };
                                      }
                                      const now = new Date();
                                      const additions = Array.from({ length: count - current.length }, (_, i) => ({
                                        id: `${Date.now()}-${i}`,
                                        badgeNumber: "",
                                        date: now.toLocaleDateString(),
                                        time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                        isAssembler: false,
                                        isInspector: false,
                                      }));
                                      return { ...prev, personnel: [...current, ...additions] };
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-7 w-full sm:w-[120px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
                                      <SelectItem key={n} value={String(n)}>
                                        {n} {n === 1 ? "Row" : "Rows"}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </CollapsibleContent>
                        </Collapsible>

                        <Separator />

                        {/* Format Mode Selection */}
                        <div className="space-y-3">
                          <Label className="text-sm font-semibold flex items-center gap-2">
                            <Settings2 className="h-4 w-4" />
                            Format Mode
                          </Label>
                          <RadioGroup
                            value={settings.mode}
                            onValueChange={(value) => setSettings(prev => ({ ...prev, mode: value as PrintFormatMode }))}
                            className="space-y-2 w-full"
                          >
                            <div className={`flex items-center space-x-2 p-2.5 rounded-md border cursor-pointer transition-colors ${settings.mode === "standardize" ? "bg-muted/5 border-muted/50" : "bg-background hover:bg-muted/50"}`}>
                              <RadioGroupItem value="standardize" id="standardize" />
                              <Label htmlFor="standardize" className="flex-1 cursor-pointer">
                                <div className="font-medium text-sm">Standardize Format</div>
                                <div className="text-xs text-muted-foreground">Apply preset organization options</div>
                              </Label>
                            </div>
                            <div className={`flex items-center space-x-2 p-2.5 rounded-md border cursor-pointer transition-colors ${settings.mode === "branding" ? "bg-muted/5 border-muted/50" : "bg-background hover:bg-muted/50"}`}>
                              <RadioGroupItem value="branding" id="branding" />
                              <Label htmlFor="branding" className="flex-1 cursor-pointer">
                                <div className="font-medium text-sm">Branding</div>
                                <div className="text-xs text-muted-foreground">Adjust measurements inline for one or many rows</div>
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {/* Branding Sort Mode */}
                        {settings.mode === "branding" && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold flex items-center gap-2">
                                <ArrowUpDown className="h-4 w-4" />
                                Group Ordering
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Controls how single connection groups are organized
                              </p>
                              <RadioGroup
                                value={settings.brandingSortMode}
                                onValueChange={(value) => setSettings(prev => ({ ...prev, brandingSortMode: value as BrandingSortMode }))}
                                className="space-y-1.5"
                              >
                                <div className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${settings.brandingSortMode === "default" ? "bg-muted/5 border-muted/50" : "bg-background hover:bg-muted/50"}`}>
                                  <RadioGroupItem value="default" id="sort-default" />
                                  <Label htmlFor="sort-default" className="flex-1 cursor-pointer">
                                    <div className="font-medium text-xs">Default</div>
                                    <div className="text-[10px] text-muted-foreground">Original discovery order</div>
                                  </Label>
                                </div>
                                <div className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${settings.brandingSortMode === "device-prefix" ? "bg-muted/5 border-muted/50" : "bg-background hover:bg-muted/50"}`}>
                                  <RadioGroupItem value="device-prefix" id="sort-prefix" />
                                  <Label htmlFor="sort-prefix" className="flex-1 cursor-pointer">
                                    <div className="font-medium text-xs">By Device Prefix</div>
                                    <div className="text-[10px] text-muted-foreground">KA, CT, XT — grouped by device family</div>
                                  </Label>
                                </div>
                                <div className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${settings.brandingSortMode === "device-prefix-part-number" ? "bg-muted/5 border-muted/50" : "bg-background hover:bg-muted/50"}`}>
                                  <RadioGroupItem value="device-prefix-part-number" id="sort-prefix-pn" />
                                  <Label htmlFor="sort-prefix-pn" className="flex-1 cursor-pointer">
                                    <div className="font-medium text-xs">By Device Prefix + Part Number</div>
                                    <div className="text-[10px] text-muted-foreground">Grouped by family then sorted by part number</div>
                                  </Label>
                                </div>
                              </RadioGroup>
                            </div>
                          </>
                        )}

                        {/* Wire List Sort Mode */}
                        {settings.mode === "standardize" && (
                          <>
                            <Separator />
                            <div className="space-y-2">
                              <Label className="text-sm font-semibold flex items-center gap-2">
                                <ArrowUpDown className="h-4 w-4" />
                                Group Ordering
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                Controls how single connection groups are organized
                              </p>
                              <RadioGroup
                                value={settings.wireListSortMode}
                                onValueChange={(value) => setSettings(prev => ({ ...prev, wireListSortMode: value as BrandingSortMode }))}
                                className="space-y-1.5"
                              >
                                <div className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${settings.wireListSortMode === "default" ? "bg-muted/5 border-muted/50" : "bg-background hover:bg-muted/50"}`}>
                                  <RadioGroupItem value="default" id="wl-sort-default" />
                                  <Label htmlFor="wl-sort-default" className="flex-1 cursor-pointer">
                                    <div className="font-medium text-xs">Default</div>
                                    <div className="text-[10px] text-muted-foreground">Original discovery order</div>
                                  </Label>
                                </div>
                                <div className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${settings.wireListSortMode === "device-prefix" ? "bg-muted/5 border-muted/50" : "bg-background hover:bg-muted/50"}`}>
                                  <RadioGroupItem value="device-prefix" id="wl-sort-prefix" />
                                  <Label htmlFor="wl-sort-prefix" className="flex-1 cursor-pointer">
                                    <div className="font-medium text-xs">By Device Prefix</div>
                                    <div className="text-[10px] text-muted-foreground">KA, CT, XT — grouped by device family</div>
                                  </Label>
                                </div>
                                <div className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${settings.wireListSortMode === "device-prefix-part-number" ? "bg-muted/5 border-muted/50" : "bg-background hover:bg-muted/50"}`}>
                                  <RadioGroupItem value="device-prefix-part-number" id="wl-sort-prefix-pn" />
                                  <Label htmlFor="wl-sort-prefix-pn" className="flex-1 cursor-pointer">
                                    <div className="font-medium text-xs">By Device Prefix + Part Number</div>
                                    <div className="text-[10px] text-muted-foreground">Grouped by family then sorted by part number, with reference images</div>
                                  </Label>
                                </div>
                                <div className={`flex items-center space-x-2 p-2 rounded-md border cursor-pointer transition-colors ${settings.wireListSortMode === "blue-label-sequence" ? "bg-muted/5 border-muted/50" : "bg-background hover:bg-muted/50"}`}>
                                  <RadioGroupItem value="blue-label-sequence" id="wl-sort-blue-label-sequence" />
                                  <Label htmlFor="wl-sort-blue-label-sequence" className="flex-1 cursor-pointer">
                                    <div className="font-medium text-xs">By Blue Label Sequence</div>
                                    <div className="text-[10px] text-muted-foreground">Single connections follow the current sheet's Blue Labels order</div>
                                  </Label>
                                </div>
                              </RadioGroup>
                            </div>
                          </>
                        )}

                        <Separator />

                        {/* Section Overview */}
                        {(settings.mode === "standardize" || settings.mode === "branding") && processedLocationGroups.length > 0 && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div>
                                  <Label className="text-sm font-semibold">
                                    {settings.mode === "branding" ? "Branding Sections" : "Section Overview"}
                                  </Label>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {settings.mode === "branding"
                                      ? "Single Connections are visible by default. Click eye icon to show or hide other sections."
                                      : "Click eye icon to show/hide sections"}
                                  </p>
                                </div>
                                {swsType && swsType.id !== 'UNDECIDED' && (
                                  <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-5 shrink-0", getSwsBadgeColorClass(swsType.color))}>
                                    {swsType.shortLabel}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {settings.mode === "branding" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 px-2 text-[10px]"
                                    onClick={() => updateActiveHiddenSections(new Set(defaultBrandingHiddenSections))}
                                  >
                                    Single Connections Only
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => updateActiveHiddenSections(new Set<string>())}
                                >
                                  Show All
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => {
                                    const allSectionKeys = new Set<string>();
                                    processedLocationGroups.forEach((group, gi) => {
                                      allSectionKeys.add(`loc-${gi}`);
                                      group.subsections.forEach((_, si) => {
                                        allSectionKeys.add(`${gi}-${si}`);
                                      });
                                    });
                                    updateActiveHiddenSections(allSectionKeys);
                                  }}
                                >
                                  Hide All
                                </Button>
                              </div>
                            </div>

                            {/* TOC-style section list */}
                            <div className="border rounded-md overflow-hidden">
                              {/* Header */}
                              <div className="flex items-center gap-2 px-2 py-1.5 bg-muted/50 border-b text-[10px] font-semibold text-muted-foreground">
                                <span className="w-5 text-center">#</span>
                                <span className="flex-1">Section</span>
                                <span className="w-10 text-right">Rows</span>
                                <span className="w-6"></span>
                                <span className="w-6"></span>
                              </div>

                              {/* Section list */}
                              <div className="max-h-[320px] overflow-y-auto">
                                {processedLocationGroups.map((group, groupIndex) => {
                                  let sectionCounter = 0;
                                  const locationKey = `loc-${groupIndex}`;
                                  const isLocationHidden = activeHiddenSections.has(locationKey);

                                  return (
                                    <div key={groupIndex} className={isLocationHidden ? "opacity-50" : ""}>
                                      {/* Location Group Header */}
                                      <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/30 border-b border-t border-border/50">
                                        <span className="flex-1 text-[10px] font-regular text-foreground truncate">
                                          {group.isExternal
                                            ? `${resolveLocationDisplayTitle(group.location, locationNormalizedTitleByName)} - External`
                                            : resolveLocationDisplayTitle(group.location, locationNormalizedTitleByName)}
                                          {!group.isExternal && currentSheetName && (
                                            <span className="ml-1 text-[10px] font-normal text-foreground">Internal</span>
                                          )}
                                        </span>
                                        {(() => {
                                          const groupSwsType = group.isExternal
                                            ? resolveLocationSwsType(group.location)
                                            : (swsType && swsType.id !== 'UNDECIDED' ? swsType : undefined);
                                          return groupSwsType ? (
                                            <Badge variant="outline" className={cn("text-[9px] px-1 py-0 h-4 shrink-0", getSwsBadgeColorClass(groupSwsType.color))}>
                                              {groupSwsType.shortLabel}
                                            </Badge>
                                          ) : null;
                                        })()}
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-5 w-5 p-0"
                                          onClick={() => {
                                            updateActiveHiddenSections((currentHiddenSections) => {
                                              const newSet = new Set(currentHiddenSections);
                                              if (newSet.has(locationKey)) {
                                                newSet.delete(locationKey);
                                              } else {
                                                newSet.add(locationKey);
                                              }
                                              return newSet;
                                            });
                                          }}
                                        >
                                          {isLocationHidden ? (
                                            <EyeOff className="h-3 w-3 text-muted-foreground" />
                                          ) : (
                                            <Eye className="h-3 w-3 text-muted" />
                                          )}
                                        </Button>
                                        {/* Swap From/To for all subsections in this group */}
                                        {!isLocationHidden && settings.mode === "standardize" && printViewTab === "cross-wire" && (
                                          (() => {
                                            const allSwapped = group.subsections.every((sub) => {
                                              const cols = getEffectiveSectionColumns(settings.sectionColumnVisibility, sub.label, sub.sectionKind);
                                              return cols.swapFromTo === true;
                                            });
                                            return (
                                              <Button
                                                variant={allSwapped ? "default" : "outline"}
                                                size="sm"
                                                className={cn(
                                                  "h-4 px-1.5 text-[8px] shrink-0 gap-0.5",
                                                  allSwapped
                                                    ? "bg-blue-500 hover:bg-blue-600 text-white border-blue-500"
                                                    : "text-muted-foreground"
                                                )}
                                                onClick={() => toggleGroupSwapFromTo(groupIndex)}
                                                title={allSwapped ? "Reset From/To for all subsections" : "Swap From/To for all subsections"}
                                              >

                                                {allSwapped ? "Swapped" : "Swap Locations"}
                                              </Button>
                                            );
                                          })()
                                        )}
                                        {/* Move to CrossWire button for external sections (wire list mode only) */}
                                        {group.isExternal && settings.mode === "standardize" && !isLocationHidden && (
                                          <Button
                                            variant={settings.crossWireSections.has(locationKey) ? "default" : "outline"}
                                            size="sm"
                                            className={cn(
                                              "h-4 px-1.5 text-[8px] shrink-0",
                                              settings.crossWireSections.has(locationKey)
                                                ? "bg-amber-500 hover:bg-amber-600 text-white border-amber-500"
                                                : "text-muted-foreground"
                                            )}
                                            onClick={() => toggleCrossWireSection(locationKey)}
                                            title={settings.crossWireSections.has(locationKey) ? "Remove from CrossWire" : "Move to CrossWire section"}
                                          >
                                            {settings.crossWireSections.has(locationKey) ? "CrossWire ✓" : "CrossWire"}
                                          </Button>
                                        )}
                                      </div>

                                      {/* Subsections */}
                                      {!isLocationHidden && group.subsections.map((subsection, subIndex) => {
                                        sectionCounter++;
                                        const sectionKey = `${groupIndex}-${subIndex}`;
                                        const isSectionHidden = activeHiddenSections.has(sectionKey);
                                        const sectionColumns = getEffectiveSectionColumns(
                                          settings.sectionColumnVisibility,
                                          subsection.label,
                                          subsection.sectionKind,
                                        );
                                        const defaultColumns = getDefaultSectionColumns(subsection.sectionKind);
                                        const canShowTypeColumn = settings.mode !== "branding";

                                        return (
                                          <div key={subIndex} className={isSectionHidden ? "opacity-50" : ""}>
                                            <div className="flex items-center gap-1.5 px-2 py-1 border-b border-border/20 text-[10px]">
                                              <span className="w-5 text-center text-muted-foreground">{sectionCounter}</span>
                                              <span className={`flex-1 truncate ${isSectionHidden ? "line-through text-muted-foreground" : ""}`}>
                                                {subsection.label}
                                              </span>
                                              <span className="w-10 text-right text-muted-foreground tabular-nums">
                                                {subsection.rows.length > 0 ? subsection.rows.length : "-"}
                                              </span>
                                              <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-4 w-5 p-0"
                                                    title="Section columns"
                                                  >
                                                    <Settings2 className="h-2.5 w-2.5 text-muted-foreground" />
                                                  </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end" className="w-44">
                                                  <DropdownMenuLabel>Section Columns</DropdownMenuLabel>
                                                  {settings.mode !== "branding" && (
                                                    <DropdownMenuCheckboxItem
                                                      checked={sectionColumns.partNumber}
                                                      onCheckedChange={(checked) => updateSectionColumnVisibility(
                                                        subsection.label,
                                                        subsection.sectionKind,
                                                        "partNumber",
                                                        Boolean(checked),
                                                      )}
                                                    >
                                                      Part Number
                                                    </DropdownMenuCheckboxItem>
                                                  )}
                                                  {settings.mode !== "branding" && (
                                                    <DropdownMenuCheckboxItem
                                                      checked={sectionColumns.description}
                                                      onCheckedChange={(checked) => updateSectionColumnVisibility(
                                                        subsection.label,
                                                        subsection.sectionKind,
                                                        "description",
                                                        Boolean(checked),
                                                      )}
                                                    >
                                                      Description
                                                    </DropdownMenuCheckboxItem>
                                                  )}
                                                  {canShowTypeColumn && (
                                                    <DropdownMenuCheckboxItem
                                                      checked={sectionColumns.wireType}
                                                      onCheckedChange={(checked) => updateSectionColumnVisibility(
                                                        subsection.label,
                                                        subsection.sectionKind,
                                                        "wireType",
                                                        Boolean(checked),
                                                      )}
                                                    >
                                                      Type
                                                    </DropdownMenuCheckboxItem>
                                                  )}
                                                  <DropdownMenuCheckboxItem
                                                    checked={sectionColumns.wireNo}
                                                    onCheckedChange={(checked) => updateSectionColumnVisibility(
                                                      subsection.label,
                                                      subsection.sectionKind,
                                                      "wireNo",
                                                      Boolean(checked),
                                                    )}
                                                  >
                                                    Wire No.
                                                  </DropdownMenuCheckboxItem>
                                                  <DropdownMenuCheckboxItem
                                                    checked={sectionColumns.wireId}
                                                    onCheckedChange={(checked) => updateSectionColumnVisibility(
                                                      subsection.label,
                                                      subsection.sectionKind,
                                                      "wireId",
                                                      Boolean(checked),
                                                    )}
                                                  >
                                                    {settings.mode === "branding" ? "Color" : "Wire ID"}
                                                  </DropdownMenuCheckboxItem>
                                                  <DropdownMenuCheckboxItem
                                                    checked={sectionColumns.gaugeSize}
                                                    onCheckedChange={(checked) => updateSectionColumnVisibility(
                                                      subsection.label,
                                                      subsection.sectionKind,
                                                      "gaugeSize",
                                                      Boolean(checked),
                                                    )}
                                                  >
                                                    {settings.mode === "branding" ? "Gauge" : "Size"}
                                                  </DropdownMenuCheckboxItem>
                                                  {settings.mode !== "branding" && printViewTab === "cross-wire" && (
                                                    <DropdownMenuCheckboxItem
                                                      checked={sectionColumns.fromLocation ?? false}
                                                      onCheckedChange={(checked) => updateSectionColumnVisibility(
                                                        subsection.label,
                                                        subsection.sectionKind,
                                                        "fromLocation",
                                                        Boolean(checked),
                                                      )}
                                                    >
                                                      From Location
                                                    </DropdownMenuCheckboxItem>
                                                  )}
                                                  {settings.mode !== "branding" && printViewTab === "cross-wire" && (
                                                    <DropdownMenuCheckboxItem
                                                      checked={sectionColumns.toLocation ?? true}
                                                      onCheckedChange={(checked) => updateSectionColumnVisibility(
                                                        subsection.label,
                                                        subsection.sectionKind,
                                                        "toLocation",
                                                        Boolean(checked),
                                                      )}
                                                    >
                                                      To Location
                                                    </DropdownMenuCheckboxItem>
                                                  )}
                                                  {printViewTab === "cross-wire" ? (
                                                    <>
                                                      <DropdownMenuSeparator />
                                                      <DropdownMenuCheckboxItem
                                                        checked={sectionColumns.swapFromTo ?? false}
                                                        onCheckedChange={(checked) => updateSectionColumnVisibility(
                                                          subsection.label,
                                                          subsection.sectionKind,
                                                          "swapFromTo",
                                                          Boolean(checked),
                                                        )}
                                                      >
                                                        Swap From / To
                                                      </DropdownMenuCheckboxItem>
                                                    </>
                                                  ) : null}
                                                  <DropdownMenuSeparator />
                                                  <DropdownMenuItem
                                                    onClick={() => resetSectionColumnVisibility(subsection.label, subsection.sectionKind)}
                                                    disabled={
                                                      sectionColumns.partNumber === defaultColumns.partNumber &&
                                                      sectionColumns.description === defaultColumns.description &&
                                                      sectionColumns.wireNo === defaultColumns.wireNo &&
                                                      sectionColumns.wireId === defaultColumns.wireId &&
                                                      sectionColumns.wireType === defaultColumns.wireType &&
                                                      sectionColumns.gaugeSize === defaultColumns.gaugeSize &&
                                                      (sectionColumns.fromLocation ?? false) === (defaultColumns.fromLocation ?? false) &&
                                                      (sectionColumns.toLocation ?? true) === (defaultColumns.toLocation ?? true) &&
                                                      (sectionColumns.swapFromTo ?? false) === (defaultColumns.swapFromTo ?? false)
                                                    }
                                                  >
                                                    Reset Defaults
                                                  </DropdownMenuItem>
                                                </DropdownMenuContent>
                                              </DropdownMenu>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-4 w-5 p-0"
                                                onClick={() => {
                                                  updateActiveHiddenSections((currentHiddenSections) => {
                                                    const newSet = new Set(currentHiddenSections);
                                                    if (newSet.has(sectionKey)) {
                                                      newSet.delete(sectionKey);
                                                    } else {
                                                      newSet.add(sectionKey);
                                                    }
                                                    return newSet;
                                                  });
                                                }}
                                              >
                                                {isSectionHidden ? (
                                                  <EyeOff className="h-2.5 w-2.5 text-muted-foreground" />
                                                ) : (
                                                  <Eye className="h-2.5 w-2.5 text-muted" />
                                                )}
                                              </Button>
                                            </div>

                                            {/* Device-to-Device subsections */}
                                            {!isSectionHidden && subsection.deviceToDeviceSubsections && (() => {
                                              const d2ds = subsection.deviceToDeviceSubsections!;
                                              let lastPrefix = "";
                                              const showGroupedPrefixHeader = settings.wireListSortMode !== "blue-label-sequence";
                                              return d2ds.map((d2d, d2dIndex) => {
                                                const prefix = getTocSubsectionPrefix(d2d.label, subsection.sectionKind);
                                                const showPrefixHeader = showGroupedPrefixHeader && prefix !== lastPrefix;
                                                lastPrefix = prefix;
                                                return (
                                                  <React.Fragment key={`d2d-${d2dIndex}`}>
                                                    {showPrefixHeader && (
                                                      <div className="flex items-center gap-1.5 px-2 py-0.5 border-b border-border/10 text-[9px]">
                                                        <span className="w-5"></span>
                                                        <span className="flex-1 truncate text-foreground/70 pl-2 font-semibold uppercase tracking-wide">
                                                          {prefix}
                                                        </span>
                                                      </div>
                                                    )}
                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 border-b border-border/10 text-[9px] bg-muted/10">
                                                      <span className="w-5"></span>
                                                      <span className="flex-1 truncate text-muted-foreground pl-2">
                                                        <span className="mr-0.5">└</span>{d2d.label}
                                                      </span>
                                                      <span className="w-10 text-right text-muted-foreground tabular-nums">{d2d.rows.length}</span>
                                                      <span className="w-6"></span>
                                                    </div>
                                                  </React.Fragment>
                                                );
                                              });
                                            })()}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Summary */}
                            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                              <span>Locations: <strong className="text-foreground">{processedLocationGroups.length}</strong></span>
                              <span>Sections: <strong className="text-foreground">{processedLocationGroups.reduce((sum, g) => sum + g.subsections.length, 0)}</strong></span>
                              <span>Rows: <strong className="text-foreground">{processedLocationGroups.reduce((sum, g) => sum + g.totalRows, 0)}</strong></span>
                            </div>

                            {/* Hidden rows indicator */}
                            {settings.hiddenRows.size > 0 && (
                              <div className="flex items-center justify-between px-1 py-1 rounded-md bg-muted/30 border border-border/50">
                                <span className="text-[10px] text-muted-foreground">
                                  <EyeOff className="h-3 w-3 inline mr-1" />
                                  {settings.hiddenRows.size} row{settings.hiddenRows.size !== 1 ? "s" : ""} hidden
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 px-2 text-[9px]"
                                  onClick={clearHiddenRows}
                                >
                                  Reset
                                </Button>
                              </div>
                            )}

                            {/* CrossWire sections summary */}
                            {hasCrossWireSections && (
                              <button
                                type="button"
                                className="flex items-center gap-1.5 w-full px-1 py-1 rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                                onClick={() => setPrintViewTab("cross-wire")}
                              >
                                <span className="text-[10px] text-amber-700 dark:text-amber-400">
                                  {crossWireVisibleSections.length} CrossWire section{crossWireVisibleSections.length !== 1 ? "s" : ""} — view in Cross Wire tab
                                </span>
                              </button>
                            )}
                          </div>
                        )}

                        {settings.mode === "branding" && (
                          <div className="space-y-4">
                            <div className="space-y-1">
                              <Label className="text-sm font-semibold">Branding Controls</Label>
                              <p className="text-xs text-muted-foreground">
                                Select rows in the preview, then adjust measurements in place or in bulk.
                              </p>
                            </div>

                            <div className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                              <span className="text-sm font-medium">
                                {brandingSelection.selectedIds.size} selected
                              </span>
                              <div className="flex items-center gap-1.5">
                                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={selectAllBrandingRows}>
                                  Select all
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => clearBrandingSelection()}>
                                  Clear
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Adjustment step</Label>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={brandingSelection.selectedIds.size === 0}
                                  onClick={() => updateSelectedBrandingMeasurements(-parsedBrandingAdjustmentStep)}
                                >
                                  <Minus className="h-4 w-4" />
                                </Button>
                                <Input
                                  type="number"
                                  step="0.25"
                                  min="0.25"
                                  value={brandingAdjustmentStep}
                                  onChange={(event) => setBrandingAdjustmentStep(event.target.value)}
                                  className="h-8 text-center font-mono"
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  disabled={brandingSelection.selectedIds.size === 0}
                                  onClick={() => updateSelectedBrandingMeasurements(parsedBrandingAdjustmentStep)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Set measurement</Label>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={brandingSetValue}
                                  onChange={(event) => setBrandingSetValue(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      setSelectedBrandingMeasurements();
                                    }
                                  }}
                                  className="h-8 font-mono"
                                  placeholder="24.0"
                                />
                                <Button
                                  size="sm"
                                  className="h-8"
                                  disabled={brandingSelection.selectedIds.size === 0}
                                  onClick={setSelectedBrandingMeasurements}
                                >
                                  Apply
                                </Button>
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-8"
                              disabled={brandingSelection.selectedIds.size === 0}
                              onClick={resetSelectedBrandingMeasurements}
                            >
                              Reset selected measurements
                            </Button>
                          </div>
                        )}

                        {settings.mode !== "branding" && <Separator />}

                        {/* Cover Page & Table of Contents */}
                        {settings.mode !== "branding" && (
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                              <BookOpen className="h-4 w-4" />
                              Document Pages
                            </Label>
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="showCoverPage"
                                  checked={settings.showCoverPage}
                                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showCoverPage: !!checked }))}
                                />
                                <Label htmlFor="showCoverPage" className="text-sm">Cover Page</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="showTableOfContents"
                                  checked={settings.showTableOfContents}
                                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showTableOfContents: !!checked }))}
                                />
                                <Label htmlFor="showTableOfContents" className="text-sm">Table of Contents</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="showIPVCodes"
                                  checked={settings.showIPVCodes}
                                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showIPVCodes: !!checked }))}
                                />
                                <Label htmlFor="showIPVCodes" className="text-sm">IPV Discrepancy Codes</Label>
                              </div>
                            </div>
                          </div>
                        )}

                        {settings.mode !== "branding" && <Separator />}

                        {/* Column Visibility */}
                        {settings.mode !== "branding" && (
                          <div className="space-y-3">
                            <Label className="text-sm font-semibold flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              Print Columns
                            </Label>
                            <div className="space-y-2">
                              <div className="rounded-md border border-border/60 bg-muted/10 p-2.5 space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Checkbox
                                    id="showAllCompletionColumns"
                                    checked={settings.showFromCheckbox && settings.showToCheckbox && settings.showIPV}
                                    onCheckedChange={(checked) => {
                                      const nextValue = Boolean(checked);
                                      setSettings((prev) => ({
                                        ...prev,
                                        showFromCheckbox: nextValue,
                                        showToCheckbox: nextValue,
                                        showIPV: nextValue,
                                      }));
                                    }}
                                  />
                                  <Label htmlFor="showAllCompletionColumns" className="text-sm font-medium">All completion columns</Label>
                                </div>
                                {[
                                  { id: "showFromCheckbox", label: "From complete" },
                                  { id: "showToCheckbox", label: "To complete" },
                                  { id: "showIPV", label: "IPV complete" },
                                ].map(({ id, label }) => (
                                  <div key={id} className="flex items-center space-x-2 pl-6">
                                    <Checkbox
                                      id={id}
                                      checked={settings[id as keyof PrintSettings] as boolean}
                                      onCheckedChange={(checked) => setSettings(prev => ({ ...prev, [id]: !!checked }))}
                                    />
                                    <Label htmlFor={id} className="text-sm">{label}</Label>
                                  </div>
                                ))}
                              </div>
                              {[
                                { id: "showComments", label: "Notes" },
                                { id: "showLength", label: "Length column" },
                                { id: "showEstTime", label: "Est. Time columns" },
                                { id: "showDeviceSubheaders", label: "Device Subheaders" },
                                { id: "enableBlueDeviceIDColumns", label: "Blue Device ID style" },
                              ].map(({ id, label }) => (
                                <div key={id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={id}
                                    checked={settings[id as keyof PrintSettings] as boolean}
                                    onCheckedChange={(checked) => setSettings(prev => ({ ...prev, [id]: !!checked }))}
                                  />
                                  <Label htmlFor={id} className="text-sm">{label}</Label>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {settings.mode !== "branding" && <Separator />}

                        {/* Feedback Section Settings */}
                        {settings.mode !== "branding" && (
                          <Collapsible open={feedbackOptionsOpen} onOpenChange={setFeedbackOptionsOpen}>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="w-full justify-between px-0 h-auto py-1">
                                <Label className="text-sm font-semibold cursor-pointer flex items-center gap-2">
                                  <ClipboardCheck className="h-4 w-4" />
                                  Feedback Form
                                </Label>
                                <ChevronDown className={`h-4 w-4 transition-transform ${feedbackOptionsOpen ? "rotate-180" : ""}`} />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="space-y-4 pt-3">
                              <div className="flex items-center space-x-2">
                                <Checkbox
                                  id="showFeedbackSection"
                                  checked={settings.showFeedbackSection}
                                  onCheckedChange={(checked) => setSettings(prev => ({ ...prev, showFeedbackSection: !!checked }))}
                                />
                                <Label htmlFor="showFeedbackSection" className="text-sm font-medium">Include Feedback Form</Label>
                              </div>

                              {settings.showFeedbackSection && (
                                <>
                                  <div className="space-y-2 pl-6">
                                    <Label className="text-xs text-muted-foreground">Render Mode</Label>
                                    <RadioGroup
                                      value={settings.feedbackRenderMode}
                                      onValueChange={(value) => setSettings(prev => ({
                                        ...prev,
                                        feedbackRenderMode: value as "PREFILLED" | "BLANK"
                                      }))}
                                      className="space-y-1"
                                    >
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="BLANK" id="feedback-blank" />
                                        <Label htmlFor="feedback-blank" className="text-sm">Blank (for handwriting)</Label>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="PREFILLED" id="feedback-prefilled" />
                                        <Label htmlFor="feedback-prefilled" className="text-sm">Prefilled (with data)</Label>
                                      </div>
                                    </RadioGroup>
                                  </div>

                                  <div className="space-y-2 pl-6">
                                    <Label className="text-xs text-muted-foreground">Feedback Sections & Questions</Label>
                                    <p className="text-[10px] text-muted-foreground/70">Click section to expand and edit/hide questions</p>
                                    <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                                      {settings.feedbackSections
                                        .filter(s => s.id !== "header" && s.id !== "footer")
                                        .sort((a, b) => a.order - b.order)
                                        .map((section) => {
                                          const sectionQuestions = getQuestionsForSection(section.id);
                                          const enabledCount = sectionQuestions.filter(q => q.enabled).length;
                                          const isExpanded = expandedFeedbackSections.has(section.id);

                                          return (
                                            <div key={section.id} className="border rounded-md overflow-hidden">
                                              {/* Section Header */}
                                              <div
                                                className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${section.enabled ? "bg-muted/5 hover:bg-muted/10" : "bg-muted/30 hover:bg-muted/50"
                                                  }`}
                                                onClick={() => toggleFeedbackSectionExpanded(section.id)}
                                              >
                                                <Checkbox
                                                  id={`fb-${section.id}`}
                                                  checked={section.enabled}
                                                  onCheckedChange={() => {
                                                    toggleFeedbackSection(section.id);
                                                  }}
                                                  onClick={(e) => e.stopPropagation()}
                                                  className="h-3.5 w-3.5"
                                                />
                                                <span className={`flex-1 text-xs font-medium ${!section.enabled ? "text-muted-foreground" : ""}`}>
                                                  {section.title}
                                                </span>
                                                {sectionQuestions.length > 0 && (
                                                  <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                                    {enabledCount}/{sectionQuestions.length}
                                                  </Badge>
                                                )}
                                                <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                              </div>

                                              {/* Expandable Questions */}
                                              {isExpanded && section.enabled && (
                                                <div className="bg-muted/20 px-2 py-2 space-y-1.5 border-t">
                                                  {sectionQuestions.map((question) => (
                                                    <div
                                                      key={question.key}
                                                      className={`flex items-center gap-1.5 py-1 px-1.5 rounded text-[10px] ${question.enabled ? "bg-background" : "bg-muted/50 opacity-60"
                                                        }`}
                                                    >
                                                      <button
                                                        type="button"
                                                        onClick={() => toggleQuestion(question.key)}
                                                        className="flex-shrink-0 p-0.5 rounded hover:bg-muted"
                                                        title={question.enabled ? "Hide question" : "Show question"}
                                                      >
                                                        {question.enabled ? (
                                                          <Eye className="h-3 w-3 text-muted" />
                                                        ) : (
                                                          <EyeOff className="h-3 w-3 text-muted-foreground" />
                                                        )}
                                                      </button>
                                                      <Input
                                                        value={question.label}
                                                        onChange={(e) => updateQuestionLabel(question.key, e.target.value)}
                                                        className="flex-1 h-5 text-[10px] px-1.5 py-0"
                                                      />
                                                      {question.isCustom && (
                                                        <button
                                                          type="button"
                                                          onClick={() => removeCustomQuestion(question.key)}
                                                          className="flex-shrink-0 p-0.5 rounded hover:bg-destructive/20 text-destructive"
                                                          title="Remove custom question"
                                                        >
                                                          <Trash2 className="h-3 w-3" />
                                                        </button>
                                                      )}
                                                    </div>
                                                  ))}
                                                  <button
                                                    type="button"
                                                    onClick={() => addCustomQuestion(section.id)}
                                                    className="flex items-center gap-1.5 w-full py-1 px-2 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors"
                                                  >
                                                    <Plus className="h-3 w-3" />
                                                    Add custom question
                                                  </button>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                    </div>
                                  </div>
                                </>
                              )}
                            </CollapsibleContent>
                          </Collapsible>
                        )}
                      </div>
                    </div>
                    ) : null}

                    {/* Right: Preview Panel */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-muted/10">
                      {/* Preview Header with Zoom Controls */}
                      {!reviewModeCompact ? (
                      <div className="px-4 py-2 border-b bg-background flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2">
                          {hasCrossWireSections ? (
                            <div className="flex items-center gap-1 rounded-md bg-muted p-0.5">
                              <button
                                type="button"
                                className={cn(
                                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                                  printViewTab === "wire-list"
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                                onClick={() => setPrintViewTab("wire-list")}
                              >
                                Wire List
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                                  printViewTab === "cross-wire"
                                    ? "bg-amber-100 text-amber-900 shadow-sm dark:bg-amber-900/30 dark:text-amber-200"
                                    : "text-muted-foreground hover:text-foreground",
                                )}
                                onClick={() => setPrintViewTab("cross-wire")}
                              >
                                Cross Wire
                              </button>
                            </div>
                          ) : (
                            <span className="text-sm font-medium">Preview</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {printViewTab === "cross-wire"
                              ? `${crossWirePageCount} page${crossWirePageCount !== 1 ? "s" : ""} | ${crossWireVisibleSections.length} section${crossWireVisibleSections.length !== 1 ? "s" : ""} | ${crossWireVisibleSections.reduce((sum, s) => sum + s.visibleRows.length, 0)} rows`
                              : `${previewPageCount} page${previewPageCount !== 1 ? "s" : ""} | ${activePreviewSectionCount} section${activePreviewSectionCount !== 1 ? "s" : ""} | ${settings.mode === "branding" ? brandingVisibleRowCount : totalRowCount} rows`
                            }
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {settings.mode !== "branding" && (
                          <Button
                            variant={settings.showEstTime ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 gap-1 px-2 text-xs"
                            onClick={() => setSettings(prev => ({ ...prev, showEstTime: !prev.showEstTime }))}
                            title={settings.showEstTime ? "Hide Est. Time columns" : "Show Est. Time columns"}
                          >
                            <Clock className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Est. Time</span>
                          </Button>
                          )}
                          {(settings.mode === "branding" || printViewTab === "cross-wire" || (settings.mode === "standardize" && printViewTab === "wire-list")) ? (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut} disabled={zoom <= 50}>
                                <ZoomOut className="h-4 w-4" />
                              </Button>
                              <div className="flex items-center gap-1.5 min-w-[100px]">
                                <Slider
                                  value={zoom}
                                  onChange={(val) => setZoom(Array.isArray(val) ? val[0] : val)}
                                  onValueChange={(val) => setZoom(Array.isArray(val) ? val[0] : val)}
                                  min={50}
                                  max={150}
                                  step={5}
                                  className="w-[100px]"
                                />
                                <span className="text-xs text-muted-foreground w-10 text-right">{zoom}%</span>
                              </div>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn} disabled={zoom >= 150}>
                                <ZoomIn className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomReset}>
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                      ) : null}

                      <div
                        ref={previewContainerRef}
                        className="flex-1 overflow-auto bg-[repeating-linear-gradient(0deg,transparent,transparent_19px,hsl(var(--border)/0.3)_19px,hsl(var(--border)/0.3)_20px),repeating-linear-gradient(90deg,transparent,transparent_19px,hsl(var(--border)/0.3)_19px,hsl(var(--border)/0.3)_20px)]"
                      >
                        {/* Centering wrapper: keep the full page stack centered while scaled */}
                        <div
                          className="flex justify-center"
                          style={{
                            minWidth: `${PRINT_PAGE_WIDTH * (zoom / 100) + 96}px`,
                            minHeight: `max(100%, ${PRINT_PAGE_MIN_HEIGHT * (zoom / 100) + 96}px)`,
                            padding: "48px",
                          }}
                        >
                          <motion.div
                            ref={printRef}
                            className="print-pages origin-top flex-shrink-0 flex flex-col gap-6"
                            animate={{
                              scale: zoom / 100,
                            }}
                            transition={{
                              type: "spring",
                              stiffness: 300,
                              damping: 30,
                            }}
                            style={{
                              width: `${PRINT_PAGE_WIDTH}px`,
                            }}
                          >
                                {settings.mode === "branding" ? (
                              <PrintPage
                                className="shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
                                pageNumber={1}
                                totalPages={1}
                              >
                                <ProjectInfoHeader
                                  projectInfo={projectInfo}
                                  sheetTitle={`${sheetTitle} - Branding`}
                                  totalRows={brandingVisibleRowCount}
                                  pageNumber={1}
                                  totalPages={1}
                                />

                                <BrandingPreviewContent
                                  sections={brandingVisibleSections}
                                  renderSection={({ group, subsection, rows }) => (
                                    <BrandingPreviewTable
                                      rows={rows}
                                      currentSheetName={currentSheetName}
                                      location={group.location}
                                      sectionLabel={subsection.label}
                                      sectionKind={subsection.sectionKind}
                                      sectionColumnVisibility={settings.sectionColumnVisibility}
                                      partNumberMap={effectivePartNumberMap}
                                      matchMetadata={subsection.matchMetadata}
                                      brandingSortMode={settings.brandingSortMode}
                                      selection={brandingSelection}
                                      onToggleSelection={toggleBrandingSelection}
                                      onSelectAll={selectBrandingRows}
                                      onClearSelection={clearBrandingSelection}
                                      onUpdateMeasurement={updateBrandingMeasurementWithFeedback}
                                      onAdjustMeasurement={adjustBrandingMeasurementWithFeedback}
                                      onResetMeasurement={resetBrandingMeasurementWithFeedback}
                                    />
                                  )}
                                />
                              </PrintPage>
                            ) : (
                              <>
                                <StandardWorkspacePreviewDocument
                                  enabled={printViewTab === "wire-list"}
                                  showCoverPage={settings.showCoverPage}
                                  showTableOfContents={settings.showTableOfContents && processedLocationGroups.length > 0}
                                  showIPVCodes={settings.showIPVCodes}
                                  showFeedbackSection={settings.showFeedbackSection}
                                  hasVisibleSections={hasNonCrossWireSections}
                                  renderCoverPage={() => (
                                    <CoverPage
                                      projectInfo={projectInfo}
                                      sheetTitle={sheetTitle}
                                      currentSheetName={currentSheetName}
                                      coverImageUrl={settings.coverImageUrl}
                                      swsType={swsType}
                                      coverSubtitle={currentSheetName}
                                      pageNumber={1}
                                      totalPages={previewPageCount}
                                    />
                                  )}
                                  renderTableOfContentsPage={() => (
                                    <TableOfContentsPage
                                      locationGroups={processedLocationGroups}
                                      showFeedbackSection={settings.showFeedbackSection}
                                      showCoverPage={settings.showCoverPage}
                                      showTableOfContents={settings.showTableOfContents}
                                      showIPVCodes={settings.showIPVCodes}
                                      showEstTime={settings.showEstTime}
                                      totalPages={previewPageCount}
                                      currentSheetName={currentSheetName}
                                      hiddenSections={activeHiddenSections}
                                      crossWireSections={settings.crossWireSections}
                                      wireListSortMode={settings.wireListSortMode}
                                    />
                                  )}
                                  renderIpvCodesPage={() => (
                                    <IPVCodesPage
                                      pageNumber={(settings.showCoverPage ? 1 : 0) + (settings.showTableOfContents ? 1 : 0) + 1}
                                      totalPages={previewPageCount}
                                    />
                                  )}
                                  renderPreviewDocument={() => (
                                    <StandardWireListPreviewDocument
                                      visibleSections={visiblePreviewSections}
                                      renderPage={(content) => (
                                        <PrintPage
                                          className="shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
                                          pageNumber={(settings.showCoverPage ? 1 : 0) + (settings.showTableOfContents ? 1 : 0) + (settings.showIPVCodes ? 1 : 0) + 1}
                                          totalPages={previewPageCount}
                                        >
                                          <ProjectInfoHeader
                                            projectInfo={projectInfo}
                                            sheetTitle={sheetTitle}
                                            totalRows={processedLocationGroups.reduce((sum, g) => sum + g.totalRows, 0)}
                                            pageNumber={(settings.showCoverPage ? 1 : 0) + (settings.showTableOfContents ? 1 : 0) + (settings.showIPVCodes ? 1 : 0) + 1}
                                            totalPages={previewPageCount}
                                          />
                                          {content}
                                        </PrintPage>
                                      )}
                                      renderSection={({ group, subsection, visibleRows }) => (
                                        <div className="rounded-sm w-full">
                                          <PrintPreviewTable
                                            rows={visibleRows}
                                            settings={{
                                              ...settings,
                                              showComments: false,
                                            }}
                                            currentSheetName={currentSheetName}
                                            comments={comments}
                                            onCommentChange={handleCommentChange}
                                            sectionKind={subsection.sectionKind}
                                            sectionLabel={subsection.label}
                                            matchMetadata={subsection.matchMetadata}
                                            partNumberMap={effectivePartNumberMap}
                                            cablePartNumberMap={cablePartNumberMap}
                                            getRowLength={effectiveGetRowLength}
                                            hiddenRows={settings.hiddenRows}
                                            onToggleRowHidden={toggleRowHidden}
                                            locationNormalizedTitleByName={locationNormalizedTitleByName}
                                            isExternal={group.isExternal}
                                          />
                                        </div>
                                      )}
                                    />
                                  )}
                                  renderFeedbackPage={() => (
                                    <PrintPage
                                      className="feedback-page shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
                                      pageNumber={previewPageCount}
                                      totalPages={previewPageCount}
                                    >
                                      <div className="pt-4">
                                        <PrintFeedbackSection
                                          config={{
                                            showFeedbackSection: settings.showFeedbackSection,
                                            feedbackSections: settings.feedbackSections,
                                            feedbackRenderMode: settings.feedbackRenderMode,
                                            feedbackValues: {
                                              projectName: projectInfo.projectName,
                                              pdNumber: projectInfo.pdNumber,
                                              sheetName: currentSheetName,
                                              revision: projectInfo.revision,
                                            },
                                            customQuestions: settings.customQuestions,
                                          }}
                                          sheetName={currentSheetName}
                                          projectName={projectInfo.projectName}
                                          withLeadingPageBreak={false}
                                        />
                                      </div>
                                    </PrintPage>
                                  )}
                                />

                                <CrossWireWorkspacePreviewDocument
                                  enabled={printViewTab === "cross-wire" && hasCrossWireSections}
                                  renderPreviewDocument={() => {
                                    const crossWireHiddenSections = new Set<string>(activeHiddenSections);
                                    processedLocationGroups.forEach((_, groupIndex) => {
                                      const locationKey = `loc-${groupIndex}`;
                                      if (!settings.crossWireSections.has(locationKey)) {
                                        crossWireHiddenSections.add(locationKey);
                                      }
                                    });

                                    return (
                                      <CrossWirePreviewDocument
                                        visibleSections={crossWireVisibleSections}
                                        renderCoverPage={() => (
                                          <CoverPage
                                            projectInfo={projectInfo}
                                            sheetTitle={sheetTitle}
                                            currentSheetName={currentSheetName}
                                            coverImageUrl={settings.coverImageUrl}
                                            swsType={crossWireSwsType}
                                            coverSubtitle="Cross Wire List"
                                            pageNumber={1}
                                            totalPages={crossWirePageCount}
                                          />
                                        )}
                                        renderTableOfContentsPage={() => (
                                          <TableOfContentsPage
                                            locationGroups={processedLocationGroups}
                                            showFeedbackSection={false}
                                            showCoverPage={true}
                                            showTableOfContents={true}
                                            showIPVCodes={false}
                                            showEstTime={settings.showEstTime}
                                            totalPages={crossWirePageCount}
                                            currentSheetName={currentSheetName}
                                            hiddenSections={crossWireHiddenSections}
                                            wireListSortMode={settings.wireListSortMode}
                                          />
                                        )}
                                        renderPage={(content) => (
                                          <PrintPage
                                            className="shadow-[0_4px_20px_rgba(0,0,0,0.15),0_0_0_1px_rgba(0,0,0,0.05)]"
                                            pageNumber={3}
                                            totalPages={crossWirePageCount}
                                          >
                                            <ProjectInfoHeader
                                              projectInfo={projectInfo}
                                              sheetTitle={`${sheetTitle} — CrossWire`}
                                              totalRows={crossWireVisibleSections.reduce((sum, s) => sum + s.visibleRows.length, 0)}
                                            />
                                            {content}
                                          </PrintPage>
                                        )}
                                        renderSection={(section, sectionIdx, showLocationHeader) => (
                                          <div key={`${section.group.location}-${section.subsection.label}-${sectionIdx}`} className={sectionIdx > 0 ? "mt-5" : ""}>
                                            {showLocationHeader && (
                  <SectionHeaderBlock
                                            title={resolveLocationDisplayTitle(section.group.location, locationNormalizedTitleByName)}
                    subtitle="Location:"
                    subtitleFirst
                    className="mb-3 border-b border-foreground/10 pb-2"
                    titleClassName="text-[13px] font-bold text-foreground"
                    subtitleClassName="text-[10px] font-normal uppercase tracking-wide text-muted-foreground"
                  />
                                            )}
                                            <SectionHeaderBlock
                                              title={section.subsection.label}
                                              count={section.visibleRows.length}
                                            />
                                            <div className="rounded-sm w-full">
                                              <PrintPreviewTable
                                                rows={section.visibleRows}
                                                settings={{
                                                  ...settings,
                                                  showComments: false,
                                                  showIPV: false,
                                                  showLength: false,
                                                  sectionColumnVisibility: {
                                                    ...settings.sectionColumnVisibility,
                                                    [section.subsection.label]: section.sectionColumns,
                                                  },
                                                }}
                                                currentSheetName={currentSheetName}
                                                comments={{}}
                                                onCommentChange={handleCommentChange}
                                                sectionKind={section.subsection.sectionKind}
                                                sectionLabel={section.subsection.label}
                                                matchMetadata={section.subsection.matchMetadata}
                                                partNumberMap={effectivePartNumberMap}
                                                cablePartNumberMap={cablePartNumberMap}
                                                getRowLength={effectiveGetRowLength}
                                                locationNormalizedTitleByName={locationNormalizedTitleByName}
                                                isExternal={true}
                                              />
                                            </div>
                                          </div>
                                        )}
                                      />
                                    );
                                  }}
                                />
                              </>
                            )}
                          </motion.div>
                        </div>
                      </div>
                      
                    </div>
        </div>
      )}
    </div>
  );
}

export function PrintModal(props: PrintModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsOpen(true)}>
        <Printer className="h-4 w-4" />
        <span className="hidden sm:inline">Print</span>
      </Button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="fixed inset-0 z-50 pointer-events-none"
            >
              <div className="h-screen w-screen pointer-events-auto">
                <SingleSheetPrintWorkspace
                  {...props}
                  workspaceActive={isOpen}
                  onRequestClose={() => setIsOpen(false)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
