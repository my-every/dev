/**
 * D380 Shared Types
 *
 * Canonical type definitions shared across multiple domain boundaries.
 * These replace former duplicates that existed in separate files.
 */

import type { ProjectModel } from '@/lib/workbook/types'

// ── Unified assignment stage (project-board + workspace) ───────────────────

/**
 * Assignment stage used by both the single-project board and the workspace.
 *
 * NOTE: `ProjectsBoardAssignmentStage` (multi-project board) intentionally
 * differs — it includes 'KIT' and omits 'BOX_BUILD', 'IPV2', 'POWER_CHECK'.
 */
export type ProjectAssignmentStage =
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

// ── Unified assignment status (lowercase family) ───────────────────────────

/**
 * Lowercase assignment status used by the projects-board and workspace.
 *
 * NOTE: `ProjectBoardAssignmentStatus` (single-project board) intentionally
 * differs — it uses uppercase values with 5 members including 'UNASSIGNED'.
 */
export type ProjectAssignmentStatus = 'queued' | 'active' | 'blocked' | 'complete'

// ── Canonical stored project ───────────────────────────────────────────────

/**
 * Stored project shape shared between client-side context and server-side
 * state handlers. Replaces the former `StoredProject` (contexts/) and
 * `StoredProjectRecord` (lib/project-state/).
 */
export interface StoredProject {
    id: string
    name: string
    filename: string
    createdAt: string
    projectModel: ProjectModel
}
