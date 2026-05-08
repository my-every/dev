/**
 * Zod schemas for all workspace API PATCH payloads.
 */

import { z } from "zod";

const WORKSPACE_ROLES = [
  "DEVELOPER", "MANAGER", "SUPERVISOR", "ENGINEER",
  "TEAM_LEAD", "QA", "BRANDER", "ASSEMBLER", "GUEST",
] as const;

// ─── Feature flags ────────────────────────────────────────────────────────────

export const FeatureFlagPatchSchema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  updatedBy: z.string().min(1),
});

export const FeatureFlagsBatchPatchSchema = z.object({
  flags: z.array(FeatureFlagPatchSchema).min(1),
});

export type FeatureFlagPatch = z.infer<typeof FeatureFlagPatchSchema>;
export type FeatureFlagsBatchPatch = z.infer<typeof FeatureFlagsBatchPatchSchema>;

// ─── Widget layout ────────────────────────────────────────────────────────────

const WidgetSizeSchema = z.enum(["xs", "sm", "md", "lg", "xl", "full"]);
const WidgetViewModeSchema = z.enum(["compact", "standard", "expanded"]);

export const WidgetSlotPatchSchema = z.object({
  slotId: z.string().min(1),
  widgetId: z.string().min(1),
  colSpan: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  rowSpan: z.union([z.literal(1), z.literal(2)]).optional(),
  size: WidgetSizeSchema.optional(),
  viewMode: WidgetViewModeSchema.optional(),
  visible: z.boolean().optional(),
  collapsed: z.boolean().optional(),
  pinned: z.boolean().optional(),
  order: z.number().int().min(0).optional(),
});

export const WorkspaceLayoutPatchSchema = z.object({
  presetId: z.string().optional(),
  slotOverrides: z.array(WidgetSlotPatchSchema),
});

export type WorkspaceLayoutPatch = z.infer<typeof WorkspaceLayoutPatchSchema>;

// ─── Widget visibility ────────────────────────────────────────────────────────

export const WidgetVisibilityPatchSchema = z.object({
  widgetId: z.string().min(1),
  visible: z.boolean(),
});

export type WidgetVisibilityPatch = z.infer<typeof WidgetVisibilityPatchSchema>;

// ─── Workspace config (user-level) ───────────────────────────────────────────

export const WorkspaceConfigPatchSchema = z.object({
  role: z.enum(WORKSPACE_ROLES).optional(),
  featureFlagOverrides: z.record(z.string(), z.boolean()).optional(),
  widgetVisibility: z.record(z.string(), z.boolean()).optional(),
});

export type WorkspaceConfigPatch = z.infer<typeof WorkspaceConfigPatchSchema>;

// ─── Nav item override (admin) ────────────────────────────────────────────────

export const NavItemOverridePatchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(60).optional(),
  order: z.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
  iconKey: z.string().min(1).optional(),
  group: z.string().max(60).optional(),
});

export const NavRegistryAdminPatchSchema = z.object({
  items: z.array(NavItemOverridePatchSchema).min(1),
  updatedBy: z.string().min(1),
});

export type NavRegistryAdminPatch = z.infer<typeof NavRegistryAdminPatchSchema>;

// ─── Widget registry override (admin, developer-only) ────────────────────────

export const WidgetOverridePatchSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(80).optional(),
  description: z.string().max(300).optional(),
  enabled: z.boolean().optional(),
  defaultColSpan: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
  draggable: z.boolean().optional(),
  resizable: z.boolean().optional(),
});

export const WidgetRegistryAdminPatchSchema = z.object({
  overrides: z.array(WidgetOverridePatchSchema).min(1),
  updatedBy: z.string().min(1),
});

export type WidgetRegistryAdminPatch = z.infer<typeof WidgetRegistryAdminPatchSchema>;

// ─── Admin workspace config (developer-only full write) ──────────────────────

export const AdminWorkspaceConfigPatchSchema = z.object({
  widgetOverrides: z.array(WidgetOverridePatchSchema).optional(),
  navOverrides: z.array(NavItemOverridePatchSchema).optional(),
  updatedBy: z.string().min(1),
});

export type AdminWorkspaceConfigPatch = z.infer<typeof AdminWorkspaceConfigPatchSchema>;
