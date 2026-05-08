import { NextResponse } from "next/server";

import { readRevisionRefreshJob } from "@/lib/project-state/revision-refresh-job-store";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const job = await readRevisionRefreshJob(projectId);
    // No active/previous job is a valid state.
    return NextResponse.json({ job });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to read revision refresh job.",
      },
      { status: 500 },
    );
  }
}
