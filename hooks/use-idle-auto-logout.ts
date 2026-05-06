'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/hooks/use-session'

// ============================================================================
// Types
// ============================================================================

/** Idle timeout preset in milliseconds */
export type IdleTimeoutOption = {
    label: string
    value: number
}

/** Available idle timeout presets */
export const IDLE_TIMEOUT_OPTIONS: IdleTimeoutOption[] = [
    { label: '5 minutes', value: 5 * 60 * 1000 },
    { label: '15 minutes', value: 15 * 60 * 1000 },
    { label: '30 minutes', value: 30 * 60 * 1000 },
    { label: '1 hour', value: 60 * 60 * 1000 },
    { label: 'Never', value: 0 },
]

const STORAGE_KEY = 'd380_idle_timeout'

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
    'mousedown',
    'mousemove',
    'keydown',
    'touchstart',
    'scroll',
    'pointerdown',
]

// ============================================================================
// Helpers
// ============================================================================

/** Get saved timeout from localStorage (default: 30 minutes) */
export function getIdleTimeout(): number {
    if (typeof window === 'undefined') return 30 * 60 * 1000
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved !== null) {
        const parsed = Number(saved)
        if (!isNaN(parsed) && parsed >= 0) return parsed
    }
    return 30 * 60 * 1000
}

/** Persist the idle timeout preference */
export function setIdleTimeout(ms: number): void {
    localStorage.setItem(STORAGE_KEY, String(ms))
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Monitors user activity and automatically signs out after the
 * configured idle period. Only active when the user is authenticated.
 *
 * @param overrideMs — override the stored timeout (useful for testing)
 */
export function useIdleAutoLogout(overrideMs?: number) {
    const { isAuthenticated, signOut } = useSession()
    const router = useRouter()
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const timeoutMs = overrideMs ?? getIdleTimeout()

    const handleLogout = useCallback(async () => {
        await signOut()
        router.replace('/380')
    }, [signOut, router])

    const resetTimer = useCallback(() => {
        if (timerRef.current) clearTimeout(timerRef.current)

        // 0 means "never auto-logout"
        if (timeoutMs <= 0 || !isAuthenticated) return

        timerRef.current = setTimeout(() => {
            void handleLogout()
        }, timeoutMs)
    }, [timeoutMs, isAuthenticated, handleLogout])

    useEffect(() => {
        if (!isAuthenticated || timeoutMs <= 0) return

        // Start the timer immediately
        resetTimer()

        // Reset on every activity event
        const handler = () => resetTimer()
        for (const event of ACTIVITY_EVENTS) {
            window.addEventListener(event, handler, { passive: true })
        }

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current)
            for (const event of ACTIVITY_EVENTS) {
                window.removeEventListener(event, handler)
            }
        }
    }, [isAuthenticated, timeoutMs, resetTimer])
}
