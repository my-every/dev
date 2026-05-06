import { NextRequest, NextResponse } from 'next/server'

import { readProjectManifest, readSheetSchema } from '@/lib/project-state/share-project-state-handlers'
import { readAssignmentSwsConfig } from '@/lib/project-state/share-assignment-sws-handlers'
import {
  saveBuildUpSwsSchema,
  readBuildUpSwsSchema,
  listBuildUpSwsSchemas,
} from '@/lib/project-state/share-print-schema-handlers'
import { getSwsTemplate } from '@/lib/sws/sws-template-registry'
import type { AssignmentSwsConfig } from '@/types/d380-assignment-sws'
import type { BuildUpSwsSectionSchema } from '@/types/d380-build-up'
import type { SwsTemplateId } from '@/types/d380-sws'
import { isSwsTemplateId } from '@/types/d380-sws'

export const dynamic = 'force-dynamic'

function getTemplateId(config?: AssignmentSwsConfig): SwsTemplateId {
  if (config?.templateId && isSwsTemplateId(config.templateId)) {
    return config.templateId
  }
  return 'PANEL_BUILD_WIRE'
}

function buildBuildUpSwsSchemasForSheet(options: {
  projectId: string
  panelName: string
  templateId: SwsTemplateId
  config?: AssignmentSwsConfig
}): BuildUpSwsSectionSchema[] {
  const { projectId, panelName, templateId, config } = options
  const template = getSwsTemplate(templateId)

  return template.sections.map((section) => {
    const override = config?.sectionOverrides?.[section.id]

    return {
      schemaVersion: 1,
      schemaId: `${projectId}:${panelName}:${templateId}:${section.id}`,
      projectId,
      panelName,
      templateId,
      templateSectionId: section.id,
      workElementNumber: section.workElementNumber,
      sectionId: section.id,
      title: section.description,
      description: section.description,
      status: override?.hidden ? 'BLOCKED' : 'NOT_STARTED',
      statusLabel: override?.hidden ? 'Blocked' : 'Not Started',
      fields: [
        {
          key: 'cycleTime',
          label: 'Cycle Time',
          type: 'TEXT',
          value: override?.cycleTimeOverride ?? section.cycleTime ?? '',
          required: false,
          editable: true,
          description: 'Target cycle time for this section.',
        },
        {
          key: 'references',
          label: 'References',
          type: 'LIST',
          value: section.references,
          required: false,
          editable: false,
        },
        {
          key: 'notes',
          label: 'Section Notes',
          type: 'TEXTAREA',
          value: override?.notes ?? section.notes?.join('\n') ?? '',
          required: false,
          editable: true,
        },
      ],
      checklist: section.processSteps.map((step) => ({
        id: step.id,
        label: step.text,
        required: step.requiresCheckOff,
        completed: false,
        editable: true,
      })),
      stats: [
        {
          id: 'process-step-count',
          label: 'Process Steps',
          value: String(section.processSteps.length),
          detail: 'Total process steps in this section.',
          editable: false,
        },
        {
          id: 'supports-multi-badge',
          label: 'Supports Multi Badge',
          value: section.supportsMultiBadge ? 'Yes' : 'No',
          detail: 'Whether parallel badge execution is supported.',
          editable: false,
        },
      ],
      items: section.processSteps.map((step) => ({
        id: step.id,
        eyebrow: step.isKeyPoint ? 'Key Point' : 'Step',
        title: step.text,
        description: step.subSteps?.join(' ') ?? '',
        chips: [
          step.requiresCheckOff ? 'Checkoff Required' : 'Optional',
          step.verificationType ?? 'Standard',
        ],
        tone: step.isKeyPoint ? 'attention' : 'neutral',
        editable: true,
      })),
      progressUpdates: [],
      startedAtLabel: undefined,
      completedAtLabel: undefined,
    }
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params
  const sheetSlug = request.nextUrl.searchParams.get('sheet')

  try {
    if (!sheetSlug) {
      const slugs = await listBuildUpSwsSchemas(projectId)
      return NextResponse.json({ sheets: slugs })
    }

    const schema = await readBuildUpSwsSchema(projectId, sheetSlug)
    if (!schema) {
      return NextResponse.json(
        { error: `No saved Build Up SWS schema found for sheet: ${sheetSlug}` },
        { status: 404 },
      )
    }

    return NextResponse.json(schema)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read Build Up SWS schema' },
      { status: 500 },
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  try {
    const body = await request.json() as {
      mode?: 'single' | 'all'
      sheetSlug?: string
      save?: boolean
    }

    const manifest = await readProjectManifest(projectId)
    if (!manifest) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    if (body.mode === 'all') {
      const operationalSheets = manifest.sheets.filter((sheet) => sheet.kind === 'operational')
      const generated = [] as Array<{ sheetSlug: string; templateId: SwsTemplateId; savedPath?: string }>
      const skipped = [] as Array<{ sheetSlug: string; reason: string }>

      for (const sheet of operationalSheets) {
        const sheetSchema = await readSheetSchema(projectId, sheet.slug)
        if (!sheetSchema) {
          skipped.push({ sheetSlug: sheet.slug, reason: 'Sheet schema not found' })
          continue
        }

        const swsConfig = await readAssignmentSwsConfig(projectId, sheet.slug)
        const templateId = getTemplateId(swsConfig)
        const schemas = buildBuildUpSwsSchemasForSheet({
          projectId,
          panelName: sheetSchema.name,
          templateId,
          config: swsConfig,
        })

        let savedPath: string | undefined
        if (body.save !== false) {
          savedPath = await saveBuildUpSwsSchema(projectId, sheet.slug, schemas)
        }

        generated.push({
          sheetSlug: sheet.slug,
          templateId,
          ...(savedPath ? { savedPath } : {}),
        })
      }

      return NextResponse.json({
        projectId,
        generatedAt: new Date().toISOString(),
        generated,
        skipped,
      })
    }

    if (!body.sheetSlug) {
      return NextResponse.json(
        { error: "Missing required 'sheetSlug' for single mode generation" },
        { status: 400 },
      )
    }

    const sheetSchema = await readSheetSchema(projectId, body.sheetSlug)
    if (!sheetSchema) {
      return NextResponse.json(
        { error: `Sheet schema not found for slug: ${body.sheetSlug}` },
        { status: 404 },
      )
    }

    const swsConfig = await readAssignmentSwsConfig(projectId, body.sheetSlug)
    const templateId = getTemplateId(swsConfig)
    const schemas = buildBuildUpSwsSchemasForSheet({
      projectId,
      panelName: sheetSchema.name,
      templateId,
      config: swsConfig,
    })

    let savedPath: string | undefined
    if (body.save !== false) {
      savedPath = await saveBuildUpSwsSchema(projectId, body.sheetSlug, schemas)
    }

    return NextResponse.json({
      sheetSlug: body.sheetSlug,
      panelName: sheetSchema.name,
      templateId,
      schemas,
      ...(savedPath ? { savedPath } : {}),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate Build Up SWS schema' },
      { status: 500 },
    )
  }
}
