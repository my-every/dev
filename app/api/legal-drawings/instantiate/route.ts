import { NextRequest, NextResponse } from 'next/server'

import { addActivityToShare } from '@/lib/activity/share-activity-store'
import { createProjectFromLegalSource } from '@/lib/legal-drawings/library'
import { createProjectTask, listProjectTasks } from '@/lib/projects/task-store'
import type { CreateProjectFromLegalSourceInput } from '@/types/legal-drawings'
import type { CreateProjectTaskInput, ProjectTaskScope } from '@/types/project-task'

export const dynamic = 'force-dynamic'

async function seedDefaultTasksForProject(input: {
  projectId: string
  pdNumber: string
  revision?: string | null
  actorBadge: string
  actorShift: string
}) {
  const existingTasks = await listProjectTasks({
    projectId: input.projectId,
    includeDone: true,
  })
  if (existingTasks.length > 0) {
    return
  }

  const defaultTasks: CreateProjectTaskInput[] = [
    {
      title: 'Review legal artifacts and revision',
      scope: 'legal' as ProjectTaskScope,
      projectId: input.projectId,
      pdNumber: input.pdNumber,
      legalRevision: input.revision || undefined,
      assignedToBadge: input.actorBadge,
      createdByBadge: input.actorBadge,
      createdByShift: input.actorShift,
      recurrence: { enabled: false, cadence: 'weekly', interval: 1 },
    },
    {
      title: 'Validate dates and project priority',
      scope: 'project' as ProjectTaskScope,
      projectId: input.projectId,
      pdNumber: input.pdNumber,
      assignedToBadge: input.actorBadge,
      createdByBadge: input.actorBadge,
      createdByShift: input.actorShift,
      recurrence: { enabled: false, cadence: 'daily', interval: 1 },
    },
    {
      title: 'Assign owner and kickoff execution',
      scope: 'project' as ProjectTaskScope,
      projectId: input.projectId,
      pdNumber: input.pdNumber,
      assignedToBadge: input.actorBadge,
      createdByBadge: input.actorBadge,
      createdByShift: input.actorShift,
      recurrence: { enabled: false, cadence: 'daily', interval: 1 },
    },
  ]

  await Promise.all(defaultTasks.map((task) => createProjectTask(task)))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateProjectFromLegalSourceInput
    const manifest = await createProjectFromLegalSource(body)

    const actorBadge = body.actorBadge?.trim()
    const actorShift = body.actorShift?.trim()
    if (actorBadge && actorShift) {
      await addActivityToShare(actorBadge, actorShift, {
        action: 'SETTINGS_CHANGED',
        performedBy: actorBadge,
        projectId: manifest.id,
        comment: `Created project instance from legal drawing (${manifest.pdNumber})`,
        metadata: {
          source: 'legal_instance_create',
          pdNumber: manifest.pdNumber,
          revision: manifest.revision,
        },
        result: 'success',
      })

      await seedDefaultTasksForProject({
        projectId: manifest.id,
        pdNumber: manifest.pdNumber,
        revision: manifest.revision,
        actorBadge,
        actorShift,
      })
    }

    return NextResponse.json({ manifest })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create project from legal source'
    const lowered = message.toLowerCase()
    const status =
      lowered.includes('required')
        ? 422
        : lowered.includes('missing project-manifest.json') || lowered.includes('no fallback revision')
          ? 404
          : 500

    return NextResponse.json(
      { error: message },
      { status },
    )
  }
}
