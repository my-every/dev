import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import type { ProjectWorkspaceProgressViewModel } from '@/types/d380-project-workspace'

export function ProjectProgressPanel({ progress }: { progress: ProjectWorkspaceProgressViewModel }) {
  return (
    <section className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
      <Card className="rounded-[32px] border border-border/70 bg-card py-0">
        <CardContent className="space-y-6 px-6 py-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Completion summary</div>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">Overall project progress and stage distribution.</h2>
          </div>
          <div className="space-y-3 rounded-[28px] bg-accent/35 px-5 py-5">
            <div className="flex items-center justify-between text-sm text-foreground/62">
              <span>{progress.completionLabel}</span>
              <span>{progress.completionPercent}%</span>
            </div>
            <Progress value={progress.completionPercent} className="h-3 bg-muted [&_[data-slot=progress-indicator]]:bg-primary" />
          </div>
          <div className="space-y-4">
            {progress.stageDistribution.map(stage => (
              <div key={stage.label} className="space-y-2">
                <div className="flex items-center justify-between text-sm text-foreground/62">
                  <span>{stage.label}</span>
                  <span>{stage.count} · {stage.percent}%</span>
                </div>
                <Progress value={stage.percent} className="h-2 bg-muted [&_[data-slot=progress-indicator]]:bg-primary" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        <Card className="rounded-[32px] border border-border/70 bg-card py-0">
          <CardContent className="space-y-4 px-6 py-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Assignment breakdown</div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Current status mix.</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {progress.assignmentBreakdown.map(item => (
                <div key={item.label} className="rounded-2xl bg-muted/50 px-4 py-4 text-foreground">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/42">{item.label}</div>
                  <div className="mt-2 text-2xl font-semibold">{item.count}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[32px] border border-border/70 bg-card py-0">
          <CardContent className="space-y-4 px-6 py-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Timeline / blockers</div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Phase progression and delayed work signals.</h2>
            </div>
            <div className="space-y-3">
              {progress.timeline.map(item => (
                <div key={item.label} className="flex items-center justify-between rounded-2xl bg-muted/50 px-4 py-3 text-sm text-foreground/62">
                  <span>{item.label}</span>
                  <span className="uppercase tracking-[0.18em]">{item.status}</span>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              {progress.blockers.length > 0 ? progress.blockers.map(blocker => (
                <div key={blocker} className="rounded-2xl bg-red-500/8 px-4 py-3 text-sm leading-6 text-red-700">{blocker}</div>
              )) : <div className="rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">No blockers are currently staged for this project context.</div>}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}