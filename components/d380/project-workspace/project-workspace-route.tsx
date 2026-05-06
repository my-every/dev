'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { ProjectAssignmentsPanel } from '@/components/d380/project-workspace/project-assignments-panel'
import { ProjectExportsPanel } from '@/components/d380/project-workspace/project-exports-panel'
import { ProjectFilesPanel } from '@/components/d380/project-workspace/project-files-panel'
import { ProjectOverviewPanel } from '@/components/d380/project-workspace/project-overview-panel'
import { ProjectProgressPanel } from '@/components/d380/project-workspace/project-progress-panel'
import { ProjectStageReadinessModules } from '@/components/d380/project-workspace/project-stage-readiness-modules'
import { ProjectTeamAssignmentsPanel } from '@/components/d380/project-workspace/project-team-assignments-panel'
import { ProjectWorkspaceHeader } from '@/components/d380/project-workspace/project-workspace-header'
import { ProjectWorkspaceTabs } from '@/components/d380/project-workspace/project-workspace-tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  deriveProjectStageCompletions,
  formatShortDate,
  type ProjectAssignmentProgress,
} from '@/lib/data-loader/client'
import { buildProjectWorkspaceViewModel } from '@/lib/view-models/d380-project-workspace'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { D380ProjectWorkspaceDataSet, ProjectWorkspaceTabId } from '@/types/d380-project-workspace'

interface StageCompletionData {
  stageId: AssignmentStageId
  completedAt: string
}

export function ProjectWorkspaceRoute({ projectId, dataSet }: { projectId: string; dataSet?: D380ProjectWorkspaceDataSet }) {
  const viewModel = useMemo(() => buildProjectWorkspaceViewModel({ projectId, dataSet }), [dataSet, projectId])
  const [activeTab, setActiveTab] = useState<ProjectWorkspaceTabId>('OVERVIEW')

  // Load stage completion data from Share/Projects files
  const [stageCompletions, setStageCompletions] = useState<StageCompletionData[]>([])
  const [currentStage, setCurrentStage] = useState<AssignmentStageId | undefined>()

  useEffect(() => {
    async function loadStageData() {
      try {
        const response = await fetch(`/api/d380/projects/${projectId}/progress`)
        if (!response.ok) return

        const progress = (await response.json()) as ProjectAssignmentProgress
        // Derive project-level stage completions from all assignments
        const completions = deriveProjectStageCompletions(progress.assignments)
        const completionArray: StageCompletionData[] = []
        completions.forEach((value, stageId) => {
          completionArray.push({
            stageId,
            completedAt: formatShortDate(value.completedAt),
          })
        })
        setStageCompletions(completionArray)
        setCurrentStage(progress.currentStage as AssignmentStageId)
      } catch (error) {
        console.warn('[ProjectWorkspace] Failed to load stage data:', error)
      }
    }
    loadStageData()
  }, [projectId])

  return (
    <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-background via-background to-muted/45 px-4 py-6 text-foreground sm:px-6 sm:py-8 md:px-10">
      <div className="pointer-events-none absolute inset-0 bg-primary/[0.04]" />
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: 'easeOut' }} className="relative mx-auto max-w-360 space-y-8">
        {viewModel.found && viewModel.overview ? (
          <ProjectWorkspaceHeader header={viewModel.overview.header} operatingDateLabel={viewModel.operatingDateLabel} />
        ) : (
          <Card className="rounded-4xl border border-dashed border-border/80 bg-card/78 py-0">
            <CardContent className="px-8 py-14 text-center">
              <h1 className="text-3xl font-semibold text-foreground">{viewModel.emptyState.title}</h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-foreground/60">{viewModel.emptyState.description}</p>
            </CardContent>
          </Card>
        )}

        {viewModel.found ? (
          <>
            <ProjectStageReadinessModules modules={viewModel.stageReadiness} />

            <Tabs value={activeTab} onValueChange={value => setActiveTab(value as ProjectWorkspaceTabId)} className="space-y-4 sm:space-y-5">
            <ProjectWorkspaceTabs tabs={viewModel.tabs} activeTab={activeTab} />

            <AnimatePresence mode="wait">
              <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: 'easeOut' }}>
                <TabsContent value="OVERVIEW">
                  {viewModel.overview ? (
                    <ProjectOverviewPanel
                      overview={viewModel.overview}
                      stageCompletions={stageCompletions}
                      currentStage={currentStage}
                    />
                  ) : null}
                </TabsContent>
                <TabsContent value="ASSIGNMENTS">
                  {viewModel.assignments ? <ProjectAssignmentsPanel assignments={viewModel.assignments} /> : null}
                </TabsContent>
                <TabsContent value="FILES">
                  {viewModel.files ? <ProjectFilesPanel files={viewModel.files} /> : null}
                </TabsContent>
                <TabsContent value="PROGRESS">
                  {viewModel.progress ? <ProjectProgressPanel progress={viewModel.progress} /> : null}
                </TabsContent>
                <TabsContent value="TEAM_ASSIGNMENTS">
                  {viewModel.teamAssignments ? <ProjectTeamAssignmentsPanel teamAssignments={viewModel.teamAssignments} /> : null}
                </TabsContent>
                <TabsContent value="EXPORTS">
                  {viewModel.exports ? <ProjectExportsPanel exportsView={viewModel.exports} /> : null}
                </TabsContent>
              </motion.div>
            </AnimatePresence>
            </Tabs>
          </>
        ) : null}

  
      </motion.div>
    </main>
  )
}
