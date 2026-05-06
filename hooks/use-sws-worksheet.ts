'use client'

import { useState, useCallback, useMemo } from 'react'
import type {
  SwsTemplateId,
  SwsExecutionMode,
  SwsTemplateDefinition,
  SwsWorksheetContext,
  SwsWorksheetOverrideState,
  SwsTabletSectionActivity,
  SwsSectionStamp,
  SwsDiscrepancyEntry,
} from '@/types/d380-sws'
import { SWS_TEMPLATE_REGISTRY } from '@/lib/sws/sws-template-registry'

interface UseSwsWorksheetOptions {
  swsType: SwsTemplateId
  mode: SwsExecutionMode
  context: SwsWorksheetContext
  initialOverrides?: SwsWorksheetOverrideState
}

interface UseSwsWorksheetReturn {
  /** The SWS template definition */
  template: SwsTemplateDefinition
  /** Current execution mode */
  mode: SwsExecutionMode
  /** Worksheet context with project/assignment data */
  context: SwsWorksheetContext
  /** Current override state (for print mode) */
  overrides: SwsWorksheetOverrideState
  /** Update override values */
  setOverrides: (overrides: SwsWorksheetOverrideState) => void
  /** Section activity map (for tablet mode) */
  sectionActivity: Map<string, SwsTabletSectionActivity>
  /** Start a section */
  startSection: (sectionId: string, badge: string) => void
  /** Complete a section */
  completeSection: (sectionId: string, badge: string) => void
  /** Add a discrepancy */
  addDiscrepancy: (entry: Omit<SwsDiscrepancyEntry, 'timestamp'>) => void
  /** Remove a discrepancy */
  removeDiscrepancy: (index: number) => void
  /** All recorded discrepancies */
  discrepancies: SwsDiscrepancyEntry[]
  /** Print the worksheet */
  print: () => void
  /** Overall completion percentage */
  completionPercent: number
  /** Whether all sections are complete */
  isComplete: boolean
}

/**
 * Hook for managing SWS worksheet state in both print and tablet modes.
 * Handles section activity, timestamps, discrepancies, and overrides.
 */
export function useSwsWorksheet(options: UseSwsWorksheetOptions): UseSwsWorksheetReturn {
  const { swsType, mode, context, initialOverrides = {} } = options

  // Get template
  const template = SWS_TEMPLATE_REGISTRY[swsType]

  // Override state (for print mode)
  const [overrides, setOverrides] = useState<SwsWorksheetOverrideState>(initialOverrides)

  // Section activity state (for tablet mode)
  const [sectionActivity, setSectionActivity] = useState<Map<string, SwsTabletSectionActivity>>(
    () => new Map()
  )

  // Discrepancies
  const [discrepancies, setDiscrepancies] = useState<SwsDiscrepancyEntry[]>([])

  // Start a section
  const startSection = useCallback((sectionId: string, badge: string) => {
    setSectionActivity(prev => {
      const next = new Map(prev)
      const existing = next.get(sectionId)

      if (!existing || existing.status === 'PENDING') {
        const stamp: SwsSectionStamp = {
          badge,
          timestamp: new Date().toISOString(),
          action: 'START',
        }

        next.set(sectionId, {
          sectionId,
          status: 'IN_PROGRESS',
          startedAt: stamp.timestamp,
          stamps: [stamp],
          activeBadges: [badge],
        })
      }

      return next
    })
  }, [])

  // Complete a section
  const completeSection = useCallback((sectionId: string, badge: string) => {
    setSectionActivity(prev => {
      const next = new Map(prev)
      const existing = next.get(sectionId)

      if (existing && existing.status === 'IN_PROGRESS') {
        const stamp: SwsSectionStamp = {
          badge,
          timestamp: new Date().toISOString(),
          action: 'COMPLETE',
        }

        next.set(sectionId, {
          ...existing,
          status: 'COMPLETE',
          completedAt: stamp.timestamp,
          stamps: [...(existing.stamps ?? []), stamp],
          activeBadges: [],
        })
      }

      return next
    })
  }, [])

  // Add discrepancy
  const addDiscrepancy = useCallback((entry: Omit<SwsDiscrepancyEntry, 'timestamp'>) => {
    setDiscrepancies(prev => [
      ...prev,
      { ...entry, timestamp: new Date().toISOString() },
    ])
  }, [])

  // Remove discrepancy
  const removeDiscrepancy = useCallback((index: number) => {
    setDiscrepancies(prev => prev.filter((_, i) => i !== index))
  }, [])

  // Print worksheet
  const print = useCallback(() => {
    window.print()
  }, [])

  // Computed values
  const completionPercent = useMemo(() => {
    const totalSections = template.sections.length
    if (totalSections === 0) return 0

    const completedSections = Array.from(sectionActivity.values()).filter(
      a => a.status === 'COMPLETE'
    ).length

    return Math.round((completedSections / totalSections) * 100)
  }, [template.sections.length, sectionActivity])

  const isComplete = useMemo(() => {
    return completionPercent === 100 && template.sections.length > 0
  }, [completionPercent, template.sections.length])

  return {
    template,
    mode,
    context,
    overrides,
    setOverrides,
    sectionActivity,
    startSection,
    completeSection,
    addDiscrepancy,
    removeDiscrepancy,
    discrepancies,
    print,
    completionPercent,
    isComplete,
  }
}
