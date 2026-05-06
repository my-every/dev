import fs from 'node:fs'
import path from 'node:path'
import { resolveShareDirectorySync } from '@/lib/runtime/share-directory'

import type { UserSettings, RolePermission } from '@/types/user-settings'
import { createDefaultUserSettings, DEFAULT_GRANULAR_PERMISSIONS } from '@/types/user-settings'

const SHIFT_DIRS = ['1st-shift', '2nd-shift', '3rd-shift'] as const

function getUsersDir(): string {
    return path.join(resolveShareDirectorySync(), 'users')
}

type ShiftDir = (typeof SHIFT_DIRS)[number]

function normalizeShiftDir(shift: string): ShiftDir | null {
    const raw = shift.trim().toLowerCase()
    if (!raw) return null

    if (raw === '1st' || raw === 'first' || raw === '1' || raw === '1st-shift') return '1st-shift'
    if (raw === '2nd' || raw === 'second' || raw === '2' || raw === '2nd-shift') return '2nd-shift'
    if (raw === '3rd' || raw === 'third' || raw === '3' || raw === '3rd-shift') return '3rd-shift'

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

function resolveSettingsPath(badge: string, shift?: string): string | null {
    const shiftDir = shift ? normalizeShiftDir(shift) : resolveShiftDirForBadge(badge)
    if (!shiftDir) return null
    return path.join(getUsersDir(), shiftDir, badge, 'settings.json')
}

/**
 * Migrate old settings to include new fields
 */
function migrateSettings(stored: Partial<UserSettings>, badge: string, shift: string): UserSettings {
    return {
        badge: stored.badge ?? badge,
        shift: stored.shift ?? shift,
        lastUpdated: stored.lastUpdated ?? new Date().toISOString(),
        roles: stored.roles ?? [],
        dashboardAccess: {
            projectSchedule: stored.dashboardAccess?.projectSchedule ?? false,
            userAccess: stored.dashboardAccess?.userAccess ?? false,
            catalogAccess: stored.dashboardAccess?.catalogAccess ?? false,
        },
        // New fields with defaults
        permissions: stored.permissions ?? { ...DEFAULT_GRANULAR_PERMISSIONS },
        permissionGroupId: stored.permissionGroupId ?? null,
        permissionAudit: stored.permissionAudit ?? [],
    }
}

export async function readUserSettings(
    badge: string,
    shift?: string,
): Promise<UserSettings | null> {
    const settingsPath = resolveSettingsPath(badge, shift)
    if (!settingsPath || !fs.existsSync(settingsPath)) {
        return null
    }

    try {
        const raw = fs.readFileSync(settingsPath, 'utf-8')
        const stored = JSON.parse(raw) as Partial<UserSettings>
        // Migrate to include new fields
        const shiftDir = shift ? normalizeShiftDir(shift) : resolveShiftDirForBadge(badge)
        return migrateSettings(stored, badge, shiftDir ? toApiShift(shiftDir) : '1st')
    } catch {
        return null
    }
}

export async function upsertUserSettings(
    badge: string,
    shift: string,
): Promise<UserSettings> {
    const shiftDir = normalizeShiftDir(shift)
    if (!shiftDir) {
        throw new Error(`Invalid shift: ${shift}`)
    }

    const userDir = path.join(getUsersDir(), shiftDir, badge)
    const settingsPath = path.join(userDir, 'settings.json')

    fs.mkdirSync(userDir, { recursive: true })

    if (fs.existsSync(settingsPath)) {
        try {
            const raw = fs.readFileSync(settingsPath, 'utf-8')
            const stored = JSON.parse(raw) as Partial<UserSettings>
            // Migrate to include new fields
            return migrateSettings(stored, badge, toApiShift(shiftDir))
        } catch {
            // Corrupt file — recreate
        }
    }

    const defaults = createDefaultUserSettings(badge, toApiShift(shiftDir))
    fs.writeFileSync(settingsPath, JSON.stringify(defaults, null, 2) + '\n', 'utf-8')
    return defaults
}

export async function writeUserSettings(
    badge: string,
    shift: string,
    settings: UserSettings,
): Promise<UserSettings> {
    const shiftDir = normalizeShiftDir(shift)
    if (!shiftDir) {
        throw new Error(`Invalid shift: ${shift}`)
    }

    const userDir = path.join(getUsersDir(), shiftDir, badge)
    const settingsPath = path.join(userDir, 'settings.json')

    fs.mkdirSync(userDir, { recursive: true })

    settings.lastUpdated = new Date().toISOString()

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf-8')
    return settings
}

export async function updateRolePermission(
    badge: string,
    shift: string,
    role: string,
    enabled: boolean,
    grantedBy: string,
): Promise<UserSettings> {
    const settings = await upsertUserSettings(badge, shift)

    const existingIndex = settings.roles.findIndex((r) => r.role === role)
    const permission: RolePermission = {
        role,
        enabled,
        grantedBy,
        grantedAt: new Date().toISOString(),
    }

    if (existingIndex >= 0) {
        settings.roles[existingIndex] = permission
    } else {
        settings.roles.push(permission)
    }

    return writeUserSettings(badge, shift, settings)
}

export async function updateDashboardAccess(
    badge: string,
    shift: string,
    key: keyof UserSettings['dashboardAccess'],
    enabled: boolean,
): Promise<UserSettings> {
    const settings = await upsertUserSettings(badge, shift)
    settings.dashboardAccess[key] = enabled
    return writeUserSettings(badge, shift, settings)
}
