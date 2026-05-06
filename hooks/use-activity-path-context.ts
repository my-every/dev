'use client'

/**
 * useActivityPathContext
 *
 * Reads the current URL path and derives appropriate ActivityTimeline filter
 * constraints automatically, so the panel shows only relevant activity.
 *
 * Supported route patterns (all under /{badgeNumber}/...):
 *   /projects                    → all badge activity
 *   /projects/[projectId]        → filter by projectId
 *   /parts/[partId]              → all badge activity (parts don't have activity yet)
 *   /profile/[profileId]         → filter by targetBadge === profileId
 *   /users/[userId]              → filter by targetBadge === userId
 *   /sws/[swsId]                 → all badge activity
 *   /schedule                    → all badge activity
 *   /training/[trainingId]       → all badge activity
 */

import { usePathname, useParams } from 'next/navigation'
import { useMemo } from 'react'
import type { ActivityTimelineFilterOptions } from '@/types/activity'

export type ActivityPathContext = {
    /** Derived filters to apply to the activity timeline */
    filters: ActivityTimelineFilterOptions

    /** Human-readable label describing the current context scope */
    scopeLabel: string

    /**
     * Whether the context is scoped to something narrower than "all activity".
     * Use this to show/hide a "viewing X activity" indicator.
     */
    isScoped: boolean

    /** True when current section is Projects */
    isProjectsRoute: boolean

    /** Project id when on /projects/[projectId], else null */
    projectId: string | null
}

/**
 * Parse the workspace path and return appropriate filter constraints.
 * Path is expected to be: /{badgeNumber}/{section}/[entityId]/...
 */
export function useActivityPathContext(): ActivityPathContext {
    const pathname = usePathname()
    const params = useParams<{
        badgeNumber?: string
        projectId?: string
        profileId?: string
        userId?: string
        partId?: string
        swsId?: string
        trainingId?: string
    }>()

    return useMemo<ActivityPathContext>(() => {
        // Strip leading slash and split into segments
        const segments = pathname.replace(/^\//, '').split('/')
        // segments[0] = badgeNumber, segments[1] = section, segments[2] = entityId, ...

        const section = segments[1] ?? ''

        // Projects: /{badge}/projects/{projectId}
        if (section === 'projects' && params.projectId) {
            return {
                filters: { projectIds: [params.projectId] },
                scopeLabel: 'Project activity',
                isScoped: true,
                isProjectsRoute: true,
                projectId: params.projectId,
            }
        }

        // Profile: /{badge}/profile/{profileId}
        if (section === 'profile' && params.profileId) {
            return {
                filters: { targetBadges: [params.profileId] },
                scopeLabel: 'Profile activity',
                isScoped: true,
                isProjectsRoute: false,
                projectId: null,
            }
        }

        // Users: /{badge}/users/{userId}
        if (section === 'users' && params.userId) {
            return {
                filters: { targetBadges: [params.userId] },
                scopeLabel: 'User activity',
                isScoped: true,
                isProjectsRoute: false,
                projectId: null,
            }
        }

        // Fallthrough: no scoping, show all badge activity
        return {
            filters: {},
            scopeLabel: section === 'projects' ? 'Projects activity' : 'All activity',
            isScoped: false,
            isProjectsRoute: section === 'projects',
            projectId: null,
        }
    }, [pathname, params.projectId, params.profileId, params.userId])
}
