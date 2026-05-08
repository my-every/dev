import 'server-only'

/**
 * Revision Discovery Service (Server-Only)
 * 
 * Discovers all file revisions from Share/Legal Drawings directory structure.
 * Tracks UCP/LAY revision patterns and enables version comparison.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import {
  extractProjectNumberFromLegalFolder,
} from '@/lib/legal-drawings/discovery'
import {
  type ProjectRevisionHistory,
} from './types'
import { scanProjectRevisionsFromFilesystem, toProjectRevisionHistory } from './filesystem-scan'

async function getLegalDrawingsRoot(): Promise<string> {
  const shareRoot = await resolveShareDirectory()
  return path.join(shareRoot, 'Legal Drawings')
}

/**
 * Discover all revisions for a specific project.
 */
export async function discoverProjectRevisions(
  projectId: string,
  folderName: string
): Promise<ProjectRevisionHistory> {
  const pdNumber = extractProjectNumberFromLegalFolder(folderName)

  const scan = await scanProjectRevisionsFromFilesystem({
    scope: 'both',
    projectFilter: pdNumber,
  })

  const row = scan.projects.find((project) => project.pdNumber.toUpperCase() === pdNumber.toUpperCase())
  if (!row) {
    return {
      projectId,
      folderName,
      pdNumber,
      wireListRevisions: [],
      layoutRevisions: [],
      currentWireList: null,
      currentLayout: null,
      previousWireList: null,
      previousLayout: null,
      sourceRoots: {
        legal: scan.legalSourceRoot,
        brand: scan.brandSourceRoot,
      },
      treeRow: null,
    }
  }

  const history = toProjectRevisionHistory(row)
  return {
    ...history,
    projectId,
    folderName,
  }
}

/**
 * Discover revisions for all projects in Legal Drawings.
 */
export async function discoverAllProjectRevisions(): Promise<ProjectRevisionHistory[]> {
  const scan = await scanProjectRevisionsFromFilesystem({ scope: 'both' })
  return scan.projects.map(toProjectRevisionHistory)
}

/**
 * Get revision history for a specific project by ID or PD number.
 * @param projectIdOrPdNumber - Project ID, PD number prefix, or full PD number
 * @param pdNumberHint - Optional explicit PD number to improve matching
 */
export async function getProjectRevisionHistory(
  projectIdOrPdNumber: string,
  pdNumberHint?: string | null,
): Promise<ProjectRevisionHistory | null> {
  try {
    const normalizedHint = pdNumberHint?.trim().replace(/^pd-/i, '') || null
    const normalizedProject = projectIdOrPdNumber.trim().replace(/^pd-/i, '')
    const projectFilter = normalizedHint || normalizedProject

    const scan = await scanProjectRevisionsFromFilesystem({
      scope: 'both',
      projectFilter,
    })
    const searchTerm = projectIdOrPdNumber
      .replace(/^pd-/i, '')
      .toLowerCase()

    const pdHint = pdNumberHint?.trim().toLowerCase() || null

    const row = scan.projects.find((project) => {
      const rowPd = project.pdNumber.toLowerCase()
      if (pdHint && rowPd === pdHint) return true
      return rowPd === searchTerm || project.rootLabel.toLowerCase().includes(searchTerm)
    })

    return row ? toProjectRevisionHistory(row) : null
  } catch {
    return null
  }
}

/**
 * Get file content for a specific revision file path.
 * Returns the buffer for Excel/PDF files.
 */
export async function getRevisionFileContent(filePath: string): Promise<Buffer | null> {
  try {
    const legalDrawingsRoot = await getLegalDrawingsRoot()
    // Security: Ensure the path is within Legal Drawings
    const normalizedPath = path.normalize(filePath)
    if (!normalizedPath.startsWith(legalDrawingsRoot)) {
      throw new Error('Invalid file path')
    }
    
    return await fs.readFile(normalizedPath)
  } catch {
    return null
  }
}

/**
 * Check if a project has multiple revisions available for comparison.
 */
export async function hasComparableRevisions(projectIdOrPdNumber: string): Promise<boolean> {
  const history = await getProjectRevisionHistory(projectIdOrPdNumber)
  if (!history) return false
  
  return history.wireListRevisions.length > 1 || history.layoutRevisions.length > 1
}
