import { NextRequest, NextResponse } from "next/server";
import {
  updateOperationTimeEntry,
  deleteOperationTimeEntry,
} from "@/lib/project-state/share-operation-time-handlers";
import type { OperationTimeEntry } from "@/types/d380-operation-codes";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; entryId: string }> },
) {
  const { projectId, entryId } = await params;
  const body = await request.json() as Partial<Pick<OperationTimeEntry, "endedAt" | "actualMinutes" | "note">>;

  const updated = await updateOperationTimeEntry(projectId, entryId, body);
  if (!updated) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  return NextResponse.json({ entry: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string; entryId: string }> },
) {
  const { projectId, entryId } = await params;
  const deleted = await deleteOperationTimeEntry(projectId, entryId);
  if (!deleted) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
