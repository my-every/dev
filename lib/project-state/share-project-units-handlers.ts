import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { SlimLayoutPage } from '@/lib/layout-matching'
import { resolveUnitTypeIcon } from '@/lib/project-units/icon-resolver'
import type {
  ProjectUnit,
  ProjectUnitDetectionSummary,
  ProjectUnitsDocument,
  ProjectUnitsPayload,
} from '@/lib/project-units/types'
import {
  readAllSheetSchemas,
  readProjectManifest,
  resolveProjectStateDirectory,
  writeAssignmentMappings,
  writeSheetSchema,
} from '@/lib/project-state/share-project-state-handlers'
import { groupLayoutAndSheetsByUnitType } from '@/lib/project-state/unit-type-grouping'
import type { MappedAssignment } from '@/lib/assignment/mapped-assignment'
import type { SheetSchema } from '@/types/sheet-schema'

const PROJECT_UNITS_FILE = 'project-units.json'

const DEFAULT_BUILD_SEQUENCE = [
  'build-up',
  'wire',
  'box-build',
  'hang',
  'cross-wire',
  'branding-measure',
] as const

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

async function resolveProjectUnitsPath(projectId: string): Promise<string | null> {
  const stateDirectory = await resolveProjectStateDirectory(projectId)
  if (!stateDirectory) {
    return null
  }

  await fs.mkdir(stateDirectory, { recursive: true })
  return path.join(stateDirectory, PROJECT_UNITS_FILE)
}

async function readLayoutPages(projectId: string): Promise<SlimLayoutPage[]> {
  const stateDirectory = await resolveProjectStateDirectory(projectId)
  if (!stateDirectory) {
    return []
  }

  const filePath = path.join(stateDirectory, 'layout-pages.json')
  const data = await readJsonFile<{ pages?: SlimLayoutPage[] }>(filePath)
  return Array.isArray(data?.pages) ? data.pages : []
}

function buildUnitId(unitType: string): string {
  return `unit-${unitType.trim().toLowerCase()}`
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function dedupeNumbers(values: number[]): number[] {
  return Array.from(new Set(values.filter((value) => Number.isFinite(value)))).sort((a, b) => a - b)
}

function sanitizeUnit(unit: ProjectUnit, projectLwc?: string | null): ProjectUnit {
  const resolvedIcon = resolveUnitTypeIcon({
    unitType: unit.unitType,
    lwc: unit.lwc ?? projectLwc ?? null,
    state: unit.visualState ?? 'closed',
    doorCount: unit.doorCount ?? null,
  })

  return {
    ...unit,
    id: unit.id || buildUnitId(unit.unitType),
    label: unit.label?.trim() || unit.unitType,
    lwc: unit.lwc ?? resolvedIcon.lwc,
    visualState: unit.visualState ?? resolvedIcon.state,
    doorCount: unit.doorCount ?? resolvedIcon.doors,
    sheetSlugs: dedupeStrings(unit.sheetSlugs ?? []),
    layoutPageNumbers: dedupeNumbers(unit.layoutPageNumbers ?? []),
    sheetBindings: Object.fromEntries(
      Object.entries(unit.sheetBindings ?? {}).map(([sheetSlug, binding]) => [
        sheetSlug,
        {
          unitId: binding?.unitId ?? unit.id ?? buildUnitId(unit.unitType),
          workType: binding?.workType ?? 'wire',
          roleInUnit: binding?.roleInUnit ?? 'panel',
        },
      ]),
    ),
    status: unit.status ?? 'draft',
    readiness: {
      buildUp: Boolean(unit.readiness?.buildUp),
      wire: Boolean(unit.readiness?.wire),
      boxBuild: Boolean(unit.readiness?.boxBuild),
      hang: Boolean(unit.readiness?.hang),
      crossWire: Boolean(unit.readiness?.crossWire),
      brandingMeasure: Boolean(unit.readiness?.brandingMeasure),
    },
    buildSequence: unit.buildSequence?.length
      ? [...unit.buildSequence]
      : [...DEFAULT_BUILD_SEQUENCE],
    icon: resolvedIcon,
    source: unit.source ?? 'manual',
  }
}

function inferDefaultSheetBinding(schema: SheetSchema, unitId: string) {
  const haystack = `${schema.slug} ${schema.name}`.toUpperCase()

  if (haystack.includes('RAIL')) {
    return {
      unitId,
      roleInUnit: 'rail' as const,
      workType: 'build-up' as const,
    }
  }

  if (haystack.includes('COMP') || haystack.includes('COMPONENT')) {
    return {
      unitId,
      roleInUnit: 'component' as const,
      workType: 'build-up' as const,
    }
  }

  if (haystack.includes('BOX') || haystack.includes('DOOR') || haystack.includes('JB')) {
    return {
      unitId,
      roleInUnit: 'box' as const,
      workType: schema.rowCount > 0 ? 'wire' as const : 'build-up' as const,
    }
  }

  return {
    unitId,
    roleInUnit: 'panel' as const,
    workType: schema.rowCount > 0 ? 'wire' as const : 'build-up' as const,
  }
}

function getBindingForSheet(unit: ProjectUnit, schema: SheetSchema) {
  return unit.sheetBindings?.[schema.slug] ?? inferDefaultSheetBinding(schema, unit.id)
}

function buildDetectionFallbackSummary(
  projectUnitTypes: string[] | undefined,
  projectLwc: string | undefined,
): ProjectUnit[] {
  return (projectUnitTypes ?? []).map((unitType) => {
    const icon = resolveUnitTypeIcon({ unitType, lwc: projectLwc, state: 'closed' })
    return {
      id: buildUnitId(unitType),
      unitType,
      label: unitType,
      lwc: icon.lwc,
      doorCount: icon.doors,
      visualState: icon.state,
      layoutPageNumbers: [],
      sheetSlugs: [],
      status: 'draft',
      readiness: {
        buildUp: false,
        wire: false,
        boxBuild: false,
        hang: false,
        crossWire: false,
        brandingMeasure: false,
      },
      buildSequence: [...DEFAULT_BUILD_SEQUENCE],
      icon,
      source: 'detected',
    }
  })
}

export async function readProjectUnits(projectId: string): Promise<ProjectUnitsDocument | null> {
  const filePath = await resolveProjectUnitsPath(projectId)
  if (!filePath) {
    return null
  }

  const document = await readJsonFile<ProjectUnitsDocument>(filePath)
  if (!document) {
    return null
  }

  const manifest = await readProjectManifest(projectId)
  return {
    projectId,
    updatedAt: document.updatedAt,
    units: (document.units ?? []).map((unit) => sanitizeUnit(unit, manifest?.lwcType ? String(manifest.lwcType) : null)),
  }
}

export async function writeProjectUnits(
  projectId: string,
  units: ProjectUnit[],
): Promise<ProjectUnitsDocument> {
  const filePath = await resolveProjectUnitsPath(projectId)
  if (!filePath) {
    throw new Error('Project state directory not found')
  }

  const manifest = await readProjectManifest(projectId)
  const document: ProjectUnitsDocument = {
    projectId,
    updatedAt: new Date().toISOString(),
    units: units.map((unit) => sanitizeUnit(unit, manifest?.lwcType ? String(manifest.lwcType) : null)),
  }

  await writeJsonFile(filePath, document)
  return document
}

export async function detectProjectUnits(projectId: string): Promise<ProjectUnitsPayload> {
  const manifest = await readProjectManifest(projectId)
  if (!manifest) {
    throw new Error('Project not found')
  }

  const layoutPages = await readLayoutPages(projectId)
  const sheetSchemas = await readAllSheetSchemas(projectId)
  const grouping = groupLayoutAndSheetsByUnitType(layoutPages, sheetSchemas)

  const detectedUnits = grouping.groups.map((group) => {
    const icon = resolveUnitTypeIcon({
      unitType: group.unitType,
      lwc: manifest.lwcType ? String(manifest.lwcType) : null,
      state: 'closed',
    })

    const primaryBoxSheetSlug =
      group.sheets.find((sheet) => {
        const haystack = `${sheet.slug} ${sheet.name}`.toUpperCase()
        return haystack.includes(group.unitType.toUpperCase())
      })?.slug ?? group.sheets[0]?.slug

    return sanitizeUnit(
      {
        id: buildUnitId(group.unitType),
        unitType: group.unitType,
        label: group.unitType,
        lwc: icon.lwc,
        doorCount: icon.doors,
        visualState: icon.state,
        layoutPageNumbers: group.layoutPages.map((page) => page.pageNumber),
        sheetSlugs: group.sheets.map((sheet) => sheet.slug),
        sheetBindings: Object.fromEntries(
          group.sheets.map((sheet) => {
            const schema = sheetSchemas.find((entry) => entry.slug === sheet.slug)
            const binding = schema
              ? inferDefaultSheetBinding(schema, buildUnitId(group.unitType))
              : {
                unitId: buildUnitId(group.unitType),
                roleInUnit: 'panel' as const,
                workType: 'wire' as const,
              }
            return [sheet.slug, binding]
          }),
        ),
        primaryBoxSheetSlug,
        status: 'draft',
        readiness: {
          buildUp: false,
          wire: false,
          boxBuild: false,
          hang: false,
          crossWire: false,
          brandingMeasure: false,
        },
        buildSequence: [...DEFAULT_BUILD_SEQUENCE],
        icon,
        source: 'detected',
      },
      manifest.lwcType ? String(manifest.lwcType) : null,
    )
  })

  const units =
    detectedUnits.length > 0
      ? detectedUnits
      : buildDetectionFallbackSummary(manifest.unitTypes, manifest.lwcType ? String(manifest.lwcType) : undefined)

  const summary: ProjectUnitDetectionSummary = {
    unmatchedSheetSlugs: dedupeStrings(grouping.unclassifiedSheets.map((sheet) => sheet.slug)),
    unmatchedPageNumbers: dedupeNumbers(grouping.unclassifiedLayoutPages.map((page) => page.pageNumber)),
  }

  return {
    source: 'detected',
    summary,
    document: {
      projectId,
      updatedAt: new Date().toISOString(),
      units,
    },
  }
}

export async function applyProjectUnitBindingsToSheetSchemas(
  projectId: string,
  units: ProjectUnit[],
): Promise<void> {
  const schemas = await readAllSheetSchemas(projectId)
  const memberBySheet = new Map<string, { unit: ProjectUnit; binding: NonNullable<ProjectUnit['sheetBindings']>[string] }>()

  for (const unit of units) {
    for (const sheetSlug of unit.sheetSlugs) {
      const schema = schemas.find((entry) => entry.slug === sheetSlug)
      if (!schema) continue
      memberBySheet.set(sheetSlug, {
        unit,
        binding: getBindingForSheet(unit, schema),
      })
    }
  }

  for (const schema of schemas) {
    const member = memberBySheet.get(schema.slug)
    schema.unitBinding = member
      ? {
        unitId: member.unit.id,
        workType: member.binding.workType,
        roleInUnit: member.binding.roleInUnit,
      }
      : undefined
    await writeSheetSchema(projectId, schema)
  }
}

function deriveSwsTypeFromRole(role: string | undefined): MappedAssignment['selectedSwsType'] {
  if (role === 'box') return 'BOX'
  if (role === 'rail') return 'RAIL'
  if (role === 'component') return 'COMPONENT'
  return 'PANEL'
}

function deriveStageFromWorkType(workType: string | undefined): MappedAssignment['selectedStage'] {
  if (workType === 'build-up') return 'BUILD_UP'
  if (workType === 'cross-wire') return 'CROSS_WIRE'
  if (workType === 'branding') return 'READY_FOR_VISUAL'
  return 'WIRING'
}

export async function generateAssignmentWorkflowFromProjectUnits(
  projectId: string,
  units: ProjectUnit[],
): Promise<MappedAssignment[]> {
  await applyProjectUnitBindingsToSheetSchemas(projectId, units)

  const manifest = await readProjectManifest(projectId)
  if (!manifest) {
    throw new Error('Project not found')
  }

  const schemas = await readAllSheetSchemas(projectId)
  const unitById = new Map(units.map((unit) => [unit.id, unit]))

  const mappings: MappedAssignment[] = schemas.map((schema) => {
    const binding = schema.unitBinding
    const unit = binding?.unitId ? unitById.get(binding.unitId) : undefined
    const selectedSwsType = deriveSwsTypeFromRole(binding?.roleInUnit)
    const selectedStage = deriveStageFromWorkType(binding?.workType)

    return {
      sheetSlug: schema.slug,
      sheetName: schema.name,
      rowCount: schema.rowCount,
      sheetKind:
        schema.kind === 'operational'
          ? 'assignment'
          : schema.kind === 'reference'
            ? 'reference'
            : 'other',
      detectedSwsType: selectedSwsType,
      detectedConfidence: binding ? 95 : schema.assignment?.detectedConfidence ?? 0,
      detectedReasons: binding
        ? [
          `Derived from unit ${unit?.label ?? binding.unitId}`,
          `Role: ${binding.roleInUnit ?? 'panel'}`,
          `Work type: ${binding.workType ?? 'wire'}`,
        ]
        : schema.assignment?.detectedReasons ?? ['No unit binding assigned'],
      selectedSwsType,
      selectedStage,
      selectedStatus: 'NOT_STARTED',
      overrideReason: binding
        ? 'Generated from project unit workflow'
        : '',
      isOverride: Boolean(binding),
      requiresWireSws:
        binding?.workType === 'wire' ||
        binding?.workType === 'cross-wire' ||
        schema.rowCount > 0,
      requiresCrossWireSws: binding?.workType === 'cross-wire' || binding?.roleInUnit === 'cross-wire',
      matchedLayoutPage: schema.layoutMatch?.pageNumber,
      matchedLayoutTitle: schema.layoutMatch?.pageTitle,
    }
  })

  await writeAssignmentMappings(projectId, manifest.pdNumber ?? null, mappings)
  return mappings
}
