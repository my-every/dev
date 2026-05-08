import "server-only";

import { promises as fs } from "node:fs";
import path from "node:path";

import { resolveShareDirectory } from "@/lib/runtime/share-directory";
import type {
  FeatureFlag,
  FeatureFlagKey,
  SystemWorkspaceConfig,
  WorkspaceConfig,
  WorkspaceLayout,
} from "@/types/workspace-config";

// ─── Path helpers ─────────────────────────────────────────────────────────────

async function userWorkspaceConfigPath(badge: string, shift: string): Promise<string> {
  const shareRoot = await resolveShareDirectory();
  return path.join(shareRoot, "users", shift, badge, "workspace-config.json");
}

async function systemConfigPath(): Promise<string> {
  const shareRoot = await resolveShareDirectory();
  return path.join(shareRoot, "system", "workspace-config.json");
}

// ─── Default feature flags ────────────────────────────────────────────────────

const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  {
    key: "workspace_engineer_tab",
    label: "Engineer Tab",
    description: "Enables the Engineer manifest editor subtab on the project details page.",
    enabled: true,
    minRoleLevel: 60,
    developerOnly: false,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
  {
    key: "workspace_widget_drag",
    label: "Widget Drag & Drop",
    description: "Enables Swapy-powered widget reordering on the workspace dashboard.",
    enabled: true,
    minRoleLevel: 0,
    developerOnly: false,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
  {
    key: "workspace_custom_nav",
    label: "Custom Navigation",
    description: "Allows users to reorder or hide sidebar nav items.",
    enabled: false,
    minRoleLevel: 60,
    developerOnly: false,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
  {
    key: "manifest_audit_log",
    label: "Manifest Audit Log",
    description: "Shows the manifest change audit log tab on project details.",
    enabled: true,
    minRoleLevel: 60,
    developerOnly: false,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
  {
    key: "manifest_field_editor",
    label: "Manifest Field Editor",
    description: "Enables inline editing of project manifest fields.",
    enabled: true,
    minRoleLevel: 70,
    developerOnly: false,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
  {
    key: "board_assignment_advanced",
    label: "Advanced Board Assignment",
    description: "Enables advanced scheduling fields in the board assignment editor.",
    enabled: true,
    minRoleLevel: 60,
    developerOnly: false,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
  {
    key: "project_recalculate",
    label: "Project Recalculate",
    description: "Shows the recalculate button on the manifest editor.",
    enabled: true,
    minRoleLevel: 60,
    developerOnly: false,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
  {
    key: "admin_widget_registry",
    label: "Admin: Widget Registry",
    description: "Allows admin-level editing of the global widget registry.",
    enabled: true,
    minRoleLevel: 200,
    developerOnly: true,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
  {
    key: "admin_nav_registry",
    label: "Admin: Nav Registry",
    description: "Allows admin-level editing of the global nav registry.",
    enabled: true,
    minRoleLevel: 200,
    developerOnly: true,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
  {
    key: "admin_feature_flags",
    label: "Admin: Feature Flags",
    description: "Allows managing global feature flags.",
    enabled: true,
    minRoleLevel: 200,
    developerOnly: true,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
  {
    key: "admin_workspace_config",
    label: "Admin: Workspace Config",
    description: "Allows reading/writing the global workspace config.",
    enabled: true,
    minRoleLevel: 200,
    developerOnly: true,
    updatedAt: new Date(0).toISOString(),
    updatedBy: "system",
  },
];

// ─── System config I/O ────────────────────────────────────────────────────────

export async function readSystemWorkspaceConfig(): Promise<SystemWorkspaceConfig> {
  try {
    const raw = await fs.readFile(await systemConfigPath(), "utf-8");
    const stored = JSON.parse(raw) as Partial<SystemWorkspaceConfig>;
    // Merge stored feature flags onto defaults — stored wins for non-developerOnly flags
    const mergedFlags = DEFAULT_FEATURE_FLAGS.map((def) => {
      const stored_ = (stored.features ?? []).find((f) => f.key === def.key);
      if (!stored_) return def;
      return { ...def, enabled: stored_.enabled, updatedAt: stored_.updatedAt, updatedBy: stored_.updatedBy };
    });
    return {
      features: mergedFlags,
      widgetOverrides: stored.widgetOverrides ?? [],
      navOverrides: stored.navOverrides ?? [],
      lastUpdated: stored.lastUpdated ?? new Date(0).toISOString(),
      lastUpdatedBy: stored.lastUpdatedBy ?? "system",
    };
  } catch {
    return {
      features: DEFAULT_FEATURE_FLAGS,
      widgetOverrides: [],
      navOverrides: [],
      lastUpdated: new Date(0).toISOString(),
      lastUpdatedBy: "system",
    };
  }
}

export async function writeSystemWorkspaceConfig(
  config: SystemWorkspaceConfig,
): Promise<void> {
  const filePath = await systemConfigPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), "utf-8");
}

// ─── User workspace config I/O ────────────────────────────────────────────────

function buildDefaultWorkspaceConfig(badge: string, shift: string): WorkspaceConfig {
  return {
    badge,
    shift,
    role: "ASSEMBLER",
    featureFlagOverrides: {},
    widgetVisibility: {},
    layout: {
      presetId: "assembler-default",
      slotOverrides: [],
      lastUpdated: new Date().toISOString(),
    },
    lastUpdated: new Date().toISOString(),
  };
}

export async function readWorkspaceConfig(
  badge: string,
  shift: string,
): Promise<WorkspaceConfig> {
  try {
    const raw = await fs.readFile(await userWorkspaceConfigPath(badge, shift), "utf-8");
    const parsed = JSON.parse(raw) as WorkspaceConfig;
    return {
      ...buildDefaultWorkspaceConfig(badge, shift),
      ...parsed,
    };
  } catch {
    return buildDefaultWorkspaceConfig(badge, shift);
  }
}

export async function writeWorkspaceConfig(config: WorkspaceConfig): Promise<void> {
  const filePath = await userWorkspaceConfigPath(config.badge, config.shift);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(
    filePath,
    JSON.stringify({ ...config, lastUpdated: new Date().toISOString() }, null, 2),
    "utf-8",
  );
}

export async function patchWorkspaceLayout(
  badge: string,
  shift: string,
  layout: WorkspaceLayout,
): Promise<WorkspaceConfig> {
  const config = await readWorkspaceConfig(badge, shift);
  const updated: WorkspaceConfig = {
    ...config,
    layout: { ...layout, lastUpdated: new Date().toISOString() },
    lastUpdated: new Date().toISOString(),
  };
  await writeWorkspaceConfig(updated);
  return updated;
}

export async function patchWidgetVisibility(
  badge: string,
  shift: string,
  widgetId: string,
  visible: boolean,
): Promise<WorkspaceConfig> {
  const config = await readWorkspaceConfig(badge, shift);
  const updated: WorkspaceConfig = {
    ...config,
    widgetVisibility: { ...config.widgetVisibility, [widgetId]: visible },
    lastUpdated: new Date().toISOString(),
  };
  await writeWorkspaceConfig(updated);
  return updated;
}

// ─── Feature flag patch (developer-only) ─────────────────────────────────────

export async function patchFeatureFlag(
  key: FeatureFlagKey,
  enabled: boolean,
  updatedBy: string,
): Promise<FeatureFlag[]> {
  const config = await readSystemWorkspaceConfig();
  const updatedFeatures = config.features.map((flag) => {
    if (flag.key !== key) return flag;
    return { ...flag, enabled, updatedAt: new Date().toISOString(), updatedBy };
  });
  await writeSystemWorkspaceConfig({
    ...config,
    features: updatedFeatures,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: updatedBy,
  });
  return updatedFeatures;
}
