import { NextRequest, NextResponse } from "next/server";

import { upsertUserSettings } from "@/lib/user-settings/share-user-settings-store";
import { readUserFromShare } from "@/lib/session/share-user-store";
import { readSystemWorkspaceConfig, readWorkspaceConfig } from "@/lib/workspace/workspace-config-store";
import { DEFAULT_WIDGET_REGISTRY, mergeWidgetOverrides } from "@/lib/workspace/widget-registry";
import { DEFAULT_LAYOUT_PRESETS } from "@/lib/workspace/layout-presets";
import {
  resolveHighestWorkspaceRole,
  resolveProcessPermissions,
  resolveFeatureFlags,
  resolveWidgets,
} from "@/lib/workspace/permission-resolver";
import { WidgetVisibilityPatchSchema } from "@/lib/workspace/workspace-schemas";
import { patchWidgetVisibility } from "@/lib/workspace/workspace-config-store";
import type { FeatureFlagKey, WorkspaceLayout } from "@/types/workspace-config";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/[badgeNumber]/widgets?shift=1st
 * Returns resolved, filtered widget list with slot config for the badge.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ badgeNumber: string }> },
) {
  const { badgeNumber } = await params;
  const shift = req.nextUrl.searchParams.get("shift") ?? "1st";

  const [settings, workspaceConfig, systemConfig, csvUser] = await Promise.all([
    upsertUserSettings(badgeNumber, shift),
    readWorkspaceConfig(badgeNumber, shift),
    readSystemWorkspaceConfig(),
    readUserFromShare(badgeNumber),
  ]);

  const grantedRoleKeys = (settings.roles ?? [])
    .filter((r) => r.enabled)
    .map((r) => r.role);

  // Use the CSV role as the base so users without an explicit settings.json
  // still get the correct layout (e.g. DEVELOPER from the users.csv role column).
  const role = resolveHighestWorkspaceRole(csvUser?.role ?? undefined, grantedRoleKeys);
  const permissions = resolveProcessPermissions({ role });
  const featureFlags = resolveFeatureFlags(
    systemConfig.features,
    role,
    workspaceConfig.featureFlagOverrides as Partial<Record<FeatureFlagKey, boolean>>,
  );

  const widgets = mergeWidgetOverrides(DEFAULT_WIDGET_REGISTRY, systemConfig.widgetOverrides);

  // Resolve layout: user overrides → role preset → assembler default
  const rolePreset = DEFAULT_LAYOUT_PRESETS[role] ?? DEFAULT_LAYOUT_PRESETS["ASSEMBLER"];
  const layout: WorkspaceLayout = {
    presetId: workspaceConfig.layout.presetId || rolePreset.id,
    slotOverrides: workspaceConfig.layout.slotOverrides,
    lastUpdated: workspaceConfig.layout.lastUpdated,
  };

  // Seed slot order from preset if no overrides exist
  if (layout.slotOverrides.length === 0) {
    layout.slotOverrides = rolePreset.slots;
  }

  const resolved = resolveWidgets(
    widgets,
    role,
    permissions,
    featureFlags,
    layout,
    workspaceConfig.widgetVisibility,
  );

  return NextResponse.json({ widgets: resolved, layout, role });
}

/**
 * PATCH /api/workspaces/[badgeNumber]/widgets
 * Body: WidgetVisibilityPatch — toggle widget visibility for this user.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ badgeNumber: string }> },
) {
  const { badgeNumber } = await params;
  const shift = req.headers.get("x-shift") ?? "1st";

  const body = await req.json().catch(() => null);
  const parsed = WidgetVisibilityPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid widget visibility patch", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const config = await patchWidgetVisibility(
    badgeNumber,
    shift,
    parsed.data.widgetId,
    parsed.data.visible,
  );

  return NextResponse.json({ widgetVisibility: config.widgetVisibility });
}
