import { NextRequest, NextResponse } from "next/server";

import { ensureLegalWorkspaceProject } from "@/lib/legal-drawings/library";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      pdNumber?: string;
      revision?: string;
    };

    if (!body.pdNumber || !body.revision) {
      return NextResponse.json(
        { error: "Missing pdNumber or revision." },
        { status: 400 },
      );
    }

    const manifest = await ensureLegalWorkspaceProject({
      pdNumber: body.pdNumber,
      revision: body.revision,
    });

    return NextResponse.json({
      projectId: manifest.id,
      manifest,
      operationalSheets: manifest.sheets
        .filter((sheet) => sheet.kind === "operational")
        .map((sheet) => ({
          slug: sheet.slug,
          name: sheet.name,
          rowCount: sheet.rowCount,
        })),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to prepare legal workspace project",
      },
      { status: 500 },
    );
  }
}
