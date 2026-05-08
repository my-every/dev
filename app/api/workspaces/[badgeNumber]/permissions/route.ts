import { NextRequest, NextResponse } from "next/server";

import { upsertUserSettings } from "@/lib/user-settings/share-user-settings-store";
import { readSystemWorkspaceConfig, readWorkspaceConfig } from "@/lib/workspace/workspace-config-store";
import {
  resolveHighestWorkspaceRole,
  resolveProcessPermissions,
  resolveFeatureFlags,
} from "@/lib/workspace/permission-resolver";
import type { FeatureFlagKey } from "@/types/workspace-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/[badgeNumber]/permissions?shift=1st
 * Returns the fully-resolved process permissions + feature flags for the badge.
 * Used by client-side guards and the workspace layout.
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
  const permissions = resolveProcessPermissions({ role });
  const featureFlags = resolveFeatureFlags(
    systemConfig.features,
    role,
    workspaceConfig.featureFlagOverrides as Partial<Record<FeatureFlagKey, boolean>>,
  );

  return NextResponse.json({
    role,
    roleLevel: (await import("@/types/workspace-config")).WORKSPACE_ROLE_LEVELS[role],
    permissions,
    featureFlags,
    dashboardAccess: settings.dashboardAccess,
  });
}
