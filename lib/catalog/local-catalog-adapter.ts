/**
 * Local Catalog Adapter
 * 
 * Parses and indexes the local part number library CSV.
 * Provides lookup functions with confidence scoring and fallback strategies.
 */

import type {
  PartCatalog,
  PartCatalogRecord,
  PartCategory,
  CatalogLookupResult,
  CatalogBatchLookupResult,
  CatalogIndexEntry,
  CatalogImageSet,
  CatalogImage,
  MatchConfidence,
} from '@/types/d380-catalog'

// ============================================================================
// CATALOG PARSING
// ============================================================================

/**
 * CSV row structure from the part number library.
 */
interface PartLibraryCSVRow {
  'Part Number': string
  'Description': string
  'Category': string
  'Reference Image'?: string
  'Icon'?: string
}

/**
 * Parse the local part number library CSV content.
 */
export function parsePartLibraryCSV(csvContent: string): PartCatalogRecord[] {
  const lines = csvContent.trim().split('\n')
  if (lines.length < 2) return []
  
  const headers = parseCSVLine(lines[0])
  const records: PartCatalogRecord[] = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    if (values.length === 0) continue
    
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx] || ''
    })
    
    const partNumber = row['Part Number']?.trim()
    if (!partNumber) continue
    
    const description = row['Description']?.trim() || ''
    const category = normalizeCategory(row['Category']?.trim() || 'Unknown')
    const referenceImage = row['Reference Image']?.trim() || undefined
    const icon = row['Icon']?.trim() || undefined
    
    // Build image set
    const images = buildImageSet(partNumber, referenceImage, icon)
    
    // Infer device prefixes from part number pattern
    const devicePrefixes = inferDevicePrefixes(partNumber, description)
    
    // Infer mount type from category/description
    const mountType = inferMountType(category, description)
    
    records.push({
      partNumber,
      description,
      category,
      images,
      devicePrefixes,
      mountType,
      source: 'LIBRARY_CSV',
    })
  }
  
  return records
}

/**
 * Parse a single CSV line handling quoted fields.
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  
  result.push(current.trim())
  return result
}

/**
 * Normalize category string to PartCategory type.
 */
function normalizeCategory(category: string): PartCategory {
  // Direct mapping for known categories
  const categoryMap: Record<string, PartCategory> = {
    'grounding & busbars': 'Grounding & Busbars',
    'wire ferrules': 'Wire Ferrules',
    'terminal blocks & accessories': 'Terminal Blocks & Accessories',
    'ring terminals': 'Ring Terminals',
    'fork terminals': 'Fork Terminals',
    'din rail & mounting': 'DIN Rail & Mounting',
    'passive components': 'Passive Components',
    'diodes & suppression': 'Diodes & Suppression',
    'measurement & shunts': 'Measurement & Shunts',
    'control relays': 'Control Relays',
    'relay sockets': 'Relay Sockets',
    'timing relays': 'Timing Relays',
    'protection relays': 'Protection Relays',
    'circuit protection': 'Circuit Protection',
    'control power': 'Control Power',
    'power conversion': 'Power Conversion',
    'operator controls': 'Operator Controls',
    'pilot lights & indicators': 'Pilot Lights & Indicators',
    'panel lighting': 'Panel Lighting',
    'alarm devices': 'Alarm Devices',
    'panel hardware': 'Panel Hardware',
    'cable management': 'Cable Management',
    'wire management': 'Wire Management',
    'wire duct & panduit': 'Wire Duct & Panduit',
    'hmi & operator interface': 'HMI & Operator Interface',
    'industrial computing': 'Industrial Computing',
    'industrial networking': 'Industrial Networking',
    'gateway & protocol conversion': 'Gateway & Protocol Conversion',
    'time synchronization': 'Time Synchronization',
    'counters & timers': 'Counters & Timers',
    'plc control platform': 'PLC Control Platform',
    'plc rack hardware': 'PLC Rack Hardware',
    'plc communication modules': 'PLC Communication Modules',
    'safety control system': 'Safety Control System',
    'control modules': 'Control Modules',
    'signal conditioning': 'Signal Conditioning',
    'distributed i/o': 'Distributed I/O',
    'condition monitoring i/o': 'Condition Monitoring I/O',
  }
  
  const normalized = category.toLowerCase()
  return categoryMap[normalized] || 'Unknown'
}

/**
 * Build image set from CSV data.
 */
function buildImageSet(
  partNumber: string,
  referenceImage?: string,
  icon?: string
): CatalogImageSet {
  const images: CatalogImage[] = []
  let primary: CatalogImage | undefined
  let iconImage: CatalogImage | undefined
  
  // Add reference image if available
  if (referenceImage) {
    // Normalize path - ensure it starts with /
    const normalizedPath = referenceImage.startsWith('/') 
      ? referenceImage 
      : `/${referenceImage}`
    
    primary = {
      src: normalizedPath,
      viewType: 'front',
      label: 'Reference Image',
      alt: `${partNumber} reference image`,
    }
    images.push(primary)
  }
  
  // Add icon if available
  if (icon) {
    const normalizedPath = icon.startsWith('/') ? icon : `/${icon}`
    iconImage = {
      src: normalizedPath,
      viewType: 'icon',
      label: 'Icon',
      alt: `${partNumber} icon`,
    }
  }
  
  // Try static device image fallback
  const staticDevicePath = `/devices/${partNumber}.png`
  if (!primary) {
    // Use static device image as primary if no reference image
    images.push({
      src: staticDevicePath,
      viewType: 'front',
      label: 'Device Image',
      alt: `${partNumber} device image`,
    })
  }
  
  return {
    primary,
    icon: iconImage,
    images,
    diagrams: [],
  }
}

/**
 * Infer device prefixes from part number and description.
 */
function inferDevicePrefixes(partNumber: string, description: string): string[] {
  const prefixes: string[] = []
  const descLower = description.toLowerCase()
  
  // Map description keywords to device prefixes
  if (descLower.includes('relay')) {
    prefixes.push('KA', 'KT', 'K')
  }
  if (descLower.includes('fuse')) {
    prefixes.push('FU')
  }
  if (descLower.includes('terminal') || descLower.includes('block')) {
    prefixes.push('TB', 'XB', 'X')
  }
  if (descLower.includes('switch')) {
    prefixes.push('PB', 'SS', 'S')
  }
  if (descLower.includes('power supply') || descLower.includes('converter')) {
    prefixes.push('PS', 'PE')
  }
  if (descLower.includes('controller') || descLower.includes('plc')) {
    prefixes.push('PLC', 'CPU')
  }
  if (descLower.includes('busbar') || descLower.includes('ground')) {
    prefixes.push('GB', 'GND')
  }
  
  return prefixes
}

/**
 * Infer mount type from category and description.
 */
function inferMountType(
  category: PartCategory,
  description: string
): 'DIN_RAIL' | 'PANEL_MOUNT' | 'SURFACE_MOUNT' | 'BUSBAR_MOUNT' | 'RACK_MOUNT' | 'TERMINAL_BLOCK' | 'UNKNOWN' {
  const descLower = description.toLowerCase()
  
  if (descLower.includes('din rail') || descLower.includes('rail mount')) {
    return 'DIN_RAIL'
  }
  if (descLower.includes('panel')) {
    return 'PANEL_MOUNT'
  }
  if (descLower.includes('surface')) {
    return 'SURFACE_MOUNT'
  }
  if (descLower.includes('busbar')) {
    return 'BUSBAR_MOUNT'
  }
  if (descLower.includes('rack') || descLower.includes('chassis')) {
    return 'RACK_MOUNT'
  }
  
  // Infer from category
  switch (category) {
    case 'Terminal Blocks & Accessories':
      return 'DIN_RAIL'
    case 'Grounding & Busbars':
      return 'BUSBAR_MOUNT'
    case 'PLC Rack Hardware':
      return 'RACK_MOUNT'
    case 'Operator Controls':
    case 'Pilot Lights & Indicators':
      return 'PANEL_MOUNT'
    default:
      return 'UNKNOWN'
  }
}

// ============================================================================
// CATALOG INDEX BUILDING
// ============================================================================

/**
 * Build a complete catalog with indexes from parsed records.
 */
export function buildPartCatalog(
  records: PartCatalogRecord[],
  sources: string[] = ['part-number-library.csv']
): PartCatalog {
  const catalog: PartCatalog = {
    records: new Map(),
    byPartNumber: new Map(),
    byAlternate: new Map(),
    byDevicePrefix: new Map(),
    byCategory: new Map(),
    metadata: {
      recordCount: records.length,
      builtAt: new Date().toISOString(),
      sources,
    },
  }
  
  for (const record of records) {
    // Add to records map
    catalog.records.set(record.partNumber, record)
    
    // Index by normalized part number
    const normalizedPN = normalizePartNumber(record.partNumber)
    catalog.byPartNumber.set(normalizedPN, {
      partNumber: record.partNumber,
      indexType: 'PRIMARY',
    })
    
    // Index by alternate part numbers
    if (record.alternatePartNumbers) {
      for (const alt of record.alternatePartNumbers) {
        const normalizedAlt = normalizePartNumber(alt)
        catalog.byAlternate.set(normalizedAlt, {
          partNumber: record.partNumber,
          indexType: 'ALTERNATE',
        })
      }
    }
    
    // Index by device prefixes
    if (record.devicePrefixes) {
      for (const prefix of record.devicePrefixes) {
        const normalizedPrefix = prefix.toUpperCase()
        const existing = catalog.byDevicePrefix.get(normalizedPrefix) || []
        existing.push({
          partNumber: record.partNumber,
          indexType: 'PREFIX',
        })
        catalog.byDevicePrefix.set(normalizedPrefix, existing)
      }
    }
    
    // Index by category
    const categoryRecords = catalog.byCategory.get(record.category) || []
    categoryRecords.push(record)
    catalog.byCategory.set(record.category, categoryRecords)
  }
  
  return catalog
}

/**
 * Normalize part number for consistent lookup.
 */
export function normalizePartNumber(partNumber: string): string {
  return partNumber
    .toUpperCase()
    .trim()
    .replace(/\s+/g, '')
    .replace(/[^\w-]/g, '')
}

// ============================================================================
// CATALOG LOOKUP FUNCTIONS
// ============================================================================

/**
 * Look up a part in the catalog by part number.
 */
export function lookupByPartNumber(
  catalog: PartCatalog,
  partNumber: string
): CatalogLookupResult {
  const normalized = normalizePartNumber(partNumber)
  
  // Try exact match
  const exactMatch = catalog.byPartNumber.get(normalized)
  if (exactMatch) {
    const record = catalog.records.get(exactMatch.partNumber)
    if (record) {
      return {
        found: true,
        record,
        confidence: 'EXACT',
        confidenceScore: 100,
        matchedBy: 'EXACT_PART_NUMBER',
        query: partNumber,
        reasons: ['Exact part number match'],
      }
    }
  }
  
  // Try alternate match
  const altMatch = catalog.byAlternate.get(normalized)
  if (altMatch) {
    const record = catalog.records.get(altMatch.partNumber)
    if (record) {
      return {
        found: true,
        record,
        confidence: 'ALTERNATE',
        confidenceScore: 90,
        matchedBy: 'ALTERNATE_PART_NUMBER',
        query: partNumber,
        reasons: [`Matched via alternate part number ${altMatch.partNumber}`],
      }
    }
  }
  
  // Try fuzzy match
  const fuzzyResult = fuzzyMatchPartNumber(catalog, partNumber)
  if (fuzzyResult) {
    return fuzzyResult
  }
  
  return {
    found: false,
    confidence: 'NONE',
    confidenceScore: 0,
    matchedBy: 'NOT_FOUND',
    query: partNumber,
    reasons: ['No matching part number found in catalog'],
  }
}

/**
 * Look up parts by device ID prefix.
 */
export function lookupByDevicePrefix(
  catalog: PartCatalog,
  deviceId: string
): CatalogLookupResult[] {
  // Extract prefix from device ID (e.g., "KA" from "KA0561")
  const prefix = extractDevicePrefix(deviceId)
  if (!prefix) {
    return []
  }
  
  const matches = catalog.byDevicePrefix.get(prefix.toUpperCase())
  if (!matches || matches.length === 0) {
    return []
  }
  
  return matches.map(match => {
    const record = catalog.records.get(match.partNumber)
    return {
      found: !!record,
      record,
      confidence: 'PREFIX' as MatchConfidence,
      confidenceScore: 50,
      matchedBy: 'DEVICE_PREFIX' as const,
      query: deviceId,
      reasons: [`Matched via device prefix "${prefix}"`],
    }
  })
}

/**
 * Extract device prefix from device ID.
 */
function extractDevicePrefix(deviceId: string): string | null {
  // Match letter prefix (e.g., "KA" from "KA0561", "TB" from "TB15")
  const match = deviceId.match(/^([A-Za-z]+)/)
  return match ? match[1].toUpperCase() : null
}

/**
 * Attempt fuzzy matching on part number.
 */
function fuzzyMatchPartNumber(
  catalog: PartCatalog,
  partNumber: string
): CatalogLookupResult | null {
  const normalized = normalizePartNumber(partNumber)
  
  // Try removing trailing suffix (e.g., "1043265-1" -> "1043265")
  const basePart = normalized.replace(/-\d+$/, '')
  if (basePart !== normalized) {
    // Look for any variant of this base part
    for (const [pn, _entry] of catalog.byPartNumber) {
      if (pn.startsWith(basePart)) {
        const record = catalog.records.get(_entry.partNumber)
        if (record) {
          return {
            found: true,
            record,
            confidence: 'FUZZY',
            confidenceScore: 70,
            matchedBy: 'FUZZY_MATCH',
            query: partNumber,
            reasons: [`Fuzzy match via base part number "${basePart}"`],
          }
        }
      }
    }
  }
  
  return null
}

/**
 * Batch lookup multiple part numbers.
 */
export function batchLookup(
  catalog: PartCatalog,
  partNumbers: string[]
): CatalogBatchLookupResult {
  const results: CatalogLookupResult[] = []
  let exactMatches = 0
  let alternateMatches = 0
  let prefixMatches = 0
  let notFound = 0
  
  for (const pn of partNumbers) {
    const result = lookupByPartNumber(catalog, pn)
    results.push(result)
    
    switch (result.confidence) {
      case 'EXACT':
        exactMatches++
        break
      case 'ALTERNATE':
        alternateMatches++
        break
      case 'PREFIX':
        prefixMatches++
        break
      case 'NONE':
        notFound++
        break
    }
  }
  
  return {
    totalQueried: partNumbers.length,
    exactMatches,
    alternateMatches,
    prefixMatches,
    notFound,
    results,
  }
}

// ============================================================================
// CATALOG LOADING
// ============================================================================

let cachedCatalog: PartCatalog | null = null

/**
 * Load the catalog from the CSV file.
 * Caches the result for subsequent calls.
 */
export async function loadPartCatalog(): Promise<PartCatalog> {
  if (cachedCatalog) {
    return cachedCatalog
  }
  
  try {
    // Fetch the CSV from public directory
    const response = await fetch('/library/part-number-libary.csv')
    if (!response.ok) {
      throw new Error(`Failed to load catalog: ${response.status}`)
    }
    
    const csvContent = await response.text()
    const records = parsePartLibraryCSV(csvContent)
    cachedCatalog = buildPartCatalog(records)
    
    return cachedCatalog
  } catch (error) {
    console.error('[Catalog] Failed to load part catalog:', error)
    // Return empty catalog on error
    return buildPartCatalog([])
  }
}

/**
 * Clear the cached catalog (useful for testing or refresh).
 */
export function clearCatalogCache(): void {
  cachedCatalog = null
}

/**
 * Get catalog statistics.
 */
export function getCatalogStats(catalog: PartCatalog): {
  totalRecords: number
  byCategory: { category: PartCategory; count: number }[]
  withImages: number
  withIcons: number
} {
  let withImages = 0
  let withIcons = 0
  
  for (const record of catalog.records.values()) {
    if (record.images.primary) withImages++
    if (record.images.icon) withIcons++
  }
  
  const byCategory: { category: PartCategory; count: number }[] = []
  for (const [category, records] of catalog.byCategory) {
    byCategory.push({ category, count: records.length })
  }
  byCategory.sort((a, b) => b.count - a.count)
  
  return {
    totalRecords: catalog.records.size,
    byCategory,
    withImages,
    withIcons,
  }
}
