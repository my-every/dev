'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'

import { BuildUpHeader } from '@/components/d380/build-up/build-up-header'
import { BuildUpMetricCard } from '@/components/d380/build-up/build-up-metric-card'
import { BuildUpProgressSummaryPanel } from '@/components/d380/build-up/build-up-progress-summary-panel'
import { BuildUpSectionCard } from '@/components/d380/build-up/build-up-section-card'
import { AssignmentContextHeader } from '@/components/projects/assignment-context-header'
import { Card, CardContent } from '@/components/ui/card'
import { useBuildUpWorkflow } from '@/hooks/use-build-up-workflow'
import { useAssignmentContext } from '@/hooks/use-assignment-context'
import { buildBuildUpWorkspaceViewModel } from '@/lib/view-models/d380-build-up'

interface BuildUpRouteProps {
  projectId: string
  sheetSlug?: string
}

export function BuildUpRoute({ projectId, sheetSlug }: BuildUpRouteProps) {
  // Get assignment context if sheetSlug is provided
  const assignmentContext = useAssignmentContext(sheetSlug || '')
  const workflow = useBuildUpWorkflow({ projectId })
  const viewModel = useMemo(
    () => buildBuildUpWorkspaceViewModel({ projectId, workflowState: workflow.workflowState }),
    [projectId, workflow.workflowState],
  )

  return (
    <main className="min-h-screen bg-gradient-to-b from-background via-background to-muted/45 text-foreground">
      {/* Assignment context header - shows SWS type, confidence, stage info */}
      {sheetSlug && (
        <AssignmentContextHeader 
          context={assignmentContext} 
          sheetName={sheetSlug} 
        />
      )}
      
      <motion.div 
        initial={{ opacity: 0, y: 18 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ duration: 0.3, ease: 'easeOut' }} 
        className="mx-auto max-w-[1480px] space-y-7 px-4 py-6 sm:px-6 sm:py-8 md:px-10"
      >
        {viewModel.found && viewModel.header && viewModel.progressSummary ? (
          <BuildUpHeader header={viewModel.header} operatingDateLabel={viewModel.operatingDateLabel} />
        ) : (
          <Card className="rounded-[36px] border border-dashed border-border/80 bg-card/82 py-0">
            <CardContent className="px-8 py-14 text-center">
              <h1 className="text-3xl font-semibold text-foreground">{viewModel.emptyState.title}</h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-foreground/60">{viewModel.emptyState.description}</p>
            </CardContent>
          </Card>
        )}

        {viewModel.found ? (
          <>
            {viewModel.progressSummary ? <BuildUpProgressSummaryPanel summary={viewModel.progressSummary} /> : null}

            <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
              {viewModel.metrics.map(metric => <BuildUpMetricCard key={metric.id} metric={metric} />)}
            </section>

            <section className="space-y-5">
              {viewModel.sections.map(section => (
                <BuildUpSectionCard
                  key={section.id}
                  section={section}
                  onStart={workflow.startSection}
                  onComplete={workflow.completeSection}
                  onToggleChecklistItem={workflow.toggleChecklistItem}
                  onToggleBlocked={workflow.toggleSectionBlocked}
                  onSetComment={workflow.setSectionComment}
                  onSetBlockedReason={workflow.setSectionBlockedReason}
                  onAddProgressUpdate={workflow.addProgressUpdate}
                />
              ))}
            </section>
          </>
        ) : null}
      </motion.div>
    </main>
  )
}
