"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  RefreshCw,
} from "lucide-react";

import {
  type ProjectScheduleStatus,
} from "@/components/projects/project-schedule-slots";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildProjectScheduleExtraColumns,
  parseProjectScheduleLegalsValue,
  type ParsedProjectScheduleLegalsValue,
} from "@/lib/project-schedule/adapters";
import { fetchProjectScheduleComparison } from "@/lib/project-schedule/client";
import type { ProjectScheduleComparisonRow } from "@/lib/project-schedule/types";

type BranderDashboardProps = {
  badgeNumber: string;
};

interface BranderChecklistState {
  checkedSlotChart: boolean;
  checkedDateUpdates: boolean;
  checkedLegalFiles: boolean;
  uploadedLegalFiles: boolean;
  notes: string;
  updatedAt: string | null;
  updatedBy: string | null;
}

interface BranderScheduleRow {
  id: string;
  source: ProjectScheduleComparisonRow;
  pdNumber: string;
  projectName: string;
  unit: string;
  dept380TargetRaw: string;
  dueMonth: string | null;
  daysLate: number | null;
  legals: ParsedProjectScheduleLegalsValue;
  extraColumns: Record<string, string>;
  checklist: BranderChecklistState;
}

const CHECKLIST_STORAGE_PREFIX = "brander-dashboard-checklist-v1";

const EMPTY_CHECKLIST: BranderChecklistState = {
  checkedSlotChart: false,
  checkedDateUpdates: false,
  checkedLegalFiles: false,
  uploadedLegalFiles: false,
  notes: "",
  updatedAt: null,
  updatedBy: null,
};

function parseDateToIso(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) {
    return null;
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = match[3].length === 2 ? 2000 + rawYear : rawYear;

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return iso;
}

function parseDaysLate(rawValue: string): number | null {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUnitNumber(rawValue: string): number | null {
  const value = rawValue.trim();
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function checklistIsComplete(checklist: BranderChecklistState): boolean {
  return (
    checklist.checkedSlotChart &&
    checklist.checkedDateUpdates &&
    checklist.checkedLegalFiles &&
    checklist.uploadedLegalFiles
  );
}

function checklistNeedsAttention(row: BranderScheduleRow): boolean {
  if (row.legals.state !== "published") {
    return false;
  }

  return !checklistIsComplete(row.checklist);
}

function getRowStatus(row: BranderScheduleRow): ProjectScheduleStatus {
  if (checklistIsComplete(row.checklist)) {
    return "Complete";
  }

  if (hasChecklistData(row.checklist)) {
    return "In Process";
  }

  if (row.legals.state === "published") {
    return "Pending";
  }

  return "Upcoming";
}

function getLegalsStateLabel(state: ParsedProjectScheduleLegalsValue["state"]): string {
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

function getLegalsStateVariant(
  state: ParsedProjectScheduleLegalsValue["state"],
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

function getChecklistStorageKey(badgeNumber: string): string {
  return `${CHECKLIST_STORAGE_PREFIX}:${badgeNumber}`;
}

function hasChecklistData(entry: BranderChecklistState | undefined): boolean {
  if (!entry) {
    return false;
  }

  return Boolean(
    entry.checkedSlotChart ||
    entry.checkedDateUpdates ||
    entry.checkedLegalFiles ||
    entry.uploadedLegalFiles ||
    entry.notes.trim() ||
    entry.updatedAt,
  );
}

function compactChecklistMap(
  nextMap: Record<string, BranderChecklistState>,
): Record<string, BranderChecklistState> {
  const compact: Record<string, BranderChecklistState> = {};

  for (const [rowId, checklist] of Object.entries(nextMap)) {
    if (!hasChecklistData(checklist)) {
      continue;
    }

    compact[rowId] = {
      ...EMPTY_CHECKLIST,
      ...checklist,
      // keep notes bounded so one long note cannot consume storage quota
      notes: checklist.notes.slice(0, 500),
    };
  }

  return compact;
}

function loadChecklistMap(
  badgeNumber: string,
): Record<string, BranderChecklistState> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const key = getChecklistStorageKey(badgeNumber);
    const raw =
      window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, BranderChecklistState>;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }

    return parsed;
  } catch {
    return {};
  }
}

function saveChecklistMap(
  badgeNumber: string,
  nextMap: Record<string, BranderChecklistState>,
): { ok: boolean; message?: string } {
  if (typeof window === "undefined") {
    return { ok: true };
  }

  const key = getChecklistStorageKey(badgeNumber);
  const compactMap = compactChecklistMap(nextMap);
  const payload = JSON.stringify(compactMap);

  try {
    window.localStorage.setItem(key, payload);
    window.sessionStorage.removeItem(key);
    return { ok: true };
  } catch {
    try {
      window.sessionStorage.setItem(key, payload);
      return {
        ok: true,
        message:
          "Checklist saved to temporary session storage because local storage is full.",
      };
    } catch {
      return {
        ok: false,
        message:
          "Could not persist checklist data because browser storage is full.",
      };
    }
  }
}

function mergeChecklist(
  existing: BranderChecklistState | undefined,
): BranderChecklistState {
  return {
    ...EMPTY_CHECKLIST,
    ...existing,
  };
}

function toScheduleRow(
  row: ProjectScheduleComparisonRow,
  checklistMap: Record<string, BranderChecklistState>,
  unit1LegalsByPd: Record<string, string | null>,
): BranderScheduleRow {
  const pdNumber = row.pdNumber.toUpperCase();
  const projectName = row.projectName || "Unnamed Project";
  const unit = row.unit || "-";
  const dept380TargetRaw = row.plannedDept380Target ?? "";
  const dept380TargetIso = parseDateToIso(dept380TargetRaw);
  const dueMonth = dept380TargetIso ? dept380TargetIso.slice(0, 7) : null;

  const rawLegals = row.plannedLegals ?? "";
  const parsedLegals = parseProjectScheduleLegalsValue(rawLegals);
  const inheritedUnit1Legals =
    parsedLegals.state === "pending_reference"
      ? (unit1LegalsByPd[pdNumber] ?? null)
      : null;
  const effectiveLegals: ParsedProjectScheduleLegalsValue = inheritedUnit1Legals
    ? {
        raw: `${rawLegals} (Unit 1)`,
        normalizedDate: inheritedUnit1Legals,
        statusCode: null,
        state: "published",
      }
    : parsedLegals;
  const rowId = row.key || `${pdNumber || "UNKNOWN"}-${unit || "NA"}`;
  const checklist = mergeChecklist(checklistMap[rowId]);
  const extraColumns = buildProjectScheduleExtraColumns(row);

  return {
    id: rowId,
    source: row,
    pdNumber: pdNumber || "UNKNOWN",
    projectName,
    unit,
    dept380TargetRaw,
    dueMonth,
    daysLate: row.plannedDaysLate ?? parseDaysLate(extraColumns["DAYS LATE"] ?? ""),
    legals: effectiveLegals,
    extraColumns,
    checklist,
  };
}

export function BranderDashboard({ badgeNumber }: BranderDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<BranderScheduleRow[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const payload = await fetchProjectScheduleComparison();
        const sourceRows = payload.rows ?? [];

        const checklistMap = loadChecklistMap(badgeNumber);

        const unit1LegalsByPd: Record<string, string | null> = {};
        for (const rawRow of sourceRows) {
          const pd = rawRow.pdNumber.trim().toUpperCase();
          if (!pd) {
            continue;
          }

          const unitNumber = parseUnitNumber(rawRow.unit);
          if (unitNumber !== 1) {
            continue;
          }

          const parsed = parseProjectScheduleLegalsValue(rawRow.plannedLegals ?? "");
          if (parsed.state === "published" && parsed.normalizedDate) {
            if (
              !unit1LegalsByPd[pd] ||
              parsed.normalizedDate < (unit1LegalsByPd[pd] || "")
            ) {
              unit1LegalsByPd[pd] = parsed.normalizedDate;
            }
          }
        }

        const normalizedRows = sourceRows.map((rawRow) =>
          toScheduleRow(rawRow, checklistMap, unit1LegalsByPd),
        );

        normalizedRows.sort((left, right) => {
          const leftDue = left.dueMonth ? `${left.dueMonth}-31` : "9999-12-31";
          const rightDue = right.dueMonth ? `${right.dueMonth}-31` : "9999-12-31";
          if (leftDue !== rightDue) {
            return leftDue.localeCompare(rightDue);
          }
          return left.pdNumber.localeCompare(right.pdNumber, undefined, {
            numeric: true,
            sensitivity: "base",
          });
        });

        if (!cancelled) {
          setRows(normalizedRows);
          setSelectedRowId((prev) => prev || normalizedRows[0]?.id || "");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Failed to load dashboard data",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [badgeNumber]);

  const summary = useMemo(() => {
    const published = rows.filter(
      (row) => row.legals.state === "published",
    ).length;
    const pending = rows.filter(
      (row) => row.legals.state === "pending_reference",
    ).length;
    const checklistOpen = rows.filter((row) =>
      checklistNeedsAttention(row),
    ).length;
    const overdue = rows.filter(
      (row) => (row.daysLate ?? 0) > 0,
    ).length;

    return {
      published,
      pending,
      checklistOpen,
      overdue,
      total: rows.length,
    };
  }, [rows]);

  const updateChecklist = (
    rowId: string,
    updater: (current: BranderChecklistState) => BranderChecklistState,
  ) => {
    setRows((prev) => {
      const next = prev.map((row) => {
        if (row.id !== rowId) {
          return row;
        }

        const updated = updater(row.checklist);
        return {
          ...row,
          checklist: {
            ...updated,
            updatedAt: new Date().toISOString(),
            updatedBy: badgeNumber,
          },
        };
      });

      const checklistMap: Record<string, BranderChecklistState> = {};
      for (const row of next) {
        checklistMap[row.id] = row.checklist;
      }
      const result = saveChecklistMap(badgeNumber, checklistMap);
      setStorageMessage(result.message ?? null);

      return next;
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" />
            Brander Priority Dashboard
          </CardTitle>
          <CardDescription>
            Prioritize by DEPT 380 TARGET month and track LEGALS publication
            workflow with checklist actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Visible Projects
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.total}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                LEGALS Published
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.published}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                LEGALS Pending Ref
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.pending}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Checklist Open
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.checklistOpen}
              </p>
            </div>
            <div className="rounded-md border bg-muted/30 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Days Late &gt; 0
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.overdue}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <Card>
          <CardContent className="py-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading slot schedule...
            </div>
          </CardContent>
        </Card>
      ) : null}

      {error ? (
        <Card className="border-destructive/40">
          <CardContent className="py-6">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      ) : null}

      {storageMessage ? (
        <Card className="border-amber-300/60">
          <CardContent className="py-4">
            <p className="text-sm text-amber-700">{storageMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      {!isLoading && !error ? null : null}
    </div>
  );
}
