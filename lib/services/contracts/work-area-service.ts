/**
 * Work Area Service Contract
 * 
 * Manages work area/station configuration and state.
 * Reads from Share/380/WorkAreas/ and Share/380/Config/
 */

import type { ServiceResult, LwcSectionId } from './index'

export type WorkAreaKind = 'BUILDUP_TABLE' | 'WIRING_TABLE' | 'TEST_STATION' | 'FLOAT' | 'NTB' | 'OFFICE_AREA'
export type WorkAreaLoadState = 'idle' | 'balanced' | 'busy' | 'over-capacity'

export interface WorkArea {
  /** Unique work area ID */
  id: string
  /** Display label */
  label: string
  /** Station code (e.g., "B1", "W2", "T15") */
  stationCode: string
  /** LWC section this area belongs to */
  lwc: LwcSectionId
  /** Work area kind */
  kind: WorkAreaKind
  /** Maximum capacity (concurrent assignments/members) */
  capacity: number
  /** Supported workflow stages */
  supportedStages: string[]
  /** Position for floor layout (grid coordinates) */
  position: { row: number; col: number }
  /** Notes about this work area */
  notes: string
  /** Is this area currently available */
  available: boolean
  /** Data mode indicator */
  dataMode: 'mock' | 'share' | 'electron'
}

export interface WorkAreaWithState extends WorkArea {
  /** Current load state */
  loadState: WorkAreaLoadState
  /** Load ratio (0-1.2) */
  loadRatio: number
  /** Currently assigned member badges */
  assignedMemberBadges: string[]
  /** Currently active assignment IDs */
  activeAssignmentIds: string[]
}

export interface FloorLayoutConfig {
  /** Layout ID */
  id: string
  /** Display label */
  label: string
  /** LWC section */
  lwc: LwcSectionId
  /** Grid dimensions */
  grid: { rows: number; cols: number }
  /** Work area placements */
  placements: Array<{
    workAreaId: string
    row: number
    col: number
    rowSpan?: number
    colSpan?: number
  }>
  /** Blocked/unavailable cells (striped areas) */
  blockedCells: Array<{ row: number; col: number }>
  /** Special zones (staging areas, etc.) */
  specialZones: Array<{
    id: string
    label: string
    row: number
    col: number
    rowSpan: number
    colSpan: number
    type: 'staging' | 'storage' | 'pathway'
  }>
}

export interface IWorkAreaService {
  /**
   * Get all work areas.
   * Reads from Share/380/WorkAreas/config.json or Share/380/Config/work-areas.xlsx
   */
  getWorkAreas(): Promise<ServiceResult<WorkArea[]>>

  /**
   * Get work areas with current state (load, assignments, members).
   */
  getWorkAreasWithState(): Promise<ServiceResult<WorkAreaWithState[]>>

  /**
   * Get work areas by LWC section.
   */
  getWorkAreasByLwc(lwc: LwcSectionId): Promise<ServiceResult<WorkAreaWithState[]>>

  /**
   * Get work areas by kind.
   */
  getWorkAreasByKind(kind: WorkAreaKind): Promise<ServiceResult<WorkAreaWithState[]>>

  /**
   * Get a single work area by ID.
   */
  getWorkAreaById(id: string): Promise<ServiceResult<WorkAreaWithState | null>>

  /**
   * Get floor layout configuration.
   * Reads from Share/380/Config/floor-layouts.json
   */
  getFloorLayout(lwc: LwcSectionId): Promise<ServiceResult<FloorLayoutConfig | null>>

  /**
   * Get all floor layouts.
   */
  getAllFloorLayouts(): Promise<ServiceResult<FloorLayoutConfig[]>>

  /**
   * Update work area availability.
   */
  setWorkAreaAvailability(id: string, available: boolean): Promise<ServiceResult<WorkArea>>

  /**
   * Update work area notes.
   */
  updateWorkAreaNotes(id: string, notes: string): Promise<ServiceResult<WorkArea>>
}
