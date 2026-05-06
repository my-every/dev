import { motion } from 'framer-motion'

import { WorkAreaCard } from '@/components/d380/project-board/work-area-card'
import type { ProjectBoardLwcSectionViewModel } from '@/types/d380-project-board'

export function FloorLayoutSection({
  section,
  selectedWorkAreaId,
  onSelectWorkArea,
  onOpenDetails,
}: {
  section: ProjectBoardLwcSectionViewModel
  selectedWorkAreaId?: string
  onSelectWorkArea: (workAreaId: string) => void
  onOpenDetails: (workAreaId: string) => void
}) {
  return (
    <section className="space-y-4 rounded-[32px] border border-border/70 bg-card/70 p-5 shadow-[0_16px_60px_rgba(0,0,0,0.08)] backdrop-blur-sm">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/44">{section.id}</div>
          <h2 className="mt-1 text-2xl font-semibold text-foreground">{section.label}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground/60">{section.description}</p>
        </div>
        <div className="rounded-full border border-border/70 bg-muted/40 px-4 py-2 text-sm text-foreground/60">
          {section.workAreas.length} work area{section.workAreas.length === 1 ? '' : 's'}
        </div>
      </div>

      <motion.div layout className="flex flex-1 max-w-max">
        {section.workAreas.map(workArea => (
          <WorkAreaCard
            key={workArea.id}
            workArea={workArea}
            isSelected={selectedWorkAreaId === workArea.id}
            onSelect={() => onSelectWorkArea(workArea.id)}
            onOpenDetails={() => onOpenDetails(workArea.id)}
          />
        ))}
      </motion.div>
    </section>
  )
}