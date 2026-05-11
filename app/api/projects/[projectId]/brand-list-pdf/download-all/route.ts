import { promises as fs } from "node:fs";
import path from "node:path";

import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";

import { generateBrandListPdfExports } from "@/lib/project-exports/brand-list-pdf-exports";
import { resolveProjectExportFile } from "@/lib/project-exports/project-exports-paths";
import type { BrandingSortMode } from "@/lib/wire-list-print/defaults";

export const dynamic = "force-dynamic";

const VALID_GROUPING_MODES = ["default", "device-prefix", "device-prefix-part-number", "blue-label-sequence"] as const;

function parseGroupingMode(value: string | null): BrandingSortMode {
  if (value && VALID_GROUPING_MODES.includes(value as BrandingSortMode)) {
    return value as BrandingSortMode;
  }
  return "default";
}

async function handleDownloadAllBrandLists(
  request: NextRequest,
  paramsPromise: Promise<{ projectId: string }>,
) {
  const { projectId } = await paramsPromise;
  const grouping = parseGroupingMode(request.nextUrl.searchParams.get("grouping"));

  try {
    const exportResult = await generateBrandListPdfExports(projectId, request.nextUrl.origin, { grouping });
    if (!exportResult.sheetExports.length) {
      return NextResponse.json(
        { error: "No brand-list exports were generated for this project." },
        { status: 404 },
      );
    }

    const zip = new JSZip();
    for (const item of exportResult.sheetExports) {
      const segments = item.relativePath.replace(/^exports\//, "").split("/").filter(Boolean);
      const absoluteFilePath = await resolveProjectExportFile(projectId, segments);
      if (!absoluteFilePath) continue;
      const bytes = await fs.readFile(absoluteFilePath);
      zip.file(item.fileName || path.basename(absoluteFilePath), bytes);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const safeProjectName = (exportResult.projectName || projectId)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const groupingSuffix = grouping !== "default" ? `-${grouping}` : "";
    const fileName = `${safeProjectName || "project"}-brandlists${groupingSuffix}.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[brand-list-download-all] Export failed:", error);
    const message = error instanceof Error ? error.message : "Failed to generate brand-list zip export";
    const isPlaywrightError = message.includes("Playwright") || message.includes("browser") || message.includes("timeout");
    return NextResponse.json(
      { 
        error: isPlaywrightError 
          ? "PDF generation is temporarily unavailable. Please try again or download individual sheets." 
          : message 
      },
      { status: 500 },
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handleDownloadAllBrandLists(request, params);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  return handleDownloadAllBrandLists(request, params);
}
