import { NextRequest, NextResponse } from "next/server";

import {
    getSwsLibrarySettings,
    updateSwsLibrarySettings,
} from "@/lib/project-state/sws-library-handlers";
import type { SwsLibrarySettings } from "@/types/sws-library";

export const dynamic = "force-dynamic";

export async function GET() {
    const settings = await getSwsLibrarySettings();
    return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
    const body = await request.json() as Partial<SwsLibrarySettings>;

    try {
        const settings = await updateSwsLibrarySettings(body);
        return NextResponse.json({ settings });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update SWS settings" },
            { status: 500 },
        );
    }
}
