import { NextRequest, NextResponse } from "next/server";

import {
  deleteAssignmentSwsConfigs,
  listAssignmentSwsSlugs,
} from "@/lib/project-state/share-assignment-sws-handlers";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const sheetSlugs = await listAssignmentSwsSlugs(projectId);
  return NextResponse.json({ sheetSlugs });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  await deleteAssignmentSwsConfigs(projectId);
  return NextResponse.json({ success: true });
}
