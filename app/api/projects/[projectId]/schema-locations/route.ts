import { NextRequest, NextResponse } from "next/server";

import {
  readSchemaLocationsBySheet,
  readSchemaLocationsForSheet,
} from "@/lib/project-state/schema-locations";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const sheetSlug = request.nextUrl.searchParams.get("sheet")?.trim();

  try {
    if (sheetSlug) {
      const locations = await readSchemaLocationsForSheet(projectId, sheetSlug);
      return NextResponse.json({ sheetSlug, locations });
    }

    const bySheet = await readSchemaLocationsBySheet(projectId);
    return NextResponse.json({ bySheet });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to read schema locations",
      },
      { status: 500 },
    );
  }
}