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
import { useSession } from '@/hooks/use-session'
import { useFeedbackLoader } from '@/contexts/feedback-loader-context'

// ============================================================================
// LoginPopover
// ============================================================================

interface LoginPopoverProps {
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
}

export function LoginPopover({ children, side = 'top', align = 'center' }: LoginPopoverProps) {
  const router = useRouter()
  const { signIn } = useSession()
  const { showLoader } = useFeedbackLoader()

  const [open, setOpen] = useState(false)
  const [badge, setBadge] = useState('')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [showPin, setShowPin] = useState(false)

  const badgeInputRef = useRef<HTMLInputElement>(null)
  const pinInputRef = useRef<HTMLInputElement>(null)

  // Reset state when popover closes
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

  const handleSignIn = useCallback(async () => {
    if (!badge.trim()) {
      setPinError('Badge number is required.')
      return
    }
    if (pin.length !== 4) {
      setPinError('PIN must be 4 digits.')
      return
    }

    setIsSigningIn(true)
    setPinError('')

    const result = await signIn(badge.trim(), pin)

    if (result.success) {
      setOpen(false)
      showLoader('profile-transition')
      const normalizedBadge = badge.trim().replace(/\D/g, '')
      const assignmentHref = await resolveAssignmentRedirectHref(normalizedBadge)
      router.push(assignmentHref ?? `/${normalizedBadge}`)
    } else {
      setPinError(result.error || 'Invalid credentials. Please try again.')
      setPin('')
      pinInputRef.current?.focus()
    }
    setIsSigningIn(false)
  }, [badge, pin, signIn, router, showLoader])

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
            <Label htmlFor="login-popover-badge" className="text-xs">
              Badge Number
            </Label>
            <Input
              ref={badgeInputRef}
              id="login-popover-badge"
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
            <Label htmlFor="login-popover-pin" className="flex items-center gap-1.5 text-xs">
              <KeyRound className="h-3 w-3 text-muted-foreground" />
              4-Digit PIN
            </Label>
            <div className="relative">
              <Input
                ref={pinInputRef}
                id="login-popover-pin"
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
  )
}
