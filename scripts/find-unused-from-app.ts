import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";

const workspaceRoot = process.cwd();

const SOURCE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
] as const;

const TARGET_DIRECTORIES = ["components", "lib", "types"] as const;
const QUARANTINE_ROOT = ".unused-from-app-quarantine";
const DEFAULT_ALLOWLIST_PATH = "scripts/unused-from-app.allowlist.txt";
const BARREL_FILE_NAMES = new Set([
  "index.ts",
  "index.tsx",
  "index.js",
  "index.jsx",
]);

const IMPORT_SPECIFIER_PATTERNS = [
  /\bimport\s+[^"'`]*?\s+from\s+["'`]([^"'`]+)["'`]/g,
  /\bexport\s+[^"'`]*?\s+from\s+["'`]([^"'`]+)["'`]/g,
  /\bimport\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
  /\brequire\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/g,
] as const;

type CliOptions = {
  json: boolean;
  quarantine: boolean;
  restoreRunId: string | null;
  restoreLatest: boolean;
  verifyBuild: boolean;
  rollbackOnFailure: boolean;
  cleanupBarrels: boolean;
  allowlistPath: string;
  onlyDirs: string[];
  limit: number | null;
  help: boolean;
};

function parseCliOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    quarantine: false,
    restoreRunId: null,
    restoreLatest: false,
    verifyBuild: false,
    rollbackOnFailure: false,
    cleanupBarrels: false,
    allowlistPath: path.join(workspaceRoot, DEFAULT_ALLOWLIST_PATH),
    onlyDirs: [],
    limit: null,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) continue;

    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--quarantine") {
      options.quarantine = true;
      continue;
    }
    if (arg === "--restore-latest") {
      options.restoreLatest = true;
      continue;
    }
    if (arg === "--verify-build") {
      options.verifyBuild = true;
      continue;
    }
    if (arg === "--rollback-on-failure") {
      options.rollbackOnFailure = true;
      continue;
    }
    if (arg === "--cleanup-barrels") {
      options.cleanupBarrels = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    if (arg === "--restore") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value for --restore <runId>");
      }
      options.restoreRunId = next;
      index += 1;
      continue;
    }
    if (arg === "--allowlist") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value for --allowlist <path>");
      }
      options.allowlistPath = path.resolve(next);
      index += 1;
      continue;
    }
    if (arg === "--only-dir") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value for --only-dir <path>");
      }
      options.onlyDirs.push(normalizeDirFilter(next));
      index += 1;
      continue;
    }
    if (arg === "--limit") {
      const next = argv[index + 1];
      if (!next) {
        throw new Error("Missing value for --limit <number>");
      }
      const parsed = Number.parseInt(next, 10);
      if (!Number.isFinite(parsed) || Number.isNaN(parsed) || parsed < 0) {
        throw new Error(`Invalid --limit value: ${next}`);
      }
      options.limit = parsed;
      index += 1;
      continue;
    }
  }

  return options;
}

function printHelp() {
  console.log("find-unused-from-app");
  console.log("\nUsage:");
  console.log("  pnpm analyze:unused-from-app [-- --json]");
  console.log("  pnpm analyze:unused-from-app -- --quarantine [--limit N] [--only-dir path] [--cleanup-barrels] [--verify-build] [--rollback-on-failure]");
  console.log("  pnpm analyze:unused-from-app -- --restore-latest");
  console.log("  pnpm analyze:unused-from-app -- --restore <runId>");
  console.log("\nOptions:");
  console.log("  --json                  Output machine-readable report");
  console.log("  --quarantine            Move candidates to quarantine instead of deleting");
  console.log("  --verify-build          Run pnpm build after quarantine");
  console.log("  --rollback-on-failure   Restore files automatically if build check fails");
  console.log("  --cleanup-barrels       Remove export lines in index barrels for quarantined files");
  console.log("  --allowlist <path>      Allowlist file path (default scripts/unused-from-app.allowlist.txt)");
  console.log("  --only-dir <path>       Restrict candidates to a specific directory (repeatable)");
  console.log("  --limit <n>             Limit number of files moved in quarantine mode");
  console.log("  --restore <runId>       Restore a specific quarantine run");
  console.log("  --restore-latest        Restore the latest quarantine run");
  console.log("  --help                  Show this help");
}

function normalizeDirFilter(inputPath: string): string {
  const normalized = inputPath.replaceAll("\\", "/").trim();
  if (!normalized) {
    return normalized;
  }

  let relativePath = normalized;
  if (path.isAbsolute(normalized)) {
    relativePath = path.relative(workspaceRoot, normalized).replaceAll("\\", "/");
  }

  return relativePath.replace(/^\.\/+/, "").replace(/^\/+/, "").replace(/\/+$/, "");
}

function normalizeFilePath(filePath: string): string {
  return path.resolve(filePath);
}

function toRelative(filePath: string): string {
  return path.relative(workspaceRoot, filePath).split(path.sep).join("/");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isSourceFile(filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  return SOURCE_EXTENSIONS.includes(extension as (typeof SOURCE_EXTENSIONS)[number]);
}

async function walkDirectory(
  root: string,
  onFile: (filePath: string) => void,
): Promise<void> {
  if (!(await pathExists(root))) {
    return;
  }

  const entries = await fs.readdir(root, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);

    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules"
        || entry.name === ".next"
        || entry.name === ".git"
        || entry.name === "dist"
        || entry.name === "dist-electron"
      ) {
        continue;
      }
      await walkDirectory(fullPath, onFile);
      continue;
    }

    if (isSourceFile(entry.name)) {
      onFile(normalizeFilePath(fullPath));
    }
  }
}

async function ensureDirectory(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

async function removeDirectoryIfEmpty(targetPath: string): Promise<void> {
  try {
    const entries = await fs.readdir(targetPath);
    if (entries.length === 0) {
      await fs.rmdir(targetPath);
    }
  } catch {
    // Best effort cleanup only.
  }
}

function isLocalSpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("./")
    || specifier.startsWith("../")
    || specifier.startsWith("@/")
    || specifier.startsWith("/")
  );
}

function extractLocalSpecifiers(fileContent: string): string[] {
  const results = new Set<string>();

  for (const pattern of IMPORT_SPECIFIER_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(fileContent)) !== null) {
      const specifier = String(match[1] ?? "").trim();
      if (!specifier) {
        continue;
      }
      if (
        isLocalSpecifier(specifier)
      ) {
        results.add(specifier);
      }
    }
  }

  return [...results];
}

function resolveImportPathCandidates(importerFile: string, specifier: string): string[] {
  let basePath: string;
  if (specifier.startsWith("@/")) {
    basePath = path.join(workspaceRoot, specifier.slice(2));
  } else if (specifier.startsWith("/")) {
    basePath = path.join(workspaceRoot, specifier.slice(1));
  } else {
    basePath = path.resolve(path.dirname(importerFile), specifier);
  }

  const candidates = new Set<string>();
  candidates.add(normalizeFilePath(basePath));

  for (const extension of SOURCE_EXTENSIONS) {
    candidates.add(normalizeFilePath(`${basePath}${extension}`));
    candidates.add(normalizeFilePath(path.join(basePath, `index${extension}`)));
  }

  return [...candidates];
}

async function resolveImportPath(importerFile: string, specifier: string): Promise<string | null> {
  let basePath: string;
  if (specifier.startsWith("@/")) {
    basePath = path.join(workspaceRoot, specifier.slice(2));
  } else if (specifier.startsWith("/")) {
    basePath = path.join(workspaceRoot, specifier.slice(1));
  } else {
    basePath = path.resolve(path.dirname(importerFile), specifier);
  }

  // Direct file with extension
  if (await pathExists(basePath)) {
    const stat = await fs.stat(basePath).catch(() => null);
    if (stat?.isFile()) {
      return normalizeFilePath(basePath);
    }
  }

  // Try extension candidates
  for (const ext of SOURCE_EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (await pathExists(candidate)) {
      return normalizeFilePath(candidate);
    }
  }

  // Directory index candidates
  for (const ext of SOURCE_EXTENSIONS) {
    const candidate = path.join(basePath, `index${ext}`);
    if (await pathExists(candidate)) {
      return normalizeFilePath(candidate);
    }
  }

  return null;
}

async function buildReachableFromApp(): Promise<Set<string>> {
  const appRoot = path.join(workspaceRoot, "app");
  const appFiles: string[] = [];
  await walkDirectory(appRoot, (filePath) => {
    appFiles.push(filePath);
  });

  const visited = new Set<string>();
  const queue = [...appFiles];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current)) {
      continue;
    }

    visited.add(current);

    const content = await fs.readFile(current, "utf8").catch(() => "");
    if (!content) {
      continue;
    }

    const specifiers = extractLocalSpecifiers(content);
    for (const specifier of specifiers) {
      const resolved = await resolveImportPath(current, specifier);
      if (!resolved || visited.has(resolved)) {
        continue;
      }
      queue.push(resolved);
    }
  }

  return visited;
}

async function collectTargetFiles(): Promise<string[]> {
  const targets: string[] = [];

  for (const dirName of TARGET_DIRECTORIES) {
    const dirPath = path.join(workspaceRoot, dirName);
    await walkDirectory(dirPath, (filePath) => {
      targets.push(filePath);
    });
  }

  return targets;
}

type AllowlistRule = {
  raw: string;
  kind: "exact" | "prefix";
  value: string;
};

async function loadAllowlist(filePath: string): Promise<AllowlistRule[]> {
  if (!(await pathExists(filePath))) {
    return [];
  }

  const content = await fs.readFile(filePath, "utf8");
  const lines = content.split(/\r?\n/);
  const rules: AllowlistRule[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const normalized = trimmed.replaceAll("\\", "/");
    if (normalized.endsWith("/**")) {
      rules.push({
        raw: normalized,
        kind: "prefix",
        value: normalized.slice(0, -3),
      });
    } else {
      rules.push({
        raw: normalized,
        kind: "exact",
        value: normalized,
      });
    }
  }

  return rules;
}

function isAllowlisted(relativePath: string, rules: AllowlistRule[]): boolean {
  const normalized = relativePath.replaceAll("\\", "/");

  return rules.some((rule) => {
    if (rule.kind === "exact") {
      return normalized === rule.value;
    }
    return normalized.startsWith(rule.value);
  });
}

type QuarantineManifestEntry = {
  relativePath: string;
  from: string;
  to: string;
};

type BarrelCleanupEntry = {
  relativePath: string;
  filePath: string;
  backupPath: string;
  removedLineCount: number;
};

type QuarantineManifest = {
  runId: string;
  createdAt: string;
  workspaceRoot: string;
  verifyBuild: boolean;
  rollbackOnFailure: boolean;
  cleanupBarrels: boolean;
  onlyDirs: string[];
  movedFiles: QuarantineManifestEntry[];
  cleanedBarrels: BarrelCleanupEntry[];
};

function createRunId(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    "-",
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join("");
}

function getRunDirectory(runId: string): string {
  return path.join(workspaceRoot, QUARANTINE_ROOT, runId);
}

function getManifestPath(runId: string): string {
  return path.join(getRunDirectory(runId), "manifest.json");
}

async function writeManifest(manifest: QuarantineManifest): Promise<void> {
  const manifestPath = getManifestPath(manifest.runId);
  await ensureDirectory(path.dirname(manifestPath));
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
}

async function readManifest(runId: string): Promise<QuarantineManifest> {
  const manifestPath = getManifestPath(runId);
  const content = await fs.readFile(manifestPath, "utf8");
  return JSON.parse(content) as QuarantineManifest;
}

async function getLatestRunId(): Promise<string | null> {
  const root = path.join(workspaceRoot, QUARANTINE_ROOT);
  if (!(await pathExists(root))) {
    return null;
  }

  const entries = await fs.readdir(root, { withFileTypes: true });
  const runIds = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left));

  return runIds[0] ?? null;
}

function isInsideOnlyDirs(relativePath: string, onlyDirs: string[]): boolean {
  if (onlyDirs.length === 0) {
    return true;
  }

  return onlyDirs.some((dir) => relativePath === dir || relativePath.startsWith(`${dir}/`));
}

async function collectBarrelFiles(): Promise<string[]> {
  const barrels: string[] = [];

  for (const dirName of TARGET_DIRECTORIES) {
    const dirPath = path.join(workspaceRoot, dirName);
    await walkDirectory(dirPath, (filePath) => {
      if (BARREL_FILE_NAMES.has(path.basename(filePath))) {
        barrels.push(filePath);
      }
    });
  }

  return barrels;
}

async function cleanupBarrelExportsForMovedFiles(
  movedSourcePaths: Set<string>,
  runId: string,
): Promise<BarrelCleanupEntry[]> {
  const barrelFiles = await collectBarrelFiles();
  const backupRoot = path.join(getRunDirectory(runId), "barrel-backups");
  const exportFromPattern = /^\s*export\b.*\bfrom\s+["'`]([^"'`]+)["'`]\s*;?\s*$/;
  const cleaned: BarrelCleanupEntry[] = [];

  for (const barrelPath of barrelFiles) {
    const original = await fs.readFile(barrelPath, "utf8").catch(() => "");
    if (!original) {
      continue;
    }

    const lines = original.split(/\r?\n/);
    const kept: string[] = [];
    let removedLineCount = 0;

    for (const line of lines) {
      const match = line.match(exportFromPattern);
      if (!match) {
        kept.push(line);
        continue;
      }

      const specifier = String(match[1] ?? "").trim();
      if (!isLocalSpecifier(specifier)) {
        kept.push(line);
        continue;
      }

      const candidates = resolveImportPathCandidates(barrelPath, specifier);
      const pointsToMovedFile = candidates.some((candidate) => movedSourcePaths.has(candidate));
      if (!pointsToMovedFile) {
        kept.push(line);
        continue;
      }

      removedLineCount += 1;
    }

    if (removedLineCount === 0) {
      continue;
    }

    const relativePath = toRelative(barrelPath);
    const backupPath = path.join(backupRoot, `${relativePath}.bak`);
    await ensureDirectory(path.dirname(backupPath));
    await fs.writeFile(backupPath, original, "utf8");

    const nextContent = `${kept.join("\n")}${original.endsWith("\n") ? "\n" : ""}`;
    await fs.writeFile(barrelPath, nextContent, "utf8");

    cleaned.push({
      relativePath,
      filePath: barrelPath,
      backupPath,
      removedLineCount,
    });
  }

  return cleaned;
}

async function quarantineFiles(
  files: string[],
  options: Pick<
    CliOptions,
    "verifyBuild" | "rollbackOnFailure" | "limit" | "cleanupBarrels" | "onlyDirs"
  >,
): Promise<{ runId: string; moved: QuarantineManifestEntry[]; buildPassed: boolean }> {
  const runId = createRunId();
  const runDir = getRunDirectory(runId);
  const filesRoot = path.join(runDir, "files");
  await ensureDirectory(filesRoot);

  const filesToMove = options.limit === null ? files : files.slice(0, options.limit);
  const moved: QuarantineManifestEntry[] = [];

  for (const sourceAbsPath of filesToMove) {
    const relativePath = toRelative(sourceAbsPath);
    const destination = path.join(filesRoot, relativePath);
    await ensureDirectory(path.dirname(destination));
    await fs.rename(sourceAbsPath, destination);
    moved.push({
      relativePath,
      from: sourceAbsPath,
      to: destination,
    });
  }

  const movedSourcePaths = new Set(moved.map((entry) => entry.from));
  const cleanedBarrels = options.cleanupBarrels
    ? await cleanupBarrelExportsForMovedFiles(movedSourcePaths, runId)
    : [];

  const manifest: QuarantineManifest = {
    runId,
    createdAt: new Date().toISOString(),
    workspaceRoot,
    verifyBuild: options.verifyBuild,
    rollbackOnFailure: options.rollbackOnFailure,
    cleanupBarrels: options.cleanupBarrels,
    onlyDirs: options.onlyDirs,
    movedFiles: moved,
    cleanedBarrels,
  };
  await writeManifest(manifest);

  if (!options.verifyBuild) {
    return { runId, moved, buildPassed: true };
  }

  const build = spawnSync("pnpm", ["build"], {
    cwd: workspaceRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  const buildPassed = build.status === 0;

  if (!buildPassed && options.rollbackOnFailure) {
    await restoreRun(runId);
  }

  return { runId, moved, buildPassed };
}

async function restoreRun(runId: string): Promise<number> {
  const manifest = await readManifest(runId);
  let restoredCount = 0;
  let restoredBarrels = 0;

  for (const entry of manifest.cleanedBarrels ?? []) {
    if (!(await pathExists(entry.backupPath))) {
      continue;
    }

    await ensureDirectory(path.dirname(entry.filePath));
    const backupContent = await fs.readFile(entry.backupPath, "utf8");
    await fs.writeFile(entry.filePath, backupContent, "utf8");
    restoredBarrels += 1;
  }

  for (const entry of manifest.movedFiles.slice().reverse()) {
    const source = entry.to;
    const destination = entry.from;

    if (!(await pathExists(source))) {
      continue;
    }

    await ensureDirectory(path.dirname(destination));
    await fs.rename(source, destination);
    restoredCount += 1;

    await removeDirectoryIfEmpty(path.dirname(source));
  }

  console.log(`Restored barrel files: ${restoredBarrels}`);
  return restoredCount;
}

function printSummary(
  targetFiles: string[],
  rawUnused: string[],
  candidates: string[],
  allowlistRules: AllowlistRule[],
  onlyDirs: string[],
) {
  console.log("Unused files not reachable from app import graph");
  console.log(`Targets scanned: ${targetFiles.length}`);
  console.log(`Raw unused: ${rawUnused.length}`);
  console.log(`After allowlist: ${candidates.length}`);
  console.log(`Allowlist rules: ${allowlistRules.length}`);
  if (onlyDirs.length > 0) {
    console.log(`Directory filter: ${onlyDirs.join(", ")}`);
  }
}

async function main() {
  const options = parseCliOptions(process.argv.slice(2));

  if (options.help) {
    printHelp();
    return;
  }

  if (options.restoreRunId || options.restoreLatest) {
    const runId = options.restoreRunId ?? (await getLatestRunId());
    if (!runId) {
      console.log("No quarantine run found to restore.");
      return;
    }

    const restored = await restoreRun(runId);
    console.log(`Restored ${restored} files from run ${runId}.`);
    return;
  }

  const reachable = await buildReachableFromApp();
  const targetFiles = await collectTargetFiles();
  const allowlistRules = await loadAllowlist(options.allowlistPath);

  const rawUnused = targetFiles
    .filter((filePath) => !reachable.has(filePath))
    .sort((left, right) => left.localeCompare(right));
  const candidates = rawUnused.filter((filePath) => {
    const relative = toRelative(filePath);
    return !isAllowlisted(relative, allowlistRules) && isInsideOnlyDirs(relative, options.onlyDirs);
  });

  if (options.json) {
    const payload = {
      workspaceRoot,
      scannedRoot: "app",
      allowlistPath: path.relative(workspaceRoot, options.allowlistPath),
      onlyDirs: options.onlyDirs,
      targetDirectories: [...TARGET_DIRECTORIES],
      totalTargets: targetFiles.length,
      rawUnusedCount: rawUnused.length,
      candidateCount: candidates.length,
      candidates: candidates.map(toRelative),
    };
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  printSummary(targetFiles, rawUnused, candidates, allowlistRules, options.onlyDirs);

  if (candidates.length === 0) {
    console.log("No unused files found.");
    return;
  }

  if (options.quarantine) {
    const { runId, moved, buildPassed } = await quarantineFiles(candidates, {
      verifyBuild: options.verifyBuild,
      rollbackOnFailure: options.rollbackOnFailure,
      limit: options.limit,
      cleanupBarrels: options.cleanupBarrels,
      onlyDirs: options.onlyDirs,
    });

    console.log(`\nQuarantine run: ${runId}`);
    console.log(`Moved files: ${moved.length}`);
    if (options.limit !== null) {
      console.log(`Move limit: ${options.limit}`);
    }

    if (options.verifyBuild) {
      console.log(`Build verification: ${buildPassed ? "passed" : "failed"}`);
      if (!buildPassed && options.rollbackOnFailure) {
        console.log("Rollback completed due to failed build verification.");
      }
    }

    if (options.cleanupBarrels) {
      console.log("Barrel cleanup: enabled");
    }

    console.log(`Restore command: pnpm analyze:unused-from-app -- --restore ${runId}`);
    return;
  }

  console.log("\nCandidates:");
  for (const filePath of candidates) {
    console.log(`- ${toRelative(filePath)}`);
  }

  console.log("\nSafety tips:");
  console.log("- Use --quarantine to move files without deleting them.");
  console.log("- Use --verify-build --rollback-on-failure for automatic protection.");
  console.log("- Use --cleanup-barrels to remove stale exports from index barrels.");
  console.log("- Use --only-dir components/d380/assignment-workspace to scope cleanup.");
  console.log("- Add exceptions to scripts/unused-from-app.allowlist.txt.");
  console.log("\nNote: dynamic runtime path usage can produce false positives.");
}

void main();
