import { NextRequest, NextResponse } from "next/server";

import { upsertUserSettings } from "@/lib/user-settings/share-user-settings-store";
import { readSystemWorkspaceConfig, readWorkspaceConfig } from "@/lib/workspace/workspace-config-store";
import { DEFAULT_NAV_ITEMS } from "@/lib/workspace/nav-registry";
import {
  resolveHighestWorkspaceRole,
  resolveProcessPermissions,
  resolveFeatureFlags,
  resolveNavItems,
} from "@/lib/workspace/permission-resolver";
import type { FeatureFlagKey } from "@/types/workspace-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/[badgeNumber]/navigation?shift=1st
 * Returns the filtered, resolved nav items for the badge.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ badgeNumber: string }> },
) {
  const { badgeNumber } = await params;
  const shift = req.nextUrl.searchParams.get("shift") ?? "1st";

  const [settings, workspaceConfig, systemConfig] = await Promise.all([
    upsertUserSettings(badgeNumber, shift),
    readWorkspaceConfig(badgeNumber, shift),
    readSystemWorkspaceConfig(),
  ]);

  const grantedRoleKeys = (settings.roles ?? [])
    .filter((r) => r.enabled)
    .map((r) => r.role);

  const role = resolveHighestWorkspaceRole(undefined, grantedRoleKeys);
  const permissions = resolveProcessPermissions({ role, processOverrides: undefined });
  const featureFlags = resolveFeatureFlags(
    systemConfig.features,
    role,
    workspaceConfig.featureFlagOverrides as Partial<Record<FeatureFlagKey, boolean>>,
  );

  // Merge nav overrides onto defaults
  const navItems = DEFAULT_NAV_ITEMS.map((def) => {
    const override = systemConfig.navOverrides.find((o) => o.id === def.id);
    if (!override) return def;
    return { ...def, ...override, id: def.id };
  });

  const resolved = resolveNavItems(navItems, role, permissions, featureFlags, badgeNumber);

  return NextResponse.json({ nav: resolved, role });
}
