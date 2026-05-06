"use client"

/**
 * Project Timeline View
 *
 * Split-pane layout matching the factory floor scheduling UI:
 *
 *  LEFT (fixed ~280px):
 *    Station rows grouped by floor area (NEW/FLEX, ON SKID, OFF SKID).
 *    Each station row = one workstation (Build-Up Table, Wiring Table, Test Station, etc.)
 *    Clicking a card opens a user assignment panel on the right side of the left column.
 *
 *  RIGHT (scrollable):
 *    24-hour timeline grid with:
 *    - Day header (WEDNESDAY 4/15/2026)
 *    - Shift overlay bars (1ST / 2ND on weekdays, OVERTIME on weekends)
 *    - Hour markers (12, 2, 4, 6, 8, 10, 12…)
 *    - Swimlane rows per station (1:1 with left panel rows)
 *    - Positioned assignment cards at their scheduled time
 *    - Current-time indicator
 */

import { useState, useMemo, useRef, useCallback, useEffect } from "react"
import {
    ChevronLeft,
    ChevronRight,
    CalendarDays,
    Users,
    X,
    Search,
    Shield,
    GraduationCap,
    UserPlus,
    Check,
    Clock,
    AlertTriangle,
    Layers,
    Save,
    Loader2,
    CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ProfileAvatar } from "@/components/profile/profile-fields"
import { getAvatarColor, getAvatarInitials } from "@/lib/profile/avatar-utils"
import type { MappedAssignment } from "@/lib/assignment/mapped-assignment"
import type { ProjectManifest } from "@/types/project-manifest"
import { SWS_TYPE_REGISTRY, type SwsTypeId } from "@/lib/assignment/sws-detection"
import {
    getShiftsForDate,
    getDayLabel,
    getDateLabel,
    timeToMinutes,
    toISODate,
    type ShiftSlot,
    type ScheduledSlot,
} from "@/types/shift-schedule"
import {
    FLOOR_AREAS,
    FLOOR_AREA_META,
    FLOOR_STATIONS,
    STATION_CATEGORY_COLORS,
    STATION_CATEGORY_TEXT,
    STATION_COMPATIBLE_STAGES,
    STATION_ASSIGNABLE_STAGES,
    STAGE_ESTIMATES,
    getSkillLevel,
    type FloorArea,
    type StationDefinition,
    type StationCategory,
    type StageEstimate,
} from "@/types/floor-layout"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
    TooltipProvider,
} from "@/components/ui/tooltip"
import type { AssignmentStageId } from "@/types/d380-assignment-stages"
import { ASSIGNMENT_STAGES } from "@/types/d380-assignment-stages"
import type { AssignableMember } from "@/components/projects/member-assignment-selector"

// ============================================================================
// Types
// ============================================================================

export interface ProjectTimelineViewProps {
    project: ProjectManifest
    assignments: MappedAssignment[]
    onAssignmentClick?: (assignment: MappedAssignment) => void
    /** Patch a single assignment's stage/status */
    onPatchAssignment?: (slug: string, update: { selectedStage?: string; selectedStatus?: string }) => void
}

/** Shape returned by /api/users/team */
interface ApiTeamMember {
    badge: string
    fullName: string
    preferredName?: string | null
    initials?: string | null
    role: string
    shift: string
    primaryLwc?: string | null
    skills?: Record<string, number> | null
    yearsExperience?: number | null
}

/** Extended assignable member with numeric skill levels */
interface TimelineMember extends AssignableMember {
    skills: Record<string, number>
}

// ============================================================================
// Constants
// ============================================================================

/** Timeline grid: 24 hours, 2-hour markers */
const TIMELINE_START_HOUR = 0
const TIMELINE_END_HOUR = 24
const TIMELINE_TOTAL_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR
const PX_PER_HOUR = 60
const TIMELINE_GRID_WIDTH = TIMELINE_TOTAL_HOURS * PX_PER_HOUR
const ROW_HEIGHT = 72

function getHourMarkers(): { hour: number; label: string }[] {
    const markers: { hour: number; label: string }[] = []
    for (let h = 0; h <= 24; h += 2) {
        const display = h === 0 || h === 24 ? 12 : h > 12 ? h - 12 : h === 12 ? 12 : h
        markers.push({ hour: h, label: `${display}` })
    }
    return markers
}

const HOUR_MARKERS = getHourMarkers()

// ============================================================================
// Helpers
// ============================================================================

function cleanName(raw: string): string {
    return raw
        .replace(/[^A-Za-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

// ============================================================================
// Schedule helpers: place a single assignment onto a station
// ============================================================================

/** Create a ScheduledSlot when the user places an assignment on a station */
function createSlotForAssignment(
    assignment: MappedAssignment,
    station: StationDefinition,
    dateStr: string,
    shiftStartHour: number,
    existingSlots: ScheduledSlot[],
    startTimeOverride?: string,
): ScheduledSlot {
    const estimate = STAGE_ESTIMATES[assignment.selectedStage]
    const durationMinutes = estimate?.estimatedMinutes
        ? Math.min(estimate.estimatedMinutes, 600)
        : 120

    let startTotalMin: number

    if (startTimeOverride) {
        // Use the user-selected time
        startTotalMin = timeToMinutes(startTimeOverride)
    } else {
        // Stagger after any existing slots on this station
        startTotalMin = existingSlots.reduce((max, s) => {
            const start = timeToMinutes(s.scheduledStart)
            return Math.max(max, start + s.scheduledDuration)
        }, shiftStartHour * 60)
    }

    const startH = Math.floor(startTotalMin / 60)
    const startM = startTotalMin % 60

    return {
        assignmentSlug: assignment.sheetSlug,
        scheduledStart: `${startH.toString().padStart(2, "0")}:${startM.toString().padStart(2, "0")}`,
        scheduledDuration: durationMinutes,
        scheduledDate: dateStr,
        assignedBadges: [],
        workstation: station.label,
        stationId: station.id,
    }
}

// ============================================================================
// Load real team members from /api/users/team
// ============================================================================

async function fetchTeamMembers(shift: string): Promise<TimelineMember[]> {
    try {
        const res = await fetch(`/api/users/team?shift=${encodeURIComponent(shift)}`)
        if (!res.ok) return []
        const data = await res.json()
        const members: ApiTeamMember[] = data.members ?? []
        return members.map((m) => {
            const names = (m.fullName || "").split(/\s+/)
            const firstName = names[0] || ""
            const lastName = names.slice(1).join(" ") || ""
            return {
                badge: m.badge,
                fullName: m.fullName || m.badge,
                firstName,
                lastName,
                initials: m.initials || `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase(),
                shift: m.shift?.replace("-shift", "") || shift,
                primaryRole: m.role || "",
                secondaryRoles: [],
                status: "active" as const,
                experiencedStages: [],
                traineeEligibleStages: [],
                avatarPath: null,
                currentProjectIds: [],
                currentSheetNames: [],
                skills: m.skills ?? {},
            }
        })
    } catch {
        return []
    }
}

// ============================================================================
// Shift Bar
// ============================================================================

function ShiftBar({ shift }: { shift: ShiftSlot }) {
    const leftPct = ((shift.startHour - TIMELINE_START_HOUR) / TIMELINE_TOTAL_HOURS) * 100
    const widthPct = ((shift.endHour - shift.startHour) / TIMELINE_TOTAL_HOURS) * 100

    return (
        <div
            className={cn(
                "absolute top-0 bottom-0 rounded-full flex items-center justify-center",
                shift.color,
                shift.hatched && "overflow-hidden",
            )}
            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
        >
            {shift.hatched && (
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        backgroundImage:
                            "repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(255,255,255,0.5) 4px, rgba(255,255,255,0.5) 8px)",
                    }}
                />
            )}
            <span className={cn("relative z-[1] text-xs font-bold tracking-wider", shift.textColor)}>
                {shift.label}
            </span>
        </div>
    )
}

// ============================================================================
// Day Header Row
// ============================================================================

function DayHeaderRow({ date }: { date: Date }) {
    const shifts = getShiftsForDate(date)

    return (
        <div className="sticky top-0 z-20 bg-card border-b">
            <div className="flex items-center justify-between px-4 py-2">
                <span className="text-sm font-bold tracking-tight">{getDayLabel(date)}</span>
                <span className="text-sm text-muted-foreground font-medium">{getDateLabel(date)}</span>
            </div>
            <div className="relative h-8 mx-4 mb-2 rounded-full bg-muted/40">
                {shifts.map((s) => (
                    <ShiftBar key={s.id} shift={s} />
                ))}
            </div>
        </div>
    )
}

/** Hour markers rendered inside the timeline scroll area */
function HourMarkerRow({ gridWidth }: { gridWidth: number }) {
    return (
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b" style={{ width: gridWidth }}>
            <div className="relative h-6">
                {HOUR_MARKERS.map((m) => (
                    <span
                        key={m.hour}
                        className="absolute text-[11px] text-muted-foreground font-medium -translate-x-1/2 top-1"
                        style={{ left: `${(m.hour / TIMELINE_TOTAL_HOURS) * 100}%` }}
                    >
                        {m.label}
                    </span>
                ))}
            </div>
        </div>
    )
}

// ============================================================================
// Current Time Indicator
// ============================================================================

function CurrentTimeIndicator() {
    const [now, setNow] = useState(new Date())

    useEffect(() => {
        const iv = setInterval(() => setNow(new Date()), 60_000)
        return () => clearInterval(iv)
    }, [])

    const totalMinutes = now.getHours() * 60 + now.getMinutes()
    const leftPct = (totalMinutes / (TIMELINE_TOTAL_HOURS * 60)) * 100

    if (totalMinutes < 0 || totalMinutes > TIMELINE_TOTAL_HOURS * 60) return null

    return (
        <div
            className="absolute top-0 bottom-0 z-30 pointer-events-none"
            style={{ left: `${leftPct}%` }}
        >
            <div className="absolute top-0 bottom-0 w-0.5 bg-blue-500/70" />
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-blue-500 border-2 border-white shadow" />
        </div>
    )
}

// ============================================================================
// Shift Backgrounds
// ============================================================================

function ShiftBackgrounds({ date }: { date: Date }) {
    const shifts = getShiftsForDate(date)
    return (
        <>
            {shifts.map((s) => {
                const leftPct = ((s.startHour - TIMELINE_START_HOUR) / TIMELINE_TOTAL_HOURS) * 100
                const widthPct = ((s.endHour - s.startHour) / TIMELINE_TOTAL_HOURS) * 100
                const bgColor =
                    s.id === "1ST"
                        ? "bg-cyan-50/40 dark:bg-cyan-950/10"
                        : s.id === "2ND"
                            ? "bg-yellow-50/30 dark:bg-yellow-950/10"
                            : "bg-muted/20"
                return (
                    <div
                        key={s.id}
                        className={cn("absolute top-0 bottom-0", bgColor)}
                        style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                    />
                )
            })}
        </>
    )
}

// ============================================================================
// Timeline Hover Tooltip (shows time at cursor position)
// ============================================================================

function TimelineHoverTime({
    gridWidth,
    rowHeight,
}: {
    gridWidth: number
    rowHeight: number
}) {
    const [hoverTime, setHoverTime] = useState<string | null>(null)
    const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        const rect = containerRef.current?.getBoundingClientRect()
        if (!rect) return
        const relX = e.clientX - rect.left
        const pct = relX / rect.width
        const totalMinutes = Math.round(pct * TIMELINE_TOTAL_HOURS * 60)
        const clamped = Math.max(0, Math.min(totalMinutes, TIMELINE_TOTAL_HOURS * 60))
        const h = Math.floor(clamped / 60)
        const m = clamped % 60
        const ampm = h >= 12 ? "PM" : "AM"
        const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
        setHoverTime(`${h12}:${m.toString().padStart(2, "0")} ${ampm}`)
        setHoverPos({ x: e.clientX, y: e.clientY })
    }, [])

    const handleMouseLeave = useCallback(() => {
        setHoverTime(null)
        setHoverPos(null)
    }, [])

    return (
        <div
            ref={containerRef}
            className="absolute inset-0 z-10 pointer-events-auto"
            style={{ width: gridWidth }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
        >
            {hoverTime && hoverPos && (
                <div
                    className="fixed z-50 pointer-events-none px-2 py-1 rounded-md bg-popover border shadow-md text-xs font-medium text-popover-foreground"
                    style={{ left: hoverPos.x + 12, top: hoverPos.y - 30 }}
                >
                    {hoverTime}
                </div>
            )}
        </div>
    )
}

// ============================================================================
// Timeline Grid Card (positioned on a station row)
// ============================================================================

function TimelineGridCard({
    assignment,
    slot,
    project,
    allMembers,
    station,
    isStationSelected,
    onClick,
    onDragMove,
    selectedDate,
}: {
    assignment: MappedAssignment
    slot: ScheduledSlot
    project: ProjectManifest
    allMembers: TimelineMember[]
    station: StationDefinition
    isStationSelected: boolean
    onClick?: () => void
    onDragMove?: (slug: string, newStartMinutes: number) => void
    selectedDate: string
}) {
    const projectColor = project.color || "#ffcc61"
    const isDraggable = assignment.selectedStatus === "NOT_STARTED" && !!onDragMove

    const startMin = timeToMinutes(slot.scheduledStart)
    const leftPct = (startMin / (TIMELINE_TOTAL_HOURS * 60)) * 100
    const estimateWidthPct = (slot.scheduledDuration / (TIMELINE_TOTAL_HOURS * 60)) * 100

    // Live elapsed-time width: grows from scheduledStart until now, capped at estimate
    const [now, setNow] = useState(new Date())
    useEffect(() => {
        const iv = setInterval(() => setNow(new Date()), 60_000)
        return () => clearInterval(iv)
    }, [])

    const status = assignment.selectedStatus
    const isComplete = status === "COMPLETE"
    const isInProgress = status === "IN_PROGRESS"

    const elapsedWidthPct = useMemo(() => {
        if (isComplete) return estimateWidthPct
        if (!isInProgress) return 0

        // Compute elapsed minutes from scheduledStart on the selected date
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
        if (selectedDate !== todayStr) {
            // Past date: treat as fully elapsed; future date: no elapsed
            return selectedDate < todayStr ? estimateWidthPct : 0
        }

        const currentMin = now.getHours() * 60 + now.getMinutes()
        const elapsed = Math.max(0, currentMin - startMin)
        const elapsedCapped = Math.min(elapsed, slot.scheduledDuration)
        return (elapsedCapped / (TIMELINE_TOTAL_HOURS * 60)) * 100
    }, [now, isComplete, isInProgress, selectedDate, startMin, slot.scheduledDuration, estimateWidthPct])

    // Filled width = elapsed (for in-progress), full estimate (for complete), or min bar (for not started)
    const filledWidthPct = isComplete
        ? estimateWidthPct
        : isInProgress
            ? Math.max(elapsedWidthPct, (30 / (TIMELINE_TOTAL_HOURS * 60)) * 100) // min 30 min visible
            : (30 / (TIMELINE_TOTAL_HOURS * 60)) * 100 // thin placeholder for NOT_STARTED

    const displayName = cleanName(assignment.sheetName)
    const stageInfo = ASSIGNMENT_STAGES.find((s) => s.id === assignment.selectedStage)
    const hasAssigned = slot.assignedBadges.length > 0

    // Drag state
    const [isDragging, setIsDragging] = useState(false)
    const [dragLeftPct, setDragLeftPct] = useState<number | null>(null)
    const dragStartRef = useRef<{ mouseX: number; origLeftPct: number } | null>(null)
    const cardRef = useRef<HTMLDivElement>(null)

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!isDraggable) return
        e.preventDefault()
        e.stopPropagation()
        const parentEl = cardRef.current?.parentElement
        if (!parentEl) return
        const parentRect = parentEl.getBoundingClientRect()
        const currentLeftPx = (leftPct / 100) * parentRect.width
        dragStartRef.current = { mouseX: e.clientX, origLeftPct: leftPct }
        setIsDragging(true)

        const handleMouseMove = (ev: MouseEvent) => {
            if (!dragStartRef.current) return
            const dx = ev.clientX - dragStartRef.current.mouseX
            const dxPct = (dx / parentRect.width) * 100
            const newLeftPct = Math.max(0, Math.min(100 - estimateWidthPct, dragStartRef.current.origLeftPct + dxPct))
            setDragLeftPct(newLeftPct)
        }

        const handleMouseUp = (ev: MouseEvent) => {
            document.removeEventListener("mousemove", handleMouseMove)
            document.removeEventListener("mouseup", handleMouseUp)
            setIsDragging(false)
            if (dragStartRef.current) {
                const dx = ev.clientX - dragStartRef.current.mouseX
                const dxPct = (dx / parentRect.width) * 100
                const newLeftPct = Math.max(0, Math.min(100 - estimateWidthPct, dragStartRef.current.origLeftPct + dxPct))
                const newStartMin = Math.round((newLeftPct / 100) * TIMELINE_TOTAL_HOURS * 60)
                // Snap to 15-minute intervals
                const snapped = Math.round(newStartMin / 15) * 15
                onDragMove!(assignment.sheetSlug, snapped)
            }
            dragStartRef.current = null
            setDragLeftPct(null)
        }

        document.addEventListener("mousemove", handleMouseMove)
        document.addEventListener("mouseup", handleMouseUp)
    }, [isDraggable, leftPct, estimateWidthPct, assignment.sheetSlug, onDragMove])

    // Resolve badge → member for display
    const assignedMembers = useMemo(() => {
        return slot.assignedBadges
            .map((badge) => allMembers.find((m) => m.badge === badge))
            .filter(Boolean) as TimelineMember[]
    }, [slot.assignedBadges, allMembers])

    const effectiveLeftPct = dragLeftPct ?? leftPct

    return (
        <div
            ref={cardRef}
            className={cn(
                "absolute top-1 bottom-1 group",
                isDragging ? "z-40 cursor-grabbing" : isDraggable ? "cursor-grab" : "cursor-pointer",
            )}
            style={{ left: `${effectiveLeftPct}%`, width: `${estimateWidthPct}%`, minWidth: 80 }}
            onClick={isDragging ? undefined : onClick}
            onMouseDown={isDraggable ? handleMouseDown : undefined}
        >
            {/* Estimate boundary — dashed outline showing the full estimated duration */}
            {!isComplete && (
                <div
                    className="absolute inset-0 rounded-md border border-dashed border-border/40 pointer-events-none"
                />
            )}
            {/* Filled card — grows with elapsed time */}
            <div
                className={cn(
                    "h-full bg-card border rounded-md shadow-sm hover:shadow-md transition-all relative overflow-hidden",
                    isStationSelected ? "border-primary ring-1 ring-primary/30" : "border-border/60",
                )}
                style={{
                    width: isComplete ? "100%" : `${Math.max((filledWidthPct / estimateWidthPct) * 100, 0)}%`,
                    minWidth: 80,
                    borderRightWidth: 4,
                    borderRightColor: projectColor,
                    transition: "width 1s ease-in-out",
                }}
            >
                {/* Card content */}
                <div className="absolute inset-0 flex flex-col justify-center px-2 pr-8">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground truncate">
                        <span className="font-medium truncate">{station.label}</span>
                        {stageInfo && (
                            <>
                                <span className="shrink-0">·</span>
                                <span className="shrink-0 font-semibold">{stageInfo.shortLabel}</span>
                            </>
                        )}
                    </div>
                    <span className="text-[11px] font-bold truncate leading-tight">{displayName}</span>
                    {/* Assigned user full names */}
                    {hasAssigned && (
                        <div className="flex items-center gap-1 mt-0.5">
                            {assignedMembers.slice(0, 2).map((m) => {
                                const color = getAvatarColor(m.badge)
                                const inits = getAvatarInitials(m.fullName)
                                return (
                                    <div key={m.badge} className="flex items-center gap-0.5">
                                        <div className={cn("h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0", color.bg)}>
                                            <span className={cn("text-[6px] font-bold", color.text)}>{inits}</span>
                                        </div>
                                        <span className="text-[9px] text-muted-foreground truncate max-w-[60px]">
                                            {m.fullName}
                                        </span>
                                    </div>
                                )
                            })}
                            {assignedMembers.length > 2 && (
                                <span className="text-[8px] text-muted-foreground">+{assignedMembers.length - 2}</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Avatars — pinned to right edge inside the card */}
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center">
                    {hasAssigned ? (
                        <div className="flex -space-x-1.5">
                            {assignedMembers.slice(0, 2).map((m) => {
                                const color = getAvatarColor(m.badge)
                                const inits = getAvatarInitials(m.fullName)
                                return (
                                    <div
                                        key={m.badge}
                                        className={cn("h-6 w-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm", color.bg)}
                                        title={m.fullName}
                                    >
                                        <span className={cn("text-[7px] font-bold", color.text)}>{inits}</span>
                                    </div>
                                )
                            })}
                            {assignedMembers.length > 2 && (
                                <div className="h-6 w-6 rounded-full bg-muted border-2 border-white flex items-center justify-center shadow-sm">
                                    <span className="text-[7px] font-bold">+{assignedMembers.length - 2}</span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center">
                            <Users className="h-3 w-3 text-muted-foreground" />
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// Left Panel: Station Row Label
// ============================================================================

function StationRowLabel({
    station,
    assignment,
    project,
    isSelected,
    assignedBadges,
    onClick,
}: {
    station: StationDefinition
    assignment?: MappedAssignment | null
    project: ProjectManifest
    isSelected: boolean
    assignedBadges: string[]
    onClick: () => void
}) {
    const projectColor = project.color || "#ffcc61"
    const swsInfo = assignment
        ? SWS_TYPE_REGISTRY[assignment.selectedSwsType as SwsTypeId]
        : null
    const hasAssigned = assignedBadges.length > 0

    return (
        <div
            className={cn(
                "flex items-stretch border-b border-border/20 cursor-pointer transition-colors",
                isSelected ? "bg-primary/5 ring-1 ring-primary/30 ring-inset" : "hover:bg-muted/30",
            )}
            style={{ height: ROW_HEIGHT }}
            onClick={onClick}
        >

            {/* Station content */}
            <div className="flex-1 min-w-0 px-2 py-1 flex flex-col justify-center">
                <span className={cn("text-[10px] font-semibold", STATION_CATEGORY_TEXT[station.category])}>
                    {station.shortLabel}
                </span>
                {assignment ? (
                    <div className="min-w-0">
                        <div className="text-[10px] text-muted-foreground truncate">
                            {project.name || `PD# ${project.pdNumber || "—"}`}
                        </div>
                        <div className="text-[11px] font-semibold truncate leading-tight">
                            {cleanName(assignment.sheetName)}
                        </div>
                        {/* Est. time from stage estimates */}
                        {(() => {
                            const est = STAGE_ESTIMATES[assignment.selectedStage] as StageEstimate | undefined
                            return est ? (
                                <div className="flex items-center gap-1 mt-0.5">
                                    <Clock className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" />
                                    <span className="text-[8px] text-muted-foreground">{est.label}</span>
                                </div>
                            ) : null
                        })()}
                        {/* Assigned members indicator */}
                        {hasAssigned && (
                            <div className="flex items-center gap-1 mt-0.5">
                                <div className="flex -space-x-1">
                                    {assignedBadges.slice(0, 2).map((b) => {
                                        const color = getAvatarColor(b)
                                        return (
                                            <div
                                                key={b}
                                                className={cn("h-4 w-4 rounded-full flex items-center justify-center", color.bg)}
                                            >
                                                <span className={cn("text-[6px] font-bold", color.text)}>{b.slice(0, 2)}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                                <span className="text-[8px] text-muted-foreground">
                                    {assignedBadges.length} assigned
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <span className="text-[9px] text-muted-foreground/40 italic">Empty</span>
                )}
            </div>

            {/* Project color bar */}
            {assignment && (
                <div className="w-1 shrink-0" style={{ backgroundColor: projectColor }} />
            )}
        </div>
    )
}

// ============================================================================
// User Assignment Panel (slides in on station click)
//
// Flow:
//   1. No assignment placed → show assignment picker (filtered by station compatibility)
//   2. Assignment placed → show stage selection + member assignment list
// ============================================================================

/** Stage label lookup for the assignment picker list */
function stageLabelFor(stageId: string): string {
    const def = ASSIGNMENT_STAGES.find((s) => s.id === stageId)
    return def?.shortLabel ?? stageId
}

function UserAssignmentPanel({
    station,
    assignment,
    allAssignments,
    placedSlugs,
    members,
    assignedBadges,
    shiftFilter: initialShiftFilter,
    selectedStage,
    onStageSelect,
    onPlaceAssignment,
    onAssign,
    onUnassign,
    onClose,
}: {
    station: StationDefinition
    assignment: MappedAssignment | null
    allAssignments: MappedAssignment[]
    placedSlugs: Set<string>
    members: TimelineMember[]
    assignedBadges: string[]
    shiftFilter: "1st" | "2nd"
    selectedStage: AssignmentStageId | null
    onStageSelect: (stage: AssignmentStageId) => void
    onPlaceAssignment: (assignment: MappedAssignment, startTime?: string) => void
    onAssign: (badge: string) => void
    onUnassign: (badge: string) => void
    onClose: () => void
}) {
    const [search, setSearch] = useState("")
    const [shiftFilter, setShiftFilter] = useState<"1st" | "2nd">(initialShiftFilter)

    // Time picker — default to current time
    const defaultTime = useMemo(() => {
        const now = new Date()
        const h = now.getHours()
        const m = now.getMinutes()
        return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
    }, [])
    const [selectedTime, setSelectedTime] = useState(defaultTime)

    const assignedSet = useMemo(() => new Set(assignedBadges), [assignedBadges])

    // ── Step 1: Assignment Picker ──────────────────────────────────────
    // Available assignments for this station type (not yet placed elsewhere)
    const availableAssignments = useMemo(() => {
        const eligibleStages = STATION_ASSIGNABLE_STAGES[station.category]
        return allAssignments
            .filter((a) => a.sheetKind === "assignment")
            .filter((a) => eligibleStages.includes(a.selectedStage as AssignmentStageId))
            .filter((a) => !placedSlugs.has(a.sheetSlug))
    }, [allAssignments, station.category, placedSlugs])

    const filteredAssignments = useMemo(() => {
        if (!search) return availableAssignments
        const q = search.toLowerCase()
        return availableAssignments.filter(
            (a) =>
                a.sheetName.toLowerCase().includes(q) ||
                a.sheetSlug.toLowerCase().includes(q) ||
                a.selectedStage.toLowerCase().includes(q),
        )
    }, [availableAssignments, search])

    // ── Step 2: Stage + Member selection (when assignment is placed) ───
    const compatibleStages = useMemo(() => {
        const stageIds = STATION_COMPATIBLE_STAGES[station.category]
        return stageIds
            .map((id) => ASSIGNMENT_STAGES.find((s) => s.id === id))
            .filter(Boolean) as (typeof ASSIGNMENT_STAGES)[number][]
    }, [station.category])

    const stageEstimate = selectedStage ? STAGE_ESTIMATES[selectedStage] ?? null : null

    const needsCrossShift = useMemo(() => {
        if (!stageEstimate) return false
        const shiftEnd = shiftFilter === "1st" ? 14.5 * 60 : 23 * 60
        const now = new Date()
        const currentMin = now.getHours() * 60 + now.getMinutes()
        const remainingShiftMin = Math.max(0, shiftEnd - currentMin)
        return stageEstimate.estimatedMinutes > remainingShiftMin
    }, [stageEstimate, shiftFilter])

    // Resolve which stage(s) to use for skill sorting:
    // If a specific stage is selected use that; otherwise use the station's compatible stages
    const skillSortStages = useMemo(() => {
        if (selectedStage) return [selectedStage]
        return STATION_COMPATIBLE_STAGES[station.category] as AssignmentStageId[]
    }, [selectedStage, station.category])

    const filteredMembers = useMemo(() => {
        let list = members.filter((m) => m.shift === shiftFilter || m.shift === `${shiftFilter}-shift`)
        if (search) {
            const q = search.toLowerCase()
            list = list.filter(
                (m) =>
                    m.fullName.toLowerCase().includes(q) ||
                    m.badge.toLowerCase().includes(q) ||
                    m.primaryRole.toLowerCase().includes(q),
            )
        }
        return list.sort((a, b) => {
            const aAssigned = assignedSet.has(a.badge) ? 0 : 1
            const bAssigned = assignedSet.has(b.badge) ? 0 : 1
            if (aAssigned !== bAssigned) return aAssigned - bAssigned
            // Sort by best skill across the relevant stage(s)
            const aSkill = Math.max(...skillSortStages.map((s) => getSkillLevel(a.skills, s)), 0)
            const bSkill = Math.max(...skillSortStages.map((s) => getSkillLevel(b.skills, s)), 0)
            if (aSkill !== bSkill) return bSkill - aSkill
            if (a.status === "active" && b.status !== "active") return -1
            if (b.status === "active" && a.status !== "active") return 1
            return a.fullName.localeCompare(b.fullName)
        })
    }, [members, shiftFilter, search, assignedSet, skillSortStages])

    const minPeople = stageEstimate?.minPeople ?? 1
    const needsMorePeople = assignedBadges.length < minPeople

    // ── Determine which step we're on ─────────────────────────────────
    const hasPlacedAssignment = assignment !== null

    return (
        <div className="flex flex-col h-full border-l bg-card">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
                <div className="min-w-0">
                    <div className={cn("text-[10px] font-semibold", STATION_CATEGORY_TEXT[station.category])}>
                        {station.label}
                    </div>
                    {assignment && (
                        <div className="text-[10px] text-muted-foreground truncate">
                            {cleanName(assignment.sheetName)}
                        </div>
                    )}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={onClose}>
                    <X className="h-3.5 w-3.5" />
                </Button>
            </div>

            {!hasPlacedAssignment ? (
                /* ══════════════════════════════════════════════════════════
                 * STEP 1: Assignment Picker
                 * ══════════════════════════════════════════════════════════ */
                <>
                    <div className="px-3 py-2 border-b">
                        <div className="text-[9px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                            Select Assignment
                        </div>
                        <p className="text-[9px] text-muted-foreground/60">
                            {availableAssignments.length} compatible assignment{availableAssignments.length !== 1 ? "s" : ""}
                        </p>
                    </div>

                    {/* Start time picker */}
                    <div className="px-3 py-2 border-b bg-muted/10">
                        <div className="text-[9px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">
                            Start Time
                        </div>
                        <div className="flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <input
                                type="time"
                                value={selectedTime}
                                onChange={(e) => setSelectedTime(e.target.value)}
                                className="h-7 px-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary w-full"
                            />
                        </div>
                        <p className="text-[8px] text-muted-foreground/50 mt-1">
                            Defaults to current time
                        </p>
                    </div>

                    {/* Search */}
                    <div className="px-3 py-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search assignments..."
                                className="w-full h-7 pl-7 pr-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Assignment list */}
                    <ScrollArea className="flex-1">
                        <div className="flex flex-col">
                            {filteredAssignments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                                    <Layers className="h-5 w-5 text-muted-foreground/30 mb-2" />
                                    <p className="text-[10px] text-muted-foreground/50">
                                        No compatible assignments available
                                    </p>
                                </div>
                            ) : (
                                filteredAssignments.map((a) => {
                                    const swsInfo = SWS_TYPE_REGISTRY[a.selectedSwsType as SwsTypeId]
                                    return (
                                        <button
                                            key={a.sheetSlug}
                                            type="button"
                                            className="flex items-center gap-2 px-3 py-2.5 text-left border-b border-border/10 hover:bg-muted/40 transition-colors focus:bg-muted/50 focus:outline-none"
                                            onClick={() => onPlaceAssignment(a, selectedTime)}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-semibold truncate">
                                                    {cleanName(a.sheetName)}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                    {swsInfo && (
                                                        <Badge
                                                            className="text-[7px] font-bold px-1 py-0 h-3.5"
                                                            style={{ backgroundColor: swsInfo.color || "#22c55e", color: "#fff" }}
                                                        >
                                                            {swsInfo.shortLabel}
                                                        </Badge>
                                                    )}
                                                    <span className="text-[9px] text-muted-foreground">
                                                        {a.rowCount} rows
                                                    </span>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="text-[8px] h-4 px-1.5 shrink-0">
                                                {stageLabelFor(a.selectedStage)}
                                            </Badge>
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </ScrollArea>
                </>
            ) : (
                /* ══════════════════════════════════════════════════════════
                 * STEP 2: Stage + Member Selection
                 * ══════════════════════════════════════════════════════════ */
                <>
                    {/* Stage selection */}
                    <div className="px-3 py-2 border-b">
                        <div className="text-[9px] font-semibold text-muted-foreground mb-1.5 uppercase tracking-wider">
                            Select Stage
                        </div>
                        <div className="flex flex-wrap gap-1">
                            {compatibleStages.map((stage) => {
                                const est = STAGE_ESTIMATES[stage.id]
                                const isSelected = selectedStage === stage.id
                                return (
                                    <button
                                        key={stage.id}
                                        type="button"
                                        className={cn(
                                            "text-[9px] px-2 py-1 rounded-md border transition-colors",
                                            isSelected
                                                ? "bg-primary text-primary-foreground border-primary"
                                                : "bg-muted/30 hover:bg-muted/60 border-border/50",
                                        )}
                                        onClick={() => onStageSelect(stage.id)}
                                        title={est ? `Est. ${est.label}` : undefined}
                                    >
                                        {stage.shortLabel}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Estimated duration + requirements */}
                    {selectedStage && stageEstimate && (
                        <div className="px-3 py-2 border-b bg-muted/10">
                            <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>Est. {stageEstimate.label}</span>
                                </div>
                                {minPeople > 1 && (
                                    <div className={cn(
                                        "flex items-center gap-1 text-[10px] font-medium",
                                        needsMorePeople ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400",
                                    )}>
                                        <AlertTriangle className="h-3 w-3" />
                                        <span>Min {minPeople} people</span>
                                    </div>
                                )}
                                {needsCrossShift && (
                                    <Badge variant="outline" className="text-[8px] h-4 px-1 border-amber-400 text-amber-600 dark:text-amber-400">
                                        Rolls into {shiftFilter === "1st" ? "2nd" : "1st"} shift
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Assigned members summary */}
                    {assignedBadges.length > 0 && (
                        <div className="px-3 py-2 border-b bg-primary/5">
                            <div className="text-[9px] font-semibold text-primary mb-1.5">
                                Assigned ({assignedBadges.length})
                                {needsMorePeople && (
                                    <span className="text-amber-600 dark:text-amber-400 ml-1">
                                        — need {minPeople - assignedBadges.length} more
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {assignedBadges.map((badge) => {
                                    const member = members.find((m) => m.badge === badge)
                                    const color = getAvatarColor(badge)
                                    const inits = member ? getAvatarInitials(member.fullName) : badge.slice(0, 2)
                                    return (
                                        <div
                                            key={badge}
                                            className="flex items-center gap-1 bg-card border rounded-full pl-1 pr-0.5 py-0.5"
                                        >
                                            <div className={cn("h-4 w-4 rounded-full flex items-center justify-center", color.bg)}>
                                                <span className={cn("text-[7px] font-bold", color.text)}>
                                                    {inits}
                                                </span>
                                            </div>
                                            <span className="text-[9px] font-medium truncate max-w-[60px]">
                                                {member?.firstName || badge}
                                            </span>
                                            <button
                                                type="button"
                                                className="h-4 w-4 rounded-full hover:bg-destructive/10 flex items-center justify-center transition-colors"
                                                onClick={() => onUnassign(badge)}
                                                title="Remove assignment"
                                            >
                                                <X className="h-2.5 w-2.5 text-muted-foreground hover:text-destructive" />
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Search */}
                    <div className="px-3 py-2 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search members..."
                                className="w-full h-7 pl-7 pr-2 text-xs rounded-md border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Shift toggle */}
                    <div className="px-3 py-1.5 border-b bg-muted/10 flex items-center gap-1.5">
                        <button
                            type="button"
                            className={cn(
                                "text-[9px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                                shiftFilter === "1st"
                                    ? "bg-cyan-500 text-white border-cyan-500"
                                    : "bg-transparent text-muted-foreground border-border hover:bg-muted/40",
                            )}
                            onClick={() => setShiftFilter("1st")}
                        >
                            1st Shift
                        </button>
                        <button
                            type="button"
                            className={cn(
                                "text-[9px] font-semibold px-2 py-0.5 rounded-full border transition-colors",
                                shiftFilter === "2nd"
                                    ? "bg-amber-500 text-white border-amber-500"
                                    : "bg-transparent text-muted-foreground border-border hover:bg-muted/40",
                            )}
                            onClick={() => setShiftFilter("2nd")}
                        >
                            2nd Shift
                        </button>
                        <span className="text-[9px] text-muted-foreground ml-auto">
                            {filteredMembers.length}
                        </span>
                    </div>

                    {/* Member list */}
                    <ScrollArea className="flex-1">
                        <div className="flex flex-col">
                            {filteredMembers.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 text-center">
                                    <Users className="h-5 w-5 text-muted-foreground/30 mb-2" />
                                    <p className="text-[10px] text-muted-foreground/50">
                                        No members found
                                    </p>
                                </div>
                            ) : (
                                filteredMembers.map((m) => {
                                    const isAssigned = assignedSet.has(m.badge)
                                    const skillLevel = Math.max(...skillSortStages.map((s) => getSkillLevel(m.skills, s)), 0)

                                    return (
                                        <button
                                            key={m.badge}
                                            type="button"
                                            className={cn(
                                                "flex items-center gap-2 px-3 py-2 text-left border-b border-border/10 transition-colors",
                                                isAssigned
                                                    ? "bg-primary/5 hover:bg-primary/10"
                                                    : "hover:bg-muted/40",
                                                "focus:bg-muted/50 focus:outline-none",
                                                m.status !== "active" && !isAssigned && "opacity-60",
                                            )}
                                            onClick={() => isAssigned ? onUnassign(m.badge) : onAssign(m.badge)}
                                        >
                                            <div className="relative shrink-0">
                                                <ProfileAvatar
                                                    fullName={m.fullName}
                                                    size="sm"
                                                    colorKey={m.badge}
                                                    status={isAssigned ? "active" : undefined}
                                                    className="[&_>div]:!h-7 [&_>div]:!w-7 [&_span.text-xs]:!text-[10px] [&_.border-4]:!border-0 [&_.shadow-xl]:!shadow-none"
                                                />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-[11px] font-medium truncate">{m.fullName}</div>
                                                <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                                                    <span className="font-mono">{m.badge}</span>
                                                    {m.primaryRole && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{m.primaryRole}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                            {skillLevel > 0 && !isAssigned && (
                                                <div className="flex items-center gap-0.5 shrink-0" title={`Skill: ${skillLevel}/4`}>
                                                    {Array.from({ length: 4 }, (_, i) => (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                "h-1.5 w-1.5 rounded-full",
                                                                i < skillLevel
                                                                    ? skillLevel >= 3 ? "bg-green-500"
                                                                        : skillLevel >= 2 ? "bg-amber-500"
                                                                            : "bg-orange-400"
                                                                    : "bg-muted-foreground/20",
                                                            )}
                                                        />
                                                    ))}
                                                </div>
                                            )}
                                            {isAssigned ? (
                                                <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                                                    <Check className="h-3 w-3 text-primary-foreground" />
                                                </div>
                                            ) : (
                                                <>
                                                    {skillLevel >= 3 && (
                                                        <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
                                                    )}
                                                    {skillLevel > 0 && skillLevel < 3 && (
                                                        <GraduationCap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                                    )}
                                                    <UserPlus className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                                                </>
                                            )}
                                        </button>
                                    )
                                })
                            )}
                        </div>
                    </ScrollArea>
                </>
            )}
        </div>
    )
}

// ============================================================================
// Main Component
// ============================================================================

export function ProjectTimelineView({
    project,
    assignments,
    onAssignmentClick,
    onPatchAssignment,
}: ProjectTimelineViewProps) {
    const [currentDate, setCurrentDate] = useState(() => new Date())
    const [selectedStationId, setSelectedStationId] = useState<string | null>(null)

    // Day navigation
    const goToPreviousDay = () =>
        setCurrentDate((d) => { const p = new Date(d); p.setDate(p.getDate() - 1); return p })
    const goToNextDay = () =>
        setCurrentDate((d) => { const n = new Date(d); n.setDate(n.getDate() + 1); return n })
    const goToToday = () => setCurrentDate(new Date())

    const dateStr = toISODate(currentDate)

    // Determine the current shift based on time
    const currentShift = useMemo((): "1st" | "2nd" => {
        const hour = new Date().getHours()
        return hour >= 4 && hour < 15 ? "1st" : "2nd"
    }, [])

    // Schedule: starts empty — user places assignments on stations manually
    const [scheduleMap, setScheduleMap] = useState<Map<string, ScheduledSlot>>(new Map())
    const [isSaving, setIsSaving] = useState(false)
    const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle")
    const [isLoadingSchedule, setIsLoadingSchedule] = useState(false)
    const hasUnsavedChanges = useRef(false)

    // Set of assignment slugs already placed on a station
    const placedSlugs = useMemo(() => {
        const set = new Set<string>()
        for (const [, slot] of scheduleMap) set.add(slot.assignmentSlug)
        return set
    }, [scheduleMap])

    // Map: stationId → ScheduledSlot[]
    const slotsByStation = useMemo(() => {
        const map = new Map<string, ScheduledSlot[]>()
        for (const [, slot] of scheduleMap) {
            if (slot.stationId) {
                if (!map.has(slot.stationId)) map.set(slot.stationId, [])
                map.get(slot.stationId)!.push(slot)
            }
        }
        return map
    }, [scheduleMap])

    // Map: slug → MappedAssignment
    const assignmentBySlug = useMemo(() => {
        const map = new Map<string, MappedAssignment>()
        for (const a of assignments) map.set(a.sheetSlug, a)
        return map
    }, [assignments])

    // Map: stationId → first assignment on that station (for left label)
    const assignmentByStation = useMemo(() => {
        const map = new Map<string, MappedAssignment>()
        for (const [, slot] of scheduleMap) {
            if (slot.stationId && !map.has(slot.stationId)) {
                const a = assignmentBySlug.get(slot.assignmentSlug)
                if (a) map.set(slot.stationId, a)
            }
        }
        return map
    }, [scheduleMap, assignmentBySlug])

    // Map: stationId → assigned badges (aggregated from all slots on that station)
    const badgesByStation = useMemo(() => {
        const map = new Map<string, string[]>()
        for (const [, slot] of scheduleMap) {
            if (slot.stationId && slot.assignedBadges.length > 0) {
                map.set(slot.stationId, [...(map.get(slot.stationId) ?? []), ...slot.assignedBadges])
            }
        }
        return map
    }, [scheduleMap])

    // Team members loaded from Share directory
    const [teamMembers, setTeamMembers] = useState<TimelineMember[]>([])
    const [crossShiftMembers, setCrossShiftMembers] = useState<TimelineMember[]>([])
    const [selectedStage, setSelectedStage] = useState<AssignmentStageId | null>(null)

    // Load real team members from API
    useEffect(() => {
        fetchTeamMembers(currentShift).then(setTeamMembers)
    }, [currentShift])

    // Load cross-shift members when needed
    const otherShift = currentShift === "1st" ? "2nd" : "1st"
    useEffect(() => {
        fetchTeamMembers(otherShift).then(setCrossShiftMembers)
    }, [otherShift])

    // Combine members — primary shift plus cross-shift when assignment rolls over
    const allMembers = useMemo(() => {
        return [...teamMembers, ...crossShiftMembers]
    }, [teamMembers, crossShiftMembers])

    // Selected station info
    const selectedStation = useMemo(
        () => (selectedStationId ? getAllStationsFlat().find((s) => s.id === selectedStationId) ?? null : null),
        [selectedStationId],
    )
    const selectedAssignment = selectedStationId ? assignmentByStation.get(selectedStationId) ?? null : null

    const totalCards = assignments.filter((a) => a.sheetKind === "assignment").length
    const scheduledCount = scheduleMap.size
    const showUserPanel = selectedStation !== null

    // ── Load saved schedule on mount / date change ──
    useEffect(() => {
        let cancelled = false
        async function loadSchedule() {
            setIsLoadingSchedule(true)
            try {
                const res = await fetch(
                    `/api/schedule/timeline/${encodeURIComponent(project.id)}?date=${dateStr}`,
                )
                if (!res.ok) return
                const data = await res.json()
                if (cancelled) return
                const slots: ScheduledSlot[] = data.slots ?? []
                if (slots.length > 0) {
                    const map = new Map<string, ScheduledSlot>()
                    for (const s of slots) map.set(s.assignmentSlug, s)
                    setScheduleMap(map)
                } else {
                    setScheduleMap(new Map())
                }
                hasUnsavedChanges.current = false
                setSaveStatus("idle")
            } catch {
                // no saved data — start fresh
            } finally {
                if (!cancelled) setIsLoadingSchedule(false)
            }
        }
        loadSchedule()
        return () => { cancelled = true }
    }, [project.id, dateStr])

    // ── Save handler ──
    const handleSave = useCallback(async () => {
        setIsSaving(true)
        setSaveStatus("idle")
        try {
            const slots = Array.from(scheduleMap.values())
            const res = await fetch(
                `/api/schedule/timeline/${encodeURIComponent(project.id)}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ date: dateStr, slots }),
                },
            )
            if (res.ok) {
                setSaveStatus("saved")
                hasUnsavedChanges.current = false
                setTimeout(() => setSaveStatus("idle"), 3000)
            } else {
                setSaveStatus("error")
            }
        } catch {
            setSaveStatus("error")
        } finally {
            setIsSaving(false)
        }
    }, [scheduleMap, project.id, dateStr])

    // Scroll sync
    const scrollContainerRef = useRef<HTMLDivElement>(null)
    const leftPanelRef = useRef<HTMLDivElement>(null)
    const dayHeaderRef = useRef<HTMLDivElement>(null)
    const isSyncing = useRef(false)

    const handleRightScroll = useCallback(() => {
        if (isSyncing.current) return
        isSyncing.current = true
        const right = scrollContainerRef.current
        const left = leftPanelRef.current
        if (right && left) left.scrollTop = right.scrollTop
        isSyncing.current = false
    }, [])

    const handleLeftScroll = useCallback(() => {
        if (isSyncing.current) return
        isSyncing.current = true
        const right = scrollContainerRef.current
        const left = leftPanelRef.current
        if (right && left) right.scrollTop = left.scrollTop
        isSyncing.current = false
    }, [])

    const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
        const el = scrollContainerRef.current
        if (!el) return
        if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
            e.preventDefault()
            el.scrollBy({ left: e.deltaY, behavior: "auto" })
        }
    }, [])

    const handlePlaceAssignment = useCallback((a: MappedAssignment, startTime?: string) => {
        if (!selectedStationId) return
        const station = getAllStationsFlat().find((s) => s.id === selectedStationId)
        if (!station) return
        const shiftStart = currentShift === "1st" ? 4 : 15
        const existingSlots = Array.from(scheduleMap.values()).filter(
            (s) => s.stationId === selectedStationId,
        )
        const slot = createSlotForAssignment(a, station, dateStr, shiftStart, existingSlots, startTime)
        setScheduleMap((prev) => {
            const next = new Map(prev)
            next.set(a.sheetSlug, slot)
            return next
        })
        hasUnsavedChanges.current = true
        setSaveStatus("idle")

        // Mark assignment as IN_PROGRESS when placed on timeline
        if (a.selectedStatus === "NOT_STARTED" && onPatchAssignment) {
            onPatchAssignment(a.sheetSlug, { selectedStatus: "IN_PROGRESS" })
        }
    }, [selectedStationId, currentShift, dateStr, scheduleMap, onPatchAssignment])

    const handleAssign = useCallback((badge: string) => {
        if (!selectedStationId) return
        setScheduleMap((prev) => {
            const next = new Map(prev)
            for (const [key, slot] of next) {
                if (slot.stationId === selectedStationId && !slot.assignedBadges.includes(badge)) {
                    next.set(key, {
                        ...slot,
                        assignedBadges: [...slot.assignedBadges, badge],
                    })
                }
            }
            return next
        })
        hasUnsavedChanges.current = true
        setSaveStatus("idle")
    }, [selectedStationId])

    const handleUnassign = useCallback((badge: string) => {
        if (!selectedStationId) return
        setScheduleMap((prev) => {
            const next = new Map(prev)
            for (const [key, slot] of next) {
                if (slot.stationId === selectedStationId) {
                    next.set(key, {
                        ...slot,
                        assignedBadges: slot.assignedBadges.filter((b) => b !== badge),
                    })
                }
            }
            return next
        })
        hasUnsavedChanges.current = true
        setSaveStatus("idle")
    }, [selectedStationId])

    const handleDragMove = useCallback((slug: string, newStartMinutes: number) => {
        setScheduleMap((prev) => {
            const next = new Map(prev)
            const existing = next.get(slug)
            if (!existing) return prev
            const h = Math.floor(newStartMinutes / 60)
            const m = newStartMinutes % 60
            next.set(slug, {
                ...existing,
                scheduledStart: `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`,
            })
            return next
        })
        hasUnsavedChanges.current = true
        setSaveStatus("idle")
    }, [])

    return (
        <div className="flex flex-col h-full w-full">
            {/* Top navigation bar */}
            <div className="flex items-center justify-between px-4 py-2 border-b bg-card shrink-0">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToPreviousDay}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={goToToday}>
                        <CalendarDays className="h-3.5 w-3.5" />
                        Today
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={goToNextDay}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                        {scheduledCount}/{totalCards} scheduled
                    </Badge>
                    <Button
                        variant={saveStatus === "saved" ? "outline" : "default"}
                        size="sm"
                        className={cn(
                            "h-8 gap-1.5 text-xs",
                            saveStatus === "saved" && "text-green-600 border-green-300",
                            saveStatus === "error" && "text-destructive",
                        )}
                        disabled={isSaving || scheduleMap.size === 0}
                        onClick={handleSave}
                    >
                        {isSaving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : saveStatus === "saved" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                        ) : (
                            <Save className="h-3.5 w-3.5" />
                        )}
                        {isSaving ? "Saving…" : saveStatus === "saved" ? "Saved" : "Save"}
                    </Button>
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                        {currentShift === "1st" ? "1st Shift" : "2nd Shift"}
                    </Badge>
                </div>
            </div>

            {/* Day/Shift header spanning full width */}
            <div ref={dayHeaderRef}>
                <DayHeaderRow date={currentDate} />
            </div>

            {/* Main content: LWC column + Station list + (optional) user panel + RIGHT timeline */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* ── LEFT: LWC headers + Station rows ── */}
                <div
                    ref={leftPanelRef}
                    className={cn(
                        "shrink-0 border-r overflow-y-auto bg-muted/10 flex flex-col",
                        showUserPanel ? "w-[200px] min-w-[200px]" : "w-[220px] min-w-[220px]",
                    )}
                    onScroll={handleLeftScroll}
                >
                    {/* Spacer matching the hour marker row in the timeline */}
                    <div className="shrink-0 h-6 border-b bg-card/95" />
                    <div>
                        {FLOOR_AREAS.map((area) => {
                            const meta = FLOOR_AREA_META[area]
                            const stations = FLOOR_STATIONS[area] ?? []

                            return (
                                <div key={area}>
                                    {/* LWC area header */}
                                    <div
                                        className={cn("flex items-center gap-1.5 px-2 border-b border-white/20", meta.color)}
                                        style={{ height: 28 }}
                                    >
                                        <span className="text-[10px] font-bold tracking-wide text-white uppercase">
                                            {meta.label}
                                        </span>
                                        <span className="text-[9px] text-white/70">
                                            {stations.length}
                                        </span>
                                    </div>

                                    {/* Station rows */}
                                    {stations.map((st) => (
                                        <StationRowLabel
                                            key={st.id}
                                            station={st}
                                            assignment={assignmentByStation.get(st.id) ?? null}
                                            project={project}
                                            isSelected={selectedStationId === st.id}
                                            assignedBadges={badgesByStation.get(st.id) ?? []}
                                            onClick={() =>
                                                setSelectedStationId((prev) => {
                                                    const next = prev === st.id ? null : st.id
                                                    if (next !== prev) setSelectedStage(null)
                                                    return next
                                                })
                                            }
                                        />
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* ── USER ASSIGNMENT PANEL (conditionally rendered) ── */}
                {showUserPanel && selectedStation && (
                    <div className="w-[260px] min-w-[260px] shrink-0 border-r overflow-y-auto">
                        <UserAssignmentPanel
                            station={selectedStation}
                            assignment={selectedAssignment}
                            allAssignments={assignments}
                            placedSlugs={placedSlugs}
                            members={allMembers}
                            assignedBadges={badgesByStation.get(selectedStationId!) ?? []}
                            shiftFilter={currentShift}
                            selectedStage={selectedStage}
                            onStageSelect={setSelectedStage}
                            onPlaceAssignment={handlePlaceAssignment}
                            onAssign={handleAssign}
                            onUnassign={handleUnassign}
                            onClose={() => { setSelectedStationId(null); setSelectedStage(null) }}
                        />
                    </div>
                )}

                {/* ── RIGHT PANEL: Timeline grid ── */}
                <div className="flex-1 overflow-hidden flex flex-col min-w-0">

                    <div
                        ref={scrollContainerRef}
                        className="flex-1 overflow-auto"
                        onWheel={handleWheel}
                        onScroll={handleRightScroll}
                    >
                        <div className="relative" style={{ width: TIMELINE_GRID_WIDTH, minHeight: "100%" }}>
                            {/* Hour markers — sticky at top of scroll area */}
                            <HourMarkerRow gridWidth={TIMELINE_GRID_WIDTH} />

                            {/* Global hour grid lines */}
                            {Array.from({ length: TIMELINE_TOTAL_HOURS + 1 }, (_, i) => (
                                <div
                                    key={`global-${i}`}
                                    className={cn(
                                        "absolute top-0 bottom-0 w-px",
                                        i % 2 === 0 ? "bg-border/50" : "bg-border/20",
                                    )}
                                    style={{ left: `${(i / TIMELINE_TOTAL_HOURS) * 100}%` }}
                                />
                            ))}

                            {/* Station swimlane rows — grouped by floor area */}
                            {FLOOR_AREAS.map((area) => {
                                const meta = FLOOR_AREA_META[area]
                                const stations = FLOOR_STATIONS[area] ?? []

                                return (
                                    <div key={area}>
                                        {/* Area header spacer matching left panel */}
                                        <div
                                            className={cn("border-b", meta.color, "bg-opacity-10")}
                                            style={{ height: 28 }}
                                        />

                                        {/* One row per station */}
                                        {stations.map((st) => {
                                            const stationSlots = slotsByStation.get(st.id) ?? []
                                            return (
                                                <div
                                                    key={st.id}
                                                    className={cn(
                                                        "relative border-b border-border/80 cursor-crosshair",
                                                        selectedStationId === st.id && "ring-1 ring-inset ring-primary/20",
                                                    )}
                                                    style={{ height: ROW_HEIGHT, width: TIMELINE_GRID_WIDTH }}
                                                    onClick={() =>
                                                        setSelectedStationId((prev) => {
                                                            const next = prev === st.id ? null : st.id
                                                            if (next !== prev) setSelectedStage(null)
                                                            return next
                                                        })
                                                    }
                                                >
                                                    {/* Time hover tooltip */}
                                                    <TimelineHoverTime gridWidth={TIMELINE_GRID_WIDTH} rowHeight={ROW_HEIGHT} />
                                                    {/* Hour grid lines */}
                                                    {Array.from({ length: TIMELINE_TOTAL_HOURS + 1 }, (_, i) => (
                                                        <div
                                                            key={i}
                                                            className={cn(
                                                                "absolute top-0 bottom-0 w-px",
                                                                i % 2 === 0 ? "bg-border/40" : "bg-border/15",
                                                            )}
                                                            style={{ left: `${(i / TIMELINE_TOTAL_HOURS) * 100}%` }}
                                                        />
                                                    ))}
                                                    <ShiftBackgrounds date={currentDate} />

                                                    {/* Scheduled cards on this station */}
                                                    {stationSlots.map((slot) => {
                                                        const a = assignmentBySlug.get(slot.assignmentSlug)
                                                        if (!a) return null
                                                        return (
                                                            <TimelineGridCard
                                                                key={slot.assignmentSlug}
                                                                assignment={a}
                                                                slot={slot}
                                                                project={project}
                                                                allMembers={allMembers}
                                                                station={st}
                                                                isStationSelected={selectedStationId === st.id}
                                                                selectedDate={dateStr}
                                                                onDragMove={handleDragMove}
                                                                onClick={() =>
                                                                    setSelectedStationId((prev) => {
                                                                        const next = prev === st.id ? null : st.id
                                                                        if (next !== prev) setSelectedStage(null)
                                                                        return next
                                                                    })
                                                                }
                                                            />
                                                        )
                                                    })}

                                                    {/* Empty state */}
                                                    {stationSlots.length === 0 && (
                                                        <div className="absolute inset-0 flex items-center justify-center">
                                                            <span className="text-[9px] text-muted-foreground/30 italic">—</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )
                            })}

                            <CurrentTimeIndicator />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// Internal helper
// ============================================================================

function getAllStationsFlat(): StationDefinition[] {
    return [...FLOOR_STATIONS.NEW_FLEX, ...FLOOR_STATIONS.ONSKID, ...FLOOR_STATIONS.OFFSKID]
}
