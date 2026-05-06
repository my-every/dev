import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { readProjectBundle, resolveProjectStateDirectory } from "@/lib/project-state/share-project-state-handlers";
import {
  ASSIGNMENT_STAGES,
  SWS_STAGE_PROFILES,
  type AssignmentStageId,
  type SwsTypeId,
} from "@/types/d380-assignment-stages";
import { estimateWireTime } from "@/lib/wire-list-print/time-estimation";
import type { ManifestAssignment } from "@/types/project-manifest";
import { getOperationCode, type OperationTimeEntry } from "@/types/d380-operation-codes";

export interface SheetTimeBreakdown {
  sheetId: string;
  sheetName: string;
  rowCount: number;
  estimatedMinutes: number;
}

export interface StageHoursEntry {
  stageId: AssignmentStageId;
  label: string;
  shortLabel: string;
  category: string;
  order: number;
  estimatedMinutes: number;
  averageMinutes: number;
  actualMinutes: number;
}

export interface ProjectStageHoursResponse {
  projectId: string;
  totalEstimatedMinutes: number;
  totalAverageMinutes: number;
  totalActualMinutes: number;
  stages: StageHoursEntry[];
  sheets: SheetTimeBreakdown[];
}

async function readOperationEntries(projectId: string): Promise<OperationTimeEntry[]> {
  const stateDir = await resolveProjectStateDirectory(projectId);
  if (!stateDir) return [];
  try {
    const raw = await fs.readFile(path.join(stateDir, "operation-time.json"), "utf-8");
    const payload = JSON.parse(raw) as { entries?: OperationTimeEntry[] };
    return Array.isArray(payload.entries) ? payload.entries : [];
  } catch {
    return [];
  }
}

function computeSheetWiringMinutes(
  rows: Array<{ gaugeSize?: string; fromDeviceId?: string; toDeviceId?: string; wireNo?: string; wireId?: string }>,
): number {
  let total = 0;
  for (const row of rows) {
    const wireNo = (row.wireNo || "").trim();
    const wireId = (row.wireId || "").trim();
    const gaugeSize = (row.gaugeSize || "").trim();
    if (wireNo === "*" && !wireId && !gaugeSize) continue;

    const est = estimateWireTime(undefined, row.gaugeSize);
    total += est.totalMinutes;
  }
  return total;
}

function computeStageHoursFromWiringTotal(
  wiringMinutes: number,
  swsType: SwsTypeId = "PANEL",
): StageHoursEntry[] {
  const profile = SWS_STAGE_PROFILES[swsType] ?? SWS_STAGE_PROFILES.UNDECIDED;
  const weights = profile.stageWeightPercent;
  const wiringWeight = (weights.WIRING ?? 40) / 100;
  const impliedTotal = wiringWeight > 0 ? wiringMinutes / wiringWeight : wiringMinutes;

  return ASSIGNMENT_STAGES
    .filter((stage) => !stage.isQueue && weights[stage.id] != null)
    .map((stage) => {
      const weight = (weights[stage.id] ?? 0) / 100;
      const estimated = stage.id === "WIRING"
        ? Math.round(wiringMinutes)
        : Math.round(impliedTotal * weight);

      return {
        stageId: stage.id,
        label: stage.label,
        shortLabel: stage.shortLabel,
        category: stage.category,
        order: stage.order,
        estimatedMinutes: estimated,
        averageMinutes: estimated,
        actualMinutes: 0,
      };
    });
}

function parseTimeToMinutes(value?: string): number {
  if (!value) return 0;
  const hoursMatch = value.match(/(\d+)\s*h/i);
  const minutesMatch = value.match(/(\d+)\s*m/i);
  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
  return hours * 60 + minutes;
}

function mapSwsTypeToProfile(swsType?: string): SwsTypeId {
  const normalized = (swsType ?? "").trim().toUpperCase();
  switch (normalized) {
    case "BOX":
    case "BOX_BUILD":
      return "BOX_BUILD";
    case "RAIL":
    case "RAIL_BUILD":
      return "RAIL_BUILD";
    case "BLANK":
    case "BLANK_PANEL":
      return "BLANK_PANEL";
    case "COMPONENT_BUILD":
      return "COMPONENT_BUILD";
    case "WIRING_ONLY":
      return "WIRING_ONLY";
    case "PANEL":
      return "PANEL";
    default:
      return "UNDECIDED";
  }
}

function deriveAssignmentStageHours(assignment: ManifestAssignment): Record<AssignmentStageId, number> {
  const buildUpMinutes = parseTimeToMinutes(assignment.buildUpEstTime);
  const wiringMinutes = parseTimeToMinutes(assignment.wireListEstTime);
  const profile = SWS_STAGE_PROFILES[mapSwsTypeToProfile(assignment.swsType)] ?? SWS_STAGE_PROFILES.UNDECIDED;
  const weights = profile.stageWeightPercent;

  const impliedTotals: number[] = [];
  if (buildUpMinutes > 0 && (weights.BUILD_UP ?? 0) > 0) {
    impliedTotals.push(buildUpMinutes / ((weights.BUILD_UP ?? 0) / 100));
  }
  if (wiringMinutes > 0 && (weights.WIRING ?? 0) > 0) {
    impliedTotals.push(wiringMinutes / ((weights.WIRING ?? 0) / 100));
  }

  const fallbackTotal = buildUpMinutes + wiringMinutes;
  const impliedTotal = impliedTotals.length > 0
    ? impliedTotals.reduce((sum, value) => sum + value, 0) / impliedTotals.length
    : fallbackTotal;

  const derived: Record<AssignmentStageId, number> = {} as Record<AssignmentStageId, number>;
  for (const stage of ASSIGNMENT_STAGES) {
    if (stage.isQueue) {
      derived[stage.id] = 0;
      continue;
    }
    const weight = (weights[stage.id] ?? 0) / 100;
    derived[stage.id] = weight > 0 ? Math.round(impliedTotal * weight) : 0;
  }

  if (buildUpMinutes > 0) {
    derived.BUILD_UP = buildUpMinutes;
  }
  if (wiringMinutes > 0) {
    derived.WIRING = wiringMinutes;
  }

  return derived;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const bundle = await readProjectBundle(projectId);

    if (!bundle) {
      return NextResponse.json(
        { error: "Project not found", projectId },
        { status: 404 },
      );
    }

    const { manifest, sheetSchemas } = bundle;
    const operationEntries = await readOperationEntries(projectId);
    const operationalSchemas = sheetSchemas.filter((schema) => schema.kind === "operational");
    const manifestAssignments = Object.values(manifest.assignments ?? {})
      .filter((assignment) => assignment.kind === "operational");

    const sheetBreakdowns: SheetTimeBreakdown[] = [];
    let stages: StageHoursEntry[] = [];

    if (manifestAssignments.length > 0) {
      const stageTotals = new Map<AssignmentStageId, number>();

      for (const assignment of manifestAssignments) {
        const fallbackSchema = operationalSchemas.find((schema) => schema.slug === assignment.sheetSlug);
        const fallbackRows = fallbackSchema?.rows ?? [];
        const wireMinutes = parseTimeToMinutes(assignment.wireListEstTime)
          || computeSheetWiringMinutes(fallbackRows);

        sheetBreakdowns.push({
          sheetId: assignment.sheetSlug,
          sheetName: assignment.sheetName,
          rowCount: assignment.rowCount,
          estimatedMinutes: wireMinutes,
        });

        const assignmentStageHours = deriveAssignmentStageHours(assignment);
        for (const stage of ASSIGNMENT_STAGES) {
          if (stage.isQueue) continue;
          const nextMinutes = (stageTotals.get(stage.id) ?? 0) + (assignmentStageHours[stage.id] ?? 0);
          stageTotals.set(stage.id, nextMinutes);
        }
      }

      stages = ASSIGNMENT_STAGES
        .filter((stage) => !stage.isQueue)
        .map((stage) => ({
          stageId: stage.id,
          label: stage.label,
          shortLabel: stage.shortLabel,
          category: stage.category,
          order: stage.order,
          estimatedMinutes: stageTotals.get(stage.id) ?? 0,
          averageMinutes: stageTotals.get(stage.id) ?? 0,
          actualMinutes: 0,
        }))
        .filter((stage) => stage.estimatedMinutes > 0 || stage.actualMinutes > 0);
    } else {
      let projectWiringMinutes = 0;

      for (const schema of operationalSchemas) {
        const rows = schema.rows ?? [];
        const sheetMinutes = computeSheetWiringMinutes(rows);

        sheetBreakdowns.push({
          sheetId: schema.slug,
          sheetName: schema.name,
          rowCount: rows.length,
          estimatedMinutes: sheetMinutes,
        });

        projectWiringMinutes += sheetMinutes;
      }

      stages = computeStageHoursFromWiringTotal(projectWiringMinutes, "PANEL");
    }

    const actualMinutesByStage = new Map<AssignmentStageId, number>();
    for (const entry of operationEntries) {
      const stageId = getOperationCode(entry.opCode)?.stageId;
      if (!stageId) continue;
      actualMinutesByStage.set(stageId, (actualMinutesByStage.get(stageId) ?? 0) + Math.max(0, entry.actualMinutes ?? 0));
    }

    for (const stage of stages) {
      stage.actualMinutes = actualMinutesByStage.get(stage.stageId) ?? stage.actualMinutes ?? 0;
    }

    const stateDir = await resolveProjectStateDirectory(manifest.id);
    if (stateDir) {
      const actualsFile = path.join(stateDir, "stage-hours-actuals.json");
      try {
        const raw = await fs.readFile(actualsFile, "utf-8");
        const actuals = JSON.parse(raw) as { stages?: Record<string, number> };
        if (actuals.stages) {
          for (const stage of stages) {
            if (actuals.stages[stage.stageId] != null) {
              stage.actualMinutes = actuals.stages[stage.stageId];
            }
          }
        }
      } catch {
        // No saved actuals file yet.
      }
    }

    const response: ProjectStageHoursResponse = {
      projectId: manifest.id,
      totalEstimatedMinutes: stages.reduce((sum, stage) => sum + stage.estimatedMinutes, 0),
      totalAverageMinutes: stages.reduce((sum, stage) => sum + stage.averageMinutes, 0),
      totalActualMinutes: stages.reduce((sum, stage) => sum + stage.actualMinutes, 0),
      stages,
      sheets: sheetBreakdowns,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] Failed to compute stage hours:", error);
    return NextResponse.json(
      { error: "Failed to compute stage hours", projectId },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  let body: { stages?: Record<string, number> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.stages || typeof body.stages !== "object") {
    return NextResponse.json(
      { error: "Body must include stages: { STAGE_ID: minutes }" },
      { status: 400 },
    );
  }

  const validStageIds = new Set(ASSIGNMENT_STAGES.map((stage) => stage.id));
  for (const [key, value] of Object.entries(body.stages)) {
    if (!validStageIds.has(key as AssignmentStageId)) {
      return NextResponse.json({ error: `Unknown stage: ${key}` }, { status: 400 });
    }
    if (typeof value !== "number" || value < 0) {
      return NextResponse.json(
        { error: `Invalid value for ${key}: must be a non-negative number` },
        { status: 400 },
      );
    }
  }

  try {
    const stateDir = await resolveProjectStateDirectory(projectId);
    if (!stateDir) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const actualsFile = path.join(stateDir, "stage-hours-actuals.json");

    let existing: Record<string, number> = {};
    try {
      const raw = await fs.readFile(actualsFile, "utf-8");
      const data = JSON.parse(raw) as { stages?: Record<string, number> };
      existing = data.stages ?? {};
    } catch {
      // No prior file.
    }

    const merged = { ...existing, ...body.stages };
    const payload = {
      projectId,
      stages: merged,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(actualsFile, JSON.stringify(payload, null, 2), "utf-8");

    return NextResponse.json({ ok: true, stages: merged });
  } catch (error) {
    console.error("[API] Failed to save stage hours actuals:", error);
    return NextResponse.json(
      { error: "Failed to save stage hours actuals", projectId },
      { status: 500 },
    );
  }
}
