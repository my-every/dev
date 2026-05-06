"use client";

import type { LwcType } from "@/lib/workbook/types";

export type ProjectScheduleLegalsState =
  | "published"
  | "pending_reference"
  | "not_applicable"
  | "missing"
  | "invalid";

export type ProjectScheduleStatus =
  | "Complete"
  | "In Process"
  | "Pending"
  | "Upcoming";

export type ProjectScheduleUploadStatus =
  | "missing_project"
  | "seeded_from_slots"
  | "partial_upload"
  | "uploaded_legals";

export interface ProjectScheduleSlotsTableRow {
  id: string;
  sourceIndex: number;
  pdNumber: string;
  projectName: string;
  unit: string;
  dueLabel: string;
  dueMonth: string | null;
  daysLate: number | null;
  legalsState: ProjectScheduleLegalsState;
  legalsLabel: string;
  status: ProjectScheduleStatus;
  slotProjectId?: string;
  slotProjectDisplayName?: string;
  slotProjectFolderName?: string;
  manifestExists?: boolean;
  hasUploadedProjectFiles?: boolean;
  uploadStatus: ProjectScheduleUploadStatus;
  extraColumns?: Record<string, string>;
}

export interface ProjectScheduleSlotsProps {
  rows: ProjectScheduleSlotsTableRow[];
  selectedRowId: string;
  onSelectRowId: (rowId: string) => void;
  currentBadge?: string;
  detailsModalVariant?: "default" | "alt";
  onRowsChanged?: () => void | Promise<void>;
}

export interface TableFilters {
  search: string;
  dueMonth: string;
  dueDateFrom: string;
  dueDateTo: string;
  legalsState: "all" | ProjectScheduleLegalsState;
  status: "all" | ProjectScheduleStatus;
  multiUnitProject: "all" | "true" | "false";
}

export type BaseColumnKey =
  | "actions"
  | "unit"
  | "pdNumber"
  | "projectName"
  | "due"
  | "daysLate"
  | "legals"
  | "status";

export interface OverviewBarDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

export type LwcTabValue = "ALL" | LwcType;

export interface LwcMetricSet {
  totalProjects: number;
  totalUnits: number;
  multiUnitProjects: number;
  singleUnitProjects: number;
  avgDaysLate: number | null;
  medianDaysLate: number | null;
  overdueCount: number;
  earlyCount: number;
  onTimeCount: number;
  legalsPublishedCount: number;
  legalsPendingRefCount: number;
  legalsMissingCount: number;
  legalsInvalidCount: number;
  statusCompleteCount: number;
  statusInProcessCount: number;
  statusPendingCount: number;
  statusUpcomingCount: number;
}

export type GroupedDisplayEntry =
  | { type: "single"; row: ProjectScheduleSlotsTableRow }
  | {
      type: "group";
      key: string;
      lead: ProjectScheduleSlotsTableRow;
      rows: ProjectScheduleSlotsTableRow[];
    };

export const BASE_COLUMNS: BaseColumnKey[] = [
  "actions",
  "unit",
  "pdNumber",
  "projectName",
  "due",
  "daysLate",
  "legals",
  "status",
];

export const BASE_COLUMN_LABELS: Record<BaseColumnKey, string> = {
  actions: "Actions",
  unit: "Unit",
  pdNumber: "PD#",
  projectName: "Project Name",
  due: "Due",
  daysLate: "Days Late",
  legals: "Legals",
  status: "Status",
};

const UPPERCASE_ABBREVIATIONS = new Set([
  "id",
  "pd",
  "lwc",
  "d380",
  "biq",
  "de",
  "me",
  "pm",
  "cmp",
  "mo",
  "ntb",
  "pwrchk",
  "conasy",
  "conlay",
  "condef",
  "softt",
  "dt",
  "ac",
  "a/c",
]);

export function isBaseColumnKey(column: string): column is BaseColumnKey {
  return BASE_COLUMNS.includes(column as BaseColumnKey);
}

export function getLegalsBadgeVariant(
  state: ProjectScheduleLegalsState,
): "default" | "secondary" | "outline" | "destructive" {
  switch (state) {
    case "published":
      return "default";
    case "pending_reference":
      return "secondary";
    case "not_applicable":
      return "outline";
    case "missing":
      return "destructive";
    case "invalid":
      return "destructive";
    default:
      return "outline";
  }
}

export function getLegalsBadgeLabel(state: ProjectScheduleLegalsState): string {
  switch (state) {
    case "published":
      return "Published";
    case "pending_reference":
      return "Pending Ref";
    case "not_applicable":
      return "N/A";
    case "missing":
      return "Missing";
    default:
      return "Invalid";
  }
}

export function getStatusBadgeVariant(
  status: ProjectScheduleStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "Complete":
      return "default";
    case "In Process":
      return "secondary";
    case "Pending":
      return "outline";
    case "Upcoming":
      return "destructive";
    default:
      return "outline";
  }
}

export function getStatusDotClass(status: ProjectScheduleStatus): string {
  switch (status) {
    case "Complete":
      return "bg-emerald-500";
    case "In Process":
      return "bg-amber-500";
    case "Pending":
      return "bg-slate-500";
    case "Upcoming":
      return "bg-red-200";
    default:
      return "bg-slate-500";
  }
}

export function getUploadBadgeVariant(
  status: ProjectScheduleUploadStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "uploaded_legals":
      return "default";
    case "partial_upload":
      return "secondary";
    case "seeded_from_slots":
      return "outline";
    case "missing_project":
    default:
      return "destructive";
  }
}

export function getUploadBadgeLabel(status: ProjectScheduleUploadStatus): string {
  switch (status) {
    case "uploaded_legals":
      return "Legals Uploaded";
    case "partial_upload":
      return "Partial Upload";
    case "seeded_from_slots":
      return "Seeded Only";
    case "missing_project":
    default:
      return "Missing Project";
  }
}

function normalizeLabelToken(token: string): string {
  const compact = token.trim();
  if (!compact) {
    return compact;
  }

  const hasHash = compact.endsWith("#");
  const core = hasHash ? compact.slice(0, -1) : compact;
  const lowerCore = core.toLowerCase();

  let normalizedCore = core;
  if (UPPERCASE_ABBREVIATIONS.has(lowerCore)) {
    normalizedCore = core.toUpperCase();
  } else if (/[a-zA-Z]/.test(core)) {
    normalizedCore = core.charAt(0).toUpperCase() + core.slice(1).toLowerCase();
  }

  return hasHash ? `${normalizedCore}#` : normalizedCore;
}

export function normalizeColumnLabel(value: string): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return value;
  }

  return normalized
    .split(" ")
    .map((word) =>
      word
        .split("-")
        .map((segment) =>
          segment
            .split("/")
            .map((part) => normalizeLabelToken(part))
            .join("/"),
        )
        .join("-"),
    )
    .join(" ");
}

export function parseLwcTypeFromValue(rawValue: string | undefined): LwcType | undefined {
  if (!rawValue) {
    return undefined;
  }

  const normalized = rawValue.trim().toUpperCase().replace(/\s+/g, " ");
  if (!normalized) {
    return undefined;
  }

  if (normalized.includes("NEW") || normalized.includes("FLEX")) {
    return "NEW_FLEX";
  }
  if (normalized.includes("OFFSKID") || normalized.includes("OFF SKID")) {
    return "OFFSKID";
  }
  if (normalized.includes("ONSKID") || normalized.includes("ON SKID")) {
    return "ONSKID";
  }
  if (normalized.includes("NTB")) {
    return "NTB";
  }
  if (normalized.includes("FLOAT")) {
    return "FLOAT";
  }

  return undefined;
}

export function getExtraColumnValue(
  row: ProjectScheduleSlotsTableRow,
  columnName: string,
): string | undefined {
  const entries = Object.entries(row.extraColumns ?? {});
  const target = columnName.trim().toUpperCase();
  const hit = entries.find(([key]) => key.trim().toUpperCase() === target);
  return hit?.[1];
}
