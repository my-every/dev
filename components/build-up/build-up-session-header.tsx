'use client'

/**
 * BuildUpSessionHeader
 * 
 * Displays session status, timing, and last member info.
 */

import { Clock, User, Calendar, Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { BuildUpExecutionSession, BuildUpSectionExecution } from '@/types/d380-build-up-execution'

interface BuildUpSessionHeaderProps {
  session: BuildUpExecutionSession
  progress: {
    percentage: number
    completedSections: number
    totalSections: number
    completedSteps: number
    totalSteps: number
    currentSection?: BuildUpSectionExecution
  }
  assignmentName: string
  onResume?: () => void
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit' 
  })
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  })
}

export function BuildUpSessionHeader({
  session,
  progress,
  assignmentName,
  onResume,
}: BuildUpSessionHeaderProps) {
  const startTime = new Date(session.startedAt)
  const now = new Date()
  const elapsedMinutes = Math.round((now.getTime() - startTime.getTime()) / 1000 / 60)
  
  const statusColors: Record<string, string> = {
    not_started: 'bg-muted text-muted-foreground',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  }
  
  const statusLabels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    completed: 'Completed',
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Status & Timing */}
          <div className="flex items-center gap-4">
            <Badge 
              variant="secondary" 
              className={statusColors[session.status]}
            >
              {statusLabels[session.status]}
            </Badge>
            
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                <span>{formatDate(session.startedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Started {formatTime(session.startedAt)}</span>
              </div>
              {session.status === 'in_progress' && (
                <div className="flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  <span>{formatDuration(elapsedMinutes)} elapsed</span>
                </div>
              )}
            </div>
          </div>
          
          {/* Last Member */}
          {session.lastMember && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Last:</span>
              <span className="font-medium">{session.lastMember.name}</span>
              <Badge variant="outline" className="text-xs capitalize">
                {session.lastMember.shift}
              </Badge>
            </div>
          )}
        </div>
        
        {/* Current Section */}
        {progress.currentSection && session.status === 'in_progress' && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Current Section:</span>
              <span className="font-medium">{progress.currentSection.title}</span>
            </div>
          </div>
        )}
        
        {/* Section Progress */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sections:</span>
            <div className="flex items-center gap-1">
              {session.sections.map((section, idx) => (
                <div
                  key={section.id}
                  className={`h-2 w-8 rounded-full transition-colors ${
                    section.status === 'completed'
                      ? 'bg-green-500'
                      : section.status === 'in_progress'
                      ? 'bg-blue-500'
                      : 'bg-muted'
                  }`}
                  title={section.title}
                />
              ))}
            </div>
            <span className="text-sm font-medium">
              {progress.completedSections}/{progress.totalSections}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
