/**
 * D380 Service Contracts
 * 
 * Central service interfaces for filesystem-driven data access.
 * These contracts define the API surface that all service providers must implement.
 * 
 * Architecture:
 * - Contracts define async interfaces for all data operations
 * - Providers implement these contracts for different environments:
 *   - SimulatedShare380Provider: Browser dev mode (default)
 *   - ElectronShare380Provider: Future Electron runtime
 * - View models consume services, never raw files or mock data directly
 * - Routes call view models, never services directly
 * 
 * Root folder model:
 * Share/380/
 * ├── Config/           - Global app configuration
 * ├── Projects/         - Active project folders
 * ├── Teams/            - Team roster files
 * ├── Users/            - User profile folders
 * ├── WorkAreas/        - Workstation configuration
 * ├── State/            - Runtime state snapshots
 * ├── Exports/          - Export bundles
 * └── CompletedProjects/- Archived projects
 */

// Re-export all service contracts
export * from './workspace-service'
export * from './project-discovery-service'
export * from './project-details-v2-service'
export * from './team-roster-service'
export * from './user-profile-service'
export * from './work-area-service'
export * from './assignment-state-service'
export * from './stage-state-service'
export * from './file-catalog-service'
export * from './notification-service'
export * from './leaderboard-service'
export * from './session-service'

// Common types used across services
export interface ServiceResult<T> {
  data: T | null
  error: string | null
  source: 'mock' | 'share' | 'electron'
  timestamp: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface FileReference {
  path: string
  exists: boolean
  modifiedAt: string | null
  sizeBytes: number | null
  mimeType: string | null
}

export type ShiftId = '1st' | '2nd'
export type LwcSectionId = 'ONSKID' | 'OFFSKID' | 'NEW/FLEX' | 'OFFICE'
