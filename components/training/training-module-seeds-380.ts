import type { UserRole } from "@/types/d380-user-session";
import type {
  TrainingModuleV2,
  TrainingSection,
  TrainingStage,
  TrainingSectionType,
} from "@/types/training";
import type { AssignmentStageRole } from "@/lib/board/stage-workspaces";
import type { PartStack } from "@/types/parts-library";
import {
  buildDefaultTrainingResourceCategories,
  createTrainingModuleResourceBinding,
  type TrainingModuleResourceBinding,
} from "@/lib/training/training-resource-categories";

const NOW = "2026-04-29T00:00:00.000Z";

const ALL_VISIBLE_ROLES: UserRole[] = [
  "DEVELOPER",
  "MANAGER",
  "SUPERVISOR",
  "TEAM_LEAD",
  "QA",
  "BRANDER",
  "ASSEMBLER",
];

const LEAD_PLUS_ROLES: UserRole[] = ["DEVELOPER", "MANAGER", "SUPERVISOR", "TEAM_LEAD"];

export type TrainingSeedRecord = {
  id: string;
  status: TrainingModuleV2["status"];
  visibility: TrainingModuleV2["visibility"];
  visibleRoles: UserRole[];
  defaultAssignees: string[];
  module: TrainingModuleV2;
};

const TRAINING_MODULE_PARTS_STACK_ID = "stack-training-modules-380-core";

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function section(params: {
  id: string;
  type: TrainingSectionType;
  order: number;
  title?: string;
  stage?: TrainingStage | null;
  visible?: boolean;
  content: TrainingSection["content"];
}): TrainingSection {
  return {
    id: params.id,
    type: params.type,
    order: params.order,
    title: params.title,
    stage: params.stage ?? null,
    visible: params.visible ?? true,
    content: params.content,
  };
}

function baseModule(params: {
  id: string;
  name: string;
  description: string;
  category: string;
  type: string;
  tags: string[];
  partNumbers?: string[];
  enabledStages: TrainingStage[];
  totalEstimatedMinutes: number;
  difficulty?: TrainingModuleV2["difficulty"];
  status?: TrainingModuleV2["status"];
  visibility?: TrainingModuleV2["visibility"];
  visibleRoles?: UserRole[];
  competencyStages?: AssignmentStageRole[];
  triggerStages?: AssignmentStageRole[];
  sections: TrainingSection[];
}): TrainingModuleV2 {
  const status = params.status ?? "published";
  const visibility = params.visibility ?? "everyone";
  const visibleRoles = params.visibleRoles ?? ALL_VISIBLE_ROLES;

  return {
    id: params.id,
    name: params.name,
    slug: slugify(params.name),
    description: params.description,
    category: params.category,
    type: params.type,
    coverImage: {
      imageUrl: "",
      alt: `${params.name} cover`,
      caption: "",
    },
    visibility,
    visibleRoles,
    partNumbers: params.partNumbers ?? [],
    swsTemplateIds: [],
    competencyTargets: {
      stages: params.competencyStages ?? [],
      partNumbers: params.partNumbers ?? [],
      deviceFamilies: [],
      qualificationLevel: "trainee",
      relatedIntakeTemplateIds: [],
    },
    trainingTriggerRules: {
      requiredForStages: params.triggerStages ?? [],
      requiredForPartNumbers: params.partNumbers ?? [],
      autoAssignOnMissingCompetency: true,
    },
    progressTracking: {
      requireAssessment: true,
      requireLeadReview: false,
      milestoneLabels: ["Started", "Midpoint", "Complete"],
    },
    sections: params.sections,
    enabledStages: params.enabledStages,
    totalEstimatedMinutes: params.totalEstimatedMinutes,
    difficulty: params.difficulty ?? "intermediate",
    tags: params.tags,
    version: 1,
    status,
    createdAt: NOW,
    updatedAt: NOW,
    publishedAt: status === "published" ? NOW : undefined,
    createdBy: "380",
  };
}

export const TRAINING_MODULE_SEEDS_380_V2: TrainingSeedRecord[] = [
  {
    id: "training-tool-operation-cordless-pneumatic",
    status: "published",
    visibility: "everyone",
    visibleRoles: ALL_VISIBLE_ROLES,
    defaultAssignees: ["TEAM_LEAD", "SUPERVISOR"],
    module: baseModule({
      id: "training-tool-operation-cordless-pneumatic",
      name: "Hand Tool Operation: Cordless & Pneumatic",
      description: "Safe operation of powered hand tools and panduct cutting workflow.",
      category: "tool",
      type: "operations",
      tags: ["safety", "tools", "panduct", "drilling"],
      enabledStages: ["preparation", "buildup"],
      totalEstimatedMinutes: 35,
      competencyStages: ["BUILD_UP"],
      triggerStages: ["BUILD_UP"],
      sections: [
        section({
          id: "tool-details",
          type: "details",
          order: 0,
          stage: null,
          title: "Training Details",
          content: {
            title: "Hand Tool Operation",
            description: "Instructor-led and hands-on training for cordless and pneumatic tools.",
            difficulty: "beginner",
            estimatedMinutes: 35,
            tags: ["safety", "tooling"],
          },
        }),
        section({
          id: "tool-dos-donts",
          type: "dos-and-donts",
          order: 1,
          stage: "preparation",
          title: "Safety First",
          content: {
            dos: [
              { id: "do-1", text: "Wear gloves and safety glasses before cutting/drilling.", priority: "high" },
              { id: "do-2", text: "Confirm nearest exit, extinguisher, and AED location.", priority: "high" },
              { id: "do-3", text: "Report any loose cables or floor hazards.", priority: "medium" },
            ],
            donts: [
              { id: "dont-1", text: "Do not use powered tools without completing training.", severity: "critical" },
              { id: "dont-2", text: "Do not continue drilling if discomfort occurs.", severity: "warning" },
            ],
          },
        }),
        section({
          id: "tool-checklist",
          type: "checklist",
          order: 2,
          stage: "buildup",
          title: "Panduct Cutter Process",
          content: {
            items: [
              { id: "ck-1", text: "Insert panduct correctly into cutter.", order: 1, required: true },
              { id: "ck-2", text: "Align desired cut between fingers.", order: 2, required: true },
              { id: "ck-3", text: "Pull lever fully to complete cut.", order: 3, required: true },
              { id: "ck-4", text: "Verify 1-finger / 2-finger / 3-finger cut selection.", order: 4, required: true },
            ],
          },
        }),
      ],
    }),
  },
  {
    id: "training-wirelist-reading-core",
    status: "published",
    visibility: "everyone",
    visibleRoles: ALL_VISIBLE_ROLES,
    defaultAssignees: ["TEAM_LEAD", "QA"],
    module: baseModule({
      id: "training-wirelist-reading-core",
      name: "Wire Training: Read and Validate Wirelists",
      description: "How to validate revisions and interpret wirelist columns for production wiring.",
      category: "device",
      type: "wiring",
      tags: ["wirelist", "revision", "wiring", "new-hire"],
      enabledStages: ["preparation", "wiring", "cross-wiring"],
      totalEstimatedMinutes: 45,
      competencyStages: ["WIRING", "CROSS_WIRING"],
      triggerStages: ["WIRING", "CROSS_WIRING"],
      sections: [
        section({
          id: "wire-details",
          type: "details",
          order: 0,
          content: {
            title: "How to Read a Wirelist",
            description: "Revision checks, From/To mapping, wire classes, IDs, and gauges.",
            difficulty: "beginner",
            estimatedMinutes: 45,
            tags: ["wirelist", "qc"],
          },
        }),
        section({
          id: "wire-custom-guide",
          type: "custom",
          order: 1,
          stage: "preparation",
          title: "Revision Validation",
          content: {
            markdown:
              "- Match PD# and panel name against drawing title and coversheet\n- Verify wirelist revision matches ELS revision on working cover sheet",
          },
        }),
        section({
          id: "wire-checklist-columns",
          type: "checklist",
          order: 2,
          stage: "wiring",
          title: "Column Interpretation",
          content: {
            items: [
              { id: "wck-1", text: "Identify W vs SC vs JC correctly.", order: 1, required: true },
              { id: "wck-2", text: "Interpret Wire No and Wire ID on each row.", order: 2, required: true },
              { id: "wck-3", text: "Validate gauge/size (including '---' for jumper clip).", order: 3, required: true },
            ],
          },
        }),
      ],
    }),
  },
  {
    id: "training-box-build-up-standard",
    status: "published",
    visibility: "everyone",
    visibleRoles: ALL_VISIBLE_ROLES,
    defaultAssignees: ["TEAM_LEAD", "SUPERVISOR", "ASSEMBLER"],
    module: baseModule({
      id: "training-box-build-up-standard",
      name: "Box Build-Up Standard",
      description: "Box setup, inspection, grounding standards, and torque paint rules.",
      category: "app",
      type: "build-up",
      tags: ["box-build", "grounding", "torque"],
      enabledStages: ["preparation", "box-build"],
      totalEstimatedMinutes: 40,
      competencyStages: ["BOX_BUILD"],
      triggerStages: ["BOX_BUILD"],
      sections: [
        section({
          id: "box-details",
          type: "details",
          order: 0,
          content: {
            title: "Box Build-Up",
            description: "Verification, visual inspection, frame grounds, and torque paint standards.",
            difficulty: "intermediate",
            estimatedMinutes: 40,
            tags: ["onskid", "flex", "ground"],
          },
        }),
        section({
          id: "box-tools",
          type: "required-tools",
          order: 1,
          stage: "preparation",
          content: {
            tools: [
              { id: "bt-1", name: "Swivel Eye Bolts", notes: "Mounted on top of boxes." },
              { id: "bt-2", name: "Approved Bonding Lubricant" },
              { id: "bt-3", name: "Torque Paint" },
            ],
            stackIds: [],
          },
        }),
        section({
          id: "box-checklist",
          type: "checklist",
          order: 2,
          stage: "box-build",
          title: "Ground and Inspection Checklist",
          content: {
            items: [
              { id: "bc-1", text: "Verify box number, PD, CM match pick tag.", order: 1, required: true },
              { id: "bc-2", text: "Inspect for damage, dents, door operation, gasket integrity.", order: 2, required: true },
              { id: "bc-3", text: "Install correct frame ground stack and orientation.", order: 3, required: true },
              { id: "bc-4", text: "Apply torque paint on nut-end only.", order: 4, required: true },
            ],
          },
        }),
      ],
    }),
  },
  {
    id: "training-box-crosswire-sequence",
    status: "published",
    visibility: "restricted",
    visibleRoles: LEAD_PLUS_ROLES,
    defaultAssignees: ["TEAM_LEAD", "SUPERVISOR", "QA"],
    module: baseModule({
      id: "training-box-crosswire-sequence",
      name: "Box Crosswire Sequence",
      description: "Crosswire sequence, harness routing, and expando sleeving process.",
      category: "app",
      type: "cross-wire",
      tags: ["crosswire", "harness", "expando"],
      enabledStages: ["cross-wiring"],
      totalEstimatedMinutes: 35,
      competencyStages: ["CROSS_WIRING"],
      triggerStages: ["CROSS_WIRING"],
      sections: [
        section({
          id: "crosswire-details",
          type: "details",
          order: 0,
          content: {
            title: "Box Crosswire",
            description: "Sequenced routing from panel-to-panel, rail, and doors.",
            difficulty: "intermediate",
            estimatedMinutes: 35,
            tags: ["sequence", "termination"],
          },
        }),
        section({
          id: "crosswire-checklist",
          type: "checklist",
          order: 1,
          stage: "cross-wiring",
          content: {
            items: [
              { id: "cw-1", text: "Verify build and visual SWS are complete.", order: 1, required: true },
              { id: "cw-2", text: "Transfer discrepancies to crosswire SWS and notify lead.", order: 2, required: true },
              { id: "cw-3", text: "Route Panel A -> Panel B first.", order: 3, required: true },
              { id: "cw-4", text: "Route PLC -> panel and grounds to bus bar before final terminations.", order: 4, required: true },
              { id: "cw-5", text: "Apply expando clamp-to-clamp and follow harness sequence.", order: 5, required: true },
            ],
          },
        }),
      ],
    }),
  },
  {
    id: "training-console-build-up-standard",
    status: "published",
    visibility: "everyone",
    visibleRoles: ALL_VISIBLE_ROLES,
    defaultAssignees: ["TEAM_LEAD", "SUPERVISOR", "ASSEMBLER"],
    module: baseModule({
      id: "training-console-build-up-standard",
      name: "Console Build-Up Standard",
      description: "Console inspection, overhead component install, panel orientation, and #10 hardware stacks.",
      category: "app",
      type: "console-build",
      tags: ["console", "door-panels", "hardware"],
      enabledStages: ["preparation", "buildup"],
      totalEstimatedMinutes: 40,
      competencyStages: ["BUILD_UP"],
      triggerStages: ["BUILD_UP"],
      sections: [
        section({
          id: "console-details",
          type: "details",
          order: 0,
          content: {
            title: "Console Build-Up",
            description: "Visual checks, overhead placement, and door panel/hardware standards.",
            difficulty: "intermediate",
            estimatedMinutes: 40,
            tags: ["panel-orientation", "torque"],
          },
        }),
        section({
          id: "console-hardware",
          type: "required-hardware",
          order: 1,
          stage: "buildup",
          content: {
            items: [
              { id: "ch-1", name: "#10 Screw", partNumber: "965276C1", quantity: 1 },
              { id: "ch-2", name: "#10 Split Washer", partNumber: "19298R1", quantity: 1 },
              { id: "ch-3", name: "#10 Flat Washer", partNumber: "22652R1", quantity: 1 },
              { id: "ch-4", name: "Trim Strip Washer", partNumber: "965653C1", quantity: 1 },
            ],
            stackIds: [],
          },
        }),
        section({
          id: "console-dos-donts",
          type: "dos-and-donts",
          order: 2,
          stage: "buildup",
          content: {
            dos: [
              { id: "cd-1", text: "Install door panels left-to-right and bottom-to-top per layout.", priority: "high" },
              { id: "cd-2", text: "Use torque setting 1 for plastic washer screws.", priority: "high" },
            ],
            donts: [
              { id: "cnd-1", text: "Do not over-tighten plastic washer screws.", severity: "critical" },
              { id: "cnd-2", text: "Do not cover component or ID labels with shield bars.", severity: "warning" },
            ],
          },
        }),
      ],
    }),
  },
  {
    id: "training-controls-lwc-slotchart-reference",
    status: "draft",
    visibility: "restricted",
    visibleRoles: LEAD_PLUS_ROLES,
    defaultAssignees: ["DEVELOPER", "MANAGER"],
    module: baseModule({
      id: "training-controls-lwc-slotchart-reference",
      name: "Controls LWC Slotchart Reference",
      description: "Reference module for interpreting LWC slotchart schedule fields and dependencies.",
      category: "app",
      type: "planning",
      tags: ["slotchart", "planning", "conlay", "conassy"],
      enabledStages: ["preparation"],
      totalEstimatedMinutes: 20,
      competencyStages: [],
      triggerStages: [],
      sections: [
        section({
          id: "slotchart-details",
          type: "details",
          order: 0,
          content: {
            title: "Slotchart Field Interpretation",
            description: "Understand LWC, unit, PD#, legal/SW/WO, ConLay, and ConAssy columns.",
            difficulty: "advanced",
            estimatedMinutes: 20,
            tags: ["schedule", "reference"],
          },
        }),
        section({
          id: "slotchart-custom",
          type: "custom",
          order: 1,
          content: {
            markdown:
              "Use this as planning guidance only. Resolve `see #1` dependency entries before release planning and assignment sequencing.",
          },
        }),
      ],
    }),
  },
];

export const TRAINING_RESOURCE_CATEGORIES_380 = buildDefaultTrainingResourceCategories();

export const TRAINING_MODULE_RESOURCE_BINDINGS_380: TrainingModuleResourceBinding[] =
  TRAINING_MODULE_SEEDS_380_V2.map((entry) =>
    createTrainingModuleResourceBinding({
      id: entry.module.id,
      tags: entry.module.tags,
      partNumbers: entry.module.partNumbers,
    }),
  );

function collectPartNumbersFromModule(module: TrainingModuleV2): string[] {
  const values = new Set<string>();
  for (const pn of module.partNumbers ?? []) {
    if (pn?.trim()) values.add(pn.trim().toUpperCase());
  }

  for (const entry of module.sections ?? []) {
    if (entry.type === "required-tools") {
      const content = entry.content as { tools?: Array<{ partNumber?: string }> };
      for (const item of content.tools ?? []) {
        if (item.partNumber?.trim()) values.add(item.partNumber.trim().toUpperCase());
      }
    }
    if (entry.type === "required-hardware") {
      const content = entry.content as { items?: Array<{ partNumber?: string }> };
      for (const item of content.items ?? []) {
        if (item.partNumber?.trim()) values.add(item.partNumber.trim().toUpperCase());
      }
    }
    if (entry.type === "related-devices") {
      const content = entry.content as { devices?: Array<{ partNumber?: string }> };
      for (const item of content.devices ?? []) {
        if (item.partNumber?.trim()) values.add(item.partNumber.trim().toUpperCase());
      }
    }
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export function buildTrainingModulesPartsStackSeed(): PartStack {
  const partNumbers = new Set<string>();
  for (const record of TRAINING_MODULE_SEEDS_380_V2) {
    for (const pn of collectPartNumbersFromModule(record.module)) {
      partNumbers.add(pn);
    }
  }

  const now = NOW;
  const items = Array.from(partNumbers)
    .sort((a, b) => a.localeCompare(b))
    .map((partNumber, index) => ({
      id: `stack-item-${index + 1}`,
      partNumber,
      quantity: 1,
      sortOrder: index,
      role: "training" as const,
      notes: "Referenced by training module content.",
    }));

  return {
    id: TRAINING_MODULE_PARTS_STACK_ID,
    name: "Training Modules 380 Core Parts",
    description: "Auto-collected part numbers referenced by seeded training modules.",
    category: "mixed",
    type: "mixed",
    useCases: ["training-module"],
    tags: ["training", "seed", "380"],
    items,
    source: "derived",
    createdAt: now,
    updatedAt: now,
    createdBy: "380",
    updatedBy: "380",
  };
}

export async function seedTrainingModulesV2(options?: {
  overwrite?: boolean;
  endpoint?: string;
  linkStackIds?: boolean;
}) {
  const endpoint = options?.endpoint ?? "/api/training";
  const overwrite = options?.overwrite ?? false;
  const linkStackIds = options?.linkStackIds ?? true;
  const stackSeed = buildTrainingModulesPartsStackSeed();

  for (const record of TRAINING_MODULE_SEEDS_380_V2) {
    const payload = linkStackIds
      ? {
          ...record.module,
          sections: record.module.sections.map((sectionEntry) => {
            if (sectionEntry.type !== "required-tools" && sectionEntry.type !== "required-hardware") {
              return sectionEntry;
            }
            const content = sectionEntry.content as { stackIds?: string[] };
            const stackIds = Array.from(new Set([...(content.stackIds ?? []), stackSeed.id]));
            return {
              ...sectionEntry,
              content: {
                ...content,
                stackIds,
              },
            };
          }),
        }
      : record.module;
    if (overwrite) {
      await fetch(`${endpoint}/${encodeURIComponent(payload.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      continue;
    }

    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
}

export async function seedTrainingModulesPartStack(options?: {
  overwrite?: boolean;
  endpoint?: string;
}) {
  const endpoint = options?.endpoint ?? "/api/parts/stacks";
  const overwrite = options?.overwrite ?? false;
  const stack = buildTrainingModulesPartsStackSeed();

  if (!overwrite) {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(stack),
    });
    return;
  }

  await fetch(`${endpoint}/${encodeURIComponent(stack.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(stack),
  });
}
