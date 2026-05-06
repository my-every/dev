'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  AlertTriangle, 
  Package, 
  HardHat, 
  FileQuestion, 
  Wrench,
  Clock,
  MessageSquare,
  X,
  Save,
  ArrowRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ============================================================================
// BLOCKED REASON TYPES
// ============================================================================

export type BlockedReasonCode = 
  | 'MISSING_PARTS'
  | 'MISSING_HARDWARE'
  | 'DRAWING_ISSUE'
  | 'EQUIPMENT_ISSUE'
  | 'WAITING_APPROVAL'
  | 'REWORK_REQUIRED'
  | 'OTHER'

export interface BlockedReason {
  code: BlockedReasonCode
  label: string
  description: string
  icon: React.ElementType
  color: string
  requiresPartNumber?: boolean
}

export const BLOCKED_REASONS: BlockedReason[] = [
  {
    code: 'MISSING_PARTS',
    label: 'Missing Parts',
    description: 'Components or parts not available in kit',
    icon: Package,
    color: 'red',
    requiresPartNumber: true,
  },
  {
    code: 'MISSING_HARDWARE',
    label: 'Missing Hardware',
    description: 'Screws, nuts, bolts, or other hardware missing',
    icon: Wrench,
    color: 'orange',
    requiresPartNumber: true,
  },
  {
    code: 'DRAWING_ISSUE',
    label: 'Drawing Issue',
    description: 'Unclear or incorrect drawing/documentation',
    icon: FileQuestion,
    color: 'amber',
  },
  {
    code: 'EQUIPMENT_ISSUE',
    label: 'Equipment Issue',
    description: 'Required tool or equipment not available',
    icon: HardHat,
    color: 'purple',
  },
  {
    code: 'WAITING_APPROVAL',
    label: 'Waiting Approval',
    description: 'Waiting for engineering or QA approval',
    icon: Clock,
    color: 'blue',
  },
  {
    code: 'REWORK_REQUIRED',
    label: 'Rework Required',
    description: 'Previous step requires correction',
    icon: AlertTriangle,
    color: 'rose',
  },
  {
    code: 'OTHER',
    label: 'Other',
    description: 'Other reason not listed',
    icon: MessageSquare,
    color: 'slate',
  },
]

// ============================================================================
// BLOCKED ITEM TYPE
// ============================================================================

export interface BlockedItem {
  /** Unique ID for this blocked item */
  id: string
  /** Reason code */
  reasonCode: BlockedReasonCode
  /** Part number if applicable */
  partNumber?: string
  /** Quantity missing */
  quantity?: number
  /** Additional notes */
  notes?: string
  /** When the block was reported */
  reportedAt: Date
  /** Who reported it */
  reportedBy: {
    badgeNumber: string
    fullName: string
    initials: string
  }
  /** Which section/step is blocked */
  sectionId?: string
  stepId?: string
  /** Status of the block */
  status: 'active' | 'resolved'
  /** Resolution info if resolved */
  resolvedAt?: Date
  resolvedBy?: {
    badgeNumber: string
    fullName: string
    initials: string
  }
}

// ============================================================================
// MODAL PROPS
// ============================================================================

interface SwsBlockedReasonModalProps {
  open: boolean
  onClose: () => void
  /** Can accept either BlockedItem format or simplified (items, reason) format */
  onSubmit: ((blockedItem: Omit<BlockedItem, 'id' | 'reportedAt' | 'status' | 'reportedBy'>) => void) | ((items: BlockedItem[], reason: string) => void)
  currentUser?: {
    badgeNumber: string
    fullName: string
    initials: string
  }
  sectionId?: string
  stepId?: string
  existingBlocks?: BlockedItem[]
  /** For simplified usage from assignment page */
  assignmentName?: string
  currentStage?: string
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SwsBlockedReasonModal({
  open,
  onClose,
  onSubmit,
  currentUser,
  sectionId,
  stepId,
  existingBlocks = [],
  assignmentName,
  currentStage,
}: SwsBlockedReasonModalProps) {
  const [selectedReason, setSelectedReason] = useState<BlockedReasonCode | null>(null)
  const [partNumber, setPartNumber] = useState('')
  const [quantity, setQuantity] = useState('')
  const [notes, setNotes] = useState('')
  const [step, setStep] = useState<'select' | 'details'>('select')

  const selectedReasonData = BLOCKED_REASONS.find(r => r.code === selectedReason)

  const handleSelectReason = (code: BlockedReasonCode) => {
    setSelectedReason(code)
    const reason = BLOCKED_REASONS.find(r => r.code === code)
    if (reason?.requiresPartNumber) {
      setStep('details')
    }
  }

  const handleSubmit = () => {
    if (!selectedReason) return

    // Create the blocked item
    const blockedItem: BlockedItem = {
      id: `block-${Date.now()}`,
      reasonCode: selectedReason,
      partNumber: partNumber || undefined,
      quantity: quantity ? parseInt(quantity) : undefined,
      notes: notes || undefined,
      reportedAt: new Date(),
      reportedBy: currentUser || { badgeNumber: '00000', fullName: 'Unknown', initials: 'UN' },
      sectionId,
      stepId,
      status: 'active',
    }

    // Support both callback signatures
    if (assignmentName || currentStage) {
      // Simplified callback for assignment page: (items, reason)
      (onSubmit as (items: BlockedItem[], reason: string) => void)([blockedItem], selectedReason)
    } else {
      // Original callback: (blockedItem partial)
      (onSubmit as (item: Omit<BlockedItem, 'id' | 'reportedAt' | 'status' | 'reportedBy'>) => void)({
        reasonCode: selectedReason,
        partNumber: partNumber || undefined,
        quantity: quantity ? parseInt(quantity) : undefined,
        notes: notes || undefined,
        sectionId,
        stepId,
      })
    }

    // Reset state
    setSelectedReason(null)
    setPartNumber('')
    setQuantity('')
    setNotes('')
    setStep('select')
    onClose()
  }

  const handleBack = () => {
    setStep('select')
  }

  const handleClose = () => {
    setSelectedReason(null)
    setPartNumber('')
    setQuantity('')
    setNotes('')
    setStep('select')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 'select' ? (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader className="p-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950 flex items-center justify-center">
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <DialogTitle className="text-lg">Report Blocked Status</DialogTitle>
                    <DialogDescription>
                      Select the reason why work cannot continue
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Existing Blocks */}
              {existingBlocks.filter(b => b.status === 'active').length > 0 && (
                <div className="px-6 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium mb-2">
                    Active Blocks ({existingBlocks.filter(b => b.status === 'active').length})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {existingBlocks.filter(b => b.status === 'active').map(block => {
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
                  </div>
                </div>
              )}

              {/* Reason Selection */}
              <div className="p-6 space-y-2 max-h-[50vh] overflow-y-auto">
                {BLOCKED_REASONS.map((reason) => {
                  const Icon = reason.icon
                  const isSelected = selectedReason === reason.code
                  
                  return (
                    <button
                      key={reason.code}
                      type="button"
                      onClick={() => handleSelectReason(reason.code)}
                      className={cn(
                        'w-full flex items-center gap-4 p-4 rounded-lg border-2 transition-all text-left',
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-border hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-900/50'
                      )}
                    >
                      <div className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center shrink-0',
                        reason.color === 'red' && 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400',
                        reason.color === 'orange' && 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400',
                        reason.color === 'amber' && 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
                        reason.color === 'purple' && 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400',
                        reason.color === 'blue' && 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
                        reason.color === 'rose' && 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400',
                        reason.color === 'slate' && 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
                      )}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground">{reason.label}</p>
                        <p className="text-sm text-muted-foreground">{reason.description}</p>
                      </div>
                      {reason.requiresPartNumber && (
                        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Actions */}
              <div className="p-6 pt-4 border-t border-border flex items-center justify-between">
                <Button variant="ghost" onClick={handleClose}>
                  Cancel
                </Button>
                {selectedReason && !selectedReasonData?.requiresPartNumber && (
                  <Button onClick={handleSubmit}>
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Report Block
                  </Button>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="details"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <DialogHeader className="p-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  {selectedReasonData && (
                    <div className={cn(
                      'h-10 w-10 rounded-lg flex items-center justify-center',
                      selectedReasonData.color === 'red' && 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400',
                      selectedReasonData.color === 'orange' && 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400',
                    )}>
                      <selectedReasonData.icon className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <DialogTitle className="text-lg">{selectedReasonData?.label}</DialogTitle>
                    <DialogDescription>
                      Provide details about the missing item
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Part Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={partNumber}
                    onChange={(e) => setPartNumber(e.target.value)}
                    placeholder="Enter part number (e.g., P/N 12345)"
                    className="font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Quantity Missing
                  </label>
                  <Input
                    type="number"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Enter quantity"
                    min="1"
                    className="w-32"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Additional Notes
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional details about the blocked item..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="p-6 pt-4 border-t border-border flex items-center justify-between">
                <Button variant="ghost" onClick={handleBack}>
                  Back
                </Button>
                <Button onClick={handleSubmit} disabled={!partNumber.trim()}>
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Report Block
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// BLOCKED STATUS BADGE
// ============================================================================

interface SwsBlockedStatusBadgeProps {
  // Either pass blocked items array or a simple reason code
  blockedItems?: BlockedItem[]
  reason?: BlockedReasonCode | string
  onClick?: () => void
  className?: string
}

export function SwsBlockedStatusBadge({ blockedItems, reason, onClick, className }: SwsBlockedStatusBadgeProps) {
  // If using blockedItems
  if (blockedItems && blockedItems.length > 0) {
    const activeBlocks = blockedItems.filter(b => b.status === 'active')
    if (activeBlocks.length === 0) return null
    
    const hasMissingParts = activeBlocks.some(b => b.reasonCode === 'MISSING_PARTS' || b.reasonCode === 'MISSING_HARDWARE')
    
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
          'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
          'border border-amber-300 dark:border-amber-700',
          onClick && 'hover:bg-amber-200 dark:hover:bg-amber-900/50 cursor-pointer',
          className
        )}
      >
        {hasMissingParts ? (
          <Package className="h-3.5 w-3.5" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5" />
        )}
        <span>{activeBlocks.length} Block{activeBlocks.length > 1 ? 's' : ''}</span>
      </button>
    )
  }
  
  // If using simple reason code
  if (reason) {
    const reasonInfo = BLOCKED_REASONS.find(r => r.code === reason)
    const Icon = reasonInfo?.icon || AlertTriangle
    
    return (
      <div
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium',
          'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300',
          'border border-amber-300 dark:border-amber-700',
          onClick && 'hover:bg-amber-200 dark:hover:bg-amber-900/50 cursor-pointer',
          className
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
      >
        <Icon className="h-3.5 w-3.5" />
        <span>{reasonInfo?.label || reason}</span>
      </div>
    )
  }
  
  return null
}

// ============================================================================
// BLOCKED ITEMS LIST
// ============================================================================

interface SwsBlockedItemsListProps {
  blockedItems: BlockedItem[]
  onResolve?: (itemId: string) => void
  compact?: boolean
}

export function SwsBlockedItemsList({ blockedItems, onResolve, compact = false }: SwsBlockedItemsListProps) {
  const activeBlocks = blockedItems.filter(b => b.status === 'active')
  
  if (activeBlocks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No active blocks</p>
      </div>
    )
  }
  
  return (
    <div className="space-y-2">
      {activeBlocks.map((block) => {
        const reason = BLOCKED_REASONS.find(r => r.code === block.reasonCode)
        const Icon = reason?.icon || AlertTriangle
        
        return (
          <div
            key={block.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border',
              'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800'
            )}
          >
            <div className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
              reason?.color === 'red' && 'bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400',
              reason?.color === 'orange' && 'bg-orange-100 dark:bg-orange-950 text-orange-600 dark:text-orange-400',
              reason?.color === 'amber' && 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
              reason?.color === 'purple' && 'bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400',
              reason?.color === 'blue' && 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
              reason?.color === 'rose' && 'bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400',
              reason?.color === 'slate' && 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400',
            )}>
              <Icon className="h-4 w-4" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm text-foreground">{reason?.label}</p>
                {block.partNumber && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {block.partNumber}
                  </Badge>
                )}
                {block.quantity && (
                  <Badge variant="secondary" className="text-xs">
                    Qty: {block.quantity}
                  </Badge>
                )}
              </div>
              
              {!compact && block.notes && (
                <p className="text-xs text-muted-foreground mt-1">{block.notes}</p>
              )}
              
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span>Reported by {block.reportedBy.initials}</span>
                <span>|</span>
                <span>{new Date(block.reportedAt).toLocaleString([], { 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}</span>
              </div>
            </div>
            
            {onResolve && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResolve(block.id)}
                className="shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
              >
                Resolve
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
