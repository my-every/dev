/**
 * Production Slot Types
 *
 * Typed interface for SLOTS.json production planning records.
 * Each record represents one project-unit slot with target milestone dates,
 * estimated hours, and project metadata.
 *
 * SLOTS.json date columns map to project lifecycle gates and assignment
 * stage milestones as follows:
 *
 *   LEGALS          → ProjectLifecycleGate: LEGALS_READY
 *   BRAND LIST      → ProjectLifecycleGate: BRANDLIST_COMPLETE
 *   BRAND WIRE      → ProjectLifecycleGate: BRANDING_READY
 *   PROJ KITTED     → ProjectLifecycleGate: KITTING_READY
 *   CONLAY          → AssignmentStage milestone: BUILD_UP target
 *   CONASY          → AssignmentStage milestone: WIRING target (all assignments cross stages up to test)
 *   PWRCHK          → AssignmentStage milestone: POWER_CHECK
 *   D380 FINAL-BIQ  → AssignmentStage milestone: BIQ
 *   SHIPC           → Post-production shipment milestone
 */

import type { ProjectLifecycleGateId } from './d380-assignment-stages'
import type { AssignmentStageId } from './d380-assignment-stages'

// ============================================================================
// Raw SLOTS.json Record
// ============================================================================

/**
 * Represents a single row from SLOTS.json (production planning spreadsheet).
 * All date fields are date strings in M/D/YYYY or MM/DD/YY format.
 */
export interface ProductionSlotRecord {
    // ── Project Identity ──────────────────────────────────────────────────
    /** LWC category: "New", "Onskid", "Offskid", etc. */
    LWC: string
    /** Project name */
    PROJECT: string
    /** Unit number within the project */
    UNIT: string
    /** Production Drawing number */
    'PD#': string

    // ── Project Gate Dates ────────────────────────────────────────────────
    /** Legals received date. "see #1" when shared with another unit. */
    LEGALS: string
    /** BrandList target date. "see #1" when shared. */
    'BRAND LIST': string
    /** Branding wire/print target date */
    'BRAND WIRE': string
    /** Project kitting target date */
    'PROJ KITTED': string

    // ── Stage Milestone Dates ─────────────────────────────────────────────
    /** Construction Layout — maps to BUILD_UP stage target */
    CONLAY: string
    /** Construction Assembly — maps to WIRING stage target */
    CONASY: string
    /** Power Check target date */
    PWRCHK: string
    /** Final BIQ target date */
    'D380 FINAL-BIQ': string

    // ── Shipment & Targets ────────────────────────────────────────────────
    /** Ship date */
    SHIPC: string
    /** Department 380 target date */
    'DEPT 380 TARGET': string
    /** Days late (negative = early, positive = late) */
    'DAYS LATE': string
    /** Revised commit date */
    'NEW COMMMIT'?: string
    /** BIQ completion date */
    'BIQ COMP'?: string

    // ── Project Classification ────────────────────────────────────────────
    /** Application area (e.g., "O & G", "IPG") */
    Applic?: string
    /** Product ID */
    'Prod ID'?: string
    /** Unit type */
    'Unit Type'?: string
    /** Manufacturing Order number */
    'MO #'?: string
    /** Construction type */
    'Cons Type'?: string
    /** Project type composite string */
    'Project Type'?: string
    /** Controls Slot identifier */
    'Controls Slot'?: string

    // ── Personnel ─────────────────────────────────────────────────────────
    /** Manufacturing Engineer name */
    'ME Name'?: string
    /** Controls Design Engineer name */
    'Cntls DE Name'?: string
    /** Project Manager name */
    'PM Name'?: string
    /** CMP name */
    'CMP Name'?: string
    /** Coordinator name */
    'Coord Name'?: string
    /** Certification Engineer name */
    'Cert Eng Name'?: string
    /** MLM name */
    'MLM Name'?: string

    // ── Scheduling ────────────────────────────────────────────────────────
    /** Need event code */
    'Need Event'?: string
    /** Need date */
    'Need Dt'?: string
    /** Base date */
    'Base Dt'?: string
    /** Package assembly date */
    'Pkg Assy Dt'?: string
    /** Power check status code */
    'PWRCHK Status'?: string
    /** Construction ship minus 2 weeks */
    'Cons Ship - 2'?: string
    /** Construction ship date */
    'Cons Ship'?: string
    /** CONDEF planned date */
    'CONDEF Plan'?: string
    /** CONDEF actual/completed date */
    'CONDEF A/C'?: string
    /** SOFTT planned date */
    'SOFTT Plan'?: string
    /** SOFTT actual/completed date */
    'SOFTT A/C'?: string
    /** Revised power check date */
    'New Pwrchk'?: string

    // ── Estimates ─────────────────────────────────────────────────────────
    /** Estimated total hours for the project */
    'Est Total Hours'?: number
    /** Estimated panel count */
    'Est Panel Count'?: number
    /** Estimated sample count */
    'Est Sample Count'?: number
}

// ============================================================================
// Processed / Normalized Slot
// ============================================================================

export interface ProductionMilestone {
    /** Parsed target date */
    targetDate: Date | null
    /** Actual completion date (if completed) */
    actualDate?: Date | null
    /** Whether this milestone maps to a project gate or assignment stage */
    scope: 'project-gate' | 'assignment-stage' | 'post-production'
    /** The gate or stage this milestone maps to */
    mappedGateId?: ProjectLifecycleGateId
    mappedStageId?: AssignmentStageId
}

/**
 * Normalized production slot with parsed dates and mapped milestones.
 * Created by processing a raw ProductionSlotRecord.
 */
export interface NormalizedProductionSlot {
    // Identity
    lwc: string
    projectName: string
    unitNumber: string
    pdNumber: string

    // Parsed milestone dates
    milestones: {
        legalsReady: ProductionMilestone
        brandlistComplete: ProductionMilestone
        brandingReady: ProductionMilestone
        kittingReady: ProductionMilestone
        buildUpTarget: ProductionMilestone
        wiringTarget: ProductionMilestone
        powerCheck: ProductionMilestone
        biq: ProductionMilestone
        shipDate: ProductionMilestone
    }

    // Estimates
    estimatedTotalHours: number | null
    estimatedPanelCount: number | null
    estimatedSampleCount: number | null

    // Target & variance
    deptTargetDate: Date | null
    daysLate: number | null
    revisedCommitDate: Date | null

    // Personnel
    personnel: {
        meEngineer?: string
        controlsDE?: string
        projectManager?: string
        cmpName?: string
        coordinator?: string
        certEngineer?: string
        mlm?: string
    }

    // Classification
    consType?: string
    projectType?: string
    controlsSlot?: string

    /** Reference to the raw record for any un-mapped fields */
    raw: ProductionSlotRecord
}

// ============================================================================
// Gate → SLOTS Column Mapping
// ============================================================================

export const GATE_TO_SLOT_COLUMN: Record<ProjectLifecycleGateId, keyof ProductionSlotRecord> = {
    LEGALS_READY: 'LEGALS',
    BRANDLIST_COMPLETE: 'BRAND LIST',
    BRANDING_READY: 'BRAND WIRE',
    KITTING_READY: 'PROJ KITTED',
}

export const STAGE_TO_SLOT_COLUMN: Partial<Record<AssignmentStageId, keyof ProductionSlotRecord>> = {
    BUILD_UP: 'CONLAY',
    WIRING: 'CONASY',
    POWER_CHECK: 'PWRCHK',
    BIQ: 'D380 FINAL-BIQ',
}
