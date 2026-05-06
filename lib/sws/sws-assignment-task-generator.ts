import type { ManifestAssignment, ProjectManifest } from "@/types/project-manifest";
import type { SwsTemplateDefinition, SwsTemplateId } from "@/types/d380-sws";
import type { SwsChecklistGroup, SwsTaskNode } from "@/types/sws-library";
import { resolveSwsTemplateIdForAssignment } from "@/lib/sws/assignment-template-resolution";
import { SWS_TEMPLATE_REGISTRY } from "@/lib/sws/sws-template-registry";
import { buildMergedWorksheetMetadata } from "@/lib/sws/assignment-sws-instance";

export interface GeneratedSwsAssignmentTaskSchema {
  schemaVersion: 1;
  generatedAt: string;
  project: {
    id: string;
    name: string;
    pdNumber: string;
    revision: string;
    unitNumber: string;
  };
  assignment: {
    sheetSlug: string;
    sheetName: string;
    stage: string;
    swsType: string;
    status: string;
    templateId: SwsTemplateId;
    unitType?: string;
    panelNumber?: string | null;
    boxNumber?: string | null;
  };
  worksheetMetadata: ReturnType<typeof buildMergedWorksheetMetadata>;
  summary: {
    sections: number;
    tasks: number;
    subtasks: number;
    partNumbers: number;
    rails: number;
    panducts: number;
    whiteLabels: number;
    blueLabels: number;
  };
  groups: SwsChecklistGroup[];
}

function toUnique(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => `${value}`.trim()).filter(Boolean)));
}

function toPreview(values: string[], max = 8): string {
  if (values.length === 0) {
    return "none";
  }
  if (values.length <= max) {
    return values.join(", ");
  }
  return `${values.slice(0, max).join(", ")} (+${values.length - max} more)`;
}

function getSectionText(section: SwsTemplateDefinition["sections"][number]): string {
  const stepText = section.processSteps.map((step) => `${step.text} ${(step.subSteps ?? []).join(" ")}`).join(" ");
  return `${section.description} ${stepText}`.toLowerCase();
}

function getSectionMetadataNotes(
  sectionText: string,
  assignment: ManifestAssignment,
  panelNumber?: string | null,
  boxNumber?: string | null,
): string[] {
  const notes: string[] = [];
  const partNumbers = toUnique(assignment.partNumbers);
  const rails = toUnique(assignment.rails);
  const panducts = toUnique(assignment.panducts);
  const whiteLabels = toUnique(assignment.whiteLabels);
  const blueLabels = toUnique(assignment.blueLabels);

  const mentionsPanel = /\bpanel\b|layout|drill|bond|build|wire/.test(sectionText);
  const mentionsParts = /part|component|device|mount|install|hardware|verify/.test(sectionText);
  const mentionsRail = /\brail\b/.test(sectionText);
  const mentionsPanduct = /pan\s*duct|panduct|\bduct\b/.test(sectionText);
  const mentionsLabels = /label|marker|id\s*label/.test(sectionText);

  if (mentionsPanel && panelNumber) {
    notes.push(`Panel Number: ${panelNumber}`);
  }
  if (mentionsPanel && boxNumber) {
    notes.push(`Box Number: ${boxNumber}`);
  }
  if (mentionsParts && partNumbers.length > 0) {
    notes.push(`Part Numbers: ${toPreview(partNumbers)}`);
  }
  if (mentionsRail && rails.length > 0) {
    notes.push(`Rails: ${toPreview(rails)}`);
  }
  if (mentionsPanduct && panducts.length > 0) {
    notes.push(`Panducts: ${toPreview(panducts)}`);
  }
  if (mentionsLabels && (whiteLabels.length > 0 || blueLabels.length > 0)) {
    notes.push(`White Labels: ${toPreview(whiteLabels)}`);
    notes.push(`Blue Labels: ${toPreview(blueLabels)}`);
  }

  return notes;
}

function createStepChildren(sectionId: string, stepId: string, subSteps: string[], stageId: string): SwsTaskNode[] {
  return subSteps.map((subStep, index) => ({
    id: `${sectionId}:${stepId}:sub-${index + 1}`,
    title: `Sub-step ${index + 1}`,
    description: subStep,
    required: true,
    completedByDefault: false,
    stageIds: [stageId],
    children: [],
  }));
}

function buildTaskTreeFromTemplate(
  template: SwsTemplateDefinition,
  assignment: ManifestAssignment,
): { groups: SwsChecklistGroup[]; taskCount: number; subtaskCount: number } {
  const stageId = assignment.stage;
  const panelNumber = assignment.layout?.primaryPage?.panelNumber;
  const boxNumber = assignment.layout?.primaryPage?.boxNumber;

  let taskCount = 0;
  let subtaskCount = 0;

  const sectionTasks: SwsTaskNode[] = template.sections.map((section) => {
    taskCount += 1;
    const sectionText = getSectionText(section);
    const sectionNotes = getSectionMetadataNotes(sectionText, assignment, panelNumber, boxNumber);

    const stepChildren: SwsTaskNode[] = section.processSteps.map((step) => {
      taskCount += 1;
      const children = createStepChildren(section.id, step.id, step.subSteps ?? [], stageId);
      subtaskCount += children.length;

      return {
        id: `${section.id}:${step.id}`,
        title: step.text,
        description: step.subSteps?.join(" "),
        required: step.requiresCheckOff,
        completedByDefault: false,
        notes: step.isKeyPoint ? "Key point" : undefined,
        reviewRequirement: step.requiresVerification ?? step.verificationType,
        stageIds: [stageId],
        children,
      };
    });

    const checkpointChildren: SwsTaskNode[] = (section.verificationCheckpoints ?? []).map((checkpoint) => {
      taskCount += 1;
      return {
        id: `${section.id}:checkpoint:${checkpoint.id}`,
        title: checkpoint.label,
        description: checkpoint.description,
        required: true,
        completedByDefault: false,
        notes: checkpoint.requiresAuditorStamp ? "Auditor stamp required" : undefined,
        reviewRequirement: checkpoint.columnLabel,
        stageIds: [stageId],
        children: [],
      };
    });

    return {
      id: section.id,
      title: `Work Element ${section.workElementNumber}`,
      description: section.description,
      required: true,
      completedByDefault: false,
      notes: sectionNotes.length > 0 ? sectionNotes.join("\n") : undefined,
      reviewRequirement: section.requiresAuditor ? (section.auditorReference ?? "Auditor verification") : undefined,
      stageIds: [stageId],
      children: [...stepChildren, ...checkpointChildren],
    };
  });

  return {
    groups: [
      {
        id: `${assignment.sheetSlug}-template-sections`,
        title: `${template.shortLabel} Checklist`,
        description: `Generated from ${template.swsIpvId} for ${assignment.sheetName}`,
        order: 0,
        tasks: sectionTasks,
      },
    ],
    taskCount,
    subtaskCount,
  };
}

export function generateSwsAssignmentTaskSchema(
  manifest: ProjectManifest,
  assignment: ManifestAssignment,
): GeneratedSwsAssignmentTaskSchema {
  const templateId = resolveSwsTemplateIdForAssignment(assignment, null) as SwsTemplateId;
  const template = SWS_TEMPLATE_REGISTRY[templateId];
  if (!template) {
    throw new Error(`SWS template not found for assignment ${assignment.sheetSlug}: ${templateId}`);
  }

  const { groups, taskCount, subtaskCount } = buildTaskTreeFromTemplate(template, assignment);
  const worksheetMetadata = buildMergedWorksheetMetadata(manifest, assignment, templateId);

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    project: {
      id: manifest.id,
      name: manifest.name,
      pdNumber: manifest.pdNumber,
      revision: manifest.revision,
      unitNumber: manifest.unitNumber,
    },
    assignment: {
      sheetSlug: assignment.sheetSlug,
      sheetName: assignment.sheetName,
      stage: assignment.stage,
      swsType: `${assignment.swsType}`,
      status: assignment.status,
      templateId,
      unitType: assignment.unitType,
      panelNumber: assignment.layout?.primaryPage?.panelNumber,
      boxNumber: assignment.layout?.primaryPage?.boxNumber,
    },
    worksheetMetadata,
    summary: {
      sections: template.sections.length,
      tasks: taskCount,
      subtasks: subtaskCount,
      partNumbers: assignment.partNumbers.length,
      rails: assignment.rails.length,
      panducts: assignment.panducts.length,
      whiteLabels: assignment.whiteLabels.length,
      blueLabels: assignment.blueLabels.length,
    },
    groups,
  };
}

export function generateSwsSchemasForManifest(
  manifest: ProjectManifest,
): Record<string, GeneratedSwsAssignmentTaskSchema> {
  const result: Record<string, GeneratedSwsAssignmentTaskSchema> = {};

  for (const assignment of Object.values(manifest.assignments ?? {})) {
    if (assignment.kind !== "operational") {
      continue;
    }
    result[assignment.sheetSlug] = generateSwsAssignmentTaskSchema(manifest, assignment);
  }

  return result;
}