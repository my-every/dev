'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Search } from 'lucide-react'

import { ProjectCard } from '@/components/d380/projects/project-card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { D380ShellAssignmentGroupViewModel } from '@/types/d380-shell'
import type { ProjectWorkspaceAssignmentItemViewModel } from '@/types/d380-project-workspace'
import type { ProjectsBoardProjectCardViewModel } from '@/types/d380-projects-board'

type AssignmentSortMode = 'project' | 'sheet' | 'status' | 'progress'

function getStatusRank(statusLabel: string) {
    if (statusLabel === 'Active') {
        return 0
    }

    if (statusLabel === 'Blocked') {
        return 1
    }

    if (statusLabel === 'Queued') {
        return 2
    }

    return 3
}

function matchesAssignmentSearch({
    search,
    group,
    assignment,
}: {
    search: string
    group: D380ShellAssignmentGroupViewModel
    assignment: ProjectWorkspaceAssignmentItemViewModel
}) {
    if (!search) {
        return true
    }

    const haystack = [
        group.pdNumber,
        group.projectName,
        group.member,
        assignment.sheetName,
        assignment.stageLabel,
        assignment.statusLabel,
        assignment.lwcLabel,
        assignment.workstationLabel ?? '',
    ].join(' ').toLowerCase()

    return haystack.includes(search)
}

function sortAssignments(
    assignments: ProjectWorkspaceAssignmentItemViewModel[],
    mode: AssignmentSortMode,
) {
    const list = [...assignments]

    if (mode === 'sheet') {
        return list.sort((left, right) => left.sheetName.localeCompare(right.sheetName))
    }

    if (mode === 'status') {
        return list.sort((left, right) => {
            const statusDelta = getStatusRank(left.statusLabel) - getStatusRank(right.statusLabel)
            if (statusDelta !== 0) {
                return statusDelta
            }

            return right.progressPercent - left.progressPercent
        })
    }

    if (mode === 'progress') {
        return list.sort((left, right) => right.progressPercent - left.progressPercent)
    }

    return list.sort((left, right) => left.sheetName.localeCompare(right.sheetName))
}

function AssignmentExplorerRow({
    assignment,
    assigned,
    trackedProgress,
    open,
    onOpenChange,
    onAssign,
    onReassign,
}: {
    assignment: ProjectWorkspaceAssignmentItemViewModel
    assigned: boolean
    trackedProgress: number
    open: boolean
    onOpenChange: (open: boolean) => void
    onAssign: () => void
    onReassign: () => void
}) {
    const actionLabel = assigned ? 'Reassign' : 'Assign'

    return (
        <Collapsible open={open} onOpenChange={onOpenChange} className="rounded-2xl border border-border/70 bg-background/70">
            <div className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <CollapsibleTrigger asChild>
                    <button type="button" className="flex min-w-0 items-center gap-3 text-left">
                        <ChevronDown className={cn('size-4 shrink-0 text-foreground/54 transition-transform', open && 'rotate-180')} />
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-base font-semibold text-foreground">{assignment.sheetName}</span>
                                <Badge variant="outline" className="rounded-full border-border/70 bg-muted/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/68">
                                    {assignment.statusLabel}
                                </Badge>
                                <Badge variant="outline" className="rounded-full border-border/70 bg-muted/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-foreground/68">
                                    {assignment.stageLabel}
                                </Badge>
                            </div>
                            <div className="mt-1 text-sm text-foreground/60">{assignment.lwcLabel} • {assignment.workstationLabel ?? 'Workstation pending'}</div>
                        </div>
                    </button>
                </CollapsibleTrigger>

                <div className="grid gap-2 sm:grid-cols-[auto_auto] md:grid-cols-[auto_auto]">
                    <Button type="button" variant={assigned ? 'outline' : 'default'} className="rounded-xl" onClick={assigned ? onReassign : onAssign}>
                        {actionLabel}
                    </Button>
                    <Button asChild type="button" variant="outline" className="rounded-xl bg-muted/40">
                        <Link href={assignment.sheetWorkspaceHref}>Open</Link>
                    </Button>
                </div>
            </div>

            {assigned ? (
                <div className="px-4 pb-3">
                    <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-foreground/46">
                        <span>Time track</span>
                        <span>{trackedProgress}%</span>
                    </div>
                    <Progress value={trackedProgress} className="h-2 bg-muted" />
                </div>
            ) : null}

            <CollapsibleContent>
                <div className="grid gap-3 border-t border-border/70 px-4 py-4 md:grid-cols-4">
                    <div className="rounded-xl bg-muted/50 px-3 py-3 text-sm text-foreground/66">Assigned: {assignment.assignedMemberCount}</div>
                    <div className="rounded-xl bg-muted/50 px-3 py-3 text-sm text-foreground/66">Trainees: {assignment.traineeCount}</div>
                    <div className="rounded-xl bg-muted/50 px-3 py-3 text-sm text-foreground/66">Est: {assignment.estimatedHoursLabel}</div>
                    <div className="rounded-xl bg-muted/50 px-3 py-3 text-sm text-foreground/66">Avg: {assignment.averageHoursLabel}</div>
                </div>
                <div className="px-4 pb-4 text-sm leading-6 text-foreground/64">{assignment.statusNote}</div>
            </CollapsibleContent>
        </Collapsible>
    )
}

export function D380ProjectsExplorerPanel({
    projects,
    title = 'Project index',
    description = 'Project cards ready for quick triage and workspace entry.',
    maxHeightClassName,
}: {
    projects: ProjectsBoardProjectCardViewModel[]
    title?: string
    description?: string
    maxHeightClassName?: string
}) {
    const content = (
        <div className="space-y-5">
            <div className="relative overflow-hidden rounded-[32px] border border-border/70 bg-card/88 px-5 py-5 shadow-[0_18px_70px_rgba(0,0,0,0.08)]">
                <Image src="/patterns/image.png" alt="" fill className="object-cover opacity-15" />
                <div className="relative space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/46">Project explorer</div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
                    <p className="max-w-3xl text-sm leading-6 text-foreground/62">{description}</p>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                {projects.map(project => <ProjectCard key={project.id} project={project} />)}
            </div>
        </div>
    )

    if (!maxHeightClassName) {
        return content
    }

    return (
        <ScrollArea className={maxHeightClassName}>
            <div className="pr-3">{content}</div>
        </ScrollArea>
    )
}

export function D380AssignmentsExplorerPanel({
    groups,
    title = 'Assignments by project',
    description = 'Assignment routing grouped by project workspace with direct links into sheet and stage flows.',
    maxHeightClassName,
}: {
    groups: D380ShellAssignmentGroupViewModel[]
    title?: string
    description?: string
    maxHeightClassName?: string
}) {
    const [search, setSearch] = useState('')
    const [sortMode, setSortMode] = useState<AssignmentSortMode>('project')
    const [openRows, setOpenRows] = useState<Record<string, boolean>>({})
    const [assignedOverrides, setAssignedOverrides] = useState<Record<string, boolean>>({})
    const [rowProgress, setRowProgress] = useState<Record<string, number>>({})

    useEffect(() => {
        const activeIds = new Set(
            groups
                .flatMap(group => group.assignments)
                .map(assignment => assignment.id)
                .filter(id => {
                    const isAssigned = assignedOverrides[id] ?? groups.some(group => group.assignments.some(assignment => assignment.id === id && assignment.assignedMemberCount > 0))
                    return isAssigned
                }),
        )

        if (activeIds.size === 0) {
            return
        }

        const timer = window.setInterval(() => {
            setRowProgress(current => {
                const next = { ...current }
                for (const id of activeIds) {
                    next[id] = Math.min(100, (next[id] ?? 0) + 1)
                }
                return next
            })
        }, 3000)

        return () => window.clearInterval(timer)
    }, [assignedOverrides, groups])

    const normalizedSearch = search.trim().toLowerCase()

    const filteredGroups = useMemo(() => {
        const nextGroups = groups
            .map(group => {
                const filteredAssignments = group.assignments.filter(assignment => matchesAssignmentSearch({
                    search: normalizedSearch,
                    group,
                    assignment,
                }))

                return {
                    ...group,
                    assignments: sortAssignments(filteredAssignments, sortMode),
                }
            })
            .filter(group => group.assignments.length > 0)

        if (sortMode === 'project') {
            return nextGroups.sort((left, right) => left.projectName.localeCompare(right.projectName))
        }

        if (sortMode === 'status') {
            return nextGroups.sort((left, right) => {
                const leftRank = Math.min(...left.assignments.map(assignment => getStatusRank(assignment.statusLabel)))
                const rightRank = Math.min(...right.assignments.map(assignment => getStatusRank(assignment.statusLabel)))

                if (leftRank !== rightRank) {
                    return leftRank - rightRank
                }

                return left.projectName.localeCompare(right.projectName)
            })
        }

        if (sortMode === 'progress') {
            return nextGroups.sort((left, right) => {
                const leftProgress = Math.max(...left.assignments.map(assignment => assignment.progressPercent))
                const rightProgress = Math.max(...right.assignments.map(assignment => assignment.progressPercent))
                return rightProgress - leftProgress
            })
        }

        return nextGroups
    }, [groups, normalizedSearch, sortMode])

    function getAssignedState(assignment: ProjectWorkspaceAssignmentItemViewModel) {
        return assignedOverrides[assignment.id] ?? assignment.assignedMemberCount > 0
    }

    function markAssigned(assignment: ProjectWorkspaceAssignmentItemViewModel) {
        setAssignedOverrides(current => ({
            ...current,
            [assignment.id]: true,
        }))
        setRowProgress(current => ({
            ...current,
            [assignment.id]: Math.max(current[assignment.id] ?? 0, assignment.progressPercent),
        }))
    }

    function markReassigned(assignment: ProjectWorkspaceAssignmentItemViewModel) {
        setAssignedOverrides(current => ({
            ...current,
            [assignment.id]: true,
        }))
        setRowProgress(current => ({
            ...current,
            [assignment.id]: Math.max(current[assignment.id] ?? assignment.progressPercent, 5),
        }))
    }

    const content = (
        <div className="space-y-5">
            <div className="rounded-[32px] border border-border/70 bg-card/88 px-5 py-5 shadow-[0_18px_70px_rgba(0,0,0,0.08)]">
                <div className="space-y-2">
                    <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/46">Assignment explorer</div>
                    <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h2>
                    <p className="max-w-3xl text-sm leading-6 text-foreground/62">{description}</p>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_15rem]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/40" />
                        <Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search project, sheet, stage, status, workstation..." className="pl-9" />
                    </div>
                    <Select value={sortMode} onValueChange={value => setSortMode(value as AssignmentSortMode)}>
                        <SelectTrigger className="w-full">
                            <SelectValue placeholder="Sort rows" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="project">Sort: Project</SelectItem>
                            <SelectItem value="sheet">Sort: Sheet</SelectItem>
                            <SelectItem value="status">Sort: Status</SelectItem>
                            <SelectItem value="progress">Sort: Progress</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-4">
                {filteredGroups.map(group => (
                    <Card key={group.id} className="rounded-[32px] border border-border/70 bg-card/92 py-0 shadow-[0_12px_40px_rgba(0,0,0,0.06)]">
                        <CardContent className="space-y-4 px-5 py-5">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="size-11 border border-border/70 bg-primary/12 text-primary">
                                        <AvatarFallback className="bg-transparent text-sm font-semibold text-primary">{group.pdNumber.slice(-3)}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/42">{group.pdNumber}</div>
                                        <h3 className="text-xl font-semibold tracking-tight text-foreground">{group.projectName}</h3>
                                        <p className="text-sm text-foreground/58">{group.member}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="rounded-full border-border/70 bg-muted/40 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-foreground/68">
                                        {group.assignments.length} assignments
                                    </Badge>
                                    <Link href={group.href} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                                        Open project
                                    </Link>
                                </div>
                            </div>

                            <div className="space-y-3">
                                {group.assignments.map(assignment => {
                                    const assigned = getAssignedState(assignment)

                                    return (
                                        <AssignmentExplorerRow
                                            key={assignment.id}
                                            assignment={assignment}
                                            assigned={assigned}
                                            trackedProgress={assigned ? rowProgress[assignment.id] ?? assignment.progressPercent : assignment.progressPercent}
                                            open={openRows[assignment.id] ?? false}
                                            onOpenChange={open => setOpenRows(current => ({ ...current, [assignment.id]: open }))}
                                            onAssign={() => markAssigned(assignment)}
                                            onReassign={() => markReassigned(assignment)}
                                        />
                                    )
                                })}
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {filteredGroups.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-border/80 bg-card/70 px-5 py-8 text-center text-sm text-foreground/58">
                        No assignments match the current search and sort selection.
                    </div>
                ) : null}
            </div>
        </div>
    )

    if (!maxHeightClassName) {
        return content
    }

    return (
        <ScrollArea className={maxHeightClassName}>
            <div className="pr-3">{content}</div>
        </ScrollArea>
    )
}
