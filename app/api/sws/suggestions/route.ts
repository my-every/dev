import { NextResponse } from "next/server";

import { listSwsSuggestions } from "@/lib/project-state/sws-library-handlers";

export const dynamic = "force-dynamic";

export async function GET() {
    const suggestions = await listSwsSuggestions();
    return NextResponse.json({ suggestions });
}
