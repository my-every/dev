'use client'

/**
 * ShiftBadgeModal
 * 
 * Modal for capturing badge ID, name, and shift selection.
 * Simplified version for Build Up execution (no PIN required).
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { User, Sun, Moon, RotateCcw, Loader2, X } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { WorkShift } from '@/types/d380-build-up-execution'

// ============================================================================
// Types
// ============================================================================

interface ShiftBadgeModalProps {
  /** Is modal open */
  open: boolean
  /** On close callback */
  onClose: () => void
  /** On submit callback */
  onSubmit: (badgeId: string, name: string, shift: WorkShift) => void
  /** Modal title */
  title?: string
  /** Modal description */
  description?: string
  /** Whether shift selection is required */
  requireShift?: boolean
  /** Default shift value */
  defaultShift?: WorkShift
  /** Is submitting */
  isSubmitting?: boolean
}

// ============================================================================
// Shift Button Component
// ============================================================================

interface ShiftButtonProps {
  shift: WorkShift
  selected: boolean
  onClick: () => void
  disabled?: boolean
}

const shiftConfig: Record<WorkShift, { icon: typeof Sun; label: string; color: string }> = {
  day: {
    icon: Sun,
    label: 'Day',
    color: 'amber',
  },
  night: {
    icon: Moon,
    label: 'Night',
    color: 'indigo',
  },
  swing: {
    icon: RotateCcw,
    label: 'Swing',
    color: 'purple',
  },
}

function ShiftButton({ shift, selected, onClick, disabled }: ShiftButtonProps) {
  const config = shiftConfig[shift]
  const Icon = config.icon

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected
          ? `border-${config.color}-500 bg-${config.color}-50 dark:bg-${config.color}-950/20`
          : 'border-muted hover:border-muted-foreground/30',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      style={{
        borderColor: selected ? `var(--${config.color}-500, hsl(var(--primary)))` : undefined,
        backgroundColor: selected ? `var(--${config.color}-50, hsl(var(--muted)))` : undefined,
      }}
    >
      <Icon className={cn(
        'h-6 w-6',
        selected ? `text-${config.color}-600` : 'text-muted-foreground'
      )} />
      <span className={cn(
        'text-sm font-medium',
        selected ? 'text-foreground' : 'text-muted-foreground'
      )}>
        {config.label}
      </span>
    </button>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function ShiftBadgeModal({
  open,
  onClose,
  onSubmit,
  title = 'Enter Badge',
  description = 'Enter your badge number to continue',
  requireShift = true,
  defaultShift = 'day',
  isSubmitting = false,
}: ShiftBadgeModalProps) {
  const [badge, setBadge] = useState('')
  const [name, setName] = useState('')
  const [shift, setShift] = useState<WorkShift>(defaultShift)
  const [step, setStep] = useState<'badge' | 'shift'>('badge')
  const badgeInputRef = useRef<HTMLInputElement>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setBadge('')
      setName('')
      setShift(defaultShift)
      setStep('badge')
      setTimeout(() => badgeInputRef.current?.focus(), 100)
    }
  }, [open, defaultShift])

  // Auto-generate name from badge (mock for now)
  const lookupName = useCallback((badgeId: string): string => {
    // In a real implementation, this would lookup the employee name
    // For now, generate a placeholder
    const mockNames: Record<string, string> = {
      '123': 'John Smith',
      '456': 'Jane Doe',
      '789': 'Mike Johnson',
    }
    return mockNames[badgeId] || `Employee ${badgeId}`
  }, [])

  // Handle badge submission
  const handleBadgeSubmit = useCallback(() => {
    if (badge.length >= 3) {
      const employeeName = lookupName(badge)
      setName(employeeName)
      
      if (requireShift) {
        setStep('shift')
      } else {
        onSubmit(badge, employeeName, shift)
      }
    }
  }, [badge, lookupName, requireShift, shift, onSubmit])

  // Handle shift submission
  const handleShiftSubmit = useCallback(() => {
    onSubmit(badge, name, shift)
  }, [badge, name, shift, onSubmit])

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (step === 'badge') {
      handleBadgeSubmit()
    } else {
      handleShiftSubmit()
    }
  }, [step, handleBadgeSubmit, handleShiftSubmit])

  // Handle back to badge
  const handleBack = useCallback(() => {
    setStep('badge')
    setName('')
  }, [])

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <User className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {step === 'badge' ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="badge" className="text-sm font-medium">
                  Badge Number
                </Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={badgeInputRef}
                    id="badge"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value.replace(/\D/g, ''))}
                    placeholder="Enter badge number"
                    className="pl-10 text-lg"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={badge.length < 3 || isSubmitting}
              >
                {requireShift ? 'Continue' : 'Submit'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Badge Info Header */}
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  <X className="mr-1 h-4 w-4" /> Change
                </Button>
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{name}</span>
                  <span className="text-muted-foreground">({badge})</span>
                </div>
              </div>

              {/* Shift Selection */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Shift</Label>
                <div className="grid grid-cols-3 gap-3">
                  {(['day', 'night', 'swing'] as const).map((s) => (
                    <ShiftButton
                      key={s}
                      shift={s}
                      selected={shift === s}
                      onClick={() => setShift(s)}
                      disabled={isSubmitting}
                    />
                  ))}
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm'
                )}
              </Button>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
