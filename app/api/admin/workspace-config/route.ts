import { NextRequest, NextResponse } from "next/server";

import { upsertUserSettings } from "@/lib/user-settings/share-user-settings-store";
import {
  readSystemWorkspaceConfig,
  writeSystemWorkspaceConfig,
} from "@/lib/workspace/workspace-config-store";
import { AdminWorkspaceConfigPatchSchema } from "@/lib/workspace/workspace-schemas";
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
 * GET /api/admin/workspace-config
 * Returns the full system workspace config (feature flags + widget/nav overrides).
 * Developer-only.
 */
export async function GET(req: NextRequest) {
  const actor = req.headers.get("x-badge-number") ?? "";
  if (!actor || !(await requireDeveloper(actor))) {
    return NextResponse.json({ error: "Developer access required" }, { status: 403 });
  }

  const config = await readSystemWorkspaceConfig();
  return NextResponse.json({ config });
}

/**
 * PATCH /api/admin/workspace-config
 * Body: AdminWorkspaceConfigPatch — update widget and nav overrides.
 * Developer-only.
 */
export async function PATCH(req: NextRequest) {
  const actor = req.headers.get("x-badge-number") ?? "";
  if (!actor || !(await requireDeveloper(actor))) {
    return NextResponse.json({ error: "Developer access required" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = AdminWorkspaceConfigPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid workspace config patch", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const config = await readSystemWorkspaceConfig();

  // Merge widget overrides
  let widgetOverrides = config.widgetOverrides;
  if (parsed.data.widgetOverrides) {
    const byId = new Map(widgetOverrides.map((o) => [o.id, o]));
    for (const override of parsed.data.widgetOverrides) {
      byId.set(override.id, { ...(byId.get(override.id) ?? {}), ...override });
    }
    widgetOverrides = Array.from(byId.values());
  }

  // Merge nav overrides
  let navOverrides = config.navOverrides;
  if (parsed.data.navOverrides) {
    const byId = new Map(navOverrides.map((o) => [o.id, o]));
    for (const override of parsed.data.navOverrides) {
      byId.set(override.id, { ...(byId.get(override.id) ?? {}), ...override });
    }
    navOverrides = Array.from(byId.values());
  }

  const updated = {
    ...config,
    widgetOverrides,
    navOverrides,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: parsed.data.updatedBy,
  };

  await writeSystemWorkspaceConfig(updated);
  return NextResponse.json({ config: updated });
}
