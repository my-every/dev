import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { AssignmentWorkspacePlaceholderPanelViewModel } from '@/types/d380-assignment-workspace'

export function AssignmentPlaceholderPanel({ panel }: { panel: AssignmentWorkspacePlaceholderPanelViewModel }) {
  return (
    <Card className="rounded-[28px] border border-border/70 bg-card/84 py-0 shadow-[0_14px_50px_rgba(0,0,0,0.08)] backdrop-blur-sm">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">{panel.eyebrow}</div>
        <div>
          <h3 className="text-xl font-semibold text-foreground">{panel.title}</h3>
          <p className="mt-2 text-sm leading-6 text-foreground/62">{panel.description}</p>
        </div>
        <Button variant="outline" className="w-full rounded-2xl bg-muted/40 text-foreground/72">
          {panel.actionLabel}
        </Button>
      </CardContent>
    </Card>
  )
}