import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import { resolveShareDirectory } from "@/lib/runtime/share-directory";

import type {
  ProjectScheduleColumn,
  ProjectScheduleDocument,
  ProjectScheduleGroup,
  ProjectScheduleRow,
  Schedule,
  ScheduleProject,
} from "@/lib/project-schedule/types";

export const dynamic = "force-dynamic";

interface SchedulePaths {
  shareProjectsDir: string;
  shareScheduleDir: string;
  shareProjectsScheduleFile: string;
  shareScheduleFile: string;
  shareProjectsScheduleTsFile: string;
  shareScheduleTsFile: string;
}

async function resolveSchedulePaths(): Promise<SchedulePaths> {
  const shareRoot = await resolveShareDirectory();
  const shareProjectsDir = path.join(shareRoot, "Projects");
  const shareScheduleDir = path.join(shareRoot, "Schedule");

  return {
    shareProjectsDir,
    shareScheduleDir,
    shareProjectsScheduleFile: path.join(shareProjectsDir, "schedule.json"),
    shareScheduleFile: path.join(shareScheduleDir, "project-schedule.json"),
    shareProjectsScheduleTsFile: path.join(shareProjectsDir, "schedule.ts"),
    shareScheduleTsFile: path.join(shareScheduleDir, "project-schedule.ts"),
  };
}

const EMPTY_DOCUMENT: ProjectScheduleDocument = {
  columns: [],
  groups: [],
  importedAt: "",
};

async function ensureDirs(paths: SchedulePaths) {
  await fs.mkdir(paths.shareProjectsDir, { recursive: true });
  await fs.mkdir(paths.shareScheduleDir, { recursive: true });
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function safeString(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function normalizeRow(row: unknown, groupId: string, rowIndex: number): ProjectScheduleRow | null {
  const record = toRecord(row);
  if (!record) {
    return null;
  }

  const normalized: ProjectScheduleRow = {
    id: safeString(record.id) || `${groupId}-${rowIndex + 1}`,
  };

  for (const [key, value] of Object.entries(record)) {
    if (!key || key === "id") {
      continue;
    }

    const canonicalKey = canonicalizeScheduleKey(key);
    if (!canonicalKey) {
      continue;
    }

    if (typeof value === "string") {
      normalized[canonicalKey] = value;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      normalized[canonicalKey] = value;
      continue;
    }

    if (typeof value === "boolean") {
      normalized[canonicalKey] = String(value);
    }
  }

  const corrected = normalizeImportedScheduleRow(normalized);
  if (shouldSkipImportedScheduleRow(corrected)) {
    return null;
  }

  return corrected;
}

function normalizeGroups(input: unknown): ProjectScheduleGroup[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const normalized: ProjectScheduleGroup[] = [];

  input.forEach((groupValue, groupIndex) => {
    const groupRecord = toRecord(groupValue);
    if (!groupRecord) {
      return;
    }

    const groupId = safeString(groupRecord.id) || `group-${groupIndex + 1}`;
    const projectLabel =
      safeString(groupRecord.projectLabel) ||
      safeString(groupRecord.project) ||
      `Project ${groupIndex + 1}`;

    const rowValues = Array.isArray(groupRecord.rows) ? groupRecord.rows : [];
    const rows = rowValues
      .map((row, rowIndex) => normalizeRow(row, groupId, rowIndex))
      .filter((row): row is ProjectScheduleRow => Boolean(row));

    // Some source exports leave PROJECT blank on continuation rows.
    // Carry the last non-empty project name forward for consistency.
    let lastProjectName = "";
    for (const row of rows) {
      const currentName = safeString(row.name);
      if (currentName) {
        lastProjectName = currentName;
        continue;
      }

      if (lastProjectName) {
        row.name = lastProjectName;
      }
    }

    normalized.push({
      id: groupId,
      projectLabel,
      rows,
    });
  });

  return normalized;
}

function normalizeColumns(input: unknown, groups: ProjectScheduleGroup[]): ProjectScheduleColumn[] {
  void input;
  void groups;
  return CANONICAL_SCHEDULE_COLUMNS.map((column) => ({
    key: column.key,
    label: column.label,
  }));
}

function normalizeDocument(payload: unknown, sourceFile?: string): ProjectScheduleDocument {
  const payloadRecord = toRecord(payload);
  const rawGroups = Array.isArray(payload)
    ? payload
    : payloadRecord?.groups;

  const groups = normalizeGroups(rawGroups);
  const columns = normalizeColumns(payloadRecord?.columns, groups);

  return {
    columns,
    groups,
    importedAt: new Date().toISOString(),
    sourceFile: sourceFile || safeString(payloadRecord?.sourceFile) || undefined,
  };
}

type MappedField = keyof Omit<ScheduleProject, "id" | "customer"> | "lwc";

const CANONICAL_SCHEDULE_COLUMNS: Array<{ key: MappedField; label: string }> = [
  { key: "lwc", label: "LWC" },
  { key: "name", label: "PROJECT" },
  { key: "unit", label: "UNIT" },
  { key: "pd", label: "PD#" },
  { key: "legals", label: "LEGALS" },
  { key: "sw", label: "SW" },
  { key: "wo", label: "CONCSH WO OPEN" },
  { key: "proj", label: "PROJ KITTED" },
  { key: "conlay", label: "CONLAY" },
  { key: "conasy", label: "CONASY" },
  { key: "test", label: "TEST 1ST PASS" },
  { key: "concus", label: "CONCUS" },
  { key: "pwrchk", label: "PWRCHK" },
  { key: "d380Final", label: "D380 FINAL-BIQ" },
  { key: "dept380", label: "DEPT 380 TARGET" },
  { key: "daysLate", label: "DAYS LATE" },
  { key: "commit", label: "NEW COMMMIT" },
  { key: "biqComp", label: "BIQ COMP" },
  { key: "hide", label: "HIDE" },
  { key: "comments", label: "COMMENTS" },
];

const CANONICAL_SCHEDULE_COLUMN_KEYS = new Set<string>(
  CANONICAL_SCHEDULE_COLUMNS.map((column) => column.key),
);

const HEADER_ALIASES: Record<string, MappedField> = {
  lwc: "lwc",
  lwcproject: "lwc",
  pd: "pd",
  "pd#": "pd",
  pdnumber: "pd",
  unit: "unit",
  project: "name",
  "project name": "name",
  customer: "name",
  legals: "legals",
  sw: "sw",
  "consh wo open": "wo",
  "concsh wo open": "wo",
  "concsh woopen": "wo",
  wo: "wo",
  "proj kitted": "proj",
  "project kitted": "proj",
  "prject knitted": "proj",
  proj: "proj",
  conlay: "conlay",
  conasy: "conasy",
  conassy: "conasy",
  test: "test",
  "test 1st pass": "test",
  "test first pass": "test",
  concus: "concus",
  pwrchk: "pwrchk",
  d380final: "d380Final",
  "d380final-": "d380Final",
  "d380-final": "d380Final",
  "d380 final": "d380Final",
  "d380 final biq": "d380Final",
  dept380: "dept380",
  "dept 380": "dept380",
  "dept 380 target": "dept380",
  target: "dept380",
  "target date": "dept380",
  dayslate: "daysLate",
  "days late": "daysLate",
  commit: "commit",
  commmit: "commit",
  "new commmit": "commit",
  "new commit": "commit",
  "new commit date": "commit",
  "biq comp": "biqComp",
  biqcomp: "biqComp",
  hide: "hide",
  comments: "comments",
};

function canonicalizeScheduleKey(rawKey: string): MappedField | null {
  const token = normalizeHeaderToken(rawKey);
  const mapped = HEADER_ALIASES[token];
  if (mapped) {
    return mapped;
  }

  if (CANONICAL_SCHEDULE_COLUMN_KEYS.has(rawKey)) {
    return rawKey as MappedField;
  }

  return null;
}

function normalizeHeaderToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeCellText(value: unknown): string {
  return safeString(value)
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeHeaderKey(label: string, index: number): string {
  const normalized = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || `column_${index + 1}`;
}

function getOrderedColumnKeys(row: ProjectScheduleRow): string[] {
  return Object.keys(row)
    .filter((key) => key !== "id")
    .sort((left, right) => {
      const leftMatch = left.match(/(\d+)$/);
      const rightMatch = right.match(/(\d+)$/);
      if (leftMatch && rightMatch) {
        return Number(leftMatch[1]) - Number(rightMatch[1]);
      }
      return left.localeCompare(right);
    });
}

function findHeaderRowIndex(rows: ProjectScheduleRow[]): number {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const columnKeys = getOrderedColumnKeys(row);
    const recognized = columnKeys.reduce((count, key) => {
      const value = safeString(row[key]);
      const alias = HEADER_ALIASES[normalizeHeaderToken(value)];
      return alias ? count + 1 : count;
    }, 0);

    if (recognized >= 6) {
      return index;
    }
  }
  return -1;
}

function looksLikeProjectCode(value: string): boolean {
  return /[A-Z]\d{3,}|\d+[A-Z]\d+|\d+-[A-Z0-9]+/i.test(value);
}

function looksLikeHeaderLikeRow(row: ProjectScheduleRow): boolean {
  const combined = getOrderedColumnKeys(row)
    .map((key) => safeString(row[key]))
    .join(" ")
    .toLowerCase();
  return combined.includes("project open") || combined.includes("kitted") || combined.includes("target");
}

function buildColumnMap(headerRow: ProjectScheduleRow): Map<string, MappedField> {
  const map = new Map<string, MappedField>();
  const ordered = getOrderedColumnKeys(headerRow);

  for (const key of ordered) {
    const token = normalizeHeaderToken(safeString(headerRow[key]));
    const alias = HEADER_ALIASES[token];
    if (alias) {
      map.set(key, alias);
    }
  }

  return map;
}

function rowHasSemanticFields(row: ProjectScheduleRow): boolean {
  const keys = Object.keys(row);
  return keys.some((key) => ["name", "project", "pd", "unit", "dept380", "commit", "legals"].includes(key));
}

function buildPartialFromSemanticRow(row: ProjectScheduleRow): Partial<ScheduleProject> {
  const partial: Partial<ScheduleProject> = {
    legals: "",
    sw: "",
    wo: "",
    proj: "",
    conlay: "",
    conasy: "",
    test: "",
    concus: "",
    pwrchk: "",
    d380Final: "",
    dept380: "",
    commit: "",
    biqComp: "",
    hide: "",
    comments: "",
  };

  for (const [key, value] of Object.entries(row)) {
    if (key === "id") {
      continue;
    }
    const normalizedKey = normalizeHeaderToken(key);
    const mapped = HEADER_ALIASES[normalizedKey] ?? HEADER_ALIASES[normalizeHeaderToken(sanitizeCellText(key))];
    const text = safeString(value);
    if (!text || !mapped) {
      continue;
    }

    if (mapped === "daysLate") {
      partial.daysLate = Number.parseInt(text, 10);
    } else {
      partial[mapped] = text as never;
    }
  }

  // Preserve direct fields when keys are already semantic.
  if (safeString(row.name)) partial.name = safeString(row.name);
  if (safeString(row.pd)) partial.pd = safeString(row.pd);
  if (safeString(row.unit)) partial.unit = safeString(row.unit);
  if (safeString(row.legals)) partial.legals = safeString(row.legals);
  if (safeString(row.sw)) partial.sw = safeString(row.sw);
  if (safeString(row.wo)) partial.wo = safeString(row.wo);
  if (safeString(row.proj)) partial.proj = safeString(row.proj);
  if (safeString(row.conlay)) partial.conlay = safeString(row.conlay);
  if (safeString(row.conasy)) partial.conasy = safeString(row.conasy);
  if (safeString(row.test)) partial.test = safeString(row.test);
  if (safeString(row.concus)) partial.concus = safeString(row.concus);
  if (safeString(row.pwrchk)) partial.pwrchk = safeString(row.pwrchk);
  if (safeString(row.d380Final)) partial.d380Final = safeString(row.d380Final);
  if (safeString(row.dept380)) partial.dept380 = safeString(row.dept380);
  if (safeString(row.commit)) partial.commit = safeString(row.commit);
  if (safeString(row.biqComp)) partial.biqComp = safeString(row.biqComp);
  if (safeString(row.hide)) partial.hide = safeString(row.hide);
  if (safeString(row.comments)) partial.comments = safeString(row.comments);

  return partial;
}

function buildColumnMapFromDocumentColumns(columns: ProjectScheduleColumn[]): Map<string, MappedField> {
  const map = new Map<string, MappedField>();
  for (const column of columns) {
    const keyToken = normalizeHeaderToken(column.key);
    const labelToken = normalizeHeaderToken(column.label);
    const mapped = HEADER_ALIASES[labelToken] ?? HEADER_ALIASES[keyToken];
    if (mapped) {
      map.set(column.key, mapped);
    }
  }
  return map;
}

async function parseCsvUploadToDocument(file: File): Promise<ProjectScheduleDocument> {
  const fileName = path.basename(file.name);
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "schedule";
  const groupId = baseName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "schedule";

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer", raw: false });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
  if (!sheet) {
    return {
      columns: [],
      groups: [],
      importedAt: new Date().toISOString(),
      sourceFile: fileName,
    };
  }

  const rows = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  let headerIndex = -1;
  let headerMap = new Map<number, MappedField>();

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? [];
    const rowMap = new Map<number, MappedField>();
    let recognized = 0;

    row.forEach((cell, cellIndex) => {
      const cleaned = sanitizeCellText(cell);
      const token = normalizeHeaderToken(cleaned);
      const mapped = HEADER_ALIASES[token];
      if (mapped) {
        rowMap.set(cellIndex, mapped);
        recognized += 1;
      }
    });

    if (recognized >= 6) {
      headerIndex = index;
      headerMap = rowMap;
      break;
    }
  }

  if (headerIndex < 0) {
    return {
      columns: [],
      groups: [],
      importedAt: new Date().toISOString(),
      sourceFile: fileName,
    };
  }

  const normalizedRows: ProjectScheduleRow[] = [];
  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const source = rows[rowIndex] ?? [];
    const record: ProjectScheduleRow = { id: `${groupId}-${rowIndex - headerIndex}` };
    let hasValues = false;

    for (const [colIndex, mappedField] of headerMap.entries()) {
      const cellValue = sanitizeCellText(source[colIndex]);
      if (!cellValue) {
        continue;
      }

      record[mappedField] = cellValue;
      hasValues = true;
    }

    if (!hasValues) {
      continue;
    }

    normalizedRows.push(record);
  }

  const columns: ProjectScheduleColumn[] = CANONICAL_SCHEDULE_COLUMNS.map((column) => ({
    key: column.key,
    label: column.label,
  }));

  return {
    columns,
    groups: [
      {
        id: groupId,
        projectLabel: baseName,
        rows: normalizedRows,
      },
    ],
    importedAt: new Date().toISOString(),
    sourceFile: fileName,
  };
}

function parseDateLike(value: string): Date | null {
  const text = value.trim();
  if (!text || /^#N\/A|#VALUE!|see\s+#/i.test(text)) {
    return null;
  }

  const isoLike = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoLike) {
    const date = new Date(Date.UTC(Number(isoLike[1]), Number(isoLike[2]) - 1, Number(isoLike[3])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const usLike = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (usLike) {
    const year = usLike[3].length === 2 ? 2000 + Number(usLike[3]) : Number(usLike[3]);
    const date = new Date(Date.UTC(year, Number(usLike[1]) - 1, Number(usLike[2])));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function isPendingUnitLike(value: string): boolean {
  const text = value.trim().toUpperCase();
  return /^PENDING-[A-Z0-9]+$/.test(text) || text === "LOST";
}

function isNameLikeText(value: string): boolean {
  const text = value.trim();
  if (!text) {
    return false;
  }

  if (parseDateLike(text)) {
    return false;
  }

  if (/^#N\/A|#VALUE!|see\s+#|none$/i.test(text)) {
    return false;
  }

  if (looksLikeProjectCode(text)) {
    return false;
  }

  return /[A-Za-z]/.test(text);
}

function normalizeImportedScheduleRow(row: ProjectScheduleRow): ProjectScheduleRow {
  const corrected: ProjectScheduleRow = { ...row };

  const unit = safeString(corrected.unit);
  const pd = safeString(corrected.pd);
  const legals = safeString(corrected.legals);
  const sw = safeString(corrected.sw);
  const name = safeString(corrected.name);

  // Pattern seen in imported rows: unit is status (PENDING-A/LOST), pd is numeric,
  // and project/customer name lands under legals (e.g. MABANK).
  if (!name && isPendingUnitLike(unit) && /^\d+$/.test(pd) && isNameLikeText(legals)) {
    corrected.name = legals;
    if (parseDateLike(sw)) {
      corrected.legals = sw;
    }
  }

  return corrected;
}

function shouldSkipImportedScheduleRow(row: ProjectScheduleRow): boolean {
  const unit = safeString(row.unit);
  const rawValues = Object.entries(row)
    .filter(([key]) => key !== "id")
    .map(([, value]) => safeString(value));
  const populated = rawValues.filter(Boolean);

  if (populated.length === 0) {
    return true;
  }

  if (
    populated.length === 1
    && /^caterpillar:\s*confidential\s*green$/i.test(unit)
  ) {
    return true;
  }

  return false;
}

function computeDaysLate(targetDate: string, commitDate: string, existing?: number): number {
  if (Number.isFinite(existing)) {
    return existing as number;
  }

  const target = parseDateLike(targetDate);
  if (!target) {
    return 0;
  }

  const commit = parseDateLike(commitDate) ?? new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const diff = Math.floor((commit.getTime() - target.getTime()) / msPerDay);
  return Math.max(0, diff);
}

function applyShiftedColumnCorrection(partial: Partial<ScheduleProject> & { lwc?: string }): Partial<ScheduleProject> & { lwc?: string } {
  const unitValue = partial.unit ?? "";
  const pdValue = partial.pd ?? "";
  const legalsValue = partial.legals ?? "";
  const hasNumericPd = /^\d+$/.test(pdValue.trim());
  const hasProjectLikeUnit = !!unitValue && !/^\d+$/.test(unitValue.trim()) && !looksLikeProjectCode(unitValue);
  const hasProjectLikeLegals = looksLikeProjectCode(legalsValue);

  // Heuristic: project name landed in unit, unit landed in pd, and pd landed in legals.
  if (hasNumericPd && hasProjectLikeLegals && hasProjectLikeUnit) {
    partial.name = partial.name || unitValue;
    partial.customer = partial.customer || unitValue;
    partial.unit = pdValue;
    partial.pd = legalsValue;
    partial.legals = partial.sw || "";
  }

  return partial;
}

function buildScheduleFromDocument(document: ProjectScheduleDocument): Schedule {
  const projects: Record<string, ScheduleProject> = {};

  for (const group of document.groups) {
    const headerIndex = findHeaderRowIndex(group.rows);
    const semanticMode = headerIndex < 0 && group.rows.some(rowHasSemanticFields);
    const columnFallbackMap = buildColumnMapFromDocumentColumns(document.columns);
    const columnMappedMode = headerIndex < 0 && !semanticMode && columnFallbackMap.size > 0;

    if (headerIndex < 0 && !semanticMode && !columnMappedMode) {
      continue;
    }

    const headerRow = semanticMode || columnMappedMode ? null : group.rows[headerIndex];
    const columnMap = headerRow
      ? buildColumnMap(headerRow)
      : columnMappedMode
        ? columnFallbackMap
        : new Map<string, MappedField>();
    const dataRows = semanticMode || columnMappedMode ? group.rows : group.rows.slice(headerIndex + 1);

    for (const row of dataRows) {
      if (looksLikeHeaderLikeRow(row)) {
        continue;
      }

      const partial: Partial<ScheduleProject> & { lwc?: string } = semanticMode
        ? buildPartialFromSemanticRow(row)
        : {
        legals: "",
        sw: "",
        wo: "",
        proj: "",
        conlay: "",
        conasy: "",
        test: "",
        concus: "",
        pwrchk: "",
        d380Final: "",
        dept380: "",
        commit: "",
        biqComp: "",
        hide: "",
        comments: "",
      };

      if (!semanticMode) {
        for (const [columnKey, scheduleField] of columnMap.entries()) {
          const value = safeString(row[columnKey]);
          if (!value) {
            continue;
          }
          if (scheduleField === "daysLate") {
            partial.daysLate = Number.parseInt(value, 10);
          } else {
            partial[scheduleField] = value;
          }
        }
      }

      applyShiftedColumnCorrection(partial);

      const rawUnit = partial.unit ?? "";
      const rawPd = partial.pd ?? "";
      const pd = looksLikeProjectCode(rawPd)
        ? rawPd
        : looksLikeProjectCode(rawUnit)
          ? rawUnit
          : "";
      const unit = pd === rawPd ? rawUnit : rawPd || rawUnit;
      const resolvedName = partial.name || "";
      const customer = resolvedName || (!looksLikeProjectCode(rawUnit) ? rawUnit : "") || group.projectLabel || "UNKNOWN";
      const name = resolvedName || customer;

      if (!name && !unit && !pd) {
        continue;
      }

      const id = `${pd || "UNKNOWN"}_${name || unit || row.id}`
        .toUpperCase()
        .replace(/\s+/g, "-")
        .replace(/[^A-Z0-9_-]/g, "");

      projects[id] = {
        id,
        name,
        customer,
        unit: unit || "",
        pd: pd || "",
        legals: partial.legals || "",
        sw: partial.sw || "",
        wo: partial.wo || "",
        proj: partial.proj || "",
        conlay: partial.conlay || "",
        conasy: partial.conasy || "",
        test: partial.test || "",
        concus: partial.concus || "",
        pwrchk: partial.pwrchk || "",
        d380Final: partial.d380Final || "",
        dept380: partial.dept380 || "",
        daysLate: computeDaysLate(partial.dept380 || "", partial.commit || "", partial.daysLate),
        commit: partial.commit || "",
        biqComp: partial.biqComp || "",
        hide: partial.hide || "",
        comments: partial.comments || "",
      };
    }
  }

  return {
    importedAt: document.importedAt,
    sourceFile: document.sourceFile || "",
    projects,
  };
}

function serializeScheduleTypeScript(schedule: Schedule): string {
  const body = JSON.stringify(schedule, null, 2);

  return [
    "export interface ScheduleProject {",
    "  id: string;",
    "  name: string;",
    "  customer: string;",
    "  unit: string;",
    "  pd: string;",
    "  legals: string;",
    "  sw: string;",
    "  wo: string;",
    "  proj: string;",
    "  conlay: string;",
    "  conasy: string;",
    "  test: string;",
    "  concus: string;",
    "  pwrchk: string;",
    "  d380Final: string;",
    "  dept380: string;",
    "  daysLate: number;",
    "  commit: string;",
    "  biqComp: string;",
    "  hide: string;",
    "  comments: string;",
    "}",
    "",
    "export interface Schedule {",
    "  importedAt: string;",
    "  sourceFile: string;",
    "  projects: Record<string, ScheduleProject>;",
    "}",
    "",
    `export const ProjectSchedule: Schedule = ${body};`,
    "",
    "export default ProjectSchedule;",
    "",
  ].join("\n");
}

async function readScheduleDocument(paths: SchedulePaths): Promise<ProjectScheduleDocument> {
  const candidates = [paths.shareProjectsScheduleFile, paths.shareScheduleFile];
  for (const filePath of candidates) {
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(raw) as ProjectScheduleDocument;
      if (parsed && Array.isArray(parsed.groups) && Array.isArray(parsed.columns)) {
        return parsed;
      }
    } catch {
      // Continue to fallback candidate.
    }
  }

  return EMPTY_DOCUMENT;
}

async function writeScheduleDocument(paths: SchedulePaths, document: ProjectScheduleDocument) {
  const content = JSON.stringify(document, null, 2);
  const schedule = buildScheduleFromDocument(document);
  const scheduleTs = serializeScheduleTypeScript(schedule);

  await Promise.all([
    fs.writeFile(paths.shareProjectsScheduleFile, content, "utf-8"),
    fs.writeFile(paths.shareScheduleFile, content, "utf-8"),
    fs.writeFile(paths.shareProjectsScheduleTsFile, scheduleTs, "utf-8"),
    fs.writeFile(paths.shareScheduleTsFile, scheduleTs, "utf-8"),
  ]);
}

export async function GET() {
  try {
    const paths = await resolveSchedulePaths();
    await ensureDirs(paths);
    const document = await readScheduleDocument(paths);
    return NextResponse.json(document);
  } catch (error) {
    console.error("Failed to read project schedule:", error);
    return NextResponse.json(
      { error: "Failed to read project schedule" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const paths = await resolveSchedulePaths();
    await ensureDirs(paths);

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const payload = await request.json();
      const normalizedFromJson = normalizeDocument(payload);
      await writeScheduleDocument(paths, normalizedFromJson);

      return NextResponse.json({
        success: true,
        schedule: normalizedFromJson,
        writes: {
          projectsSchedule: paths.shareProjectsScheduleFile,
          scheduleArchive: paths.shareScheduleFile,
        },
      });
    }

    const formData = await request.formData();
    const upload = formData.get("file");
    if (!(upload instanceof File)) {
      return NextResponse.json(
        { error: "A schedule file upload is required." },
        { status: 400 },
      );
    }

    const fileName = path.basename(upload.name);
    if (/\.(csv|xlsx|xls)$/i.test(fileName)) {
      const normalizedCsv = await parseCsvUploadToDocument(upload);
      const canonicalCsv = normalizeDocument(normalizedCsv, fileName);
      await writeScheduleDocument(paths, canonicalCsv);

      return NextResponse.json({
        success: true,
        schedule: canonicalCsv,
        writes: {
          projectsSchedule: paths.shareProjectsScheduleFile,
          scheduleArchive: paths.shareScheduleFile,
        },
      });
    }

    if (!/\.json$/i.test(fileName)) {
      return NextResponse.json(
        { error: "Only .json, .csv, .xlsx, and .xls files are allowed for file upload." },
        { status: 400 },
      );
    }

    const text = await upload.text();
    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Uploaded file is not valid JSON." },
        { status: 400 },
      );
    }

    const normalized = normalizeDocument(parsedPayload, fileName);
    await writeScheduleDocument(paths, normalized);

    return NextResponse.json({
      success: true,
      schedule: normalized,
      writes: {
        projectsSchedule: paths.shareProjectsScheduleFile,
        scheduleArchive: paths.shareScheduleFile,
      },
    });
  } catch (error) {
    console.error("Failed to import project schedule:", error);
    return NextResponse.json(
      { error: "Failed to import project schedule" },
      { status: 500 },
    );
  }
}
