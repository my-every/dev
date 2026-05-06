import { promises as fs } from "node:fs";
import path from "node:path";

import { generateSwsSchemasForManifest } from "../lib/sws/sws-assignment-task-generator";
import type { ProjectManifest } from "../types/project-manifest";

interface CliOptions {
  manifestPath: string;
  outputDirectory: string;
}

function parseArgs(argv: string[]): CliOptions {
  const defaultManifestPath = "Share/Legal Drawings/4L107/B.1/project-manifest.json";
  const options: CliOptions = {
    manifestPath: defaultManifestPath,
    outputDirectory: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--manifest" && argv[index + 1]) {
      options.manifestPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === "--out-dir" && argv[index + 1]) {
      options.outputDirectory = argv[index + 1];
      index += 1;
      continue;
    }
  }

  const manifestDirectory = path.dirname(options.manifestPath);
  if (!options.outputDirectory) {
    options.outputDirectory = path.join(manifestDirectory, "assignment-sws-schemas");
  }

  return options;
}

async function readManifest(manifestPath: string): Promise<ProjectManifest> {
  const raw = await fs.readFile(manifestPath, "utf-8");
  return JSON.parse(raw) as ProjectManifest;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  const manifestPath = path.resolve(root, options.manifestPath);
  const outputDirectory = path.resolve(root, options.outputDirectory);

  const manifest = await readManifest(manifestPath);
  const schemasByAssignment = generateSwsSchemasForManifest(manifest);

  await fs.mkdir(outputDirectory, { recursive: true });

  const index = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    projectId: manifest.id,
    projectName: manifest.name,
    manifestPath: path.relative(root, manifestPath),
    outputDirectory: path.relative(root, outputDirectory),
    assignments: [] as Array<{
      sheetSlug: string;
      templateId: string;
      outputPath: string;
      tasks: number;
      subtasks: number;
      sections: number;
    }>,
  };

  for (const [sheetSlug, schema] of Object.entries(schemasByAssignment)) {
    const outputPath = path.join(outputDirectory, `${sheetSlug}.json`);
    await fs.writeFile(outputPath, JSON.stringify(schema, null, 2), "utf-8");

    index.assignments.push({
      sheetSlug,
      templateId: schema.assignment.templateId,
      outputPath: path.relative(root, outputPath),
      tasks: schema.summary.tasks,
      subtasks: schema.summary.subtasks,
      sections: schema.summary.sections,
    });
  }

  const indexPath = path.join(outputDirectory, "index.json");
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), "utf-8");

  console.log(`Generated ${index.assignments.length} assignment schemas.`);
  console.log(`Output: ${path.relative(root, outputDirectory)}`);
  console.log(`Index: ${path.relative(root, indexPath)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});