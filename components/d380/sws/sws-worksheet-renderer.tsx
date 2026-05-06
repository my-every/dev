'use client'

import { cn } from '@/lib/utils'
import type {
  SwsExecutionMode,
  SwsTemplateId,
  SwsWorksheetMetadata,
} from '@/types/d380-sws'
import { SWS_TEMPLATE_REGISTRY } from '@/lib/sws/sws-template-registry'
import { SwsWorksheetHeader } from './sws-worksheet-header'
import { SwsWorksheetMetadataGrid } from './sws-worksheet-metadata-grid'
import { SwsWorksheetWorkExecutions } from './sws-worksheet-work-executions'
import { SwsWorksheetFooter } from './sws-worksheet-footer'

export interface SwsWorksheetRendererProps {
  swsType: SwsTemplateId
  executionMode: SwsExecutionMode
  metadata: SwsWorksheetMetadata
  className?: string
}

function toContext(metadata: SwsWorksheetMetadata) {
  return {
    pdNumber: metadata.pdNumber,
    projectName: metadata.projectName,
    unitNumber: metadata.unit,
    panelIdentifier: metadata.panel ?? metadata.box ?? metadata.bays ?? '',
    revision: metadata.revision,
    operatingDate: metadata.date,
  }
}

function toRenderableSections(template: (typeof SWS_TEMPLATE_REGISTRY)[SwsTemplateId]) {
  return template.sections.map((section) => ({
    id: section.id,
    title: `WE${section.workExecutionNumber} ${section.description}`,
    description: section.cycleTime ? `Cycle ${section.cycleTime}` : section.auditorReference,
    workExecutions: section.processSteps.map((step) => step.text),
    references: section.references,
  }))
}

export function SwsWorksheetRenderer({
  swsType,
  executionMode,
  metadata,
  className,
}: SwsWorksheetRendererProps) {
  const template = SWS_TEMPLATE_REGISTRY[swsType]

  if (!template) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Unknown SWS template: {swsType}
      </div>
    )
  }

  const context = toContext(metadata)
  const sections = toRenderableSections(template)

  return (
    <div className={cn('space-y-3', className)}>
      <div className="rounded-xl border border-border bg-card p-4">
        <SwsWorksheetHeader template={template} executionMode={executionMode} />
        <div className="mt-3">
          <SwsWorksheetMetadataGrid context={context} mode={executionMode} />
        </div>
        <div className="mt-3">
          <SwsWorksheetWorkExecutions sections={sections as any} mode={executionMode} />
        </div>
        <SwsWorksheetFooter template={template as any} />
      </div>
    </div>
  )
}
