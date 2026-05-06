/**
 * Assignment Component Normalizer
 * 
 * Combines data from wire lists, part number lists, layout extraction,
 * reference sheets, and catalog lookups into normalized assignment components.
 */

import type { ParsedWorkbookSheet, SemanticWireListRow } from '@/lib/workbook/types'
import type {
  PartCatalog,
  PartCategory,
  CatalogLookupResult,
  NormalizedAssignmentComponent,
  AssignmentComponentSummary,
  ProjectReferenceData,
  CatalogImage,
  ComponentSource,
} from '@/types/d380-catalog'
import { lookupByPartNumber, lookupByDevicePrefix } from './local-catalog-adapter'
import { findReferencesForDevice, findReferencesForWire } from './reference-sheet-normalizer'

// ============================================================================
// COMPONENT EXTRACTION FROM WIRE LIST
// ============================================================================

/**
 * Extract unique devices from a wire list sheet.
 */
export function extractDevicesFromWireList(
  sheet: ParsedWorkbookSheet
): Map<string, { deviceId: string; terminal?: string; wireConnections: NormalizedAssignmentComponent['wireConnections'] }> {
  const devices = new Map<string, {
    deviceId: string
    terminal?: string
    wireConnections: NormalizedAssignmentComponent['wireConnections']
  }>()
  
  if (!sheet.semanticRows) return devices
  
  for (const row of sheet.semanticRows) {
    // Process FROM device
    if (row.fromDeviceId) {
      const { baseId, terminal } = parseDeviceIdWithTerminal(row.fromDeviceId)
      const key = row.fromDeviceId // Keep full device ID as key
      
      const existing = devices.get(key) || {
        deviceId: baseId,
        terminal,
        wireConnections: [],
      }
      
      existing.wireConnections.push({
        wireId: row.wireId || '',
        fromOrTo: 'FROM',
        otherDeviceId: row.toDeviceId || '',
        signal: row.signal,
      })
      
      devices.set(key, existing)
    }
    
    // Process TO device
    if (row.toDeviceId) {
      const { baseId, terminal } = parseDeviceIdWithTerminal(row.toDeviceId)
      const key = row.toDeviceId
      
      const existing = devices.get(key) || {
        deviceId: baseId,
        terminal,
        wireConnections: [],
      }
      
      existing.wireConnections.push({
        wireId: row.wireId || '',
        fromOrTo: 'TO',
        otherDeviceId: row.fromDeviceId || '',
        signal: row.signal,
      })
      
      devices.set(key, existing)
    }
  }
  
  return devices
}

/**
 * Parse device ID with terminal (e.g., "KA0561:A1" -> { baseId: "KA0561", terminal: "A1" }).
 */
function parseDeviceIdWithTerminal(fullDeviceId: string): { baseId: string; terminal?: string } {
  const colonIndex = fullDeviceId.indexOf(':')
  if (colonIndex === -1) {
    return { baseId: fullDeviceId }
  }
  return {
    baseId: fullDeviceId.substring(0, colonIndex),
    terminal: fullDeviceId.substring(colonIndex + 1),
  }
}

// ============================================================================
// COMPONENT NORMALIZATION
// ============================================================================

/**
 * Normalize a single component by merging data from multiple sources.
 */
export function normalizeComponent(
  fullDeviceId: string,
  deviceData: {
    deviceId: string
    terminal?: string
    wireConnections: NormalizedAssignmentComponent['wireConnections']
  },
  catalog: PartCatalog | null,
  referenceData: ProjectReferenceData | null
): NormalizedAssignmentComponent {
  const sources: ComponentSource[] = ['WIRE_LIST']
  const reasons: string[] = []
  let confidence = 30 // Base confidence from wire list
  
  const partNumbers: string[] = []
  let primaryPartNumber: string | undefined
  let description: string | undefined
  let category: PartCategory | undefined
  let catalogMatch: CatalogLookupResult | undefined
  let referenceImage: CatalogImage | undefined
  let icon: CatalogImage | undefined
  
  // Try to get part number from reference data
  if (referenceData) {
    const deviceRefs = findReferencesForDevice(referenceData, deviceData.deviceId)
    
    if (deviceRefs.partNumber?.partNumber) {
      partNumbers.push(deviceRefs.partNumber.partNumber)
      sources.push('PART_NUMBER_LIST')
      reasons.push(`Part number from Part Number List: ${deviceRefs.partNumber.partNumber}`)
      confidence += 20
      
      if (deviceRefs.partNumber.description) {
        description = deviceRefs.partNumber.description
      }
    }
    
    if (deviceRefs.labels.length > 0) {
      sources.push('REFERENCE_SHEET')
      reasons.push(`Found ${deviceRefs.labels.length} label reference(s)`)
    }
    
    if (deviceRefs.errors.length > 0) {
      reasons.push(`WARNING: ${deviceRefs.errors.length} panel error(s) for this device`)
    }
  }
  
  // Try catalog lookup if we have part numbers
  if (catalog && partNumbers.length > 0) {
    for (const pn of partNumbers) {
      const lookupResult = lookupByPartNumber(catalog, pn)
      if (lookupResult.found && lookupResult.record) {
        catalogMatch = lookupResult
        primaryPartNumber = lookupResult.record.partNumber
        description = description || lookupResult.record.description
        category = lookupResult.record.category
        
        if (lookupResult.record.images.primary) {
          referenceImage = lookupResult.record.images.primary
        }
        if (lookupResult.record.images.icon) {
          icon = lookupResult.record.images.icon
        }
        
        sources.push('CATALOG_MATCH')
        reasons.push(`Catalog match: ${lookupResult.confidence} (${lookupResult.confidenceScore}%)`)
        confidence += lookupResult.confidenceScore * 0.5
        break
      }
    }
  }
  
  // Try device prefix fallback if no catalog match yet
  if (catalog && !catalogMatch) {
    const prefixResults = lookupByDevicePrefix(catalog, deviceData.deviceId)
    if (prefixResults.length > 0 && prefixResults[0].found && prefixResults[0].record) {
      const firstMatch = prefixResults[0]
      catalogMatch = firstMatch
      category = category || firstMatch.record?.category
      
      if (firstMatch.record?.images.icon && !icon) {
        icon = firstMatch.record.images.icon
      }
      
      reasons.push(`Device prefix fallback: ${firstMatch.record?.partNumber}`)
      confidence += 10
    }
  }
  
  // Generate component ID
  const componentId = generateComponentId(fullDeviceId)
  
  // Ensure confidence is within bounds
  confidence = Math.min(100, Math.max(0, Math.round(confidence)))
  
  return {
    componentId,
    deviceId: deviceData.deviceId,
    terminal: deviceData.terminal,
    fullDeviceId,
    partNumbers,
    primaryPartNumber,
    description,
    category,
    catalogMatch,
    referenceImage,
    icon,
    wireConnections: deviceData.wireConnections,
    sources,
    confidence,
    reasons,
  }
}

/**
 * Generate a unique component ID.
 */
function generateComponentId(fullDeviceId: string): string {
  return `comp_${fullDeviceId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`
}

// ============================================================================
// ASSIGNMENT COMPONENT SUMMARY BUILDER
// ============================================================================

/**
 * Build a complete component summary for an assignment.
 */
export function buildAssignmentComponentSummary(
  assignmentId: string,
  sheetName: string,
  sheet: ParsedWorkbookSheet,
  catalog: PartCatalog | null,
  referenceData: ProjectReferenceData | null
): AssignmentComponentSummary {
  // Extract devices from wire list
  const deviceMap = extractDevicesFromWireList(sheet)
  
  // Normalize each component
  const components: NormalizedAssignmentComponent[] = []
  for (const [fullDeviceId, deviceData] of deviceMap) {
    const component = normalizeComponent(
      fullDeviceId,
      deviceData,
      catalog,
      referenceData
    )
    components.push(component)
  }
  
  // Sort components by device ID
  components.sort((a, b) => a.fullDeviceId.localeCompare(b.fullDeviceId))
  
  // Build category index
  const byCategory = new Map<PartCategory, NormalizedAssignmentComponent[]>()
  for (const component of components) {
    if (component.category) {
      const existing = byCategory.get(component.category) || []
      existing.push(component)
      byCategory.set(component.category, existing)
    }
  }
  
  // Calculate statistics
  const catalogMatched = components.filter(c => c.catalogMatch?.found).length
  const withImages = components.filter(c => c.referenceImage || c.icon).length
  const withNotes = components.filter(c => 
    c.catalogMatch?.record?.notes && c.catalogMatch.record.notes.length > 0
  ).length
  
  return {
    assignmentId,
    sheetName,
    totalComponents: components.length,
    catalogMatched,
    withImages,
    withNotes,
    components,
    byCategory,
    builtAt: new Date().toISOString(),
  }
}

// ============================================================================
// BATCH PROCESSING
// ============================================================================

/**
 * Batch normalize components for multiple assignments.
 */
export function batchNormalizeAssignments(
  assignments: { assignmentId: string; sheetName: string; sheet: ParsedWorkbookSheet }[],
  catalog: PartCatalog | null,
  referenceData: ProjectReferenceData | null
): Map<string, AssignmentComponentSummary> {
  const summaries = new Map<string, AssignmentComponentSummary>()
  
  for (const assignment of assignments) {
    const summary = buildAssignmentComponentSummary(
      assignment.assignmentId,
      assignment.sheetName,
      assignment.sheet,
      catalog,
      referenceData
    )
    summaries.set(assignment.assignmentId, summary)
  }
  
  return summaries
}

// ============================================================================
// COMPONENT STATISTICS
// ============================================================================

/**
 * Get aggregated statistics for an assignment's components.
 */
export function getComponentStats(summary: AssignmentComponentSummary): {
  totalComponents: number
  totalWireConnections: number
  uniquePartNumbers: number
  matchedToCategory: number
  categoryCounts: { category: PartCategory; count: number }[]
  confidenceDistribution: { range: string; count: number }[]
} {
  let totalWireConnections = 0
  const uniquePartNumbers = new Set<string>()
  let matchedToCategory = 0
  
  const confidenceBuckets: Record<string, number> = {
    '0-25': 0,
    '26-50': 0,
    '51-75': 0,
    '76-100': 0,
  }
  
  for (const component of summary.components) {
    totalWireConnections += component.wireConnections.length
    
    for (const pn of component.partNumbers) {
      uniquePartNumbers.add(pn)
    }
    
    if (component.category) {
      matchedToCategory++
    }
    
    // Bucket confidence
    if (component.confidence <= 25) {
      confidenceBuckets['0-25']++
    } else if (component.confidence <= 50) {
      confidenceBuckets['26-50']++
    } else if (component.confidence <= 75) {
      confidenceBuckets['51-75']++
    } else {
      confidenceBuckets['76-100']++
    }
  }
  
  // Category counts
  const categoryCounts: { category: PartCategory; count: number }[] = []
  for (const [category, components] of summary.byCategory) {
    categoryCounts.push({ category, count: components.length })
  }
  categoryCounts.sort((a, b) => b.count - a.count)
  
  // Confidence distribution
  const confidenceDistribution = Object.entries(confidenceBuckets)
    .map(([range, count]) => ({ range, count }))
  
  return {
    totalComponents: summary.totalComponents,
    totalWireConnections,
    uniquePartNumbers: uniquePartNumbers.size,
    matchedToCategory,
    categoryCounts,
    confidenceDistribution,
  }
}

// ============================================================================
// COMPONENT FILTERING
// ============================================================================

/**
 * Filter components by confidence level.
 */
export function filterByConfidence(
  components: NormalizedAssignmentComponent[],
  minConfidence: number
): NormalizedAssignmentComponent[] {
  return components.filter(c => c.confidence >= minConfidence)
}

/**
 * Filter components by category.
 */
export function filterByCategory(
  components: NormalizedAssignmentComponent[],
  category: PartCategory
): NormalizedAssignmentComponent[] {
  return components.filter(c => c.category === category)
}

/**
 * Filter components that have catalog matches.
 */
export function filterWithCatalogMatch(
  components: NormalizedAssignmentComponent[]
): NormalizedAssignmentComponent[] {
  return components.filter(c => c.catalogMatch?.found)
}

/**
 * Filter components that need review (low confidence or no catalog match).
 */
export function filterNeedsReview(
  components: NormalizedAssignmentComponent[],
  confidenceThreshold: number = 50
): NormalizedAssignmentComponent[] {
  return components.filter(
    c => c.confidence < confidenceThreshold || !c.catalogMatch?.found
  )
}
