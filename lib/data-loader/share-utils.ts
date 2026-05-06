/**
 * Share Data Utilities (Client-Safe)
 * 
 * Pure utility functions that can be used in both server and client components.
 * No Node.js dependencies - safe for browser environments.
 */

import type { AssignmentStageId } from '@/types/d380-assignment-stages'

// Types for the JSON data structures (also exported for client use)
export interface StageHistoryEntry {
  stageId: AssignmentStageId
  completedAt: string
  completedBy: string
}

export interface AssignmentProgressRecord {
  assignmentId: string
  sheetName: string
  currentStage: string
  stageHistory: StageHistoryEntry[]
  progress: number
  assignedBadge?: string
  station?: string
  wireCount: number
  completedWires: number
  defectCount?: number
}

export interface ProjectAssignmentProgress {
  projectId: string
  stageHistory: StageHistoryEntry[]
  currentStage: string
  assignments: AssignmentProgressRecord[]
  updatedAt: string
  dataMode?: 'extracted' | 'live'
}

export interface ActiveProjectsState {
  activeProjects: Array<{
    projectId: string
    pdNumber: string
    projectName: string
    priority: number
    status: string
    progress: number
  }>
  updatedAt: string
  dataMode: 'extracted' | 'live'
}

export interface CurrentShiftState {
  activeShift: string
  shiftLabel: string
  shiftStart: string
  shiftEnd: string
  operatingDate: string
  updatedAt: string
  dataMode: 'extracted' | 'live'
}

export interface DiscoveredProject {
  folder: string
  projectId: string
  pdNumber: string
}

/**
 * Derives project-level stage completion dates from assignment histories.
 * A project stage is complete when ALL assignments have completed that stage.
 * Returns the latest completion date among all assignments for each stage.
 */
export function deriveProjectStageCompletions(
  assignments: AssignmentProgressRecord[]
): Map<AssignmentStageId, { completedAt: string; completedBy: string }> {
  const stageCompletions = new Map<AssignmentStageId, { completedAt: string; completedBy: string }>()

  if (assignments.length === 0) return stageCompletions

  // Get all unique stages that appear in any assignment
  const allStages = new Set<AssignmentStageId>()
  for (const assignment of assignments) {
    for (const entry of assignment.stageHistory) {
      allStages.add(entry.stageId)
    }
  }

  // For each stage, check if ALL assignments have completed it
  for (const stageId of allStages) {
    const completionsForStage: StageHistoryEntry[] = []

    let allComplete = true
    for (const assignment of assignments) {
      const stageEntry = assignment.stageHistory.find(h => h.stageId === stageId)
      if (stageEntry) {
        completionsForStage.push(stageEntry)
      } else {
        allComplete = false
        break
      }
    }

    if (allComplete && completionsForStage.length > 0) {
      // Use the latest completion date (the stage isn't done until the last one finishes)
      const sorted = completionsForStage.sort(
        (a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime()
      )
      stageCompletions.set(stageId, {
        completedAt: sorted[0].completedAt,
        completedBy: sorted[0].completedBy,
      })
    }
  }

  return stageCompletions
}

/**
 * Format ISO date to short display format (e.g., "Mar 19")
 */
export function formatShortDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
