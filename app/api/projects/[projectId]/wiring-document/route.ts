import { NextRequest, NextResponse } from "next/server";
import { buildProjectSheetPrintDocument } from "@/lib/wire-list-print/build-project-sheet-print-document";

export const dynamic = "force-dynamic";

/**
 * GET /api/project-context/[projectId]/wiring-document?sheet=slug
 *
 * Returns the processed wire list print document data needed for wiring execution.
 * This includes location groups, settings, and row data.
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
        const document = await buildProjectSheetPrintDocument({
            projectId,
            sheetSlug,
            settings: { mode: "standardize" },
        });

        if (!document) {
            return NextResponse.json(
                { error: "Sheet not found or has no data" },
                { status: 404 },
            );
        }

        return NextResponse.json({
            processedLocationGroups: document.processedLocationGroups,
            settings: document.settings,
            currentSheetName: document.currentSheetName,
            hiddenSectionKeys: document.hiddenSectionKeys ?? [],
            hiddenRowIds: document.hiddenRowIds ?? [],
            crossWireSectionKeys: document.crossWireSectionKeys ?? [],
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Failed to build wiring document" },
            { status: 500 },
        );
    }
}
