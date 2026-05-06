import { NextRequest, NextResponse } from "next/server";

import {
    createSwsTemplate,
    getSwsLibraryManifest,
    listSwsTemplates,
} from "@/lib/project-state/sws-library-handlers";
import type { SwsTemplateRecord } from "@/types/sws-library";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;

    if (searchParams.get("manifest") === "true") {
        const manifest = await getSwsLibraryManifest();
        return NextResponse.json(manifest);
    }

    const templates = await listSwsTemplates();
    return NextResponse.json({ templates });
}

export async function POST(request: NextRequest) {
    const body = await request.json() as SwsTemplateRecord;

    if (!body.id || !body.name) {
        return NextResponse.json({ error: "id and name are required" }, { status: 400 });
    }

    try {
        const template = await createSwsTemplate(body);
        console.info("[api/sws/templates] created", { templateId: template.id, kind: template.kind, status: template.status });
        return NextResponse.json({ template });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to create SWS template" },
            { status: 500 },
        );
    }
}
