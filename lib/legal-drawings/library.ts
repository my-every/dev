import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { buildProjectModel } from '@/lib/workbook/build-project-model'
import { buildUploadPropsManifest } from '@/lib/workbook/upload-props'
import { parseWorkbook } from '@/lib/workbook/parse-workbook'
import { buildGreenChangeSchemasFromWorkbook, isGreenChangesWorkbookFileName } from '@/lib/workbook/green-changes-schema'
import { buildDefaultMappedAssignments, buildAllSheetSchemas, buildProjectManifest } from '@/lib/project-state/schema-generators'
import { summarizeLayoutPagesForManifest } from '@/lib/project-state/layout-pages-manifest-summary'
import { computeManifestAggregates, deriveProjectMechanicalSummaryFromAssignments } from '@/lib/project-state/manifest-layout-utils'
import { buildManifestAssignmentSummaries } from '@/lib/project-state/manifest-assignment-summaries'
import { generateDevicePartNumbersMap } from '@/lib/project-state/device-part-numbers-generator'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import { generateCleanProjectId } from '@/lib/workbook/normalize-sheet-name'
import { parseLegalDrawingsFileVersion, compareLegalDrawingsFileVersions, extractProjectNumberFromLegalFolder, getProjectNameFromLegalFolder } from '@/lib/legal-drawings/discovery'
import type { ProjectManifest } from '@/types/project-manifest'
import type { StoredProject } from '@/types/d380-shared'
import type { ProjectModel } from '@/lib/workbook/types'
import type { LegalDrawingsLibraryManifest, LegalProjectRecord, LegalRevisionArtifactStatus, LegalRevisionRecord, LegalDrawingsSyncResult, LegalSyncProjectResult, CreateProjectFromLegalSourceInput } from '@/types/legal-drawings'
import { buildShareProjectFolderName, writeProjectManifest } from '@/lib/project-state/share-project-state-handlers'
import {
  applyResolvedVisibilityToManifest,
  readAssignmentVisibilityReferenceSettings,
  readProjectAssignmentVisibilitySettings,
  resolveVisibilitySettingsForManifest,
} from '@/lib/project-state/assignment-visibility-settings'
import { resolveProjectRootDirectory, readProjectManifest as readExistingProjectManifest } from '@/lib/project-state/share-project-state-handlers'
import type { LayoutPagesIndexDocument, SlimLayoutPage } from '@/lib/layout-matching'
import { buildSlimLayoutPagesFromIndex, extractLayoutPagesIndexOnServer } from '@/lib/layout-matching/extract-layout-pages-index-server'
import { enrichManifestFromProjectState } from '@/lib/project-state/manifest-enrichment'
import { generateAllPrintSchemas } from '@/lib/project-exports/generate-print-schemas'
import { findSlotManifestMetadata } from '@/lib/project-schedule/slots-project-seeding'
import { buildLayoutPageCollections } from '@/lib/layout-matching/layout-page-collections'
import { updateLayoutPageReferenceStore } from '@/lib/layout-matching/layout-page-reference-store'

const WORKBOOK_PATTERN = /\.(xlsx|xlsm|xls|xlsb)$/i
const LAYOUT_PATTERN = /\.pdf$/i

const LEGAL_LIBRARY_CACHE_TTL_MS = 60_000
let legalLibraryManifestCache:
  | { manifest: LegalDrawingsLibraryManifest; expiresAt: number }
  | null = null
let legalLibraryManifestInFlight: Promise<LegalDrawingsLibraryManifest> | null = null

export function invalidateLegalDrawingsLibraryManifestCache() {
  legalLibraryManifestCache = null
}

interface LegalSourceCandidate {
  pdNumber: string
  projectNameHint: string
  sourceFolderName: string
  sourceProjectPath: string
  sourceFilesDirectory: string
  workbook: SourceFileCandidate | null
  greenChangesWorkbook: SourceFileCandidate | null
  layout: SourceFileCandidate | null
}

interface SourceFileCandidate {
  fileName: string
  fullPath: string
  mtimeMs: number
  revision: string
  baseRevision: string
  isModified: boolean
}

interface BuiltLegalRevision {
  manifest: ProjectManifest | null
  model: ProjectModel | null
  uploadPropsBuilt: boolean
  layoutPagesBuilt: boolean
  devicePartNumbersBuilt: boolean
  sheetSchemasBuilt: boolean
  greenChangesSchemaBuilt: boolean
  wireListPrintSchemaBuilt: boolean
  brandListSchemaBuilt: boolean
  diagnostics: string[]
}

function normalizeRevisionFolderName(revision: string | null | undefined) {
  const normalized = String(revision ?? '').trim().toUpperCase()
  return normalized || 'IMPORTED'
}

function isWorkbookCandidate(fileName: string) {
  return WORKBOOK_PATTERN.test(fileName) && /ucp/i.test(fileName) && !isGreenChangesWorkbookCandidate(fileName)
}

function isGreenChangesWorkbookCandidate(fileName: string) {
  return isGreenChangesWorkbookFileName(fileName)
}

function isLayoutCandidate(fileName: string) {
  return LAYOUT_PATTERN.test(fileName) && /lay/i.test(fileName)
}

function isTempOfficeFile(fileName: string) {
  return fileName.startsWith('~$')
}

function toIsoDate(value: number | null | undefined) {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value).toISOString() : null
}

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
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
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), 'utf-8')
}

async function copyFileIfChanged(sourcePath: string, destinationPath: string) {
  const [sourceStat, destinationStat] = await Promise.all([
    fs.stat(sourcePath),
    fs.stat(destinationPath).catch(() => null),
  ])

  if (
    destinationStat
    && destinationStat.size === sourceStat.size
    && destinationStat.mtimeMs >= sourceStat.mtimeMs
  ) {
    return false
  }

  await fs.mkdir(path.dirname(destinationPath), { recursive: true })
  await fs.copyFile(sourcePath, destinationPath)
  await fs.utimes(destinationPath, sourceStat.atime, sourceStat.mtime)
  return true
}

function compareCandidates(left: SourceFileCandidate, right: SourceFileCandidate) {
  const versionCompare = compareLegalDrawingsFileVersions(
    {
      revision: left.revision,
      baseRevision: left.baseRevision,
      isModified: left.isModified,
      modificationNumber: left.isModified ? Number.parseInt(left.revision.split('M.')[1] ?? '', 10) || undefined : undefined,
    },
    {
      revision: right.revision,
      baseRevision: right.baseRevision,
      isModified: right.isModified,
      modificationNumber: right.isModified ? Number.parseInt(right.revision.split('M.')[1] ?? '', 10) || undefined : undefined,
    },
  )

  if (versionCompare !== 0) {
    return versionCompare
  }

  return left.mtimeMs - right.mtimeMs
}

async function listSourceProjectCandidates(sourceRoot: string): Promise<LegalSourceCandidate[]> {
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true })
  const folders = entries.filter(entry => entry.isDirectory())
  const grouped = new Map<string, LegalSourceCandidate[]>()

  for (const folder of folders) {
    const sourceProjectPath = path.join(sourceRoot, folder.name)
    const electricalPath = path.join(sourceProjectPath, 'Electrical')
    const sourceFilesDirectory = await pathExists(electricalPath) ? electricalPath : sourceProjectPath
    const fileEntries = await fs.readdir(sourceFilesDirectory, { withFileTypes: true }).catch(() => [])

    let latestWorkbook: SourceFileCandidate | null = null
    let latestGreenChangesWorkbook: SourceFileCandidate | null = null
    let latestLayout: SourceFileCandidate | null = null

    for (const fileEntry of fileEntries) {
      if (!fileEntry.isFile() || isTempOfficeFile(fileEntry.name)) {
        continue
      }

      const isWorkbook = isWorkbookCandidate(fileEntry.name)
      const isGreenChangesWorkbook = isGreenChangesWorkbookCandidate(fileEntry.name)
      const isLayout = isLayoutCandidate(fileEntry.name)
      if (!isWorkbook && !isGreenChangesWorkbook && !isLayout) {
        continue
      }

      const fullPath = path.join(sourceFilesDirectory, fileEntry.name)
      const stats = await fs.stat(fullPath)
      const version = parseLegalDrawingsFileVersion(fileEntry.name)
      const candidate: SourceFileCandidate = {
        fileName: fileEntry.name,
        fullPath,
        mtimeMs: stats.mtimeMs,
        revision: version.revision,
        baseRevision: version.baseRevision,
        isModified: version.isModified,
      }

      if (isWorkbook && (!latestWorkbook || compareCandidates(latestWorkbook, candidate) < 0)) {
        latestWorkbook = candidate
      }
      if (isGreenChangesWorkbook && (!latestGreenChangesWorkbook || compareCandidates(latestGreenChangesWorkbook, candidate) < 0)) {
        latestGreenChangesWorkbook = candidate
      }
      if (isLayout && (!latestLayout || compareCandidates(latestLayout, candidate) < 0)) {
        latestLayout = candidate
      }
    }

    const pdNumber = extractProjectNumberFromLegalFolder(folder.name)
    const projectNameHint = getProjectNameFromLegalFolder(folder.name)
    const groupedCandidates = grouped.get(pdNumber) ?? []
    groupedCandidates.push({
      pdNumber,
      projectNameHint,
      sourceFolderName: folder.name,
      sourceProjectPath,
      sourceFilesDirectory,
      workbook: latestWorkbook,
      greenChangesWorkbook: latestGreenChangesWorkbook,
      layout: latestLayout,
    })
    grouped.set(pdNumber, groupedCandidates)
  }

  const selected: LegalSourceCandidate[] = []
  for (const [pdNumber, candidates] of grouped.entries()) {
    let workbook: SourceFileCandidate | null = null
    let greenChangesWorkbook: SourceFileCandidate | null = null
    let layout: SourceFileCandidate | null = null
    let projectNameHint = pdNumber
    let sourceFolderName = pdNumber
    let sourceProjectPath = ''
    let sourceFilesDirectory = ''

    for (const candidate of candidates) {
      if (candidate.workbook && (!workbook || compareCandidates(workbook, candidate.workbook) < 0)) {
        workbook = candidate.workbook
        projectNameHint = candidate.projectNameHint
        sourceFolderName = candidate.sourceFolderName
        sourceProjectPath = candidate.sourceProjectPath
        sourceFilesDirectory = candidate.sourceFilesDirectory
      }
      if (candidate.greenChangesWorkbook && (!greenChangesWorkbook || compareCandidates(greenChangesWorkbook, candidate.greenChangesWorkbook) < 0)) {
        greenChangesWorkbook = candidate.greenChangesWorkbook
        if (!sourceProjectPath) {
          projectNameHint = candidate.projectNameHint
          sourceFolderName = candidate.sourceFolderName
          sourceProjectPath = candidate.sourceProjectPath
          sourceFilesDirectory = candidate.sourceFilesDirectory
        }
      }
      if (candidate.layout && (!layout || compareCandidates(layout, candidate.layout) < 0)) {
        layout = candidate.layout
        if (!sourceProjectPath) {
          projectNameHint = candidate.projectNameHint
          sourceFolderName = candidate.sourceFolderName
          sourceProjectPath = candidate.sourceProjectPath
          sourceFilesDirectory = candidate.sourceFilesDirectory
        }
      }
    }

    selected.push({
      pdNumber,
      projectNameHint,
      sourceFolderName,
      sourceProjectPath,
      sourceFilesDirectory,
      workbook,
      greenChangesWorkbook,
      layout,
    })
  }

  return selected.sort((left, right) => left.pdNumber.localeCompare(right.pdNumber, undefined, { numeric: true, sensitivity: 'base' }))
}

async function getLegalDrawingsRoot() {
  const shareRoot = await resolveShareDirectory()
  return path.join(shareRoot, 'Legal Drawings')
}

function getLatestManifestPath(projectRoot: string) {
  return path.join(projectRoot, 'latest.json')
}

function getRevisionRoot(projectRoot: string, revision: string) {
  return path.join(projectRoot, normalizeRevisionFolderName(revision))
}

function createEmptyArtifactStatus(): LegalRevisionArtifactStatus {
  return {
    workbookPresent: false,
    greenChangesWorkbookPresent: false,
    layoutPresent: false,
    uploadPropsBuilt: false,
    manifestBuilt: false,
    layoutPagesBuilt: false,
    devicePartNumbersBuilt: false,
    sheetSchemasBuilt: false,
    greenChangesSchemaBuilt: false,
    wireListPrintSchemaPrepared: false,
    brandListSchemaPrepared: false,
  }
}

function buildLegalManifestModelName(pdNumber: string, projectNameHint?: string) {
  const normalizedHint = String(projectNameHint ?? '').trim()
  return normalizedHint && normalizedHint.toUpperCase() !== pdNumber.toUpperCase()
    ? normalizedHint
    : pdNumber
}

async function parseWorkbookBuffer(filePath: string, fileName: string) {
  const buffer = await fs.readFile(filePath)
  const workbookFile = new File([buffer], fileName)
  return parseWorkbook(workbookFile)
}

async function buildServerLayoutPages(layoutPath: string): Promise<{
  index: LayoutPagesIndexDocument
  slimPages: SlimLayoutPage[]
}> {
  const index = await extractLayoutPagesIndexOnServer(layoutPath)
  const slimPages = buildSlimLayoutPagesFromIndex(index)
  return { index, slimPages }
}

async function buildLegalRevisionFiles(
  revisionRoot: string,
  candidate: LegalSourceCandidate,
  revision: string,
): Promise<BuiltLegalRevision> {
  const workbookCandidate = candidate.workbook
  const greenChangesWorkbookCandidate = candidate.greenChangesWorkbook
  const layoutCandidate = candidate.layout
  const diagnostics: string[] = []
  const sheetsRoot = path.join(revisionRoot, 'sheets')
  const printSchemaRoot = path.join(revisionRoot, 'wire-list-print-schema')
  const brandSchemaRoot = path.join(revisionRoot, 'wire-brand-list')
  const greenChangesSchemaRoot = path.join(revisionRoot, 'wire-list-green-changes')

  await Promise.all([
    fs.mkdir(sheetsRoot, { recursive: true }),
    fs.mkdir(printSchemaRoot, { recursive: true }),
    fs.mkdir(brandSchemaRoot, { recursive: true }),
    fs.mkdir(greenChangesSchemaRoot, { recursive: true }),
  ])

  let manifest: ProjectManifest | null = null
  let model: ProjectModel | null = null
  let uploadPropsBuilt = false
  let layoutPagesBuilt = false
  let devicePartNumbersBuilt = false
  let sheetSchemasBuilt = false
  let greenChangesSchemaBuilt = false
  let wireListPrintSchemaBuilt = false
  let brandListSchemaBuilt = false
  const shareRoot = await resolveShareDirectory()

  if (workbookCandidate) {
    const parsed = await parseWorkbookBuffer(workbookCandidate.fullPath, workbookCandidate.fileName)
    if (!parsed.success || !parsed.workbook) {
      diagnostics.push(...parsed.errors)
    } else {
      model = buildProjectModel(parsed.workbook)
      model.id = `legal-${candidate.pdNumber.toLowerCase()}-${normalizeRevisionFolderName(revision).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      model.name = buildLegalManifestModelName(
        candidate.pdNumber,
        parsed.workbook.sheets[0]?.metadata?.projectName || candidate.projectNameHint,
      )
      model.pdNumber = candidate.pdNumber
      model.revision = revision

      const defaultAssignments = buildDefaultMappedAssignments(model)
      const builtManifest = buildProjectManifest(model, defaultAssignments)
      builtManifest.name = model.name
      builtManifest.pdNumber = candidate.pdNumber
      builtManifest.revision = revision
      const slotMetadata = await findSlotManifestMetadata(shareRoot, {
        pdNumber: candidate.pdNumber,
        unitNumber: model.unitNumber,
      })
      if (slotMetadata) {
        builtManifest.name = slotMetadata.displayName || slotMetadata.projectName || builtManifest.name
        builtManifest.unitNumber = slotMetadata.unitNumber || builtManifest.unitNumber
        builtManifest.lwcType = slotMetadata.lwcType || builtManifest.lwcType
        builtManifest.unitType = slotMetadata.unitType || builtManifest.unitType
        builtManifest.unitTypes = slotMetadata.unitType ? [slotMetadata.unitType] : builtManifest.unitTypes
        builtManifest.color = slotMetadata.color || builtManifest.color || ''
        builtManifest.dueDate = slotMetadata.dueDate || builtManifest.dueDate
        builtManifest.planConlayDate = slotMetadata.planConlayDate || builtManifest.planConlayDate
        builtManifest.planConassyDate = slotMetadata.planConassyDate || builtManifest.planConassyDate
        builtManifest.shipDate = slotMetadata.shipDate || builtManifest.shipDate
        builtManifest.deptTargetDate = slotMetadata.deptTargetDate || builtManifest.deptTargetDate
        builtManifest.estimatedTotalHours = slotMetadata.estimatedTotalHours ?? builtManifest.estimatedTotalHours
        builtManifest.estimatedPanelCount = slotMetadata.estimatedPanelCount ?? builtManifest.estimatedPanelCount
        builtManifest.estimatedSampleCount = slotMetadata.estimatedSampleCount ?? builtManifest.estimatedSampleCount
        builtManifest.daysLate = slotMetadata.daysLate ?? builtManifest.daysLate
        builtManifest.scheduleMetadata = slotMetadata
      }

      const sheetSchemas = buildAllSheetSchemas(model, defaultAssignments)
      manifest = builtManifest

      const uploadProps = buildUploadPropsManifest(parsed.workbook, model)
      await writeJsonFile(path.join(revisionRoot, 'upload-props.json'), uploadProps)
      uploadPropsBuilt = true

      for (const schema of sheetSchemas) {
        await writeJsonFile(path.join(sheetsRoot, `${schema.slug}.json`), schema)
      }
      sheetSchemasBuilt = true

      const storedProject: StoredProject = {
        id: model.id,
        name: model.name,
        filename: model.filename,
        createdAt: new Date().toISOString(),
        projectModel: model,
      }
      const devicePartNumbers = await generateDevicePartNumbersMap(storedProject)
      await writeJsonFile(path.join(revisionRoot, 'device-part-numbers.json'), devicePartNumbers)
      devicePartNumbersBuilt = true
    }
  }

  if (greenChangesWorkbookCandidate) {
    const parsed = await parseWorkbookBuffer(greenChangesWorkbookCandidate.fullPath, greenChangesWorkbookCandidate.fileName)
    if (!parsed.success || !parsed.workbook) {
      diagnostics.push(...parsed.errors)
    } else {
      const greenSchemas = buildGreenChangeSchemasFromWorkbook(parsed.workbook, greenChangesWorkbookCandidate.fileName)
      await fs.mkdir(greenChangesSchemaRoot, { recursive: true })
      for (const schema of greenSchemas) {
        await writeJsonFile(path.join(greenChangesSchemaRoot, `${schema.slug}.json`), schema)
      }
      greenChangesSchemaBuilt = greenSchemas.length > 0
      if (greenSchemas.length === 0) {
        diagnostics.push(`No Green Changes rows detected in ${greenChangesWorkbookCandidate.fileName}`)
      }
    }
  }

  if (layoutCandidate) {
    try {
      const layoutPages = await buildServerLayoutPages(layoutCandidate.fullPath)
      await writeJsonFile(path.join(revisionRoot, 'layout-pages.index.json'), layoutPages.index)
      await writeJsonFile(path.join(revisionRoot, 'layout-pages.json'), {
        generatedAt: layoutPages.index.generatedAt,
        pages: layoutPages.slimPages,
      })
      await writeJsonFile(
        path.join(revisionRoot, 'layout-pages.collections.json'),
        buildLayoutPageCollections(layoutPages.slimPages),
      )
      await updateLayoutPageReferenceStore({
        projectKey: candidate.pdNumber,
        pdNumber: candidate.pdNumber,
        projectName: candidate.projectNameHint ?? null,
        pages: layoutPages.slimPages,
      })
      layoutPagesBuilt = true
    } catch (error) {
      console.error('[legal-drawings] Failed to build layout pages metadata', {
        revisionRoot,
        layoutPath: layoutCandidate.fullPath,
        error,
      })
      diagnostics.push(error instanceof Error ? error.message : 'Failed to build layout pages metadata')
    }
  }

  if (manifest) {
    const enrichedManifest = rewriteManifestPathsForLegalRoot(await enrichManifestFromLocalRoot(manifest, revisionRoot))
    manifest = enrichedManifest
    await writeJsonFile(path.join(revisionRoot, 'project-manifest.json'), enrichedManifest)

    try {
      const generatedSchemas = await generatePrintSchemasForLegalRevision(revisionRoot, enrichedManifest)
      wireListPrintSchemaBuilt = generatedSchemas.wireListPrintSchemaBuilt
      brandListSchemaBuilt = generatedSchemas.brandListSchemaBuilt
      manifest = rewriteManifestPathsForLegalRoot(await enrichManifestFromLocalRoot(manifest, revisionRoot))
      await writeJsonFile(path.join(revisionRoot, 'project-manifest.json'), manifest)
    } catch (error) {
      diagnostics.push(error instanceof Error ? error.message : 'Failed to generate print schemas for legal revision')
    }
  }

  return {
    manifest,
    model,
    uploadPropsBuilt,
    layoutPagesBuilt,
    devicePartNumbersBuilt,
    sheetSchemasBuilt,
    greenChangesSchemaBuilt,
    wireListPrintSchemaBuilt,
    brandListSchemaBuilt,
    diagnostics,
  }
}

async function generatePrintSchemasForLegalRevision(
  revisionRoot: string,
  manifest: ProjectManifest,
): Promise<{ wireListPrintSchemaBuilt: boolean; brandListSchemaBuilt: boolean }> {
  const shareRoot = await resolveShareDirectory()
  const projectsRoot = path.join(shareRoot, 'Projects')
  const tempProjectFolder = path.join(
    projectsRoot,
    `__legal_build_${manifest.pdNumber}_${normalizeRevisionFolderName(manifest.revision).replace(/[^A-Z0-9._-]+/gi, '_')}`,
  )
  const tempStateRoot = path.join(tempProjectFolder, 'state')
  const tempProjectId = `legal-build-${manifest.pdNumber.toLowerCase()}-${normalizeRevisionFolderName(manifest.revision).toLowerCase()}`
  const tempManifest: ProjectManifest = {
    ...manifest,
    id: tempProjectId,
  }

  await fs.rm(tempProjectFolder, { recursive: true, force: true })
  await fs.mkdir(tempStateRoot, { recursive: true })
  await seedProjectStateFromRevisionRoot(revisionRoot, tempStateRoot)
  await writeJsonFile(path.join(tempStateRoot, 'project-manifest.json'), tempManifest)

  try {
    const result = await generateAllPrintSchemas(tempProjectId)
    await copyDirectoryContents(path.join(tempStateRoot, 'wire-list-print-schema'), path.join(revisionRoot, 'wire-list-print-schema'))
    await copyDirectoryContents(path.join(tempStateRoot, 'wire-brand-list'), path.join(revisionRoot, 'wire-brand-list'))

    return {
      wireListPrintSchemaBuilt: result.sheets.some(sheet => sheet.wireListPrintSchema),
      brandListSchemaBuilt: result.sheets.some(sheet => sheet.wireBrandListSchema),
    }
  } finally {
    await fs.rm(tempProjectFolder, { recursive: true, force: true }).catch(() => undefined)
  }
}

async function enrichManifestFromLocalRoot(manifest: ProjectManifest, projectRoot: string) {
  const layoutPagesPath = path.join(projectRoot, 'layout-pages.json')

  try {
    const layoutPayload = await readJsonFile<{ pages?: SlimLayoutPage[] }>(layoutPagesPath)
    const pages = Array.isArray(layoutPayload?.pages) ? layoutPayload.pages : []
    const summary = pages.length > 0 ? summarizeLayoutPagesForManifest(pages) : null
    const enrichedAssignments = await buildManifestAssignmentSummaries(projectRoot, manifest)
    const derivedMechanicalSummary = deriveProjectMechanicalSummaryFromAssignments(enrichedAssignments)

    return computeManifestAggregates({
      ...manifest,
      unitType: derivedMechanicalSummary.unitType || summary?.unitType || manifest.unitType,
      unitTypes:
        derivedMechanicalSummary.unitTypes.length > 0
          ? derivedMechanicalSummary.unitTypes
          : (summary?.unitTypes ?? manifest.unitTypes),
      panducts: derivedMechanicalSummary.panducts || summary?.panducts || manifest.panducts,
      rails: derivedMechanicalSummary.rails || summary?.rails || manifest.rails,
      assignments: enrichedAssignments as ProjectManifest['assignments'],
    })
  } catch {
    return manifest
  }
}

function stripStatePrefix(value: string | undefined | null): string | undefined {
  if (!value) return value ?? undefined
  return value.startsWith('state/') ? value.slice('state/'.length) : value
}

function rewriteManifestPathsForLegalRoot(manifest: ProjectManifest): ProjectManifest {
  const sheets = manifest.sheets.map(sheet => ({
    ...sheet,
    sheetPath: stripStatePrefix(sheet.sheetPath) ?? sheet.sheetPath,
  }))

  const assignments = Object.fromEntries(
    Object.entries(manifest.assignments ?? {}).map(([slug, assignment]) => [
      slug,
      {
        ...assignment,
        sheetPath: stripStatePrefix(assignment.sheetPath) ?? assignment.sheetPath,
        files: {
          ...assignment.files,
          wireListSchemaPath: stripStatePrefix(assignment.files?.wireListSchemaPath) ?? assignment.files?.wireListSchemaPath,
          brandListSchemaPath: stripStatePrefix(assignment.files?.brandListSchemaPath) ?? assignment.files?.brandListSchemaPath,
          buildUpSWSSchemaPath: stripStatePrefix(assignment.files?.buildUpSWSSchemaPath) ?? assignment.files?.buildUpSWSSchemaPath,
        },
      },
    ]),
  ) as ProjectManifest['assignments']

  const referenceSheetsValue = (manifest as ProjectManifest & { referenceSheets?: Record<string, unknown> }).referenceSheets
  const referenceSheets = Object.fromEntries(
    Object.entries(referenceSheetsValue ?? {}).map(([slug, sheet]) => {
      const typedSheet = sheet as { sheetPath?: string }
      return [
        slug,
        {
          ...(sheet as Record<string, unknown>),
          sheetPath: stripStatePrefix(typedSheet.sheetPath) ?? typedSheet.sheetPath,
        },
      ]
    }),
  )

  return {
    ...manifest,
    sheets,
    assignments,
    ...(Object.keys(referenceSheets).length > 0 ? { referenceSheets } : {}),
  }
}

function buildRevisionRecord(
  pdNumber: string,
  projectNameHint: string,
  revision: string,
  workbook: SourceFileCandidate | null,
  greenChangesWorkbook: SourceFileCandidate | null,
  layout: SourceFileCandidate | null,
  artifactStatus: LegalRevisionArtifactStatus,
): LegalRevisionRecord {
  return {
    pdNumber,
    revision,
    projectNameHint,
    workbookFileName: workbook?.fileName ?? null,
    workbookRelativePath: workbook ? `${normalizeRevisionFolderName(revision)}/${workbook.fileName}` : null,
    workbookUpdatedAt: toIsoDate(workbook?.mtimeMs),
    greenChangesWorkbookFileName: greenChangesWorkbook?.fileName ?? null,
    greenChangesWorkbookRelativePath: greenChangesWorkbook ? `${normalizeRevisionFolderName(revision)}/${greenChangesWorkbook.fileName}` : null,
    greenChangesWorkbookUpdatedAt: toIsoDate(greenChangesWorkbook?.mtimeMs),
    layoutFileName: layout?.fileName ?? null,
    layoutRelativePath: layout ? `${normalizeRevisionFolderName(revision)}/${layout.fileName}` : null,
    layoutUpdatedAt: toIsoDate(layout?.mtimeMs),
    sourceFingerprint: [
      workbook ? `${workbook.fileName}:${workbook.mtimeMs}` : 'no-workbook',
      greenChangesWorkbook ? `${greenChangesWorkbook.fileName}:${greenChangesWorkbook.mtimeMs}` : 'no-green-changes-workbook',
      layout ? `${layout.fileName}:${layout.mtimeMs}` : 'no-layout',
    ].join('|'),
    files: artifactStatus,
    generatedAt: new Date().toISOString(),
  }
}

async function buildProjectRecord(projectRoot: string, pdNumber: string): Promise<LegalProjectRecord | null> {
  const latest = await readJsonFile<{
    pdNumber: string
    latestRevision: string | null
    projectNameHint?: string
    projectName?: string | null
    dueDate?: string | null
    dueMonth?: string | null
    planConlayDate?: string | null
    planConassyDate?: string | null
    shipDate?: string | null
    deptTargetDate?: string | null
    lwcType?: string | null
    color?: string | null
    daysLate?: number | null
    latestWorkbookFileName?: string | null
    latestGreenChangesWorkbookFileName?: string | null
    latestLayoutFileName?: string | null
    latestWorkbookUpdatedAt?: string | null
    latestGreenChangesWorkbookUpdatedAt?: string | null
    latestLayoutUpdatedAt?: string | null
  }>(getLatestManifestPath(projectRoot))
  const projectMeta = await readJsonFile<{
    projectName?: string | null
    dueDate?: string | null
    dueMonth?: string | null
    planConlayDate?: string | null
    planConassyDate?: string | null
    shipDate?: string | null
    deptTargetDate?: string | null
    lwcType?: string | null
    color?: string | null
    daysLate?: number | null
  }>(path.join(projectRoot, 'project-meta.json'))

  const entries = await fs.readdir(projectRoot, { withFileTypes: true }).catch(() => [])
  const revisionFolders = entries
    .filter(entry => entry.isDirectory() && entry.name.toLowerCase() !== 'electrical')
    .map(entry => entry.name)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))

  const revisions = (
    await Promise.all(
      revisionFolders.map(async revisionFolder => {
        const revisionManifest = await readJsonFile<LegalRevisionRecord>(path.join(projectRoot, revisionFolder, 'revision.json'))
        return revisionManifest
      }),
    )
  ).filter((record): record is LegalRevisionRecord => Boolean(record))

  const latestRevisionRecord =
    revisions.find(revision => revision.revision === (latest?.latestRevision ?? ''))
    ?? revisions[revisions.length - 1]

  return {
    pdNumber,
    folderName: path.basename(projectRoot),
    latestRevision: latest?.latestRevision ?? latestRevisionRecord?.revision ?? null,
    projectNameHint: latest?.projectNameHint ?? latestRevisionRecord?.projectNameHint,
    projectName: latest?.projectName ?? projectMeta?.projectName ?? null,
    dueDate: latest?.dueDate ?? projectMeta?.dueDate ?? null,
    dueMonth: latest?.dueMonth ?? projectMeta?.dueMonth ?? null,
    planConlayDate: latest?.planConlayDate ?? projectMeta?.planConlayDate ?? null,
    planConassyDate: latest?.planConassyDate ?? projectMeta?.planConassyDate ?? null,
    shipDate: latest?.shipDate ?? projectMeta?.shipDate ?? null,
    deptTargetDate: latest?.deptTargetDate ?? projectMeta?.deptTargetDate ?? null,
    lwcType: latest?.lwcType ?? projectMeta?.lwcType ?? null,
    color: latest?.color ?? projectMeta?.color ?? null,
    daysLate: latest?.daysLate ?? projectMeta?.daysLate ?? null,
    hasWorkbook: Boolean(
      latest?.hasWorkbook
      ?? latestRevisionRecord?.files?.workbookPresent
      ?? latestRevisionRecord?.workbookFileName,
    ),
    hasGreenChangesWorkbook: Boolean(
      latest?.hasGreenChangesWorkbook
      ?? latestRevisionRecord?.files?.greenChangesWorkbookPresent
      ?? latestRevisionRecord?.greenChangesWorkbookFileName,
    ),
    hasLayout: Boolean(
      latest?.hasLayout
      ?? latestRevisionRecord?.files?.layoutPresent
      ?? latestRevisionRecord?.layoutFileName,
    ),
    latestWorkbookUpdatedAt: latest?.latestWorkbookUpdatedAt ?? latestRevisionRecord?.workbookUpdatedAt ?? null,
    latestGreenChangesWorkbookUpdatedAt: latest?.latestGreenChangesWorkbookUpdatedAt ?? latestRevisionRecord?.greenChangesWorkbookUpdatedAt ?? null,
    latestLayoutUpdatedAt: latest?.latestLayoutUpdatedAt ?? latestRevisionRecord?.layoutUpdatedAt ?? null,
    revisions,
  }
}

async function buildLegalDrawingsLibraryManifest(): Promise<LegalDrawingsLibraryManifest> {
  const legalRoot = await getLegalDrawingsRoot()
  const exists = await pathExists(legalRoot)
  if (!exists) {
    return { generatedAt: new Date().toISOString(), sourceRoot: null, projects: [] }
  }

  const entries = await fs.readdir(legalRoot, { withFileTypes: true })
  const projects = (
    await Promise.all(
      entries
        .filter(entry => entry.isDirectory())
        .map(async entry => buildProjectRecord(path.join(legalRoot, entry.name), entry.name)),
    )
  ).filter((record): record is LegalProjectRecord => Boolean(record))

  return {
    generatedAt: new Date().toISOString(),
    sourceRoot: null,
    projects: projects.sort((left, right) => left.pdNumber.localeCompare(right.pdNumber, undefined, { numeric: true, sensitivity: 'base' })),
  }
}

export async function getLegalDrawingsLibraryManifest(): Promise<LegalDrawingsLibraryManifest> {
  const now = Date.now()
  if (legalLibraryManifestCache && legalLibraryManifestCache.expiresAt > now) {
    return legalLibraryManifestCache.manifest
  }

  if (legalLibraryManifestInFlight) {
    return legalLibraryManifestInFlight
  }

  legalLibraryManifestInFlight = buildLegalDrawingsLibraryManifest()

  try {
    const manifest = await legalLibraryManifestInFlight
    legalLibraryManifestCache = {
      manifest,
      expiresAt: Date.now() + LEGAL_LIBRARY_CACHE_TTL_MS,
    }
    return manifest
  } finally {
    legalLibraryManifestInFlight = null
  }
}

export async function patchLegalProjectMeta(
  pdNumber: string,
  patch: Partial<{
    projectName: string | null
    lwcType: string | null
    dueDate: string | null
    planConlayDate: string | null
    planConassyDate: string | null
    shipDate: string | null
    deptTargetDate: string | null
  }>,
) {
  const legalRoot = await getLegalDrawingsRoot()
  const projectRoot = path.join(legalRoot, pdNumber.trim().toUpperCase())
  if (!(await pathExists(projectRoot))) {
    throw new Error(`Legal project not found: ${pdNumber}`)
  }

  const metaPath = path.join(projectRoot, 'project-meta.json')
  let existing: Record<string, unknown> = {}
  try {
    existing = JSON.parse(await fs.readFile(metaPath, 'utf8'))
  } catch {
    // file may not exist yet — start fresh
  }

  const updated = { ...existing, ...patch }
  await fs.writeFile(metaPath, JSON.stringify(updated, null, 2), 'utf8')
  invalidateLegalDrawingsLibraryManifestCache()
  return buildProjectRecord(projectRoot, pdNumber.trim().toUpperCase())
}

export async function getLegalProjectRecord(pdNumber: string) {
  const legalRoot = await getLegalDrawingsRoot()
  const projectRoot = path.join(legalRoot, pdNumber.trim().toUpperCase())
  if (!(await pathExists(projectRoot))) {
    return null
  }

  return buildProjectRecord(projectRoot, pdNumber.trim().toUpperCase())
}

function resolveSourceRoot(explicitSourceRoot?: string | null) {
  const sourceRoot = explicitSourceRoot?.trim() || process.env.LEGAL_DRAWINGS_SOURCE_DIR?.trim() || ''
  return sourceRoot || null
}

export async function syncLegalDrawingsLibrary(explicitSourceRoot?: string | null): Promise<LegalDrawingsSyncResult> {
  const sourceRoot = resolveSourceRoot(explicitSourceRoot)
  if (!sourceRoot) {
    throw new Error('LEGAL_DRAWINGS_SOURCE_DIR is not configured')
  }

  const legalRoot = await getLegalDrawingsRoot()
  await fs.mkdir(legalRoot, { recursive: true })
  const candidates = await listSourceProjectCandidates(sourceRoot)
  const projectResults: LegalSyncProjectResult[] = []

  for (const candidate of candidates) {
    const pdRoot = path.join(legalRoot, candidate.pdNumber)
    await fs.mkdir(pdRoot, { recursive: true })

    const latestRevision = normalizeRevisionFolderName(
      candidate.workbook?.baseRevision
        || candidate.layout?.baseRevision
        || candidate.greenChangesWorkbook?.baseRevision
        || 'IMPORTED',
    )
    const revisionRoot = getRevisionRoot(pdRoot, latestRevision)
    const revisionExisted = await pathExists(revisionRoot)
    await fs.mkdir(revisionRoot, { recursive: true })

    let copiedWorkbook = false
    let copiedGreenChangesWorkbook = false
    let copiedLayout = false
    const diagnostics: string[] = []

    if (candidate.workbook) {
      copiedWorkbook = await copyFileIfChanged(candidate.workbook.fullPath, path.join(pdRoot, candidate.workbook.fileName))
      await copyFileIfChanged(candidate.workbook.fullPath, path.join(revisionRoot, candidate.workbook.fileName))
    }

    if (candidate.greenChangesWorkbook) {
      copiedGreenChangesWorkbook = await copyFileIfChanged(
        candidate.greenChangesWorkbook.fullPath,
        path.join(pdRoot, candidate.greenChangesWorkbook.fileName),
      )
      await copyFileIfChanged(
        candidate.greenChangesWorkbook.fullPath,
        path.join(revisionRoot, candidate.greenChangesWorkbook.fileName),
      )
    }

    if (candidate.layout) {
      copiedLayout = await copyFileIfChanged(candidate.layout.fullPath, path.join(pdRoot, candidate.layout.fileName))
      await copyFileIfChanged(candidate.layout.fullPath, path.join(revisionRoot, candidate.layout.fileName))
    }

    const built = await buildLegalRevisionFiles(revisionRoot, candidate, latestRevision)
    diagnostics.push(...built.diagnostics)

    const artifactStatus: LegalRevisionArtifactStatus = {
      workbookPresent: Boolean(candidate.workbook),
      greenChangesWorkbookPresent: Boolean(candidate.greenChangesWorkbook),
      layoutPresent: Boolean(candidate.layout),
      uploadPropsBuilt: built.uploadPropsBuilt,
      manifestBuilt: Boolean(built.manifest),
      layoutPagesBuilt: built.layoutPagesBuilt,
      devicePartNumbersBuilt: built.devicePartNumbersBuilt,
      sheetSchemasBuilt: built.sheetSchemasBuilt,
      greenChangesSchemaBuilt: built.greenChangesSchemaBuilt,
      wireListPrintSchemaPrepared: built.wireListPrintSchemaBuilt,
      brandListSchemaPrepared: built.brandListSchemaBuilt,
    }

    const revisionRecord = buildRevisionRecord(
      candidate.pdNumber,
      candidate.projectNameHint,
      latestRevision,
      candidate.workbook,
      candidate.greenChangesWorkbook,
      candidate.layout,
      artifactStatus,
    )
    await writeJsonFile(path.join(revisionRoot, 'revision.json'), revisionRecord)
    await writeJsonFile(getLatestManifestPath(pdRoot), {
      pdNumber: candidate.pdNumber,
      latestRevision,
      projectNameHint: candidate.projectNameHint,
      latestWorkbookFileName: candidate.workbook?.fileName ?? null,
      latestGreenChangesWorkbookFileName: candidate.greenChangesWorkbook?.fileName ?? null,
      latestLayoutFileName: candidate.layout?.fileName ?? null,
      latestWorkbookUpdatedAt: toIsoDate(candidate.workbook?.mtimeMs),
      latestGreenChangesWorkbookUpdatedAt: toIsoDate(candidate.greenChangesWorkbook?.mtimeMs),
      latestLayoutUpdatedAt: toIsoDate(candidate.layout?.mtimeMs),
      hasWorkbook: Boolean(candidate.workbook),
      hasGreenChangesWorkbook: Boolean(candidate.greenChangesWorkbook),
      hasLayout: Boolean(candidate.layout),
      generatedAt: new Date().toISOString(),
    })

    projectResults.push({
      pdNumber: candidate.pdNumber,
      latestRevision,
      createdRevision: !revisionExisted,
      updatedLatestRoot: copiedWorkbook || copiedGreenChangesWorkbook || copiedLayout,
      copiedWorkbook,
      copiedLayout,
    })
  }

  const result = {
    syncedAt: new Date().toISOString(),
    sourceRoot,
    projectCount: projectResults.length,
    projects: projectResults,
  }

  invalidateLegalDrawingsLibraryManifestCache()
  return result
}

export async function rebuildLegalRevisionFiles(pdNumber: string, revision?: string | null) {
  const project = await getLegalProjectRecord(pdNumber)
  if (!project) {
    throw new Error(`Legal project ${pdNumber} not found`)
  }

  const selectedRevision = normalizeRevisionFolderName(revision || project.latestRevision)
  const legalRoot = await getLegalDrawingsRoot()
  const pdRoot = path.join(legalRoot, project.pdNumber)
  const revisionRoot = path.join(pdRoot, selectedRevision)
  const revisionRecord = await readJsonFile<LegalRevisionRecord>(path.join(revisionRoot, 'revision.json'))
  if (!revisionRecord) {
    throw new Error(`Revision ${selectedRevision} not found for ${project.pdNumber}`)
  }

  // Re-classify: a workbookFileName that matches the green-changes pattern was stored incorrectly
  // by an older version of the pipeline. Move it to greenChangesWorkbook so it is processed correctly.
  const storedWorkbookIsGreenChanges =
    Boolean(revisionRecord.workbookFileName) &&
    isGreenChangesWorkbookFileName(revisionRecord.workbookFileName!)
  const effectiveWorkbookFileName = storedWorkbookIsGreenChanges ? null : revisionRecord.workbookFileName
  const effectiveGreenChangesFileName =
    revisionRecord.greenChangesWorkbookFileName ??
    (storedWorkbookIsGreenChanges ? revisionRecord.workbookFileName : null)

  const workbook = effectiveWorkbookFileName
    ? {
        fileName: effectiveWorkbookFileName,
        fullPath: path.join(revisionRoot, effectiveWorkbookFileName),
        mtimeMs: Date.parse(revisionRecord.workbookUpdatedAt ?? '') || Date.now(),
        revision: revisionRecord.revision,
        baseRevision: revisionRecord.revision,
        isModified: /M\.\d+$/i.test(revisionRecord.revision),
      } satisfies SourceFileCandidate
    : null
  const greenChangesWorkbook = effectiveGreenChangesFileName
    ? {
        fileName: effectiveGreenChangesFileName,
        fullPath: path.join(revisionRoot, effectiveGreenChangesFileName),
        mtimeMs: Date.parse((storedWorkbookIsGreenChanges ? revisionRecord.workbookUpdatedAt : revisionRecord.greenChangesWorkbookUpdatedAt) ?? '') || Date.now(),
        revision: revisionRecord.revision,
        baseRevision: revisionRecord.revision,
        isModified: /M\.\d+$/i.test(revisionRecord.revision),
      } satisfies SourceFileCandidate
    : null
  const layout = revisionRecord.layoutFileName
    ? {
        fileName: revisionRecord.layoutFileName,
        fullPath: path.join(revisionRoot, revisionRecord.layoutFileName),
        mtimeMs: Date.parse(revisionRecord.layoutUpdatedAt ?? '') || Date.now(),
        revision: revisionRecord.revision,
        baseRevision: revisionRecord.revision,
        isModified: /M\.\d+$/i.test(revisionRecord.revision),
      } satisfies SourceFileCandidate
    : null

  const built = await buildLegalRevisionFiles(revisionRoot, {
    pdNumber: project.pdNumber,
    projectNameHint: project.projectNameHint ?? project.pdNumber,
    sourceFolderName: project.folderName,
    sourceProjectPath: pdRoot,
    sourceFilesDirectory: revisionRoot,
    workbook,
    greenChangesWorkbook,
    layout,
  }, selectedRevision)

  const nextRecord: LegalRevisionRecord = {
    ...revisionRecord,
    // Persist corrected classification (fixes cases where old pipeline stored greenChanges as workbook)
    workbookFileName: workbook?.fileName ?? null,
    workbookRelativePath: workbook ? `${normalizeRevisionFolderName(selectedRevision)}/${workbook.fileName}` : null,
    workbookUpdatedAt: toIsoDate(workbook?.mtimeMs ?? null),
    greenChangesWorkbookFileName: greenChangesWorkbook?.fileName ?? null,
    greenChangesWorkbookRelativePath: greenChangesWorkbook ? `${normalizeRevisionFolderName(selectedRevision)}/${greenChangesWorkbook.fileName}` : null,
    greenChangesWorkbookUpdatedAt: toIsoDate(greenChangesWorkbook?.mtimeMs ?? null),
    sourceFingerprint: [
      workbook ? `${workbook.fileName}:${workbook.mtimeMs}` : 'no-workbook',
      greenChangesWorkbook ? `${greenChangesWorkbook.fileName}:${greenChangesWorkbook.mtimeMs}` : 'no-green-changes-workbook',
      layout ? `${layout.fileName}:${layout.mtimeMs}` : 'no-layout',
    ].join('|'),
    files: {
      ...revisionRecord.files,
      greenChangesWorkbookPresent: Boolean(greenChangesWorkbook),
      uploadPropsBuilt: built.uploadPropsBuilt,
      manifestBuilt: Boolean(built.manifest),
      layoutPagesBuilt: built.layoutPagesBuilt,
      devicePartNumbersBuilt: built.devicePartNumbersBuilt,
      sheetSchemasBuilt: built.sheetSchemasBuilt,
      greenChangesSchemaBuilt: built.greenChangesSchemaBuilt,
      wireListPrintSchemaPrepared: built.wireListPrintSchemaBuilt,
      brandListSchemaPrepared: built.brandListSchemaBuilt,
    },
    generatedAt: new Date().toISOString(),
  }

  await writeJsonFile(path.join(revisionRoot, 'revision.json'), nextRecord)
  invalidateLegalDrawingsLibraryManifestCache()
  return nextRecord
}

async function copyDirectoryContents(sourceDir: string, destinationDir: string) {
  await fs.mkdir(destinationDir, { recursive: true })
  const entries = await fs.readdir(sourceDir, { withFileTypes: true }).catch(() => [])

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const destinationPath = path.join(destinationDir, entry.name)
    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, destinationPath)
    } else if (entry.isFile()) {
      await copyFileIfChanged(sourcePath, destinationPath)
    }
  }
}

async function countJsonFilesInDirectory(targetDir: string) {
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true })
    return entries.filter(entry => entry.isFile() && entry.name.endsWith('.json')).length
  } catch {
    return 0
  }
}

function countOperationalSheets(manifest: ProjectManifest | null | undefined) {
  return manifest?.sheets.filter(sheet => sheet.kind === 'operational').length ?? 0
}

async function seedProjectStateFromRevisionRoot(revisionRoot: string, destinationStateRoot: string) {
  await fs.mkdir(destinationStateRoot, { recursive: true })

  const sourceProjectManifestPath = path.join(revisionRoot, 'project-manifest.json')
  const destinationProjectManifestPath = path.join(destinationStateRoot, 'project-manifest.json')
  if (await pathExists(sourceProjectManifestPath)) {
    await copyFileIfChanged(sourceProjectManifestPath, destinationProjectManifestPath)
  }

  const sourceUploadPropsPath = path.join(revisionRoot, 'upload-props.json')
  const destinationUploadPropsPath = path.join(destinationStateRoot, 'upload-props.json')
  if (await pathExists(sourceUploadPropsPath)) {
    await copyFileIfChanged(sourceUploadPropsPath, destinationUploadPropsPath)
  }

  const sourceDevicePartNumbersPath = path.join(revisionRoot, 'device-part-numbers.json')
  const destinationDevicePartNumbersPath = path.join(destinationStateRoot, 'device-part-numbers.json')
  if (await pathExists(sourceDevicePartNumbersPath)) {
    await copyFileIfChanged(sourceDevicePartNumbersPath, destinationDevicePartNumbersPath)
  }

  const sourceLayoutPagesPath = path.join(revisionRoot, 'layout-pages.json')
  const destinationLayoutPagesPath = path.join(destinationStateRoot, 'layout-pages.json')
  if (await pathExists(sourceLayoutPagesPath)) {
    await copyFileIfChanged(sourceLayoutPagesPath, destinationLayoutPagesPath)
  }

  const sourceLayoutPagesIndexPath = path.join(revisionRoot, 'layout-pages.index.json')
  const destinationLayoutPagesIndexPath = path.join(destinationStateRoot, 'layout-pages.index.json')
  if (await pathExists(sourceLayoutPagesIndexPath)) {
    await copyFileIfChanged(sourceLayoutPagesIndexPath, destinationLayoutPagesIndexPath)
  }

  const sourceLayoutPagesCollectionsPath = path.join(revisionRoot, 'layout-pages.collections.json')
  const destinationLayoutPagesCollectionsPath = path.join(destinationStateRoot, 'layout-pages.collections.json')
  if (await pathExists(sourceLayoutPagesCollectionsPath)) {
    await copyFileIfChanged(sourceLayoutPagesCollectionsPath, destinationLayoutPagesCollectionsPath)
  }



  const sourceSheetsPath = path.join(revisionRoot, 'sheets')
  const destinationSheetsPath = path.join(destinationStateRoot, 'sheets')
  if (await pathExists(sourceSheetsPath)) {
    await copyDirectoryContents(sourceSheetsPath, destinationSheetsPath)
  }

  const sourceWireListPrintSchemaPath = path.join(revisionRoot, 'wire-list-print-schema')
  const destinationWireListPrintSchemaPath = path.join(destinationStateRoot, 'wire-list-print-schema')
  if (await pathExists(sourceWireListPrintSchemaPath)) {
    await copyDirectoryContents(sourceWireListPrintSchemaPath, destinationWireListPrintSchemaPath)
  }

  const sourceWireBrandListPath = path.join(revisionRoot, 'wire-brand-list')
  const destinationWireBrandListPath = path.join(destinationStateRoot, 'wire-brand-list')
  if (await pathExists(sourceWireBrandListPath)) {
    await copyDirectoryContents(sourceWireBrandListPath, destinationWireBrandListPath)
  }

  const sourceGreenChangesPath = path.join(revisionRoot, 'wire-list-green-changes')
  const destinationGreenChangesPath = path.join(destinationStateRoot, 'wire-list-green-changes')
  if (await pathExists(sourceGreenChangesPath)) {
    await copyDirectoryContents(sourceGreenChangesPath, destinationGreenChangesPath)
  }

  await fs.mkdir(path.join(destinationStateRoot, 'sheet-state'), { recursive: true })
}

export async function refreshProjectFromLegalRevision(input: {
  projectId: string
  pdNumber: string
  revision?: string | null
}) {
  const projectId = input.projectId.trim()
  const pdNumber = input.pdNumber.trim().toUpperCase()

  if (!projectId) {
    throw new Error('projectId is required')
  }
  if (!pdNumber) {
    throw new Error('pdNumber is required')
  }

  const legalProject = await getLegalProjectRecord(pdNumber)
  if (!legalProject) {
    throw new Error(`Legal project not found: ${pdNumber}`)
  }

  const selectedRevision = normalizeRevisionFolderName(input.revision || legalProject.latestRevision)
  await rebuildLegalRevisionFiles(pdNumber, selectedRevision)

  const legalRoot = await getLegalDrawingsRoot()
  const revisionRoot = path.join(legalRoot, pdNumber, selectedRevision)
  const revisionManifest = await readJsonFile<ProjectManifest>(path.join(revisionRoot, 'project-manifest.json'))
  const revisionRecord = await readJsonFile<LegalRevisionRecord>(path.join(revisionRoot, 'revision.json'))

  if (!revisionManifest) {
    throw new Error(`Missing project-manifest.json for legal revision ${pdNumber}/${selectedRevision}`)
  }

  const existingManifest = await readExistingProjectManifest(projectId)
  const projectRoot = await resolveProjectRootDirectory(projectId, {
    pdNumber: existingManifest?.pdNumber ?? pdNumber,
    projectName: existingManifest?.name ?? revisionManifest.name,
  })
  if (!projectRoot) {
    throw new Error(`Project root not found for ${projectId}`)
  }

  const projectStateRoot = path.join(projectRoot, 'state')
  await seedProjectStateFromRevisionRoot(revisionRoot, projectStateRoot)

  const seededManifest = await readJsonFile<ProjectManifest>(path.join(projectStateRoot, 'project-manifest.json'))
  if (!seededManifest) {
    throw new Error('Failed to seed project manifest from legal revision')
  }

  const nextManifestBase: ProjectManifest = {
    ...seededManifest,
    id: existingManifest?.id ?? projectId,
    name: existingManifest?.name ?? seededManifest.name,
    filename: existingManifest?.filename ?? seededManifest.filename,
    pdNumber: existingManifest?.pdNumber ?? pdNumber,
    unitNumber: existingManifest?.unitNumber ?? seededManifest.unitNumber,
    revision: selectedRevision,
    lwcType: existingManifest?.lwcType ?? seededManifest.lwcType,
    dueDate: existingManifest?.dueDate ?? seededManifest.dueDate,
    planConlayDate: existingManifest?.planConlayDate ?? seededManifest.planConlayDate,
    planConassyDate: existingManifest?.planConassyDate ?? seededManifest.planConassyDate,
    shipDate: existingManifest?.shipDate ?? seededManifest.shipDate,
    color: existingManifest?.color ?? seededManifest.color,
    status: existingManifest?.status ?? seededManifest.status,
    activeWorkbookRevisionId: revisionRecord?.workbookFileName ?? seededManifest.activeWorkbookRevisionId,
    activeLayoutRevisionId: revisionRecord?.layoutFileName ?? seededManifest.activeLayoutRevisionId,
  }

  const [projectSettings, referenceSettings] = await Promise.all([
    readProjectAssignmentVisibilitySettings(projectId),
    readAssignmentVisibilityReferenceSettings(),
  ])

  const resolvedBySheet = resolveVisibilitySettingsForManifest(
    nextManifestBase,
    projectSettings,
    referenceSettings,
  )
  const nextManifestWithVisibility = applyResolvedVisibilityToManifest(
    nextManifestBase,
    resolvedBySheet,
  )

  const savedManifest = await writeProjectManifest(nextManifestWithVisibility)
  const enriched = await enrichManifestFromProjectState(savedManifest)

  // Preserve external location visibility from explicit settings after enrichment.
  const mergedAssignments = {
    ...enriched.assignments,
  }
  for (const [sheetSlug, assignment] of Object.entries(nextManifestWithVisibility.assignments ?? {})) {
    if (!assignment.externalLocations) {
      continue
    }
    mergedAssignments[sheetSlug] = {
      ...mergedAssignments[sheetSlug],
      externalLocations: assignment.externalLocations,
    }
  }

  const finalManifest: ProjectManifest = {
    ...enriched,
    assignments: mergedAssignments,
  }

  await writeProjectManifest(finalManifest)
  return finalManifest
}

export async function createProjectFromLegalSource(input: CreateProjectFromLegalSourceInput) {
  const pdNumber = input.pdNumber.trim().toUpperCase()
  const requestedRevision = normalizeRevisionFolderName(input.revision)
  const name = input.name.trim()

  if (!pdNumber) {
    throw new Error('pdNumber is required')
  }
  if (!requestedRevision) {
    throw new Error('revision is required')
  }
  if (!name) {
    throw new Error('name is required')
  }

  const legalRoot = await getLegalDrawingsRoot()
  let revision = requestedRevision
  let revisionRoot = path.join(legalRoot, pdNumber, revision)
  let revisionManifest = await readJsonFile<ProjectManifest>(path.join(revisionRoot, 'project-manifest.json'))
  let revisionRecord = await readJsonFile<LegalRevisionRecord>(path.join(revisionRoot, 'revision.json'))

  // Some legal revisions exist but have not had files generated yet.
  // In that case, automatically fall back to the newest revision that has
  // a built manifest so create-project does not fail with a hard 500.
  if (!revisionManifest) {
    const projectRoot = path.join(legalRoot, pdNumber)
    const revisionFolders = await fs.readdir(projectRoot, { withFileTypes: true }).catch(() => [])
    const orderedCandidates = revisionFolders
      .filter((entry) => entry.isDirectory() && entry.name.toLowerCase() !== 'electrical')
      .map((entry) => normalizeRevisionFolderName(entry.name))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' }))
      .reverse()

    for (const candidateRevision of orderedCandidates) {
      if (!candidateRevision || candidateRevision === requestedRevision) continue

      const candidateRoot = path.join(projectRoot, candidateRevision)
      const candidateManifest = await readJsonFile<ProjectManifest>(path.join(candidateRoot, 'project-manifest.json'))
      if (!candidateManifest) continue

      revision = candidateRevision
      revisionRoot = candidateRoot
      revisionManifest = candidateManifest
      revisionRecord = await readJsonFile<LegalRevisionRecord>(path.join(revisionRoot, 'revision.json'))
      break
    }
  }

  if (!revisionManifest) {
    throw new Error(
      `Legal revision ${pdNumber}/${requestedRevision} is missing project-manifest.json and no fallback revision with a built manifest was found`,
    )
  }

  const shareRoot = await resolveShareDirectory()
  const projectsRoot = path.join(shareRoot, 'Projects')
  const projectId = generateCleanProjectId(pdNumber, input.name)
  const projectFolderName = buildShareProjectFolderName(pdNumber, input.name)
  const projectRoot = path.join(projectsRoot, projectFolderName)
  const projectStateRoot = path.join(projectRoot, 'state')

  await fs.mkdir(projectStateRoot, { recursive: true })
  await seedProjectStateFromRevisionRoot(revisionRoot, projectStateRoot)

  const seededManifest: ProjectManifest = {
    ...revisionManifest,
    id: projectId,
    name,
    pdNumber,
    unitNumber: input.unitNumber?.trim() || revisionManifest.unitNumber || '',
    revision,
    lwcType: input.lwcType || revisionManifest.lwcType,
    dueDate: input.dueDate || revisionManifest.dueDate,
    planConlayDate: input.planConlayDate || revisionManifest.planConlayDate,
    planConassyDate: input.planConassyDate || revisionManifest.planConassyDate,
    shipDate: input.shipDate || revisionManifest.shipDate,
    color: input.color || revisionManifest.color,
    activeWorkbookRevisionId: revisionRecord?.workbookFileName ?? revisionManifest.activeWorkbookRevisionId,
    activeLayoutRevisionId: revisionRecord?.layoutFileName ?? revisionManifest.activeLayoutRevisionId,
  }

  await writeProjectManifest(seededManifest)
  const finalManifest = await enrichManifestFromProjectState(seededManifest)
  await writeProjectManifest(finalManifest)
  return finalManifest
}

export async function ensureLegalWorkspaceProject(input: {
  pdNumber: string
  revision: string
}) {
  const pdNumber = input.pdNumber.trim().toUpperCase()
  const revision = normalizeRevisionFolderName(input.revision)
  const workspaceName = `${pdNumber} ${revision} Legal Workspace`
  const projectFolderName = buildShareProjectFolderName(pdNumber, workspaceName)
  const shareRoot = await resolveShareDirectory()
  const projectRoot = path.join(shareRoot, 'Projects', projectFolderName)
  const projectStateRoot = path.join(projectRoot, 'state')
  const manifestPath = path.join(projectRoot, 'state', 'project-manifest.json')
  const legalRoot = await getLegalDrawingsRoot()
  const revisionRoot = path.join(legalRoot, pdNumber, revision)

  const existingManifest = await readJsonFile<ProjectManifest>(manifestPath)
  if (existingManifest) {
    const revisionManifest = await readJsonFile<ProjectManifest>(path.join(revisionRoot, 'project-manifest.json'))
    const existingOperationalSheets = countOperationalSheets(existingManifest)
    const revisionOperationalSheets = countOperationalSheets(revisionManifest)
    const existingBrandSchemas = await countJsonFilesInDirectory(path.join(projectStateRoot, 'wire-brand-list'))
    const revisionBrandSchemas = await countJsonFilesInDirectory(path.join(revisionRoot, 'wire-brand-list'))
    const existingSheetSchemas = await countJsonFilesInDirectory(path.join(projectStateRoot, 'sheets'))
    const revisionSheetSchemas = await countJsonFilesInDirectory(path.join(revisionRoot, 'sheets'))

    const needsRefresh =
      (revisionOperationalSheets > 0 && existingOperationalSheets === 0)
      || existingBrandSchemas < revisionBrandSchemas
      || existingSheetSchemas < revisionSheetSchemas

    if (!needsRefresh) {
      return existingManifest
    }

    await fs.rm(projectStateRoot, { recursive: true, force: true }).catch(() => undefined)
    return createProjectFromLegalSource({
      pdNumber,
      revision,
      name: workspaceName,
      unitNumber: null,
    })
  }

  return createProjectFromLegalSource({
    pdNumber,
    revision,
    name: workspaceName,
    unitNumber: null,
  })
}
