'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  canCompleteBuildUpSection,
  canStartBuildUpSection,
  getNextBuildUpSection,
} from '@/lib/view-models/d380-build-up'
import type {
  BuildUpWorkflowController,
  BuildUpWorkflowSectionId,
  BuildUpWorkflowState,
  D380BuildUpDataSet,
  D380ProjectBuildUpRecord,
} from '@/types/d380-build-up'

function buildInitialWorkflowState(project?: D380ProjectBuildUpRecord): BuildUpWorkflowState {
  if (!project) {
    return {
      sections: {} as BuildUpWorkflowState['sections'],
    }
  }

  const sections = Object.fromEntries(
    project.sections.map(section => [
      section.id,
      {
        status: section.initialStatus,
        comment: section.seedComment ?? '',
        startedAt: section.startedAt,
        completedAt: section.completedAt,
        blockedReason: section.blockedReason,
        progressUpdates: section.progressUpdates ?? [],
        checklist: Object.fromEntries(section.checklist.map(item => [item.id, item.completed])),
      },
    ]),
  ) as BuildUpWorkflowState['sections']

  const initialState: BuildUpWorkflowState = { sections }

  initialState.activeSectionId = Object.entries(sections).find(([, snapshot]) => snapshot.status === 'IN_PROGRESS')?.[0] as BuildUpWorkflowSectionId | undefined
  initialState.currentActionableSectionId = getNextBuildUpSection({ project, workflowState: initialState })

  return initialState
}

function syncDerivedState(nextState: BuildUpWorkflowState, project?: D380ProjectBuildUpRecord): BuildUpWorkflowState {
  if (!project) {
    return nextState
  }

  return {
    ...nextState,
    activeSectionId: (Object.entries(nextState.sections).find(([, snapshot]) => snapshot.status === 'IN_PROGRESS')?.[0] as BuildUpWorkflowSectionId | undefined),
    currentActionableSectionId: getNextBuildUpSection({ project, workflowState: nextState }),
  }
}

function buildTimestampedUpdate(message: string) {
  return `${new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date())} · ${message.trim()}`
}

export function useBuildUpWorkflow({ projectId, dataSet }: { projectId: string; dataSet?: D380BuildUpDataSet }): BuildUpWorkflowController {
  const project = useMemo(
    () => dataSet?.projects.find(candidate => candidate.projectId === projectId),
    [projectId, dataSet],
  )

  const [workflowState, setWorkflowState] = useState<BuildUpWorkflowState>(() => buildInitialWorkflowState(project))

  useEffect(() => {
    setWorkflowState(buildInitialWorkflowState(project))
  }, [project?.id])

  function startSection(sectionId: BuildUpWorkflowSectionId) {
    setWorkflowState(current => {
      if (!project || !canStartBuildUpSection({ project, workflowState: current, sectionId })) {
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
      }, project)
    })
  }

  function resumeSection(sectionId: BuildUpWorkflowSectionId) {
    startSection(sectionId)
  }

  function completeSection(sectionId: BuildUpWorkflowSectionId) {
    setWorkflowState(current => {
      if (!project || !canCompleteBuildUpSection({ project, workflowState: current, sectionId })) {
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
      }, project)
    })
  }

  function setSectionComment(sectionId: BuildUpWorkflowSectionId, comment: string) {
    setWorkflowState(current => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionId]: {
          ...current.sections[sectionId],
          comment,
        },
      },
    }))
  }

  function setSectionBlockedReason(sectionId: BuildUpWorkflowSectionId, reason: string) {
    setWorkflowState(current => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionId]: {
          ...current.sections[sectionId],
          blockedReason: reason,
        },
      },
    }))
  }

  function toggleChecklistItem(sectionId: BuildUpWorkflowSectionId, checklistItemId: string) {
    setWorkflowState(current => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionId]: {
          ...current.sections[sectionId],
          checklist: {
            ...current.sections[sectionId].checklist,
            [checklistItemId]: !current.sections[sectionId].checklist[checklistItemId],
          },
        },
      },
    }))
  }

  function toggleSectionBlocked(sectionId: BuildUpWorkflowSectionId) {
    setWorkflowState(current => {
      if (!project) {
        return current
      }

      const currentSnapshot = current.sections[sectionId]
      if (!currentSnapshot || currentSnapshot.status === 'COMPLETE') {
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
            blockedReason: currentSnapshot.blockedReason ?? 'Blocked locally in the Build Up slice.',
          }

      return syncDerivedState({
        ...current,
        sections: {
          ...current.sections,
          [sectionId]: nextSnapshot,
        },
      }, project)
    })
  }

  function addProgressUpdate(sectionId: BuildUpWorkflowSectionId, update: string) {
    const trimmed = update.trim()
    if (!trimmed) {
      return
    }

    setWorkflowState(current => ({
      ...current,
      sections: {
        ...current.sections,
        [sectionId]: {
          ...current.sections[sectionId],
          progressUpdates: [...current.sections[sectionId].progressUpdates, buildTimestampedUpdate(trimmed)],
        },
      },
    }))
  }

  return {
    project,
    workflowState,
    startSection,
    resumeSection,
    completeSection,
    setSectionComment,
    setSectionBlockedReason,
    toggleChecklistItem,
    toggleSectionBlocked,
    addProgressUpdate,
  }
}
