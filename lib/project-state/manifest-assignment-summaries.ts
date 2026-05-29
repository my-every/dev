import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { PDFDocument } from 'pdf-lib'
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

function formatValuesWithQty(values: string[]): string[] {
  const counts = new Map<string, number>()
  const order: string[] = []

  for (const rawValue of values) {
    const value = normalize(rawValue)
    if (!value) continue

    if (!counts.has(value)) {
      counts.set(value, 1)
      order.push(value)
    } else {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  return order.map((value) => {
    const qty = counts.get(value) ?? 0
    return qty > 1 ? `${value} x${qty}` : value
  })
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

function decodeDataImageUrl(dataUrl: string): { buffer: Buffer; extension: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/i.exec(dataUrl)
  if (!match) {
    return null
  }

  const mimeType = match[1].toLowerCase()
  const base64 = match[2]
  const extension = mimeType === 'image/png'
    ? 'png'
    : mimeType === 'image/webp'
      ? 'webp'
      : mimeType === 'image/gif'
        ? 'gif'
        : 'jpg'

  try {
    return {
      buffer: Buffer.from(base64, 'base64'),
      extension,
    }
  } catch {
    return null
  }
}

async function persistLayoutPageExports(
  projectRoot: string,
  pages: SlimLayoutPage[],
): Promise<{ imagePathByPage: Map<number, string>; pdfPathByPage: Map<number, string> }> {
  const exportDir = path.join(projectRoot, 'exports', 'layout-pages')
  const imagePathByPage = new Map<number, string>()
  const pdfPathByPage = new Map<number, string>()

  await fs.mkdir(exportDir, { recursive: true })

  for (const page of pages) {
    const image = decodeDataImageUrl(page.imageUrl)
    if (!image) {
      continue
    }

    const imageFileName = `page-${page.pageNumber}.${image.extension}`
    const imageFilePath = path.join(exportDir, imageFileName)
    await fs.writeFile(imageFilePath, image.buffer)
    imagePathByPage.set(page.pageNumber, `exports/layout-pages/${imageFileName}`)

    const pdfFileName = `page-${page.pageNumber}.pdf`
    const pdfFilePath = path.join(exportDir, pdfFileName)

    const pdf = await PDFDocument.create()
    let embeddedImage
    if (image.extension === 'png') {
      embeddedImage = await pdf.embedPng(image.buffer)
    } else {
      embeddedImage = await pdf.embedJpg(image.buffer)
    }
    const pdfPage = pdf.addPage([embeddedImage.width, embeddedImage.height])
    pdfPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: embeddedImage.width,
      height: embeddedImage.height,
    })
    await fs.writeFile(pdfFilePath, Buffer.from(await pdf.save()))
    pdfPathByPage.set(page.pageNumber, `exports/layout-pages/${pdfFileName}`)
  }

  const keep = new Set([
    ...Array.from(imagePathByPage.values()).map((value) => path.basename(value)),
    ...Array.from(pdfPathByPage.values()).map((value) => path.basename(value)),
  ])
  const staleEntries = await fs.readdir(exportDir, { withFileTypes: true }).catch(() => [])
  for (const entry of staleEntries) {
    if (!entry.isFile()) continue
    if (!/^page-\d+\.(?:jpg|jpeg|png|webp|gif|pdf)$/i.test(entry.name)) continue
    if (keep.has(entry.name)) continue
    await fs.rm(path.join(exportDir, entry.name), { force: true })
  }

  return { imagePathByPage, pdfPathByPage }
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

async function readExternalLocationsFromPrintSchema(
  artifactRoot: string,
  assignmentSlug: string,
): Promise<string[]> {
  const schema = await readJson<{
    pages?: Array<{
      locationGroups?: Array<{ location?: string; isExternal?: boolean }>
    }>
  }>(path.join(artifactRoot, 'wire-list-print-schema', `${assignmentSlug}.json`))

  if (!Array.isArray(schema?.pages)) {
    return []
  }

  const locations = new Set<string>()
  for (const page of schema.pages) {
    if (!Array.isArray(page?.locationGroups)) continue
    for (const group of page.locationGroups) {
      if (!group?.isExternal) continue
      const location = normalize(group.location)
      if (!location) continue
      locations.add(location)
    }
  }

  return Array.from(locations)
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

  const layoutPagesDoc = await readJson<{ pages?: SlimLayoutPage[] }>(path.join(artifactRoot, 'layout-pages.json'))
  const layoutPagesIndexDoc = await readJson<{ pages?: Array<{ pageNumber?: number; imageUrl?: string }> }>(
    path.join(artifactRoot, 'layout-pages.index.json'),
  )
  const indexedImageByPage = new Map<number, string>()
  for (const page of layoutPagesIndexDoc?.pages ?? []) {
    if (typeof page?.pageNumber !== 'number') continue
    const imageUrl = normalize(page.imageUrl)
    if (!imageUrl) continue
    indexedImageByPage.set(page.pageNumber, imageUrl)
  }

  const layoutPages = Array.isArray(layoutPagesDoc?.pages)
    ? layoutPagesDoc.pages.map((page) => ({
      ...page,
      imageUrl: normalize(page.imageUrl) || indexedImageByPage.get(page.pageNumber) || '',
    }))
    : []
  const layoutIndex = buildNormalizedLayoutPageIndex(layoutPages)
  const { imagePathByPage: layoutImagePathByPage, pdfPathByPage: layoutPdfPathByPage } =
    await persistLayoutPageExports(projectRoot, layoutPages)

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

  const [whiteSheetData, blueSheetData, heatShrinkSheetData] = await Promise.all([
    readLabelSheetData(artifactRoot, 'white-labels'),
    readLabelSheetData(artifactRoot, 'blue-labels'),
    readLabelSheetData(artifactRoot, 'heat-shrink-labels'),
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
    const layoutImageUrlPath = primaryPage
      ? layoutImagePathByPage.get(primaryPage.pageNumber)
      : undefined
    const layoutPdfPath = primaryPage
      ? layoutPdfPathByPage.get(primaryPage.pageNumber)
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

    // User's explicit unitType takes precedence over inferred values
    const unitType = normalize(assignment.unitType)
      || normalize(primaryPage?.unitType)
      || normalize(mappedPage?.unitType)
      || normalize(referenceUnitType)
      || extractUnitType(primaryPage?.title)
      || extractUnitType(assignment.sheetName)

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

    const railsFromLayout = (mappedPage?.rails ?? []).map((rail) => rail.railLabel ?? '')
    const railsSource = railsFromLayout.length > 0
      ? railsFromLayout
      : persistedRailGroups.map((group) => group.railLabel ?? '')
    const rails = formatValuesWithQty(railsSource)

    const panductFromLayout = (mappedPage?.panducts ?? []).map((panduct) => panduct.label ?? '')
    const panductSource = panductFromLayout.length > 0
      ? panductFromLayout
      : []
    const panducts = formatValuesWithQty(panductSource)

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
    const heatShrinkLabels = collectLabelsFromSheetData(
      heatShrinkSheetData,
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
    const wireListSchemaRelativePath = `state/wire-list-print-schema/${assignment.sheetSlug}.json`
    const ipvWireListSchemaRelativePath = `state/ipv/${assignment.sheetSlug}-ipv.json`
    const brandListSchemaRelativePath = `state/wire-brand-list/${assignment.sheetSlug}.json`
    const buildUpSWSSchemaRelativePath = `state/build-up-sws-schema/${assignment.sheetSlug}.json`
    const [hasBrandListSchema, hasBuildUpSchema] = await Promise.all([
      fileExists(path.join(projectRoot, brandListSchemaRelativePath)),
      fileExists(path.join(projectRoot, buildUpSWSSchemaRelativePath)),
    ])

    const schemaExternalLocations = await readExternalLocationsFromPrintSchema(
      artifactRoot,
      assignment.sheetSlug,
    )

    // Look up this assignment in the UBP cross-project reference to get
    // validated swsType and boxSide values (unit-type-scoped, then global fallback).
    const ubpEntry = ubpIndex
      ? lookupUbpAssignment(assignment.sheetName, unitType, ubpIndex)
      : null
    const resolvedSwsType = ubpEntry?.swsType || assignment.swsType
    const resolvedBoxSide = ubpEntry?.boxSide || assignment.boxSide

    // Build a lookup of user-saved visibility flags keyed by normalized location name.
    // This is always consulted so that wireListVisible / brandingVisible edits survive enrichment.
    const savedVisibilityByLocation = new Map<string, { wireListVisible: boolean; brandingVisible: boolean }>()
    for (const item of Array.isArray(assignment.externalLocations) ? assignment.externalLocations : []) {
      const entry = item as { location?: string; wireListVisible?: boolean; brandingVisible?: boolean }
      const loc = normalize(entry?.location ?? '')
      if (loc) {
        savedVisibilityByLocation.set(loc.toUpperCase(), {
          wireListVisible: entry.wireListVisible ?? true,
          brandingVisible: entry.brandingVisible ?? true,
        })
      }
    }

    // Use UBP reference for location structure when available; otherwise keep manifest locations.
    const rawLocations: unknown[] = [
      ...schemaExternalLocations.map((location) => ({ location })),
      ...(Array.isArray(ubpEntry?.externalLocations) ? ubpEntry.externalLocations : []),
      ...(Array.isArray(assignment.externalLocations) ? assignment.externalLocations : []),
    ]
    const seenLocations = new Set<string>()
    const resolvedExternalLocations = rawLocations
      .map((item) => {
        const loc = normalize(typeof item === 'string' ? item : (item as { location?: string })?.location ?? '')
        if (!loc) return null
        const saved = savedVisibilityByLocation.get(loc.toUpperCase())
        const ubpItem = typeof item === 'object' && item !== null ? item as { wireListVisible?: boolean; brandingVisible?: boolean } : null
        return {
          location: loc,
          wireListVisible: saved?.wireListVisible ?? ubpItem?.wireListVisible ?? true,
          brandingVisible: saved?.brandingVisible ?? ubpItem?.brandingVisible ?? true,
        }
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
      heatShrinkLabels,
      partNumbers: Array.from(devicePartNumbers).sort((a, b) => a.localeCompare(b)),
      files: {
        wireListPDFPath,
        wireListSchemaPath: wireListSchemaRelativePath,
        ipvWireListSchemaPath: ipvWireListSchemaRelativePath,
        brandListSchemaPath: hasBrandListSchema ? brandListSchemaRelativePath : undefined,
        brandListExcelPath: brandingExports?.combinedRelativePath,
        buildUpSWSSchemaPath: hasBuildUpSchema ? buildUpSWSSchemaRelativePath : undefined,
        layoutImagePath: layoutImageUrlPath,
        layoutPdfPath,
      },
      layoutImageUrlPath,
      buildUpEstTime: undefined,
      wireListEstTime: undefined,
      normalizedTitle: normalizedLayout?.primaryPage?.normalizedTitle ?? assignment.normalizedTitle,
      panelNumber: normalizedLayout?.primaryPage?.panelNumber ?? assignment.panelNumber,
      boxNumber: normalizedLayout?.primaryPage?.boxNumber ?? assignment.boxNumber,
      layout: normalizedLayout,
    }
  }

  return updatedNodes
}
