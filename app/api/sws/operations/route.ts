import { NextRequest, NextResponse } from "next/server";

import {
    deleteSwsOperation,
    listSwsOperations,
    upsertSwsOperation,
} from "@/lib/project-state/sws-library-handlers";
import type { SwsOperationRecord } from "@/types/sws-library";

export const dynamic = "force-dynamic";

export async function GET() {
    const operations = await listSwsOperations();
    return NextResponse.json({ operations });
}

export async function POST(request: NextRequest) {
    const body = await request.json() as Partial<SwsOperationRecord> & { deleteId?: string };

    if (body.deleteId) {
        const deleted = await deleteSwsOperation(body.deleteId);
        console.info("[api/sws/operations] deleted", { operationId: body.deleteId, success: deleted });
        return NextResponse.json({ success: deleted });
    }

    if (!body.id || !body.templateId || !body.targetType || !body.targetId || !body.targetLabel) {
        return NextResponse.json({ error: "id, templateId, targetType, targetId, and targetLabel are required" }, { status: 400 });
    }

    try {
        const operation = await upsertSwsOperation(body as SwsOperationRecord);
        console.info("[api/sws/operations] saved", {
            operationId: operation.id,
            templateId: operation.templateId,
            targetType: operation.targetType,
            targetId: operation.targetId,
        });
        return NextResponse.json({ operation });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to save operation" },
            { status: 500 },
        );
    }
}
