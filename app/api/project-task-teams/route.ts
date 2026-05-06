import { NextResponse } from "next/server";

import { listProjectTaskTeams } from "@/lib/projects/task-teams";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ teams: listProjectTaskTeams() });
}
