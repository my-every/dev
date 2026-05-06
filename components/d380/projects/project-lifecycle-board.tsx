'use client'

import { AnimatePresence, motion } from 'framer-motion'

import { ProjectLifecycleColumn } from '@/components/d380/projects/project-lifecycle-column'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import type { ProjectsBoardColumnViewModel } from '@/types/d380-projects-board'

interface ProjectLifecycleBoardProps {
  columns: ProjectsBoardColumnViewModel[]
  isLoading: boolean
  emptyState: {
    title: string
    description: string
  }
}

function ColumnSkeleton() {
  return (
    <div className="flex min-h-160 w-full min-w-72 max-w-sm flex-col gap-4 rounded-3xl border border-border/70 bg-card/70 p-4">
      <div className="space-y-2 border-b border-border/60 pb-4">
        <Skeleton className="h-6 w-36 bg-muted" />
        <Skeleton className="h-4 w-56 bg-muted/80" />
      </div>
      <div className="grid gap-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="rounded-3xl border border-border/60 bg-card/88 p-4">
            <Skeleton className="h-4 w-20 bg-muted/80" />
            <Skeleton className="mt-3 h-6 w-44 bg-muted" />
            <Skeleton className="mt-3 h-24 w-full rounded-3xl bg-muted/80" />
            <Skeleton className="mt-3 h-2.5 w-full bg-muted/80" />
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Skeleton className="h-14 w-full rounded-2xl bg-muted/80" />
              <Skeleton className="h-14 w-full rounded-2xl bg-muted/80" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ProjectLifecycleBoard({ columns, isLoading, emptyState }: ProjectLifecycleBoardProps) {
  const hasProjects = columns.some(column => column.projects.length > 0)

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ScrollArea className="w-full">
              <div className="flex min-w-max gap-5 pb-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <ColumnSkeleton key={index} />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </motion.div>
        ) : hasProjects ? (
          <motion.div
            key="board"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: 'easeOut' }}
          >
            <ScrollArea className="w-full">
              <div className="flex min-w-max gap-5 pb-4">
                {columns.map(column => (
                  <ProjectLifecycleColumn key={column.id} column={column} />
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-4xl border border-dashed border-border/80 bg-card/70 px-6 py-10 text-center shadow-[0_16px_50px_rgba(0,0,0,0.06)]"
          >
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">{emptyState.title}</h3>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-foreground/60">{emptyState.description}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
