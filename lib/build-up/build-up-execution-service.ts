/**
 * Build Up Execution Service
 * 
 * Manages Build Up execution sessions including:
 * - Session creation and resume
 * - Section/step completion tracking
 * - Member and shift tracking
 * - State persistence (localStorage for now)
 * - Auto-progression triggers
 */

import type {
  BuildUpExecutionSession,
  BuildUpSectionExecution,
  BuildUpStepExecution,
  BuildUpMemberRecord,
  BuildUpSessionStatus,
  BuildUpSectionStatus,
  WorkShift,
} from '@/types/d380-build-up-execution'
import {
  createExecutionSession,
  isSessionComplete,
  calculateSessionProgress,
  getNextIncompleteSection,
} from '@/types/d380-build-up-execution'

// ============================================================================
// STORAGE KEYS
// ============================================================================

const BUILD_UP_SESSIONS_PREFIX = 'wirelist_buildup_sessions_'

/**
 * Get storage key for a project's build-up sessions.
 */
function getStorageKey(projectId: string): string {
  return `${BUILD_UP_SESSIONS_PREFIX}${projectId}`
}

// ============================================================================
// SESSION STORAGE
// ============================================================================

/**
 * Load all Build Up sessions for a project.
 */
export function loadProjectSessions(projectId: string): Record<string, BuildUpExecutionSession> {
  if (typeof window === 'undefined') return {}
  
  try {
    const stored = localStorage.getItem(getStorageKey(projectId))
    if (!stored) return {}
    return JSON.parse(stored)
  } catch (err) {
    console.error('Failed to load build-up sessions:', err)
    return {}
  }
}

/**
 * Save all Build Up sessions for a project.
 */
export function saveProjectSessions(
  projectId: string,
  sessions: Record<string, BuildUpExecutionSession>
): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(getStorageKey(projectId), JSON.stringify(sessions))
  } catch (err) {
    console.error('Failed to save build-up sessions:', err)
  }
}

/**
 * Get a specific session for an assignment.
 */
export function getSession(
  projectId: string,
  assignmentId: string
): BuildUpExecutionSession | undefined {
  const sessions = loadProjectSessions(projectId)
  return sessions[assignmentId]
}

/**
 * Save a session (creates or updates).
 */
export function saveSession(session: BuildUpExecutionSession): void {
  const sessions = loadProjectSessions(session.projectId)
  sessions[session.assignmentId] = session
  saveProjectSessions(session.projectId, sessions)
}

/**
 * Delete a session.
 */
export function deleteSession(projectId: string, assignmentId: string): void {
  const sessions = loadProjectSessions(projectId)
  delete sessions[assignmentId]
  saveProjectSessions(projectId, sessions)
}

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

/**
 * Start a new Build Up session for an assignment.
 */
export function startNewSession(
  assignmentId: string,
  projectId: string,
  swsType: string,
  startedBy: { badgeId: string; name: string }
): BuildUpExecutionSession {
  // Check for existing session
  const existing = getSession(projectId, assignmentId)
  if (existing && existing.status !== 'completed') {
    throw new Error('An active session already exists for this assignment')
  }
  
  // Create new session
  const session = createExecutionSession(assignmentId, projectId, swsType, startedBy)
  saveSession(session)
  
  return session
}

/**
 * Resume an existing session (updates last activity).
 */
export function resumeSession(
  projectId: string,
  assignmentId: string
): BuildUpExecutionSession | undefined {
  const session = getSession(projectId, assignmentId)
  if (!session) return undefined
  
  // Update last activity
  session.lastActivityAt = new Date().toISOString()
  saveSession(session)
  
  return session
}

// ============================================================================
// SECTION MANAGEMENT
// ============================================================================

/**
 * Start a section (add member, set status).
 */
export function startSection(
  session: BuildUpExecutionSession,
  sectionId: string,
  member: { badgeId: string; name: string; shift: WorkShift }
): BuildUpExecutionSession {
  const section = session.sections.find(s => s.id === sectionId)
  if (!section) throw new Error(`Section not found: ${sectionId}`)
  
  const now = new Date().toISOString()
  
  // Close any previous active member in this section
  for (const m of section.members) {
    if (!m.endedAt) {
      m.endedAt = now
    }
  }
  
  // Add new member record
  section.members.push({
    badgeId: member.badgeId,
    name: member.name,
    shift: member.shift,
    startedAt: now,
  })
  
  // Update section status
  if (section.status === 'pending') {
    section.status = 'in_progress'
    section.startedAt = now
  }
  
  // Update session
  session.currentSectionId = sectionId
  session.lastActivityAt = now
  session.lastMember = member
  
  saveSession(session)
  return session
}

/**
 * Complete a step within a section.
 */
export function completeStep(
  session: BuildUpExecutionSession,
  sectionId: string,
  stepId: string,
  completedBy: { badgeId: string; name: string }
): BuildUpExecutionSession {
  const section = session.sections.find(s => s.id === sectionId)
  if (!section) throw new Error(`Section not found: ${sectionId}`)
  
  const step = section.steps.find(s => s.id === stepId)
  if (!step) throw new Error(`Step not found: ${stepId}`)
  
  const now = new Date().toISOString()
  
  step.completed = true
  step.completedAt = now
  step.completedBy = completedBy
  
  session.lastActivityAt = now
  
  // Check if section is complete
  const allStepsComplete = section.steps.every(s => s.completed)
  if (allStepsComplete) {
    section.status = 'completed'
    section.completedAt = now
    
    // Close active member
    for (const m of section.members) {
      if (!m.endedAt) {
        m.endedAt = now
      }
    }
    
    // Move to next section
    const nextSection = getNextIncompleteSection(session)
    session.currentSectionId = nextSection?.id
  }
  
  // Check if session is complete
  if (isSessionComplete(session)) {
    session.status = 'completed'
    session.completedAt = now
  }
  
  saveSession(session)
  return session
}

/**
 * Uncomplete a step (toggle back).
 */
export function uncompleteStep(
  session: BuildUpExecutionSession,
  sectionId: string,
  stepId: string
): BuildUpExecutionSession {
  const section = session.sections.find(s => s.id === sectionId)
  if (!section) throw new Error(`Section not found: ${sectionId}`)
  
  const step = section.steps.find(s => s.id === stepId)
  if (!step) throw new Error(`Step not found: ${stepId}`)
  
  step.completed = false
  step.completedAt = undefined
  step.completedBy = undefined
  
  // Reset section status if it was completed
  if (section.status === 'completed') {
    section.status = 'in_progress'
    section.completedAt = undefined
  }
  
  // Reset session status if it was completed
  if (session.status === 'completed') {
    session.status = 'in_progress'
    session.completedAt = undefined
  }
  
  session.lastActivityAt = new Date().toISOString()
  
  saveSession(session)
  return session
}

/**
 * Add a note to a section.
 */
export function addSectionNote(
  session: BuildUpExecutionSession,
  sectionId: string,
  note: string
): BuildUpExecutionSession {
  const section = session.sections.find(s => s.id === sectionId)
  if (!section) throw new Error(`Section not found: ${sectionId}`)
  
  section.notes = note
  session.lastActivityAt = new Date().toISOString()
  
  saveSession(session)
  return session
}

// ============================================================================
// MEMBER TRACKING
// ============================================================================

/**
 * Switch active member for a section.
 */
export function switchMember(
  session: BuildUpExecutionSession,
  sectionId: string,
  newMember: { badgeId: string; name: string; shift: WorkShift }
): BuildUpExecutionSession {
  const section = session.sections.find(s => s.id === sectionId)
  if (!section) throw new Error(`Section not found: ${sectionId}`)
  
  const now = new Date().toISOString()
  
  // Close previous active member
  for (const m of section.members) {
    if (!m.endedAt) {
      m.endedAt = now
    }
  }
  
  // Add new member
  section.members.push({
    badgeId: newMember.badgeId,
    name: newMember.name,
    shift: newMember.shift,
    startedAt: now,
  })
  
  session.lastActivityAt = now
  session.lastMember = newMember
  
  saveSession(session)
  return session
}

/**
 * Get the current active member for a section.
 */
export function getActiveMember(
  section: BuildUpSectionExecution
): BuildUpMemberRecord | undefined {
  return section.members.find(m => !m.endedAt)
}

// ============================================================================
// PROGRESS & STATUS
// ============================================================================

/**
 * Get session progress information.
 */
export function getSessionProgress(session: BuildUpExecutionSession): {
  percentage: number
  completedSections: number
  totalSections: number
  completedSteps: number
  totalSteps: number
  currentSection?: BuildUpSectionExecution
} {
  const totalSections = session.sections.length
  const completedSections = session.sections.filter(s => s.status === 'completed').length
  const totalSteps = session.sections.reduce((sum, s) => sum + s.steps.length, 0)
  const completedSteps = session.sections.reduce(
    (sum, s) => sum + s.steps.filter(step => step.completed).length,
    0
  )
  const currentSection = session.sections.find(s => s.id === session.currentSectionId)
  
  return {
    percentage: calculateSessionProgress(session),
    completedSections,
    totalSections,
    completedSteps,
    totalSteps,
    currentSection,
  }
}

/**
 * Get section progress information.
 */
export function getSectionProgress(section: BuildUpSectionExecution): {
  percentage: number
  completedSteps: number
  totalSteps: number
} {
  const totalSteps = section.steps.length
  const completedSteps = section.steps.filter(s => s.completed).length
  
  return {
    percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
    completedSteps,
    totalSteps,
  }
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all in-progress sessions for a project.
 */
export function getInProgressSessions(projectId: string): BuildUpExecutionSession[] {
  const sessions = loadProjectSessions(projectId)
  return Object.values(sessions).filter(s => s.status === 'in_progress')
}

/**
 * Get all completed sessions for a project.
 */
export function getCompletedSessions(projectId: string): BuildUpExecutionSession[] {
  const sessions = loadProjectSessions(projectId)
  return Object.values(sessions).filter(s => s.status === 'completed')
}

/**
 * Check if an assignment has an active session.
 */
export function hasActiveSession(projectId: string, assignmentId: string): boolean {
  const session = getSession(projectId, assignmentId)
  return session?.status === 'in_progress'
}

/**
 * Get time elapsed since session started.
 */
export function getSessionDuration(session: BuildUpExecutionSession): number {
  const startTime = new Date(session.startedAt).getTime()
  const endTime = session.completedAt 
    ? new Date(session.completedAt).getTime()
    : Date.now()
  
  return Math.round((endTime - startTime) / 1000 / 60) // minutes
}

/**
 * Get time elapsed since last activity.
 */
export function getIdleTime(session: BuildUpExecutionSession): number {
  const lastActivity = new Date(session.lastActivityAt).getTime()
  return Math.round((Date.now() - lastActivity) / 1000 / 60) // minutes
}
