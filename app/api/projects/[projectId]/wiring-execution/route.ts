import { NextRequest, NextResponse } from "next/server";
import {
    saveWiringExecutionSession,
    readWiringExecutionSession,
    deleteWiringExecutionSession,
} from "@/lib/project-state/share-wiring-execution-handlers";
import { runWiringEffects } from "@/lib/wiring-execution/effects";
import type { WiringExecutionSession } from "@/types/d380-wiring-execution";

// Register all effects
import "@/lib/wiring-execution/register-effects";

export const dynamic = "force-dynamic";

/**
 * GET /api/project-context/[projectId]/wiring-execution?sheet=slug
 *
 * Read a saved wiring execution session for a sheet.
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const { projectId } = await params;
    const sheetSlug = request.nextUrl.searchParams.get("sheet");

    if (!sheetSlug) {
        return NextResponse.json(
            { error: "Missing 'sheet' query parameter" },
            { status: 400 },
        );
    }

    try {
        const session = await readWiringExecutionSession(projectId, sheetSlug);
        if (!session) {
            return NextResponse.json(
                { error: "No saved wiring execution session found" },
                { status: 404 },
            );
        }
        return NextResponse.json(session);
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to read session" },
            { status: 500 },
        );
    }
}

/**
 * POST /api/project-context/[projectId]/wiring-execution
 *
 * Save/update a wiring execution session and run side effects.
 *
 * Body:
 *   session: WiringExecutionSession
 *   trigger?: "section-complete" | "session-complete" — which effects to run
 */
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const { projectId } = await params;

    try {
        const body = await request.json();
        const { session, trigger } = body as {
            session: WiringExecutionSession;
            trigger?: "section-complete" | "session-complete";
        };

        if (!session || !session.id) {
            return NextResponse.json(
                { error: "Missing or invalid session" },
                { status: 400 },
            );
        }

        // Persist session
        const savedPath = await saveWiringExecutionSession(projectId, session);

        // Run effects if a trigger was specified
        let effectResults: Array<{ effectId: string; success: boolean; error?: string }> = [];
        if (trigger) {
            const completedSection = trigger === "section-complete"
                ? session.sections.find(s => s.status === "completed" && s.completedAt)
                : undefined;

            // For section-complete, find the most recently completed section
            const latestSection = trigger === "section-complete"
                ? session.sections
                    .filter(s => s.status === "completed" && s.completedAt)
                    .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? ""))
                [0]
                : undefined;

            effectResults = await runWiringEffects(trigger, {
                session,
                section: latestSection ?? completedSection,
                projectId,
                badge: session.badge,
                shift: session.shift,
            });
        }

        return NextResponse.json({
            savedPath,
            effectResults,
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to save session" },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/project-context/[projectId]/wiring-execution?sheet=slug
 *
 * Delete a saved wiring execution session.
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> },
) {
    const { projectId } = await params;
    const sheetSlug = request.nextUrl.searchParams.get("sheet");

    if (!sheetSlug) {
        return NextResponse.json(
            { error: "Missing 'sheet' query parameter" },
            { status: 400 },
        );
    }

    try {
        const deleted = await deleteWiringExecutionSession(projectId, sheetSlug);
        return NextResponse.json({ deleted });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to delete session" },
            { status: 500 },
        );
    }
}
