'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'

import { ProjectBoardFilters } from '@/components/d380/projects/project-board-filters'
import { ProjectLifecycleBoard } from '@/components/d380/projects/project-lifecycle-board'
import { ProjectSearchBar } from '@/components/d380/projects/project-search-bar'
import { buildProjectsBoardViewModel } from '@/lib/view-models/d380-projects-board'
import type { D380ProjectsBoardDataSet, ProjectsBoardFilterState } from '@/types/d380-projects-board'

const DEFAULT_FILTERS: ProjectsBoardFilterState = {
  search: '',
  shift: 'ALL',
  risk: 'ALL',
  lifecycle: 'ALL',
  lateOnly: false,
}

export function ProjectsRoute({ dataSet }: { dataSet?: D380ProjectsBoardDataSet }) {
  const [filters, setFilters] = useState<ProjectsBoardFilterState>(DEFAULT_FILTERS)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 420)

    return () => {
      clearTimeout(timer)
    }
  }, [])

  const viewModel = useMemo(() => buildProjectsBoardViewModel({ filters, dataSet }), [dataSet, filters])

  function updateFilter<K extends keyof ProjectsBoardFilterState>(
    key: K,
    value: ProjectsBoardFilterState[K],
  ) {
    setFilters(current => ({
      ...current,
      [key]: value,
    }))
  }

  return (
    <main className="min-h-screen px-4 py-6 text-foreground sm:px-6 sm:py-8 md:px-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: 'easeOut' }}
        className="mx-auto max-w-360 space-y-8"
      >
        <section className="grid gap-3 rounded-3xl border border-border/70 bg-card/76 p-5 shadow-xl backdrop-blur-sm sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/60 bg-muted/35 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/45">Upcoming</div>
            <div className="mt-1 text-2xl font-semibold">{viewModel.filteredProjectCount}</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/35 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/45">Late projects</div>
            <div className="mt-1 text-2xl font-semibold">{viewModel.lateProjectCount}</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/35 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/45">Watch list</div>
            <div className="mt-1 text-2xl font-semibold">{viewModel.watchProjectCount}</div>
          </div>
          <div className="rounded-2xl border border-border/60 bg-muted/35 px-4 py-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-foreground/45">Completed</div>
            <div className="mt-1 text-2xl font-semibold">{viewModel.completedProjectCount}</div>
          </div>
        </section>

        <section className="space-y-4 rounded-3xl border border-border/70 bg-card/76 p-5 shadow-xl backdrop-blur-sm">
          <div className="grid gap-3 xl:grid-cols-[1.2fr_1.8fr] xl:items-center">
            <ProjectSearchBar value={filters.search} onValueChange={value => updateFilter('search', value)} />
            <ProjectBoardFilters
              filters={filters}
              shiftOptions={viewModel.shiftOptions}
              riskOptions={viewModel.riskOptions}
              lifecycleOptions={viewModel.lifecycleOptions}
              onFilterChange={updateFilter}
              onReset={() => setFilters(DEFAULT_FILTERS)}
            />
          </div>
        </section>

        <ProjectLifecycleBoard
          columns={viewModel.columns}
          isLoading={isLoading}
          emptyState={viewModel.emptyState}
        />
      </motion.div>
    </main>
  )
}
