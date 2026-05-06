/**
 * Legal Drawings Loader (Server-Only)
 * 
 * Automatically discovers and loads projects from Share/Legal Drawings directory.
 * Resolves only UCP wiring list workbooks and LAY PDFs for each project.
 */
import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import {
  compareLegalDrawingsFileVersions,
  extractProjectNumberFromLegalFolder,
  getProjectNameFromLegalFolder,
  parseLegalDrawingsFileVersion,
  resolveLegalProjectFilesDirectory,
} from '@/lib/legal-drawings/discovery'
import type { ProjectModel, ProjectSheetSummary, ParsedWorkbookSheet, LwcType } from '@/lib/workbook/types'

async function getLegalDrawingsRoot(): Promise<string> {
  const shareRoot = await resolveShareDirectory()
  return path.join(shareRoot, 'Legal Drawings')
}

// ============================================================================
// Types
// ============================================================================

export interface LegalDrawingsProject {
  /** Folder name (e.g., "4L341_WP-BDR") */
  folderName: string
  /** PD Number extracted from folder (e.g., "4L341") */
  pdNumber: string
  /** Project name/description (e.g., "WP-BDR") */
  projectName: string
  /** Full path to project folder */
  folderPath: string
  /** Wire list Excel file info */
  wireList: {
    filename: string
    fullPath: string
    revision: string
    isModified: boolean
    modificationNumber?: string
  } | null
  /** Layout PDF file info */
  layoutPdf: {
    filename: string
    fullPath: string
    revision: string
  } | null
  /** ELS (Electrical Line Schedule) PDF */
  elsPdf: {
    filename: string
    fullPath: string
    revision: string
  } | null
  /** All files in the Electrical folder */
  allFiles: string[]
}

export interface LoadedLegalProject {
  id: string
  pdNumber: string
  projectName: string
  folderName: string
  revision: string
  wireListPath: string | null
  layoutPdfPath: string | null
  /** Parsed project model (if wire list was successfully parsed) */
  projectModel: ProjectModel | null
  /** Error message if parsing failed */
  error?: string
}

// ============================================================================
// Discovery Functions
// ============================================================================

/**
 * Extract version info from filename.
 * Examples:
 *   "4M582-UCPWiringList_A.2.xlsx" -> { revision: "A.2", isModified: false }
 *   "4M582-UCPWiringList_A.2_M.1.xlsx" -> { revision: "A.2", isModified: true, modificationNumber: "1" }
 *   "4L341-UCPWiringList_0.5.xlsx" -> { revision: "0.5", isModified: false }
 */
function extractVersionInfo(filename: string): { revision: string; isModified: boolean; modificationNumber?: string } {
  const versionInfo = parseLegalDrawingsFileVersion(filename)

  return {
    revision: versionInfo.baseRevision === 'Imported' ? 'unknown' : versionInfo.baseRevision,
    isModified: versionInfo.isModified,
    modificationNumber: versionInfo.modificationNumber?.toString(),
  }
}

function isNewerVersion(
  current: { revision: string; isModified: boolean; modificationNumber?: string },
  candidate: { revision: string; isModified: boolean; modificationNumber?: string }
): boolean {
  return compareLegalDrawingsFileVersions(
    {
      revision: current.isModified ? `${current.revision} M.${current.modificationNumber}` : current.revision,
      baseRevision: current.revision,
      isModified: current.isModified,
      modificationNumber: current.modificationNumber ? Number.parseInt(current.modificationNumber, 10) : undefined,
    },
    {
      revision: candidate.isModified ? `${candidate.revision} M.${candidate.modificationNumber}` : candidate.revision,
      baseRevision: candidate.revision,
      isModified: candidate.isModified,
      modificationNumber: candidate.modificationNumber ? Number.parseInt(candidate.modificationNumber, 10) : undefined,
    },
  ) < 0
}

function isPreferredWireList(fileName: string) {
  return /(?:^|[_-])UCPWiringList(?=[_.-]|$)/i.test(fileName)
}

function isWireListCandidate(fileName: string) {
  return isPreferredWireList(fileName)
}

function isLayoutCandidate(fileName: string) {
  return /(?:^|[_-])LAY(?:[_-]|\.)/i.test(fileName)
}

function selectLatestFileName(fileNames: string[], kind: 'wire-list' | 'layout', preferredBaseRevision?: string) {
  const ranked = fileNames
    .map(fileName => ({
      fileName,
      version: parseLegalDrawingsFileVersion(fileName),
      score: kind === 'wire-list'
        ? (isPreferredWireList(fileName) ? 300 : isWireListCandidate(fileName) ? 150 : 0)
        : (isLayoutCandidate(fileName) ? 250 : 0),
    }))
    .filter(candidate => candidate.score > 0)

  const candidates = preferredBaseRevision
    ? ranked.filter(candidate => candidate.version.baseRevision === preferredBaseRevision)
    : ranked

  const pool = candidates.length > 0 ? candidates : ranked

  return pool
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score
      }

      const versionCompare = compareLegalDrawingsFileVersions(left.version, right.version)
      if (versionCompare !== 0) {
        return versionCompare > 0 ? -1 : 1
      }

      return right.fileName.localeCompare(left.fileName, undefined, { numeric: true, sensitivity: 'base' })
    })[0]?.fileName ?? null
}

export async function discoverLegalDrawingsProjects(): Promise<LegalDrawingsProject[]> {
  const projects: LegalDrawingsProject[] = []
  const legalDrawingsRoot = await getLegalDrawingsRoot()

  try {
    await fs.access(legalDrawingsRoot)
  } catch {
    console.warn('[LegalDrawingsLoader] Legal Drawings directory not found')
    return []
  }

  const entries = await fs.readdir(legalDrawingsRoot, { withFileTypes: true })
  const projectFolders = entries.filter(e => e.isDirectory())

  for (const folder of projectFolders) {
    const folderPath = path.join(legalDrawingsRoot, folder.name)
    const projectFilesPath = await resolveLegalProjectFilesDirectory(legalDrawingsRoot, folder.name)
    const pdNumber = extractProjectNumberFromLegalFolder(folder.name)
    const projectName = getProjectNameFromLegalFolder(folder.name)

    let allFiles: string[] = []
    let wireList: LegalDrawingsProject['wireList'] = null
    let layoutPdf: LegalDrawingsProject['layoutPdf'] = null
    let elsPdf: LegalDrawingsProject['elsPdf'] = null

    try {
      allFiles = await fs.readdir(projectFilesPath)

      const wireListFiles = allFiles.filter(f => /\.(xlsx|xlsm|xls|xlsb)$/i.test(f) && isWireListCandidate(f))
      const latestWireList = selectLatestFileName(wireListFiles, 'wire-list')

      if (latestWireList) {
        const versionInfo = extractVersionInfo(latestWireList)
        wireList = {
          filename: latestWireList,
          fullPath: path.join(projectFilesPath, latestWireList),
          ...versionInfo,
        }
      }

      const layoutFiles = allFiles.filter(f => f.toLowerCase().endsWith('.pdf') && isLayoutCandidate(f))
      const preferredLayoutRevision = wireList?.revision
      const latestLayout = selectLatestFileName(layoutFiles, 'layout', preferredLayoutRevision)

      if (latestLayout) {
        const versionInfo = extractVersionInfo(latestLayout)
        layoutPdf = {
          filename: latestLayout,
          fullPath: path.join(projectFilesPath, latestLayout),
          revision: versionInfo.revision,
        }
      }

      // ELS and other companion files are intentionally ignored for startup discovery.
    } catch {
      console.warn(`[LegalDrawingsLoader] Could not read project files in ${folder.name}`)
    }

    projects.push({
      folderName: folder.name,
      pdNumber,
      projectName,
      folderPath,
      wireList,
      layoutPdf,
      elsPdf,
      allFiles,
    })
  }

  return projects
}

// ============================================================================
// Excel Parsing (simplified - creates stub ProjectModel)
// ============================================================================

/**
 * Create a stub ProjectModel for a Legal Drawings project.
 * In production, this would parse the Excel file fully.
 * For now, we create a minimal model with metadata.
 */
function createStubProjectModel(
  project: LegalDrawingsProject,
  wireListBuffer?: Buffer
): ProjectModel {
  const id = `legal-${project.pdNumber.toLowerCase()}`
  const revision = project.wireList?.revision || 'unknown'
  
  // Determine LWC type based on project name patterns
  let lwcType: LwcType = 'ONSKID'
  const projectNameLower = project.projectName.toLowerCase()
  if (projectNameLower.includes('flex') || projectNameLower.includes('new')) {
    lwcType = 'NEW_FLEX'
  } else if (projectNameLower.includes('ntb')) {
    lwcType = 'NTB'
  } else if (projectNameLower.includes('off')) {
    lwcType = 'OFFSKID'
  }
  
  // Create stub sheets based on discovered files
  const sheets: ProjectSheetSummary[] = []
  const sheetData: Record<string, ParsedWorkbookSheet> = {}
  
  // Add a main wire list sheet
  if (project.wireList) {
    const sheetId = 'main-wirelist'
    sheets.push({
      id: sheetId,
      name: 'UCP Wiring List',
      slug: 'ucp-wiring-list',
      kind: 'operational',
      rowCount: 0, // Would be populated from actual parsing
      columnCount: 0,
      headers: [],
      sheetIndex: 0,
      hasData: true,
      warnings: []
    })
    
    sheetData[sheetId] = {
      originalName: 'UCP Wiring List',
      slug: 'ucp-wiring-list',
      headers: [],
      rows: [],
      rowCount: 0,
      columnCount: 0,
      sheetIndex: 0,
      warnings: []
    }
  }
  
  return {
    id,
    filename: project.wireList?.filename || `${project.pdNumber}.xlsx`,
    name: `${project.pdNumber} - ${project.projectName}`,
    pdNumber: project.pdNumber,
    revision,
    lwcType,
    sheets,
    sheetData,
    createdAt: new Date(),
    warnings: []
  }
}

// ============================================================================
// Main Loading Function
// ============================================================================

/**
 * Load all Legal Drawings projects and create ProjectModels.
 */
export async function loadLegalDrawingsProjects(): Promise<LoadedLegalProject[]> {
  const discovered = await discoverLegalDrawingsProjects()
  const loaded: LoadedLegalProject[] = []
  
  for (const project of discovered) {
    try {
      // For now, create stub models. In production, parse Excel files fully.
      const projectModel = createStubProjectModel(project)
      
      loaded.push({
        id: projectModel.id,
        pdNumber: project.pdNumber,
        projectName: project.projectName,
        folderName: project.folderName,
        revision: project.wireList?.revision || 'unknown',
        wireListPath: project.wireList?.fullPath || null,
        layoutPdfPath: project.layoutPdf?.fullPath || null,
        projectModel
      })
    } catch (error) {
      loaded.push({
        id: `legal-${project.pdNumber.toLowerCase()}`,
        pdNumber: project.pdNumber,
        projectName: project.projectName,
        folderName: project.folderName,
        revision: 'unknown',
        wireListPath: null,
        layoutPdfPath: null,
        projectModel: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
  
  return loaded
}

/**
 * Get paths to Legal Drawings files (for client-side use).
 * Returns paths relative to /Share that can be used with API routes.
 */
export async function getLegalDrawingsPaths(): Promise<{
  projects: Array<{
    pdNumber: string
    projectName: string
    wireListPath: string | null
    layoutPdfPath: string | null
  }>
}> {
  const discovered = await discoverLegalDrawingsProjects()
  
  return {
    projects: discovered.map(p => ({
      pdNumber: p.pdNumber,
      projectName: p.projectName,
      wireListPath: p.wireList 
        ? p.wireList.fullPath.replace(process.cwd(), '')
        : null,
      layoutPdfPath: p.layoutPdf
        ? p.layoutPdf.fullPath.replace(process.cwd(), '')
        : null
    }))
  }
}
