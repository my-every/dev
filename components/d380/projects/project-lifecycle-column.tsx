'use client'

import { motion } from 'framer-motion'

import { ProjectCard } from '@/components/d380/projects/project-card'
import type { ProjectsBoardColumnViewModel } from '@/types/d380-projects-board'

interface ProjectLifecycleColumnProps {
  column: ProjectsBoardColumnViewModel
}

export function ProjectLifecycleColumn({ column }: ProjectLifecycleColumnProps) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, ease: 'easeOut' }}
      className="flex min-h-160 w-full min-w-72 max-w-sm flex-col gap-4 rounded-3xl border border-border/70 bg-card/70 p-4 shadow-lg backdrop-blur-sm"
    >
      <div className="space-y-2 border-b border-border/60 pb-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">{column.label}</h2>
          <div className="flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-muted text-xs font-medium text-foreground/90 tabular-nums">
            {column.projects.length}
          </div>
        </div>
        <p className="text-sm leading-6 text-foreground/58">{column.description}</p>
      </div>

      <div className="grid gap-4">
        {column.projects.length > 0 ? (
          column.projects.map(project => <ProjectCard key={project.id} project={project} />)
        ) : (
          <div className="rounded-3xl border border-dashed border-border/70 bg-muted/30 px-4 py-6 text-sm leading-6 text-muted-foreground">
            No projects are currently staged in this lifecycle column.
          </div>
        )}
      </div>
    </motion.section>
  )
}
