'use client'

import * as React from 'react'
import {
  Users,
  Folder,
  Activity,
  AlertTriangle,
  Clock,
  CheckCircle,
  ClipboardList,
  BarChart3,
  Tag,
  Wrench,
  Timer,
  FileCheck,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import type { ProfileWidgetConfig, UserRole } from '@/types/profile'
import { getWidgetsByRole } from '@/lib/profile/widget-registry'

// ============================================================================
// WIDGET COMPONENTS
// ============================================================================

function TeamOverviewWidget() {
  const members = [
    { name: 'James C.', role: 'Team Lead', status: 'active' },
    { name: 'Ana M.', role: 'Assembler', status: 'active' },
    { name: 'David K.', role: 'Brander', status: 'busy' },
    { name: 'Lisa P.', role: 'QA', status: 'active' },
  ]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Active Members</span>
        <Badge variant="secondary">12 / 15</Badge>
      </div>
      <div className="space-y-2">
        {members.map((member, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  member.status === 'active' && 'bg-emerald-500',
                  member.status === 'busy' && 'bg-amber-500'
                )}
              />
              <span className="text-sm font-medium">{member.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{member.role}</span>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="w-full gap-1">
        View All <ArrowRight className="h-3 w-3" />
      </Button>
    </div>
  )
}

function ProjectHealthWidget() {
  const projects = [
    { name: 'PD-4L341', progress: 75, status: 'on-track' },
    { name: 'PD-4L342', progress: 45, status: 'at-risk' },
    { name: 'PD-4L343', progress: 90, status: 'on-track' },
  ]

  return (
    <div className="space-y-3">
      {projects.map((project, i) => (
        <div key={i} className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{project.name}</span>
            <Badge
              variant="outline"
              className={cn(
                project.status === 'on-track' && 'border-emerald-500/50 text-emerald-600',
                project.status === 'at-risk' && 'border-amber-500/50 text-amber-600'
              )}
            >
              {project.status === 'on-track' ? 'On Track' : 'At Risk'}
            </Badge>
          </div>
          <Progress value={project.progress} className="h-1.5" />
        </div>
      ))}
    </div>
  )
}

function ShiftSummaryWidget() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div className="rounded-lg bg-muted/50 p-3 text-center">
        <p className="text-2xl font-bold">24</p>
        <p className="text-xs text-muted-foreground">Assigned</p>
      </div>
      <div className="rounded-lg bg-emerald-100 dark:bg-emerald-900/30 p-3 text-center">
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">18</p>
        <p className="text-xs text-muted-foreground">Completed</p>
      </div>
      <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-3 text-center">
        <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">4</p>
        <p className="text-xs text-muted-foreground">In Progress</p>
      </div>
      <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-3 text-center">
        <p className="text-2xl font-bold">2</p>
        <p className="text-xs text-muted-foreground">Pending</p>
      </div>
    </div>
  )
}

function ValidationQueueWidget() {
  const items = [
    { id: 'IPV-001', project: 'PD-4L341', stage: 'Wiring', priority: 'high' },
    { id: 'IPV-002', project: 'PD-4L342', stage: 'Harness', priority: 'medium' },
    { id: 'IPV-003', project: 'PD-4L343', stage: 'Testing', priority: 'low' },
  ]

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-border/50 p-3"
        >
          <div className="flex items-center gap-3">
            <FileCheck className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{item.id}</p>
              <p className="text-xs text-muted-foreground">
                {item.project} - {item.stage}
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn(
              item.priority === 'high' && 'border-red-500/50 text-red-600',
              item.priority === 'medium' && 'border-amber-500/50 text-amber-600',
              item.priority === 'low' && 'border-slate-500/50 text-slate-600'
            )}
          >
            {item.priority}
          </Badge>
        </div>
      ))}
    </div>
  )
}

function LabelTasksWidget() {
  const tasks = [
    { name: 'Panel A Labels', count: 24, status: 'pending' },
    { name: 'Harness Tags', count: 12, status: 'in-progress' },
    { name: 'Device IDs', count: 8, status: 'pending' },
  ]

  return (
    <div className="space-y-2">
      {tasks.map((task, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
        >
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{task.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{task.count} items</span>
            <Badge
              variant={task.status === 'in-progress' ? 'default' : 'secondary'}
              className="text-xs"
            >
              {task.status === 'in-progress' ? 'Active' : 'Pending'}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  )
}

function CurrentAssignmentWidget() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold">PD-4L341 / A PANEL</h4>
          <p className="text-sm text-muted-foreground">Wiring Stage</p>
        </div>
        <Badge>Active</Badge>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium">45%</span>
        </div>
        <Progress value={45} className="h-2" />
      </div>
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Timer className="h-3.5 w-3.5" />
          <span>2h 15m elapsed</span>
        </div>
        <div className="flex items-center gap-1">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>12 / 27 tasks</span>
        </div>
      </div>
      <Button className="w-full">Continue Working</Button>
    </div>
  )
}

function AssignmentsWidget() {
  const assignments = [
    { name: 'PD-4L341 Wiring', due: 'Today', status: 'active' },
    { name: 'PD-4L342 QA Review', due: 'Tomorrow', status: 'pending' },
  ]

  return (
    <div className="space-y-2">
      {assignments.map((a, i) => (
        <div
          key={i}
          className="flex items-center justify-between rounded-lg border border-border/50 p-3"
        >
          <div>
            <p className="text-sm font-medium">{a.name}</p>
            <p className="text-xs text-muted-foreground">Due: {a.due}</p>
          </div>
          <Badge variant={a.status === 'active' ? 'default' : 'secondary'}>
            {a.status}
          </Badge>
        </div>
      ))}
    </div>
  )
}

function TimelineWidget() {
  const events = [
    { time: '2:30 PM', event: 'Completed Wiring Stage', type: 'success' },
    { time: '11:45 AM', event: 'Started PD-4L341', type: 'info' },
    { time: '9:00 AM', event: 'Shift Started', type: 'neutral' },
  ]

  return (
    <div className="space-y-3">
      {events.map((e, i) => (
        <div key={i} className="flex items-start gap-3">
          <div
            className={cn(
              'mt-1.5 h-2 w-2 rounded-full',
              e.type === 'success' && 'bg-emerald-500',
              e.type === 'info' && 'bg-blue-500',
              e.type === 'neutral' && 'bg-slate-400'
            )}
          />
          <div className="flex-1">
            <p className="text-sm">{e.event}</p>
            <p className="text-xs text-muted-foreground">{e.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatsWidget() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-muted/50 p-3 text-center">
        <p className="text-xl font-bold">8</p>
        <p className="text-xs text-muted-foreground">Completed</p>
      </div>
      <div className="rounded-lg bg-muted/50 p-3 text-center">
        <p className="text-xl font-bold">97%</p>
        <p className="text-xs text-muted-foreground">Quality</p>
      </div>
    </div>
  )
}

function PerformanceWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm">Efficiency</span>
        <span className="text-sm font-medium">94%</span>
      </div>
      <Progress value={94} className="h-2" />
      <div className="flex items-center justify-between">
        <span className="text-sm">Quality Score</span>
        <span className="text-sm font-medium">98%</span>
      </div>
      <Progress value={98} className="h-2" />
    </div>
  )
}

function ListWidget({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
        <span className="text-sm">Item 1</span>
        <Badge variant="secondary" className="text-xs">New</Badge>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
        <span className="text-sm">Item 2</span>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
        <span className="text-sm">Item 3</span>
      </div>
    </div>
  )
}

function StatusWidget() {
  return (
    <div className="flex items-center justify-center py-4">
      <div className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <p className="text-sm font-medium">All Systems Go</p>
        <p className="text-xs text-muted-foreground">No issues detected</p>
      </div>
    </div>
  )
}

function PlaceholderWidget({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <Activity className="mb-2 h-8 w-8 opacity-50" />
      <p className="text-sm">{title}</p>
    </div>
  )
}

// ============================================================================
// WIDGET ICON MAPPING
// ============================================================================

const WIDGET_ICONS: Record<string, typeof Users> = {
  'team-overview': Users,
  'project-health': Folder,
  'productivity-metrics': BarChart3,
  'blockers-summary': AlertTriangle,
  'shift-summary': Clock,
  'active-assignments': ClipboardList,
  'workforce-distribution': Users,
  'issue-alerts': AlertTriangle,
  'assigned-projects': Folder,
  'workstation-occupancy': Users,
  'upcoming-assignments': Clock,
  'stage-readiness': CheckCircle,
  'validation-queue': FileCheck,
  'discrepancy-counts': AlertTriangle,
  'recent-ipv-actions': Activity,
  'audit-metrics': BarChart3,
  'label-tasks': Tag,
  'pending-branding': Tag,
  'completed-branding': CheckCircle,
  'upcoming-queue': Clock,
  'current-assignment': Wrench,
  'assignment-history': Clock,
  'task-timer': Timer,
  'completed-work': CheckCircle,
}

// ============================================================================
// RENDER WIDGET CONTENT
// ============================================================================

function renderWidgetContent(widget: ProfileWidgetConfig): React.ReactNode {
  switch (widget.id) {
    case 'team-overview':
      return <TeamOverviewWidget />
    case 'project-health':
      return <ProjectHealthWidget />
    case 'shift-summary':
      return <ShiftSummaryWidget />
    case 'validation-queue':
      return <ValidationQueueWidget />
    case 'label-tasks':
      return <LabelTasksWidget />
    case 'current-assignment':
      return <CurrentAssignmentWidget />
    case 'active-assignments':
    case 'assigned-projects':
      return <AssignmentsWidget />
    case 'assignment-history':
    case 'upcoming-assignments':
    case 'recent-ipv-actions':
    case 'upcoming-queue':
      return <TimelineWidget />
    case 'completed-work':
    case 'completed-branding':
    case 'discrepancy-counts':
    case 'workstation-occupancy':
    case 'workforce-distribution':
      return <StatsWidget />
    case 'productivity-metrics':
    case 'audit-metrics':
      return <PerformanceWidget />
    case 'blockers-summary':
    case 'issue-alerts':
    case 'pending-branding':
      return <ListWidget title={widget.title} />
    case 'stage-readiness':
    case 'task-timer':
      return <StatusWidget />
    default:
      return <PlaceholderWidget title={widget.title} />
  }
}

// ============================================================================
// PROFILE WIDGET RENDERER
// ============================================================================

interface ProfileWidgetRendererProps {
  role: UserRole
  className?: string
}

export function ProfileWidgetRenderer({ role, className }: ProfileWidgetRendererProps) {
  const widgets = getWidgetsByRole(role)

  return (
    <div
      className={cn(
        'grid gap-4',
        'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
        className
      )}
    >
      {widgets.map((widget) => {
        const Icon = WIDGET_ICONS[widget.id] || Activity

        return (
          <Card
            key={widget.id}
            className={cn(
              'overflow-hidden',
              widget.colSpan === 2 && 'sm:col-span-2',
              widget.colSpan === 3 && 'sm:col-span-2 lg:col-span-3',
              widget.colSpan === 4 && 'sm:col-span-2 lg:col-span-4'
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Icon className="h-4 w-4 text-muted-foreground" />
                {widget.title}
              </CardTitle>
            </CardHeader>
            <CardContent>{renderWidgetContent(widget)}</CardContent>
          </Card>
        )
      })}
    </div>
  )
}
