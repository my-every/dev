'use client'

import { useState, useCallback, useMemo } from 'react'
import type { SwsTemplateId, SwsAutoDetectResult, SwsSelectionRecord } from '@/types/d380-sws'
import { autoDetectSwsType, type SwsDetectionContext } from '@/lib/sws/sws-auto-detect'

interface UseSwsSelectionOptions {
  projectId: string
  assignmentId?: string
  drawingTitle?: string
  panelIdentifier?: string
  enclosureType?: 'BOX' | 'CONSOLE'
  hasDoors?: boolean
  hasSideRails?: boolean
  isDigitalPanel?: boolean
  isBlankPanel?: boolean
}

interface UseSwsSelectionReturn {
  /** Auto-detected SWS type result */
  autoDetectResult: SwsAutoDetectResult
  /** Currently selected SWS type */
  selectedType: SwsTemplateId
  /** Whether the selection differs from auto-detected */
  isOverride: boolean
  /** Override reason if applicable */
  overrideReason: string | undefined
  /** Select an SWS type (optionally with override reason) */
  selectSwsType: (type: SwsTemplateId, reason?: string) => void
  /** Reset to auto-detected type */
  resetToAutoDetected: () => void
  /** Get the full selection record for saving */
  getSelectionRecord: () => SwsSelectionRecord
  /** Whether the picker dialog is open */
  isPickerOpen: boolean
  /** Open the picker dialog */
  openPicker: () => void
  /** Close the picker dialog */
  closePicker: () => void
}

/**
 * Hook for managing SWS type selection during assignment creation.
 * Handles auto-detection, Team Lead override, and selection state.
 */
export function useSwsSelection(options: UseSwsSelectionOptions): UseSwsSelectionReturn {
  const {
    projectId,
    assignmentId,
    drawingTitle,
    panelIdentifier,
    enclosureType,
    hasDoors,
    hasSideRails,
    isDigitalPanel,
    isBlankPanel,
  } = options

  // Build detection context
  const detectionContext: SwsDetectionContext = useMemo(() => ({
    drawingTitle,
    swsPacketTitle: undefined,
    panelIdentifier,
    enclosureType,
    hasDoors,
    hasSideRails,
    isDigitalPanel,
    isBlankPanel,
  }), [drawingTitle, panelIdentifier, enclosureType, hasDoors, hasSideRails, isDigitalPanel, isBlankPanel])

  // Auto-detect SWS type
  const autoDetectResult = useMemo(
    () => autoDetectSwsType(detectionContext),
    [detectionContext]
  )

  // Selection state
  const [selectedType, setSelectedType] = useState<SwsTemplateId>(autoDetectResult.detectedType)
  const [overrideReason, setOverrideReason] = useState<string | undefined>(undefined)
  const [isPickerOpen, setIsPickerOpen] = useState(false)

  // Computed values
  const isOverride = selectedType !== autoDetectResult.detectedType

  // Handlers
  const selectSwsType = useCallback((type: SwsTemplateId, reason?: string) => {
    setSelectedType(type)
    if (type !== autoDetectResult.detectedType) {
      setOverrideReason(reason)
    } else {
      setOverrideReason(undefined)
    }
  }, [autoDetectResult.detectedType])

  const resetToAutoDetected = useCallback(() => {
    setSelectedType(autoDetectResult.detectedType)
    setOverrideReason(undefined)
  }, [autoDetectResult.detectedType])

  const openPicker = useCallback(() => {
    setIsPickerOpen(true)
  }, [])

  const closePicker = useCallback(() => {
    setIsPickerOpen(false)
  }, [])

  const getSelectionRecord = useCallback((): SwsSelectionRecord => ({
    projectId,
    assignmentId: assignmentId ?? '',
    detectedType: autoDetectResult.detectedType,
    selectedType,
    isOverride,
    overrideReason,
    detectionConfidence: autoDetectResult.confidence,
    detectionReasons: autoDetectResult.reasons,
    selectedAt: new Date().toISOString(),
    selectedBy: '', // Would be filled by auth context
  }), [projectId, assignmentId, autoDetectResult, selectedType, isOverride, overrideReason])

  return {
    autoDetectResult,
    selectedType,
    isOverride,
    overrideReason,
    selectSwsType,
    resetToAutoDetected,
    getSelectionRecord,
    isPickerOpen,
    openPicker,
    closePicker,
  }
}
