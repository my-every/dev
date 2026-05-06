#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";

const APP_ROOT = process.cwd();
const PROJECTS_ROOT = path.join(APP_ROOT, "Share", "Projects");
const LEGAL_ROOT = path.join(APP_ROOT, "Share", "Legal Drawings");

const { values } = parseArgs({
  options: {
    project: { type: "string" },
    pd: { type: "string" },
    revision: { type: "string" },
    out: { type: "string" },
    "only-diff": { type: "boolean", default: false },
  },
  strict: false,
});

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizeToken(value) {
  return normalize(value)
    .toUpperCase()
    .replace(/\(SHT\s*\d+\)/g, " ")
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function csvValue(value) {
  const raw = value == null ? "" : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

function toCsv(rows, headers) {
  const lines = [headers.map(csvValue).join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvValue(row[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function getLatestRevisionFolder(pdRoot) {
  const latestPath = path.join(pdRoot, "latest.json");
  try {
    const latest = await readJson(latestPath);
    if (normalize(latest?.latestRevision)) {
      const candidate = path.join(pdRoot, normalize(latest.latestRevision));
      const stat = await fs.stat(candidate).catch(() => null);
      if (stat?.isDirectory()) return path.basename(candidate);
    }
  } catch {
    // Ignore and fall through to directory scan.
  }

  const entries = await fs.readdir(pdRoot, { withFileTypes: true }).catch(() => []);
  const revisions = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  return revisions.length > 0 ? revisions[revisions.length - 1] : null;
}

async function loadBrandFilesFromDir(brandDir) {
  const entries = await fs.readdir(brandDir, { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const bySheet = new Map();

  for (const fileName of files) {
    const filePath = path.join(brandDir, fileName);
    let doc;
    try {
      doc = await readJson(filePath);
    } catch {
      continue;
    }

    const sheetKey =
      normalizeToken(doc?.importHints?.canonicalSheetName) ||
      normalizeToken(doc?.sheetName) ||
      normalizeToken(doc?.sheetSlug) ||
      normalizeToken(fileName.replace(/\.json$/i, ""));

    if (!sheetKey) continue;

    bySheet.set(sheetKey, {
      fileName,
      filePath,
      sheetName: normalize(doc?.sheetName),
      sheetSlug: normalize(doc?.sheetSlug),
      sheetKey,
      doc,
    });
  }

  return bySheet;
}

function flattenRowsByKey(sheetData) {
  const rowsByKey = new Map();
  const doc = sheetData?.doc ?? {};
  const prefixGroups = Array.isArray(doc.prefixGroups) ? doc.prefixGroups : [];

  for (const group of prefixGroups) {
    const bundles = Array.isArray(group?.bundles) ? group.bundles : [];
    for (const bundle of bundles) {
      const rows = Array.isArray(bundle?.rows) ? bundle.rows : [];
      for (const row of rows) {
        const comparableKey = [
          sheetData.sheetKey,
          normalizeToken(row?.fromDeviceId),
          normalizeToken(row?.fromTerminal),
          normalizeToken(row?.wireNo),
          normalizeToken(row?.wireId),
          normalizeToken(row?.gaugeSize),
          normalizeToken(row?.toDeviceId),
          normalizeToken(row?.toTerminal),
          normalizeToken(row?.toLocation),
          normalizeToken(row?.bundleName),
        ].join("||");

        const record = {
          sheetName: normalize(doc?.sheetName) || sheetData.sheetName,
          sheetSlug: normalize(doc?.sheetSlug) || sheetData.sheetSlug,
          sheetKey: sheetData.sheetKey,
          rowId: normalize(row?.rowId),
          rowIndex: row?.rowIndex ?? null,
          fromDeviceId: normalize(row?.fromDeviceId),
          fromTerminal: normalize(row?.fromTerminal),
          wireNo: normalize(row?.wireNo),
          wireId: normalize(row?.wireId),
          gaugeSize: normalize(row?.gaugeSize),
          toDeviceId: normalize(row?.toDeviceId),
          toTerminal: normalize(row?.toTerminal),
          toLocation: normalize(row?.toLocation),
          bundleName: normalize(row?.bundleName),
          length: toNumber(row?.length),
        };

        const list = rowsByKey.get(comparableKey) ?? [];
        list.push(record);
        rowsByKey.set(comparableKey, list);
      }
    }
  }

  return rowsByKey;
}

function compareSheetRows(projectSheet, legalSheet, onlyDiff) {
  const projectRows = projectSheet ? flattenRowsByKey(projectSheet) : new Map();
  const legalRows = legalSheet ? flattenRowsByKey(legalSheet) : new Map();

  const keys = Array.from(new Set([...projectRows.keys(), ...legalRows.keys()])).sort((a, b) => a.localeCompare(b));
  const rows = [];

  for (const key of keys) {
    const pList = projectRows.get(key) ?? [];
    const lList = legalRows.get(key) ?? [];
    const count = Math.max(pList.length, lList.length);

    for (let index = 0; index < count; index += 1) {
      const p = pList[index] ?? null;
      const l = lList[index] ?? null;

      let status = "MATCH";
      if (!p && l) status = "MISSING_IN_PROJECT";
      else if (p && !l) status = "MISSING_IN_LEGAL";
      else if (p && l && p.length !== l.length) status = "LENGTH_DIFF";

      if (onlyDiff && status === "MATCH") continue;

      const base = p ?? l;
      const projectLength = p?.length ?? "";
      const legalLength = l?.length ?? "";
      const delta = typeof p?.length === "number" && typeof l?.length === "number"
        ? p.length - l.length
        : "";

      rows.push({
        sheetKey: base?.sheetKey ?? "",
        sheetName: base?.sheetName ?? "",
        sheetSlug: base?.sheetSlug ?? "",
        status,
        rowIdProject: p?.rowId ?? "",
        rowIdLegal: l?.rowId ?? "",
        rowIndexProject: p?.rowIndex ?? "",
        rowIndexLegal: l?.rowIndex ?? "",
        fromDeviceId: base?.fromDeviceId ?? "",
        fromTerminal: base?.fromTerminal ?? "",
        wireNo: base?.wireNo ?? "",
        wireId: base?.wireId ?? "",
        gaugeSize: base?.gaugeSize ?? "",
        toDeviceId: base?.toDeviceId ?? "",
        toTerminal: base?.toTerminal ?? "",
        toLocation: base?.toLocation ?? "",
        bundleName: base?.bundleName ?? "",
        lengthProject: projectLength,
        lengthLegal: legalLength,
        lengthDelta: delta,
      });
    }
  }

  return rows;
}

async function main() {
  const projectId = normalize(values.project);
  if (!projectId) {
    throw new Error("Missing required --project (example: --project 4M481_ET_TRI)");
  }

  const projectRoot = path.join(PROJECTS_ROOT, projectId, "state");
  const projectManifestPath = path.join(projectRoot, "project-manifest.json");
  const projectManifest = await readJson(projectManifestPath).catch(() => null);
  if (!projectManifest) {
    throw new Error(`Project manifest not found: ${projectManifestPath}`);
  }

  const pdNumber = normalize(values.pd) || normalize(projectManifest.pdNumber);
  if (!pdNumber) {
    throw new Error("Unable to resolve PD number. Provide --pd.");
  }

  const pdRoot = path.join(LEGAL_ROOT, pdNumber);
  const pdStat = await fs.stat(pdRoot).catch(() => null);
  if (!pdStat?.isDirectory()) {
    throw new Error(`Legal PD folder not found: ${pdRoot}`);
  }

  const resolvedRevision = normalize(values.revision) || (await getLatestRevisionFolder(pdRoot));
  if (!resolvedRevision) {
    throw new Error(`No revision folders found under: ${pdRoot}`);
  }

  const legalRevisionRoot = path.join(pdRoot, resolvedRevision);
  const legalBrandDir = path.join(legalRevisionRoot, "wire-brand-list");
  const projectBrandDir = path.join(projectRoot, "wire-brand-list");

  const [projectSheets, legalSheets] = await Promise.all([
    loadBrandFilesFromDir(projectBrandDir),
    loadBrandFilesFromDir(legalBrandDir),
  ]);

  if (projectSheets.size === 0) {
    throw new Error(`No project brand-list JSON found: ${projectBrandDir}`);
  }
  if (legalSheets.size === 0) {
    throw new Error(`No legal brand-list JSON found: ${legalBrandDir}`);
  }

  const onlyDiff = Boolean(values["only-diff"]);
  const allSheetKeys = Array.from(new Set([...projectSheets.keys(), ...legalSheets.keys()])).sort((a, b) =>
    a.localeCompare(b),
  );

  const comparisonRows = [];
  for (const sheetKey of allSheetKeys) {
    const rows = compareSheetRows(projectSheets.get(sheetKey), legalSheets.get(sheetKey), onlyDiff);
    comparisonRows.push(...rows);
  }

  comparisonRows.sort((a, b) => {
    if (a.sheetKey !== b.sheetKey) return a.sheetKey.localeCompare(b.sheetKey);
    if (a.status !== b.status) return a.status.localeCompare(b.status);
    const ai = Number(a.rowIndexProject || a.rowIndexLegal || 0);
    const bi = Number(b.rowIndexProject || b.rowIndexLegal || 0);
    if (ai !== bi) return ai - bi;
    if (a.wireNo !== b.wireNo) return String(a.wireNo).localeCompare(String(b.wireNo));
    return String(a.fromDeviceId).localeCompare(String(b.fromDeviceId));
  });

  const outputPath = normalize(values.out) || path.join(legalBrandDir, `length-comparison-${projectId}.csv`);
  const headers = [
    "sheetKey",
    "sheetName",
    "sheetSlug",
    "status",
    "rowIdProject",
    "rowIdLegal",
    "rowIndexProject",
    "rowIndexLegal",
    "fromDeviceId",
    "fromTerminal",
    "wireNo",
    "wireId",
    "gaugeSize",
    "toDeviceId",
    "toTerminal",
    "toLocation",
    "bundleName",
    "lengthProject",
    "lengthLegal",
    "lengthDelta",
  ];

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, toCsv(comparisonRows, headers), "utf8");

  const summary = {
    project: projectId,
    pdNumber,
    revision: resolvedRevision,
    projectSheetCount: projectSheets.size,
    legalSheetCount: legalSheets.size,
    comparedSheetCount: allSheetKeys.length,
    totalRows: comparisonRows.length,
    matches: comparisonRows.filter((row) => row.status === "MATCH").length,
    lengthDiffs: comparisonRows.filter((row) => row.status === "LENGTH_DIFF").length,
    missingInProject: comparisonRows.filter((row) => row.status === "MISSING_IN_PROJECT").length,
    missingInLegal: comparisonRows.filter((row) => row.status === "MISSING_IN_LEGAL").length,
    outputPath,
  };

  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(`[wire-brand-length-compare] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
