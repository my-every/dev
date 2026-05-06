/**
 * ActivityService - API-backed activity tracking
 *
 * Client-side service that calls /api/activity/[badge] so actions are persisted
 * to Share/users/{shift}/{badge}/activity.json on the server.
 */

import type {
    ActivityEntry,
    ActivityDocument,
    ActivityAction,
    ActivityTimelineFilterOptions,
    ActivityStats,
    ActivityMetadata,
} from '@/types/activity'

export interface IActivityService {
    /**
     * Add a new activity record
     */
    addActivity(
        badge: string,
        shift: string,
        action: ActivityAction,
        metadata: ActivityMetadata
    ): Promise<ActivityEntry>

    /**
     * Get activity for a user with optional filters
     */
    getActivity(
        badge: string,
        shift: string,
        filters?: ActivityTimelineFilterOptions
    ): Promise<ActivityEntry[]>

    /**
     * Get a single activity entry by ID
     */
    getActivityEntry(
        badge: string,
        shift: string,
        entryId: string
    ): Promise<ActivityEntry | null>

    /**
     * Get statistics about activity
     */
    getActivityStats(
        badge: string,
        shift: string
    ): Promise<ActivityStats>

    /**
     * Get complete activity document (all activities + metadata)
     */
    getActivityDocument(
        badge: string,
        shift: string
    ): Promise<ActivityDocument | null>

    /**
     * Add a comment as a separate activity record
     */
    addComment(
        badge: string,
        shift: string,
        comment: string,
        targetBadge?: string,
        assignmentId?: string
    ): Promise<ActivityEntry>

    /**
     * Add a threaded comment to an existing activity
     */
    addThreadComment(
        badge: string,
        shift: string,
        activityId: string,
        comment: string,
        author: string
    ): Promise<ActivityEntry>

    /**
     * Link related/nested activities to an activity
     */
    linkRelatedActivities(
        badge: string,
        shift: string,
        activityId: string,
        relatedActivityIds: string[]
    ): Promise<ActivityEntry>

    /**
     * Generic typed write path used by workflows (assignments/comments/status/actions)
     */
    logAction(
        badge: string,
        shift: string,
        payload: {
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
        }
    ): Promise<ActivityEntry>
}

function appendCsv(params: URLSearchParams, key: string, values?: string[]) {
    if (values?.length) {
        params.set(key, values.join(','))
    }
}

export class ApiActivityService implements IActivityService {
    async logAction(
        badge: string,
        shift: string,
        payload: {
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
        },
    ): Promise<ActivityEntry> {
        const response = await fetch(`/api/activity/${badge}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                shift,
                ...payload,
                performedBy: payload.performedBy ?? badge,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to create activity (${response.status})`)
        }

        const result = await response.json()
        return result.entry as ActivityEntry
    }

    async addActivity(
        badge: string,
        shift: string,
        action: ActivityAction,
        metadata: ActivityMetadata,
    ): Promise<ActivityEntry> {
        return this.logAction(badge, shift, {
            action,
            metadata,
            assignmentId: metadata.assignmentId,
            projectId: metadata.projectId,
            stage: metadata.stage,
            comment: metadata.comment,
            targetBadge: metadata.targetBadge,
            durationSeconds: metadata.durationSeconds,
            result: metadata.result,
            error: metadata.error,
            performedBy: metadata.performedBy,
        })
    }

    async getActivity(
        badge: string,
        shift: string,
        filters?: ActivityTimelineFilterOptions,
    ): Promise<ActivityEntry[]> {
        const params = new URLSearchParams({ shift })

        appendCsv(params, 'actionTypes', filters?.actionTypes)
        appendCsv(params, 'targetBadges', filters?.targetBadges)
        appendCsv(params, 'assignmentIds', filters?.assignmentIds)
        appendCsv(params, 'projectIds', filters?.projectIds)
        appendCsv(params, 'resultStatus', filters?.resultStatus)

        if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom)
        if (filters?.dateTo) params.set('dateTo', filters.dateTo)
        if (filters?.searchText) params.set('searchText', filters.searchText)
        if (typeof filters?.limit === 'number') params.set('limit', String(filters.limit))
        if (typeof filters?.offset === 'number') params.set('offset', String(filters.offset))
        if (typeof filters?.reversed === 'boolean') params.set('reversed', String(filters.reversed))

        params.set('includeDocument', 'false')
        const response = await fetch(`/api/activity/${badge}?${params.toString()}`)
        if (!response.ok) {
            throw new Error(`Failed to read activity (${response.status})`)
        }

        const payload = await response.json()
        return (payload.activities ?? []) as ActivityEntry[]
    }

    async getActivityEntry(
        badge: string,
        shift: string,
        entryId: string,
    ): Promise<ActivityEntry | null> {
        const activities = await this.getActivity(badge, shift)
        return activities.find((x) => x.id === entryId) ?? null
    }

    async getActivityStats(badge: string, shift: string): Promise<ActivityStats> {
        const response = await fetch(`/api/activity/${badge}?shift=${encodeURIComponent(shift)}&includeDocument=false`)
        if (!response.ok) {
            throw new Error(`Failed to read activity stats (${response.status})`)
        }

        const payload = await response.json()
        return payload.stats as ActivityStats
    }

    async getActivityDocument(
        badge: string,
        shift: string,
    ): Promise<ActivityDocument | null> {
        const response = await fetch(`/api/activity/${badge}?shift=${encodeURIComponent(shift)}&includeDocument=true`)
        if (!response.ok) {
            throw new Error(`Failed to read activity document (${response.status})`)
        }

        const payload = await response.json()
        return (payload.document ?? null) as ActivityDocument | null
    }

    async addComment(
        badge: string,
        shift: string,
        comment: string,
        targetBadge?: string,
        assignmentId?: string,
    ): Promise<ActivityEntry> {
        return this.addActivity(badge, shift, 'COMMENT_ADDED', {
            comment,
            targetBadge,
            assignmentId,
            mentionedBadge: targetBadge,
            performedBy: badge,
        })
    }

    async addThreadComment(
        badge: string,
        shift: string,
        activityId: string,
        comment: string,
        author: string
    ): Promise<ActivityEntry> {
        const response = await fetch(`/api/activity/${badge}/details`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                activityId,
                shift,
                comment,
                author,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to add thread comment (${response.status})`)
        }

        const result = await response.json()
        return result.activity as ActivityEntry
    }

    async linkRelatedActivities(
        badge: string,
        shift: string,
        activityId: string,
        relatedActivityIds: string[]
    ): Promise<ActivityEntry> {
        const response = await fetch(`/api/activity/${badge}/details`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                activityId,
                shift,
                relatedActivityIds,
            }),
        })

        if (!response.ok) {
            throw new Error(`Failed to link related activities (${response.status})`)
        }

        const result = await response.json()
        return result.activity as ActivityEntry
    }
}

export const activityService = new ApiActivityService()
