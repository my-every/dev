import { NextResponse } from "next/server";

import { listSwsUsage } from "@/lib/project-state/sws-library-handlers";

export const dynamic = "force-dynamic";

export async function GET() {
    const usage = await listSwsUsage();
    return NextResponse.json({ usage });
}
