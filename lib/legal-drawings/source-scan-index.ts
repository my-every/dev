import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import {
  getPathSettings,
  resolveRuntimeStorageDirectoryPath,
} from '@/lib/runtime/share-directory'

export const DEFAULT_LEGAL_DRAWINGS_SOURCE_ROOT = String.raw`S:\Legal Drawings\Drawings`

export type LegalDrawingFileKind =
  | 'ucp_wl_compare_spreadsheet'
  | 'ucp_wire_list_spreadsheet'
  | 'ucp_spreadsheet'
  | 'lay_pdf'

export type LegalDrawingFileStatus = 'new' | 'updated' | 'unchanged'

export interface LegalDrawingIndexedFile {
  fullPath: string
  relativePath: string
  fileName: string
  kind: LegalDrawingFileKind
  mtimeMs: number
  sizeBytes: number
  status: LegalDrawingFileStatus
}

export interface LegalDrawingIndexedProject {
  projectFolderName: string
  projectNumber: string
  projectName: string
  electricalPath: string
  hasUpdates: boolean
  files: LegalDrawingIndexedFile[]
}

export interface LegalDrawingsSourceIndexSchema {
  version: 1
  sourceRoot: string
  scannedAt: string
  fromYear: number
  projectCount: number
  updatedProjectCount: number
  projects: LegalDrawingIndexedProject[]
}

interface PreviousFileSnapshot {
  mtimeMs: number
}

function getProjectNumber(projectFolderName: string): string {
  const [prefix] = projectFolderName.split('_')
  return prefix?.trim() || projectFolderName
}

function getProjectName(projectFolderName: string): string {
  const underscoreIndex = projectFolderName.indexOf('_')
  if (underscoreIndex === -1) return ''
  return projectFolderName.slice(underscoreIndex + 1).trim()
}

function getMatchKind(fileName: string): LegalDrawingFileKind | null {
  const extension = path.extname(fileName).toLowerCase()
  const baseName = path.basename(fileName, extension).toLowerCase()
  const normalizedBaseName = baseName.replace(/[^a-z0-9]+/g, '')
  const isSpreadsheet = ['.xlsx', '.xlsm', '.xls', '.xlsb', '.xslx'].includes(extension)

  if (isSpreadsheet && normalizedBaseName.includes('ucpwlcompare')) {
    return 'ucp_wl_compare_spreadsheet'
  }

  if (isSpreadsheet && (normalizedBaseName.includes('ucpwirelist') || normalizedBaseName.includes('ucpwiringlist'))) {
    return 'ucp_wire_list_spreadsheet'
  }

  if (isSpreadsheet && baseName.includes('ucp')) {
    return 'ucp_spreadsheet'
  }

  if (extension === '.pdf' && baseName.includes('lay')) {
    return 'lay_pdf'
  }

  return null
}

function normalizeConfiguredSourceRoot(value: string | null | undefined): string {
  const raw = String(value ?? '').trim()
  if (!raw) {
    return ''
  }

  const wildcardIndex = raw.indexOf('*')
  const withoutWildcard = wildcardIndex >= 0 ? raw.slice(0, wildcardIndex) : raw

  const withoutTemplate = withoutWildcard
    .replace(/<P#_ProjectName>/gi, '')
    .replace(/<[^>]+>/g, '')

  const cleaned = withoutTemplate
    .replace(/[\\/]+$/g, '')
    .trim()

  if (!cleaned) {
    return ''
  }

  return path.normalize(cleaned)
}

async function ensureDirectoryExists(directoryPath: string): Promise<void> {
  const stat = await fs.stat(directoryPath)
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${directoryPath}`)
  }
}

async function resolveLegalProjectsRoot(sourceRoot: string): Promise<string> {
  const normalized = path.resolve(sourceRoot)
  await ensureDirectoryExists(normalized)

  const drawingsVariants = ['Drawings', 'Drawing']
  for (const folderName of drawingsVariants) {
    const candidatePath = path.join(normalized, folderName)
    try {
      const stat = await fs.stat(candidatePath)
      if (stat.isDirectory()) {
        return candidatePath
      }
    } catch {
      // Continue.
    }
  }

  return normalized
}

async function walkFiles(rootPath: string): Promise<string[]> {
  const queue = [rootPath]
  const files: string[] = []

  while (queue.length > 0) {
    const current = queue.pop()
    if (!current) continue

    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        queue.push(fullPath)
      } else if (entry.isFile()) {
        files.push(fullPath)
      }
    }
  }

  return files
}

function buildPreviousSnapshot(index: LegalDrawingsSourceIndexSchema | null): Map<string, PreviousFileSnapshot> {
  const snapshot = new Map<string, PreviousFileSnapshot>()
  if (!index) {
    return snapshot
  }

  for (const project of index.projects) {
    for (const file of project.files) {
      snapshot.set(file.relativePath.toUpperCase(), { mtimeMs: file.mtimeMs })
    }
  }

  return snapshot
}

function toStatus(
  relativePath: string,
  mtimeMs: number,
  previousSnapshot: Map<string, PreviousFileSnapshot>,
): LegalDrawingFileStatus {
  const key = relativePath.toUpperCase()
  const previous = previousSnapshot.get(key)
  if (!previous) {
    return 'new'
  }

  if (mtimeMs > previous.mtimeMs) {
    return 'updated'
  }

  return 'unchanged'
}

function getIndexFilePath(runtimeStorageDirectory: string): string {
  return path.join(runtimeStorageDirectory, 'legal-drawings-source-index.json')
}

async function readSavedSourceIndex(): Promise<LegalDrawingsSourceIndexSchema | null> {
  const runtimeStorageDirectory = await resolveRuntimeStorageDirectoryPath()
  const indexPath = getIndexFilePath(runtimeStorageDirectory)

  try {
    const raw = await fs.readFile(indexPath, 'utf-8')
    const parsed = JSON.parse(raw) as LegalDrawingsSourceIndexSchema
    if (parsed?.version !== 1 || !Array.isArray(parsed.projects)) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

async function writeSourceIndex(index: LegalDrawingsSourceIndexSchema): Promise<void> {
  const runtimeStorageDirectory = await resolveRuntimeStorageDirectoryPath()
  const indexPath = getIndexFilePath(runtimeStorageDirectory)
  await fs.mkdir(path.dirname(indexPath), { recursive: true })
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8')
}

export async function resolveLegalDrawingsSourceRoot(): Promise<string> {
  const pathSettings = await getPathSettings()
  const configured = normalizeConfiguredSourceRoot(pathSettings.legalDrawingsPath)
  return configured
}

export async function buildLegalDrawingsSourceIndex(options?: {
  sourceRoot?: string
  fromYear?: number
  previousIndex?: LegalDrawingsSourceIndexSchema | null
}): Promise<LegalDrawingsSourceIndexSchema> {
  const sourceRoot = normalizeConfiguredSourceRoot(options?.sourceRoot)
  if (!sourceRoot) {
    throw new Error('Legal Drawings source root is not configured. Set it in Startup or Path Settings.')
  }
  const fromYear = Number.isInteger(options?.fromYear) ? Number(options?.fromYear) : 2026
  const fromTimeMs = new Date(fromYear, 0, 1).getTime()

  const previousIndex = options?.previousIndex ?? await readSavedSourceIndex()
  const previousSnapshot = buildPreviousSnapshot(previousIndex)

  const projectRoot = await resolveLegalProjectsRoot(sourceRoot)
  const directoryEntries = await fs.readdir(projectRoot, { withFileTypes: true })
  const projectDirectories = directoryEntries
    .filter(entry => entry.isDirectory())
    .map(entry => ({
      name: entry.name,
      fullPath: path.join(projectRoot, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }))

  const projects: LegalDrawingIndexedProject[] = []

  for (const projectDirectory of projectDirectories) {
    const electricalPath = path.join(projectDirectory.fullPath, 'Electrical')

    try {
      const electricalStat = await fs.stat(electricalPath)
      if (!electricalStat.isDirectory()) {
        continue
      }
    } catch {
      continue
    }

    const filesInElectrical = await walkFiles(electricalPath)
    const indexedFiles: LegalDrawingIndexedFile[] = []

    for (const filePath of filesInElectrical) {
      const fileName = path.basename(filePath)
      const kind = getMatchKind(fileName)
      if (!kind) {
        continue
      }

      const stat = await fs.stat(filePath)
      if (stat.mtimeMs < fromTimeMs) {
        continue
      }

      const relativePath = path.relative(projectRoot, filePath)
      const status = toStatus(relativePath, stat.mtimeMs, previousSnapshot)

      indexedFiles.push({
        fullPath: filePath,
        relativePath,
        fileName,
        kind,
        mtimeMs: stat.mtimeMs,
        sizeBytes: stat.size,
        status,
      })
    }

    indexedFiles.sort((left, right) => {
      if (right.mtimeMs !== left.mtimeMs) {
        return right.mtimeMs - left.mtimeMs
      }
      return left.fileName.localeCompare(right.fileName)
    })

    projects.push({
      projectFolderName: projectDirectory.name,
      projectNumber: getProjectNumber(projectDirectory.name),
      projectName: getProjectName(projectDirectory.name),
      electricalPath,
      hasUpdates: indexedFiles.some(file => file.status === 'new' || file.status === 'updated'),
      files: indexedFiles,
    })
  }

  const index: LegalDrawingsSourceIndexSchema = {
    version: 1,
    sourceRoot,
    scannedAt: new Date().toISOString(),
    fromYear,
    projectCount: projects.length,
    updatedProjectCount: projects.filter(project => project.hasUpdates).length,
    projects,
  }

  return index
}

export async function refreshLegalDrawingsSourceIndex(options?: {
  sourceRoot?: string
  fromYear?: number
}): Promise<LegalDrawingsSourceIndexSchema> {
  const previousIndex = await readSavedSourceIndex()
  const index = await buildLegalDrawingsSourceIndex({
    ...options,
    previousIndex,
  })
  await writeSourceIndex(index)
  return index
}

export async function getLegalDrawingsSourceIndex(options?: {
  sourceRoot?: string
  fromYear?: number
  refresh?: boolean
}): Promise<LegalDrawingsSourceIndexSchema> {
  if (options?.refresh) {
    return refreshLegalDrawingsSourceIndex(options)
  }

  const saved = await readSavedSourceIndex()
  if (saved) {
    return saved
  }

  return refreshLegalDrawingsSourceIndex(options)
}
