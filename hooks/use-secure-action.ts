'use client'

import { useState, useCallback } from 'react'
import { useAppRuntime } from '@/components/providers/app-runtime-provider'
import { getSessionService } from '@/lib/services/session-service-registry'
import type {
  SecureActionType,
  SecureActionContext,
  SecureActionResult,
  TimestampEvent,
} from '@/types/d380-user-session'
import { useSession } from './use-session'

// ============================================================================
// Types
// ============================================================================

interface UseSecureActionOptions {
  /** Action type */
  action: SecureActionType
  /** Assignment ID (if applicable) */
  assignmentId?: string
  /** Work area ID (if applicable) */
  workAreaId?: string
  /** Target member badge (if applicable) */
  targetBadge?: string
  /** Additional metadata */
  metadata?: Record<string, unknown>
  /** Callback on success */
  onSuccess?: (result: SecureActionResult) => void
  /** Callback on error */
  onError?: (error: string) => void
  /** Skip auth if already authenticated for same action */
  skipAuthIfRecent?: boolean
}

interface UseSecureActionReturn {
  /** Execute the secure action (opens modal if needed) */
  execute: () => void
  /** Execute with credentials */
  executeWithCredentials: (badge: string, pin: string) => Promise<SecureActionResult>
  /** Is the modal open */
  isModalOpen: boolean
  /** Open the modal */
  openModal: () => void
  /** Close the modal */
  closeModal: () => void
  /** Is executing */
  isExecuting: boolean
  /** Error message */
  error: string | null
  /** Clear error */
  clearError: () => void
  /** Last result */
  lastResult: SecureActionResult | null
  /** Last timestamp event */
  lastTimestampEvent: TimestampEvent | null
  /** Can perform this action (permission check) */
  canPerform: boolean
}

// ============================================================================
// Hook
// ============================================================================

export function useSecureAction(options: UseSecureActionOptions): UseSecureActionReturn {
  const { dataMode, appMode } = useAppRuntime()
  const { session, canPerform: checkCanPerform } = useSession()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<SecureActionResult | null>(null)
  const [lastTimestampEvent, setLastTimestampEvent] = useState<TimestampEvent | null>(null)

  const canPerform = checkCanPerform(options.action)

  const openModal = useCallback(() => {
    setError(null)
    setIsModalOpen(true)
  }, [])

  const closeModal = useCallback(() => {
    setIsModalOpen(false)
    setError(null)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const executeWithCredentials = useCallback(async (badge: string, pin: string): Promise<SecureActionResult> => {
    setIsExecuting(true)
    setError(null)

    try {
      const context: SecureActionContext = {
        action: options.action,
        assignmentId: options.assignmentId,
        workAreaId: options.workAreaId,
        targetBadge: options.targetBadge,
        metadata: options.metadata,
      }

      if (appMode === 'STANDALONE_TOOL') {
        const standaloneResult: SecureActionResult = { success: true }
        setLastResult(standaloneResult)
        setIsModalOpen(false)
        options.onSuccess?.(standaloneResult)
        return standaloneResult
      }

      const sessionService = await getSessionService(dataMode)
      const result = await sessionService.executeSecureAction({ badge, pin, context })
      
      if (result.data) {
        setLastResult(result.data)
        if (result.data.timestampEvent) {
          setLastTimestampEvent(result.data.timestampEvent)
        }

        if (result.data.success) {
          setIsModalOpen(false)
          options.onSuccess?.(result.data)
        } else {
          setError(result.data.error || 'Action failed')
          options.onError?.(result.data.error || 'Action failed')
        }

        return result.data
      }

      const fallbackResult: SecureActionResult = { success: false, error: 'Unknown error' }
      setError('Unknown error')
      return fallbackResult
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Action failed'
      setError(errorMessage)
      options.onError?.(errorMessage)
      return { success: false, error: errorMessage }
    } finally {
      setIsExecuting(false)
    }
  }, [appMode, dataMode, options])

  const execute = useCallback(() => {
    if (appMode === 'STANDALONE_TOOL') {
      const activeBadge = session?.badge ?? '0000'
      void executeWithCredentials(activeBadge, '')
      return
    }

    // If already authenticated and action allows, execute directly
    if (session && options.skipAuthIfRecent && canPerform) {
      executeWithCredentials(session.badge, '') // Service should accept empty PIN for refresh
      return
    }
    // Otherwise, open modal for credentials
    openModal()
  }, [appMode, session, options.skipAuthIfRecent, canPerform, executeWithCredentials, openModal])

  return {
    execute,
    executeWithCredentials,
    isModalOpen,
    openModal,
    closeModal,
    isExecuting,
    error,
    clearError,
    lastResult,
    lastTimestampEvent,
    canPerform,
  }
}

// ============================================================================
// Convenience Hooks
// ============================================================================

export function useStartAssignment(assignmentId: string, workAreaId?: string) {
  return useSecureAction({
    action: 'START_ASSIGNMENT',
    assignmentId,
    workAreaId,
  })
}

export function usePauseAssignment(assignmentId: string) {
  return useSecureAction({
    action: 'PAUSE_ASSIGNMENT',
    assignmentId,
  })
}

export function useResumeAssignment(assignmentId: string) {
  return useSecureAction({
    action: 'RESUME_ASSIGNMENT',
    assignmentId,
  })
}

export function useCompleteAssignment(assignmentId: string) {
  return useSecureAction({
    action: 'COMPLETE_ASSIGNMENT',
    assignmentId,
  })
}

export function useHandoffAssignment(assignmentId: string, targetBadge: string) {
  return useSecureAction({
    action: 'HANDOFF_ASSIGNMENT',
    assignmentId,
    targetBadge,
  })
}

export function useVerifyStage(assignmentId: string) {
  return useSecureAction({
    action: 'VERIFY_STAGE',
    assignmentId,
  })
}

export function useApproveStage(assignmentId: string) {
  return useSecureAction({
    action: 'APPROVE_STAGE',
    assignmentId,
  })
}

export function useAssignMember(assignmentId: string, workAreaId: string, targetBadge: string) {
  return useSecureAction({
    action: 'ASSIGN_MEMBER',
    assignmentId,
    workAreaId,
    targetBadge,
  })
}
