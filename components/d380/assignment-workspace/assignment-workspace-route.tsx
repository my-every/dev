'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useSearchParams } from 'next/navigation'

import { AssignmentOverviewTab } from '@/components/d380/assignment-workspace/assignment-overview-tab'
import { AssignmentPlaceholderPanel } from '@/components/d380/assignment-workspace/assignment-placeholder-panel'
import { AssignmentRailWidget } from '@/components/d380/assignment-workspace/assignment-rail-widget'
import { AssignmentStagesTab } from '@/components/d380/assignment-workspace/assignment-stages-tab'
import { AssignmentWorkspaceHeader } from '@/components/d380/assignment-workspace/assignment-workspace-header'
import { ProjectWorkspaceTabs } from '@/components/d380/project-workspace/project-workspace-tabs'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useAssignmentStageWorkflow } from '@/hooks/use-assignment-stage-workflow'
import { buildAssignmentWorkspaceViewModel } from '@/lib/view-models/d380-assignment-workspace'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { AssignmentWorkspaceTabId } from '@/types/d380-assignment-workspace'

export function AssignmentWorkspaceRoute({ projectId, sheetName }: { projectId: string; sheetName: string }) {
  const searchParams = useSearchParams()
  const requestedTab = searchParams.get('tab') === 'STAGES' ? 'STAGES' : 'OVERVIEW'
  const requestedStageId = searchParams.get('stage') as AssignmentStageId | null
  const [activeTab, setActiveTab] = useState<AssignmentWorkspaceTabId>('OVERVIEW')
  const {
    assignment,
    workflowState,
    startStage,
    resumeStage,
    completeStage,
    setStageComment,
    toggleChecklistItem,
    toggleStageBlocked,
    simulateShiftHandoff,
  } = useAssignmentStageWorkflow({ projectId, sheetName })

  const viewModel = useMemo(
    () => buildAssignmentWorkspaceViewModel({ projectId, sheetName, workflowState }),
    [projectId, sheetName, workflowState],
  )

  const [openStageId, setOpenStageId] = useState<AssignmentStageId | undefined>(viewModel.stages?.currentActionableStageId)

  useEffect(() => {
    setActiveTab(requestedTab)
  }, [requestedTab])

  useEffect(() => {
    const validStageIds = new Set(viewModel.stages?.stages.map(stage => stage.id) ?? [])

    if (requestedStageId && validStageIds.has(requestedStageId)) {
      setOpenStageId(requestedStageId)
      setActiveTab('STAGES')
      return
    }

    setOpenStageId(viewModel.stages?.currentActionableStageId)
  }, [viewModel.stages?.currentActionableStageId, viewModel.stages?.stages, assignment?.id, requestedStageId])

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted/45 px-4 py-6 text-foreground sm:px-6 sm:py-8 md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-primary/[0.04]" />
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="relative mx-auto max-w-360 space-y-8">
        {viewModel.found && viewModel.overview ? (
          <AssignmentWorkspaceHeader header={viewModel.overview.header} operatingDateLabel={viewModel.operatingDateLabel} onSimulateHandoff={simulateShiftHandoff} />
        ) : (
          <Card className="rounded-4xl border border-dashed border-border/80 bg-card/78 py-0">
            <CardContent className="px-8 py-14 text-center">
              <h1 className="text-3xl font-semibold text-foreground">{viewModel.emptyState.title}</h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-foreground/60">{viewModel.emptyState.description}</p>
            </CardContent>
          </Card>
        )}

        {viewModel.found ? (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.34fr)_minmax(18rem,22rem)] xl:items-start">
            <Tabs value={activeTab} onValueChange={value => setActiveTab(value as AssignmentWorkspaceTabId)} className="space-y-5">
              <ProjectWorkspaceTabs tabs={viewModel.tabs} activeTab={activeTab} />

              <AnimatePresence mode="wait">
                <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                  <TabsContent value="OVERVIEW">
                    {viewModel.overview ? <AssignmentOverviewTab overview={viewModel.overview} /> : null}
                  </TabsContent>
                  <TabsContent value="STAGES">
                    {viewModel.stages ? (
                      <AssignmentStagesTab
                        stagesView={viewModel.stages}
                        openStageId={openStageId}
                        onOpenStageChange={setOpenStageId}
                        onStartStage={startStage}
                        onResumeStage={resumeStage}
                        onCompleteStage={completeStage}
                        onToggleStageBlocked={toggleStageBlocked}
                        onToggleChecklistItem={toggleChecklistItem}
                        onCommentChange={setStageComment}
                      />
                    ) : null}
                  </TabsContent>
                </motion.div>
              </AnimatePresence>
            </Tabs>

            <ScrollArea className="xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)] xl:pr-3">
              <div className="space-y-4">
                {viewModel.railWidgets.map(widget => <AssignmentRailWidget key={widget.id} widget={widget} />)}
                {viewModel.placeholders.map(panel => <AssignmentPlaceholderPanel key={panel.id} panel={panel} />)}
              </div>
            </ScrollArea>
          </section>
        ) : null}

        <section className="rounded-4xl border border-border/70 bg-card px-6 py-6 text-foreground shadow-[0_18px_70px_rgba(0,0,0,0.12)] md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-foreground/52">Assignment workspace seam</div>
              <h2 className="mt-2 text-2xl font-semibold">This route owns stage workflow state while keeping heavier systems as labeled integration surfaces.</h2>
            </div>
            <p className="max-w-2xl text-sm leading-6 text-foreground/72">
              Stage progression, comments, checklist state, local timestamps, block/unblock behavior, and handoff simulation all live in the hook and pure view-model layer so the real wire list, sidebar, layout preview, device details, and branding systems can attach later without rewriting the workflow shell.
            </p>
          </div>
        </section>
      </motion.div>
    </main>
  )
}
