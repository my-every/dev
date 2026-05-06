import { NextRequest, NextResponse } from "next/server";
import {
  getCatalogEntry,
  upsertCatalogEntry,
  deleteCatalogEntry,
} from "@/lib/project-state/share-catalog-handlers";
import type { PartCatalogRecord } from "@/types/d380-catalog";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ partNumber: string }> },
) {
  const { partNumber } = await params;
  const decoded = decodeURIComponent(partNumber);
  const record = await getCatalogEntry(decoded);
  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ record });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ partNumber: string }> },
) {
  const { partNumber } = await params;
  const decoded = decodeURIComponent(partNumber);
  const body = await request.json() as Partial<PartCatalogRecord>;

  const record = await upsertCatalogEntry({
    ...body,
    partNumber: decoded,
  } as PartCatalogRecord);

  return NextResponse.json({ record });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ partNumber: string }> },
) {
  const { partNumber } = await params;
  const decoded = decodeURIComponent(partNumber);
  const deleted = await deleteCatalogEntry(decoded);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
