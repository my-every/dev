import type { MappedAssignment } from "@/lib/assignment/mapped-assignment";
import type { ProjectScheduleSlotsTableRow } from "@/components/projects/project-schedule-slots";
import type { ProjectManifest } from "@/types/project-manifest";

export interface ExportSheetItem {
  fileName: string;
  relativePath: string;
  rowCount?: number;
  sheetName?: string;
}

export interface ExportManifest {
  combinedFileName?: string;
  combinedRelativePath?: string;
  sheetExports?: ExportSheetItem[];
}

export interface AssignmentUnitGroup {
  unitType: string;
  assignments: MappedAssignment[];
  completeCount: number;
  progressPercent: number;
}

export interface ScheduleStepperMilestoneConfig {
  key: string;
  label: string;
  plannedField: string;
  actualAliases?: string[];
}

export interface ScheduleStepperMilestone {
  key: string;
  label: string;
  plannedRaw: string;
  plannedDate: Date | null;
  actualRaw: string;
  actualDate: Date | null;
  isReached: boolean;
}

export interface ProjectScheduleStats {
  total: number;
  complete: number;
  inProgress: number;
  pending: number;
  completionPercent: number;
  unitTypeCount: number;
  referenceCount: number;
}

export interface ProjectScheduleDetailsDataPayload {
  project: ProjectManifest;
  assignments: MappedAssignment[];
  brandingExports: ExportManifest | null;
  wireListExports: ExportManifest | null;
}

export const STAGE_SUBGROUPS: Array<{ label: string; stages: string[] }> = [
  {
    label: "Queued",
    stages: [
      "READY_TO_LAY",
      "READY_TO_WIRE",
      "READY_FOR_VISUAL",
      "READY_TO_HANG",
      "READY_TO_CROSS_WIRE",
      "READY_TO_TEST",
      "READY_FOR_BIQ",
    ],
  },
  {
    label: "In Work",
    stages: ["BUILD_UP", "WIRING", "BOX_BUILD", "CROSS_WIRE", "TEST_1ST_PASS", "BIQ"],
  },
  {
    label: "Complete",
    stages: ["FINISHED_BIQ"],
  },
];

export const STEP_MILESTONES: ScheduleStepperMilestoneConfig[] = [
  { key: "LEGALS", label: "LEGALS", plannedField: "LEGALS", actualAliases: ["LEGALS A/C", "LEGALS ACTUAL"] },
  { key: "BRAND_LIST", label: "BRAND LIST", plannedField: "BRAND LIST", actualAliases: ["BRAND LIST A/C", "BRAND LIST ACTUAL"] },
  { key: "BRAND_WIRE", label: "BRAND WIRE", plannedField: "BRAND WIRE", actualAliases: ["BRAND WIRE A/C", "BRAND WIRE ACTUAL"] },
  { key: "PROJ_KITTED", label: "PROJ KITTED", plannedField: "PROJ KITTED", actualAliases: ["PROJ KITTED A/C", "PROJ KITTED ACTUAL"] },
  { key: "CONLAY", label: "CONLAY", plannedField: "CONLAY", actualAliases: ["CONLAY A/C", "CONLAY ACTUAL"] },
  { key: "CONASY", label: "CONASY", plannedField: "CONASY", actualAliases: ["CONASY A/C", "CONASY ACTUAL"] },
  { key: "PWRCHK", label: "PWRCHK", plannedField: "PWRCHK", actualAliases: ["NEW PWRCHK", "PWRCHK ACTUAL"] },
  { key: "D380_FINAL_BIQ", label: "D380 FINAL-BIQ", plannedField: "D380 FINAL-BIQ", actualAliases: ["BIQ COMP", "D380 FINAL-BIQ A/C", "D380 FINAL-BIQ ACTUAL"] },
  { key: "DEPT_380_TARGET", label: "DEPT 380 TARGET", plannedField: "DEPT 380 TARGET", actualAliases: ["DEPT 380 TARGET A/C", "DEPT 380 ACTUAL"] },
];

export const STAGE_MILESTONE_INDEX: Record<string, number> = {
  READY_TO_LAY: 4,
  BUILD_UP: 4,
  READY_TO_WIRE: 5,
  WIRING: 5,
  READY_TO_TEST: 6,
  TEST_1ST_PASS: 6,
  READY_FOR_BIQ: 7,
  BIQ: 7,
  FINISHED_BIQ: 8,
};

export function normalizeUnitTypeToken(rawValue: string | undefined): string {
  if (!rawValue) return "UNSPECIFIED";
  const match = rawValue.match(/\b(JB\d+)\b/i);
  if (match?.[1]) return match[1].toUpperCase();
  const compact = rawValue.trim();
  return compact ? compact.toUpperCase() : "UNSPECIFIED";
}

export function inferAssignmentUnitType(assignment: MappedAssignment, fallback?: string): string {
  const fromLayout = normalizeUnitTypeToken(assignment.matchedLayoutTitle);
  if (fromLayout !== "UNSPECIFIED") return fromLayout;

  const fromName = normalizeUnitTypeToken(assignment.sheetName);
  if (fromName !== "UNSPECIFIED") return fromName;

  return normalizeUnitTypeToken(fallback);
}

export function formatStageLabel(stage: string): string {
  return stage
    .toLowerCase()
    .split("_")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}

export async function loadProjectScheduleDetailsData(row: ProjectScheduleSlotsTableRow): Promise<ProjectScheduleDetailsDataPayload> {
  const response = await fetch("/api/projects/projects", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load project manifests");
  }

  const payload = (await response.json()) as { manifests?: ProjectManifest[] };
  const manifests = payload.manifests ?? [];

  const pd = row.pdNumber.trim().toUpperCase();
  const unit = row.unit.trim();
  const projectName = row.projectName.trim().toUpperCase();

  const match =
    manifests.find(
      (manifest) =>
        manifest.pdNumber?.trim().toUpperCase() === pd &&
        (manifest.unitNumber?.trim() ?? "") === unit,
    ) ??
    manifests.find(
      (manifest) =>
        manifest.pdNumber?.trim().toUpperCase() === pd &&
        manifest.name.trim().toUpperCase() === projectName,
    ) ??
    manifests.find((manifest) => manifest.pdNumber?.trim().toUpperCase() === pd) ??
    null;

  if (!match) {
    throw new Error(`No project manifest found for ${row.pdNumber} unit ${row.unit}`);
  }

  const [assignmentRes, brandingRes, wireRes] = await Promise.all([
    fetch(`/api/projects/${encodeURIComponent(match.id)}/assignment-mappings`, { cache: "no-store" }),
    fetch(`/api/projects/${encodeURIComponent(match.id)}/exports?kind=branding`, { cache: "no-store" }).catch(() => null),
    fetch(`/api/projects/${encodeURIComponent(match.id)}/exports?kind=wire-lists`, { cache: "no-store" }).catch(() => null),
  ]);

  const assignments = assignmentRes.ok
    ? (((await assignmentRes.json()) as { mappings?: MappedAssignment[] }).mappings ?? [])
    : [];
  const brandingExports = brandingRes?.ok
    ? ((await brandingRes.json()) as ExportManifest)
    : null;
  const wireListExports = wireRes?.ok
    ? ((await wireRes.json()) as ExportManifest)
    : null;

  return {
    project: match,
    assignments,
    brandingExports,
    wireListExports,
  };
}

export function buildAssignmentUnitGroups(
  assignments: MappedAssignment[],
  fallbackUnitType?: string,
): AssignmentUnitGroup[] {
  const operationalAssignments = assignments.filter((entry) => entry.sheetKind === "assignment");
  const groupMap = new Map<string, MappedAssignment[]>();

  for (const assignment of operationalAssignments) {
    const unitType = inferAssignmentUnitType(assignment, fallbackUnitType);
    const existing = groupMap.get(unitType);
    if (existing) {
      existing.push(assignment);
    } else {
      groupMap.set(unitType, [assignment]);
    }
  }

  return Array.from(groupMap.entries())
    .map(([unitType, groupedAssignments]) => {
      const completeCount = groupedAssignments.filter((entry) => entry.selectedStatus === "COMPLETE").length;
      return {
        unitType,
        assignments: groupedAssignments.sort((a, b) => a.sheetName.localeCompare(b.sheetName)),
        completeCount,
        progressPercent: groupedAssignments.length
          ? Math.round((completeCount / groupedAssignments.length) * 100)
          : 0,
      };
    })
    .sort((a, b) => a.unitType.localeCompare(b.unitType));
}

export function buildProjectScheduleStats(
  operationalAssignments: MappedAssignment[],
  assignmentGroups: AssignmentUnitGroup[],
  referenceMappings: MappedAssignment[],
): ProjectScheduleStats {
  const total = operationalAssignments.length;
  const complete = operationalAssignments.filter((entry) => entry.selectedStatus === "COMPLETE").length;
  const inProgress = operationalAssignments.filter((entry) => entry.selectedStatus === "IN_PROGRESS").length;
  const pending = operationalAssignments.filter((entry) => entry.selectedStatus === "NOT_STARTED").length;

  return {
    total,
    complete,
    inProgress,
    pending,
    completionPercent: total ? Math.round((complete / total) * 100) : 0,
    unitTypeCount: assignmentGroups.length,
    referenceCount: referenceMappings.length,
  };
}

export function buildProjectScheduleStepper(
  row: ProjectScheduleSlotsTableRow | null,
  operationalAssignments: MappedAssignment[],
) {
  const source = row?.extraColumns ?? {};
  const legalsValue = row?.legalsLabel ?? source.LEGALS ?? "";
  const targetValue = row?.dueLabel ?? source["DEPT 380 TARGET"] ?? "";

  const stageIndexFromAssignments = operationalAssignments.reduce((maxIndex, assignment) => {
    const index = STAGE_MILESTONE_INDEX[assignment.selectedStage] ?? -1;
    return Math.max(maxIndex, index);
  }, -1);

  const fallbackStatusIndex = row?.status === "Complete"
    ? STEP_MILESTONES.length - 1
    : row?.status === "In Process"
      ? 5
      : row?.status === "Pending"
        ? 3
        : -1;

  const reachedByProgressIndex = Math.max(stageIndexFromAssignments, fallbackStatusIndex);

  const milestones: ScheduleStepperMilestone[] = STEP_MILESTONES.map((step, index) => {
    const plannedRaw = step.plannedField === "LEGALS"
      ? legalsValue
      : step.plannedField === "DEPT 380 TARGET"
        ? targetValue
        : (source[step.plannedField] ?? "");

    const plannedDate = parseScheduleDate(plannedRaw);
    const actualRaw = [step.label, ...(step.actualAliases ?? [])]
      .map((alias) => source[alias] ?? "")
      .find((value) => value.trim().length > 0) ?? "";
    const actualDate = parseScheduleDate(actualRaw);
    const isReached = Boolean(actualDate) || reachedByProgressIndex >= index;

    return {
      key: step.key,
      label: step.label,
      plannedRaw,
      plannedDate,
      actualRaw,
      actualDate,
      isReached,
    };
  });

  const completed = milestones.filter((step) => step.isReached).length;
  const percent = milestones.length ? Math.round((completed / milestones.length) * 100) : 0;

  return {
    milestones,
    completed,
    percent,
    total: milestones.length,
  };
}

export function getStatusVariant(status: MappedAssignment["selectedStatus"]): "solid" | "dot" {
  switch (status) {
    case "COMPLETE":
      return "solid";
    case "IN_PROGRESS":
      return "solid";
    case "INCOMPLETE":
      return "dot";
    case "NOT_STARTED":
    default:
      return "dot";
  }
}

export function buildExportFileUrl(projectId: string, relativePath: string): string {
  const cleaned = relativePath.trim().replace(/^\/+/, "");
  const segments = cleaned.split("/").filter(Boolean);
  const fileSegments = segments[0] === "exports" ? segments.slice(1) : segments;
  const encoded = fileSegments.map((segment) => encodeURIComponent(segment)).join("/");
  return `/api/projects/${encodeURIComponent(projectId)}/exports/files/${encoded}?download=1`;
}

export function parseScheduleDate(rawValue: string | undefined): Date | null {
  if (!rawValue) return null;
  const normalized = rawValue.trim();
  if (!normalized) return null;
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
    return null;
  }

  const date = new Date(year, month - 1, day);
  if (
    Number.isNaN(date.getTime()) ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getFullYear() !== year
  ) {
    return null;
  }

  return date;
}

export function formatScheduleDisplayDate(date: Date | null, fallback: string): string {
  if (!date) return fallback || "-";
  const month = `${date.getMonth() + 1}`;
  const day = `${date.getDate()}`;
  const year = `${date.getFullYear()}`;
  return `${month}/${day}/${year}`;
}
