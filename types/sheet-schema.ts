/**
 * Sheet Schema — Self-contained per-sheet data file
 *
 * Each operational sheet gets its own `sheets/{slug}.json` file containing
 * the wire list rows, assignment state, layout match, and metadata.
 * This replaces the monolithic sheetData embedded in project-context.json.
 */

import type { SheetUnitBinding } from '@/lib/project-units/types'
import type { SemanticWireListRow, SheetMetadataInfo, ProjectSheetKind, ParsedSheetRow } from '@/lib/workbook/types'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'

// ── Assignment state slice ────────────────────────────────────────────────

export interface SheetAssignmentState {
    swsType: string
    stage: AssignmentStageId
    status: 'NOT_STARTED' | 'IN_PROGRESS' | 'INCOMPLETE' | 'COMPLETE'
    isOverride: boolean
    overrideReason: string
    detectedSwsType: string
    detectedConfidence: number
    detectedReasons: string[]
    requiresWireSws: boolean
    requiresCrossWireSws: boolean
}

// ── Layout match slice ────────────────────────────────────────────────────

export interface SheetLayoutMatch {
    pageNumber: number
    pageTitle: string
    panelNumber?: string
    confidence: 'high' | 'medium' | 'low'
}

// ── The schema itself ─────────────────────────────────────────────────────

export interface SheetSchema {
    /** URL-safe slug (filename stem) */
    slug: string
    /** Display name */
    name: string
    /** Sheet classification */
    kind: ProjectSheetKind
    /** Original sheet index in workbook */
    sheetIndex: number

    // ── Column structure ─────────────────────────────────────────────────
    headers: string[]

    // ── Wire list data ───────────────────────────────────────────────────
    rows: SemanticWireListRow[]
    /** Raw parsed rows (used for reference sheets and fallback rendering) */
    rawRows?: ParsedSheetRow[]
    rowCount: number

    // ── Metadata from intro rows ─────────────────────────────────────────
    metadata?: SheetMetadataInfo

    // ── Assignment state ─────────────────────────────────────────────────
    assignment: SheetAssignmentState

    // ── Layout match result ──────────────────────────────────────────────
    layoutMatch?: SheetLayoutMatch

    // ── Unit-first orchestration binding ────────────────────────────────
    unitBinding?: SheetUnitBinding

    // ── Diagnostics ──────────────────────────────────────────────────────
    warnings: string[]

    // ── Generation timestamp ─────────────────────────────────────────────
    generatedAt: string
}
