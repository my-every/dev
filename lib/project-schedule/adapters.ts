import type { ProjectScheduleSlotsTableRow } from "@/components/projects/project-schedule-slots";
import type { ProjectScheduleComparisonRow } from "@/lib/project-schedule/types";

export type ProjectScheduleDerivedLegalsState =
  | "published"
  | "pending_reference"
  | "not_applicable"
  | "missing"
  | "invalid";

export interface ParsedProjectScheduleLegalsValue {
  raw: string;
  normalizedDate: string | null;
  statusCode: "A" | "C" | null;
  state: ProjectScheduleDerivedLegalsState;
}

function toText(value: string | undefined): string {
  return (value ?? "").trim();
}

function formatDisplayDate(value: string | undefined): string {
  const iso = parseIsoOrUsDate(toText(value));
  if (!iso) {
    return toText(value);
  }

  return `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}/${iso.slice(0, 4)}`;
}

function parseIsoOrUsDate(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const iso = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const year = Number(iso[1]);
    const month = Number(iso[2]);
    const day = Number(iso[3]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return null;
    }
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const us = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!us) {
    return null;
  }

  const month = Number(us[1]);
  const day = Number(us[2]);
  const rawYear = Number(us[3]);
  const year = us[3].length === 2 ? 2000 + rawYear : rawYear;
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseProjectScheduleLegalsValue(rawValue: string): ParsedProjectScheduleLegalsValue {
  const raw = rawValue.trim();
  const lower = raw.toLowerCase();

  if (!raw) {
    return {
      raw,
      normalizedDate: null,
      statusCode: null,
      state: "missing",
    };
  }

  if (lower === "see #1") {
    return {
      raw,
      normalizedDate: null,
      statusCode: null,
      state: "pending_reference",
    };
  }

  if (lower === "#n/a") {
    return {
      raw,
      normalizedDate: null,
      statusCode: null,
      state: "not_applicable",
    };
  }

  const suffixMatch = raw.match(/[A-Za-z]$/);
  const suffix = suffixMatch ? suffixMatch[0].toUpperCase() : null;
  const dateOnly = suffix ? raw.slice(0, -1).trim() : raw;
  const normalizedDate = parseIsoOrUsDate(dateOnly);

  if (!normalizedDate) {
    return {
      raw,
      normalizedDate: null,
      statusCode: suffix === "A" || suffix === "C" ? suffix : null,
      state: "invalid",
    };
  }

  return {
    raw,
    normalizedDate,
    statusCode: suffix === "A" || suffix === "C" ? suffix : null,
    state: "published",
  };
}

export function buildProjectScheduleExtraColumns(
  row: ProjectScheduleComparisonRow,
): Record<string, string> {
  const actuals = row.actuals?.milestoneActuals;

  return {
    LWC: toText(row.sourceValues.lwc),
    PROJECT: row.projectName,
    UNIT: row.unit,
    "PD#": row.pdNumber,
    LEGALS: toText(row.plannedLegals),
    "PROJ KITTED": toText(row.plannedProjKitted),
    CONLAY: toText(row.plannedConlay),
    CONASY: toText(row.plannedConassy),
    "TEST 1ST PASS": toText(row.plannedTestFirstPass),
    PWRCHK: toText(row.plannedPwrchk),
    "D380 FINAL-BIQ": toText(row.plannedD380Final),
    "DEPT 380 TARGET": toText(row.plannedDept380Target),
    "NEW COMMMIT": toText(row.plannedCommit),
    "DAYS LATE": row.plannedDaysLate == null ? "" : String(row.plannedDaysLate),
    "LEGALS ACTUAL": formatDisplayDate(actuals?.actualLegalsAt),
    "PROJ KITTED ACTUAL": formatDisplayDate(actuals?.actualProjKittedAt),
    "CONLAY ACTUAL": formatDisplayDate(actuals?.actualConlayAt),
    "CONASY ACTUAL": formatDisplayDate(actuals?.actualConassyAt),
    "PWRCHK ACTUAL": formatDisplayDate(actuals?.actualPwrchkAt),
    "BIQ COMP": formatDisplayDate(actuals?.actualD380FinalAt),
    "DEPT 380 ACTUAL": formatDisplayDate(actuals?.actualDept380CompletedAt),
    "Variance Days": row.varianceDaysToTarget == null ? "" : String(row.varianceDaysToTarget),
    "Completed On Time":
      row.completedOnTime == null ? "" : row.completedOnTime ? "Yes" : "No",
  };
}

export function toProjectScheduleSlotsTableRow(
  row: ProjectScheduleComparisonRow,
  status: ProjectScheduleSlotsTableRow["status"],
  legalsState?: ProjectScheduleSlotsTableRow["legalsState"],
): ProjectScheduleSlotsTableRow {
  const parsedLegals = parseProjectScheduleLegalsValue(row.plannedLegals ?? "");

  return {
    id: row.key,
    sourceIndex: -1,
    pdNumber: row.pdNumber,
    projectName: row.projectName,
    unit: row.unit || "-",
    dueLabel: toText(row.plannedDept380Target),
    dueMonth: parseIsoOrUsDate(row.plannedDept380Target ?? "")?.slice(0, 7) ?? null,
    daysLate: row.plannedDaysLate ?? null,
    legalsState: legalsState ?? parsedLegals.state,
    legalsLabel: parsedLegals.raw,
    status,
    extraColumns: buildProjectScheduleExtraColumns(row),
  };
}
