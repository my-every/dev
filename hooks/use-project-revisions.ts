"use client"

/**
 * Hook for fetching and managing project revision history.
 * 
 * Provides:
 * - List of all wire list revisions
 * - List of all layout revisions  
 * - Current and previous revision selection
 * - Comparison state management
 */

import { useState, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import type { FileRevision, ProjectRevisionHistory } from '@/lib/revision/types'

// ============================================================================
// Types
// ============================================================================

interface UseProjectRevisionsOptions {
  projectId: string
  /** PD number hint for matching Legal Drawings folders */
  pdNumber?: string | null
  /** Whether to auto-fetch on mount */
  autoFetch?: boolean
}

interface UseProjectRevisionsReturn {
  /** All revision history */
  history: ProjectRevisionHistory | null
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Refresh revision data */
  refresh: () => void
  /** Selected wire list revision for comparison */
  selectedSourceRevision: FileRevision | null
  /** Select a revision for comparison */
  selectSourceRevision: (revision: FileRevision | null) => void
  /** Whether comparison modal is open */
  isComparisonOpen: boolean
  /** Open comparison modal */
  openComparison: (source: FileRevision, target: FileRevision) => void
  /** Close comparison modal */
  closeComparison: () => void
  /** Target revision for comparison (current) */
  comparisonTarget: FileRevision | null
  /** Has multiple revisions available */
  hasMultipleRevisions: boolean
}

// ============================================================================
// Fetcher
// ============================================================================

const fetcher = async (url: string): Promise<ProjectRevisionHistory> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch revisions')
  }
  return response.json()
}

// ============================================================================
// Hook
// ============================================================================

export function useProjectRevisions({
  projectId,
  pdNumber,
  autoFetch = true,
}: UseProjectRevisionsOptions): UseProjectRevisionsReturn {
  // Build URL with optional pdNumber query param for accurate folder matching
  const apiUrl = autoFetch && projectId
    ? pdNumber
      ? `/api/projects/revisions/${projectId}?pdNumber=${encodeURIComponent(pdNumber)}`
      : `/api/projects/revisions/${projectId}`
    : null

  // SWR for fetching revision data
  const {
    data: history,
    error,
    isLoading,
    mutate,
  } = useSWR<ProjectRevisionHistory>(
    apiUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  )
  
  // Comparison state
  const [selectedSourceRevision, setSelectedSourceRevision] = useState<FileRevision | null>(null)
  const [comparisonTarget, setComparisonTarget] = useState<FileRevision | null>(null)
  const [isComparisonOpen, setIsComparisonOpen] = useState(false)
  
  // Update comparison target when history changes
  useEffect(() => {
    if (history?.currentWireList) {
      setComparisonTarget(history.currentWireList)
    }
  }, [history?.currentWireList])
  
  const refresh = useCallback(() => {
    mutate()
  }, [mutate])
  
  const selectSourceRevision = useCallback((revision: FileRevision | null) => {
    setSelectedSourceRevision(revision)
  }, [])
  
  const openComparison = useCallback((source: FileRevision, target: FileRevision) => {
    setSelectedSourceRevision(source)
    setComparisonTarget(target)
    setIsComparisonOpen(true)
  }, [])
  
  const closeComparison = useCallback(() => {
    setIsComparisonOpen(false)
  }, [])
  
  const hasMultipleRevisions = Boolean(
    history && (history.wireListRevisions.length > 1 || history.layoutRevisions.length > 1)
  )
  
  return {
    history: history ?? null,
    isLoading,
    error: error || null,
    refresh,
    selectedSourceRevision,
    selectSourceRevision,
    isComparisonOpen,
    openComparison,
    closeComparison,
    comparisonTarget,
    hasMultipleRevisions,
  }
}
