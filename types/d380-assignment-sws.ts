/**
 * D380 Assignment SWS Configuration Types
 *
 * Manages the binding between assignments (sheets) and SWS templates,
 * per-section overrides, pre-configured components, review workflow,
 * and export review state for wire list and branding list outputs.
 */

import type { SwsTemplateId } from './d380-sws'
import type { SwsExecutionMode, SwsSectionState, SwsWorksheetMetadata } from './d380-sws'
import type { AssignmentStageId } from './d380-assignment-stages'
import type { PatchHistory, RowPatch } from '@/lib/row-patches'
import { createPatchHistory } from '@/lib/row-patches'

// ============================================================================
// SECTION OVERRIDES
// ============================================================================

export interface SwsSectionOverride {
    /** Hide / skip this section entirely */
    hidden?: boolean
    /** Override the default cycle time (format "H:MM") */
    cycleTimeOverride?: string
    /** Additional notes for this section */
    notes?: string
    /** Custom process steps appended to the template steps */
    additionalSteps?: SwsAdditionalStep[]
}

export interface SwsAdditionalStep {
    id?: string
    text: string
    isKeyPoint: boolean
    requiresCheckOff?: boolean
    requiresVerification?: '1444' | 'nutcert'
}

export interface SwsWorkElementEdit {
    id: string
    text?: string
    isKeyPoint?: boolean
    requiresCheckOff?: boolean
    requiresVerification?: '1444' | 'nutcert'
    deleted?: boolean
}

export interface SwsSectionEdit {
    sectionId: string
    title?: string
    description?: string
    cycleTime?: string
    hidden?: boolean
    workElementsOrder?: string[]
    workElementEdits?: Record<string, SwsWorkElementEdit>
    addedWorkElements?: SwsWorkElementEdit[]
}

export interface SwsExecutionState {
    activeMode: SwsExecutionMode
    sectionStates: SwsSectionState[]
    lastSavedAt?: string
    lastSavedBy?: string
}

export interface SwsPrintOverrideAuditEntry {
    field: string
    value: string
    reason?: string
    updatedAt: string
    updatedBy?: string
}

export interface AssignmentWorkspaceRowState {
    fromChecked: boolean
    toChecked: boolean
    ipvChecked: boolean
    comment: string
}

export interface AssignmentWorkspaceWorkflowState {
    [rowId: string]: Partial<AssignmentWorkspaceRowState>
}

export interface AssignmentWorkspaceColumnVisibility {
    [columnKey: string]: boolean
}

export interface AssignmentWorkspaceColumnOrder {
    [columnKey: string]: number
}

export interface AssignmentWorkspaceBrandingRowEdit {
    wireNo: string
    length?: number
    lengthAdjustment?: number
    excluded?: boolean
    notes?: string
}

export interface AssignmentWorkspaceBrandingEdits {
    [rowId: string]: AssignmentWorkspaceBrandingRowEdit
}

export interface AssignmentWorkspaceRevisionSelection {
    wireListFilename: string | null
    layoutFilename: string | null
}

export interface AssignmentWorkspaceState {
    rowPatches: RowPatch[]
    workflow: AssignmentWorkspaceWorkflowState
    columnVisibility: AssignmentWorkspaceColumnVisibility
    columnOrder: AssignmentWorkspaceColumnOrder
    brandingEdits: AssignmentWorkspaceBrandingEdits
    revisionSelection: AssignmentWorkspaceRevisionSelection
    patchHistory: PatchHistory
}

// ============================================================================
// COMPONENT CONFIGURATION
// ============================================================================

export interface AssignmentComponentConfig {
    /** Device ID in the wire list, e.g. "KA0561" */
    deviceId: string
    /** Part number override (catalog or manual) */
    partNumber?: string
    /** Link to catalog record */
    catalogRecordId?: string
    /** Custom notes shown to the assembler */
    customNotes?: string
    /** Reference image path override */
    referenceImagePath?: string
}

// ============================================================================
// EXPORT REVIEW STATE
// ============================================================================

export type ExportReviewStatus = 'pending' | 'approved' | 'rejected' | 'revised'

export interface ExportReviewEntry {
    /** What was reviewed */
    exportType: 'wire_list' | 'branding_list'
    /** Review status */
    status: ExportReviewStatus
    /** Who reviewed */
    reviewedBy: string
    /** ISO timestamp */
    reviewedAt: string
    /** Optional rejection reason or comment */
    comment?: string
}

// ============================================================================
// ASSIGNMENT SWS CONFIG
// ============================================================================

export type SwsReviewStatus = 'pending' | 'reviewed' | 'finalized'

export interface AssignmentSwsConfig {
    /** Which SWS template is assigned */
    templateId: SwsTemplateId
    /** Whether the template was manually overridden vs auto-detected */
    isManualOverride: boolean
    /** Override reason (required when manual) */
    overrideReason?: string

    /** Per-section customizations keyed by section id */
    sectionOverrides: Record<string, SwsSectionOverride>
    /** Ordered section IDs rendered in worksheet */
    sectionOrder?: string[]
    /** Structured section/work-element edits for builder mode */
    sectionEdits?: Record<string, SwsSectionEdit>
    /** Top-level work element edit registry */
    workElementEdits?: Record<string, SwsWorkElementEdit>
    /** Pre-configured components for this assignment */
    components: AssignmentComponentConfig[]
    /** Worksheet metadata state merged from assignment+project context */
    worksheetMetadata?: Partial<SwsWorksheetMetadata>
    /** Current print overrides */
    printOverrides?: Record<string, string>
    /** Print override audit trail */
    printOverridesAudit?: SwsPrintOverrideAuditEntry[]
    /** Execution mode state and section completion tracking */
    executionState?: SwsExecutionState
    /** Assignment-scoped workspace state for wire list, branding, and revision tooling */
    workspaceState?: AssignmentWorkspaceState
    /** Instance version for migration/rebase operations */
    instanceVersion?: number
    /** Preferred operation code for this assignment */
    linkedOperationCode?: string | null
    /** Optional stage-specific operation code defaults */
    defaultOperationCodeByStage?: Partial<Record<AssignmentStageId, string | null>>

    /** Overall SWS review status */
    reviewStatus: SwsReviewStatus
    /** Who reviewed/finalized */
    reviewedBy?: string
    /** ISO timestamp of review */
    reviewedAt?: string

    /** Export review entries for wire list and branding list */
    exportReviews: ExportReviewEntry[]
}

// ============================================================================
// DEFAULTS
// ============================================================================

export function createDefaultAssignmentSwsConfig(
    templateId: SwsTemplateId = 'PANEL_BUILD_WIRE',
): AssignmentSwsConfig {
    return {
        templateId,
        isManualOverride: false,
        sectionOverrides: {},
        sectionOrder: [],
        sectionEdits: {},
        workElementEdits: {},
        components: [],
        worksheetMetadata: {},
        printOverrides: {},
        printOverridesAudit: [],
        executionState: {
            activeMode: 'PRINT_MANUAL',
            sectionStates: [],
        },
        workspaceState: createDefaultAssignmentWorkspaceState(),
        instanceVersion: 1,
        linkedOperationCode: null,
        defaultOperationCodeByStage: {},
        reviewStatus: 'pending',
        exportReviews: [],
    }
}

export function createDefaultAssignmentWorkspaceState(): AssignmentWorkspaceState {
    return {
        rowPatches: [],
        workflow: {},
        columnVisibility: {},
        columnOrder: {},
        brandingEdits: {},
        revisionSelection: {
            wireListFilename: null,
            layoutFilename: null,
        },
        patchHistory: createPatchHistory(),
    }
}
