'use client'

/**
 * BuildUpQuickResumePanel
 * 
 * Shows all in-progress Build Up sessions with quick resume access.
 * Displayed on project details page.
 */

import { useMemo } from 'react'
import Link from 'next/link'
import { Play, User, Clock, AlertCircle, Activity, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getInProgressSessions, getSessionProgress } from '@/lib/build-up/build-up-execution-service'
import type { MappedAssignment } from '@/components/projects/project-assignment-mapping-modal'

interface BuildUpQuickResumePanelProps {
  projectId: string
  assignments: MappedAssignment[]
}

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMinutes = Math.round((now.getTime() - date.getTime()) / 1000 / 60)
  
  if (diffMinutes < 1) return 'Just now'
  if (diffMinutes < 60) return `${diffMinutes}m ago`
  
  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours}h ago`
  
  const diffDays = Math.round(diffHours / 24)
  return `${diffDays}d ago`
}

export function BuildUpQuickResumePanel({
  projectId,
  assignments,
}: BuildUpQuickResumePanelProps) {
  const inProgressSessions = useMemo(() => {
    const sessions = getInProgressSessions(projectId)
    
    // Enrich with assignment data
    return sessions.map(session => {
      const assignment = assignments.find(a => a.sheetSlug === session.assignmentId)
      const progress = getSessionProgress(session)
      
      return {
        session,
        assignment,
        progress,
      }
    }).filter(item => item.assignment) // Only show sessions with valid assignments
  }, [projectId, assignments])
  
  if (inProgressSessions.length === 0) {
    return null
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
            <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-base">Active Build Up Sessions</CardTitle>
            <CardDescription>
              {inProgressSessions.length} session{inProgressSessions.length !== 1 ? 's' : ''} in progress
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {inProgressSessions.map(({ session, assignment, progress }) => (
          <div
            key={session.id}
            className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
          >
            {/* Progress Indicator */}
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <span className="text-sm font-semibold">{progress.percentage}%</span>
              </div>
              <svg
                className="absolute inset-0 -rotate-90"
                viewBox="0 0 48 48"
              >
                <circle
                  cx="24"
                  cy="24"
                  r="20"
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="4"
                  strokeDasharray={`${progress.percentage * 1.26} 126`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
            
            {/* Session Info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">
                {assignment?.sheetName}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                {progress.currentSection && (
                  <span className="truncate">
                    {progress.currentSection.title}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTimeAgo(session.lastActivityAt)}
                </span>
              </div>
              {session.lastMember && (
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <span>{session.lastMember.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize px-1.5">
                    {session.lastMember.shift}
                  </Badge>
                </div>
              )}
            </div>
            
            {/* Resume Button */}
            <Link
              href={`/projects/${projectId}/assignments/${assignment?.sheetSlug}/build-up`}
            >
              <Button size="sm" className="shrink-0 gap-1.5">
                <Play className="h-3.5 w-3.5" />
                Resume
              </Button>
            </Link>
          </div>
        ))}
        
        {/* View All Link */}
        {inProgressSessions.length > 3 && (
          <div className="pt-2 text-center">
            <Link
              href={`/projects/${projectId}?tab=assignments`}
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              View all assignments
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
