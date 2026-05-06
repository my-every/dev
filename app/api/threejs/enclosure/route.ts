import { readFile } from "node:fs/promises"
import path from "node:path"

export async function GET() {
  const enclosurePath = path.join(process.cwd(), "threejs", "enclosure.js")

  try {
    const raw = await readFile(enclosurePath, "utf8")
    return new Response(raw, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600",
      },
    })
  } catch {
    return Response.json(
      { error: "Enclosure model was not found." },
      { status: 404 },
    )
  }
}
