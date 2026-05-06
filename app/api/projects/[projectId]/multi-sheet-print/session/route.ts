import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "node:fs";

import {
  readMultiSheetPrintSession,
  writeMultiSheetPrintSession,
} from "@/lib/project-state/share-multi-sheet-print-session-handlers";
import {
  listStoredProjectsByPdNumber,
  readProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { resolveProjectExportFile } from "@/lib/project-exports/project-exports-paths";
import type { MultiSheetImportSession, MultiSheetReviewEntryMode } from "@/lib/wire-brand-list/multi-sheet-review";

export const dynamic = "force-dynamic";

async function exportFileExists(projectId: string, relativePath?: string | null): Promise<boolean> {
  if (!relativePath) {
    return false;
  }

  const normalizedRelativePath = relativePath.replace(/^exports\//, "");
  const filePath = await resolveProjectExportFile(
    projectId,
    normalizedRelativePath.split("/").filter(Boolean),
  );
  if (!filePath) {
    return false;
  }

  return fs.stat(filePath).then((stat) => stat.isFile()).catch(() => false);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const session = await readMultiSheetPrintSession(projectId);
    const [brandingWorkbookExists, wireListSchemaExists, manifestFileExists] = await Promise.all([
      exportFileExists(projectId, session?.lastCombinedExportResult?.brandingWorkbook?.relativePath),
      exportFileExists(projectId, session?.lastCombinedExportResult?.wireListSchema?.relativePath),
      exportFileExists(projectId, session?.lastCombinedExportResult?.manifestFile?.relativePath),
    ]);

    const exportFiles = {
      brandingWorkbookExists,
      wireListSchemaExists,
      manifestFileExists,
    };

    return NextResponse.json({ session, exportFiles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read multi-sheet print session" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  try {
    const manifest = await readProjectManifest(projectId);
    const body = await request.json() as {
      activeSheetSlug?: string | null;
      approvedSheetSlugs?: string[];
      editedAfterApprovalSheetSlugs?: string[];
      sheetReviews?: Record<string, unknown>;
      lastCombinedExportResult?: unknown;
      entryMode?: MultiSheetReviewEntryMode;
      importSession?: MultiSheetImportSession | null;
    };

    const familyProjects = manifest
      ? await listStoredProjectsByPdNumber(manifest.pdNumber)
      : [];
    const targetProjectIds: string[] = Array.from(new Set<string>(
      (familyProjects.length ? familyProjects : [{ id: projectId }]).map((entry: { id: string }) => entry.id),
    ));

    const entryMode: MultiSheetReviewEntryMode = body.entryMode === "import-review" || body.entryMode === "review"
      ? body.entryMode
      : "cover";

    const sessionPayload = {
      activeSheetSlug: body.activeSheetSlug ?? null,
      approvedSheetSlugs: Array.isArray(body.approvedSheetSlugs) ? body.approvedSheetSlugs : [],
      editedAfterApprovalSheetSlugs: Array.isArray(body.editedAfterApprovalSheetSlugs) ? body.editedAfterApprovalSheetSlugs : [],
      sheetReviews: (body.sheetReviews ?? {}) as never,
      lastCombinedExportResult: (body.lastCombinedExportResult ?? null) as never,
      entryMode,
      importSession: (body.importSession ?? null) as never,
    };

    const writtenSessions = await Promise.all(
      targetProjectIds.map((targetProjectId) => writeMultiSheetPrintSession(targetProjectId, sessionPayload)),
    );
    const session = writtenSessions[0];

    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to write multi-sheet print session" },
      { status: 500 },
    );
  }
}
