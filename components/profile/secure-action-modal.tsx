'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Shield, User, Lock, AlertCircle, Loader2, X, Delete } from 'lucide-react'

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
import type { SecureActionType } from '@/types/d380-user-session'
import { SECURE_ACTION_LABELS } from '@/types/d380-user-session'

// ============================================================================
// Types
// ============================================================================

interface SecureActionModalProps {
  /** Is open */
  open: boolean
  /** On close */
  onClose: () => void
  /** Action type */
  action: SecureActionType
  /** On submit credentials */
  onSubmit: (badge: string, pin: string) => Promise<void>
  /** Is submitting */
  isSubmitting?: boolean
  /** Error message */
  error?: string | null
  /** Title override */
  title?: string
  /** Description override */
  description?: string
  /** Show number pad (tablet mode) */
  showNumpad?: boolean
  /** Blocked badge numbers (e.g., workers can't do IPV) */
  blockedBadges?: string[]
  /** Message to show when blocked badge is entered */
  blockedMessage?: string
  /** Whether the current badge must change the default PIN before continuing */
  pinChangeRequired?: boolean
  /** Handle changing the PIN */
  onChangePin?: (badge: string, currentPin: string, nextPin: string) => Promise<void>
}

// ============================================================================
// Number Pad Component
// ============================================================================

interface NumpadProps {
  value: string
  onChange: (value: string) => void
  maxLength?: number
  disabled?: boolean
}

function Numpad({ value, onChange, maxLength = 4, disabled }: NumpadProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null)

  const handlePress = useCallback((digit: string) => {
    if (disabled) return
    if (value.length < maxLength) {
      onChange(value + digit)
    }
  }, [disabled, value, maxLength, onChange])

  const handleBackspace = useCallback(() => {
    if (disabled) return
    onChange(value.slice(0, -1))
  }, [disabled, value, onChange])

  const handleClear = useCallback(() => {
    if (disabled) return
    onChange('')
  }, [disabled, onChange])

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return
      
      const key = e.key
      if (/^[0-9]$/.test(key)) {
        setActiveKey(key)
        handlePress(key)
      } else if (key === 'Backspace') {
        setActiveKey('⌫')
        handleBackspace()
      } else if (key === 'Delete' || key === 'Escape') {
        setActiveKey('C')
        handleClear()
      }
    }

    const handleKeyUp = () => {
      setActiveKey(null)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [disabled, handlePress, handleBackspace, handleClear])

  const buttons = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    'C', '0', '⌫',
  ]

  return (
    <div className="grid grid-cols-3 gap-2">
      {buttons.map((btn) => (
        <Button
          key={btn}
          type="button"
          variant={btn === 'C' ? 'outline' : 'secondary'}
          size="lg"
          disabled={disabled}
          className={cn(
            'h-14 text-xl font-semibold transition-all duration-100',
            'hover:scale-[1.02] active:scale-95',
            'hover:bg-accent hover:shadow-md',
            btn === '⌫' && 'text-destructive hover:bg-destructive/10',
            btn === 'C' && 'hover:bg-muted',
            activeKey === btn && 'scale-95 bg-accent shadow-inner'
          )}
          onClick={() => {
            if (btn === 'C') handleClear()
            else if (btn === '⌫') handleBackspace()
            else handlePress(btn)
          }}
          onMouseDown={() => setActiveKey(btn)}
          onMouseUp={() => setActiveKey(null)}
          onMouseLeave={() => setActiveKey(null)}
          onTouchStart={() => setActiveKey(btn)}
          onTouchEnd={() => setActiveKey(null)}
        >
          {btn === '⌫' ? <Delete className="h-5 w-5" /> : btn}
        </Button>
      ))}
    </div>
  )
}

// ============================================================================
// PIN Display Component
// ============================================================================

interface PinDisplayProps {
  length: number
  filled: number
  error?: boolean
}

function PinDisplay({ length, filled, error }: PinDisplayProps) {
  return (
    <div className="flex items-center justify-center gap-3">
      {Array.from({ length }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-4 w-4 rounded-full border-2 transition-all',
            i < filled
              ? error
                ? 'border-destructive bg-destructive'
                : 'border-primary bg-primary'
              : 'border-muted-foreground/30 bg-transparent',
            error && 'animate-shake'
          )}
        />
      ))}
    </div>
  )
}

// ============================================================================
// Main Component
// ============================================================================

export function SecureActionModal({
  open,
  onClose,
  action,
  onSubmit,
  isSubmitting = false,
  error,
  title,
  description,
  showNumpad = true,
  blockedBadges = [],
  blockedMessage = 'This badge is not authorized for this action.',
  pinChangeRequired = false,
  onChangePin,
}: SecureActionModalProps) {
  const [badge, setBadge] = useState('')
  const [pin, setPin] = useState('')
  const [step, setStep] = useState<'badge' | 'pin' | 'change_pin'>('badge')
  const [localError, setLocalError] = useState<string | null>(null)
  const [nextPin, setNextPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const badgeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    setBadge('')
    setPin('')
    setNextPin('')
    setConfirmPin('')
    setStep('badge')
    setLocalError(null)
    setTimeout(() => badgeInputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    if (pinChangeRequired) {
      setStep('change_pin')
      setLocalError(null)
      return
    }

    if (step === 'change_pin') {
      setStep('badge')
      setPin('')
      setNextPin('')
      setConfirmPin('')
      setLocalError(null)
    }
  }, [pinChangeRequired, step])

  const handleBadgeSubmit = useCallback(() => {
    if (badge.length < 3) {
      return
    }

    if (blockedBadges.includes(badge)) {
      setLocalError(blockedMessage)
      return
    }

    setLocalError(null)
    setStep('pin')
  }, [badge, blockedBadges, blockedMessage])

  const handlePinChange = useCallback((value: string) => {
    setPin(value)
    if (value.length === 4) {
      void onSubmit(badge, value)
    }
  }, [badge, onSubmit])

  const handlePinResetSubmit = useCallback(async () => {
    if (!onChangePin) {
      return
    }

    if (!/^\d{4}$/.test(nextPin)) {
      setLocalError('Enter a new 4-digit PIN.')
      return
    }

    if (nextPin !== confirmPin) {
      setLocalError('The new PIN entries do not match.')
      return
    }

    if (nextPin === pin) {
      setLocalError('Choose a different PIN than the current one.')
      return
    }

    setLocalError(null)
    await onChangePin(badge, pin, nextPin)
  }, [badge, confirmPin, nextPin, onChangePin, pin])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()

    if (step === 'badge') {
      handleBadgeSubmit()
      return
    }

    if (step === 'pin' && pin.length === 4) {
      void onSubmit(badge, pin)
      return
    }

    if (step === 'change_pin') {
      void handlePinResetSubmit()
    }
  }, [badge, handleBadgeSubmit, handlePinResetSubmit, onSubmit, pin, step])

  const handleBack = useCallback(() => {
    setStep('badge')
    setPin('')
    setNextPin('')
    setConfirmPin('')
    setLocalError(null)
  }, [])

  const actionLabel = title || SECURE_ACTION_LABELS[action] || action
  const actionDescription = description || `Enter your credentials to ${actionLabel.toLowerCase()}`

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">{actionLabel}</DialogTitle>
          <DialogDescription className="text-center">
            {actionDescription}
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
                    onChange={(e) => {
                      setBadge(e.target.value.replace(/\D/g, ''))
                      setLocalError(null) // Clear error when typing
                    }}
                    placeholder="Enter badge number"
                    className={cn("pl-10 text-lg", localError && "border-destructive")}
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                </div>
                
                {/* Blocked badge error */}
                {localError && (
                  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{localError}</span>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={badge.length < 3 || isSubmitting}
              >
                Continue
              </Button>
            </div>
          ) : step === 'pin' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  <X className="mr-1 h-4 w-4" /> Change Badge
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  Badge: {badge}
                </div>
              </div>

              <div className="space-y-4">
                <div className="text-center">
                  <Label className="text-sm font-medium text-muted-foreground">
                    <Lock className="mr-1 inline h-4 w-4" />
                    Enter 4-digit PIN
                  </Label>
                </div>

                <PinDisplay length={4} filled={pin.length} error={!!error} />

                {error && (
                  <div className="flex items-center justify-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {error}
                  </div>
                )}

                {showNumpad ? (
                  <Numpad
                    value={pin}
                    onChange={handlePinChange}
                    maxLength={4}
                    disabled={isSubmitting}
                  />
                ) : (
                  <Input
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => handlePinChange(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="text-center text-2xl tracking-[0.5em]"
                    autoComplete="off"
                    disabled={isSubmitting}
                  />
                )}

                {isSubmitting && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  disabled={isSubmitting}
                >
                  <X className="mr-1 h-4 w-4" /> Change Badge
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  Badge: {badge}
                </div>
              </div>

              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                This account still uses the default PIN. Set a new 4-digit PIN to continue.
              </div>

              <div className="space-y-2">
                <Label htmlFor="next-pin" className="text-sm font-medium">
                  New PIN
                </Label>
                <Input
                  id="next-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={nextPin}
                  onChange={(e) => {
                    setNextPin(e.target.value.replace(/\D/g, ''))
                    setLocalError(null)
                  }}
                  placeholder="••••"
                  className="text-center text-2xl tracking-[0.5em]"
                  autoComplete="off"
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-pin" className="text-sm font-medium">
                  Confirm New PIN
                </Label>
                <Input
                  id="confirm-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={4}
                  value={confirmPin}
                  onChange={(e) => {
                    setConfirmPin(e.target.value.replace(/\D/g, ''))
                    setLocalError(null)
                  }}
                  placeholder="••••"
                  className="text-center text-2xl tracking-[0.5em]"
                  autoComplete="off"
                  disabled={isSubmitting}
                />
              </div>

              {(localError || error) && (
                <div className="flex items-center justify-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  {localError || error}
                </div>
              )}

              <Button
                type="button"
                className="w-full"
                size="lg"
                disabled={isSubmitting}
                onClick={() => void handlePinResetSubmit()}
              >
                Update PIN
              </Button>

              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Updating PIN...
                </div>
              )}
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
