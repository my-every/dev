import { NextRequest, NextResponse } from "next/server";

import {
    deleteSwsTemplate,
    getSwsTemplate,
    saveSwsTemplateTasks,
    updateSwsTemplate,
} from "@/lib/project-state/sws-library-handlers";
import type { SwsChecklistGroup, SwsTemplateRecord } from "@/types/sws-library";

export const dynamic = "force-dynamic";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ templateId: string }> },
) {
    const { templateId } = await params;
    const template = await getSwsTemplate(decodeURIComponent(templateId));

    if (!template) {
        return NextResponse.json({ error: "SWS template not found" }, { status: 404 });
    }

    return NextResponse.json({ template });
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ templateId: string }> },
) {
    const { templateId } = await params;
    const body = await request.json() as Partial<SwsTemplateRecord> & { groups?: SwsChecklistGroup[]; saveTasksOnly?: boolean };

    try {
        if (body.saveTasksOnly && body.groups) {
            const template = await saveSwsTemplateTasks(decodeURIComponent(templateId), body.groups);
            console.info("[api/sws/template] tasks-saved", { templateId });
            return NextResponse.json({ template });
        }

        const template = await updateSwsTemplate({
            ...(body as SwsTemplateRecord),
            id: decodeURIComponent(templateId),
        });
        console.info("[api/sws/template] updated", { templateId, status: template.status, kind: template.kind });

        return NextResponse.json({ template });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to update SWS template" },
            { status: 500 },
        );
    }
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ templateId: string }> },
) {
    const { templateId } = await params;
    const deleted = await deleteSwsTemplate(decodeURIComponent(templateId));

    if (!deleted) {
        return NextResponse.json({ error: "SWS template not found" }, { status: 404 });
    }

    console.info("[api/sws/template] deleted", { templateId });
    return NextResponse.json({ success: true });
}
