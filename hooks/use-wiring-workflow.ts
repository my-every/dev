'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  buildWiringProgressSummary,
  canCompleteWiringSection,
  canStartWiringSection,
  getNextActionableWiringSection,
} from '@/lib/view-models/d380-wiring'
import type {
  D380WiringDataSet,
  D380WiringRecord,
  WiringProgressSummaryViewModel,
  WiringSectionId,
  WiringWorkflowController,
  WiringWorkflowState,
} from '@/types/d380-wiring'

function buildInitialWorkflowState(wiring?: D380WiringRecord): WiringWorkflowState {
  if (!wiring) {
    return {
      sections: {} as WiringWorkflowState['sections'],
    }
  }

  const sections = Object.fromEntries(
    wiring.sections.map(section => [
      section.id,
      {
        status: section.initialStatus,
        comments: section.seedComments ?? [],
        startedAt: section.startedAt,
        completedAt: section.completedAt,
        blockedReason: section.blockedReason,
        checklist: Object.fromEntries(section.checklist.map(item => [item.id, item.checked])),
      },
    ]),
  ) as WiringWorkflowState['sections']

  const initialState: WiringWorkflowState = { sections }
  initialState.activeSectionId = Object.entries(sections).find(([, snapshot]) => snapshot.status === 'IN_PROGRESS')?.[0] as WiringSectionId | undefined
  initialState.currentActionableSectionId = getNextActionableWiringSection({ wiring, workflowState: initialState })

  return initialState
}

function syncDerivedState(nextState: WiringWorkflowState, wiring?: D380WiringRecord): WiringWorkflowState {
  if (!wiring) {
    return nextState
  }

  return {
    ...nextState,
    activeSectionId: (Object.entries(nextState.sections).find(([, snapshot]) => snapshot.status === 'IN_PROGRESS')?.[0] as WiringSectionId | undefined),
    currentActionableSectionId: getNextActionableWiringSection({ wiring, workflowState: nextState }),
  }
}

export function useWiringWorkflow({ projectId, dataSet }: { projectId: string; dataSet?: D380WiringDataSet }): WiringWorkflowController {
  const wiring = useMemo(
    () => dataSet?.projects.find(candidate => candidate.projectId === projectId),
    [projectId, dataSet],
  )

  const [workflowState, setWorkflowState] = useState<WiringWorkflowState>(() => buildInitialWorkflowState(wiring))

  useEffect(() => {
    setWorkflowState(buildInitialWorkflowState(wiring))
  }, [wiring?.id])

  function startSection(sectionId: WiringSectionId) {
    setWorkflowState(current => {
      if (!wiring || !canStartWiringSection({ wiring, workflowState: current, sectionId })) {
        return current
      }

      return syncDerivedState({
        ...current,
        sections: {
          ...current.sections,
          [sectionId]: {
            ...current.sections[sectionId],
            status: 'IN_PROGRESS',
            startedAt: current.sections[sectionId].startedAt ?? new Date().toISOString(),
            blockedReason: undefined,
          },
        },
      }, wiring)
    })
  }

  function resumeSection(sectionId: WiringSectionId) {
    startSection(sectionId)
  }

  function completeSection(sectionId: WiringSectionId) {
    setWorkflowState(current => {
      if (!wiring || !canCompleteWiringSection({ wiring, workflowState: current, sectionId })) {
        return current
      }

      return syncDerivedState({
        ...current,
        sections: {
          ...current.sections,
          [sectionId]: {
            ...current.sections[sectionId],
            status: 'COMPLETE',
            completedAt: new Date().toISOString(),
            blockedReason: undefined,
          },
        },
      }, wiring)
    })
  }

  function blockSection(sectionId: WiringSectionId, reason: string) {
    setWorkflowState(current => {
      const currentSnapshot = current.sections[sectionId]
      if (!wiring || !currentSnapshot || currentSnapshot.status === 'COMPLETE') {
        return current
      }

      const nextSnapshot = currentSnapshot.status === 'BLOCKED'
        ? {
            ...currentSnapshot,
            status: currentSnapshot.previousStatus ?? 'NOT_STARTED',
            blockedReason: undefined,
            previousStatus: undefined,
          }
        : {
            ...currentSnapshot,
            previousStatus: currentSnapshot.status,
            status: 'BLOCKED',
            blockedReason: reason.trim() || currentSnapshot.blockedReason || 'Blocked locally in the wiring workflow.',
          }

      return syncDerivedState({
        ...current,
        sections: {
          ...current.sections,
          [sectionId]: nextSnapshot,
        },
      }, wiring)
    })
  }

  function setSectionComment(sectionId: WiringSectionId, value: string) {
    setWorkflowState(current => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionId]: {
          ...current.sections[sectionId],
          comments: value.trim() ? [value.trim()] : [],
        },
      },
    }))
  }

  function toggleChecklistItem(sectionId: WiringSectionId, itemId: string) {
    setWorkflowState(current => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionId]: {
          ...current.sections[sectionId],
          checklist: {
            ...current.sections[sectionId].checklist,
            [itemId]: !current.sections[sectionId].checklist[itemId],
          },
        },
      },
    }))
  }

  function getCompletionProgress(): WiringProgressSummaryViewModel | null {
    if (!wiring) {
      return null
    }

    return buildWiringProgressSummary({ wiring, workflowState })
  }

  return {
    wiring,
    workflowState,
    startSection,
    resumeSection,
    completeSection,
    blockSection,
    setSectionComment,
    toggleChecklistItem,
    getCompletionProgress,
  }
}
