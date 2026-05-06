/**
 * Revision Management Types
 * 
 * Types for tracking and comparing file revisions across projects.
 * Supports naming patterns like: _A.2, _0.5, _A.2_M.1 (modified versions)
 */

// ============================================================================
// Revision Info
// ============================================================================

export interface RevisionInfo {
  /** Raw revision string (e.g., "A.2", "0.5") */
  revision: string
  /** Whether this is a modified version (_M.x suffix) */
  isModified: boolean
  /** Modification number if applicable */
  modificationNumber?: string
  /** Full version string for display (e.g., "A.2 M.1") */
  displayVersion: string
  /** Sortable numeric score for ordering */
  sortScore: number
}

export interface FileRevision {
  /** Full filename */
  filename: string
  /** Full file path */
  filePath: string
  /** Extracted revision info */
  revisionInfo: RevisionInfo
  /** File category (LAYOUT, WIRE_LIST, etc.) */
  category: 'LAYOUT' | 'WIRE_LIST' | 'REFERENCE' | 'OTHER'
  /** Last modified date */
  lastModified?: string
  /** File size in bytes */
  fileSize?: number
}

export interface ProjectRevisionHistory {
  /** Project ID */
  projectId: string
  /** Legal drawings source folder backing this revision set */
  folderName: string
  /** PD Number */
  pdNumber: string
  /** All wire list revisions found */
  wireListRevisions: FileRevision[]
  /** All layout revisions found */
  layoutRevisions: FileRevision[]
  /** Current/latest wire list revision */
  currentWireList: FileRevision | null
  /** Current/latest layout revision */
  currentLayout: FileRevision | null
  /** Previous wire list revision (for comparison) */
  previousWireList: FileRevision | null
  /** Previous layout revision (for comparison) */
  previousLayout: FileRevision | null
}

// ============================================================================
// Comparison Types
// ============================================================================

export type RowChangeType = 'added' | 'removed' | 'modified' | 'unchanged'

export interface WireRowDiff {
  /** Row ID from source revision */
  sourceRowId?: string
  /** Row ID from target revision */
  targetRowId?: string
  /** Change type */
  changeType: RowChangeType
  /** Fields that changed (for modified rows) */
  changedFields?: string[]
  /** Source row data */
  sourceRow?: Record<string, unknown>
  /** Target row data */
  targetRow?: Record<string, unknown>
}

export interface RevisionComparison {
  /** Source revision (previous) */
  sourceRevision: RevisionInfo
  /** Target revision (current) */
  targetRevision: RevisionInfo
  /** Sheet name being compared */
  sheetName: string
  /** Summary statistics */
  summary: {
    totalRows: {
      source: number
      target: number
    }
    added: number
    removed: number
    modified: number
    unchanged: number
  }
  /** Detailed row diffs */
  diffs: WireRowDiff[]
}

// ============================================================================
// Revision Parsing Utilities
// ============================================================================

/**
 * Parse revision info from a filename.
 * Handles patterns like:
 *   - _A.2.xlsx -> { revision: "A.2", isModified: false }
 *   - _0.5.pdf -> { revision: "0.5", isModified: false }
 *   - _A.2_M.1.xlsx -> { revision: "A.2", isModified: true, modificationNumber: "1" }
 */
export function parseRevisionFromFilename(filename: string): RevisionInfo {
  // Match modified version pattern: _A.5_M.3.pdf or _A.5_M3.pdf (dot after M is optional)
  const modifiedMatch = filename.match(/_([A-Z0-9]+\.[0-9]+)_M\.?([0-9]+)\./i)
  if (modifiedMatch) {
    const revision = modifiedMatch[1].toUpperCase()
    const modNum = modifiedMatch[2]
    return {
      revision,
      isModified: true,
      modificationNumber: modNum,
      displayVersion: `${revision} M.${modNum}`,
      sortScore: calculateRevisionScore(revision, true, parseInt(modNum))
    }
  }
  
  // Match standard version pattern: _A.2.xlsx or _0.5.pdf
  const standardMatch = filename.match(/_([A-Z0-9]+\.[0-9]+)\./i)
  if (standardMatch) {
    const revision = standardMatch[1].toUpperCase()
    return {
      revision,
      isModified: false,
      displayVersion: revision,
      sortScore: calculateRevisionScore(revision, false, 0)
    }
  }
  
  // No revision found
  return {
    revision: 'unknown',
    isModified: false,
    displayVersion: 'Unknown',
    sortScore: 0
  }
}

/**
 * Calculate a numeric score for sorting revisions.
 * Higher score = more recent revision.
 */
function calculateRevisionScore(revision: string, isModified: boolean, modNumber: number): number {
  let score = 0
  
  // Parse letter.number format (e.g., "A.2" or "0.5")
  const parts = revision.split('.')
  const majorPart = parts[0] || ''
  const minorPart = parseInt(parts[1] || '0')
  
  // Letter revisions (A-Z) are typically newer than numeric (0.x)
  if (/^[A-Z]$/i.test(majorPart)) {
    // A=1, B=2, etc. multiplied by 1000
    score = (majorPart.toUpperCase().charCodeAt(0) - 64) * 1000
  } else {
    // Numeric major version
    score = parseInt(majorPart) * 100
  }
  
  // Add minor version
  score += minorPart * 10
  
  // Modified versions are later than base versions
  if (isModified) {
    score += modNumber
  }
  
  return score
}

/**
 * Sort revisions from oldest to newest.
 */
export function sortRevisions<T extends { revisionInfo: RevisionInfo }>(revisions: T[]): T[] {
  return [...revisions].sort((a, b) => a.revisionInfo.sortScore - b.revisionInfo.sortScore)
}

/**
 * Get the latest revision from a list.
 */
export function getLatestRevision<T extends { revisionInfo: RevisionInfo }>(revisions: T[]): T | null {
  if (revisions.length === 0) return null
  const sorted = sortRevisions(revisions)
  return sorted[sorted.length - 1]
}

/**
 * Get the previous revision from a list (second to last).
 */
export function getPreviousRevision<T extends { revisionInfo: RevisionInfo }>(revisions: T[]): T | null {
  if (revisions.length < 2) return null
  const sorted = sortRevisions(revisions)
  return sorted[sorted.length - 2]
}

/**
 * Check if a filename is a wire list file.
 */
export function isWireListFile(filename: string): boolean {
  return /(?:^|[_-])UCPWiringList(?=[_.-]|$)/i.test(filename) && 
         /\.(xlsx|xlsm|xls)$/i.test(filename)
}

/**
 * Check if a filename is a layout file.
 */
export function isLayoutFile(filename: string): boolean {
  return /(?:^|[_-])LAY(?:[_-]|\.)/i.test(filename) && /\.pdf$/i.test(filename)
}
