import { NextResponse } from "next/server";
import { syncLegalDrawingsLibrary } from "@/lib/legal-drawings/library";
import { discoverProjectFolders } from "@/lib/data-loader/share-loader";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const result = await syncLegalDrawingsLibrary();
    const syncedProjects = result.projects.filter((project) =>
      project.createdRevision || project.updatedLatestRoot || project.copiedWorkbook || project.copiedLayout,
    ).length;

    return NextResponse.json({
      success: true,
      message: `Synced ${syncedProjects} of ${result.projectCount} projects`,
      syncedProjects,
      totalProjects: result.projectCount,
      projects: result.projects,
      syncedAt: result.syncedAt,
      sourceRoot: result.sourceRoot,
    });
  } catch (error) {
    console.error("[Sync] Failed to sync projects:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const folders = await discoverProjectFolders();

    return NextResponse.json({
      success: true,
      projectFolders: folders,
      count: folders.length,
    });
  } catch (error) {
    console.error("[Sync] Failed to get project folders:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
