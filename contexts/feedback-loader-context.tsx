'use client'

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'

// ============================================================================
// Types
// ============================================================================

/** Supported loader visual styles */
export type LoaderVariant = 'full-page' | 'skeleton' | 'spinner'

/** Registered loader preset configuration */
export interface LoaderPreset {
  id: string
  variant: LoaderVariant
  /** Human-readable label (used for accessible aria-label) */
  label?: string
  /** Minimum display duration in ms before auto-dismiss */
  minDuration?: number
}

/** Active loader state */
export interface ActiveLoader {
  preset: LoaderPreset
  startedAt: number
}

/** Context value exposed to consumers */
export interface FeedbackLoaderContextValue {
  /** Currently active loader, or null */
  activeLoader: ActiveLoader | null
  /** Show a loader by preset id or inline preset */
  showLoader: (presetOrId: string | LoaderPreset) => void
  /** Hide the current loader */
  hideLoader: () => void
  /** Register a reusable preset */
  registerPreset: (preset: LoaderPreset) => void
  /** Check if a loader is currently visible */
  isLoading: boolean
}

// ============================================================================
// Built-in presets
// ============================================================================

const BUILT_IN_PRESETS: LoaderPreset[] = [
  {
    id: 'profile-transition',
    variant: 'full-page',
    label: 'Loading profile…',
    minDuration: 800,
  },
  {
    id: 'profile-skeleton',
    variant: 'skeleton',
    label: 'Loading profile…',
  },
  {
    id: 'projects-skeleton',
    variant: 'skeleton',
    label: 'Loading projects…',
  },
  {
    id: 'page-transition',
    variant: 'full-page',
    label: 'Loading…',
    minDuration: 600,
  },
]

// ============================================================================
// Context
// ============================================================================

const FeedbackLoaderContext = createContext<FeedbackLoaderContextValue | null>(null)

// ============================================================================
// Provider
// ============================================================================

export function FeedbackLoaderProvider({ children }: { children: ReactNode }) {
  const [presets, setPresets] = useState<Map<string, LoaderPreset>>(() => {
    const map = new Map<string, LoaderPreset>()
    for (const p of BUILT_IN_PRESETS) map.set(p.id, p)
    return map
  })

  const [activeLoader, setActiveLoader] = useState<ActiveLoader | null>(null)

  const registerPreset = useCallback((preset: LoaderPreset) => {
    setPresets((prev) => {
      const next = new Map(prev)
      next.set(preset.id, preset)
      return next
    })
  }, [])

  const showLoader = useCallback(
    (presetOrId: string | LoaderPreset) => {
      let preset: LoaderPreset

      if (typeof presetOrId === 'string') {
        const found = presets.get(presetOrId)
        if (!found) {
          // Fallback: create an ad-hoc spinner preset
          preset = { id: presetOrId, variant: 'spinner', label: 'Loading…' }
        } else {
          preset = found
        }
      } else {
        preset = presetOrId
      }

      setActiveLoader({ preset, startedAt: Date.now() })
    },
    [presets],
  )

  const hideLoader = useCallback(() => {
    setActiveLoader((current) => {
      if (!current) return null

      const min = current.preset.minDuration ?? 0
      const elapsed = Date.now() - current.startedAt

      if (elapsed < min) {
        // Defer hide until minDuration elapses
        setTimeout(() => setActiveLoader(null), min - elapsed)
        return current
      }

      return null
    })
  }, [])

  return (
    <FeedbackLoaderContext.Provider
      value={{
        activeLoader,
        showLoader,
        hideLoader,
        registerPreset,
        isLoading: activeLoader !== null,
      }}
    >
      {children}
    </FeedbackLoaderContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useFeedbackLoader(): FeedbackLoaderContextValue {
  const ctx = useContext(FeedbackLoaderContext)
  if (!ctx) {
    throw new Error('useFeedbackLoader must be used within a FeedbackLoaderProvider')
  }
  return ctx
}
