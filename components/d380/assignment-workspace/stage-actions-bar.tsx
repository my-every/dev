import { AlertTriangle, CheckCircle2, PlayCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { AssignmentWorkspaceStageViewModel } from '@/types/d380-assignment-workspace'

export function StageActionsBar({
  stage,
  onStart,
  onResume,
  onComplete,
  onToggleBlocked,
}: {
  stage: AssignmentWorkspaceStageViewModel
  onStart: () => void
  onResume: () => void
  onComplete: () => void
  onToggleBlocked: () => void
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {stage.status === 'IN_PROGRESS' ? (
        <Button className="rounded-full" onClick={onResume}>
          <PlayCircle className="size-4" />
          Resume stage
        </Button>
      ) : (
        <Button className="rounded-full" disabled={!stage.canStart} onClick={onStart}>
          <PlayCircle className="size-4" />
          Start stage
        </Button>
      )}

      <Button variant="outline" className="rounded-full" disabled={!stage.canComplete} onClick={onComplete}>
        <CheckCircle2 className="size-4" />
        Complete stage
      </Button>

      <Button variant="outline" className="rounded-full" onClick={onToggleBlocked}>
        <AlertTriangle className="size-4" />
        {stage.status === 'BLOCKED' ? 'Unblock stage' : 'Block stage'}
      </Button>
    </div>
  )
}