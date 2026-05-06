#!/usr/bin/env node

const fs = require('node:fs') as typeof import('node:fs')
const path = require('node:path') as typeof import('node:path')

function getArgValue(flag: string): string | undefined {
    const index = process.argv.findIndex((arg) => arg === flag)
    if (index === -1) return undefined
    const value = process.argv[index + 1]
    if (!value || value.startsWith('--')) return undefined
    return value
}

function normalizeShiftDir(shift: string): '1st-shift' | '2nd-shift' | null {
    const raw = shift.trim().toLowerCase()
    if (raw === '1st' || raw === 'first' || raw === '1' || raw === '1st-shift') return '1st-shift'
    if (raw === '2nd' || raw === 'second' || raw === '2' || raw === '2nd-shift') return '2nd-shift'
    return null
}

function resolveShareDirectory(): string {
    const fromEnv = process.env.SHARE_DIR?.trim()
    if (fromEnv && path.isAbsolute(fromEnv)) {
        return path.normalize(fromEnv)
    }

    const runtimeSettingsPath = path.join(process.cwd(), 'cache', 'runtime-settings.json')
    if (fs.existsSync(runtimeSettingsPath)) {
        try {
            const raw = fs.readFileSync(runtimeSettingsPath, 'utf-8')
            const parsed = JSON.parse(raw) as { shareDirectory?: string | null }
            if (parsed.shareDirectory && path.isAbsolute(parsed.shareDirectory)) {
                return path.normalize(parsed.shareDirectory)
            }
        } catch {
            // Fallback handled below.
        }
    }

    return path.join(process.cwd(), 'Share')
}

type Report = {
    scannedUsers: number
    scannedActivities: number
    indexFilesWritten: number
    usersWithNoActivityFile: number
    usersWithNoProjectActivities: number
    errors: Array<{ badge: string; shift: string; message: string }>
}

function backfillForUser(shareDir: string, shiftDir: '1st-shift' | '2nd-shift', badge: string): {
    scannedActivities: number
    indexFilesWritten: number
    noActivityFile: boolean
    noProjectActivities: boolean
} {
    const userDir = path.join(shareDir, 'users', shiftDir, badge)
    const activityPath = path.join(userDir, 'activity.json')

    if (!fs.existsSync(activityPath)) {
        return {
            scannedActivities: 0,
            indexFilesWritten: 0,
            noActivityFile: true,
            noProjectActivities: false,
        }
    }

    const raw = fs.readFileSync(activityPath, 'utf-8')
    const doc = JSON.parse(raw) as { activities?: Array<{ id: string; projectId?: string }> }
    const activities = Array.isArray(doc.activities) ? doc.activities : []

    const projectMap = new Map<string, string[]>()
    for (const entry of activities) {
        if (!entry?.projectId || !entry?.id) continue
        const ids = projectMap.get(entry.projectId) ?? []
        ids.push(entry.id)
        projectMap.set(entry.projectId, ids)
    }

    if (projectMap.size === 0) {
        return {
            scannedActivities: activities.length,
            indexFilesWritten: 0,
            noActivityFile: false,
            noProjectActivities: true,
        }
    }

    const indexDir = path.join(userDir, 'activity-index', 'projects')
    fs.mkdirSync(indexDir, { recursive: true })

    let indexFilesWritten = 0
    for (const [projectId, activityIds] of projectMap.entries()) {
        const indexPath = path.join(indexDir, `${encodeURIComponent(projectId)}.json`)
        const payload = {
            projectId,
            badge,
            shift: shiftDir === '1st-shift' ? '1st' : '2nd',
            lastUpdated: new Date().toISOString(),
            activityIds,
        }
        fs.writeFileSync(indexPath, JSON.stringify(payload, null, 2) + '\n', 'utf-8')
        indexFilesWritten += 1
    }

    return {
        scannedActivities: activities.length,
        indexFilesWritten,
        noActivityFile: false,
        noProjectActivities: false,
    }
}

async function main() {
    const badge = getArgValue('--badge')
    const shiftArg = getArgValue('--shift')
    const shiftDir = shiftArg ? normalizeShiftDir(shiftArg) : null
    const shareDir = resolveShareDirectory()

    const shifts: Array<'1st-shift' | '2nd-shift'> = shiftDir ? [shiftDir] : ['1st-shift', '2nd-shift']

    const report: Report = {
        scannedUsers: 0,
        scannedActivities: 0,
        indexFilesWritten: 0,
        usersWithNoActivityFile: 0,
        usersWithNoProjectActivities: 0,
        errors: [],
    }

    for (const currentShift of shifts) {
        const shiftUsersDir = path.join(shareDir, 'users', currentShift)
        const badges = badge
            ? [badge]
            : (fs.existsSync(shiftUsersDir)
                ? fs.readdirSync(shiftUsersDir, { withFileTypes: true })
                    .filter((entry) => entry.isDirectory())
                    .map((entry) => entry.name)
                    .filter((name) => /^\d+$/.test(name))
                : [])

        for (const currentBadge of badges) {
            report.scannedUsers += 1
            try {
                const result = backfillForUser(shareDir, currentShift, currentBadge)
                report.scannedActivities += result.scannedActivities
                report.indexFilesWritten += result.indexFilesWritten
                if (result.noActivityFile) report.usersWithNoActivityFile += 1
                if (result.noProjectActivities) report.usersWithNoProjectActivities += 1
            } catch (error) {
                report.errors.push({
                    badge: currentBadge,
                    shift: currentShift === '1st-shift' ? '1st' : '2nd',
                    message: error instanceof Error ? error.message : 'Unknown backfill error',
                })
            }
        }
    }

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)

    if (report.errors.length > 0) {
        process.exitCode = 1
    }
}

main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exit(1)
})
