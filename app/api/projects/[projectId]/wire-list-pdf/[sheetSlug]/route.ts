import { promises as fs } from "node:fs";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { ensureWireListPdfSheetExport } from "@/lib/project-exports/wire-list-pdf-exports";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; sheetSlug: string }> },
) {
  const { projectId, sheetSlug } = await params;

  try {
    const { absoluteFilePath, record } = await ensureWireListPdfSheetExport(
      projectId,
      sheetSlug,
      request.nextUrl.origin,
    );
    const data = await fs.readFile(absoluteFilePath);
    const download = request.nextUrl.searchParams.get("download") !== "0";

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${path.basename(record.fileName)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate wire list PDF";
    const download = request.nextUrl.searchParams.get("download") !== "0";

    if (!download) {
      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Wire List Preview Unavailable</title>
    <style>
      :root { color-scheme: light; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #f7f7f5;
        color: #18181b;
        font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .card {
        width: min(720px, calc(100vw - 48px));
        border: 1px solid #e4e4e7;
        border-radius: 24px;
        background: white;
        box-shadow: 0 12px 28px rgba(0,0,0,0.08);
        padding: 28px;
      }
      .eyebrow {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.18em;
        color: #71717a;
      }
      h1 {
        margin: 10px 0 0;
        font-size: 30px;
        line-height: 1.15;
      }
      p {
        margin: 14px 0 0;
        font-size: 15px;
        line-height: 1.6;
        color: #3f3f46;
      }
      pre {
        margin: 18px 0 0;
        padding: 16px;
        border-radius: 16px;
        background: #fafafa;
        border: 1px solid #e4e4e7;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 12px;
        line-height: 1.5;
        color: #52525b;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <div class="eyebrow">Wire List Preview</div>
      <h1>Preview unavailable</h1>
      <p>The PDF could not be generated for inline preview right now. You can still retry after the browser runtime is available, or use the download action once generation succeeds.</p>
      <pre>${message.replace(/[<>&]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[char] ?? char))}</pre>
    </main>
  </body>
</html>`;

      return new NextResponse(html, {
        status: 500,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
