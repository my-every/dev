import { NextRequest, NextResponse } from "next/server";

import { upsertUserSettings } from "@/lib/user-settings/share-user-settings-store";
import {
  readSystemWorkspaceConfig,
  patchFeatureFlag,
} from "@/lib/workspace/workspace-config-store";
import { FeatureFlagsBatchPatchSchema } from "@/lib/workspace/workspace-schemas";
import { resolveHighestWorkspaceRole } from "@/lib/workspace/permission-resolver";
import { WORKSPACE_ROLE_LEVELS } from "@/types/workspace-config";

export const dynamic = "force-dynamic";

const DEVELOPER_LEVEL = WORKSPACE_ROLE_LEVELS["DEVELOPER"];

async function resolveActorRole(actorBadge: string) {
  const settings = await upsertUserSettings(actorBadge, "1st").catch(() => null);
  const grantedKeys = (settings?.roles ?? []).filter((r) => r.enabled).map((r) => r.role);
  return resolveHighestWorkspaceRole(undefined, grantedKeys);
}

/**
 * GET /api/admin/features
 * Returns all global feature flags.
 * Requires x-badge-number with DEVELOPER role.
 */
export async function GET(req: NextRequest) {
  const actorBadge = req.headers.get("x-badge-number") ?? "";
  if (!actorBadge) {
    return NextResponse.json({ error: "Missing x-badge-number header" }, { status: 401 });
  }

  const role = await resolveActorRole(actorBadge);
  if (WORKSPACE_ROLE_LEVELS[role] < DEVELOPER_LEVEL) {
    return NextResponse.json({ error: "Developer access required" }, { status: 403 });
  }

  const config = await readSystemWorkspaceConfig();
  return NextResponse.json({ features: config.features });
}

/**
 * PATCH /api/admin/features
 * Body: FeatureFlagsBatchPatch — toggle one or more feature flags.
 * Requires DEVELOPER role for developerOnly flags.
 * Requires MANAGER+ for non-developerOnly flags.
 */
export async function PATCH(req: NextRequest) {
  const actorBadge = req.headers.get("x-badge-number") ?? "";
  if (!actorBadge) {
    return NextResponse.json({ error: "Missing x-badge-number header" }, { status: 401 });
  }

  const role = await resolveActorRole(actorBadge);
  const roleLevel = WORKSPACE_ROLE_LEVELS[role];

  const body = await req.json().catch(() => null);
  const parsed = FeatureFlagsBatchPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid feature flags patch", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const config = await readSystemWorkspaceConfig();
  const results: string[] = [];

  for (const { key, enabled, updatedBy } of parsed.data.flags) {
    const existing = config.features.find((f) => f.key === key);
    if (!existing) {
      results.push(`SKIP: unknown flag ${key}`);
      continue;
    }

    if (existing.developerOnly && roleLevel < DEVELOPER_LEVEL) {
      results.push(`DENIED: ${key} is developer-only`);
      continue;
    }

    if (!existing.developerOnly && roleLevel < 100) {
      results.push(`DENIED: ${key} requires manager+ role`);
      continue;
    }

    await patchFeatureFlag(key as never, enabled, updatedBy || actorBadge);
    results.push(`OK: ${key} = ${String(enabled)}`);
  }

  const updated = await readSystemWorkspaceConfig();
  return NextResponse.json({ features: updated.features, results });
}
