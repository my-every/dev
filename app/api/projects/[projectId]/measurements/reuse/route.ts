import { NextResponse } from "next/server";

import {
  readWireBrandListSchema,
  readWireListPrintSchema,
  saveWireBrandListSchema,
  saveWireListPrintSchema,
} from "@/lib/project-state/share-print-schema-handlers";
import { resolveMeasurementReuseSource } from "@/lib/project-measurements/source-resolution";
import type { BrandListExportSchema } from "@/lib/wire-brand-list/schema";
import type { WireListPrintSchema } from "@/lib/wire-list-print/schema";

export const dynamic = "force-dynamic";

type ReuseMode = "branding" | "wire-list" | "both";

interface ReuseMeasurementsRequest {
  sourceSheetSlug?: string;
  targetSheetSlugs: string[];
  mode?: ReuseMode;
}

function normalizeSlug(value: string | undefined): string {
  return (value ?? "").trim();
}

function copyBrandingLengths(
  source: BrandListExportSchema,
  target: BrandListExportSchema,
): number {
  const sourceRows = new Map<
    string,
    { length: number | null; bundleName: string; devicePrefix: string }
  >();

  for (const group of source.prefixGroups) {
    for (const bundle of group.bundles) {
      for (const row of bundle.rows) {
        sourceRows.set(row.rowId, {
          length: row.length,
          bundleName: row.bundleName,
          devicePrefix: row.devicePrefix,
        });
      }
    }
  }

  let copied = 0;
  for (const group of target.prefixGroups) {
    for (const bundle of group.bundles) {
      for (const row of bundle.rows) {
        const sourceRow = sourceRows.get(row.rowId);
        if (!sourceRow) {
          continue;
        }

        row.length = sourceRow.length;
        copied += 1;
      }
    }
  }

  return copied;
}

function copyWireListLengths(
  source: WireListPrintSchema,
  target: WireListPrintSchema,
): number {
  const sourceLengths = new Map<
    string,
    { lengthDisplay?: string; lengthInches?: number }
  >();

  for (const page of source.pages) {
    if (page.pageType !== "wire-list") {
      continue;
    }
    for (const group of page.locationGroups) {
      for (const subsection of group.subsections) {
        for (const row of subsection.rows) {
          sourceLengths.set(row.rowId, {
            lengthDisplay: row.lengthDisplay,
            lengthInches: row.lengthInches,
          });
        }
      }
    }
  }

  let copied = 0;
  for (const page of target.pages) {
    if (page.pageType !== "wire-list") {
      continue;
    }
    for (const group of page.locationGroups) {
      for (const subsection of group.subsections) {
        for (const row of subsection.rows) {
          const sourceRow = sourceLengths.get(row.rowId);
          if (!sourceRow) {
            continue;
          }

          row.lengthDisplay = sourceRow.lengthDisplay;
          row.lengthInches = sourceRow.lengthInches;
          copied += 1;
        }
      }
    }
  }

  return copied;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const body = (await request.json()) as ReuseMeasurementsRequest;

    const targetSheetSlugs = Array.isArray(body.targetSheetSlugs)
      ? body.targetSheetSlugs.map((value) => normalizeSlug(value)).filter(Boolean)
      : [];
    const resolution = await resolveMeasurementReuseSource(
      projectId,
      body.sourceSheetSlug,
      targetSheetSlugs,
    );
    const sourceSheetSlug = resolution.sourceSheetSlug;
    const mode: ReuseMode = body.mode ?? "both";

    if (!sourceSheetSlug) {
      return NextResponse.json(
        { error: "sourceSheetSlug is required." },
        { status: 400 },
      );
    }
    if (targetSheetSlugs.length === 0) {
      return NextResponse.json(
        { error: "At least one targetSheetSlug is required." },
        { status: 400 },
      );
    }

    const sourceBranding =
      mode === "branding" || mode === "both"
        ? await readWireBrandListSchema(projectId, sourceSheetSlug)
        : null;
    const sourceWireList =
      mode === "wire-list" || mode === "both"
        ? await readWireListPrintSchema(projectId, sourceSheetSlug)
        : null;

    if ((mode === "branding" || mode === "both") && !sourceBranding) {
      return NextResponse.json(
        { error: `Branding schema not found for source sheet ${sourceSheetSlug}.` },
        { status: 404 },
      );
    }
    if ((mode === "wire-list" || mode === "both") && !sourceWireList) {
      return NextResponse.json(
        { error: `Wire-list schema not found for source sheet ${sourceSheetSlug}.` },
        { status: 404 },
      );
    }

    const results: Array<{
      sheetSlug: string;
      brandingRowsCopied?: number;
      wireListRowsCopied?: number;
    }> = [];

    for (const targetSheetSlug of targetSheetSlugs) {
      const result: {
        sheetSlug: string;
        brandingRowsCopied?: number;
        wireListRowsCopied?: number;
      } = {
        sheetSlug: targetSheetSlug,
      };

      if (sourceBranding && (mode === "branding" || mode === "both")) {
        const targetBranding = await readWireBrandListSchema(projectId, targetSheetSlug);
        if (targetBranding) {
          result.brandingRowsCopied = copyBrandingLengths(sourceBranding, targetBranding);
          await saveWireBrandListSchema(projectId, targetSheetSlug, targetBranding);
        }
      }

      if (sourceWireList && (mode === "wire-list" || mode === "both")) {
        const targetWireList = await readWireListPrintSchema(projectId, targetSheetSlug);
        if (targetWireList) {
          result.wireListRowsCopied = copyWireListLengths(sourceWireList, targetWireList);
          await saveWireListPrintSchema(projectId, targetSheetSlug, targetWireList);
        }
      }

      results.push(result);
    }

    return NextResponse.json({
      success: true,
      projectId,
      sourceSheetSlug,
      sourceInferenceUsed: resolution.sourceInferenceUsed,
      confidence: resolution.confidence,
      reason: resolution.reason,
      targetSheetSlugs,
      mode,
      results,
      guidance: "See #1 flows should point downstream units at the latest revision of unit 1 as the source sheet.",
    });
  } catch (error) {
    console.error("Failed to reuse project measurements:", error);
    return NextResponse.json(
      { error: "Failed to reuse project measurements" },
      { status: 500 },
    );
  }
}
