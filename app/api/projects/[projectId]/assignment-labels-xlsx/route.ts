import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";

export const dynamic = "force-dynamic";

type LabelType = "blue" | "white" | "cable";

const LABEL_CONFIG: Record<LabelType, { field: keyof import("@/types/project-manifest").ManifestAssignment; label: string }> = {
  blue:  { field: "blueLabels",  label: "Blue Labels"  },
  white: { field: "whiteLabels", label: "White Labels" },
  cable: { field: "partNumbers", label: "Cable Labels" },
};

/**
 * GET /api/projects/[projectId]/assignment-labels-xlsx
 * Query params:
 *   assignmentSlug  — e.g. "bop-box"
 *   labelType       — "blue" | "white" | "cable"
 *
 * Returns an .xlsx file with one column:
 *   Row 1: assignment name (header)
 *   Rows 2+: label / part-number values
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const { searchParams } = req.nextUrl;

  const assignmentSlug = searchParams.get("assignmentSlug");
  const rawLabelType = searchParams.get("labelType") as LabelType | null;

  if (!assignmentSlug || !rawLabelType || !(rawLabelType in LABEL_CONFIG)) {
    return NextResponse.json(
      { error: "Missing or invalid query params: assignmentSlug, labelType (blue|white|cable)" },
      { status: 400 },
    );
  }

  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const assignment = manifest.assignments?.[assignmentSlug];
  if (!assignment) {
    return NextResponse.json(
      { error: `Assignment "${assignmentSlug}" not found` },
      { status: 404 },
    );
  }

  const config = LABEL_CONFIG[rawLabelType];
  const items = (assignment[config.field] as string[] | undefined) ?? [];

  if (items.length === 0) {
    return NextResponse.json(
      { error: `No ${config.label} data for assignment "${assignment.sheetName}"` },
      { status: 404 },
    );
  }

  // Build worksheet: header = assignment name, rows = items
  const aoa: string[][] = [
    [assignment.sheetName],
    ...items.map((item) => [item]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Auto-width for column A
  const maxLen = Math.max(assignment.sheetName.length, ...items.map((s) => s.length));
  ws["!cols"] = [{ wch: maxLen + 4 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, config.label);

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const safeSlug = assignmentSlug.replace(/[^a-z0-9-]/gi, "-");
  const fileName = `${safeSlug}-${rawLabelType}-labels.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
