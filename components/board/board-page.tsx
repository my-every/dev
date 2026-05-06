'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { AssignmentCardCompact } from '@/components/board/assignment-card-compact'
import { AssignmentSummaryBar } from '@/components/board/assignment-summary-bar'
import { BoardAssignedUsersSidePanel } from '@/components/board/board-assigned-users-side-panel'
import { BoardFloatingActions } from '@/components/board/board-floating-actions'
import { MemberQuickPicker } from '@/components/board/member-quick-picker'
import { MultiStepProjectAssignmentModal, type AssignmentModalTriggerContext } from '@/components/board/multi-step-project-assignment-modal'
import { QuickAssignmentPanel } from '@/components/board/quick-assignment-panel'
import PageLayout from '@/components/layout/page-layout'
import { ProjectScheduler } from '@/components/scheduling/project-scheduler'
import { UserList } from '@/components/scheduling/user-list'
import { SchedulingProvider } from '@/contexts/scheduling-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getAssignmentRoleLabel, type AssignmentStageRole } from '@/lib/board/stage-workspaces'
import type { BoardAssignmentView, BoardDataResponse, BoardMemberView, BoardProjectView } from '@/lib/board/types'
import { useSession } from '@/hooks/use-session'
import { cn } from '@/lib/utils'
import { getShiftForTime } from '@/lib/services/timeline-bridge'
import { getAllStations, lwcToFloorArea, STATION_CATEGORY_COLORS, type FloorArea } from '@/types/floor-layout'
import type { Assignment as SchedulingAssignment, Project as SchedulingProject, Resource } from '@/types/scheduling'
import type { FlattenedAssignment, ManifestAssignmentStatus, PriorityLevel } from '@/types/project-manifest'

function getPriorityLevel(status: string, stageRole: AssignmentStageRole): PriorityLevel {
  if (status === 'BLOCKED') {
    return 'critical'
  }

  if (stageRole === 'BIQ' || stageRole === 'TEST') {
    return 'high'
  }

  if (stageRole === 'WIRING' || stageRole === 'BOX_BUILD') {
    return 'medium'
  }

  return 'low'
}

function getStatusTone(status: string) {
  switch (status) {
    case 'Complete':
      return 'bg-emerald-100 text-emerald-700'
    case 'Blocked':
      return 'bg-red-100 text-red-700'
    case 'In Progress':
      return 'bg-blue-100 text-blue-700'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

function buildMembersCsv(members: BoardMemberView[]) {
  const headers = [
    'badge',
    'pin',
    'requires_pin_change',
    'legal_name',
    'preferred_name',
    'initials',
    'role',
    'primary_lwc',
    'shift',
    'email',
    'phone',
    'is_active',
    'created_at',
    'updated_at',
    'hire_date',
    'years_experience',
    'skill_brand_list',
    'skill_branding',
    'skill_build_up',
    'skill_wiring',
    'skill_wiring_ipv',
    'skill_box_build',
    'skill_cross_wire',
    'skill_test',
    'skill_pwr_check',
    'skill_biq',
    'skill_green_change',
  ]

  const lines = members.map(member => {
    const shift = member.shift.startsWith('2') ? 2 : 1
    return [
      member.badge,
      '',
      'false',
      member.fullName,
      member.preferredName ?? member.fullName,
      member.initials ?? member.fullName.slice(0, 2).toUpperCase(),
      member.role,
      member.primaryLwc,
      shift,
      '',
      '',
      member.availabilityStatus !== 'OFF_SHIFT' ? 'true' : 'false',
      '',
      '',
      '',
      0,
      member.skills.brandList ?? 0,
      member.skills.branding ?? 0,
      member.skills.buildUp ?? 0,
      member.skills.wiring ?? 0,
      member.skills.wiringIpv ?? 0,
      member.skills.boxBuild ?? 0,
      member.skills.crossWire ?? 0,
      member.skills.test ?? 0,
      member.skills.pwrCheck ?? 0,
      member.skills.biq ?? 0,
      member.skills.greenChange ?? 0,
    ].join(',')
  })

  return [headers.join(','), ...lines].join('\n')
}

function buildSchedulingProjects(projects: BoardProjectView[]): SchedulingProject[] {
  return projects.map(project => ({
    id: project.id,
    name: project.name,
    description: `${project.pdNumber} · Unit ${project.unitNumber || 'TBD'}`,
    color: '#111827',
    estimatedMinutes: project.assignments.length * 30,
    priority: 'medium',
    requiredSkills: [],
  }))
}

function stageRoleToStationCategory(stageRole: AssignmentStageRole) {
  switch (stageRole) {
    case 'BUILD_UP':
      return 'BUILD_UP'
    case 'WIRING':
      return 'WIRING'
    case 'BOX_BUILD':
    case 'CROSS_WIRING':
    case 'TEST':
    case 'BIQ':
      return 'TEST'
    default:
      return 'BUILD_UP'
  }
}

function chooseStationId(lwcType: string, stageRole: AssignmentStageRole, seed: string) {
  const floorArea = lwcToFloorArea(lwcType)
  const stationCategory = stageRoleToStationCategory(stageRole)
  const stations = getAllStations().filter(station => station.floorArea === floorArea && station.category === stationCategory)
  if (stations.length === 0) {
    return getAllStations()[0]?.id ?? 'NEW_FLEX_buildUpTable1'
  }

  const numericSeed = Array.from(seed).reduce((total, char) => total + char.charCodeAt(0), 0)
  return stations[numericSeed % stations.length]!.id
}

function buildSchedulingResources(): Resource[] {
  return getAllStations().map(station => ({
    id: station.id,
    name: station.shortLabel,
    shiftId: '1st',
    skills: [station.label, station.shortLabel],
    maxOvertimeMinutes: 120,
    isActive: true,
  }))
}

function buildSchedulingAssignments(projects: BoardProjectView[], members: BoardMemberView[]): SchedulingAssignment[] {
  const membersByBadge = new Map(members.map(member => [member.badge, member]))

  return projects
    .flatMap(project => project.assignments.map((assignment, index) => ({ project, assignment, index })))
    .filter(entry => Boolean(entry.assignment.assignedBadge))
    .map(({ project, assignment, index }) => {
      const assignedMember = assignment.assignedBadge ? membersByBadge.get(assignment.assignedBadge) : null
      const shiftId = assignment.shiftId ?? (assignedMember?.shift.startsWith('2') ? '2nd' : '1st')
      const startTime = assignment.startTime ?? (shiftId === '2nd' ? '15:00' : '06:00')
      const endTime = assignment.endTime ?? (shiftId === '2nd' ? '17:00' : '08:00')
      const resourceId = assignment.workAreaId ?? chooseStationId(project.lwcType, assignment.stageRole, `${assignment.assignmentId}-${index}`)
      const floorArea = lwcToFloorArea(project.lwcType)
      const priorityLevel = getPriorityLevel(assignment.status, assignment.stageRole)
      const schedulingPriority = priorityLevel === 'critical' ? 'urgent' : priorityLevel
      const color = STATION_CATEGORY_COLORS[stageRoleToStationCategory(assignment.stageRole) as keyof typeof STATION_CATEGORY_COLORS]
        .replace('bg-', '')

      return {
        id: assignment.assignmentId,
        projectId: project.id,
        projectName: `${project.pdNumber} ${project.name}`,
        resourceId,
        shiftId,
        status: assignment.workflowStatus === 'in-progress' ? 'in-progress' : 'scheduled',
        priority: schedulingPriority,
        isOvertime: false,
        assignees: assignedMember ? [{ id: assignedMember.badge, name: assignedMember.preferredName || assignedMember.fullName }] : [],
        startTime,
        endTime,
        estimatedStartTime: startTime,
        estimatedEndTime: endTime,
        notes: `${assignment.sheetName} · ${assignment.stageRoleLabel} · ${floorArea.replace('_', ' ')}`,
        color,
      }
    })
}

function findBoardAssignmentForDroppedQueueItem(
  projects: BoardProjectView[],
  data: Record<string, unknown>,
) {
  const projectId = String(data.projectId ?? '')
  const sheetSlug = String(data.sheetSlug ?? '')

  return projects
    .flatMap(project => project.assignments)
    .find(assignment => assignment.projectId === projectId && assignment.sheetSlug === sheetSlug)
}

function buildFlattenedAssignments(projects: BoardProjectView[]): FlattenedAssignment[] {
  return projects.flatMap(project =>
    project.assignments
      .filter(assignment => !assignment.assignedBadge)
      .map((assignment, index) => {
        const priorityLevel = getPriorityLevel(assignment.status, assignment.stageRole)
        return {
          assignment: {
            sheetSlug: assignment.sheetSlug,
            sheetName: assignment.sheetName,
            kind: 'operational',
            sheetPath: '',
            rowCount: Math.max(assignment.partNumbers.length, 1) * 8,
            hasData: true,
            swsType: 'PANEL',
            stage: assignment.stage as never,
            status: assignment.status as ManifestAssignmentStatus,
            unitType: project.unitNumber,
            buildUpEstTime: assignment.stageRole === 'BUILD_UP' ? '2h 0m' : '45m',
            wireListEstTime: assignment.stageRole === 'WIRING' ? '3h 30m' : '1h 0m',
            files: {
              wireListSchemaPath: '',
              brandListSchemaPath: '',
              buildUpSWSSchemaPath: '',
            },
            partNumbers: assignment.partNumbers,
            layout: null,
            devices: {},
            panducts: [],
            rails: [],
            whiteLabels: [],
            blueLabels: [],
            priority: {
              score: index + 1,
              level: priorityLevel,
              remainingMinutes: priorityLevel === 'high' ? 120 : priorityLevel === 'medium' ? 240 : 480,
              deadlineMultiplier: 1,
              stageWeight: 1,
              reason: `${assignment.stageRoleLabel} ready for scheduling`,
            },
          },
          project: {
            id: project.id,
            name: project.name,
            pdNumber: project.pdNumber,
            color: '#16a34a',
            dueDate: new Date().toISOString(),
            lwcType: lwcToFloorArea(project.lwcType) as FloorArea,
          },
          priority: {
            score: index + 1,
            level: priorityLevel,
            remainingMinutes: priorityLevel === 'high' ? 120 : priorityLevel === 'medium' ? 240 : 480,
            deadlineMultiplier: 1,
            stageWeight: 1,
            reason: `${assignment.stageRoleLabel} ready for scheduling`,
          },
          effectiveDeadline: new Date().toISOString(),
        }
      }),
  )
}

function findBoardAssignmentForQueueItem(
  projects: BoardProjectView[],
  item: FlattenedAssignment,
) {
  return projects
    .flatMap(project => project.assignments)
    .find(assignment => assignment.sheetSlug === item.assignment.sheetSlug && assignment.projectId === item.project.id)
}

function ActiveAssignmentsRail({
  projects,
  className,
}: {
  projects: BoardProjectView[]
  className?: string
}) {
  const router = useRouter()
  const activeAssignments = projects.flatMap(project =>
    project.assignments.filter(assignment => assignment.assignedBadge).map(assignment => ({ project, assignment })),
  )

  return (
    <ScrollArea className={cn('h-[22rem] xl:h-[calc(100vh-24rem)]', className)}>
      <div className="space-y-3 p-1">
        {activeAssignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
            No active scheduled work yet.
          </div>
        ) : (
          activeAssignments.map(({ project, assignment }) => (
            <div key={assignment.assignmentId} className="rounded-2xl border border-border/70 bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{project.pdNumber}</div>
                  <div className="mt-1 font-semibold">{assignment.sheetName}</div>
                </div>
                <Badge className={cn('rounded-full', getStatusTone(project.status))}>{project.status}</Badge>
              </div>
              <div className="mt-2 text-sm text-muted-foreground">{assignment.stageRoleLabel ?? getAssignmentRoleLabel(assignment.stageRole)}</div>
              {assignment.workspaceHref ? (
                <Button variant="outline" className="mt-3 w-full" onClick={() => router.push(assignment.workspaceHref!)}>
                  Open Workspace
                </Button>
              ) : null}
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  )
}

function BoardSchedulerWorkspace({
  data,
  canAssign,
  onOpenAssignmentFlow,
  onPersistTimelineUpdate,
}: {
  data: BoardDataResponse
  canAssign: boolean
  onOpenAssignmentFlow: (context: AssignmentModalTriggerContext) => void
  onPersistTimelineUpdate: (params: { assignmentId: string, resourceId: string, startTime: string, endTime?: string, shiftId: '1st' | '2nd' }) => void
}) {
  const queueAssignments = useMemo(() => buildFlattenedAssignments(data.projects), [data.projects])
  const schedulingProjects = useMemo(() => buildSchedulingProjects(data.projects), [data.projects])
  const schedulingResources = useMemo(() => buildSchedulingResources(), [])
  const schedulingAssignments = useMemo(() => buildSchedulingAssignments(data.projects, data.members), [data.members, data.projects])
  const assignedUserIds = useMemo(() => new Set(data.projects.flatMap(project => project.assignments.map(assignment => assignment.assignedBadge).filter(Boolean) as string[])), [data.projects])
  const membersCsv = useMemo(() => buildMembersCsv(data.members), [data.members])

  return (
    <SchedulingProvider
      key={`${data.summary.assignedCount}-${data.summary.assignmentCount}`}
      initialAssignments={schedulingAssignments}
      initialResources={schedulingResources}
      initialProjects={schedulingProjects}
    >
      <div className="space-y-6">
        <Card className="overflow-hidden rounded-[2rem]">
          <CardHeader className="border-b pb-4">
         
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-2 max-w-2xl">
                <CardTitle>Project Board</CardTitle>
                <CardDescription className="max-w-lg">
                  Timeline scheduling workspace driven by board assignments, stage routing, and team competency. The pending queue now lives in the floating launcher.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="dot">{data.summary.projectCount} projects</Badge>
                <Badge>{data.summary.assignedCount} active</Badge>
                <Badge variant="dot">{queueAssignments.length} pending queue</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <ProjectScheduler
              className="min-h-[30rem] lg:min-h-[42rem]"
              onStationClick={(station) => {
                onOpenAssignmentFlow({
                  source: 'station',
                  stationId: station.id,
                  stationLabel: station.shortName ?? station.name,
                  lockWorkArea: true,
                })
              }}
              onStationTimeSelect={(station, startTime) => {
                onOpenAssignmentFlow({
                  source: 'timeline',
                  stationId: station.id,
                  stationLabel: station.shortName ?? station.name,
                  shiftId: getShiftForTime(startTime),
                  startTime,
                  lockWorkArea: true,
                })
              }}
              onAssignmentMovePersist={(assignmentId, resourceId, startTime, shiftId) => {
                onPersistTimelineUpdate({ assignmentId, resourceId, startTime, shiftId })
              }}
              onAssignmentResizePersist={(assignmentId, startTime, endTime, shiftId) => {
                const currentResourceId = schedulingAssignments.find(assignment => assignment.id === assignmentId)?.resourceId
                if (!currentResourceId) {
                  return
                }

                onPersistTimelineUpdate({ assignmentId, resourceId: currentResourceId, startTime, endTime, shiftId })
              }}
              onDropFromQueue={(stationId, startTime, droppedData) => {
                const droppedAssignment = findBoardAssignmentForDroppedQueueItem(data.projects, droppedData)
                if (!droppedAssignment) {
                  return
                }

                const station = getAllStations().find(entry => entry.id === stationId)
                onOpenAssignmentFlow({
                  source: 'timeline',
                  stationId,
                  stationLabel: station?.shortLabel ?? station?.label ?? stationId,
                  shiftId: getShiftForTime(startTime),
                  startTime,
                  lockWorkArea: true,
                  preselectedAssignmentIds: [droppedAssignment.assignmentId],
                })
              }}
            />
          </CardContent>
        </Card>

     
      </div>
    </SchedulingProvider>
  )
}

export function BoardPage() {
  const { user, hasAnyRole } = useSession()
  const canAssign = hasAnyRole(['TEAM_LEAD', 'DEVELOPER'])
  const [data, setData] = useState<BoardDataResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [assignmentModalContext, setAssignmentModalContext] = useState<AssignmentModalTriggerContext | null>(null)
  const [actorBadge, setActorBadge] = useState(user?.badge ?? '')
  const [actorPin, setActorPin] = useState('')
  const [sidePanelView, setSidePanelView] = useState<'team' | 'quick-assign'>('team')

  const loadBoard = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/board/data', { cache: 'no-store' })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const payload = await response.json() as BoardDataResponse
      setData(payload)
    } catch {
      setError('Failed to load board data.')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadBoard()
  }, [])

  useEffect(() => {
    if (user?.badge) {
      setActorBadge(user.badge)
    }
  }, [user?.badge])

  const queueAssignments = useMemo(
    () => (data ? buildFlattenedAssignments(data.projects) : []),
    [data],
  )

  const handleQuickAssign = async (assignmentId: string, memberBadge: string) => {
    try {
      const response = await fetch('/api/board/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId,
          memberBadge,
          actorBadge: actorBadge || user?.badge,
        }),
      })
      if (!response.ok) {
        throw new Error('Assignment failed')
      }
      await loadBoard()
    } catch (error) {
      console.error('Quick assign failed:', error)
    }
  }
  const handlePersistTimelineUpdate = async (params: {
    assignmentId: string
    resourceId: string
    startTime: string
    endTime?: string
    shiftId: '1st' | '2nd'
  }) => {
    try {
      await fetch('/api/board/assignment/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      await loadBoard()
    } catch (nextError) {
      console.error('Failed to persist timeline update', nextError)
    }
  }

  return (
    <PageLayout
      title="Board"
      showAside={false}
      activeRootId="board"
      sidePanelContent={
        <div className="flex h-full flex-col">
          {/* Side Panel View Toggle */}
          <div className="flex items-center gap-1 border-b p-2">
            <button
              onClick={() => setSidePanelView('team')}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                sidePanelView === 'team'
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Team
            </button>
            <button
              onClick={() => setSidePanelView('quick-assign')}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                sidePanelView === 'quick-assign'
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              Quick Assign
            </button>
          </div>
          {/* Side Panel Content */}
          <div className="flex-1 overflow-hidden">
            {sidePanelView === 'team' ? (
              <BoardAssignedUsersSidePanel
                members={data?.members ?? []}
                projects={data?.projects ?? []}
                isLoading={isLoading}
              />
            ) : (
              <QuickAssignmentPanel
                projects={data?.projects ?? []}
                members={data?.members ?? []}
                onAssign={handleQuickAssign}
              />
            )}
          </div>
        </div>
      }
      showSidePanelToggle
      floatingActions={data ? (
        <BoardFloatingActions
          queueAssignments={queueAssignments}
          scheduledCount={data.summary.assignedCount}
          canAssign={canAssign}
          members={data.members}
          activeShiftId={getShiftForTime(new Date().toTimeString().slice(0, 5))}
          onOpenAssignmentFlow={setAssignmentModalContext}
          onStateChanged={loadBoard}
          onSelectAssignment={(item) => {
            const boardAssignment = findBoardAssignmentForQueueItem(data.projects, item)
            if (boardAssignment) {
              setAssignmentModalContext({
                source: 'queue',
                preselectedAssignmentIds: [boardAssignment.assignmentId],
              })
            }
          }}
        />
      ) : undefined}
    >
      <div className="mx-auto flex w-full max-w-[1800px] flex-col gap-6 px-2 py-4 sm:px-4">
        {/* Summary Bar */}
        {isLoading || !data ? (
          <Skeleton className="h-[180px] rounded-lg" />
        ) : (
          <AssignmentSummaryBar
            projects={data.projects}
            members={data.members}
            variant="expanded"
          />
        )}

        

        {error ? (
          <Card className="rounded-none py-0">
            <CardContent className="flex items-center gap-3 px-6 py-6 text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </CardContent>
          </Card>
        ) : null}

        {data ? <BoardSchedulerWorkspace data={data} canAssign={canAssign} onOpenAssignmentFlow={setAssignmentModalContext} onPersistTimelineUpdate={handlePersistTimelineUpdate} /> : null}
      </div>

      <MultiStepProjectAssignmentModal
        open={Boolean(assignmentModalContext)}
        onOpenChange={(open) => {
          if (!open) {
            setAssignmentModalContext(null)
          }
        }}
        data={data}
        canAssign={canAssign}
        actorBadge={actorBadge}
        actorPin={actorPin}
        onActorBadgeChange={setActorBadge}
        onActorPinChange={setActorPin}
        triggerContext={assignmentModalContext}
        onAssignmentsApplied={loadBoard}
      />
    </PageLayout>
  )
}
