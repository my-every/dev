import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getFileNameFromUrl(rawUrl: string) {
    try {
        const parsed = new URL(rawUrl);
        const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
        return lastSegment || parsed.hostname;
    } catch {
        return rawUrl;
    }
}

export async function POST(request: NextRequest) {
    const body = (await request.json()) as { url?: string };
    const rawUrl = body.url?.trim();

    if (!rawUrl) {
        return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    let target: URL;
    try {
        target = new URL(rawUrl);
    } catch {
        return NextResponse.json({ error: "A valid image URL is required." }, { status: 400 });
    }

    if (!["http:", "https:"].includes(target.protocol)) {
        return NextResponse.json({ error: "Only http and https image URLs are supported." }, { status: 400 });
    }

    try {
        const response = await fetch(target, {
            cache: "no-store",
            headers: {
                "User-Agent": "Codex Parts Workspace Image Import",
            },
        });

        if (!response.ok) {
            return NextResponse.json(
                { error: `Unable to fetch image URL (${response.status}).` },
                { status: 400 },
            );
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.startsWith("image/")) {
            return NextResponse.json(
                { error: "The provided URL did not return an image." },
                { status: 400 },
            );
        }

        const bytes = Buffer.from(await response.arrayBuffer());
        const dataUrl = `data:${contentType};base64,${bytes.toString("base64")}`;

        return NextResponse.json({
            dataUrl,
            name: getFileNameFromUrl(rawUrl),
            contentType,
        });
    } catch (error) {
        return NextResponse.json(
            {
                error: error instanceof Error ? error.message : "Failed to fetch image URL.",
            },
            { status: 500 },
        );
    }
}
