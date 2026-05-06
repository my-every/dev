/**
 * Assignment Stage Types
 *
 * Two-layer lifecycle model:
 *
 * Layer 1 — Project-level gates (sequential, supervisor-controlled):
 *   LEGALS_READY → BRANDLIST_COMPLETE → BRANDING_READY → KITTING_READY
 *   These are project-wide prerequisites that must be met before
 *   per-assignment stages can begin.  All units share these gates.
 *
 * Layer 2 — Per-assignment stages (per sheet, SWS-type-driven):
 *   BUILD_UP → WIRING → WIRING_IPV → BOX_BUILD → CROSS_WIRE → CROSS_WIRE_IPV
 *   → TEST_1ST_PASS → POWER_CHECK → BIQ → FINISHED_BIQ
 *
 * Stage readiness is a STATUS on a stage, not a separate stage.
 * When a stage's prerequisites are met and it is waiting to be started,
 * its AssignmentStageStatus is set to 'ready'.
 *
 * SWS types determine which stages apply to a given assignment.
 * Hours are tracked per assignment × per stage (estimated / average / actual).
 */

// ============================================================================
// Layer 1 — Project Lifecycle Gates
// ============================================================================

export type ProjectLifecycleGateId =
  | 'LEGALS_READY'
  | 'BRANDLIST_COMPLETE'
  | 'BRANDING_READY'
  | 'KITTING_READY'

export type ProjectLifecycleGateStatus = 'LOCKED' | 'READY' | 'COMPLETE'

export interface ProjectLifecycleGateState {
  gateId: ProjectLifecycleGateId
  status: ProjectLifecycleGateStatus
  targetDate?: string
  completedAt?: string
  completedByBadge?: string
  notes?: string
}

export interface ProjectLifecycleGateDefinition {
  id: ProjectLifecycleGateId
  label: string
  shortLabel: string
  description: string
  order: number
  /** SLOTS.json column that provides the target date for this gate */
  slotColumn?: string
}

export const PROJECT_LIFECYCLE_GATES: ProjectLifecycleGateDefinition[] = [
  {
    id: 'LEGALS_READY',
    label: 'Legals Ready',
    shortLabel: 'Legals',
    description: 'UCP wirelist and layout PDF uploaded and validated for current revision',
    order: 1,
    slotColumn: 'LEGALS',
  },
  {
    id: 'BRANDLIST_COMPLETE',
    label: 'BrandList Complete',
    shortLabel: 'BrandList',
    description: 'Combined Excel brand export generated from wirelist branding module',
    order: 2,
    slotColumn: 'BRAND LIST',
  },
  {
    id: 'BRANDING_READY',
    label: 'Branding Ready',
    shortLabel: 'Branded',
    description: 'Physical labels printed externally and confirmed ready for use',
    order: 3,
    slotColumn: 'BRAND WIRE',
  },
  {
    id: 'KITTING_READY',
    label: 'Kitting Ready',
    shortLabel: 'Kitted',
    description: 'Physical devices available for installation (project-level gate)',
    order: 4,
    slotColumn: 'PROJ KITTED',
  },
] as const

// ============================================================================
// Layer 2 — Per-Assignment Stages
// ============================================================================

export type AssignmentStageId =
  | 'BUILD_UP'
  | 'WIRING'
  | 'WIRING_IPV'
  | 'BOX_BUILD'
  | 'CROSS_WIRE'
  | 'CROSS_WIRE_IPV'
  | 'TEST_1ST_PASS'
  | 'POWER_CHECK'
  | 'BIQ'
  | 'FINISHED_BIQ'

export type AssignmentStageCategory = 'build' | 'verify' | 'test' | 'final'

export type AssignmentStageStatus = 'pending' | 'ready' | 'active' | 'completed' | 'skipped' | 'blocked'

export interface AssignmentStageDefinition {
  id: AssignmentStageId
  label: string
  shortLabel: string
  description: string
  category: AssignmentStageCategory
  order: number
  isVerification: boolean
  requiredForExport: boolean
  /** SLOTS.json column mapped as target milestone (if applicable) */
  slotMilestone?: string
}

// ── Hours tracking per stage ───────────────────────────────────────────────

export interface AssignmentStageHours {
  /** Estimated minutes based on SLOTS total × stage weight × sheet weight */
  estimatedMinutes: number
  /** Rolling average from historical completions */
  averageMinutes?: number
  /** Accumulated actual work minutes */
  actualMinutes?: number
}

export interface AssignmentStageState {
  stageId: AssignmentStageId
  status: AssignmentStageStatus
  hours: AssignmentStageHours
  completedAt?: string
  completedBy?: string
  notes?: string
  blockedReason?: string
}

export interface AssignmentStageProgress {
  currentStage: AssignmentStageId
  completedStages: AssignmentStageId[]
  stages: AssignmentStageState[]
  overallProgress: number // 0-100
  estimatedCompletion?: string
  /** Total hours across all stages */
  totalHours: AssignmentStageHours
}

// ── Stage definitions ──────────────────────────────────────────────────────

export const ASSIGNMENT_STAGES: AssignmentStageDefinition[] = [
  {
    id: 'BUILD_UP',
    label: 'Build Up',
    shortLabel: 'Build',
    description: 'Mechanical mounting, rails, terminal blocks, base assembly',
    category: 'build',
    order: 1,
    isVerification: false,
    requiredForExport: true,
    slotMilestone: 'CONLAY',
  },
  {
    id: 'WIRING',
    label: 'Wiring',
    shortLabel: 'Wire',
    description: 'Point-to-point and internal panel wiring',
    category: 'build',
    order: 2,
    isVerification: false,
    requiredForExport: true,
  },
  {
    id: 'WIRING_IPV',
    label: 'Wiring IPV',
    shortLabel: 'Wire IPV',
    description: 'In-process verification of wiring',
    category: 'verify',
    order: 3,
    isVerification: true,
    requiredForExport: true,
  },
  {
    id: 'BOX_BUILD',
    label: 'Box Build',
    shortLabel: 'Box',
    description: 'Install panels into enclosure / box integration',
    category: 'build',
    order: 4,
    isVerification: false,
    requiredForExport: true,
  },
  {
    id: 'CROSS_WIRE',
    label: 'Cross Wire',
    shortLabel: 'Cross Wire',
    description: 'Cross-panel wiring across sections / door / panel operationships',
    category: 'build',
    order: 5,
    isVerification: false,
    requiredForExport: true,
  },
  {
    id: 'CROSS_WIRE_IPV',
    label: 'Cross Wire IPV',
    shortLabel: 'Cross Wire IPV',
    description: 'In-process verification of cross wiring',
    category: 'verify',
    order: 6,
    isVerification: true,
    requiredForExport: true,
  },
  {
    id: 'TEST_1ST_PASS',
    label: 'Test 1st Pass',
    shortLabel: 'Test',
    description: 'Functional test — first pass',
    category: 'test',
    order: 7,
    isVerification: false,
    requiredForExport: true,
  },
  {
    id: 'POWER_CHECK',
    label: 'Power Check',
    shortLabel: 'Power',
    description: 'Power validation checkpoint, hand-off to BIQ',
    category: 'test',
    order: 8,
    isVerification: false,
    requiredForExport: true,
    slotMilestone: 'PWRCHK',
  },
  {
    id: 'BIQ',
    label: 'BIQ',
    shortLabel: 'BIQ',
    description: 'Final built-in quality review',
    category: 'final',
    order: 9,
    isVerification: false,
    requiredForExport: true,
    slotMilestone: 'D380 FINAL-BIQ',
  },
  {
    id: 'FINISHED_BIQ',
    label: 'Finished BIQ',
    shortLabel: 'Done',
    description: 'BIQ complete, assignment fully finished',
    category: 'final',
    order: 10,
    isVerification: false,
    requiredForExport: false,
  },
] as const

// ============================================================================
// SWS Type → Stage Profiles
// ============================================================================

export type SwsTypeId =
  | 'PANEL'
  | 'BLANK_PANEL'
  | 'RAIL_BUILD'
  | 'COMPONENT_BUILD'
  | 'BOX_BUILD'
  | 'WIRING_ONLY'
  | 'UNDECIDED'

export interface SwsStageProfile {
  swsType: SwsTypeId
  label: string
  description: string
  applicableStages: AssignmentStageId[]
  skippedStages: AssignmentStageId[]
  /** Stage weight percentages (must total ~100 for applicable work stages) */
  stageWeightPercent: Partial<Record<AssignmentStageId, number>>
  /** Alternate weights when cross-wire does not apply */
  stageWeightPercentNoCrossWire?: Partial<Record<AssignmentStageId, number>>
}

export const SWS_STAGE_PROFILES: Record<SwsTypeId, SwsStageProfile> = {
  PANEL: {
    swsType: 'PANEL',
    label: 'Panel',
    description: 'Full sequence — build, wire, box, cross-wire, test, BIQ',
    applicableStages: [
      'BUILD_UP', 'WIRING', 'WIRING_IPV', 'BOX_BUILD',
      'CROSS_WIRE', 'CROSS_WIRE_IPV',
      'TEST_1ST_PASS', 'POWER_CHECK',
      'BIQ', 'FINISHED_BIQ',
    ],
    skippedStages: [],
    stageWeightPercent: {
      BUILD_UP: 15,
      WIRING: 40,
      WIRING_IPV: 10,
      BOX_BUILD: 2,
      CROSS_WIRE: 15,
      CROSS_WIRE_IPV: 5,
      TEST_1ST_PASS: 5,
      POWER_CHECK: 2,
      BIQ: 6,
    },
    stageWeightPercentNoCrossWire: {
      BUILD_UP: 18,
      WIRING: 46,
      WIRING_IPV: 12,
      BOX_BUILD: 3,
      TEST_1ST_PASS: 10,
      POWER_CHECK: 3,
      BIQ: 8,
    },
  },
  BLANK_PANEL: {
    swsType: 'BLANK_PANEL',
    label: 'Blank Panel',
    description: 'No wiring — build-up and BIQ only',
    applicableStages: [
      'BUILD_UP',
      'BIQ', 'FINISHED_BIQ',
    ],
    skippedStages: [
      'WIRING', 'WIRING_IPV',
      'BOX_BUILD', 'CROSS_WIRE', 'CROSS_WIRE_IPV',
      'TEST_1ST_PASS', 'POWER_CHECK',
    ],
    stageWeightPercent: {
      BUILD_UP: 80,
      BIQ: 20,
    },
  },
  RAIL_BUILD: {
    swsType: 'RAIL_BUILD',
    label: 'Rail Build',
    description: 'Mechanical rail fabrication — build-up and BIQ only',
    applicableStages: [
      'BUILD_UP',
      'BIQ', 'FINISHED_BIQ',
    ],
    skippedStages: [
      'WIRING', 'WIRING_IPV',
      'BOX_BUILD', 'CROSS_WIRE', 'CROSS_WIRE_IPV',
      'TEST_1ST_PASS', 'POWER_CHECK',
    ],
    stageWeightPercent: {
      BUILD_UP: 85,
      BIQ: 15,
    },
  },
  COMPONENT_BUILD: {
    swsType: 'COMPONENT_BUILD',
    label: 'Component Build',
    description: 'Device/component prep — build-up and BIQ only',
    applicableStages: [
      'BUILD_UP',
      'BIQ', 'FINISHED_BIQ',
    ],
    skippedStages: [
      'WIRING', 'WIRING_IPV',
      'BOX_BUILD', 'CROSS_WIRE', 'CROSS_WIRE_IPV',
      'TEST_1ST_PASS', 'POWER_CHECK',
    ],
    stageWeightPercent: {
      BUILD_UP: 85,
      BIQ: 15,
    },
  },
  BOX_BUILD: {
    swsType: 'BOX_BUILD',
    label: 'Box Build',
    description: 'Enclosure/box-focused work — build-up, box, cross-wire, test, BIQ',
    applicableStages: [
      'BUILD_UP', 'BOX_BUILD',
      'CROSS_WIRE', 'CROSS_WIRE_IPV',
      'TEST_1ST_PASS', 'POWER_CHECK',
      'BIQ', 'FINISHED_BIQ',
    ],
    skippedStages: [
      'WIRING', 'WIRING_IPV',
    ],
    stageWeightPercent: {
      BUILD_UP: 20,
      BOX_BUILD: 45,
      CROSS_WIRE: 15,
      CROSS_WIRE_IPV: 5,
      TEST_1ST_PASS: 7,
      POWER_CHECK: 3,
      BIQ: 5,
    },
    stageWeightPercentNoCrossWire: {
      BUILD_UP: 24,
      BOX_BUILD: 54,
      TEST_1ST_PASS: 9,
      POWER_CHECK: 4,
      BIQ: 9,
    },
  },
  WIRING_ONLY: {
    swsType: 'WIRING_ONLY',
    label: 'Wiring Only',
    description: 'Wiring execution only — no mechanical build-up',
    applicableStages: [
      'WIRING', 'WIRING_IPV',
      'BOX_BUILD',
      'CROSS_WIRE', 'CROSS_WIRE_IPV',
      'TEST_1ST_PASS', 'POWER_CHECK',
      'BIQ', 'FINISHED_BIQ',
    ],
    skippedStages: [
      'BUILD_UP',
    ],
    stageWeightPercent: {
      WIRING: 60,
      WIRING_IPV: 15,
      CROSS_WIRE: 10,
      CROSS_WIRE_IPV: 5,
      TEST_1ST_PASS: 5,
      POWER_CHECK: 2,
      BIQ: 3,
    },
    stageWeightPercentNoCrossWire: {
      WIRING: 68,
      WIRING_IPV: 17,
      TEST_1ST_PASS: 7,
      POWER_CHECK: 3,
      BIQ: 5,
    },
  },
  UNDECIDED: {
    swsType: 'UNDECIDED',
    label: 'Undecided',
    description: 'SWS type not yet determined — defaults to PANEL sequence',
    applicableStages: [
      'BUILD_UP', 'WIRING', 'WIRING_IPV', 'BOX_BUILD',
      'CROSS_WIRE', 'CROSS_WIRE_IPV',
      'TEST_1ST_PASS', 'POWER_CHECK',
      'BIQ', 'FINISHED_BIQ',
    ],
    skippedStages: [],
    stageWeightPercent: {
      BUILD_UP: 15,
      WIRING: 40,
      WIRING_IPV: 10,
      BOX_BUILD: 2,
      CROSS_WIRE: 15,
      CROSS_WIRE_IPV: 5,
      TEST_1ST_PASS: 5,
      POWER_CHECK: 2,
      BIQ: 6,
    },
  },
}

// ============================================================================
// Project-Level Stage Weight Distribution
// ============================================================================

/**
 * Overall project-level distribution across all phases (intake through final).
 * Used for project-level progress and resource planning.
 */
export const STAGE_WEIGHT_DISTRIBUTION = {
  // Intake & Prep (project gates)
  INTAKE: 0.04,
  ASSIGNMENT_MAPPING: 0.05,
  BRANDING_KITTING: 0.06,
  TEAM_ASSIGNMENT: 0.03,

  // Execution (per-assignment stages)
  BUILD_UP: 0.18,
  WIRING: 0.28,
  CROSS_WIRE: 0.07,
  BOX_BUILD: 0.04,

  // QA / Validation
  WIRING_IPV: 0.08,
  TEST: 0.04,
  POWER_CHECK: 0.03,
  BIQ: 0.02,
  FINALIZATION: 0.01,
} as const

// ============================================================================
// Utility functions
// ============================================================================

export function getStageDefinition(stageId: AssignmentStageId): AssignmentStageDefinition | undefined {
  return ASSIGNMENT_STAGES.find(s => s.id === stageId)
}

export function getStagesByCategory(category: AssignmentStageCategory): AssignmentStageDefinition[] {
  return ASSIGNMENT_STAGES.filter(s => s.category === category)
}

export function getVerificationStages(): AssignmentStageDefinition[] {
  return ASSIGNMENT_STAGES.filter(s => s.isVerification)
}

export function getWorkStages(): AssignmentStageDefinition[] {
  return ASSIGNMENT_STAGES.filter(s => !s.isVerification)
}

export function getNextStage(currentStageId: AssignmentStageId): AssignmentStageDefinition | undefined {
  const current = ASSIGNMENT_STAGES.find(s => s.id === currentStageId)
  if (!current) return undefined
  return ASSIGNMENT_STAGES.find(s => s.order === current.order + 1)
}

export function getPreviousStage(currentStageId: AssignmentStageId): AssignmentStageDefinition | undefined {
  const current = ASSIGNMENT_STAGES.find(s => s.id === currentStageId)
  if (!current) return undefined
  return ASSIGNMENT_STAGES.find(s => s.order === current.order - 1)
}

export function calculateStageProgress(completedStages: AssignmentStageId[]): number {
  const requiredStages = ASSIGNMENT_STAGES.filter(s => s.requiredForExport)
  const completed = requiredStages.filter(s => completedStages.includes(s.id))
  return Math.round((completed.length / requiredStages.length) * 100)
}

export function getGateDefinition(gateId: ProjectLifecycleGateId): ProjectLifecycleGateDefinition | undefined {
  return PROJECT_LIFECYCLE_GATES.find(g => g.id === gateId)
}

export function getSwsProfile(swsType: SwsTypeId): SwsStageProfile {
  return SWS_STAGE_PROFILES[swsType] ?? SWS_STAGE_PROFILES.UNDECIDED
}

/**
 * Get applicable stages for an assignment given its SWS type and
 * whether cross-wiring applies.
 */
export function getApplicableStages(
  swsType: SwsTypeId,
  hasCrossWire: boolean = true
): AssignmentStageId[] {
  const profile = getSwsProfile(swsType)
  if (!hasCrossWire) {
    return profile.applicableStages.filter(
      s => s !== 'CROSS_WIRE' && s !== 'CROSS_WIRE_IPV'
    )
  }
  return [...profile.applicableStages]
}

/**
 * Get the stage weight percentages for an assignment given its SWS type.
 * When cross-wire does not apply, returns the alternate weights if defined.
 */
export function getStageWeights(
  swsType: SwsTypeId,
  hasCrossWire: boolean = true
): Partial<Record<AssignmentStageId, number>> {
  const profile = getSwsProfile(swsType)
  if (!hasCrossWire && profile.stageWeightPercentNoCrossWire) {
    return { ...profile.stageWeightPercentNoCrossWire }
  }
  return { ...profile.stageWeightPercent }
}

// ============================================================================
// Category color mapping
// ============================================================================

export const STAGE_CATEGORY_COLORS: Record<AssignmentStageCategory, { bg: string; text: string; border: string }> = {
  build: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-300' },
  verify: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  test: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  final: { bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-300' },
}

// Status color mapping
export const STAGE_STATUS_COLORS: Record<AssignmentStageStatus, { bg: string; text: string; icon: string }> = {
  pending: { bg: 'bg-muted', text: 'text-muted-foreground', icon: 'text-muted-foreground' },
  ready: { bg: 'bg-amber-100', text: 'text-amber-700', icon: 'text-amber-500' },
  active: { bg: 'bg-blue-500', text: 'text-white', icon: 'text-blue-500' },
  completed: { bg: 'bg-emerald-500', text: 'text-white', icon: 'text-emerald-500' },
  skipped: { bg: 'bg-slate-400', text: 'text-white', icon: 'text-slate-400' },
  blocked: { bg: 'bg-red-500', text: 'text-white', icon: 'text-red-500' },
}

// ── Display config ─────────────────────────────────────────────────────────

export interface StageDisplayConfig {
  id: AssignmentStageId
  label: string
  shortLabel: string
  description: string
  color: string
  actionLabel: string
  isTerminal: boolean
}

export const STAGE_DISPLAY_CONFIG: Record<AssignmentStageId, StageDisplayConfig> = {
  BUILD_UP: {
    id: 'BUILD_UP', label: 'Build Up', shortLabel: 'Build',
    description: 'Mechanical mounting and base assembly',
    color: 'amber', actionLabel: 'Continue', isTerminal: false,
  },
  WIRING: {
    id: 'WIRING', label: 'Wiring', shortLabel: 'Wire',
    description: 'Point-to-point and internal panel wiring',
    color: 'purple', actionLabel: 'Continue', isTerminal: false,
  },
  WIRING_IPV: {
    id: 'WIRING_IPV', label: 'Wiring IPV', shortLabel: 'W-IPV',
    description: 'In-process verification of wiring',
    color: 'sky', actionLabel: 'Verify', isTerminal: false,
  },
  BOX_BUILD: {
    id: 'BOX_BUILD', label: 'Box Build', shortLabel: 'Box',
    description: 'Install panels into enclosure',
    color: 'fuchsia', actionLabel: 'Continue', isTerminal: false,
  },
  CROSS_WIRE: {
    id: 'CROSS_WIRE', label: 'Cross Wire', shortLabel: 'Cross Wire',
    description: 'Cross-panel wiring across sections',
    color: 'rose', actionLabel: 'Continue', isTerminal: false,
  },
  CROSS_WIRE_IPV: {
    id: 'CROSS_WIRE_IPV', label: 'Cross Wire IPV', shortLabel: 'Cross Wire IPV',
    description: 'Verification of cross wiring',
    color: 'red', actionLabel: 'Verify', isTerminal: false,
  },
  TEST_1ST_PASS: {
    id: 'TEST_1ST_PASS', label: 'Test 1st Pass', shortLabel: 'Test',
    description: 'Functional test — first pass',
    color: 'teal', actionLabel: 'Continue', isTerminal: false,
  },
  POWER_CHECK: {
    id: 'POWER_CHECK', label: 'Power Check', shortLabel: 'Power',
    description: 'Power validation checkpoint',
    color: 'green', actionLabel: 'Continue', isTerminal: false,
  },
  BIQ: {
    id: 'BIQ', label: 'BIQ', shortLabel: 'BIQ',
    description: 'Final built-in quality review',
    color: 'emerald', actionLabel: 'Complete BIQ', isTerminal: false,
  },
  FINISHED_BIQ: {
    id: 'FINISHED_BIQ', label: 'Finished BIQ', shortLabel: 'Done',
    description: 'Assignment complete',
    color: 'emerald', actionLabel: 'Done', isTerminal: true,
  },
}