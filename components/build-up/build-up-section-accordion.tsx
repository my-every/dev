'use client'

/**
 * BuildUpSectionAccordion
 * 
 * Collapsible section card with:
 * - Status indicator
 * - Progress info
 * - Member tracking
 * - Step checklist
 */

import { useState } from 'react'
import { 
  ChevronDown, 
  ChevronRight, 
  Play, 
  CheckCircle2, 
  Circle,
  User,
  Clock,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import type { 
  BuildUpSectionExecution, 
  BuildUpMemberRecord,
  WorkShift,
} from '@/types/d380-build-up-execution'

interface BuildUpSectionAccordionProps {
  section: BuildUpSectionExecution
  isCurrentSection: boolean
  progress: {
    percentage: number
    completedSteps: number
    totalSteps: number
  }
  activeMember?: {
    badgeId: string
    name: string
    shift: WorkShift
    startedAt: string
  }
  onStartSection: () => void
  onSwitchMember: () => void
  onToggleStep: (stepId: string) => void
}

const statusIcons = {
  pending: Circle,
  in_progress: Play,
  completed: CheckCircle2,
}

const statusColors = {
  pending: 'text-muted-foreground',
  in_progress: 'text-blue-500',
  completed: 'text-green-500',
}

const statusBgColors = {
  pending: 'bg-muted',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
}

export function BuildUpSectionAccordion({
  section,
  isCurrentSection,
  progress,
  activeMember,
  onStartSection,
  onSwitchMember,
  onToggleStep,
}: BuildUpSectionAccordionProps) {
  const [isExpanded, setIsExpanded] = useState(
    isCurrentSection || section.status === 'in_progress'
  )
  
  const StatusIcon = statusIcons[section.status]
  const canStartSection = section.status === 'pending'
  const canWorkOnSection = section.status === 'in_progress'

  return (
    <Card className={cn(
      'transition-all',
      isCurrentSection && 'ring-2 ring-primary/20',
      section.status === 'completed' && 'opacity-80'
    )}>
      {/* Header - always visible */}
      <CardHeader 
        className="cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          {/* Status Icon */}
          <div className={cn(
            'rounded-full p-1.5',
            statusBgColors[section.status],
            section.status !== 'pending' && 'text-white'
          )}>
            <StatusIcon className="h-4 w-4" />
          </div>
          
          {/* Title & Progress */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{section.title}</h3>
              {section.status === 'in_progress' && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Active
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5">
              <span>
                {progress.completedSteps}/{progress.totalSteps} steps
              </span>
              {progress.percentage > 0 && progress.percentage < 100 && (
                <span>({progress.percentage}%)</span>
              )}
            </div>
          </div>
          
          {/* Active Member Badge */}
          {activeMember && (
            <div className="hidden sm:flex items-center gap-1.5 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{activeMember.name}</span>
              <Badge variant="outline" className="text-xs capitalize">
                {activeMember.shift}
              </Badge>
            </div>
          )}
          
          {/* Expand Icon */}
          <div className="shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>
      
      {/* Expanded Content */}
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="border-t pt-4 space-y-4">
            {/* Section Controls */}
            {canStartSection && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm text-muted-foreground">
                  Ready to start this section
                </span>
                <Button size="sm" onClick={(e) => {
                  e.stopPropagation()
                  onStartSection()
                }}>
                  <Play className="h-4 w-4 mr-1.5" />
                  Start Section
                </Button>
              </div>
            )}
            
            {/* Active Member for Mobile */}
            {activeMember && (
              <div className="sm:hidden flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-blue-500" />
                  <span>{activeMember.name}</span>
                  <Badge variant="outline" className="text-xs capitalize">
                    {activeMember.shift}
                  </Badge>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSwitchMember()
                  }}
                >
                  <Users className="h-4 w-4 mr-1.5" />
                  Switch
                </Button>
              </div>
            )}
            
            {/* Step List */}
            <div className="space-y-2">
              {section.steps.map((step) => (
                <label
                  key={step.id}
                  className={cn(
                    'flex items-start gap-3 p-3 rounded-lg transition-colors',
                    canWorkOnSection 
                      ? 'hover:bg-muted/50 cursor-pointer'
                      : 'opacity-60',
                    step.completed && 'bg-green-50 dark:bg-green-950/10'
                  )}
                >
                  <Checkbox
                    checked={step.completed}
                    disabled={!canWorkOnSection}
                    onCheckedChange={() => onToggleStep(step.id)}
                    className="mt-0.5"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-sm',
                      step.completed && 'line-through text-muted-foreground'
                    )}>
                      {step.label}
                    </div>
                    {step.description && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {step.description}
                      </div>
                    )}
                    {step.completedAt && step.completedBy && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(step.completedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                        <User className="h-3 w-3" />
                        <span>{step.completedBy.name}</span>
                      </div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            
            {/* Member Timeline (if multiple members worked) */}
            {section.members.length > 0 && (
              <div className="pt-2 border-t">
                <div className="text-xs font-medium text-muted-foreground mb-2">
                  Member Activity
                </div>
                <div className="space-y-1">
                  {section.members.map((member, idx) => (
                    <div 
                      key={`${member.badgeId}-${idx}`}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        <span>{member.name}</span>
                        <Badge variant="outline" className="text-[10px] capitalize px-1.5">
                          {member.shift}
                        </Badge>
                      </div>
                      <div className="text-muted-foreground">
                        {new Date(member.startedAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                        {member.endedAt && (
                          <span>
                            {' - '}
                            {new Date(member.endedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
