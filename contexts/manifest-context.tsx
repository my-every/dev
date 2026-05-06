"use client"

import {
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  type ReactNode,
} from "react"
import type {
  ProjectManifest,
  ManifestAssignment,
  ManifestCollectionFilters,
  ManifestCollectionSort,
  FlattenedAssignment,
  PriorityLevel,
} from "@/types/project-manifest"
import type { AssignmentStageId } from "@/types/d380-assignment-stages"
import {
  loadManifest,
  calculateProjectPriorities,
  calculateAggregates,
  flattenAndSortAssignments,
  filterFlattenedAssignments,
  sortFlattenedAssignments,
  updateAssignment,
  updateAssignmentStatus,
  updateAssignmentStage,
} from "@/lib/services"

// ============================================================================
// Context Types
// ============================================================================

interface ManifestContextValue {
  // Data
  manifests: ProjectManifest[]
  flattenedAssignments: FlattenedAssignment[]
  filteredAssignments: FlattenedAssignment[]

  // Filters & Sort
  filters: ManifestCollectionFilters
  sort: ManifestCollectionSort
  setFilters: (filters: ManifestCollectionFilters) => void
  setSort: (sort: ManifestCollectionSort) => void

  // Actions
  loadManifestData: (data: unknown) => void
  loadMultipleManifests: (data: unknown[]) => void
  updateManifestAssignment: (
    projectId: string,
    sheetSlug: string,
    updates: Partial<ManifestAssignment>
  ) => void
  setAssignmentStatus: (
    projectId: string,
    sheetSlug: string,
    status: ManifestAssignment["status"]
  ) => void
  setAssignmentStage: (
    projectId: string,
    sheetSlug: string,
    stage: AssignmentStageId
  ) => void

  // Computed
  getManifest: (projectId: string) => ProjectManifest | undefined
  getAssignment: (projectId: string, sheetSlug: string) => ManifestAssignment | undefined
  getTopPriorityAssignments: (limit?: number) => FlattenedAssignment[]
  getAssignmentsByStage: (stage: AssignmentStageId) => FlattenedAssignment[]
  getAssignmentsByPriority: (level: PriorityLevel) => FlattenedAssignment[]

  // Stats
  totalProjects: number
  totalAssignments: number
  criticalCount: number
  highCount: number
}

// ============================================================================
// Context Creation
// ============================================================================

const ManifestContext = createContext<ManifestContextValue | null>(null)

// ============================================================================
// Provider Component
// ============================================================================

interface ManifestProviderProps {
  children: ReactNode
  initialManifests?: ProjectManifest[]
}

export function ManifestProvider({
  children,
  initialManifests = [],
}: ManifestProviderProps) {
  // State
  const [manifests, setManifests] = useState<ProjectManifest[]>(initialManifests)
  const [filters, setFilters] = useState<ManifestCollectionFilters>({})
  const [sort, setSort] = useState<ManifestCollectionSort>({
    field: "priority",
    direction: "desc",
  })

  // Computed: Flatten all assignments with priorities
  const flattenedAssignments = useMemo(() => {
    return flattenAndSortAssignments(manifests)
  }, [manifests])

  // Computed: Apply filters and sort
  const filteredAssignments = useMemo(() => {
    const filtered = filterFlattenedAssignments(flattenedAssignments, filters)
    return sortFlattenedAssignments(filtered, sort)
  }, [flattenedAssignments, filters, sort])

  // Stats
  const totalProjects = manifests.length
  const totalAssignments = flattenedAssignments.length
  const criticalCount = useMemo(
    () => flattenedAssignments.filter((a) => a.priority.level === "critical").length,
    [flattenedAssignments]
  )
  const highCount = useMemo(
    () => flattenedAssignments.filter((a) => a.priority.level === "high").length,
    [flattenedAssignments]
  )

  // Actions
  const loadManifestData = useCallback((data: unknown) => {
    const manifest = loadManifest(data)
    setManifests((prev) => {
      // Replace if exists, otherwise add
      const index = prev.findIndex((m) => m.id === manifest.id)
      if (index >= 0) {
        const updated = [...prev]
        updated[index] = manifest
        return updated
      }
      return [...prev, manifest]
    })
  }, [])

  const loadMultipleManifests = useCallback((data: unknown[]) => {
    const loaded = data.map(loadManifest)
    setManifests(loaded)
  }, [])

  const updateManifestAssignment = useCallback(
    (projectId: string, sheetSlug: string, updates: Partial<ManifestAssignment>) => {
      setManifests((prev) =>
        prev.map((manifest) => {
          if (manifest.id !== projectId) return manifest
          const updated = updateAssignment(manifest, sheetSlug, updates)
          return calculateAggregates(calculateProjectPriorities(updated))
        })
      )
    },
    []
  )

  const setAssignmentStatus = useCallback(
    (projectId: string, sheetSlug: string, status: ManifestAssignment["status"]) => {
      setManifests((prev) =>
        prev.map((manifest) => {
          if (manifest.id !== projectId) return manifest
          const updated = updateAssignmentStatus(manifest, sheetSlug, status)
          return calculateAggregates(calculateProjectPriorities(updated))
        })
      )
    },
    []
  )

  const setAssignmentStage = useCallback(
    (projectId: string, sheetSlug: string, stage: AssignmentStageId) => {
      setManifests((prev) =>
        prev.map((manifest) => {
          if (manifest.id !== projectId) return manifest
          const updated = updateAssignmentStage(manifest, sheetSlug, stage)
          return calculateAggregates(calculateProjectPriorities(updated))
        })
      )
    },
    []
  )

  // Getters
  const getManifest = useCallback(
    (projectId: string) => manifests.find((m) => m.id === projectId),
    [manifests]
  )

  const getAssignment = useCallback(
    (projectId: string, sheetSlug: string) => {
      const manifest = manifests.find((m) => m.id === projectId)
      return manifest?.assignments[sheetSlug]
    },
    [manifests]
  )

  const getTopPriorityAssignments = useCallback(
    (limit = 10) => flattenedAssignments.slice(0, limit),
    [flattenedAssignments]
  )

  const getAssignmentsByStage = useCallback(
    (stage: AssignmentStageId) =>
      flattenedAssignments.filter((a) => a.assignment.stage === stage),
    [flattenedAssignments]
  )

  const getAssignmentsByPriority = useCallback(
    (level: PriorityLevel) =>
      flattenedAssignments.filter((a) => a.priority.level === level),
    [flattenedAssignments]
  )

  // Context value
  const value: ManifestContextValue = {
    manifests,
    flattenedAssignments,
    filteredAssignments,
    filters,
    sort,
    setFilters,
    setSort,
    loadManifestData,
    loadMultipleManifests,
    updateManifestAssignment,
    setAssignmentStatus,
    setAssignmentStage,
    getManifest,
    getAssignment,
    getTopPriorityAssignments,
    getAssignmentsByStage,
    getAssignmentsByPriority,
    totalProjects,
    totalAssignments,
    criticalCount,
    highCount,
  }

  return (
    <ManifestContext.Provider value={value}>{children}</ManifestContext.Provider>
  )
}

// ============================================================================
// Hook
// ============================================================================

export function useManifest() {
  const context = useContext(ManifestContext)
  if (!context) {
    throw new Error("useManifest must be used within a ManifestProvider")
  }
  return context
}

// ============================================================================
// Selector Hooks
// ============================================================================

export function useManifestFilters() {
  const { filters, setFilters, sort, setSort } = useManifest()
  return { filters, setFilters, sort, setSort }
}

export function useManifestStats() {
  const { totalProjects, totalAssignments, criticalCount, highCount } = useManifest()
  return { totalProjects, totalAssignments, criticalCount, highCount }
}

export function usePriorityQueue(limit?: number) {
  const { getTopPriorityAssignments, filteredAssignments } = useManifest()
  return limit ? getTopPriorityAssignments(limit) : filteredAssignments
}
