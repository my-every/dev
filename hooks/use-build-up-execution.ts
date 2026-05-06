'use client'

/**
 * useBuildUpExecution Hook
 * 
 * Manages Build Up execution session state with:
 * - Session creation, resume, and persistence
 * - Section and step completion tracking
 * - Member/shift management
 * - Auto-progression trigger on completion
 */

import { useState, useCallback, useEffect, useMemo } from 'react'
import type {
  BuildUpExecutionSession,
  BuildUpSectionExecution,
  WorkShift,
} from '@/types/d380-build-up-execution'
import {
  getSession,
  startNewSession,
  resumeSession,
  startSection,
  completeStep,
  uncompleteStep,
  switchMember,
  getSessionProgress,
  getSectionProgress,
  getActiveMember,
  saveSession,
} from '@/lib/build-up/build-up-execution-service'

// ============================================================================
// TYPES
// ============================================================================

export interface BuildUpExecutionState {
  session: BuildUpExecutionSession | null
  isLoading: boolean
  error: string | null
  progress: {
    percentage: number
    completedSections: number
    totalSections: number
    completedSteps: number
    totalSteps: number
    currentSection?: BuildUpSectionExecution
  }
}

export interface BuildUpExecutionActions {
  startSession: (
    swsType: string,
    member: { badgeId: string; name: string }
  ) => void
  resumeExistingSession: () => void
  startSectionExecution: (
    sectionId: string,
    member: { badgeId: string; name: string; shift: WorkShift }
  ) => void
  toggleStep: (
    sectionId: string,
    stepId: string,
    completedBy: { badgeId: string; name: string }
  ) => void
  switchActiveMember: (
    sectionId: string,
    newMember: { badgeId: string; name: string; shift: WorkShift }
  ) => void
  getSection: (sectionId: string) => BuildUpSectionExecution | undefined
  getSectionProgressInfo: (section: BuildUpSectionExecution) => {
    percentage: number
    completedSteps: number
    totalSteps: number
  }
  getActiveMemberForSection: (section: BuildUpSectionExecution) => {
    badgeId: string
    name: string
    shift: WorkShift
    startedAt: string
  } | undefined
}

// ============================================================================
// HOOK
// ============================================================================

export function useBuildUpExecution(
  projectId: string,
  assignmentId: string
): BuildUpExecutionState & BuildUpExecutionActions {
  const [session, setSession] = useState<BuildUpExecutionSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load existing session on mount
  useEffect(() => {
    setIsLoading(true)
    setError(null)
    
    try {
      const existingSession = getSession(projectId, assignmentId)
      setSession(existingSession || null)
    } catch (err) {
      console.error('Failed to load build-up session:', err)
      setError('Failed to load session')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, assignmentId])

  // Calculate progress
  const progress = useMemo(() => {
    if (!session) {
      return {
        percentage: 0,
        completedSections: 0,
        totalSections: 0,
        completedSteps: 0,
        totalSteps: 0,
        currentSection: undefined,
      }
    }
    return getSessionProgress(session)
  }, [session])

  // Start a new session
  const startSessionAction = useCallback(
    (swsType: string, member: { badgeId: string; name: string }) => {
      try {
        const newSession = startNewSession(
          assignmentId,
          projectId,
          swsType,
          member
        )
        setSession(newSession)
        setError(null)
      } catch (err) {
        console.error('Failed to start session:', err)
        setError(err instanceof Error ? err.message : 'Failed to start session')
      }
    },
    [assignmentId, projectId]
  )

  // Resume existing session
  const resumeExistingSession = useCallback(() => {
    try {
      const resumed = resumeSession(projectId, assignmentId)
      if (resumed) {
        setSession(resumed)
        setError(null)
      } else {
        setError('No session to resume')
      }
    } catch (err) {
      console.error('Failed to resume session:', err)
      setError('Failed to resume session')
    }
  }, [projectId, assignmentId])

  // Start section execution with member
  const startSectionExecution = useCallback(
    (
      sectionId: string,
      member: { badgeId: string; name: string; shift: WorkShift }
    ) => {
      if (!session) return
      
      try {
        const updated = startSection(session, sectionId, member)
        setSession({ ...updated })
        setError(null)
      } catch (err) {
        console.error('Failed to start section:', err)
        setError('Failed to start section')
      }
    },
    [session]
  )

  // Toggle step completion
  const toggleStep = useCallback(
    (
      sectionId: string,
      stepId: string,
      completedBy: { badgeId: string; name: string }
    ) => {
      if (!session) return
      
      try {
        const section = session.sections.find(s => s.id === sectionId)
        if (!section) return
        
        const step = section.steps.find(s => s.id === stepId)
        if (!step) return
        
        let updated: BuildUpExecutionSession
        if (step.completed) {
          updated = uncompleteStep(session, sectionId, stepId)
        } else {
          updated = completeStep(session, sectionId, stepId, completedBy)
        }
        
        setSession({ ...updated })
        setError(null)
      } catch (err) {
        console.error('Failed to toggle step:', err)
        setError('Failed to update step')
      }
    },
    [session]
  )

  // Switch active member
  const switchActiveMemberAction = useCallback(
    (
      sectionId: string,
      newMember: { badgeId: string; name: string; shift: WorkShift }
    ) => {
      if (!session) return
      
      try {
        const updated = switchMember(session, sectionId, newMember)
        setSession({ ...updated })
        setError(null)
      } catch (err) {
        console.error('Failed to switch member:', err)
        setError('Failed to switch member')
      }
    },
    [session]
  )

  // Get section by ID
  const getSection = useCallback(
    (sectionId: string) => {
      return session?.sections.find(s => s.id === sectionId)
    },
    [session]
  )

  // Get section progress info
  const getSectionProgressInfo = useCallback(
    (section: BuildUpSectionExecution) => {
      return getSectionProgress(section)
    },
    []
  )

  // Get active member for section
  const getActiveMemberForSection = useCallback(
    (section: BuildUpSectionExecution) => {
      return getActiveMember(section)
    },
    []
  )

  return {
    session,
    isLoading,
    error,
    progress,
    startSession: startSessionAction,
    resumeExistingSession,
    startSectionExecution,
    toggleStep,
    switchActiveMember: switchActiveMemberAction,
    getSection,
    getSectionProgressInfo,
    getActiveMemberForSection,
  }
}
