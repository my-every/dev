/**
 * Priority Scoring Service
 *
 * Calculates priority scores for assignments based on:
 * - Remaining time until deadline
 * - Stage weights from SWS profiles
 * - Deadline proximity multipliers
 *
 * Formula: score = (1 / remainingTime) * deadlineMultiplier * stageWeight * 1000
 */

import type {
  PriorityScore,
  PriorityLevel,
  PriorityConfig,
  ManifestAssignment,
  ProjectManifest,
  FlattenedAssignment,
} from '@/types/project-manifest'
import {
  DEFAULT_PRIORITY_CONFIG,
} from '@/types/project-manifest'
import {
  ASSIGNMENT_STAGES,
  SWS_STAGE_PROFILES,
  type AssignmentStageId,
  type SwsTypeId,
  type AssignmentStageCategory,
} from '@/types/d380-assignment-stages'

// ============================================================================
// Time Parsing Utilities
// ============================================================================

/**
 * Parse time string like "3h 24m" to minutes
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0

  let totalMinutes = 0
  const hoursMatch = timeStr.match(/(\d+)h/)
  const minutesMatch = timeStr.match(/(\d+)m/)

  if (hoursMatch) {
    totalMinutes += parseInt(hoursMatch[1], 10) * 60
  }
  if (minutesMatch) {
    totalMinutes += parseInt(minutesMatch[1], 10)
  }

  return totalMinutes
}

/**
 * Format minutes to time string like "3h 24m"
 */
export function formatMinutesToTime(minutes: number): string {
  if (minutes <= 0) return '0m'

  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)

  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

/**
 * Calculate minutes until a deadline
 */
export function minutesUntilDeadline(deadline: string): number {
  const deadlineDate = new Date(deadline)
  const now = new Date()
  const diffMs = deadlineDate.getTime() - now.getTime()
  return Math.floor(diffMs / (1000 * 60))
}

// ============================================================================
// Stage Utilities
// ============================================================================

/**
 * Get stage definition by ID
 */
export function getStageDefinition(stageId: AssignmentStageId) {
  return ASSIGNMENT_STAGES.find((s) => s.id === stageId)
}

/**
 * Get stage category for a stage ID
 */
export function getStageCategory(stageId: AssignmentStageId): AssignmentStageCategory {
  const stage = getStageDefinition(stageId)
  return stage?.category ?? 'build'
}

/**
 * Map manifest SWS type to profile SWS type
 */
export function mapSwsType(swsType: string): SwsTypeId {
  const mapping: Record<string, SwsTypeId> = {
    PANEL: 'PANEL',
    BOX: 'BOX_BUILD',
    RAIL: 'RAIL_BUILD',
    BLANK: 'BLANK_PANEL',
    BLANK_PANEL: 'BLANK_PANEL',
    RAIL_BUILD: 'RAIL_BUILD',
    COMPONENT_BUILD: 'COMPONENT_BUILD',
    BOX_BUILD: 'BOX_BUILD',
    WIRING_ONLY: 'WIRING_ONLY',
    UNDECIDED: 'UNDECIDED',
  }
  return mapping[swsType] ?? 'UNDECIDED'
}

/**
 * Get stage weight from SWS profile
 */
export function getStageWeight(
  swsType: string,
  stageId: AssignmentStageId
): number {
  const profileType = mapSwsType(swsType)
  const profile = SWS_STAGE_PROFILES[profileType]

  if (!profile) return 1.0

  const weight = profile.stageWeightPercent[stageId]
  return weight ? weight / 100 : 0.1 // Default to 10% if not specified
}

/**
 * Calculate remaining estimated minutes based on current stage
 */
export function calculateRemainingMinutes(
  assignment: ManifestAssignment
): number {
  const totalMinutes =
    parseTimeToMinutes(assignment.buildUpEstTime ?? '') +
    parseTimeToMinutes(assignment.wireListEstTime ?? '')

  if (totalMinutes === 0) return 0

  const swsType = mapSwsType(assignment.swsType)
  const profile = SWS_STAGE_PROFILES[swsType]

  if (!profile) return totalMinutes

  // Find current stage order
  const currentStage = ASSIGNMENT_STAGES.find((s) => s.id === assignment.stage)
  if (!currentStage) return totalMinutes

  // Calculate remaining percentage based on stages after current
  let remainingPercent = 0
  for (const stage of profile.applicableStages) {
    const stageDef = ASSIGNMENT_STAGES.find((s) => s.id === stage)
    if (stageDef && stageDef.order >= currentStage.order) {
      const weight = profile.stageWeightPercent[stage] ?? 0
      remainingPercent += weight
    }
  }

  // If assignment is in progress, reduce by estimated progress
  if (assignment.status === 'IN_PROGRESS') {
    const currentStageWeight = profile.stageWeightPercent[assignment.stage] ?? 0
    // Assume 50% of current stage done if in progress
    remainingPercent -= currentStageWeight * 0.5
  }

  return Math.max(0, Math.round((remainingPercent / 100) * totalMinutes))
}

// ============================================================================
// Priority Calculation
// ============================================================================

/**
 * Calculate deadline multiplier based on time remaining
 */
export function calculateDeadlineMultiplier(
  remainingMinutes: number,
  config: PriorityConfig = DEFAULT_PRIORITY_CONFIG
): number {
  if (remainingMinutes <= 0) {
    return config.deadlineMultipliers.overdue
  }
  if (remainingMinutes < config.criticalThreshold) {
    return config.deadlineMultipliers.critical
  }
  if (remainingMinutes < config.highThreshold) {
    return config.deadlineMultipliers.high
  }
  if (remainingMinutes < config.mediumThreshold) {
    return config.deadlineMultipliers.medium
  }
  return config.deadlineMultipliers.low
}

/**
 * Determine priority level from remaining minutes
 */
export function getPriorityLevel(
  remainingMinutes: number,
  config: PriorityConfig = DEFAULT_PRIORITY_CONFIG
): PriorityLevel {
  if (remainingMinutes <= 0) return 'critical'
  if (remainingMinutes < config.criticalThreshold) return 'critical'
  if (remainingMinutes < config.highThreshold) return 'high'
  if (remainingMinutes < config.mediumThreshold) return 'medium'
  return 'low'
}

/**
 * Generate priority reason string
 */
export function getPriorityReason(
  level: PriorityLevel,
  remainingMinutes: number,
  stageId: AssignmentStageId
): string {
  const stageDef = getStageDefinition(stageId)
  const stageName = stageDef?.shortLabel ?? stageId

  if (remainingMinutes <= 0) {
    return `Overdue - ${stageName} stage`
  }

  const timeStr = formatMinutesToTime(remainingMinutes)

  switch (level) {
    case 'critical':
      return `Critical: ${timeStr} remaining - ${stageName}`
    case 'high':
      return `High priority: ${timeStr} remaining - ${stageName}`
    case 'medium':
      return `Medium priority: ${timeStr} remaining - ${stageName}`
    case 'low':
      return `Low priority: ${timeStr} remaining - ${stageName}`
  }
}

/**
 * Calculate priority score for an assignment
 *
 * Formula: score = (1 / remainingTime) * deadlineMultiplier * stageWeight * 1000
 *
 * Higher score = higher priority (needs attention first)
 */
export function calculatePriorityScore(
  assignment: ManifestAssignment,
  projectDeadline: string,
  config: PriorityConfig = DEFAULT_PRIORITY_CONFIG
): PriorityScore {
  // Use assignment deadline if set, otherwise project deadline
  const deadline = assignment.deadline ?? projectDeadline
  const deadlineMinutes = minutesUntilDeadline(deadline)

  // Calculate remaining work time
  const remainingWorkMinutes = calculateRemainingMinutes(assignment)

  // Calculate effective remaining time (deadline - work needed)
  const effectiveRemaining = deadlineMinutes - remainingWorkMinutes

  // Get stage category weight
  const stageCategory = getStageCategory(assignment.stage)
  const categoryWeight = config.stageCategoryWeights[stageCategory]

  // Get SWS stage weight
  const swsStageWeight = getStageWeight(assignment.swsType, assignment.stage)

  // Combined stage weight
  const stageWeight = categoryWeight * (1 + swsStageWeight)

  // Deadline multiplier
  const deadlineMultiplier = calculateDeadlineMultiplier(effectiveRemaining, config)

  // Priority level
  const level = getPriorityLevel(effectiveRemaining, config)

  // Calculate score
  // Avoid division by zero - use small positive number for overdue
  const timeComponent = effectiveRemaining <= 0 ? 10000 : 1000 / effectiveRemaining
  const score = timeComponent * deadlineMultiplier * stageWeight

  return {
    score: Math.round(score * 100) / 100,
    level,
    remainingMinutes: effectiveRemaining,
    deadlineMultiplier,
    stageWeight: Math.round(stageWeight * 100) / 100,
    reason: getPriorityReason(level, effectiveRemaining, assignment.stage),
  }
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Calculate priority scores for all assignments in a project
 */
export function calculateProjectPriorities(
  project: ProjectManifest,
  config: PriorityConfig = DEFAULT_PRIORITY_CONFIG
): ProjectManifest {
  const updatedAssignments: Record<string, ManifestAssignment> = {}

  for (const [slug, assignment] of Object.entries(project.assignments)) {
    const priority = calculatePriorityScore(assignment, project.dueDate, config)
    const remainingMinutes = calculateRemainingMinutes(assignment)
    const totalEstimatedMinutes =
      parseTimeToMinutes(assignment.buildUpEstTime ?? '') +
      parseTimeToMinutes(assignment.wireListEstTime ?? '')

    updatedAssignments[slug] = {
      ...assignment,
      priority,
      priorityLevel: priority.level,
      remainingMinutes,
      totalEstimatedMinutes,
    }
  }

  return {
    ...project,
    assignments: updatedAssignments,
  }
}

/**
 * Flatten all assignments from multiple projects into priority-sorted list
 */
export function flattenAndSortAssignments(
  projects: ProjectManifest[],
  config: PriorityConfig = DEFAULT_PRIORITY_CONFIG
): FlattenedAssignment[] {
  const flattened: FlattenedAssignment[] = []

  for (const project of projects) {
    for (const assignment of Object.values(project.assignments)) {
      // Skip completed assignments
      if (assignment.status === 'COMPLETED') continue

      const priority =
        assignment.priority ??
        calculatePriorityScore(assignment, project.dueDate, config)

      flattened.push({
        assignment,
        project: {
          id: project.id,
          name: project.name,
          pdNumber: project.pdNumber,
          color: project.color,
          dueDate: project.dueDate,
          lwcType: project.lwcType,
        },
        priority,
        effectiveDeadline: assignment.deadline ?? project.dueDate,
      })
    }
  }

  // Sort by priority score descending (highest priority first)
  return flattened.sort((a, b) => b.priority.score - a.priority.score)
}

/**
 * Get top N priority assignments
 */
export function getTopPriorityAssignments(
  projects: ProjectManifest[],
  limit: number = 10,
  config: PriorityConfig = DEFAULT_PRIORITY_CONFIG
): FlattenedAssignment[] {
  return flattenAndSortAssignments(projects, config).slice(0, limit)
}

/**
 * Filter assignments by priority level
 */
export function filterByPriorityLevel(
  assignments: FlattenedAssignment[],
  levels: PriorityLevel[]
): FlattenedAssignment[] {
  return assignments.filter((a) => levels.includes(a.priority.level))
}

/**
 * Group assignments by priority level
 */
export function groupByPriorityLevel(
  assignments: FlattenedAssignment[]
): Record<PriorityLevel, FlattenedAssignment[]> {
  const groups: Record<PriorityLevel, FlattenedAssignment[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  }

  for (const assignment of assignments) {
    groups[assignment.priority.level].push(assignment)
  }

  return groups
}

/**
 * Group assignments by stage
 */
export function groupByStage(
  assignments: FlattenedAssignment[]
): Partial<Record<AssignmentStageId, FlattenedAssignment[]>> {
  const groups: Partial<Record<AssignmentStageId, FlattenedAssignment[]>> = {}

  for (const assignment of assignments) {
    const stage = assignment.assignment.stage
    if (!groups[stage]) {
      groups[stage] = []
    }
    groups[stage]!.push(assignment)
  }

  // Sort each group by priority
  for (const stage of Object.keys(groups) as AssignmentStageId[]) {
    groups[stage]!.sort((a, b) => b.priority.score - a.priority.score)
  }

  return groups
}
