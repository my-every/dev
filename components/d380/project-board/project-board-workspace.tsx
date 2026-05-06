'use client'

import { motion } from 'framer-motion'

import { AssignmentBacklogPanel } from '@/components/d380/project-board/assignment-backlog-panel'
import { FloorLayoutSection } from '@/components/d380/project-board/floor-layout-section'
import type { D380ProjectBoardViewModel } from '@/types/d380-project-board'

export function ProjectBoardWorkspace({
  viewModel,
  selectedWorkAreaId,
  onSelectWorkArea,
  onOpenWorkAreaDetails,
}: {
  viewModel: D380ProjectBoardViewModel
  selectedWorkAreaId?: string
  onSelectWorkArea: (workAreaId: string) => void
  onOpenWorkAreaDetails: (workAreaId: string) => void
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <AssignmentBacklogPanel backlog={viewModel.backlog} />

      {viewModel.sections.length === 0 ? (
        <div className="rounded-4xl border border-dashed border-border/80 bg-card/72 px-8 py-16 text-center">
          <h2 className="text-2xl font-semibold text-foreground">{viewModel.emptyState.title}</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-foreground/58">{viewModel.emptyState.description}</p>
        </div>
      ) : (
        <motion.div layout className="space-y-6">
          {viewModel.sections.map(section => (
            <FloorLayoutSection
              key={section.id}
              section={section}
              selectedWorkAreaId={selectedWorkAreaId}
              onSelectWorkArea={onSelectWorkArea}
              onOpenDetails={onOpenWorkAreaDetails}
            />
          ))}
        </motion.div>
      )}
    </section>
  )
}