import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

import { buildProjectScheduleActualsKey, cleanProjectScheduleToken } from "@/lib/project-schedule/actuals";
import {
  EMPTY_PROJECT_SCHEDULE_ACTUALS_DOCUMENT,
  ensureProjectScheduleDirs,
  readProjectScheduleActualsDocument,
  resolveProjectSchedulePaths,
} from "@/lib/project-schedule/storage";
import type {
  ProjectScheduleActualMilestones,
  ProjectScheduleActualsDocument,
  ProjectScheduleActualsPatchRequest,
  ProjectScheduleActualsRecord,
} from "@/lib/project-schedule/types";

export const dynamic = "force-dynamic";

const EMPTY_DOCUMENT: ProjectScheduleActualsDocument = EMPTY_PROJECT_SCHEDULE_ACTUALS_DOCUMENT;

async function resolveMetricsPath(): Promise<string> {
  const paths = await resolveProjectSchedulePaths();
  return paths.actualsFile;
}

async function ensureMetricsDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function writeActualsDocument(filePath: string, document: ProjectScheduleActualsDocument) {
  await fs.writeFile(filePath, JSON.stringify(document, null, 2), "utf-8");
}

function cleanToken(value: string | undefined): string {
  return cleanProjectScheduleToken(value);
}

function mergeMilestoneActuals(
  current: ProjectScheduleActualMilestones | undefined,
  incoming: Partial<ProjectScheduleActualMilestones> | undefined,
): ProjectScheduleActualMilestones {
  const next: ProjectScheduleActualMilestones = {
    ...(current ?? {}),
  };

  for (const [rawKey, rawValue] of Object.entries(incoming ?? {})) {
    const key = rawKey as keyof ProjectScheduleActualMilestones;
    if (typeof rawValue === "string") {
      const cleaned = rawValue.trim();
      if (cleaned) {
        next[key] = cleaned;
      } else {
        delete next[key];
      }
      continue;
    }

    if (rawValue == null) {
      delete next[key];
    }
  }

  return next;
}

function mergeRecord(
  current: ProjectScheduleActualsRecord | undefined,
  patch: ProjectScheduleActualsPatchRequest,
  recordKey: string,
): ProjectScheduleActualsRecord {
  const now = new Date().toISOString();

  const pdNumber = cleanToken(patch.pdNumber) || current?.pdNumber || "";
  const unit = cleanToken(patch.unit) || current?.unit || "";
  const projectName = cleanToken(patch.projectName) || current?.projectName || "";

  return {
    key: recordKey,
    projectId: cleanToken(patch.projectId) || current?.projectId || undefined,
    pdNumber,
    unit,
    projectName,
    assignedTeamLeadBadge:
      patch.assignedTeamLeadBadge === null
        ? undefined
        : cleanToken(patch.assignedTeamLeadBadge ?? current?.assignedTeamLeadBadge),
    priorityMemberBadge:
      patch.priorityMemberBadge === null
        ? undefined
        : cleanToken(patch.priorityMemberBadge ?? current?.priorityMemberBadge),
    notes:
      patch.notes === null
        ? undefined
        : cleanToken(patch.notes ?? current?.notes),
    milestoneActuals: mergeMilestoneActuals(current?.milestoneActuals, patch.milestoneActuals),
    updatedAt: now,
    updatedBy: cleanToken(patch.updatedBy) || current?.updatedBy || undefined,
  };
}

function validatePatchBody(body: ProjectScheduleActualsPatchRequest): string | null {
  const recordKey = buildProjectScheduleActualsKey(body);
  if (!recordKey) {
    return "A record key or identifying fields (projectId or pdNumber) are required.";
  }

  const hasPayload =
    body.milestoneActuals !== undefined ||
    body.notes !== undefined ||
    body.assignedTeamLeadBadge !== undefined ||
    body.priorityMemberBadge !== undefined ||
    body.projectId !== undefined ||
    body.pdNumber !== undefined ||
    body.unit !== undefined ||
    body.projectName !== undefined;

  if (!hasPayload) {
    return "At least one metrics field must be provided.";
  }

  return null;
}

export async function GET() {
  try {
    const filePath = await resolveMetricsPath();
    await ensureProjectScheduleDirs(await resolveProjectSchedulePaths());
    await ensureMetricsDir(filePath);
    const document = await readProjectScheduleActualsDocument(filePath);
    return NextResponse.json(document);
  } catch (error) {
    console.error("Failed to read project schedule actuals:", error);
    return NextResponse.json(
      { error: "Failed to read project schedule actuals" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as ProjectScheduleActualsPatchRequest;
    const validationError = validatePatchBody(body);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const filePath = await resolveMetricsPath();
    await ensureProjectScheduleDirs(await resolveProjectSchedulePaths());
    await ensureMetricsDir(filePath);

    const document = await readProjectScheduleActualsDocument(filePath);
    const recordKey = buildProjectScheduleActualsKey(body);
    const current = document.records[recordKey];
    const nextRecord = mergeRecord(current, body, recordKey);

    if (!nextRecord.pdNumber) {
      return NextResponse.json(
        { error: "pdNumber is required when creating a new metrics record." },
        { status: 400 },
      );
    }

    document.records[recordKey] = nextRecord;
    document.updatedAt = new Date().toISOString();
    document.sourceFile = "project-schedule-actuals.json";

    await writeActualsDocument(filePath, document);

    return NextResponse.json({
      success: true,
      record: nextRecord,
      documentUpdatedAt: document.updatedAt,
      writes: {
        actualsFile: filePath,
      },
    });
  } catch (error) {
    console.error("Failed to update project schedule actuals:", error);
    return NextResponse.json(
      { error: "Failed to update project schedule actuals" },
      { status: 500 },
    );
  }
}
