import { NextResponse } from "next/server";

import { readRevisionRefreshJob } from "@/lib/project-state/revision-refresh-job-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const job = await readRevisionRefreshJob(projectId);
  if (!job) {
    return NextResponse.json({ error: "Revision refresh job not found." }, { status: 404 });
  }

  return NextResponse.json({ job });
}
