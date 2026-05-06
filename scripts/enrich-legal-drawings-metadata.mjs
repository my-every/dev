#!/usr/bin/env node
/**
 * enrich-legal-drawings-metadata.mjs
 *
 * Fast standalone script that maps projectName / lwcType / pdNumber onto every
 * Legal Drawings revision project-manifest.json and updates latest.json /
 * project-meta.json — without triggering any workbook rebuild.
 *
 * Usage:
 *   node scripts/enrich-legal-drawings-metadata.mjs
 *   node scripts/enrich-legal-drawings-metadata.mjs --pd 4N291
 *   node scripts/enrich-legal-drawings-metadata.mjs --dry-run
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, "..");
const LEGAL_ROOT =
  process.env.LEGAL_DRAWINGS_ROOT ||
  path.join(APP_ROOT, "Share", "Legal Drawings");
const SCHEDULE_CSV_PATH = path.join(APP_ROOT, "Share", "Schedule", "Schedule.csv");
const PRIORITY_LIST_JSON_PATH = path.join(APP_ROOT, "Share", "Schedule", "priority-list.json");
const PROJECTS_ROOT = path.join(APP_ROOT, "Share", "Projects");

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_PD = getArgValue("--pd");

// ---------------------------------------------------------------------------
// Lazy-load caches
// ---------------------------------------------------------------------------
let scheduleRowsPromise = null;
let priorityRowsPromise = null;
let projectManifestsPromise = null;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const startedAt = new Date().toISOString();

  const allEntries = await listLegalProjects();
  const entries = ONLY_PD
    ? allEntries.filter((e) => e.name.toLowerCase() === ONLY_PD.toLowerCase())
    : allEntries;

  if (entries.length === 0) {
    console.error(`No Legal Drawings folders found${ONLY_PD ? ` for PD: ${ONLY_PD}` : ""}.`);
    process.exit(1);
  }

  const summaries = [];
  for (const entry of entries) {
    const summary = await enrichPdFolder(entry);
    summaries.push(summary);
  }

  const totalScanned = summaries.reduce((acc, s) => acc + s.manifestFilesScanned, 0);
  const totalUpdated = summaries.reduce((acc, s) => acc + s.manifestFilesUpdated, 0);

  const runSummary = {
    startedAt,
    completedAt: new Date().toISOString(),
    legalRoot: LEGAL_ROOT,
    dryRun: DRY_RUN,
    processedCount: summaries.length,
    totalManifestFilesScanned: totalScanned,
    totalManifestFilesUpdated: totalUpdated,
    projects: summaries,
  };

  process.stdout.write(`${JSON.stringify(runSummary, null, 2)}\n`);
}

// ---------------------------------------------------------------------------
// Per-PD enrichment
// ---------------------------------------------------------------------------
async function enrichPdFolder(entry) {
  const pdNumber = entry.name;
  const pdPath = entry.path;

  const existingLatest = await readJsonIfExists(path.join(pdPath, "latest.json"));
  const existingProjectMeta = await readJsonIfExists(path.join(pdPath, "project-meta.json"));

  // Find all existing revision directories
  const dirEntries = await fs.readdir(pdPath, { withFileTypes: true }).catch(() => []);
  const revisionNames = dirEntries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);

  // Pick a unit hint from existing data
  const unitHint =
    existingLatest?.unitNumber ||
    existingProjectMeta?.unitNumber ||
    null;

  const scheduleMetadata = await findScheduleMetadata(pdNumber, unitHint);
  const priorityMetadata = await findPriorityMetadata(pdNumber, unitHint);
  const projectManifestMetadata = await findProjectManifestMetadata(pdNumber, unitHint);

  // Resolve the latest revision manifest for additional fallback
  const latestRevision = existingLatest?.latestRevision || null;
  const latestRevisionManifest = latestRevision
    ? await readJsonIfExists(path.join(pdPath, latestRevision, "project-manifest.json"))
    : null;

  const resolvedPdNumber = normalizePdNumberValue(
    firstNonEmptyText(
      pdNumber,
      latestRevisionManifest?.pdNumber,
      existingLatest?.pdNumber,
      existingProjectMeta?.pdNumber,
      projectManifestMetadata?.pdNumber,
      scheduleMetadata?.pdNumber,
      priorityMetadata?.pdNumber,
    ) || pdNumber,
  );

  const resolvedProjectName = firstNonEmptyText(
    scheduleMetadata?.displayName,
    scheduleMetadata?.projectName,
    priorityMetadata?.projectName,
    projectManifestMetadata?.projectName,
    existingLatest?.projectName,
    existingProjectMeta?.projectName,
    latestRevisionManifest?.projectName,
    latestRevisionManifest?.name,
    existingLatest?.projectNameHint,
    existingProjectMeta?.projectNameHint,
    resolvedPdNumber,
  );

  const resolvedLwcType = firstNonEmptyText(
    scheduleMetadata?.lwcType,
    priorityMetadata?.lwcType,
    projectManifestMetadata?.lwcType,
    existingLatest?.lwcType,
    existingProjectMeta?.lwcType,
    latestRevisionManifest?.lwcType,
  );

  // Update every revision project-manifest.json
  const manifestMapResult = await mapProjectMetadataToRevisionManifests({
    pdPath,
    revisionNames,
    pdNumber: resolvedPdNumber,
    projectName: resolvedProjectName,
    lwcType: resolvedLwcType,
  });

  // Patch latest.json and project-meta.json if they exist
  if (!DRY_RUN) {
    if (existingLatest) {
      const patchedLatest = {
        ...existingLatest,
        pdNumber: resolvedPdNumber,
        projectName: resolvedProjectName ?? existingLatest.projectName,
        lwcType: resolvedLwcType ?? existingLatest.lwcType,
      };
      await writeJson(path.join(pdPath, "latest.json"), patchedLatest);
    }

    if (existingProjectMeta) {
      const patchedMeta = {
        ...existingProjectMeta,
        pdNumber: resolvedPdNumber,
        projectName: resolvedProjectName ?? existingProjectMeta.projectName,
        lwcType: resolvedLwcType ?? existingProjectMeta.lwcType,
      };
      await writeJson(path.join(pdPath, "project-meta.json"), patchedMeta);
    }
  }

  return {
    pdNumber: resolvedPdNumber,
    resolvedProjectName,
    resolvedLwcType,
    manifestFilesScanned: manifestMapResult.scanned,
    manifestFilesUpdated: manifestMapResult.updated,
  };
}

// ---------------------------------------------------------------------------
// Revision manifest metadata mapper
// ---------------------------------------------------------------------------
async function mapProjectMetadataToRevisionManifests({ pdPath, revisionNames, pdNumber, projectName, lwcType }) {
  let scanned = 0;
  let updated = 0;

  for (const revision of revisionNames) {
    const manifestPath = path.join(pdPath, revision, "project-manifest.json");
    const manifest = await readJsonIfExists(manifestPath);
    if (!manifest || typeof manifest !== "object") {
      continue;
    }

    scanned += 1;
    const next = { ...manifest };
    const normalizedPd = normalizePdNumberValue(pdNumber) || normalizePdNumberValue(next.pdNumber) || null;
    const normalizedProjectName = firstNonEmptyText(projectName, next.projectName, next.name, normalizedPd);
    const normalizedLwc = firstNonEmptyText(lwcType, next.lwcType);

    let changed = false;

    if (normalizedPd && normalizeScheduleText(next.pdNumber) !== normalizedPd) {
      next.pdNumber = normalizedPd;
      changed = true;
    }

    if (normalizedProjectName && normalizeScheduleText(next.projectName) !== normalizedProjectName) {
      next.projectName = normalizedProjectName;
      changed = true;
    }

    if (normalizedProjectName) {
      const existingName = normalizeScheduleText(next.name);
      const existingPd = normalizePdNumberValue(next.pdNumber);
      const shouldReplaceName = !existingName || (existingPd && existingName === existingPd);
      if (shouldReplaceName && existingName !== normalizedProjectName) {
        next.name = normalizedProjectName;
        changed = true;
      }
    }

    if (normalizedLwc && normalizeScheduleText(next.lwcType) !== normalizedLwc) {
      next.lwcType = normalizedLwc;
      changed = true;
    }

    if (changed && !DRY_RUN) {
      await writeJson(manifestPath, next);
      updated += 1;
    }
  }

  return { scanned, updated };
}

// ---------------------------------------------------------------------------
// Metadata source loaders
// ---------------------------------------------------------------------------
async function loadScheduleRows() {
  if (scheduleRowsPromise) return scheduleRowsPromise;
  scheduleRowsPromise = fs.readFile(SCHEDULE_CSV_PATH, "utf8").then((raw) => {
    const workbook = XLSX.read(raw, { type: "string", raw: false });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
    if (!sheet) return [];
    return XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  }).catch(() => []);
  return scheduleRowsPromise;
}

async function loadPriorityRows() {
  if (priorityRowsPromise) return priorityRowsPromise;
  priorityRowsPromise = readJsonIfExists(PRIORITY_LIST_JSON_PATH).then((doc) => {
    return Array.isArray(doc?.entries) ? doc.entries : [];
  });
  return priorityRowsPromise;
}

async function loadProjectManifestRows() {
  if (projectManifestsPromise) return projectManifestsPromise;
  projectManifestsPromise = (async () => {
    const rows = [];
    const projectDirs = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true }).catch(() => []);
    for (const projectDir of projectDirs) {
      if (!projectDir.isDirectory()) continue;
      const manifestPath = path.join(PROJECTS_ROOT, projectDir.name, "state", "project-manifest.json");
      const manifest = await readJsonIfExists(manifestPath);
      if (!manifest) continue;
      rows.push({
        pdNumber: normalizePdNumberValue(manifest.pdNumber),
        unitNumber: normalizeScheduleText(manifest.unitNumber),
        projectName: firstNonEmptyText(manifest.projectName, manifest.name),
        lwcType: normalizeScheduleText(manifest.lwcType),
        updatedAt: normalizeScheduleText(manifest.updatedAt || manifest.createdAt),
      });
    }
    return rows;
  })();
  return projectManifestsPromise;
}

async function findScheduleMetadata(pdNumber, unitNumber) {
  const rows = await loadScheduleRows();
  const normalizedPdNumber = String(pdNumber || "").trim().toUpperCase();
  const normalizedUnitNumber = normalizeScheduleText(unitNumber);
  let fallbackRow = null;

  for (const row of rows) {
    const rowPdNumber = normalizeScheduleText(row["PD#"]).toUpperCase();
    if (rowPdNumber !== normalizedPdNumber) continue;
    if (!fallbackRow) fallbackRow = row;
    const rowUnit = normalizeScheduleText(row["UNIT"]);
    if (normalizedUnitNumber && rowUnit !== normalizedUnitNumber) continue;
    return buildScheduleMetadata(row);
  }

  return fallbackRow ? buildScheduleMetadata(fallbackRow) : null;
}

function buildScheduleMetadata(row) {
  const projectName = normalizeScheduleText(row["PROJECT"]);
  const unitNumber = normalizeScheduleText(row["UNIT"]);
  return {
    pdNumber: normalizeScheduleText(row["PD#"]).toUpperCase(),
    projectName,
    displayName: unitNumber ? projectName : projectName,
    unitNumber,
    lwcType: normalizeLwcType(row["LWC"]),
  };
}

async function findPriorityMetadata(pdNumber, unitNumber) {
  const rows = await loadPriorityRows();
  const keys = buildPdLookupKeys(pdNumber);
  const normalizedUnit = normalizeScheduleText(unitNumber);
  let fallback = null;

  for (const row of rows) {
    const rowKeys = buildPdLookupKeys(row?.pd);
    if (!rowKeys.some((k) => keys.includes(k))) continue;
    if (!fallback) fallback = row;
    const rowUnit = normalizeScheduleText(row?.unit);
    if (normalizedUnit && rowUnit && rowUnit !== normalizedUnit) continue;
    return { pdNumber: normalizePdNumberValue(row?.pd), unitNumber: normalizeScheduleText(row?.unit), projectName: normalizeScheduleText(row?.customer), lwcType: normalizeLwcType(row?.lwc) };
  }

  if (!fallback) return null;
  return { pdNumber: normalizePdNumberValue(fallback?.pd), unitNumber: normalizeScheduleText(fallback?.unit), projectName: normalizeScheduleText(fallback?.customer), lwcType: normalizeLwcType(fallback?.lwc) };
}

async function findProjectManifestMetadata(pdNumber, unitNumber) {
  const rows = await loadProjectManifestRows();
  const keys = buildPdLookupKeys(pdNumber);
  const normalizedUnit = normalizeScheduleText(unitNumber);
  const matches = rows.filter((row) => {
    const rowKeys = buildPdLookupKeys(row.pdNumber);
    return rowKeys.some((k) => keys.includes(k));
  });

  if (!matches.length) return null;

  const exactUnitMatch = normalizedUnit
    ? matches.find((row) => normalizeScheduleText(row.unitNumber) === normalizedUnit)
    : null;

  const picked = exactUnitMatch || matches.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  return {
    pdNumber: normalizePdNumberValue(picked.pdNumber),
    unitNumber: normalizeScheduleText(picked.unitNumber),
    projectName: normalizeScheduleText(picked.projectName),
    lwcType: normalizeLwcType(picked.lwcType),
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------
async function listLegalProjects() {
  const entries = await fs.readdir(LEGAL_ROOT, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => ({ name: e.name, path: path.join(LEGAL_ROOT, e.name) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function normalizeScheduleText(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

/**
 * Maps raw LWC values from Schedule CSV / priority-list.json to canonical
 * internal values (NEW_FLEX, ONSKID, OFFSKID, NTB, FLOAT).
 * The schedule uses "New" for New/Flex, "Onskid", "Offskid", "NTB", etc.
 */
function normalizeLwcType(value) {
  const v = normalizeScheduleText(value).toUpperCase();
  if (!v) return "";
  if (v === "NEW" || v.includes("NEW") || v.includes("FLEX")) return "NEW_FLEX";
  if (v.includes("OFFSKID") || v.includes("OFF")) return "OFFSKID";
  if (v.includes("ONSKID") || v.includes("ON") || v.includes("SKID")) return "ONSKID";
  if (v === "NTB") return "NTB";
  if (v === "FLOAT") return "FLOAT";
  return v;
}

function normalizePdNumberValue(value) {
  return normalizeScheduleText(value).toUpperCase();
}

function buildPdLookupKeys(value) {
  const normalized = normalizePdNumberValue(value);
  if (!normalized) return [];
  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  const withoutSuffix = compact.replace(/(CB|CC|CS|CD|CE|CF)$/i, "");
  return Array.from(new Set([compact, withoutSuffix].filter(Boolean)));
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    const normalized = normalizeScheduleText(value);
    if (normalized) return normalized;
  }
  return null;
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

// ---------------------------------------------------------------------------
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
