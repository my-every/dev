import "server-only";

import path from "node:path";

import {
  readProjectManifest,
  resolveProjectRootDirectory,
} from "@/lib/project-state/share-project-state-handlers";

export const EXPORTS_DIRECTORY = "exports";
export const UNITS_DIRECTORY = "units";
export const BRANDING_EXPORTS_DIRECTORY = "branding";
export const WIRE_LIST_EXPORTS_DIRECTORY = "wire-lists";

export function sanitizeExportFileSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sheet";
}

export async function resolveProjectExportsRoot(projectId: string): Promise<string | null> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return null;
  }

  const projectRoot = await resolveProjectRootDirectory(projectId, {
    pdNumber: manifest.pdNumber,
    projectName: manifest.name,
  });
  if (!projectRoot) {
    return null;
  }

  return path.join(projectRoot, EXPORTS_DIRECTORY);
}

/**
 * Resolve the unit-scoped exports root directory: `<projectRoot>/exports/units/<unitNumber>/`
 */
export async function resolveUnitExportsRoot(projectId: string, unitNumber: string): Promise<string | null> {
  const exportsRoot = await resolveProjectExportsRoot(projectId);
  if (!exportsRoot) {
    return null;
  }

  const sanitizedUnit = sanitizeExportFileSegment(unitNumber);
  if (!sanitizedUnit) {
    return null;
  }

  return path.join(exportsRoot, UNITS_DIRECTORY, sanitizedUnit);
}

export async function resolveProjectExportFile(
  projectId: string,
  segments: string[],
): Promise<string | null> {
  const exportsRoot = await resolveProjectExportsRoot(projectId);
  if (!exportsRoot) {
    return null;
  }

  const sanitizedSegments = segments
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (sanitizedSegments.length === 0) {
    return null;
  }

  const resolvedPath = path.resolve(exportsRoot, ...sanitizedSegments);
  const normalizedRoot = `${path.resolve(exportsRoot)}${path.sep}`;

  if (resolvedPath !== path.resolve(exportsRoot) && !resolvedPath.startsWith(normalizedRoot)) {
    return null;
  }

  return resolvedPath;
}