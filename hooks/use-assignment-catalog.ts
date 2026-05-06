'use client'

/**
 * useAssignmentCatalog Hook
 * 
 * Manages catalog data loading and normalization for an assignment.
 * Combines part catalog, reference data, and wire list data.
 */

import { useState, useEffect, useCallback } from 'react'
import useSWR from 'swr'
import type {
  PartCatalog,
  AssignmentComponentSummary,
  ProjectReferenceData,
} from '@/types/d380-catalog'
import type { ParsedWorkbookSheet } from '@/lib/workbook/types'
import {
  loadPartCatalog,
  buildAssignmentComponentSummary,
  buildProjectReferenceData,
  getComponentStats,
} from '@/lib/catalog'

// ============================================================================
// TYPES
// ============================================================================

export interface UseAssignmentCatalogOptions {
  /** Project ID */
  projectId: string
  /** Assignment ID */
  assignmentId: string
  /** Sheet name for the assignment */
  sheetName: string
  /** Parsed sheet data (if already available) */
  sheetData?: ParsedWorkbookSheet
  /** Reference sheets data */
  referenceSheets?: { name: string; sheet: ParsedWorkbookSheet }[]
  /** Auto-load catalog on mount */
  autoLoad?: boolean
}

export interface UseAssignmentCatalogResult {
  /** Whether catalog is loading */
  isLoading: boolean
  /** Error if loading failed */
  error: Error | null
  /** Loaded part catalog */
  catalog: PartCatalog | null
  /** Normalized component summary */
  componentSummary: AssignmentComponentSummary | null
  /** Project reference data */
  referenceData: ProjectReferenceData | null
  /** Component statistics */
  stats: ReturnType<typeof getComponentStats> | null
  /** Manually trigger catalog load/refresh */
  refresh: () => Promise<void>
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useAssignmentCatalog({
  projectId,
  assignmentId,
  sheetName,
  sheetData,
  referenceSheets,
  autoLoad = true,
}: UseAssignmentCatalogOptions): UseAssignmentCatalogResult {
  const [catalog, setCatalog] = useState<PartCatalog | null>(null)
  const [componentSummary, setComponentSummary] = useState<AssignmentComponentSummary | null>(null)
  const [referenceData, setReferenceData] = useState<ProjectReferenceData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  // Load catalog using SWR for caching
  const { data: loadedCatalog, error: catalogError } = useSWR(
    autoLoad ? 'part-catalog' : null,
    loadPartCatalog,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000, // 1 minute
    }
  )
  
  // Set catalog when loaded
  useEffect(() => {
    if (loadedCatalog) {
      setCatalog(loadedCatalog)
    }
  }, [loadedCatalog])
  
  // Set error if catalog failed to load
  useEffect(() => {
    if (catalogError) {
      setError(catalogError)
    }
  }, [catalogError])
  
  // Build reference data when reference sheets change
  useEffect(() => {
    if (referenceSheets && referenceSheets.length > 0) {
      const data = buildProjectReferenceData(projectId, referenceSheets)
      setReferenceData(data)
    }
  }, [projectId, referenceSheets])
  
  // Build component summary when dependencies are ready
  useEffect(() => {
    if (!sheetData || !assignmentId) return
    
    setIsLoading(true)
    
    try {
      const summary = buildAssignmentComponentSummary(
        assignmentId,
        sheetName,
        sheetData,
        catalog,
        referenceData
      )
      setComponentSummary(summary)
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to build component summary'))
    } finally {
      setIsLoading(false)
    }
  }, [assignmentId, sheetName, sheetData, catalog, referenceData])
  
  // Calculate stats
  const stats = componentSummary ? getComponentStats(componentSummary) : null
  
  // Refresh function
  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Reload catalog
      const freshCatalog = await loadPartCatalog()
      setCatalog(freshCatalog)
      
      // Rebuild reference data
      if (referenceSheets && referenceSheets.length > 0) {
        const data = buildProjectReferenceData(projectId, referenceSheets)
        setReferenceData(data)
      }
      
      // Rebuild component summary
      if (sheetData && assignmentId) {
        const summary = buildAssignmentComponentSummary(
          assignmentId,
          sheetName,
          sheetData,
          freshCatalog,
          referenceData
        )
        setComponentSummary(summary)
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh catalog'))
    } finally {
      setIsLoading(false)
    }
  }, [projectId, assignmentId, sheetName, sheetData, referenceSheets, referenceData])
  
  return {
    isLoading: isLoading || (!loadedCatalog && autoLoad),
    error,
    catalog,
    componentSummary,
    referenceData,
    stats,
    refresh,
  }
}

// ============================================================================
// CATALOG LOOKUP HOOK
// ============================================================================

/**
 * Hook for simple part number lookups against the catalog.
 */
export function usePartLookup(partNumber: string | null) {
  const { data: catalog } = useSWR('part-catalog', loadPartCatalog, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  })
  
  const [result, setResult] = useState<ReturnType<typeof import('@/lib/catalog').lookupByPartNumber> | null>(null)
  
  useEffect(() => {
    if (!catalog || !partNumber) {
      setResult(null)
      return
    }
    
    import('@/lib/catalog').then(({ lookupByPartNumber }) => {
      const lookupResult = lookupByPartNumber(catalog, partNumber)
      setResult(lookupResult)
    })
  }, [catalog, partNumber])
  
  return {
    isLoading: !catalog && !!partNumber,
    result,
    record: result?.record || null,
  }
}
