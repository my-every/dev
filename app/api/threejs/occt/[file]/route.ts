import { readFile } from "node:fs/promises"
import path from "node:path"

const ALLOWED_OCCT_FILES = new Set(["occt-import-js.wasm", "occt-import-js-worker.js"])

function contentTypeFor(fileName: string): string {
  if (fileName.endsWith(".wasm")) return "application/wasm"
  if (fileName.endsWith(".js")) return "application/javascript; charset=utf-8"
  return "application/octet-stream"
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const params = await context.params
  const safeFileName = path.basename(params.file)

  if (!ALLOWED_OCCT_FILES.has(safeFileName)) {
    return Response.json({ error: "File is not allowed." }, { status: 400 })
  }

  const filePath = path.join(process.cwd(), "node_modules", "occt-import-js", "dist", safeFileName)

  try {
    const content = await readFile(filePath)
    return new Response(content, {
      headers: {
        "content-type": contentTypeFor(safeFileName),
        "cache-control": "public, max-age=3600",
      },
    })
  } catch {
    return Response.json({ error: "File was not found." }, { status: 404 })
  }
}
