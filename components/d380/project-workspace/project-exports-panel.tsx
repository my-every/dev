import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ProjectWorkspaceExportsViewModel } from '@/types/d380-project-workspace'

const statusClasses: Record<ProjectWorkspaceExportsViewModel['records'][number]['status'], string> = {
  ready: 'border-emerald-300/80 bg-emerald-500/10 text-emerald-700',
  watch: 'border-amber-300/90 bg-amber-400/18 text-amber-950',
  'not-ready': 'border-red-300/80 bg-red-500/10 text-red-700',
}

export function ProjectExportsPanel({ exportsView }: { exportsView: ProjectWorkspaceExportsViewModel }) {
  return (
    <section className="space-y-6">
      <Card className="rounded-[32px] border border-border/70 bg-card py-0">
        <CardContent className="space-y-4 px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Archive readiness</div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Export and completion bundles with live readiness signals.</h2>
            </div>
            <Badge variant="outline" className={cn('rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.18em]', exportsView.archiveReady ? statusClasses.ready : statusClasses['not-ready'])}>
              {exportsView.archiveStatusLabel}
            </Badge>
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            {exportsView.records.map(record => (
              <div key={record.id} className="rounded-[28px] border border-border/70 bg-accent/35 px-5 py-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium text-foreground">{record.label}</div>
                    <p className="mt-2 text-sm leading-6 text-foreground/62">{record.description}</p>
                  </div>
                  <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]', statusClasses[record.status])}>
                    {record.status}
                  </Badge>
                </div>
                <div className="mt-4 text-sm text-foreground/58">{record.lastGeneratedLabel ?? 'Not generated yet'}</div>
                <p className="mt-3 text-sm leading-6 text-foreground/62">{record.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </section>
  )
}