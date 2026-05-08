import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveShareDirectory } from "@/lib/runtime/share-directory";
import {
  readProjectManifest,
  resolveProjectStateDirectory,
} from "@/lib/project-state/share-project-state-handlers";
import type { ProjectManifest } from "@/types/project-manifest";

const PROJECT_SETTINGS_FILE = "assignment-visibility-settings.json";
const REFERENCE_SETTINGS_FILE = "assignment-visibility-settings-reference.json";

function normalizeKey(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function normalizeSheetName(value: string | null | undefined): string {
  return normalizeKey(value);
}

function normalizeUnitType(value: string | null | undefined): string {
  return normalizeKey(value);
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf-8");
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export interface AssignmentVisibilityLocationSettings {
  location: string;
  wireListVisible: boolean;
  brandingVisible: boolean;
  crossWireVisible: boolean;
}

export interface AssignmentVisibilitySettingsEntry {
  sheetSlug: string;
  sheetName: string;
  unitType?: string | null;
  locations: AssignmentVisibilityLocationSettings[];
}

export interface ProjectAssignmentVisibilitySettingsDocument {
  version: 1;
  updatedAt: string;
  projectId: string;
  pdNumber: string | null;
  assignments: AssignmentVisibilitySettingsEntry[];
}

interface AssignmentVisibilityReferenceAssignment {
  sheetName: string;
  locations: AssignmentVisibilityLocationSettings[];
}

interface AssignmentVisibilityReferenceUnitType {
  unitType: string;
  assignments: AssignmentVisibilityReferenceAssignment[];
}

export interface AssignmentVisibilityReferenceDocument {
  version: 1;
  updatedAt: string;
  unitTypes: AssignmentVisibilityReferenceUnitType[];
}

export interface ResolvedVisibilityLocation {
  wireListVisible: boolean;
  brandingVisible: boolean;
  crossWireVisible: boolean;
  source: "project" | "reference" | "manifest-default";
}

export type ResolvedVisibilityBySheet = Record<
  string,
  Record<string, ResolvedVisibilityLocation>
>;

async function resolveProjectSettingsPath(projectId: string): Promise<string | null> {
  const stateDirectory = await resolveProjectStateDirectory(projectId);
  if (!stateDirectory) {
    return null;
  }
  return path.join(stateDirectory, PROJECT_SETTINGS_FILE);
}

async function resolveReferenceSettingsPath(): Promise<string> {
  const shareRoot = await resolveShareDirectory();
  return path.join(shareRoot, "References", REFERENCE_SETTINGS_FILE);
}

function sanitizeSettingsEntry(entry: AssignmentVisibilitySettingsEntry): AssignmentVisibilitySettingsEntry {
  const dedup = new Map<string, AssignmentVisibilityLocationSettings>();

  for (const location of entry.locations ?? []) {
    const key = normalizeKey(location.location);
    if (!key) {
      continue;
    }

    dedup.set(key, {
      location: String(location.location ?? "").trim(),
      wireListVisible: toBoolean(location.wireListVisible, true),
      brandingVisible: toBoolean(location.brandingVisible, true),
      crossWireVisible: toBoolean(location.crossWireVisible, true),
    });
  }

  return {
    sheetSlug: String(entry.sheetSlug ?? "").trim(),
    sheetName: String(entry.sheetName ?? "").trim(),
    unitType: entry.unitType ? String(entry.unitType).trim() : null,
    locations: Array.from(dedup.values()),
  };
}

function sanitizeProjectDocument(
  projectId: string,
  pdNumber: string | null,
  assignments: AssignmentVisibilitySettingsEntry[],
): ProjectAssignmentVisibilitySettingsDocument {
  const cleaned = assignments
    .map(sanitizeSettingsEntry)
    .filter((entry) => entry.sheetSlug || entry.sheetName);

  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    projectId,
    pdNumber,
    assignments: cleaned,
  };
}

function emptyReferenceDocument(): AssignmentVisibilityReferenceDocument {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    unitTypes: [],
  };
}

export async function readProjectAssignmentVisibilitySettings(
  projectId: string,
): Promise<ProjectAssignmentVisibilitySettingsDocument | null> {
  const settingsPath = await resolveProjectSettingsPath(projectId);
  if (!settingsPath) {
    return null;
  }
  return readJsonFile<ProjectAssignmentVisibilitySettingsDocument>(settingsPath);
}

export async function readAssignmentVisibilityReferenceSettings(): Promise<AssignmentVisibilityReferenceDocument> {
  const referencePath = await resolveReferenceSettingsPath();
  const doc = await readJsonFile<AssignmentVisibilityReferenceDocument>(referencePath);
  if (!doc || doc.version !== 1 || !Array.isArray(doc.unitTypes)) {
    return emptyReferenceDocument();
  }
  return doc;
}

async function writeAssignmentVisibilityReferenceSettings(doc: AssignmentVisibilityReferenceDocument) {
  const referencePath = await resolveReferenceSettingsPath();
  await writeJsonFile(referencePath, {
    ...doc,
    version: 1,
    updatedAt: new Date().toISOString(),
  });
}

function upsertReferenceFromAssignments(
  reference: AssignmentVisibilityReferenceDocument,
  assignments: AssignmentVisibilitySettingsEntry[],
): AssignmentVisibilityReferenceDocument {
  const next: AssignmentVisibilityReferenceDocument = {
    ...reference,
    unitTypes: [...reference.unitTypes],
    updatedAt: new Date().toISOString(),
  };

  for (const assignment of assignments) {
    const unitTypeKey = normalizeUnitType(assignment.unitType);
    const sheetNameKey = normalizeSheetName(assignment.sheetName);
    if (!unitTypeKey || !sheetNameKey) {
      continue;
    }

    let unitTypeEntry = next.unitTypes.find(
      (entry) => normalizeUnitType(entry.unitType) === unitTypeKey,
    );
    if (!unitTypeEntry) {
      unitTypeEntry = {
        unitType: String(assignment.unitType ?? "").trim(),
        assignments: [],
      };
      next.unitTypes.push(unitTypeEntry);
    }

    const existingAssignmentIndex = unitTypeEntry.assignments.findIndex(
      (entry) => normalizeSheetName(entry.sheetName) === sheetNameKey,
    );
    const assignmentValue: AssignmentVisibilityReferenceAssignment = {
      sheetName: assignment.sheetName,
      locations: assignment.locations.map((loc) => ({
        location: loc.location,
        wireListVisible: loc.wireListVisible,
        brandingVisible: loc.brandingVisible,
        crossWireVisible: loc.crossWireVisible,
      })),
    };

    if (existingAssignmentIndex >= 0) {
      unitTypeEntry.assignments[existingAssignmentIndex] = assignmentValue;
    } else {
      unitTypeEntry.assignments.push(assignmentValue);
    }
  }

  return next;
}

export async function writeProjectAssignmentVisibilitySettings(input: {
  projectId: string;
  pdNumber?: string | null;
  assignments: AssignmentVisibilitySettingsEntry[];
  persistToReference?: boolean;
}): Promise<{
  settings: ProjectAssignmentVisibilitySettingsDocument;
  referenceUpdated: boolean;
}> {
  const settingsPath = await resolveProjectSettingsPath(input.projectId);
  if (!settingsPath) {
    throw new Error("Project state directory not found.");
  }

  const settings = sanitizeProjectDocument(
    input.projectId,
    input.pdNumber ?? null,
    input.assignments,
  );

  await writeJsonFile(settingsPath, settings);

  if (!input.persistToReference) {
    return { settings, referenceUpdated: false };
  }

  const reference = await readAssignmentVisibilityReferenceSettings();
  const mergedReference = upsertReferenceFromAssignments(reference, settings.assignments);
  await writeAssignmentVisibilityReferenceSettings(mergedReference);

  return { settings, referenceUpdated: true };
}

function buildProjectAssignmentLookup(doc: ProjectAssignmentVisibilitySettingsDocument | null) {
  const bySheetSlug = new Map<string, AssignmentVisibilitySettingsEntry>();

  for (const entry of doc?.assignments ?? []) {
    const sheetSlug = String(entry.sheetSlug ?? "").trim();
    if (sheetSlug) {
      bySheetSlug.set(sheetSlug, sanitizeSettingsEntry(entry));
    }
  }

  return { bySheetSlug };
}

function buildReferenceLookup(doc: AssignmentVisibilityReferenceDocument) {
  const byUnitTypeAndSheet = new Map<string, AssignmentVisibilityReferenceAssignment>();

  for (const unitType of doc.unitTypes ?? []) {
    const unitTypeKey = normalizeUnitType(unitType.unitType);
    if (!unitTypeKey) {
      continue;
    }

    for (const assignment of unitType.assignments ?? []) {
      const sheetNameKey = normalizeSheetName(assignment.sheetName);
      if (!sheetNameKey) {
        continue;
      }
      byUnitTypeAndSheet.set(`${unitTypeKey}::${sheetNameKey}`, assignment);
    }
  }

  return { byUnitTypeAndSheet };
}

function toResolvedLocationMap(
  sourceLocations: AssignmentVisibilityLocationSettings[] | undefined,
): Map<string, AssignmentVisibilityLocationSettings> {
  const map = new Map<string, AssignmentVisibilityLocationSettings>();
  for (const location of sourceLocations ?? []) {
    const key = normalizeKey(location.location);
    if (!key) {
      continue;
    }
    map.set(key, {
      location: String(location.location ?? "").trim(),
      wireListVisible: toBoolean(location.wireListVisible, true),
      brandingVisible: toBoolean(location.brandingVisible, true),
      crossWireVisible: toBoolean(location.crossWireVisible, true),
    });
  }
  return map;
}

export function resolveVisibilitySettingsForManifest(
  manifest: ProjectManifest,
  projectSettings: ProjectAssignmentVisibilitySettingsDocument | null,
  referenceSettings: AssignmentVisibilityReferenceDocument,
): ResolvedVisibilityBySheet {
  const resolved: ResolvedVisibilityBySheet = {};

  const projectLookup = buildProjectAssignmentLookup(projectSettings);
  const referenceLookup = buildReferenceLookup(referenceSettings);

  for (const [sheetSlug, assignment] of Object.entries(manifest.assignments ?? {})) {
    const row: Record<string, ResolvedVisibilityLocation> = {};
    const projectAssignment = projectLookup.bySheetSlug.get(sheetSlug);
    const projectLocationMap = toResolvedLocationMap(projectAssignment?.locations);

    const referenceKey = `${normalizeUnitType(assignment.unitType)}::${normalizeSheetName(assignment.sheetName)}`;
    const referenceAssignment = referenceLookup.byUnitTypeAndSheet.get(referenceKey);
    const referenceLocationMap = toResolvedLocationMap(referenceAssignment?.locations);

    for (const location of assignment.externalLocations ?? []) {
      const key = normalizeKey(location.location);
      if (!key) {
        continue;
      }

      const projectLocation = projectLocationMap.get(key);
      if (projectLocation) {
        row[key] = {
          wireListVisible: projectLocation.wireListVisible,
          brandingVisible: projectLocation.brandingVisible,
          crossWireVisible: projectLocation.crossWireVisible,
          source: "project",
        };
        continue;
      }

      const referenceLocation = referenceLocationMap.get(key);
      if (referenceLocation) {
        row[key] = {
          wireListVisible: referenceLocation.wireListVisible,
          brandingVisible: referenceLocation.brandingVisible,
          crossWireVisible: referenceLocation.crossWireVisible,
          source: "reference",
        };
        continue;
      }

      row[key] = {
        wireListVisible: toBoolean(location.wireListVisible, true),
        brandingVisible: toBoolean(location.brandingVisible, true),
        crossWireVisible: toBoolean(location.wireListVisible, true),
        source: "manifest-default",
      };
    }

    resolved[sheetSlug] = row;
  }

  return resolved;
}

export function applyResolvedVisibilityToManifest(
  manifest: ProjectManifest,
  resolved: ResolvedVisibilityBySheet,
): ProjectManifest {
  const nextAssignments: ProjectManifest["assignments"] = {
    ...manifest.assignments,
  };

  for (const [sheetSlug, assignment] of Object.entries(manifest.assignments ?? {})) {
    const row = resolved[sheetSlug] ?? {};
    const nextLocations = (assignment.externalLocations ?? []).map((location) => {
      const key = normalizeKey(location.location);
      const values = row[key];
      if (!values) {
        return location;
      }
      return {
        ...location,
        wireListVisible: values.wireListVisible,
        brandingVisible: values.brandingVisible,
      };
    });

    nextAssignments[sheetSlug] = {
      ...assignment,
      externalLocations: nextLocations,
    };
  }

  return {
    ...manifest,
    assignments: nextAssignments,
  };
}

export async function loadResolvedVisibilityForProject(projectId: string): Promise<{
  manifest: ProjectManifest;
  settings: ProjectAssignmentVisibilitySettingsDocument | null;
  reference: AssignmentVisibilityReferenceDocument;
  resolvedBySheet: ResolvedVisibilityBySheet;
}> {
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    throw new Error("Project not found");
  }

  const [settings, reference] = await Promise.all([
    readProjectAssignmentVisibilitySettings(projectId),
    readAssignmentVisibilityReferenceSettings(),
  ]);

  const resolvedBySheet = resolveVisibilitySettingsForManifest(
    manifest,
    settings,
    reference,
  );

  return {
    manifest,
    settings,
    reference,
    resolvedBySheet,
  };
}
