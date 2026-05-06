/**
 * Project Discovery Service Contract
 * 
 * Discovers and catalogs projects from the filesystem.
 * Reads from Share/380/Projects/<PD#>-<ProjectName>/
 */

import type { ServiceResult, PaginatedResult, FileReference } from './index'

export interface ProjectSummary {
  /** Unique project ID derived from folder name */
  projectId: string
  /** PD number (e.g., "PD-380-214") */
  pdNumber: string
  /** Project display name */
  projectName: string
  /** Full folder path relative to Share/380/Projects/ */
  folderPath: string
  /** Project priority (1-5, lower is higher priority) */
  priority: number
  /** Current lifecycle stage */
  stage: 'upcoming' | 'in_progress' | 'testing' | 'completed' | 'on_hold'
  /** Risk indicator */
  risk: 'healthy' | 'watch' | 'late'
  /** Total sheet count */
  totalSheets: number
  /** Completed sheet count */
  completedSheets: number
  /** Overall progress percentage */
  progressPercent: number
  /** Last updated timestamp */
  updatedAt: string
  /** Target completion date */
  targetDate: string | null
  /** Project has layout PDFs */
  hasLayouts: boolean
  /** Project has UCP workbook */
  hasUcp: boolean
  /** Data mode indicator */
  dataMode: 'mock' | 'share' | 'electron'
}

export interface ProjectDetail extends ProjectSummary {
  /** Sheets/assignments in this project */
  sheets: ProjectSheet[]
  /** Layout PDF references */
  layoutFiles: FileReference[]
  /** UCP workbook reference */
  ucpFile: FileReference | null
  /** Reference files */
  referenceFiles: FileReference[]
  /** Export bundles */
  exportBundles: FileReference[]
  /** Project state file */
  stateFile: FileReference | null
  /** Project notes from state */
  notes: string
  /** Customer name if available */
  customerName: string | null
  /** Serial number if available */
  serialNumber: string | null
}

export interface ProjectSheet {
  /** Sheet name (e.g., "A PANEL", "DOOR HARNESS") */
  sheetName: string
  /** Normalized slug for URLs */
  sheetSlug: string
  /** Current stage */
  currentStage: string
  /** Stage progress percentage */
  stageProgress: number
  /** Wire count for this sheet */
  wireCount: number
  /** Completed wire count */
  completedWires: number
  /** Assigned member badges */
  assignedMemberBadges: string[]
  /** Current work area ID if assigned */
  currentWorkAreaId: string | null
  /** Last updated timestamp */
  updatedAt: string
  /** Has IPV1 been completed */
  ipv1Complete: boolean
  /** Has IPV2 been completed */
  ipv2Complete: boolean
}

export interface ProjectFilter {
  /** Filter by lifecycle stage */
  stage?: ProjectSummary['stage'] | ProjectSummary['stage'][]
  /** Filter by risk level */
  risk?: ProjectSummary['risk'] | ProjectSummary['risk'][]
  /** Filter by LWC section */
  lwc?: string
  /** Search by PD number or name */
  search?: string
  /** Only projects with layouts */
  hasLayouts?: boolean
  /** Sort field */
  sortBy?: 'priority' | 'updatedAt' | 'targetDate' | 'progress'
  /** Sort direction */
  sortDir?: 'asc' | 'desc'
}

export interface IProjectDiscoveryService {
  /**
   * Scan for all projects in Share/380/Projects/
   * Returns summary records for each discovered project folder.
   */
  discoverProjects(): Promise<ServiceResult<ProjectSummary[]>>

  /**
   * Get paginated project list with filters.
   */
  getProjects(
    filter?: ProjectFilter,
    page?: number,
    pageSize?: number
  ): Promise<ServiceResult<PaginatedResult<ProjectSummary>>>

  /**
   * Get full project detail by ID.
   * Reads project folder contents and state files.
   */
  getProjectById(projectId: string): Promise<ServiceResult<ProjectDetail | null>>

  /**
   * Get project by PD number.
   */
  getProjectByPdNumber(pdNumber: string): Promise<ServiceResult<ProjectDetail | null>>

  /**
   * Get sheets for a project.
   */
  getProjectSheets(projectId: string): Promise<ServiceResult<ProjectSheet[]>>

  /**
   * Get upcoming projects (not yet started).
   */
  getUpcomingProjects(limit?: number): Promise<ServiceResult<ProjectSummary[]>>

  /**
   * Get late/at-risk projects.
   */
  getLateProjects(limit?: number): Promise<ServiceResult<ProjectSummary[]>>

  /**
   * Get recently updated projects.
   */
  getRecentlyUpdatedProjects(limit?: number): Promise<ServiceResult<ProjectSummary[]>>

  /**
   * Refresh project cache (re-scan filesystem).
   */
  refreshCache(): Promise<ServiceResult<void>>
}
