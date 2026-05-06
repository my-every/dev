"use client"

import { useCallback, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  Clock,
  Search,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react"
import type {
  FlattenedAssignment,
  PriorityLevel,
  ManifestCollectionFilters,
} from "@/types/project-manifest"
import type { AssignmentStageId } from "@/types/d380-assignment-stages"
import { ASSIGNMENT_STAGES } from "@/types/d380-assignment-stages"
import {
  filterFlattenedAssignments,
  groupByPriorityLevel,
  groupByStage,
  formatMinutesToTime,
  parseTimeToMinutes,
} from "@/lib/services"
import { FLOOR_AREA_META, type FloorArea } from "@/types/floor-layout"

// ============================================================================
// Priority Badge Component
// ============================================================================

interface PriorityBadgeProps {
  level: PriorityLevel
  className?: string
}

const priorityConfig: Record<
  PriorityLevel,
  { label: string; bgColor: string; textColor: string; icon: typeof AlertCircle | null }
> = {
  critical: {
    label: "Critical",
    bgColor: "bg-red-100",
    textColor: "text-red-700",
    icon: AlertCircle,
  },
  high: {
    label: "High",
    bgColor: "bg-orange-100",
    textColor: "text-orange-700",
    icon: ArrowUp,
  },
  medium: {
    label: "Medium",
    bgColor: "bg-yellow-100",
    textColor: "text-yellow-700",
    icon: null,
  },
  low: {
    label: "Low",
    bgColor: "bg-green-100",
    textColor: "text-green-700",
    icon: ArrowDown,
  },
}

export function PriorityBadge({ level, className }: PriorityBadgeProps) {
  const config = priorityConfig[level]
  const Icon = config.icon

  return (
    <Badge
      color={
        level === "critical"
          ? "red"
          : level === "high"
            ? "orange"
            : level === "medium"
              ? "yellow"
              : "green"
      }
      className={cn(config.bgColor, config.textColor, "gap-1", className)}
    >
      {Icon && <Icon className="h-3 w-3" />}
      {config.label}
    </Badge>
  )
}

// ============================================================================
// Priority Queue Card Component
// ============================================================================

// Time display mode for showing different estimate types
type TimeEstimateMode = "estimate" | "build_up" | "wire_list"

interface PriorityQueueCardProps {
  item: FlattenedAssignment
  onDragStart?: (item: FlattenedAssignment) => void
  onClick?: (item: FlattenedAssignment) => void
  onSchedule?: (item: FlattenedAssignment) => void
  timeEstimateMode?: TimeEstimateMode
  className?: string
}

export function PriorityQueueCard({
  item,
  onDragStart,
  onClick,
  onSchedule,
  timeEstimateMode = "estimate",
  className,
}: PriorityQueueCardProps) {
  const { assignment, project, priority } = item

  // Get LWC color
  const lwcColor =
    project.lwcType && FLOOR_AREA_META[project.lwcType as FloorArea]
      ? FLOOR_AREA_META[project.lwcType as FloorArea].color
      : "bg-gray-400"

  // Get stage definition
  const stageDef = ASSIGNMENT_STAGES.find((s) => s.id === assignment.stage)

  const handleDragStart = (e: React.DragEvent) => {
    // Set drag data for HTML5 drag and drop with all necessary fields
    const dragData = {
      type: "priority-queue-item",
      projectId: project.id,
      projectName: project.name,
      pdNumber: project.pdNumber,
      projectColor: project.color,
      sheetSlug: assignment.sheetSlug,
      sheetName: assignment.sheetName,
      stage: assignment.stage,
      status: assignment.status,
      unitType: assignment.unitType,
      buildUpEstTime: assignment.buildUpEstTime,
      wireListEstTime: assignment.wireListEstTime,
      estimatedMinutes: priority.remainingMinutes,
      lwcType: project.lwcType,
      priorityLevel: priority.level,
      priorityScore: priority.score,
    }
    e.dataTransfer.setData("application/json", JSON.stringify(dragData))
    e.dataTransfer.effectAllowed = "move"
    onDragStart?.(item)
  }

  return (
    <div
      className={cn(
        "group relative flex cursor-pointer items-start gap-2 rounded-lg border bg-card p-3 transition-all hover:shadow-md",
        priority.level === "critical" && "border-red-300 bg-red-50/50",
        priority.level === "high" && "border-orange-300 bg-orange-50/50",
        className
      )}
      draggable
      onDragStart={handleDragStart}
      onClick={() => onClick?.(item)}
    >
      {/* Drag handle */}
      <div className="mt-1 cursor-grab opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* LWC color indicator */}
      <div className={cn("mt-1 h-8 w-1 shrink-0 rounded-full", lwcColor)} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{assignment.sheetName}</p>
            <p className="truncate text-xs text-muted-foreground">
              {project.name} ({project.pdNumber})
            </p>
          </div>
          <PriorityBadge level={priority.level} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {/* Stage badge */}
          <Badge variant="dot" className="shrink-0">
            {stageDef?.shortLabel ?? assignment.stage}
          </Badge>

          {/* Time display - shows different estimates based on mode */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>
                    {timeEstimateMode === "build_up" && assignment.buildUpEstTime
                      ? assignment.buildUpEstTime
                      : timeEstimateMode === "wire_list" && assignment.wireListEstTime
                        ? assignment.wireListEstTime
                        : (() => {
                          // Calculate total estimated time from both phases
                          const buildUp = parseTimeToMinutes(assignment.buildUpEstTime || "0m")
                          const wireList = parseTimeToMinutes(assignment.wireListEstTime || "0m")
                          const total = buildUp + wireList
                          return total > 0 ? formatMinutesToTime(total) : "0m"
                        })()}
                  </span>
                  {(timeEstimateMode === "build_up" || timeEstimateMode === "wire_list") && (
                    <Badge size="sm" color="blue" className="ml-1 px-1 text-[9px]">
                      {timeEstimateMode === "build_up" ? "BU" : "WL"}
                    </Badge>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p>{priority.reason}</p>
                  {assignment.buildUpEstTime && (
                    <p className="text-xs text-muted-foreground">Build Up: {assignment.buildUpEstTime}</p>
                  )}
                  {assignment.wireListEstTime && (
                    <p className="text-xs text-muted-foreground">Wire List: {assignment.wireListEstTime}</p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Unit type */}
          {assignment.unitType && (
            <span className="text-muted-foreground">{assignment.unitType}</span>
          )}

          {/* Schedule button */}
          {onSchedule && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-6 gap-1 px-2 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSchedule(item)
                    }}
                  >
                    <ArrowRight className="h-3 w-3" />
                    Schedule
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Add to timeline (next available slot)</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// Priority Queue Group Component
// ============================================================================

interface PriorityQueueGroupProps {
  title: string
  items: FlattenedAssignment[]
  defaultExpanded?: boolean
  onDragStart?: (item: FlattenedAssignment) => void
  onItemClick?: (item: FlattenedAssignment) => void
  onSchedule?: (item: FlattenedAssignment) => void
  timeEstimateMode?: TimeEstimateMode
}

function PriorityQueueGroup({
  title,
  items,
  defaultExpanded = true,
  onDragStart,
  onItemClick,
  onSchedule,
  timeEstimateMode,
}: PriorityQueueGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (items.length === 0) return null

  return (
    <div className="space-y-2">
      <button
        className="flex w-full items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span>{title}</span>
        <Badge size="sm" color="gray" className="ml-auto">
          {items.length}
        </Badge>
      </button>

      {expanded && (
        <div className="space-y-2 pl-6">
          {items.map((item) => (
            <PriorityQueueCard
              key={`${item.project.id}-${item.assignment.sheetSlug}`}
              item={item}
              onDragStart={onDragStart}
              onClick={onItemClick}
              onSchedule={onSchedule}
              timeEstimateMode={timeEstimateMode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Project with Stage Subgroups Component
// ============================================================================

interface ProjectStageGroupProps {
  projectName: string
  projectColor?: string
  items: FlattenedAssignment[]
  defaultExpanded?: boolean
  onDragStart?: (item: FlattenedAssignment) => void
  onItemClick?: (item: FlattenedAssignment) => void
  onSchedule?: (item: FlattenedAssignment) => void
  timeEstimateMode?: TimeEstimateMode
}

function ProjectStageGroup({
  projectName,
  projectColor,
  items,
  defaultExpanded = true,
  onDragStart,
  onItemClick,
  onSchedule,
  timeEstimateMode,
}: ProjectStageGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  
  // Group items by stage
  const stageGroups = useMemo(() => {
    const groups = new Map<string, FlattenedAssignment[]>()
    for (const item of items) {
      const stage = item.assignment.stage
      if (!groups.has(stage)) {
        groups.set(stage, [])
      }
      groups.get(stage)!.push(item)
    }
    return groups
  }, [items])
  
  // Sort stages by ASSIGNMENT_STAGES order
  const sortedStages = useMemo(() => {
    const stageOrder = ASSIGNMENT_STAGES.map(s => s.id)
    return Array.from(stageGroups.entries()).sort((a, b) => {
      const aIndex = stageOrder.indexOf(a[0] as AssignmentStageId)
      const bIndex = stageOrder.indexOf(b[0] as AssignmentStageId)
      return aIndex - bIndex
    })
  }, [stageGroups])

  if (items.length === 0) return null

  return (
    <div className="space-y-1">
      <button
        className="flex w-full items-center gap-2 text-sm font-medium hover:bg-accent/50 rounded-md px-2 py-1.5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
        <div 
          className="w-2 h-2 rounded-full shrink-0" 
          style={{ backgroundColor: projectColor || "#6b7280" }}
        />
        <span className="truncate">{projectName}</span>
        <Badge size="sm" color="gray" className="ml-auto shrink-0">
          {items.length}
        </Badge>
      </button>

      {expanded && (
        <div className="ml-4 space-y-2 border-l-2 pl-3" style={{ borderColor: projectColor || "#e5e7eb" }}>
          {sortedStages.map(([stageId, stageItems]) => {
            const stageDef = ASSIGNMENT_STAGES.find(s => s.id === stageId)
            return (
              <div key={stageId} className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <Badge variant="dot" size="sm" className="text-[10px] h-5">
                    {stageDef?.shortLabel || stageId}
                  </Badge>
                  <span className="text-muted-foreground/60">
                    {stageItems.length} {stageItems.length === 1 ? "item" : "items"}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {stageItems.map((item) => (
                    <PriorityQueueCard
                      key={`${item.project.id}-${item.assignment.sheetSlug}`}
                      item={item}
                      onDragStart={onDragStart}
                      onClick={onItemClick}
                      onSchedule={onSchedule}
                      timeEstimateMode={timeEstimateMode}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Main Priority Queue Panel Component
// ============================================================================

export type QueueGroupBy = "priority" | "stage" | "project"
export type { TimeEstimateMode }

interface PriorityQueuePanelProps {
  assignments: FlattenedAssignment[]
  groupBy?: QueueGroupBy
  onGroupByChange?: (groupBy: QueueGroupBy) => void
  onDragStart?: (item: FlattenedAssignment) => void
  onItemClick?: (item: FlattenedAssignment) => void
  onSchedule?: (item: FlattenedAssignment, stationId: string, startTime: string) => void
  timeEstimateMode?: TimeEstimateMode
  onTimeEstimateModeChange?: (mode: TimeEstimateMode) => void
  /** Hide items that are already assigned/in progress */
  hideAssigned?: boolean
  embedded?: boolean
  showTitle?: boolean
  className?: string
}

export function PriorityQueuePanel({
  assignments,
  groupBy: controlledGroupBy,
  onGroupByChange,
  onDragStart,
  onItemClick,
  onSchedule,
  timeEstimateMode: controlledTimeMode,
  onTimeEstimateModeChange,
  hideAssigned = true,
  embedded = false,
  showTitle = !embedded,
  className,
}: PriorityQueuePanelProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filters] = useState<ManifestCollectionFilters>({})
  const [internalGroupBy, setInternalGroupBy] = useState<QueueGroupBy>("project")
  const [internalTimeMode, setInternalTimeMode] = useState<TimeEstimateMode>("estimate")

  // Use controlled or internal time mode
  const timeMode = controlledTimeMode ?? internalTimeMode
  const handleTimeModeChange = (mode: TimeEstimateMode) => {
    setInternalTimeMode(mode)
    onTimeEstimateModeChange?.(mode)
  }

  // Use controlled or internal groupBy
  const groupBy = controlledGroupBy ?? internalGroupBy
  const handleGroupByChange = (value: QueueGroupBy) => {
    setInternalGroupBy(value)
    onGroupByChange?.(value)
  }

  // Handle scheduling - auto-assign to first available station at current time
  const handleSchedule = useCallback((item: FlattenedAssignment) => {
    if (!onSchedule) return
    // Use a default station and current time for quick scheduling
    const now = new Date()
    const startTime = `${now.getHours().toString().padStart(2, '0')}:${Math.ceil(now.getMinutes() / 15) * 15 % 60}`.padEnd(5, '0').slice(0, 5)
    onSchedule(item, "new-flex-bu-1", startTime)
  }, [onSchedule])

  // Filter assignments
  const filteredAssignments = useMemo(() => {
    const withSearch: ManifestCollectionFilters = {
      ...filters,
      searchQuery: searchQuery || undefined,
    }
    let result = filterFlattenedAssignments(assignments, withSearch)
    
    // Filter out already assigned/in-progress items
    if (hideAssigned) {
      result = result.filter(item => 
        item.assignment.status !== "IN_PROGRESS" && 
        item.assignment.status !== "COMPLETED"
      )
    }
    
    return result
  }, [assignments, filters, searchQuery, hideAssigned])

  // Group assignments
  const groupedContent = useMemo(() => {
    switch (groupBy) {
      case "priority": {
        const groups = groupByPriorityLevel(filteredAssignments)
        return (
          <>
            <PriorityQueueGroup
              title="Critical"
              items={groups.critical}
              onDragStart={onDragStart}
              onItemClick={onItemClick}
              onSchedule={onSchedule ? handleSchedule : undefined}
              timeEstimateMode={timeMode}
            />
            <PriorityQueueGroup
              title="High Priority"
              items={groups.high}
              onDragStart={onDragStart}
              onItemClick={onItemClick}
              onSchedule={onSchedule ? handleSchedule : undefined}
              timeEstimateMode={timeMode}
            />
            <PriorityQueueGroup
              title="Medium Priority"
              items={groups.medium}
              defaultExpanded={false}
              onDragStart={onDragStart}
              onItemClick={onItemClick}
              onSchedule={onSchedule ? handleSchedule : undefined}
              timeEstimateMode={timeMode}
            />
            <PriorityQueueGroup
              title="Low Priority"
              items={groups.low}
              defaultExpanded={false}
              onDragStart={onDragStart}
              onItemClick={onItemClick}
              onSchedule={onSchedule ? handleSchedule : undefined}
              timeEstimateMode={timeMode}
            />
          </>
        )
      }

      case "stage": {
        const groups = groupByStage(filteredAssignments)
        const stageOrder = ASSIGNMENT_STAGES.filter((s) => !s.isQueue)
        return (
          <>
            {stageOrder.map((stage) => {
              const items = groups[stage.id] ?? []
              if (items.length === 0) return null
              return (
                <PriorityQueueGroup
                  key={stage.id}
                  title={stage.label}
                  items={items}
                  onDragStart={onDragStart}
                  onItemClick={onItemClick}
                  onSchedule={onSchedule ? handleSchedule : undefined}
                  timeEstimateMode={timeMode}
                />
              )
            })}
          </>
        )
      }

      case "project": {
        const projectGroups = new Map<string, FlattenedAssignment[]>()
        for (const item of filteredAssignments) {
          const key = item.project.id
          if (!projectGroups.has(key)) {
            projectGroups.set(key, [])
          }
          projectGroups.get(key)!.push(item)
        }

        return (
          <>
            {Array.from(projectGroups.entries()).map(([projectId, items]) => (
              <ProjectStageGroup
                key={projectId}
                projectName={items[0].project.name}
                projectColor={items[0].project.color}
                items={items}
                onDragStart={onDragStart}
                onItemClick={onItemClick}
                onSchedule={onSchedule ? handleSchedule : undefined}
                timeEstimateMode={timeMode}
              />
            ))}
          </>
        )
      }
    }
  }, [groupBy, filteredAssignments, onDragStart, onItemClick, onSchedule, handleSchedule, timeMode])

  const panelHeader = (
    <div className="shrink-0 space-y-3 pb-3">
        {showTitle ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-base font-semibold">
              <Layers className="h-4 w-4" />
              Priority Queue
            </div>
            <Badge variant="dot">{filteredAssignments.length}</Badge>
          </div>
        ) : null}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search assignments..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Group By buttons */}
        <div className="flex gap-1">
          <Button
            variant={groupBy === "priority" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => handleGroupByChange("priority")}
          >
            Priority
          </Button>
          <Button
            variant={groupBy === "stage" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => handleGroupByChange("stage")}
          >
            Stage
          </Button>
          <Button
            variant={groupBy === "project" ? "secondary" : "ghost"}
            size="sm"
            className="flex-1 text-xs"
            onClick={() => handleGroupByChange("project")}
          >
            Project
          </Button>
        </div>

      </div>
  )

  const panelBody = (
    <div className="flex-1 overflow-hidden p-0">
      <ScrollArea className="h-full px-4 pb-4">
        <div className="space-y-4">{groupedContent}</div>
      </ScrollArea>
    </div>
  )

  if (embedded) {
    return (
      <div className={cn("flex h-full flex-col", className)}>
        {panelHeader}
        {panelBody}
      </div>
    )
  }

  return (
    <Card className={cn("flex h-full max-w-2xl flex-col", className)}>
      <CardHeader className="shrink-0 space-y-3 pb-3">{panelHeader}</CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">{panelBody}</CardContent>
    </Card>
  )
}
