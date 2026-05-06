/**
 * Auto-Progression Rules Engine
 *
 * Implements the SWS-type-driven lifecycle rules for stage progression.
 * All transitions require supervisor/team-lead manual approval.
 *
 * PANEL (full sequence):
 *   READY_TO_LAY → BUILD_UP → READY_TO_WIRE → WIRING → READY_FOR_VISUAL
 *   → WIRING_IPV → READY_TO_HANG → BOX_BUILD → CROSS_WIRE → CROSS_WIRE_IPV
 *   → READY_TO_TEST → TEST_1ST_PASS → POWER_CHECK → READY_FOR_BIQ → BIQ → FINISHED_BIQ
 *
 * BLANK_PANEL / RAIL_BUILD / COMPONENT_BUILD:
 *   READY_TO_LAY → BUILD_UP → READY_FOR_BIQ → BIQ → FINISHED_BIQ
 *
 * BOX_BUILD (SWS):
 *   READY_TO_LAY → BUILD_UP → READY_TO_HANG → BOX_BUILD → CROSS_WIRE* → CROSS_WIRE_IPV*
 *   → READY_TO_TEST → TEST_1ST_PASS → POWER_CHECK → READY_FOR_BIQ → BIQ → FINISHED_BIQ
 *
 * WIRING_ONLY:
 *   READY_TO_WIRE → WIRING → READY_FOR_VISUAL → WIRING_IPV → READY_TO_HANG
 *   → CROSS_WIRE* → CROSS_WIRE_IPV* → READY_TO_TEST → TEST_1ST_PASS
 *   → POWER_CHECK → READY_FOR_BIQ → BIQ → FINISHED_BIQ
 */

import type { AssignmentStageId, SwsTypeId } from '@/types/d380-assignment-stages'
import type { StageFlowType } from './stage-lifecycle'
import { getStageOrderIndex } from './stage-lifecycle'

// ============================================================================
// RULE TYPES
// ============================================================================

/**
 * Trigger condition for auto-progression.
 */
export type ProgressionTrigger =
  | 'WORK_STARTED'     // Work has started on this stage
  | 'WORK_COMPLETE'    // Work is complete on this stage
  | 'IPV_COMPLETE'     // In-Process Verification complete
  | 'VISUAL_COMPLETE'  // Visual inspection complete
  | 'TEST_PASS'        // Test passed
  | 'MANUAL_ADVANCE'   // Manual advancement by Team Lead

/**
 * A single progression rule.
 */
export interface ProgressionRule {
  id: string
  name: string
  fromStage: AssignmentStageId
  toStage: AssignmentStageId
  trigger: ProgressionTrigger
  requiresIpv: boolean
  isAutomatic: boolean
  description: string
  prerequisites: ProgressionPrerequisite[]
}

/**
 * A prerequisite for a progression rule.
 */
export interface ProgressionPrerequisite {
  type: 'SELF_IPV' | 'PROJECT_GATE' | 'ASSIGNMENT_GATE' | 'MANUAL_CHECK'
  description: string
  checkFn?: (context: ProgressionContext) => boolean
}

/**
 * Context for evaluating progression rules.
 */
export interface ProgressionContext {
  currentStage: AssignmentStageId
  hasWireRows: boolean
  requiresCrossWireSws: boolean
  swsType: string
  ipvComplete: boolean
  projectCrossWireReady: boolean
  projectMetrics?: {
    readyToHangPercent: number
    boxBuildPercent: number
    crossWireComplete: boolean
    testComplete: boolean
  }
}

// ============================================================================
// PROGRESSION RULES REGISTRY
// ============================================================================

export const PROGRESSION_RULES: ProgressionRule[] = [
  // BUILD_UP → WIRING (panel/full flow)
  {
    id: 'build-up-to-wiring',
    name: 'Build Up Complete → Wiring',
    fromStage: 'BUILD_UP',
    toStage: 'WIRING',
    trigger: 'WORK_COMPLETE',
    requiresIpv: false,
    isAutomatic: false,
    description: 'Build-up complete, assignment ready for wiring',
    prerequisites: [],
  },

  // BUILD_UP → BOX_BUILD (box build SWS)
  {
    id: 'build-up-to-box-build',
    name: 'Build Up Complete → Box Build',
    fromStage: 'BUILD_UP',
    toStage: 'BOX_BUILD',
    trigger: 'WORK_COMPLETE',
    requiresIpv: false,
    isAutomatic: false,
    description: 'Build-up complete (box SWS), ready for box install',
    prerequisites: [],
  },

  // BUILD_UP → BIQ (build-only: BLANK_PANEL, RAIL, COMPONENT)
  {
    id: 'build-up-to-biq',
    name: 'Build Up Complete → BIQ',
    fromStage: 'BUILD_UP',
    toStage: 'BIQ',
    trigger: 'WORK_COMPLETE',
    requiresIpv: false,
    isAutomatic: false,
    description: 'Build-up complete (build-only), proceed to BIQ',
    prerequisites: [],
  },

  // WIRING → WIRING_IPV
  {
    id: 'wiring-to-wiring-ipv',
    name: 'Wiring Complete → Wiring IPV',
    fromStage: 'WIRING',
    toStage: 'WIRING_IPV',
    trigger: 'WORK_COMPLETE',
    requiresIpv: false,
    isAutomatic: false,
    description: 'Wiring complete, ready for in-process verification',
    prerequisites: [],
  },

  // WIRING_IPV → BOX_BUILD
  {
    id: 'wiring-ipv-to-box-build',
    name: 'Wiring IPV Complete → Box Build',
    fromStage: 'WIRING_IPV',
    toStage: 'BOX_BUILD',
    trigger: 'IPV_COMPLETE',
    requiresIpv: true,
    isAutomatic: false,
    description: 'Wiring verified, ready for box install',
    prerequisites: [{ type: 'SELF_IPV', description: 'Wiring IPV must be complete' }],
  },

  // BOX_BUILD → CROSS_WIRE (conditional)
  {
    id: 'box-build-to-cross-wire',
    name: 'Box Build Complete → Cross Wire',
    fromStage: 'BOX_BUILD',
    toStage: 'CROSS_WIRE',
    trigger: 'MANUAL_ADVANCE',
    requiresIpv: false,
    isAutomatic: false,
    description: 'Box build complete, cross-wiring starts',
    prerequisites: [
      {
        type: 'PROJECT_GATE',
        description: '50% of panels must be at or past BOX_BUILD',
        checkFn: (ctx) => (ctx.projectMetrics?.readyToHangPercent ?? 0) >= 50,
      },
      {
        type: 'ASSIGNMENT_GATE',
        description: 'Assignment must require cross-wire SWS',
        checkFn: (ctx) => ctx.requiresCrossWireSws,
      },
    ],
  },

  // BOX_BUILD → TEST_1ST_PASS (no cross-wire)
  {
    id: 'box-build-to-test-1st-pass',
    name: 'Box Build Complete → Test',
    fromStage: 'BOX_BUILD',
    toStage: 'TEST_1ST_PASS',
    trigger: 'MANUAL_ADVANCE',
    requiresIpv: false,
    isAutomatic: false,
    description: 'Box build complete, no cross-wire required',
    prerequisites: [
      {
        type: 'ASSIGNMENT_GATE',
        description: 'Only for assignments without cross-wire',
        checkFn: (ctx) => !ctx.requiresCrossWireSws,
      },
    ],
  },

  // CROSS_WIRE → CROSS_WIRE_IPV
  {
    id: 'cross-wire-to-cross-wire-ipv',
    name: 'Cross Wire Complete → Cross Wire IPV',
    fromStage: 'CROSS_WIRE',
    toStage: 'CROSS_WIRE_IPV',
    trigger: 'WORK_COMPLETE',
    requiresIpv: false,
    isAutomatic: false,
    description: 'Cross wiring complete, proceed to verification',
    prerequisites: [],
  },

  // CROSS_WIRE_IPV → TEST_1ST_PASS
  {
    id: 'cross-wire-ipv-to-test-1st-pass',
    name: 'Cross Wire IPV Complete → Test',
    fromStage: 'CROSS_WIRE_IPV',
    toStage: 'TEST_1ST_PASS',
    trigger: 'IPV_COMPLETE',
    requiresIpv: true,
    isAutomatic: false,
    description: 'Cross wiring verified, ready for test',
    prerequisites: [{ type: 'SELF_IPV', description: 'Cross Wire IPV must be complete' }],
  },

  // TEST_1ST_PASS → POWER_CHECK
  {
    id: 'test-1st-pass-to-power-check',
    name: 'Test Complete → Power Check',
    fromStage: 'TEST_1ST_PASS',
    toStage: 'POWER_CHECK',
    trigger: 'WORK_COMPLETE',
    requiresIpv: false,
    isAutomatic: false,
    description: 'Test complete, power validation starts',
    prerequisites: [],
  },

  // POWER_CHECK → BIQ
  {
    id: 'power-check-to-biq',
    name: 'Power Check Complete → BIQ',
    fromStage: 'POWER_CHECK',
    toStage: 'BIQ',
    trigger: 'WORK_COMPLETE',
    requiresIpv: false,
    isAutomatic: false,
    description: 'Power check complete, ready for final BIQ',
    prerequisites: [],
  },

  // BIQ → FINISHED_BIQ
  {
    id: 'biq-to-finished-biq',
    name: 'BIQ Complete',
    fromStage: 'BIQ',
    toStage: 'FINISHED_BIQ',
    trigger: 'WORK_COMPLETE',
    requiresIpv: false,
    isAutomatic: false,
    description: 'BIQ review complete, assignment finished',
    prerequisites: [],
  },
]

// ============================================================================
// RULE LOOKUP AND EVALUATION
// ============================================================================

export function findApplicableRules(
  fromStage: AssignmentStageId,
  _flowType?: StageFlowType | SwsTypeId,
): ProgressionRule[] {
  return PROGRESSION_RULES.filter(rule => rule.fromStage === fromStage)
}

export function getNextPossibleStages(
  context: ProgressionContext,
  _flowType?: StageFlowType | SwsTypeId,
): { stage: AssignmentStageId; rule: ProgressionRule; canProgress: boolean; reason: string }[] {
  const rules = findApplicableRules(context.currentStage)
  return rules.map(rule => {
    const { canProgress, reason } = evaluateRule(rule, context)
    return { stage: rule.toStage, rule, canProgress, reason }
  })
}

export function evaluateRule(
  rule: ProgressionRule,
  context: ProgressionContext
): { canProgress: boolean; reason: string } {
  for (const prereq of rule.prerequisites) {
    if (prereq.checkFn && !prereq.checkFn(context)) {
      return { canProgress: false, reason: prereq.description }
    }
    if (prereq.type === 'SELF_IPV' && !context.ipvComplete) {
      return { canProgress: false, reason: prereq.description }
    }
    if (prereq.type === 'PROJECT_GATE' && rule.toStage === 'CROSS_WIRE') {
      if (!context.projectCrossWireReady) {
        return { canProgress: false, reason: 'Project cross-wire prerequisites not met' }
      }
    }
  }
  return { canProgress: true, reason: rule.description }
}

export function getRecommendedNextStage(
  context: ProgressionContext,
  flowType?: StageFlowType | SwsTypeId,
): { stage: AssignmentStageId | null; rule: ProgressionRule | null; reasons: string[] } {
  const possibleStages = getNextPossibleStages(context, flowType)

  const automaticMatch = possibleStages.find(s => s.canProgress && s.rule.isAutomatic)
  if (automaticMatch) {
    return { stage: automaticMatch.stage, rule: automaticMatch.rule, reasons: [automaticMatch.reason] }
  }

  const manualMatch = possibleStages.find(s => s.canProgress)
  if (manualMatch) {
    return { stage: manualMatch.stage, rule: manualMatch.rule, reasons: [manualMatch.reason] }
  }

  const blockedReasons = possibleStages.filter(s => !s.canProgress).map(s => s.reason)
  return {
    stage: null,
    rule: null,
    reasons: blockedReasons.length > 0 ? blockedReasons : ['No valid transitions from current stage'],
  }
}

export function determineFlowType(
  _hasWireRows: boolean,
  _requiresCrossWireSws: boolean,
  swsType: string
): StageFlowType {
  switch (swsType) {
    case 'BLANK_PANEL':
    case 'BLANK': return 'BLANK_PANEL'
    case 'RAIL_BUILD':
    case 'RAIL': return 'RAIL_BUILD'
    case 'COMPONENT_BUILD':
    case 'COMPONENT': return 'COMPONENT_BUILD'
    case 'BOX_BUILD':
    case 'BOX': return 'BOX_BUILD'
    case 'WIRING_ONLY': return 'WIRING_ONLY'
    default: return 'PANEL'
  }
}

// ============================================================================
// IPV TRACKING
// ============================================================================

export const STAGES_REQUIRING_IPV: AssignmentStageId[] = [
  'WIRING_IPV',
  'CROSS_WIRE_IPV',
]

export function stageRequiresIpv(stage: AssignmentStageId): boolean {
  return STAGES_REQUIRING_IPV.includes(stage)
}

export function getIpvTypeForStage(stage: AssignmentStageId): string | null {
  switch (stage) {
    case 'WIRING_IPV': return 'Wiring IPV'
    case 'CROSS_WIRE_IPV': return 'Cross Wiring IPV'
    default: return null
  }
}
