/**
 * File Catalog Service Contract
 * 
 * Manages file discovery, metadata extraction, and references.
 * Scans Share/380/ for all project files and extracts metadata.
 */

import type { ServiceResult, FileReference } from './index'

export type FileCategory = 
  | 'WIRE_LIST' 
  | 'LAYOUT' 
  | 'REFERENCE' 
  | 'UCP' 
  | 'STATE' 
  | 'CONFIG' 
  | 'EXPORT' 
  | 'PREVIEW' 
  | 'UNKNOWN'

export interface CatalogedFile extends FileReference {
  /** File category */
  category: FileCategory
  /** File role identifier */
  fileRole: string
  /** Parent project ID (if project-scoped) */
  projectId: string | null
  /** PD number (if project-scoped) */
  pdNumber: string | null
  /** Sheet name (if sheet-scoped) */
  sheetName: string | null
  /** Original filename */
  filename: string
  /** File extension */
  extension: string
  /** Extracted metadata (type depends on file type) */
  metadata: FileMetadata | null
  /** Preview image path (for PDFs) */
  previewPath: string | null
  /** Is this file required or optional */
  requiredLevel: 'required' | 'optional' | 'out_of_scope'
  /** Indexed timestamp */
  indexedAt: string
}

export interface FileMetadata {
  /** Title from document */
  title: string | null
  /** Author if available */
  author: string | null
  /** Page count (for PDFs) */
  pageCount: number | null
  /** Row count (for spreadsheets) */
  rowCount: number | null
  /** Column count (for spreadsheets) */
  columnCount: number | null
  /** Sheet names (for spreadsheets) */
  sheetNames: string[] | null
  /** Creation date */
  createdAt: string | null
  /** Last modified date */
  modifiedAt: string | null
  /** Extracted keywords/tags */
  keywords: string[]
  /** PDF-specific: panel name */
  panelName: string | null
  /** PDF-specific: device count */
  deviceCount: number | null
  /** PDF-specific: wire count */
  wireCount: number | null
}

export interface FileScanOptions {
  /** Only scan specific project folders */
  projectIds?: string[]
  /** Only scan specific categories */
  categories?: FileCategory[]
  /** Include hidden/system files */
  includeHidden?: boolean
  /** Force re-extraction of metadata */
  forceRefresh?: boolean
}

export interface IFileCatalogService {
  /**
   * Full scan of Share/380/ directory.
   * Returns all cataloged files.
   */
  scanAll(options?: FileScanOptions): Promise<ServiceResult<CatalogedFile[]>>

  /**
   * Scan a specific project folder.
   */
  scanProject(projectId: string): Promise<ServiceResult<CatalogedFile[]>>

  /**
   * Get files by category.
   */
  getFilesByCategory(category: FileCategory): Promise<ServiceResult<CatalogedFile[]>>

  /**
   * Get files for a project.
   */
  getProjectFiles(projectId: string): Promise<ServiceResult<CatalogedFile[]>>

  /**
   * Get layout PDFs for a project.
   */
  getProjectLayouts(projectId: string): Promise<ServiceResult<CatalogedFile[]>>

  /**
   * Get UCP workbook for a project.
   */
  getProjectUcp(projectId: string): Promise<ServiceResult<CatalogedFile | null>>

  /**
   * Get file by path.
   */
  getFileByPath(path: string): Promise<ServiceResult<CatalogedFile | null>>

  /**
   * Extract metadata from a file.
   */
  extractMetadata(path: string): Promise<ServiceResult<FileMetadata | null>>

  /**
   * Generate preview image for a PDF page.
   */
  generatePdfPreview(path: string, page?: number): Promise<ServiceResult<string | null>>

  /**
   * Check if a required file exists for a project.
   */
  checkRequiredFiles(projectId: string): Promise<ServiceResult<{
    missing: CatalogedFile[]
    present: CatalogedFile[]
    optional: CatalogedFile[]
  }>>

  /**
   * Get file contents (for small text/json files).
   */
  readFileContents(path: string): Promise<ServiceResult<string | null>>

  /**
   * Write file contents (for state/config files).
   */
  writeFileContents(path: string, contents: string): Promise<ServiceResult<void>>
}
