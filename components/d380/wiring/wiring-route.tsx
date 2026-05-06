'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'

import { WiringConnectionPlanPanel } from '@/components/d380/wiring/wiring-connection-plan-panel'
import { WiringHeader } from '@/components/d380/wiring/wiring-header'
import { WiringProgressSummaryPanel } from '@/components/d380/wiring/wiring-progress-summary-panel'
import { WiringRoutingPanel } from '@/components/d380/wiring/wiring-routing-panel'
import { WiringSectionCard } from '@/components/d380/wiring/wiring-section-card'
import { WiringTerminationPanel } from '@/components/d380/wiring/wiring-termination-panel'
import { WiringValidationPanel } from '@/components/d380/wiring/wiring-validation-panel'
import { AssignmentContextHeader } from '@/components/projects/assignment-context-header'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useWiringWorkflow } from '@/hooks/use-wiring-workflow'
import { useAssignmentContext } from '@/hooks/use-assignment-context'
import {
  buildWiringHeaderViewModel,
  buildWiringProgressSummary,
  buildWiringViewModel,
  formatWiringTimestamp,
  getWiringSectionDisplayState,
  wiringSectionLabels,
  canCompleteWiringSection,
  canStartWiringSection,
} from '@/lib/view-models/d380-wiring'

const sectionCategories = ['Connection Plan', 'Wire Execution', 'Routing', 'Termination', 'Validation', 'Labeling', 'Discrepancy', 'Export / IPV']

const categoryMap = {
  WIRING_PREP: ['Connection Plan'],
  GROUNDING_INITIAL: ['Wire Execution', 'Routing'],
  RELAY_TIMER: ['Termination', 'Validation'],
  SMALL_GAUGE: ['Wire Execution', 'Routing'],
  DIODES_AC: ['Validation', 'Discrepancy'],
  CABLES_COMM: ['Labeling', 'Routing'],
  FINAL_COMPLETION: ['Discrepancy', 'Export / IPV'],
  IPV_FINAL: ['Validation', 'Export / IPV'],
} as const

interface WiringRouteProps {
  projectId: string
  sheetSlug?: string
}

export function WiringRoute({ projectId, sheetSlug }: WiringRouteProps) {
  const workflow = useWiringWorkflow({ projectId })
  
  // Get assignment context if sheetSlug is provided
  const assignmentContext = useAssignmentContext(sheetSlug || '')

  const header = useMemo(
    () => workflow.wiring ? buildWiringHeaderViewModel({ wiring: workflow.wiring, workflowState: workflow.workflowState }) : null,
    [workflow.wiring, workflow.workflowState],
  )

  const progressSummary = useMemo(
    () => workflow.wiring ? buildWiringProgressSummary({ wiring: workflow.wiring, workflowState: workflow.workflowState }) : null,
    [workflow.wiring, workflow.workflowState],
  )

  const wiringViewModel = useMemo(
    () => workflow.wiring ? buildWiringViewModel({ wiring: workflow.wiring, workflowState: workflow.workflowState }) : null,
    [workflow.wiring, workflow.workflowState],
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
        {workflow.wiring && header && progressSummary && wiringViewModel ? (
          <>
            <WiringHeader header={header} operatingDateLabel={workflow.wiring?.operatingDate ? formatWiringTimestamp(workflow.wiring.operatingDate) : undefined} />
            <WiringProgressSummaryPanel summary={progressSummary} />

            <section className="rounded-4xl border border-border/70 bg-card/70 px-5 py-5">
              <div className="text-[11px] uppercase tracking-[0.22em] text-foreground/44">Wiring domain split</div>
              <div className="mt-4 flex flex-wrap gap-2">
                {sectionCategories.map(category => (
                  <Badge key={category} variant="outline" className="rounded-full border-border/70 bg-muted/40 px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-foreground/62">{category}</Badge>
                ))}
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              <WiringConnectionPlanPanel plan={wiringViewModel.connectionPlan} />
              <WiringRoutingPanel plan={wiringViewModel.routingPlan} />
              <WiringTerminationPanel plan={wiringViewModel.terminationPlan} />
              <WiringValidationPanel plan={wiringViewModel.validationPlan} />
            </section>

            <section className="space-y-5">
              {wiringViewModel.sections.map(section => (
                <WiringSectionCard
                  key={section.id}
                  section={{
                    ...section,
                    completedAt: formatWiringTimestamp(section.completedAt),
                  }}
                  displayState={getWiringSectionDisplayState({ wiring: workflow.wiring!, workflowState: workflow.workflowState, sectionId: section.id })}
                  isActionable={wiringViewModel.currentActionableSectionId === section.id}
                  canStart={canStartWiringSection({ wiring: workflow.wiring!, workflowState: workflow.workflowState, sectionId: section.id })}
                  canComplete={canCompleteWiringSection({ wiring: workflow.wiring!, workflowState: workflow.workflowState, sectionId: section.id })}
                  dependencySummary={section.dependencies.length > 0 ? `Depends on ${section.dependencies.map(dependencyId => wiringSectionLabels[dependencyId]).join(', ')}` : 'No upstream dependency gate'}
                  categoryBadges={[...categoryMap[section.id]]}
                  onStart={workflow.startSection}
                  onComplete={workflow.completeSection}
                  onBlock={workflow.blockSection}
                  onSetComment={workflow.setSectionComment}
                  onToggleChecklistItem={workflow.toggleChecklistItem}
                />
              ))}
            </section>
          </>
        ) : (
          <Card className="rounded-[36px] border border-dashed border-border/80 bg-card/82 py-0">
            <CardContent className="px-8 py-14 text-center">
              <h1 className="text-3xl font-semibold text-foreground">Wiring slice not staged yet</h1>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-foreground/60">No dedicated Wiring workflow data is currently seeded for this project.</p>
            </CardContent>
          </Card>
        )}
      </motion.div>
    </main>
  )
}
