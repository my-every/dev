'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Loader2,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  LogIn,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { PinChangeDialog } from '@/components/profile/pin-change-dialog'
import { useSession } from '@/hooks/use-session'
import { useFeedbackLoader } from '@/contexts/feedback-loader-context'

// ============================================================================
// ProfileLoginFlow
// A reusable login popover that handles badge+PIN authentication.
// If the user requires a PIN change (first-time login), the PinChangeDialog
// is automatically shown after successful sign-in before navigating away.
// ============================================================================

interface ProfileLoginFlowProps {
  /** Trigger element (e.g. a sign-in button) */
  children: React.ReactNode
  /** Popover placement side */
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Popover alignment */
  align?: 'start' | 'center' | 'end'
  /** Route to navigate to after successful login (defaults to /profile) */
  redirectTo?: string
  /** Called after successful login + optional PIN change */
  onLoginComplete?: () => void
}

export function ProfileLoginFlow({
  children,
  side = 'top',
  align = 'center',
  redirectTo = '/profile',
  onLoginComplete,
}: ProfileLoginFlowProps) {
  const router = useRouter()
  const { signIn, user } = useSession()
  const { showLoader } = useFeedbackLoader()

  // Popover state
  const [open, setOpen] = useState(false)
  const [badge, setBadge] = useState('')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [showPin, setShowPin] = useState(false)

  // PIN-change flow state
  const [showPinChange, setShowPinChange] = useState(false)
  const [pinChangeBadge, setPinChangeBadge] = useState('')
  // Tracks whether we're waiting for the session user to propagate after signIn
  const [pendingLogin, setPendingLogin] = useState(false)

  const badgeInputRef = useRef<HTMLInputElement>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  const navigateToProfile = useCallback(async () => {
    showLoader('profile-transition')
    let target = redirectTo

    if (redirectTo === `/${user.badge}` && user?.badge) {
      const assignmentHref = await resolveAssignmentRedirectHref(user.badge)
      target = assignmentHref ?? `/${user.badge}`
    }

    router.push(target)
    onLoginComplete?.()
  }, [showLoader, router, redirectTo, onLoginComplete, user?.badge])

  // Reset login form when popover closes
  useEffect(() => {
    if (!open) {
      setBadge('')
      setPin('')
      setPinError('')
      setIsSigningIn(false)
      setShowPin(false)
    }
  }, [open])

  // Auto-focus badge input when popover opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => badgeInputRef.current?.focus(), 150)
      return () => clearTimeout(timer)
    }
  }, [open])

  // After signIn succeeds, watch for user state to propagate.
  // If user requires PIN change, show the dialog. Otherwise navigate.
  useEffect(() => {
    if (!pendingLogin || !user) return

    if (user.requiresPinChange) {
      setPinChangeBadge(user.badge)
      setShowPinChange(true)
    } else {
      navigateToProfile()
    }
    setPendingLogin(false)
  }, [pendingLogin, user, navigateToProfile])

  const handleSignIn = useCallback(async () => {
    const normalizedBadge = badge.trim().replace(/\D/g, '')
    const normalizedPin = pin.trim().replace(/\D/g, '').slice(0, 4)

    if (!normalizedBadge) {
      setPinError('Badge number is required.')
      return
    }
    if (normalizedPin.length !== 4) {
      setPinError('PIN must be 4 digits.')
      return
    }

    setIsSigningIn(true)
    setPinError('')

    const result = await signIn(normalizedBadge, normalizedPin)

    if (result.success) {
      setOpen(false)
      // Signal the effect to check for requiresPinChange once user state updates
      setPendingLogin(true)
    } else {
      setPinError(result.error || 'Invalid credentials. Please try again.')
      setPin('')
      pinInputRef.current?.focus()
    }
    setIsSigningIn(false)
  }, [badge, pin, signIn])

  const handlePinChangeComplete = useCallback((nextOpen: boolean) => {
    setShowPinChange(nextOpen)
    if (!nextOpen) {
      // PIN change dialog closed — navigate to profile
      setPinChangeBadge('')
      navigateToProfile()
    }
  }, [navigateToProfile])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') void handleSignIn()
    },
    [handleSignIn],
  )

  const handleBadgeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && badge.trim()) {
        pinInputRef.current?.focus()
      }
    },
    [badge],
  )

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent side={side} align={align} className="w-72 p-0">
          <div className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center gap-2">
              <LogIn className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold">Sign In</h4>
            </div>

            {/* Badge input */}
            <div className="space-y-1.5">
              <Label htmlFor="profile-login-badge" className="text-xs">
                Badge Number
              </Label>
              <Input
                ref={badgeInputRef}
                id="profile-login-badge"
                type="text"
                inputMode="numeric"
                placeholder="e.g. 75241"
                value={badge}
                onChange={(e) => setBadge(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleBadgeKeyDown}
                className="h-9 text-sm"
                autoComplete="off"
                disabled={isSigningIn}
              />
            </div>

            {/* PIN input */}
            <div className="space-y-1.5" onKeyDown={handleKeyDown}>
              <Label htmlFor="profile-login-pin" className="flex items-center gap-1.5 text-xs">
                <KeyRound className="h-3 w-3 text-muted-foreground" />
                4-Digit PIN
              </Label>
              <div className="relative">
                <Input
                  ref={pinInputRef}
                  id="profile-login-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="\d{4}"
                  maxLength={4}
                  placeholder="••••"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="h-9 pr-8 text-center text-lg tracking-[0.4em] font-mono"
                  autoComplete="off"
                  disabled={isSigningIn}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6"
                  onClick={() => setShowPin(!showPin)}
                  tabIndex={-1}
                >
                  {showPin ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </Button>
              </div>
            </div>

            {/* Error */}
            {pinError && (
              <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Submit */}
            <Button
              className="w-full h-9 text-sm"
              disabled={!badge.trim() || pin.length !== 4 || isSigningIn}
              onClick={handleSignIn}
            >
              {isSigningIn && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Sign In
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* PIN Change Dialog — shown after sign-in if user requires PIN change */}
      {pinChangeBadge && (
        <PinChangeDialog
          open={showPinChange}
          onOpenChange={handlePinChangeComplete}
          badge={pinChangeBadge}
          required
        />
      )}
    </>
  )
}
