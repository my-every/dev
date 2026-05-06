/**
 * Completed Archive Types
 *
 * Types for browsing and inspecting completed projects
 * that have been exported to CompletedProjects/
 */

export interface CompletedProjectRecord {
    id: string
    pdNumber: string
    projectName: string
    unitNumber?: string
    lwcType?: string
    completedAt: string
    completedByBadge: string
    totalAssignments: number
    totalWires: number
    totalHoursActual: number
    totalHoursEstimated: number
    sheetSummaries: CompletedSheetSummary[]
    exportFiles: CompletedExportFile[]
}

export interface CompletedSheetSummary {
    sheetSlug: string
    sheetName: string
    wireCount: number
    actualMinutes: number
    estimatedMinutes: number
    workersInvolved: number
    completedAt: string
}

export interface CompletedExportFile {
    filename: string
    kind: 'wirelist-summary' | 'assignment-history' | 'ipv-summary' | 'leadership-metrics' | 'completion-bundle'
    generatedAt: string
    sizeBytes?: number
}

export interface CompletedArchiveViewModel {
    operatingDateLabel: string
    summary: {
        totalCompleted: number
        thisMonth: number
        averageHours: number
    }
    projects: CompletedProjectCardViewModel[]
    emptyState: {
        title: string
        description: string
    }
}

export interface CompletedProjectCardViewModel {
    id: string
    pdNumber: string
    projectName: string
    unitNumber?: string
    lwcType?: string
    completedAtLabel: string
    daysAgoLabel: string
    totalAssignments: number
    totalWires: number
    actualHoursLabel: string
    estimatedHoursLabel: string
    variancePercent: number
    sheets: CompletedSheetSummary[]
    exportFileCount: number
}
