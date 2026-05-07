import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import {
  extractProjectNumberFromLegalFolder,
  getProjectNameFromLegalFolder,
  parseLegalDrawingsFileVersion,
} from '@/lib/legal-drawings/discovery'
import {
  type FileRevision,
  type ProjectRevisionHistory,
  type ProjectRevisionTreeRow,
  type RevisionFilesystemNode,
  type RevisionInfo,
  type RevisionPairState,
  type RevisionScanRequest,
  type RevisionScanResult,
  type RevisionScanScope,
  type RevisionValidationSummary,
  getLatestRevision,
  getPreviousRevision,
  isLayoutFile,
  isWireListFile,
  parseRevisionFromFilename,
  sortRevisions,
} from '@/lib/revision/types'

const DEFAULT_LEGAL_SOURCE_ROOT = String.raw`S:\Legal Drawings`
const DEFAULT_BRAND_SOURCE_ROOT = String.raw`S:\#Depts\380\6SIGMABRANDLIST\BRANDING\Projects Folder`
const STALE_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 30

function nowMs() {
  return Date.now()
}

function elapsedMs(startMs: number) {
  return nowMs() - startMs
}

interface SourceRoots {
  legalSourceRoot: string | null
  brandSourceRoot: string | null
}

interface ScannedFile {
  absolutePath: string
  fileName: string
  extension: string
  modifiedTimeMs: number
  sizeBytes: number
  fileTypeIndicator: RevisionFilesystemNode['fileTypeIndicator']
  revisionInfo: RevisionInfo
}

interface ProjectAggregate {
  pdNumber: string
  projectName: string
  legalFolderName: string | null
  legalRootPath: string | null
  brandFolderName: string | null
  brandRootPath: string | null
  files: ScannedFile[]
}

function normalizeScope(scope: RevisionScanScope | undefined): RevisionScanScope {
  if (scope === 'legal' || scope === 'brand' || scope === 'both') {
    return scope
  }

  return 'both'
}

async function safeStat(targetPath: string) {
  try {
    return await fs.stat(targetPath)
  } catch {
    return null
  }
}

async function resolveLegalProjectsRoot(sourceRoot: string): Promise<string> {
  const drawingsVariants = ['Drawings', 'Drawing']
  for (const variant of drawingsVariants) {
    const candidatePath = path.join(sourceRoot, variant)
    const candidateStats = await safeStat(candidatePath)
    if (candidateStats?.isDirectory()) {
      return candidatePath
    }
  }

  return sourceRoot
}

function normalizePathFromRequest(inputPath: string | null | undefined): string | null {
  if (!inputPath) {
    return null
  }

  const trimmed = inputPath.trim()
  if (!trimmed) {
    return null
  }

  return path.normalize(trimmed)
}

function inferFileTypeIndicator(fileName: string): RevisionFilesystemNode['fileTypeIndicator'] {
  const ext = path.extname(fileName).toLowerCase()
  const baseName = path.basename(fileName, ext).toLowerCase()
  const compact = baseName.replace(/[^a-z0-9]+/g, '')

  if (isLayoutFile(fileName)) {
    return 'layout-pdf'
  }

  if (isWireListFile(fileName)) {
    return 'wire-list'
  }

  if (compact.includes('ucpwlcompare')) {
    return 'compare-wire-list'
  }

  if ([`.xlsx`, `.xlsm`, `.xls`, '.xlsb'].includes(ext) && compact.includes('brand')) {
    return 'brand-list'
  }

  return 'other'
}

async function collectFilesRecursively(rootPath: string): Promise<ScannedFile[]> {
  const stack: string[] = [rootPath]
  const files: ScannedFile[] = []

  while (stack.length > 0) {
    const current = stack.pop()
    if (!current) continue

    let entries: Awaited<ReturnType<typeof fs.readdir>>
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(fullPath)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const stats = await safeStat(fullPath)
      if (!stats?.isFile()) {
        continue
      }

      const revisionInfo = parseRevisionFromFilename(entry.name)
      files.push({
        absolutePath: fullPath,
        fileName: entry.name,
        extension: path.extname(entry.name).toLowerCase(),
        modifiedTimeMs: stats.mtimeMs,
        sizeBytes: stats.size,
        fileTypeIndicator: inferFileTypeIndicator(entry.name),
        revisionInfo,
      })
    }
  }

  files.sort((left, right) => right.modifiedTimeMs - left.modifiedTimeMs)
  return files
}

function fileToRevision(file: ScannedFile): FileRevision {
  const category: FileRevision['category'] =
    file.fileTypeIndicator === 'layout-pdf'
      ? 'LAYOUT'
      : file.fileTypeIndicator === 'wire-list' || file.fileTypeIndicator === 'compare-wire-list'
        ? 'WIRE_LIST'
        : file.fileTypeIndicator === 'brand-list'
          ? 'REFERENCE'
          : 'OTHER'

  return {
    filename: file.fileName,
    filePath: file.absolutePath,
    revisionInfo: file.revisionInfo,
    category,
    lastModified: new Date(file.modifiedTimeMs).toISOString(),
    fileSize: file.sizeBytes,
  }
}

function buildValidationSummary(
  pairState: RevisionPairState,
  files: ScannedFile[],
  hasBrandSource: boolean,
  nowMs: number,
): RevisionValidationSummary {
  const hasCompareWireListSheet = files.some((file) => file.fileTypeIndicator === 'compare-wire-list')
  const hasUcpLayoutPdf = files.some((file) => file.fileTypeIndicator === 'layout-pdf')
  const missingRequiredLegalAssets = !pairState.latestWireListRevision || !pairState.latestLayoutRevision

  const latestModified = files[0]?.modifiedTimeMs ?? 0
  const revisionMetadataStale = latestModified > 0 ? nowMs - latestModified > STALE_THRESHOLD_MS : true

  const brandListRevisionsIncomplete = hasBrandSource
    ? !pairState.latestBrandListRevision
    : false

  return {
    hasCompareWireListSheet,
    hasUcpLayoutPdf,
    hasMatchingRevisionPairs: pairState.comparisonState === 'ready',
    missingRequiredLegalAssets,
    brandListRevisionsIncomplete,
    revisionMetadataStale,
  }
}

function resolveComparisonState(
  latestWire: FileRevision | null,
  latestLayout: FileRevision | null,
): RevisionPairState['comparisonState'] {
  if (!latestWire || !latestLayout) {
    return latestWire || latestLayout ? 'partial' : 'missing'
  }

  const wireBase = latestWire.revisionInfo.revision
  const layoutBase = latestLayout.revisionInfo.revision

  if (wireBase && layoutBase && wireBase !== 'unknown' && layoutBase !== 'unknown' && wireBase === layoutBase) {
    return 'ready'
  }

  // If both are present but revision tags are inconsistent, we still allow a partial state.
  return 'partial'
}

function buildRevisionPairState(files: ScannedFile[]): RevisionPairState {
  const wireRevisions = sortRevisions(
    files
      .filter((file) => file.fileTypeIndicator === 'wire-list' || file.fileTypeIndicator === 'compare-wire-list')
      .map(fileToRevision),
  )
  const layoutRevisions = sortRevisions(
    files
      .filter((file) => file.fileTypeIndicator === 'layout-pdf')
      .map(fileToRevision),
  )
  const brandRevisions = sortRevisions(
    files
      .filter((file) => file.fileTypeIndicator === 'brand-list')
      .map(fileToRevision),
  )

  const latestWire = getLatestRevision(wireRevisions)
  const latestLayout = getLatestRevision(layoutRevisions)
  const latestBrand = getLatestRevision(brandRevisions)

  const previousWire = getPreviousRevision(wireRevisions)
  const previousLayout = getPreviousRevision(layoutRevisions)
  const previousBrand = getPreviousRevision(brandRevisions)

  return {
    latestWireListRevision: latestWire?.revisionInfo.displayVersion ?? null,
    latestLayoutRevision: latestLayout?.revisionInfo.displayVersion ?? null,
    latestBrandListRevision: latestBrand?.revisionInfo.displayVersion ?? null,
    previousWireListRevision: previousWire?.revisionInfo.displayVersion ?? null,
    previousLayoutRevision: previousLayout?.revisionInfo.displayVersion ?? null,
    previousBrandListRevision: previousBrand?.revisionInfo.displayVersion ?? null,
    comparisonState: resolveComparisonState(latestWire, latestLayout),
  }
}

function fileToTreeNode(file: ScannedFile): RevisionFilesystemNode {
  return {
    id: `${file.absolutePath}:${file.modifiedTimeMs}`,
    name: file.fileName,
    type: 'file',
    absolutePath: file.absolutePath,
    modifiedTimeMs: file.modifiedTimeMs,
    modifiedAt: new Date(file.modifiedTimeMs).toISOString(),
    sizeBytes: file.sizeBytes,
    extension: file.extension,
    fileTypeIndicator: file.fileTypeIndicator,
    validationStatus: 'valid',
    readinessStatus: 'ready',
    revisionInfo: file.revisionInfo,
  }
}

async function discoverLegalProjects(sourceRoot: string): Promise<Map<string, ProjectAggregate>> {
  const map = new Map<string, ProjectAggregate>()
  const legalRoot = await resolveLegalProjectsRoot(sourceRoot)
  const stats = await safeStat(legalRoot)
  if (!stats?.isDirectory()) {
    return map
  }

  const entries = await fs.readdir(legalRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const pdNumber = extractProjectNumberFromLegalFolder(entry.name)
    const projectName = getProjectNameFromLegalFolder(entry.name)
    const rootPath = path.join(legalRoot, entry.name)
    const files = await collectFilesRecursively(rootPath)

    map.set(pdNumber, {
      pdNumber,
      projectName,
      legalFolderName: entry.name,
      legalRootPath: rootPath,
      brandFolderName: null,
      brandRootPath: null,
      files,
    })
  }

  return map
}

function parseBrandProjectFolder(entryName: string): { pdNumber: string; projectName: string } | null {
  const separatorIndex = entryName.indexOf('_')
  if (separatorIndex <= 0) {
    return null
  }

  const pdNumber = entryName.slice(0, separatorIndex).trim().toUpperCase()
  if (!pdNumber) {
    return null
  }

  const projectName = entryName.slice(separatorIndex + 1).replace(/[_-]+/g, ' ').trim() || pdNumber
  return { pdNumber, projectName }
}

async function mergeBrandProjects(
  aggregates: Map<string, ProjectAggregate>,
  sourceRoot: string,
): Promise<void> {
  const stats = await safeStat(sourceRoot)
  if (!stats?.isDirectory()) {
    return
  }

  const entries = await fs.readdir(sourceRoot, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory()) continue

    const parsed = parseBrandProjectFolder(entry.name)
    if (!parsed) continue

    const rootPath = path.join(sourceRoot, entry.name)
    const files = await collectFilesRecursively(rootPath)
    const existing = aggregates.get(parsed.pdNumber)

    if (existing) {
      existing.brandFolderName = entry.name
      existing.brandRootPath = rootPath
      existing.files.push(...files)
      existing.files.sort((left, right) => right.modifiedTimeMs - left.modifiedTimeMs)
      continue
    }

    aggregates.set(parsed.pdNumber, {
      pdNumber: parsed.pdNumber,
      projectName: parsed.projectName,
      legalFolderName: null,
      legalRootPath: null,
      brandFolderName: entry.name,
      brandRootPath: rootPath,
      files,
    })
  }
}

function filterByRange(files: ScannedFile[], fromTimeMs: number, toTimeMs: number): ScannedFile[] {
  return files.filter((file) => file.modifiedTimeMs >= fromTimeMs && file.modifiedTimeMs <= toTimeMs)
}

function resolveReadiness(validation: RevisionValidationSummary): ProjectRevisionTreeRow['readiness'] {
  if (validation.missingRequiredLegalAssets || validation.brandListRevisionsIncomplete) {
    return 'blocked'
  }

  if (validation.revisionMetadataStale || !validation.hasMatchingRevisionPairs) {
    return 'partial'
  }

  return 'ready'
}

export async function resolveRevisionSourceRoots(
  request: RevisionScanRequest,
): Promise<SourceRoots> {
  const legalSourceRoot = normalizePathFromRequest(request.legalSourceRoot) ?? path.normalize(DEFAULT_LEGAL_SOURCE_ROOT)
  const brandSourceRoot = normalizePathFromRequest(request.brandSourceRoot) ?? path.normalize(DEFAULT_BRAND_SOURCE_ROOT)

  return {
    legalSourceRoot,
    brandSourceRoot,
  }
}

function normalizeRequestBounds(request: RevisionScanRequest): { fromTimeMs: number; toTimeMs: number } {
  const now = Date.now()
  const fallbackFrom = new Date(new Date().getFullYear(), 0, 1).getTime()

  const fromTimeMs = Number.isFinite(request.fromTimeMs) ? Number(request.fromTimeMs) : fallbackFrom
  const toTimeMs = Number.isFinite(request.toTimeMs) ? Number(request.toTimeMs) : now

  return {
    fromTimeMs: Math.min(fromTimeMs, toTimeMs),
    toTimeMs: Math.max(fromTimeMs, toTimeMs),
  }
}

export async function scanProjectRevisionsFromFilesystem(
  request: RevisionScanRequest = {},
): Promise<RevisionScanResult> {
  const startedAt = nowMs()
  const scope = normalizeScope(request.scope)
  const { fromTimeMs, toTimeMs } = normalizeRequestBounds(request)
  const sourceRoots = await resolveRevisionSourceRoots(request)

  console.info(
    '[revision/filesystem-scan] Start',
    JSON.stringify({
      scope,
      fromTimeMs,
      toTimeMs,
      legalSourceRoot: sourceRoots.legalSourceRoot,
      brandSourceRoot: sourceRoots.brandSourceRoot,
      projectFilter: request.projectFilter?.trim() || null,
    }),
  )

  const projectFilter = request.projectFilter?.trim().toUpperCase() || null

  const aggregates = new Map<string, ProjectAggregate>()

  if (scope === 'legal' || scope === 'both') {
    const legalScanStartedAt = nowMs()
    const legalProjects = await discoverLegalProjects(sourceRoots.legalSourceRoot ?? '')
    for (const [pdNumber, aggregate] of legalProjects.entries()) {
      aggregates.set(pdNumber, aggregate)
    }
    console.info(
      '[revision/filesystem-scan] Legal scan complete',
      JSON.stringify({
        durationMs: elapsedMs(legalScanStartedAt),
        discoveredProjects: legalProjects.size,
      }),
    )
  }

  if (scope === 'brand' || scope === 'both') {
    const brandScanStartedAt = nowMs()
    const aggregateCountBefore = aggregates.size
    await mergeBrandProjects(aggregates, sourceRoots.brandSourceRoot ?? '')
    console.info(
      '[revision/filesystem-scan] Brand merge complete',
      JSON.stringify({
        durationMs: elapsedMs(brandScanStartedAt),
        aggregateCountBefore,
        aggregateCountAfter: aggregates.size,
      }),
    )
  }

  const nowMs = Date.now()
  const projects: ProjectRevisionTreeRow[] = []

  for (const aggregate of aggregates.values()) {
    if (projectFilter) {
      const label = `${aggregate.pdNumber}_${aggregate.projectName}`.toUpperCase()
      if (!label.includes(projectFilter) && aggregate.pdNumber !== projectFilter) {
        continue
      }
    }

    const inRangeFiles = filterByRange(aggregate.files, fromTimeMs, toTimeMs)
    const candidateFiles = inRangeFiles.length > 0 ? inRangeFiles : aggregate.files

    const revisionPairState = buildRevisionPairState(candidateFiles)
    const validation = buildValidationSummary(
      revisionPairState,
      candidateFiles,
      Boolean(aggregate.brandRootPath),
      nowMs,
    )

    const latestModifiedTimeMs = candidateFiles[0]?.modifiedTimeMs ?? 0

    projects.push({
      projectId: `pd-${aggregate.pdNumber.toLowerCase()}`,
      pdNumber: aggregate.pdNumber,
      projectName: aggregate.projectName,
      rootLabel: `${aggregate.pdNumber}_${aggregate.projectName}`,
      legalFolderName: aggregate.legalFolderName,
      brandFolderName: aggregate.brandFolderName,
      revisionPairState,
      validation,
      readiness: resolveReadiness(validation),
      filesNewestFirst: candidateFiles.map(fileToTreeNode),
      latestModifiedTimeMs,
      latestModifiedAt: latestModifiedTimeMs ? new Date(latestModifiedTimeMs).toISOString() : null,
      discoveredFileCount: candidateFiles.length,
    })
  }

  projects.sort((left, right) => right.latestModifiedTimeMs - left.latestModifiedTimeMs)

  console.info(
    '[revision/filesystem-scan] Complete',
    JSON.stringify({
      durationMs: elapsedMs(startedAt),
      scope,
      aggregateCount: aggregates.size,
      projectCount: projects.length,
      hasProjectFilter: Boolean(projectFilter),
    }),
  )

  return {
    generatedAt: new Date().toISOString(),
    scope,
    fromTimeMs,
    toTimeMs,
    legalSourceRoot: sourceRoots.legalSourceRoot,
    brandSourceRoot: scope === 'legal' ? null : sourceRoots.brandSourceRoot,
    projects,
  }
}

export function toProjectRevisionHistory(row: ProjectRevisionTreeRow): ProjectRevisionHistory {
  const wireListRevisions = row.filesNewestFirst
    .filter((node) => node.fileTypeIndicator === 'wire-list' || node.fileTypeIndicator === 'compare-wire-list')
    .map((node) => ({
      filename: node.name,
      filePath: node.absolutePath,
      revisionInfo: node.revisionInfo ?? parseRevisionFromFilename(node.name),
      category: 'WIRE_LIST' as const,
      lastModified: node.modifiedAt,
      fileSize: node.sizeBytes,
    }))

  const layoutRevisions = row.filesNewestFirst
    .filter((node) => node.fileTypeIndicator === 'layout-pdf')
    .map((node) => ({
      filename: node.name,
      filePath: node.absolutePath,
      revisionInfo: node.revisionInfo ?? parseRevisionFromFilename(node.name),
      category: 'LAYOUT' as const,
      lastModified: node.modifiedAt,
      fileSize: node.sizeBytes,
    }))

  return {
    projectId: row.projectId,
    folderName: row.legalFolderName ?? row.rootLabel,
    pdNumber: row.pdNumber,
    wireListRevisions,
    layoutRevisions,
    currentWireList: getLatestRevision(wireListRevisions),
    currentLayout: getLatestRevision(layoutRevisions),
    previousWireList: getPreviousRevision(wireListRevisions),
    previousLayout: getPreviousRevision(layoutRevisions),
    sourceRoots: {
      legal: row.legalFolderName,
      brand: row.brandFolderName,
    },
    treeRow: row,
  }
}

export function parseRevisionFromLegalFileName(fileName: string): RevisionInfo {
  const legal = parseLegalDrawingsFileVersion(fileName)
  if (legal.baseRevision === 'Imported') {
    return parseRevisionFromFilename(fileName)
  }

  const displayVersion = legal.isModified && legal.modificationNumber !== undefined
    ? `${legal.baseRevision} M.${legal.modificationNumber}`
    : legal.baseRevision

  return {
    revision: legal.baseRevision,
    isModified: legal.isModified,
    modificationNumber: legal.modificationNumber !== undefined ? String(legal.modificationNumber) : undefined,
    displayVersion,
    sortScore: parseRevisionFromFilename(`${fileName}`).sortScore,
  }
}
