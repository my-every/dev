import 'server-only'

import { execFile } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { promisify } from 'node:util'

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
  type RevisionScanTransport,
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
const execFileAsync = promisify(execFile)

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

interface FileCollectionOptions {
  fromTimeMs?: number
  toTimeMs?: number
  telemetry?: ScanCollectionTelemetry
}

interface ScanCollectionTelemetry {
  nodeTraversalCount: number
  powerShellCount: number
  powerShellForced: boolean
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

function toScannedFileFromStats(input: {
  fullPath: string
  fileName: string
  sizeBytes: number
  modifiedTimeMs: number
}): ScannedFile {
  const revisionInfo = parseRevisionFromFilename(input.fileName)
  return {
    absolutePath: input.fullPath,
    fileName: input.fileName,
    extension: path.extname(input.fileName).toLowerCase(),
    modifiedTimeMs: input.modifiedTimeMs,
    sizeBytes: input.sizeBytes,
    fileTypeIndicator: inferFileTypeIndicator(input.fileName),
    revisionInfo,
  }
}

function shouldAttemptPowerShellFileListing() {
  if (process.platform !== 'win32') {
    return false
  }

  if (process.env.REVISION_SCAN_DISABLE_POWERSHELL === '1') {
    return false
  }

  return true
}

function quotePowerShellLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

async function collectFilesWithPowerShell(
  rootPath: string,
  options: FileCollectionOptions = {},
): Promise<ScannedFile[] | null> {
  if (!shouldAttemptPowerShellFileListing()) {
    return null
  }

  const fromTimeMs = Number.isFinite(options.fromTimeMs) ? Number(options.fromTimeMs) : Number.NEGATIVE_INFINITY
  const toTimeMs = Number.isFinite(options.toTimeMs) ? Number(options.toTimeMs) : Number.POSITIVE_INFINITY

  const script = [
    "$ErrorActionPreference = 'Stop'",
    `$root = ${quotePowerShellLiteral(rootPath)}`,
    "if (-not (Test-Path -LiteralPath $root)) { Write-Output '[]'; exit 0 }",
    "$rows = Get-ChildItem -LiteralPath $root -Recurse -File -Force -ErrorAction SilentlyContinue | Select-Object FullName, Name, Length, LastWriteTimeUtc",
    "if ($null -eq $rows) { Write-Output '[]' } else { $rows | ConvertTo-Json -Compress }",
  ].join('; ')

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { maxBuffer: 1024 * 1024 * 32 },
    )

    const raw = String(stdout ?? '').trim()
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as
      | { FullName?: string; Name?: string; Length?: number; LastWriteTimeUtc?: string }
      | Array<{ FullName?: string; Name?: string; Length?: number; LastWriteTimeUtc?: string }>

    const rows = Array.isArray(parsed) ? parsed : [parsed]
    const files = rows
      .filter((row) => Boolean(row?.FullName) && Boolean(row?.Name))
      .map((row) => {
        const parsedMs = row.LastWriteTimeUtc ? Date.parse(row.LastWriteTimeUtc) : 0
        return {
          row,
          modifiedTimeMs: Number.isFinite(parsedMs) ? parsedMs : 0,
        }
      })
      .filter(({ modifiedTimeMs }) => modifiedTimeMs >= fromTimeMs && modifiedTimeMs <= toTimeMs)
      .map((row) =>
        toScannedFileFromStats({
          fullPath: String(row.row.FullName),
          fileName: String(row.row.Name),
          sizeBytes: Number(row.row.Length ?? 0),
          modifiedTimeMs: row.modifiedTimeMs,
        }),
      )

    files.sort((left, right) => right.modifiedTimeMs - left.modifiedTimeMs)
    return files
  } catch (error) {
    console.warn('[revision-scan] PowerShell fallback failed:', error)
    return null
  }
}

async function collectFilesRecursively(
  rootPath: string,
  options: FileCollectionOptions = {},
): Promise<ScannedFile[]> {
  const telemetry = options.telemetry
  const forcePowerShell = process.env.REVISION_SCAN_USE_POWERSHELL === '1'
  if (forcePowerShell) {
    if (telemetry) {
      telemetry.powerShellForced = true
    }
    const fromPowerShell = await collectFilesWithPowerShell(rootPath, options)
    if (fromPowerShell) {
      if (telemetry) {
        telemetry.powerShellCount += 1
      }
      return fromPowerShell
    }
  }

  const fromTimeMs = Number.isFinite(options.fromTimeMs) ? Number(options.fromTimeMs) : Number.NEGATIVE_INFINITY
  const toTimeMs = Number.isFinite(options.toTimeMs) ? Number(options.toTimeMs) : Number.POSITIVE_INFINITY

  // Collect directories breadth-first, then batch-stat all files per directory
  // with Promise.all. This eliminates sequential round-trips on SMB/network drives
  // where each individual stat() call can cost 5-50ms.
  const dirQueue: string[] = [rootPath]
  const files: ScannedFile[] = []

  while (dirQueue.length > 0) {
    const current = dirQueue.shift()!

    let entries: Awaited<ReturnType<typeof fs.readdir>>
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch {
      continue
    }

    const fileEntries: string[] = []
    const unknownEntries: string[] = []
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        dirQueue.push(fullPath)
      } else if (entry.isFile()) {
        fileEntries.push(fullPath)
      } else {
        // On Windows SMB/UNC network shares, the server may not populate dirent
        // type bits, causing isFile() and isDirectory() to both return false.
        // Collect these and resolve via stat in a separate batch.
        unknownEntries.push(fullPath)
      }
    }

    // Resolve unknown-type entries in one parallel batch to avoid serial round-trips
    if (unknownEntries.length > 0) {
      const unknownStats = await Promise.all(unknownEntries.map(p => safeStat(p)))
      for (let i = 0; i < unknownEntries.length; i++) {
        const s = unknownStats[i]
        if (s?.isDirectory()) dirQueue.push(unknownEntries[i]!)
        else if (s?.isFile()) fileEntries.push(unknownEntries[i]!)
      }
    }

    // Stat all files in this directory concurrently — one network batch per dir
    // instead of one round-trip per file.
    const statResults = await Promise.all(
      fileEntries.map(async (fullPath) => {
        const stats = await safeStat(fullPath)
        return { fullPath, stats }
      }),
    )

    for (const { fullPath, stats } of statResults) {
      if (!stats?.isFile()) continue
      if (stats.mtimeMs < fromTimeMs || stats.mtimeMs > toTimeMs) continue

      const fileName = path.basename(fullPath)
      files.push(
        toScannedFileFromStats({
          fullPath,
          fileName,
          sizeBytes: stats.size,
          modifiedTimeMs: stats.mtimeMs,
        }),
      )
    }
  }

  if (files.length === 0 && shouldAttemptPowerShellFileListing()) {
    const fromPowerShell = await collectFilesWithPowerShell(rootPath, options)
    if (fromPowerShell) {
      if (telemetry) {
        telemetry.powerShellCount += 1
      }
      return fromPowerShell
    }
  }

  if (telemetry) {
    telemetry.nodeTraversalCount += 1
  }

  files.sort((left, right) => right.modifiedTimeMs - left.modifiedTimeMs)
  return files
}

function resolveScanTransport(telemetry: ScanCollectionTelemetry): RevisionScanTransport {
  if (telemetry.powerShellCount <= 0) {
    return 'node-fs'
  }

  if (telemetry.nodeTraversalCount <= 0) {
    return telemetry.powerShellForced ? 'powershell-forced' : 'powershell-fallback'
  }

  return 'mixed'
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

async function discoverLegalProjects(
  sourceRoot: string,
  options: FileCollectionOptions,
): Promise<Map<string, ProjectAggregate>> {
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
    const files = await collectFilesRecursively(rootPath, options)

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
  options: FileCollectionOptions,
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
    const files = await collectFilesRecursively(rootPath, options)
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
  const collectionTelemetry: ScanCollectionTelemetry = {
    nodeTraversalCount: 0,
    powerShellCount: 0,
    powerShellForced: false,
  }

  const aggregates = new Map<string, ProjectAggregate>()

  if (scope === 'legal' || scope === 'both') {
    const legalScanStartedAt = nowMs()
    const legalProjects = await discoverLegalProjects(sourceRoots.legalSourceRoot ?? '', {
      fromTimeMs,
      toTimeMs,
      telemetry: collectionTelemetry,
    })
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
    await mergeBrandProjects(aggregates, sourceRoots.brandSourceRoot ?? '', {
      fromTimeMs,
      toTimeMs,
      telemetry: collectionTelemetry,
    })
    console.info(
      '[revision/filesystem-scan] Brand merge complete',
      JSON.stringify({
        durationMs: elapsedMs(brandScanStartedAt),
        aggregateCountBefore,
        aggregateCountAfter: aggregates.size,
      }),
    )
  }

  const currentTimeMs = Date.now()
  const projects: ProjectRevisionTreeRow[] = []

  for (const aggregate of aggregates.values()) {
    if (projectFilter) {
      const label = `${aggregate.pdNumber}_${aggregate.projectName}`.toUpperCase()
      if (!label.includes(projectFilter) && aggregate.pdNumber !== projectFilter) {
        continue
      }
    }

    // Files are already range-filtered during collection.
    const candidateFiles = aggregate.files

    const revisionPairState = buildRevisionPairState(candidateFiles)
    const validation = buildValidationSummary(
      revisionPairState,
      candidateFiles,
      Boolean(aggregate.brandRootPath),
      currentTimeMs,
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
      scanTransport: resolveScanTransport(collectionTelemetry),
      scanTransportStats: {
        nodeTraversalCount: collectionTelemetry.nodeTraversalCount,
        powerShellCount: collectionTelemetry.powerShellCount,
      },
    }),
  )

  return {
    generatedAt: new Date().toISOString(),
    scope,
    fromTimeMs,
    toTimeMs,
    legalSourceRoot: sourceRoots.legalSourceRoot,
    brandSourceRoot: scope === 'legal' ? null : sourceRoots.brandSourceRoot,
    scanTransport: resolveScanTransport(collectionTelemetry),
    scanTransportStats: {
      nodeTraversalCount: collectionTelemetry.nodeTraversalCount,
      powerShellCount: collectionTelemetry.powerShellCount,
    },
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
