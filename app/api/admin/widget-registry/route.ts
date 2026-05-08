import { NextRequest, NextResponse } from "next/server";

import { upsertUserSettings } from "@/lib/user-settings/share-user-settings-store";
import {
  readSystemWorkspaceConfig,
  writeSystemWorkspaceConfig,
} from "@/lib/workspace/workspace-config-store";
import { DEFAULT_WIDGET_REGISTRY, mergeWidgetOverrides } from "@/lib/workspace/widget-registry";
import { WidgetRegistryAdminPatchSchema } from "@/lib/workspace/workspace-schemas";
import { resolveHighestWorkspaceRole } from "@/lib/workspace/permission-resolver";
import { WORKSPACE_ROLE_LEVELS } from "@/types/workspace-config";

export const dynamic = "force-dynamic";

const DEVELOPER_LEVEL = WORKSPACE_ROLE_LEVELS["DEVELOPER"];

async function requireDeveloper(actorBadge: string): Promise<boolean> {
  const settings = await upsertUserSettings(actorBadge, "1st").catch(() => null);
  const keys = (settings?.roles ?? []).filter((r) => r.enabled).map((r) => r.role);
  const role = resolveHighestWorkspaceRole(undefined, keys);
  return WORKSPACE_ROLE_LEVELS[role] >= DEVELOPER_LEVEL;
}

/**
 * GET /api/admin/widget-registry
 * Returns the merged widget registry (defaults + admin overrides).
 * Developer-only.
 */
export async function GET(req: NextRequest) {
  const actor = req.headers.get("x-badge-number") ?? "";
  if (!actor || !(await requireDeveloper(actor))) {
    return NextResponse.json({ error: "Developer access required" }, { status: 403 });
  }

  const config = await readSystemWorkspaceConfig();
  const merged = mergeWidgetOverrides(DEFAULT_WIDGET_REGISTRY, config.widgetOverrides);
  return NextResponse.json({ widgets: merged, overrides: config.widgetOverrides });
}

/**
 * PATCH /api/admin/widget-registry
 * Body: WidgetRegistryAdminPatch — apply admin overrides to widget descriptors.
 * Developer-only.
 */
export async function PATCH(req: NextRequest) {
  const actor = req.headers.get("x-badge-number") ?? "";
  if (!actor || !(await requireDeveloper(actor))) {
    return NextResponse.json({ error: "Developer access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = WidgetRegistryAdminPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid widget registry patch", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const config = await readSystemWorkspaceConfig();

  // Merge incoming overrides onto existing ones
  const existingById = new Map(config.widgetOverrides.map((o) => [o.id, o]));
  for (const override of parsed.data.overrides) {
    existingById.set(override.id, { ...(existingById.get(override.id) ?? {}), ...override });
  }

  const updated = {
    ...config,
    widgetOverrides: Array.from(existingById.values()),
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: parsed.data.updatedBy,
  };

  await writeSystemWorkspaceConfig(updated);
  const merged = mergeWidgetOverrides(DEFAULT_WIDGET_REGISTRY, updated.widgetOverrides);
  return NextResponse.json({ widgets: merged, overrides: updated.widgetOverrides });
}
