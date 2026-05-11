import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import type { MappedAssignment } from '@/lib/assignment/mapped-assignment'
import type { LwcType, ParsedWorkbookSheet, ProjectModel, ProjectSheetSummary } from '@/lib/workbook/types'
import type { StoredProject } from '@/types/d380-shared'
import type { ProjectManifest } from '@/types/project-manifest'
import type { SheetSchema } from '@/types/sheet-schema'
import { generateDevicePartNumbersMap, saveDevicePartNumbersMap } from '@/lib/project-state/device-part-numbers-generator'
import { ingestStoredProjectPartNumbers } from '@/lib/project-state/parts-ingest-service'
import { syncExtractedPartTerminalSchemas } from '@/lib/project-state/part-terminal-schema'
import { buildManifestAssignmentSummaries } from '@/lib/project-state/manifest-assignment-summaries'
import { buildManifestAssignmentNode } from '@/lib/project-state/schema-generators'
import { loadManifest } from '@/lib/services/manifest-service'
import { generateCleanProjectId } from '@/lib/workbook/normalize-sheet-name'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import { getOperationCode, type OperationTimeEntry } from '@/types/d380-operation-codes'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import { deriveSwsProgressSummary } from '@/lib/sws/progress'

const PROJECT_MANIFEST_FILE = 'project-manifest.json'
const SHEETS_DIR = 'sheets'

// ── Project root directory cache ─────────────────────────────────────────────
// resolveExistingProjectRoot scans every project folder on the network share
// (S:\) and reads each manifest.json twice per request — expensive over SMB.
// Cache the resolved path per projectId with a 2-minute TTL.
const PROJECT_ROOT_CACHE_TTL_MS = 2 * 60 * 1000
interface ProjectRootCacheEntry { dir: string | null; ts: number }
const projectRootCache = new Map<string, ProjectRootCacheEntry>()

function getCachedProjectRoot(projectId: string): string | null | undefined {
  const entry = projectRootCache.get(projectId)
  if (!entry) return undefined
  if (Date.now() - entry.ts > PROJECT_ROOT_CACHE_TTL_MS) {
    projectRootCache.delete(projectId)
    return undefined
  }
  return entry.dir
}

function setCachedProjectRoot(projectId: string, dir: string | null): void {
  projectRootCache.set(projectId, { dir, ts: Date.now() })
}

/** Invalidate the cached directory path for a project (call after write/create operations). */
export function invalidateProjectRootCache(projectId: string): void {
  projectRootCache.delete(projectId)
}

async function resolveShareProjectsRoot(): Promise<string> {
  const shareRoot = await resolveShareDirectory()
  return path.join(shareRoot, 'Projects')
}

interface ProjectStatePaths {
  projectDirectory: string
  stateDirectory: string
  manifestPath: string
  sheetsDirectory: string
}

function normalizeManifestForStorage(manifest: ProjectManifest): ProjectManifest {
  const manifestRecord = manifest as unknown as Record<string, unknown>
  const { sheetData: _legacySheetData, ...rest } = manifestRecord

  const sheets = Array.isArray(manifest.sheets)
    ? ((manifest.sheets as unknown) as Array<Record<string, unknown>>).map((sheet) => {
      const slug = String(sheet.slug ?? '').trim()
      const sheetPath =
        typeof sheet.sheetPath === 'string' && sheet.sheetPath.trim().length > 0
          ? sheet.sheetPath.trim()
          : `state/sheets/${slug}.json`

      return {
        slug,
        name: String(sheet.name ?? '').trim(),
        kind: String(sheet.kind ?? 'other') as ProjectManifest['sheets'][number]['kind'],
        sheetPath,
        rowCount: Number(sheet.rowCount ?? 0),
        columnCount: Number(sheet.columnCount ?? 0),
        sheetIndex: Number(sheet.sheetIndex ?? 0),
        hasData: Boolean(sheet.hasData ?? true),
      }
    })
    : []

  return {
    ...((rest as unknown) as ProjectManifest),
    sheets,
  }
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

async function writeJsonFile(filePath: string, value: unknown) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

function deriveEstimatedMinutes(buildUpEstTime?: string, wireListEstTime?: string) {
  const parse = (value?: string) => {
    if (!value) return 0
    const hoursMatch = value.match(/(\d+)\s*h/i)
    const minutesMatch = value.match(/(\d+)\s*m/i)
    const hours = hoursMatch ? Number(hoursMatch[1]) : 0
    const minutes = minutesMatch ? Number(minutesMatch[1]) : 0
    return hours * 60 + minutes
  }

  return parse(buildUpEstTime) + parse(wireListEstTime)
}

interface AssignmentOperationTotals {
  actualMinutesByAssignment: Map<string, number>
  latestStartByAssignment: Map<string, string>
  latestEndByAssignment: Map<string, string>
}

async function readOperationTimeEntriesFromStateDirectory(stateDirectory: string): Promise<OperationTimeEntry[]> {
  try {
    const raw = await fs.readFile(path.join(stateDirectory, 'operation-time.json'), 'utf-8')
    const payload = JSON.parse(raw) as { entries?: OperationTimeEntry[] }
    return Array.isArray(payload.entries) ? payload.entries : []
  } catch {
    return []
  }
}

function summarizeAssignmentOperationTotals(entries: OperationTimeEntry[]): AssignmentOperationTotals {
  const actualMinutesByAssignment = new Map<string, number>()
  const latestStartByAssignment = new Map<string, string>()
  const latestEndByAssignment = new Map<string, string>()

  for (const entry of entries) {
    const assignmentId = entry.assignmentId
    const currentMinutes = actualMinutesByAssignment.get(assignmentId) ?? 0
    actualMinutesByAssignment.set(assignmentId, currentMinutes + Math.max(0, entry.actualMinutes ?? 0))

    if (entry.startedAt) {
      const currentStart = latestStartByAssignment.get(assignmentId)
      if (!currentStart || new Date(entry.startedAt).getTime() > new Date(currentStart).getTime()) {
        latestStartByAssignment.set(assignmentId, entry.startedAt)
      }
    }

    if (entry.endedAt) {
      const currentEnd = latestEndByAssignment.get(assignmentId)
      if (!currentEnd || new Date(entry.endedAt).getTime() > new Date(currentEnd).getTime()) {
        latestEndByAssignment.set(assignmentId, entry.endedAt)
      }
    }
  }

  return {
    actualMinutesByAssignment,
    latestStartByAssignment,
    latestEndByAssignment,
  }
}

async function readAssignmentSwsConfigsFromStateDirectory(stateDirectory: string) {
  const assignmentSwsDirectory = path.join(stateDirectory, 'assignment-sws')
  const bySheetSlug = new Map<string, import('@/types/d380-assignment-sws').AssignmentSwsConfig>()

  try {
    const entries = await fs.readdir(assignmentSwsDirectory, { withFileTypes: true })
    await Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map(async (entry) => {
      try {
        const raw = await fs.readFile(path.join(assignmentSwsDirectory, entry.name), 'utf-8')
        const payload = JSON.parse(raw) as import('@/types/d380-assignment-sws').AssignmentSwsConfig
        bySheetSlug.set(decodeURIComponent(entry.name.slice(0, -5)), payload)
      } catch {
        // Ignore malformed assignment SWS payloads during hydration.
      }
    }))
  } catch {
    // Assignment SWS directory may not exist yet.
  }

  return bySheetSlug
}

async function hydrateManifestOperationalMetrics(
  manifest: ProjectManifest,
  stateDirectory: string,
): Promise<ProjectManifest> {
  const operationEntries = await readOperationTimeEntriesFromStateDirectory(stateDirectory)
  const assignmentTotals = summarizeAssignmentOperationTotals(operationEntries)
  const swsConfigBySheetSlug = await readAssignmentSwsConfigsFromStateDirectory(stateDirectory)

  const assignments = Object.fromEntries(
    Object.entries(manifest.assignments ?? {}).map(([sheetSlug, assignment]) => {
      const boardAssignment = assignment.boardAssignment ?? null
      const assignmentId = boardAssignment?.assignmentId ?? `${manifest.id}:${sheetSlug}`
      const actualMinutes =
        assignmentTotals.actualMinutesByAssignment.get(assignmentId)
        ?? assignmentTotals.actualMinutesByAssignment.get(sheetSlug)
        ?? assignment.actualMinutes
        ?? 0
      const totalEstimatedMinutes = assignment.totalEstimatedMinutes
        ?? boardAssignment?.estimatedMinutes
        ?? deriveEstimatedMinutes(assignment.buildUpEstTime, assignment.wireListEstTime)
      const swsConfig = swsConfigBySheetSlug.get(sheetSlug)
      const swsProgress = deriveSwsProgressSummary(swsConfig)
      const derivedProgress = swsProgress.totalSections > 0
        ? swsProgress.progressPercent
        : assignment.progress
      const remainingMinutes = Math.max(0, (totalEstimatedMinutes ?? 0) - actualMinutes)

      const latestStart = assignmentTotals.latestStartByAssignment.get(assignmentId) ?? assignmentTotals.latestStartByAssignment.get(sheetSlug)
      const latestEnd = assignmentTotals.latestEndByAssignment.get(assignmentId) ?? assignmentTotals.latestEndByAssignment.get(sheetSlug)
      const nextStatus = derivedProgress != null && derivedProgress >= 100
        ? 'COMPLETED'
        : actualMinutes > 0 || latestStart
          ? 'IN_PROGRESS'
          : assignment.status

      return [sheetSlug, {
        ...assignment,
        totalEstimatedMinutes,
        actualMinutes,
        remainingMinutes,
        progress: derivedProgress,
        status: nextStatus,
        linkedOperationCode: assignment.linkedOperationCode ?? boardAssignment?.operationCode ?? swsConfig?.linkedOperationCode ?? null,
        defaultOperationCodeByStage: assignment.defaultOperationCodeByStage ?? swsConfig?.defaultOperationCodeByStage ?? {},
        assignedBadge: boardAssignment?.assignedBadge ?? assignment.assignedBadge ?? null,
        workflowStatus: boardAssignment?.workflowStatus ?? assignment.workflowStatus ?? null,
        boardAssignment: boardAssignment ? {
          ...boardAssignment,
          actualStartTime: latestStart ?? boardAssignment.actualStartTime ?? null,
          actualEndTime: latestEnd ?? boardAssignment.actualEndTime ?? null,
        } : boardAssignment,
      }]
    }),
  ) as ProjectManifest['assignments']

  return {
    ...manifest,
    assignments,
  }
}

function ensureManifestBoardAssignments(manifest: ProjectManifest): ProjectManifest {
  const assignments = manifest.assignments ?? {}
  return {
    ...manifest,
    assignments: Object.fromEntries(
      (Object.entries(assignments) as Array<[string, ProjectManifest['assignments'][string]]>).map(([sheetSlug, assignment]) => {
        const existingBoardAssignment = (assignment.boardAssignment ?? {}) as NonNullable<typeof assignment.boardAssignment>
        return [
          sheetSlug,
          {
            ...assignment,
            boardAssignment: {
              assignmentId: existingBoardAssignment.assignmentId ?? `${manifest.id}:${sheetSlug}`,
              estimatedMinutes: existingBoardAssignment.estimatedMinutes ?? deriveEstimatedMinutes(assignment.buildUpEstTime, assignment.wireListEstTime),
              assignedBadge: existingBoardAssignment.assignedBadge ?? null,
              assignedAt: existingBoardAssignment.assignedAt ?? null,
              workAreaId: existingBoardAssignment.workAreaId ?? null,
              workAreaLabel: existingBoardAssignment.workAreaLabel ?? null,
              floorArea: existingBoardAssignment.floorArea ?? null,
              shiftId: existingBoardAssignment.shiftId ?? null,
              scheduledDate: existingBoardAssignment.scheduledDate ?? null,
              startTime: existingBoardAssignment.startTime ?? null,
              endTime: existingBoardAssignment.endTime ?? null,
              queueIndex: existingBoardAssignment.queueIndex ?? null,
              assignmentGroupId: existingBoardAssignment.assignmentGroupId ?? null,
              source: existingBoardAssignment.source ?? null,
              operationCode: existingBoardAssignment.operationCode ?? assignment.linkedOperationCode ?? null,
              workflowStatus: existingBoardAssignment.workflowStatus ?? (existingBoardAssignment.workAreaId ? 'scheduled' : 'pending'),
              actualStartTime: existingBoardAssignment.actualStartTime ?? null,
              actualEndTime: existingBoardAssignment.actualEndTime ?? null,
              activeOperationEntryId: existingBoardAssignment.activeOperationEntryId ?? null,
            },
            assignedBadge: existingBoardAssignment.assignedBadge ?? null,
            workflowStatus: existingBoardAssignment.workflowStatus ?? (existingBoardAssignment.workAreaId ? 'scheduled' : 'pending'),
            linkedOperationCode: assignment.linkedOperationCode ?? existingBoardAssignment.operationCode ?? null,
            defaultOperationCodeByStage: assignment.defaultOperationCodeByStage ?? {},
          },
        ]
      }),
    ),
  }
}

function buildMappedAssignmentFromSchema(schema: SheetSchema): MappedAssignment | null {
  if (schema.kind !== 'operational') {
    return null
  }

  return {
    sheetSlug: schema.slug,
    sheetName: schema.name,
    rowCount: schema.rowCount,
    sheetKind: 'assignment',
    detectedSwsType: schema.assignment.detectedSwsType as MappedAssignment['detectedSwsType'],
    detectedConfidence: schema.assignment.detectedConfidence,
    detectedReasons: schema.assignment.detectedReasons,
    selectedSwsType: schema.assignment.swsType as MappedAssignment['selectedSwsType'],
    selectedStage: schema.assignment.stage,
    selectedStatus: schema.assignment.status,
    overrideReason: schema.assignment.overrideReason,
    isOverride: schema.assignment.isOverride,
    requiresWireSws: schema.assignment.requiresWireSws,
    requiresCrossWireSws: schema.assignment.requiresCrossWireSws,
    matchedLayoutPage: schema.layoutMatch?.pageNumber,
    matchedLayoutTitle: schema.layoutMatch?.pageTitle,
  }
}

function hasManifestAssignments(manifest: ProjectManifest): boolean {
  return Object.keys(manifest.assignments ?? {}).length > 0
}

async function hydrateManifestAssignmentsFromSheetSchemas(
  manifest: ProjectManifest,
  projectRoot: string,
  sheetSchemas: SheetSchema[],
): Promise<ProjectManifest> {
  if (hasManifestAssignments(manifest)) {
    return manifest
  }

  const manifestAssignments = {} as NonNullable<ProjectManifest['assignments']>

  for (const schema of sheetSchemas) {
    const mapped = buildMappedAssignmentFromSchema(schema)
    if (!mapped) {
      continue
    }

    const sheetMeta = manifest.sheets.find((sheet) => sheet.slug === schema.slug)
    manifestAssignments[schema.slug] = buildManifestAssignmentNode(mapped, {
      sheetPath: `state/sheets/${schema.slug}.json`,
      columnCount:
        sheetMeta?.columnCount
        ?? (typeof (schema as unknown as { columnCount?: unknown }).columnCount === 'number'
          ? Number((schema as unknown as { columnCount?: unknown }).columnCount)
          : undefined),
      sheetIndex: sheetMeta?.sheetIndex ?? schema.sheetIndex,
      hasData: sheetMeta?.hasData ?? (schema.rowCount > 0),
    }) as ProjectManifest['assignments'][string]
  }

  if (Object.keys(manifestAssignments).length === 0) {
    return manifest
  }

  return {
    ...manifest,
    assignments: (await buildManifestAssignmentSummaries(projectRoot, {
      ...manifest,
      assignments: manifestAssignments,
    })) as ProjectManifest['assignments'],
  }
}

function normalizeProjectLwcType(value: string | null | undefined): LwcType | undefined {
  if (!value) {
    return undefined
  }

  const normalized = value.trim().toUpperCase()
  switch (normalized) {
    case 'NEW_FLEX':
    case 'ONSKID':
    case 'OFFSKID':
    case 'NTB':
    case 'FLOAT':
      return normalized as LwcType
    default:
      return undefined
  }
}

function normalizeOptionalString(value: string | null | undefined): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function normalizeOptionalNumber(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeMappedStage(stage: MappedAssignment['selectedStage']): AssignmentStageId {
  switch (stage) {
    case 'KITTED':
      return 'READY_TO_LAY'
    case 'IPV1':
      return 'READY_FOR_VISUAL'
    case 'IPV2':
    case 'IPV3':
      return 'WIRING_IPV'
    case 'CROSS_WIRING':
      return 'CROSS_WIRE'
    case 'IPV4':
      return 'CROSS_WIRE_IPV'
    case 'TEST_READY':
      return 'READY_TO_TEST'
    case 'TEST':
      return 'TEST_1ST_PASS'
    default:
      return stage
  }
}

async function listProjectFolders() {
  const shareProjectsRoot = await resolveShareProjectsRoot()

  try {
    const entries = await fs.readdir(shareProjectsRoot, { withFileTypes: true })
    return entries.filter(entry => entry.isDirectory()).map(entry => entry.name)
  } catch {
    return []
  }
}

function sanitizeProjectNameSegment(projectName: string | null | undefined, pdNumber: string) {
  const stripped = (projectName ?? '')
    .trim()
    .replace(new RegExp(`^${pdNumber}(?:\\s*[-_]+\\s*|\\s+)`, 'i'), '')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!stripped) {
    return ''
  }

  const compact = stripped.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  if (!compact) {
    return ''
  }

  const comparable = compact.replace(/_/g, '').toUpperCase()
  return comparable === pdNumber.replace(/[^A-Za-z0-9]+/g, '').toUpperCase() ? '' : compact
}

export function buildShareProjectFolderName(pdNumber: string, projectName?: string | null) {
  const normalizedPdNumber = pdNumber.trim().toUpperCase()
  const nameSegment = sanitizeProjectNameSegment(projectName, normalizedPdNumber)
  return nameSegment ? `${normalizedPdNumber}_${nameSegment}` : normalizedPdNumber
}

async function resolveExistingProjectRoot(projectId: string): Promise<string | null> {
  const cached = getCachedProjectRoot(projectId)
  if (cached !== undefined) return cached

  const shareProjectsRoot = await resolveShareProjectsRoot()
  const folders = await listProjectFolders()

  // Single pass: check exact ID match and slug match together to halve file reads
  for (const folder of folders) {
    const stateDirectory = path.join(shareProjectsRoot, folder, 'state')
    const manifestPath = path.join(stateDirectory, PROJECT_MANIFEST_FILE)
    const manifest = await readJsonFile<ProjectManifest>(manifestPath)
    if (!manifest) continue

    if (manifest.id === projectId) {
      const dir = path.join(shareProjectsRoot, folder)
      setCachedProjectRoot(projectId, dir)
      return dir
    }

    if (manifest.pdNumber && manifest.name) {
      const slug = generateCleanProjectId(manifest.pdNumber, manifest.name)
      if (slug === projectId) {
        const dir = path.join(shareProjectsRoot, folder)
        setCachedProjectRoot(projectId, dir)
        // Also cache under the manifest's own id so future lookups by either key are fast
        if (manifest.id && manifest.id !== projectId) setCachedProjectRoot(manifest.id, dir)
        return dir
      }
    }
  }

  setCachedProjectRoot(projectId, null)
  return null
}

async function resolveExistingStatePaths(projectId: string): Promise<ProjectStatePaths | null> {
  const projectDirectory = await resolveExistingProjectRoot(projectId)
  if (!projectDirectory) {
    return null
  }

  const stateDirectory = path.join(projectDirectory, 'state')
  return {
    projectDirectory,
    stateDirectory,
    manifestPath: path.join(stateDirectory, PROJECT_MANIFEST_FILE),
    sheetsDirectory: path.join(stateDirectory, SHEETS_DIR),
  }
}

export async function resolveProjectRootDirectory(
  projectId: string,
  options?: { pdNumber?: string | null; projectName?: string | null },
): Promise<string | null> {
  const shareProjectsRoot = await resolveShareProjectsRoot()
  const existing = await resolveExistingStatePaths(projectId)
  if (existing) {
    return existing.projectDirectory
  }

  const normalizedPdNumber = options?.pdNumber?.trim().toUpperCase() || null
  if (!normalizedPdNumber) {
    // Fall back to project name as folder name when PD number is absent
    const nameSegment = (options?.projectName ?? '')
      .trim()
      .replace(/[\\/:*?"<>|]+/g, ' ')
      .replace(/\s+/g, '_')
      .replace(/^_+|_+$/g, '')

    if (!nameSegment) {
      return null
    }

    const projectDirectory = path.join(shareProjectsRoot, nameSegment)
    await fs.mkdir(projectDirectory, { recursive: true })
    // Update cache so subsequent lookups find the newly created project
    setCachedProjectRoot(projectId, projectDirectory)
    return projectDirectory
  }

  const projectDirectory = path.join(
    shareProjectsRoot,
    buildShareProjectFolderName(normalizedPdNumber, options?.projectName),
  )
  await fs.mkdir(projectDirectory, { recursive: true })
  // Update cache so subsequent lookups find the newly created project
  setCachedProjectRoot(projectId, projectDirectory)

  return projectDirectory
}

async function resolveStatePaths(projectId: string, pdNumber?: string | null, projectName?: string | null): Promise<ProjectStatePaths | null> {
  const projectDirectory = await resolveProjectRootDirectory(projectId, { pdNumber, projectName })
  if (!projectDirectory) {
    return null
  }

  const stateDirectory = path.join(projectDirectory, 'state')
  await fs.mkdir(stateDirectory, { recursive: true })

  const sheetsDirectory = path.join(stateDirectory, SHEETS_DIR)
  await fs.mkdir(sheetsDirectory, { recursive: true })

  return {
    projectDirectory,
    stateDirectory,
    manifestPath: path.join(stateDirectory, PROJECT_MANIFEST_FILE),
    sheetsDirectory,
  }
}

export async function resolveProjectStateDirectory(projectId: string, pdNumber?: string | null): Promise<string | null> {
  const paths = await resolveStatePaths(projectId, pdNumber)
  return paths?.stateDirectory ?? null
}

export async function listStoredProjects(): Promise<ProjectManifest[]> {
  const shareProjectsRoot = await resolveShareProjectsRoot()
  const folders = await listProjectFolders()
  const records = await Promise.all(
    folders.map(async folder => {
      const stateDir = path.join(shareProjectsRoot, folder, 'state')
      const manifestPath = path.join(stateDir, PROJECT_MANIFEST_FILE)
      const manifest = await readJsonFile<ProjectManifest>(manifestPath)
      if (!manifest) return null

      // Auto-migrate to clean ID if pdNumber + name are available
      if (manifest.pdNumber && manifest.name) {
        const cleanId = generateCleanProjectId(manifest.pdNumber, manifest.name)
        if (manifest.id !== cleanId) {
          manifest.id = cleanId
          await writeJsonFile(manifestPath, manifest)
        }
      }

      return ensureManifestBoardAssignments(manifest)
    }),
  )

  return records.filter((record): record is ProjectManifest => Boolean(record))
}

export async function listStoredProjectsByPdNumber(pdNumber: string | null | undefined): Promise<ProjectManifest[]> {
  const normalizedPdNumber = pdNumber?.trim().toUpperCase()
  if (!normalizedPdNumber) {
    return []
  }

  const projects = await listStoredProjects()
  return projects.filter((project) => project.pdNumber?.trim().toUpperCase() === normalizedPdNumber)
}

export async function readProjectManifest(projectId: string): Promise<ProjectManifest | null> {
  const paths = await resolveExistingStatePaths(projectId)
  if (!paths) {
    return null
  }

  const manifest = await readJsonFile<ProjectManifest>(paths.manifestPath)
  if (!manifest) return null

  // Migrate to clean slug-based ID if the manifest was found via slug lookup
  // but its stored ID is the old filename-timestamp format
  if (manifest.id !== projectId && manifest.pdNumber && manifest.name) {
    const cleanId = generateCleanProjectId(manifest.pdNumber, manifest.name)
    if (cleanId === projectId) {
      manifest.id = cleanId
      await writeJsonFile(paths.manifestPath, manifest)
    }
  }

  const normalizedManifest = ensureManifestBoardAssignments(manifest)
  const sheetSchemas = hasManifestAssignments(normalizedManifest)
    ? []
    : await readAllSheetSchemas(projectId)
  const hydratedManifest = await hydrateManifestAssignmentsFromSheetSchemas(
    normalizedManifest,
    paths.projectDirectory,
    sheetSchemas,
  )
  const manifestWithOperationalMetrics = await hydrateManifestOperationalMetrics(
    hydratedManifest,
    paths.stateDirectory,
  )
  const fullyHydratedManifest = loadManifest(manifestWithOperationalMetrics)

  if (JSON.stringify(fullyHydratedManifest) !== JSON.stringify(manifest)) {
    await writeJsonFile(paths.manifestPath, fullyHydratedManifest)
  }

  return fullyHydratedManifest
}

export async function writeProjectManifest(manifest: ProjectManifest): Promise<ProjectManifest> {
  const normalizedManifest = ensureManifestBoardAssignments(normalizeManifestForStorage(manifest))
  const shareProjectsRoot = await resolveShareProjectsRoot()
  const pdNumber = normalizedManifest.pdNumber || null
  const projectName = normalizedManifest.name

  // Check if the project already exists under a different folder
  const existingRoot = await resolveExistingProjectRoot(normalizedManifest.id)
  const desiredFolderName = pdNumber
    ? buildShareProjectFolderName(pdNumber, projectName)
    : (projectName.trim().replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, '_').replace(/^_+|_+$/g, '') || normalizedManifest.id)
  const desiredDirectory = path.join(shareProjectsRoot, desiredFolderName)

  // If existing folder has a different name (e.g. PD number was added/changed), rename it
  if (existingRoot && path.basename(existingRoot) !== desiredFolderName) {
    try {
      const desiredExists = await fs.stat(desiredDirectory).then(() => true).catch(() => false)
      if (!desiredExists) {
        await fs.rename(existingRoot, desiredDirectory)
      }
    } catch (error) {
      console.error('Failed to rename project folder:', error)
    }
  }

  const paths = await resolveStatePaths(normalizedManifest.id, pdNumber, projectName)
  if (!paths) {
    throw new Error('Project state directory not found')
  }

  await writeJsonFile(paths.manifestPath, normalizedManifest)

  return normalizedManifest
}

export async function updateManifestBoardAssignment(
  projectId: string,
  sheetSlug: string,
  updates: NonNullable<ProjectManifest['assignments'][string]['boardAssignment']>,
): Promise<ProjectManifest | null> {
  const manifest = await readProjectManifest(projectId)
  if (!manifest) {
    return null
  }

  const assignment = manifest.assignments[sheetSlug]
  if (!assignment) {
    return null
  }

  const mergedBoardAssignment = {
    ...(assignment.boardAssignment ?? {
      assignmentId: `${projectId}:${sheetSlug}`,
      estimatedMinutes: deriveEstimatedMinutes(assignment.buildUpEstTime, assignment.wireListEstTime),
    }),
    ...updates,
  }
  manifest.assignments[sheetSlug] = {
    ...assignment,
    linkedOperationCode: updates.operationCode ?? assignment.linkedOperationCode ?? null,
    defaultOperationCodeByStage: {
      ...(assignment.defaultOperationCodeByStage ?? {}),
      ...(updates.operationCode ? { [assignment.stage]: updates.operationCode } : {}),
    },
    assignedBadge: mergedBoardAssignment.assignedBadge ?? assignment.assignedBadge ?? null,
    workflowStatus: mergedBoardAssignment.workflowStatus ?? assignment.workflowStatus ?? null,
    boardAssignment: mergedBoardAssignment,
  }

  return writeProjectManifest(manifest)
}

/**
 * Write the full project (manifest + sheet schemas + part numbers).
 * Called during project creation from upload flow.
 */
export async function writeFullProject(
  manifest: ProjectManifest,
  sheetSchemas: SheetSchema[],
  model: ProjectModel,
): Promise<void> {
  // Write the manifest
  await writeProjectManifest(manifest)

  const paths = await resolveStatePaths(manifest.id, manifest.pdNumber, manifest.name)
  if (!paths) {
    throw new Error('Project state directory not found')
  }

  // Write each sheet schema
  for (const schema of sheetSchemas) {
    const schemaPath = path.join(paths.sheetsDirectory, `${schema.slug}.json`)
    await writeJsonFile(schemaPath, schema)
  }

  if (!hasManifestAssignments(manifest)) {
    const hydratedManifest = await hydrateManifestAssignmentsFromSheetSchemas(
      ensureManifestBoardAssignments(manifest),
      paths.projectDirectory,
      sheetSchemas,
    )
    if (hasManifestAssignments(hydratedManifest)) {
      await writeJsonFile(paths.manifestPath, hydratedManifest)
    }
  }

  // Generate and save device part numbers
  const storedProject: StoredProject = {
    id: model.id,
    name: model.name,
    filename: model.filename,
    createdAt: model.createdAt instanceof Date ? model.createdAt.toISOString() : String(model.createdAt),
    projectModel: model,
  }

  try {
    const partNumbersMap = await generateDevicePartNumbersMap(storedProject)
    await saveDevicePartNumbersMap(paths.projectDirectory, partNumbersMap)
  } catch (error) {
    console.error('Failed to generate device part numbers for project:', manifest.id, error)
  }

  // Auto-ingest newly discovered part numbers into Share/parts as lifecycle "new" stubs.
  try {
    await ingestStoredProjectPartNumbers(storedProject, {
      projectId: manifest.id,
      reviewRole: 'team_lead',
    })
  } catch (error) {
    console.error('Failed to ingest workbook parts for project:', manifest.id, error)
  }

  try {
    await syncExtractedPartTerminalSchemas({
      projectRoot: paths.projectDirectory,
      sheetSchemas,
    })
  } catch (error) {
    console.error('Failed to sync extracted part terminals for project:', manifest.id, error)
  }
}

export async function deleteStoredProject(projectId: string) {
  const paths = await resolveExistingStatePaths(projectId)
  if (!paths) {
    return
  }

  // Delete the entire project folder
  await fs.rm(paths.projectDirectory, { recursive: true, force: true })
}

// ── Sheet Schema I/O ──────────────────────────────────────────────────────

export async function readSheetSchema(projectId: string, sheetSlug: string): Promise<SheetSchema | null> {
  const paths = await resolveExistingStatePaths(projectId)
  if (!paths) return null

  const schemaPath = path.join(paths.sheetsDirectory, `${sheetSlug}.json`)
  return readJsonFile<SheetSchema>(schemaPath)
}

export async function writeSheetSchema(projectId: string, schema: SheetSchema): Promise<void> {
  const paths = await resolveExistingStatePaths(projectId)
  if (!paths) throw new Error('Project state directory not found')

  await fs.mkdir(paths.sheetsDirectory, { recursive: true })
  const schemaPath = path.join(paths.sheetsDirectory, `${schema.slug}.json`)
  await writeJsonFile(schemaPath, schema)
}

export async function listSheetSchemaSlugs(projectId: string): Promise<string[]> {
  const paths = await resolveExistingStatePaths(projectId)
  if (!paths) return []

  try {
    const entries = await fs.readdir(paths.sheetsDirectory)
    return entries
      .filter(e => e.endsWith('.json'))
      .map(e => e.replace(/\.json$/, ''))
  } catch {
    return []
  }
}

export async function readAllSheetSchemas(projectId: string): Promise<SheetSchema[]> {
  const slugs = await listSheetSchemaSlugs(projectId)
  const schemas = await Promise.all(
    slugs.map(slug => readSheetSchema(projectId, slug)),
  )
  return schemas.filter((s): s is SheetSchema => Boolean(s))
}

// ── Project bundle (manifest + all sheet schemas) ─────────────────────────

export interface ProjectBundle {
  manifest: ProjectManifest
  sheetSchemas: SheetSchema[]
}

export async function readProjectBundle(projectId: string): Promise<ProjectBundle | null> {
  const manifest = await readProjectManifest(projectId)
  if (!manifest) return null

  const sheetSchemas = await readAllSheetSchemas(projectId)
  return { manifest, sheetSchemas }
}

export async function readStoredProjectFromState(
  projectId: string,
): Promise<{ root: string; project: StoredProject } | null> {
  const manifest = await readProjectManifest(projectId)
  if (!manifest) {
    return null
  }

  const projectRoot = await resolveProjectRootDirectory(projectId, {
    pdNumber: manifest.pdNumber,
    projectName: manifest.name,
  })
  if (!projectRoot) {
    return null
  }

  const sheetSchemas = await readAllSheetSchemas(projectId)
  if (sheetSchemas.length === 0) {
    return null
  }

  const summaryBySlug = new Map(
    (manifest.sheets ?? []).map((sheet) => [sheet.slug, sheet]),
  )

  const orderedSchemas = [...sheetSchemas].sort((a, b) => {
    const aIndex = summaryBySlug.get(a.slug)?.sheetIndex ?? a.sheetIndex ?? 0
    const bIndex = summaryBySlug.get(b.slug)?.sheetIndex ?? b.sheetIndex ?? 0
    return aIndex - bIndex
  })

  const sheets: ProjectSheetSummary[] = orderedSchemas.map((schema) => {
    const summary = summaryBySlug.get(schema.slug)
    return {
      id: schema.slug,
      name: schema.name,
      slug: schema.slug,
      kind: schema.kind,
      rowCount: schema.rowCount,
      columnCount: summary?.columnCount ?? schema.headers.length,
      headers: schema.headers ?? [],
      sheetIndex: summary?.sheetIndex ?? schema.sheetIndex ?? 0,
      hasData: summary?.hasData ?? schema.rowCount > 0,
      warnings: schema.warnings ?? [],
    }
  })

  const sheetData = Object.fromEntries(
    orderedSchemas.map((schema) => {
      const parsedSheet: ParsedWorkbookSheet = {
        originalName: schema.name,
        slug: schema.slug,
        headers: schema.headers ?? [],
        rows: schema.rawRows ?? [],
        semanticRows: schema.rows ?? [],
        rowCount: schema.rowCount,
        columnCount: summaryBySlug.get(schema.slug)?.columnCount ?? schema.headers.length,
        sheetIndex: summaryBySlug.get(schema.slug)?.sheetIndex ?? schema.sheetIndex ?? 0,
        warnings: schema.warnings ?? [],
        metadata: schema.metadata,
      }
      return [schema.slug, parsedSheet]
    }),
  )

  const projectModel: ProjectModel = {
    id: manifest.id,
    filename: manifest.filename,
    name: manifest.name,
    pdNumber: manifest.pdNumber,
    unitNumber: manifest.unitNumber,
    revision: manifest.revision,
    lwcType: normalizeProjectLwcType(manifest.lwcType),
    dueDate: manifest.dueDate ? new Date(manifest.dueDate) : undefined,
    planConlayDate: manifest.planConlayDate ? new Date(manifest.planConlayDate) : undefined,
    planConassyDate: manifest.planConassyDate ? new Date(manifest.planConassyDate) : undefined,
    shipDate: manifest.shipDate ? new Date(manifest.shipDate) : undefined,
    deptTargetDate: manifest.deptTargetDate ? new Date(manifest.deptTargetDate) : undefined,
    color: manifest.color,
    sheets,
    sheetData,
    createdAt: new Date(manifest.createdAt),
    warnings: [],
    activeWorkbookRevisionId: normalizeOptionalString(manifest.activeWorkbookRevisionId),
    activeLayoutRevisionId: normalizeOptionalString(manifest.activeLayoutRevisionId),
    status: manifest.status,
    lifecycleGates: manifest.lifecycleGates,
    estimatedTotalHours: normalizeOptionalNumber(manifest.estimatedTotalHours),
    estimatedPanelCount: normalizeOptionalNumber(manifest.estimatedPanelCount),
    daysLate: normalizeOptionalNumber(manifest.daysLate),
  }

  return {
    root: projectRoot,
    project: {
      id: projectModel.id,
      name: projectModel.name,
      filename: projectModel.filename,
      createdAt: projectModel.createdAt.toISOString(),
      projectModel,
    },
  }
}

// ── Assignment mappings (update sheet schemas + manifest) ──────────────────

export async function readAssignmentMappings(projectId: string): Promise<MappedAssignment[]> {
  // Build MappedAssignment[] from sheet schemas
  const schemas = await readAllSheetSchemas(projectId)
  return schemas.map((s) => ({
    sheetSlug: s.slug,
    sheetName: s.name,
    rowCount: s.rowCount,
    sheetKind: s.kind === 'operational' ? 'assignment' as const : s.kind === 'reference' ? 'reference' as const : 'other' as const,
    detectedSwsType: s.assignment.detectedSwsType as MappedAssignment['detectedSwsType'],
    detectedConfidence: s.assignment.detectedConfidence,
    detectedReasons: s.assignment.detectedReasons,
    selectedSwsType: s.assignment.swsType as MappedAssignment['selectedSwsType'],
    selectedStage: s.assignment.stage,
    selectedStatus: s.assignment.status,
    overrideReason: s.assignment.overrideReason,
    isOverride: s.assignment.isOverride,
    requiresWireSws: s.assignment.requiresWireSws,
    requiresCrossWireSws: s.assignment.requiresCrossWireSws,
    matchedLayoutPage: s.layoutMatch?.pageNumber,
    matchedLayoutTitle: s.layoutMatch?.pageTitle,
  }))
}

export async function writeAssignmentMappings(projectId: string, _pdNumber: string | null | undefined, mappings: MappedAssignment[]) {
  const paths = await resolveExistingStatePaths(projectId)
  if (!paths) throw new Error('Project state directory not found')

  // Update each sheet schema with the new assignment state
  for (const mapping of mappings) {
    const schemaPath = path.join(paths.sheetsDirectory, `${mapping.sheetSlug}.json`)
    const schema = await readJsonFile<SheetSchema>(schemaPath)
    if (!schema) continue

    schema.assignment = {
      swsType: mapping.selectedSwsType,
      stage: normalizeMappedStage(mapping.selectedStage),
      status: mapping.selectedStatus,
      isOverride: mapping.isOverride,
      overrideReason: mapping.overrideReason,
      detectedSwsType: mapping.detectedSwsType,
      detectedConfidence: mapping.detectedConfidence,
      detectedReasons: mapping.detectedReasons,
      requiresWireSws: mapping.requiresWireSws,
      requiresCrossWireSws: mapping.requiresCrossWireSws,
    }

    if (mapping.matchedLayoutPage) {
      schema.layoutMatch = {
        pageNumber: mapping.matchedLayoutPage,
        pageTitle: mapping.matchedLayoutTitle ?? '',
        confidence: 'high',
      }
    } else {
      delete schema.layoutMatch
    }

    await writeJsonFile(schemaPath, schema)
  }

  // Update manifest assignment index
  const manifest = await readProjectManifest(projectId)
  if (manifest) {
    for (const a of mappings) {
      const existing = manifest.assignments[a.sheetSlug]
      manifest.assignments[a.sheetSlug] = buildManifestAssignmentNode(a, existing as Parameters<typeof buildManifestAssignmentNode>[1]) as ProjectManifest['assignments'][string]
    }

    const projectRoot = await resolveProjectRootDirectory(projectId, {
      pdNumber: manifest.pdNumber,
      projectName: manifest.name,
    })
    if (projectRoot) {
      manifest.assignments = (await buildManifestAssignmentSummaries(projectRoot, manifest)) as ProjectManifest['assignments']
    }

    await writeProjectManifest(manifest)
  }

  return mappings
}

// End of share-project-state-handlers.ts
