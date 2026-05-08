/**
 * Workspace Permission Resolver
 *
 * Priority stack (highest wins):
 *  1. DEVELOPER system override — always full access
 *  2. Explicit user process permission override (from workspace-config.json)
 *  3. Role-based process permissions (ROLE_PROCESS_PERMISSIONS)
 *  4. Feature flag gate
 *  5. Default deny
 *
 * Maps legacy UserRole → WorkspaceRole so existing session types still work.
 */

import type { UserRole } from "@/types/d380-user-session";
import {
  DEFAULT_PROCESS_PERMISSIONS,
  ROLE_PROCESS_PERMISSIONS,
  WORKSPACE_ROLE_LEVELS,
  type WorkspaceProcessPermissions,
  type WorkspaceRole,
} from "@/types/workspace-config";

// ─── Role mapping ─────────────────────────────────────────────────────────────

/**
 * Maps the legacy 3-value UserRole → WorkspaceRole.
 * The caller can override with a more specific role from settings.
 */
export function legacyRoleToWorkspaceRole(role: UserRole | null | undefined): WorkspaceRole {
  switch (role) {
    case "DEVELOPER": return "DEVELOPER";
    case "TEAM_LEAD": return "TEAM_LEAD";
    case "ASSEMBLER": return "ASSEMBLER";
    default: return "GUEST";
  }
}

/**
 * Maps a settings role key (from AVAILABLE_ROLES) → WorkspaceRole.
 */
export function settingsRoleKeyToWorkspaceRole(key: string): WorkspaceRole | null {
  const map: Record<string, WorkspaceRole> = {
    developer: "DEVELOPER",
    manager: "MANAGER",
    supervisor: "SUPERVISOR",
    engineer: "ENGINEER",
    "team-lead": "TEAM_LEAD",
    qa: "QA",
    brander: "BRANDER",
    assembler: "ASSEMBLER",
  };
  return map[key] ?? null;
}

/**
 * Given a user's granted roles (from settings.roles[]), return the highest
 * WorkspaceRole level they hold.
 */
export function resolveHighestWorkspaceRole(
  baseRole: UserRole | null | undefined,
  grantedRoleKeys: string[],
): WorkspaceRole {
  let best = legacyRoleToWorkspaceRole(baseRole);
  let bestLevel = WORKSPACE_ROLE_LEVELS[best];

  for (const key of grantedRoleKeys) {
    const mapped = settingsRoleKeyToWorkspaceRole(key);
    if (mapped && WORKSPACE_ROLE_LEVELS[mapped] > bestLevel) {
      best = mapped;
      bestLevel = WORKSPACE_ROLE_LEVELS[mapped];
    }
  }

  return best;
}

// ─── Permission resolution ────────────────────────────────────────────────────

export interface PermissionResolverInput {
  /** Resolved WorkspaceRole for this user */
  role: WorkspaceRole;
  /** Explicit user overrides from workspace-config.json (partial) */
  processOverrides?: Partial<WorkspaceProcessPermissions>;
}

/**
 * Build a fully-resolved WorkspaceProcessPermissions set for a user.
 * Role defaults are applied first, then user-specific overrides on top.
 * DEVELOPER always gets every permission regardless of overrides.
 */
export function resolveProcessPermissions(
  input: PermissionResolverInput,
): WorkspaceProcessPermissions {
  const { role, processOverrides } = input;

  // Developer always gets everything — no override can reduce this
  if (role === "DEVELOPER") {
    return {
      ...DEFAULT_PROCESS_PERMISSIONS,
      ...Object.fromEntries(
        Object.keys(DEFAULT_PROCESS_PERMISSIONS).map((k) => [k, true]),
      ),
    } as WorkspaceProcessPermissions;
  }

  const roleDefaults = ROLE_PROCESS_PERMISSIONS[role] ?? {};

  return {
    ...DEFAULT_PROCESS_PERMISSIONS,
    ...roleDefaults,
    ...(processOverrides ?? {}),
  };
}

// ─── Route / action guards ────────────────────────────────────────────────────

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  missingPermissions?: (keyof WorkspaceProcessPermissions)[];
}

/**
 * Check whether a user has the required process permission.
 * Returns a structured result so API routes can return consistent 403 bodies.
 */
export function checkPermission(
  permissions: WorkspaceProcessPermissions,
  required: keyof WorkspaceProcessPermissions,
): PermissionCheckResult {
  if (permissions[required]) {
    return { allowed: true };
  }
  return {
    allowed: false,
    reason: `Missing permission: ${required}`,
    missingPermissions: [required],
  };
}

/**
 * Check role level access (≥ minLevel required).
 */
export function checkRoleLevel(
  role: WorkspaceRole,
  minLevel: number,
): PermissionCheckResult {
  const level = WORKSPACE_ROLE_LEVELS[role];
  if (level >= minLevel) return { allowed: true };
  return {
    allowed: false,
    reason: `Role level ${level} is below required ${minLevel}`,
  };
}

/**
 * Combined check: either permission OR role level grants access.
 */
export function checkPermissionOrRole(
  permissions: WorkspaceProcessPermissions,
  role: WorkspaceRole,
  permission: keyof WorkspaceProcessPermissions,
  minRoleLevel: number,
): PermissionCheckResult {
  if (permissions[permission]) return { allowed: true };
  const level = WORKSPACE_ROLE_LEVELS[role];
  if (level >= minRoleLevel) return { allowed: true };
  return {
    allowed: false,
    reason: `Requires ${permission} permission or role level ≥ ${minRoleLevel}`,
    missingPermissions: [permission],
  };
}

// ─── Feature flag resolver ─────────────────────────────────────────────────────

import type { FeatureFlag, FeatureFlagKey } from "@/types/workspace-config";

/**
 * Resolve effective feature flag values for a user.
 * Global flags → role gates → user overrides (if allowed).
 * developerOnly flags can only be overridden by DEVELOPER role.
 */
export function resolveFeatureFlags(
  globalFlags: FeatureFlag[],
  role: WorkspaceRole,
  userOverrides: Partial<Record<FeatureFlagKey, boolean>>,
): Record<FeatureFlagKey, boolean> {
  const roleLevel = WORKSPACE_ROLE_LEVELS[role];
  const result: Partial<Record<FeatureFlagKey, boolean>> = {};

  for (const flag of globalFlags) {
    const key = flag.key as FeatureFlagKey;

    // Check role level gate
    const accessAllowed = roleLevel >= flag.minRoleLevel;
    let effective = flag.enabled && accessAllowed;

    // Apply user override only if:
    // - Not developerOnly, OR user is DEVELOPER
    const override = userOverrides[key];
    if (override !== undefined) {
      if (!flag.developerOnly || role === "DEVELOPER") {
        effective = override && accessAllowed;
      }
    }

    result[key] = effective;
  }

  return result as Record<FeatureFlagKey, boolean>;
}

// ─── Nav item filter ──────────────────────────────────────────────────────────

import type { NavItemDescriptor, ResolvedNavItem } from "@/types/workspace-config";

export function resolveNavItems(
  items: NavItemDescriptor[],
  role: WorkspaceRole,
  permissions: WorkspaceProcessPermissions,
  featureFlags: Record<FeatureFlagKey, boolean>,
  badgeNumber: string,
): ResolvedNavItem[] {
  const roleLevel = WORKSPACE_ROLE_LEVELS[role];

  return items
    .filter((item) => {
      if (!item.enabled) return false;
      if (item.visibilityMode === "hidden") return false;
      if (item.visibilityMode === "always") return true;
      if (roleLevel < item.minRoleLevel) return false;
      if (item.requiredPermission && !permissions[item.requiredPermission]) return false;
      if (item.featureFlag && !featureFlags[item.featureFlag]) return false;
      return true;
    })
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      ...item,
      href: item.hrefTemplate.replace("{badgeNumber}", badgeNumber),
      visible: true,
    }));
}

// ─── Widget filter ────────────────────────────────────────────────────────────

import type { ResolvedWidget, WidgetDescriptor, WidgetSlot, WorkspaceLayout } from "@/types/workspace-config";

export function resolveWidgets(
  widgets: WidgetDescriptor[],
  role: WorkspaceRole,
  permissions: WorkspaceProcessPermissions,
  featureFlags: Record<FeatureFlagKey, boolean>,
  layout: WorkspaceLayout,
  widgetVisibilityOverrides: Record<string, boolean>,
): ResolvedWidget[] {
  return widgets
    .filter((widget) => {
      if (!widget.enabled) return false;
      if (widget.rolesAllowed.length > 0 && !widget.rolesAllowed.includes(role)) return false;
      if (widget.requiredPermission && !permissions[widget.requiredPermission]) return false;
      if (widget.featureFlag && !featureFlags[widget.featureFlag]) return false;
      return true;
    })
    .map((widget) => {
      const slotOverride = layout.slotOverrides.find((s) => s.widgetId === widget.id);
      const defaultSlot = buildDefaultSlot(widget);
      const slot: WidgetSlot = slotOverride ?? defaultSlot;

      const visibilityOverride = widgetVisibilityOverrides[widget.id];
      const visible = visibilityOverride !== false && slot.visible;

      return { ...widget, slot, visible };
    })
    .sort((a, b) => a.slot.order - b.slot.order);
}

function buildDefaultSlot(widget: WidgetDescriptor): WidgetSlot {
  return {
    slotId: widget.id,
    widgetId: widget.id,
    colSpan: widget.defaultColSpan,
    rowSpan: widget.defaultRowSpan,
    size: widget.defaultSize,
    viewMode: widget.defaultViewMode,
    visible: true,
    collapsed: false,
    pinned: false,
    order: 99,
  };
}
