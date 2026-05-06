'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { KeyRound, Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/hooks/use-session'

// ============================================================================
// PIN Change Dialog
// ============================================================================

interface PinChangeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  badge: string
  /** When true the dialog cannot be dismissed without changing the PIN */
  required?: boolean
}

type PinStep = 'current' | 'new' | 'confirm' | 'success'

export function PinChangeDialog({ open, onOpenChange, badge, required }: PinChangeDialogProps) {
  const { changePin } = useSession()
  const [step, setStep] = useState<PinStep>('current')
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input on step change
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100)
      return () => clearTimeout(timer)
    }
  }, [open, step])

  const reset = useCallback(() => {
    setStep('current')
    setCurrentPin('')
    setNewPin('')
    setConfirmPin('')
    setError('')
    setIsSubmitting(false)
    setShowCurrent(false)
    setShowNew(false)
  }, [])

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && required && step !== 'success') return
      if (!next) reset()
      onOpenChange(next)
    },
    [onOpenChange, required, reset, step],
  )

  const handleSubmitCurrent = useCallback(() => {
    if (!/^\d{4}$/.test(currentPin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    setError('')
    setStep('new')
  }, [currentPin])

  const handleSubmitNew = useCallback(() => {
    if (!/^\d{4}$/.test(newPin)) {
      setError('PIN must be exactly 4 digits.')
      return
    }
    if (newPin === currentPin) {
      setError('New PIN must be different from current PIN.')
      return
    }
    setError('')
    setStep('confirm')
  }, [currentPin, newPin])

  const handleSubmitConfirm = useCallback(async () => {
    if (confirmPin !== newPin) {
      setError('PINs do not match. Please try again.')
      setConfirmPin('')
      return
    }
    setError('')
    setIsSubmitting(true)

    const result = await changePin(badge, currentPin, newPin)

    if (result.success) {
      setStep('success')
    } else {
      setError(result.error || 'Failed to change PIN. Check your current PIN.')
      setStep('current')
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
    }
    setIsSubmitting(false)
  }, [badge, changePin, confirmPin, currentPin, newPin])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key !== 'Enter') return
      if (step === 'current') handleSubmitCurrent()
      else if (step === 'new') handleSubmitNew()
      else if (step === 'confirm') void handleSubmitConfirm()
    },
    [handleSubmitConfirm, handleSubmitCurrent, handleSubmitNew, step],
  )

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-sm"
        onInteractOutside={(e) => { if (required && step !== 'success') e.preventDefault() }}
        onEscapeKeyDown={(e) => { if (required && step !== 'success') e.preventDefault() }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            {step === 'success' ? 'PIN Changed' : 'Change PIN'}
          </DialogTitle>
          <DialogDescription>
            {required && step !== 'success'
              ? 'You must change your PIN before continuing.'
              : step === 'success'
                ? 'Your PIN has been updated successfully.'
                : 'Enter your current PIN and choose a new 4-digit PIN.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'success' ? (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <CheckCircle className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Your PIN has been changed. You can now use your new PIN for secure actions.
            </p>
            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <div className="space-y-4 py-2" onKeyDown={handleKeyDown}>
            {/* Step indicators */}
            <div className="flex items-center gap-2 justify-center">
              {(['current', 'new', 'confirm'] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      step === s
                        ? 'bg-primary text-primary-foreground'
                        : (['current', 'new', 'confirm'].indexOf(step) > i)
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-muted text-muted-foreground',
                    )}
                  >
                    {i + 1}
                  </div>
                  {i < 2 && <div className="h-px w-6 bg-border" />}
                </div>
              ))}
            </div>

            {/* Current PIN */}
            {step === 'current' && (
              <div className="space-y-2">
                <Label htmlFor="current-pin">Current PIN</Label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    id="current-pin"
                    type={showCurrent ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    placeholder="••••"
                    value={currentPin}
                    onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="pr-10 text-center text-lg tracking-[0.5em] font-mono"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowCurrent(!showCurrent)}
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* New PIN */}
            {step === 'new' && (
              <div className="space-y-2">
                <Label htmlFor="new-pin">New PIN</Label>
                <div className="relative">
                  <Input
                    ref={inputRef}
                    id="new-pin"
                    type={showNew ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    placeholder="••••"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="pr-10 text-center text-lg tracking-[0.5em] font-mono"
                    autoComplete="off"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowNew(!showNew)}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Choose a 4-digit PIN you&apos;ll remember.</p>
              </div>
            )}

            {/* Confirm PIN */}
            {step === 'confirm' && (
              <div className="space-y-2">
                <Label htmlFor="confirm-pin">Confirm New PIN</Label>
                <Input
                  ref={inputRef}
                  id="confirm-pin"
                  type="password"
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  placeholder="••••"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="text-center text-lg tracking-[0.5em] font-mono"
                  autoComplete="off"
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Actions */}
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              {step !== 'current' && (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setError('')
                    setStep(step === 'confirm' ? 'new' : 'current')
                  }}
                >
                  Back
                </Button>
              )}
              <Button
                className="w-full sm:w-auto"
                disabled={
                  isSubmitting ||
                  (step === 'current' && currentPin.length !== 4) ||
                  (step === 'new' && newPin.length !== 4) ||
                  (step === 'confirm' && confirmPin.length !== 4)
                }
                onClick={() => {
                  if (step === 'current') handleSubmitCurrent()
                  else if (step === 'new') handleSubmitNew()
                  else void handleSubmitConfirm()
                }}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {step === 'confirm' ? 'Change PIN' : 'Next'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
