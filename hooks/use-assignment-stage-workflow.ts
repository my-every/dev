'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  canCompleteStage,
  canStartStage,
  getNextAvailableStage,
} from '@/lib/view-models/d380-assignment-workspace'
import type {
  AssignmentStageWorkflowController,
  AssignmentStageWorkflowState,
  D380AssignmentWorkspaceDataSet,
  D380AssignmentWorkspaceRecord,
} from '@/types/d380-assignment-workspace'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'

function buildInitialWorkflowState(assignment?: D380AssignmentWorkspaceRecord): AssignmentStageWorkflowState {
  if (!assignment) {
    return {
      stages: {} as AssignmentStageWorkflowState['stages'],
      handoffCount: 0,
    }
  }

  const stages = Object.fromEntries(
    assignment.stages.map(stage => [
      stage.id,
      {
        status: stage.initialStatus,
        comment: stage.seedComment ?? '',
        startedAt: stage.startedAt,
        completedAt: stage.completedAt,
        blockedReason: stage.blockedReason,
        checklist: Object.fromEntries(stage.checklist.map(item => [item.id, item.completed])),
      },
    ]),
  ) as AssignmentStageWorkflowState['stages']

  const initialState: AssignmentStageWorkflowState = {
    stages,
    handoffCount: 0,
  }

  initialState.activeStageId = Object.entries(stages).find(([, snapshot]) => snapshot.status === 'IN_PROGRESS')?.[0] as AssignmentStageId | undefined
  initialState.currentActionableStageId = getNextAvailableStage({ assignment, workflowState: initialState })

  return initialState
}

export function useAssignmentStageWorkflow({
  projectId,
  sheetName,
  dataSet,
}: {
  projectId: string
  sheetName: string
  dataSet?: D380AssignmentWorkspaceDataSet
}): AssignmentStageWorkflowController {
  const assignment = useMemo(
    () => dataSet?.assignments.find(candidate => candidate.projectId === projectId && candidate.sheetName === sheetName),
    [projectId, sheetName, dataSet],
  )

  const [workflowState, setWorkflowState] = useState<AssignmentStageWorkflowState>(() => buildInitialWorkflowState(assignment))

  useEffect(() => {
    setWorkflowState(buildInitialWorkflowState(assignment))
  }, [assignment?.id])

  function syncDerivedState(nextState: AssignmentStageWorkflowState, currentAssignment?: D380AssignmentWorkspaceRecord) {
    if (!currentAssignment) {
      return nextState
    }

    return {
      ...nextState,
      activeStageId: (Object.entries(nextState.stages).find(([, snapshot]) => snapshot.status === 'IN_PROGRESS')?.[0] as AssignmentStageId | undefined),
      currentActionableStageId: getNextAvailableStage({ assignment: currentAssignment, workflowState: nextState }),
    }
  }

  function startStage(stageId: AssignmentStageId) {
    if (!assignment || !canStartStage({ assignment, workflowState, stageId })) {
      return
    }

    setWorkflowState(current => syncDerivedState({
      ...current,
      stages: {
        ...current.stages,
        [stageId]: {
          ...current.stages[stageId],
          status: 'IN_PROGRESS',
          startedAt: current.stages[stageId].startedAt ?? new Date().toISOString(),
          blockedReason: undefined,
        },
      },
    }, assignment))
  }

  function resumeStage(stageId: AssignmentStageId) {
    startStage(stageId)
  }

  function completeStage(stageId: AssignmentStageId) {
    if (!assignment || !canCompleteStage({ assignment, workflowState, stageId })) {
      return
    }

    setWorkflowState(current => syncDerivedState({
      ...current,
      stages: {
        ...current.stages,
        [stageId]: {
          ...current.stages[stageId],
          status: 'COMPLETE',
          completedAt: new Date().toISOString(),
          blockedReason: undefined,
        },
      },
    }, assignment))
  }

  function setStageComment(stageId: AssignmentStageId, comment: string) {
    setWorkflowState(current => ({
      ...current,
      stages: {
        ...current.stages,
        [stageId]: {
          ...current.stages[stageId],
          comment,
        },
      },
    }))
  }

  function toggleChecklistItem(stageId: AssignmentStageId, checklistItemId: string) {
    setWorkflowState(current => ({
      ...current,
      stages: {
        ...current.stages,
        [stageId]: {
          ...current.stages[stageId],
          checklist: {
            ...current.stages[stageId].checklist,
            [checklistItemId]: !current.stages[stageId].checklist[checklistItemId],
          },
        },
      },
    }))
  }

  function toggleStageBlocked(stageId: AssignmentStageId) {
    if (!assignment) {
      return
    }

    setWorkflowState(current => {
      const currentSnapshot = current.stages[stageId]
      const nextSnapshot = currentSnapshot.status === 'BLOCKED'
        ? {
          ...currentSnapshot,
          status: currentSnapshot.previousStatus ?? 'NOT_STARTED',
          blockedReason: undefined,
          previousStatus: undefined,
        }
        : {
          ...currentSnapshot,
          previousStatus: currentSnapshot.status === 'BLOCKED' ? undefined : currentSnapshot.status,
          status: 'BLOCKED',
          blockedReason: currentSnapshot.blockedReason ?? 'Blocked locally in the mock stage workflow.',
        }

      return syncDerivedState({
        ...current,
        stages: {
          ...current.stages,
          [stageId]: nextSnapshot,
        },
      }, assignment)
    })
  }

  function simulateShiftHandoff() {
    if (!assignment) {
      return
    }

    setWorkflowState(current => syncDerivedState({
      ...current,
      handoffCount: current.handoffCount + 1,
      lastHandoffAt: new Date().toISOString(),
      lastHandoffShift: current.lastHandoffShift === '1st' ? '2nd' : '1st',
    }, assignment))
  }

  return {
    assignment,
    workflowState,
    startStage,
    resumeStage,
    completeStage,
    setStageComment,
    toggleChecklistItem,
    toggleStageBlocked,
    simulateShiftHandoff,
  }
}
