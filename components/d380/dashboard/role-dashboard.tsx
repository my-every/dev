'use client'

import { useRouter } from 'next/navigation'
import {
  LayoutGrid,
  Users,
  FolderKanban,
  Map,
  Clock,
  BarChart3,
  Trophy,
  Bell,
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  PieChart,
  UserCheck,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useSession } from '@/hooks/use-session'
import type { DashboardWidgetType, DashboardWidget, RoleDashboardConfig } from '@/types/d380-user-session'

const WIDGET_ICONS: Record<DashboardWidgetType, typeof LayoutGrid> = {
  my_assignments: LayoutGrid,
  team_overview: Users,
  project_board: FolderKanban,
  work_area_map: Map,
  shift_summary: Clock,
  quality_metrics: BarChart3,
  leaderboard: Trophy,
  notifications: Bell,
  recent_activity: Activity,
  blocked_items: AlertTriangle,
  carryover_items: ArrowRightLeft,
  stage_distribution: PieChart,
  member_roster: UserCheck,
}

function MyAssignmentsWidget() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">Active</span>
        <Badge variant="default">2</Badge>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
          <div>
            <p className="font-medium">PD-4L341 / A PANEL</p>
            <p className="text-xs text-muted-foreground">Wiring - 45%</p>
          </div>
          <Button size="sm">Continue</Button>
        </div>
      </div>
    </div>
  )
}

function ShiftSummaryWidget() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-sm text-muted-foreground">Today</p>
        <p className="text-2xl font-bold">24</p>
      </div>
      <div>
        <p className="text-sm text-muted-foreground">Done</p>
        <p className="text-2xl font-bold text-emerald-600">18</p>
      </div>
    </div>
  )
}

function PlaceholderWidget({ type }: { type: DashboardWidgetType }) {
  const Icon = WIDGET_ICONS[type]
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <Icon className="h-8 w-8 mb-2" />
      <p className="text-sm capitalize">{type.replace(/_/g, ' ')}</p>
    </div>
  )
}

function renderWidget(widget: DashboardWidget) {
  switch (widget.type) {
    case 'my_assignments':
      return <MyAssignmentsWidget />
    case 'shift_summary':
      return <ShiftSummaryWidget />
    default:
      return <PlaceholderWidget type={widget.type} />
  }
}

interface RoleDashboardProps {
  config?: RoleDashboardConfig
  className?: string
}

export function RoleDashboard({ config: configOverride, className }: RoleDashboardProps) {
  const router = useRouter()
  const { user, dashboardConfig, isAuthenticated, signOut } = useSession()
  const config = configOverride || dashboardConfig

  if (!isAuthenticated || !user || !config) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">Please sign in</p>
            <Button className="mt-4" onClick={() => router.push('/380')}>Sign In</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{config.title}</h1>
          {config.subtitle && <p className="text-muted-foreground">{config.subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-medium">{user.preferredName}</p>
            <p className="text-sm text-muted-foreground">{user.role}</p>
          </div>
          <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {config.widgets.map((widget, index) => {
          const Icon = WIDGET_ICONS[widget.type]
          return (
            <Card
              key={`${widget.type}-${index}`}
              className={cn(
                widget.colSpan === 2 && 'md:col-span-2',
                widget.colSpan === 4 && 'md:col-span-2 lg:col-span-4'
              )}
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  {widget.title || widget.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </CardTitle>
              </CardHeader>
              <CardContent>{renderWidget(widget)}</CardContent>
            </Card>
          )
        })}
      </div>

      <div className="flex gap-4">
        {config.showProjectBoard && (
          <Button variant="outline" onClick={() => router.push('/380/project-board')}>
            <FolderKanban className="mr-2 h-4 w-4" />Project Board
          </Button>
        )}
        {config.showTeamRoster && (
          <Button variant="outline" onClick={() => router.push('/380/leaderboard')}>
            <Users className="mr-2 h-4 w-4" />Team Roster
          </Button>
        )}
      </div>
    </div>
  )
}
