import { readAssignmentMappings } from "@/lib/project-state/share-project-state-handlers";

export type MeasurementReuseConfidence = "high" | "medium" | "low" | "none";

export interface MeasurementReuseSourceResolution {
  sourceSheetSlug: string;
  sourceInferenceUsed: boolean;
  confidence: MeasurementReuseConfidence;
  reason: string;
}

function normalizeSlug(value: string | undefined): string {
  return (value ?? "").trim();
}

function normalizeUnitTypeToken(rawValue: string | undefined): string {
  if (!rawValue) return "";
  const match = rawValue.match(/\b(JB\d+)\b/i);
  if (match?.[1]) return match[1].toUpperCase();
  return rawValue.trim().toUpperCase();
}

function extractUnitNumber(rawValue: string | undefined): number | null {
  if (!rawValue) return null;
  const match = rawValue.match(/\b(?:UNIT|U)?\s*(\d+)\b/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferAssignmentUnitType(assignment: {
  matchedLayoutTitle?: string;
  sheetName: string;
}): string {
  const fromLayout = normalizeUnitTypeToken(assignment.matchedLayoutTitle);
  if (fromLayout) return fromLayout;
  return normalizeUnitTypeToken(assignment.sheetName);
}

export async function resolveMeasurementReuseSource(
  projectId: string,
  explicitSourceSheetSlug: string | undefined,
  targetSheetSlugs: string[],
): Promise<MeasurementReuseSourceResolution> {
  const explicit = normalizeSlug(explicitSourceSheetSlug);
  if (explicit) {
    return {
      sourceSheetSlug: explicit,
      sourceInferenceUsed: false,
      confidence: "high",
      reason: "Source sheet was explicitly provided.",
    };
  }

  const mappings = await readAssignmentMappings(projectId);
  if (mappings.length === 0 || targetSheetSlugs.length === 0) {
    return {
      sourceSheetSlug: "",
      sourceInferenceUsed: true,
      confidence: "none",
      reason: "No assignment mappings were available to infer a source sheet.",
    };
  }

  const targetSlug = normalizeSlug(targetSheetSlugs[0]);
  const target = mappings.find((entry) => entry.sheetSlug === targetSlug);
  if (!target) {
    return {
      sourceSheetSlug: "",
      sourceInferenceUsed: true,
      confidence: "none",
      reason: `Target sheet ${targetSlug} was not found in assignment mappings.`,
    };
  }

  const targetUnitType = inferAssignmentUnitType(target);
  const sameUnitTypeAssignments = mappings
    .filter((entry) => inferAssignmentUnitType(entry) === targetUnitType)
    .map((entry) => ({
      entry,
      unitNumber:
        extractUnitNumber(entry.matchedLayoutTitle) ??
        extractUnitNumber(entry.sheetName) ??
        Number.POSITIVE_INFINITY,
    }))
    .sort((left, right) => left.unitNumber - right.unitNumber);

  const exactUnitOne = sameUnitTypeAssignments.find(
    ({ entry, unitNumber }) => unitNumber === 1 && entry.sheetSlug !== target.sheetSlug,
  )?.entry.sheetSlug;
  if (exactUnitOne) {
    return {
      sourceSheetSlug: exactUnitOne,
      sourceInferenceUsed: true,
      confidence: "high",
      reason: `Resolved to Unit 1 sheet in the same unit type group (${targetUnitType}).`,
    };
  }

  const nearestSameGroup = sameUnitTypeAssignments.find(
    ({ entry }) => entry.sheetSlug !== target.sheetSlug,
  )?.entry.sheetSlug;
  if (nearestSameGroup) {
    return {
      sourceSheetSlug: nearestSameGroup,
      sourceInferenceUsed: true,
      confidence: "medium",
      reason: `Resolved to the nearest sibling sheet in the same unit type group (${targetUnitType}).`,
    };
  }

  const globalUnitOne = mappings
    .map((entry) => ({
      entry,
      unitNumber:
        extractUnitNumber(entry.matchedLayoutTitle) ??
        extractUnitNumber(entry.sheetName) ??
        Number.POSITIVE_INFINITY,
    }))
    .sort((left, right) => left.unitNumber - right.unitNumber)
    .find(({ entry, unitNumber }) => unitNumber === 1 && entry.sheetSlug !== target.sheetSlug)?.entry.sheetSlug;

  if (globalUnitOne) {
    return {
      sourceSheetSlug: globalUnitOne,
      sourceInferenceUsed: true,
      confidence: "low",
      reason: "Resolved to the first available Unit 1 sheet across the project.",
    };
  }

  return {
    sourceSheetSlug: "",
    sourceInferenceUsed: true,
    confidence: "none",
    reason: "No suitable source sheet could be inferred.",
  };
}
