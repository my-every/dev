#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const APP_ROOT = process.cwd();
const PROJECTS_ROOT = path.join(APP_ROOT, "Share", "Projects");
const LEGAL_ROOT = path.join(APP_ROOT, "Share", "Legal Drawings");
const REFERENCE_PATH = path.join(APP_ROOT, "Share", "References", "layout-unit-box-panel-reference.json");

const { values } = parseArgs({
  options: {
    scope: { type: "string", default: "both" }, // projects | legals | both
    project: { type: "string" },
    pd: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
  strict: false,
});

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizeKey(value) {
  return normalize(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripUnitTypePrefix(name) {
  return normalize(name).replace(/^JB\d+\s+/i, "").trim();
}

function normalizeTitle(name) {
  return normalizeKey(stripUnitTypePrefix(name));
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeJson(filePath, value, dryRun) {
  if (dryRun) return;
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function buildReferenceLookup(reference) {
  const byUnitAndTitle = new Map();
  const byTitle = new Map();

  const rows = Array.isArray(reference?.mappings?.unitTypeToBoxNumber)
    ? reference.mappings.unitTypeToBoxNumber
    : [];

  for (const row of rows) {
    const unitType = normalizeKey(row?.unitType);
    if (!unitType) continue;

    for (const assignment of row.assignments ?? []) {
      const title = normalizeTitle(assignment?.value);
      if (!title) continue;

      const mapping = {
        unitType,
        title,
        swsType: normalize(assignment?.swsType),
        boxSide: normalize(assignment?.boxSide),
        externalLocations: Array.isArray(assignment?.externalLocations)
          ? assignment.externalLocations
              .map((v) =>
                typeof v === "string"
                  ? { location: normalize(v), wireListVisible: true, brandingVisible: true }
                  : v
              )
              .filter((v) => v?.location)
          : [],
      };

      byUnitAndTitle.set(`${unitType}||${title}`, mapping);

      const existing = byTitle.get(title) ?? [];
      existing.push(mapping);
      byTitle.set(title, existing);
    }
  }

  return { byUnitAndTitle, byTitle };
}

async function listProjectManifestPaths(projectFilter) {
  const dirents = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true }).catch(() => []);
  const paths = [];

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    if (projectFilter && normalizeKey(dirent.name) !== normalizeKey(projectFilter)) continue;
    const manifestPath = path.join(PROJECTS_ROOT, dirent.name, "state", "project-manifest.json");
    const stat = await fs.stat(manifestPath).catch(() => null);
    if (stat?.isFile()) paths.push(manifestPath);
  }

  return paths;
}

async function listLegalManifestPaths(pdFilter) {
  const pdDirents = await fs.readdir(LEGAL_ROOT, { withFileTypes: true }).catch(() => []);
  const paths = [];

  for (const pdDirent of pdDirents) {
    if (!pdDirent.isDirectory()) continue;
    if (pdFilter && normalizeKey(pdDirent.name) !== normalizeKey(pdFilter)) continue;

    const pdRoot = path.join(LEGAL_ROOT, pdDirent.name);
    const revisionDirents = await fs.readdir(pdRoot, { withFileTypes: true }).catch(() => []);
    for (const revisionDirent of revisionDirents) {
      if (!revisionDirent.isDirectory()) continue;
      const manifestPath = path.join(pdRoot, revisionDirent.name, "project-manifest.json");
      const stat = await fs.stat(manifestPath).catch(() => null);
      if (stat?.isFile()) paths.push(manifestPath);
    }
  }

  return paths;
}

function findBestMapping(lookup, assignment) {
  const unitType = normalizeKey(assignment?.unitType);
  const title = normalizeTitle(assignment?.sheetName);
  if (!title) return null;

  if (unitType) {
    const exact = lookup.byUnitAndTitle.get(`${unitType}||${title}`);
    if (exact) return exact;
  }

  const candidates = lookup.byTitle.get(title) ?? [];
  if (candidates.length === 1) return candidates[0];

  // If multiple candidates exist but one matches this unitType, use it.
  if (unitType) {
    const unitMatch = candidates.find((candidate) => candidate.unitType === unitType);
    if (unitMatch) return unitMatch;
  }

  return null;
}

function applyMappingToManifest(manifest, lookup) {
  const assignments = manifest?.assignments ?? {};
  let touched = 0;

  for (const assignment of Object.values(assignments)) {
    const mapping = findBestMapping(lookup, assignment);
    if (!mapping) continue;

    let changed = false;

    if (mapping.swsType && normalize(assignment.swsType) !== mapping.swsType) {
      assignment.swsType = mapping.swsType;
      changed = true;
    }

    if (mapping.boxSide && normalize(assignment.boxSide) !== mapping.boxSide) {
      assignment.boxSide = mapping.boxSide;
      changed = true;
    }

    const refLocations = mapping.externalLocations ?? [];
    const refSerialized = JSON.stringify(
      refLocations
        .map((v) => (typeof v === "string" ? { location: normalize(v), wireListVisible: true, brandingVisible: true } : v))
        .filter((v) => v?.location)
        .sort((a, b) => a.location.localeCompare(b.location))
    );
    const currentLocations = Array.isArray(assignment.externalLocations)
      ? assignment.externalLocations
      : [];
    const currentSerialized = JSON.stringify(
      currentLocations
        .map((v) => (typeof v === "string" ? { location: normalize(v), wireListVisible: true, brandingVisible: true } : v))
        .filter((v) => v?.location)
        .sort((a, b) => a.location.localeCompare(b.location))
    );

    if (refSerialized !== currentSerialized) {
      assignment.externalLocations = refLocations;
      changed = true;
    }

    if (changed) touched += 1;
  }

  return touched;
}

async function run() {
  const scope = normalize(values.scope).toLowerCase();
  const dryRun = Boolean(values["dry-run"]);
  const projectFilter = normalize(values.project);
  const pdFilter = normalize(values.pd);

  if (!["projects", "legals", "both"].includes(scope)) {
    throw new Error(`Invalid --scope value: ${values.scope}. Expected projects|legals|both.`);
  }

  const reference = await readJson(REFERENCE_PATH);
  if (!reference) {
    throw new Error(`Unable to read reference: ${REFERENCE_PATH}`);
  }

  const lookup = buildReferenceLookup(reference);

  const manifestPaths = [];
  // Legal manifests are the authoritative source; update them before Share/Projects copies.
  if (scope === "legals" || scope === "both") {
    manifestPaths.push(...(await listLegalManifestPaths(pdFilter)));
  }
  if (scope === "projects" || scope === "both") {
    manifestPaths.push(...(await listProjectManifestPaths(projectFilter)));
  }

  let scanned = 0;
  let updatedManifests = 0;
  let updatedAssignments = 0;

  for (const manifestPath of manifestPaths) {
    const manifest = await readJson(manifestPath);
    if (!manifest || typeof manifest !== "object") continue;

    scanned += 1;
    const touched = applyMappingToManifest(manifest, lookup);
    if (touched > 0) {
      await writeJson(manifestPath, manifest, dryRun);
      updatedManifests += 1;
      updatedAssignments += touched;
    }
  }

  console.log(`[reference-backfill] scope: ${scope}`);
  console.log(`[reference-backfill] manifests scanned: ${scanned}`);
  console.log(`[reference-backfill] manifests updated: ${updatedManifests}`);
  console.log(`[reference-backfill] assignments updated: ${updatedAssignments}`);
  if (dryRun) {
    console.log("[reference-backfill] dry-run enabled; no files written");
  }
}

run().catch((error) => {
  console.error(`[reference-backfill] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
