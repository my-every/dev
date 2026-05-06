#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(SCRIPT_DIR, "..");
const SHARE_ROOT = path.join(APP_ROOT, "Share");
const SCHEDULE_CSV_PATH = path.join(SHARE_ROOT, "Schedule", "Schedule.csv");
const LEGAL_ROOT = path.join(SHARE_ROOT, "Legal Drawings");
const BRAND_LIST_ROOT = path.join(SHARE_ROOT, "Brand List");
const JSON_OUTPUT = getArgValue("--json");
const LIMIT = Number.parseInt(getArgValue("--limit") || "15", 10);
const CURRENT_MONTH_KEY = new Date().toISOString().slice(0, 7);

const WORKBOOK_EXTENSIONS = new Set([".xlsx", ".xlsm", ".xls", ".xlsb"]);
const PDF_EXTENSIONS = new Set([".pdf"]);

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] || null;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function normalizePdNumber(value) {
  return normalizeText(value).toUpperCase();
}

function parseScheduleDate(value) {
  const normalized = normalizeText(value);
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

function isGreenChangesWorkbookFileName(fileName) {
  return /ucp/i.test(fileName) && /compare/i.test(fileName) && /\.(xlsx|xlsm|xls|xlsb|csv)$/i.test(fileName);
}

function isWorkbookFile(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return WORKBOOK_EXTENSIONS.has(extension) && !fileName.startsWith("~$");
}

function isLayoutFile(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  return PDF_EXTENSIONS.has(extension) && !fileName.startsWith("~$");
}

function classifyLegalFiles(fileNames) {
  let workbookCount = 0;
  let greenChangesCount = 0;
  let layoutCount = 0;

  for (const fileName of fileNames) {
    if (isWorkbookFile(fileName)) {
      if (isGreenChangesWorkbookFileName(fileName)) {
        greenChangesCount += 1;
      } else {
        workbookCount += 1;
      }
      continue;
    }

    if (isLayoutFile(fileName)) {
      layoutCount += 1;
    }
  }

  return {
    workbookCount,
    greenChangesCount,
    layoutCount,
    hasWorkbook: workbookCount > 0,
    hasGreenChanges: greenChangesCount > 0,
    hasLayout: layoutCount > 0,
    hasAnySource: workbookCount > 0 || greenChangesCount > 0 || layoutCount > 0,
  };
}

async function readScheduleProjects() {
  const raw = await fs.readFile(SCHEDULE_CSV_PATH, "utf8");
  const workbook = XLSX.read(raw, { type: "string", raw: false });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
  if (!firstSheet) {
    throw new Error("Schedule.csv is missing its first worksheet");
  }

  const rows = XLSX.utils.sheet_to_json(firstSheet, {
    defval: "",
    raw: false,
  });

  const projectsByPd = new Map();
  for (const row of rows) {
    const pdNumber = normalizePdNumber(row["PD#"]);
    if (!pdNumber) {
      continue;
    }

    const existing = projectsByPd.get(pdNumber) || {
      pdNumber,
      rowCount: 0,
      projectNames: new Set(),
      unitNumbers: new Set(),
      legalsMilestones: new Set(),
      dueDates: new Set(),
      dueMonths: new Set(),
    };

    existing.rowCount += 1;
    const projectName = normalizeText(row["PROJECT"]);
    const unitNumber = normalizeText(row["UNIT"]);
    const legalsDate = normalizeText(row["LEGALS"]);
    const dueDate = parseScheduleDate(row["BIQ COMP"] || row["DEPT 380 TARGET"]);
    if (projectName) existing.projectNames.add(projectName);
    if (unitNumber) existing.unitNumbers.add(unitNumber);
    if (legalsDate) existing.legalsMilestones.add(legalsDate);
    if (dueDate) {
      existing.dueDates.add(dueDate);
      existing.dueMonths.add(dueDate.slice(0, 7));
    }
    projectsByPd.set(pdNumber, existing);
  }

  return Array.from(projectsByPd.values())
    .map((entry) => ({
      pdNumber: entry.pdNumber,
      rowCount: entry.rowCount,
      projectNames: Array.from(entry.projectNames),
      unitNumbers: Array.from(entry.unitNumbers),
      legalsMilestones: Array.from(entry.legalsMilestones),
      dueDates: Array.from(entry.dueDates).sort(),
      dueMonths: Array.from(entry.dueMonths).sort(),
    }))
    .sort((left, right) => left.pdNumber.localeCompare(right.pdNumber, undefined, { numeric: true, sensitivity: "base" }));
}

async function readLegalProjects() {
  const entries = await fs.readdir(LEGAL_ROOT, { withFileTypes: true });
  const legalProjects = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const pdNumber = normalizePdNumber(entry.name);
    const pdPath = path.join(LEGAL_ROOT, entry.name);
    const childEntries = await fs.readdir(pdPath, { withFileTypes: true });
    const rootFiles = childEntries.filter((child) => child.isFile()).map((child) => child.name);
    const revisionDirs = childEntries.filter((child) => child.isDirectory()).map((child) => child.name);
    const classification = classifyLegalFiles(rootFiles);

    legalProjects.push({
      pdNumber,
      folderName: entry.name,
      path: pdPath,
      rootFiles,
      revisionDirs,
      ...classification,
    });
  }

  return legalProjects.sort((left, right) => left.pdNumber.localeCompare(right.pdNumber, undefined, { numeric: true, sensitivity: "base" }));
}

async function readBrandListProjects() {
  const entries = await fs.readdir(BRAND_LIST_ROOT, { withFileTypes: true }).catch(() => []);
  const brandListProjects = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }

    const pdNumber = normalizePdNumber(entry.name);
    const pdPath = path.join(BRAND_LIST_ROOT, entry.name);
    const childEntries = await fs.readdir(pdPath, { withFileTypes: true }).catch(() => []);
    const workbookFiles = childEntries
      .filter((child) => child.isFile() && isWorkbookFile(child.name))
      .map((child) => child.name)
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));

    brandListProjects.push({
      pdNumber,
      folderName: entry.name,
      path: pdPath,
      workbookFiles,
      hasBrandListWorkbook: workbookFiles.length > 0,
    });
  }

  return brandListProjects.sort((left, right) => left.pdNumber.localeCompare(right.pdNumber, undefined, { numeric: true, sensitivity: "base" }));
}

function summarize(scheduleProjects, legalProjects, brandListProjects) {
  const legalByPd = new Map(legalProjects.map((entry) => [entry.pdNumber, entry]));
  const scheduleByPd = new Map(scheduleProjects.map((entry) => [entry.pdNumber, entry]));
  const brandListByPd = new Map(brandListProjects.map((entry) => [entry.pdNumber, entry]));

  const matched = [];
  const missingLegal = [];
  const workbookReady = [];
  const greenOnly = [];
  const layoutOnly = [];
  const sourceLess = [];
  const dueThisMonth = [];
  const dueThisMonthWorkbookReady = [];
  const dueThisMonthMissingLegal = [];
  const dueThisMonthBrandListReady = [];
  const dueThisMonthFullyReady = [];

  for (const scheduleProject of scheduleProjects) {
    const legalProject = legalByPd.get(scheduleProject.pdNumber);
    const brandListProject = brandListByPd.get(scheduleProject.pdNumber) || null;
    if (!legalProject) {
      missingLegal.push(scheduleProject);
      if (scheduleProject.dueMonths.includes(CURRENT_MONTH_KEY)) {
        dueThisMonthMissingLegal.push(scheduleProject);
      }
      continue;
    }

    const combined = { ...scheduleProject, legal: legalProject, brandList: brandListProject };
    matched.push(combined);
    if (scheduleProject.dueMonths.includes(CURRENT_MONTH_KEY)) {
      dueThisMonth.push(combined);
      if (brandListProject?.hasBrandListWorkbook) {
        dueThisMonthBrandListReady.push(combined);
      }
    }

    if (legalProject.hasWorkbook) {
      workbookReady.push(combined);
      if (scheduleProject.dueMonths.includes(CURRENT_MONTH_KEY)) {
        dueThisMonthWorkbookReady.push(combined);
        if (brandListProject?.hasBrandListWorkbook) {
          dueThisMonthFullyReady.push(combined);
        }
      }
    } else if (legalProject.hasGreenChanges) {
      greenOnly.push(combined);
    } else if (legalProject.hasLayout) {
      layoutOnly.push(combined);
    } else {
      sourceLess.push(combined);
    }
  }

  const notOnSchedule = legalProjects.filter((legalProject) => !scheduleByPd.has(legalProject.pdNumber));

  return {
    scheduleProjectCount: scheduleProjects.length,
    legalDirectoryCount: legalProjects.length,
    brandListDirectoryCount: brandListProjects.length,
    matchedCount: matched.length,
    workbookReadyCount: workbookReady.length,
    greenOnlyCount: greenOnly.length,
    layoutOnlyCount: layoutOnly.length,
    sourceLessCount: sourceLess.length,
    missingLegalCount: missingLegal.length,
    notOnScheduleCount: notOnSchedule.length,
    dueThisMonthCount: dueThisMonth.length,
    dueThisMonthWorkbookReadyCount: dueThisMonthWorkbookReady.length,
    dueThisMonthMissingLegalCount: dueThisMonthMissingLegal.length,
    dueThisMonthBrandListReadyCount: dueThisMonthBrandListReady.length,
    dueThisMonthFullyReadyCount: dueThisMonthFullyReady.length,
    matched,
    workbookReady,
    greenOnly,
    layoutOnly,
    sourceLess,
    missingLegal,
    notOnSchedule,
    dueThisMonth,
    dueThisMonthWorkbookReady,
    dueThisMonthMissingLegal,
    dueThisMonthBrandListReady,
    dueThisMonthFullyReady,
  };
}

function printProjectList(title, rows, mapper) {
  if (rows.length === 0) {
    return;
  }

  console.log(`\n${title} (${rows.length})`);
  for (const row of rows.slice(0, LIMIT)) {
    console.log(`  - ${mapper(row)}`);
  }
  if (rows.length > LIMIT) {
    console.log(`  ... ${rows.length - LIMIT} more`);
  }
}

async function main() {
  const [scheduleProjects, legalProjects, brandListProjects] = await Promise.all([
    readScheduleProjects(),
    readLegalProjects(),
    readBrandListProjects(),
  ]);

  const summary = summarize(scheduleProjects, legalProjects, brandListProjects);

  const report = {
    generatedAt: new Date().toISOString(),
    scheduleCsvPath: SCHEDULE_CSV_PATH,
    legalRoot: LEGAL_ROOT,
    brandListRoot: BRAND_LIST_ROOT,
    counts: {
      scheduleProjectCount: summary.scheduleProjectCount,
      legalDirectoryCount: summary.legalDirectoryCount,
      brandListDirectoryCount: summary.brandListDirectoryCount,
      matchedCount: summary.matchedCount,
      workbookReadyCount: summary.workbookReadyCount,
      greenOnlyCount: summary.greenOnlyCount,
      layoutOnlyCount: summary.layoutOnlyCount,
      sourceLessCount: summary.sourceLessCount,
      missingLegalCount: summary.missingLegalCount,
      notOnScheduleCount: summary.notOnScheduleCount,
      dueThisMonthCount: summary.dueThisMonthCount,
      dueThisMonthWorkbookReadyCount: summary.dueThisMonthWorkbookReadyCount,
      dueThisMonthMissingLegalCount: summary.dueThisMonthMissingLegalCount,
      dueThisMonthBrandListReadyCount: summary.dueThisMonthBrandListReadyCount,
      dueThisMonthFullyReadyCount: summary.dueThisMonthFullyReadyCount,
    },
    details: {
      workbookReady: summary.workbookReady.map((entry) => ({
        pdNumber: entry.pdNumber,
        projectNames: entry.projectNames,
        unitNumbers: entry.unitNumbers,
        legalsMilestones: entry.legalsMilestones,
        dueDates: entry.dueDates,
        rootFiles: entry.legal.rootFiles,
        brandListFiles: entry.brandList?.workbookFiles || [],
      })),
      greenOnly: summary.greenOnly.map((entry) => ({
        pdNumber: entry.pdNumber,
        projectNames: entry.projectNames,
        unitNumbers: entry.unitNumbers,
        legalsMilestones: entry.legalsMilestones,
        dueDates: entry.dueDates,
        rootFiles: entry.legal.rootFiles,
        brandListFiles: entry.brandList?.workbookFiles || [],
      })),
      layoutOnly: summary.layoutOnly.map((entry) => ({
        pdNumber: entry.pdNumber,
        projectNames: entry.projectNames,
        unitNumbers: entry.unitNumbers,
        legalsMilestones: entry.legalsMilestones,
        dueDates: entry.dueDates,
        rootFiles: entry.legal.rootFiles,
        brandListFiles: entry.brandList?.workbookFiles || [],
      })),
      sourceLess: summary.sourceLess.map((entry) => ({
        pdNumber: entry.pdNumber,
        projectNames: entry.projectNames,
        unitNumbers: entry.unitNumbers,
        legalsMilestones: entry.legalsMilestones,
        dueDates: entry.dueDates,
        revisionDirs: entry.legal.revisionDirs,
      })),
      missingLegal: summary.missingLegal,
      dueThisMonth: summary.dueThisMonth.map((entry) => ({
        pdNumber: entry.pdNumber,
        projectNames: entry.projectNames,
        unitNumbers: entry.unitNumbers,
        dueDates: entry.dueDates,
        rootFiles: entry.legal.rootFiles,
        brandListFiles: entry.brandList?.workbookFiles || [],
      })),
      dueThisMonthWorkbookReady: summary.dueThisMonthWorkbookReady.map((entry) => ({
        pdNumber: entry.pdNumber,
        projectNames: entry.projectNames,
        unitNumbers: entry.unitNumbers,
        dueDates: entry.dueDates,
        rootFiles: entry.legal.rootFiles,
        brandListFiles: entry.brandList?.workbookFiles || [],
      })),
      dueThisMonthFullyReady: summary.dueThisMonthFullyReady.map((entry) => ({
        pdNumber: entry.pdNumber,
        projectNames: entry.projectNames,
        unitNumbers: entry.unitNumbers,
        dueDates: entry.dueDates,
        rootFiles: entry.legal.rootFiles,
        brandListFiles: entry.brandList?.workbookFiles || [],
      })),
      dueThisMonthMissingLegal: summary.dueThisMonthMissingLegal,
      notOnSchedule: summary.notOnSchedule.map((entry) => ({
        pdNumber: entry.pdNumber,
        folderName: entry.folderName,
        rootFiles: entry.rootFiles,
      })),
    },
  };

  console.log("Legal Prebuild Availability");
  console.log(`Schedule projects: ${summary.scheduleProjectCount}`);
  console.log(`Legal directories: ${summary.legalDirectoryCount}`);
  console.log(`Brand list directories: ${summary.brandListDirectoryCount}`);
  console.log(`Matched PDs: ${summary.matchedCount}`);
  console.log(`Prebuildable with workbook: ${summary.workbookReadyCount}`);
  console.log(`Green-change only: ${summary.greenOnlyCount}`);
  console.log(`Layout only: ${summary.layoutOnlyCount}`);
  console.log(`No usable root sources: ${summary.sourceLessCount}`);
  console.log(`Missing legal directory: ${summary.missingLegalCount}`);
  console.log(`Legal directories not on schedule: ${summary.notOnScheduleCount}`);
  console.log(`Due this month (${CURRENT_MONTH_KEY}): ${summary.dueThisMonthCount}`);
  console.log(`Due this month and workbook-ready: ${summary.dueThisMonthWorkbookReadyCount}`);
  console.log(`Due this month with brand list workbook: ${summary.dueThisMonthBrandListReadyCount}`);
  console.log(`Due this month fully ready (legal workbook + brand list): ${summary.dueThisMonthFullyReadyCount}`);
  console.log(`Due this month but missing legal directory: ${summary.dueThisMonthMissingLegalCount}`);

  printProjectList(
    "Workbook-ready examples",
    summary.workbookReady,
    (entry) => `${entry.pdNumber} | ${entry.projectNames[0] || "(no project name)"}`,
  );
  printProjectList(
    "Green-only examples",
    summary.greenOnly,
    (entry) => `${entry.pdNumber} | ${entry.projectNames[0] || "(no project name)"}`,
  );
  printProjectList(
    "Missing legal directory examples",
    summary.missingLegal,
    (entry) => `${entry.pdNumber} | ${entry.projectNames[0] || "(no project name)"}`,
  );
  printProjectList(
    `Due-this-month workbook-ready examples`,
    summary.dueThisMonthWorkbookReady,
    (entry) => `${entry.pdNumber} | ${entry.projectNames[0] || "(no project name)"} | ${entry.dueDates.join(", ") || "(no due date)"}`,
  );
  printProjectList(
    `Due-this-month fully-ready examples`,
    summary.dueThisMonthFullyReady,
    (entry) => `${entry.pdNumber} | ${entry.projectNames[0] || "(no project name)"} | ${entry.dueDates.join(", ") || "(no due date)"}`,
  );

  if (JSON_OUTPUT) {
    await fs.writeFile(JSON_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(`\nWrote JSON report to ${JSON_OUTPUT}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});