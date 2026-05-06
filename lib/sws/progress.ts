import type { AssignmentSwsConfig } from "@/types/d380-assignment-sws";
import type { SwsTemplateDefinition } from "@/types/d380-sws";
import { SWS_TEMPLATE_REGISTRY } from "@/lib/sws/sws-template-registry";

export interface SwsSectionProgressWeight {
  sectionId: string;
  weight: number;
}

export interface SwsProgressSummary {
  completedWeight: number;
  totalWeight: number;
  progressPercent: number;
  completedSections: number;
  totalSections: number;
  remainingSections: number;
}

function parseCycleTimeToMinutes(value?: string): number {
  if (!value) return 0;
  const match = value.trim().match(/^(?:(\d+):)?(\d{1,2})$/);
  if (match) {
    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    return hours * 60 + minutes;
  }

  const hoursMatch = value.match(/(\d+)\s*h/i);
  const minutesMatch = value.match(/(\d+)\s*m/i);
  const hours = hoursMatch ? Number(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? Number(minutesMatch[1]) : 0;
  return hours * 60 + minutes;
}

function getTemplate(config?: AssignmentSwsConfig | null): SwsTemplateDefinition | null {
  if (!config?.templateId) return null;
  return SWS_TEMPLATE_REGISTRY[config.templateId] ?? null;
}

export function buildSwsSectionWeights(config?: AssignmentSwsConfig | null): SwsSectionProgressWeight[] {
  const template = getTemplate(config);
  const sectionIds = config?.sectionOrder?.length
    ? config.sectionOrder
    : (template?.sections ?? []).map((section) => section.id);

  if (!sectionIds.length || !template) {
    return [];
  }

  const templateSections = new Map(template.sections.map((section) => [section.id, section]));
  const rawWeights = sectionIds.map((sectionId) => {
    const section = templateSections.get(sectionId);
    const override = config?.sectionEdits?.[sectionId];
    const cycleTime = override?.cycleTime ?? section?.cycleTime;
    const parsedWeight = parseCycleTimeToMinutes(cycleTime);
    return {
      sectionId,
      weight: parsedWeight > 0 ? parsedWeight : 1,
    };
  });

  const totalWeight = rawWeights.reduce((sum, section) => sum + section.weight, 0);
  if (totalWeight <= 0) {
    const evenWeight = sectionIds.length > 0 ? 1 / sectionIds.length : 0;
    return sectionIds.map((sectionId) => ({ sectionId, weight: evenWeight }));
  }

  return rawWeights.map((section) => ({
    sectionId: section.sectionId,
    weight: section.weight / totalWeight,
  }));
}

export function deriveSwsProgressSummary(config?: AssignmentSwsConfig | null): SwsProgressSummary {
  const weights = buildSwsSectionWeights(config);
  if (!weights.length) {
    return {
      completedWeight: 0,
      totalWeight: 0,
      progressPercent: 0,
      completedSections: 0,
      totalSections: 0,
      remainingSections: 0,
    };
  }

  const states = new Map((config?.executionState?.sectionStates ?? []).map((state) => [state.sectionId, state]));
  let completedWeight = 0;
  let completedSections = 0;

  for (const weight of weights) {
    const state = states.get(weight.sectionId);
    if (state?.status === "COMPLETE") {
      completedWeight += weight.weight;
      completedSections += 1;
    }
  }

  const totalSections = weights.length;
  return {
    completedWeight,
    totalWeight: 1,
    progressPercent: Math.max(0, Math.min(100, Math.round(completedWeight * 100))),
    completedSections,
    totalSections,
    remainingSections: Math.max(0, totalSections - completedSections),
  };
}
