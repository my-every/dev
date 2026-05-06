import type {
    CompletedProjectRecord,
    CompletedProjectCardViewModel,
    CompletedArchiveViewModel,
} from '@/types/d380-completed-archive'

const dateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
})

const shortDateFormatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
})

function formatHours(hours: number): string {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    return `${hours.toFixed(1)}h`
}

function daysAgo(dateStr: string): string {
    const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    return `${days} days ago`
}

function toCardViewModel(record: CompletedProjectRecord): CompletedProjectCardViewModel {
    const variance = record.totalHoursEstimated > 0
        ? Math.round(((record.totalHoursActual - record.totalHoursEstimated) / record.totalHoursEstimated) * 100)
        : 0

    return {
        id: record.id,
        pdNumber: record.pdNumber,
        projectName: record.projectName,
        unitNumber: record.unitNumber,
        lwcType: record.lwcType,
        completedAtLabel: dateFormatter.format(new Date(record.completedAt)),
        daysAgoLabel: daysAgo(record.completedAt),
        totalAssignments: record.totalAssignments,
        totalWires: record.totalWires,
        actualHoursLabel: formatHours(record.totalHoursActual),
        estimatedHoursLabel: formatHours(record.totalHoursEstimated),
        variancePercent: variance,
        sheets: record.sheetSummaries,
        exportFileCount: record.exportFiles.length,
    }
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_COMPLETED: CompletedProjectRecord[] = [
    {
        id: 'completed-1',
        pdNumber: '4M291',
        projectName: 'APEX UNIT 3',
        unitNumber: '3',
        lwcType: 'ONSKID',
        completedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        completedByBadge: '75241',
        totalAssignments: 6,
        totalWires: 1842,
        totalHoursActual: 48.5,
        totalHoursEstimated: 52.0,
        sheetSummaries: [
            { sheetSlug: 'main-panel', sheetName: 'MAIN PANEL', wireCount: 520, actualMinutes: 780, estimatedMinutes: 840, workersInvolved: 3, completedAt: new Date(Date.now() - 4 * 86_400_000).toISOString() },
            { sheetSlug: 'aux-panel', sheetName: 'AUX PANEL', wireCount: 343, actualMinutes: 490, estimatedMinutes: 520, workersInvolved: 2, completedAt: new Date(Date.now() - 3.5 * 86_400_000).toISOString() },
        ],
        exportFiles: [
            { filename: 'completed-2026-04-13.json', kind: 'completion-bundle', generatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() },
            { filename: 'wirelist-summary-2026-04-13.csv', kind: 'wirelist-summary', generatedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() },
        ],
    },
    {
        id: 'completed-2',
        pdNumber: '4M187',
        projectName: 'CEDAR RIDGE',
        lwcType: 'OFFSKID',
        completedAt: new Date(Date.now() - 12 * 86_400_000).toISOString(),
        completedByBadge: '88001',
        totalAssignments: 4,
        totalWires: 978,
        totalHoursActual: 28.2,
        totalHoursEstimated: 25.0,
        sheetSummaries: [
            { sheetSlug: 'pnl-a', sheetName: 'PNL A', wireCount: 512, actualMinutes: 900, estimatedMinutes: 780, workersInvolved: 2, completedAt: new Date(Date.now() - 13 * 86_400_000).toISOString() },
        ],
        exportFiles: [
            { filename: 'completed-2026-04-04.json', kind: 'completion-bundle', generatedAt: new Date(Date.now() - 12 * 86_400_000).toISOString() },
        ],
    },
    {
        id: 'completed-3',
        pdNumber: '4M052',
        projectName: 'SUMMIT PEAK',
        unitNumber: '1',
        lwcType: 'NEW/FLEX',
        completedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        completedByBadge: '75241',
        totalAssignments: 8,
        totalWires: 2450,
        totalHoursActual: 72.0,
        totalHoursEstimated: 68.5,
        sheetSummaries: [],
        exportFiles: [
            { filename: 'completed-2026-03-17.json', kind: 'completion-bundle', generatedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() },
            { filename: 'assignment-history-2026-03-17.json', kind: 'assignment-history', generatedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() },
            { filename: 'ipv-summary-2026-03-17.json', kind: 'ipv-summary', generatedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() },
        ],
    },
]

// ============================================================================
// View Model Builder
// ============================================================================

export function buildCompletedArchiveViewModel(
    records?: CompletedProjectRecord[],
): CompletedArchiveViewModel {
    const data = records ?? MOCK_COMPLETED
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonth = data.filter(r => new Date(r.completedAt) >= thisMonthStart).length
    const avgHours = data.length > 0
        ? data.reduce((sum, r) => sum + r.totalHoursActual, 0) / data.length
        : 0

    return {
        operatingDateLabel: shortDateFormatter.format(now),
        summary: {
            totalCompleted: data.length,
            thisMonth,
            averageHours: Math.round(avgHours * 10) / 10,
        },
        projects: [...data]
            .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
            .map(toCardViewModel),
        emptyState: {
            title: 'No completed projects yet',
            description: 'Projects will appear here once all assignments complete through BIQ and are exported.',
        },
    }
}
