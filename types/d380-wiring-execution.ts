/**
 * Wiring Execution Types
 *
 * Data model for interactive, section-by-section wiring execution.
 * Mirrors the BuildUpExecution pattern but adapted for wire list sections
 * with from/to column completion tracking and time comparison.
 */

import type { IdentificationFilterKind } from "@/lib/wiring-identification/types";

// ============================================================================
// Core Enums / Unions
// ============================================================================

export type WiringColumnSide = "from" | "to";

export type WiringSectionStatus = "locked" | "active" | "completed";

export type WiringSessionStatus = "idle" | "in-progress" | "completed" | "paused";

// ============================================================================
// Row-Level Tracking
// ============================================================================

export interface WireRowCompletion {
    rowId: string;
    fromDeviceId: string;
    toDeviceId: string;
    wireId: string;
    /** Device group key (e.g. "HL0171") for single-connection subsection grouping */
    deviceGroup?: string;
    fromCompletedAt: string | null;
    toCompletedAt: string | null;
    fromCompletedBy: string | null;
    toCompletedBy: string | null;
}

// ============================================================================
// Section-Level Tracking
// ============================================================================

export interface WiringSectionExecution {
    sectionId: string;
    locationKey: string;
    location: string;
    sectionLabel: string;
    sectionKind?: IdentificationFilterKind;
    status: WiringSectionStatus;
    startedAt: string | null;
    completedAt: string | null;
    completedBy: string | null;
    estimatedMinutes: number;
    actualMinutes: number | null;
    totalRows: number;
    completedRows: number;
    rows: WireRowCompletion[];
}

// ============================================================================
// Session-Level Tracking
// ============================================================================

export interface WiringExecutionSession {
    id: string;
    projectId: string;
    sheetName: string;
    sheetSlug: string;
    swsType: string;
    badge: string;
    shift: string;
    status: WiringSessionStatus;
    startedAt: string;
    completedAt: string | null;
    pausedAt: string | null;
    sections: WiringSectionExecution[];
    activeSectionIndex: number;
    totalEstimatedMinutes: number;
    totalActualMinutes: number | null;
}

// ============================================================================
// Summary / Report Types
// ============================================================================

export interface SectionExecutionSummary {
    sectionId: string;
    sectionLabel: string;
    location: string;
    estimatedMinutes: number;
    actualMinutes: number | null;
    variance: number | null;
    variancePercent: number | null;
    totalRows: number;
    completedRows: number;
    status: WiringSectionStatus;
}

export interface WiringExecutionReport {
    sessionId: string;
    projectId: string;
    sheetName: string;
    badge: string;
    shift: string;
    startedAt: string;
    completedAt: string;
    totalEstimatedMinutes: number;
    totalActualMinutes: number;
    totalVariance: number;
    totalVariancePercent: number;
    sections: SectionExecutionSummary[];
}
