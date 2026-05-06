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
  resolveLegalProjectFilesDirectory,
} from '@/lib/legal-drawings/discovery'
import {
  type FileRevision,
  type ProjectRevisionHistory,
  parseRevisionFromFilename,
  sortRevisions,
  getLatestRevision,
  getPreviousRevision,
  isWireListFile,
  isLayoutFile,
} from './types'

async function getLegalDrawingsRoot(): Promise<string> {
  const shareRoot = await resolveShareDirectory()
  return path.join(shareRoot, 'Legal Drawings')
}

// ============================================================================
// File Discovery
// ============================================================================

/**
 * Build a FileRevision from a file path.
 */
async function buildFileRevision(
  filePath: string,
  category: FileRevision['category']
): Promise<FileRevision> {
  const filename = path.basename(filePath)
  const stats = await fs.stat(filePath)
  
  return {
    filename,
    filePath,
    revisionInfo: parseRevisionFromFilename(filename),
    category,
    lastModified: stats.mtime.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    fileSize: stats.size,
  }
}

/**
 * Discover all revisions for a specific project.
 */
export async function discoverProjectRevisions(
  projectId: string,
  folderName: string
): Promise<ProjectRevisionHistory> {
  const legalDrawingsRoot = await getLegalDrawingsRoot()
  const projectFilesPath = await resolveLegalProjectFilesDirectory(legalDrawingsRoot, folderName)
  const pdNumber = extractProjectNumberFromLegalFolder(folderName)
  
  const wireListRevisions: FileRevision[] = []
  const layoutRevisions: FileRevision[] = []
  
  try {
    const files = await fs.readdir(projectFilesPath)
    
    for (const file of files) {
      const filePath = path.join(projectFilesPath, file)
      const stats = await fs.stat(filePath)
      
      if (!stats.isFile()) continue
      
      // Categorize and build revision info
      if (isWireListFile(file)) {
        wireListRevisions.push(await buildFileRevision(filePath, 'WIRE_LIST'))
      } else if (isLayoutFile(file)) {
        layoutRevisions.push(await buildFileRevision(filePath, 'LAYOUT'))
      }
    }
  } catch {
    console.warn(`[RevisionDiscovery] Could not read ${projectFilesPath}`)
  }
  
  // Sort and identify current/previous
  const sortedWireLists = sortRevisions(wireListRevisions)
  const sortedLayouts = sortRevisions(layoutRevisions)
  
  return {
    projectId,
    folderName,
    pdNumber,
    wireListRevisions: sortedWireLists,
    layoutRevisions: sortedLayouts,
    currentWireList: getLatestRevision(wireListRevisions),
    currentLayout: getLatestRevision(layoutRevisions),
    previousWireList: getPreviousRevision(wireListRevisions),
    previousLayout: getPreviousRevision(layoutRevisions),
  }
}

/**
 * Discover revisions for all projects in Legal Drawings.
 */
export async function discoverAllProjectRevisions(): Promise<ProjectRevisionHistory[]> {
  const results: ProjectRevisionHistory[] = []
  const legalDrawingsRoot = await getLegalDrawingsRoot()
  
  try {
    const entries = await fs.readdir(legalDrawingsRoot, { withFileTypes: true })
    const projectFolders = entries.filter(e => e.isDirectory())
    
    for (const folder of projectFolders) {
      const pdNumber = extractProjectNumberFromLegalFolder(folder.name).toLowerCase()
      const projectId = `pd-${pdNumber}`
      
      const history = await discoverProjectRevisions(projectId, folder.name)
      results.push(history)
    }
  } catch {
    console.warn('[RevisionDiscovery] Could not read Legal Drawings directory')
  }
  
  return results
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
    const legalDrawingsRoot = await getLegalDrawingsRoot()
    const entries = await fs.readdir(legalDrawingsRoot, { withFileTypes: true })
    const projectFolders = entries.filter(e => e.isDirectory())
    
    // Normalize search term
    const searchTerm = projectIdOrPdNumber
      .replace(/^pd-/i, '')
      .toLowerCase()
    
    // Normalize pdNumber hint (most reliable match key)
    const pdHint = pdNumberHint?.trim().toLowerCase() || null
    
    // Find matching folder — prefer pdNumber hint, then fallback to searchTerm
    const matchingFolder = projectFolders.find(folder => {
      const folderPd = extractProjectNumberFromLegalFolder(folder.name).toLowerCase()
      // Match on explicit PD number hint first
      if (pdHint && folderPd === pdHint) return true
      // Match on search term (works when projectId IS the PD number)
      return folderPd === searchTerm || folder.name.toLowerCase().includes(searchTerm)
    })
    
    if (!matchingFolder) return null
    
    const pdNumber = extractProjectNumberFromLegalFolder(matchingFolder.name).toLowerCase()
    const projectId = `pd-${pdNumber}`
    
    return discoverProjectRevisions(projectId, matchingFolder.name)
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
