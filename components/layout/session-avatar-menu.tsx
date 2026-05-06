'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { UserAvatarMenu } from '@/components/layout/user-avatar-menu'
import { LoginPopup } from '@/components/dialog/login-popup'
import { PinChangeDialog } from '@/components/profile/pin-change-dialog'
import { useSession } from '@/hooks/use-session'
import { useFeedbackLoader } from '@/contexts/feedback-loader-context'
import { USER_ROLE_LABELS } from '@/types/d380-user-session'

/**
 * Session-aware avatar menu.
 *
 * - Authenticated → renders `UserAvatarMenu` with user data and sign-out.
 * - Not authenticated → renders a "Sign In" button that opens the
 *   `LoginPopup` modal. After successful login:
 *     • if `requiresPinChange` → shows `PinChangeDialog` first
 *     • then redirects to `/{badge}`
 */

interface SessionAvatarMenuProps {
    /** When true, only shows the avatar icon (no name). Used in the side rail. */
    showName?: boolean
    className?: string
}

export function SessionAvatarMenu({
    showName = false,
    className,
}: SessionAvatarMenuProps) {
    const router = useRouter()
    const { user, isAuthenticated, signOut } = useSession()
    const { showLoader } = useFeedbackLoader()

    const [loginOpen, setLoginOpen] = useState(false)
    const [pinChangeOpen, setPinChangeOpen] = useState(false)
    const [pinChangeBadge, setPinChangeBadge] = useState('')

    // After LoginPopup succeeds it navigates to /profile. But if the user
    // requires a PIN change we intercept here before navigation.
    useEffect(() => {
        if (isAuthenticated && user?.requiresPinChange && !pinChangeOpen) {
            setPinChangeBadge(user.badge)
            setPinChangeOpen(true)
        }
    }, [isAuthenticated, user, pinChangeOpen])

    const handleSignOut = useCallback(async () => {
        await signOut()
        router.push('/380')
    }, [signOut, router])

    const handlePinChangeDone = useCallback(
        (open: boolean) => {
            setPinChangeOpen(open)
            if (!open && user?.badge) {
                setPinChangeBadge('')
                showLoader('profile-transition')
                router.push(`/${user.badge}`)
            }
        },
        [router, user, showLoader],
    )

    // ── Not authenticated: render sign-in button ──
    if (!isAuthenticated || !user) {
        return (
            <>
                <button
                    type="button"
                    onClick={() => setLoginOpen(true)}
                    className={cn(
                        'group flex items-center justify-center rounded-2xl border border-border bg-card/90 text-left transition-colors hover:bg-accent',
                        showName ? 'gap-2 py-1.5 pl-2 pr-4' : 'h-12 w-12 p-0',
                        className,
                    )}
                    aria-label="Sign in"
                >
                    <Avatar className="h-10 w-10 rounded-2xl after:rounded-2xl">
                        <AvatarFallback className="rounded-2xl">
                            <LogIn className="h-4 w-4 text-muted-foreground" />
                        </AvatarFallback>
                    </Avatar>
                    {showName && (
                        <span className="hidden min-w-0 md:block">
                            <span className="block text-sm font-medium text-foreground">Sign In</span>
                        </span>
                    )}
                </button>

                <LoginPopup open={loginOpen} onOpenChange={setLoginOpen} />
            </>
        )
    }

    // ── Authenticated: render full avatar menu ──
    const fullName = user.preferredName
        ? `${user.preferredName} ${user.legalName?.split(' ').pop() ?? ''}`
        : user.legalName ?? 'User'

    return (
        <>
            <UserAvatarMenu
                fullName={fullName}
                role={USER_ROLE_LABELS[user.role] ?? user.role}
                initials={user.initials}
                presence="online"
                showName={showName}
                className={className}
                onSignOutSelect={handleSignOut}
            />

            {pinChangeBadge && (
                <PinChangeDialog
                    open={pinChangeOpen}
                    onOpenChange={handlePinChangeDone}
                    badge={pinChangeBadge}
                    required
                />
            )}
        </>
    )
}
