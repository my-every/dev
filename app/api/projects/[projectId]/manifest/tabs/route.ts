import { NextRequest, NextResponse } from "next/server";

import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";
import { readTabConfig, writeTabConfig } from "@/lib/manifest/tab-config";
import { TabConfigPatchSchema } from "@/lib/manifest/engineer-schemas";
import { appendAuditEntry } from "@/lib/manifest/audit-log";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }
  const tabs = await readTabConfig(projectId);
  return NextResponse.json({ tabs });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = TabConfigPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid tab config patch", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const existing = await readTabConfig(projectId);
  const merged = existing.map((tab) => {
    const patch = parsed.data.tabs.find((t) => t.id === tab.id);
    if (!patch) return tab;
    return {
      ...tab,
      label: patch.label ?? tab.label,
      order: patch.order ?? tab.order,
      enabled: patch.enabled ?? tab.enabled,
      title: patch.title ?? tab.title,
      description: patch.description ?? tab.description,
      guidanceTitle: patch.guidanceTitle ?? tab.guidanceTitle,
      guidanceDescription: patch.guidanceDescription ?? tab.guidanceDescription,
      guidanceItems: patch.guidanceItems ?? tab.guidanceItems,
    };
  });

  await writeTabConfig(projectId, merged);

  const badgeNumber = req.headers.get("x-badge-number") ?? "unknown";
  await appendAuditEntry({
    projectId,
    badgeNumber,
    role: "engineer",
    endpoint: "PATCH /manifest/tabs",
    changedPaths: parsed.data.tabs.map((t) => `tabs.${t.id}`),
    before: existing,
    after: merged,
  });

  return NextResponse.json({ tabs: merged });
}
