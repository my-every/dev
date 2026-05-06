import { promises as fs } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

export type SlotsSeedRow = Record<string, unknown>;
const CURRENT_MONTH_KEY = new Date().toISOString().slice(0, 7);
const SCHEDULE_SOURCE_FILE = "Schedule.csv";

export interface SlotManifestMetadata {
  source: "Schedule.csv";
  slotKey: string;
  pdNumber: string;
  projectName: string;
  displayName: string;
  unitNumber: string;
  lwcType: string;
  color?: string;
  dueDate: string;
  dueMonth: string | null;
  planConlayDate: string;
  planConassyDate: string;
  shipDate: string;
  deptTargetDate: string;
  daysLate: number | null;
  estimatedTotalHours: number | null;
  estimatedPanelCount: number | null;
  estimatedSampleCount: number | null;
  unitType: string;
  projectType: string;
  controlsSlot: string;
  pmName: string;
  cmpName: string;
  coordinatorName: string;
  needDate: string;
  milestones: {
    legals: string;
    brandList: string;
    brandWire: string;
    projKitted: string;
    conlay: string;
    conassy: string;
    pwrchk: string;
    d380FinalBiq: string;
    dept380Target: string;
  };
}

export type SlotProjectPresenceStatus =
  | "missing_project"
  | "seeded_from_slots"
  | "partial_upload"
  | "uploaded_legals";

export interface SlotProjectIdentity {
  key: string;
  pdNumber: string;
  projectName: string;
  displayName: string;
  unitNumber: string;
  projectId: string;
  folderName: string;
}

interface SlotIdentityContext {
  projectDuplicateCount: number;
  exactDuplicateCount: number;
  exactOccurrenceIndex: number;
}

export interface SlotProjectUploadStatus extends SlotProjectIdentity {
  manifestPath: string;
  projectRoot: string;
  manifestExists: boolean;
  hasWorkbookArtifacts: boolean;
  hasLayoutArtifacts: boolean;
  hasUploadedProjectFiles: boolean;
  legalsUploadStatus: SlotProjectPresenceStatus;
}

export interface SeededSlotProjectResult extends SlotProjectUploadStatus {
  action: "created" | "updated" | "skipped";
}

interface SeedProjectsFromSlotsOptions {
  shareRoot: string;
  overwrite?: boolean;
  dryRun?: boolean;
}

const PROJECTS_DIRECTORY_NAME = "Projects";
const SLOT_SEED_FILENAME = "schedule-seed.json";

function toText(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function toNumber(value: unknown): number | null {
  const normalized = toText(value);
  if (!normalized) {
    return null;
  }
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseUsDateToIso(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return "";
  }

  const match = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) {
    return "";
  }

  const month = Number(match[1]);
  const day = Number(match[2]);
  const rawYear = Number(match[3]);
  const year = match[3].length === 2 ? 2000 + rawYear : rawYear;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function pickColorForDueMonth(dueDate: string, monthKey: string): string {
  if (!dueDate || !monthKey) {
    return "";
  }

  return dueDate.startsWith(monthKey) ? "#F4B400" : "";
}

function normalizeProjectName(rawProjectName: string, unitNumber: string, duplicateCount: number): string {
  const base = rawProjectName || "Untitled Project";
  if (duplicateCount > 1 && unitNumber) {
    return `${base} - Unit ${unitNumber}`;
  }
  return base;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "project";
}

function sanitizeProjectNameSegment(projectName: string, pdNumber: string): string {
  const stripped = projectName
    .trim()
    .replace(new RegExp(`^${pdNumber}(?:\\s*[-_]+\\s*|\\s+)`, "i"), "")
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!stripped) {
    return "";
  }

  const compact = stripped.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const comparable = compact.replace(/_/g, "").toUpperCase();
  const normalizedPd = pdNumber.replace(/[^A-Za-z0-9]+/g, "").toUpperCase();
  return comparable === normalizedPd ? "" : compact;
}

function buildShareProjectFolderName(pdNumber: string, projectName: string): string {
  const normalizedPdNumber = pdNumber.trim().toUpperCase();
  const nameSegment = sanitizeProjectNameSegment(projectName, normalizedPdNumber);
  return nameSegment ? `${normalizedPdNumber}_${nameSegment}` : normalizedPdNumber;
}

function mapLwcType(rawValue: string): string {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return "NEW_FLEX";
  }
  if (normalized.includes("new")) {
    return "NEW_FLEX";
  }
  if (normalized.includes("on")) {
    return "ONSKID";
  }
  if (normalized.includes("off")) {
    return "OFFSKID";
  }
  return normalized.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function inferLegalsScheduleState(rawValue: string): "missing" | "pending_reference" | "dated" | "invalid" {
  const normalized = rawValue.trim().toLowerCase();
  if (!normalized) {
    return "missing";
  }
  if (normalized === "published") {
    return "dated";
  }
  if (normalized === "see #1") {
    return "pending_reference";
  }
  if (normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})([ac])?$/i)) {
    return "dated";
  }
  return "invalid";
}

function buildIdentityContexts(rows: SlotsSeedRow[]): SlotIdentityContext[] {
  const projectCounts = new Map<string, number>();
  const exactCounts = new Map<string, number>();

  for (const row of rows) {
    const pdNumber = toText(row["PD#"]).toUpperCase();
    const projectName = toText(row["PROJECT"]);
    const unitNumber = toText(row["UNIT"]);
    const projectKey = `${pdNumber}::${projectName}`;
    const exactKey = `${projectKey}::${unitNumber}`;
    projectCounts.set(projectKey, (projectCounts.get(projectKey) ?? 0) + 1);
    exactCounts.set(exactKey, (exactCounts.get(exactKey) ?? 0) + 1);
  }

  const exactSeen = new Map<string, number>();
  return rows.map((row) => {
    const pdNumber = toText(row["PD#"]).toUpperCase();
    const projectName = toText(row["PROJECT"]);
    const unitNumber = toText(row["UNIT"]);
    const projectKey = `${pdNumber}::${projectName}`;
    const exactKey = `${projectKey}::${unitNumber}`;
    const exactOccurrenceIndex = (exactSeen.get(exactKey) ?? 0) + 1;
    exactSeen.set(exactKey, exactOccurrenceIndex);

    return {
      projectDuplicateCount: projectCounts.get(projectKey) ?? 1,
      exactDuplicateCount: exactCounts.get(exactKey) ?? 1,
      exactOccurrenceIndex,
    };
  });
}

export function buildSlotProjectIdentity(
  row: SlotsSeedRow,
  context: SlotIdentityContext,
): SlotProjectIdentity {
  const pdNumber = toText(row["PD#"]).toUpperCase();
  const rawProjectName = toText(row["PROJECT"]) || "Untitled Project";
  const unitNumber = toText(row["UNIT"]);
  const duplicateKey = `${pdNumber}::${rawProjectName}`;
  let displayName = normalizeProjectName(rawProjectName, unitNumber, context.projectDuplicateCount);
  if (context.exactDuplicateCount > 1) {
    displayName = `${displayName}`;
  }
  const projectId = `${slugify(pdNumber)}-${slugify(displayName)}`;
  const folderName = buildShareProjectFolderName(pdNumber, displayName);

  return {
    key: duplicateKey,
    pdNumber,
    projectName: rawProjectName,
    displayName,
    unitNumber,
    projectId,
    folderName,
  };
}

function buildLifecycleGates(row: SlotsSeedRow, legalsUploaded: boolean) {
  const legalsRaw = toText(row["LEGALS"]);
  const brandListRaw = toText(row["BRAND LIST"]);
  const brandWireRaw = toText(row["BRAND WIRE"]);
  const kittedRaw = toText(row["PROJ KITTED"]);

  return [
    {
      gateId: "LEGALS_READY",
      status: legalsUploaded ? "COMPLETE" : inferLegalsScheduleState(legalsRaw) === "missing" ? "LOCKED" : "READY",
      targetDate: parseUsDateToIso(legalsRaw) || undefined,
      notes: legalsUploaded ? "Detected uploaded workbook + layout artifacts." : "Seeded from Schedule.csv legals milestone.",
    },
    {
      gateId: "BRANDLIST_COMPLETE",
      status: brandListRaw ? "READY" : "LOCKED",
      targetDate: parseUsDateToIso(brandListRaw) || undefined,
      notes: "Seeded from Schedule.csv brand-list milestone.",
    },
    {
      gateId: "BRANDING_READY",
      status: brandWireRaw ? "READY" : "LOCKED",
      targetDate: parseUsDateToIso(brandWireRaw) || undefined,
      notes: "Seeded from Schedule.csv branding milestone.",
    },
    {
      gateId: "KITTING_READY",
      status: kittedRaw ? "READY" : "LOCKED",
      targetDate: parseUsDateToIso(kittedRaw) || undefined,
      notes: "Seeded from Schedule.csv kitting milestone.",
    },
  ] as const;
}

function deriveProjectStatus(row: SlotsSeedRow, hasUploadedProjectFiles: boolean) {
  if (!hasUploadedProjectFiles) {
    return "legals_pending";
  }
  if (toText(row["BRAND LIST"])) {
    return "brandlist";
  }
  if (toText(row["BRAND WIRE"])) {
    return "branding";
  }
  if (toText(row["PROJ KITTED"])) {
    return "kitting";
  }
  return "active";
}

function buildSeedManifest(row: SlotsSeedRow, identity: SlotProjectIdentity, hasUploadedProjectFiles: boolean) {
  const scheduleMetadata = buildSlotManifestMetadata(row, identity);
  const revision = toText(row["Applic"]) || toText(row["REV"]) || "";
  const unitType = scheduleMetadata.unitType || "UNSPECIFIED";

  return {
    id: identity.projectId,
    name: identity.displayName,
    filename: `slots-seeded:${identity.pdNumber}:${identity.unitNumber || "unitless"}`,
    pdNumber: identity.pdNumber,
    unitNumber: identity.unitNumber,
    revision,
    lwcType: scheduleMetadata.lwcType,
    color: scheduleMetadata.color ?? "",
    unitType,
    unitTypes: unitType ? [unitType] : [],
    createdAt: new Date().toISOString(),
    dueDate: scheduleMetadata.dueDate,
    planConlayDate: scheduleMetadata.planConlayDate,
    planConassyDate: scheduleMetadata.planConassyDate,
    sheets: [],
    assignments: {},
    lifecycleGates: buildLifecycleGates(row, hasUploadedProjectFiles),
    aggregates: {
      totalAssignments: 0,
      completedAssignments: 0,
      inProgressAssignments: 0,
      blockedAssignments: 0,
      totalEstimatedMinutes: 0,
      totalRemainingMinutes: 0,
      totalActualMinutes: 0,
      overallProgress: 0,
      highestPriority: "low",
      priorityCounts: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      stageCounts: {},
    },
    panducts: 0,
    rails: 0,
    status: deriveProjectStatus(row, hasUploadedProjectFiles),
    estimatedTotalHours: scheduleMetadata.estimatedTotalHours,
    estimatedPanelCount: scheduleMetadata.estimatedPanelCount,
    estimatedSampleCount: scheduleMetadata.estimatedSampleCount,
    daysLate: scheduleMetadata.daysLate,
    deptTargetDate: scheduleMetadata.deptTargetDate,
    shipDate: scheduleMetadata.shipDate,
    activeWorkbookRevisionId: null,
    activeLayoutRevisionId: null,
    scheduleMetadata,
  };
}

function buildSeedMetadata(row: SlotsSeedRow, identity: SlotProjectIdentity) {
  return {
    source: "Schedule.csv",
    seededAt: new Date().toISOString(),
    pdNumber: identity.pdNumber,
    projectName: identity.projectName,
    displayName: identity.displayName,
    unitNumber: identity.unitNumber,
    scheduleSnapshot: {
      LEGALS: toText(row["LEGALS"]),
      BRAND_LIST: toText(row["BRAND LIST"]),
      BRAND_WIRE: toText(row["BRAND WIRE"]),
      PROJ_KITTED: toText(row["PROJ KITTED"]),
      CONLAY: toText(row["CONLAY"]),
      CONASY: toText(row["CONASY"]),
      PWRCHK: toText(row["PWRCHK"]),
      D380_FINAL_BIQ: toText(row["D380 FINAL-BIQ"]),
      DEPT_380_TARGET: toText(row["DEPT 380 TARGET"]),
      LWC: toText(row["LWC"]),
      UNIT_TYPE: toText(row["Unit Type"]),
    },
  };
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function ensureDirectory(filePath: string) {
  await fs.mkdir(filePath, { recursive: true });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function hasAnyFiles(directoryPath: string) {
  try {
    const entries = await fs.readdir(directoryPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

export async function inspectSlotProjectStatus(
  shareRoot: string,
  row: SlotsSeedRow,
  context: SlotIdentityContext,
): Promise<SlotProjectUploadStatus> {
  const identity = buildSlotProjectIdentity(row, context);
  const projectRoot = path.join(shareRoot, PROJECTS_DIRECTORY_NAME, identity.folderName);
  const stateRoot = path.join(projectRoot, "state");
  const manifestPath = path.join(stateRoot, "project-manifest.json");
  const manifest = await readJson<Record<string, unknown>>(manifestPath);

  const manifestExists = Boolean(manifest);
  const workbookFlag = typeof manifest?.activeWorkbookRevisionId === "string" && manifest.activeWorkbookRevisionId.length > 0;
  const layoutFlag = typeof manifest?.activeLayoutRevisionId === "string" && manifest.activeLayoutRevisionId.length > 0;
  const hasSheetArtifacts = await hasAnyFiles(path.join(stateRoot, "sheets"));
  const hasLayoutArtifacts = layoutFlag || await fileExists(path.join(stateRoot, "layout-pages.json"));
  const hasWorkbookArtifacts = workbookFlag || hasSheetArtifacts || await fileExists(path.join(stateRoot, "upload-props.json"));
  const hasUploadedProjectFiles = hasWorkbookArtifacts && hasLayoutArtifacts;

  let legalsUploadStatus: SlotProjectPresenceStatus = "missing_project";
  if (manifestExists && hasUploadedProjectFiles) {
    legalsUploadStatus = "uploaded_legals";
  } else if (manifestExists && (hasWorkbookArtifacts || hasLayoutArtifacts)) {
    legalsUploadStatus = "partial_upload";
  } else if (manifestExists) {
    legalsUploadStatus = "seeded_from_slots";
  }

  return {
    ...identity,
    projectRoot,
    manifestPath,
    manifestExists,
    hasWorkbookArtifacts,
    hasLayoutArtifacts,
    hasUploadedProjectFiles,
    legalsUploadStatus,
  };
}

export async function loadSlotsRowsFromShare(shareRoot: string): Promise<SlotsSeedRow[]> {
  const schedulePath = path.join(shareRoot, "Schedule", SCHEDULE_SOURCE_FILE);
  const raw = await fs.readFile(schedulePath, "utf-8");
  const workbook = XLSX.read(raw, { type: "string", raw: false });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = firstSheetName ? workbook.Sheets[firstSheetName] : null;
  if (!firstSheet) {
    throw new Error(`${SCHEDULE_SOURCE_FILE} is missing its first worksheet`);
  }

  const parsed = XLSX.utils.sheet_to_json<SlotsSeedRow>(firstSheet, {
    defval: "",
    raw: false,
  });

  if (!Array.isArray(parsed)) {
    throw new Error(`${SCHEDULE_SOURCE_FILE} did not produce a row array`);
  }

  return parsed;
}

const slotsRowsCache = new Map<string, Promise<SlotsSeedRow[]>>();

async function loadCachedSlotsRowsFromShare(shareRoot: string): Promise<SlotsSeedRow[]> {
  const cacheKey = path.resolve(shareRoot);
  const existing = slotsRowsCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const next = loadSlotsRowsFromShare(shareRoot);
  slotsRowsCache.set(cacheKey, next);
  return next;
}

export function buildSlotManifestMetadata(
  row: SlotsSeedRow,
  identity: SlotProjectIdentity,
  options: { monthKey?: string } = {},
): SlotManifestMetadata {
  const monthKey = options.monthKey ?? CURRENT_MONTH_KEY;
  const dueDate = parseUsDateToIso(toText(row["DEPT 380 TARGET"]));
  const planConlayDate = parseUsDateToIso(toText(row["CONLAY"]));
  const planConassyDate = parseUsDateToIso(toText(row["CONASY"]));
  const shipDate = parseUsDateToIso(toText(row["SHIPC"] || row["Cons Ship"] || row["Cons Ship - 2"]));
  const deptTargetDate = dueDate;

  return {
    source: "Schedule.csv",
    slotKey: identity.key,
    pdNumber: identity.pdNumber,
    projectName: identity.projectName,
    displayName: identity.displayName,
    unitNumber: identity.unitNumber,
    lwcType: mapLwcType(toText(row["LWC"])),
    color: pickColorForDueMonth(dueDate, monthKey) || undefined,
    dueDate,
    dueMonth: dueDate ? dueDate.slice(0, 7) : null,
    planConlayDate,
    planConassyDate,
    shipDate,
    deptTargetDate,
    daysLate: toNumber(row["DAYS LATE"]),
    estimatedTotalHours: toNumber(row["Est Total Hours"]),
    estimatedPanelCount: toNumber(row["Est Panel Count"]),
    estimatedSampleCount: toNumber(row["Est Sample Count"]),
    unitType: toText(row["Unit Type"]) || "UNSPECIFIED",
    projectType: toText(row["Project Type"]),
    controlsSlot: toText(row["Controls Slot"]),
    pmName: toText(row["PM Name"]),
    cmpName: toText(row["CMP Name"]),
    coordinatorName: toText(row["Coord Name"]),
    needDate: parseUsDateToIso(toText(row["Need Dt"])),
    milestones: {
      legals: parseUsDateToIso(toText(row["LEGALS"])),
      brandList: parseUsDateToIso(toText(row["BRAND LIST"])),
      brandWire: parseUsDateToIso(toText(row["BRAND WIRE"])),
      projKitted: parseUsDateToIso(toText(row["PROJ KITTED"])),
      conlay: planConlayDate,
      conassy: planConassyDate,
      pwrchk: parseUsDateToIso(toText(row["PWRCHK"])),
      d380FinalBiq: parseUsDateToIso(toText(row["D380 FINAL-BIQ"])),
      dept380Target: deptTargetDate,
    },
  };
}

export async function findSlotManifestMetadata(
  shareRoot: string,
  input: {
    pdNumber: string;
    unitNumber?: string | null;
    monthKey?: string;
  },
): Promise<SlotManifestMetadata | null> {
  const rows = await loadCachedSlotsRowsFromShare(shareRoot);
  const contexts = buildIdentityContexts(rows);
  const targetPdNumber = input.pdNumber.trim().toUpperCase();
  const targetUnitNumber = toText(input.unitNumber);

  let fallbackIndex = -1;

  for (const [index, row] of rows.entries()) {
    const identity = buildSlotProjectIdentity(row, contexts[index]);
    if (identity.pdNumber !== targetPdNumber) {
      continue;
    }

    if (fallbackIndex < 0) {
      fallbackIndex = index;
    }

    if (targetUnitNumber && identity.unitNumber !== targetUnitNumber) {
      continue;
    }

    return buildSlotManifestMetadata(row, identity, { monthKey: input.monthKey });
  }

  if (fallbackIndex >= 0) {
    return buildSlotManifestMetadata(rows[fallbackIndex], buildSlotProjectIdentity(rows[fallbackIndex], contexts[fallbackIndex]), {
      monthKey: input.monthKey,
    });
  }

  return null;
}

export async function getSlotProjectsUploadStatuses(shareRoot: string): Promise<SlotProjectUploadStatus[]> {
  const rows = await loadSlotsRowsFromShare(shareRoot);
  const contexts = buildIdentityContexts(rows);
  return Promise.all(rows.map((row, index) => inspectSlotProjectStatus(shareRoot, row, contexts[index])));
}

export async function seedProjectsFromSlots({
  shareRoot,
  overwrite = false,
  dryRun = false,
}: SeedProjectsFromSlotsOptions): Promise<SeededSlotProjectResult[]> {
  const rows = await loadSlotsRowsFromShare(shareRoot);
  const contexts = buildIdentityContexts(rows);
  const results: SeededSlotProjectResult[] = [];

  for (const [index, row] of rows.entries()) {
    const currentStatus = await inspectSlotProjectStatus(shareRoot, row, contexts[index]);
    const nextAction: SeededSlotProjectResult["action"] =
      currentStatus.manifestExists ? (overwrite ? "updated" : "skipped") : "created";

    if (!dryRun && nextAction !== "skipped") {
      const projectRoot = currentStatus.projectRoot;
      const stateRoot = path.join(projectRoot, "state");
      await ensureDirectory(projectRoot);
      await ensureDirectory(path.join(projectRoot, "exports"));
      await ensureDirectory(path.join(projectRoot, "revisions"));
      await ensureDirectory(path.join(projectRoot, "source"));
      await ensureDirectory(stateRoot);
      await ensureDirectory(path.join(stateRoot, "sheets"));

      const manifest = buildSeedManifest(row, currentStatus, currentStatus.hasUploadedProjectFiles);
      const seedMetadata = buildSeedMetadata(row, currentStatus);

      await fs.writeFile(currentStatus.manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
      await fs.writeFile(path.join(stateRoot, SLOT_SEED_FILENAME), JSON.stringify(seedMetadata, null, 2), "utf-8");
    }

    const finalStatus =
      dryRun || nextAction === "skipped"
        ? currentStatus
        : await inspectSlotProjectStatus(shareRoot, row, contexts[index]);

    results.push({
      ...finalStatus,
      action: nextAction,
    });
  }

  return results;
}
