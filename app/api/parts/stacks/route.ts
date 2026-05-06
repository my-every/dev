import { NextRequest, NextResponse } from "next/server";

import {
    createPartStack,
    getPartStacksManifest,
    listPartStacks,
} from "@/lib/project-state/parts-stacks-handlers";
import type { PartStack } from "@/types/parts-library";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;

    if (searchParams.get("manifest") === "true") {
        const manifest = await getPartStacksManifest();
        return NextResponse.json(manifest);
    }

    const query = searchParams.get("query") ?? undefined;
    const stacks = await listPartStacks(query);
    return NextResponse.json({ stacks });
}

export async function POST(request: NextRequest) {
    const body = await request.json() as PartStack;

    if (!body.id || !body.name) {
        return NextResponse.json({ error: "id and name are required" }, { status: 400 });
    }

    try {
        const stack = await createPartStack(body);
        return NextResponse.json({ stack });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create stack" },
            { status: 500 },
        );
    }
}
