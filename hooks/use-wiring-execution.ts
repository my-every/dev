"use client";

/**
 * useWiringExecution Hook
 *
 * Manages the interactive wiring execution session state.
 * Handles row-by-row from/to completion, section advancement,
 * time tracking, and server persistence with effect triggers.
 */

import { useState, useCallback, useMemo, useRef } from "react";
import type { PrintLocationGroup } from "@/lib/wire-list-print/model";
import type { PrintSettings } from "@/lib/wire-list-print/defaults";
import type {
    WiringExecutionSession,
    WiringSectionExecution,
    WiringColumnSide,
    SectionExecutionSummary,
    WiringExecutionReport,
} from "@/types/d380-wiring-execution";
import { buildWiringExecutionSession } from "@/lib/wiring-execution/session-builder";

// ============================================================================
// Types
// ============================================================================

export interface UseWiringExecutionOptions {
    projectId: string;
    sheetSlug: string;
    sheetName: string;
    swsType: string;
    badge: string;
    shift: string;
    locationGroups: PrintLocationGroup[];
    settings: PrintSettings;
}

export interface UseWiringExecutionReturn {
    // State
    session: WiringExecutionSession | null;
    activeSection: WiringSectionExecution | null;
    activeSectionIndex: number;
    isStarted: boolean;
    isComplete: boolean;
    isPaused: boolean;
    isSaving: boolean;
    isLoading: boolean;
    error: string | null;

    // Progress
    progress: { completed: number; total: number; percent: number };
    sectionProgress: { completed: number; total: number; percent: number };
    canAdvance: boolean;
    elapsedSeconds: number;

    // Summary
    sectionSummaries: SectionExecutionSummary[];
    report: WiringExecutionReport | null;

    // Actions
    startSession: () => void;
    resumeSession: () => Promise<void>;
    pauseSession: () => void;
    toggleRowColumn: (rowId: string, side: WiringColumnSide) => void;
    completeActiveSection: () => Promise<void>;
    resetSession: () => void;
}

// ============================================================================
// Hook
// ============================================================================

export function useWiringExecution(options: UseWiringExecutionOptions): UseWiringExecutionReturn {
    const { projectId, sheetSlug, sheetName, swsType, badge, shift, locationGroups, settings } = options;

    const [session, setSession] = useState<WiringExecutionSession | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Timer management ────────────────────────────────────────────────

    const startTimer = useCallback(() => {
        if (timerRef.current) return;
        timerRef.current = setInterval(() => {
            setElapsedSeconds(prev => prev + 1);
        }, 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }, []);

    // ── Persistence ─────────────────────────────────────────────────────

    const persistSession = useCallback(async (
        updatedSession: WiringExecutionSession,
        trigger?: "section-complete" | "session-complete",
    ) => {
        setIsSaving(true);
        try {
            await fetch(`/api/projects/${projectId}/wiring-execution`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ session: updatedSession, trigger }),
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to save");
        } finally {
            setIsSaving(false);
        }
    }, [projectId]);

    // ── Actions ─────────────────────────────────────────────────────────

    const startSession = useCallback(() => {
        const newSession = buildWiringExecutionSession({
            projectId,
            sheetName,
            sheetSlug,
            swsType,
            badge,
            shift,
            locationGroups,
            settings,
        });

        // Start timing the first section
        if (newSession.sections.length > 0) {
            newSession.status = "in-progress";
            newSession.sections[0].status = "active";
            newSession.sections[0].startedAt = new Date().toISOString();
        }

        setSession(newSession);
        setElapsedSeconds(0);
        setError(null);
        startTimer();
        persistSession(newSession);
    }, [projectId, sheetName, sheetSlug, swsType, badge, shift, locationGroups, settings, startTimer, persistSession]);

    const resumeSession = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/projects/${projectId}/wiring-execution?sheet=${encodeURIComponent(sheetSlug)}`,
            );
            if (!res.ok) {
                if (res.status === 404) {
                    setError(null);
                    setIsLoading(false);
                    return;
                }
                throw new Error("Failed to load session");
            }
            const loaded: WiringExecutionSession = await res.json();
            setSession(loaded);

            // Calculate elapsed time from active section
            const activeSection = loaded.sections[loaded.activeSectionIndex];
            if (activeSection?.startedAt && loaded.status === "in-progress") {
                const elapsed = Math.floor((Date.now() - new Date(activeSection.startedAt).getTime()) / 1000);
                setElapsedSeconds(elapsed);
                startTimer();
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load");
        } finally {
            setIsLoading(false);
        }
    }, [projectId, sheetSlug, startTimer]);

    const pauseSession = useCallback(() => {
        if (!session) return;
        stopTimer();
        const updated: WiringExecutionSession = {
            ...session,
            status: "paused",
            pausedAt: new Date().toISOString(),
        };
        setSession(updated);
        persistSession(updated);
    }, [session, stopTimer, persistSession]);

    const toggleRowColumn = useCallback((rowId: string, side: WiringColumnSide) => {
        if (!session) return;

        const sectionIndex = session.activeSectionIndex;
        const section = session.sections[sectionIndex];
        if (!section || section.status !== "active") return;

        const now = new Date().toISOString();
        const updatedRows = section.rows.map(row => {
            if (row.rowId !== rowId) return row;
            if (side === "from") {
                return {
                    ...row,
                    fromCompletedAt: row.fromCompletedAt ? null : now,
                    fromCompletedBy: row.fromCompletedAt ? null : badge,
                };
            } else {
                return {
                    ...row,
                    toCompletedAt: row.toCompletedAt ? null : now,
                    toCompletedBy: row.toCompletedAt ? null : badge,
                };
            }
        });

        const completedRows = updatedRows.filter(r => r.fromCompletedAt && r.toCompletedAt).length;

        const updatedSections = [...session.sections];
        updatedSections[sectionIndex] = {
            ...section,
            rows: updatedRows,
            completedRows,
        };

        const updated: WiringExecutionSession = {
            ...session,
            sections: updatedSections,
        };
        setSession(updated);
    }, [session, badge]);

    const completeActiveSection = useCallback(async () => {
        if (!session) return;

        const sectionIndex = session.activeSectionIndex;
        const section = session.sections[sectionIndex];
        if (!section) return;

        stopTimer();
        const now = new Date().toISOString();
        const startTime = section.startedAt ? new Date(section.startedAt).getTime() : Date.now();
        const actualMinutes = Math.round((Date.now() - startTime) / 60000);

        const updatedSections = [...session.sections];
        updatedSections[sectionIndex] = {
            ...section,
            status: "completed",
            completedAt: now,
            completedBy: badge,
            actualMinutes,
        };

        const isLastSection = sectionIndex >= session.sections.length - 1;

        // Unlock next section
        if (!isLastSection && updatedSections[sectionIndex + 1]) {
            updatedSections[sectionIndex + 1] = {
                ...updatedSections[sectionIndex + 1],
                status: "active",
                startedAt: now,
            };
        }

        const totalActual = isLastSection
            ? updatedSections.reduce((sum, s) => sum + (s.actualMinutes ?? 0), 0)
            : null;

        const updated: WiringExecutionSession = {
            ...session,
            sections: updatedSections,
            activeSectionIndex: isLastSection ? sectionIndex : sectionIndex + 1,
            status: isLastSection ? "completed" : "in-progress",
            completedAt: isLastSection ? now : null,
            totalActualMinutes: totalActual,
        };

        setSession(updated);
        setElapsedSeconds(0);

        if (!isLastSection) {
            startTimer();
        }

        // Persist and trigger effects
        await persistSession(updated, isLastSection ? "session-complete" : "section-complete");
    }, [session, badge, stopTimer, startTimer, persistSession]);

    const resetSession = useCallback(() => {
        stopTimer();
        setSession(null);
        setElapsedSeconds(0);
        setError(null);
    }, [stopTimer]);

    // ── Derived state ───────────────────────────────────────────────────

    const activeSection = session?.sections[session.activeSectionIndex] ?? null;

    const isStarted = session?.status === "in-progress" || session?.status === "paused";
    const isComplete = session?.status === "completed";
    const isPaused = session?.status === "paused";

    const progress = useMemo(() => {
        if (!session) return { completed: 0, total: 0, percent: 0 };
        const total = session.sections.length;
        const completed = session.sections.filter(s => s.status === "completed").length;
        return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }, [session]);

    const sectionProgress = useMemo(() => {
        if (!activeSection) return { completed: 0, total: 0, percent: 0 };
        const total = activeSection.totalRows;
        const completed = activeSection.completedRows;
        return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }, [activeSection]);

    const canAdvance = useMemo(() => {
        if (!activeSection) return false;
        return activeSection.rows.every(r => r.fromCompletedAt && r.toCompletedAt);
    }, [activeSection]);

    const sectionSummaries = useMemo((): SectionExecutionSummary[] => {
        if (!session) return [];
        return session.sections.map(s => {
            const variance = s.actualMinutes != null ? s.actualMinutes - s.estimatedMinutes : null;
            const variancePercent = s.actualMinutes != null && s.estimatedMinutes > 0
                ? Math.round(((s.actualMinutes - s.estimatedMinutes) / s.estimatedMinutes) * 100)
                : null;
            return {
                sectionId: s.sectionId,
                sectionLabel: s.sectionLabel,
                location: s.location,
                estimatedMinutes: s.estimatedMinutes,
                actualMinutes: s.actualMinutes,
                variance,
                variancePercent,
                totalRows: s.totalRows,
                completedRows: s.completedRows,
                status: s.status,
            };
        });
    }, [session]);

    const report = useMemo((): WiringExecutionReport | null => {
        if (!session || session.status !== "completed") return null;
        const totalActual = session.totalActualMinutes ?? 0;
        const totalVariance = totalActual - session.totalEstimatedMinutes;
        const totalVariancePercent = session.totalEstimatedMinutes > 0
            ? Math.round((totalVariance / session.totalEstimatedMinutes) * 100)
            : 0;
        return {
            sessionId: session.id,
            projectId: session.projectId,
            sheetName: session.sheetName,
            badge: session.badge,
            shift: session.shift,
            startedAt: session.startedAt,
            completedAt: session.completedAt ?? new Date().toISOString(),
            totalEstimatedMinutes: session.totalEstimatedMinutes,
            totalActualMinutes: totalActual,
            totalVariance,
            totalVariancePercent,
            sections: sectionSummaries,
        };
    }, [session, sectionSummaries]);

    return {
        session,
        activeSection,
        activeSectionIndex: session?.activeSectionIndex ?? 0,
        isStarted,
        isComplete,
        isPaused,
        isSaving,
        isLoading,
        error,
        progress,
        sectionProgress,
        canAdvance,
        elapsedSeconds,
        sectionSummaries,
        report,
        startSession,
        resumeSession,
        pauseSession,
        toggleRowColumn,
        completeActiveSection,
        resetSession,
    };
}
