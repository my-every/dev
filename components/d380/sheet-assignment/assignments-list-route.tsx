'use client'

import { useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  Filter,
  Search,
  LayoutGrid,
  List,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  Play,
} from 'lucide-react'

import { StageMiniStatus } from '@/components/projects/stage-navigation/stage-mini-status'
import { StageProgressBar } from '@/components/projects/stage-navigation/stage-progress-bar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  ASSIGNMENT_STAGES,
  getStageDefinition,
  type AssignmentStageId,
  type AssignmentStageStatus,
} from '@/types/d380-assignment-stages'

interface AssignmentsListRouteProps {
  projectId: string
}

interface SheetAssignment {
  id: string
  sheetName: string
  panelType: string
  currentStage: AssignmentStageId
  completedStages: AssignmentStageId[]
  assignedMembers: string[]
  estimatedHours: number
  elapsedHours: number
  status: 'active' | 'paused' | 'blocked' | 'complete'
  blockedReason?: string
}

// Mock data
const mockAssignments: SheetAssignment[] = [
  {
    id: '1',
    sheetName: 'PNL A - CONTROL',
    panelType: 'Control Panel',
    currentStage: 'WIRING',
    completedStages: ['BUILD_UP'],
    assignedMembers: ['JM', 'SR'],
    estimatedHours: 12,
    elapsedHours: 5.5,
    status: 'active',
  },
  {
    id: '2',
    sheetName: 'PNL B - POWER',
    panelType: 'Power Distribution',
    currentStage: 'WIRING_IPV',
    completedStages: ['BUILD_UP', 'WIRING'],
    assignedMembers: ['TL'],
    estimatedHours: 8,
    elapsedHours: 6.2,
    status: 'paused',
  },
  {
    id: '3',
    sheetName: 'PNL C - PLC',
    panelType: 'PLC Cabinet',
    currentStage: 'BUILD_UP',
    completedStages: [],
    assignedMembers: ['KW', 'DM'],
    estimatedHours: 16,
    elapsedHours: 2.0,
    status: 'blocked',
    blockedReason: 'Waiting for rail shipment',
  },
  {
    id: '4',
    sheetName: 'PNL D - TCP',
    panelType: 'Touch Panel',
    currentStage: 'BIQ',
    completedStages: ['BUILD_UP', 'WIRING', 'WIRING_IPV', 'BOX_BUILD', 'CROSS_WIRE', 'CROSS_WIRE_IPV', 'TEST_1ST_PASS', 'POWER_CHECK'],
    assignedMembers: ['JM'],
    estimatedHours: 6,
    elapsedHours: 5.8,
    status: 'active',
  },
  {
    id: '5',
    sheetName: 'DOOR A',
    panelType: 'Door Assembly',
    currentStage: 'BIQ',
    completedStages: ['BUILD_UP', 'WIRING', 'WIRING_IPV', 'BOX_BUILD', 'CROSS_WIRE', 'CROSS_WIRE_IPV', 'TEST_1ST_PASS', 'POWER_CHECK', 'BIQ'],
    assignedMembers: ['SR'],
    estimatedHours: 4,
    elapsedHours: 4.1,
    status: 'complete',
  },
]

export function AssignmentsListRoute({ projectId }: AssignmentsListRouteProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredAssignments = mockAssignments.filter(a =>
    a.sheetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.panelType.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const statusCounts = {
    active: mockAssignments.filter(a => a.status === 'active').length,
    paused: mockAssignments.filter(a => a.status === 'paused').length,
    blocked: mockAssignments.filter(a => a.status === 'blocked').length,
    complete: mockAssignments.filter(a => a.status === 'complete').length,
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30 px-4 py-6 sm:px-6 sm:py-8 md:px-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="mx-auto max-w-7xl space-y-6"
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href={`/380/projects/${projectId}`} className="hover:text-foreground">
            Project {projectId}
          </Link>
          <ChevronRight className="h-4 w-4" />
          <span className="font-medium text-foreground">Assignments</span>
        </div>

        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href={`/380/projects/${projectId}`}>
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">Sheet Assignments</h1>
              <p className="text-sm text-muted-foreground">
                {mockAssignments.length} sheets across all stages
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search sheets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 pl-9"
              />
            </div>
            <Button variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </Button>
            <div className="flex rounded-lg border p-1">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-7 w-7"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <Play className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{statusCounts.active}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{statusCounts.paused}</div>
                <div className="text-xs text-muted-foreground">Paused</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{statusCounts.blocked}</div>
                <div className="text-xs text-muted-foreground">Blocked</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{statusCounts.complete}</div>
                <div className="text-xs text-muted-foreground">Complete</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Assignments Grid/List */}
        {viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredAssignments.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} projectId={projectId} />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAssignments.map((assignment) => (
              <AssignmentRow key={assignment.id} assignment={assignment} projectId={projectId} />
            ))}
          </div>
        )}
      </motion.div>
    </main>
  )
}

function AssignmentCard({ assignment, projectId }: { assignment: SheetAssignment; projectId: string }) {
  const stageDef = getStageDefinition(assignment.currentStage)
  const progress = Math.round((assignment.completedStages.length / ASSIGNMENT_STAGES.length) * 100)

  const statusColors = {
    active: 'border-l-blue-500',
    paused: 'border-l-amber-500',
    blocked: 'border-l-red-500',
    complete: 'border-l-emerald-500',
  }

  return (
    <Link href={`/380/projects/${projectId}/assignments/${encodeURIComponent(assignment.sheetName)}`}>
      <Card className={cn('rounded-2xl border-l-4 transition-all hover:shadow-md', statusColors[assignment.status])}>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">{assignment.sheetName}</h3>
              <p className="text-sm text-muted-foreground">{assignment.panelType}</p>
            </div>
            <Badge
              variant="secondary"
              className={cn(
                'capitalize',
                assignment.status === 'active' && 'bg-blue-100 text-blue-700',
                assignment.status === 'paused' && 'bg-amber-100 text-amber-700',
                assignment.status === 'blocked' && 'bg-red-100 text-red-700',
                assignment.status === 'complete' && 'bg-emerald-100 text-emerald-700'
              )}
            >
              {assignment.status}
            </Badge>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Stage: {stageDef?.shortLabel}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <StageMiniStatus
            currentStage={assignment.currentStage}
            completedStages={assignment.completedStages}
            compact
            size="sm"
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {assignment.assignedMembers.join(', ')}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {assignment.elapsedHours}h / {assignment.estimatedHours}h
            </span>
          </div>

          {assignment.blockedReason && (
            <div className="rounded-md bg-red-50 px-2 py-1.5 text-xs text-red-700">
              {assignment.blockedReason}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

function AssignmentRow({ assignment, projectId }: { assignment: SheetAssignment; projectId: string }) {
  const stageDef = getStageDefinition(assignment.currentStage)
  const progress = Math.round((assignment.completedStages.length / ASSIGNMENT_STAGES.length) * 100)

  return (
    <Link href={`/380/projects/${projectId}/assignments/${encodeURIComponent(assignment.sheetName)}`}>
      <Card className="rounded-xl transition-all hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate">{assignment.sheetName}</h3>
              <Badge
                variant="secondary"
                className={cn(
                  'capitalize shrink-0',
                  assignment.status === 'active' && 'bg-blue-100 text-blue-700',
                  assignment.status === 'paused' && 'bg-amber-100 text-amber-700',
                  assignment.status === 'blocked' && 'bg-red-100 text-red-700',
                  assignment.status === 'complete' && 'bg-emerald-100 text-emerald-700'
                )}
              >
                {assignment.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{assignment.panelType}</p>
          </div>

          <div className="hidden sm:block w-32">
            <StageMiniStatus
              currentStage={assignment.currentStage}
              completedStages={assignment.completedStages}
              compact
              size="sm"
            />
          </div>

          <div className="text-right text-sm">
            <div className="font-medium">{stageDef?.shortLabel}</div>
            <div className="text-muted-foreground">{progress}%</div>
          </div>

          <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-4 w-4" />
            {assignment.assignedMembers.length}
          </div>

          <div className="hidden md:flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {assignment.elapsedHours}h
          </div>

          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  )
}
