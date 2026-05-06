import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { SlimLayoutPage } from '@/lib/layout-matching'
import type {
  ManifestAssignmentNode,
  ProjectManifest,
} from '@/types/project-manifest'
import type { ParsedSheetRow } from '@/lib/workbook/types'
import type { SheetSchema } from '@/types/sheet-schema'
import {
  buildNormalizedLayoutPageIndex,
  matchAssignmentToLayoutPages,
} from '@/lib/project-state/manifest-layout-utils'
import { buildUbpReferenceIndex, inferUnitTypeByUbpReference, lookupUbpAssignment, type UbpReferenceIndex } from '@/lib/layout-matching/ubp-reference-index'

function normalize(value: string | undefined | null): string {
  return (value ?? '').trim()
}

function normalizeUpper(value: string | undefined | null): string {
  return normalize(value).toUpperCase()
}

function extractUnitType(input: string | undefined): string | undefined {
  const match = normalizeUpper(input).match(/\b(JB\d+)\b/)
  return match?.[1]
}

function normalizePartToken(rawToken: string): string {
  return normalize(rawToken)
    .replace(/^\[\d+\]\s*/, '')
    .replace(/\s+/g, ' ')
}

function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const remainder = safe % 60
  if (hours === 0) return `${remainder}m`
  if (remainder === 0) return `${hours}h`
  return `${hours}h ${remainder}m`
}

async function readJson<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

interface LabelSheetData {
  headers: string[]
  rawRows: Record<string, unknown>[]
}

async function readLabelSheetData(stateRoot: string, slug: string): Promise<LabelSheetData> {
  const schema = await readJson<SheetSchema>(path.join(stateRoot, 'sheets', `${slug}.json`))
  if (!schema) {
    return { headers: [], rawRows: [] }
  }

  const headers = Array.isArray(schema.headers)
    ? schema.headers.map((value) => normalize(String(value))).filter(Boolean)
    : []
  const rawRows = Array.isArray(schema.rawRows)
    ? (schema.rawRows as ParsedSheetRow[] as Record<string, unknown>[])
    : []

  return { headers, rawRows }
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs.stat(filePath).then(() => true).catch(() => false)
}

async function resolveArtifactRoot(projectRoot: string): Promise<string> {
  const stateRoot = path.join(projectRoot, 'state')
  if (await fileExists(path.join(stateRoot, 'sheets'))) {
    return stateRoot
  }
  return projectRoot
}

function normalizeTokenForMatch(value: string | undefined | null): string {
  return normalizeUpper(value)
    .replace(/\(SHT\s*\d+\)/g, ' ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function splitHeaderSegments(header: string): string[] {
  return normalize(header)
    .split(/\s+-\s+/)
    .map((segment) => segment.replace(/\(SHT\s*\d+\)/ig, ' ').trim())
    .filter(Boolean)
}

function isHeaderMappedToAssignment(
  header: string,
  assignmentName: string,
  assignmentSlug: string,
  unitType?: string,
): boolean {
  const assignmentToken = normalizeTokenForMatch(assignmentName)
  const slugToken = normalizeTokenForMatch(assignmentSlug.replace(/[-_]+/g, ' '))
  const unitToken = normalizeTokenForMatch(unitType)

  const headerSegments = splitHeaderSegments(header)
  if (headerSegments.length === 0) {
    headerSegments.push(header)
  }

  return headerSegments.some((segment) => {
    const segmentToken = normalizeTokenForMatch(segment)
    if (!segmentToken) return false

    if (assignmentToken && segmentToken === assignmentToken) return true
    if (assignmentToken && segmentToken.includes(assignmentToken)) return true
    if (slugToken && segmentToken === slugToken) return true
    if (slugToken && segmentToken.includes(slugToken)) return true

    // Unit type is a weak fallback to retain compatibility with older headers.
    return Boolean(unitToken && segmentToken.includes(unitToken) && assignmentToken && assignmentToken.length <= 4)
  })
}

function collectLabelsFromSheetData(
  sheetData: LabelSheetData,
  assignmentName: string,
  assignmentSlug: string,
  unitType?: string,
): string[] {
  const headerMatches = sheetData.headers.filter((header) =>
    isHeaderMappedToAssignment(header, assignmentName, assignmentSlug, unitType),
  )

  const labels = new Set<string>()
  if (headerMatches.length === 0) {
    return []
  }

  for (const row of sheetData.rawRows) {
    for (const header of headerMatches) {
      const rawValue = normalize(String(row[header] ?? ''))
      if (!rawValue) continue

      labels.add(rawValue)

      if (labels.size >= 200) {
        return Array.from(labels)
      }
    }
  }

  return Array.from(labels)
}

function deriveEstimateMinutes(entry: ManifestAssignmentNode): { buildUp: number; wireList: number } {
  const rowCount = Math.max(0, entry.rowCount || 0)
  const swsType = normalizeUpper(entry.swsType)

  const buildUpFactor = swsType.includes('PANEL') ? 1.7 : swsType.includes('BOX') ? 1.3 : 1.1
  const wireListFactor = swsType.includes('PANEL') ? 1.1 : swsType.includes('BOX') ? 0.85 : 0.75

  return {
    buildUp: rowCount * buildUpFactor,
    wireList: rowCount * wireListFactor,
  }
}

function deriveUnmappedLayoutReason(
  assignment: ManifestAssignmentNode,
  layoutPages: SlimLayoutPage[],
 ): string {
  if (layoutPages.length === 0) {
    return "No layout pages were available during manifest regeneration.";
  }

  const matchingUnitPages = layoutPages.filter((page) =>
    extractUnitType(page.title) && extractUnitType(page.title) === extractUnitType(assignment.sheetName),
  );

  if (matchingUnitPages.length === 0) {
    return `No high-confidence layout page matched ${assignment.sheetName}.`;
  }

  return `Layout pages exist for ${assignment.sheetName}, but none passed high-confidence structural matching.`;
}

export async function buildManifestAssignmentSummaries(
  projectRoot: string,
  manifest: ProjectManifest,
): Promise<Record<string, ManifestAssignmentNode>> {
  const artifactRoot = await resolveArtifactRoot(projectRoot)
  const pathPrefix = artifactRoot === projectRoot ? '' : 'state/'

  const layoutPagesDoc = await readJson<{ pages?: SlimLayoutPage[] }>(path.join(artifactRoot, 'layout-pages.json'))
  const layoutPages = Array.isArray(layoutPagesDoc?.pages) ? layoutPagesDoc.pages : []
  const layoutIndex = buildNormalizedLayoutPageIndex(layoutPages)

  // Load UBP reference index for reference-backed matching (panel/box/unit signals)
  const ubpRefPath = path.join(process.cwd(), 'Share', 'References', 'layout-unit-box-panel-reference.json')
  const ubpRaw = await readJson<unknown>(ubpRefPath)
  const ubpIndex: UbpReferenceIndex | undefined = ubpRaw ? buildUbpReferenceIndex(ubpRaw) : undefined

  const projectUnitTypes: string[] = [
    ...(manifest.unitTypes ?? []),
    ...(manifest.unitType ? [manifest.unitType] : []),
  ].filter(Boolean)

  const devicePartsDoc = await readJson<{
    devices?: Record<string, { partNumber?: string; sheet?: string }>
  }>(path.join(artifactRoot, 'device-part-numbers.json'))
  const devices = devicePartsDoc?.devices ?? {}

  const [whiteSheetData, blueSheetData] = await Promise.all([
    readLabelSheetData(artifactRoot, 'white-labels'),
    readLabelSheetData(artifactRoot, 'blue-labels'),
  ])

  const brandingExports = await readJson<{
    combinedRelativePath?: string
  }>(path.join(projectRoot, 'exports', 'branding', 'manifest.json'))
  const wireExports = await readJson<{
    sheetExports?: Array<{ sheetName?: string; relativePath?: string }>
  }>(path.join(projectRoot, 'exports', 'wire-lists', 'manifest.json'))

  const updatedNodes: Record<string, ManifestAssignmentNode> = { ...manifest.assignments }

  for (const assignment of Object.values(manifest.assignments)) {
    const inferredLayout = matchAssignmentToLayoutPages(assignment, layoutIndex, ubpIndex, projectUnitTypes)
    const matchedLayout = inferredLayout
      ?? (
        assignment.layout?.primaryPage || (assignment.layout?.pages?.length ?? 0) > 0
          ? assignment.layout
          : {
              pages: [],
              unmappedReason: deriveUnmappedLayoutReason(assignment, layoutPages),
            }
      )
    const primaryPage = matchedLayout?.primaryPage
    const mappedPage = primaryPage
      ? layoutPages.find(page => page.pageNumber === primaryPage.pageNumber)
      : undefined

    const referenceUnitType = ubpIndex
      ? inferUnitTypeByUbpReference(
          {
            panelNumber: primaryPage?.panelNumber ?? mappedPage?.panelNumber,
            boxNumber: primaryPage?.boxNumber ?? mappedPage?.boxNumber,
            unitType: primaryPage?.unitType ?? mappedPage?.unitType,
          },
          assignment.sheetName,
          projectUnitTypes,
          ubpIndex,
        )
      : undefined

    const unitType = normalize(primaryPage?.unitType)
      || normalize(mappedPage?.unitType)
      || normalize(referenceUnitType)
      || extractUnitType(primaryPage?.title)
      || extractUnitType(assignment.sheetName)
      || normalize(assignment.unitType)

    // Keep only same-unit alternatives once a unit has been resolved.
    const normalizedLayout = matchedLayout
      ? {
          ...matchedLayout,
          pages: (matchedLayout.pages ?? [])
            .map((page) => ({
              ...page,
              unitType: normalize(page.unitType) || unitType || undefined,
            }))
            .filter((page) => !unitType || !page.unitType || normalize(page.unitType) === unitType),
        }
      : matchedLayout

    if (normalizedLayout?.pages?.length) {
      normalizedLayout.primaryPage = normalizedLayout.pages[0]
    }

    const persistedRailGroups = mappedPage?.railGroups ?? []

    const rails = Array.from(
      new Set(
        [
          ...(mappedPage?.rails ?? []),
          ...persistedRailGroups.map(group => ({ railLabel: group.railLabel ?? '' })),
        ]
          .map(rail => normalize(rail.railLabel))
          .filter(Boolean),
      ),
    )
    const panducts = Array.from(new Set((mappedPage?.panducts ?? []).map(panduct => normalize(panduct.label)).filter(Boolean)))

    const whiteLabels = collectLabelsFromSheetData(
      whiteSheetData,
      assignment.sheetName,
      assignment.sheetSlug,
      unitType,
    )
    const blueLabels = collectLabelsFromSheetData(
      blueSheetData,
      assignment.sheetName,
      assignment.sheetSlug,
      unitType,
    )

    const devicePartNumbers = new Set<string>()
    const assignmentSheetUpper = normalizeUpper(assignment.sheetName)
    for (const device of Object.values(devices)) {
      if (normalizeUpper(device.sheet) !== assignmentSheetUpper) continue
      for (const token of normalize(device.partNumber).split(/[\n,;]+/)) {
        const part = normalizePartToken(token)
        if (part) devicePartNumbers.add(part)
      }
    }

    const wireListPDFPath = wireExports?.sheetExports
      ?.find(entry => normalizeUpper(entry.sheetName) === assignmentSheetUpper)
      ?.relativePath
    const wireListSchemaRelativePath = `${pathPrefix}sheets/${assignment.sheetSlug}.json`
    const brandListSchemaRelativePath = `${pathPrefix}wire-brand-list/${assignment.sheetSlug}.json`
    const buildUpSWSSchemaRelativePath = `${pathPrefix}build-up-sws-schema/${assignment.sheetSlug}.json`
    const [hasBrandListSchema, hasBuildUpSchema] = await Promise.all([
      fileExists(path.join(projectRoot, brandListSchemaRelativePath)),
      fileExists(path.join(projectRoot, buildUpSWSSchemaRelativePath)),
    ])

    const estimates = deriveEstimateMinutes(assignment)

    // Look up this assignment in the UBP cross-project reference to get
    // validated swsType and boxSide values (unit-type-scoped, then global fallback).
    const ubpEntry = ubpIndex
      ? lookupUbpAssignment(assignment.sheetName, unitType, ubpIndex)
      : null
    const resolvedSwsType = ubpEntry?.swsType || assignment.swsType
    const resolvedBoxSide = ubpEntry?.boxSide || assignment.boxSide

    // Prefer the UBP reference config (has visibility flags); fall back to manifest strings.
    // Normalize both string[] (legacy) and ExternalLocationConfig[] inputs.
    const rawLocations: unknown[] = Array.isArray(ubpEntry?.externalLocations) && ubpEntry.externalLocations.length > 0
      ? ubpEntry.externalLocations
      : Array.isArray(assignment.externalLocations)
        ? assignment.externalLocations
        : []
    const seenLocations = new Set<string>()
    const resolvedExternalLocations = rawLocations
      .map((item) => {
        if (typeof item === 'string') {
          const loc = normalize(item)
          return loc ? { location: loc, wireListVisible: true, brandingVisible: true } : null
        }
        const entry = item as { location?: string; wireListVisible?: boolean; brandingVisible?: boolean }
        const loc = normalize(entry?.location ?? '')
        return loc ? { location: loc, wireListVisible: entry.wireListVisible ?? true, brandingVisible: entry.brandingVisible ?? true } : null
      })
      .filter((item): item is NonNullable<typeof item> => {
        if (!item) return false
        if (seenLocations.has(item.location)) return false
        seenLocations.add(item.location)
        return true
      })

    updatedNodes[assignment.sheetSlug] = {
      ...assignment,
      unitType: unitType || undefined,
      swsType: resolvedSwsType,
      boxSide: resolvedBoxSide || undefined,
      externalLocations: resolvedExternalLocations,
      panducts,
      rails,
      whiteLabels,
      blueLabels,
      partNumbers: Array.from(devicePartNumbers).sort((a, b) => a.localeCompare(b)),
      files: {
        wireListPDFPath,
        wireListSchemaPath: wireListSchemaRelativePath,
        brandListSchemaPath: hasBrandListSchema ? brandListSchemaRelativePath : undefined,
        brandListExcelPath: brandingExports?.combinedRelativePath,
        buildUpSWSSchemaPath: hasBuildUpSchema ? buildUpSWSSchemaRelativePath : undefined,
      },
      buildUpEstTime: formatMinutes(estimates.buildUp),
      wireListEstTime: formatMinutes(estimates.wireList),
      layout: normalizedLayout,
    }
  }

  return updatedNodes
}
