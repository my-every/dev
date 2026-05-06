/**
 * D380 Operation Code Type Definitions
 *
 * Operation codes represent discrete manufacturing operations.
 * Each operation maps to one production stage and carries a
 * default time estimate. Time entries are logged per operation
 * per assignment and accumulated into project-level summaries.
 */

import type { AssignmentStageId } from './d380-assignment-stages'

// ============================================================================
// OPERATION CODE REGISTRY
// ============================================================================

export type OperationCodeCategory =
    | 'assembly'
    | 'wiring'
    | 'inspection'
    | 'test'
    | 'preparation'
    | 'general'

export interface OperationCode {
    /** Numeric code string, e.g. "010", "200" */
    code: string
    /** Human-readable label */
    label: string
    /** Broad category */
    category: OperationCodeCategory
    /** Which production stage this maps to */
    stageId: AssignmentStageId
    /** Default time estimate in minutes */
    defaultMinutes: number
    /** Optional description */
    description?: string
}

// ============================================================================
// TIME ENTRIES
// ============================================================================

export type TimeEntrySource = 'manual' | 'timer' | 'sws_tablet' | 'stage_transition'

export interface OperationTimeEntry {
    /** Unique entry id */
    id: string
    /** Operation code */
    opCode: string
    /** Assignment (sheet) this entry belongs to */
    assignmentId: string
    /** Project id */
    projectId: string
    /** Worker badge */
    badge: string
    /** ISO timestamp when work started */
    startedAt: string
    /** ISO timestamp when work ended (null = in progress) */
    endedAt: string | null
    /** Computed actual minutes */
    actualMinutes: number
    /** How the entry was created */
    source: TimeEntrySource
    /** Optional note */
    note?: string
}

// ============================================================================
// SUMMARIES
// ============================================================================

export interface OpCodeTimeSummary {
    opCode: string
    label: string
    totalMinutes: number
    entryCount: number
}

export interface StageTimeSummary {
    stageId: AssignmentStageId
    totalMinutes: number
    entryCount: number
}

export interface BadgeTimeSummary {
    badge: string
    totalMinutes: number
    entryCount: number
}

export interface ProjectOperationSummary {
    projectId: string
    entries: OperationTimeEntry[]
    byOpCode: OpCodeTimeSummary[]
    byStage: StageTimeSummary[]
    byBadge: BadgeTimeSummary[]
    totalMinutes: number
    updatedAt: string
}

// ============================================================================
// OPERATION CODE REGISTRY (STATIC DATA)
// ============================================================================

export const OPERATION_CODES: OperationCode[] = [
    { code: '005', label: 'Kitting', category: 'preparation', stageId: 'BOX_BUILD', defaultMinutes: 30, description: 'Kitting parts and materials' },
    { code: '006', label: 'Kitting Review', category: 'preparation', stageId: 'BOX_BUILD', defaultMinutes: 15 },
    { code: '007', label: 'Kitting Verification', category: 'inspection', stageId: 'BOX_BUILD', defaultMinutes: 15 },
    { code: '010', label: 'Box Build Up', category: 'assembly', stageId: 'BOX_BUILD', defaultMinutes: 120, description: 'Box enclosure build up' },
    { code: '011', label: 'Box Inspection', category: 'inspection', stageId: 'BOX_BUILD', defaultMinutes: 30 },
    { code: '012', label: 'Box Label Install', category: 'assembly', stageId: 'BOX_BUILD', defaultMinutes: 30 },
    { code: '020', label: 'Rail Build', category: 'assembly', stageId: 'BUILD_UP', defaultMinutes: 60, description: 'Rail assembly and component mounting' },
    { code: '030', label: 'Panel Build Up', category: 'assembly', stageId: 'BUILD_UP', defaultMinutes: 90, description: 'Panel drill, bond, and component install' },
    { code: '038', label: 'Panel Build Visual', category: 'inspection', stageId: 'WIRING_IPV', defaultMinutes: 20 },
    { code: '070', label: 'Console Build Up', category: 'assembly', stageId: 'BOX_BUILD', defaultMinutes: 180, description: 'Console enclosure build up and panel hang' },
    { code: '071', label: 'Console Panel Hang', category: 'assembly', stageId: 'BOX_BUILD', defaultMinutes: 60 },
    { code: '101', label: 'Panel Wiring', category: 'wiring', stageId: 'WIRING', defaultMinutes: 240, description: 'Wire termination on panel' },
    { code: '102', label: 'Cable Termination', category: 'wiring', stageId: 'WIRING', defaultMinutes: 60 },
    { code: '103', label: 'Ground Wiring', category: 'wiring', stageId: 'WIRING', defaultMinutes: 30 },
    { code: '104', label: 'Jumper Install', category: 'wiring', stageId: 'WIRING', defaultMinutes: 30 },
    { code: '105', label: 'Wiring Visual', category: 'inspection', stageId: 'WIRING_IPV', defaultMinutes: 30 },
    { code: '106', label: 'Wiring IPV', category: 'inspection', stageId: 'WIRING_IPV', defaultMinutes: 45, description: 'In-process validation of wiring' },
    { code: '107', label: 'Cross Wire', category: 'wiring', stageId: 'CROSS_WIRE', defaultMinutes: 120, description: 'Box cross wiring' },
    { code: '108', label: 'Cross Wire IPV', category: 'inspection', stageId: 'CROSS_WIRE_IPV', defaultMinutes: 30 },
    { code: '109', label: 'Harness Build', category: 'wiring', stageId: 'CROSS_WIRE', defaultMinutes: 60 },
    { code: '110', label: 'Door Wiring', category: 'wiring', stageId: 'CROSS_WIRE', defaultMinutes: 45 },
    { code: '200', label: 'Test 1st Pass', category: 'test', stageId: 'TEST_1ST_PASS', defaultMinutes: 120, description: 'First pass electrical test' },
    { code: '205', label: 'Power Check', category: 'test', stageId: 'POWER_CHECK', defaultMinutes: 60 },
    { code: '207', label: 'Test Rework', category: 'test', stageId: 'TEST_1ST_PASS', defaultMinutes: 60 },
    { code: '210', label: 'BIQ Inspection', category: 'inspection', stageId: 'BIQ', defaultMinutes: 45, description: 'Built-in quality inspection' },
    { code: '215', label: 'BIQ Rework', category: 'inspection', stageId: 'BIQ', defaultMinutes: 30 },
    { code: '220', label: 'Final BIQ', category: 'inspection', stageId: 'FINISHED_BIQ', defaultMinutes: 30 },
    { code: '225', label: 'Ship Prep', category: 'general', stageId: 'FINISHED_BIQ', defaultMinutes: 30 },
    { code: '300', label: 'General Labor', category: 'general', stageId: 'BOX_BUILD', defaultMinutes: 60 },
]

/** Lookup a single operation code by its code string. */
export function getOperationCode(code: string): OperationCode | undefined {
    return OPERATION_CODES.find(op => op.code === code)
}

/** All codes for a given stage. */
export function getOperationCodesForStage(stageId: AssignmentStageId): OperationCode[] {
    return OPERATION_CODES.filter(op => op.stageId === stageId)
}

/** All codes for a given category. */
export function getOperationCodesByCategory(category: OperationCodeCategory): OperationCode[] {
    return OPERATION_CODES.filter(op => op.category === category)
}
