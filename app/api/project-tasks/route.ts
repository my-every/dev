import { NextRequest, NextResponse } from "next/server";

import { addActivityToShare } from "@/lib/activity/share-activity-store";
import { createProjectTask, listProjectTasks } from "@/lib/projects/task-store";
import type { CreateProjectTaskInput } from "@/types/project-task";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || undefined;
  const pdNumber = url.searchParams.get("pdNumber") || undefined;
  const assignedToBadge = url.searchParams.get("assignedToBadge") || undefined;
  const teamId = url.searchParams.get("teamId") || undefined;
  const createdByBadge = url.searchParams.get("createdByBadge") || undefined;
  const includeDone = url.searchParams.get("includeDone") === "true";

  const tasks = await listProjectTasks({
    projectId,
    pdNumber,
    assignedToBadge,
    teamId,
    createdByBadge,
    includeDone,
  });

  return NextResponse.json({ tasks });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateProjectTaskInput;
    if (!body.title?.trim()) {
      return NextResponse.json({ error: "Task title is required" }, { status: 422 });
    }
    if (!body.createdByBadge?.trim() || !body.createdByShift?.trim()) {
      return NextResponse.json(
        { error: "createdByBadge and createdByShift are required" },
        { status: 422 },
      );
    }

    const task = await createProjectTask(body);

    await addActivityToShare(body.createdByBadge, body.createdByShift, {
      action: "SETTINGS_CHANGED",
      performedBy: body.createdByBadge,
      projectId: task.projectId || undefined,
      comment: `Task created: ${task.title}`,
      metadata: {
        source: "project_tasks",
        taskId: task.id,
        scope: task.scope,
        teamId: task.teamId,
        pdNumber: task.pdNumber,
        dueDate: task.dueDate,
        recurrence: task.recurrence,
      },
      result: "success",
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create task";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
