'use client'

/**
 * Completed Archive Route
 *
 * Browse historically completed projects with summaries,
 * time comparisons, and export file references.
 */

import { useMemo } from 'react'
import {
    Archive,
    Calendar,
    CheckCircle2,
    Clock,
    FileText,
    TrendingDown,
    TrendingUp,
    Minus,
    Package,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { buildCompletedArchiveViewModel } from '@/lib/view-models/d380-completed-archive'
import type { CompletedProjectCardViewModel } from '@/types/d380-completed-archive'
import { cn } from '@/lib/utils'

function varianceColor(percent: number): string {
    if (percent <= -5) return 'text-green-600 dark:text-green-400'
    if (percent <= 5) return 'text-blue-600 dark:text-blue-400'
    if (percent <= 15) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
}

function CompletedProjectCard({ project }: { project: CompletedProjectCardViewModel }) {
    const VarianceIcon = project.variancePercent <= -2 ? TrendingDown
        : project.variancePercent >= 2 ? TrendingUp
            : Minus

    return (
        <Card className="hover:shadow-md transition-shadow">
            <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-semibold text-sm truncate">{project.projectName}</h3>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <span className="text-xs text-muted-foreground">{project.pdNumber}</span>
                                {project.unitNumber && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">Unit {project.unitNumber}</Badge>
                                )}
                                {project.lwcType && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{project.lwcType}</Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                        <div className="text-xs text-muted-foreground">{project.completedAtLabel}</div>
                        <div className="text-[10px] text-muted-foreground/70">{project.daysAgoLabel}</div>
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-4 gap-3 mt-4 pt-3 border-t">
                    <div>
                        <div className="text-lg font-bold">{project.totalAssignments}</div>
                        <div className="text-[10px] text-muted-foreground">Assignments</div>
                    </div>
                    <div>
                        <div className="text-lg font-bold">{project.totalWires.toLocaleString()}</div>
                        <div className="text-[10px] text-muted-foreground">Wires</div>
                    </div>
                    <div>
                        <div className="text-lg font-bold">{project.actualHoursLabel}</div>
                        <div className="text-[10px] text-muted-foreground">Actual</div>
                    </div>
                    <div className="flex flex-col items-start">
                        <div className={cn('text-lg font-bold flex items-center gap-1', varianceColor(project.variancePercent))}>
                            <VarianceIcon className="h-4 w-4" />
                            {Math.abs(project.variancePercent)}%
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                            vs est. {project.estimatedHoursLabel}
                        </div>
                    </div>
                </div>

                {/* Export files */}
                {project.exportFileCount > 0 && (
                    <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>{project.exportFileCount} export file{project.exportFileCount !== 1 ? 's' : ''}</span>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export function CompletedArchiveRoute() {
    const viewModel = useMemo(() => buildCompletedArchiveViewModel(), [])

    return (
        <main className="min-h-screen bg-muted/30">
            {/* Header */}
            <div className="bg-[#1e3a5f] text-white">
                <div className="container mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="rounded-xl bg-white/10 p-3">
                                <Archive className="h-7 w-7" />
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Completed Projects</h1>
                                <p className="text-sm text-white/70">Archive of finished work</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge variant="secondary" className="bg-white/20 text-white border-0">
                                {viewModel.summary.totalCompleted} total
                            </Badge>
                            <Badge variant="secondary" className="bg-white/20 text-white border-0">
                                {viewModel.summary.thisMonth} this month
                            </Badge>
                        </div>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <div className="container mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                <Package className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{viewModel.summary.totalCompleted}</div>
                                <div className="text-xs text-muted-foreground">Projects Completed</div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                <Calendar className="h-5 w-5 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{viewModel.summary.thisMonth}</div>
                                <div className="text-xs text-muted-foreground">This Month</div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                <Clock className="h-5 w-5 text-amber-600" />
                            </div>
                            <div>
                                <div className="text-2xl font-bold">{viewModel.summary.averageHours}h</div>
                                <div className="text-xs text-muted-foreground">Avg. Hours</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Project list */}
                {viewModel.projects.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-card px-8 py-16 text-center">
                        <Archive className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                        <h2 className="text-xl font-semibold">{viewModel.emptyState.title}</h2>
                        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{viewModel.emptyState.description}</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {viewModel.projects.map(project => (
                            <CompletedProjectCard key={project.id} project={project} />
                        ))}
                    </div>
                )}
            </div>
        </main>
    )
}
