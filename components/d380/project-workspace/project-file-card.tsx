import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ProjectWorkspaceFileCardViewModel } from '@/types/d380-project-workspace'

const statusClasses: Record<ProjectWorkspaceFileCardViewModel['status'], string> = {
  ready: 'border-emerald-300/80 bg-emerald-500/10 text-emerald-800',
  watch: 'border-amber-300/90 bg-amber-400/14 text-amber-950',
  missing: 'border-red-300/80 bg-red-500/10 text-red-800',
  staged: 'border-border/70 bg-muted/50 text-foreground/68',
}

export function ProjectFileCard({ file }: { file: ProjectWorkspaceFileCardViewModel }) {
  return (
    <Card className="rounded-[28px] border border-border/70 bg-card py-0 shadow-[0_12px_42px_rgba(0,0,0,0.06)]">
      <CardContent className="space-y-4 px-5 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-foreground/42">{file.label}</div>
            <h3 className="mt-1 text-lg font-semibold text-foreground">{file.fileName}</h3>
          </div>
          <Badge variant="outline" className={cn('rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]', statusClasses[file.status])}>
            {file.status}
          </Badge>
        </div>
        <div className="grid gap-2 text-sm text-foreground/60 md:grid-cols-2">
          <div>Revision: {file.revision}</div>
          <div>Source: {file.sourceLabel}</div>
          <div>Last updated: {file.lastUpdatedLabel}</div>
        </div>
        <p className="text-sm leading-6 text-foreground/62">{file.note}</p>
      </CardContent>
    </Card>
  )
}