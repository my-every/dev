import { NextResponse } from 'next/server'

import type { ActivityAction, ActivityEntry, ActivityTimelineFilterOptions } from '@/types/activity'
import { isActivityAction } from '@/lib/activity/activity-validation'

export const dynamic = 'force-dynamic'

function parseCsv(value: string | null): string[] | undefined {
  if (!value) return undefined
  const list = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
  return list.length > 0 ? list : undefined
}

function createDemoActivities(projectId: string): ActivityEntry[] {
  const now = Date.now()
  const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60 * 1000).toISOString()

  const baseMetadata = {
    projectId,
    projectName: 'Demo Project Alpha',
    pdNumber: 'PD-380-DEMO',
  }

  return [
    {
      id: `demo-${projectId}-001`,
      timestamp: iso(1),
      action: 'STARTED',
      projectId,
      performedBy: '12345',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'start',
      },
    },
    {
      id: `demo-${projectId}-002`,
      timestamp: iso(2),
      action: 'STARTED',
      projectId,
      performedBy: '12345',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'continue',
      },
    },
    {
      id: `demo-${projectId}-003`,
      timestamp: iso(3),
      action: 'STARTED',
      projectId,
      performedBy: '12345',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'import',
      },
    },
    {
      id: `demo-${projectId}-004`,
      timestamp: iso(4),
      action: 'SETTINGS_CHANGED',
      projectId,
      performedBy: '12345',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'edit-schema',
        description: 'Adjusted gauge, terminal family, and wire color mapping for SR-VIEW.',
      },
    },
    {
      id: `demo-${projectId}-005`,
      timestamp: iso(5),
      action: 'STARTED',
      projectId,
      performedBy: '12345',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'approve-sheet',
        sheetName: 'SR-VIEW',
      },
    },
    {
      id: `demo-${projectId}-006`,
      timestamp: iso(6),
      action: 'COMPLETED',
      projectId,
      performedBy: '12345',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'complete',
        sheetName: 'SR-VIEW',
        durationSeconds: 420,
      },
    },
    {
      id: `demo-${projectId}-007`,
      timestamp: iso(8),
      action: 'BLOCKED',
      projectId,
      performedBy: '12345',
      result: 'failure',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'combine',
        reason: 'Workbook schema mismatch detected in 2 sheets.',
      },
      error: 'Schema mismatch',
    },
    {
      id: `demo-${projectId}-008`,
      timestamp: iso(9),
      action: 'UNBLOCKED',
      projectId,
      performedBy: '22334',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'combine',
        reason: 'Schema mismatch resolved after row normalization.',
      },
    },
    {
      id: `demo-${projectId}-009`,
      timestamp: iso(10),
      action: 'STARTED',
      projectId,
      performedBy: '12345',
      result: 'pending',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'save-later',
      },
    },
    {
      id: `demo-${projectId}-010`,
      timestamp: iso(12),
      action: 'COMPLETED',
      projectId,
      performedBy: '12345',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'combine',
        durationSeconds: 190,
      },
    },
    {
      id: `demo-${projectId}-011`,
      timestamp: iso(14),
      action: 'STARTED',
      projectId,
      performedBy: '12345',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'branding',
        milestone: 'download',
      },
    },
    {
      id: `demo-${projectId}-012`,
      timestamp: iso(16),
      action: 'COMPLETED',
      projectId,
      performedBy: '12345',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'branding',
        milestone: 'complete',
        durationSeconds: 95,
      },
    },
    {
      id: `demo-${projectId}-013`,
      timestamp: iso(18),
      action: 'STAGE_CHANGED',
      projectId,
      performedBy: '22334',
      stage: 'BRANDING_READY',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'branding',
        milestone: 'gate-sync',
        fromStage: 'BRANDLIST_COMPLETE',
        toStage: 'BRANDING_READY',
      },
    },
    {
      id: `demo-${projectId}-014`,
      timestamp: iso(20),
      action: 'COMMENT_ADDED',
      projectId,
      performedBy: '44556',
      comment: 'QA note: workbook aligns with latest customer revision.',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'qa-note',
      },
    },
    {
      id: `demo-${projectId}-015`,
      timestamp: iso(24),
      action: 'CANCELLED',
      projectId,
      performedBy: '55667',
      result: 'failure',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'import',
        reason: 'User canceled import before applying changes.',
      },
    },
    {
      id: `demo-${projectId}-016`,
      timestamp: iso(28),
      action: 'REOPENED',
      projectId,
      performedBy: '44556',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'reopen',
      },
    },
    {
      id: `demo-${projectId}-017`,
      timestamp: iso(32),
      action: 'ASSIGNED',
      projectId,
      performedBy: '55667',
      targetBadge: '22334',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'handoff',
        assigneeName: 'Alex Rivera',
      },
    },
    {
      id: `demo-${projectId}-018`,
      timestamp: iso(36),
      action: 'REASSIGNED',
      projectId,
      performedBy: '55667',
      targetBadge: '44556',
      result: 'success',
      metadata: {
        ...baseMetadata,
        workflow: 'brandlist',
        milestone: 'handoff',
        assigneeName: 'Taylor Nguyen',
      },
    },
    {
      id: `demo-${projectId}-019`,
      timestamp: iso(40),
      action: 'PROJECT_CREATED',
      projectId,
      performedBy: '90001',
      result: 'success',
      metadata: {
        ...baseMetadata,
      },
    },
  ]
}

function applyFilters(
  activities: ActivityEntry[],
  filters: Omit<ActivityTimelineFilterOptions, 'projectIds'>,
): ActivityEntry[] {
  return activities.filter((activity) => {
    if (filters.actionTypes?.length && !filters.actionTypes.includes(activity.action)) {
      return false
    }

    if (filters.targetBadges?.length) {
      const targetBadge = activity.targetBadge ?? ''
      if (!filters.targetBadges.includes(targetBadge)) {
        return false
      }
    }

    if (filters.assignmentIds?.length) {
      const assignmentId = activity.assignmentId ?? ''
      if (!filters.assignmentIds.includes(assignmentId)) {
        return false
      }
    }

    if (filters.resultStatus?.length) {
      const status = activity.result ?? 'success'
      if (!filters.resultStatus.includes(status)) {
        return false
      }
    }

    if (filters.dateFrom) {
      const from = Date.parse(filters.dateFrom)
      if (Number.isFinite(from) && Date.parse(activity.timestamp) < from) {
        return false
      }
    }

    if (filters.dateTo) {
      const to = Date.parse(filters.dateTo)
      if (Number.isFinite(to) && Date.parse(activity.timestamp) > to) {
        return false
      }
    }

    if (filters.searchText?.trim()) {
      const search = filters.searchText.toLowerCase()
      const metadataString = JSON.stringify(activity.metadata ?? {}).toLowerCase()
      const matches = [
        activity.action.toLowerCase(),
        activity.comment?.toLowerCase() ?? '',
        activity.stage?.toLowerCase() ?? '',
        activity.assignmentId?.toLowerCase() ?? '',
        activity.performedBy?.toLowerCase() ?? '',
        metadataString,
      ].some((value) => value.includes(search))

      if (!matches) {
        return false
      }
    }

    return true
  })
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  if (!projectId) {
    return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
  }

  const url = new URL(request.url)

  const rawActionTypes = parseCsv(url.searchParams.get('actionTypes'))
  const actionTypes = rawActionTypes?.filter(isActivityAction) as ActivityAction[] | undefined
  const targetBadges = parseCsv(url.searchParams.get('targetBadges'))
  const assignmentIds = parseCsv(url.searchParams.get('assignmentIds'))
  const resultStatus = parseCsv(url.searchParams.get('resultStatus')) as Array<'success' | 'failure' | 'pending'> | undefined
  const dateFrom = url.searchParams.get('dateFrom') ?? undefined
  const dateTo = url.searchParams.get('dateTo') ?? undefined
  const searchText = url.searchParams.get('searchText') ?? undefined

  const limitRaw = url.searchParams.get('limit')
  const limit = limitRaw ? Number(limitRaw) : 200
  const resolvedLimit = Number.isFinite(limit) && limit > 0 ? limit : 200

  const filters: Omit<ActivityTimelineFilterOptions, 'projectIds'> = {
    actionTypes,
    targetBadges,
    assignmentIds,
    resultStatus,
    dateFrom,
    dateTo,
    searchText,
  }

  const scenario = (url.searchParams.get('scenario') ?? 'all').toLowerCase()
  let activities = createDemoActivities(projectId)

  if (scenario === 'brandlist') {
    activities = activities.filter((entry) => {
      const workflow = typeof entry.metadata?.workflow === 'string' ? entry.metadata.workflow.toLowerCase() : ''
      return workflow === 'brandlist'
    })
  } else if (scenario === 'branding') {
    activities = activities.filter((entry) => {
      const workflow = typeof entry.metadata?.workflow === 'string' ? entry.metadata.workflow.toLowerCase() : ''
      return workflow === 'branding'
    })
  } else if (scenario === 'exceptions') {
    activities = activities.filter((entry) => entry.result === 'failure' || entry.result === 'pending' || entry.action === 'BLOCKED')
  }

  const filtered = applyFilters(activities, filters)
  const sorted = filtered.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))

  return NextResponse.json({
    projectId,
    source: 'demo',
    scenario,
    activities: sorted.slice(0, resolvedLimit),
    total: sorted.length,
    availableScenarios: ['all', 'brandlist', 'branding', 'exceptions'],
  })
}
