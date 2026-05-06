/**
 * Cross-Wire Runtime Classifier
 * 
 * Runtime classification system for determining whether wire connections
 * belong to WIRING (internal panel) or CROSS_WIRING (boundary crossing).
 * 
 * Classification Rules:
 * 1. Parse FROM and TO locations to structural zones
 * 2. Compare zones - same zone = WIRING, different zones = CROSS_WIRING
 * 3. Handle ambiguous cases with REVIEW_REQUIRED bucket
 * 4. Support Team Lead override
 */

import type {
  StructuralZoneId,
  WiringBoundaryType,
  ClassificationConfidence,
  WireConnectionExecutionBucket,
  CrossWireClassification,
  CrossWireReviewItem,
  CrossWireClassificationSummary,
  ClassificationContext,
  STRUCTURAL_ZONE_PATTERNS,
} from '@/types/d380-cross-wire'
import type { WireConnection } from '@/types/d380-wiring'

// ============================================================================
// ZONE DETECTION
// ============================================================================

/**
 * Structural zone patterns for detection.
 */
const ZONE_PATTERNS: Array<{
  zoneId: StructuralZoneId
  patterns: RegExp[]
  keywords: string[]
  priority: number
}> = [
  {
    zoneId: 'LEFT_DOOR',
    patterns: [/left\s*door/i, /l[\.\s]?door/i, /door\s*l/i, /^ld$/i],
    keywords: ['LEFT DOOR', 'L DOOR', 'LDOOR', 'LD'],
    priority: 10,
  },
  {
    zoneId: 'RIGHT_DOOR',
    patterns: [/right\s*door/i, /r[\.\s]?door/i, /door\s*r/i, /^rd$/i],
    keywords: ['RIGHT DOOR', 'R DOOR', 'RDOOR', 'RD'],
    priority: 10,
  },
  {
    zoneId: 'DOOR',
    patterns: [/^door$/i, /door\s*panel/i, /door\s*harness/i],
    keywords: ['DOOR'],
    priority: 5,
  },
  {
    zoneId: 'LEFT_SIDE_RAIL',
    patterns: [/left\s*side\s*rail/i, /l[\.\s]?rail/i, /lsr/i, /left\s*rail/i],
    keywords: ['LEFT SIDE RAIL', 'L RAIL', 'LSR', 'LEFT RAIL'],
    priority: 10,
  },
  {
    zoneId: 'RIGHT_SIDE_RAIL',
    patterns: [/right\s*side\s*rail/i, /r[\.\s]?rail/i, /rsr/i, /right\s*rail/i],
    keywords: ['RIGHT SIDE RAIL', 'R RAIL', 'RSR', 'RIGHT RAIL'],
    priority: 10,
  },
  {
    zoneId: 'SIDE_RAIL',
    patterns: [/side\s*rail/i, /^rail$/i],
    keywords: ['SIDE RAIL', 'RAIL'],
    priority: 5,
  },
  {
    zoneId: 'BOX',
    patterns: [/^box$/i, /box\s*panel/i, /enclosure/i, /^jb\d+/i],
    keywords: ['BOX', 'ENCLOSURE', 'JB'],
    priority: 3,
  },
  {
    zoneId: 'CONSOLE',
    patterns: [/^console$/i, /console\s*panel/i, /^con$/i],
    keywords: ['CONSOLE', 'CON'],
    priority: 3,
  },
  {
    zoneId: 'HARNESS',
    patterns: [/harness/i, /harn/i, /wire\s*bundle/i],
    keywords: ['HARNESS', 'HARN', 'WIRE BUNDLE'],
    priority: 8,
  },
  {
    zoneId: 'PANEL',
    patterns: [/pnl\s*[a-z]/i, /panel\s*[a-z]/i, /^pnl$/i, /^panel$/i, /^p[a-z]$/i],
    keywords: ['PNL', 'PANEL'],
    priority: 1,
  },
]

/**
 * Detect structural zone from a location string.
 */
export function detectStructuralZone(location: string): {
  zone: StructuralZoneId
  confidence: ClassificationConfidence
  matchedPattern?: string
} {
  if (!location || location.trim() === '') {
    return { zone: 'UNKNOWN', confidence: 'LOW' }
  }
  
  const normalized = location.trim().toUpperCase()
  
  // Sort patterns by priority (highest first)
  const sortedPatterns = [...ZONE_PATTERNS].sort((a, b) => b.priority - a.priority)
  
  for (const patternDef of sortedPatterns) {
    // Check keywords first (exact matches)
    for (const keyword of patternDef.keywords) {
      if (normalized.includes(keyword)) {
        return {
          zone: patternDef.zoneId,
          confidence: patternDef.priority >= 8 ? 'HIGH' : 'MEDIUM',
          matchedPattern: keyword,
        }
      }
    }
    
    // Check regex patterns
    for (const pattern of patternDef.patterns) {
      if (pattern.test(location)) {
        return {
          zone: patternDef.zoneId,
          confidence: patternDef.priority >= 8 ? 'HIGH' : 'MEDIUM',
          matchedPattern: pattern.source,
        }
      }
    }
  }
  
  // No match found
  return { zone: 'UNKNOWN', confidence: 'LOW' }
}

/**
 * Extract panel identifier from a location string.
 */
export function extractPanelId(location: string): string | undefined {
  // Match patterns like "PNL A", "PANEL B", "PA", etc.
  const panelMatch = location.match(/(?:pnl|panel)\s*([a-z])/i)
  if (panelMatch) {
    return `PNL ${panelMatch[1].toUpperCase()}`
  }
  
  // Match single letter panel references
  const singleMatch = location.match(/^p([a-z])$/i)
  if (singleMatch) {
    return `PNL ${singleMatch[1].toUpperCase()}`
  }
  
  return undefined
}

// ============================================================================
// CLASSIFICATION LOGIC
// ============================================================================

/**
 * Determine boundary type between two zones.
 */
export function determineBoundaryType(
  fromZone: StructuralZoneId,
  toZone: StructuralZoneId,
  context?: Partial<ClassificationContext>
): WiringBoundaryType {
  // Same zone = internal
  if (fromZone === toZone && fromZone === 'PANEL') {
    return 'INTERNAL_PANEL'
  }
  
  // Panel to panel
  if (fromZone === 'PANEL' && toZone === 'PANEL') {
    // Need to check if same panel
    return 'PANEL_TO_PANEL'
  }
  
  // Panel to door
  if (fromZone === 'PANEL' && (toZone === 'LEFT_DOOR' || toZone === 'RIGHT_DOOR' || toZone === 'DOOR')) {
    return 'PANEL_TO_DOOR'
  }
  if ((fromZone === 'LEFT_DOOR' || fromZone === 'RIGHT_DOOR' || fromZone === 'DOOR') && toZone === 'PANEL') {
    return 'PANEL_TO_DOOR'
  }
  
  // Panel to side rail
  if (fromZone === 'PANEL' && (toZone === 'LEFT_SIDE_RAIL' || toZone === 'RIGHT_SIDE_RAIL' || toZone === 'SIDE_RAIL')) {
    return 'PANEL_TO_SIDE_RAIL'
  }
  if ((fromZone === 'LEFT_SIDE_RAIL' || fromZone === 'RIGHT_SIDE_RAIL' || fromZone === 'SIDE_RAIL') && toZone === 'PANEL') {
    return 'PANEL_TO_SIDE_RAIL'
  }
  
  // Panel to box
  if (fromZone === 'PANEL' && toZone === 'BOX') {
    return 'PANEL_TO_BOX'
  }
  if (fromZone === 'BOX' && toZone === 'PANEL') {
    return 'PANEL_TO_BOX'
  }
  
  // Panel to console
  if (fromZone === 'PANEL' && toZone === 'CONSOLE') {
    return 'PANEL_TO_CONSOLE'
  }
  if (fromZone === 'CONSOLE' && toZone === 'PANEL') {
    return 'PANEL_TO_CONSOLE'
  }
  
  // Door to door
  if ((fromZone === 'LEFT_DOOR' || fromZone === 'RIGHT_DOOR' || fromZone === 'DOOR') &&
      (toZone === 'LEFT_DOOR' || toZone === 'RIGHT_DOOR' || toZone === 'DOOR')) {
    return 'DOOR_TO_DOOR'
  }
  
  // Door to console
  if ((fromZone === 'LEFT_DOOR' || fromZone === 'RIGHT_DOOR' || fromZone === 'DOOR') && toZone === 'CONSOLE') {
    return 'DOOR_TO_CONSOLE'
  }
  if (fromZone === 'CONSOLE' && (toZone === 'LEFT_DOOR' || toZone === 'RIGHT_DOOR' || toZone === 'DOOR')) {
    return 'DOOR_TO_CONSOLE'
  }
  
  // Harness internal
  if (fromZone === 'HARNESS' && toZone === 'HARNESS') {
    return 'HARNESS_INTERNAL'
  }
  
  // Unknown external
  return 'UNKNOWN_EXTERNAL'
}

/**
 * Determine execution bucket from boundary type.
 */
export function determineExecutionBucket(
  boundaryType: WiringBoundaryType,
  confidence: ClassificationConfidence
): WireConnectionExecutionBucket {
  // Internal panel is always wiring
  if (boundaryType === 'INTERNAL_PANEL') {
    return 'WIRING'
  }
  
  // Low confidence always goes to review
  if (confidence === 'LOW') {
    return 'REVIEW_REQUIRED'
  }
  
  // External boundaries are cross-wiring
  const crossWireBoundaries: WiringBoundaryType[] = [
    'PANEL_TO_PANEL',
    'PANEL_TO_DOOR',
    'PANEL_TO_SIDE_RAIL',
    'PANEL_TO_BOX',
    'PANEL_TO_CONSOLE',
    'DOOR_TO_DOOR',
    'DOOR_TO_CONSOLE',
  ]
  
  if (crossWireBoundaries.includes(boundaryType)) {
    return 'CROSS_WIRING'
  }
  
  // Unknown external goes to review
  if (boundaryType === 'UNKNOWN_EXTERNAL') {
    return 'REVIEW_REQUIRED'
  }
  
  // Harness internal is typically wiring
  if (boundaryType === 'HARNESS_INTERNAL') {
    return 'WIRING'
  }
  
  return 'REVIEW_REQUIRED'
}

// ============================================================================
// MAIN CLASSIFICATION FUNCTION
// ============================================================================

/**
 * Classify a single wire connection.
 */
export function classifyCrossWireConnection(
  connection: WireConnection,
  context?: Partial<ClassificationContext>
): CrossWireClassification {
  const reasons: string[] = []
  
  // Parse from and to locations
  const fromResult = detectStructuralZone(connection.fromLocation || '')
  const toResult = detectStructuralZone(connection.toLocation || '')
  
  reasons.push(`From zone: ${fromResult.zone} (${fromResult.confidence})`)
  reasons.push(`To zone: ${toResult.zone} (${toResult.confidence})`)
  
  // Check if same panel (using panel IDs if available)
  const fromPanelId = extractPanelId(connection.fromLocation || '')
  const toPanelId = extractPanelId(connection.toLocation || '')
  
  let isSamePanel = false
  if (fromPanelId && toPanelId) {
    isSamePanel = fromPanelId === toPanelId
    if (isSamePanel) {
      reasons.push(`Same panel: ${fromPanelId}`)
    } else {
      reasons.push(`Different panels: ${fromPanelId} → ${toPanelId}`)
    }
  }
  
  // Determine boundary type
  let boundaryType = determineBoundaryType(fromResult.zone, toResult.zone, context)
  
  // Override for same panel case
  if (isSamePanel && boundaryType === 'PANEL_TO_PANEL') {
    boundaryType = 'INTERNAL_PANEL'
    reasons.push('Reclassified to INTERNAL_PANEL (same panel)')
  }
  
  // Determine confidence
  let confidence: ClassificationConfidence
  if (fromResult.confidence === 'HIGH' && toResult.confidence === 'HIGH') {
    confidence = 'HIGH'
  } else if (fromResult.confidence === 'LOW' || toResult.confidence === 'LOW') {
    confidence = 'LOW'
  } else {
    confidence = 'MEDIUM'
  }
  
  // Determine execution bucket
  const executionBucket = determineExecutionBucket(boundaryType, confidence)
  
  // Determine if external
  const isExternal = boundaryType !== 'INTERNAL_PANEL'
  
  // Determine if cross-wire
  const isCrossWire = executionBucket === 'CROSS_WIRING'
  
  // Determine if review required
  const requiresReview = executionBucket === 'REVIEW_REQUIRED'
  
  if (requiresReview) {
    reasons.push('Requires Team Lead review due to ambiguous classification')
  }
  
  return {
    connectionId: connection.id,
    isExternal,
    isCrossWire,
    confidence,
    boundaryType,
    executionBucket,
    fromZone: fromResult.zone,
    toZone: toResult.zone,
    reasons,
    requiresReview,
  }
}

/**
 * Classify all connections for an assignment.
 */
export function classifyAssignmentConnectionsByExecutionBucket(
  connections: WireConnection[],
  context?: Partial<ClassificationContext>
): {
  wiring: CrossWireClassification[]
  crossWiring: CrossWireClassification[]
  reviewRequired: CrossWireClassification[]
} {
  const wiring: CrossWireClassification[] = []
  const crossWiring: CrossWireClassification[] = []
  const reviewRequired: CrossWireClassification[] = []
  
  for (const connection of connections) {
    const classification = classifyCrossWireConnection(connection, context)
    
    switch (classification.executionBucket) {
      case 'WIRING':
        wiring.push(classification)
        break
      case 'CROSS_WIRING':
        crossWiring.push(classification)
        break
      case 'REVIEW_REQUIRED':
        reviewRequired.push(classification)
        break
    }
  }
  
  return { wiring, crossWiring, reviewRequired }
}

/**
 * Build a review queue from classifications that need review.
 */
export function buildCrossWireReviewQueue(
  connections: WireConnection[],
  classifications: CrossWireClassification[]
): CrossWireReviewItem[] {
  const reviewItems: CrossWireReviewItem[] = []
  
  for (const classification of classifications) {
    if (!classification.requiresReview) continue
    
    const connection = connections.find(c => c.id === classification.connectionId)
    if (!connection) continue
    
    // Suggest a bucket based on best guess
    let suggestedBucket: WireConnectionExecutionBucket = 'WIRING'
    let suggestedReason = 'Default to WIRING when uncertain'
    
    if (classification.isExternal) {
      suggestedBucket = 'CROSS_WIRING'
      suggestedReason = 'Appears to cross structural boundary'
    }
    
    reviewItems.push({
      connection,
      classification,
      suggestedBucket,
      suggestedReason,
    })
  }
  
  return reviewItems
}

/**
 * Get classification summary for a sheet/project.
 */
export function getClassificationSummary(
  projectId: string,
  sheetName: string,
  connections: WireConnection[],
  context?: Partial<ClassificationContext>
): CrossWireClassificationSummary {
  const classifications: CrossWireClassification[] = []
  
  for (const connection of connections) {
    classifications.push(classifyCrossWireConnection(connection, context))
  }
  
  const { wiring, crossWiring, reviewRequired } = classifyAssignmentConnectionsByExecutionBucket(
    connections,
    context
  )
  
  const reviewQueue = buildCrossWireReviewQueue(connections, classifications)
  
  return {
    projectId,
    sheetName,
    totalConnections: connections.length,
    wiringConnections: wiring.length,
    crossWiringConnections: crossWiring.length,
    reviewRequiredConnections: reviewRequired.length,
    classifications,
    reviewQueue,
    lastClassifiedAt: new Date().toISOString(),
    overrideCount: classifications.filter(c => c.override).length,
  }
}
