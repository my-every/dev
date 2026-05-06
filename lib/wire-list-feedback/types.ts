"use strict";

import { z } from "zod";

// ============================================================================
// Wire List Feedback Schema Definitions
// ============================================================================

export const wireListFeedbackDifficultySchema = z.enum([
  "EASY",
  "MODERATE",
  "DIFFICULT",
]);

export const wireListFeedbackQualityRatingSchema = z.enum([
  "EXCELLENT",
  "GOOD",
  "NEEDS_IMPROVEMENT",
  "REWORK_REQUIRED",
]);

export const wireListFeedbackImprovementAreaSchema = z.enum([
  "DEVICE_LABELING",
  "ROUTING_CLARITY",
  "TERMINATION_DETAILS",
  "SEQUENCE_ORDER",
  "MATERIALS",
  "OTHER",
]);

export const wireListFeedbackBooleanOptionSchema = z.enum([
  "YES",
  "NO",
  "PARTIALLY",
  "NOT_APPLICABLE",
]);

export const wireListFeedbackSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  enabled: z.boolean().default(true),
  order: z.number().int().nonnegative(),
});

export const wireListFeedbackFormSchema = z.object({
  assignmentId: z.string().min(1),
  projectId: z.string().min(1),
  projectName: z.string().min(1),
  pdNumber: z.string().min(1),
  sheetName: z.string().min(1),
  revision: z.string().optional().nullable(),
  unit: z.string().optional().nullable(),

  technicianBadge: z.string().min(1),
  technicianName: z.string().min(1),
  completedDate: z.string().min(1),

  auditorBadge: z.string().optional().nullable(),
  auditorName: z.string().optional().nullable(),

  accuracyBlueLabelsClear: wireListFeedbackBooleanOptionSchema,
  accuracySequenceMatchedLayout: wireListFeedbackBooleanOptionSchema,
  accuracyMissingDuplicateIncorrectEntries: wireListFeedbackBooleanOptionSchema,
  accuracyLocationColumnCorrect: wireListFeedbackBooleanOptionSchema,

  terminationTypesClear: wireListFeedbackBooleanOptionSchema,
  terminationLengthsAccurate: wireListFeedbackBooleanOptionSchema,
  terminationReworkDueToInstructionClarity: wireListFeedbackBooleanOptionSchema,
  terminationJumperRulesEasyToFollow: wireListFeedbackBooleanOptionSchema,

  routingAlignedWithLayout: wireListFeedbackBooleanOptionSchema,
  routingLengthFit: wireListFeedbackBooleanOptionSchema,
  routingConflictsPanduct: wireListFeedbackBooleanOptionSchema,
  routingConflictsRails: wireListFeedbackBooleanOptionSchema,
  routingConflictsAdjacentDevices: wireListFeedbackBooleanOptionSchema,
  routingEfficientOrder: wireListFeedbackBooleanOptionSchema,

  buildOrderHelpful: wireListFeedbackBooleanOptionSchema,
  buildRequiredDeviation: wireListFeedbackBooleanOptionSchema,
  buildDeviationReason: z.string().max(2000).optional().nullable(),
  buildCausedDelays: wireListFeedbackBooleanOptionSchema,

  materialsFerrulesAvailable: wireListFeedbackBooleanOptionSchema,
  materialsLugsAvailable: wireListFeedbackBooleanOptionSchema,
  materialsJumpersAvailable: wireListFeedbackBooleanOptionSchema,
  materialsWireTypesAvailable: wireListFeedbackBooleanOptionSchema,
  materialsIssuesNotes: z.string().max(2000).optional().nullable(),

  qualityErrorsCaughtDuringWiring: wireListFeedbackBooleanOptionSchema,
  qualityReterminatedWires: wireListFeedbackBooleanOptionSchema,
  qualityReroutedWires: wireListFeedbackBooleanOptionSchema,
  qualityReplacedWires: wireListFeedbackBooleanOptionSchema,
  qualityCommonIssues: z.string().max(2000).optional().nullable(),

  estimatedWiringTimeHours: z.number().nonnegative().optional().nullable(),
  actualWiringTimeHours: z.number().nonnegative().optional().nullable(),
  timeVarianceReason: z.string().max(2000).optional().nullable(),

  safetyGroundsClearlyIdentified: wireListFeedbackBooleanOptionSchema,
  safetyTerminationsCompliant: wireListFeedbackBooleanOptionSchema,
  safetyConcernsNotes: z.string().max(2000).optional().nullable(),

  documentationDifficulty: wireListFeedbackDifficultySchema,
  documentationImprovementAreas: z
    .array(wireListFeedbackImprovementAreaSchema)
    .default([]),
  documentationOtherImprovementArea: z.string().max(500).optional().nullable(),
  documentationSpecificSuggestions: z.string().max(3000).optional().nullable(),

  automationJumperPredictionCorrect: wireListFeedbackBooleanOptionSchema.optional(),
  automationBlueLabelSequencesCorrect: wireListFeedbackBooleanOptionSchema.optional(),
  automationKtRulesCorrect: wireListFeedbackBooleanOptionSchema.optional(),
  automationReusableTemplateCandidate: wireListFeedbackBooleanOptionSchema.optional(),

  finalQualityRating: wireListFeedbackQualityRatingSchema,
  finalComments: z.string().max(3000).optional().nullable(),

  sections: z.array(wireListFeedbackSectionSchema).default([]),
});

// ============================================================================
// Type Exports
// ============================================================================

export type WireListFeedbackFormValues = z.infer<typeof wireListFeedbackFormSchema>;
export type WireListFeedbackDifficulty = z.infer<typeof wireListFeedbackDifficultySchema>;
export type WireListFeedbackQualityRating = z.infer<typeof wireListFeedbackQualityRatingSchema>;
export type WireListFeedbackImprovementArea = z.infer<typeof wireListFeedbackImprovementAreaSchema>;
export type WireListFeedbackBooleanOption = z.infer<typeof wireListFeedbackBooleanOptionSchema>;
export type WireListFeedbackSection = z.infer<typeof wireListFeedbackSectionSchema>;

// ============================================================================
// Default Section Configuration
// ============================================================================

export const DEFAULT_WIRE_LIST_FEEDBACK_SECTIONS: WireListFeedbackSection[] = [
  { id: "header", title: "Header", enabled: true, order: 0 },
  { id: "accuracy", title: "Accuracy & Usability", enabled: true, order: 10 },
  { id: "termination", title: "Termination Clarity", enabled: true, order: 20 },
  { id: "routing", title: "Routing & Layout Alignment", enabled: true, order: 30 },
  { id: "buildOrder", title: "Build Sequence & Efficiency", enabled: true, order: 40 },
  { id: "materials", title: "Hardware & Materials", enabled: true, order: 50 },
  { id: "quality", title: "Quality & Rework", enabled: true, order: 60 },
  { id: "time", title: "Time & Effort", enabled: true, order: 70 },
  { id: "safety", title: "Safety & Compliance", enabled: true, order: 80 },
  { id: "documentation", title: "Documentation Quality", enabled: true, order: 90 },
  { id: "automation", title: "Automation Checks", enabled: true, order: 100 },
  { id: "final", title: "Final Sign-Off", enabled: true, order: 110 },
  { id: "footer", title: "Footer", enabled: true, order: 999 },
];

// ============================================================================
// Stage-Agnostic Interfaces for Reusable Print Feedback
// ============================================================================

export interface PrintableFeedbackSectionConfig {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
}

export interface PrintableFooterConfig {
  text: string;
  repeatOnEveryPage: boolean;
}

export interface CustomQuestionConfig {
  key: string;
  label: string;
  type: "boolean" | "text" | "number" | "difficulty" | "quality" | "improvement";
  enabled: boolean;
  sectionId: string;
  isCustom?: boolean;
}

export interface PrintFeedbackConfig {
  showFeedbackSection?: boolean;
  feedbackSections?: WireListFeedbackSection[];
  feedbackValues?: Partial<WireListFeedbackFormValues>;
  feedbackRenderMode?: "PREFILLED" | "BLANK";
  footer?: PrintableFooterConfig;
  customQuestions?: Record<string, CustomQuestionConfig>;
}

// ============================================================================
// Label Maps for Display
// ============================================================================

export const BOOLEAN_OPTION_LABELS: Record<WireListFeedbackBooleanOption, string> = {
  YES: "Yes",
  NO: "No",
  PARTIALLY: "Partially",
  NOT_APPLICABLE: "N/A",
};

export const DIFFICULTY_LABELS: Record<WireListFeedbackDifficulty, string> = {
  EASY: "Easy",
  MODERATE: "Moderate",
  DIFFICULT: "Difficult",
};

export const QUALITY_RATING_LABELS: Record<WireListFeedbackQualityRating, string> = {
  EXCELLENT: "Excellent",
  GOOD: "Good",
  NEEDS_IMPROVEMENT: "Needs Improvement",
  REWORK_REQUIRED: "Rework Required",
};

export const IMPROVEMENT_AREA_LABELS: Record<WireListFeedbackImprovementArea, string> = {
  DEVICE_LABELING: "Device Labeling",
  ROUTING_CLARITY: "Routing Clarity",
  TERMINATION_DETAILS: "Termination Details",
  SEQUENCE_ORDER: "Sequence Order",
  MATERIALS: "Materials",
  OTHER: "Other",
};

// ============================================================================
// Section Question Definitions
// ============================================================================

export interface FeedbackQuestion {
  key: keyof WireListFeedbackFormValues;
  label: string;
  type: "boolean" | "difficulty" | "quality" | "improvement" | "text" | "number";
}

export const FEEDBACK_SECTION_QUESTIONS: Record<string, FeedbackQuestion[]> = {
  accuracy: [
    { key: "accuracyBlueLabelsClear", label: "Blue labels clear and legible?", type: "boolean" },
    { key: "accuracySequenceMatchedLayout", label: "Sequence matched layout?", type: "boolean" },
    { key: "accuracyMissingDuplicateIncorrectEntries", label: "Any missing/duplicate/incorrect entries?", type: "boolean" },
    { key: "accuracyLocationColumnCorrect", label: "Location column correct?", type: "boolean" },
  ],
  termination: [
    { key: "terminationTypesClear", label: "Termination types clear?", type: "boolean" },
    { key: "terminationLengthsAccurate", label: "Wire lengths accurate?", type: "boolean" },
    { key: "terminationReworkDueToInstructionClarity", label: "Rework due to unclear instructions?", type: "boolean" },
    { key: "terminationJumperRulesEasyToFollow", label: "Jumper rules easy to follow?", type: "boolean" },
  ],
  routing: [
    { key: "routingAlignedWithLayout", label: "Routing aligned with layout?", type: "boolean" },
    { key: "routingLengthFit", label: "Wire length fit properly?", type: "boolean" },
    { key: "routingConflictsPanduct", label: "Conflicts with panduct?", type: "boolean" },
    { key: "routingConflictsRails", label: "Conflicts with rails?", type: "boolean" },
    { key: "routingConflictsAdjacentDevices", label: "Conflicts with adjacent devices?", type: "boolean" },
    { key: "routingEfficientOrder", label: "Build order efficient?", type: "boolean" },
  ],
  buildOrder: [
    { key: "buildOrderHelpful", label: "Build order helpful?", type: "boolean" },
    { key: "buildRequiredDeviation", label: "Required deviation from order?", type: "boolean" },
    { key: "buildDeviationReason", label: "Reason for deviation", type: "text" },
    { key: "buildCausedDelays", label: "Caused delays?", type: "boolean" },
  ],
  materials: [
    { key: "materialsFerrulesAvailable", label: "Ferrules available?", type: "boolean" },
    { key: "materialsLugsAvailable", label: "Lugs available?", type: "boolean" },
    { key: "materialsJumpersAvailable", label: "Jumpers available?", type: "boolean" },
    { key: "materialsWireTypesAvailable", label: "Wire types available?", type: "boolean" },
    { key: "materialsIssuesNotes", label: "Material issues notes", type: "text" },
  ],
  quality: [
    { key: "qualityErrorsCaughtDuringWiring", label: "Errors caught during wiring?", type: "boolean" },
    { key: "qualityReterminatedWires", label: "Re-terminated wires?", type: "boolean" },
    { key: "qualityReroutedWires", label: "Re-routed wires?", type: "boolean" },
    { key: "qualityReplacedWires", label: "Replaced wires?", type: "boolean" },
    { key: "qualityCommonIssues", label: "Common issues", type: "text" },
  ],
  time: [
    { key: "estimatedWiringTimeHours", label: "Estimated time (hours)", type: "number" },
    { key: "actualWiringTimeHours", label: "Actual time (hours)", type: "number" },
    { key: "timeVarianceReason", label: "Reason for variance", type: "text" },
  ],
  safety: [
    { key: "safetyGroundsClearlyIdentified", label: "Grounds clearly identified?", type: "boolean" },
    { key: "safetyTerminationsCompliant", label: "Terminations compliant?", type: "boolean" },
    { key: "safetyConcernsNotes", label: "Safety concerns", type: "text" },
  ],
  documentation: [
    { key: "documentationDifficulty", label: "Documentation difficulty", type: "difficulty" },
    { key: "documentationImprovementAreas", label: "Areas for improvement", type: "improvement" },
    { key: "documentationOtherImprovementArea", label: "Other improvement area", type: "text" },
    { key: "documentationSpecificSuggestions", label: "Specific suggestions", type: "text" },
  ],
  automation: [
    { key: "automationJumperPredictionCorrect", label: "Jumper prediction correct?", type: "boolean" },
    { key: "automationBlueLabelSequencesCorrect", label: "Blue label sequences correct?", type: "boolean" },
    { key: "automationKtRulesCorrect", label: "KT rules correct?", type: "boolean" },
    { key: "automationReusableTemplateCandidate", label: "Reusable template candidate?", type: "boolean" },
  ],
  final: [
    { key: "finalQualityRating", label: "Overall quality rating", type: "quality" },
    { key: "finalComments", label: "Final comments", type: "text" },
  ],
};
