/**
 * Manifest Service
 *
 * CRUD operations and utilities for managing project manifests:
 * - Load/save manifests
 * - Filter and sort assignments
 * - Calculate aggregates
 * - Group by various dimensions
 */

import type {
  ProjectManifest,
  ManifestAssignment,
  ManifestAssignmentStatus,
  ManifestCollectionFilters,
  ManifestCollectionSort,
  ProjectManifestAggregates,
  FlattenedAssignment,
  PriorityLevel,
} from '@/types/project-manifest'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { FloorArea } from '@/types/floor-layout'
import {
  calculateProjectPriorities,
  flattenAndSortAssignments,
  parseTimeToMinutes,
  calculateRemainingMinutes,
} from './priority-service'

// ============================================================================
// Manifest Loading
// ============================================================================

/**
 * Load a project manifest from JSON
 */
export function loadManifest(json: unknown): ProjectManifest {
  const manifest = json as ProjectManifest

  // Calculate priorities and aggregates
  const withPriorities = calculateProjectPriorities(manifest)
  const withAggregates = calculateAggregates(withPriorities)

  return withAggregates
}

/**
 * Load multiple manifests
 */
export function loadManifests(jsonArray: unknown[]): ProjectManifest[] {
  return jsonArray.map(loadManifest)
}

// ============================================================================
// Aggregates Calculation
// ============================================================================

/**
 * Calculate aggregate statistics for a project
 */
export function calculateAggregates(
  project: ProjectManifest
): ProjectManifest {
  const assignments = Object.values(project.assignments)

  let totalEstimatedMinutes = 0
  let totalRemainingMinutes = 0
  let totalActualMinutes = 0
  let completedAssignments = 0
  let inProgressAssignments = 0
  let blockedAssignments = 0
  let highestPriority: PriorityLevel = 'low'

  const priorityCounts: Record<PriorityLevel, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }

  const stageCounts: Partial<Record<AssignmentStageId, number>> = {}

  const priorityOrder: PriorityLevel[] = ['critical', 'high', 'medium', 'low']

  for (const assignment of assignments) {
    // Time calculations
    const estimated =
      parseTimeToMinutes(assignment.buildUpEstTime ?? '') +
      parseTimeToMinutes(assignment.wireListEstTime ?? '')
    const remaining = calculateRemainingMinutes(assignment)

    totalEstimatedMinutes += estimated
    totalRemainingMinutes += remaining
    totalActualMinutes += assignment.actualMinutes ?? 0

    // Status counts
    switch (assignment.status) {
      case 'COMPLETE':
      case 'COMPLETED':
        completedAssignments++
        break
      case 'IN_PROGRESS':
        inProgressAssignments++
        break
      case 'BLOCKED':
        blockedAssignments++
        break
    }

    // Priority counts
    if (assignment.priority) {
      priorityCounts[assignment.priority.level]++

      // Track highest priority
      const currentIndex = priorityOrder.indexOf(assignment.priority.level)
      const highestIndex = priorityOrder.indexOf(highestPriority)
      if (currentIndex < highestIndex) {
        highestPriority = assignment.priority.level
      }
    }

    // Stage counts
    const stage = assignment.stage
    stageCounts[stage] = (stageCounts[stage] ?? 0) + 1
  }

  const totalAssignments = assignments.length
  const overallProgress =
    totalAssignments > 0
      ? Math.round((completedAssignments / totalAssignments) * 100)
      : 0

  const aggregates: ProjectManifestAggregates = {
    totalAssignments,
    completedAssignments,
    inProgressAssignments,
    blockedAssignments,
    totalEstimatedMinutes,
    totalRemainingMinutes,
    totalActualMinutes,
    overallProgress,
    highestPriority,
    priorityCounts,
    stageCounts,
  }

  // Group assignment slugs by unitType
  const assignmentsByUnitType: Record<string, string[]> = {}
  for (const [slug, assignment] of Object.entries(project.assignments)) {
    const unitType = assignment.unitType ?? 'UNASSIGNED'
    if (!assignmentsByUnitType[unitType]) {
      assignmentsByUnitType[unitType] = []
    }
    assignmentsByUnitType[unitType].push(slug)
  }

  return {
    ...project,
    aggregates,
    assignmentsByUnitType,
  }
}

// ============================================================================
// Filtering
// ============================================================================

/**
 * Filter assignments within a project
 */
export function filterAssignments(
  assignments: ManifestAssignment[],
  filters: ManifestCollectionFilters
): ManifestAssignment[] {
  return assignments.filter((assignment) => {
    // Filter by stages
    if (filters.stages && filters.stages.length > 0) {
      if (!filters.stages.includes(assignment.stage)) {
        return false
      }
    }

    // Filter by status
    if (filters.statuses && filters.statuses.length > 0) {
      if (!filters.statuses.includes(assignment.status)) {
        return false
      }
    }

    // Filter by priority levels
    if (filters.priorityLevels && filters.priorityLevels.length > 0) {
      if (!assignment.priority || !filters.priorityLevels.includes(assignment.priority.level)) {
        return false
      }
    }

    // Filter by unit types
    if (filters.unitTypes && filters.unitTypes.length > 0) {
      if (!assignment.unitType || !filters.unitTypes.includes(assignment.unitType)) {
        return false
      }
    }

    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const searchableText = [
        assignment.sheetName,
        assignment.sheetSlug,
        assignment.unitType,
        assignment.swsType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (!searchableText.includes(query)) {
        return false
      }
    }

    return true
  })
}

/**
 * Filter projects by LWC types
 */
export function filterProjectsByLwcType(
  projects: ProjectManifest[],
  lwcTypes: FloorArea[]
): ProjectManifest[] {
  if (!lwcTypes || lwcTypes.length === 0) return projects
  return projects.filter((p) => lwcTypes.includes(p.lwcType as FloorArea))
}

/**
 * Filter flattened assignments
 */
export function filterFlattenedAssignments(
  assignments: FlattenedAssignment[],
  filters: ManifestCollectionFilters
): FlattenedAssignment[] {
  return assignments.filter((item) => {
    const { assignment, project } = item

    // Filter by LWC types
    if (filters.lwcTypes && filters.lwcTypes.length > 0) {
      if (!filters.lwcTypes.includes(project.lwcType as FloorArea)) {
        return false
      }
    }

    // Filter by stages
    if (filters.stages && filters.stages.length > 0) {
      if (!filters.stages.includes(assignment.stage)) {
        return false
      }
    }

    // Filter by status
    if (filters.statuses && filters.statuses.length > 0) {
      if (!filters.statuses.includes(assignment.status)) {
        return false
      }
    }

    // Filter by priority levels
    if (filters.priorityLevels && filters.priorityLevels.length > 0) {
      if (!filters.priorityLevels.includes(item.priority.level)) {
        return false
      }
    }

    // Filter by unit types
    if (filters.unitTypes && filters.unitTypes.length > 0) {
      if (!assignment.unitType || !filters.unitTypes.includes(assignment.unitType)) {
        return false
      }
    }

    // Search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      const searchableText = [
        assignment.sheetName,
        assignment.sheetSlug,
        project.name,
        project.pdNumber,
        assignment.unitType,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      if (!searchableText.includes(query)) {
        return false
      }
    }

    return true
  })
}

// ============================================================================
// Sorting
// ============================================================================

/**
 * Sort flattened assignments
 */
export function sortFlattenedAssignments(
  assignments: FlattenedAssignment[],
  sort: ManifestCollectionSort
): FlattenedAssignment[] {
  const sorted = [...assignments]
  const multiplier = sort.direction === 'asc' ? 1 : -1

  sorted.sort((a, b) => {
    let comparison = 0

    switch (sort.field) {
      case 'priority':
        comparison = a.priority.score - b.priority.score
        break
      case 'remainingTime':
        comparison = a.priority.remainingMinutes - b.priority.remainingMinutes
        break
      case 'deadline':
        comparison =
          new Date(a.effectiveDeadline).getTime() -
          new Date(b.effectiveDeadline).getTime()
        break
      case 'progress':
        comparison = (a.assignment.progress ?? 0) - (b.assignment.progress ?? 0)
        break
      case 'name':
        comparison = a.assignment.sheetName.localeCompare(b.assignment.sheetName)
        break
      case 'dueDate':
        comparison =
          new Date(a.project.dueDate).getTime() -
          new Date(b.project.dueDate).getTime()
        break
    }

    return comparison * multiplier
  })

  return sorted
}

// ============================================================================
// Grouping
// ============================================================================

/**
 * Group assignments by project
 */
export function groupByProject(
  assignments: FlattenedAssignment[]
): Map<string, FlattenedAssignment[]> {
  const groups = new Map<string, FlattenedAssignment[]>()

  for (const assignment of assignments) {
    const projectId = assignment.project.id
    if (!groups.has(projectId)) {
      groups.set(projectId, [])
    }
    groups.get(projectId)!.push(assignment)
  }

  return groups
}

/**
 * Group assignments by LWC type
 */
export function groupByLwcType(
  assignments: FlattenedAssignment[]
): Map<string, FlattenedAssignment[]> {
  const groups = new Map<string, FlattenedAssignment[]>()

  for (const assignment of assignments) {
    const lwcType = assignment.project.lwcType
    if (!groups.has(lwcType)) {
      groups.set(lwcType, [])
    }
    groups.get(lwcType)!.push(assignment)
  }

  return groups
}

/**
 * Group assignments by unit type
 */
export function groupByUnitType(
  assignments: FlattenedAssignment[]
): Map<string, FlattenedAssignment[]> {
  const groups = new Map<string, FlattenedAssignment[]>()

  for (const assignment of assignments) {
    const unitType = assignment.assignment.unitType ?? 'Unknown'
    if (!groups.has(unitType)) {
      groups.set(unitType, [])
    }
    groups.get(unitType)!.push(assignment)
  }

  return groups
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Update an assignment within a manifest
 */
export function updateAssignment(
  manifest: ProjectManifest,
  sheetSlug: string,
  updates: Partial<ManifestAssignment>
): ProjectManifest {
  const assignment = manifest.assignments[sheetSlug]
  if (!assignment) {
    throw new Error(`Assignment not found: ${sheetSlug}`)
  }

  const updatedManifest: ProjectManifest = {
    ...manifest,
    assignments: {
      ...manifest.assignments,
      [sheetSlug]: {
        ...assignment,
        ...updates,
      },
    },
  }

  // Recalculate priorities and aggregates
  return calculateAggregates(calculateProjectPriorities(updatedManifest))
}

/**
 * Update assignment status
 */
export function updateAssignmentStatus(
  manifest: ProjectManifest,
  sheetSlug: string,
  status: ManifestAssignmentStatus
): ProjectManifest {
  return updateAssignment(manifest, sheetSlug, { status })
}

/**
 * Update assignment stage
 */
export function updateAssignmentStage(
  manifest: ProjectManifest,
  sheetSlug: string,
  stage: AssignmentStageId
): ProjectManifest {
  return updateAssignment(manifest, sheetSlug, { stage })
}

/**
 * Add actual time worked to an assignment
 */
export function addActualTime(
  manifest: ProjectManifest,
  sheetSlug: string,
  minutes: number
): ProjectManifest {
  const assignment = manifest.assignments[sheetSlug]
  if (!assignment) {
    throw new Error(`Assignment not found: ${sheetSlug}`)
  }

  const currentActual = assignment.actualMinutes ?? 0
  return updateAssignment(manifest, sheetSlug, {
    actualMinutes: currentActual + minutes,
  })
}

// ============================================================================
// Queue Management
// ============================================================================

/**
 * Get assignments ready for a specific stage (queue stages)
 */
export function getAssignmentsReadyForStage(
  projects: ProjectManifest[],
  stage: AssignmentStageId
): FlattenedAssignment[] {
  const all = flattenAndSortAssignments(projects)
  return all.filter((a) => a.assignment.stage === stage)
}

/**
 * Get next assignment to work on (highest priority that's not blocked)
 */
export function getNextAssignment(
  projects: ProjectManifest[]
): FlattenedAssignment | null {
  const all = flattenAndSortAssignments(projects)
  return (
    all.find(
      (a) =>
        a.assignment.status !== 'BLOCKED' &&
        a.assignment.status !== 'COMPLETED'
    ) ?? null
  )
}

/**
 * Get assignments that can be started (stage status is 'ready').
 */
export function getStartableAssignments(
  projects: ProjectManifest[]
): FlattenedAssignment[] {
  const all = flattenAndSortAssignments(projects)
  return all.filter((a) => {
    if (
      a.assignment.status === 'BLOCKED' ||
      a.assignment.status === 'COMPLETE' ||
      a.assignment.status === 'COMPLETED'
    ) return false
    // An assignment is startable when its current stage has 'ready' status,
    // or when it has not been started yet (status NOT_STARTED).
    const currentStageState = a.assignment.stageStates?.find(
      s => s.stageId === a.assignment.stage
    )
    return currentStageState?.status === 'ready' ||
      a.assignment.status === 'NOT_STARTED'
  })
}
