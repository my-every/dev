#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPORT_SCRIPT = path.join(APP_ROOT, "scripts", "report-legal-prebuild-availability.mjs");
const REPORT_PATH = path.join(APP_ROOT, "Share", "Legal Drawings", "prebuild-report.json");
const BRAND_LIST_ROOT = path.join(APP_ROOT, "Share", "Brand List");
const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_REPORT = process.argv.includes("--skip-report");

const WORKBOOK_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xls", ".xlsb"]);

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    cwd: APP_ROOT,
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status ?? "unknown"}`);
  }
}

async function hasBrandListWorkbook(pdNumber) {
  const brandListDir = path.join(BRAND_LIST_ROOT, pdNumber);
  const entries = await fs.readdir(brandListDir, { withFileTypes: true }).catch(() => []);
  const hasWorkbook = entries.some((entry) => {
    if (!entry.isFile()) {
      return false;
    }
    const extension = path.extname(entry.name).toLowerCase();
    return WORKBOOK_EXTENSIONS.has(extension) && !entry.name.startsWith("~$");
  });

  return { hasWorkbook, brandListDir };
}

async function loadWorkbookReadyProjects() {
  const raw = await fs.readFile(REPORT_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const projects = Array.isArray(parsed?.details?.workbookReady)
    ? parsed.details.workbookReady
    : [];

  return projects
    .map((entry) => ({
      pdNumber: String(entry.pdNumber || "").trim().toUpperCase(),
      projectName: Array.isArray(entry.projectNames) ? String(entry.projectNames[0] || "").trim() : "",
    }))
    .filter((entry) => entry.pdNumber);
}

async function main() {
  if (!SKIP_REPORT) {
    console.log("Refreshing workbook-ready availability report...");
    runCommand("node", [REPORT_SCRIPT, "--json", REPORT_PATH]);
  }

  const projects = await loadWorkbookReadyProjects();
  console.log(`Found ${projects.length} workbook-ready projects.`);

  if (projects.length === 0) {
    return;
  }

  const results = [];

  for (const project of projects) {
    const { hasWorkbook, brandListDir } = await hasBrandListWorkbook(project.pdNumber);
    console.log(`\n=== ${project.pdNumber} | ${project.projectName || "(no project name)"} ===`);

    if (DRY_RUN) {
      console.log(`DRY RUN: pnpm legal:backfill -- --pd ${project.pdNumber}`);
      if (hasWorkbook) {
        console.log(`DRY RUN: pnpm brandlist:sync-legals -- --brandlist-dir ${brandListDir}`);
      } else {
        console.log(`DRY RUN: skip brandlist:sync-legals (no brand list workbook in ${brandListDir})`);
      }
      results.push({ pdNumber: project.pdNumber, status: hasWorkbook ? "dry-run-ready" : "dry-run-no-brandlist" });
      continue;
    }

    try {
      runCommand("pnpm", ["legal:backfill", "--", "--pd", project.pdNumber]);

      if (hasWorkbook) {
        runCommand("pnpm", ["brandlist:sync-legals", "--", "--brandlist-dir", brandListDir]);
        results.push({ pdNumber: project.pdNumber, status: "completed" });
      } else {
        console.log(`[runner] ${project.pdNumber} brandlist:sync-legals skipped (no brand list workbook)`);
        results.push({ pdNumber: project.pdNumber, status: "completed-no-brandlist" });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[runner] ${project.pdNumber} failed: ${message}`);
      results.push({ pdNumber: project.pdNumber, status: "failed", error: message });
    }
  }

  const completed = results.filter((result) => result.status === "completed").length;
  const completedNoBrandList = results.filter((result) => result.status === "completed-no-brandlist").length;
  const failed = results.filter((result) => result.status === "failed");

  console.log(`\nBatch summary: ${completed}/${results.length} completed with brandlist:sync-legals, ${completedNoBrandList} completed with backfill only, ${failed.length} failed.`);
  for (const result of failed) {
    console.log(`  - ${result.pdNumber}: ${result.error}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});