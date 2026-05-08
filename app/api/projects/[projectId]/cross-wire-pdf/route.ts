import { NextRequest, NextResponse } from "next/server";

import { renderCrossWirePdfFromRoute } from "@/lib/project-exports/render-wire-list-pdf";
import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const manifest = await readProjectManifest(projectId);
    if (!manifest) {
      return NextResponse.json({ error: "Project not found." }, { status: 404 });
    }

    const origin = request.nextUrl.origin;
    const pdf = await renderCrossWirePdfFromRoute({
      origin,
      projectId,
    });

    const safeUnit = String(manifest.unitNumber ?? projectId)
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";

    return new NextResponse(pdf, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safeUnit}-cross-wire.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to render cross wire PDF.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
