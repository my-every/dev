import { Checkbox } from '@/components/ui/checkbox'
import type { AssignmentWorkspaceStageChecklistItemViewModel } from '@/types/d380-assignment-workspace'

export function StageChecklist({
  items,
  onToggle,
  disabled,
}: {
  items: AssignmentWorkspaceStageChecklistItemViewModel[]
  onToggle: (checklistItemId: string) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-3">
      {items.length > 0 ? items.map(item => (
        <label key={item.id} className="flex items-start gap-3 rounded-2xl bg-muted/50 px-4 py-3 text-sm text-foreground/62">
          <Checkbox checked={item.completed} disabled={disabled} onCheckedChange={() => onToggle(item.id)} className="mt-0.5" />
          <div>
            <div className="font-medium text-foreground">{item.label}</div>
            <div className="mt-1 text-xs uppercase tracking-[0.18em] text-foreground/42">{item.required ? 'Required' : 'Optional'}</div>
          </div>
        </label>
      )) : <div className="rounded-2xl border border-dashed border-border/80 px-4 py-4 text-sm text-muted-foreground">No checklist items are staged for this step yet.</div>}
    </div>
  )
}