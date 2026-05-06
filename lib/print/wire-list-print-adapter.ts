/**
 * Wire List Print Adapter
 * 
 * Implements the PrintAdapter interface for wire list documents.
 */

import type { 
  PrintAdapter, 
  PrintDocumentMetadata, 
  PrintSection, 
  PrintConfig,
  DEFAULT_PRINT_CONFIG 
} from './types'
import type { ProjectModel, ProjectSheetSummary } from '@/lib/workbook/types'

/**
 * Wire list print data
 */
export interface WireListPrintData {
  project: ProjectModel
  sheet: ProjectSheetSummary
  sheetSlug: string
}

/**
 * Wire list print configuration
 */
export interface WireListPrintConfig {
  sortMode: 'default' | 'gauge' | 'location' | 'custom'
  showJumperSections: boolean
  showExternalSections: boolean
  showCableSections: boolean
  groupByIdentity: boolean
}

/**
 * Default wire list print configuration
 */
export const DEFAULT_WIRE_LIST_PRINT_CONFIG: WireListPrintConfig = {
  sortMode: 'default',
  showJumperSections: true,
  showExternalSections: true,
  showCableSections: true,
  groupByIdentity: true,
}

/**
 * Wire List Print Adapter
 */
export const wireListPrintAdapter: PrintAdapter<WireListPrintData, WireListPrintConfig> = {
  adapterId: 'wire-list',
  adapterName: 'Wire List',
  documentType: 'WIRE_LIST',
  
  buildMetadata(data: WireListPrintData): PrintDocumentMetadata {
    return {
      projectId: data.project.id,
      projectName: data.project.name,
      documentTitle: `Wire List - ${data.sheet.name}`,
      documentType: 'WIRE_LIST',
      createdAt: new Date().toISOString(),
      revision: '1.0',
    }
  },
  
  buildSections(data: WireListPrintData, config?: WireListPrintConfig): PrintSection[] {
    const cfg = config || DEFAULT_WIRE_LIST_PRINT_CONFIG
    const sections: PrintSection[] = []
    let order = 0
    
    // Metadata section
    sections.push({
      id: 'metadata',
      title: 'Document Information',
      type: 'metadata',
      visible: true,
      order: order++,
    })
    
    // Main wire list content
    sections.push({
      id: 'wire-list',
      title: 'Wire List',
      type: 'content',
      visible: true,
      order: order++,
    })
    
    // Jumper sections
    if (cfg.showJumperSections) {
      sections.push({
        id: 'jumpers',
        title: 'Jumpers & Special Connections',
        type: 'content',
        visible: true,
        order: order++,
        pageBreakBefore: true,
      })
    }
    
    // External sections
    if (cfg.showExternalSections) {
      sections.push({
        id: 'external',
        title: 'External Connections',
        type: 'content',
        visible: true,
        order: order++,
      })
    }
    
    // Cable sections
    if (cfg.showCableSections) {
      sections.push({
        id: 'cables',
        title: 'Cables',
        type: 'content',
        visible: true,
        order: order++,
      })
    }
    
    // Signatures section
    sections.push({
      id: 'signatures',
      title: 'Sign-off',
      type: 'signatures',
      visible: true,
      order: order++,
      pageBreakBefore: true,
    })
    
    return sections
  },
  
  getDefaultConfig(): PrintConfig {
    return {
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
  },
  
  validateData(data: WireListPrintData): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    
    if (!data.project) {
      errors.push('Project data is required')
    }
    
    if (!data.sheet) {
      errors.push('Sheet data is required')
    }
    
    return {
      valid: errors.length === 0,
      errors,
    }
  },
}
