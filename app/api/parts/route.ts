import { NextRequest, NextResponse } from "next/server";
import {
    getRootManifest,
    searchParts,
    createPart,
} from "@/lib/project-state/parts-library-handlers";
import type { PartRecord, PartCategory } from "@/types/parts-library";

export const dynamic = "force-dynamic";

const MANIFEST_CACHE_TTL_MS = 10_000;
const SEARCH_CACHE_TTL_MS = 5_000;
const SEARCH_CACHE_MAX_ENTRIES = 100;

type CacheEntry<T> = {
    expiresAt: number;
    value: T;
};

let manifestCache: CacheEntry<unknown> | null = null;
const searchCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(entry: CacheEntry<T> | null): T | null {
    if (!entry) return null;
    if (entry.expiresAt <= Date.now()) return null;
    return entry.value;
}

function setSearchCache(key: string, value: unknown) {
    if (searchCache.size >= SEARCH_CACHE_MAX_ENTRIES) {
        const firstKey = searchCache.keys().next().value;
        if (firstKey) {
            searchCache.delete(firstKey);
        }
    }

    searchCache.set(key, {
        value,
        expiresAt: Date.now() + SEARCH_CACHE_TTL_MS,
    });
}

function clearPartsCache() {
    manifestCache = null;
    searchCache.clear();
}

/**
 * GET /api/parts
 * List/search parts or get manifest.
 * Query params: ?manifest=true | ?query=&category=&type=&limit=&offset=
 */
export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl;

    // Return manifest
    if (searchParams.get("manifest") === "true") {
        const cachedManifest = getCached(manifestCache);
        if (cachedManifest) {
            return NextResponse.json(cachedManifest);
        }

        const manifest = await getRootManifest();
        manifestCache = {
            value: manifest,
            expiresAt: Date.now() + MANIFEST_CACHE_TTL_MS,
        };
        return NextResponse.json(manifest);
    }

    // Search parts
    const query = searchParams.get("query") ?? undefined;
    const category = searchParams.get("category") as PartCategory | undefined;
    const type = searchParams.get("type") ?? undefined;
    const limit = searchParams.has("limit") ? Number(searchParams.get("limit")) : undefined;
    const offset = searchParams.has("offset") ? Number(searchParams.get("offset")) : undefined;

    const cacheKey = JSON.stringify({ query, category, type, limit, offset });
    const cachedSearch = getCached(searchCache.get(cacheKey) ?? null);
    if (cachedSearch) {
        return NextResponse.json(cachedSearch);
    }

    const result = await searchParts({ query, category, type, limit, offset });
    setSearchCache(cacheKey, result);
    return NextResponse.json(result);
}

/**
 * POST /api/parts
 * Create a new part.
 */
export async function POST(request: NextRequest) {
    const body = await request.json() as PartRecord;

    if (!body.partNumber || typeof body.partNumber !== "string") {
        return NextResponse.json({ error: "partNumber is required" }, { status: 400 });
    }
    if (!body.description || typeof body.description !== "string") {
        return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (!body.category || typeof body.category !== "string") {
        return NextResponse.json({ error: "category is required" }, { status: 400 });
    }
    if (!body.type || typeof body.type !== "string") {
        return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    try {
        const part = await createPart(body);
        clearPartsCache();
        return NextResponse.json({ part });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to create part" },
            { status: 500 }
        );
    }
}
