import { AssignmentProgressSummary } from '@/components/d380/assignment-workspace/assignment-progress-summary'
import { StageAccordion } from '@/components/d380/assignment-workspace/stage-accordion'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { AssignmentWorkspaceStagesViewModel } from '@/types/d380-assignment-workspace'

export function AssignmentStagesTab({
  stagesView,
  openStageId,
  onOpenStageChange,
  onStartStage,
  onResumeStage,
  onCompleteStage,
  onToggleStageBlocked,
  onToggleChecklistItem,
  onCommentChange,
}: {
  stagesView: AssignmentWorkspaceStagesViewModel
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
    <section className="space-y-6">
      <AssignmentProgressSummary summary={stagesView.progressSummary} />
      <StageAccordion
        stages={stagesView.stages}
        openStageId={openStageId}
        onOpenStageChange={onOpenStageChange}
        onStartStage={onStartStage}
        onResumeStage={onResumeStage}
        onCompleteStage={onCompleteStage}
        onToggleStageBlocked={onToggleStageBlocked}
        onToggleChecklistItem={onToggleChecklistItem}
        onCommentChange={onCommentChange}
      />
    </section>
  )
}