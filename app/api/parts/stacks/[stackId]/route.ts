import { NextRequest, NextResponse } from "next/server";

import {
    deletePartStack,
    getPartStack,
    updatePartStack,
} from "@/lib/project-state/parts-stacks-handlers";
import type { PartStack } from "@/types/parts-library";

export const dynamic = "force-dynamic";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ stackId: string }> },
) {
    const { stackId } = await params;
    const stack = await getPartStack(decodeURIComponent(stackId));

    if (!stack) {
        return NextResponse.json({ error: "Stack not found" }, { status: 404 });
    }

    return NextResponse.json({ stack });
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ stackId: string }> },
) {
    const { stackId } = await params;
    const body = await request.json() as Partial<PartStack>;

    try {
        const stack = await updatePartStack({
            ...(body as PartStack),
            id: decodeURIComponent(stackId),
        });
        return NextResponse.json({ stack });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update stack" },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ stackId: string }> },
) {
    const { stackId } = await params;
    const deleted = await deletePartStack(decodeURIComponent(stackId));

    if (!deleted) {
        return NextResponse.json({ error: "Stack not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
