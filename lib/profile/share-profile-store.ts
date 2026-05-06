/**
 * share-profile-store.ts
 *
 * File-system helpers for reading/writing per-user profile.json files
 * from the Share/users/<shift>/<badge>/ directory structure.
 *
 * This is the server-side entry point for all profile mutations.
 */

import fs from 'node:fs'
import path from 'node:path'
import { resolveShareDirectorySync } from '@/lib/runtime/share-directory'
import { getUserDefaultTitleForRole } from '@/lib/users/display'
import {
    createDefaultCompetencyProfile,
    normalizeCompetencyProfile,
    type UserCompetencyProfile,
} from '@/lib/users/competency'
import type { UserAssignmentCompetencyLedger } from '@/lib/board/skill-ledger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShareUserProfile {
    badge: string
    fullName: string
    preferredName: string | null
    initials: string | null
    role: string
    shift: string
    primaryLwc: string
    email: string | null
    phone: string | null
    avatarPath: string | null
    coverImagePath: string | null
    coverImagePositionY: number
    bio: string | null
    department: string | null
    title: string | null
    location: string | null
    hireDate: string | null
    yearsExperience: number
    skills: Record<string, number>
    competencyProfile?: UserCompetencyProfile
    activeAssignments?: Array<Record<string, unknown>>
    assignmentCompetency?: UserAssignmentCompetencyLedger | null
    boardAvailability?: {
        status: 'OFF_SHIFT' | 'AVAILABLE' | 'ON_ASSIGNMENT'
        shiftId: '1st' | '2nd' | null
        updatedAt: string
        clockedInAt?: string | null
        clockedOutAt?: string | null
        activeAssignmentId?: string | null
    } | null
    preferences: ShareUserPreferences
    lastLoginAt: string | null
    createdAt: string
    updatedAt: string
}

export interface ShareUserPreferences {
    theme: 'light' | 'dark' | 'system'
    notifications: {
        stageComplete: boolean
        assignmentBlocked: boolean
        handoffRequired: boolean
        shiftReminders: boolean
    }
    dashboardLayout: 'compact' | 'expanded'
    defaultViews: {
        projectBoard: 'list' | 'kanban' | 'grid'
        workAreaBoard: 'floor' | 'list'
    }
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const SHIFT_DIRS = ['1st-shift', '2nd-shift', '3rd-shift'] as const

function getUsersDir(): string {
    return path.join(resolveShareDirectorySync(), 'users')
}

/**
 * Resolve the profile.json path for a badge by checking all shift directories.
 * Returns null if no profile directory exists for this badge.
 */
export function resolveProfilePath(badge: string): string | null {
    const usersDir = getUsersDir()
    for (const shift of SHIFT_DIRS) {
        const candidate = path.join(usersDir, shift, badge, 'profile.json')
        if (fs.existsSync(candidate)) {
            return candidate
        }
    }
    return null
}

/**
 * Get the shift directory name for a badge (e.g. '1st-shift').
 */
export function resolveShiftDir(badge: string): string | null {
    const usersDir = getUsersDir()
    for (const shift of SHIFT_DIRS) {
        const candidate = path.join(usersDir, shift, badge)
        if (fs.existsSync(candidate)) {
            return shift
        }
    }
    return null
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function readProfileFromShare(badge: string): Promise<ShareUserProfile | null> {
    const profilePath = resolveProfilePath(badge)
    if (!profilePath) return null

    try {
        const raw = fs.readFileSync(profilePath, 'utf-8')
        const profile = JSON.parse(raw) as ShareUserProfile
        return {
            ...profile,
            title: profile.title?.trim() ? profile.title : getUserDefaultTitleForRole(profile.role),
            competencyProfile: normalizeCompetencyProfile(
                profile.competencyProfile,
                profile.assignmentCompetency,
            ),
        }
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export async function writeProfileToShare(
    badge: string,
    updates: Partial<ShareUserProfile>,
): Promise<ShareUserProfile | null> {
    const profilePath = resolveProfilePath(badge)
    if (!profilePath) return null

    try {
        const raw = fs.readFileSync(profilePath, 'utf-8')
        const current = JSON.parse(raw) as ShareUserProfile

        // Merge updates (shallow for top-level, deep for preferences)
        const merged: ShareUserProfile = {
            ...current,
            ...updates,
            // Deep-merge preferences if provided
            preferences: updates.preferences
                ? {
                    ...current.preferences,
                    ...updates.preferences,
                    notifications: {
                        ...current.preferences.notifications,
                        ...(updates.preferences.notifications ?? {}),
                    },
                    defaultViews: {
                        ...current.preferences.defaultViews,
                        ...(updates.preferences.defaultViews ?? {}),
                    },
                }
                : current.preferences,
            // Always refresh updatedAt
            updatedAt: new Date().toISOString(),
            // Never allow badge to be changed
            badge: current.badge,
        }

        merged.title = merged.title?.trim() ? merged.title : getUserDefaultTitleForRole(merged.role)
        merged.competencyProfile = normalizeCompetencyProfile(
            updates.competencyProfile ?? current.competencyProfile,
            updates.assignmentCompetency ?? current.assignmentCompetency,
        )

        fs.writeFileSync(profilePath, JSON.stringify(merged, null, 2) + '\n', 'utf-8')
        return merged
    } catch {
        return null
    }
}

// ---------------------------------------------------------------------------
// Record login
// ---------------------------------------------------------------------------

export async function recordLoginInProfile(badge: string): Promise<void> {
    const profilePath = resolveProfilePath(badge)
    if (!profilePath) return

    try {
        const raw = fs.readFileSync(profilePath, 'utf-8')
        const profile = JSON.parse(raw) as ShareUserProfile
        profile.lastLoginAt = new Date().toISOString()
        profile.updatedAt = new Date().toISOString()
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n', 'utf-8')
    } catch {
        // Silent — profile not critical to login flow
    }
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Create a new profile.json for a badge in the given shift directory.
 * Returns null if the profile already exists.
 */
export async function createProfileInShare(
    badge: string,
    shift: string,
    data: Partial<ShareUserProfile>,
): Promise<ShareUserProfile | null> {
    // Don't overwrite existing profiles
    if (resolveProfilePath(badge)) return null

    const shiftMap: Record<string, string> = {
        '1st': '1st-shift',
        '2nd': '2nd-shift',
        '3rd': '3rd-shift',
        '1st-shift': '1st-shift',
        '2nd-shift': '2nd-shift',
        '3rd-shift': '3rd-shift',
    }
    const shiftDir = shiftMap[shift]
    if (!shiftDir) return null

    const userDir = path.join(getUsersDir(), shiftDir, badge)
    const profilePath = path.join(userDir, 'profile.json')

    const now = new Date().toISOString()
    const profile: ShareUserProfile = {
        badge,
        fullName: data.fullName ?? '',
        preferredName: data.preferredName ?? null,
        initials: data.initials ?? null,
        role: data.role ?? 'assembler',
        shift: shift.replace('-shift', ''),
        primaryLwc: data.primaryLwc ?? 'NEW_FLEX',
        email: data.email ?? null,
        phone: data.phone ?? null,
        avatarPath: data.avatarPath ?? null,
        coverImagePath: data.coverImagePath ?? null,
        coverImagePositionY: data.coverImagePositionY ?? 50,
        bio: data.bio ?? null,
        department: data.department ?? null,
        title: data.title ?? null,
        location: data.location ?? null,
        hireDate: data.hireDate ?? null,
        yearsExperience: data.yearsExperience ?? 0,
        competencyProfile: data.competencyProfile ?? createDefaultCompetencyProfile(),
        skills: data.skills ?? {},
        preferences: {
            theme: 'system',
            notifications: {
                stageComplete: true,
                assignmentBlocked: true,
                handoffRequired: true,
                shiftReminders: true,
            },
            dashboardLayout: 'compact',
            defaultViews: {
                projectBoard: 'kanban',
                workAreaBoard: 'floor',
            },
            ...(data.preferences ?? {}),
        },
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
    }

    profile.title = profile.title?.trim() ? profile.title : getUserDefaultTitleForRole(profile.role)
    profile.competencyProfile = normalizeCompetencyProfile(
        profile.competencyProfile,
        profile.assignmentCompetency,
    )

    fs.mkdirSync(userDir, { recursive: true })
    fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2) + '\n', 'utf-8')
    return profile
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

/**
 * Delete a user's profile.json. Returns true if deleted, false if not found.
 */
export async function deleteProfileFromShare(badge: string): Promise<boolean> {
    const profilePath = resolveProfilePath(badge)
    if (!profilePath) return false

    try {
        fs.unlinkSync(profilePath)
        return true
    } catch {
        return false
    }
}
