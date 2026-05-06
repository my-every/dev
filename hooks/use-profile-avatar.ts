'use client'

import { useState, useCallback, useEffect } from 'react'

// ============================================================================
// useProfileAvatar
//
// Reusable hook for avatar upload that converts a File to a base64 data URL,
// renders it immediately as a preview, and persists it to the user's
// profile.json via PATCH /api/users/[badge]/profile.
//
// Usage:
//   const { avatarUrl, handleAvatarChange, handleAvatarRemove, isSaving } = useProfileAvatar(badge)
// ============================================================================

interface UseProfileAvatarOptions {
  /** Badge number — used to call the profile API */
  badge: string
  /** Initial avatar URL (data URL or path) */
  initialUrl?: string | null
  /** Max file size in bytes (default: 2 MB) */
  maxSizeBytes?: number
  /** Called on error */
  onError?: (message: string) => void
  /** Called after successful save */
  onSaved?: (dataUrl: string | null) => void
}

interface UseProfileAvatarReturn {
  /** Current avatar URL (data URL or null) */
  avatarUrl: string | null
  /** Whether a save is in progress */
  isSaving: boolean
  /** Error message (cleared on next upload) */
  error: string | null
  /** Pass this to ProfileAvatarUploader's onImageChange */
  handleAvatarChange: (file: File) => void
  /** Pass this to ProfileAvatarUploader's onRemove */
  handleAvatarRemove: () => void
}

const DEFAULT_MAX_SIZE = 2 * 1024 * 1024 // 2 MB

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function useProfileAvatar({
  badge,
  initialUrl = null,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  onError,
  onSaved,
}: UseProfileAvatarOptions): UseProfileAvatarReturn {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialUrl)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync internal state when initialUrl changes (e.g. after async API fetch)
  useEffect(() => {
    if (initialUrl !== null) {
      setAvatarUrl(initialUrl)
    }
  }, [initialUrl])

  const persistAvatar = useCallback(
    async (dataUrl: string | null) => {
      setIsSaving(true)
      try {
        const res = await fetch(`/api/users/${badge}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ avatarPath: dataUrl }),
        })

        if (!res.ok) {
          throw new Error('Failed to save avatar')
        }

        onSaved?.(dataUrl)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to save avatar'
        setError(msg)
        onError?.(msg)
      } finally {
        setIsSaving(false)
      }
    },
    [badge, onError, onSaved],
  )

  const handleAvatarChange = useCallback(
    async (file: File) => {
      setError(null)

      // Validate type
      if (!file.type.startsWith('image/')) {
        const msg = 'Please select an image file.'
        setError(msg)
        onError?.(msg)
        return
      }

      // Validate size
      if (file.size > maxSizeBytes) {
        const sizeMb = (maxSizeBytes / (1024 * 1024)).toFixed(0)
        const msg = `Image must be under ${sizeMb} MB.`
        setError(msg)
        onError?.(msg)
        return
      }

      try {
        const dataUrl = await fileToDataUrl(file)
        // Set preview immediately
        setAvatarUrl(dataUrl)
        // Persist in background
        await persistAvatar(dataUrl)
      } catch {
        const msg = 'Failed to process image.'
        setError(msg)
        onError?.(msg)
      }
    },
    [maxSizeBytes, onError, persistAvatar],
  )

  const handleAvatarRemove = useCallback(() => {
    setError(null)
    setAvatarUrl(null)
    void persistAvatar(null)
  }, [persistAvatar])

  return {
    avatarUrl,
    isSaving,
    error,
    handleAvatarChange,
    handleAvatarRemove,
  }
}
