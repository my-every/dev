import { NextResponse } from "next/server";
import { promises as fs } from "node:fs";

import { readBrandingCsvExports } from "@/lib/project-exports/branding-csv-exports";
import { readWireListPdfExports } from "@/lib/project-exports/wire-list-pdf-exports";
import { resolveProjectExportFile } from "@/lib/project-exports/project-exports-paths";
import { getProjectActivityAcrossAllBadges } from "@/lib/activity/share-activity-store";
import {
  listStoredProjectsByPdNumber,
  readProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { readMultiSheetPrintSession } from "@/lib/project-state/share-multi-sheet-print-session-handlers";

export const dynamic = "force-dynamic";

function manifestHasUploadedProjectFiles(manifest: Awaited<ReturnType<typeof readProjectManifest>>) {
  if (!manifest) {
    return false;
  }

  const hasWorkbook = Boolean(manifest.activeWorkbookRevisionId);
  const hasLayout = Boolean(manifest.activeLayoutRevisionId);
  const hasOperationalSheets = (manifest.sheets ?? []).some((sheet) => sheet.kind === "operational" && sheet.hasData);

  return (hasWorkbook && hasLayout) || hasOperationalSheets;
}

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

function metadataHasTag(metadata: unknown, key: string, expected: string): boolean {
  if (!metadata || typeof metadata !== "object") {
    return false;
  }

  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.toLowerCase() === expected.toLowerCase();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const manifest = await readProjectManifest(projectId);

  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const familyManifests = await listStoredProjectsByPdNumber(manifest.pdNumber);
  const family = (familyManifests.length ? familyManifests : [manifest]).sort((left, right) => {
    const leftUnit = Number(left.unitNumber ?? Number.POSITIVE_INFINITY);
    const rightUnit = Number(right.unitNumber ?? Number.POSITIVE_INFINITY);
    if (Number.isFinite(leftUnit) && Number.isFinite(rightUnit) && leftUnit !== rightUnit) {
      return leftUnit - rightUnit;
    }

    return (left.unitNumber ?? "").localeCompare(right.unitNumber ?? "");
  });

  const [projectActivities, familyStates] = await Promise.all([
    getProjectActivityAcrossAllBadges(projectId, { limit: 400 }),
    Promise.all(family.map(async (familyManifest) => {
      const [brandingExports, wireListExports, multiSheetSession] = await Promise.all([
        readBrandingCsvExports(familyManifest.id),
        readWireListPdfExports(familyManifest.id),
        readMultiSheetPrintSession(familyManifest.id),
      ]);

      const multiSheetBrandingWorkbook = multiSheetSession?.lastCombinedExportResult?.brandingWorkbook ?? null;
      const multiSheetBrandingWorkbookExists = await exportFileExists(
        familyManifest.id,
        multiSheetBrandingWorkbook?.relativePath,
      );
      const brandingWorkspaceVisited = Boolean(
        multiSheetSession && (
          multiSheetSession.activeSheetSlug
          || (multiSheetSession.approvedSheetSlugs?.length ?? 0) > 0
          || (multiSheetSession.editedAfterApprovalSheetSlugs?.length ?? 0) > 0
          || Object.keys(multiSheetSession.sheetReviews ?? {}).length > 0
          || multiSheetSession.lastCombinedExportResult
        ),
      );
      const brandingCombinedRelativePath =
        multiSheetBrandingWorkbookExists
          ? multiSheetBrandingWorkbook?.relativePath
          : brandingExports?.combinedRelativePath ?? null;

      return {
        manifest: familyManifest,
        operationalSheetCount: familyManifest.sheets.filter((sheet) => sheet.kind === "operational").length,
        hasOperationalSheets: familyManifest.sheets.some((sheet) => sheet.kind === "operational"),
        hasUploadedProjectFiles: manifestHasUploadedProjectFiles(familyManifest),
        hasBrandingExports: Boolean(brandingExports?.sheetExports.length || multiSheetBrandingWorkbookExists),
        hasWireListExports: Boolean(wireListExports?.sheetExports.length),
        brandingWorkspaceVisited,
        brandingCombinedRelativePath,
        brandingCombinedFileName: multiSheetBrandingWorkbookExists
          ? multiSheetBrandingWorkbook?.fileName ?? brandingExports?.combinedFileName ?? null
          : brandingExports?.combinedFileName ?? null,
      };
    })),
  ]);

  const brandListStartedByActivity = projectActivities.some((entry) =>
    entry.action === "STARTED"
    && metadataHasTag(entry.metadata, "workflow", "brandlist"),
  );

  const brandingStartedByActivity = projectActivities.some((entry) =>
    entry.action === "STARTED"
    && metadataHasTag(entry.metadata, "workflow", "branding"),
  );

  const brandingCompletedByActivity = projectActivities.some((entry) =>
    entry.action === "COMPLETED"
    && metadataHasTag(entry.metadata, "workflow", "branding"),
  );

  const stateMember =
    familyStates.find((entry) => entry.brandingCombinedRelativePath)
    ?? familyStates.find((entry) => entry.brandingWorkspaceVisited)
    ?? familyStates.find((entry) => entry.hasUploadedProjectFiles)
    ?? familyStates[0];

  const hasOperationalSheets = familyStates.some((entry) => entry.hasOperationalSheets);
  const hasBrandingExports = familyStates.some((entry) => entry.hasBrandingExports);
  const hasWireListExports = familyStates.some((entry) => entry.hasWireListExports);
  const brandingWorkspaceVisited = familyStates.some((entry) => entry.brandingWorkspaceVisited);
  const brandingCombinedRelativePath = stateMember?.brandingCombinedRelativePath ?? null;
  const brandingCombinedFileName = stateMember?.brandingCombinedFileName ?? null;
  const brandingReadyGateCompleteFromGate = family.some((entry) =>
    entry.lifecycleGates?.some((gate) => gate.gateId === "BRANDING_READY" && gate.status === "COMPLETE"),
  );
  const brandingReadyGateComplete = brandingReadyGateCompleteFromGate || brandingCompletedByActivity;
  const legalsUploaded = familyStates.some((entry) => entry.hasUploadedProjectFiles);
  const operationalSheetCount = familyStates.reduce((sum, entry) => sum + entry.operationalSheetCount, 0);

  return NextResponse.json({
    projectId,
    actions: {
      wireList: {
        enabled: hasOperationalSheets,
        reason: hasOperationalSheets ? null : "No operational sheets are available yet.",
      },
      print: {
        enabled: hasOperationalSheets,
        reason: hasOperationalSheets ? null : "No operational sheets are available yet.",
      },
      details: {
        enabled: true,
        reason: null,
      },
      exports: {
        enabled: hasBrandingExports || hasWireListExports || hasOperationalSheets,
        reason: hasBrandingExports || hasWireListExports || hasOperationalSheets
          ? null
          : "Exports are not available for this project yet.",
      },
    },
    summary: {
      hasOperationalSheets,
      hasBrandingExports,
      hasWireListExports,
      operationalSheetCount,
      legalsUploaded,
      brandingWorkspaceVisited,
      brandListStarted: brandListStartedByActivity || brandingWorkspaceVisited,
      brandListReady: Boolean(brandingCombinedRelativePath),
      brandingCombinedRelativePath,
      brandingCombinedFileName,
      brandingStarted: brandingStartedByActivity,
      brandingReadyGateComplete,
      stateMemberProjectId: stateMember?.manifest.id ?? manifest.id,
      familyProjectIds: family.map((entry) => entry.id),
    },
  });
}
