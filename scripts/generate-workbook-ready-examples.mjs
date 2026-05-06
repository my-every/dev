#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, "..");
const REPORT_SCRIPT = path.join(APP_ROOT, "scripts", "report-legal-prebuild-availability.mjs");
const REPORT_PATH = path.join(APP_ROOT, "Share", "Legal Drawings", "prebuild-report.json");

const LIMIT = Number.parseInt(getArgValue("--limit") || "15", 10);
const REFRESH = process.argv.includes("--refresh");

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return null;
  }
  return process.argv[index + 1] || null;
}

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

function toDisplayName(entry) {
  const projectName = Array.isArray(entry.projectNames) ? String(entry.projectNames[0] || "").trim() : "";
  return `${entry.pdNumber} | ${projectName || "(no project name)"}`;
}

async function main() {
  if (REFRESH) {
    runCommand("node", [REPORT_SCRIPT, "--json", REPORT_PATH]);
  }

  const raw = await fs.readFile(REPORT_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const workbookReady = Array.isArray(parsed?.details?.workbookReady) ? parsed.details.workbookReady : [];

  console.log(`Workbook-ready examples (${workbookReady.length})`);
  for (const entry of workbookReady.slice(0, LIMIT)) {
    console.log(`  - ${toDisplayName(entry)}`);
  }

  if (workbookReady.length > LIMIT) {
    console.log(`  ... ${workbookReady.length - LIMIT} more`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});