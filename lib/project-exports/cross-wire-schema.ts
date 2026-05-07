import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import {
  readProjectManifest,
  readSheetSchema,
} from "@/lib/project-state/share-project-state-handlers";
import { readWireBrandListSchema } from "@/lib/project-state/share-print-schema-handlers";
import { normalizeDisplayTitle } from "@/lib/workbook/normalize-sheet-name";
import type { ManifestAssignment, ProjectManifest } from "@/types/project-manifest";
import type { BrandListSchemaRow } from "@/lib/wire-brand-list/schema";
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

// ============================================================================
// Core generator
// ============================================================================

/**
 * Generate a cross-wire schema for a project.
 *
 * Iterates all operational assignments in the manifest, loads each one's
 * raw sheet schema (which contains ALL wire rows including unbranded wires
 * like grounds and clips), then extracts every row whose toLocation differs
 * from the assignment's own sheet name. Those "external" rows are collected,
 * deduplicated, and grouped by:
 *
 *   unitType (source) → assignment (source) → toLocation (destination)
 *
 * Brand list schemas are used as optional enrichment to attach bundle names
 * and measured lengths to rows that have been branded. Unbranded wires
 * (grounds, clips, etc.) will still appear with empty bundle fields.
 *
 * Each destination group also attempts to resolve the toLocation to a known
 * sibling assignment using the manifest's assignment name index.
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

      // Primary data source: raw sheet schema (has ALL wires, including unbranded).
      // Requires legals to have been processed (legal:backfill or project upload).
      const sheetSchema = await readSheetSchema(projectId, slug);
      if (!sheetSchema) {
        missingSchemas.push(slug);
        continue;
      }

      // Optional enrichment: brand list schema provides bundleName, bundleDisplay, length.
      const brandSchema = await readWireBrandListSchema(projectId, slug);

      // Build wireId → brand row lookup for enrichment
      const brandLookup = new Map<string, BrandListSchemaRow>();
      if (brandSchema) {
        for (const prefixGroup of brandSchema.prefixGroups) {
          for (const bundle of prefixGroup.bundles) {
            for (const brandRow of bundle.rows as BrandListSchemaRow[]) {
              if (brandRow.wireId) {
                brandLookup.set(brandRow.wireId, brandRow);
              }
            }
          }
        }
      }

      const sheetName = sheetSchema.name;
      const sheetNameUpper = sheetName.toUpperCase();
      const strippedSheet = normalizeLocationKey(sheetName);
      const externalRows: CrossWireRow[] = [];

      // Walk all raw wire rows and collect externally-located ones.
      // This captures ALL wire types including unbranded (grounds, clips, etc.).
      for (const row of sheetSchema.rows) {
        const toLocRaw = (row.toLocation ?? "").trim();
        if (!toLocRaw) continue;

        const toLocationNorm = toLocRaw.toUpperCase();

        // Row is internal if toLocation matches the current sheet name
        if (toLocationNorm === sheetNameUpper) continue;

        // Also skip rows where the normalised location maps to the sheet itself
        const strippedLocation = normalizeLocationKey(toLocRaw);
        if (strippedLocation && strippedLocation === strippedSheet) continue;

        // Enrich with brand list data if available for this wire
        const brandRow = row.wireId ? brandLookup.get(row.wireId) : undefined;

        externalRows.push({
          fromDeviceId: row.fromDeviceId ?? "",
          wireNo: row.wireNo ?? "",
          wireId: row.wireId ?? "",
          gaugeSize: row.gaugeSize ?? "",
          length: brandRow?.length ?? null,
          toDeviceId: row.toDeviceId ?? "",
          toLocation: toLocRaw,
          bundleName: brandRow?.bundleName ?? "",
          bundleDisplay: brandRow?.bundleDisplay ?? "",
        });
      }

      if (externalRows.length === 0) {
        internalOnlyAssignments.push(slug);
        continue;
      }

      // Group external rows by toLocation
      const byDestination = new Map<string, CrossWireRow[]>();
      for (const row of externalRows) {
        const key = (row.toLocation ?? "").trim();
        const existing = byDestination.get(key) ?? [];
        existing.push(row);
        byDestination.set(key, existing);
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
        sheetName: sheetSchema.name,
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
