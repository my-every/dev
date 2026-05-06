import { NextRequest, NextResponse } from "next/server";
import {
  addOperationTimeEntry,
  getProjectOperationSummary,
} from "@/lib/project-state/share-operation-time-handlers";
import type { OperationTimeEntry } from "@/types/d380-operation-codes";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const summary = await getProjectOperationSummary(projectId);
  return NextResponse.json(summary);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = await request.json() as Partial<OperationTimeEntry>;

  if (!body.opCode || typeof body.opCode !== "string") {
    return NextResponse.json({ error: "opCode is required" }, { status: 400 });
  }
  if (!body.badge || typeof body.badge !== "string") {
    return NextResponse.json({ error: "badge is required" }, { status: 400 });
  }
  if (!body.assignmentId || typeof body.assignmentId !== "string") {
    return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
  }

  const entry = await addOperationTimeEntry(projectId, {
    opCode: body.opCode,
    assignmentId: body.assignmentId,
    projectId,
    badge: body.badge,
    startedAt: body.startedAt ?? new Date().toISOString(),
    endedAt: body.endedAt ?? null,
    actualMinutes: body.actualMinutes ?? 0,
    source: body.source ?? "manual",
    note: body.note,
  });

  return NextResponse.json({ entry });
}
