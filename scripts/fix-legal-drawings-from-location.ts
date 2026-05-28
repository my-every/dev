import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface SchemaRow {
  fromLocation?: string;
}

interface SchemaSubsection {
  rows?: SchemaRow[];
}

interface SchemaLocationGroup {
  isExternal?: boolean;
  subsections?: SchemaSubsection[];
}

interface SchemaPage {
  pageType?: string;
  locationGroups?: SchemaLocationGroup[];
}

interface WireListPrintSchemaDocument {
  sheetName?: string;
  pages?: SchemaPage[];
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath);
    }
    return [fullPath];
  }));

  return files.flat();
}

function parseArgs(argv: string[]): { rootDir: string; dryRun: boolean } {
  const cwd = process.cwd();
  let rootDir = path.join(cwd, "Share", "Legal Drawings");
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--root") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("Missing value for --root");
      }
      rootDir = path.resolve(cwd, next);
      i += 1;
    }
  }

  return { rootDir, dryRun };
}

function updateSchemaDocument(document: WireListPrintSchemaDocument): number {
  const sheetName = (document.sheetName || "").trim();
  if (!sheetName || !Array.isArray(document.pages)) {
    return 0;
  }

  let updatedRows = 0;

  for (const page of document.pages) {
    if (page.pageType !== "wire-list" || !Array.isArray(page.locationGroups)) {
      continue;
    }

    for (const group of page.locationGroups) {
      if (!group.isExternal || !Array.isArray(group.subsections)) {
        continue;
      }

      for (const subsection of group.subsections) {
        if (!Array.isArray(subsection.rows)) {
          continue;
        }

        for (const row of subsection.rows) {
          if ((row.fromLocation || "") !== sheetName) {
            row.fromLocation = sheetName;
            updatedRows += 1;
          }
        }
      }
    }
  }

  return updatedRows;
}

async function run(): Promise<void> {
  const { rootDir, dryRun } = parseArgs(process.argv.slice(2));
  const allFiles = await walk(rootDir);
  const schemaFiles = allFiles.filter((filePath) =>
    filePath.endsWith(".json") && filePath.includes(`${path.sep}wire-list-print-schema${path.sep}`),
  );

  let changedFiles = 0;
  let changedRows = 0;

  for (const filePath of schemaFiles) {
    const raw = await readFile(filePath, "utf-8");
    let parsed: JsonValue;

    try {
      parsed = JSON.parse(raw) as JsonValue;
    } catch {
      continue;
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      continue;
    }

    const updatedRowsForFile = updateSchemaDocument(parsed as WireListPrintSchemaDocument);
    if (updatedRowsForFile === 0) {
      continue;
    }

    changedFiles += 1;
    changedRows += updatedRowsForFile;

    if (!dryRun) {
      await writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
    }
  }

  const mode = dryRun ? "DRY RUN" : "UPDATED";
  console.log(`[${mode}] scanned=${schemaFiles.length} filesChanged=${changedFiles} rowsChanged=${changedRows}`);
}

run().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to update legal drawings schemas: ${message}`);
  process.exitCode = 1;
});
