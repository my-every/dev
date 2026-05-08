import { NextRequest, NextResponse } from "next/server";

import { renderWireListPdfFromRoute } from "@/lib/project-exports/render-wire-list-pdf";
import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[projectId]/brand-list-pdf/[sheetSlug]
 *
 * Renders the branding print view for the given sheet as a PDF using the
 * same route used by the print modal (`?mode=branding`), so the output is
 * the clean brand list without length input field toggles.
 *
 * Query params:
 *   grouping  - BrandingSortMode passed through to the print route (optional)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const { projectId, sheetSlug } = await params;
  const grouping = request.nextUrl.searchParams.get("grouping") ?? undefined;

  try {
    const manifest = await readProjectManifest(projectId);
    if (!manifest) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const assignment = manifest.assignments?.[sheetSlug];
    const sheetName = assignment?.sheetName ?? sheetSlug;

    const safeUnit = String(manifest.unitNumber ?? projectId)
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";

    const safeSheet = sheetName
      .trim()
      .replace(/[^a-zA-Z0-9_\- ]+/g, "")
      .replace(/\s+/g, "-")
      .toLowerCase() || sheetSlug;

    const origin = request.nextUrl.origin;
    const pdf = await renderWireListPdfFromRoute({
      origin,
      projectId,
      sheetSlug,
      grouping,
      mode: "branding",
    });

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeUnit}-${safeSheet}-branding.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to render brand list PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
