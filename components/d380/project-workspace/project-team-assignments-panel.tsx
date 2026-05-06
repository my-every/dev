import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { ProjectMetricCard } from '@/components/d380/project-workspace/project-metric-card'
import type { ProjectWorkspaceTeamAssignmentsViewModel } from '@/types/d380-project-workspace'

export function ProjectTeamAssignmentsPanel({ teamAssignments }: { teamAssignments: ProjectWorkspaceTeamAssignmentsViewModel }) {
  return (
    <section className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {teamAssignments.summary.map(metric => <ProjectMetricCard key={metric.id} metric={metric} />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <Card className="rounded-[32px] border border-border/70 bg-card py-0">
          <CardContent className="space-y-4 px-6 py-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Current assigned members</div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Member, workstation, and LWC summary.</h2>
            </div>
            <div className="space-y-3">
              {teamAssignments.members.map(member => (
                <div key={member.id} className="rounded-2xl border border-border/70 bg-accent/35 px-4 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{member.name}</div>
                      <div className="mt-1 text-sm text-foreground/60">{member.role} · {member.shiftLabel}</div>
                    </div>
                    {member.continuityMember ? <Badge variant="outline" className="rounded-full border-emerald-300/80 bg-emerald-500/10 text-[11px] uppercase tracking-[0.18em] text-emerald-700">Continuity</Badge> : null}
                  </div>
                  <div className="mt-3 grid gap-2 text-sm text-foreground/62 md:grid-cols-3">
                    <div>Workstation: {member.workstationLabel}</div>
                    <div>LWC: {member.lwcLabel}</div>
                    <div>Assignments: {member.assignmentCount}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-[32px] border border-border/70 bg-card py-0">
            <CardContent className="space-y-4 px-6 py-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Trainee pairings</div>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">Paired learning and continuity support.</h2>
              </div>
              {teamAssignments.traineePairings.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border/80 px-4 py-5 text-sm text-muted-foreground">No trainee pairings are assigned for this project yet.</div>
              ) : teamAssignments.traineePairings.map(pairing => (
                <div key={pairing.id} className="rounded-2xl bg-muted/50 px-4 py-4 text-sm text-foreground/62">
                  <div className="font-medium text-foreground">{pairing.leadName} + {pairing.traineeName}</div>
                  <div className="mt-1">{pairing.assignmentLabel}</div>
                  <p className="mt-2 leading-6">{pairing.note}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-[32px] border border-border/70 bg-card py-0">
            <CardContent className="space-y-4 px-6 py-6">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Shift continuity overview</div>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">Continuity notes across workstations and shifts.</h2>
              </div>
              <div className="space-y-3">
                {teamAssignments.continuityOverview.map(item => (
                  <div key={item} className="rounded-2xl bg-muted/50 px-4 py-3 text-sm leading-6 text-foreground/62">{item}</div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}