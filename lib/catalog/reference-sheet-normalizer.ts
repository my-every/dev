/**
 * Reference Sheet Normalizer
 * 
 * Normalizes data from reference sheets (Part Number List, Cable Part Numbers,
 * Blue Labels, White Labels, Heat Shrink Labels, Panel Errors) into a unified
 * format for catalog enrichment.
 */

import type { ParsedWorkbookSheet, ParsedSheetRow } from '@/lib/workbook/types'
import type {
  ReferenceSheetType,
  NormalizedReference,
  ProjectReferenceData,
} from '@/types/d380-catalog'

// ============================================================================
// SHEET TYPE DETECTION
// ============================================================================

/**
 * Detect the reference sheet type from sheet name.
 */
export function detectReferenceSheetType(sheetName: string): ReferenceSheetType {
  const normalized = sheetName.toLowerCase().trim()
  
  if (normalized.includes('part number list') || normalized === 'pn list' || normalized === 'parts list') {
    return 'PART_NUMBER_LIST'
  }
  if (normalized.includes('cable part') || normalized.includes('cable pn')) {
    return 'CABLE_PART_NUMBERS'
  }
  if (normalized.includes('blue label')) {
    return 'BLUE_LABELS'
  }
  if (normalized.includes('white label')) {
    return 'WHITE_LABELS'
  }
  if (normalized.includes('heat shrink') || normalized.includes('heatshrink')) {
    return 'HEAT_SHRINK_LABELS'
  }
  if (normalized.includes('panel error') || normalized === 'errors') {
    return 'PANEL_ERRORS'
  }
  
  return 'UNKNOWN'
}

// ============================================================================
// COLUMN DETECTION
// ============================================================================

/**
 * Column patterns for different reference sheet types.
 */
const COLUMN_PATTERNS = {
  partNumber: [
    /^part\s*(?:no\.?|number|#)$/i,
    /^p\/n$/i,
    /^pn$/i,
    /^catalog\s*(?:no\.?|number|#)?$/i,
    /^model$/i,
    /^item$/i,
  ],
  deviceId: [
    /^device\s*(?:id)?$/i,
    /^tag$/i,
    /^equipment$/i,
    /^component$/i,
  ],
  wireId: [
    /^wire\s*(?:id|no\.?|number|#)?$/i,
    /^cable\s*(?:id|no\.?|number|#)?$/i,
    /^conductor$/i,
  ],
  description: [
    /^description$/i,
    /^desc\.?$/i,
    /^name$/i,
    /^label$/i,
  ],
  quantity: [
    /^qty\.?$/i,
    /^quantity$/i,
    /^count$/i,
    /^#$/,
  ],
  labelText: [
    /^label\s*(?:text)?$/i,
    /^text$/i,
    /^marking$/i,
    /^print$/i,
  ],
  location: [
    /^location$/i,
    /^loc\.?$/i,
    /^panel$/i,
    /^zone$/i,
  ],
  errorMessage: [
    /^error$/i,
    /^message$/i,
    /^issue$/i,
    /^problem$/i,
  ],
}

/**
 * Find a column matching any of the patterns.
 */
function findColumn(headers: string[], patterns: RegExp[]): string | null {
  for (const header of headers) {
    const trimmed = (header || '').trim()
    for (const pattern of patterns) {
      if (pattern.test(trimmed)) {
        return header
      }
    }
  }
  return null
}

/**
 * Detect all columns in a reference sheet.
 */
function detectColumns(headers: string[]): {
  partNumber: string | null
  deviceId: string | null
  wireId: string | null
  description: string | null
  quantity: string | null
  labelText: string | null
  location: string | null
  errorMessage: string | null
} {
  return {
    partNumber: findColumn(headers, COLUMN_PATTERNS.partNumber),
    deviceId: findColumn(headers, COLUMN_PATTERNS.deviceId),
    wireId: findColumn(headers, COLUMN_PATTERNS.wireId),
    description: findColumn(headers, COLUMN_PATTERNS.description),
    quantity: findColumn(headers, COLUMN_PATTERNS.quantity),
    labelText: findColumn(headers, COLUMN_PATTERNS.labelText),
    location: findColumn(headers, COLUMN_PATTERNS.location),
    errorMessage: findColumn(headers, COLUMN_PATTERNS.errorMessage),
  }
}

// ============================================================================
// SHEET NORMALIZATION
// ============================================================================

/**
 * Normalize a Part Number List sheet.
 */
export function normalizePartNumberList(
  sheet: ParsedWorkbookSheet,
  sheetName: string
): NormalizedReference[] {
  const references: NormalizedReference[] = []
  const columns = detectColumns(sheet.headers)
  
  if (!columns.partNumber && !columns.deviceId) {
    // Cannot normalize without at least one key column
    return references
  }
  
  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]
    
    const partNumber = columns.partNumber ? String(row[columns.partNumber] || '').trim() : undefined
    const deviceId = columns.deviceId ? String(row[columns.deviceId] || '').trim() : undefined
    const description = columns.description ? String(row[columns.description] || '').trim() : undefined
    const quantity = columns.quantity ? parseQuantity(row[columns.quantity]) : undefined
    
    // Skip empty rows
    if (!partNumber && !deviceId) continue
    
    references.push({
      type: 'PART_NUMBER_LIST',
      partNumber,
      deviceId,
      description,
      quantity,
      sourceRow: i + 2, // +2 for header row and 0-indexing
      sourceSheet: sheetName,
    })
  }
  
  return references
}

/**
 * Normalize a Cable Part Numbers sheet.
 */
export function normalizeCablePartNumbers(
  sheet: ParsedWorkbookSheet,
  sheetName: string
): NormalizedReference[] {
  const references: NormalizedReference[] = []
  const columns = detectColumns(sheet.headers)
  
  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]
    
    const partNumber = columns.partNumber ? String(row[columns.partNumber] || '').trim() : undefined
    const deviceId = columns.deviceId ? String(row[columns.deviceId] || '').trim() : undefined
    const wireId = columns.wireId
      ? String(row[columns.wireId] || '').trim()
      : deviceId
    const description = columns.description ? String(row[columns.description] || '').trim() : undefined
    const quantity = columns.quantity ? parseQuantity(row[columns.quantity]) : undefined
    
    // Skip empty rows
    if (!partNumber && !wireId) continue
    
    references.push({
      type: 'CABLE_PART_NUMBERS',
      partNumber,
      deviceId,
      wireId,
      description,
      quantity,
      sourceRow: i + 2,
      sourceSheet: sheetName,
    })
  }
  
  return references
}

/**
 * Normalize a Labels sheet (Blue, White, or Heat Shrink).
 */
export function normalizeLabelsSheet(
  sheet: ParsedWorkbookSheet,
  sheetName: string,
  labelType: 'BLUE_LABELS' | 'WHITE_LABELS' | 'HEAT_SHRINK_LABELS'
): NormalizedReference[] {
  const references: NormalizedReference[] = []
  const columns = detectColumns(sheet.headers)
  
  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]
    
    const deviceId = columns.deviceId ? String(row[columns.deviceId] || '').trim() : undefined
    const wireId = columns.wireId ? String(row[columns.wireId] || '').trim() : undefined
    const labelText = columns.labelText 
      ? String(row[columns.labelText] || '').trim() 
      : columns.description 
        ? String(row[columns.description] || '').trim()
        : undefined
    const quantity = columns.quantity ? parseQuantity(row[columns.quantity]) : undefined
    
    // Skip empty rows
    if (!deviceId && !wireId && !labelText) continue
    
    references.push({
      type: labelType,
      deviceId,
      wireId,
      labelText,
      quantity,
      sourceRow: i + 2,
      sourceSheet: sheetName,
    })
  }
  
  return references
}

/**
 * Normalize a Panel Errors sheet.
 */
export function normalizePanelErrors(
  sheet: ParsedWorkbookSheet,
  sheetName: string
): NormalizedReference[] {
  const references: NormalizedReference[] = []
  const columns = detectColumns(sheet.headers)
  
  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]
    
    const deviceId = columns.deviceId ? String(row[columns.deviceId] || '').trim() : undefined
    const wireId = columns.wireId ? String(row[columns.wireId] || '').trim() : undefined
    const errorMessage = columns.errorMessage 
      ? String(row[columns.errorMessage] || '').trim()
      : columns.description
        ? String(row[columns.description] || '').trim()
        : undefined
    
    // Skip empty rows
    if (!errorMessage) continue
    
    references.push({
      type: 'PANEL_ERRORS',
      deviceId,
      wireId,
      errorMessage,
      sourceRow: i + 2,
      sourceSheet: sheetName,
    })
  }
  
  return references
}

/**
 * Parse quantity from various formats.
 */
function parseQuantity(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined
  
  const numValue = typeof value === 'number' 
    ? value 
    : parseFloat(String(value).replace(/[^\d.-]/g, ''))
  
  return isNaN(numValue) ? undefined : Math.abs(Math.floor(numValue))
}

// ============================================================================
// REFERENCE SHEET DISPATCHER
// ============================================================================

/**
 * Normalize any reference sheet based on detected type.
 */
export function normalizeReferenceSheet(
  sheet: ParsedWorkbookSheet,
  sheetName: string
): NormalizedReference[] {
  const type = detectReferenceSheetType(sheetName)
  
  switch (type) {
    case 'PART_NUMBER_LIST':
      return normalizePartNumberList(sheet, sheetName)
    case 'CABLE_PART_NUMBERS':
      return normalizeCablePartNumbers(sheet, sheetName)
    case 'BLUE_LABELS':
      return normalizeLabelsSheet(sheet, sheetName, 'BLUE_LABELS')
    case 'WHITE_LABELS':
      return normalizeLabelsSheet(sheet, sheetName, 'WHITE_LABELS')
    case 'HEAT_SHRINK_LABELS':
      return normalizeLabelsSheet(sheet, sheetName, 'HEAT_SHRINK_LABELS')
    case 'PANEL_ERRORS':
      return normalizePanelErrors(sheet, sheetName)
    default:
      return []
  }
}

// ============================================================================
// PROJECT REFERENCE DATA BUILDER
// ============================================================================

/**
 * Build complete project reference data from all reference sheets.
 */
export function buildProjectReferenceData(
  projectId: string,
  sheets: { name: string; sheet: ParsedWorkbookSheet }[]
): ProjectReferenceData {
  const data: ProjectReferenceData = {
    projectId,
    partNumbers: [],
    cablePartNumbers: [],
    blueLabels: [],
    whiteLabels: [],
    heatShrinkLabels: [],
    panelErrors: [],
    builtAt: new Date().toISOString(),
    sourceSheets: [],
  }
  
  for (const { name, sheet } of sheets) {
    const type = detectReferenceSheetType(name)
    if (type === 'UNKNOWN') continue
    
    data.sourceSheets.push(name)
    const references = normalizeReferenceSheet(sheet, name)
    
    switch (type) {
      case 'PART_NUMBER_LIST':
        data.partNumbers.push(...references)
        break
      case 'CABLE_PART_NUMBERS':
        data.cablePartNumbers.push(...references)
        break
      case 'BLUE_LABELS':
        data.blueLabels.push(...references)
        break
      case 'WHITE_LABELS':
        data.whiteLabels.push(...references)
        break
      case 'HEAT_SHRINK_LABELS':
        data.heatShrinkLabels.push(...references)
        break
      case 'PANEL_ERRORS':
        data.panelErrors.push(...references)
        break
    }
  }
  
  return data
}

// ============================================================================
// REFERENCE DATA LOOKUP HELPERS
// ============================================================================

/**
 * Find references for a specific device ID.
 */
export function findReferencesForDevice(
  data: ProjectReferenceData,
  deviceId: string
): {
  partNumber?: NormalizedReference
  labels: NormalizedReference[]
  errors: NormalizedReference[]
} {
  const normalizedId = deviceId.toUpperCase().trim()
  
  const partNumber = data.partNumbers.find(
    ref => ref.deviceId?.toUpperCase().trim() === normalizedId
  )
  
  const labels = [
    ...data.blueLabels.filter(ref => ref.deviceId?.toUpperCase().trim() === normalizedId),
    ...data.whiteLabels.filter(ref => ref.deviceId?.toUpperCase().trim() === normalizedId),
    ...data.heatShrinkLabels.filter(ref => ref.deviceId?.toUpperCase().trim() === normalizedId),
  ]
  
  const errors = data.panelErrors.filter(
    ref => ref.deviceId?.toUpperCase().trim() === normalizedId
  )
  
  return { partNumber, labels, errors }
}

/**
 * Find references for a specific wire ID.
 */
export function findReferencesForWire(
  data: ProjectReferenceData,
  wireId: string
): {
  cablePartNumber?: NormalizedReference
  labels: NormalizedReference[]
  errors: NormalizedReference[]
} {
  const normalizedId = wireId.toUpperCase().trim()
  
  const cablePartNumber = data.cablePartNumbers.find(
    ref => ref.wireId?.toUpperCase().trim() === normalizedId
  )
  
  const labels = [
    ...data.blueLabels.filter(ref => ref.wireId?.toUpperCase().trim() === normalizedId),
    ...data.whiteLabels.filter(ref => ref.wireId?.toUpperCase().trim() === normalizedId),
    ...data.heatShrinkLabels.filter(ref => ref.wireId?.toUpperCase().trim() === normalizedId),
  ]
  
  const errors = data.panelErrors.filter(
    ref => ref.wireId?.toUpperCase().trim() === normalizedId
  )
  
  return { cablePartNumber, labels, errors }
}

/**
 * Get reference data statistics.
 */
export function getReferenceDataStats(data: ProjectReferenceData): {
  totalPartNumbers: number
  totalCablePartNumbers: number
  totalBlueLabels: number
  totalWhiteLabels: number
  totalHeatShrinkLabels: number
  totalPanelErrors: number
  totalReferences: number
  sourceSheetCount: number
} {
  return {
    totalPartNumbers: data.partNumbers.length,
    totalCablePartNumbers: data.cablePartNumbers.length,
    totalBlueLabels: data.blueLabels.length,
    totalWhiteLabels: data.whiteLabels.length,
    totalHeatShrinkLabels: data.heatShrinkLabels.length,
    totalPanelErrors: data.panelErrors.length,
    totalReferences: 
      data.partNumbers.length +
      data.cablePartNumbers.length +
      data.blueLabels.length +
      data.whiteLabels.length +
      data.heatShrinkLabels.length +
      data.panelErrors.length,
    sourceSheetCount: data.sourceSheets.length,
  }
}
