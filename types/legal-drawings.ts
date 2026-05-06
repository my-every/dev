export interface LegalRevisionArtifactStatus {
  workbookPresent: boolean
  greenChangesWorkbookPresent: boolean
  layoutPresent: boolean
  uploadPropsBuilt: boolean
  manifestBuilt: boolean
  layoutPagesBuilt: boolean
  devicePartNumbersBuilt: boolean
  sheetSchemasBuilt: boolean
  greenChangesSchemaBuilt: boolean
  wireListPrintSchemaPrepared: boolean
  brandListSchemaPrepared: boolean
}

export interface LegalRevisionRecord {
  pdNumber: string
  revision: string
  projectNameHint?: string
  workbookFileName?: string | null
  workbookRelativePath?: string | null
  workbookUpdatedAt?: string | null
  greenChangesWorkbookFileName?: string | null
  greenChangesWorkbookRelativePath?: string | null
  greenChangesWorkbookUpdatedAt?: string | null
  layoutFileName?: string | null
  layoutRelativePath?: string | null
  layoutUpdatedAt?: string | null
  sourceFingerprint?: string | null
  artifacts: LegalRevisionArtifactStatus
  generatedAt?: string | null
}

export interface LegalProjectRecord {
  pdNumber: string
  folderName: string
  latestRevision: string | null
  projectNameHint?: string
  projectName?: string | null
  dueDate?: string | null
  dueMonth?: string | null
  planConlayDate?: string | null
  planConassyDate?: string | null
  shipDate?: string | null
  deptTargetDate?: string | null
  lwcType?: string | null
  color?: string | null
  daysLate?: number | null
  hasWorkbook: boolean
  hasGreenChangesWorkbook?: boolean
  hasLayout: boolean
  latestWorkbookUpdatedAt?: string | null
  latestGreenChangesWorkbookUpdatedAt?: string | null
  latestLayoutUpdatedAt?: string | null
  revisions: LegalRevisionRecord[]
}

export interface LegalDrawingsLibraryManifest {
  generatedAt: string
  sourceRoot?: string | null
  projects: LegalProjectRecord[]
}

export interface LegalSyncProjectResult {
  pdNumber: string
  latestRevision: string | null
  createdRevision: boolean
  updatedLatestRoot: boolean
  copiedWorkbook: boolean
  copiedLayout: boolean
}

export interface LegalDrawingsSyncResult {
  syncedAt: string
  sourceRoot: string
  projectCount: number
  projects: LegalSyncProjectResult[]
}

export interface CreateProjectFromLegalSourceInput {
  pdNumber: string
  revision: string
  name: string
  unitNumber?: string | null
  lwcType?: string | null
  dueDate?: string | null
  planConlayDate?: string | null
  planConassyDate?: string | null
  shipDate?: string | null
  color?: string | null
  actorBadge?: string | null
  actorShift?: string | null
}
