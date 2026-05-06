'use client'

import { motion } from 'framer-motion'
import { BellRing, FolderKanban, Hammer, Wrench } from 'lucide-react'

import { WireListStandaloneTool } from '@/components/d380/tools/wire-list-standalone-tool'
import { Badge } from '@/components/ui/badge'
import { buildD380ShellViewModel } from '@/lib/view-models/d380-shell'

export function ToolsRoute() {
  const viewModel = buildD380ShellViewModel()

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted/35 px-3 py-4 text-foreground sm:px-5 sm:py-6 md:px-8 md:py-8">
      <div className="pointer-events-none absolute inset-0" />
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="relative mx-auto max-w-360 space-y-4 sm:space-y-6 md:space-y-8">
        <section className="grid gap-4 sm:gap-5 md:gap-6 xl:grid-cols-[1.08fr_0.92fr] xl:items-end">
          <div className="space-y-2 sm:space-y-3 md:space-y-4">
            <Badge variant="outline" className="rounded-full border-border/70 bg-muted/40 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-foreground/68 sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.22em]">
              /380/tools
            </Badge>
            <div className="space-y-2 sm:space-y-3">
              <h1 className="max-w-4xl text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl">
                Wire List Tool
              </h1>
              <p className="max-w-3xl text-xs leading-relaxed text-foreground/66 sm:text-sm sm:leading-7 md:text-base lg:text-lg">
                Upload Excel workbooks, browse projects, and view wire lists directly from this standalone tool surface.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border/70 bg-card/84 p-3 shadow-xl sm:gap-3 sm:rounded-3xl sm:p-4 md:p-5 xl:grid-cols-4">
            <div className="rounded-xl border border-border/70 bg-muted/50 px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-4">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-foreground/46 sm:gap-2 sm:text-[11px] sm:tracking-[0.22em]"><FolderKanban className="size-3 sm:size-4" />Projects</div>
              <div className="mt-2 text-xl font-semibold text-foreground sm:mt-3 sm:text-2xl">{viewModel.summary.totalProjects}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/50 px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-4">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-foreground/46 sm:gap-2 sm:text-[11px] sm:tracking-[0.22em]"><Hammer className="size-3 sm:size-4" />Assignments</div>
              <div className="mt-2 text-xl font-semibold text-foreground sm:mt-3 sm:text-2xl">{viewModel.summary.totalAssignments}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/50 px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-4">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-foreground/46 sm:gap-2 sm:text-[11px] sm:tracking-[0.22em]"><BellRing className="size-3 sm:size-4" />Unread</div>
              <div className="mt-2 text-xl font-semibold text-foreground sm:mt-3 sm:text-2xl">{viewModel.summary.unreadNotifications}</div>
            </div>
            <div className="rounded-xl border border-border/70 bg-muted/50 px-3 py-3 sm:rounded-2xl sm:px-4 sm:py-4">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.15em] text-foreground/46 sm:gap-2 sm:text-[11px] sm:tracking-[0.22em]"><Wrench className="size-3 sm:size-4" />Shortcut</div>
              <div className="mt-2 text-base font-semibold text-foreground sm:mt-3 sm:text-xl md:text-2xl">Ctrl/Cmd + K</div>
            </div>
          </div>
        </section>

        {/* Wire List Standalone Tool */}
        <section>
          <WireListStandaloneTool />
        </section>
      </motion.div>
    </main>
  )
}
