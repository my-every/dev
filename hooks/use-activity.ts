/**
 * useActivity Hook
 *
 * Provides access to activity service with automatic fetching and caching
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import type {
    ActivityAction,
    ActivityEntry,
    ActivityMetadata,
    ActivityTimelineFilterOptions,
    ActivityStats,
} from '@/types/activity'
import { activityService } from '@/lib/services/activity-service'

interface UseActivityOptions {
    badge: string
    shift: string
    autoFetch?: boolean
    filters?: ActivityTimelineFilterOptions
    projectId?: string
    aggregateAcrossUsers?: boolean
}

interface UseActivityReturn {
    activities: ActivityEntry[]
    loading: boolean
    error: string | null
    stats: ActivityStats | null
    refresh: () => Promise<void>
    addComment: (comment: string, targetBadge?: string, assignmentId?: string) => Promise<void>
    logActivity: (payload: {
        action: ActivityAction
        metadata?: ActivityMetadata
        assignmentId?: string
        projectId?: string
        stage?: string
        comment?: string
        targetBadge?: string
        durationSeconds?: number
        result?: 'success' | 'failure' | 'pending'
        error?: string
        performedBy?: string
    }) => Promise<void>
}

export function useActivity({
    badge,
    shift,
    autoFetch = true,
    filters,
    projectId,
    aggregateAcrossUsers = false,
}: UseActivityOptions): UseActivityReturn {
    const [activities, setActivities] = useState<ActivityEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [stats, setStats] = useState<ActivityStats | null>(null)

    const buildStats = useCallback((entries: ActivityEntry[]): ActivityStats => {
        const countByAction = {} as Record<ActivityAction, number>
        const countByResult = {} as Record<string, number>

        for (const entry of entries) {
            countByAction[entry.action] = (countByAction[entry.action] ?? 0) + 1
            const result = entry.result ?? 'pending'
            countByResult[result] = (countByResult[result] ?? 0) + 1
        }

        return {
            totalCount: entries.length,
            countByAction,
            countByResult,
            oldestEntry: entries[entries.length - 1],
            newestEntry: entries[0],
        }
    }, [])

    const appendCsv = useCallback((params: URLSearchParams, key: string, values?: string[]) => {
        if (values?.length) {
            params.set(key, values.join(','))
        }
    }, [])

    const refresh = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            if (aggregateAcrossUsers) {
                const params = new URLSearchParams({ shift })
                appendCsv(params, 'actionTypes', filters?.actionTypes)
                appendCsv(params, 'targetBadges', filters?.targetBadges)
                appendCsv(params, 'assignmentIds', filters?.assignmentIds)
                appendCsv(params, 'resultStatus', filters?.resultStatus)

                if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom)
                if (filters?.dateTo) params.set('dateTo', filters.dateTo)
                if (filters?.searchText) params.set('searchText', filters.searchText)
                if (typeof filters?.limit === 'number') params.set('limit', String(filters.limit))

                if (projectId) {
                    const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/activity?${params.toString()}`, {
                        cache: 'no-store',
                    })
                    if (!response.ok) {
                        throw new Error(`Failed to load project activity (${response.status})`)
                    }
                    const payload = await response.json()
                    const entries = (payload.activities ?? []) as ActivityEntry[]
                    setActivities(entries)
                    setStats(buildStats(entries))
                    return
                }

                appendCsv(params, 'projectIds', filters?.projectIds)
                const response = await fetch(`/api/activity/all?${params.toString()}`, {
                    cache: 'no-store',
                })
                if (!response.ok) {
                    throw new Error(`Failed to load aggregate activity (${response.status})`)
                }
                const payload = await response.json()
                const entries = (payload.activities ?? []) as ActivityEntry[]
                setActivities(entries)
                setStats(buildStats(entries))
                return
            }

            const [activityList, activityStats] = await Promise.all([
                activityService.getActivity(badge, shift, filters),
                activityService.getActivityStats(badge, shift),
            ])
            setActivities(activityList)
            setStats(activityStats)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load activity')
        } finally {
            setLoading(false)
        }
    }, [badge, shift, filters, aggregateAcrossUsers, projectId, appendCsv, buildStats])

    const addComment = useCallback(
        async (comment: string, targetBadge?: string, assignmentId?: string) => {
            try {
                await activityService.addComment(badge, shift, comment, targetBadge, assignmentId)
                await refresh()
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to add comment')
            }
        },
        [badge, shift, refresh]
    )

    const logActivity = useCallback(
        async (payload: {
            action: ActivityAction
            metadata?: ActivityMetadata
            assignmentId?: string
            projectId?: string
            stage?: string
            comment?: string
            targetBadge?: string
            durationSeconds?: number
            result?: 'success' | 'failure' | 'pending'
            error?: string
            performedBy?: string
        }) => {
            try {
                await activityService.logAction(badge, shift, payload)
                await refresh()
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to log activity')
            }
        },
        [badge, shift, refresh]
    )

    useEffect(() => {
        if (autoFetch) {
            void refresh()
        }
    }, [autoFetch, refresh])

    return { activities, loading, error, stats, refresh, addComment, logActivity }
}
