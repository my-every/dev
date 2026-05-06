import fs from 'node:fs'
import path from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import { getUserDefaultTitleForRole } from '@/lib/users/display'

function normalizeShiftDir(shift: string): string | null {
    const raw = shift.trim().toLowerCase()
    if (raw === '1st' || raw === 'first' || raw === '1' || raw === '1st-shift') return '1st-shift'
    if (raw === '2nd' || raw === 'second' || raw === '2' || raw === '2nd-shift') return '2nd-shift'
    return null
}

export async function GET(request: NextRequest) {
    const shift = request.nextUrl.searchParams.get('shift')
    const roleFilter = request.nextUrl.searchParams.get('role')
    const lwcFilter = request.nextUrl.searchParams.get('lwc')
    const skillFilter = request.nextUrl.searchParams.get('skill')
    const minSkillLevel = Number(request.nextUrl.searchParams.get('minSkillLevel') || '0')

    if (!shift) {
        return NextResponse.json({ error: 'Missing shift parameter' }, { status: 400 })
    }

    const shiftDir = normalizeShiftDir(shift)

    if (!shiftDir) {
        return NextResponse.json({ error: 'Invalid shift value' }, { status: 400 })
    }

    const shareRoot = await resolveShareDirectory()
    const usersDir = path.join(shareRoot, 'users')
    const shiftPath = path.join(usersDir, shiftDir)

    if (!fs.existsSync(shiftPath)) {
        return NextResponse.json({ shift: shiftDir, members: [] })
    }

    try {
        const badgeDirs = fs.readdirSync(shiftPath, { withFileTypes: true })
            .filter((d) => d.isDirectory())
            .map((d) => d.name)

        const members: Record<string, unknown>[] = []

        for (const badge of badgeDirs) {
            const profilePath = path.join(shiftPath, badge, 'profile.json')

            if (!fs.existsSync(profilePath)) continue

            try {
                const raw = fs.readFileSync(profilePath, 'utf-8')
                const parsed = JSON.parse(raw)
                // Strip large binary fields to keep response lean
                const { avatarPath: _a, coverImagePath: _c, preferences: _p, ...profile } = parsed

                members.push({
                    badge: profile.badge ?? badge,
                    fullName: profile.fullName ?? '',
                    preferredName: profile.preferredName ?? null,
                    initials: profile.initials ?? null,
                    role: profile.role ?? '',
                    shift: profile.shift ?? shiftDir.replace('-shift', ''),
                    primaryLwc: profile.primaryLwc ?? null,
                    email: profile.email ?? null,
                    phone: profile.phone ?? null,
                    bio: profile.bio ?? null,
                    department: profile.department ?? null,
                    title: profile.title?.trim() ? profile.title : getUserDefaultTitleForRole(profile.role),
                    location: profile.location ?? null,
                    hireDate: profile.hireDate ?? null,
                    yearsExperience: profile.yearsExperience ?? null,
                    skills: profile.skills ?? null,
                    lastLoginAt: profile.lastLoginAt ?? null,
                    createdAt: profile.createdAt ?? null,
                    updatedAt: profile.updatedAt ?? null,
                })
            } catch {
                // skip invalid profile
            }
        }

        // Sort alphabetically by full name
        members.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName)))

        // Apply optional filters
        let filtered = members

        if (roleFilter) {
            filtered = filtered.filter((m) => String(m.role).toLowerCase() === roleFilter.toLowerCase())
        }

        if (lwcFilter) {
            filtered = filtered.filter((m) => String(m.primaryLwc).toUpperCase() === lwcFilter.toUpperCase())
        }

        if (skillFilter) {
            filtered = filtered.filter((m) => {
                const skills = m.skills as Record<string, number> | null
                if (!skills) return false
                const level = skills[skillFilter] ?? 0
                return level >= (minSkillLevel || 1)
            })
        }

        return NextResponse.json({ shift: shiftDir, members: filtered })
    } catch {
        return NextResponse.json({ error: 'Failed to scan user directories' }, { status: 500 })
    }
}
