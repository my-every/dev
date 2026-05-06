'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import type { AssignmentSwsConfig, ExportReviewEntry, SwsReviewStatus } from '@/types/d380-assignment-sws'
import { createDefaultAssignmentSwsConfig } from '@/types/d380-assignment-sws'
import { saveSwsConfig, loadSwsConfig } from '@/lib/persistence/project-storage'

// ---------------------------------------------------------------------------
// Options / Result interfaces
// ---------------------------------------------------------------------------

export interface UseAssignmentSwsConfigOptions {
    projectId: string
    sheetSlug: string
    /** Auto-load on mount (default: true) */
    autoLoad?: boolean
}

export interface UseAssignmentSwsConfigResult {
    config: AssignmentSwsConfig
    isLoading: boolean
    isDirty: boolean
    error: Error | null

    /** Override a section (show/hide, notes, cycleTimeOverride, additionalSteps). */
    setSectionOverride: (
        sectionId: string,
        override: Partial<AssignmentSwsConfig['sectionOverrides'][string]>,
    ) => void
    /** Set the SWS templateId. */
    setTemplateId: (templateId: string) => void
    /** Mark the config as manually overridden. */
    setManualOverride: (value: boolean) => void
    /** Set overall review status. */
    setReviewStatus: (status: SwsReviewStatus) => void

    /** Add or update an export review (wire_list or branding_list). */
    upsertExportReview: (review: ExportReviewEntry) => void
    /** Remove an export review by type. */
    removeExportReview: (exportType: ExportReviewEntry['exportType']) => void

    /** Persist current config to server. */
    save: () => Promise<boolean>
    /** Reload from server (discards unsaved changes). */
    reload: () => Promise<void>
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAssignmentSwsConfig(
    options: UseAssignmentSwsConfigOptions,
): UseAssignmentSwsConfigResult {
    const { projectId, sheetSlug, autoLoad = true } = options

    const [config, setConfig] = useState<AssignmentSwsConfig>(
        createDefaultAssignmentSwsConfig(),
    )
    const [savedSnapshot, setSavedSnapshot] = useState<string>('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<Error | null>(null)

    const isDirty = useMemo(
        () => JSON.stringify(config) !== savedSnapshot,
        [config, savedSnapshot],
    )

    // --- Load ---
    const reload = useCallback(async () => {
        if (!projectId || !sheetSlug) return
        setIsLoading(true)
        setError(null)
        try {
            const remote = await loadSwsConfig(projectId, sheetSlug)
            const value = remote ?? createDefaultAssignmentSwsConfig()
            setConfig(value)
            setSavedSnapshot(JSON.stringify(value))
        } catch (e) {
            setError(e instanceof Error ? e : new Error(String(e)))
        } finally {
            setIsLoading(false)
        }
    }, [projectId, sheetSlug])

    // --- Save ---
    const save = useCallback(async () => {
        if (!projectId || !sheetSlug) return false
        const ok = await saveSwsConfig(projectId, sheetSlug, config)
        if (ok) {
            setSavedSnapshot(JSON.stringify(config))
        }
        return ok
    }, [projectId, sheetSlug, config])

    // --- Mutators ---
    const setTemplateId = useCallback((templateId: string) => {
        setConfig((prev) => ({ ...prev, templateId } as AssignmentSwsConfig))
    }, [])

    const setManualOverride = useCallback((value: boolean) => {
        setConfig((prev) => ({
            ...prev,
            isManualOverride: value,
        }))
    }, [])

    const setReviewStatus = useCallback((status: SwsReviewStatus) => {
        setConfig((prev) => ({ ...prev, reviewStatus: status }))
    }, [])

    const setSectionOverride = useCallback(
        (
            sectionId: string,
            override: Partial<AssignmentSwsConfig['sectionOverrides'][string]>,
        ) => {
            setConfig((prev) => ({
                ...prev,
                sectionOverrides: {
                    ...prev.sectionOverrides,
                    [sectionId]: {
                        ...(prev.sectionOverrides[sectionId] ?? {}),
                        ...override,
                    },
                },
            }))
        },
        [],
    )

    const upsertExportReview = useCallback((review: ExportReviewEntry) => {
        setConfig((prev) => {
            const others = prev.exportReviews.filter(
                (r) => r.exportType !== review.exportType,
            )
            return { ...prev, exportReviews: [...others, review] }
        })
    }, [])

    const removeExportReview = useCallback(
        (exportType: ExportReviewEntry['exportType']) => {
            setConfig((prev) => ({
                ...prev,
                exportReviews: prev.exportReviews.filter(
                    (r) => r.exportType !== exportType,
                ),
            }))
        },
        [],
    )

    // --- Auto-load ---
    useEffect(() => {
        if (autoLoad) {
            reload()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, sheetSlug])

    return useMemo(
        () => ({
            config,
            isLoading,
            isDirty,
            error,
            setSectionOverride,
            setTemplateId,
            setManualOverride,
            setReviewStatus,
            upsertExportReview,
            removeExportReview,
            save,
            reload,
        }),
        [
            config,
            isLoading,
            isDirty,
            error,
            setSectionOverride,
            setTemplateId,
            setManualOverride,
            setReviewStatus,
            upsertExportReview,
            removeExportReview,
            save,
            reload,
        ],
    )
}
