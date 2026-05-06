import { NextResponse } from "next/server";

import { resolveMeasurementReuseSource } from "@/lib/project-measurements/source-resolution";

export const dynamic = "force-dynamic";

interface ResolveMeasurementsRequest {
  sourceSheetSlug?: string;
  targetSheetSlugs: string[];
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as ResolveMeasurementsRequest;
    const targetSheetSlugs = Array.isArray(body.targetSheetSlugs)
      ? body.targetSheetSlugs.map((value) => (value ?? "").trim()).filter(Boolean)
      : [];

    const resolution = await resolveMeasurementReuseSource(
      projectId,
      body.sourceSheetSlug,
      targetSheetSlugs,
    );

    if (!resolution.sourceSheetSlug) {
      return NextResponse.json(
        {
          error: resolution.reason || "No suitable source sheet could be inferred.",
          confidence: resolution.confidence,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      ...resolution,
      projectId,
      targetSheetSlugs,
    });
  } catch (error) {
    console.error("Failed to resolve measurement source:", error);
    return NextResponse.json(
      { error: "Failed to resolve measurement source" },
      { status: 500 },
    );
  }
}
