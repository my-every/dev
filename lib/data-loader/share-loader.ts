/**
 * Share Data Loader (Server-Only)
 * 
 * Loads data from the Share/ directory JSON files using Node.js fs.
 * This module is server-only and cannot be imported in client components.
 * 
 * For client-safe utilities (deriveProjectStageCompletions, formatShortDate),
 * import from './share-utils' instead.
 */
import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import type { StoredProject } from '@/types/d380-shared'

// Re-export types and client-safe utilities from share-utils
export type {
  StageHistoryEntry,
  AssignmentProgressRecord,
  ProjectAssignmentProgress,
  ProjectState,
  ActiveProjectsState,
  CurrentShiftState,
  DiscoveredProject,
} from './share-utils'

export { deriveProjectStageCompletions, formatShortDate } from './share-utils'

import type {
  ProjectAssignmentProgress,
  ActiveProjectsState,
  CurrentShiftState,
  DiscoveredProject,
} from './share-utils'

const SHARE_PREFIX = '/Share'

async function resolveSharePath(relativePath: string): Promise<string> {
  const shareRoot = await resolveShareDirectory()

  if (relativePath.startsWith(SHARE_PREFIX)) {
    return path.join(shareRoot, relativePath.slice(SHARE_PREFIX.length))
  }

  return path.join(shareRoot, relativePath)
}

// Cache for loaded data
const dataCache: Map<string, { data: unknown; loadedAt: number }> = new Map()
const CACHE_TTL = 30000 // 30 seconds

// Project folder discovery cache
let discoveredProjectsCache: DiscoveredProject[] | null = null
let discoveredProjectsCacheTime = 0

/**
 * Load a JSON file from the filesystem.
 * Uses Node.js fs for server-side rendering.
 */
async function loadJsonFile<T>(relativePath: string): Promise<T | null> {
  const cached = dataCache.get(relativePath)
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
    return cached.data as T
  }

  try {
    const absolutePath = await resolveSharePath(relativePath)

    const content = await fs.readFile(absolutePath, 'utf-8')
    const data = JSON.parse(content) as T
    dataCache.set(relativePath, { data, loadedAt: Date.now() })
    return data
  } catch (error) {
    console.warn(`[ShareLoader] Failed to load ${relativePath}:`, error)
    return null
  }
}

/**
 * Discover project folders from Share/Projects directory.
 */
export async function discoverProjectFolders(): Promise<DiscoveredProject[]> {
  // Return cached if fresh
  if (discoveredProjectsCache && Date.now() - discoveredProjectsCacheTime < CACHE_TTL) {
    return discoveredProjectsCache
  }

  const projects: DiscoveredProject[] = []

  try {
    const shareRoot = await resolveShareDirectory()
    const entries = await fs.readdir(path.join(shareRoot, 'Projects'), { withFileTypes: true })
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue
      }

      const folder = entry.name
      const projectContext = await loadJsonFile<StoredProject>(`/Share/Projects/${folder}/state/project-context.json`)
      const projectId = projectContext?.id
      const pdNumber = projectContext?.projectModel.pdNumber ?? folder.split('_')[0]

      if (projectId && pdNumber) {
        projects.push({
          folder,
          projectId,
          pdNumber,
        })
      }
    }
  } catch {
    return []
  }

  discoveredProjectsCache = projects
  discoveredProjectsCacheTime = Date.now()
  return projects
}

/**
 * Get the base path for a project's data files.
 */
async function getProjectBasePath(projectId: string): Promise<string | null> {
  const projects = await discoverProjectFolders()
  const project = projects.find(p => p.projectId === projectId)

  if (!project) return null

  return `/Share/Projects/${project.folder}`
}

export async function loadProjectAssignmentProgress(
  projectId: string
): Promise<ProjectAssignmentProgress | null> {
  const basePath = await getProjectBasePath(projectId)
  if (!basePath) return null

  return loadJsonFile<ProjectAssignmentProgress>(`${basePath}/state/assignment-progress.json`)
}

export async function loadActiveProjects(): Promise<ActiveProjectsState | null> {
  return loadJsonFile<ActiveProjectsState>('/Share/State/active-projects.json')
}

export async function loadCurrentShift(): Promise<CurrentShiftState | null> {
  return loadJsonFile<CurrentShiftState>('/Share/State/current-shift.json')
}

/**
 * Clear the data cache (useful for forcing a refresh)
 */
export function clearDataCache(): void {
  dataCache.clear()
  discoveredProjectsCache = null
  discoveredProjectsCacheTime = 0
}

/**
 * Get all discovered projects with their sources
 */
export async function getAllProjects(): Promise<DiscoveredProject[]> {
  return discoverProjectFolders()
}

// ============================================================================
// CSV UTILITIES
// ============================================================================

/**
 * Parse a CSV string into an array of objects.
 * First row is treated as headers.
 */
export function parseCSV<T extends Record<string, unknown>>(csvContent: string): T[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0])
  const results: T[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const obj: Record<string, unknown> = {}

    headers.forEach((header, index) => {
      const value = values[index] || ''
      obj[header] = parseCSVValue(value)
    })

    results.push(obj as T)
  }

  return results
}

/**
 * Parse a single CSV line, handling quoted values.
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"' && !inQuotes) {
      inQuotes = true
    } else if (char === '"' && inQuotes) {
      if (line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = false
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  values.push(current.trim())
  return values
}

/**
 * Parse a CSV value, converting to appropriate type.
 */
function parseCSVValue(value: string): unknown {
  // Empty string
  if (value === '') return null

  // Boolean
  if (value === 'true') return true
  if (value === 'false') return false

  // Number
  if (!isNaN(Number(value)) && value !== '') {
    return Number(value)
  }

  // JSON (metadata fields)
  if (value.startsWith('{') || value.startsWith('[')) {
    try {
      // Convert single quotes to double quotes for JSON parsing
      const jsonValue = value.replace(/'/g, '"')
      return JSON.parse(jsonValue)
    } catch {
      return value
    }
  }

  // String
  return value
}

/**
 * Convert an array of objects to CSV string.
 */
export function toCSV<T extends Record<string, unknown>>(data: T[], headers?: string[]): string {
  if (data.length === 0) return ''

  const keys = headers || Object.keys(data[0])
  const lines: string[] = []

  // Header row
  lines.push(keys.join(','))

  // Data rows
  for (const row of data) {
    const values = keys.map(key => formatCSVValue(row[key]))
    lines.push(values.join(','))
  }

  return lines.join('\n')
}

/**
 * Format a value for CSV output.
 */
function formatCSVValue(value: unknown): string {
  if (value === null || value === undefined) return ''

  if (typeof value === 'boolean') return String(value)

  if (typeof value === 'number') return String(value)

  if (typeof value === 'object') {
    // Convert to single-quoted JSON
    return JSON.stringify(value).replace(/"/g, "'")
  }

  const str = String(value)

  // Quote if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`
  }

  return str
}

// ============================================================================
// CSV FILE LOADERS
// ============================================================================

/**
 * Load a CSV file and parse it into typed objects.
 */
async function loadCSVFile<T extends Record<string, unknown>>(relativePath: string): Promise<T[]> {
  try {
    const absolutePath = await resolveSharePath(relativePath)

    const content = await fs.readFile(absolutePath, 'utf-8')
    return parseCSV<T>(content)
  } catch (error) {
    console.warn(`[ShareLoader] Failed to load CSV ${relativePath}:`, error)
    return []
  }
}

/**
 * Save data to a CSV file.
 */
async function saveCSVFile<T extends Record<string, unknown>>(
  relativePath: string,
  data: T[],
  headers?: string[]
): Promise<boolean> {
  try {
    const absolutePath = await resolveSharePath(relativePath)

    const content = toCSV(data, headers)
    await fs.writeFile(absolutePath, content, 'utf-8')
    return true
  } catch (error) {
    console.error(`[ShareLoader] Failed to save CSV ${relativePath}:`, error)
    return false
  }
}

/**
 * Append a single record to a CSV file.
 */
async function appendCSVFile<T extends Record<string, unknown>>(
  relativePath: string,
  record: T,
  headers?: string[]
): Promise<boolean> {
  try {
    const absolutePath = await resolveSharePath(relativePath)

    const keys = headers || Object.keys(record)
    const values = keys.map(key => formatCSVValue(record[key]))
    const line = values.join(',') + '\n'

    await fs.appendFile(absolutePath, line, 'utf-8')
    return true
  } catch (error) {
    console.error(`[ShareLoader] Failed to append CSV ${relativePath}:`, error)
    return false
  }
}

// ============================================================================
// TYPED CSV LOADERS & EXPORTERS
// ============================================================================

import type { UserIdentity, UserSession, TimestampEvent, UserRole as SessionUserRole } from '@/types/d380-user-session'
import type { AssignmentRecord } from '@/types/d380-assignment'
import type { AssignmentStageId } from '@/types/d380-assignment-stages'
import type { SwsDiscrepancyEntry } from '@/types/d380-sws'
import type { LwcType } from '@/lib/workbook/types'

// User CSV row type
interface UserCSVRow {
  badge: string
  pin_hash: string
  legal_name: string
  preferred_name: string
  initials: string
  role: SessionUserRole
  avatar_path: string | null
  primary_lwc: LwcType
  current_shift: string
  email: string | null
  phone: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Session CSV row type
interface SessionCSVRow {
  session_id: string
  badge: string
  status: 'active' | 'idle' | 'expired' | 'locked'
  execution_mode: 'PRINT_MANUAL' | 'TABLET_INTERACTIVE'
  current_lwc: LwcType
  current_work_area_id: string | null
  started_at: string
  last_activity_at: string
  expires_at: string
  device_type: 'desktop' | 'tablet' | 'mobile'
  touch_capable: boolean
}

// Assignment CSV row type
interface AssignmentCSVRow {
  assignment_id: string
  project_id: string
  source_sheet_slug: string
  source_sheet_name: string
  row_count: number
  sheet_kind: 'assignment' | 'reference' | 'other'
  detected_sws_type: string
  detected_confidence: 'LOW' | 'MEDIUM' | 'HIGH'
  selected_sws_type: string
  selected_stage: AssignmentStageId
  readiness_state: 'READY' | 'NOT_READY' | 'BLOCKED'
  is_late: boolean
  requires_wire_sws: boolean
  requires_cross_wire_sws: boolean
  created_at: string
  updated_at: string
}

// Event CSV row type
interface EventCSVRow {
  event_id: string
  event_type: string
  timestamp: string
  actor_badge: string
  actor_name: string
  actor_role: SessionUserRole
  session_id: string
  assignment_id: string | null
  work_area_id: string | null
  target_badge: string | null
  previous_value: string | null
  new_value: string | null
  metadata: Record<string, unknown>
}

// Work area CSV row type
interface WorkAreaCSVRow {
  work_area_id: string
  name: string
  lwc_type: LwcType
  location_code: string
  capacity: number
  is_active: boolean
  current_assignment_id: string | null
  assigned_badge: string | null
  description: string
}

// SWS Progress CSV row type
interface SwsProgressCSVRow {
  progress_id: string
  assignment_id: string
  template_id: string
  execution_mode: 'PRINT_MANUAL' | 'TABLET_INTERACTIVE'
  section_id: string
  step_id: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETE' | 'BLOCKED'
  completed_by_badge: string | null
  completed_by_name: string | null
  completed_at: string | null
  auditor_badge: string | null
  auditor_name: string | null
  auditor_at: string | null
  not_applicable: boolean
  discrepancy_count: number
  created_at: string
  updated_at: string
}

// Discrepancy CSV row type
interface DiscrepancyCSVRow {
  discrepancy_id: string
  assignment_id: string
  code: string
  description: string
  count: number
  section_id: string
  reported_by_badge: string
  reported_by_name: string
  reported_at: string
  resolved_by_badge: string | null
  resolved_by_name: string | null
  resolved_at: string | null
  mrca_number: string | null
  notes: string
}

// LOADERS

export async function loadUsersFromCSV(): Promise<UserCSVRow[]> {
  return loadCSVFile<UserCSVRow>('/Share/users/users.csv')
}

export async function loadSessionsFromCSV(): Promise<SessionCSVRow[]> {
  return loadCSVFile<SessionCSVRow>('/Share/sessions/sessions.csv')
}

export async function loadAssignmentsFromCSV(): Promise<AssignmentCSVRow[]> {
  return loadCSVFile<AssignmentCSVRow>('/Share/assignments/assignments.csv')
}

export async function loadEventsFromCSV(): Promise<EventCSVRow[]> {
  return loadCSVFile<EventCSVRow>('/Share/events/timestamp_events.csv')
}

export async function loadWorkAreasFromCSV(): Promise<WorkAreaCSVRow[]> {
  return loadCSVFile<WorkAreaCSVRow>('/Share/work-areas/work_areas.csv')
}

export async function loadSwsProgressFromCSV(): Promise<SwsProgressCSVRow[]> {
  return loadCSVFile<SwsProgressCSVRow>('/Share/sws/sws_progress.csv')
}

export async function loadDiscrepanciesFromCSV(): Promise<DiscrepancyCSVRow[]> {
  return loadCSVFile<DiscrepancyCSVRow>('/Share/discrepancies/discrepancies.csv')
}

// EXPORTERS

export async function exportUsersToCSV(users: UserCSVRow[]): Promise<boolean> {
  const headers = [
    'badge', 'pin_hash', 'legal_name', 'preferred_name', 'initials', 'role',
    'avatar_path', 'primary_lwc', 'current_shift', 'email', 'phone',
    'is_active', 'created_at', 'updated_at'
  ]
  return saveCSVFile('/Share/users/users.csv', users, headers)
}

export async function exportSessionsToCSV(sessions: SessionCSVRow[]): Promise<boolean> {
  const headers = [
    'session_id', 'badge', 'status', 'execution_mode', 'current_lwc',
    'current_work_area_id', 'started_at', 'last_activity_at', 'expires_at',
    'device_type', 'touch_capable'
  ]
  return saveCSVFile('/Share/sessions/sessions.csv', sessions, headers)
}

export async function exportAssignmentsToCSV(assignments: AssignmentCSVRow[]): Promise<boolean> {
  const headers = [
    'assignment_id', 'project_id', 'source_sheet_slug', 'source_sheet_name',
    'row_count', 'sheet_kind', 'detected_sws_type', 'detected_confidence',
    'selected_sws_type', 'selected_stage', 'readiness_state', 'is_late',
    'requires_wire_sws', 'requires_cross_wire_sws', 'created_at', 'updated_at'
  ]
  return saveCSVFile('/Share/assignments/assignments.csv', assignments, headers)
}

export async function exportWorkAreasToCSV(workAreas: WorkAreaCSVRow[]): Promise<boolean> {
  const headers = [
    'work_area_id', 'name', 'lwc_type', 'location_code', 'capacity',
    'is_active', 'current_assignment_id', 'assigned_badge', 'description'
  ]
  return saveCSVFile('/Share/work-areas/work_areas.csv', workAreas, headers)
}

export async function exportSwsProgressToCSV(progress: SwsProgressCSVRow[]): Promise<boolean> {
  const headers = [
    'progress_id', 'assignment_id', 'template_id', 'execution_mode',
    'section_id', 'step_id', 'status', 'completed_by_badge', 'completed_by_name',
    'completed_at', 'auditor_badge', 'auditor_name', 'auditor_at',
    'not_applicable', 'discrepancy_count', 'created_at', 'updated_at'
  ]
  return saveCSVFile('/Share/sws/sws_progress.csv', progress, headers)
}

export async function exportDiscrepanciesToCSV(discrepancies: DiscrepancyCSVRow[]): Promise<boolean> {
  const headers = [
    'discrepancy_id', 'assignment_id', 'code', 'description', 'count',
    'section_id', 'reported_by_badge', 'reported_by_name', 'reported_at',
    'resolved_by_badge', 'resolved_by_name', 'resolved_at', 'mrca_number', 'notes'
  ]
  return saveCSVFile('/Share/discrepancies/discrepancies.csv', discrepancies, headers)
}

// APPEND-ONLY EVENT LOG

export async function appendEventToCSV(event: EventCSVRow): Promise<boolean> {
  const headers = [
    'event_id', 'event_type', 'timestamp', 'actor_badge', 'actor_name',
    'actor_role', 'session_id', 'assignment_id', 'work_area_id',
    'target_badge', 'previous_value', 'new_value', 'metadata'
  ]
  return appendCSVFile('/Share/events/timestamp_events.csv', event, headers)
}

// ============================================================================
// INITIALIZATION
// ============================================================================

export interface ShareDataState {
  users: UserCSVRow[]
  sessions: SessionCSVRow[]
  assignments: AssignmentCSVRow[]
  events: EventCSVRow[]
  workAreas: WorkAreaCSVRow[]
  swsProgress: SwsProgressCSVRow[]
  discrepancies: DiscrepancyCSVRow[]
}

/**
 * Initialize all data from Share directory CSV files.
 * Call this on app startup.
 */
export async function initializeDataFromShare(): Promise<ShareDataState> {
  const [users, sessions, assignments, events, workAreas, swsProgress, discrepancies] = await Promise.all([
    loadUsersFromCSV(),
    loadSessionsFromCSV(),
    loadAssignmentsFromCSV(),
    loadEventsFromCSV(),
    loadWorkAreasFromCSV(),
    loadSwsProgressFromCSV(),
    loadDiscrepanciesFromCSV(),
  ])

  return {
    users,
    sessions,
    assignments,
    events,
    workAreas,
    swsProgress,
    discrepancies,
  }
}

// Re-export CSV row types for external use
export type {
  UserCSVRow,
  SessionCSVRow,
  AssignmentCSVRow,
  EventCSVRow,
  WorkAreaCSVRow,
  SwsProgressCSVRow,
  DiscrepancyCSVRow,
}
