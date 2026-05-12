import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { SlimLayoutPage } from '@/lib/layout-matching'
import { summarizeLayoutPagesForManifest } from '@/lib/project-state/layout-pages-manifest-summary'
import {
  computeManifestAggregates,
  deriveProjectMechanicalSummaryFromAssignments,
} from '@/lib/project-state/manifest-layout-utils'
import { buildManifestAssignmentSummaries } from '@/lib/project-state/manifest-assignment-summaries'
import { resolveProjectRootDirectory } from '@/lib/project-state/share-project-state-handlers'
import type { ManifestAssignmentNode, ProjectManifest } from '@/types/project-manifest'
import { BoxSideConfig, getDefaultExternalLocationSettings } from '@/boxSide'

/**
 * Infer the box side key from a box side string value.
 * Normalizes various formats to match BoxSideConfig keys.
 */
function inferBoxSideKey(boxSide: string | undefined): string | undefined {
  if (!boxSide) return undefined
  
  const normalized = boxSide.toLowerCase().replace(/[\s_-]+/g, '')
  
  // Direct match check
  for (const key of Object.keys(BoxSideConfig)) {
    if (normalized === key.toLowerCase()) {
      return key
    }
  }
  
  // Partial match for common variations
  if (normalized.includes('leftdoor')) return 'leftDoor'
  if (normalized.includes('rightdoor')) return 'rightDoor'
  if (normalized.includes('leftback')) return 'leftBackSide'
  if (normalized.includes('rightback')) return 'rightBackSide'
  if (normalized.includes('topback')) return 'topBackSide'
  if (normalized.includes('leftside')) return 'leftSide'
  if (normalized.includes('rightside')) return 'rightSide'
  if (normalized.includes('back') && !normalized.includes('left') && !normalized.includes('right') && !normalized.includes('top')) {
    return 'backSide'
  }
  
  return undefined
}

/**
 * Compute visibility defaults for an assignment based on its boxSide and 
 * the boxSides of target external locations.
 */
function computeVisibilityDefaults(
  assignmentBoxSide: string | undefined,
  externalLocations: Array<{ location: string }>,
  locationToBoxSide: Record<string, string>
): Record<string, { wireListVisible: boolean; brandingVisible: boolean; crossWireVisible: boolean }> {
  const defaults: Record<string, { wireListVisible: boolean; brandingVisible: boolean; crossWireVisible: boolean }> = {}
  
  const assignmentBoxSideKey = inferBoxSideKey(assignmentBoxSide)
  if (!assignmentBoxSideKey) {
    // No box side set - default all to true
    for (const loc of externalLocations) {
      const key = loc.location?.trim().toUpperCase()
      if (key) {
        defaults[key] = { wireListVisible: true, brandingVisible: true, crossWireVisible: true }
      }
    }
    return defaults
  }
  
  for (const loc of externalLocations) {
    const locationKey = loc.location?.trim().toUpperCase()
    if (!locationKey) continue
    
    // Try to find target box side from lookup map or infer from location name
    let targetBoxSideKey = locationToBoxSide[locationKey]
    
    if (!targetBoxSideKey) {
      // Try partial match
      for (const [knownLoc, boxSide] of Object.entries(locationToBoxSide)) {
        if (locationKey.includes(knownLoc) || knownLoc.includes(locationKey)) {
          targetBoxSideKey = boxSide
          break
        }
      }
    }
    
    if (!targetBoxSideKey) {
      // Try inferring from location text
      targetBoxSideKey = inferBoxSideKey(locationKey)
    }
    
    // Get defaults based on box side relationship
    const settings = getDefaultExternalLocationSettings(assignmentBoxSideKey, targetBoxSideKey)
    defaults[locationKey] = {
      wireListVisible: settings.wire_list,
      brandingVisible: settings.brand_list,
      crossWireVisible: settings.cross_wire,
    }
  }
  
  return defaults
}

function sanitizeManifest(manifest: ProjectManifest): ProjectManifest {
  const assignments: Record<string, ManifestAssignmentNode> = {}
  const sheets = Array.isArray(manifest.sheets)
    ? manifest.sheets
      .map((sheet) => ({
        slug: String(sheet.slug ?? '').trim(),
        name: String(sheet.name ?? '').trim(),
        kind: String(sheet.kind ?? 'unknown') as ProjectManifest['sheets'][number]['kind'],
        sheetPath:
          typeof sheet.sheetPath === 'string' && sheet.sheetPath.trim().length > 0
            ? sheet.sheetPath.trim()
            : `state/sheets/${String(sheet.slug ?? '').trim()}.json`,
        rowCount: Number(sheet.rowCount ?? 0),
        columnCount: typeof sheet.columnCount === 'number' ? sheet.columnCount : undefined,
        sheetIndex: typeof sheet.sheetIndex === 'number' ? sheet.sheetIndex : undefined,
        hasData: typeof sheet.hasData === 'boolean' ? sheet.hasData : true,
      }))
      .filter((sheet) => sheet.slug && sheet.name)
    : []

  const rawAssignments = manifest.assignments as unknown as
    | Record<string, unknown>
    | Array<Record<string, unknown>>

  const entries: Array<Record<string, unknown>> = Array.isArray(rawAssignments)
    ? rawAssignments
    : Object.values(rawAssignments ?? {})

  for (const a of entries) {
    const sheetSlug = String(a.sheetSlug ?? '').trim()
    const sheetName = String(a.sheetName ?? '').trim()
    if (!sheetSlug || !sheetName) continue

    assignments[sheetSlug] = {
      sheetSlug,
      sheetName,
      kind: 'operational',
      sheetPath:
        typeof a.sheetPath === 'string' && a.sheetPath.trim().length > 0
          ? a.sheetPath.trim()
          : `state/sheets/${sheetSlug}.json`,
      rowCount: Number(a.rowCount ?? 0),
      columnCount: typeof a.columnCount === 'number' ? a.columnCount : undefined,
      sheetIndex: typeof a.sheetIndex === 'number' ? a.sheetIndex : undefined,
      hasData: typeof a.hasData === 'boolean' ? a.hasData : true,
      swsType: String(a.swsType ?? 'UNDECIDED').trim() || 'UNDECIDED',
      stage: String(a.stage ?? 'BUILD_UP') as ManifestAssignmentNode['stage'],
      status: String(a.status ?? 'NOT_STARTED') as ManifestAssignmentNode['status'],
      unitType: typeof a.unitType === 'string' ? a.unitType : undefined,
      boxSide: typeof a.boxSide === 'string' ? a.boxSide : undefined,
      normalizedTitle: typeof a.normalizedTitle === 'string' ? a.normalizedTitle : undefined,
      boxNumber: typeof a.boxNumber === 'string' ? a.boxNumber : undefined,
      panducts: Array.isArray(a.panducts) ? a.panducts as string[] : [],
      rails: Array.isArray(a.rails) ? a.rails as string[] : [],
      externalLocations: Array.isArray(a.externalLocations)
        ? a.externalLocations.map((item) => {
            if (typeof item === 'string') {
              return { location: item.trim(), wireListVisible: true, brandingVisible: true }
            }
            return item as import('@/lib/layout-matching/ubp-reference-index').ExternalLocationConfig
          }).filter((item) => Boolean(item.location))
        : [],
      whiteLabels: Array.isArray(a.whiteLabels) ? a.whiteLabels as string[] : [],
      blueLabels: Array.isArray(a.blueLabels) ? a.blueLabels as string[] : [],
      partNumbers: Array.isArray(a.partNumbers) ? a.partNumbers as string[] : [],
      files: (typeof a.files === 'object' && a.files !== null ? a.files : {}) as ManifestAssignmentNode['files'],
      buildUpEstTime: typeof a.buildUpEstTime === 'string' ? a.buildUpEstTime : undefined,
      wireListEstTime: typeof a.wireListEstTime === 'string' ? a.wireListEstTime : undefined,
      layout: (a.layout ?? null) as ManifestAssignmentNode['layout'],
      devices: (typeof a.devices === 'object' && a.devices !== null ? a.devices : {}) as ManifestAssignmentNode['devices'],
    }
  }

  // Build location-to-boxSide lookup map from all assignments
  const locationToBoxSide: Record<string, string> = {}
  for (const assignment of Object.values(assignments)) {
    const boxSideKey = inferBoxSideKey(assignment.boxSide)
    if (!boxSideKey) continue
    
    // Add sheet name
    if (assignment.sheetName) {
      locationToBoxSide[assignment.sheetName.trim().toUpperCase()] = boxSideKey
    }
    // Add normalized title
    if (assignment.normalizedTitle) {
      locationToBoxSide[assignment.normalizedTitle.trim().toUpperCase()] = boxSideKey
    }
    // Add box number variations
    if (assignment.boxNumber) {
      const boxNum = assignment.boxNumber.trim().toUpperCase()
      locationToBoxSide[boxNum] = boxSideKey
      locationToBoxSide[`${boxNum} PANEL`] = boxSideKey
    }
  }

  // Compute visibility defaults for each assignment based on boxSide logic
  for (const sheetSlug of Object.keys(assignments)) {
    const assignment = assignments[sheetSlug]
    if (assignment.externalLocations && assignment.externalLocations.length > 0) {
      assignment.visibilityDefaults = computeVisibilityDefaults(
        assignment.boxSide,
        assignment.externalLocations,
        locationToBoxSide
      )
    }
  }

  const normalizedSheets = sheets.length > 0
    ? sheets
    : [
      ...Object.values(assignments).map((assignment) => ({
        slug: assignment.sheetSlug,
        name: assignment.sheetName,
        kind: assignment.kind,
        sheetPath: assignment.sheetPath,
        rowCount: assignment.rowCount,
        columnCount: assignment.columnCount,
        sheetIndex: assignment.sheetIndex,
        hasData: assignment.hasData,
      })),
      ...Object.values(manifest.referenceSheets ?? {}).map((sheet) => ({
        slug: sheet.sheetSlug,
        name: sheet.sheetName,
        kind: sheet.kind,
        sheetPath: sheet.sheetPath,
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount,
        sheetIndex: sheet.sheetIndex,
        hasData: sheet.hasData,
      })),
    ]

  return { ...manifest, assignments, sheets: normalizedSheets }
}

function buildProjectLabelReference(assignments: Record<string, ManifestAssignmentNode>) {
  const allWhiteLabels = new Set<string>()
  const allBlueLabels = new Set<string>()
  const byAssignment: NonNullable<ProjectManifest['brandingLabelReference']>['byAssignment'] = {}

  for (const [slug, assignment] of Object.entries(assignments)) {
    const whiteLabels = Array.from(new Set((assignment.whiteLabels ?? []).map((value) => String(value).trim()).filter(Boolean)))
    const blueLabels = Array.from(new Set((assignment.blueLabels ?? []).map((value) => String(value).trim()).filter(Boolean)))

    for (const value of whiteLabels) allWhiteLabels.add(value)
    for (const value of blueLabels) allBlueLabels.add(value)

    byAssignment[slug] = {
      assignmentName: assignment.sheetName,
      whiteLabels,
      blueLabels,
    }
  }

  return {
    whiteLabels: Array.from(allWhiteLabels).sort((a, b) => a.localeCompare(b)),
    blueLabels: Array.from(allBlueLabels).sort((a, b) => a.localeCompare(b)),
    byAssignment,
  }
}

export async function enrichManifestFromProjectState(manifest: ProjectManifest): Promise<ProjectManifest> {
  const normalizedManifest = sanitizeManifest(manifest)

  const projectRoot = await resolveProjectRootDirectory(manifest.id, {
    pdNumber: normalizedManifest.pdNumber,
    projectName: normalizedManifest.name,
  })
  if (!projectRoot) {
    return normalizedManifest
  }

  const layoutPagesPath = path.join(projectRoot, 'state', 'layout-pages.json')
  try {
    const raw = await fs.readFile(layoutPagesPath, 'utf-8')
    const parsed = JSON.parse(raw) as { pages?: SlimLayoutPage[] }
    const pages = Array.isArray(parsed.pages) ? parsed.pages : []
    if (pages.length === 0) {
      return normalizedManifest
    }

    const summary = summarizeLayoutPagesForManifest(pages)
    const enrichedAssignments = await buildManifestAssignmentSummaries(projectRoot, normalizedManifest)
    const derivedMechanicalSummary = deriveProjectMechanicalSummaryFromAssignments(enrichedAssignments)
    const labelReference = buildProjectLabelReference(enrichedAssignments)

    return computeManifestAggregates({
      ...normalizedManifest,
      unitType: derivedMechanicalSummary.unitType || summary.unitType || normalizedManifest.unitType,
      unitTypes:
        derivedMechanicalSummary.unitTypes.length > 0
          ? derivedMechanicalSummary.unitTypes
          : summary.unitTypes,
      panducts: derivedMechanicalSummary.panducts || summary.panducts,
      rails: derivedMechanicalSummary.rails || summary.rails,
      assignments: enrichedAssignments,
      whiteLabels: labelReference.whiteLabels,
      blueLabels: labelReference.blueLabels,
      brandingLabelReference: {
        ...labelReference,
        joinHints: {
          sourceSheets: ['white-labels', 'blue-labels'],
          matchingStrategy: 'reference-sheet-header-to-assignment-name',
          generatedAt: new Date().toISOString(),
        },
      },
    })
  } catch {
    try {
      const enrichedAssignments = await buildManifestAssignmentSummaries(projectRoot, normalizedManifest)
      const derivedMechanicalSummary = deriveProjectMechanicalSummaryFromAssignments(enrichedAssignments)
      const labelReference = buildProjectLabelReference(enrichedAssignments)
      return computeManifestAggregates({
        ...normalizedManifest,
        unitType: derivedMechanicalSummary.unitType || normalizedManifest.unitType,
        unitTypes:
          derivedMechanicalSummary.unitTypes.length > 0
            ? derivedMechanicalSummary.unitTypes
            : normalizedManifest.unitTypes,
        panducts: derivedMechanicalSummary.panducts || normalizedManifest.panducts,
        rails: derivedMechanicalSummary.rails || normalizedManifest.rails,
        assignments: enrichedAssignments,
        whiteLabels: labelReference.whiteLabels,
        blueLabels: labelReference.blueLabels,
        brandingLabelReference: {
          ...labelReference,
          joinHints: {
            sourceSheets: ['white-labels', 'blue-labels'],
            matchingStrategy: 'reference-sheet-header-to-assignment-name',
            generatedAt: new Date().toISOString(),
          },
        },
      })
    } catch {
      return normalizedManifest
    }
  }
}
