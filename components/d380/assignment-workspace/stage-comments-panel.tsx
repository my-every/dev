import { Textarea } from '@/components/ui/textarea'

export function StageCommentsPanel({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <div className="space-y-3">
      <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/42">Stage comments</div>
      <Textarea
        value={value}
        onChange={event => onChange(event.target.value)}
        disabled={disabled}
        className="min-h-28 rounded-[22px] border-border bg-background"
        placeholder="Log notes, handoff context, or stage observations..."
      />
      <div className="text-xs text-foreground/46">Comments stay local to this workflow hook and are ready to become persisted state later.</div>
    </div>
  )
}
