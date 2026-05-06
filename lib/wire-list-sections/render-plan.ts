import type { SemanticWireListRow } from "@/lib/workbook/types";
import type { IdentificationFilterKind, PatternMatchMetadata } from "@/lib/wiring-identification/types";

import type { WireListCompiledSubgroup } from "./types";

export interface WireListRenderPlanGroup {
  key: string;
  label: string;
  groupKind: "terminal" | "subgroup" | "device" | "prefix-category";
  tone?: WireListCompiledSubgroup["tone"];
  description?: string;
}

export type WireListRenderPlanItem =
  | {
    type: "location-header";
    key: string;
    label: string;
  }
  | {
    type: "group-header";
    key: string;
    group: WireListRenderPlanGroup;
  }
  | {
    type: "row";
    key: string;
    rowId: string;
    row: SemanticWireListRow;
    showDeviceSeparator: boolean;
    isWarningRow: boolean;
  };

interface WireListRenderPlanHeaderGroup {
  key: string;
  label: string;
}

interface BuildWireListRenderPlanOptions {
  rows: SemanticWireListRow[];
  currentSheetName?: string;
  sectionKind?: IdentificationFilterKind;
  matchMetadata: Record<string, PatternMatchMetadata>;
  subgroupHeaderMap?: Record<string, WireListCompiledSubgroup[]>;
  showDeviceGroupHeader: boolean;
  hideDeviceSubheaders: boolean;
  forceDeviceSeparator: boolean;
  getLocation?: (row: SemanticWireListRow) => string;
  getBaseDeviceId?: (row: SemanticWireListRow) => string;
  getCableType?: (row: SemanticWireListRow) => string;
  getLocationHeaderLabel?: (
    row: SemanticWireListRow,
    rowIndex: number,
    rows: SemanticWireListRow[],
    currentSheetName?: string,
  ) => string | null;
  getLeadingGroup?: (
    rowId: string,
    previousRowId: string | null,
    matchMetadata: Record<string, PatternMatchMetadata>,
    sectionKind?: IdentificationFilterKind,
  ) => WireListRenderPlanHeaderGroup | null;
  getDeviceGroupLabel?: (
    row: SemanticWireListRow,
    rowIndex: number,
    rows: SemanticWireListRow[],
  ) => string | null;
}

function defaultGetLocation(row: SemanticWireListRow): string {
  return row.fromLocation || row.location || "";
}

function defaultGetBaseDeviceId(row: SemanticWireListRow): string {
  return row.fromDeviceId?.split(":")[0]?.trim() || "";
}

function defaultGetCableType(row: SemanticWireListRow): string {
  return (row.wireType || "").trim().toUpperCase();
}

function isCableType(wireType: string): boolean {
  const normalized = (wireType || "").trim().toUpperCase();
  return Boolean(normalized) && normalized !== "SC" && normalized !== "W" && normalized !== "JC";
}

export function buildWireListRenderPlan({
  rows,
  currentSheetName,
  sectionKind,
  matchMetadata,
  subgroupHeaderMap = {},
  showDeviceGroupHeader,
  hideDeviceSubheaders,
  forceDeviceSeparator,
  getLocation = defaultGetLocation,
  getBaseDeviceId = defaultGetBaseDeviceId,
  getCableType = defaultGetCableType,
  getLocationHeaderLabel,
  getLeadingGroup,
  getDeviceGroupLabel,
}: BuildWireListRenderPlanOptions): WireListRenderPlanItem[] {
  const plan: WireListRenderPlanItem[] = [];
  const isCablesSection = sectionKind === "cables";
  const suppressLocationGrouping = sectionKind === "ka_twin_ferrules" || sectionKind === "resistors";

  rows.forEach((row, rowIndex) => {
    const previousRow = rowIndex > 0 ? rows[rowIndex - 1] ?? null : null;
    const currentBaseDeviceId = getBaseDeviceId(row);
    const previousBaseDeviceId = previousRow ? getBaseDeviceId(previousRow) : "";
    const currentLocation = getLocation(row);
    const previousLocation = previousRow ? getLocation(previousRow) : "";
    const currentCableType = getCableType(row);
    const previousCableType = previousRow ? getCableType(previousRow) : "";
    const isCurrentCable = isCableType(row.wireType);
    const isNewLocationGroup = !suppressLocationGrouping && currentLocation && (rowIndex === 0 || currentLocation !== previousLocation);
    const isNewCableTypeGroup = isCablesSection && isCurrentCable && (rowIndex === 0 || currentCableType !== previousCableType);
    const explicitDeviceGroupLabel = getDeviceGroupLabel?.(row, rowIndex, rows) ?? null;
    const isNewDeviceGroup = Boolean(
      explicitDeviceGroupLabel || (
        currentBaseDeviceId && (
          rowIndex === 0 ||
          isNewLocationGroup ||
          (isCablesSection ? isNewCableTypeGroup : false) ||
          currentBaseDeviceId !== previousBaseDeviceId
        )
      ),
    );
    const deviceGroupLabel = explicitDeviceGroupLabel || (isNewDeviceGroup ? currentBaseDeviceId : null);
    const shouldShowDeviceSubheader = Boolean(
      showDeviceGroupHeader &&
      deviceGroupLabel &&
      !isNewCableTypeGroup &&
      !hideDeviceSubheaders
    );
    const shouldShowDeviceSeparator = Boolean(
      deviceGroupLabel &&
      !isNewCableTypeGroup &&
      (forceDeviceSeparator || (!showDeviceGroupHeader && !hideDeviceSubheaders))
    );
    const isWarningRow = String(matchMetadata[row.__rowId]?.meta.pairTone ?? "").trim() === "warning";

    if (isNewLocationGroup) {
      const label = getLocationHeaderLabel?.(row, rowIndex, rows, currentSheetName) ?? currentLocation;
      if (label) {
        plan.push({
          type: "location-header",
          key: `location:${row.__rowId}`,
          label,
        });
      }
    }

    if (isNewCableTypeGroup) {
      plan.push({
        type: "group-header",
        key: `cable:${row.__rowId}`,
        group: {
          key: `cable:${currentCableType}`,
          label: `Cable: ${currentCableType}`,
          groupKind: "subgroup",
        },
      });
    }

    const leadingGroup = getLeadingGroup?.(
      row.__rowId,
      previousRow?.__rowId ?? null,
      matchMetadata,
      sectionKind,
    );
    if (leadingGroup) {
      plan.push({
        type: "group-header",
        key: `leading:${row.__rowId}`,
        group: {
          key: leadingGroup.key,
          label: leadingGroup.label,
          groupKind: "terminal",
        },
      });
    }

    const rowSubgroups = subgroupHeaderMap[row.__rowId] ?? [];
    rowSubgroups.forEach((subgroup) => {
      plan.push({
        type: "group-header",
        key: subgroup.id,
        group: {
          key: subgroup.id,
          label: subgroup.label,
          groupKind: "subgroup",
          tone: subgroup.tone,
          description: subgroup.description,
        },
      });
    });

    if (shouldShowDeviceSubheader) {
      plan.push({
        type: "group-header",
        key: `device:${row.__rowId}`,
        group: {
          key: `device:${deviceGroupLabel}`,
          label: deviceGroupLabel,
          groupKind: "device",
        },
      });
    }

    plan.push({
      type: "row",
      key: row.__rowId,
      rowId: row.__rowId,
      row,
      showDeviceSeparator: shouldShowDeviceSeparator,
      isWarningRow,
    });
  });

  return plan;
}