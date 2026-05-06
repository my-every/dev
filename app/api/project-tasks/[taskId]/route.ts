import { NextRequest, NextResponse } from "next/server";

import { addActivityToShare } from "@/lib/activity/share-activity-store";
import { deleteProjectTask, updateProjectTask } from "@/lib/projects/task-store";
import type { UpdateProjectTaskInput } from "@/types/project-task";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  try {
    const body = (await request.json()) as UpdateProjectTaskInput & {
      actorBadge?: string;
      actorShift?: string;
      projectId?: string | null;
      previousStatus?: string;
    };

    const updated = await updateProjectTask(taskId, body);
    if (!updated) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (body.actorBadge && body.actorShift) {
      const statusMessage =
        body.previousStatus !== updated.status
          ? `Task status changed: ${updated.title} -> ${updated.status}`
          : `Task updated: ${updated.title}`;

      await addActivityToShare(body.actorBadge, body.actorShift, {
        action: "SETTINGS_CHANGED",
        performedBy: body.actorBadge,
        projectId: updated.projectId || body.projectId || undefined,
        comment: statusMessage,
        metadata: {
          source: "project_tasks",
          taskId: updated.id,
          scope: updated.scope,
          teamId: updated.teamId,
          pdNumber: updated.pdNumber,
          status: updated.status,
        },
        result: "success",
      });
    }

    return NextResponse.json({ task: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await params;
  const url = new URL(request.url);
  const actorBadge = url.searchParams.get("actorBadge") || "";
  const actorShift = url.searchParams.get("actorShift") || "";
  const projectId = url.searchParams.get("projectId") || undefined;

  const removed = await deleteProjectTask(taskId);
  if (!removed) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (actorBadge && actorShift) {
    await addActivityToShare(actorBadge, actorShift, {
      action: "SETTINGS_CHANGED",
      performedBy: actorBadge,
      projectId,
      comment: `Task deleted (${taskId})`,
      metadata: {
        source: "project_tasks",
        taskId,
      },
      result: "success",
    });
  }

  return NextResponse.json({ ok: true });
}
