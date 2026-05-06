import { AssignmentProgressSummary } from '@/components/d380/assignment-workspace/assignment-progress-summary'
import { Card, CardContent } from '@/components/ui/card'
import { ProjectMetricCard } from '@/components/d380/project-workspace/project-metric-card'
import type { AssignmentWorkspaceOverviewViewModel } from '@/types/d380-assignment-workspace'

export function AssignmentOverviewTab({ overview }: { overview: AssignmentWorkspaceOverviewViewModel }) {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overview.metrics.map(metric => <ProjectMetricCard key={metric.id} metric={metric} />)}
      </div>

      <AssignmentProgressSummary summary={overview.progressSummary} />

      <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
        <Card className="rounded-4xl border border-border/70 bg-card py-0">
          <CardContent className="space-y-5 px-6 py-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Assignment summary</div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Members, trainees, and layout match seam.</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[28px] bg-accent/35 px-5 py-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/42">Assigned members</div>
                <div className="mt-3 space-y-2 text-sm text-foreground/62">
                  {overview.assignedMembers.map(member => <div key={member.id}>{member.name} · {member.role}</div>)}
                </div>
              </div>
              <div className="rounded-[28px] bg-accent/35 px-5 py-5">
                <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/42">Trainee members</div>
                <div className="mt-3 space-y-2 text-sm text-foreground/62">
                  {overview.traineeMembers.length > 0 ? overview.traineeMembers.map(member => <div key={member.id}>{member.name} · {member.role}</div>) : <div>No trainee members staged on this assignment.</div>}
                </div>
              </div>
            </div>
            <div className="rounded-[28px] bg-muted/50 px-5 py-5 text-sm leading-6 text-foreground/62">
              {overview.layoutMatchSummary}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-4xl border border-border/70 bg-card py-0">
          <CardContent className="space-y-4 px-6 py-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Blockers summary</div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Local workflow blockers and downstream gates.</h2>
            </div>
            <div className="space-y-3">
              {overview.blockers.map(blocker => (
                <div key={blocker} className="rounded-2xl bg-red-500/8 px-4 py-3 text-sm leading-6 text-red-700">{blocker}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}