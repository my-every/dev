import "server-only";

import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import { readWireListPrintSchema } from "@/lib/project-state/share-print-schema-handlers";
import type { WireListPrintSchema } from "@/lib/wire-list-print/schema";

export function extractExternalSchemaLocations(
  schema: WireListPrintSchema | null | undefined,
): string[] {
  if (!schema?.pages?.length) {
    return [];
  }

  const locations = schema.pages
    .flatMap((page) => ("locationGroups" in page ? page.locationGroups ?? [] : []))
    .filter((group) => group.isExternal === true)
    .map((group) => String(group.location ?? "").trim())
    .filter(Boolean);

  return [...new Set(locations)].sort();
}

export async function readSchemaLocationsBySheet(
  projectId: string,
): Promise<Record<string, string[]>> {
  const manifest = await readProjectManifest(projectId);
  const assignmentSlugs = Object.keys(manifest?.assignments ?? {});

  if (assignmentSlugs.length === 0) {
    return {};
  }

  const entries = await Promise.all(
    assignmentSlugs.map(async (sheetSlug) => {
      const schema = await readWireListPrintSchema(projectId, sheetSlug);
      return [sheetSlug, extractExternalSchemaLocations(schema)] as const;
    }),
  );

  return Object.fromEntries(entries);
}

export async function readSchemaLocationsForSheet(
  projectId: string,
  sheetSlug: string,
): Promise<string[]> {
  const schema = await readWireListPrintSchema(projectId, sheetSlug);
  return extractExternalSchemaLocations(schema);
}