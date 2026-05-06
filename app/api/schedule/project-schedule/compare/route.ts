import { NextResponse } from "next/server";

import {
  buildProjectScheduleActualsKey,
  cleanProjectScheduleToken,
  diffProjectScheduleDays,
} from "@/lib/project-schedule/actuals";
import {
  ensureProjectScheduleDirs,
  readProjectScheduleActualsDocument,
  readProjectScheduleDocument,
  resolveProjectSchedulePaths,
} from "@/lib/project-schedule/storage";
import type {
  ProjectScheduleActualsDocument,
  ProjectScheduleComparisonDocument,
  ProjectScheduleComparisonRow,
  ProjectScheduleDocument,
  ProjectScheduleRow,
} from "@/lib/project-schedule/types";

export const dynamic = "force-dynamic";

function getRowValue(row: ProjectScheduleRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return "";
}

function buildSourceValues(row: ProjectScheduleRow): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(row)) {
    if (key === "id") {
      continue;
    }
    if (typeof value === "string") {
      next[key] = value;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      next[key] = String(value);
    }
  }
  return next;
}

function buildComparisonRows(
  planned: ProjectScheduleDocument,
  actuals: ProjectScheduleActualsDocument,
): ProjectScheduleComparisonRow[] {
  const rows: ProjectScheduleComparisonRow[] = [];

  for (const group of planned.groups) {
    for (const row of group.rows) {
      const pdNumber = cleanProjectScheduleToken(getRowValue(row, "pd")).toUpperCase();
      const unit = cleanProjectScheduleToken(getRowValue(row, "unit"));
      const projectName = cleanProjectScheduleToken(getRowValue(row, "name", "project"));

      if (!pdNumber && !projectName && !unit) {
        continue;
      }

      const key = buildProjectScheduleActualsKey({
        pdNumber,
        unit,
        projectName,
      });
      const actualRecord = actuals.records[key];
      const plannedTarget = getRowValue(row, "dept380");
      const actualTarget = actualRecord?.milestoneActuals.actualDept380CompletedAt;
      const varianceDaysToTarget = diffProjectScheduleDays(plannedTarget, actualTarget);

      rows.push({
        key,
        projectId: actualRecord?.projectId,
        pdNumber,
        unit,
        projectName,
        sourceValues: buildSourceValues(row),
        plannedLegals: getRowValue(row, "legals"),
        plannedProjKitted: getRowValue(row, "proj"),
        plannedConlay: getRowValue(row, "conlay"),
        plannedConassy: getRowValue(row, "conasy"),
        plannedTestFirstPass: getRowValue(row, "test"),
        plannedPwrchk: getRowValue(row, "pwrchk"),
        plannedD380Final: getRowValue(row, "d380Final"),
        plannedDept380Target: plannedTarget,
        plannedCommit: getRowValue(row, "commit"),
        plannedDaysLate: (() => {
          const raw = row.daysLate;
          return typeof raw === "number" && Number.isFinite(raw) ? raw : Number.parseInt(String(raw ?? ""), 10) || 0;
        })(),
        actuals: actualRecord,
        varianceDaysToTarget,
        completedOnTime:
          varianceDaysToTarget == null
            ? null
            : varianceDaysToTarget <= 0,
      });
    }
  }

  return rows.sort((left, right) => {
    const leftTarget = left.plannedDept380Target || "9999-12-31";
    const rightTarget = right.plannedDept380Target || "9999-12-31";
    if (leftTarget !== rightTarget) {
      return leftTarget.localeCompare(rightTarget);
    }
    if (left.pdNumber !== right.pdNumber) {
      return left.pdNumber.localeCompare(right.pdNumber, undefined, { numeric: true, sensitivity: "base" });
    }
    return left.unit.localeCompare(right.unit, undefined, { numeric: true, sensitivity: "base" });
  });
}

export async function GET() {
  try {
    const paths = await resolveProjectSchedulePaths();
    await ensureProjectScheduleDirs(paths);
    const [planned, actuals] = await Promise.all([
      readProjectScheduleDocument(paths),
      readProjectScheduleActualsDocument(paths.actualsFile),
    ]);

    const document: ProjectScheduleComparisonDocument = {
      rows: buildComparisonRows(planned, actuals),
      importedAt: planned.importedAt,
      actualsUpdatedAt: actuals.updatedAt,
      sourceFile: planned.sourceFile,
    };

    return NextResponse.json(document);
  } catch (error) {
    console.error("Failed to compare project schedule planned vs actuals:", error);
    return NextResponse.json(
      { error: "Failed to compare project schedule planned vs actuals" },
      { status: 500 },
    );
  }
}
