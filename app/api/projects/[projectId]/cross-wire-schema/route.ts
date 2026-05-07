import { NextRequest, NextResponse } from "next/server";

import {
  generateAndSaveCrossWireSchema,
  readCrossWireSchema,
} from "@/lib/project-exports/cross-wire-schema";

export const dynamic = "force-dynamic";

/**
 * GET /api/projects/[projectId]/cross-wire-schema
 *
 * Read the previously generated cross-wire schema for this project.
 * Returns 404 if not yet generated (POST to generate).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const schema = await readCrossWireSchema(projectId);
  if (!schema) {
    return NextResponse.json(
      { error: "Cross-wire schema not found. POST to generate." },
      { status: 404 },
    );
  }

  return NextResponse.json(schema);
}

/**
 * POST /api/projects/[projectId]/cross-wire-schema
 *
 * Generate (or regenerate) the cross-wire schema for this project by
 * scanning all operational assignment brand list schemas and extracting
 * rows whose toLocation differs from the source assignment, then grouping
 * them by unit type using the project manifest.
 *
 * The schema is persisted to the project's exports directory and returned.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const result = await generateAndSaveCrossWireSchema(projectId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate cross-wire schema",
      },
      { status: 500 },
    );
  }
}
