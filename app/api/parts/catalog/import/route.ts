import { NextRequest, NextResponse } from "next/server";
import { bulkImportCatalogEntries } from "@/lib/project-state/share-catalog-handlers";
import { parsePartLibraryCSV } from "@/lib/catalog/local-catalog-adapter";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  let csv: string | undefined;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file field is required" }, { status: 400 });
    }

    csv = await file.text();
  } else {
    const body = await request.json() as { csv?: string };
    csv = body.csv;
  }

  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "csv field is required" }, { status: 400 });
  }

  const records = parsePartLibraryCSV(csv);
  if (records.length === 0) {
    return NextResponse.json({ error: "No valid records found in CSV" }, { status: 400 });
  }

  const imported = await bulkImportCatalogEntries(records);
  return NextResponse.json({ imported, total: records.length, importedCount: imported, skippedCount: records.length - imported, errors: [] });
}
