#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, "..");
const LEGAL_ROOT =
  process.env.LEGAL_DRAWINGS_ROOT ||
  path.join(APP_ROOT, "Share", "Legal Drawings");
const API_BASE_URL = process.env.LEGAL_DRAWINGS_API_BASE_URL || "http://localhost:3000";
const SCHEDULE_CSV_PATH = path.join(APP_ROOT, "Share", "Schedule", "Schedule.csv");
const PRIORITY_LIST_JSON_PATH = path.join(APP_ROOT, "Share", "Schedule", "priority-list.json");
const PROJECTS_ROOT = path.join(APP_ROOT, "Share", "Projects");
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_PD = getArgValue("--pd");
const ONLY_REV = getArgValue("--rev");

const WORKBOOK_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xls"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

function isGreenChangesWorkbookFileName(fileName) {
  return /ucp/i.test(fileName) && /compare/i.test(fileName) && /\.(xlsx|xlsm|xls|xlsb|csv)$/i.test(fileName);
}

function extractRevisionCandidates(normalizedStem) {
  const patterns = [
    /\b([A-Z]\.\d+(?:\s*M\.\d+)?)\b/gi,
    /\b([A-Z]\d+(?:\s*M\.\d+)?)\b/gi,
    /\b(R\d+(?:\.\d+)*)\b/gi,
    /\b(\d+\.\d+(?:\s*M\.\d+)?)\b/gi,
  ];

  const values = [];
  for (const pattern of patterns) {
    for (const match of normalizedStem.matchAll(pattern)) {
      if (match?.[1]) {
        values.push(match[1]);
      }
    }
  }

  return values
    .map((value) => value.replace(/\s+/g, "_").trim())
    .filter(Boolean);
}
const EXPECTED_ROOT_FILES = [
  "layout-pages.json",
  "layout-pages.index.json",
  "device-part-numbers.json",
  "upload-props.json",
  "project-manifest.json",
];
const EXPECTED_ROOT_DIRS = ["sheets", "wire-list-print-schema", "wire-brand-list", "wire-list-green-changes"];
let scheduleRowsPromise = null;
let priorityRowsPromise = null;
let projectManifestsPromise = null;

async function main() {
  const startedAt = new Date().toISOString();
  const pdEntries = await listLegalProjects();
  const selected = ONLY_PD
    ? pdEntries.filter((entry) => entry.name.toLowerCase() === ONLY_PD.toLowerCase())
    : pdEntries;

  const summaries = [];

  for (const entry of selected) {
    const summary = await processPdFolder(entry);
    summaries.push(summary);
  }

  const runSummary = {
    startedAt,
    completedAt: new Date().toISOString(),
    legalRoot: LEGAL_ROOT,
    apiBaseUrl: API_BASE_URL,
    dryRun: DRY_RUN,
    processedCount: summaries.length,
    projects: summaries,
  };

  const outputPath = path.join(LEGAL_ROOT, "legal-drawings-build-run.json");
  if (!DRY_RUN) {
    await writeJson(outputPath, runSummary);
  }

  process.stdout.write(`${JSON.stringify(runSummary, null, 2)}\n`);
}

async function processPdFolder(entry) {
  const pdNumber = entry.name;
  const pdPath = entry.path;
  const rootFiles = await fs.readdir(pdPath, { withFileTypes: true });
  const existingProjectMeta = await readJsonIfExists(path.join(pdPath, "project-meta.json"));
  const existingLatest = await readJsonIfExists(path.join(pdPath, "latest.json"));
  const explicitRevisionDirs = rootFiles
    .filter((item) => item.isDirectory() && !item.name.startsWith("."))
    .map((item) => item.name)
    .sort(compareRevisionNames);
  const rootDiscoveredRevisions = await discoverRootFileRevisions(pdNumber, pdPath, rootFiles);
  const existingRevisionDiscovered = await discoverExistingRevisionFolders(pdNumber, pdPath, explicitRevisionDirs);
  const discoveredRevisions = mergeDiscoveredRevisions(rootDiscoveredRevisions, existingRevisionDiscovered);
  const discoveredRevisionNames = discoveredRevisions.map((revision) => revision.revision);
  const revisionNames = Array.from(new Set(discoveredRevisionNames))
    .filter((name) => !ONLY_REV || name.toLowerCase() === ONLY_REV.toLowerCase())
    .sort(compareRevisionNames);

  if (!ONLY_REV && !DRY_RUN) {
    await pruneStaleRevisionDirectories(pdPath, explicitRevisionDirs, revisionNames);
  }

  const sourceFiles = await collectSourceFiles(pdPath, rootFiles);
  const latestRevision = revisionNames.at(-1) || null;
  const revisionSummaries = [];
  const latestDiscoveredRevision =
    discoveredRevisions.find((item) => item.revision === latestRevision) || null;
  const latestFingerprint = latestDiscoveredRevision?.fingerprint || null;
  const latestRevisionPath = latestRevision ? path.join(pdPath, latestRevision) : null;
  const latestRevisionRecordPath = latestRevisionPath ? path.join(latestRevisionPath, "revision.json") : null;
  const latestRevisionRecord = latestRevisionRecordPath ? await readJsonIfExists(latestRevisionRecordPath) : null;
  const latestHasUsableArtifacts = latestRevisionPath
    ? await hasUsableGeneratedArtifacts(latestRevisionRecord, latestRevisionPath)
    : false;
  const shouldSkipWholeProject =
    Boolean(latestRevision) &&
    existingLatest?.latestRevision === latestRevision &&
    existingLatest?.sourceFingerprint === latestFingerprint &&
    latestRevisionRecord?.sourceFingerprint === latestFingerprint &&
    latestHasUsableArtifacts;

  for (const revision of revisionNames) {
    const discoveredRevision = discoveredRevisions.find((item) => item.revision === revision) || null;
    const revisionPath = path.join(pdPath, revision);
    const revisionRecordPath = path.join(pdPath, revision, "revision.json");
    const existingRevisionMeta = await readJsonIfExists(revisionRecordPath);
    const revisionHasUsableArtifacts = await hasUsableGeneratedArtifacts(existingRevisionMeta, revisionPath);
    const shouldSkipRevision =
      shouldSkipWholeProject ||
      (Boolean(discoveredRevision?.fingerprint) &&
        existingRevisionMeta?.sourceFingerprint === discoveredRevision.fingerprint &&
        revisionHasUsableArtifacts);
    const revisionSummary = await processRevision({
      pdNumber,
      pdPath,
      revision,
      discoveredRevision,
      shouldSkipRevision,
      existingRevisionMeta,
    });
    revisionSummaries.push(revisionSummary);
  }

  const projectMeta = {
    pdNumber,
    lastRunAt: new Date().toISOString(),
    latestRevision,
    hasWorkbook: Boolean(sourceFiles.workbook || latestDiscoveredRevision?.workbookPath),
    hasLayout: Boolean(sourceFiles.layout || latestDiscoveredRevision?.layoutPath),
    workbookFile: sourceFiles.workbook
      ? path.basename(sourceFiles.workbook)
      : latestDiscoveredRevision?.workbookFileName || null,
    layoutFile: sourceFiles.layout
      ? path.basename(sourceFiles.layout)
      : latestDiscoveredRevision?.layoutFileName || null,
    sourceFingerprint: latestFingerprint,
    skipped: shouldSkipWholeProject,
    revisions: revisionSummaries.map((revision) => ({
      revision: revision.revision,
      lastRunAt: revision.lastRunAt,
      generatedFiles: revision.generatedFiles,
      generatedRelativePaths: revision.generatedRelativePaths,
      generatedDirectories: revision.generatedDirectories,
    })),
  };

  const projectMetaPath = path.join(pdPath, "project-meta.json");
  const latestJsonPath = path.join(pdPath, "latest.json");
  const latestRevisionSummary =
    revisionSummaries.find((revision) => revision.revision === latestRevision) || null;
  const unitHint = latestRevisionSummary?.unitNumber || latestRevisionRecord?.unitNumber || null;
  const scheduleMetadata = await findScheduleMetadata(pdNumber, unitHint);
  const priorityMetadata = await findPriorityMetadata(pdNumber, unitHint);
  const projectManifestMetadata = await findProjectManifestMetadata(pdNumber, unitHint);
  const latestRevisionManifest = latestRevisionPath
    ? await readJsonIfExists(path.join(latestRevisionPath, "project-manifest.json"))
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

  const manifestMapResult = await mapProjectMetadataToRevisionManifests({
    pdPath,
    revisionNames,
    pdNumber: resolvedPdNumber,
    projectName: resolvedProjectName,
    lwcType: resolvedLwcType,
  });

  const latestJson = {
    pdNumber: resolvedPdNumber,
    latestRevision,
    projectName: resolvedProjectName,
    dueDate: scheduleMetadata?.dueDate || null,
    dueMonth: scheduleMetadata?.dueMonth || null,
    planConlayDate: scheduleMetadata?.planConlayDate || null,
    planConassyDate: scheduleMetadata?.planConassyDate || null,
    shipDate: scheduleMetadata?.shipDate || null,
    deptTargetDate: scheduleMetadata?.deptTargetDate || null,
    lwcType: resolvedLwcType,
    color: scheduleMetadata?.color || "",
    daysLate: scheduleMetadata?.daysLate ?? null,
    estimatedTotalHours: scheduleMetadata?.estimatedTotalHours ?? null,
    estimatedPanelCount: scheduleMetadata?.estimatedPanelCount ?? null,
    estimatedSampleCount: scheduleMetadata?.estimatedSampleCount ?? null,
    controlsSlot: scheduleMetadata?.controlsSlot || null,
    pmName: scheduleMetadata?.pmName || null,
    lastRunAt: projectMeta.lastRunAt,
    hasWorkbook: projectMeta.hasWorkbook,
    hasLayout: projectMeta.hasLayout,
    workbookFile: projectMeta.workbookFile,
    layoutFile: projectMeta.layoutFile,
    sourceFingerprint: latestFingerprint,
    skipped: shouldSkipWholeProject,
    generatedFiles: latestRevisionSummary?.generatedFiles || [],
    generatedRelativePaths: latestRevisionSummary?.generatedRelativePaths || [],
    generatedDirectories: latestRevisionSummary?.generatedDirectories || [],
  };
  Object.assign(projectMeta, {
    pdNumber: resolvedPdNumber,
    projectName: resolvedProjectName,
    dueDate: scheduleMetadata?.dueDate || null,
    dueMonth: scheduleMetadata?.dueMonth || null,
    planConlayDate: scheduleMetadata?.planConlayDate || null,
    planConassyDate: scheduleMetadata?.planConassyDate || null,
    shipDate: scheduleMetadata?.shipDate || null,
    deptTargetDate: scheduleMetadata?.deptTargetDate || null,
    lwcType: resolvedLwcType,
    color: scheduleMetadata?.color || "",
    daysLate: scheduleMetadata?.daysLate ?? null,
    estimatedTotalHours: scheduleMetadata?.estimatedTotalHours ?? null,
    estimatedPanelCount: scheduleMetadata?.estimatedPanelCount ?? null,
    estimatedSampleCount: scheduleMetadata?.estimatedSampleCount ?? null,
    controlsSlot: scheduleMetadata?.controlsSlot || null,
    pmName: scheduleMetadata?.pmName || null,
  });
  if (!DRY_RUN) {
    await writeJson(projectMetaPath, projectMeta);
    await writeJson(latestJsonPath, latestJson);
  }

  return {
    pdNumber: resolvedPdNumber,
    latestRevision,
    revisionCount: revisionNames.length,
    manifestFilesUpdated: manifestMapResult.updated,
    manifestFilesScanned: manifestMapResult.scanned,
    projectMetaPath: toPortablePath(projectMetaPath),
    latestJsonPath: toPortablePath(latestJsonPath),
    revisions: revisionSummaries.map((revision) => ({
      revision: revision.revision,
      revisionPath: revision.revisionPath,
      revisionMetaPath: revision.revisionMetaPath,
      lastRunAt: revision.lastRunAt,
      generatedFiles: revision.generatedFiles,
      generatedRelativePaths: revision.generatedRelativePaths,
      generatedDirectories: revision.generatedDirectories,
      revisionWasSkipped: revision.revisionWasSkipped,
    })),
  };
}

async function processRevision({
  pdNumber,
  pdPath,
  revision,
  discoveredRevision,
  shouldSkipRevision,
  existingRevisionMeta,
}) {
  const revisionPath = path.join(pdPath, revision);
  const revisionMetaPath = path.join(revisionPath, "revision.json");

  if (shouldSkipRevision) {
    return {
      revision,
      revisionPath: toPortablePath(revisionPath),
      revisionMetaPath: toPortablePath(revisionMetaPath),
      ...(existingRevisionMeta || {}),
      revisionWasSkipped: true,
      rebuildStatus: existingRevisionMeta?.rebuildStatus || {
        ok: true,
        skipped: true,
        reason: "unchanged-source-fingerprint",
      },
    };
  }

  await seedRevisionSourceFiles(pdNumber, revisionPath, discoveredRevision);
  const rebuildStatus = await triggerRebuild(pdNumber, revision);
  await removeLegacyStateDirectory(revisionPath);
  const existingRevisionRecord = await readJsonIfExists(path.join(revisionPath, "revision.json"));
  const revisionMeta = {
    ...(existingRevisionRecord || {}),
    lastRunAt: new Date().toISOString(),
    generatedFiles: await listPresentFiles(revisionPath, EXPECTED_ROOT_FILES),
    generatedRelativePaths: await listPresentRelativePaths(revisionPath, EXPECTED_ROOT_FILES),
    generatedDirectories: await listNonEmptyDirectories(revisionPath, EXPECTED_ROOT_DIRS),
    sourceFingerprint: discoveredRevision?.fingerprint || null,
    revisionWasSkipped: false,
  };

  if (!DRY_RUN) {
    await writeJson(revisionMetaPath, revisionMeta);
  }

  return {
    revision,
    revisionPath: toPortablePath(revisionPath),
    revisionMetaPath: toPortablePath(revisionMetaPath),
    ...revisionMeta,
    rebuildStatus,
  };
}

async function triggerRebuild(pdNumber, revision) {
  const endpoint = `${API_BASE_URL}/api/legal-drawings/${encodeURIComponent(pdNumber)}/rebuild`;
  if (DRY_RUN) {
    return {
      ok: true,
      skipped: true,
      endpoint,
      revision,
      reason: "dry-run",
    };
  }

  const fallbackEndpoint = endpoint.replace("http://localhost:", "http://127.0.0.1:");
  const attempts = fallbackEndpoint !== endpoint ? [endpoint, fallbackEndpoint] : [endpoint];
  let lastFailure = null;

  for (const attemptEndpoint of attempts) {
    try {
      const response = await fetch(attemptEndpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ revision }),
      });

      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = { raw: text };
      }

      return {
        ok: response.ok,
        status: response.status,
        endpoint: attemptEndpoint,
        attemptedEndpoints: attempts,
        revision,
        payload,
      };
    } catch (error) {
      lastFailure = {
        ok: false,
        endpoint: attemptEndpoint,
        attemptedEndpoints: attempts,
        revision,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return (
    lastFailure || {
      ok: false,
      endpoint,
      attemptedEndpoints: attempts,
      revision,
      error: "unknown fetch failure",
    }
  );
}

async function copyDirectory(sourcePath, targetPath) {
  await ensureDir(targetPath);
  const entries = await fs.readdir(sourcePath, { withFileTypes: true });
  for (const entry of entries) {
    const sourceChild = path.join(sourcePath, entry.name);
    const targetChild = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(sourceChild, targetChild);
      continue;
    }
    if (entry.isFile()) {
      await fs.copyFile(sourceChild, targetChild);
    }
  }
}

async function collectSourceFiles(pdPath, entries) {
  const files = entries.filter((entry) => entry.isFile() && !entry.name.startsWith("~$"));
  const workbook = files.find((entry) => WORKBOOK_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));
  const layout = files.find((entry) => PDF_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));
  return {
    workbook: workbook ? path.join(pdPath, workbook.name) : null,
    layout: layout ? path.join(pdPath, layout.name) : null,
  };
}

async function discoverRootFileRevisions(pdNumber, pdPath, entries) {
  const files = entries.filter((entry) => entry.isFile() && !entry.name.startsWith("~$"));
  const groupedByBaseRevision = new Map();

  for (const entry of files) {
    const extension = path.extname(entry.name).toLowerCase();
    const isWorkbook = WORKBOOK_EXTENSIONS.has(extension);
    const isLayout = PDF_EXTENSIONS.has(extension);
    if (!isWorkbook && !isLayout) {
      continue;
    }

    const revision = extractRevisionFromLegalFilename(pdNumber, entry.name);
    const baseRevision = getBaseRevisionKey(revision);
    const absolutePath = path.join(pdPath, entry.name);
    const isGreenChanges = isWorkbook && isGreenChangesWorkbookFileName(entry.name);
    const candidate = {
      revision,
      baseRevision,
      filePath: absolutePath,
      fileName: entry.name,
      fingerprint: await fingerprintFile(absolutePath),
      kind: isGreenChanges ? "green-changes" : isWorkbook ? "workbook" : "layout",
    };
    const group = groupedByBaseRevision.get(baseRevision) || [];
    group.push(candidate);
    groupedByBaseRevision.set(baseRevision, group);
  }

  const revisions = [];

  for (const [baseRevision, candidates] of groupedByBaseRevision.entries()) {
    const revisionNames = Array.from(new Set(candidates.map((candidate) => candidate.revision))).sort(compareRevisionNames);
    const effectiveRevision = revisionNames.at(-1);
    if (!effectiveRevision) {
      continue;
    }
    const usableCandidates = candidates.filter(
      (candidate) => compareRevisionNames(candidate.revision, effectiveRevision) <= 0,
    );
    const latestWorkbook = usableCandidates
      .filter((candidate) => candidate.kind === "workbook")
      .sort((left, right) => compareRevisionNames(left.revision, right.revision))
      .at(-1) || null;
    const latestGreenChanges = usableCandidates
      .filter((candidate) => candidate.kind === "green-changes")
      .sort((left, right) => compareRevisionNames(left.revision, right.revision))
      .at(-1) || null;
    const latestLayout = usableCandidates
      .filter((candidate) => candidate.kind === "layout")
      .sort((left, right) => compareRevisionNames(left.revision, right.revision))
      .at(-1) || null;

    revisions.push({
      revision: effectiveRevision,
      baseRevision,
      workbookPath: latestWorkbook?.filePath || null,
      greenChangesPath: latestGreenChanges?.filePath || null,
      layoutPath: latestLayout?.filePath || null,
      workbookFileName: latestWorkbook?.fileName || null,
      greenChangesFileName: latestGreenChanges?.fileName || null,
      layoutFileName: latestLayout?.fileName || null,
      workbookFingerprint: latestWorkbook?.fingerprint || null,
      greenChangesFingerprint: latestGreenChanges?.fingerprint || null,
      layoutFingerprint: latestLayout?.fingerprint || null,
      fingerprint: buildRevisionFingerprint({
        workbookFingerprint: latestWorkbook?.fingerprint || null,
        greenChangesFingerprint: latestGreenChanges?.fingerprint || null,
        layoutFingerprint: latestLayout?.fingerprint || null,
      }),
    });
  }

  return revisions.sort((a, b) => compareRevisionNames(a.revision, b.revision));
}

async function discoverExistingRevisionFolders(pdNumber, pdPath, revisionDirNames) {
  const revisions = [];

  for (const revisionDirName of revisionDirNames) {
    const revisionPath = path.join(pdPath, revisionDirName);
    const revisionRecord = await readJsonIfExists(path.join(revisionPath, "revision.json"));
    const files = await fs.readdir(revisionPath, { withFileTypes: true }).catch(() => []);
    const workbookFiles = files.filter((entry) => entry.isFile() && WORKBOOK_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && !entry.name.startsWith("~$"));
    const workbookEntry = workbookFiles.find((entry) => !isGreenChangesWorkbookFileName(entry.name));
    const greenChangesEntry = workbookFiles.find((entry) => isGreenChangesWorkbookFileName(entry.name));
    const layoutEntry = files.find((entry) => entry.isFile() && PDF_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));

    const workbookPath = workbookEntry ? path.join(revisionPath, workbookEntry.name) : null;
    const greenChangesPath = greenChangesEntry ? path.join(revisionPath, greenChangesEntry.name) : null;
    const layoutPath = layoutEntry ? path.join(revisionPath, layoutEntry.name) : null;
    const revision = revisionRecord?.revision || revisionDirName;

    if (!workbookPath && !greenChangesPath && !layoutPath) {
      continue;
    }

    const workbookFingerprint = workbookPath ? await fingerprintFile(workbookPath) : null;
    const greenChangesFingerprint = greenChangesPath ? await fingerprintFile(greenChangesPath) : null;
    const layoutFingerprint = layoutPath ? await fingerprintFile(layoutPath) : null;

    revisions.push({
      revision,
      baseRevision: getBaseRevisionKey(revision),
      workbookPath,
      greenChangesPath,
      layoutPath,
      workbookFileName: workbookPath ? path.basename(workbookPath) : null,
      greenChangesFileName: greenChangesPath ? path.basename(greenChangesPath) : null,
      layoutFileName: layoutPath ? path.basename(layoutPath) : null,
      workbookFingerprint,
      greenChangesFingerprint,
      layoutFingerprint,
      fingerprint: buildRevisionFingerprint({ workbookFingerprint, greenChangesFingerprint, layoutFingerprint }),
      source: "revision-folder",
    });
  }

  return revisions.sort((a, b) => compareRevisionNames(a.revision, b.revision));
}

function mergeDiscoveredRevisions(rootRevisions, existingRevisions) {
  const merged = new Map();

  for (const revision of existingRevisions) {
    merged.set(revision.revision.toLowerCase(), revision);
  }

  for (const revision of rootRevisions) {
    const key = revision.revision.toLowerCase();
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, revision);
      continue;
    }

    merged.set(key, {
      ...existing,
      ...revision,
      workbookPath: revision.workbookPath || existing.workbookPath || null,
      greenChangesPath: revision.greenChangesPath || existing.greenChangesPath || null,
      layoutPath: revision.layoutPath || existing.layoutPath || null,
      workbookFileName: revision.workbookFileName || existing.workbookFileName || null,
      greenChangesFileName: revision.greenChangesFileName || existing.greenChangesFileName || null,
      layoutFileName: revision.layoutFileName || existing.layoutFileName || null,
      workbookFingerprint: revision.workbookFingerprint || existing.workbookFingerprint || null,
      greenChangesFingerprint: revision.greenChangesFingerprint || existing.greenChangesFingerprint || null,
      layoutFingerprint: revision.layoutFingerprint || existing.layoutFingerprint || null,
      fingerprint:
        revision.fingerprint ||
        existing.fingerprint ||
        buildRevisionFingerprint({
          workbookFingerprint: revision.workbookFingerprint || existing.workbookFingerprint || null,
          greenChangesFingerprint: revision.greenChangesFingerprint || existing.greenChangesFingerprint || null,
          layoutFingerprint: revision.layoutFingerprint || existing.layoutFingerprint || null,
        }),
      source: "merged",
    });
  }

  return Array.from(merged.values()).sort((a, b) => compareRevisionNames(a.revision, b.revision));
}

function extractRevisionFromLegalFilename(pdNumber, fileName) {
  const stem = path.basename(fileName, path.extname(fileName));
  const normalizedStem = stem.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const revisionCandidates = extractRevisionCandidates(normalizedStem);

  // Compare files are usually named with both from/to revisions. Prefer the last token.
  if (isGreenChangesWorkbookFileName(fileName) && revisionCandidates.length > 0) {
    return revisionCandidates.at(-1);
  }

  const revisionMatch =
    normalizedStem.match(/\b([A-Z]\.\d+(?:\s*M\.\d+)?)\b/i) ||
    normalizedStem.match(/\b([A-Z]\d+(?:\s*M\.\d+)?)\b/i) ||
    normalizedStem.match(/\b(REV(?:ISION)?\s*[A-Z0-9.\-]+)\b/i) ||
    normalizedStem.match(/\b(R\d+(?:\.\d+)*)\b/i) ||
    normalizedStem.match(/\b(\d+\.\d+(?:\s*M\.\d+)?)\b/i);

  if (revisionMatch?.[1]) {
    return revisionMatch[1].replace(/\s+/g, "_").replace(/^REV(?:ISION)?_?/i, "").trim();
  }

  const withoutPd = normalizedStem.replace(new RegExp(`\\b${escapeRegExp(pdNumber)}\\b`, "ig"), "").trim();
  return sanitizeRevisionFolderName(withoutPd || normalizedStem);
}

async function seedRevisionSourceFiles(pdNumber, revisionPath, discoveredRevision) {
  if (!discoveredRevision || DRY_RUN) {
    return;
  }
  await ensureDir(revisionPath);
  const workbookUpdatedAt = discoveredRevision.workbookPath
    ? await safeIsoMtime(discoveredRevision.workbookPath)
    : null;
  const greenChangesUpdatedAt = discoveredRevision.greenChangesPath
    ? await safeIsoMtime(discoveredRevision.greenChangesPath)
    : null;
  const layoutUpdatedAt = discoveredRevision.layoutPath
    ? await safeIsoMtime(discoveredRevision.layoutPath)
    : null;

  if (discoveredRevision.workbookPath) {
    await moveOrCopyIntoRevision(
      discoveredRevision.workbookPath,
      path.join(revisionPath, path.basename(discoveredRevision.workbookPath)),
    );
  }

  if (discoveredRevision.greenChangesPath) {
    await moveOrCopyIntoRevision(
      discoveredRevision.greenChangesPath,
      path.join(revisionPath, path.basename(discoveredRevision.greenChangesPath)),
    );
  }

  if (discoveredRevision.layoutPath) {
    await moveOrCopyIntoRevision(
      discoveredRevision.layoutPath,
      path.join(revisionPath, path.basename(discoveredRevision.layoutPath)),
    );
  }

  const revisionRecord = {
    pdNumber,
    revision: discoveredRevision.revision,
    projectNameHint: pdNumber,
    workbookFileName: discoveredRevision.workbookFileName || null,
    workbookRelativePath: discoveredRevision.workbookFileName
      ? `${sanitizeRevisionFolderName(discoveredRevision.revision)}/${discoveredRevision.workbookFileName}`
      : null,
    workbookUpdatedAt,
    greenChangesWorkbookFileName: discoveredRevision.greenChangesFileName || null,
    greenChangesWorkbookRelativePath: discoveredRevision.greenChangesFileName
      ? `${sanitizeRevisionFolderName(discoveredRevision.revision)}/${discoveredRevision.greenChangesFileName}`
      : null,
    greenChangesWorkbookUpdatedAt: greenChangesUpdatedAt,
    layoutFileName: discoveredRevision.layoutFileName || null,
    layoutRelativePath: discoveredRevision.layoutFileName
      ? `${sanitizeRevisionFolderName(discoveredRevision.revision)}/${discoveredRevision.layoutFileName}`
      : null,
    layoutUpdatedAt,
    artifacts: {
      workbookPresent: Boolean(discoveredRevision.workbookPath),
      layoutPresent: Boolean(discoveredRevision.layoutPath),
      uploadPropsBuilt: false,
      manifestBuilt: false,
      layoutPagesBuilt: false,
      devicePartNumbersBuilt: false,
      sheetSchemasBuilt: false,
      wireListPrintSchemaPrepared: false,
      brandListSchemaPrepared: false,
      greenChangesWorkbookPresent: Boolean(discoveredRevision.greenChangesPath),
      greenChangesSchemaBuilt: false,
    },
    sourceFingerprint: discoveredRevision.fingerprint || null,
    generatedAt: new Date().toISOString(),
  };

  await writeJson(path.join(revisionPath, "revision.json"), revisionRecord);
}

async function moveOrCopyIntoRevision(sourcePath, targetPath) {
  if (sourcePath === targetPath) {
    return;
  }
  await ensureDir(path.dirname(targetPath));
  if (await exists(targetPath)) {
    return;
  }

  try {
    await fs.copyFile(sourcePath, targetPath);
  } catch {
    await fs.copyFile(sourcePath, targetPath);
  }
}

async function listLegalProjects() {
  const entries = await fs.readdir(LEGAL_ROOT, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => ({
      name: entry.name,
      path: path.join(LEGAL_ROOT, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function listPresentFiles(rootPath, fileNames) {
  const present = [];
  for (const fileName of fileNames) {
    const filePath = path.join(rootPath, fileName);
    if (await exists(filePath)) {
      present.push(fileName);
    }
  }
  return present;
}

async function listPresentRelativePaths(rootPath, fileNames) {
  const present = [];
  for (const fileName of fileNames) {
    const filePath = path.join(rootPath, fileName);
    if (await exists(filePath)) {
      present.push(fileName);
    }
  }
  return present;
}

async function listNonEmptyDirectories(rootPath, dirNames) {
  const present = [];
  for (const dirName of dirNames) {
    const dirPath = path.join(rootPath, dirName);
    if (await hasDirectoryContents(dirPath)) {
      present.push(dirName);
    }
  }
  return present;
}

async function listNonEmptyDirectoryPaths(rootPath, dirNames) {
  const present = [];
  for (const dirName of dirNames) {
    const dirPath = path.join(rootPath, dirName);
    if (await hasDirectoryContents(dirPath)) {
      present.push(dirPath);
    }
  }
  return present;
}

function compareRevisionNames(a, b) {
  return compareRevisionTokens(tokenizeRevision(a), tokenizeRevision(b));
}

function tokenizeRevision(value) {
  return value
    .toUpperCase()
    .replace(/[_\-.]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token) => token.match(/[A-Z]+|\d+/g) || [token]);
}

function compareRevisionTokens(aTokens, bTokens) {
  const max = Math.max(aTokens.length, bTokens.length);
  for (let index = 0; index < max; index += 1) {
    const a = aTokens[index];
    const b = bTokens[index];
    if (a == null) return -1;
    if (b == null) return 1;
    const aNumber = Number(a);
    const bNumber = Number(b);
    const aIsNumber = Number.isFinite(aNumber) && /^\d+$/.test(a);
    const bIsNumber = Number.isFinite(bNumber) && /^\d+$/.test(b);
    if (aIsNumber && bIsNumber) {
      if (aNumber !== bNumber) {
        return aNumber - bNumber;
      }
      continue;
    }
    const diff = a.localeCompare(b);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

async function writeJson(filePath, data) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

async function readJsonIfExists(filePath) {
  try {
    const value = await fs.readFile(filePath, "utf8");
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectory(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function pruneStaleRevisionDirectories(pdPath, explicitRevisionDirs, activeRevisionNames) {
  const activeSet = new Set(activeRevisionNames.map((name) => name.toLowerCase()));
  for (const revisionDir of explicitRevisionDirs) {
    if (activeSet.has(revisionDir.toLowerCase())) {
      continue;
    }
    const revisionPath = path.join(pdPath, revisionDir);
    const hasGeneratedMarker =
      (await exists(path.join(revisionPath, "revision.json")));
    if (!hasGeneratedMarker) {
      continue;
    }
    await fs.rm(revisionPath, { recursive: true, force: true });
  }
}

async function removeLegacyStateDirectory(revisionPath) {
  const statePath = path.join(revisionPath, "state");
  const legacyBuildMetaPath = path.join(revisionPath, "build-meta.json");

  if (!DRY_RUN && (await isDirectory(statePath))) {
    await fs.rm(statePath, { recursive: true, force: true });
  }

  if (!DRY_RUN && (await exists(legacyBuildMetaPath))) {
    await fs.rm(legacyBuildMetaPath, { force: true });
  }
}

async function hasDirectoryContents(dirPath) {
  try {
    const entries = await fs.readdir(dirPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

async function fingerprintFile(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return `${path.basename(filePath)}:${stats.size}:${stats.mtimeMs}`;
  } catch {
    return null;
  }
}

async function safeIsoMtime(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return new Date(stats.mtimeMs).toISOString();
  } catch {
    return null;
  }
}

function buildRevisionFingerprint(revision) {
  return [revision.workbookFingerprint || "no-workbook", revision.greenChangesFingerprint || "no-green-changes", revision.layoutFingerprint || "no-layout"].join("|");
}

async function hasUsableGeneratedArtifacts(meta, revisionPath) {
  if (!meta || !revisionPath) {
    return false;
  }

  const files = Array.isArray(meta.generatedRelativePaths) && meta.generatedRelativePaths.length > 0
    ? meta.generatedRelativePaths
    : (Array.isArray(meta.generatedFiles) ? meta.generatedFiles : []);
  const dirs = Array.isArray(meta.generatedDirectories) ? meta.generatedDirectories : [];

  const fileChecks = files.map((fileName) => exists(path.join(revisionPath, String(fileName))));
  const dirChecks = dirs.map((dirName) => hasDirectoryContents(path.join(revisionPath, String(dirName))));
  const checks = await Promise.all([...fileChecks, ...dirChecks]);

  return checks.some(Boolean);
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] || null;
}

async function loadScheduleRows() {
  if (scheduleRowsPromise) {
    return scheduleRowsPromise;
  }

  scheduleRowsPromise = fs.readFile(SCHEDULE_CSV_PATH, "utf8").then((raw) => {
    const workbook = XLSX.read(raw, { type: "string", raw: false });
    const firstSheetName = workbook.SheetNames[0];
    const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
    if (!firstSheet) {
      return [];
    }
    return XLSX.utils.sheet_to_json(firstSheet, {
      defval: "",
      raw: false,
    });
  }).catch(() => []);

  return scheduleRowsPromise;
}

async function findScheduleMetadata(pdNumber, unitNumber) {
  const rows = await loadScheduleRows();
  const normalizedPdNumber = String(pdNumber || "").trim().toUpperCase();
  const normalizedUnitNumber = normalizeScheduleText(unitNumber);
  let fallbackRow = null;

  for (const row of rows) {
    const rowPdNumber = normalizeScheduleText(row["PD#"]).toUpperCase();
    if (rowPdNumber !== normalizedPdNumber) {
      continue;
    }

    if (!fallbackRow) {
      fallbackRow = row;
    }

    const rowUnit = normalizeScheduleText(row["UNIT"]);
    if (normalizedUnitNumber && rowUnit !== normalizedUnitNumber) {
      continue;
    }

    return buildScheduleMetadata(row);
  }

  return fallbackRow ? buildScheduleMetadata(fallbackRow) : null;
}

function buildScheduleMetadata(row) {
  const dueDate = parseScheduleDate(row["DEPT 380 TARGET"]);
  return {
    source: "Schedule.csv",
    pdNumber: normalizeScheduleText(row["PD#"]).toUpperCase(),
    projectName: normalizeScheduleText(row["PROJECT"]),
    displayName: buildScheduleDisplayName(row),
    unitNumber: normalizeScheduleText(row["UNIT"]),
    dueDate,
    dueMonth: dueDate ? dueDate.slice(0, 7) : null,
    planConlayDate: parseScheduleDate(row["CONLAY"]),
    planConassyDate: parseScheduleDate(row["CONASY"]),
    shipDate: parseScheduleDate(row["SHIPC"] || row["Cons Ship"] || row["Cons Ship - 2"]),
    deptTargetDate: dueDate,
    lwcType: normalizeScheduleText(row["LWC"]),
    color: dueDate && dueDate.startsWith(new Date().toISOString().slice(0, 7)) ? "#F4B400" : "",
    daysLate: parseScheduleNumber(row["DAYS LATE"]),
    estimatedTotalHours: parseScheduleNumber(row["Est Total Hours"]),
    estimatedPanelCount: parseScheduleNumber(row["Est Panel Count"]),
    estimatedSampleCount: parseScheduleNumber(row["Est Sample Count"]),
    controlsSlot: normalizeScheduleText(row["Controls Slot"]),
    pmName: normalizeScheduleText(row["PM Name"]),
  };
}

async function loadPriorityRows() {
  if (priorityRowsPromise) {
    return priorityRowsPromise;
  }

  priorityRowsPromise = readJsonIfExists(PRIORITY_LIST_JSON_PATH).then((doc) => {
    if (!doc || !Array.isArray(doc.entries)) {
      return [];
    }
    return doc.entries;
  });

  return priorityRowsPromise;
}

async function findPriorityMetadata(pdNumber, unitNumber) {
  const rows = await loadPriorityRows();
  const normalizedUnitNumber = normalizeScheduleText(unitNumber);
  const keys = buildPdLookupKeys(pdNumber);
  let fallback = null;

  for (const row of rows) {
    const rowKeys = buildPdLookupKeys(row?.pd);
    const hasMatch = rowKeys.some((key) => keys.includes(key));
    if (!hasMatch) {
      continue;
    }

    if (!fallback) {
      fallback = row;
    }

    const rowUnit = normalizeScheduleText(row?.unit);
    if (normalizedUnitNumber && rowUnit && rowUnit !== normalizedUnitNumber) {
      continue;
    }

    return buildPriorityMetadata(row);
  }

  return fallback ? buildPriorityMetadata(fallback) : null;
}

function buildPriorityMetadata(row) {
  return {
    source: "priority-list.json",
    pdNumber: normalizePdNumberValue(row?.pd),
    unitNumber: normalizeScheduleText(row?.unit),
    projectName: normalizeScheduleText(row?.customer),
    lwcType: normalizeScheduleText(row?.lwc),
  };
}

async function loadProjectManifestRows() {
  if (projectManifestsPromise) {
    return projectManifestsPromise;
  }

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

async function findProjectManifestMetadata(pdNumber, unitNumber) {
  const rows = await loadProjectManifestRows();
  const keys = buildPdLookupKeys(pdNumber);
  const normalizedUnit = normalizeScheduleText(unitNumber);
  const matches = rows.filter((row) => {
    const rowKeys = buildPdLookupKeys(row.pdNumber);
    return rowKeys.some((key) => keys.includes(key));
  });

  if (!matches.length) {
    return null;
  }

  const exactUnitMatch = normalizedUnit
    ? matches.find((row) => normalizeScheduleText(row.unitNumber) === normalizedUnit)
    : null;

  const picked = exactUnitMatch || matches.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
  return {
    source: "Share/Projects",
    pdNumber: normalizePdNumberValue(picked.pdNumber),
    unitNumber: normalizeScheduleText(picked.unitNumber),
    projectName: normalizeScheduleText(picked.projectName),
    lwcType: normalizeScheduleText(picked.lwcType),
  };
}

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

function buildScheduleDisplayName(row) {
  const projectName = normalizeScheduleText(row["PROJECT"]);
  const unitNumber = normalizeScheduleText(row["UNIT"]);
  return unitNumber ? `${projectName}` : projectName;
}

function normalizeScheduleText(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalizePdNumberValue(value) {
  return normalizeScheduleText(value).toUpperCase();
}

function buildPdLookupKeys(value) {
  const normalized = normalizePdNumberValue(value);
  if (!normalized) {
    return [];
  }

  const compact = normalized.replace(/[^A-Z0-9]/g, "");
  const withoutSuffix = compact.replace(/(CB|CC|CS|CD|CE|CF)$/i, "");
  const keys = [compact, withoutSuffix]
    .map((key) => key.trim())
    .filter(Boolean);

  return Array.from(new Set(keys));
}

function firstNonEmptyText(...values) {
  for (const value of values) {
    const normalized = normalizeScheduleText(value);
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function parseScheduleNumber(value) {
  const normalized = normalizeScheduleText(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseScheduleDate(value) {
  const normalized = normalizeScheduleText(value);
  if (!normalized) {
    return "";
  }
  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})/);
  if (!match) {
    return "";
  }
  const month = Number(match[1]);
  const day = Number(match[2]);
  const yearToken = match[3];
  const year = yearToken.length === 2 ? 2000 + Number(yearToken) : Number(yearToken);
  if (!Number.isFinite(month) || !Number.isFinite(day) || !Number.isFinite(year)) {
    return "";
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function sanitizeRevisionFolderName(value) {
  return value
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "UNKNOWN_REVISION";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getBaseRevisionKey(revision) {
  return String(revision).toUpperCase().replace(/_?M\.\d+$/i, "");
}

function toPortablePath(targetPath) {
  const relative = path.relative(APP_ROOT, targetPath);
  return relative && !relative.startsWith("..") ? relative : targetPath;
}

await main();
