/**
 * Assignment Dependency Graph Types
 * 
 * Defines the dependency model for assignments that allows:
 * 1. Determining what is blocked
 * 2. Determining what is ready
 * 3. Determining what just unlocked
 * 4. Whether cross wire can begin
 * 5. Whether the project is ready for test / pwr check / BIQ
 */

import type { AssignmentStageId } from './d380-assignment-stages'

// ============================================================================
// DEPENDENCY KINDS
// ============================================================================

/**
 * The kind of dependency operationship.
 */
export type AssignmentDependencyKind =
  | 'SELF_STAGE'           // Assignment must complete its own prior stage
  | 'PROJECT_STAGE_GATE'   // Project-level stage gate (e.g., all panels must complete BOX_BUILD)
  | 'CROSS_ASSIGNMENT'     // Specific assignment dependency
  | 'BOX_BUILD_GATE'       // Box build must reach a certain progress level
  | 'CROSS_WIRE_GATE'      // Cross-wire readiness gate
  | 'TEST_GATE'            // Test stage gate
  | 'POWER_GATE'           // Power check gate
  | 'BIQ_GATE'             // BIQ gate

// ============================================================================
// DEPENDENCY TYPES
// ============================================================================

/**
 * A single dependency for an assignment.
 */
export interface AssignmentDependency {
  /** Unique identifier for this dependency */
  dependencyId: string

  /** The assignment this dependency belongs to */
  assignmentId: string

  /** The kind of dependency */
  kind: AssignmentDependencyKind

  /** For CROSS_ASSIGNMENT: the required assignment ID */
  requiredAssignmentId?: string

  /** For stage-based dependencies: the required stage */
  requiredStage?: AssignmentStageId

  /** For gate dependencies: the minimum threshold (0-100) */
  threshold?: number

  /** Human-readable description of the dependency */
  description: string

  /** Whether this dependency is currently satisfied */
  satisfied: boolean

  /** Reason why the dependency is satisfied or not */
  reason?: string
}

/**
 * A node in the dependency graph representing an assignment.
 */
export interface AssignmentDependencyNode {
  /** The assignment ID */
  assignmentId: string

  /** The sheet slug for routing */
  sheetSlug: string

  /** The assignment name */
  name: string

  /** Current stage of the assignment */
  stage: AssignmentStageId

  /** Whether the assignment has wire rows (affects flow type) */
  hasWireRows: boolean

  /** Whether the assignment requires cross-wire SWS */
  requiresCrossWireSws: boolean

  /** The SWS type */
  swsType: string

  /** All dependencies for this assignment */
  dependencies: AssignmentDependency[]

  /** IDs of assignments that are blocking this one */
  blockedBy: string[]

  /** IDs of assignments that this one unlocks when complete */
  unlocks: string[]

  /** Whether this assignment is currently blocked */
  isBlocked: boolean

  /** Whether this assignment is ready for the next stage */
  isReady: boolean

  /** Whether this assignment is late */
  isLate: boolean

  /** Due date for this assignment (ISO string) */
  dueDate?: string

  /** Late warning level */
  lateWarningLevel?: 'NONE' | 'APPROACHING' | 'IMMINENT' | 'OVERDUE' | 'CRITICAL'

  /** The next suggested stage based on auto-progression rules */
  nextSuggestedStage?: AssignmentStageId

  /** Reasons for the current readiness state */
  readinessReasons: string[]
}

/**
 * The complete dependency graph for a project.
 */
export interface AssignmentDependencyGraph {
  /** The project ID */
  projectId: string

  /** When the graph was built */
  builtAt: string

  /** All assignment nodes in the graph */
  nodes: AssignmentDependencyNode[]

  /** Index of nodes by assignment ID */
  nodeIndex: Map<string, AssignmentDependencyNode>

  /** Assignments that are currently blocked */
  blockedAssignments: string[]

  /** Assignments that are ready for the next stage */
  readyAssignments: string[]

  /** Assignments that just became unblocked (for notifications) */
  justUnlockedAssignments: string[]

  /** Whether cross-wire is available at the project level */
  crossWireAvailable: boolean

  /** Cross-wire readiness details */
  crossWireReadiness: CrossWireProjectReadiness

  /** Project-level lifecycle snapshot */
  projectSnapshot: ProjectLifecycleSnapshot
}

// ============================================================================
// PROJECT-LEVEL READINESS
// ============================================================================

/**
 * Cross-wire project readiness.
 */
export interface CrossWireProjectReadiness {
  /** Whether cross-wire stage is ready to begin */
  isReady: boolean

  /** IDs of assignments that are cross-wire candidates */
  candidateAssignments: string[]

  /** IDs of cross-wire candidates that are ready */
  readyAssignments: string[]

  /** IDs of cross-wire candidates that are blocked */
  blockedAssignments: string[]

  /** Percentage of BOX_BUILD-ready progress (panels at BOX_BUILD ready or beyond) */
  readyToHangProgress: number

  /** Percentage of BOX_BUILD progress */
  boxBuildProgress: number

  /** Reasons for the current readiness state */
  reasons: string[]
}

/**
 * Project lifecycle snapshot.
 */
export interface ProjectLifecycleSnapshot {
  /** The project ID */
  projectId: string

  /** Total number of assignments */
  totalAssignments: number

  /** Assignments by stage */
  countsByStage: Record<AssignmentStageId, number>

  /** Number of blocked assignments */
  blockedAssignments: number

  /** Number of ready assignments */
  readyAssignments: number

  /** Number of late assignments */
  lateAssignments: number

  /** Number of assignments ready for build-up */
  buildUpReadyCount: number

  /** Number of assignments ready for wiring */
  wiringReadyCount: number

  /** Number of assignments at BOX_BUILD ready or beyond */
  readyToHangCount: number

  /** Number of cross-wire candidate assignments */
  crossWireCandidateCount: number

  /** Whether cross-wire is ready at project level */
  crossWireReady: boolean

  /** Whether test stage is ready */
  testReady: boolean

  /** Whether power check stage is ready */
  powerCheckReady: boolean

  /** Whether BIQ stage is ready */
  biqReady: boolean

  /** Whether the project is complete */
  isComplete: boolean

  /** Overall project progress (0-100) */
  overallProgress: number

  /** Next recommended project-level action */
  nextRecommendedProjectAction?: string

  /** Reasons explaining the current project state */
  reasons: string[]
}

// ============================================================================
// DERIVED STATE TYPES
// ============================================================================

/**
 * Derived readiness state for a single assignment.
 */
export interface AssignmentReadinessResult {
  /** The assignment ID */
  assignmentId: string

  /** Current stage */
  stage: AssignmentStageId

  /** Whether blocked */
  isBlocked: boolean

  /** Why blocked */
  blockedReasons: string[]

  /** Whether ready for next stage */
  isReady: boolean

  /** Why ready (or not) */
  readyReasons: string[]

  /** The next suggested stage */
  nextSuggestedStage?: AssignmentStageId

  /** What this assignment unlocks when it progresses */
  unlocks: string[]
}

/**
 * Result of the auto-progression calculation.
 */
export interface AutoProgressionResult {
  /** The assignment ID */
  assignmentId: string

  /** Current stage */
  currentStage: AssignmentStageId

  /** Whether auto-progression is suggested */
  shouldProgress: boolean

  /** The suggested next stage */
  nextStage?: AssignmentStageId

  /** Reasons for the suggestion */
  reasons: string[]

  /** Whether manual confirmation is required */
  requiresConfirmation: boolean
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Event emitted when assignments become unblocked.
 */
export interface AssignmentUnlockedEvent {
  /** When the event occurred */
  timestamp: string

  /** The assignments that became unblocked */
  unlockedAssignmentIds: string[]

  /** What triggered the unlock (e.g., another assignment completing) */
  trigger?: {
    assignmentId: string
    previousStage: AssignmentStageId
    newStage: AssignmentStageId
  }
}
