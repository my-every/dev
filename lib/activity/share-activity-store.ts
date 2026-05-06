import fs from 'node:fs'
import path from 'node:path'
import { resolveShareDirectorySync } from '@/lib/runtime/share-directory'

import type {
    ActivityAction,
    ActivityDocument,
    ActivityEntry,
    ActivityStats,
    ActivityTimelineFilterOptions,
} from '@/types/activity'

const MAX_ACTIVITY_ENTRIES = 2000
const MAX_PROJECT_INDEX_ENTRIES = 2000
const ACTIVITY_EVENTS_FILE = 'activity-events.jsonl'

const SHIFT_DIRS = ['1st-shift', '2nd-shift'] as const

type ActivityEventType =
    | 'ENTRY_CREATED'
    | 'ENTRY_DELETED'
    | 'THREAD_COMMENT_ADDED'
    | 'THREAD_COMMENT_DELETED'
    | 'RELATED_IDS_UPDATED'

interface ActivityEventRecord {
    id: string
    timestamp: string
    type: ActivityEventType
    badge: string
    shift: string
    activityId?: string
    projectId?: string
    payload?: Record<string, unknown>
}

interface ProjectActivityIndex {
    projectId: string
    badge: string
    shift: string
    lastUpdated: string
    activityIds: string[]
}

export interface ActivityProjectIndexBackfillReport {
    scannedUsers: number
    scannedActivities: number
    indexFilesWritten: number
    usersWithNoActivityFile: number
    usersWithNoProjectActivities: number
    errors: Array<{
        badge: string
        shift: string
        message: string
    }>
}

function getUsersDir(): string {
    return path.join(resolveShareDirectorySync(), 'users')
}

type ShiftDir = (typeof SHIFT_DIRS)[number]

function normalizeShiftDir(shift: string): ShiftDir | null {
    const raw = shift.trim().toLowerCase()
    if (!raw) return null

    if (raw === '1st' || raw === 'first' || raw === '1' || raw === '1st-shift') return '1st-shift'
    if (raw === '2nd' || raw === 'second' || raw === '2' || raw === '2nd-shift') return '2nd-shift'

    return null
}

function toApiShift(shiftDir: ShiftDir): string {
    return shiftDir.replace('-shift', '')
}

function resolveShiftDirForBadge(badge: string): ShiftDir | null {
    const usersDir = getUsersDir()
    for (const shiftDir of SHIFT_DIRS) {
        const userDir = path.join(usersDir, shiftDir, badge)
        if (fs.existsSync(userDir)) {
            return shiftDir
        }
    }
    return null
}

function resolveActivityPath(badge: string, shift?: string): string | null {
    const shiftDir = shift ? normalizeShiftDir(shift) : resolveShiftDirForBadge(badge)
    if (!shiftDir) return null
    return path.join(getUsersDir(), shiftDir, badge, 'activity.json')
}

function resolveUserDir(badge: string, shift: string): string | null {
    const shiftDir = normalizeShiftDir(shift)
    if (!shiftDir) return null
    return path.join(getUsersDir(), shiftDir, badge)
}

function resolveActivityEventsPath(badge: string, shift: string): string | null {
    const userDir = resolveUserDir(badge, shift)
    if (!userDir) return null
    return path.join(userDir, ACTIVITY_EVENTS_FILE)
}

function toSafeFileSegment(value: string): string {
    return encodeURIComponent(value.trim())
}

function resolveProjectIndexPath(badge: string, shift: string, projectId: string): string | null {
    const userDir = resolveUserDir(badge, shift)
    if (!userDir) return null
    return path.join(userDir, 'activity-index', 'projects', `${toSafeFileSegment(projectId)}.json`)
}

function readProjectIndex(badge: string, shift: string, projectId: string): ProjectActivityIndex | null {
    const indexPath = resolveProjectIndexPath(badge, shift, projectId)
    if (!indexPath || !fs.existsSync(indexPath)) return null

    try {
        const raw = fs.readFileSync(indexPath, 'utf-8')
        const parsed = JSON.parse(raw) as ProjectActivityIndex
        if (!Array.isArray(parsed.activityIds)) return null
        return parsed
    } catch {
        return null
    }
}

function writeProjectIndex(badge: string, shift: string, projectId: string, activityIds: string[]): void {
    const indexPath = resolveProjectIndexPath(badge, shift, projectId)
    if (!indexPath) return

    const next: ProjectActivityIndex = {
        projectId,
        badge,
        shift,
        lastUpdated: new Date().toISOString(),
        activityIds: activityIds.slice(0, MAX_PROJECT_INDEX_ENTRIES),
    }

    fs.mkdirSync(path.dirname(indexPath), { recursive: true })
    fs.writeFileSync(indexPath, JSON.stringify(next, null, 2) + '\n', 'utf-8')
}

function upsertProjectIndexForAdd(badge: string, shift: string, projectId: string, activityId: string): void {
    const existing = readProjectIndex(badge, shift, projectId)
    const ids = existing?.activityIds ?? []

    if (!ids.includes(activityId)) {
        ids.unshift(activityId)
    }

    writeProjectIndex(badge, shift, projectId, ids)
}

function upsertProjectIndexForDelete(badge: string, shift: string, projectId: string, activityId: string): void {
    const existing = readProjectIndex(badge, shift, projectId)
    if (!existing) return

    const nextIds = existing.activityIds.filter((id) => id !== activityId)
    writeProjectIndex(badge, shift, projectId, nextIds)
}

function buildProjectIndexFromDocument(
    badge: string,
    shift: string,
    projectId: string,
    doc: ActivityDocument,
): string[] {
    const ids = doc.activities
        .filter((entry) => entry.projectId === projectId)
        .map((entry) => entry.id)
    writeProjectIndex(badge, shift, projectId, ids)
    return ids
}

function resolveShiftLabel(shiftDir: ShiftDir): string {
    return toApiShift(shiftDir)
}

function listBadgesForShift(shiftDir: ShiftDir): string[] {
    const dir = path.join(getUsersDir(), shiftDir)
    if (!fs.existsSync(dir)) return []

    try {
        return fs
            .readdirSync(dir, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .filter((name) => /^\d+$/.test(name))
    } catch {
        return []
    }
}

export async function backfillProjectIndexesForBadgeShift(
    badge: string,
    shift: string,
): Promise<{
    scannedActivities: number
    indexFilesWritten: number
    noActivityFile: boolean
    noProjectActivities: boolean
}> {
    const doc = await readActivityDocumentFromShare(badge, shift)
    if (!doc) {
        return {
            scannedActivities: 0,
            indexFilesWritten: 0,
            noActivityFile: true,
            noProjectActivities: false,
        }
    }

    const projectMap = new Map<string, string[]>()
    for (const entry of doc.activities) {
        if (!entry.projectId) continue
        const list = projectMap.get(entry.projectId) ?? []
        list.push(entry.id)
        projectMap.set(entry.projectId, list)
    }

    if (projectMap.size === 0) {
        return {
            scannedActivities: doc.activities.length,
            indexFilesWritten: 0,
            noActivityFile: false,
            noProjectActivities: true,
        }
    }

    let written = 0
    for (const [projectId, ids] of projectMap.entries()) {
        writeProjectIndex(badge, shift, projectId, ids)
        written += 1
    }

    return {
        scannedActivities: doc.activities.length,
        indexFilesWritten: written,
        noActivityFile: false,
        noProjectActivities: false,
    }
}

export async function backfillProjectIndexesFromShare(input?: {
    badge?: string
    shift?: string
}): Promise<ActivityProjectIndexBackfillReport> {
    const report: ActivityProjectIndexBackfillReport = {
        scannedUsers: 0,
        scannedActivities: 0,
        indexFilesWritten: 0,
        usersWithNoActivityFile: 0,
        usersWithNoProjectActivities: 0,
        errors: [],
    }

    const targetShifts: ShiftDir[] = input?.shift
        ? (normalizeShiftDir(input.shift) ? [normalizeShiftDir(input.shift)!] : [])
        : [...SHIFT_DIRS]

    for (const shiftDir of targetShifts) {
        const shift = resolveShiftLabel(shiftDir)
        const badges = input?.badge ? [input.badge] : listBadgesForShift(shiftDir)

        for (const badge of badges) {
            report.scannedUsers += 1
            try {
                const result = await backfillProjectIndexesForBadgeShift(badge, shift)
                report.scannedActivities += result.scannedActivities
                report.indexFilesWritten += result.indexFilesWritten
                if (result.noActivityFile) report.usersWithNoActivityFile += 1
                if (result.noProjectActivities) report.usersWithNoProjectActivities += 1
            } catch (error) {
                report.errors.push({
                    badge,
                    shift,
                    message: error instanceof Error ? error.message : 'Unknown backfill error',
                })
            }
        }
    }

    return report
}

export async function appendActivityEventToShare(
    badge: string,
    shift: string,
    type: ActivityEventType,
    payload: {
        activityId?: string
        projectId?: string
        data?: Record<string, unknown>
    },
): Promise<boolean> {
    const eventsPath = resolveActivityEventsPath(badge, shift)
    if (!eventsPath) return false

    const event: ActivityEventRecord = {
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        type,
        badge,
        shift,
        activityId: payload.activityId,
        projectId: payload.projectId,
        payload: payload.data,
    }

    try {
        fs.mkdirSync(path.dirname(eventsPath), { recursive: true })
        fs.appendFileSync(eventsPath, `${JSON.stringify(event)}\n`, 'utf-8')
        return true
    } catch {
        return false
    }
}

function computeStats(activities: ActivityEntry[]): ActivityStats {
    const countByAction = {} as Record<ActivityAction, number>
    const countByResult: Record<string, number> = {}

    for (const entry of activities) {
        countByAction[entry.action] = (countByAction[entry.action] ?? 0) + 1
        const result = entry.result ?? 'pending'
        countByResult[result] = (countByResult[result] ?? 0) + 1
    }

    return {
        totalCount: activities.length,
        countByAction,
        countByResult,
        newestEntry: activities[0],
        oldestEntry: activities[activities.length - 1],
    }
}

export function buildEmptyActivityDocument(badge: string, shift: string): ActivityDocument {
    return {
        badge,
        shift,
        lastUpdated: new Date().toISOString(),
        activities: [],
        stats: {
            totalActions: 0,
            actionsToday: 0,
        },
    }
}

export async function readActivityDocumentFromShare(
    badge: string,
    shift?: string,
): Promise<ActivityDocument | null> {
    const activityPath = resolveActivityPath(badge, shift)
    if (!activityPath || !fs.existsSync(activityPath)) {
        return null
    }

    try {
        const raw = fs.readFileSync(activityPath, 'utf-8')
        return JSON.parse(raw) as ActivityDocument
    } catch {
        return null
    }
}

export async function upsertActivityDocumentInShare(
    badge: string,
    shift: string,
): Promise<ActivityDocument | null> {
    const shiftDir = normalizeShiftDir(shift)
    if (!shiftDir) return null

    const userDir = path.join(getUsersDir(), shiftDir, badge)
    const activityPath = path.join(userDir, 'activity.json')

    try {
        fs.mkdirSync(userDir, { recursive: true })

        if (fs.existsSync(activityPath)) {
            const raw = fs.readFileSync(activityPath, 'utf-8')
            return JSON.parse(raw) as ActivityDocument
        }

        const empty = buildEmptyActivityDocument(badge, toApiShift(shiftDir))
        fs.writeFileSync(activityPath, JSON.stringify(empty, null, 2) + '\n', 'utf-8')
        return empty
    } catch {
        return null
    }
}

export async function addActivityToShare(
    badge: string,
    shift: string,
    payload: {
        action: ActivityAction
        performedBy: string
        metadata?: Record<string, unknown>
        assignmentId?: string
        projectId?: string
        stage?: string
        comment?: string
        targetBadge?: string
        durationSeconds?: number
        result?: 'success' | 'failure' | 'pending'
        error?: string
    },
): Promise<ActivityEntry | null> {
    const doc = await upsertActivityDocumentInShare(badge, shift)
    if (!doc) return null

    const activityPath = resolveActivityPath(badge, shift)
    if (!activityPath) return null

    const entry: ActivityEntry = {
        id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        action: payload.action,
        performedBy: payload.performedBy,
        metadata: payload.metadata ?? {},
        assignmentId: payload.assignmentId,
        projectId: payload.projectId,
        stage: payload.stage,
        comment: payload.comment,
        targetBadge: payload.targetBadge,
        durationSeconds: payload.durationSeconds,
        result: payload.result,
        error: payload.error,
    }

    doc.activities.unshift(entry)
    doc.activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    // Keep file size manageable for long-lived user histories.
    if (doc.activities.length > MAX_ACTIVITY_ENTRIES) {
        doc.activities = doc.activities.slice(0, MAX_ACTIVITY_ENTRIES)
    }

    doc.lastUpdated = new Date().toISOString()

    const today = new Date().toDateString()
    const actionsToday = doc.activities.filter((a) => new Date(a.timestamp).toDateString() === today).length

    doc.stats = {
        totalActions: doc.activities.length,
        actionsToday,
        lastActionTime: entry.timestamp,
    }

    try {
        fs.writeFileSync(activityPath, JSON.stringify(doc, null, 2) + '\n', 'utf-8')
        if (entry.projectId) {
            upsertProjectIndexForAdd(badge, shift, entry.projectId, entry.id)
        }
        await appendActivityEventToShare(badge, shift, 'ENTRY_CREATED', {
            activityId: entry.id,
            projectId: entry.projectId,
            data: {
                action: entry.action,
                result: entry.result,
            },
        })
        return entry
    } catch {
        return null
    }
}

export async function getActivityEntriesFromShare(
    badge: string,
    shift: string,
    filters?: ActivityTimelineFilterOptions,
): Promise<ActivityEntry[]> {
    const doc = await readActivityDocumentFromShare(badge, shift)
    if (!doc) return []

    if (!filters?.projectIds?.length) {
        return applyActivityFilters(doc.activities, filters)
    }

    const activityIds = new Set<string>()
    for (const projectId of filters.projectIds) {
        const indexed = readProjectIndex(badge, shift, projectId)
        const ids = indexed?.activityIds ?? buildProjectIndexFromDocument(badge, shift, projectId, doc)
        ids.forEach((id) => activityIds.add(id))
    }

    if (activityIds.size === 0) {
        return []
    }

    const byId = new Map(doc.activities.map((entry) => [entry.id, entry]))
    const scoped = Array.from(activityIds)
        .map((id) => byId.get(id))
        .filter((entry): entry is ActivityEntry => Boolean(entry))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return applyActivityFilters(scoped, filters)
}

export function applyActivityFilters(
    activities: ActivityEntry[],
    filters?: ActivityTimelineFilterOptions,
): ActivityEntry[] {
    if (!filters) return activities

    let output = [...activities]

    if (filters.actionTypes?.length) {
        output = output.filter((x) => filters.actionTypes!.includes(x.action))
    }

    if (filters.targetBadges?.length) {
        output = output.filter((x) => x.targetBadge && filters.targetBadges!.includes(x.targetBadge))
    }

    if (filters.assignmentIds?.length) {
        output = output.filter((x) => x.assignmentId && filters.assignmentIds!.includes(x.assignmentId))
    }

    if (filters.projectIds?.length) {
        output = output.filter((x) => x.projectId && filters.projectIds!.includes(x.projectId))
    }

    if (filters.resultStatus?.length) {
        output = output.filter((x) => filters.resultStatus!.includes(x.result ?? 'pending'))
    }

    if (filters.dateFrom) {
        const from = new Date(filters.dateFrom).getTime()
        output = output.filter((x) => new Date(x.timestamp).getTime() >= from)
    }

    if (filters.dateTo) {
        const to = new Date(filters.dateTo).getTime()
        output = output.filter((x) => new Date(x.timestamp).getTime() <= to)
    }

    if (filters.searchText) {
        const q = filters.searchText.toLowerCase()
        output = output.filter((x) => {
            const commentMatch = (x.comment ?? '').toLowerCase().includes(q)
            const metadataMatch = JSON.stringify(x.metadata ?? {}).toLowerCase().includes(q)
            return commentMatch || metadataMatch
        })
    }

    if (filters.reversed) {
        output = [...output].reverse()
    }

    if (typeof filters.offset === 'number' && filters.offset > 0) {
        output = output.slice(filters.offset)
    }

    if (typeof filters.limit === 'number' && filters.limit > 0) {
        output = output.slice(0, filters.limit)
    }

    return output
}

/**
 * Aggregate activity entries for a project across ALL badges and shifts.
 * Uses the per-user project index for efficient lookup.
 */
export async function getProjectActivityAcrossAllBadges(
    projectId: string,
    options?: {
        /** Restrict to a specific shift label (e.g. "1st"). Omit for all shifts. */
        shift?: string
        filters?: Omit<ActivityTimelineFilterOptions, 'projectIds'>
        /** Hard cap on returned entries. Applied after merge + sort. */
        limit?: number
    },
): Promise<ActivityEntry[]> {
    const targetShiftDirs: ShiftDir[] = options?.shift
        ? (normalizeShiftDir(options.shift) ? [normalizeShiftDir(options.shift)!] : [])
        : [...SHIFT_DIRS]

    const seen = new Set<string>()
    const merged: ActivityEntry[] = []

    for (const shiftDir of targetShiftDirs) {
        const shift = toApiShift(shiftDir)
        const badges = listBadgesForShift(shiftDir)

        for (const badge of badges) {
            try {
                const entries = await getActivityEntriesFromShare(badge, shift, {
                    ...options?.filters,
                    projectIds: [projectId],
                })
                for (const entry of entries) {
                    if (!seen.has(entry.id)) {
                        seen.add(entry.id)
                        merged.push(entry)
                    }
                }
            } catch {
                // Skip unreachable badge
            }
        }
    }

    // Sort newest-first
    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const cap = options?.limit ?? 0
    return cap > 0 ? merged.slice(0, cap) : merged
}

/**
 * Aggregate activity entries across ALL badges and shifts.
 */
export async function getActivityAcrossAllBadges(options?: {
    /** Restrict to a specific shift label (e.g. "1st"). Omit for all shifts. */
    shift?: string
    filters?: ActivityTimelineFilterOptions
    /** Hard cap on returned entries. Applied after merge + sort. */
    limit?: number
}): Promise<ActivityEntry[]> {
    const targetShiftDirs: ShiftDir[] = options?.shift
        ? (normalizeShiftDir(options.shift) ? [normalizeShiftDir(options.shift)!] : [])
        : [...SHIFT_DIRS]

    const seen = new Set<string>()
    const merged: ActivityEntry[] = []

    for (const shiftDir of targetShiftDirs) {
        const shift = toApiShift(shiftDir)
        const badges = listBadgesForShift(shiftDir)

        for (const badge of badges) {
            try {
                const entries = await getActivityEntriesFromShare(badge, shift, options?.filters)
                for (const entry of entries) {
                    if (!seen.has(entry.id)) {
                        seen.add(entry.id)
                        merged.push(entry)
                    }
                }
            } catch {
                // Skip unreachable badge
            }
        }
    }

    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const cap = options?.limit ?? 0
    return cap > 0 ? merged.slice(0, cap) : merged
}

export async function getActivityStatsFromShare(
    badge: string,
    shift?: string,
): Promise<ActivityStats> {
    const doc = await readActivityDocumentFromShare(badge, shift)
    if (!doc || !doc.activities.length) {
        return {
            totalCount: 0,
            countByAction: {} as Record<ActivityAction, number>,
            countByResult: {},
        }
    }

    return computeStats(doc.activities)
}

/**
 * Delete a single activity entry by ID.
 * Returns true if found and removed, false otherwise.
 */
export async function deleteActivityEntryFromShare(
    badge: string,
    shift: string,
    activityId: string,
): Promise<boolean> {
    const activityPath = resolveActivityPath(badge, shift)
    if (!activityPath) return false

    const doc = await readActivityDocumentFromShare(badge, shift)
    if (!doc) return false

    const index = doc.activities.findIndex((a) => a.id === activityId)
    if (index === -1) return false

    const deletedEntry = doc.activities[index]

    doc.activities.splice(index, 1)
    doc.lastUpdated = new Date().toISOString()
    doc.stats = {
        totalActions: doc.activities.length,
        actionsToday: doc.activities.filter(
            (a) => new Date(a.timestamp).toDateString() === new Date().toDateString(),
        ).length,
        lastActionTime: doc.activities[0]?.timestamp ?? null,
    }

    try {
        fs.writeFileSync(activityPath, JSON.stringify(doc, null, 2) + '\n', 'utf-8')
        if (deletedEntry.projectId) {
            upsertProjectIndexForDelete(badge, shift, deletedEntry.projectId, deletedEntry.id)
        }
        await appendActivityEventToShare(badge, shift, 'ENTRY_DELETED', {
            activityId: deletedEntry.id,
            projectId: deletedEntry.projectId,
            data: {
                action: deletedEntry.action,
            },
        })
        return true
    } catch {
        return false
    }
}
