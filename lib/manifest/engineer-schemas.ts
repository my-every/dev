/**
 * Zod schemas for Engineer-role PATCH payloads.
 * Locked/generated fields are intentionally absent from every schema here.
 */

import { z } from "zod";

// ─── Shared primitives ────────────────────────────────────────────────────────

const NullableString = z.string().nullable().optional();
const NullableNumber = z.number().int().nullable().optional();

// ─── Project-level patch ──────────────────────────────────────────────────────

export const ProjectManifestPatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  unitNumber: z.string().max(50).optional(),
  revision: z.string().max(50).optional(),
  lwcType: z.string().max(50).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color (#rrggbb)")
    .optional(),
  status: z.string().max(50).optional(),
  dueDate: z.string().nullable().optional(),
  shipDate: z.string().nullable().optional(),
  planConlayDate: z.string().nullable().optional(),
  planConassyDate: z.string().nullable().optional(),
  deptTargetDate: z.string().nullable().optional(),
});

export type ProjectManifestPatch = z.infer<typeof ProjectManifestPatchSchema>;

// ─── Assignment-level patch ───────────────────────────────────────────────────

export const AssignmentPatchSchema = z.object({
  stage: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  swsType: z.string().max(100).optional(),
  unitType: z.string().max(50).optional(),
  boxSide: z.string().max(100).nullable().optional(),
  linkedOperationCode: NullableString,
  defaultOperationCodeByStage: z
    .record(z.string(), z.string().nullable())
    .optional(),
});

export type AssignmentPatch = z.infer<typeof AssignmentPatchSchema>;

// ─── Board assignment patch ───────────────────────────────────────────────────

export const BoardAssignmentPatchSchema = z.object({
  assignedBadge: NullableString,
  workAreaId: NullableString,
  workAreaLabel: NullableString,
  floorArea: NullableString,
  shiftId: z.enum(["1st", "2nd"]).nullable().optional(),
  scheduledDate: NullableString,
  startTime: NullableString,
  endTime: NullableString,
  queueIndex: NullableNumber,
  assignmentGroupId: NullableString,
  source: z
    .enum(["station", "queue", "card", "timeline"])
    .nullable()
    .optional(),
  operationCode: NullableString,
  workflowStatus: z
    .enum(["pending", "scheduled", "in-progress", "completed"])
    .optional(),
  actualStartTime: NullableString,
  actualEndTime: NullableString,
});

export type BoardAssignmentPatch = z.infer<typeof BoardAssignmentPatchSchema>;

// ─── External locations patch ─────────────────────────────────────────────────

export const ExternalLocationVisibilityItemSchema = z.object({
  location: z.string().min(1),
  wireListVisible: z.boolean(),
  brandingVisible: z.boolean(),
  crossWireVisible: z.boolean().optional(),
});

export const ExternalLocationsPatchSchema = z.object({
  locations: z.array(ExternalLocationVisibilityItemSchema).min(1),
});

export type ExternalLocationsPatch = z.infer<
  typeof ExternalLocationsPatchSchema
>;

// ─── Tab config patch ─────────────────────────────────────────────────────────

export const TabConfigItemPatchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(60).optional(),
  order: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  title: z.string().max(100).optional(),
  description: z.string().max(300).optional(),
  guidanceTitle: z.string().max(100).optional(),
  guidanceDescription: z.string().max(500).optional(),
  guidanceItems: z
    .array(
      z.object({
        title: z.string().max(80),
        description: z.string().max(300),
      }),
    )
    .optional(),
});

export const TabConfigPatchSchema = z.object({
  tabs: z.array(TabConfigItemPatchSchema).min(1),
});

export type TabConfigPatch = z.infer<typeof TabConfigPatchSchema>;

// ─── Audit log entry ──────────────────────────────────────────────────────────

export interface ManifestAuditEntry {
  id: string;
  projectId: string;
  timestamp: string;
  badgeNumber: string;
  role: "engineer" | "admin";
  endpoint: string;
  changedPaths: string[];
  before: unknown;
  after: unknown;
  reason?: string;
}
