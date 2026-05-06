import { NextResponse } from 'next/server'
import {
    appendActivityEventToShare,
    readActivityDocumentFromShare,
    upsertActivityDocumentInShare,
} from '@/lib/activity/share-activity-store'
import path from 'path'
import fs from 'fs/promises'
import type { ActivityEntry } from '@/types/activity'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'

interface RouteParams {
    params: Promise<{
        badge: string
    }>
}

async function resolveActivityPath(badge: string, shift: string): Promise<string> {
    const shiftMap: Record<string, string> = {
        '1st': '1st-shift',
        '2nd': '2nd-shift',
     
    }
    const shiftDir = shiftMap[shift] || '1st-shift'
    const shareRoot = await resolveShareDirectory()
    return path.join(shareRoot, 'users', shiftDir, badge, 'activity.json')
}

/**
 * GET /api/activity/[badge]/details?activityId=X&relatedIds=true
 * Fetch activity details with related activities and comments
 */
export async function GET(request: Request, { params }: RouteParams) {
    try {
        const { badge } = await params
        const url = new URL(request.url)
        const activityId = url.searchParams.get('activityId')
        const shift = url.searchParams.get('shift') || '1st'
        const includeRelated = url.searchParams.get('relatedIds') === 'true'

        if (!activityId) {
            return NextResponse.json({ error: 'activityId required' }, { status: 400 })
        }

        // Read activity document
        const doc = await readActivityDocumentFromShare(badge, shift)
        if (!doc || doc.activities.length === 0) {
            return NextResponse.json({ error: 'No activities found' }, { status: 404 })
        }

        // Find the activity
        const activity = doc.activities.find(a => a.id === activityId)
        if (!activity) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
        }

        // Build response with related activities if requested
        let relatedActivities: ActivityEntry[] = []
        if (includeRelated && activity.relatedActivityIds && activity.relatedActivityIds.length > 0) {
            relatedActivities = doc.activities.filter(a =>
                activity.relatedActivityIds?.includes(a.id)
            )
        }

        return NextResponse.json({
            activity,
            relatedActivities,
            totalRelated: activity.relatedActivityIds?.length || 0,
        })
    } catch (error) {
        console.error('[activity/details] GET failed', error)
        return NextResponse.json({ error: 'Failed to fetch activity details' }, { status: 500 })
    }
}

/**
 * POST /api/activity/[badge]/details
 * Add a comment to an activity
 */
export async function POST(request: Request, { params }: RouteParams) {
    try {
        const { badge } = await params
        const body = await request.json()

        const { activityId, shift, comment, author } = body

        if (!activityId || !comment || !author) {
            return NextResponse.json(
                { error: 'activityId, comment, and author are required' },
                { status: 400 }
            )
        }

        // Ensure activity document exists
        const doc = await upsertActivityDocumentInShare(badge, shift || '1st')
        if (!doc) {
            return NextResponse.json({ error: 'Failed to access activity file' }, { status: 500 })
        }

        // Find the activity
        const activityIndex = doc.activities.findIndex(a => a.id === activityId)
        if (activityIndex === -1) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
        }

        const activity = doc.activities[activityIndex]

        // Ensure comments array exists
        if (!activity.comments) {
            activity.comments = []
        }

        // Add new comment
        const newComment = {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            text: comment.trim(),
            author,
            timestamp: new Date().toISOString(),
        }

        activity.comments.push(newComment)
        doc.activities[activityIndex] = activity

        // Write back to file
        const activityPath = await resolveActivityPath(badge, shift || '1st')
        doc.lastUpdated = new Date().toISOString()
        await fs.writeFile(activityPath, JSON.stringify(doc, null, 2) + '\n', 'utf-8')
        await appendActivityEventToShare(badge, shift || '1st', 'THREAD_COMMENT_ADDED', {
            activityId,
            projectId: activity.projectId,
            data: {
                commentId: newComment.id,
                author,
            },
        })

        return NextResponse.json({
            activity,
            comment: newComment,
        })
    } catch (error) {
        console.error('[activity/details] POST failed', error)
        return NextResponse.json({ error: 'Failed to add comment' }, { status: 500 })
    }
}

/**
 * PATCH /api/activity/[badge]/details
 * Add related activity IDs to an activity (link sub-processes)
 */
export async function PATCH(request: Request, { params }: RouteParams) {
    try {
        const { badge } = await params
        const body = await request.json()

        const { activityId, shift, relatedActivityIds } = body

        if (!activityId || !Array.isArray(relatedActivityIds)) {
            return NextResponse.json(
                { error: 'activityId and relatedActivityIds array are required' },
                { status: 400 }
            )
        }

        // Ensure activity document exists
        const doc = await upsertActivityDocumentInShare(badge, shift || '1st')
        if (!doc) {
            return NextResponse.json({ error: 'Failed to access activity file' }, { status: 500 })
        }

        // Find the activity
        const activityIndex = doc.activities.findIndex(a => a.id === activityId)
        if (activityIndex === -1) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
        }

        const activity = doc.activities[activityIndex]
        activity.relatedActivityIds = relatedActivityIds

        doc.activities[activityIndex] = activity

        // Write back to file
        const activityPath = await resolveActivityPath(badge, shift || '1st')
        doc.lastUpdated = new Date().toISOString()
        await fs.writeFile(activityPath, JSON.stringify(doc, null, 2) + '\n', 'utf-8')
        await appendActivityEventToShare(badge, shift || '1st', 'RELATED_IDS_UPDATED', {
            activityId,
            projectId: activity.projectId,
            data: {
                relatedActivityIds,
            },
        })

        return NextResponse.json({ activity })
    } catch (error) {
        console.error('[activity/details] PATCH failed', error)
        return NextResponse.json({ error: 'Failed to update activity' }, { status: 500 })
    }
}

/**
 * DELETE /api/activity/[badge]/details
 * Delete a threaded comment from an activity (author only)
 */
export async function DELETE(request: Request, { params }: RouteParams) {
    try {
        const { badge } = await params
        const body = await request.json()

        const { activityId, shift, commentId, requester } = body

        if (!activityId || !commentId || !requester) {
            return NextResponse.json(
                { error: 'activityId, commentId, and requester are required' },
                { status: 400 }
            )
        }

        const doc = await upsertActivityDocumentInShare(badge, shift || '1st')
        if (!doc) {
            return NextResponse.json({ error: 'Failed to access activity file' }, { status: 500 })
        }

        const activityIndex = doc.activities.findIndex(a => a.id === activityId)
        if (activityIndex === -1) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 })
        }

        const activity = doc.activities[activityIndex]
        const comments = activity.comments ?? []
        const commentIndex = comments.findIndex(c => c.id === commentId)
        const deletedComment = commentIndex >= 0 ? comments[commentIndex] : null

        if (commentIndex === -1) {
            return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
        }

        if (comments[commentIndex].author !== requester) {
            return NextResponse.json({ error: 'Forbidden: can only delete your own comments' }, { status: 403 })
        }

        comments.splice(commentIndex, 1)
        activity.comments = comments
        doc.activities[activityIndex] = activity

        const activityPath = await resolveActivityPath(badge, shift || '1st')
        doc.lastUpdated = new Date().toISOString()
        await fs.writeFile(activityPath, JSON.stringify(doc, null, 2) + '\n', 'utf-8')
        await appendActivityEventToShare(badge, shift || '1st', 'THREAD_COMMENT_DELETED', {
            activityId,
            projectId: activity.projectId,
            data: {
                commentId,
                author: deletedComment?.author,
            },
        })

        return NextResponse.json({ activity, deletedCommentId: commentId })
    } catch (error) {
        console.error('[activity/details] DELETE failed', error)
        return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 })
    }
}
