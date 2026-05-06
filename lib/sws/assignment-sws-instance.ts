import {
  createDefaultAssignmentSwsConfig,
  createDefaultAssignmentWorkspaceState,
  type AssignmentSwsConfig,
} from "@/types/d380-assignment-sws";
import type { ManifestAssignment, ProjectManifest } from "@/types/project-manifest";
import { resolveSwsTemplateIdForAssignment } from "@/lib/sws/assignment-template-resolution";
import { SWS_TEMPLATE_REGISTRY } from "@/lib/sws/sws-template-registry";
import type { SwsExecutionMode, SwsTemplateId, SwsWorksheetMetadata } from "@/types/d380-sws";

export interface AssignmentSwsInstance {
  config: AssignmentSwsConfig;
  assignment: ManifestAssignment;
  templateId: SwsTemplateId;
}

export function getAssignmentFromManifest(manifest: ProjectManifest, sheetSlug: string): ManifestAssignment | null {
  const assignments = manifest.assignments ?? {};
  const direct = assignments[sheetSlug];
  if (direct && direct.kind === "operational") return direct as ManifestAssignment;

  const bySlug = Object.values(assignments).find(
    (assignment) => assignment.kind === "operational" && assignment.sheetSlug === sheetSlug,
  );

  return (bySlug as ManifestAssignment | undefined) ?? null;
}

export function buildMergedWorksheetMetadata(
  manifest: ProjectManifest,
  assignment: ManifestAssignment,
  templateId: SwsTemplateId,
  existing?: Partial<SwsWorksheetMetadata>,
): SwsWorksheetMetadata {
  const template = SWS_TEMPLATE_REGISTRY[templateId];
  const today = new Date().toISOString().slice(0, 10);

  return {
    pdNumber: manifest.pdNumber || assignment.sheetSlug,
    projectName: manifest.name || assignment.sheetName,
    unit: manifest.unitNumber || assignment.unitType || "1",
    panel: existing?.panel ?? assignment.sheetName,
    box: existing?.box,
    bays: existing?.bays,
    date: existing?.date || today,
    revision: manifest.revision || "0.1",
    swsIpvId: template?.swsIpvId ?? templateId,
    revLevel: template?.revisionLevel ?? (manifest.revision || "0.1"),
    revDate: template?.revisionDate ?? today,
    ...existing,
  };
}

export function hydrateAssignmentSwsConfig(
  manifest: ProjectManifest,
  assignment: ManifestAssignment,
  existingConfig?: AssignmentSwsConfig | null,
  mode?: SwsExecutionMode,
): AssignmentSwsInstance {
  const resolvedTemplateId = resolveSwsTemplateIdForAssignment(
    assignment,
    existingConfig?.templateId ?? null,
  ) as SwsTemplateId;

  const template = SWS_TEMPLATE_REGISTRY[resolvedTemplateId];
  const base = existingConfig ? { ...existingConfig } : createDefaultAssignmentSwsConfig(resolvedTemplateId);
  const sectionOrder =
    base.sectionOrder && base.sectionOrder.length > 0
      ? base.sectionOrder
      : (template?.sections ?? []).map((section) => section.id);

  const activeMode = mode ?? base.executionState?.activeMode ?? "PRINT_MANUAL";

  const config: AssignmentSwsConfig = {
    ...base,
    templateId: resolvedTemplateId,
    sectionOrder,
    linkedOperationCode: base.linkedOperationCode ?? assignment.linkedOperationCode ?? assignment.boardAssignment?.operationCode ?? null,
    defaultOperationCodeByStage: base.defaultOperationCodeByStage ?? assignment.defaultOperationCodeByStage ?? {},
    worksheetMetadata: buildMergedWorksheetMetadata(
      manifest,
      assignment,
      resolvedTemplateId,
      base.worksheetMetadata,
    ),
    printOverrides: base.printOverrides ?? {},
    printOverridesAudit: base.printOverridesAudit ?? [],
    sectionEdits: base.sectionEdits ?? {},
    workElementEdits: base.workElementEdits ?? {},
    workspaceState: base.workspaceState ?? createDefaultAssignmentWorkspaceState(),
    instanceVersion: base.instanceVersion ?? 1,
    executionState: {
      activeMode,
      sectionStates: base.executionState?.sectionStates ?? [],
      lastSavedAt: base.executionState?.lastSavedAt,
      lastSavedBy: base.executionState?.lastSavedBy,
    },
  };

  return {
    config,
    assignment,
    templateId: resolvedTemplateId,
  };
}

export function withExecutionMode(
  config: AssignmentSwsConfig,
  mode: SwsExecutionMode,
  updatedBy?: string,
): AssignmentSwsConfig {
  return {
    ...config,
    executionState: {
      ...(config.executionState ?? { sectionStates: [] }),
      activeMode: mode,
      lastSavedAt: new Date().toISOString(),
      lastSavedBy: updatedBy,
    },
  };
}
