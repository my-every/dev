/**
 * Stage State Service Contract
 * 
 * Manages stage-level state and transitions.
 * Tracks stage completion, checklists, and handoffs.
 */

import type { ServiceResult } from './index'
import type { AssignmentStage } from './assignment-state-service'

export interface StageState {
  /** Assignment ID */
  assignmentId: string
  /** Stage ID */
  stage: AssignmentStage
  /** Stage display label */
  stageLabel: string
  /** Progress percentage */
  progressPercent: number
  /** Started timestamp */
  startedAt: string | null
  /** Completed timestamp */
  completedAt: string | null
  /** Assigned member badges */
  assignedMemberBadges: string[]
  /** Checklist items */
  checklistItems: StageChecklistItem[]
  /** Stage comments/notes */
  comments: StageComment[]
  /** Verification results (for IPV stages) */
  verificationResults: VerificationResult[]
  /** Handoff notes from prior shift */
  handoffNotes: string | null
  /** Data mode indicator */
  dataMode: 'mock' | 'share' | 'electron'
}

export interface StageChecklistItem {
  id: string
  label: string
  description: string
  required: boolean
  completed: boolean
  completedBy: string | null
  completedAt: string | null
}

export interface StageComment {
  id: string
  authorBadge: string
  authorName: string
  text: string
  createdAt: string
  category: 'note' | 'issue' | 'handoff' | 'resolution'
}

export interface VerificationResult {
  checkId: string
  checkLabel: string
  result: 'pass' | 'fail' | 'na'
  notes: string | null
  verifiedBy: string
  verifiedAt: string
}

export interface StageTransitionRequest {
  assignmentId: string
  fromStage: AssignmentStage
  toStage: AssignmentStage
  handoffNotes?: string
  skipChecklist?: boolean
}

export interface IStageStateService {
  /**
   * Get stage state for an assignment.
   */
  getStageState(assignmentId: string, stage: AssignmentStage): Promise<ServiceResult<StageState | null>>

  /**
   * Get all stage states for an assignment.
   */
  getAllStageStates(assignmentId: string): Promise<ServiceResult<StageState[]>>

  /**
   * Get checklist template for a stage.
   */
  getChecklistTemplate(stage: AssignmentStage): Promise<ServiceResult<StageChecklistItem[]>>

  /**
   * Update checklist item completion.
   */
  updateChecklistItem(
    assignmentId: string,
    stage: AssignmentStage,
    itemId: string,
    completed: boolean,
    completedBy: string
  ): Promise<ServiceResult<StageState>>

  /**
   * Add comment to a stage.
   */
  addComment(
    assignmentId: string,
    stage: AssignmentStage,
    comment: Omit<StageComment, 'id' | 'createdAt'>
  ): Promise<ServiceResult<StageComment>>

  /**
   * Add verification result (for IPV stages).
   */
  addVerificationResult(
    assignmentId: string,
    stage: AssignmentStage,
    result: Omit<VerificationResult, 'verifiedAt'>
  ): Promise<ServiceResult<StageState>>

  /**
   * Request stage transition.
   */
  requestTransition(request: StageTransitionRequest): Promise<ServiceResult<{
    allowed: boolean
    blockers: string[]
  }>>

  /**
   * Complete stage and advance.
   */
  completeStage(
    assignmentId: string,
    stage: AssignmentStage,
    completedBy: string,
    handoffNotes?: string
  ): Promise<ServiceResult<StageState>>

  /**
   * Reject stage (for IPV stages).
   */
  rejectStage(
    assignmentId: string,
    stage: AssignmentStage,
    rejectedBy: string,
    reason: string
  ): Promise<ServiceResult<StageState>>
}
