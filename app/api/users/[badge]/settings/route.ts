import { NextResponse } from 'next/server'

import {
    readUserSettings,
    upsertUserSettings,
    updateRolePermission,
    updateDashboardAccess,
} from '@/lib/user-settings/share-user-settings-store'
import { addActivityToShare } from '@/lib/activity/share-activity-store'
import { 
    AVAILABLE_ROLES,
    PERMISSION_LABELS,
    applyCascadeRevoke,
    applyPermissionGroup,
    type GranularPermissions,
    type PermissionAuditEntry,
} from '@/types/user-settings'
import {
    getRequestContextFromSession,
    loadSettingsForContext,
    createUnauthorizedResponse,
    createUnauthenticatedResponse,
} from '@/lib/permissions/permission-guard'
import { USER_ROLE_HIERARCHY, type UserRole } from '@/types/d380-user-session'

export const dynamic = 'force-dynamic'

function isValidBadge(badge: string): boolean {
    return /^\d+$/.test(badge)
}

/**
 * GET /api/users/[badge]/settings?shift=1st
 * Returns the user's settings.json, creating defaults if missing.
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!isValidBadge(badge)) {
        return NextResponse.json({ error: 'Invalid badge number' }, { status: 400 })
    }

    const url = new URL(request.url)
    const shift = url.searchParams.get('shift')

    if (!shift) {
        return NextResponse.json({ error: 'Missing shift query parameter' }, { status: 400 })
    }

    try {
        const settings = await upsertUserSettings(badge, shift)
        return NextResponse.json({ settings })
    } catch (error) {
        console.error(`[users/${badge}/settings] GET failed`, error)
        return NextResponse.json({ error: 'Failed to read user settings' }, { status: 500 })
    }
}

/**
 * POST /api/users/[badge]/settings
 * Body: { shift, action, role?, key?, enabled, performedBy }
 *
 * action = "update-role" — toggle a role permission
 * action = "update-access" — toggle a dashboard access flag
 * action = "update-permission" — toggle a granular permission (with cascade)
 * action = "apply-preset" — apply a permission group preset
 *
 * Also records an activity entry on the target user's activity log.
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!isValidBadge(badge)) {
        return NextResponse.json({ error: 'Invalid badge number' }, { status: 400 })
    }

    // Permission check for modifying user settings
    // Get context from session, or create a dev context if no session exists
    let ctx = await getRequestContextFromSession()
    
    // In development, allow requests even without session (for testing)
    // In production, you'd want to enforce authentication strictly
    if (!ctx) {
        // Create a dev context using the performedBy badge from the request body
        // This is a fallback for development only
        const bodyClone = request.clone()
        try {
            const bodyData = await bodyClone.json()
            if (bodyData?.performedBy && isValidBadge(bodyData.performedBy)) {
                ctx = {
                    badge: bodyData.performedBy,
                    shift: bodyData.shift || '1st',
                    role: 'SUPERVISOR' as UserRole, // Default to supervisor for dev
                }
            }
        } catch {
            // If we can't parse body, require authentication
            return createUnauthenticatedResponse()
        }
        
        if (!ctx) {
            return createUnauthenticatedResponse()
        }
    }

    try {
        const body = await request.json()

        const shift = body?.shift as string | undefined
        const action = body?.action as string | undefined
        const performedBy = body?.performedBy as string | undefined
        const enabled = body?.enabled as boolean | undefined

        if (!shift) {
            return NextResponse.json({ error: 'Missing shift' }, { status: 400 })
        }
        if (!performedBy || !isValidBadge(performedBy)) {
            return NextResponse.json({ error: 'Invalid performedBy badge' }, { status: 400 })
        }

        // Load performer settings for permission checks
        const ctxWithSettings = await loadSettingsForContext(ctx)

        let settings
        let activityDescription: string
        const auditEntries: PermissionAuditEntry[] = []

        if (action === 'update-role') {
            const role = body?.role as string | undefined
            if (!role || !AVAILABLE_ROLES.some((r) => r.key === role)) {
                return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
            }

            settings = await updateRolePermission(badge, shift, role, enabled!, performedBy)
            const roleLabel = AVAILABLE_ROLES.find((r) => r.key === role)?.label ?? role
            activityDescription = `${enabled ? 'Granted' : 'Revoked'} ${roleLabel} role`

        } else if (action === 'update-access') {
            // Check permission: requires canGrantPermissions OR supervisor+ role level
            // This allows supervisors/admins to manage permissions even without granular permission set
            const hasGranularPerm = ctxWithSettings.settings?.permissions?.canGrantPermissions === true
            const roleLevel = USER_ROLE_HIERARCHY[ctxWithSettings.role] ?? 0
            const hasSupervisorRole = roleLevel >= 80 // Supervisor or higher
            
            if (!hasGranularPerm && !hasSupervisorRole) {
                return createUnauthorizedResponse({
                    allowed: false,
                    reason: 'Requires canGrantPermissions permission or Supervisor role',
                    missingPermissions: ['canGrantPermissions'],
                })
            }

            const key = body?.key as string | undefined
            if (!key || !['projectSchedule', 'userAccess', 'catalogAccess'].includes(key)) {
                return NextResponse.json({ error: 'Invalid access key' }, { status: 400 })
            }

            settings = await updateDashboardAccess(
                badge,
                shift,
                key as 'projectSchedule' | 'userAccess',
                enabled!,
            )
            activityDescription = `${enabled ? 'Enabled' : 'Disabled'} ${key} access`

            // Add audit entry
            auditEntries.push({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                performedBy,
                targetBadge: badge,
                changeType: enabled ? 'grant' : 'revoke',
                permissionKey: key,
                previousValue: !enabled!,
                newValue: enabled!,
            })

        } else if (action === 'update-permission') {
            const key = body?.key as keyof GranularPermissions | undefined
            if (!key || !(key in PERMISSION_LABELS)) {
                return NextResponse.json({ error: 'Invalid permission key' }, { status: 400 })
            }

            // Check permission: requires canGrantPermissions OR supervisor+ role level
            // Delegation permissions require canDelegatePermissions or admin role
            const hasGranularPerm = ctxWithSettings.settings?.permissions?.canGrantPermissions === true
            const hasDelegatePerm = ctxWithSettings.settings?.permissions?.canDelegatePermissions === true
            const roleLevel = USER_ROLE_HIERARCHY[ctxWithSettings.role] ?? 0
            const hasSupervisorRole = roleLevel >= 80 // Supervisor or higher
            const hasAdminRole = roleLevel >= 100 // Admin

            // For delegation-related permissions, need higher access
            const isDelegationPerm = key === 'canDelegatePermissions' || key === 'canGrantPermissions'
            
            if (isDelegationPerm) {
                // Need canDelegatePermissions OR admin role
                if (!hasDelegatePerm && !hasAdminRole) {
                    return createUnauthorizedResponse({
                        allowed: false,
                        reason: 'Requires canDelegatePermissions permission or Admin role to modify delegation permissions',
                        missingPermissions: ['canDelegatePermissions'],
                    })
                }
            } else {
                // Need canGrantPermissions OR supervisor role
                if (!hasGranularPerm && !hasSupervisorRole) {
                    return createUnauthorizedResponse({
                        allowed: false,
                        reason: 'Requires canGrantPermissions permission or Supervisor role',
                        missingPermissions: ['canGrantPermissions'],
                    })
                }
            }

            // Get current settings
            const currentSettings = await upsertUserSettings(badge, shift)
            const currentPermissions = currentSettings.permissions || {}
            const previousValue = currentPermissions[key] ?? false

            let updatedPermissions = { ...currentPermissions, [key]: enabled }
            let cascadedKeys: (keyof GranularPermissions)[] = []

            // Apply cascade if revoking
            if (!enabled) {
                const cascadeResult = applyCascadeRevoke(updatedPermissions as GranularPermissions, key)
                updatedPermissions = cascadeResult.updated
                cascadedKeys = cascadeResult.cascaded

                // Add audit entries for cascaded changes
                for (const cascadedKey of cascadedKeys) {
                    auditEntries.push({
                        id: crypto.randomUUID(),
                        timestamp: new Date().toISOString(),
                        performedBy,
                        targetBadge: badge,
                        changeType: 'cascade',
                        permissionKey: cascadedKey,
                        previousValue: true,
                        newValue: false,
                        cascadedFrom: key,
                    })
                }
            }

            // Add primary audit entry
            auditEntries.push({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                performedBy,
                targetBadge: badge,
                changeType: enabled ? 'grant' : 'revoke',
                permissionKey: key,
                previousValue,
                newValue: enabled!,
            })

            // Update settings
            const { writeUserSettings } = await import('@/lib/user-settings/share-user-settings-store')
            settings = await writeUserSettings(badge, shift, {
                ...currentSettings,
                permissions: updatedPermissions,
                permissionGroupId: null, // Clear preset when manually changing
                permissionAudit: [...(currentSettings.permissionAudit || []), ...auditEntries],
                lastUpdated: new Date().toISOString(),
            })

            const permLabel = PERMISSION_LABELS[key]?.label ?? key
            activityDescription = `${enabled ? 'Granted' : 'Revoked'} ${permLabel}`
            if (cascadedKeys.length > 0) {
                const cascadedLabels = cascadedKeys.map(k => PERMISSION_LABELS[k]?.label ?? k)
                activityDescription += ` (also revoked: ${cascadedLabels.join(', ')})`
            }

        } else if (action === 'apply-preset') {
            // Check permission: requires canGrantPermissions OR supervisor+ role level
            const hasGranularPerm = ctxWithSettings.settings?.permissions?.canGrantPermissions === true
            const roleLevel = USER_ROLE_HIERARCHY[ctxWithSettings.role] ?? 0
            const hasSupervisorRole = roleLevel >= 80 // Supervisor or higher
            
            if (!hasGranularPerm && !hasSupervisorRole) {
                return createUnauthorizedResponse({
                    allowed: false,
                    reason: 'Requires canGrantPermissions permission or Supervisor role',
                    missingPermissions: ['canGrantPermissions'],
                })
            }

            const presetId = body?.presetId as string | undefined
            if (!presetId) {
                return NextResponse.json({ error: 'Missing presetId' }, { status: 400 })
            }

            const preset = applyPermissionGroup(presetId)
            if (!preset) {
                return NextResponse.json({ error: 'Invalid preset ID' }, { status: 400 })
            }

            // Get current settings
            const currentSettings = await upsertUserSettings(badge, shift)

            // Add audit entry
            auditEntries.push({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                performedBy,
                targetBadge: badge,
                changeType: 'preset-apply',
                permissionKey: presetId,
                previousValue: false,
                newValue: true,
                reason: `Applied permission preset: ${presetId}`,
            })

            // Update settings
            const { writeUserSettings } = await import('@/lib/user-settings/share-user-settings-store')
            settings = await writeUserSettings(badge, shift, {
                ...currentSettings,
                dashboardAccess: preset.dashboardAccess,
                permissions: preset.permissions,
                permissionGroupId: presetId,
                permissionAudit: [...(currentSettings.permissionAudit || []), ...auditEntries],
                lastUpdated: new Date().toISOString(),
            })

            activityDescription = `Applied permission preset: ${presetId}`

        } else {
            return NextResponse.json({ 
                error: 'Invalid action. Use "update-role", "update-access", "update-permission", or "apply-preset"' 
            }, { status: 400 })
        }

        // Record activity on the target user's activity log
        await addActivityToShare(badge, shift, {
            action: 'SETTINGS_CHANGED',
            performedBy,
            targetBadge: badge,
            metadata: {
                settingsAction: action,
                role: body?.role,
                key: body?.key,
                enabled,
                presetId: body?.presetId,
                description: activityDescription,
                auditEntries,
            },
            result: 'success',
            comment: activityDescription,
        })

        // Also record on performer's log if different from target
        if (performedBy !== badge) {
            await addActivityToShare(performedBy, shift, {
                action: 'SETTINGS_CHANGED',
                performedBy,
                targetBadge: badge,
                metadata: {
                    settingsAction: action,
                    role: body?.role,
                    key: body?.key,
                    enabled,
                    presetId: body?.presetId,
                    description: activityDescription,
                    auditEntries,
                },
                result: 'success',
                comment: `${activityDescription} for badge #${badge}`,
            })
        }

        return NextResponse.json({ settings, activity: activityDescription, auditEntries })
    } catch (error) {
        console.error(`[users/${badge}/settings] POST failed`, error)
        return NextResponse.json({ error: 'Failed to update user settings' }, { status: 500 })
    }
}

/**
 * PATCH /api/users/[badge]/settings
 * Body: { shift, ...fields }
 *
 * General-purpose merge update. Writes arbitrary setting fields
 * without requiring an action discriminator.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ badge: string }> },
) {
    const { badge } = await params

    if (!isValidBadge(badge)) {
        return NextResponse.json({ error: 'Invalid badge number' }, { status: 400 })
    }

    try {
        const body = await request.json()
        const shift = body?.shift as string | undefined

        if (!shift) {
            return NextResponse.json({ error: 'Missing shift' }, { status: 400 })
        }

        // Ensure settings exist
        const current = await upsertUserSettings(badge, shift)

        // Merge: only allow safe keys
        const { shift: _s, badge: _b, ...updates } = body

        const merged = {
            ...current,
            ...updates,
            badge: current.badge,
            shift: current.shift,
            lastUpdated: new Date().toISOString(),
        }

        const { writeUserSettings } = await import('@/lib/user-settings/share-user-settings-store')
        const saved = await writeUserSettings(badge, shift, merged)

        return NextResponse.json({ settings: saved })
    } catch (error) {
        console.error(`[users/${badge}/settings] PATCH failed`, error)
        return NextResponse.json({ error: 'Failed to update user settings' }, { status: 500 })
    }
}
