import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  readProjectManifest,
} from "@/lib/project-state/share-project-state-handlers";
import { readWireListPrintSchema } from "@/lib/project-state/share-print-schema-handlers";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";
import type { ManifestAssignment, ProjectManifest } from "@/types/project-manifest";
import {
  EXPORTS_DIRECTORY,
  UNITS_DIRECTORY,
  resolveUnitExportsRoot,
  sanitizeExportFileSegment,
} from "@/lib/project-exports/project-exports-paths";

// ============================================================================
// Schema types
// ============================================================================

export interface CrossWireSchemaProjectInfo {
  projectNumber: string;
  projectName: string;
  revision: string;
  unitNumber: string;
}

export interface CrossWireRow {
  fromDeviceId: string;
  fromLocation: string;
  wireType: string;
  wireNo: string;
  wireId: string;
  gaugeSize: string;
  length: number | null;
  toDeviceId: string;
  toLocation: string;
  bundleName: string;
  bundleDisplay: string;
}

export interface CrossWireDestinationGroup {
  /** Raw toLocation value as it appears in the wire data. */
  toLocation: string;
  /** Assignment name within this project that best matches the destination location, if resolvable. */
  resolvedAssignmentName?: string;
  /** Unit type of the resolved destination assignment, if resolved. */
  resolvedUnitType?: string;
  /** The slug of the resolved destination assignment within this project. */
  resolvedSheetSlug?: string;
  rows: CrossWireRow[];
}

export interface CrossWireAssignmentGroup {
  sheetSlug: string;
  sheetName: string;
  /** Unit type of this source assignment, from the manifest. */
  unitType: string;
  destinationGroups: CrossWireDestinationGroup[];
  totalRows: number;
}

export interface CrossWireUnitTypeGroup {
  unitType: string;
  assignments: CrossWireAssignmentGroup[];
  totalRows: number;
}

export interface CrossWireSchema {
  schemaVersion: 1;
  generatedAt: string;
  projectId: string;
  projectInfo: CrossWireSchemaProjectInfo;
  unitTypeGroups: CrossWireUnitTypeGroup[];
  /** Slugs of assignments with no sheet schema available yet (legals not yet processed). */
  missingSchemas: string[];
  /** Assignments whose sheet schemas exist but have no external-location rows. */
  internalOnlyAssignments: string[];
  totalCrossWireRows: number;
}

export interface CrossWireSchemaResult {
  schema: CrossWireSchema;
  /** Relative export path for the saved JSON file, if saved. */
  relativePath?: string;
  fileName?: string;
}

// ============================================================================
// Internal helpers
// ============================================================================

const CROSS_WIRE_EXPORTS_DIRECTORY = "cross-wire-schema";
const CROSS_WIRE_SCHEMA_FILE = "cross-wire-schema.json";

/**
 * Normalize a location string for comparison: uppercase, collapse whitespace,
 * strip common JB prefix (e.g. "JB71 ") to help match sheet names.
 */
function normalizeLocationKey(value: string): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^JB\d+\s+/i, "")
    .replace(/\s+/g, " ");
}

/**
 * Build a map from normalized assignment name → {slug, unitType} for all
 * operational assignments in the manifest, so that destination toLocation
 * values can be matched to known sibling assignments.
 */
function buildAssignmentNameIndex(
  manifest: ProjectManifest,
): Map<string, { slug: string; name: string; unitType: string }> {
  const index = new Map<string, { slug: string; name: string; unitType: string }>();

  for (const [slug, assignment] of Object.entries(manifest.assignments ?? {})) {
    const name = assignment.sheetName;
    const unitType = assignment.unitType ?? "";

    // Index by raw name
    const rawKey = normalizeLocationKey(name);
    if (rawKey) {
      index.set(rawKey, { slug, name, unitType });
    }

    // Also index by normalizeDisplayTitle variant (strips JB prefix, standardizes casing)
    const displayKey = normalizeLocationKey(normalizeDisplayTitle(name));
    if (displayKey && displayKey !== rawKey) {
      index.set(displayKey, { slug, name, unitType });
    }
  }

  return index;
}

/**
 * Attempt to resolve a toLocation value to a known assignment in the manifest.
 * Returns null if no match found.
 */
function resolveDestinationAssignment(
  toLocation: string,
  assignmentIndex: Map<string, { slug: string; name: string; unitType: string }>,
): { slug: string; name: string; unitType: string } | null {
  const normalizedLocation = normalizeLocationKey(toLocation);
  if (!normalizedLocation) {
    return null;
  }

  // Try exact key match
  const exact = assignmentIndex.get(normalizedLocation);
  if (exact) {
    return exact;
  }

  // Try prefix match — the toLocation may include extra detail the assignment name doesn't
  for (const [key, entry] of assignmentIndex) {
    if (normalizedLocation.startsWith(key) || key.startsWith(normalizedLocation)) {
      return entry;
    }
  }

  return null;
}

function buildCrossWireRowsFromLocationGroup(
  sheetName: string,
  locationGroup: {
    location: string;
    subsections: Array<{
      rows: Array<{
        fromDeviceId: string;
        toDeviceId: string;
        wireType: string;
        wireNo: string;
        wireId: string;
        gaugeSize: string;
        fromLocation: string;
        toLocation: string;
        lengthInches?: number;
      }>;
    }>;
  },
): CrossWireRow[] {
  return locationGroup.subsections.flatMap((subsection) =>
    subsection.rows.map((row) => ({
      fromDeviceId: row.fromDeviceId ?? "",
      fromLocation: String(row.fromLocation ?? "").trim() || sheetName,
      wireType: row.wireType ?? "",
      wireNo: row.wireNo ?? "",
      wireId: row.wireId ?? "",
      gaugeSize: row.gaugeSize ?? "",
      length: typeof row.lengthInches === "number" && Number.isFinite(row.lengthInches) ? row.lengthInches : null,
      toDeviceId: row.toDeviceId ?? "",
      toLocation: row.toLocation ?? locationGroup.location ?? "",
      bundleName: "",
      bundleDisplay: "",
    })),
  );
}

// ============================================================================
// Core generator
// ============================================================================

/**
 * Generate a cross-wire schema for a project.
 *
 * Iterates all operational assignments in the manifest, loads each sheet's
 * saved wire-list print schema, then extracts the wire-list location groups
 * whose `isExternal` flag is true. Those external location groups are merged
 * by destination location and grouped by:
 *
 *   unitType (source) → assignment (source) → toLocation (destination)
 *
 * This keeps the cross-wire generator aligned with the print schema's
 * existing external/internal classification instead of re-deriving it from
 * raw wire rows.
 */
export async function generateCrossWireSchema(projectId: string): Promise<CrossWireSchema> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    throw new Error("Project not found");
  }

  const assignmentIndex = buildAssignmentNameIndex(manifest);

  // Gather the unit type → slug[] mapping. Fall back to iterating all assignments.
  const assignmentsByUnitType: Record<string, string[]> =
    manifest.assignmentsByUnitType ?? {};

  // Build a flat list of operational assignment slugs in the order: unit type groups first,
  // then any assignments not present in assignmentsByUnitType.
  const slugsInUnitTypeGroups = new Set(Object.values(assignmentsByUnitType).flat());
  const remainingSlugs = Object.keys(manifest.assignments ?? {}).filter(
    (slug) => !slugsInUnitTypeGroups.has(slug),
  );

  // Build unit type → assignment slug[] map, including uncategorised
  const unitTypeMap: Record<string, string[]> = { ...assignmentsByUnitType };
  if (remainingSlugs.length > 0) {
    const fallbackKey =
      remainingSlugs
        .map((slug) => manifest.assignments[slug]?.unitType)
        .find((t) => t) ?? "UNCATEGORIZED";
    for (const slug of remainingSlugs) {
      const unitType =
        manifest.assignments[slug]?.unitType ?? fallbackKey;
      unitTypeMap[unitType] = [...(unitTypeMap[unitType] ?? []), slug];
    }
  }

  const missingSchemas: string[] = [];
  const internalOnlyAssignments: string[] = [];
  const unitTypeGroups: CrossWireUnitTypeGroup[] = [];
  let totalCrossWireRows = 0;

  for (const [unitType, slugs] of Object.entries(unitTypeMap)) {
    const assignmentGroups: CrossWireAssignmentGroup[] = [];

    for (const slug of slugs) {
      const assignment: ManifestAssignment | undefined =
        manifest.assignments[slug];
      if (!assignment || assignment.kind !== "operational") {
        continue;
      }

      const sheetSchema = await readWireListPrintSchema(projectId, slug);
      if (!sheetSchema) {
        missingSchemas.push(slug);
        continue;
      }

      const wireListPage = sheetSchema.pages.find((page) => page.pageType === "wire-list");
      const externalLocationGroups = wireListPage?.locationGroups.filter((group) => group.isExternal) ?? [];

      if (externalLocationGroups.length === 0) {
        internalOnlyAssignments.push(slug);
        continue;
      }

      // Merge all external location groups from the wire-list schema by destination location.
      const byDestination = new Map<string, CrossWireRow[]>();
      for (const locationGroup of externalLocationGroups) {
        const locationKey = (locationGroup.location ?? "").trim();
        const existing = byDestination.get(locationKey) ?? [];
        const groupRows = buildCrossWireRowsFromLocationGroup(sheetSchema.sheetName, locationGroup);
        existing.push(...groupRows);
        byDestination.set(locationKey, existing);
      }

      const destinationGroups: CrossWireDestinationGroup[] = [];
      for (const [toLocation, rows] of byDestination) {
        const resolved = resolveDestinationAssignment(toLocation, assignmentIndex);
        destinationGroups.push({
          toLocation,
          ...(resolved
            ? {
                resolvedAssignmentName: resolved.name,
                resolvedUnitType: resolved.unitType || undefined,
                resolvedSheetSlug: resolved.slug,
              }
            : {}),
          rows,
        });
      }

      // Sort destination groups by toLocation alphabetically
      destinationGroups.sort((a, b) =>
        a.toLocation.localeCompare(b.toLocation, undefined, { sensitivity: "base" }),
      );

      const groupTotalRows = destinationGroups.reduce((n, g) => n + g.rows.length, 0);
      totalCrossWireRows += groupTotalRows;

      assignmentGroups.push({
        sheetSlug: slug,
        sheetName: sheetSchema.sheetName,
        unitType: assignment.unitType ?? unitType,
        destinationGroups,
        totalRows: groupTotalRows,
      });
    }

    if (assignmentGroups.length === 0) {
      continue;
    }

    unitTypeGroups.push({
      unitType,
      assignments: assignmentGroups,
      totalRows: assignmentGroups.reduce((n, g) => n + g.totalRows, 0),
    });
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    projectId,
    projectInfo: {
      projectNumber: manifest.pdNumber ?? "",
      projectName: manifest.name ?? "",
      revision: manifest.revision ?? "",
      unitNumber: manifest.unitNumber ?? "",
    },
    unitTypeGroups,
    missingSchemas,
    internalOnlyAssignments,
    totalCrossWireRows,
  };
}

/**
 * Generate and persist the cross-wire schema to the project's exports directory.
 */
export async function generateAndSaveCrossWireSchema(
  projectId: string,
): Promise<CrossWireSchemaResult> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    throw new Error("Project not found");
  }

  const schema = await generateCrossWireSchema(projectId);

  const unitExportsRoot = await resolveUnitExportsRoot(projectId, manifest.unitNumber ?? "");
  if (!unitExportsRoot) {
    // Still return the schema, just without saving
    return { schema };
  }

  const exportDir = path.join(unitExportsRoot, CROSS_WIRE_EXPORTS_DIRECTORY);
  await fs.mkdir(exportDir, { recursive: true });

  const fileName = CROSS_WIRE_SCHEMA_FILE;
  const absolutePath = path.join(exportDir, fileName);
  await fs.writeFile(absolutePath, JSON.stringify(schema, null, 2), "utf-8");

  const sanitizedUnit = sanitizeExportFileSegment(manifest.unitNumber ?? "");
  const relativePath = path.posix.join(
    EXPORTS_DIRECTORY,
    UNITS_DIRECTORY,
    sanitizedUnit,
    CROSS_WIRE_EXPORTS_DIRECTORY,
    fileName,
  );

  return { schema, fileName, relativePath };
}

/**
 * Read a previously saved cross-wire schema from the project's exports directory.
 * Returns null if not yet generated.
 */
export async function readCrossWireSchema(
  projectId: string,
): Promise<CrossWireSchema | null> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return null;
  }

  const unitExportsRoot = await resolveUnitExportsRoot(projectId, manifest.unitNumber ?? "");
  if (!unitExportsRoot) {
    return null;
  }

  const filePath = path.join(
    unitExportsRoot,
    CROSS_WIRE_EXPORTS_DIRECTORY,
    CROSS_WIRE_SCHEMA_FILE,
  );

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as CrossWireSchema;
  } catch {
    return null;
  }
}
