'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Save, 
  AlertTriangle, 
  Check, 
  Clock, 
  Loader2,
  ArrowRight,
  Package,
  X,
  Pause,
  Play
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { 
  BLOCKED_REASONS, 
  type BlockedItem, 
  type BlockedReasonCode 
} from './sws-blocked-reason-modal'

// ============================================================================
// SAVE PROGRESS TYPES
// ============================================================================

export type SaveProgressType = 
  | 'SAVE_CONTINUE'    // Save and continue working
  | 'PAUSE_SESSION'    // Pause session (end of shift, break)
  | 'BLOCKED_SAVE'     // Save because blocked (can't continue)

export interface SaveProgressSummary {
  /** Total steps in assignment */
  totalSteps: number
  /** Steps completed */
  completedSteps: number
  /** Steps remaining */
  remainingSteps?: number
  /** Steps marked N/A */
  naSteps?: number
  /** Blocked steps count (simplified) */
  blockedSteps?: number
  /** Time spent so far */
  timeSpentMinutes?: number
  /** Progress percentage */
  progress?: number
  /** Current section being worked */
  currentSection?: string
  /** Active blocked items (full objects) */
  blockedItems?: BlockedItem[]
  /** Simple flag for blocked state */
  hasBlockedItems?: boolean
  /** Whether all required steps are done */
  canComplete: boolean
}

export interface SaveProgressResult {
  type: SaveProgressType
  summary: SaveProgressSummary
  blockedItems: BlockedItem[]
  notes?: string
  savedAt: Date
  savedBy: {
    badgeNumber: string
    fullName: string
    initials: string
  }
}

// ============================================================================
// MODAL PROPS
// ============================================================================

interface SwsSaveProgressModalProps {
  open: boolean
  onClose: () => void
  /** Can accept either SaveProgressResult or simple type string */
  onSave?: (result: SaveProgressResult) => Promise<void>
  onSubmit?: (type: 'save_continue' | 'pause' | 'blocked') => void
  summary: SaveProgressSummary
  currentUser?: {
    badgeNumber: string
    fullName: string
    initials: string
  }
  onAddBlock?: () => void
  /** For simplified usage from assignment page */
  assignmentName?: string
  currentStage?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SwsSaveProgressModal({
  open,
  onClose,
  onSave,
  onSubmit,
  summary,
  currentUser,
  onAddBlock,
  assignmentName,
  currentStage,
}: SwsSaveProgressModalProps) {
  const [selectedType, setSelectedType] = useState<SaveProgressType | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveComplete, setSaveComplete] = useState(false)

  const progress = summary.totalSteps > 0 
    ? Math.round((summary.completedSteps / summary.totalSteps) * 100)
    : 0

  const hasActiveBlocks = summary.hasBlockedItems || summary.blockedSteps > 0

  const handleSave = async (type: SaveProgressType) => {
    setSelectedType(type)
    setIsSaving(true)

    try {
      // Support simplified onSubmit callback
      if (onSubmit) {
        const simpleType = type === 'SAVE_CONTINUE' ? 'save_continue' 
          : type === 'PAUSE_SESSION' ? 'pause' 
          : 'blocked'
        onSubmit(simpleType)
        setSaveComplete(true)
        setTimeout(() => {
          setSaveComplete(false)
          setIsSaving(false)
          setSelectedType(null)
          onClose()
        }, 500)
        return
      }

      // Original onSave callback
      if (onSave) {
        await onSave({
          type,
          summary,
          blockedItems: [],
          savedAt: new Date(),
          savedBy: currentUser || { badgeNumber: '00000', fullName: 'Unknown', initials: 'UN' },
        })
        setSaveComplete(true)
        setTimeout(() => {
          setSaveComplete(false)
          setIsSaving(false)
          setSelectedType(null)
          onClose()
        }, 1500)
      }
    } catch {
      setIsSaving(false)
      setSelectedType(null)
    }
  }

  const handleClose = () => {
    if (!isSaving) {
      setSelectedType(null)
      setSaveComplete(false)
      onClose()
    }
  }

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        {saveComplete ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', damping: 15 }}
              className="h-16 w-16 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center mx-auto mb-4"
            >
              <Check className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </motion.div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Progress Saved</h3>
            <p className="text-sm text-muted-foreground">
              Your work has been saved successfully
            </p>
          </motion.div>
        ) : isSaving ? (
          <div className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">Saving Progress...</h3>
            <p className="text-sm text-muted-foreground">
              Please wait while we save your work
            </p>
          </div>
        ) : (
          <>
            <DialogHeader className="p-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <Save className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <DialogTitle className="text-lg">Save Progress</DialogTitle>
                  <DialogDescription>
                    Save your current work and select next action
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Progress Summary */}
            <div className="p-6 space-y-4 border-b border-border bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Overall Progress</span>
                <span className={cn(
                  "text-lg font-bold tabular-nums",
                  progress === 100 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                )}>
                  {progress}%
                </span>
              </div>
              <Progress value={progress} className="h-3" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3 text-emerald-500" />
                    {summary.completedSteps} completed
                  </span>
                  {summary.naSteps > 0 && (
                    <span className="flex items-center gap-1">
                      <X className="h-3 w-3 text-slate-400" />
                      {summary.naSteps} N/A
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatTime(summary.timeSpentMinutes)}
                </span>
              </div>
            </div>

            {/* Active Blocks Warning */}
            {hasActiveBlocks && (
              <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span className="text-sm font-medium">
                    {activeBlocks.length} active block{activeBlocks.length > 1 ? 's' : ''} reported
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {activeBlocks.slice(0, 3).map(block => {
                    const reason = BLOCKED_REASONS.find(r => r.code === block.reasonCode)
                    return (
                      <Badge 
                        key={block.id}
                        variant="outline"
                        className="text-xs bg-white dark:bg-slate-900 border-amber-300 dark:border-amber-700"
                      >
                        {reason?.label || block.reasonCode}
                        {block.partNumber && ` - ${block.partNumber}`}
                      </Badge>
                    )
                  })}
                  {activeBlocks.length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{activeBlocks.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Save Options */}
            <div className="p-6 space-y-3">
              {/* Continue Working */}
              <button
                type="button"
                onClick={() => handleSave('SAVE_CONTINUE')}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left',
                  'border-border hover:border-blue-300 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                )}
              >
                <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                  <Save className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Save &amp; Continue</p>
                  <p className="text-sm text-muted-foreground">Save progress and keep working</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Pause Session */}
              <button
                type="button"
                onClick={() => handleSave('PAUSE_SESSION')}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left',
                  'border-border hover:border-amber-300 dark:hover:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                )}
              >
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                  <Pause className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">Pause Session</p>
                  <p className="text-sm text-muted-foreground">End of shift or taking a break</p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>

              {/* Blocked Save */}
              <button
                type="button"
                onClick={() => hasActiveBlocks ? handleSave('BLOCKED_SAVE') : onAddBlock?.()}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left',
                  hasActiveBlocks
                    ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30'
                    : 'border-border hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-950/30'
                )}
              >
                <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
                  <Package className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {hasActiveBlocks ? 'Save as Blocked' : 'Report Block & Save'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {hasActiveBlocks 
                      ? `${activeBlocks.length} issue${activeBlocks.length > 1 ? 's' : ''} preventing progress`
                      : 'Missing parts or unable to continue'
                    }
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Cancel */}
            <div className="p-6 pt-0">
              <Button variant="ghost" onClick={handleClose} className="w-full">
                Cancel
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// RESUME SESSION BANNER
// ============================================================================

interface SwsResumeSessionBannerProps {
  lastSave?: SaveProgressResult
  onResume: () => void
  onViewBlocks?: () => void
}

export function SwsResumeSessionBanner({ 
  lastSave, 
  onResume, 
  onViewBlocks 
}: SwsResumeSessionBannerProps) {
  if (!lastSave) return null

  const wasBlocked = lastSave.type === 'BLOCKED_SAVE'
  const activeBlocks = lastSave.blockedItems.filter(b => b.status === 'active')

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex items-center justify-between p-4 rounded-lg border',
        wasBlocked
          ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
          : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'h-10 w-10 rounded-lg flex items-center justify-center',
          wasBlocked
            ? 'bg-amber-100 dark:bg-amber-900'
            : 'bg-blue-100 dark:bg-blue-900'
        )}>
          {wasBlocked ? (
            <AlertTriangle className={cn(
              'h-5 w-5',
              'text-amber-600 dark:text-amber-400'
            )} />
          ) : (
            <Pause className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          )}
        </div>
        <div>
          <p className="font-medium text-foreground">
            {wasBlocked ? 'Work Blocked' : 'Session Paused'}
          </p>
          <p className="text-sm text-muted-foreground">
            {wasBlocked 
              ? `${activeBlocks.length} issue${activeBlocks.length > 1 ? 's' : ''} reported`
              : `Last saved ${new Date(lastSave.savedAt).toLocaleString()}`
            }
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {wasBlocked && activeBlocks.length > 0 && onViewBlocks && (
          <Button variant="outline" size="sm" onClick={onViewBlocks}>
            View Blocks
          </Button>
        )}
        <Button 
          size="sm" 
          onClick={onResume}
          className={wasBlocked 
            ? 'bg-amber-600 hover:bg-amber-700 text-white'
            : ''
          }
        >
          <Play className="h-4 w-4 mr-2" />
          Resume Work
        </Button>
      </div>
    </motion.div>
  )
}
