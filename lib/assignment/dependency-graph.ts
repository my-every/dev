/**
 * Assignment Dependency Graph Engine
 * 
 * Pure helper functions for building and querying the assignment dependency graph.
 * No side effects, no component state - just pure logic.
 * 
 * Main exports:
 * - buildAssignmentDependencyGraph: Build the full graph from assignments
 * - deriveAssignmentBlockedState: Check if an assignment is blocked
 * - deriveAssignmentReadiness: Check if an assignment is ready for next stage
 * - getAutoNextStage: Get the suggested next stage
 * - getUnlockedAssignments: Get assignments that just became unblocked
 * - getCrossWireProjectReadiness: Check cross-wire readiness at project level
 * - getProjectLifecycleSnapshot: Get complete project status
 */

import type { MappedAssignment } from '@/components/projects/project-assignment-mapping-modal'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { getStageOrderIndex } from '@/lib/assignment/stage-lifecycle'
import { calculateLateState } from '@/lib/assignment/due-date-service'
import type {
  AssignmentDependency,
  AssignmentDependencyGraph,
  AssignmentDependencyNode,
  AssignmentDependencyKind,
  AssignmentReadinessResult,
  AutoProgressionResult,
  CrossWireProjectReadiness,
  ProjectLifecycleSnapshot,
} from '@/types/d380-dependency-graph'

// ============================================================================
// CONSTANTS
// ============================================================================

/** Minimum percentage of panels at READY_TO_HANG for cross-wire */
const CROSS_WIRE_READY_TO_HANG_THRESHOLD = 50

/** Minimum percentage of box build progress for cross-wire */
const CROSS_WIRE_BOX_BUILD_THRESHOLD = 25

/** Stages that are considered "complete" for progress calculation */
const COMPLETION_STAGES: AssignmentStageId[] = ['BIQ']

/** Build-up stages */
const BUILD_UP_STAGES: AssignmentStageId[] = ['BUILD_UP']

/** Wiring stages */
const WIRING_STAGES: AssignmentStageId[] = ['WIRING', 'WIRING_IPV', 'BOX_BUILD']

/** Test stages */
const TEST_STAGES: AssignmentStageId[] = ['TEST_1ST_PASS', 'POWER_CHECK', 'BIQ']

// ============================================================================
// BUILD DEPENDENCY GRAPH
// ============================================================================

/**
 * Build the complete dependency graph from mapped assignments.
 */
export function buildAssignmentDependencyGraph(
  projectId: string,
  assignments: MappedAssignment[],
  previousGraph?: AssignmentDependencyGraph
): AssignmentDependencyGraph {
  const nodes: AssignmentDependencyNode[] = []
  const nodeIndex = new Map<string, AssignmentDependencyNode>()

  // First pass: create all nodes
  for (const assignment of assignments) {
    const node = createAssignmentNode(assignment)
    nodes.push(node)
    nodeIndex.set(assignment.sheetSlug, node)
  }

  // Second pass: build dependencies
  for (const node of nodes) {
    node.dependencies = buildNodeDependencies(node, nodes, nodeIndex)
  }

  // Third pass: resolve blocked/unlocks operationships
  for (const node of nodes) {
    resolveBlockedAndUnlocks(node, nodeIndex)
  }

  // Fourth pass: determine readiness
  for (const node of nodes) {
    const readiness = deriveAssignmentReadiness(node, nodeIndex)
    node.isBlocked = readiness.isBlocked
    node.isReady = readiness.isReady
    node.nextSuggestedStage = readiness.nextSuggestedStage
    node.readinessReasons = readiness.isBlocked
      ? readiness.blockedReasons
      : readiness.readyReasons
  }

  // Calculate project-level metrics
  const crossWireReadiness = getCrossWireProjectReadiness(nodes)
  const projectSnapshot = getProjectLifecycleSnapshot(projectId, nodes, crossWireReadiness)

  // Determine just unlocked (compare with previous graph)
  const justUnlockedAssignments = previousGraph
    ? findJustUnlockedAssignments(nodes, previousGraph)
    : []

  return {
    projectId,
    builtAt: new Date().toISOString(),
    nodes,
    nodeIndex,
    blockedAssignments: nodes.filter(n => n.isBlocked).map(n => n.assignmentId),
    readyAssignments: nodes.filter(n => n.isReady).map(n => n.assignmentId),
    justUnlockedAssignments,
    crossWireAvailable: crossWireReadiness.isReady,
    crossWireReadiness,
    projectSnapshot,
  }
}

/**
 * Create a dependency node from a mapped assignment.
 */
function createAssignmentNode(assignment: MappedAssignment): AssignmentDependencyNode {
  // Calculate real late state from due date (if available)
  const dueDate = (assignment as MappedAssignment & { dueDate?: string }).dueDate
  const lateState = calculateLateState(dueDate, assignment.selectedStage)

  return {
    assignmentId: assignment.sheetSlug,
    sheetSlug: assignment.sheetSlug,
    name: assignment.sheetName,
    stage: assignment.selectedStage,
    hasWireRows: assignment.requiresWireSws,
    requiresCrossWireSws: assignment.requiresCrossWireSws,
    swsType: assignment.selectedSwsType,
    dependencies: [],
    blockedBy: [],
    unlocks: [],
    isBlocked: false,
    isReady: false,
    isLate: lateState.isLate, // Now calculated from real due dates
    dueDate,
    lateWarningLevel: lateState.warningLevel,
    nextSuggestedStage: undefined,
    readinessReasons: [],
  }
}

/**
 * Build dependencies for a single node.
 */
function buildNodeDependencies(
  node: AssignmentDependencyNode,
  allNodes: AssignmentDependencyNode[],
  nodeIndex: Map<string, AssignmentDependencyNode>
): AssignmentDependency[] {
  const dependencies: AssignmentDependency[] = []

  // 1. Self-stage dependency (must complete previous stage)
  const selfDep = buildSelfStageDependency(node)
  if (selfDep) dependencies.push(selfDep)

  // 2. Cross-wire gate dependencies (for cross-wire assignments)
  if (node.requiresCrossWireSws || node.swsType.includes('CROSS')) {
    const crossWireDeps = buildCrossWireGateDependencies(node, allNodes)
    dependencies.push(...crossWireDeps)
  }

  // 3. Test stage gate (all cross-wire must be complete)
  if (TEST_STAGES.includes(node.stage)) {
    const testDeps = buildTestGateDependencies(node, allNodes)
    dependencies.push(...testDeps)
  }

  return dependencies
}

/**
 * Build self-stage dependency.
 */
function buildSelfStageDependency(node: AssignmentDependencyNode): AssignmentDependency | null {
  const stageOrder = getStageOrderIndex(node.stage)

  // No dependency for initial stages
  if (stageOrder <= 1) return null

  // Must have completed previous stage
  return {
    dependencyId: `${node.assignmentId}-self-stage`,
    assignmentId: node.assignmentId,
    kind: 'SELF_STAGE',
    description: 'Must complete previous stage',
    satisfied: true, // Always satisfied for current stage
    reason: 'Assignment is at or past this stage',
  }
}

/**
 * Build cross-wire gate dependencies.
 */
function buildCrossWireGateDependencies(
  node: AssignmentDependencyNode,
  allNodes: AssignmentDependencyNode[]
): AssignmentDependency[] {
  const deps: AssignmentDependency[] = []

  // Count panels at READY_TO_HANG
  const panelNodes = allNodes.filter(n =>
    n.swsType.includes('PANEL') && n.hasWireRows
  )
  const readyToHangCount = panelNodes.filter(n =>
    getStageOrderIndex(n.stage) >= getStageOrderIndex('BOX_BUILD')
  ).length
  const progress = panelNodes.length > 0
    ? (readyToHangCount / panelNodes.length) * 100
    : 0

  deps.push({
    dependencyId: `${node.assignmentId}-cross-wire-ready-to-hang`,
    assignmentId: node.assignmentId,
    kind: 'CROSS_WIRE_GATE',
    threshold: CROSS_WIRE_READY_TO_HANG_THRESHOLD,
    description: `${CROSS_WIRE_READY_TO_HANG_THRESHOLD}% of panels must be at or past READY_TO_TEST`,
    satisfied: progress >= CROSS_WIRE_READY_TO_HANG_THRESHOLD,
    reason: `${Math.round(progress)}% panels at READY_TO_TEST+ (need ${CROSS_WIRE_READY_TO_HANG_THRESHOLD}%)`,
  })

  // Box build progress
  const boxBuildNodes = allNodes.filter(n => n.swsType.includes('BOX'))
  const boxProgress = boxBuildNodes.length > 0
    ? boxBuildNodes.filter(n =>
      getStageOrderIndex(n.stage) >= getStageOrderIndex('BUILD_UP')
    ).length / boxBuildNodes.length * 100
    : 100 // No box builds = no blocking

  deps.push({
    dependencyId: `${node.assignmentId}-box-build-gate`,
    assignmentId: node.assignmentId,
    kind: 'BOX_BUILD_GATE',
    threshold: CROSS_WIRE_BOX_BUILD_THRESHOLD,
    description: `${CROSS_WIRE_BOX_BUILD_THRESHOLD}% box build progress required`,
    satisfied: boxProgress >= CROSS_WIRE_BOX_BUILD_THRESHOLD,
    reason: `${Math.round(boxProgress)}% box build progress (need ${CROSS_WIRE_BOX_BUILD_THRESHOLD}%)`,
  })

  return deps
}

/**
 * Build test gate dependencies.
 */
function buildTestGateDependencies(
  node: AssignmentDependencyNode,
  allNodes: AssignmentDependencyNode[]
): AssignmentDependency[] {
  const deps: AssignmentDependency[] = []

  // All cross-wire assignments must be complete
  const crossWireNodes = allNodes.filter(n =>
    n.requiresCrossWireSws || n.swsType.includes('CROSS')
  )
  const crossWireComplete = crossWireNodes.every(n =>
    getStageOrderIndex(n.stage) >= getStageOrderIndex('TEST_1ST_PASS')
  )

  deps.push({
    dependencyId: `${node.assignmentId}-test-gate`,
    assignmentId: node.assignmentId,
    kind: 'TEST_GATE',
    description: 'All cross-wire assignments must be complete',
    satisfied: crossWireNodes.length === 0 || crossWireComplete,
    reason: crossWireNodes.length === 0
      ? 'No cross-wire assignments in project'
      : crossWireComplete
        ? 'All cross-wire complete'
        : 'Cross-wire assignments still in progress',
  })

  return deps
}

/**
 * Resolve blocked/unlocks operationships.
 */
function resolveBlockedAndUnlocks(
  node: AssignmentDependencyNode,
  nodeIndex: Map<string, AssignmentDependencyNode>
): void {
  // Find blocking dependencies
  node.blockedBy = node.dependencies
    .filter(d => !d.satisfied && d.requiredAssignmentId)
    .map(d => d.requiredAssignmentId!)

  // Find what this node unlocks
  node.unlocks = [] // Would be calculated from reverse dependency lookups
}

// ============================================================================
// READINESS DERIVATION
// ============================================================================

/**
 * Derive the blocked state for an assignment.
 */
export function deriveAssignmentBlockedState(
  node: AssignmentDependencyNode,
  nodeIndex: Map<string, AssignmentDependencyNode>
): { isBlocked: boolean; reasons: string[] } {
  const unsatisfiedDeps = node.dependencies.filter(d => !d.satisfied)

  return {
    isBlocked: unsatisfiedDeps.length > 0,
    reasons: unsatisfiedDeps.map(d => d.reason || d.description),
  }
}

/**
 * Derive the readiness state for an assignment.
 */
export function deriveAssignmentReadiness(
  node: AssignmentDependencyNode,
  nodeIndex: Map<string, AssignmentDependencyNode>
): AssignmentReadinessResult {
  const { isBlocked, reasons: blockedReasons } = deriveAssignmentBlockedState(node, nodeIndex)

  // Get auto next stage
  const autoResult = getAutoNextStage(node, nodeIndex)

  return {
    assignmentId: node.assignmentId,
    stage: node.stage,
    isBlocked,
    blockedReasons,
    isReady: !isBlocked && autoResult.shouldProgress,
    readyReasons: autoResult.reasons,
    nextSuggestedStage: autoResult.nextStage,
    unlocks: node.unlocks,
  }
}

// ============================================================================
// AUTO-PROGRESSION
// ============================================================================

/**
 * Get the auto-suggested next stage for an assignment.
 */
export function getAutoNextStage(
  node: AssignmentDependencyNode,
  nodeIndex: Map<string, AssignmentDependencyNode>
): AutoProgressionResult {
  const result: AutoProgressionResult = {
    assignmentId: node.assignmentId,
    currentStage: node.stage,
    shouldProgress: false,
    reasons: [],
    requiresConfirmation: false,
  }

  // Check if at terminal stage
  if (node.stage === 'BIQ') {
    result.reasons.push('Assignment is complete (BIQ)')
    return result
  }

  // Check for unsatisfied dependencies
  const unsatisfied = node.dependencies.filter(d => !d.satisfied)
  if (unsatisfied.length > 0) {
    result.reasons.push(`Blocked by ${unsatisfied.length} unsatisfied dependencies`)
    return result
  }

  // Determine next stage based on flow type
  const nextStage = calculateNextStage(node)

  if (nextStage) {
    result.shouldProgress = true
    result.nextStage = nextStage
    result.reasons.push(`Ready to progress from ${node.stage} to ${nextStage}`)

    // Cross-wire and test stages require confirmation
    if (nextStage === 'CROSS_WIRE' || TEST_STAGES.includes(nextStage)) {
      result.requiresConfirmation = true
      result.reasons.push('Stage transition requires confirmation')
    }
  }

  return result
}

/**
 * Calculate the next stage based on assignment characteristics.
 */
function calculateNextStage(node: AssignmentDependencyNode): AssignmentStageId | undefined {
  // Build-only assignments (no wiring)
  if (!node.hasWireRows) {
    switch (node.stage) {
      case 'BUILD_UP': return 'BIQ'
      case 'BOX_BUILD': return node.requiresCrossWireSws ? 'CROSS_WIRE' : 'TEST_1ST_PASS'
      case 'CROSS_WIRE': return 'CROSS_WIRE_IPV'
      case 'CROSS_WIRE_IPV': return 'TEST_1ST_PASS'
      case 'TEST_1ST_PASS': return 'POWER_CHECK'
      case 'POWER_CHECK': return 'BIQ'
      default: return undefined
    }
  }
  // Build + Wire assignments
  switch (node.stage) {
    case 'BUILD_UP': return 'WIRING'
    case 'WIRING': return 'WIRING_IPV'
    case 'WIRING_IPV': return 'BOX_BUILD'
    case 'BOX_BUILD': return node.requiresCrossWireSws ? 'CROSS_WIRE' : 'TEST_1ST_PASS'
    case 'CROSS_WIRE': return 'CROSS_WIRE_IPV'
    case 'CROSS_WIRE_IPV': return 'TEST_1ST_PASS'
    case 'TEST_1ST_PASS': return 'POWER_CHECK'
    case 'POWER_CHECK': return 'BIQ'
    default: return undefined
  }
}

/**
 * Get all assignments that just became unblocked.
 */
export function getUnlockedAssignments(
  currentGraph: AssignmentDependencyGraph,
  previousGraph: AssignmentDependencyGraph
): string[] {
  return findJustUnlockedAssignments(currentGraph.nodes, previousGraph)
}

/**
 * Find assignments that just became unblocked.
 */
function findJustUnlockedAssignments(
  currentNodes: AssignmentDependencyNode[],
  previousGraph: AssignmentDependencyGraph
): string[] {
  const justUnlocked: string[] = []

  for (const currentNode of currentNodes) {
    const previousNode = previousGraph.nodeIndex.get(currentNode.assignmentId)

    // Was blocked before, not blocked now
    if (previousNode?.isBlocked && !currentNode.isBlocked) {
      justUnlocked.push(currentNode.assignmentId)
    }
  }

  return justUnlocked
}

// ============================================================================
// CROSS-WIRE READINESS
// ============================================================================

/**
 * Get cross-wire project readiness.
 */
export function getCrossWireProjectReadiness(
  nodes: AssignmentDependencyNode[]
): CrossWireProjectReadiness {
  // Find cross-wire candidates
  const candidates = nodes.filter(n =>
    n.requiresCrossWireSws || n.swsType.includes('CROSS')
  )

  // Find panel nodes for READY_TO_HANG progress
  const panelNodes = nodes.filter(n =>
    n.swsType.includes('PANEL') && n.hasWireRows
  )
  const readyToHangCount = panelNodes.filter(n =>
    getStageOrderIndex(n.stage) >= getStageOrderIndex('BOX_BUILD')
  ).length
  const readyToHangProgress = panelNodes.length > 0
    ? (readyToHangCount / panelNodes.length) * 100
    : 100

  // Find box build nodes for progress
  const boxBuildNodes = nodes.filter(n => n.swsType.includes('BOX'))
  const boxBuildInProgress = boxBuildNodes.filter(n =>
    getStageOrderIndex(n.stage) >= getStageOrderIndex('BUILD_UP')
  ).length
  const boxBuildProgress = boxBuildNodes.length > 0
    ? (boxBuildInProgress / boxBuildNodes.length) * 100
    : 100

  // Determine readiness
  const reasons: string[] = []
  let isReady = true

  if (candidates.length === 0) {
    reasons.push('No cross-wire candidates in project')
    isReady = true // No cross-wire needed
  } else {
    if (readyToHangProgress < CROSS_WIRE_READY_TO_HANG_THRESHOLD) {
      reasons.push(`Only ${Math.round(readyToHangProgress)}% panels at READY_TO_TEST+ (need ${CROSS_WIRE_READY_TO_HANG_THRESHOLD}%)`)
      isReady = false
    } else {
      reasons.push(`${Math.round(readyToHangProgress)}% panels at READY_TO_TEST+ - threshold met`)
    }

    if (boxBuildProgress < CROSS_WIRE_BOX_BUILD_THRESHOLD) {
      reasons.push(`Only ${Math.round(boxBuildProgress)}% box build progress (need ${CROSS_WIRE_BOX_BUILD_THRESHOLD}%)`)
      isReady = false
    } else {
      reasons.push(`${Math.round(boxBuildProgress)}% box build progress - threshold met`)
    }
  }

  // Separate ready vs blocked candidates
  const readyAssignments = candidates
    .filter(n => !n.isBlocked)
    .map(n => n.assignmentId)
  const blockedAssignments = candidates
    .filter(n => n.isBlocked)
    .map(n => n.assignmentId)

  return {
    isReady,
    candidateAssignments: candidates.map(n => n.assignmentId),
    readyAssignments,
    blockedAssignments,
    readyToHangProgress,
    boxBuildProgress,
    reasons,
  }
}

// ============================================================================
// PROJECT LIFECYCLE SNAPSHOT
// ============================================================================

/**
 * Get complete project lifecycle snapshot.
 */
export function getProjectLifecycleSnapshot(
  projectId: string,
  nodes: AssignmentDependencyNode[],
  crossWireReadiness: CrossWireProjectReadiness
): ProjectLifecycleSnapshot {
  // Count by stage
  const countsByStage: Record<AssignmentStageId, number> = {
    READY_TO_LAY: 0,
    BUILD_UP: 0,
    READY_TO_WIRE: 0,
    WIRING: 0,
    READY_FOR_VISUAL: 0,
    WIRING_IPV: 0,
    READY_TO_HANG: 0,
    BOX_BUILD: 0,
    CROSS_WIRE: 0,
    CROSS_WIRE_IPV: 0,
    READY_TO_TEST: 0,
    TEST_1ST_PASS: 0,
    POWER_CHECK: 0,
    READY_FOR_BIQ: 0,
    BIQ: 0,
    FINISHED_BIQ: 0,
  }

  for (const node of nodes) {
    countsByStage[node.stage]++
  }

  // Calculate metrics
  const totalAssignments = nodes.length
  const blockedAssignments = nodes.filter(n => n.isBlocked).length
  const readyAssignments = nodes.filter(n => n.isReady).length
  const lateAssignments = nodes.filter(n => n.isLate).length

  // Stage-specific counts
  const buildUpReadyCount = nodes.filter(n =>
    BUILD_UP_STAGES.includes(n.stage)
  ).length
  const wiringReadyCount = nodes.filter(n =>
    WIRING_STAGES.includes(n.stage)
  ).length
  const readyToHangCount = countsByStage['BOX_BUILD']
  const crossWireCandidateCount = crossWireReadiness.candidateAssignments.length

  // Gate readiness
  const crossWireReady = crossWireReadiness.isReady
  const testReady = nodes.filter(n => n.requiresCrossWireSws).every(n =>
    getStageOrderIndex(n.stage) >= getStageOrderIndex('TEST_1ST_PASS')
  )
  const powerCheckReady = countsByStage['TEST_1ST_PASS'] === 0
  const biqReady = countsByStage['POWER_CHECK'] === 0 &&
    powerCheckReady

  // Completion
  const isComplete = nodes.every(n => n.stage === 'BIQ')
  const completedCount = countsByStage['BIQ']
  const overallProgress = totalAssignments > 0
    ? Math.round((completedCount / totalAssignments) * 100)
    : 0

  // Next recommended action
  const reasons: string[] = []
  let nextRecommendedProjectAction: string | undefined

  if (isComplete) {
    nextRecommendedProjectAction = 'Project complete!'
    reasons.push('All assignments have completed BIQ')
  } else if (blockedAssignments > 0) {
    nextRecommendedProjectAction = `Unblock ${blockedAssignments} assignments`
    reasons.push(`${blockedAssignments} assignments are blocked`)
  } else if (readyAssignments > 0) {
    nextRecommendedProjectAction = `Progress ${readyAssignments} ready assignments`
    reasons.push(`${readyAssignments} assignments ready for next stage`)
  } else if (!crossWireReady && crossWireCandidateCount > 0) {
    nextRecommendedProjectAction = 'Get more panels to IPV3 for cross-wiring gate'
    reasons.push('Cross-wire blocked waiting for panel progress')
  }

  return {
    projectId,
    totalAssignments,
    countsByStage,
    blockedAssignments,
    readyAssignments,
    lateAssignments,
    buildUpReadyCount,
    wiringReadyCount,
    readyToHangCount,
    crossWireCandidateCount,
    crossWireReady,
    testReady,
    powerCheckReady,
    biqReady,
    isComplete,
    overallProgress,
    nextRecommendedProjectAction,
    reasons,
  }
}
