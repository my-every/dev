/**
 * Workspace Configuration Types
 *
 * Central type system for the API-configured workspace:
 * navigation, widgets, layout presets, feature flags, and workspace permissions.
 *
 * Storage layout:
 *   Share/system/features.json              — global feature flags (developer-only write)
 *   Share/system/widget-registry.json       — admin-overridable widget registry
 *   Share/system/nav-registry.json          — admin-overridable nav registry
 *   Share/users/{shift}/{badge}/workspace-config.json — per-user overrides + layout
 */

// ─── Role system ──────────────────────────────────────────────────────────────

/**
 * Canonical workspace role set. Extends the legacy 3-value UserRole type
 * to include all roles referenced across the codebase.
 * Role levels follow USER_ROLE_HIERARCHY convention (higher = more access).
 */
export type WorkspaceRole =
  | "DEVELOPER"    // 200 — full system control
  | "MANAGER"      // 100 — department-level management
  | "SUPERVISOR"   // 80  — shift/team operations
  | "ENGINEER"     // 70  — project manifest + lifecycle ops
  | "TEAM_LEAD"    // 60  — assignments + scheduling
  | "QA"           // 50  — verification + approve/reject
  | "BRANDER"      // 40  — branding workspace
  | "ASSEMBLER"    // 20  — own assignments only
  | "GUEST";       // 0   — read-only, unauthenticated

export const WORKSPACE_ROLE_LEVELS: Record<WorkspaceRole, number> = {
  DEVELOPER: 200,
  MANAGER: 100,
  SUPERVISOR: 80,
  ENGINEER: 70,
  TEAM_LEAD: 60,
  QA: 50,
  BRANDER: 40,
  ASSEMBLER: 20,
  GUEST: 0,
};

export const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  DEVELOPER: "Developer",
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  ENGINEER: "Engineer",
  TEAM_LEAD: "Team Lead",
  QA: "Quality Assurance",
  BRANDER: "Brander",
  ASSEMBLER: "Assembler",
  GUEST: "Guest",
};

// ─── Feature flags ────────────────────────────────────────────────────────────

export interface FeatureFlag {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  /** Minimum role level required to access the feature */
  minRoleLevel: number;
  /** If set, only users with this exact role can toggle this flag */
  developerOnly: boolean;
  /** ISO timestamp of last change */
  updatedAt: string;
  /** Badge of who last changed it */
  updatedBy: string;
}

export type FeatureFlagKey =
  | "workspace_engineer_tab"
  | "workspace_widget_drag"
  | "workspace_custom_nav"
  | "manifest_audit_log"
  | "manifest_field_editor"
  | "board_assignment_advanced"
  | "project_recalculate"
  | "admin_widget_registry"
  | "admin_nav_registry"
  | "admin_feature_flags"
  | "admin_workspace_config";

// ─── Process permissions ──────────────────────────────────────────────────────

/**
 * Fine-grained process permissions that control what a user can DO,
 * not just what they can SEE. These extend GranularPermissions.
 */
export interface WorkspaceProcessPermissions {
  // Project lifecycle
  canEditManifest: boolean;
  canRecalculateManifest: boolean;
  canUploadLegals: boolean;
  canExportBrandLists: boolean;
  canExportWireLists: boolean;
  canConfigureExternalLocations: boolean;

  // Board / assignment operations
  canAssignUsers: boolean;
  canReassignTasks: boolean;
  canScheduleAssignments: boolean;
  canManageWorkAreas: boolean;
  canManageShiftQueues: boolean;

  // Approval/verification
  canVerifyStage: boolean;
  canApproveStage: boolean;
  canRejectStage: boolean;
  canReopenStage: boolean;
  canBlockAssignment: boolean;

  // User/access management
  canViewUsers: boolean;
  canEditUsers: boolean;
  canGrantPermissions: boolean;
  canConfigureWorkspace: boolean;

  // Developer/system
  canManageFeatureFlags: boolean;
  canManageWidgetRegistry: boolean;
  canManageNavRegistry: boolean;
  canManageSystemConfig: boolean;
}

export const DEFAULT_PROCESS_PERMISSIONS: WorkspaceProcessPermissions = {
  canEditManifest: false,
  canRecalculateManifest: false,
  canUploadLegals: false,
  canExportBrandLists: false,
  canExportWireLists: false,
  canConfigureExternalLocations: false,
  canAssignUsers: false,
  canReassignTasks: false,
  canScheduleAssignments: false,
  canManageWorkAreas: false,
  canManageShiftQueues: false,
  canVerifyStage: false,
  canApproveStage: false,
  canRejectStage: false,
  canReopenStage: false,
  canBlockAssignment: false,
  canViewUsers: false,
  canEditUsers: false,
  canGrantPermissions: false,
  canConfigureWorkspace: false,
  canManageFeatureFlags: false,
  canManageWidgetRegistry: false,
  canManageNavRegistry: false,
  canManageSystemConfig: false,
};

/** Role-based process permission defaults — applied before user overrides */
export const ROLE_PROCESS_PERMISSIONS: Record<WorkspaceRole, Partial<WorkspaceProcessPermissions>> = {
  DEVELOPER: {
    canEditManifest: true,
    canRecalculateManifest: true,
    canUploadLegals: true,
    canExportBrandLists: true,
    canExportWireLists: true,
    canConfigureExternalLocations: true,
    canAssignUsers: true,
    canReassignTasks: true,
    canScheduleAssignments: true,
    canManageWorkAreas: true,
    canManageShiftQueues: true,
    canVerifyStage: true,
    canApproveStage: true,
    canRejectStage: true,
    canReopenStage: true,
    canBlockAssignment: true,
    canViewUsers: true,
    canEditUsers: true,
    canGrantPermissions: true,
    canConfigureWorkspace: true,
    canManageFeatureFlags: true,
    canManageWidgetRegistry: true,
    canManageNavRegistry: true,
    canManageSystemConfig: true,
  },
  MANAGER: {
    canEditManifest: true,
    canRecalculateManifest: true,
    canUploadLegals: true,
    canExportBrandLists: true,
    canExportWireLists: true,
    canConfigureExternalLocations: true,
    canAssignUsers: true,
    canReassignTasks: true,
    canScheduleAssignments: true,
    canManageWorkAreas: true,
    canManageShiftQueues: true,
    canVerifyStage: true,
    canApproveStage: true,
    canRejectStage: true,
    canReopenStage: true,
    canBlockAssignment: true,
    canViewUsers: true,
    canEditUsers: true,
    canGrantPermissions: true,
    canConfigureWorkspace: true,
  },
  SUPERVISOR: {
    canEditManifest: false,
    canRecalculateManifest: true,
    canUploadLegals: true,
    canExportBrandLists: true,
    canExportWireLists: true,
    canAssignUsers: true,
    canReassignTasks: true,
    canScheduleAssignments: true,
    canManageWorkAreas: true,
    canManageShiftQueues: true,
    canVerifyStage: true,
    canApproveStage: true,
    canRejectStage: true,
    canBlockAssignment: true,
    canViewUsers: true,
    canEditUsers: true,
    canGrantPermissions: true,
    canConfigureWorkspace: false,
  },
  ENGINEER: {
    canEditManifest: true,
    canRecalculateManifest: true,
    canUploadLegals: true,
    canExportBrandLists: true,
    canExportWireLists: true,
    canConfigureExternalLocations: true,
    canAssignUsers: false,
    canScheduleAssignments: false,
    canVerifyStage: false,
    canApproveStage: false,
    canViewUsers: true,
  },
  TEAM_LEAD: {
    canExportBrandLists: true,
    canExportWireLists: true,
    canAssignUsers: true,
    canReassignTasks: true,
    canScheduleAssignments: true,
    canManageShiftQueues: true,
    canVerifyStage: true,
    canBlockAssignment: true,
    canViewUsers: true,
  },
  QA: {
    canVerifyStage: true,
    canApproveStage: true,
    canRejectStage: true,
    canViewUsers: true,
  },
  BRANDER: {
    canExportBrandLists: true,
  },
  ASSEMBLER: {},
  GUEST: {},
};

// ─── Navigation ───────────────────────────────────────────────────────────────

/** Visibility mode for nav items */
export type NavItemVisibility = "always" | "role" | "permission" | "feature" | "hidden";

export interface NavItemDescriptor {
  id: string;
  /** href template — use `{badgeNumber}` as placeholder */
  hrefTemplate: string;
  label: string;
  /** Key from ICON_REGISTRY — never store React components */
  iconKey: string;
  order: number;
  enabled: boolean;
  /** Section/group label for visual grouping */
  group?: string;
  visibilityMode: NavItemVisibility;
  /** Minimum role level to see this item */
  minRoleLevel: number;
  /** Process permission required (additional to role) */
  requiredPermission?: keyof WorkspaceProcessPermissions;
  /** Feature flag key required */
  featureFlag?: FeatureFlagKey;
  /** Child route ids (for nested nav) */
  childIds?: string[];
  /** API endpoint returning a count badge (optional) */
  badgeApiEndpoint?: string;
}

// ─── Widget system ────────────────────────────────────────────────────────────

export type WidgetSize = "xs" | "sm" | "md" | "lg" | "xl" | "full";
export type WidgetViewMode = "compact" | "standard" | "expanded";
export type WidgetScope = "user" | "workspace" | "role" | "global";
export type WidgetRefreshPolicy = "manual" | "on-mount" | "interval" | "realtime";

export interface WidgetAction {
  id: string;
  label: string;
  /** Icon key from ICON_REGISTRY */
  iconKey?: string;
  /** Required process permission to show this action */
  requiredPermission?: keyof WorkspaceProcessPermissions;
  /** API endpoint to call */
  apiEndpoint?: string;
  method?: "GET" | "POST" | "PATCH" | "DELETE";
}

export interface WidgetEmptyState {
  title: string;
  description: string;
  actionLabel?: string;
}

export interface WidgetErrorState {
  title: string;
  description: string;
  retryable: boolean;
}

export interface WidgetDescriptor {
  id: string;
  label: string;
  description: string;
  /** React component name key — resolved by WIDGET_REGISTRY on client */
  widgetType: string;
  /** Model key used for type-safe API response handling */
  modelKey: string;
  /** Primary data API endpoint template (use `{badgeNumber}`, `{projectId}` etc.) */
  apiEndpoint?: string;
  queryParams?: Record<string, string>;
  refreshPolicy: WidgetRefreshPolicy;
  refreshIntervalMs?: number;
  defaultSize: WidgetSize;
  allowedSizes: WidgetSize[];
  /** Default grid layout (CSS grid columns span) */
  defaultColSpan: 1 | 2 | 3 | 4;
  defaultRowSpan: 1 | 2;
  rolesAllowed: WorkspaceRole[];
  requiredPermission?: keyof WorkspaceProcessPermissions;
  featureFlag?: FeatureFlagKey;
  actions: WidgetAction[];
  emptyState: WidgetEmptyState;
  errorState: WidgetErrorState;
  enabled: boolean;
  draggable: boolean;
  resizable: boolean;
  defaultViewMode: WidgetViewMode;
  scope: WidgetScope;
}

// ─── Layout system ────────────────────────────────────────────────────────────

export interface WidgetSlot {
  slotId: string;
  widgetId: string;
  colSpan: 1 | 2 | 3 | 4;
  rowSpan: 1 | 2;
  size: WidgetSize;
  viewMode: WidgetViewMode;
  visible: boolean;
  collapsed: boolean;
  pinned: boolean;
  order: number;
}

export interface LayoutPreset {
  id: string;
  label: string;
  description: string;
  /** Which role this preset is the default for */
  role: WorkspaceRole;
  slots: WidgetSlot[];
}

export interface WorkspaceLayout {
  presetId: string;
  /** User-specific slot overrides — merged onto preset defaults */
  slotOverrides: WidgetSlot[];
  lastUpdated: string;
}

// ─── Workspace config (per user) ──────────────────────────────────────────────

export interface WorkspaceConfig {
  badge: string;
  shift: string;
  /** Resolved role for this workspace session */
  role: WorkspaceRole;
  /** Feature flag overrides — only developer can set developerOnly flags */
  featureFlagOverrides: Partial<Record<FeatureFlagKey, boolean>>;
  /** Widget visibility overrides — key = widgetId */
  widgetVisibility: Record<string, boolean>;
  /** Layout configuration */
  layout: WorkspaceLayout;
  lastUpdated: string;
}

// ─── Resolved workspace context ───────────────────────────────────────────────

/**
 * The fully-resolved, merged workspace context for a user.
 * Built by the permission resolver from: role defaults + user settings + feature flags + overrides.
 */
export interface ResolvedWorkspaceContext {
  badge: string;
  shift: string;
  role: WorkspaceRole;
  roleLevel: number;
  permissions: WorkspaceProcessPermissions;
  featureFlags: Record<FeatureFlagKey, boolean>;
  /** Nav items filtered and resolved for this user */
  nav: ResolvedNavItem[];
  /** Widgets filtered and resolved for this user */
  widgets: ResolvedWidget[];
  /** Active layout */
  layout: WorkspaceLayout;
}

export interface ResolvedNavItem extends NavItemDescriptor {
  /** Final resolved href with badgeNumber substituted */
  href: string;
  /** Whether the user can see this item */
  visible: boolean;
}

export interface ResolvedWidget extends WidgetDescriptor {
  /** Resolved slot config from layout */
  slot: WidgetSlot;
  /** Whether the user can see this widget */
  visible: boolean;
}

// ─── Admin config ─────────────────────────────────────────────────────────────

export interface SystemWorkspaceConfig {
  /** Global feature flags */
  features: FeatureFlag[];
  /** Widget registry overrides (admin-modified widget descriptors) */
  widgetOverrides: Partial<WidgetDescriptor>[];
  /** Nav registry overrides */
  navOverrides: Partial<NavItemDescriptor>[];
  lastUpdated: string;
  lastUpdatedBy: string;
}
