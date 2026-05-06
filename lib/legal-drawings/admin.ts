import { promises as fs } from 'node:fs'
import path from 'node:path'

export type LegalDrawingsMaintenanceCommand =
  | 'clear-meta'
  | 'clear-generated'
  | 'clear-revision-meta'
  | 'clear-unknown-schema-compare'
  | 'clear-empty-directories'
  | 'clear-orphans'
  | 'restore-root-sources'
  | 'reset-all'

export interface LegalDrawingsMaintenanceOptions {
  command: LegalDrawingsMaintenanceCommand
  pdNumber?: string | null
  revision?: string | null
  dryRun?: boolean
  legalRoot?: string
}

export interface LegalDrawingsRevisionSummary {
  revision: string
  removed?: string[]
  restored?: string[]
}

export interface LegalDrawingsProjectSummary {
  pdNumber: string
  rootRemoved: string[]
  revisions: LegalDrawingsRevisionSummary[]
}

export interface LegalDrawingsMaintenanceSummary {
  command: LegalDrawingsMaintenanceCommand
  legalRoot: string
  dryRun: boolean
  processedAt: string
  projects: LegalDrawingsProjectSummary[]
}

interface LegalProjectEntry {
  name: string
  path: string
}

interface LegalDrawingsMaintenanceContext {
  command: LegalDrawingsMaintenanceCommand
  dryRun: boolean
  onlyRevision: string | null
}

const ROOT_META_FILES = ['project-meta.json', 'latest.json']
const REVISION_META_FILES = ['build-meta.json', 'revision.json']
const WORKBOOK_EXTENSIONS = new Set(['.xlsx', '.xlsm', '.xls'])
const PDF_EXTENSIONS = new Set(['.pdf'])
const GENERATED_ROOT_FILES = [
  'layout-pages.json',
  'layout-pages.index.json',
  'device-part-numbers.json',
  'upload-props.json',
  'project-manifest.json',
]
const GENERATED_ROOT_DIRS = [
  'sheets',
  'wire-list-print-schema',
  'wire-brand-list',
  'wire-list-green-changes',
  'state',
]
const ORPHAN_FILE_PATTERNS = [/\.tmp$/i, /\.temp$/i, /\.bak$/i, /^\.DS_Store$/i, /^Thumbs\.db$/i]

function normalize(value: string | null | undefined) {
  return String(value ?? '').trim()
}

function normalizeMatch(value: string | null | undefined) {
  return normalize(value).toLowerCase()
}

function resolveLegalRoot(explicitRoot?: string) {
  return explicitRoot || process.env.LEGAL_DRAWINGS_ROOT || path.join(process.cwd(), 'Share', 'Legal Drawings')
}

export function getLegalDrawingsMaintenanceHelpText() {
  return [
    'Legal Drawings Maintenance CLI',
    '',
    'Usage:',
    '  node --experimental-strip-types scripts/legal-drawings-maintenance.ts <command> [--pd <PD>] [--rev <REV>] [--dry-run]',
    '',
    'Commands:',
    '  clear-meta          Remove root project-meta.json and latest.json',
    '  clear-generated     Remove generated revision artifacts (layout/pages/schemas/state)',
    '  clear-revision-meta Remove build-meta.json and revision.json from revision folders',
    '  clear-unknown-schema-compare Remove unknown compare artifacts in wire-list-green-changes',
    '  clear-empty-directories Remove empty directories under each legal project',
    '  clear-orphans       Remove common orphan/temp files (*.tmp, *.temp, *.bak, .DS_Store)',
    '  restore-root-sources Copy missing root UCP/LAY files back from the chosen/latest revision',
    '  reset-all           Remove both root meta and revision generated/meta files',
    '',
    'Examples:',
    '  node --experimental-strip-types scripts/legal-drawings-maintenance.ts clear-meta --pd 4K001',
    '  node --experimental-strip-types scripts/legal-drawings-maintenance.ts clear-generated --pd ANG01 --rev A.6_M.2',
    '  node --experimental-strip-types scripts/legal-drawings-maintenance.ts clear-empty-directories',
    '  node --experimental-strip-types scripts/legal-drawings-maintenance.ts clear-orphans --dry-run',
    '  node --experimental-strip-types scripts/legal-drawings-maintenance.ts restore-root-sources --pd 4K001',
    '  node --experimental-strip-types scripts/legal-drawings-maintenance.ts reset-all --dry-run',
    '',
  ].join('\n')
}

export async function runLegalDrawingsMaintenance(
  options: LegalDrawingsMaintenanceOptions,
): Promise<LegalDrawingsMaintenanceSummary> {
  const legalRoot = resolveLegalRoot(options.legalRoot)
  const onlyPd = normalize(options.pdNumber)
  const context: LegalDrawingsMaintenanceContext = {
    command: options.command,
    dryRun: Boolean(options.dryRun),
    onlyRevision: normalize(options.revision) || null,
  }

  const projects = await listLegalProjects(legalRoot)
  const selectedProjects = onlyPd
    ? projects.filter((project) => normalizeMatch(project.name) === normalizeMatch(onlyPd))
    : projects

  const summary: LegalDrawingsMaintenanceSummary = {
    command: options.command,
    legalRoot,
    dryRun: context.dryRun,
    processedAt: new Date().toISOString(),
    projects: [],
  }

  for (const project of selectedProjects) {
    const projectSummary = await processProject(project, context)
    if (projectSummary) {
      summary.projects.push(projectSummary)
    }
  }

  return summary
}

async function processProject(
  project: LegalProjectEntry,
  context: LegalDrawingsMaintenanceContext,
): Promise<LegalDrawingsProjectSummary | null> {
  const pdPath = project.path
  const entries = await fs.readdir(pdPath, { withFileTypes: true }).catch(() => [])
  const revisionNames = entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => entry.name)
    .filter((name) => !context.onlyRevision || normalizeMatch(name) === normalizeMatch(context.onlyRevision))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))

  const summary: LegalDrawingsProjectSummary = {
    pdNumber: project.name,
    rootRemoved: [],
    revisions: [],
  }

  if (context.command === 'clear-meta') {
    for (const fileName of ROOT_META_FILES) {
      const targetPath = path.join(pdPath, fileName)
      if (await removeIfExists(targetPath, context.dryRun)) {
        summary.rootRemoved.push(targetPath)
      }
    }
    return summary
  }

  if (context.command === 'clear-generated') {
    for (const revision of revisionNames) {
      const revisionPath = path.join(pdPath, revision)
      const removed = await clearGeneratedArtifacts(revisionPath, context.dryRun)
      summary.revisions.push({ revision, removed })
    }
    return summary
  }

  if (context.command === 'clear-revision-meta') {
    for (const revision of revisionNames) {
      const revisionPath = path.join(pdPath, revision)
      const removed: string[] = []
      for (const fileName of REVISION_META_FILES) {
        const targetPath = path.join(revisionPath, fileName)
        if (await removeIfExists(targetPath, context.dryRun)) {
          removed.push(targetPath)
        }
      }
      summary.revisions.push({ revision, removed })
    }
    return summary
  }

  if (context.command === 'restore-root-sources') {
    const latestRecord = await readJsonIfExists<{ latestRevision?: string }>(path.join(pdPath, 'latest.json'))
    const preferredRevision = context.onlyRevision || latestRecord?.latestRevision || revisionNames.at(-1) || null
    if (preferredRevision) {
      const revisionPath = path.join(pdPath, preferredRevision)
      const restored = await restoreRootSourcesFromRevision(pdPath, revisionPath, context.dryRun)
      summary.revisions.push({ revision: preferredRevision, restored })
    }
    return summary
  }

  if (context.command === 'reset-all') {
    for (const fileName of ROOT_META_FILES) {
      const targetPath = path.join(pdPath, fileName)
      if (await removeIfExists(targetPath, context.dryRun)) {
        summary.rootRemoved.push(targetPath)
      }
    }
    for (const revision of revisionNames) {
      const revisionPath = path.join(pdPath, revision)
      const removed = await clearGeneratedArtifacts(revisionPath, context.dryRun)
      for (const fileName of REVISION_META_FILES) {
        const targetPath = path.join(revisionPath, fileName)
        if (await removeIfExists(targetPath, context.dryRun)) {
          removed.push(targetPath)
        }
      }
      summary.revisions.push({ revision, removed })
    }
    return summary
  }

  if (context.command === 'clear-empty-directories') {
    const removed = await removeEmptyDirectoriesRecursive(pdPath, context.dryRun)
    summary.rootRemoved.push(...removed)
    return summary
  }

  if (context.command === 'clear-orphans') {
    const rootOrphans = await removeOrphanFilesInDirectory(pdPath, context.dryRun, {
      recursive: false,
      skipNames: new Set(['project-meta.json', 'latest.json']),
      skipDirectories: new Set(revisionNames),
    })
    summary.rootRemoved.push(...rootOrphans)

    for (const revision of revisionNames) {
      const revisionPath = path.join(pdPath, revision)
      const removed = await removeOrphanFilesInDirectory(revisionPath, context.dryRun, {
        recursive: true,
      })
      summary.revisions.push({ revision, removed })
    }
    return summary
  }

  if (context.command === 'clear-unknown-schema-compare') {
    const rootRemoved = await clearUnknownSchemaCompareAtProjectRoot(pdPath, context.dryRun)
    summary.rootRemoved.push(...rootRemoved)

    for (const revision of revisionNames) {
      const revisionPath = path.join(pdPath, revision)
      const removed = await clearUnknownSchemaCompare(revisionPath, context.dryRun)
      summary.revisions.push({ revision, removed })
    }
    return summary
  }

  return summary
}

async function clearGeneratedArtifacts(revisionPath: string, dryRun: boolean) {
  const removed: string[] = []
  for (const fileName of GENERATED_ROOT_FILES) {
    const targetPath = path.join(revisionPath, fileName)
    if (await removeIfExists(targetPath, dryRun)) {
      removed.push(targetPath)
    }
  }
  for (const dirName of GENERATED_ROOT_DIRS) {
    const targetPath = path.join(revisionPath, dirName)
    if (await removeDirectoryIfExists(targetPath, dryRun)) {
      removed.push(targetPath)
    }
  }
  return removed
}

async function clearUnknownSchemaCompare(revisionPath: string, dryRun: boolean) {
  const removed: string[] = []
  const unknownDir = path.join(revisionPath, 'unknown')
  if (await removePathIfExists(unknownDir, dryRun)) {
    removed.push(unknownDir)
  }

  const baseDir = path.join(revisionPath, 'wire-list-green-changes')
  const matches = await findPaths(baseDir, (entryPath, entry) => {
    const fileName = entry.name.toLowerCase()
    const fullPath = entryPath.toLowerCase()

    if (entry.isDirectory()) {
      return fileName === 'unknown'
    }

    return entry.isFile()
      && fileName.endsWith('.json')
      && (fileName.includes('unknown-schema-compare') || (fileName.includes('unknown') && fullPath.includes('compare')))
  })

  const revisionRootFiles = await fs.readdir(revisionPath, { withFileTypes: true }).catch(() => [])
  for (const entry of revisionRootFiles) {
    if (!entry.isFile()) continue
    const fileName = entry.name.toLowerCase()
    if (!fileName.includes('unknown-schema-compare')) continue
    if (!fileName.endsWith('.json')) continue
    matches.push(path.join(revisionPath, entry.name))
  }

  for (const targetPath of matches.sort((left, right) => right.length - left.length)) {
    if (await removePathIfExists(targetPath, dryRun)) {
      removed.push(targetPath)
    }
  }

  return removed
}

async function clearUnknownSchemaCompareAtProjectRoot(pdPath: string, dryRun: boolean) {
  const removed: string[] = []
  const unknownDir = path.join(pdPath, 'unknown')
  if (await removePathIfExists(unknownDir, dryRun)) {
    removed.push(unknownDir)
  }

  const rootFiles = await fs.readdir(pdPath, { withFileTypes: true }).catch(() => [])
  for (const entry of rootFiles) {
    if (!entry.isFile()) continue
    const fileName = entry.name.toLowerCase()
    if (!fileName.endsWith('.json')) continue
    if (!fileName.includes('unknown-schema-compare')) continue

    const targetPath = path.join(pdPath, entry.name)
    if (await removePathIfExists(targetPath, dryRun)) {
      removed.push(targetPath)
    }
  }

  return removed
}

async function removeOrphanFilesInDirectory(
  dirPath: string,
  dryRun: boolean,
  options: {
    recursive: boolean
    skipNames?: Set<string>
    skipDirectories?: Set<string>
  },
) {
  const removed: string[] = []
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => [])
  const skipNames = options.skipNames ?? new Set<string>()
  const skipDirectories = options.skipDirectories ?? new Set<string>()

  for (const entry of entries) {
    const targetPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      if (skipDirectories.has(entry.name)) {
        continue
      }

      if (options.recursive) {
        const nested = await removeOrphanFilesInDirectory(targetPath, dryRun, {
          recursive: true,
          skipNames,
          skipDirectories,
        })
        removed.push(...nested)
      }
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (skipNames.has(entry.name)) {
      continue
    }

    if (!ORPHAN_FILE_PATTERNS.some((pattern) => pattern.test(entry.name))) {
      continue
    }

    if (!dryRun) {
      await fs.rm(targetPath, { force: true })
    }
    removed.push(targetPath)
  }

  return removed
}

async function removeEmptyDirectoriesRecursive(rootPath: string, dryRun: boolean) {
  const removed: string[] = []

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true }).catch(() => [])

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }
      await walk(path.join(currentPath, entry.name))
    }

    if (currentPath === rootPath) {
      return
    }

    const remaining = await fs.readdir(currentPath).catch(() => [])
    if (remaining.length === 0) {
      if (!dryRun) {
        await fs.rm(currentPath, { recursive: true, force: true })
      }
      removed.push(currentPath)
    }
  }

  await walk(rootPath)
  return removed
}

async function findPaths(
  startPath: string,
  matcher: (entryPath: string, entry: { name: string; isDirectory(): boolean; isFile(): boolean }) => boolean,
) {
  if (!(await exists(startPath))) {
    return []
  }

  const results: string[] = []

  async function walk(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name)
      if (matcher(entryPath, entry)) {
        results.push(entryPath)
      }
      if (entry.isDirectory()) {
        await walk(entryPath)
      }
    }
  }

  await walk(startPath)
  return results
}

async function removePathIfExists(targetPath: string, dryRun: boolean) {
  try {
    const stats = await fs.stat(targetPath)
    if (!dryRun) {
      await fs.rm(targetPath, { recursive: stats.isDirectory(), force: true })
    }
    return true
  } catch {
    return false
  }
}

async function restoreRootSourcesFromRevision(pdPath: string, revisionPath: string, dryRun: boolean) {
  const restored: string[] = []
  const entries = await fs.readdir(revisionPath, { withFileTypes: true }).catch(() => [])

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    const extension = path.extname(entry.name).toLowerCase()
    const isWorkbook = WORKBOOK_EXTENSIONS.has(extension)
    const isLayout = PDF_EXTENSIONS.has(extension)
    if (!isWorkbook && !isLayout) {
      continue
    }

    const sourcePath = path.join(revisionPath, entry.name)
    const targetPath = path.join(pdPath, entry.name)
    if (await exists(targetPath)) {
      continue
    }

    restored.push(targetPath)
    if (!dryRun) {
      await fs.copyFile(sourcePath, targetPath)
    }
  }

  return restored
}

async function removeIfExists(targetPath: string, dryRun: boolean) {
  try {
    const stats = await fs.stat(targetPath)
    if (!stats.isFile()) {
      return false
    }
    if (!dryRun) {
      await fs.rm(targetPath, { force: true })
    }
    return true
  } catch {
    return false
  }
}

async function removeDirectoryIfExists(targetPath: string, dryRun: boolean) {
  try {
    const stats = await fs.stat(targetPath)
    if (!stats.isDirectory()) {
      return false
    }
    if (!dryRun) {
      await fs.rm(targetPath, { recursive: true, force: true })
    }
    return true
  } catch {
    return false
  }
}

async function listLegalProjects(legalRoot: string): Promise<LegalProjectEntry[]> {
  const entries = await fs.readdir(legalRoot, { withFileTypes: true }).catch(() => [])
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
    .map((entry) => ({
      name: entry.name,
      path: path.join(legalRoot, entry.name),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function readJsonIfExists<T>(filePath: string): Promise<T | null> {
  try {
    const value = await fs.readFile(filePath, 'utf8')
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

async function exists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}