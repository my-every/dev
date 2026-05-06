/**
 * Shared Print Architecture Types
 * 
 * Defines the contract for print adapters and shared print components.
 * Enables consistent printing across wire lists, SWS worksheets, and other printables.
 */

// ============================================================================
// Core Print Types
// ============================================================================

/**
 * Print document metadata
 */
export interface PrintDocumentMetadata {
  projectId: string
  projectName: string
  documentTitle: string
  documentType: PrintDocumentType
  createdAt: string
  createdBy?: string
  revision?: string
  unit?: string
  panel?: string
  pdNumber?: string
}

/**
 * Available print document types
 */
export type PrintDocumentType =
  | 'WIRE_LIST'
  | 'SWS_WORKSHEET'
  | 'BUILD_UP_CHECKLIST'
  | 'WIRING_CHECKLIST'
  | 'CROSS_WIRE_CHECKLIST'
  | 'BOX_BUILD_CHECKLIST'
  | 'TEST_CHECKLIST'
  | 'COVER_PAGE'
  | 'TABLE_OF_CONTENTS'
  | 'CUSTOM'

/**
 * Print page size options
 */
export type PrintPageSize = 'letter' | 'legal' | 'a4' | 'tabloid'

/**
 * Print orientation
 */
export type PrintOrientation = 'portrait' | 'landscape'

/**
 * Print configuration
 */
export interface PrintConfig {
  pageSize: PrintPageSize
  orientation: PrintOrientation
  margins: {
    top: number
    right: number
    bottom: number
    left: number
  }
  showCoverPage: boolean
  showTableOfContents: boolean
  showPageNumbers: boolean
  showFooter: boolean
  footerText?: string
  confidentialityLevel?: 'green' | 'yellow' | 'red'
}

/**
 * Default print configuration
 */
export const DEFAULT_PRINT_CONFIG: PrintConfig = {
  pageSize: 'letter',
  orientation: 'portrait',
  margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
  showCoverPage: false,
  showTableOfContents: false,
  showPageNumbers: true,
  showFooter: true,
  footerText: 'Caterpillar: Confidential Green',
  confidentialityLevel: 'green',
}

// ============================================================================
// Print Section Types
// ============================================================================

/**
 * A section within a print document
 */
export interface PrintSection {
  id: string
  title: string
  type: PrintSectionType
  visible: boolean
  order: number
  pageBreakBefore?: boolean
  pageBreakAfter?: boolean
}

/**
 * Available section types
 */
export type PrintSectionType =
  | 'cover'
  | 'toc'
  | 'metadata'
  | 'content'
  | 'checklist'
  | 'signatures'
  | 'comments'
  | 'discrepancy'
  | 'custom'

// ============================================================================
// Print Adapter Contract
// ============================================================================

/**
 * Print adapter interface - implemented by each printable type
 */
export interface PrintAdapter<TData = unknown, TConfig = unknown> {
  /** Unique identifier for this adapter */
  adapterId: string
  
  /** Human-readable name */
  adapterName: string
  
  /** Document type this adapter produces */
  documentType: PrintDocumentType
  
  /** Build document metadata from data */
  buildMetadata(data: TData): PrintDocumentMetadata
  
  /** Build sections from data */
  buildSections(data: TData, config?: TConfig): PrintSection[]
  
  /** Get default configuration */
  getDefaultConfig(): PrintConfig
  
  /** Validate data before printing */
  validateData(data: TData): { valid: boolean; errors: string[] }
}

// ============================================================================
// Cover Page Types
// ============================================================================

/**
 * Cover page data
 */
export interface CoverPageData {
  projectName: string
  documentTitle: string
  documentType: string
  revision?: string
  unit?: string
  panel?: string
  pdNumber?: string
  preparedBy?: string
  preparedDate?: string
  approvedBy?: string
  approvedDate?: string
  logoUrl?: string
  companyName?: string
  confidentialityLevel?: 'green' | 'yellow' | 'red'
}

// ============================================================================
// Table of Contents Types
// ============================================================================

/**
 * TOC entry
 */
export interface TocEntry {
  title: string
  pageNumber: number
  level: number
  sectionId?: string
}

/**
 * Table of contents data
 */
export interface TableOfContentsData {
  title: string
  entries: TocEntry[]
  generatedAt: string
}

// ============================================================================
// Signature/Sign-off Types
// ============================================================================

/**
 * Signature entry for print documents
 */
export interface PrintSignatureEntry {
  id: string
  role: string
  name?: string
  badgeNumber?: string
  date?: string
  time?: string
  signature?: string
}

/**
 * Print sign-off section configuration
 */
export interface PrintSignoffConfig {
  roles: string[]
  requireAllSignatures: boolean
  includeDate: boolean
  includeTime: boolean
  includeBadgeNumber: boolean
}

// ============================================================================
// Override State Types
// ============================================================================

/**
 * Print metadata overrides (for sidebar editing)
 */
export interface PrintMetadataOverrides {
  projectName?: string
  documentTitle?: string
  revision?: string
  unit?: string
  panel?: string
  pdNumber?: string
  date?: string
  customFields?: Record<string, string>
}

/**
 * Print override state
 */
export interface PrintOverrideState {
  metadata: PrintMetadataOverrides
  sectionVisibility: Record<string, boolean>
  sectionOrder: string[]
}
