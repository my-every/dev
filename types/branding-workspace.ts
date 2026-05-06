export type BrandingTaskStatus = 'pending' | 'in_progress' | 'complete'

export interface BrandingSheetTask {
  sheetSlug: string
  sheetName: string
  matchedLayoutPage?: number
  matchedLayoutTitle?: string
  layoutMatchStatus: BrandingTaskStatus
  wireListReviewStatus: BrandingTaskStatus
  wireLengthAdjustStatus: BrandingTaskStatus
  brandedStatus: BrandingTaskStatus
  notes?: string
}

export interface BrandingWorkspaceState {
  projectId: string
  projectName: string
  pdNumber?: string
  generatedAt: string
  updatedAt: string
  status: 'pending' | 'in_progress' | 'complete'
  combinedExportFileName?: string
  combinedExportRelativePath?: string
  tasks: BrandingSheetTask[]
}

export interface BrandingWorkspacePatch {
  sheetSlug: string
  layoutMatchStatus?: BrandingTaskStatus
  wireListReviewStatus?: BrandingTaskStatus
  wireLengthAdjustStatus?: BrandingTaskStatus
  brandedStatus?: BrandingTaskStatus
  notes?: string
}
