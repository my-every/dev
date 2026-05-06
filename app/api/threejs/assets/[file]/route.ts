import { readFile } from "node:fs/promises"
import path from "node:path"

const ALLOWED_EXTENSIONS = new Set([
  ".js",
  ".txt",
  ".stp",
  ".step",
  ".glb",
  ".gltf",
  ".bin",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
])

function contentTypeFor(extension: string): string {
  if (extension === ".js") return "application/json; charset=utf-8"
  if (extension === ".gltf") return "model/gltf+json; charset=utf-8"
  if (extension === ".glb") return "model/gltf-binary"
  if (extension === ".bin") return "application/octet-stream"
  if (extension === ".png") return "image/png"
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg"
  if (extension === ".webp") return "image/webp"
  if (extension === ".stp" || extension === ".step") return "text/plain; charset=utf-8"
  return "text/plain; charset=utf-8"
}

function isBinaryExtension(extension: string): boolean {
  return [".glb", ".bin", ".png", ".jpg", ".jpeg", ".webp"].includes(extension)
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ file: string }> },
) {
  const params = await context.params
  const safeFileName = path.basename(params.file)
  const extension = path.extname(safeFileName).toLowerCase()

  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return Response.json({ error: "File type is not allowed." }, { status: 400 })
  }

  const filePath = path.join(process.cwd(), "threejs", safeFileName)

  try {
    const raw = isBinaryExtension(extension)
      ? await readFile(filePath)
      : await readFile(filePath, "utf8")

    return new Response(raw, {
      headers: {
        "content-type": contentTypeFor(extension),
        "cache-control": "public, max-age=3600",
      },
    })
  } catch {
    return Response.json({ error: "File was not found." }, { status: 404 })
  }
}
