import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { ProjectWorkspaceStageReadinessCardViewModel } from '@/types/d380-project-workspace'

const themeClasses: Record<ProjectWorkspaceStageReadinessCardViewModel['theme'], string> = {
  'build-up': 'rounded-4xl border border-border/70 bg-gradient-to-br from-emerald-500/20 via-card to-card py-0 text-card-foreground shadow-[0_18px_70px_rgba(0,0,0,0.12)]',
  wiring: 'rounded-4xl border border-border/70 bg-gradient-to-br from-sky-500/20 via-card to-card py-0 text-card-foreground shadow-[0_18px_70px_rgba(0,0,0,0.12)]',
}

function ProjectStageReadinessCard({ module }: { module: ProjectWorkspaceStageReadinessCardViewModel }) {
  return (
    <Card className={themeClasses[module.theme]}>
      <CardContent className="flex flex-wrap items-start justify-between gap-5 px-6 py-6">
        <div className="max-w-3xl space-y-3">
          <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/56">{module.eyebrow}</div>
          <h2 className="text-2xl font-semibold">{module.title}</h2>
          <p className="text-sm leading-6 text-foreground/76">{module.description}</p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="rounded-full border-border/70 bg-muted/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-foreground">{module.completionLabel}</Badge>
            <Badge variant="outline" className="rounded-full border-border/70 bg-muted/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-foreground">{module.exportReadinessLabel}</Badge>
          </div>
        </div>

        <Button asChild className="w-full rounded-2xl sm:w-auto">
          <Link href={module.href}>{module.actionLabel}</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

export function ProjectStageReadinessModules({ modules }: { modules: ProjectWorkspaceStageReadinessCardViewModel[] }) {
  if (modules.length === 0) {
    return null
  }

  return (
    <section className="space-y-4">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Stage readiness modules</div>
        <h2 className="mt-2 text-2xl font-semibold text-foreground">Dedicated stage workspaces that are already staged for this project.</h2>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {modules.map(module => <ProjectStageReadinessCard key={module.id} module={module} />)}
      </div>
    </section>
  )
}