import { NextRequest, NextResponse } from "next/server";

import { upsertUserSettings } from "@/lib/user-settings/share-user-settings-store";
import {
  readWorkspaceConfig,
  writeWorkspaceConfig,
} from "@/lib/workspace/workspace-config-store";
import { WorkspaceConfigPatchSchema } from "@/lib/workspace/workspace-schemas";
import {
  legacyRoleToWorkspaceRole,
  resolveHighestWorkspaceRole,
} from "@/lib/workspace/permission-resolver";

export const dynamic = "force-dynamic";

/**
 * GET /api/workspaces/[badgeNumber]/config?shift=1st
 * Returns the resolved workspace config for the badge.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ badgeNumber: string }> },
) {
  const { badgeNumber } = await params;
  const shift = req.nextUrl.searchParams.get("shift") ?? "1st";

  const [config, settings] = await Promise.all([
    readWorkspaceConfig(badgeNumber, shift),
    upsertUserSettings(badgeNumber, shift),
  ]);

  const grantedRoleKeys = (settings.roles ?? [])
    .filter((r) => r.enabled)
    .map((r) => r.role);

  const resolvedRole = resolveHighestWorkspaceRole(
    undefined,
    grantedRoleKeys,
  );

  return NextResponse.json({
    config: { ...config, role: resolvedRole },
    resolvedRole,
  });
}

/**
 * PATCH /api/workspaces/[badgeNumber]/config
 * Body: WorkspaceConfigPatch — updates user workspace config.
 * Requires x-badge-number header (actor).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ badgeNumber: string }> },
) {
  const { badgeNumber } = await params;
  const actorBadge = req.headers.get("x-badge-number") ?? "unknown";
  const shift = req.headers.get("x-shift") ?? "1st";

  const body = await req.json().catch(() => null);
  const parsed = WorkspaceConfigPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid config patch", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const current = await readWorkspaceConfig(badgeNumber, shift);
  const updated = {
    ...current,
    ...parsed.data,
    badge: badgeNumber,
    shift,
    lastUpdated: new Date().toISOString(),
  };

  await writeWorkspaceConfig(updated);
  return NextResponse.json({ config: updated });
}
