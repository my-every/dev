'use client'

import { useState, useCallback, useEffect } from 'react'

// ============================================================================
// useProfileCoverImage
//
// Reusable hook for cover image upload that converts a File to a base64 data
// URL, renders it immediately as a preview, and persists it to the user's
// profile.json via PATCH /api/users/[badge]/profile.
//
// Usage:
//   const { coverUrl, handleCoverChange, handleCoverRemove, isSaving } = useProfileCoverImage({ badge })
// ============================================================================

interface UseProfileCoverImageOptions {
  /** Badge number — used to call the profile API */
  badge: string
  /** Initial cover image URL (data URL or path) */
  initialUrl?: string | null
  /** Initial vertical position (0–100 %, default 50) */
  initialPositionY?: number
  /** Max file size in bytes (default: 4 MB) */
  maxSizeBytes?: number
  /** Called on error */
  onError?: (message: string) => void
  /** Called after successful save */
  onSaved?: (dataUrl: string | null) => void
}

interface UseProfileCoverImageReturn {
  /** Current cover image URL (data URL or null) */
  coverUrl: string | null
  /** Cover image vertical position (0–100 %) */
  positionY: number
  /** Whether a save is in progress */
  isSaving: boolean
  /** Error message (cleared on next upload) */
  error: string | null
  /** Pass this to ProfileCoverImageUploader's onImageChange */
  handleCoverChange: (file: File) => void
  /** Pass this to ProfileCoverImageUploader's onRemove */
  handleCoverRemove: () => void
  /** Update cover position and persist */
  handlePositionChange: (y: number) => void
}

const DEFAULT_MAX_SIZE = 4 * 1024 * 1024 // 4 MB (covers are larger)

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function useProfileCoverImage({
  badge,
  initialUrl = null,
  initialPositionY = 50,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  onError,
  onSaved,
}: UseProfileCoverImageOptions): UseProfileCoverImageReturn {
  const [coverUrl, setCoverUrl] = useState<string | null>(initialUrl)
  const [positionY, setPositionY] = useState<number>(initialPositionY)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Sync internal state when initialUrl changes (e.g. after async API fetch)
  useEffect(() => {
    if (initialUrl !== null) {
      setCoverUrl(initialUrl)
    }
  }, [initialUrl])

  // Sync position when it arrives from API
  useEffect(() => {
    setPositionY(initialPositionY)
  }, [initialPositionY])

  const persistCover = useCallback(
    async (dataUrl: string | null) => {
      setIsSaving(true)
      try {
        const res = await fetch(`/api/users/${badge}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coverImagePath: dataUrl }),
        })

        if (!res.ok) {
          throw new Error('Failed to save cover image')
        }

        onSaved?.(dataUrl)
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to save cover image'
        setError(msg)
        onError?.(msg)
      } finally {
        setIsSaving(false)
      }
    },
    [badge, onError, onSaved],
  )

  const handleCoverChange = useCallback(
    async (file: File) => {
      setError(null)

      if (!file.type.startsWith('image/')) {
        const msg = 'Please select an image file.'
        setError(msg)
        onError?.(msg)
        return
      }

      if (file.size > maxSizeBytes) {
        const sizeMb = (maxSizeBytes / (1024 * 1024)).toFixed(0)
        const msg = `Image must be under ${sizeMb} MB.`
        setError(msg)
        onError?.(msg)
        return
      }

      try {
        const dataUrl = await fileToDataUrl(file)
        setCoverUrl(dataUrl)
        await persistCover(dataUrl)
      } catch {
        const msg = 'Failed to process image.'
        setError(msg)
        onError?.(msg)
      }
    },
    [maxSizeBytes, onError, persistCover],
  )

  const handleCoverRemove = useCallback(() => {
    setError(null)
    setCoverUrl(null)
    setPositionY(50)
    void persistCover(null)
  }, [persistCover])

  const handlePositionChange = useCallback(
    async (y: number) => {
      const clamped = Math.max(0, Math.min(100, y))
      setPositionY(clamped)
      setIsSaving(true)
      try {
        const res = await fetch(`/api/users/${badge}/profile`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coverImagePositionY: clamped }),
        })
        if (!res.ok) throw new Error('Failed to save cover position')
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Failed to save position'
        setError(msg)
        onError?.(msg)
      } finally {
        setIsSaving(false)
      }
    },
    [badge, onError],
  )

  return {
    coverUrl,
    positionY,
    isSaving,
    error,
    handleCoverChange,
    handleCoverRemove,
    handlePositionChange,
  }
}
