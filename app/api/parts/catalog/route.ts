import { NextRequest, NextResponse } from "next/server";
import {
  readCatalogLibrary,
  searchCatalog,
  upsertCatalogEntry,
} from "@/lib/project-state/share-catalog-handlers";
import type { PartCatalogRecord } from "@/types/d380-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const query = searchParams.get("query") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;
  const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined;

  if (searchParams.get("full") === "true") {
    const library = await readCatalogLibrary();
    return NextResponse.json(library);
  }

  const result = await searchCatalog({ query, category, limit, offset });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const raw = await request.json() as PartCatalogRecord | { entry?: PartCatalogRecord };
  const body = ("entry" in raw && raw.entry ? raw.entry : raw) as PartCatalogRecord;

  if (!body.partNumber || typeof body.partNumber !== "string") {
    return NextResponse.json({ error: "partNumber is required" }, { status: 400 });
  }
  if (!body.description || typeof body.description !== "string") {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }

  const record = await upsertCatalogEntry(body);
  return NextResponse.json({ record });
}
