import { readdir } from "node:fs/promises"
import path from "node:path"

interface ThreeAssetDescriptor {
  name: string
  extension: string
  previewable: boolean
  kind: "legacy-json" | "glb" | "gltf" | "stp" | "other"
}

export async function GET() {
  const directory = path.join(process.cwd(), "threejs")

  try {
    const entries = await readdir(directory, { withFileTypes: true })
    const files: ThreeAssetDescriptor[] = entries
      .filter((entry) => entry.isFile())
      .map((entry) => {
        const extension = path.extname(entry.name).toLowerCase()

        if (extension === ".js") {
          return {
            name: entry.name,
            extension,
            previewable: true,
            kind: "legacy-json",
          }
        }

        if (extension === ".glb") {
          return {
            name: entry.name,
            extension,
            previewable: true,
            kind: "glb",
          }
        }

        if (extension === ".gltf") {
          return {
            name: entry.name,
            extension,
            previewable: true,
            kind: "gltf",
          }
        }

        if (extension === ".stp" || extension === ".step") {
          return {
            name: entry.name,
            extension,
            previewable: true,
            kind: "stp",
          }
        }

        return {
          name: entry.name,
          extension,
          previewable: false,
          kind: "other",
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    return Response.json({ files })
  } catch {
    return Response.json({ files: [] }, { status: 200 })
  }
}
