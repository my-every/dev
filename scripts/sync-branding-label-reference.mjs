#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const APP_ROOT = process.cwd();
const PROJECTS_ROOT = path.join(APP_ROOT, "Share", "Projects");
const LEGAL_DRAWINGS_ROOT = path.join(APP_ROOT, "Share", "Legal Drawings");
const BRAND_LIST_ROOT = path.join(APP_ROOT, "Share", "Brand List");
const REFERENCE_PATH = path.join(APP_ROOT, "Share", "References", "layout-unit-box-panel-reference.json");
const DEFAULT_PREBUILD_REPORT_PATH = path.join(APP_ROOT, "Share", "Legal Drawings", "prebuild-report.json");

const { values } = parseArgs({
  options: {
    project: { type: "string" },
    pd: { type: "string" },
    revision: { type: "string" },
    "prebuild-report": { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
  strict: false,
});

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizeMatch(value) {
  return normalize(value)
    .toUpperCase()
    .replace(/\(SHT\s*\d+\)/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function canonicalTokenKey(value) {
  const tokens = normalizeMatch(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
  if (tokens.length === 0) return "";
  return tokens.sort((a, b) => a.localeCompare(b)).join(" ");
}

function getBestMapMatch(map, key) {
  if (!map || map.size === 0) return null;
  if (map.has(key)) return map.get(key);

  const normalizedKey = normalizeMatch(key);
  const canonicalKey = canonicalTokenKey(key);

  for (const [candidateKey, candidateValue] of map.entries()) {
    if (normalizeMatch(candidateKey) === normalizedKey) return candidateValue;
  }

  for (const [candidateKey, candidateValue] of map.entries()) {
    if (canonicalTokenKey(candidateKey) === canonicalKey) return candidateValue;
  }

  return null;
}

function toLowerKebab(value) {
  return normalize(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeProjectToken(value) {
  return normalize(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitHeaderSegments(header) {
  return normalize(header)
    .split(/\s+-\s+/)
    .map((part) => part.replace(/\(SHT\s*\d+\)/gi, " ").trim())
    .filter(Boolean);
}

function makeHeaderMatchIndex(manifest) {
  const byHeader = new Map();
  const assignments = Object.values(manifest.assignments ?? {});

  for (const assignment of assignments) {
    const sheetNameToken = normalizeMatch(assignment.sheetName);
    const slugToken = normalizeMatch(String(assignment.sheetSlug ?? "").replace(/[-_]+/g, " "));

    for (const header of manifest.__labelHeaders ?? []) {
      const segments = splitHeaderSegments(header);
      const targetParts = segments.length > 0 ? segments : [header];
      const matched = targetParts.some((segment) => {
        const segmentToken = normalizeMatch(segment);
        if (!segmentToken) return false;
        if (sheetNameToken && (segmentToken === sheetNameToken || segmentToken.includes(sheetNameToken))) return true;
        if (slugToken && (segmentToken === slugToken || segmentToken.includes(slugToken))) return true;
        return false;
      });

      if (!matched) continue;

      const list = byHeader.get(header) ?? [];
      list.push(String(assignment.sheetSlug));
      byHeader.set(header, list);
    }
  }

  return byHeader;
}

function explodeLabelTokens(rawValue) {
  const value = normalize(rawValue);
  if (!value) return [];
  return value
    .split(/[\s,;:/]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function extractDevicePrefix(token) {
  const upper = normalize(token).toUpperCase();
  if (!upper) return null;
  const match = upper.match(/^([A-Z]{1,5})\d/);
  if (match) return match[1];
  return null;
}

function computeMedian(sortedAsc) {
  const n = sortedAsc.length;
  if (n === 0) return null;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sortedAsc[mid - 1] + sortedAsc[mid]) / 2 : sortedAsc[mid];
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

async function listProjectIds() {
  const dirents = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true }).catch(() => []);
  return dirents.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

function derivePdNumbersFromProjectIds(projectIds) {
  const pdNumbers = new Set();
  for (const projectId of projectIds) {
    const normalized = normalize(projectId);
    if (!normalized) continue;
    const [pdPart] = normalized.split("/");
    const pd = normalize(pdPart).toUpperCase();
    if (pd) pdNumbers.add(pd);
  }
  return pdNumbers;
}

function buildPdBrandSchemaPayloads(entries, externalEntries, pdNumbers, generatedAt) {
  const payloads = new Map();

  for (const pdNumber of pdNumbers) {
    const byAssignmentKey = new Map();

    const getAssignmentBucket = (unitType, assignmentName) => {
      const key = `${unitType}||${assignmentName}`;
      if (!byAssignmentKey.has(key)) {
        byAssignmentKey.set(key, {
          unitType,
          assignment: assignmentName,
          brandingLengths: [],
          brandingMeasurements: [],
        });
      }
      return byAssignmentKey.get(key);
    };

    for (const entry of entries) {
      if (!Array.isArray(entry.projectIds) || !entry.projectIds.some((projectId) => normalize(projectId).toUpperCase().startsWith(`${pdNumber}/`))) {
        continue;
      }

      const bucket = getAssignmentBucket(entry.unitType, entry.assignment);
      bucket.brandingLengths.push({
        devicePrefix: entry.devicePrefix,
        gaugeSize: entry.gaugeSize,
        wireId: entry.wireId,
        minLength: entry.minLength,
        minLengthProjectCount: entry.minLengthProjectCount,
        maxLength: entry.maxLength,
        maxLengthProjectCount: entry.maxLengthProjectCount,
        medianLength: entry.medianLength,
        mediumLength: entry.mediumLength,
        sampleCount: entry.sampleCount,
        projectCount: entry.projectCount,
      });
    }

    for (const entry of externalEntries) {
      if (!Array.isArray(entry.projectIds) || !entry.projectIds.some((projectId) => normalize(projectId).toUpperCase().startsWith(`${pdNumber}/`))) {
        continue;
      }

      const bucket = getAssignmentBucket(entry.unitType, entry.assignment);
      let locationBucket = bucket.brandingMeasurements.find((item) => normalizeMatch(item.location) === normalizeMatch(entry.location));
      if (!locationBucket) {
        locationBucket = {
          location: entry.location,
          brandingLengths: [],
        };
        bucket.brandingMeasurements.push(locationBucket);
      }

      locationBucket.brandingLengths.push({
        devicePrefix: entry.devicePrefix,
        gaugeSize: entry.gaugeSize,
        wireId: entry.wireId,
        minLength: entry.minLength,
        minLengthProjectCount: entry.minLengthProjectCount,
        maxLength: entry.maxLength,
        maxLengthProjectCount: entry.maxLengthProjectCount,
        medianLength: entry.medianLength,
        mediumLength: entry.mediumLength,
        sampleCount: entry.sampleCount,
        projectCount: entry.projectCount,
      });
    }

    const assignments = Array.from(byAssignmentKey.values())
      .map((assignment) => ({
        unitType: assignment.unitType,
        assignment: assignment.assignment,
        brandingLengths: assignment.brandingLengths.sort((a, b) => {
          if (a.devicePrefix !== b.devicePrefix) return a.devicePrefix.localeCompare(b.devicePrefix);
          const ga = parseFloat(a.gaugeSize) || 0;
          const gb = parseFloat(b.gaugeSize) || 0;
          if (ga !== gb) return ga - gb;
          return a.wireId.localeCompare(b.wireId);
        }),
        brandingMeasurements: assignment.brandingMeasurements
          .map((locationEntry) => ({
            location: locationEntry.location,
            brandingLengths: locationEntry.brandingLengths.sort((a, b) => {
              if (a.devicePrefix !== b.devicePrefix) return a.devicePrefix.localeCompare(b.devicePrefix);
              const ga = parseFloat(a.gaugeSize) || 0;
              const gb = parseFloat(b.gaugeSize) || 0;
              if (ga !== gb) return ga - gb;
              return a.wireId.localeCompare(b.wireId);
            }),
          }))
          .sort((a, b) => normalizeMatch(a.location).localeCompare(normalizeMatch(b.location))),
      }))
      .sort((a, b) => {
        if (a.unitType !== b.unitType) return a.unitType.localeCompare(b.unitType);
        return normalizeMatch(a.assignment).localeCompare(normalizeMatch(b.assignment));
      });

    payloads.set(pdNumber, {
      schemaVersion: 1,
      generatedAt,
      pdNumber,
      source: "sync-branding-label-reference",
      assignmentCount: assignments.length,
      assignments,
    });
  }

  return payloads;
}

async function writeBrandListSchemas(pdPayloads, dryRun) {
  let writtenCount = 0;

  for (const [pdNumber, payload] of pdPayloads.entries()) {
    const pdDir = path.join(BRAND_LIST_ROOT, pdNumber);
    const assignmentSchemaPath = path.join(pdDir, "branding-lengths.schema.json");
    const externalSchemaPath = path.join(pdDir, "branding-measurements.schema.json");

    if (!dryRun) {
      await fs.mkdir(pdDir, { recursive: true });
    }

    await writeJson(assignmentSchemaPath, {
      schemaVersion: payload.schemaVersion,
      generatedAt: payload.generatedAt,
      pdNumber: payload.pdNumber,
      source: payload.source,
      assignmentCount: payload.assignmentCount,
      assignments: payload.assignments.map((assignment) => ({
        unitType: assignment.unitType,
        assignment: assignment.assignment,
        brandingLengths: assignment.brandingLengths,
      })),
    }, dryRun);

    await writeJson(externalSchemaPath, {
      schemaVersion: payload.schemaVersion,
      generatedAt: payload.generatedAt,
      pdNumber: payload.pdNumber,
      source: payload.source,
      assignmentCount: payload.assignmentCount,
      assignments: payload.assignments.map((assignment) => ({
        unitType: assignment.unitType,
        assignment: assignment.assignment,
        brandingMeasurements: assignment.brandingMeasurements,
      })),
    }, dryRun);

    writtenCount += 2;
  }

  return writtenCount;
}

function deriveMergedCandidatesFromPrebuildReport(report) {
  const workbookReady = Array.isArray(report?.details?.workbookReady) ? report.details.workbookReady : [];
  const candidates = [];

  for (const row of workbookReady) {
    const brandListFiles = Array.isArray(row?.brandListFiles) ? row.brandListFiles : [];
    if (brandListFiles.length === 0) continue;

    const pdNumber = normalize(String(row?.pdNumber ?? ""));
    if (!pdNumber) continue;

    const projectNames = Array.isArray(row?.projectNames)
      ? row.projectNames.map((name) => normalize(String(name))).filter(Boolean)
      : [];

    candidates.push({
      pdNumber,
      projectNames,
      brandListFiles,
    });
  }

  return candidates;
}

function resolveMergedProjectIds(candidates, availableProjectIds) {
  const available = new Set(availableProjectIds);
  const resolved = new Set();

  const availableMeta = availableProjectIds.map((projectId) => {
    const dirToken = normalizeProjectToken(projectId.replace(/[_-]+/g, " "));
    return {
      projectId,
      dirToken,
      kebabToken: toLowerKebab(projectId),
    };
  });

  for (const candidate of candidates) {
    const pd = normalize(candidate.pdNumber).toUpperCase();
    const pdToken = normalizeProjectToken(pd);
    const names = Array.isArray(candidate.projectNames) && candidate.projectNames.length > 0
      ? candidate.projectNames
      : [""];

    for (const name of names) {
      const nameToken = normalizeProjectToken(name);
      const underscoreCandidate = `${pd}_${normalize(name).replace(/[^A-Za-z0-9]+/g, "_")}`.replace(/_+/g, "_");
      const hyphenCandidate = `${toLowerKebab(pd)}-${toLowerKebab(name)}`.replace(/-+/g, "-");

      if (available.has(underscoreCandidate)) {
        resolved.add(underscoreCandidate);
      }

      if (available.has(hyphenCandidate)) {
        resolved.add(hyphenCandidate);
      }

      for (const entry of availableMeta) {
        if (!entry.dirToken.startsWith(pdToken)) continue;
        if (!nameToken) {
          resolved.add(entry.projectId);
          continue;
        }

        if (entry.dirToken.includes(nameToken)) {
          resolved.add(entry.projectId);
          continue;
        }

        const collapsedNameToken = nameToken.replace(/\s+/g, "");
        if (collapsedNameToken && entry.dirToken.replace(/\s+/g, "").includes(collapsedNameToken)) {
          resolved.add(entry.projectId);
        }
      }
    }
  }

  return Array.from(resolved).sort((a, b) => a.localeCompare(b));
}

function buildProjectLabelBuckets(manifest, whiteSheet, blueSheet) {
  const assignments = manifest.assignments ?? {};
  const byAssignment = {};

  for (const slug of Object.keys(assignments)) {
    byAssignment[slug] = { white: new Set(), blue: new Set() };
  }

  const whiteHeaders = Array.isArray(whiteSheet?.headers) ? whiteSheet.headers : [];
  const blueHeaders = Array.isArray(blueSheet?.headers) ? blueSheet.headers : [];
  manifest.__labelHeaders = Array.from(new Set([...whiteHeaders, ...blueHeaders]));
  const headerMatchIndex = makeHeaderMatchIndex(manifest);
  delete manifest.__labelHeaders;

  const ingest = (sheet, bucketKey) => {
    if (!sheet || !Array.isArray(sheet.rawRows)) return;
    for (const row of sheet.rawRows) {
      for (const [header, slugs] of headerMatchIndex.entries()) {
        const cellValue = normalize(row?.[header]);
        if (!cellValue) continue;
        for (const slug of slugs) {
          const bucket = byAssignment[slug];
          if (!bucket) continue;
          bucket[bucketKey].add(cellValue);
        }
      }
    }
  };

  ingest(whiteSheet, "white");
  ingest(blueSheet, "blue");

  const allWhite = new Set();
  const allBlue = new Set();

  for (const [slug, assignment] of Object.entries(assignments)) {
    const bucket = byAssignment[slug] ?? { white: new Set(), blue: new Set() };
    assignment.whiteLabels = Array.from(bucket.white).sort((a, b) => a.localeCompare(b));
    assignment.blueLabels = Array.from(bucket.blue).sort((a, b) => a.localeCompare(b));
    assignment.externalLocations = Array.isArray(assignment.externalLocations) ? assignment.externalLocations : [];

    for (const item of assignment.whiteLabels) allWhite.add(item);
    for (const item of assignment.blueLabels) allBlue.add(item);
  }

  manifest.whiteLabels = Array.from(allWhite).sort((a, b) => a.localeCompare(b));
  manifest.blueLabels = Array.from(allBlue).sort((a, b) => a.localeCompare(b));
  manifest.brandingLabelReference = {
    byAssignment: Object.fromEntries(
      Object.entries(assignments).map(([slug, assignment]) => [
        slug,
        {
          assignmentName: assignment.sheetName,
          whiteLabels: assignment.whiteLabels ?? [],
          blueLabels: assignment.blueLabels ?? [],
        },
      ]),
    ),
    whiteLabels: manifest.whiteLabels,
    blueLabels: manifest.blueLabels,
    joinHints: {
      sourceSheets: ["white-labels", "blue-labels"],
      matchingStrategy: "reference-sheet-header-to-assignment-name",
      generatedAt: new Date().toISOString(),
    },
  };
}

async function accumulateWireBrandStats(statsMap, externalStatsMap, projectStateRoot, manifest, projectId) {
  const brandListDir = path.join(projectStateRoot, "wire-brand-list");
  let dirents;
  try {
    dirents = await fs.readdir(brandListDir, { withFileTypes: true });
  } catch {
    return;
  }

  const assignmentsBySlug = manifest.assignments ?? {};

  for (const dirent of dirents) {
    if (!dirent.isFile() || !dirent.name.endsWith(".json")) continue;
    const slug = dirent.name.replace(/\.json$/, "");
    const brandData = await readJson(path.join(brandListDir, dirent.name));
    if (!brandData) continue;

    const assignment = assignmentsBySlug[slug];
    const rawUnitType = normalize(assignment?.unitType) || "UNASSIGNED";
    // TURBINE is a product type, not a physical enclosure — its panels belong to JB70.
    const unitType = rawUnitType === "TURBINE" ? "JB70" : rawUnitType;
    const assignmentName = normalize(assignment?.sheetName) || slug;

    const prefixGroups = Array.isArray(brandData.prefixGroups)
      ? brandData.prefixGroups
      : Object.values(brandData.prefixGroups ?? {});

    for (const group of prefixGroups) {
      const devicePrefix = normalize(group.prefix) || "UNKNOWN";
      for (const bundle of group.bundles ?? []) {
        for (const row of bundle.rows ?? []) {
          const gaugeSize = normalize(row.gaugeSize);
          const wireId = normalize(row.wireId);
          const toLocation = normalize(row.toLocation || bundle.toLocation);
          const length = typeof row.length === "number" ? row.length : parseFloat(row.length);
          if (!gaugeSize || !wireId || !Number.isFinite(length) || length <= 0) continue;

          const key = `${unitType}||${assignmentName}||${devicePrefix}||${gaugeSize}||${wireId}`;
          const entry = statsMap.get(key) ?? {
            unitType,
            assignment: assignmentName,
            devicePrefix,
            gaugeSize,
            wireId,
            allLengths: [],           // all individual length observations across all projects
            projectLengths: new Map(), // projectId -> number[] (lengths from that project)
            projects: new Set(),
          };

          entry.allLengths.push(length);
          const pArr = entry.projectLengths.get(projectId) ?? [];
          pArr.push(length);
          entry.projectLengths.set(projectId, pArr);
          entry.projects.add(projectId);
          statsMap.set(key, entry);

          if (toLocation) {
            const externalKey = `${unitType}||${assignmentName}||${toLocation}||${devicePrefix}||${gaugeSize}||${wireId}`;
            const externalEntry = externalStatsMap.get(externalKey) ?? {
              unitType,
              assignment: assignmentName,
              location: toLocation,
              devicePrefix,
              gaugeSize,
              wireId,
              allLengths: [],
              projectLengths: new Map(),
              projects: new Set(),
            };

            externalEntry.allLengths.push(length);
            const extProjectLengths = externalEntry.projectLengths.get(projectId) ?? [];
            extProjectLengths.push(length);
            externalEntry.projectLengths.set(projectId, extProjectLengths);
            externalEntry.projects.add(projectId);
            externalStatsMap.set(externalKey, externalEntry);
          }
        }
      }
    }
  }
}

/**
 * Resolves all Legal Drawings project folders that have a wire-brand-list.
 * Returns an array of { pdNumber, revision, stateRoot } objects.
 * Uses latest.json's latestRevision field; falls back to the last sorted subdirectory.
 * @param {string|null} pdFilter - Only include this PD number (scoped mode).
 * @param {string|null} revisionFilter - Only include this revision (requires pdFilter).
 * @param {Set<string>|null} eligiblePdNumbers - Normalized PD tokens to allow; null = no filter.
 */
async function listLegalDrawingBrandSources(pdFilter, revisionFilter, eligiblePdNumbers = null) {
  const dirents = await fs.readdir(LEGAL_DRAWINGS_ROOT, { withFileTypes: true }).catch(() => []);
  const sources = [];

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;
    if (pdFilter && normalizeProjectToken(dirent.name) !== normalizeProjectToken(pdFilter)) continue;
    if (eligiblePdNumbers && !eligiblePdNumbers.has(normalizeProjectToken(dirent.name))) continue;
    const pdDir = path.join(LEGAL_DRAWINGS_ROOT, dirent.name);

    // Resolve revision folder via latest.json or last sorted subdirectory
    let revisionDir = null;
    if (revisionFilter) {
      const candidate = path.join(pdDir, normalize(revisionFilter));
      const stat = await fs.stat(candidate).catch(() => null);
      if (stat?.isDirectory()) revisionDir = candidate;
    }

    const latestMeta = await readJson(path.join(pdDir, "latest.json"));
    if (!revisionDir && latestMeta?.latestRevision) {
      const candidate = path.join(pdDir, normalize(latestMeta.latestRevision));
      const stat = await fs.stat(candidate).catch(() => null);
      if (stat?.isDirectory()) revisionDir = candidate;
    }

    if (!revisionDir) {
      const children = await fs.readdir(pdDir, { withFileTypes: true }).catch(() => []);
      const subDirs = children
        .filter((c) => c.isDirectory())
        .map((c) => c.name)
        .sort();
      if (subDirs.length > 0) revisionDir = path.join(pdDir, subDirs[subDirs.length - 1]);
    }

    if (!revisionDir) continue;

    const brandListDir = path.join(revisionDir, "wire-brand-list");
    const brandDirStat = await fs.stat(brandListDir).catch(() => null);
    if (!brandDirStat?.isDirectory()) continue;

    const brandFiles = await fs.readdir(brandListDir).catch(() => []);
    if (!brandFiles.some((f) => f.endsWith(".json"))) continue;

    const manifestPath = path.join(revisionDir, "project-manifest.json");
    sources.push({
      pdNumber: dirent.name,
      revision: path.basename(revisionDir),
      stateRoot: revisionDir,
      manifestPath,
    });
  }

  return sources;
}

async function run() {
  const generatedAt = new Date().toISOString();
  const dryRun = Boolean(values["dry-run"]);
  const explicitProject = normalize(values.project);
  const explicitPd = normalize(values.pd);
  const explicitRevision = normalize(values.revision);
  if (explicitRevision && !explicitPd) {
    throw new Error("The --revision option requires --pd so legal source filtering is unambiguous.");
  }
  const prebuildReportPath = normalize(values["prebuild-report"]) || DEFAULT_PREBUILD_REPORT_PATH;

  const availableProjectIds = await listProjectIds();
  let projectIds = [];
  let mergedProjectIds = [];
  // Set of normalized PD tokens that have both a brand list and an automerged project folder.
  // null means no filter (explicit --pd or --project scoped mode).
  let eligiblePdNumbers = null;

  if (explicitProject) {
    projectIds = [explicitProject];
  } else if (explicitPd) {
    // Scoped legal comparison mode: skip merged Share/Projects scan unless --project is explicitly provided
    projectIds = [];
  } else {
    const prebuildReport = await readJson(prebuildReportPath);
    const mergedCandidates = deriveMergedCandidatesFromPrebuildReport(prebuildReport);
    mergedProjectIds = resolveMergedProjectIds(mergedCandidates, availableProjectIds);
    projectIds = mergedProjectIds;

    // Build eligible PD set: candidates already have brand list (deriveMergedCandidatesFromPrebuildReport
    // filters to brandListFiles.length > 0). Now additionally require a resolved automerged project folder.
    eligiblePdNumbers = new Set();
    for (const candidate of mergedCandidates) {
      const pdToken = normalizeProjectToken(candidate.pdNumber);
      const isAutomerged = mergedProjectIds.some((id) => normalizeProjectToken(id).startsWith(pdToken));
      if (isAutomerged) {
        eligiblePdNumbers.add(pdToken);
      }
    }
  }

  if (projectIds.length === 0 && !explicitPd) {
    throw new Error(
      explicitProject
        ? `No projects found for --project=${explicitProject}`
        : `No merged projects were resolved from prebuild report: ${prebuildReportPath}`,
    );
  }

  const stats = new Map();
  const externalStats = new Map();
  let projectManifestCount = 0;
  let legalManifestCount = 0;
  let legalDrawingCount = 0;

  // --- Scan Share/Legal Drawings first (authoritative source) ---
  // Legal manifests are the primary generated source. Update their label buckets first,
  // then use them as the measurement source of truth for reference stats.
  const legalSources = await listLegalDrawingBrandSources(explicitPd, explicitRevision, eligiblePdNumbers);
  for (const source of legalSources) {
    const projectId = `${source.pdNumber}/${source.revision}`;
    const manifest = await readJson(source.manifestPath);
    if (!manifest || !manifest.assignments) continue;

    const whiteSheet = await readJson(path.join(source.stateRoot, "sheets", "white-labels.json"));
    const blueSheet = await readJson(path.join(source.stateRoot, "sheets", "blue-labels.json"));

    buildProjectLabelBuckets(manifest, whiteSheet, blueSheet);
    await writeJson(source.manifestPath, manifest, dryRun);
    legalManifestCount += 1;

    await accumulateWireBrandStats(stats, externalStats, source.stateRoot, manifest, projectId);
    legalDrawingCount += 1;
  }

  // --- Scan Share/Projects second (downstream copies) ---
  // Keep project-level label buckets in sync after legal manifests are updated.
  for (const projectId of projectIds) {
    const projectStateRoot = path.join(PROJECTS_ROOT, projectId, "state");
    const manifestPath = path.join(projectStateRoot, "project-manifest.json");
    const manifest = await readJson(manifestPath);
    if (!manifest || !manifest.assignments) continue;

    const whiteSheet = await readJson(path.join(projectStateRoot, "sheets", "white-labels.json"));
    const blueSheet = await readJson(path.join(projectStateRoot, "sheets", "blue-labels.json"));

    buildProjectLabelBuckets(manifest, whiteSheet, blueSheet);
    await writeJson(manifestPath, manifest, dryRun);
    projectManifestCount += 1;
  }

  const reference = await readJson(REFERENCE_PATH);
  if (!reference || typeof reference !== "object") {
    throw new Error(`Reference file missing or invalid: ${REFERENCE_PATH}`);
  }

  const entries = Array.from(stats.values())
    .filter((entry) => entry.allLengths.length > 0)
    .map((entry) => {
      const sorted = [...entry.allLengths].sort((a, b) => a - b);
      const minLength = sorted[0];
      const maxLength = sorted[sorted.length - 1];
      const medianLength = computeMedian(sorted);

      let minLengthProjectCount = 0;
      let maxLengthProjectCount = 0;
      for (const pLengths of entry.projectLengths.values()) {
        if (pLengths.some((l) => l === minLength)) minLengthProjectCount += 1;
        if (pLengths.some((l) => l === maxLength)) maxLengthProjectCount += 1;
      }

      return {
        unitType: entry.unitType,
        assignment: entry.assignment,
        devicePrefix: entry.devicePrefix,
        gaugeSize: entry.gaugeSize,
        wireId: entry.wireId,
        minLength,
        minLengthProjectCount,
        maxLength,
        maxLengthProjectCount,
        medianLength,
        mediumLength: medianLength,
        sampleCount: entry.allLengths.length,
        projectCount: entry.projects.size,
        projectIds: Array.from(entry.projects).sort((a, b) => a.localeCompare(b)),
      };
    })
    .sort((a, b) => {
      if (a.unitType !== b.unitType) return a.unitType.localeCompare(b.unitType);
      if (a.assignment !== b.assignment) return a.assignment.localeCompare(b.assignment);
      if (a.devicePrefix !== b.devicePrefix) return a.devicePrefix.localeCompare(b.devicePrefix);
      const ga = parseFloat(a.gaugeSize) || 0;
      const gb = parseFloat(b.gaugeSize) || 0;
      if (ga !== gb) return ga - gb;
      return a.wireId.localeCompare(b.wireId);
    });

  const externalEntries = Array.from(externalStats.values())
    .filter((entry) => entry.allLengths.length > 0)
    .map((entry) => {
      const sorted = [...entry.allLengths].sort((a, b) => a - b);
      const minLength = sorted[0];
      const maxLength = sorted[sorted.length - 1];
      const medianLength = computeMedian(sorted);

      let minLengthProjectCount = 0;
      let maxLengthProjectCount = 0;
      for (const pLengths of entry.projectLengths.values()) {
        if (pLengths.some((l) => l === minLength)) minLengthProjectCount += 1;
        if (pLengths.some((l) => l === maxLength)) maxLengthProjectCount += 1;
      }

      return {
        unitType: entry.unitType,
        assignment: entry.assignment,
        location: entry.location,
        devicePrefix: entry.devicePrefix,
        gaugeSize: entry.gaugeSize,
        wireId: entry.wireId,
        minLength,
        minLengthProjectCount,
        maxLength,
        maxLengthProjectCount,
        medianLength,
        mediumLength: medianLength,
        sampleCount: entry.allLengths.length,
        projectCount: entry.projects.size,
        projectIds: Array.from(entry.projects).sort((a, b) => a.localeCompare(b)),
      };
    })
    .sort((a, b) => {
      if (a.unitType !== b.unitType) return a.unitType.localeCompare(b.unitType);
      if (a.assignment !== b.assignment) return a.assignment.localeCompare(b.assignment);
      if (a.location !== b.location) return a.location.localeCompare(b.location);
      if (a.devicePrefix !== b.devicePrefix) return a.devicePrefix.localeCompare(b.devicePrefix);
      const ga = parseFloat(a.gaugeSize) || 0;
      const gb = parseFloat(b.gaugeSize) || 0;
      if (ga !== gb) return ga - gb;
      return a.wireId.localeCompare(b.wireId);
    });

  // Build a two-level index: unitType → assignmentName → BrandingLengthEntry[]
  // Used to merge brandingLengths into unitTypeToBoxNumber assignments in-place.
  const brandingIndex = new Map();
  for (const entry of entries) {
    const unitKey = entry.unitType;
    const assignKey = entry.assignment;
    if (!brandingIndex.has(unitKey)) brandingIndex.set(unitKey, new Map());
    const assignMap = brandingIndex.get(unitKey);
    if (!assignMap.has(assignKey)) assignMap.set(assignKey, []);
    assignMap.get(assignKey).push({
      devicePrefix: entry.devicePrefix,
      gaugeSize: entry.gaugeSize,
      wireId: entry.wireId,
      minLength: entry.minLength,
      minLengthProjectCount: entry.minLengthProjectCount,
      maxLength: entry.maxLength,
      maxLengthProjectCount: entry.maxLengthProjectCount,
      medianLength: entry.medianLength,
      sampleCount: entry.sampleCount,
      projectCount: entry.projectCount,
    });
  }

  // Build a three-level index: unitType -> assignmentName -> location -> BrandingLengthEntry[]
  // Used to enrich each external location with detailed min/max/median measurement ranges.
  const externalBrandingIndex = new Map();
  for (const entry of externalEntries) {
    const unitKey = entry.unitType;
    const assignmentKey = entry.assignment;
    const locationKey = entry.location;

    if (!externalBrandingIndex.has(unitKey)) externalBrandingIndex.set(unitKey, new Map());
    const assignmentMap = externalBrandingIndex.get(unitKey);
    if (!assignmentMap.has(assignmentKey)) assignmentMap.set(assignmentKey, new Map());
    const locationMap = assignmentMap.get(assignmentKey);
    if (!locationMap.has(locationKey)) locationMap.set(locationKey, []);

    locationMap.get(locationKey).push({
      devicePrefix: entry.devicePrefix,
      gaugeSize: entry.gaugeSize,
      wireId: entry.wireId,
      minLength: entry.minLength,
      minLengthProjectCount: entry.minLengthProjectCount,
      maxLength: entry.maxLength,
      maxLengthProjectCount: entry.maxLengthProjectCount,
      medianLength: entry.medianLength,
      mediumLength: entry.mediumLength,
      sampleCount: entry.sampleCount,
      projectCount: entry.projectCount,
    });
  }

  // Merge brandingLengths into each assignment inside mappings.unitTypeToBoxNumber
  let mergedAssignmentCount = 0;
  const ubnMappings = Array.isArray(reference.mappings?.unitTypeToBoxNumber)
    ? reference.mappings.unitTypeToBoxNumber
    : [];

  for (const mapping of ubnMappings) {
    const unitMap = brandingIndex.get(normalize(mapping.unitType));
    if (!unitMap) continue;
    for (const assignment of mapping.assignments ?? []) {
      const assignmentName = normalize(assignment.value);
      // Try exact match first, then a normalizedMatch fallback
      const lengths = getBestMapMatch(unitMap, assignmentName);

      if (lengths?.length) {
        // Store detailed per-wire measurements
        assignment.brandingLengths = lengths.map((entry) => ({
          devicePrefix: entry.devicePrefix,
          gaugeSize: entry.gaugeSize,
          wireId: entry.wireId,
          minLength: entry.minLength,
          minLengthProjectCount: entry.minLengthProjectCount,
          maxLength: entry.maxLength,
          maxLengthProjectCount: entry.maxLengthProjectCount,
          medianLength: entry.medianLength,
          mediumLength: entry.medianLength,
          sampleCount: entry.sampleCount,
          projectCount: entry.projectCount,
        }));

        mergedAssignmentCount += 1;
      } else {
        // No branding data — clear detailed field
        assignment.brandingLengths = undefined;
      }

      const externalUnitMap = externalBrandingIndex.get(normalize(mapping.unitType));
      const externalAssignmentMap = externalUnitMap
        ? getBestMapMatch(externalUnitMap, assignmentName)
        : null;

      const normalizedExternalLocations = Array.isArray(assignment.externalLocations)
        ? assignment.externalLocations
            .map((item) => {
              if (typeof item === "string") {
                const loc = normalize(item);
                return loc ? { location: loc, wireListVisible: true, brandingVisible: true } : null;
              }
              if (!item || typeof item !== "object") return null;
              const loc = normalize(item.location);
              if (!loc) return null;
              return {
                ...item,
                location: loc,
                wireListVisible: item.wireListVisible ?? true,
                brandingVisible: item.brandingVisible ?? true,
              };
            })
            .filter((item) => Boolean(item))
        : [];

      const externalLocationBrandingLengths = [];
      assignment.externalLocations = normalizedExternalLocations.map((locationEntry) => {
        const locationName = normalize(locationEntry.location);
        const matchedLengths = externalAssignmentMap
          ? getBestMapMatch(externalAssignmentMap, locationName)
          : null;

        if (!matchedLengths?.length) {
          return {
            ...locationEntry,
            brandingLengths: undefined,
          };
        }

        const brandingLengths = matchedLengths.map((entry) => ({
          devicePrefix: entry.devicePrefix,
          gaugeSize: entry.gaugeSize,
          wireId: entry.wireId,
          minLength: entry.minLength,
          minLengthProjectCount: entry.minLengthProjectCount,
          maxLength: entry.maxLength,
          maxLengthProjectCount: entry.maxLengthProjectCount,
          medianLength: entry.medianLength,
          mediumLength: entry.mediumLength,
          sampleCount: entry.sampleCount,
          projectCount: entry.projectCount,
        }));

        externalLocationBrandingLengths.push({
          location: locationName,
          brandingLengths,
        });

        return {
          ...locationEntry,
          brandingLengths,
        };
      });

      // Always expose assignment-level external location measurements, even if
      // `externalLocations` is empty or missing in the reference assignment.
      if (externalAssignmentMap) {
        for (const [locationName, matchedLengths] of externalAssignmentMap.entries()) {
          if (!Array.isArray(matchedLengths) || matchedLengths.length === 0) continue;
          if (externalLocationBrandingLengths.some((entry) => normalizeMatch(entry.location) === normalizeMatch(locationName))) {
            continue;
          }

          externalLocationBrandingLengths.push({
            location: locationName,
            brandingLengths: matchedLengths.map((entry) => ({
              devicePrefix: entry.devicePrefix,
              gaugeSize: entry.gaugeSize,
              wireId: entry.wireId,
              minLength: entry.minLength,
              minLengthProjectCount: entry.minLengthProjectCount,
              maxLength: entry.maxLength,
              maxLengthProjectCount: entry.maxLengthProjectCount,
              medianLength: entry.medianLength,
              mediumLength: entry.mediumLength,
              sampleCount: entry.sampleCount,
              projectCount: entry.projectCount,
            })),
          });
        }
      }

      const brandingMeasurements = externalLocationBrandingLengths.length
        ? externalLocationBrandingLengths
        : undefined;

      assignment.brandingMeasurements = brandingMeasurements;
      // Keep a lowercase alias for legacy consumers expecting non-camel-cased keys.
      assignment.brandingmeasurements = brandingMeasurements;
      // Backward compatibility with prior field name.
      assignment.externalLocationBrandingLengths = brandingMeasurements;
    }
  }

  await writeJson(REFERENCE_PATH, reference, dryRun);

  const pdNumbersFromStats = new Set([
    ...derivePdNumbersFromProjectIds(entries.flatMap((entry) => entry.projectIds ?? [])),
    ...derivePdNumbersFromProjectIds(externalEntries.flatMap((entry) => entry.projectIds ?? [])),
  ]);
  const pdSchemaPayloads = buildPdBrandSchemaPayloads(entries, externalEntries, pdNumbersFromStats, generatedAt);
  const brandListSchemaFileCount = await writeBrandListSchemas(pdSchemaPayloads, dryRun);

  console.log(`[branding-reference] legal manifests processed: ${legalManifestCount}`);
  console.log(`[branding-reference] project manifests processed: ${projectManifestCount}`);
  console.log(`[branding-reference] legal drawings scanned: ${legalDrawingCount}`);
  console.log(`[branding-reference] reference entries: ${entries.length}`);
  console.log(`[branding-reference] external location entries: ${externalEntries.length}`);
  console.log(`[branding-reference] assignments enriched with branding lengths: ${mergedAssignmentCount}`);
  console.log(`[branding-reference] brand list schema files written: ${brandListSchemaFileCount}`);
  if (!explicitProject) {
    console.log(`[branding-reference] merged projects: ${projectIds.length}`);
    console.log(`[branding-reference] merged project ids: ${projectIds.join(", ")}`);
  }
  if (dryRun) {
    console.log("[branding-reference] dry-run enabled; no files written");
  }
}

run().catch((error) => {
  console.error(`[branding-reference] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
