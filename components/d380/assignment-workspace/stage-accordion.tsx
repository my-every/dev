'use client'

import { Accordion } from '@/components/ui/accordion'
import { StageAccordionItem } from '@/components/d380/assignment-workspace/stage-accordion-item'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { AssignmentWorkspaceStageViewModel } from '@/types/d380-assignment-workspace'

export function StageAccordion({
  stages,
  openStageId,
  onOpenStageChange,
  onStartStage,
  onResumeStage,
  onCompleteStage,
  onToggleStageBlocked,
  onToggleChecklistItem,
  onCommentChange,
}: {
  stages: AssignmentWorkspaceStageViewModel[]
  openStageId?: AssignmentStageId
  onOpenStageChange: (value?: AssignmentStageId) => void
  onStartStage: (stageId: AssignmentStageId) => void
  onResumeStage: (stageId: AssignmentStageId) => void
  onCompleteStage: (stageId: AssignmentStageId) => void
  onToggleStageBlocked: (stageId: AssignmentStageId) => void
  onToggleChecklistItem: (stageId: AssignmentStageId, checklistItemId: string) => void
  onCommentChange: (stageId: AssignmentStageId, value: string) => void
}) {
  return (
    <Accordion type="single" collapsible value={openStageId} onValueChange={value => onOpenStageChange(value as AssignmentStageId | undefined)} className="space-y-4">
      {stages.map(stage => (
        <StageAccordionItem
          key={stage.id}
          stage={stage}
          onStart={() => onStartStage(stage.id)}
          onResume={() => onResumeStage(stage.id)}
          onComplete={() => onCompleteStage(stage.id)}
          onToggleBlocked={() => onToggleStageBlocked(stage.id)}
          onToggleChecklistItem={checklistItemId => onToggleChecklistItem(stage.id, checklistItemId)}
          onCommentChange={value => onCommentChange(stage.id, value)}
        />
      ))}
    </Accordion>
  )
}