import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";

import { resolveShareDirectory } from "@/lib/runtime/share-directory";
import type {
  ProjectScheduleActualsDocument,
  ProjectScheduleDocument,
} from "@/lib/project-schedule/types";

export interface ProjectSchedulePaths {
  shareProjectsDir: string;
  shareScheduleDir: string;
  shareProjectsScheduleFile: string;
  shareScheduleFile: string;
  shareSlotsFile: string;
  shareProjectsScheduleTsFile: string;
  shareScheduleTsFile: string;
  actualsFile: string;
}

export const EMPTY_PROJECT_SCHEDULE_DOCUMENT: ProjectScheduleDocument = {
  columns: [],
  groups: [],
  importedAt: "",
};

export const EMPTY_PROJECT_SCHEDULE_ACTUALS_DOCUMENT: ProjectScheduleActualsDocument = {
  records: {},
  updatedAt: "",
  sourceFile: "project-schedule-actuals.json",
};

export async function resolveProjectSchedulePaths(): Promise<ProjectSchedulePaths> {
  const shareRoot = await resolveShareDirectory();
  const shareProjectsDir = path.join(shareRoot, "Projects");
  const shareScheduleDir = path.join(shareRoot, "Schedule");

  return {
    shareProjectsDir,
    shareScheduleDir,
    shareProjectsScheduleFile: path.join(shareProjectsDir, "schedule.json"),
    shareScheduleFile: path.join(shareScheduleDir, "project-schedule.json"),
    shareSlotsFile: path.join(shareScheduleDir, "Schedule.csv"),
    shareProjectsScheduleTsFile: path.join(shareProjectsDir, "schedule.ts"),
    shareScheduleTsFile: path.join(shareScheduleDir, "project-schedule.ts"),
    actualsFile: path.join(shareScheduleDir, "project-schedule-actuals.json"),
  };
}

export async function ensureProjectScheduleDirs(paths: ProjectSchedulePaths) {
  await fs.mkdir(paths.shareProjectsDir, { recursive: true });
  await fs.mkdir(paths.shareScheduleDir, { recursive: true });
}

export async function readProjectScheduleDocument(
  paths: ProjectSchedulePaths,
): Promise<ProjectScheduleDocument> {
  const candidates = [paths.shareProjectsScheduleFile, paths.shareScheduleFile];
  for (const filePath of candidates) {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as ProjectScheduleDocument;
      if (parsed && Array.isArray(parsed.groups) && Array.isArray(parsed.columns)) {
        const hasRows = parsed.groups.some((group) => Array.isArray(group.rows) && group.rows.length > 0);
        if (hasRows) {
          return parsed;
        }
      }
    } catch {
      // Continue to fallback candidate.
    }
  }

  try {
    const raw = await fs.readFile(paths.shareSlotsFile, "utf-8");
    const workbook = XLSX.read(raw, { type: "string", raw: false });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
    const parsed = firstSheet
      ? (XLSX.utils.sheet_to_json(firstSheet, {
          defval: "",
          raw: false,
        }) as Array<Record<string, string | number>>)
      : [];
    if (Array.isArray(parsed)) {
      const columns = Array.from(
        new Set(parsed.flatMap((row) => Object.keys(row))),
      ).map((key) => ({
        key,
        label: key,
        filterable: true,
      }));

      const groupsMap = new Map<string, ProjectScheduleDocument["groups"][number]>();

      parsed.forEach((row, index) => {
        const pdNumber = String(row["PD#"] ?? "").trim();
        const projectName = String(row["PROJECT"] ?? "").trim();
        const groupKey = `${pdNumber}::${projectName}` || `group-${index}`;
        const existing = groupsMap.get(groupKey);

        const normalizedRow = {
          id: `${pdNumber || "row"}-${String(row["UNIT"] ?? index).trim() || index}`,
          pd: pdNumber,
          name: projectName,
          unit: String(row["UNIT"] ?? "").trim(),
          legals: String(row["LEGALS"] ?? "").trim(),
          proj: String(row["PROJ KITTED"] ?? "").trim(),
          conlay: String(row["CONLAY"] ?? "").trim(),
          conasy: String(row["CONASY"] ?? "").trim(),
          test: String(row["TEST 1ST PASS"] ?? "").trim(),
          pwrchk: String(row["PWRCHK"] ?? "").trim(),
          d380Final: String(row["D380 FINAL-BIQ"] ?? "").trim(),
          dept380: String(row["DEPT 380 TARGET"] ?? "").trim(),
          commit: String(row["NEW COMMMIT"] ?? "").trim(),
          daysLate: Number.parseInt(String(row["DAYS LATE"] ?? "").trim(), 10) || 0,
          ...row,
        };

        if (existing) {
          existing.rows.push(normalizedRow);
          return;
        }

        groupsMap.set(groupKey, {
          id: groupKey,
          projectLabel: projectName || pdNumber || `Group ${index + 1}`,
          rows: [normalizedRow],
        });
      });

      return {
        columns,
        groups: Array.from(groupsMap.values()),
        importedAt: new Date().toISOString(),
        sourceFile: path.basename(paths.shareSlotsFile),
      };
    }
  } catch {
    // Continue to empty fallback.
  }

  return EMPTY_PROJECT_SCHEDULE_DOCUMENT;
}

export async function readProjectScheduleActualsDocument(
  filePath: string,
): Promise<ProjectScheduleActualsDocument> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as ProjectScheduleActualsDocument;
    if (!parsed || typeof parsed !== "object" || typeof parsed.records !== "object" || parsed.records == null) {
      return EMPTY_PROJECT_SCHEDULE_ACTUALS_DOCUMENT;
    }

    return {
      records: parsed.records,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : "",
      sourceFile: typeof parsed.sourceFile === "string" ? parsed.sourceFile : "project-schedule-actuals.json",
    };
  } catch {
    return EMPTY_PROJECT_SCHEDULE_ACTUALS_DOCUMENT;
  }
}
