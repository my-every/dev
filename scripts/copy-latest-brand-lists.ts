import fs from "node:fs";
import path from "node:path";
import process from "node:process";

interface CliOptions {
  sourceRoot: string;
  outputRoot: string;
  dryRun: boolean;
  pdFilter: string | null;
  fromYear: number;
  fromTimeMs: number;
  latestOnly: boolean;
}

interface ProjectCandidate {
  projectFolderName: string;
  projectFolderPath: string;
  pdNumber: string;
}

interface ExcelFileMatch {
  fullPath: string;
  fileName: string;
  mtimeMs: number;
}

interface CopiedFileResult {
  sourcePath: string;
  fileName: string;
  mtimeMs: number;
  destinationPath: string;
}

type ProjectCopyResult =
  | {
    projectFolderName: string;
    pdNumber: string;
    copiedFiles: CopiedFileResult[];
    action: "copied";
  }
  | {
    projectFolderName: string;
    pdNumber: string;
    copiedFiles: [];
    action: "skipped-no-excel" | "skipped-filter";
  };

const DEFAULT_SOURCE_ROOT = String.raw`S:\#Depts\380\6SIGMABRANDLIST\BRANDING\Projects Folder`;

function printUsage(): void {
  console.log(
    [
      "Usage:",
      "  pnpm legal:brandlists:copy",
      '  pnpm legal:brandlists:copy -- --source "S:\\#Depts\\380\\6SIGMABRANDLIST\\BRANDING\\Projects Folder" --dry-run',
      "  pnpm legal:brandlists:copy -- --pd PD1234",
      "",
      "Options:",
      "  --source <path>       Source Projects Folder path.",
      `                       Default: ${DEFAULT_SOURCE_ROOT}`,
      "  --output <path>       Output root directory.",
      "                       Default: <cwd>/Brand Lists",
      "  --pd <PDNumber>       Copy only one PD number, case-insensitive.",
      "  --from-year <yr>      Copy files modified on/after Jan 1 of this year.",
      `                       Default: ${new Date().getFullYear()}`,
      "  --latest-only         Copy only the newest matching Excel file per project.",
      "  --dry-run             Print what would be copied without writing files.",
      "  --help                Show this help text.",
      "",
      "Expected source shape:",
      "  <source>/<PDNumber>_<ProjectName>/*.xlsx",
      "",
      "Output shape:",
      "  ./Brand Lists/<PDNumber>/<excel-file>",
    ].join("\n"),
  );
}

function parseArgs(argv: string[]): CliOptions {
  let sourceRoot = DEFAULT_SOURCE_ROOT;
  let outputRoot = path.join(process.cwd(), "Brand Lists");
  let dryRun = false;
  let pdFilter: string | null = null;
  let fromYear = new Date().getFullYear();
  let latestOnly = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--") {
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    if (arg === "--source") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --source");
      sourceRoot = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--output") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --output");
      outputRoot = path.resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--pd") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --pd");

      pdFilter = normalizePdNumber(value);
      if (!pdFilter) throw new Error("Invalid --pd value");

      index += 1;
      continue;
    }

    if (arg === "--from-year") {
      const value = argv[index + 1];
      if (!value) throw new Error("Missing value for --from-year");

      fromYear = Number.parseInt(value, 10);
      if (!Number.isInteger(fromYear) || fromYear < 1900) {
        throw new Error(`Invalid --from-year value: ${value}`);
      }

      index += 1;
      continue;
    }

    if (arg === "--latest-only") {
      latestOnly = true;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    sourceRoot,
    outputRoot,
    dryRun,
    pdFilter,
    fromYear,
    fromTimeMs: new Date(fromYear, 0, 1).getTime(),
    latestOnly,
  };
}

function normalizePdNumber(value: string): string {
  return value.trim().toUpperCase();
}

function assertDirectory(directoryPath: string, label: string): void {
  if (!fs.existsSync(directoryPath)) {
    throw new Error(`${label} does not exist: ${directoryPath}`);
  }

  const stats = fs.statSync(directoryPath);
  if (!stats.isDirectory()) {
    throw new Error(`${label} is not a directory: ${directoryPath}`);
  }
}

function parseProjectDirectory(
  entryName: string,
  fullPath: string,
): ProjectCandidate | null {
  const separatorIndex = entryName.indexOf("_");

  if (separatorIndex <= 0) {
    return null;
  }

  const pdNumber = normalizePdNumber(entryName.slice(0, separatorIndex));
  if (!pdNumber) {
    return null;
  }

  return {
    projectFolderName: entryName,
    projectFolderPath: fullPath,
    pdNumber,
  };
}

function isExcelFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();

  return (
    lower.endsWith(".xlsx") ||
    lower.endsWith(".xls") ||
    lower.endsWith(".xlsm") ||
    lower.endsWith(".xlsb")
  );
}

function isTemporaryOfficeFile(fileName: string): boolean {
  return fileName.startsWith("~$");
}

function findExcelFilesFromYear(
  projectFolderPath: string,
  fromTimeMs: number,
): ExcelFileMatch[] {
  const entries = fs.readdirSync(projectFolderPath, { withFileTypes: true });
  const matches: ExcelFileMatch[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!isExcelFile(entry.name)) continue;
    if (isTemporaryOfficeFile(entry.name)) continue;

    const fullPath = path.join(projectFolderPath, entry.name);
    const stats = fs.statSync(fullPath);

    if (stats.mtimeMs < fromTimeMs) continue;

    matches.push({
      fullPath,
      fileName: entry.name,
      mtimeMs: stats.mtimeMs,
    });
  }

  return matches.sort((left, right) => right.mtimeMs - left.mtimeMs);
}

function getProjectDirectories(sourceRoot: string): ProjectCandidate[] {
  return fs
    .readdirSync(sourceRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      parseProjectDirectory(entry.name, path.join(sourceRoot, entry.name)),
    )
    .filter((entry): entry is ProjectCandidate => entry !== null)
    .sort((left, right) =>
      left.projectFolderName.localeCompare(right.projectFolderName, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
    );
}

function copyBrandLists(options: CliOptions): ProjectCopyResult[] {
  assertDirectory(options.sourceRoot, "Source root");

  const projectDirectories = getProjectDirectories(options.sourceRoot);
  const results: ProjectCopyResult[] = [];

  for (const projectDirectory of projectDirectories) {
    if (
      options.pdFilter &&
      projectDirectory.pdNumber !== options.pdFilter
    ) {
      results.push({
        projectFolderName: projectDirectory.projectFolderName,
        pdNumber: projectDirectory.pdNumber,
        copiedFiles: [],
        action: "skipped-filter",
      });
      continue;
    }

    const matchingFiles = findExcelFilesFromYear(
      projectDirectory.projectFolderPath,
      options.fromTimeMs,
    );

    const sourceFiles = options.latestOnly
      ? matchingFiles.slice(0, 1)
      : matchingFiles;

    if (sourceFiles.length === 0) {
      results.push({
        projectFolderName: projectDirectory.projectFolderName,
        pdNumber: projectDirectory.pdNumber,
        copiedFiles: [],
        action: "skipped-no-excel",
      });
      continue;
    }

    const destinationDirectory = path.join(
      options.outputRoot,
      projectDirectory.pdNumber,
    );

    if (!options.dryRun) {
      fs.mkdirSync(destinationDirectory, { recursive: true });
    }

    const copiedFiles: CopiedFileResult[] = sourceFiles.map((file) => {
      const destinationPath = path.join(destinationDirectory, file.fileName);

      if (!options.dryRun) {
        fs.copyFileSync(file.fullPath, destinationPath);
      }

      return {
        sourcePath: file.fullPath,
        fileName: file.fileName,
        mtimeMs: file.mtimeMs,
        destinationPath,
      };
    });

    results.push({
      projectFolderName: projectDirectory.projectFolderName,
      pdNumber: projectDirectory.pdNumber,
      copiedFiles,
      action: "copied",
    });
  }

  return results;
}

function printResults(results: ProjectCopyResult[], options: CliOptions): void {
  const copied = results.filter((result) => result.action === "copied");
  const skippedNoExcel = results.filter(
    (result) => result.action === "skipped-no-excel",
  );
  const skippedFilter = results.filter(
    (result) => result.action === "skipped-filter",
  );

  const totalFilesCopied = copied.reduce(
    (sum, project) => sum + project.copiedFiles.length,
    0,
  );

  console.log(`Source: ${options.sourceRoot}`);
  console.log(`Output: ${options.outputRoot}`);
  console.log(`Modified on/after: Jan 1, ${options.fromYear}`);
  console.log(`Mode: ${options.dryRun ? "dry run" : "copy"}`);
  console.log(`Copy behavior: ${options.latestOnly ? "latest only" : "all matching Excel files"}`);

  if (options.pdFilter) {
    console.log(`PD filter: ${options.pdFilter}`);
  }

  console.log("");

  for (const result of copied) {
    console.log(`${result.projectFolderName}`);

    for (const file of result.copiedFiles) {
      console.log(`  ${file.fileName}`);
      console.log(`    Edited: ${new Date(file.mtimeMs).toLocaleString()}`);
      console.log(`    From:   ${file.sourcePath}`);
      console.log(`    To:     ${file.destinationPath}`);
    }
  }

  if (copied.length === 0) {
    console.log("No matching project folders with Excel files were copied.");
  }

  console.log("");
  console.log(`Scanned projects: ${results.length}`);
  console.log(`Projects copied: ${copied.length}`);
  console.log(`Files copied: ${totalFilesCopied}`);
  console.log(`Skipped by filter: ${skippedFilter.length}`);
  console.log(`Skipped with no matching Excel files: ${skippedNoExcel.length}`);
}

function main(): void {
  try {
    const options = parseArgs(process.argv.slice(2));
    const results = copyBrandLists(options);
    printResults(results, options);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    console.error("");
    printUsage();
    process.exit(1);
  }
}

main();