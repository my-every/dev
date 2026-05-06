import { AlertTriangle, Clock3, Package2, Sparkles } from 'lucide-react'

import { ScrollArea } from '@/components/ui/scroll-area'
import type { D380ProjectBoardViewModel } from '@/types/d380-project-board'

function BacklogGroup({
  title,
  icon,
  assignments,
}: {
  title: string
  icon: React.ReactNode
  assignments: D380ProjectBoardViewModel['backlog']['unassigned']
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-foreground/44">
        {icon}
        {title}
      </div>
      {assignments.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 px-4 py-4 text-sm text-muted-foreground">Nothing staged in this queue.</div>
      ) : (
        <div className="space-y-3">
          {assignments.map(assignment => (
            <div key={assignment.id} className="rounded-2xl border border-border/70 bg-card/84 p-4 shadow-[0_10px_32px_rgba(0,0,0,0.06)]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/42">{assignment.pdNumber}</div>
              <div className="mt-1 font-medium text-foreground">{assignment.sheetName}</div>
              <div className="mt-1 text-sm text-foreground/60">{assignment.stageLabel} · {assignment.requiredRoleLabel}</div>
              <div className="mt-3 text-sm leading-6 text-foreground/58">{assignment.statusNote}</div>
              {assignment.blockedReason ? <div className="mt-3 rounded-xl bg-red-500/8 px-3 py-2 text-xs leading-5 text-red-700">{assignment.blockedReason}</div> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export function AssignmentBacklogPanel({ backlog }: { backlog: D380ProjectBoardViewModel['backlog'] }) {
  return (
    <div className="rounded-[32px] border border-border/70 bg-card/76 p-5 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/44">Backlog control</div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Unassigned, blocked, and carryover work in one rail.</h2>
        </div>
        <div className="rounded-full bg-black px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-[#f4c430]">{backlog.unassigned.length + backlog.blocked.length} open</div>
      </div>

      <ScrollArea className="mt-5 h-[calc(100vh-18rem)] pr-3 xl:h-[calc(100vh-16rem)]">
        <div className="space-y-6">
          <BacklogGroup title="Unassigned" icon={<Package2 className="size-4" />} assignments={backlog.unassigned} />
          <BacklogGroup title="Blocked" icon={<AlertTriangle className="size-4" />} assignments={backlog.blocked} />
          <BacklogGroup title="Prior Shift" icon={<Clock3 className="size-4" />} assignments={backlog.priorShift} />
          <BacklogGroup title="Recommended" icon={<Sparkles className="size-4" />} assignments={backlog.recommended} />
        </div>
      </ScrollArea>
    </div>
  )
}