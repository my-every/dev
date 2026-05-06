'use client'

/**
 * Stage Progression Confirmation Dialog
 * 
 * Reusable confirmation flow for sensitive stage changes.
 * Shows dependency summary, warnings, and requires explicit confirmation.
 */

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Info,
  Loader2,
  Lock,
  Unlock,
} from 'lucide-react'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { getStageDefinition } from '@/types/d380-assignment-stages'
import type {
  StageTransitionValidation,
  TransitionWarning,
  TransitionError,
} from '@/lib/assignment/auto-progression-service'

// ============================================================================
// TYPES
// ============================================================================

interface StageProgressionConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  assignmentId: string
  assignmentName: string
  currentStage: AssignmentStageId
  targetStage: AssignmentStageId
  validation: StageTransitionValidation
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StageProgressionConfirmDialog({
  open,
  onOpenChange,
  assignmentId,
  assignmentName,
  currentStage,
  targetStage,
  validation,
  onConfirm,
  onCancel,
}: StageProgressionConfirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const currentStageInfo = getStageDefinition(currentStage)
  const targetStageInfo = getStageDefinition(targetStage)
  
  const hasWarnings = validation.warnings.length > 0
  const hasErrors = validation.errors.length > 0
  const canProceed = validation.isValid
  
  const handleConfirm = async () => {
    setIsSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {canProceed ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <Lock className="h-5 w-5 text-destructive" />
            )}
            Confirm Stage Progression
          </DialogTitle>
          <DialogDescription>
            {canProceed
              ? 'Review the transition details and confirm to proceed.'
              : 'This transition cannot proceed due to blocking issues.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Assignment Info */}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-sm font-medium">{assignmentName}</p>
            <p className="text-xs text-muted-foreground mt-1">ID: {assignmentId}</p>
          </div>
          
          {/* Stage Transition Visual */}
          <StageProgressionSummary
            currentStage={currentStage}
            targetStage={targetStage}
          />
          
          <Separator />
          
          {/* Errors (blocking) */}
          {hasErrors && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">Blocking Issues</span>
              </div>
              <StageProgressionErrorList errors={validation.errors} />
            </div>
          )}
          
          {/* Warnings (non-blocking) */}
          {hasWarnings && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm font-medium">Warnings</span>
              </div>
              <StageProgressionWarningList warnings={validation.warnings} />
            </div>
          )}
          
          {/* Success state */}
          {canProceed && !hasWarnings && (
            <div className="flex items-center gap-2 text-green-600 p-3 bg-green-50 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm">All checks passed. Ready to proceed.</span>
            </div>
          )}
        </div>
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canProceed || isSubmitting}
            className={canProceed ? 'bg-green-600 hover:bg-green-700' : ''}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ChevronRight className="mr-1 h-4 w-4" />
                Confirm Progression
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface StageProgressionSummaryProps {
  currentStage: AssignmentStageId
  targetStage: AssignmentStageId
}

export function StageProgressionSummary({
  currentStage,
  targetStage,
}: StageProgressionSummaryProps) {
  const current = getStageDefinition(currentStage)
  const target = getStageDefinition(targetStage)
  
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <div className="text-center">
        <Badge variant="outline" className="mb-1">
          Current
        </Badge>
        <p className="text-sm font-medium">{current.label}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-muted-foreground" />
      <div className="text-center">
        <Badge className="mb-1 bg-green-600">
          Target
        </Badge>
        <p className="text-sm font-medium">{target.label}</p>
      </div>
    </div>
  )
}

interface StageProgressionWarningListProps {
  warnings: TransitionWarning[]
}

export function StageProgressionWarningList({ warnings }: StageProgressionWarningListProps) {
  if (warnings.length === 0) return null
  
  const getSeverityColor = (severity: TransitionWarning['severity']) => {
    switch (severity) {
      case 'HIGH': return 'text-amber-700 bg-amber-50 border-amber-200'
      case 'MEDIUM': return 'text-amber-600 bg-amber-50/50 border-amber-100'
      case 'LOW': return 'text-amber-500 bg-amber-50/30 border-amber-50'
    }
  }
  
  return (
    <ScrollArea className="max-h-[150px]">
      <div className="space-y-2">
        {warnings.map((warning, index) => (
          <div
            key={`${warning.code}-${index}`}
            className={`rounded-md border p-2 text-sm ${getSeverityColor(warning.severity)}`}
          >
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{warning.message}</p>
                <p className="text-xs opacity-75 mt-0.5">{warning.code}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

interface StageProgressionErrorListProps {
  errors: TransitionError[]
}

export function StageProgressionErrorList({ errors }: StageProgressionErrorListProps) {
  if (errors.length === 0) return null
  
  return (
    <ScrollArea className="max-h-[150px]">
      <div className="space-y-2">
        {errors.map((error, index) => (
          <div
            key={`${error.code}-${index}`}
            className="rounded-md border border-destructive/20 bg-destructive/5 p-2 text-sm text-destructive"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">{error.message}</p>
                {error.blockedBy && error.blockedBy.length > 0 && (
                  <p className="text-xs opacity-75 mt-1">
                    Blocked by: {error.blockedBy.slice(0, 3).join(', ')}
                    {error.blockedBy.length > 3 && ` +${error.blockedBy.length - 3} more`}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}

// ============================================================================
// COMPACT INLINE VERSION
// ============================================================================

interface StageProgressionInlineConfirmProps {
  currentStage: AssignmentStageId
  targetStage: AssignmentStageId
  validation: StageTransitionValidation
  onConfirm: () => void
  onCancel: () => void
  isCompact?: boolean
}

export function StageProgressionInlineConfirm({
  currentStage,
  targetStage,
  validation,
  onConfirm,
  onCancel,
  isCompact = false,
}: StageProgressionInlineConfirmProps) {
  const canProceed = validation.isValid
  const hasWarnings = validation.warnings.length > 0
  
  if (isCompact) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm">
            <span className="text-muted-foreground truncate">
              {getStageDefinition(currentStage).label}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="font-medium truncate">
              {getStageDefinition(targetStage).label}
            </span>
          </div>
          {hasWarnings && (
            <p className="text-xs text-amber-600 truncate">
              {validation.warnings.length} warning(s)
            </p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" onClick={onConfirm} disabled={!canProceed}>
            Confirm
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <StageProgressionSummary
        currentStage={currentStage}
        targetStage={targetStage}
      />
      
      {hasWarnings && (
        <StageProgressionWarningList warnings={validation.warnings} />
      )}
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={onConfirm} disabled={!canProceed}>
          <ChevronRight className="mr-1 h-4 w-4" />
          Confirm
        </Button>
      </div>
    </div>
  )
}
