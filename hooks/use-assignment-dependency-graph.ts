/**
 * useAssignmentDependencyGraph Hook
 * 
 * React hook for consuming the assignment dependency graph.
 * Builds and memoizes the graph from mapped assignments.
 * 
 * Usage:
 * ```tsx
 * const { graph, snapshot, crossWireReadiness, getNodeStatus } = useAssignmentDependencyGraph(
 *   projectId,
 *   assignmentMappings
 * )
 * ```
 */

import { useMemo, useCallback, useRef } from 'react'
import type { MappedAssignment } from '@/components/projects/project-assignment-mapping-modal'
import {
  buildAssignmentDependencyGraph,
  deriveAssignmentBlockedState,
  getAutoNextStage,
  getCrossWireProjectReadiness,
} from '@/lib/assignment/dependency-graph'
import type {
  AssignmentDependencyGraph,
  AssignmentDependencyNode,
  AssignmentReadinessResult,
  AutoProgressionResult,
  CrossWireProjectReadiness,
  ProjectLifecycleSnapshot,
} from '@/types/d380-dependency-graph'

// ============================================================================
// Hook Return Types
// ============================================================================

export interface AssignmentNodeStatus {
  node: AssignmentDependencyNode | undefined
  isBlocked: boolean
  isReady: boolean
  blockedReasons: string[]
  nextStage: string | undefined
  unlocks: string[]
}

export interface UseAssignmentDependencyGraphReturn {
  /** The complete dependency graph */
  graph: AssignmentDependencyGraph | null
  
  /** Project lifecycle snapshot */
  snapshot: ProjectLifecycleSnapshot | null
  
  /** Cross-wire readiness details */
  crossWireReadiness: CrossWireProjectReadiness | null
  
  /** Get status for a specific assignment */
  getNodeStatus: (assignmentId: string) => AssignmentNodeStatus
  
  /** Check if an assignment is blocked */
  isBlocked: (assignmentId: string) => boolean
  
  /** Check if an assignment is ready for next stage */
  isReady: (assignmentId: string) => boolean
  
  /** Get the suggested next stage for an assignment */
  getNextStage: (assignmentId: string) => string | undefined
  
  /** Get all blocked assignment IDs */
  blockedAssignments: string[]
  
  /** Get all ready assignment IDs */
  readyAssignments: string[]
  
  /** Get all just-unlocked assignment IDs (for notifications) */
  justUnlockedAssignments: string[]
  
  /** Whether cross-wire is available at project level */
  crossWireAvailable: boolean
  
  /** Whether the project is complete */
  isProjectComplete: boolean
  
  /** Overall project progress (0-100) */
  overallProgress: number
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useAssignmentDependencyGraph(
  projectId: string | null,
  assignments: MappedAssignment[]
): UseAssignmentDependencyGraphReturn {
  // Store previous graph for comparison
  const previousGraphRef = useRef<AssignmentDependencyGraph | null>(null)
  
  // Build the dependency graph
  const graph = useMemo(() => {
    if (!projectId || assignments.length === 0) {
      return null
    }
    
    const newGraph = buildAssignmentDependencyGraph(
      projectId,
      assignments,
      previousGraphRef.current || undefined
    )
    
    // Store for next comparison
    previousGraphRef.current = newGraph
    
    return newGraph
  }, [projectId, assignments])
  
  // Get node status for a specific assignment
  const getNodeStatus = useCallback((assignmentId: string): AssignmentNodeStatus => {
    if (!graph) {
      return {
        node: undefined,
        isBlocked: false,
        isReady: false,
        blockedReasons: [],
        nextStage: undefined,
        unlocks: [],
      }
    }
    
    const node = graph.nodeIndex.get(assignmentId)
    
    if (!node) {
      return {
        node: undefined,
        isBlocked: false,
        isReady: false,
        blockedReasons: [],
        nextStage: undefined,
        unlocks: [],
      }
    }
    
    return {
      node,
      isBlocked: node.isBlocked,
      isReady: node.isReady,
      blockedReasons: node.readinessReasons,
      nextStage: node.nextSuggestedStage,
      unlocks: node.unlocks,
    }
  }, [graph])
  
  // Check if an assignment is blocked
  const isBlocked = useCallback((assignmentId: string): boolean => {
    return graph?.blockedAssignments.includes(assignmentId) ?? false
  }, [graph])
  
  // Check if an assignment is ready
  const isReady = useCallback((assignmentId: string): boolean => {
    return graph?.readyAssignments.includes(assignmentId) ?? false
  }, [graph])
  
  // Get the suggested next stage
  const getNextStage = useCallback((assignmentId: string): string | undefined => {
    if (!graph) return undefined
    const node = graph.nodeIndex.get(assignmentId)
    return node?.nextSuggestedStage
  }, [graph])
  
  return {
    graph,
    snapshot: graph?.projectSnapshot ?? null,
    crossWireReadiness: graph?.crossWireReadiness ?? null,
    getNodeStatus,
    isBlocked,
    isReady,
    getNextStage,
    blockedAssignments: graph?.blockedAssignments ?? [],
    readyAssignments: graph?.readyAssignments ?? [],
    justUnlockedAssignments: graph?.justUnlockedAssignments ?? [],
    crossWireAvailable: graph?.crossWireAvailable ?? false,
    isProjectComplete: graph?.projectSnapshot.isComplete ?? false,
    overallProgress: graph?.projectSnapshot.overallProgress ?? 0,
  }
}
