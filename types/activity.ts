/**
 * Activity Model & Types
 *
 * This file defines the shape of user activity records stored in Share/users/{shift}/{badge}/activity.json
 * Activity is the source of truth for all user actions: comments, assignments, completions, etc.
 */

export const ACTIVITY_ACTIONS = [
    // Assignment & Task Actions
    'ASSIGNED',
    'REASSIGNED',
    'STARTED',
    'BLOCKED',
    'UNBLOCKED',
    'STAGE_CHANGED',
    'COMPLETED',
    'REOPENED',
    'CANCELLED',
    'SETTINGS_CHANGED',
    // Comment Actions
    'COMMENT_ADDED',
    // Permission Management Actions
    'PERMISSION_GRANTED',
    'PERMISSION_REVOKED',
    // Project Management Actions
    'PROJECT_CREATED',
    'PROJECT_ARCHIVED',
    'PROJECT_UNARCHIVED',
] as const

export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

export interface ActivityMetadata {
    [key: string]: unknown
}

/** Metadata for permission change activities */
export interface PermissionActivityMetadata extends ActivityMetadata {
    targetBadge: string
    targetName: string
    permissionKey: string
    permissionLabel: string
    previousValue: boolean
    newValue: boolean
    cascadedFrom?: string // Badge who delegated
}

/** Metadata for project activities */
export interface ProjectActivityMetadata extends ActivityMetadata {
    projectId: string
    projectName: string
    pdNumber?: string
    reason?: string
    affectedAssignments?: number
}

export interface ActivityComment {
    /** Comment ID */
    id: string
    /** Comment text */
    text: string
    /** Author badge */
    author: string
    /** Timestamp */
    timestamp: string
}

export interface ActivityEntry {
    /** Unique ID for this activity record (timestamp-based or UUID) */
    id: string

    /** Timestamp when activity occurred (ISO string) */
    timestamp: string

    /** Type of activity */
    action: ActivityAction

    /** Badge number if this is about another user, optional */
    targetBadge?: string

    /** Assignment ID, if applicable */
    assignmentId?: string

    /** Project ID, if applicable */
    projectId?: string

    /** Stage name, if applicable */
    stage?: string

    /** Comment text, if action is 'COMMENT_ADDED' */
    comment?: string

    /** Additional metadata */
    metadata: ActivityMetadata

    /** User who performed action (primary badge) */
    performedBy: string

    /** Duration in seconds if applicable (e.g., assignment time) */
    durationSeconds?: number

    /** Result status: success, failure, pending */
    result?: 'success' | 'failure' | 'pending'

    /** Optional error message if result is failure */
    error?: string

    /** IDs of related/nested activities (sub-processes) */
    relatedActivityIds?: string[]

    /** Thread comments on this activity */
    comments?: ActivityComment[]
}

export interface ActivityDocument {
    /** Badge number */
    badge: string

    /** Shift: 1st, 2nd */
    shift: string

    /** ISO timestamp of last update to this file */
    lastUpdated: string

    /** Array of activities, sorted by timestamp (newest first) */
    activities: ActivityEntry[]

    /** Optional metadata about user activity patterns */
    stats?: {
        totalActions: number
        actionsToday: number
        lastActionTime?: string
    }
}

/**
 * Filter options for timeline queries
 */
export interface ActivityTimelineFilterOptions {
    /** Filter by action type */
    actionTypes?: ActivityAction[]

    /** Filter by target badge (e.g., show comments on a specific user) */
    targetBadges?: string[]

    /** Filter by assignment ID */
    assignmentIds?: string[]

    /** Filter by project ID */
    projectIds?: string[]

    /** Filter by result status */
    resultStatus?: Array<'success' | 'failure' | 'pending'>

    /** Start of date range (ISO string) */
    dateFrom?: string

    /** End of date range (ISO string) */
    dateTo?: string

    /** Max number of results to return */
    limit?: number

    /** Offset for pagination */
    offset?: number

    /** Search text in comments or metadata */
    searchText?: string

    /** Reverse order (default is newest first) */
    reversed?: boolean
}

export interface ActivityStats {
    totalCount: number
    countByAction: Record<ActivityAction, number>
    countByResult: Record<string, number>
    oldestEntry?: ActivityEntry
    newestEntry?: ActivityEntry
}
