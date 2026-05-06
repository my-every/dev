import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import * as XLSX from "xlsx";

type ImportDecision = "pending" | "accept" | "reject";
type ImportMode = "length-only" | "full";
type PersistTarget = "projects" | "legal-drawings" | "both";
type DecisionPolicy = "conservative" | "sync-all";
type StructuralAcceptRule = "none" | "imported-only" | "current-only" | "both";

interface ImportedBrandListRow {
  importedRowId: string;
  rowIndex: number;
  matchKey: string;
  fromDeviceId: string;
  wireNo: string;
  wireId: string;
  gaugeSize: string;
  length: number | null;
  toDeviceId: string;
  toLocation: string;
  devicePrefix: string;
  bundleName: string;
  bundleDisplay: string;
}

interface ImportedBrandSheetData {
  sheetSlug: string;
  sheetName: string;
  sourceSheetName: string;
  metadata?: {
    sourceSheetSlug?: string | null;
    sourceSchemaHash?: string | null;
    normalizedSheetName?: string | null;
    bundleNames?: string[];
  };
  rows: ImportedBrandListRow[];
}

interface MultiSheetImportDiff {
  diffId: string;
  changeType: "unchanged" | "length-changed" | "imported-only" | "current-only";
}

interface MultiSheetImportSheetDiff {
  sheetSlug: string;
  sheetName: string;
  sourceSheetName: string;
  actionableDiffCount: number;
  diffs: MultiSheetImportDiff[];
}

interface PrepareResponse {
  importSession: {
    workbookFileName: string;
    importedAt: string;
    importMode: ImportMode;
    matchedSheetSlugs: string[];
    unmatchedSheetNames: string[];
    activeSheetSlug: string | null;
    completedSheetSlugs: string[];
    rowDecisions: Record<string, ImportDecision>;
    importedSheets: ImportedBrandSheetData[];
    appliedAt?: string | null;
  };
  sheetDiffs: MultiSheetImportSheetDiff[];
}

interface ApplyResponse {
  appliedSheetSlugs: string[];
  importSession: PrepareResponse["importSession"];
}

interface ResyncTerminalsResponse {
  success?: boolean;
  projectId?: string;
  updatedPartCount?: number;
  updatedParts?: string[];
  syncedAt?: string;
}

interface CliOptions {
  projectId: string | null;
  brandListDir: string;
  baseUrl: string;
  dryRun: boolean;
  mode: ImportMode;
  decisionPolicy: DecisionPolicy;
  structuralAccept: StructuralAcceptRule;
  structuralAcceptExplicit: boolean;
  target: PersistTarget;
  allFiles: boolean;
  latestOnly: boolean;
  legalDrawingsOnly: boolean;
}

interface WorkbookCandidate {
  fullPath: string;
  fileName: string;
  mtimeMs: number;
}

interface WorkbookRunSummary {
  workbookFileName: string;
  workbookPath: string;
  matchedSheets: number;
  unmatchedSheets: string[];
  unchangedRows: number;
  lengthChangedRows: number;
  importedOnlyRows: number;
  currentOnlyRows: number;
  appliedSheets: number;
  mirroredToLegalDrawings: boolean;
  mode: ImportMode;
  dryRun: boolean;
  status: "applied" | "dry-run" | "skipped-no-importable-sheets" | "failed";
  error?: string;
}

interface RevisionInfo {
  pdNumber: string;
  revision: string;
  latestJsonPath: string | null;
}

interface StoredProjectManifest {
  id: string;
  pdNumber?: string;
  revision?: string;
  updatedAt?: string;
  createdAt?: string;
}

interface LegalProjectRecordResponse {
  pdNumber: string;
  latestRevision: string | null;
  projectName?: string | null;
  projectNameHint?: string;
  lwcType?: string | null;
  dueDate?: string | null;
  planConlayDate?: string | null;
  planConassyDate?: string | null;
  shipDate?: string | null;
  color?: string | null;
}

interface InstantiateProjectResponse {
  manifest?: {
    id: string;
    pdNumber?: string;
    revision?: string;
  };
}

interface PdFolderRunSummary {
  pdNumber: string;
  brandListDir: string;
  projectId?: string;
  revision?: string;
  status: "completed" | "skipped-no-workbooks" | "skipped-no-project" | "failed";
  comparisonOutputPath?: string;
  error?: string;
  workbookCount: number;
  summaries: WorkbookRunSummary[];
}

function usage() {
  console.log(
    [
      "Usage:",
      "  node --experimental-strip-types scripts/auto-merge-brandlist.ts --brandlist-dir <dir>",
      "",
      "Options:",
      "  --project-id <id>       Optional. Target project id (auto-detected if omitted).",
      "  --brandlist-dir <dir>   Required. Either Share/Brand List/<pd#> or root Share/Brand List.",
      "  --base-url <url>        API base URL. Default: http://localhost:3000",
      "  --mode <mode>           length-only | full. Default: length-only",
      "  --decision-policy <p>   conservative | sync-all. Default: conservative",
      "  --structural-accept <r> none | imported-only | current-only | both.",
      "                          Required when --mode full for explicit structural rules.",
      "  --target <target>       projects | legal-drawings | both. Default: projects",
      "  --all-files             Process all workbook files in the folder.",
      "  --latest-only           Process only the newest workbook file (default).",
      "  --dry-run               Do not apply changes, only generate comparison output.",
      "  --legal-drawings-only   Skip project lookup and creation. Only process PD folders",
      "                          that already have a matching Legal Drawings folder and write",
      "                          schemas there (forces --target legal-drawings).",
      "  --help                  Show this help text.",
    ].join("\n"),
  );
}

function isForwardedNodeRuntimeFlag(arg: string): boolean {
  if (/^--no-w+arnings\.?$/i.test(arg)) {
    return true;
  }

  if (/^--experimental-strip-types\.?$/i.test(arg)) {
    return true;
  }

  if (/^--experimental-default-type=module\.?$/i.test(arg)) {
    return true;
  }

  return false;
}

function parseArgs(argv: string[]): CliOptions {
  let projectId: string | null = null;
  let brandListDir = "";
  let baseUrl = "http://localhost:3000";
  let dryRun = false;
  let mode: ImportMode = "length-only";
  let decisionPolicy: DecisionPolicy = "conservative";
  let structuralAccept: StructuralAcceptRule = "none";
  let structuralAcceptExplicit = false;
  let target: PersistTarget = "projects";
  let allFiles = false;
  let latestOnly = true;
  let legalDrawingsOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      continue;
    }
    if (isForwardedNodeRuntimeFlag(arg)) {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }
    if (arg === "--project-id") {
      projectId = (argv[i + 1] ?? "").trim() || null;
      i += 1;
      continue;
    }
    if (arg === "--brandlist-dir") {
      brandListDir = path.resolve((argv[i + 1] ?? "").trim());
      i += 1;
      continue;
    }
    if (arg === "--base-url") {
      baseUrl = (argv[i + 1] ?? "").trim().replace(/\/+$/, "");
      i += 1;
      continue;
    }
    if (arg === "--mode") {
      const value = (argv[i + 1] ?? "").trim();
      if (value === "length-only" || value === "full") {
        mode = value;
      } else {
        throw new Error(`Invalid --mode value: ${value}`);
      }
      i += 1;
      continue;
    }
    if (arg === "--decision-policy") {
      const value = (argv[i + 1] ?? "").trim();
      if (value === "conservative" || value === "sync-all") {
        decisionPolicy = value;
      } else {
        throw new Error(`Invalid --decision-policy value: ${value}`);
      }
      i += 1;
      continue;
    }
    if (arg === "--structural-accept") {
      const value = (argv[i + 1] ?? "").trim();
      if (value === "none" || value === "imported-only" || value === "current-only" || value === "both") {
        structuralAccept = value;
        structuralAcceptExplicit = true;
      } else {
        throw new Error(`Invalid --structural-accept value: ${value}`);
      }
      i += 1;
      continue;
    }
    if (arg === "--target") {
      const value = (argv[i + 1] ?? "").trim();
      if (value === "projects" || value === "legal-drawings" || value === "both") {
        target = value;
      } else {
        throw new Error(`Invalid --target value: ${value}`);
      }
      i += 1;
      continue;
    }
    if (arg === "--all-files") {
      allFiles = true;
      latestOnly = false;
      continue;
    }
    if (arg === "--latest-only") {
      latestOnly = true;
      allFiles = false;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--legal-drawings-only") {
      legalDrawingsOnly = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!brandListDir) {
    throw new Error("Missing required --brandlist-dir");
  }
  if (!fs.existsSync(brandListDir) || !fs.statSync(brandListDir).isDirectory()) {
    throw new Error(`Brand list directory not found: ${brandListDir}`);
  }

  if (mode === "full" && !structuralAcceptExplicit) {
    throw new Error(
      "Full mode requires explicit structural rules. Pass --structural-accept <none|imported-only|current-only|both>.",
    );
  }

  return {
    projectId,
    brandListDir,
    baseUrl,
    dryRun,
    mode,
    decisionPolicy,
    structuralAccept,
    structuralAcceptExplicit,
    target,
    allFiles,
    latestOnly,
    legalDrawingsOnly,
  };
}

function normalizeSheetName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function normalizeField(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function buildBrandImportMatchKey(values: {
  fromDeviceId?: string | null;
  wireNo?: string | null;
  wireId?: string | null;
  gaugeSize?: string | null;
  toDeviceId?: string | null;
  toLocation?: string | null;
}) {
  return [
    normalizeField(values.fromDeviceId),
    normalizeField(values.wireNo),
    normalizeField(values.wireId),
    normalizeField(values.gaugeSize),
    normalizeField(values.toDeviceId),
    normalizeField(values.toLocation),
  ].join("|");
}

function listWorkbookCandidates(dir: string): WorkbookCandidate[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => /\.(xlsx|xls|xlsm|xlsb)$/i.test(name))
    .filter((name) => !name.startsWith("~$"))
    .map((name) => {
      const fullPath = path.join(dir, name);
      const stats = fs.statSync(fullPath);
      return {
        fullPath,
        fileName: name,
        mtimeMs: stats.mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function toCellString(value: string | number | boolean | Date | null | undefined) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && !Number.isNaN(value)) return String(value).trim();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString();
  return "";
}

function parseLengthValue(value: string | number | boolean | Date | null | undefined) {
  if (typeof value === "number" && !Number.isNaN(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isNaN(numeric) ? null : numeric;
  }
  return null;
}

function shouldAcceptStructuralDiff(changeType: "imported-only" | "current-only", rule: StructuralAcceptRule) {
  if (rule === "both") return true;
  if (rule === "imported-only") return changeType === "imported-only";
  if (rule === "current-only") return changeType === "current-only";
  return false;
}

function decideImportDecision(diff: MultiSheetImportDiff, options: CliOptions): ImportDecision {
  if (diff.changeType === "unchanged" || diff.changeType === "length-changed") {
    return "accept";
  }
  if (diff.changeType === "imported-only" || diff.changeType === "current-only") {
    if (options.mode !== "full") {
      return "reject";
    }
    return shouldAcceptStructuralDiff(diff.changeType, options.structuralAccept) ? "accept" : "reject";
  }
  return options.decisionPolicy === "sync-all" ? "accept" : "reject";
}

function deriveDevicePrefix(deviceId: string) {
  const base = deviceId.split(":")[0]?.trim() ?? "";
  const match = base.match(/^([A-Za-z]+[0-9]+)/);
  if (match) return match[1].toUpperCase();
  const alpha = base.match(/^([A-Za-z]+)/);
  return alpha ? alpha[1].toUpperCase() : base.toUpperCase() || "UNKNOWN";
}

function deriveBundleName(bundleDisplay: string, toLocation: string, fromDeviceId?: string) {
  const display = bundleDisplay.trim();
  if (display) {
    const loc = toLocation.trim();
    if (loc) {
      const pattern = new RegExp(`\\s*-\\s*${loc.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}$`, "i");
      return display.replace(pattern, "").trim() || display;
    }
    return display;
  }
  return deriveDevicePrefix(fromDeviceId ?? "");
}

function isBrandSheetHeaderRow(row: Array<string | number | boolean | Date | null>) {
  const normalized = row.map((cell) => toCellString(cell).toUpperCase());
  return normalized[0] === "DEVICE ID"
    && normalized[1] === "WIRE NO."
    && normalized[2] === "WIRE ID"
    && normalized[3] === "GAUGE/SIZE"
    && normalized[4] === "LENGTH"
    && normalized[5] === "DEVICE ID"
    && (normalized[6] === "LOCATION" || normalized[6] === "TO LOCATION")
    && normalized[7] === "BUNDLE NAME";
}

function looksLikePrefixHeader(cells: string[]) {
  const first = cells[0];
  const remainder = cells.slice(1).filter(Boolean);
  return Boolean(first) && remainder.length === 0 && first.length <= 8 && /^[A-Z0-9/ -]+$/i.test(first);
}

function parseWorkbookFromPath(workbookPath: string): ImportedBrandSheetData[] {
  const buffer = fs.readFileSync(workbookPath);
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false, dense: true });
  const ignored = new Set(["all", "panel-errors", "bundle-tag-info", "bundle-tags", "bundle-tags2", "__brandlist_meta__"]);
  const sheets: ImportedBrandSheetData[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheetSlug = normalizeSheetName(sheetName);
    if (ignored.has(sheetSlug)) continue;
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<(string | number | boolean | Date | null)[]>(worksheet, {
      header: 1,
      defval: null,
      blankrows: true,
    });

    const headerRowIndex = rawRows.findIndex(isBrandSheetHeaderRow);
    if (headerRowIndex < 0) continue;

    let currentBundleName = "";
    let currentBundleDisplay = "";
    const rows: ImportedBrandListRow[] = [];

    for (let index = headerRowIndex + 1; index < rawRows.length; index += 1) {
      const rawRow = rawRows[index] ?? [];
      const cells = rawRow.map(toCellString);
      const nonEmpty = cells.filter(Boolean).length;
      if (nonEmpty === 0) {
        currentBundleName = "";
        currentBundleDisplay = "";
        continue;
      }
      if (looksLikePrefixHeader(cells)) continue;

      const fromDeviceId = cells[0];
      const wireNo = cells[1];
      const wireId = cells[2];
      const gaugeSize = cells[3];
      const length = parseLengthValue(rawRow[4]);
      const toDeviceId = cells[5];
      const toLocation = cells[6];
      const bundleDisplay = cells[7];
      if (!fromDeviceId && !toDeviceId && !toLocation) continue;

      if (bundleDisplay) {
        currentBundleDisplay = bundleDisplay;
        currentBundleName = deriveBundleName(bundleDisplay, toLocation);
      }
      const effectiveBundleName = currentBundleName || deriveBundleName("", toLocation, fromDeviceId);
      const effectiveBundleDisplay = bundleDisplay || currentBundleDisplay || effectiveBundleName;

      rows.push({
        importedRowId: `${sheetSlug}-${index}`,
        rowIndex: index,
        matchKey: buildBrandImportMatchKey({ fromDeviceId, wireNo, wireId, gaugeSize, toDeviceId, toLocation }),
        fromDeviceId,
        wireNo,
        wireId,
        gaugeSize,
        length,
        toDeviceId,
        toLocation,
        devicePrefix: deriveDevicePrefix(fromDeviceId),
        bundleName: effectiveBundleName,
        bundleDisplay: effectiveBundleDisplay,
      });
    }

    if (!rows.length) continue;
    sheets.push({
      sheetSlug,
      sheetName,
      sourceSheetName: sheetName,
      metadata: {
        normalizedSheetName: sheetSlug,
        bundleNames: Array.from(new Set(rows.map((row) => row.bundleName).filter(Boolean))),
      },
      rows,
    });
  }

  return sheets;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText} from ${url}: ${text}`);
  }
  return response.json() as Promise<T>;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText} from ${url}: ${text}`);
  }
  return response.json() as Promise<T>;
}

async function ensureApiAvailable(baseUrl: string): Promise<void> {
  try {
    await getJson<{ manifests?: StoredProjectManifest[] }>(`${baseUrl}/api/projects`);
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Cannot reach API at ${baseUrl}. Start the app server (pnpm dev) or pass --base-url <reachable-url>. Details: ${details}`,
    );
  }
}

function derivePdNumberFromBrandListDir(brandListDir: string): string {
  return path.basename(path.resolve(brandListDir)).trim().toUpperCase();
}

function listPdDirectories(rootDir: string): string[] {
  return fs
    .readdirSync(rootDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(rootDir, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, { numeric: true, sensitivity: "base" }));
}

function resolveRevisionInfo(cwd: string, pdNumber: string): RevisionInfo {
  const legalProjectRoot = path.join(cwd, "Share", "Legal Drawings", pdNumber);
  const latestJsonPath = path.join(legalProjectRoot, "latest.json");
  const hasManifestForRevision = (revision: string) =>
    fs.existsSync(path.join(legalProjectRoot, revision, "project-manifest.json"));
  const discoverFallbackRevision = (): string => {
    if (!fs.existsSync(legalProjectRoot) || !fs.statSync(legalProjectRoot).isDirectory()) {
      return "unknown";
    }

    const candidates = fs
      .readdirSync(legalProjectRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .filter((name) => hasManifestForRevision(name))
      .map((name) => {
        const manifestPath = path.join(legalProjectRoot, name, "project-manifest.json");
        const mtimeMs = fs.statSync(manifestPath).mtimeMs;
        return { name, mtimeMs };
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs);

    return candidates[0]?.name ?? "unknown";
  };

  if (!fs.existsSync(latestJsonPath)) {
    return { pdNumber, revision: discoverFallbackRevision(), latestJsonPath: null };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(latestJsonPath, "utf-8")) as { latestRevision?: string };
    const preferred = (parsed.latestRevision ?? "").trim();
    const revision = preferred && hasManifestForRevision(preferred)
      ? preferred
      : discoverFallbackRevision();
    return { pdNumber, revision, latestJsonPath };
  } catch {
    return { pdNumber, revision: discoverFallbackRevision(), latestJsonPath };
  }
}

function writeComparisonOutput(cwd: string, revisionInfo: RevisionInfo, payload: unknown): string {
  const compareDir = path.join(cwd, "Share", "Legal Drawings", revisionInfo.pdNumber, revisionInfo.revision);
  fs.mkdirSync(compareDir, { recursive: true });
  const comparePath = path.join(
    compareDir,
    `${revisionInfo.pdNumber}-brandlist-${revisionInfo.revision}-schema-compare.json`,
  );
  fs.writeFileSync(comparePath, `${JSON.stringify(payload, null, 2)}\n`, "utf-8");
  return comparePath;
}

function resolveProjectRootDirectoryById(cwd: string, projectId: string): string | null {
  const projectsRoot = path.join(cwd, "Share", "Projects");
  if (!fs.existsSync(projectsRoot)) {
    return null;
  }

  const entries = fs.readdirSync(projectsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  for (const entry of entries) {
    const projectDir = path.join(projectsRoot, entry.name);
    const manifestPath = path.join(projectDir, "state", "project-manifest.json");
    if (!fs.existsSync(manifestPath)) {
      continue;
    }
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as { id?: string };
      if ((manifest.id ?? "").trim() === projectId) {
        return projectDir;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function listStoredProjectManifestsFromDisk(cwd: string): StoredProjectManifest[] {
  const projectsRoot = path.join(cwd, "Share", "Projects");
  if (!fs.existsSync(projectsRoot)) {
    return [];
  }

  const entries = fs.readdirSync(projectsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
  const manifests: StoredProjectManifest[] = [];

  for (const entry of entries) {
    const manifestPath = path.join(projectsRoot, entry.name, "state", "project-manifest.json");
    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as StoredProjectManifest;
      if ((manifest.id ?? "").trim()) {
        manifests.push(manifest);
      }
    } catch {
      continue;
    }
  }

  return manifests;
}

function mirrorBrandSchemasToLegalDrawings(
  cwd: string,
  projectId: string,
  revisionInfo: RevisionInfo,
): { mirrored: boolean; copiedFiles: number; targetDirectory?: string; error?: string } {
  const projectRoot = resolveProjectRootDirectoryById(cwd, projectId);
  if (!projectRoot) {
    return { mirrored: false, copiedFiles: 0, error: `Project directory not found for project id ${projectId}` };
  }

  const sourceDir = path.join(projectRoot, "state", "wire-brand-list");
  if (!fs.existsSync(sourceDir) || !fs.statSync(sourceDir).isDirectory()) {
    return { mirrored: false, copiedFiles: 0, error: `Source wire-brand-list directory missing: ${sourceDir}` };
  }

  const targetDir = path.join(cwd, "Share", "Legal Drawings", revisionInfo.pdNumber, revisionInfo.revision, "wire-brand-list");
  fs.mkdirSync(targetDir, { recursive: true });

  const files = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name);

  let copiedFiles = 0;
  for (const fileName of files) {
    fs.copyFileSync(path.join(sourceDir, fileName), path.join(targetDir, fileName));
    copiedFiles += 1;
  }

  return { mirrored: true, copiedFiles, targetDirectory: targetDir };
}

function normalizeRevision(value: string | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function compareIsoDateDesc(left?: string, right?: string): number {
  const leftMs = left ? Date.parse(left) : Number.NaN;
  const rightMs = right ? Date.parse(right) : Number.NaN;
  const safeLeft = Number.isNaN(leftMs) ? 0 : leftMs;
  const safeRight = Number.isNaN(rightMs) ? 0 : rightMs;
  return safeRight - safeLeft;
}

async function resolveProjectId(options: CliOptions, pdNumber: string, revision: string): Promise<string> {
  const pdUpper = pdNumber.toUpperCase();
  if (options.projectId) {
    const requested = options.projectId.trim();
    if (!requested) {
      throw new Error("Resolved empty --project-id value");
    }

    // Allow --project-id to be either a true manifest id or a PD number alias.
    // If it is not the PD number for this run, keep prior behavior and use it verbatim.
    if (requested.toUpperCase() !== pdUpper) {
      return requested;
    }
  }

  const localManifests = listStoredProjectManifestsFromDisk(process.cwd());
  let manifests = localManifests;

  if (!manifests.length) {
    try {
      const projectsUrl = `${options.baseUrl}/api/projects`;
      const payload = await getJson<{ manifests?: StoredProjectManifest[] }>(projectsUrl);
      manifests = Array.isArray(payload.manifests) ? payload.manifests : [];
    } catch {
      manifests = [];
    }
  }

  const revisionUpper = normalizeRevision(revision);

  const pdMatches = manifests.filter((manifest) => (manifest.pdNumber ?? "").trim().toUpperCase() === pdUpper);
  if (!pdMatches.length) {
    const legalProjectUrl = `${options.baseUrl}/api/legal-drawings/${encodeURIComponent(pdNumber)}`;
    const legalProject = await getJson<LegalProjectRecordResponse>(legalProjectUrl);
    const latestRevision = (legalProject.latestRevision ?? "").trim();
    const preferredRevision = (revision ?? "").trim();
    const revisionToUse = preferredRevision && preferredRevision !== "unknown"
      ? preferredRevision
      : latestRevision;
    if (!revisionToUse) {
      throw new Error(`Could not auto-resolve project id for pd# ${pdNumber}. No project manifest and no latest legal revision found.`);
    }

    const instantiateUrl = `${options.baseUrl}/api/legal-drawings/instantiate`;
    const instantiatePayload = {
      pdNumber,
      revision: revisionToUse,
      name: (legalProject.projectName ?? legalProject.projectNameHint ?? pdNumber).trim() || pdNumber,
      lwcType: legalProject.lwcType ?? null,
      dueDate: legalProject.dueDate ?? null,
      planConlayDate: legalProject.planConlayDate ?? null,
      planConassyDate: legalProject.planConassyDate ?? null,
      shipDate: legalProject.shipDate ?? null,
      color: legalProject.color ?? null,
    };
    const created = await postJson<InstantiateProjectResponse>(instantiateUrl, instantiatePayload);
    const createdId = created.manifest?.id?.trim();
    if (!createdId) {
      throw new Error(`Could not auto-resolve project id for pd# ${pdNumber}. Instantiate route did not return manifest id.`);
    }
    return createdId;
  }

  if (revisionUpper && revisionUpper !== "UNKNOWN") {
    const revisionMatches = pdMatches.filter((manifest) => normalizeRevision(manifest.revision) === revisionUpper);
    if (revisionMatches.length === 1) {
      return revisionMatches[0].id;
    }
    if (revisionMatches.length > 1) {
      return [...revisionMatches].sort((a, b) => compareIsoDateDesc(a.updatedAt ?? a.createdAt, b.updatedAt ?? b.createdAt))[0].id;
    }
  }

  if (pdMatches.length === 1) {
    return pdMatches[0].id;
  }

  return [...pdMatches].sort((a, b) => compareIsoDateDesc(a.updatedAt ?? a.createdAt, b.updatedAt ?? b.createdAt))[0].id;
}

async function processWorkbook(options: CliOptions, workbook: WorkbookCandidate): Promise<WorkbookRunSummary> {
  if (!options.projectId) {
    throw new Error("Missing resolved project id");
  }
  const workbookName = workbook.fileName;
  const importUrl = `${options.baseUrl}/api/projects/${encodeURIComponent(options.projectId)}/multi-sheet-print/import`;

  try {
    console.log(`[auto-merge-brandlist] processing workbook: ${workbook.fullPath}`);

    const importedSheets = parseWorkbookFromPath(workbook.fullPath);
    if (!importedSheets.length) {
      return {
        workbookFileName: workbookName,
        workbookPath: workbook.fullPath,
        matchedSheets: 0,
        unmatchedSheets: [],
        unchangedRows: 0,
        lengthChangedRows: 0,
        importedOnlyRows: 0,
        currentOnlyRows: 0,
        appliedSheets: 0,
        mirroredToLegalDrawings: false,
        mode: options.mode,
        dryRun: options.dryRun,
        status: "skipped-no-importable-sheets",
      };
    }

    const prepared = await postJson<PrepareResponse>(importUrl, {
      action: "prepare",
      workbookFileName: workbookName,
      importedSheets,
    });

    const rowDecisions: Record<string, ImportDecision> = { ...prepared.importSession.rowDecisions };
    let lengthChanged = 0;
    let unchanged = 0;
    let importedOnly = 0;
    let currentOnly = 0;

    for (const sheetDiff of prepared.sheetDiffs) {
      for (const diff of sheetDiff.diffs) {
        if (diff.changeType === "length-changed") {
          lengthChanged += 1;
          rowDecisions[diff.diffId] = decideImportDecision(diff, options);
        } else if (diff.changeType === "unchanged") {
          unchanged += 1;
          rowDecisions[diff.diffId] = decideImportDecision(diff, options);
        } else if (diff.changeType === "imported-only") {
          importedOnly += 1;
          rowDecisions[diff.diffId] = decideImportDecision(diff, options);
        } else if (diff.changeType === "current-only") {
          currentOnly += 1;
          rowDecisions[diff.diffId] = decideImportDecision(diff, options);
        }
      }
    }

    const hydrated = await postJson<PrepareResponse>(importUrl, {
      action: "hydrate",
      workbookFileName: workbookName,
      importedSheets: prepared.importSession.importedSheets,
      rowDecisions,
    });
    hydrated.importSession.importMode = options.mode;

    if (options.dryRun) {
      return {
        workbookFileName: workbookName,
        workbookPath: workbook.fullPath,
        matchedSheets: hydrated.importSession.matchedSheetSlugs.length,
        unmatchedSheets: hydrated.importSession.unmatchedSheetNames,
        unchangedRows: unchanged,
        lengthChangedRows: lengthChanged,
        importedOnlyRows: importedOnly,
        currentOnlyRows: currentOnly,
        appliedSheets: 0,
        mirroredToLegalDrawings: false,
        mode: options.mode,
        dryRun: true,
        status: "dry-run",
      };
    }

    const applied = await postJson<ApplyResponse>(importUrl, {
      action: "apply",
      importSession: hydrated.importSession,
    });

    return {
      workbookFileName: workbookName,
      workbookPath: workbook.fullPath,
      matchedSheets: hydrated.importSession.matchedSheetSlugs.length,
      unmatchedSheets: hydrated.importSession.unmatchedSheetNames,
      unchangedRows: unchanged,
      lengthChangedRows: lengthChanged,
      importedOnlyRows: importedOnly,
      currentOnlyRows: currentOnly,
      appliedSheets: applied.appliedSheetSlugs.length,
      mirroredToLegalDrawings: false,
      mode: options.mode,
      dryRun: false,
      status: "applied",
    };
  } catch (error) {
    return {
      workbookFileName: workbookName,
      workbookPath: workbook.fullPath,
      matchedSheets: 0,
      unmatchedSheets: [],
      unchangedRows: 0,
      lengthChangedRows: 0,
      importedOnlyRows: 0,
      currentOnlyRows: 0,
      appliedSheets: 0,
      mirroredToLegalDrawings: false,
      mode: options.mode,
      dryRun: options.dryRun,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function processPdFolder(options: CliOptions, brandListDir: string): Promise<PdFolderRunSummary> {
  const cwd = process.cwd();
  const pdNumber = derivePdNumberFromBrandListDir(brandListDir);
  const revisionInfo = resolveRevisionInfo(cwd, pdNumber);
  const workbookCandidates = listWorkbookCandidates(brandListDir);
  if (!workbookCandidates.length) {
    return {
      pdNumber,
      brandListDir,
      revision: revisionInfo.revision,
      status: "skipped-no-workbooks",
      workbookCount: 0,
      summaries: [],
      error: `No workbook files found in ${brandListDir}`,
    };
  }

  // --legal-drawings-only: skip project lookup/creation entirely.
  // Require the Legal Drawings folder to already exist for this PD number.
  if (options.legalDrawingsOnly) {
    const legalRoot = path.join(cwd, "Share", "Legal Drawings");
    const legalFolderExists = fs.existsSync(path.join(legalRoot, pdNumber))
      || fs.existsSync(path.join(legalRoot, pdNumber.toUpperCase()))
      || (() => {
        if (!fs.existsSync(legalRoot)) return false;
        return fs.readdirSync(legalRoot, { withFileTypes: true })
          .filter((e) => e.isDirectory())
          .some((e) => e.name.toUpperCase().startsWith(pdNumber.toUpperCase()));
      })();

    if (!legalFolderExists) {
      return {
        pdNumber,
        brandListDir,
        revision: revisionInfo.revision,
        status: "skipped-no-project",
        workbookCount: 0,
        summaries: [],
        error: `No Legal Drawings folder found for pd# ${pdNumber} — skipped`,
      };
    }

    // Generate schemas directly from the brand list files without touching any project,
    // then mirror them straight into Legal Drawings.
    const selectedWorkbooks = options.allFiles
      ? workbookCandidates
      : [workbookCandidates[0]];

    console.log(`[auto-merge-brandlist] legal-drawings-only pd#: ${pdNumber}`);
    console.log(`[auto-merge-brandlist] revision: ${revisionInfo.revision}`);
    console.log(`[auto-merge-brandlist] folder: ${brandListDir}`);

    // Write the brand-list schema JSON files directly into the Legal Drawings revision folder.
    const targetRevisionDir = path.join(legalRoot, pdNumber, revisionInfo.revision, "wire-brand-list");
    fs.mkdirSync(targetRevisionDir, { recursive: true });

    const summaries: WorkbookRunSummary[] = [];
    for (const workbook of selectedWorkbooks) {
      try {
        const sheets = parseWorkbookFromPath(workbook.fullPath);
        if (!sheets.length) {
          summaries.push({
            workbookFileName: workbook.fileName,
            workbookPath: workbook.fullPath,
            matchedSheets: 0,
            unmatchedSheets: [],
            unchangedRows: 0,
            lengthChangedRows: 0,
            importedOnlyRows: 0,
            currentOnlyRows: 0,
            appliedSheets: options.dryRun ? 0 : 0,
            mirroredToLegalDrawings: false,
            mode: options.mode,
            dryRun: options.dryRun,
            status: "skipped-no-importable-sheets",
          });
          continue;
        }

        if (!options.dryRun) {
          for (const sheet of sheets) {
            const outPath = path.join(targetRevisionDir, `${sheet.sheetSlug}.json`);
            fs.writeFileSync(outPath, `${JSON.stringify(sheet, null, 2)}\n`, "utf-8");
          }
          console.log(`[auto-merge-brandlist] wrote ${sheets.length} sheet schema(s) to ${targetRevisionDir}`);
        }

        summaries.push({
          workbookFileName: workbook.fileName,
          workbookPath: workbook.fullPath,
          matchedSheets: sheets.length,
          unmatchedSheets: [],
          unchangedRows: 0,
          lengthChangedRows: 0,
          importedOnlyRows: 0,
          currentOnlyRows: 0,
          appliedSheets: options.dryRun ? 0 : sheets.length,
          mirroredToLegalDrawings: !options.dryRun,
          mode: options.mode,
          dryRun: options.dryRun,
          status: options.dryRun ? "dry-run" : "applied",
        });
      } catch (error) {
        summaries.push({
          workbookFileName: workbook.fileName,
          workbookPath: workbook.fullPath,
          matchedSheets: 0,
          unmatchedSheets: [],
          unchangedRows: 0,
          lengthChangedRows: 0,
          importedOnlyRows: 0,
          currentOnlyRows: 0,
          appliedSheets: 0,
          mirroredToLegalDrawings: false,
          mode: options.mode,
          dryRun: options.dryRun,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const comparePath = writeComparisonOutput(cwd, revisionInfo, {
      generatedAt: new Date().toISOString(),
      pdNumber,
      revision: revisionInfo.revision,
      legalDrawingsOnly: true,
      targetDirectory: targetRevisionDir,
      dryRun: options.dryRun,
      summaries,
    });

    return {
      pdNumber,
      brandListDir,
      revision: revisionInfo.revision,
      status: "completed",
      comparisonOutputPath: comparePath,
      workbookCount: selectedWorkbooks.length,
      summaries,
    };
  }

  let resolvedProjectId: string;
  try {
    resolvedProjectId = await resolveProjectId(options, pdNumber, revisionInfo.revision);
  } catch (error) {
    const skippedPayload = {
      generatedAt: new Date().toISOString(),
      projectId: null,
      pdNumber,
      revision: revisionInfo.revision,
      latestJsonPath: revisionInfo.latestJsonPath,
      mode: options.mode,
      decisionPolicy: options.decisionPolicy,
      structuralAccept: options.structuralAccept,
      fileSelection: options.allFiles ? "all-files" : "latest-only",
      sourceBrandListDirectory: brandListDir,
      selectedWorkbookCount: 0,
      selectedWorkbooks: [],
      dryRun: options.dryRun,
      skippedReason: error instanceof Error ? error.message : String(error),
      summaries: [] as WorkbookRunSummary[],
    };
    const comparePath = writeComparisonOutput(cwd, revisionInfo, skippedPayload);
    return {
      pdNumber,
      brandListDir,
      revision: revisionInfo.revision,
      status: "skipped-no-project",
      comparisonOutputPath: comparePath,
      workbookCount: 0,
      summaries: [],
      error: skippedPayload.skippedReason,
    };
  }
  const selectedWorkbooks = options.allFiles
    ? workbookCandidates
    : [workbookCandidates[0]];

  console.log(`[auto-merge-brandlist] pd#: ${pdNumber}`);
  console.log(`[auto-merge-brandlist] revision: ${revisionInfo.revision}`);
  console.log(`[auto-merge-brandlist] folder: ${brandListDir}`);
  console.log(`[auto-merge-brandlist] project id: ${resolvedProjectId}`);
  console.log(`[auto-merge-brandlist] decision policy: ${options.decisionPolicy}`);
  console.log(`[auto-merge-brandlist] structural accept: ${options.structuralAccept}`);
  console.log(`[auto-merge-brandlist] file mode: ${options.allFiles ? "all-files" : "latest-only"}`);
  console.log(`[auto-merge-brandlist] selected workbook count: ${selectedWorkbooks.length}`);

  const resyncTerminalsUrl = `${options.baseUrl}/api/projects/${encodeURIComponent(resolvedProjectId)}/parts/resync-terminals`;
  const terminalResync = await postJson<ResyncTerminalsResponse>(resyncTerminalsUrl, {});
  console.log(
    `[auto-merge-brandlist] terminal schema resync: updatedParts=${terminalResync.updatedPartCount ?? 0}`,
  );

  const generateUrl = `${options.baseUrl}/api/projects/${encodeURIComponent(resolvedProjectId)}/wire-brand-list-schemas`;
  await postJson(generateUrl, { mode: "all" });
  console.log("[auto-merge-brandlist] generated current wire-brand-list schemas");

  const summaries: WorkbookRunSummary[] = [];
  const runOptions: CliOptions = {
    ...options,
    projectId: resolvedProjectId,
  };
  for (const workbook of selectedWorkbooks) {
    const summary = await processWorkbook(runOptions, workbook);
    summaries.push(summary);
    console.log(
      `[auto-merge-brandlist] ${summary.workbookFileName}: status=${summary.status}, matchedSheets=${summary.matchedSheets}, lengthChanged=${summary.lengthChangedRows}, appliedSheets=${summary.appliedSheets}`,
    );
    if (summary.error) {
      console.log(`[auto-merge-brandlist] ${summary.workbookFileName} error: ${summary.error}`);
    }
  }

  let mirrorResult:
    | { mirrored: boolean; copiedFiles: number; targetDirectory?: string; error?: string }
    | null = null;
  if (!options.dryRun && (options.target === "legal-drawings" || options.target === "both")) {
    mirrorResult = mirrorBrandSchemasToLegalDrawings(cwd, resolvedProjectId, revisionInfo);
    if (!mirrorResult.mirrored) {
      console.log(`[auto-merge-brandlist] mirror warning: ${mirrorResult.error}`);
    } else {
      console.log(`[auto-merge-brandlist] mirrored ${mirrorResult.copiedFiles} schema files to ${mirrorResult.targetDirectory}`);
      for (const summary of summaries) {
        if (summary.status === "applied") {
          summary.mirroredToLegalDrawings = true;
        }
      }
    }
  }

  const comparisonPayload = {
    generatedAt: new Date().toISOString(),
    projectId: resolvedProjectId,
    pdNumber,
    revision: revisionInfo.revision,
    latestJsonPath: revisionInfo.latestJsonPath,
    mode: options.mode,
    decisionPolicy: options.decisionPolicy,
    structuralAccept: options.structuralAccept,
    target: options.target,
    fileSelection: options.allFiles ? "all-files" : "latest-only",
    sourceBrandListDirectory: brandListDir,
    selectedWorkbookCount: selectedWorkbooks.length,
    selectedWorkbooks: selectedWorkbooks.map((workbook) => ({
      fileName: workbook.fileName,
      fullPath: workbook.fullPath,
      mtimeMs: workbook.mtimeMs,
      mtimeIso: new Date(workbook.mtimeMs).toISOString(),
    })),
    dryRun: options.dryRun,
    terminalResync: {
      updatedPartCount: terminalResync.updatedPartCount ?? 0,
      updatedParts: terminalResync.updatedParts ?? [],
      syncedAt: terminalResync.syncedAt ?? null,
    },
    mirror: mirrorResult,
    summaries,
  };

  const comparePath = writeComparisonOutput(cwd, revisionInfo, comparisonPayload);
  console.log(`[auto-merge-brandlist] comparison output: ${comparePath}`);

  return {
    pdNumber,
    brandListDir,
    projectId: resolvedProjectId,
    revision: revisionInfo.revision,
    status: "completed",
    comparisonOutputPath: comparePath,
    workbookCount: selectedWorkbooks.length,
    summaries,
  };
}

function shouldTreatAsRootBrandListDirectory(dir: string): boolean {
  const children = listPdDirectories(dir);
  if (!children.length) return false;
  return children.some((childDir) => listWorkbookCandidates(childDir).length > 0);
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  await ensureApiAvailable(options.baseUrl);
  const rootMode = shouldTreatAsRootBrandListDirectory(options.brandListDir);
  const targetDirectories = rootMode ? listPdDirectories(options.brandListDir) : [options.brandListDir];

  if (rootMode) {
    console.log(`[auto-merge-brandlist] root mode detected: processing ${targetDirectories.length} PD folders`);
  }

  const pdResults: PdFolderRunSummary[] = [];
  for (const dir of targetDirectories) {
    try {
      const result = await processPdFolder(options, dir);
      pdResults.push(result);
    } catch (error) {
      const pdNumber = derivePdNumberFromBrandListDir(dir);
      pdResults.push({
        pdNumber,
        brandListDir: dir,
        status: "failed",
        workbookCount: 0,
        summaries: [],
        error: error instanceof Error ? error.message : String(error),
      });
      console.log(`[auto-merge-brandlist] ${pdNumber}: failed (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  const completed = pdResults.filter((r) => r.status === "completed").length;
  const skippedNoWorkbooks = pdResults.filter((r) => r.status === "skipped-no-workbooks").length;
  const skippedNoProject = pdResults.filter((r) => r.status === "skipped-no-project").length;
  const failed = pdResults.filter((r) => r.status === "failed").length;
  console.log(`[auto-merge-brandlist] run summary: completed=${completed}, skipped-no-workbooks=${skippedNoWorkbooks}, skipped-no-project=${skippedNoProject}, failed=${failed}`);
}

void run().catch((error) => {
  console.error(`[auto-merge-brandlist] failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
