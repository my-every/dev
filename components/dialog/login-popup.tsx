'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users,
  ArrowLeft,
  Loader2,
  ChevronRight,
  KeyRound,
  AlertCircle,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { RoleChoiceBox } from '@/components/ui/role-choice-box'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSession } from '@/hooks/use-session'
import { useFeedbackLoader } from '@/contexts/feedback-loader-context'
import type { UserRole, UserIdentity } from '@/types/d380-user-session'
import { USER_ROLE_LABELS } from '@/types/d380-user-session'
import { resolveAssignmentRedirectHref } from '@/lib/session/client-assignment-redirect'

// ============================================================================
// Role Config for User List and PIN Entry styling
// ============================================================================

interface RoleCardConfig {
  role: UserRole
  color: string
  bgColor: string
}

const ROLE_STYLE_MAP: Record<UserRole, RoleCardConfig> = {
  DEVELOPER: {
    role: 'DEVELOPER',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  TEAM_LEAD: {
    role: 'TEAM_LEAD',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  ASSEMBLER: {
    role: 'ASSEMBLER',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
}

// ============================================================================
// LoginPopup
// ============================================================================

interface LoginPopupProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LoginPopup({ open, onOpenChange }: LoginPopupProps) {
  const router = useRouter()
  const { signIn } = useSession()
  const { showLoader } = useFeedbackLoader()

  const [step, setStep] = useState<'role' | 'user' | 'pin'>('role')
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)
  const [selectedUser, setSelectedUser] = useState<UserIdentity | null>(null)
  const [users, setUsers] = useState<UserIdentity[]>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const pinInputRef = useRef<HTMLInputElement>(null)

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep('role')
      setSelectedRole(null)
      setSelectedUser(null)
      setUsers([])
      setPin('')
      setPinError('')
      setIsSigningIn(false)
      setShowPin(false)
    }
  }, [open])

  // Focus PIN input
  useEffect(() => {
    if (step === 'pin') {
      const timer = setTimeout(() => pinInputRef.current?.focus(), 150)
      return () => clearTimeout(timer)
    }
  }, [step])

  const fetchUsers = useCallback(async (role: UserRole) => {
    setIsLoadingUsers(true)
    try {
      const response = await fetch('/api/session/users', { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to load users')
      const payload = (await response.json()) as { users?: UserIdentity[] }
      const allUsers = payload.users ?? []
      setUsers(allUsers.filter((u) => u.isActive && u.role === role))
    } catch {
      setUsers([])
    } finally {
      setIsLoadingUsers(false)
    }
  }, [])

  const handleSelectRole = useCallback(
    (role: UserRole) => {
      setSelectedRole(role)
      setStep('user')
      void fetchUsers(role)
    },
    [fetchUsers],
  )

  const handleSelectUser = useCallback((user: UserIdentity) => {
    setSelectedUser(user)
    setPin('')
    setPinError('')
    setStep('pin')
  }, [])

  const handleBack = useCallback(() => {
    if (step === 'pin') {
      setSelectedUser(null)
      setPin('')
      setPinError('')
      setShowPin(false)
      setStep('user')
    } else if (step === 'user') {
      setSelectedRole(null)
      setUsers([])
      setStep('role')
    }
  }, [step])

  const handleSignIn = useCallback(async () => {
    if (pin.length !== 4 || !selectedUser) return

    const normalizedBadge = selectedUser.badge.trim().replace(/\D/g, '')
    const normalizedPin = pin.trim().replace(/\D/g, '').slice(0, 4)

    if (!normalizedBadge || normalizedPin.length !== 4) {
      setPinError('Badge or PIN format is invalid. Please retry.')
      return
    }

    setIsSigningIn(true)
    setPinError('')

    const result = await signIn(normalizedBadge, normalizedPin)

    if (result.success) {
      onOpenChange(false)
      showLoader('profile-transition')
      const assignmentHref = await resolveAssignmentRedirectHref(normalizedBadge)
      router.push(assignmentHref ?? `/${normalizedBadge}`)
    } else {
      setPinError(result.error || 'Invalid PIN. Please try again.')
      setPin('')
      pinInputRef.current?.focus()
    }
    setIsSigningIn(false)
  }, [pin, selectedUser, signIn, router, onOpenChange, showLoader])

  const handlePinKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') void handleSignIn()
    },
    [handleSignIn],
  )

  const selectedConfig = selectedRole
    ? ROLE_STYLE_MAP[selectedRole]
    : null

  const title =
    step === 'pin'
      ? 'Enter PIN'
      : step === 'user'
        ? USER_ROLE_LABELS[selectedRole!]
        : 'Sign In'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto p-0" showCloseButton={false}>
        {/* Header */}
        <div className="sticky top-0 z-10 border-b bg-card px-4 py-3 sm:px-5">
          <div className="flex items-center gap-3">
            {step !== 'role' && (
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-semibold">{title}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {step === 'pin' && selectedUser
                  ? `Sign in as ${selectedUser.preferredName || selectedUser.legalName}`
                  : step === 'user'
                    ? 'Choose your name'
                    : 'Select your role to continue'}
              </p>
            </div>
            {selectedConfig && (
              <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', selectedConfig.bgColor)}>
                <span className={cn('text-sm font-semibold', selectedConfig.color)}>
                  {selectedRole?.charAt(0)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-4 py-4 sm:px-5">
          {step === 'role' && (
            <RoleChoiceBox
              value={null}
              onChange={handleSelectRole}
              layout="grid"
              size="compact"
            />
          )}

{step === 'user' && (
            <ModalUserList
              users={users}
              isLoading={isLoadingUsers}
              roleConfig={selectedConfig!}
              onSelect={handleSelectUser}
              showSearch={selectedRole === 'DEVELOPER'}
            />
          )}

          {step === 'pin' && selectedUser && selectedConfig && (
            <ModalPinEntry
              user={selectedUser}
              roleConfig={selectedConfig}
              pin={pin}
              onPinChange={setPin}
              pinError={pinError}
              isSigningIn={isSigningIn}
              showPin={showPin}
              onToggleShowPin={() => setShowPin(!showPin)}
              onSignIn={handleSignIn}
              onKeyDown={handlePinKeyDown}
              pinInputRef={pinInputRef}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Modal User List
// ============================================================================

function ModalUserList({
  users,
  isLoading,
  roleConfig,
  onSelect,
  showSearch = false,
}: {
  users: UserIdentity[]
  isLoading: boolean
  roleConfig: RoleCardConfig
  onSelect: (user: UserIdentity) => void
  showSearch?: boolean
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeShift, setActiveShift] = useState<'1st' | '2nd'>('1st')

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading team members…</p>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10">
        <Users className="h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No active members found.</p>
      </div>
    )
  }

  const shift1 = users.filter((u) => u.currentShift === '1st')
  const shift2 = users.filter((u) => u.currentShift === '2nd')

  // Filter users based on search query and active shift
  const filterUsers = (userList: UserIdentity[]) => {
    if (!searchQuery.trim()) return userList
    const query = searchQuery.toLowerCase()
    return userList.filter(
      (u) =>
        u.preferredName.toLowerCase().includes(query) ||
        u.legalName.toLowerCase().includes(query) ||
        u.badge.includes(query)
    )
  }

  const filteredShift1 = filterUsers(shift1)
  const filteredShift2 = filterUsers(shift2)
  const currentShiftUsers = activeShift === '1st' ? filteredShift1 : filteredShift2
  const totalFiltered = filteredShift1.length + filteredShift2.length

  return (
    <div className="space-y-3">
      {/* Search and count row */}
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-xs shrink-0">
          {searchQuery ? `${totalFiltered} of ${users.length}` : `${users.length}`} member{users.length !== 1 ? 's' : ''}
        </Badge>
        {showSearch && (
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by name or badge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-sm"
            />
          </div>
        )}
      </div>

      {/* Shift Tabs */}
      <div className="flex rounded-lg border bg-muted/30 p-0.5">
        <button
          type="button"
          onClick={() => setActiveShift('1st')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
            activeShift === '1st'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          First Shift
          {filteredShift1.length > 0 && (
            <span className="ml-1.5 text-[10px] text-muted-foreground">({filteredShift1.length})</span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveShift('2nd')}
          className={cn(
            'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
            activeShift === '2nd'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Second Shift
          {filteredShift2.length > 0 && (
            <span className="ml-1.5 text-[10px] text-muted-foreground">({filteredShift2.length})</span>
          )}
        </button>
      </div>

      {/* User grid for active shift */}
      {currentShiftUsers.length > 0 ? (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {currentShiftUsers.map((user) => (
            <Card
              key={user.badge}
              className="cursor-pointer border transition-all duration-150 hover:shadow-sm hover:border-primary/30"
              onClick={() => onSelect(user)}
            >
              <CardContent className="flex items-center gap-2.5 p-2.5">
                <div
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    roleConfig.bgColor,
                    roleConfig.color,
                  )}
                >
                  {user.initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {user.preferredName} {user.legalName.split(' ').pop()}
                  </p>
                  <p className="text-xs text-muted-foreground">Badge {user.badge}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 py-8">
          <Users className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {searchQuery ? 'No members match your search.' : `No members in ${activeShift} shift.`}
          </p>
        </div>
      )}
    </div>
  )
}



// ============================================================================
// Modal PIN Entry
// ============================================================================

function ModalPinEntry({
  user,
  roleConfig,
  pin,
  onPinChange,
  pinError,
  isSigningIn,
  showPin,
  onToggleShowPin,
  onSignIn,
  onKeyDown,
  pinInputRef,
}: {
  user: UserIdentity
  roleConfig: RoleCardConfig
  pin: string
  onPinChange: (pin: string) => void
  pinError: string
  isSigningIn: boolean
  showPin: boolean
  onToggleShowPin: () => void
  onSignIn: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  pinInputRef: React.RefObject<HTMLInputElement | null>
}) {
  return (
    <div className="space-y-4">
      {/* User card */}
      <Card className="border">
        <CardContent className="flex items-center gap-3 p-3">
          <div
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
              roleConfig.bgColor,
              roleConfig.color,
            )}
          >
            {user.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{user.preferredName || user.legalName}</p>
            <p className="text-xs text-muted-foreground">
              Badge {user.badge} · {USER_ROLE_LABELS[user.role]}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* PIN input */}
      <div className="space-y-3" onKeyDown={onKeyDown}>
        <Label htmlFor="login-popup-pin" className="flex items-center gap-2 text-sm font-medium">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          Enter your 4-digit PIN
        </Label>
        <div className="relative">
          <Input
            ref={pinInputRef}
            id="login-popup-pin"
            type={showPin ? 'text' : 'password'}
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            placeholder="••••"
            value={pin}
            onChange={(e) => onPinChange(e.target.value.replace(/\D/g, '').slice(0, 4))}
            className="pr-10 text-center text-2xl tracking-[0.5em] font-mono h-14"
            autoComplete="off"
            disabled={isSigningIn}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={onToggleShowPin}
            tabIndex={-1}
          >
            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        {pinError && (
          <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{pinError}</span>
          </div>
        )}

        <Button className="w-full h-11" disabled={pin.length !== 4 || isSigningIn} onClick={onSignIn}>
          {isSigningIn && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
      </div>
    </div>
  )
}
