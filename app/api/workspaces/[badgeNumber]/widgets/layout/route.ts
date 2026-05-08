import { NextRequest, NextResponse } from "next/server";

import { patchWorkspaceLayout } from "@/lib/workspace/workspace-config-store";
import { WorkspaceLayoutPatchSchema } from "@/lib/workspace/workspace-schemas";
import type { WorkspaceLayout } from "@/types/workspace-config";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/workspaces/[badgeNumber]/widgets/layout
 * Persists the user's widget slot layout (Swapy drag result).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ badgeNumber: string }> },
) {
  const { badgeNumber } = await params;
  const shift = req.headers.get("x-shift") ?? "1st";

  const body = await req.json().catch(() => null);
  const parsed = WorkspaceLayoutPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid layout patch", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const layout: WorkspaceLayout = {
    presetId: parsed.data.presetId ?? "user-custom",
    slotOverrides: parsed.data.slotOverrides.map((slot) => ({
      slotId: slot.slotId,
      widgetId: slot.widgetId,
      colSpan: slot.colSpan ?? 2,
      rowSpan: slot.rowSpan ?? 1,
      size: slot.size ?? "md",
      viewMode: slot.viewMode ?? "standard",
      visible: slot.visible ?? true,
      collapsed: slot.collapsed ?? false,
      pinned: slot.pinned ?? false,
      order: slot.order ?? 99,
    })),
    lastUpdated: new Date().toISOString(),
  };

  const config = await patchWorkspaceLayout(badgeNumber, shift, layout);
  return NextResponse.json({ layout: config.layout });
}
