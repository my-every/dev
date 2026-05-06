/**
 * Cross Wire Classification View Model Helpers
 * 
 * Pure functions for classifying wire connections into WIRING, CROSS_WIRING,
 * or REVIEW_REQUIRED execution buckets based on structural zone analysis.
 * 
 * Based on SWS documentation:
 * - Box Cross Wire: panel-to-panel, side rails, left/right doors, harnesses
 * - Console Cross Wire: door routing, harness wiring, communication cables
 */

import type { WireConnection } from '@/types/d380-wiring'
import type {
  ClassificationConfidence,
  ClassificationContext,
  CrossWireClassification,
  CrossWireClassificationSummary,
  CrossWireExecutionPlan,
  CrossWireReviewItem,
  EnclosureType,
  StructuralZoneId,
  WireConnectionExecutionBucket,
  WiringBoundaryType,
} from '@/types/d380-cross-wire'
import {
  isDoorZone,
  isSideRailZone,
  isEnclosureZone,
  STRUCTURAL_ZONE_PATTERNS,
} from '@/types/d380-cross-wire'

// ============================================================================
// ZONE DETECTION
// ============================================================================

/**
 * Parse a location string to detect the structural zone.
 */
export function detectStructuralZone(location: string | null | undefined): StructuralZoneId {
  if (!location) return 'UNKNOWN'
  
  const normalized = location.toUpperCase().trim()
  
  // Check patterns in priority order
  const sortedPatterns = [...STRUCTURAL_ZONE_PATTERNS].sort((a, b) => b.priority - a.priority)
  
  for (const pattern of sortedPatterns) {
    // Check regex patterns
    for (const regex of pattern.patterns) {
      if (regex.test(location)) {
        return pattern.zoneId
      }
    }
    
    // Check keywords
    for (const keyword of pattern.keywords) {
      if (normalized.includes(keyword)) {
        return pattern.zoneId
      }
    }
  }
  
  // Default to PANEL if it looks like a panel reference
  if (/^[A-Z]$|^PNL|^PANEL/.test(normalized)) {
    return 'PANEL'
  }
  
  return 'UNKNOWN'
}

/**
 * Extract panel name from a location string.
 */
export function extractPanelName(location: string | null | undefined): string | null {
  if (!location) return null
  
  // Match patterns like "PNL A", "PANEL B", "A PANEL"
  const match = location.match(/(?:PNL|PANEL)\s*([A-Z])|([A-Z])\s*(?:PNL|PANEL)/i)
  if (match) {
    return (match[1] || match[2]).toUpperCase()
  }
  
  // Match standalone letters that might be panel refs
  const letterMatch = location.match(/^([A-Z])$/i)
  if (letterMatch) {
    return letterMatch[1].toUpperCase()
  }
  
  return null
}

// ============================================================================
// BOUNDARY TYPE DETERMINATION
// ============================================================================

/**
 * Determine the boundary type between two structural zones.
 */
export function determineBoundaryType(
  fromZone: StructuralZoneId,
  toZone: StructuralZoneId,
  context: Partial<ClassificationContext> = {}
): WiringBoundaryType {
  // Same zone = internal
  if (fromZone === toZone && fromZone === 'PANEL') {
    // Check if they're the same panel
    return 'INTERNAL_PANEL'
  }
  
  // Panel to panel
  if (fromZone === 'PANEL' && toZone === 'PANEL') {
    return 'PANEL_TO_PANEL'
  }
  
  // Panel to door
  if (fromZone === 'PANEL' && isDoorZone(toZone)) {
    return 'PANEL_TO_DOOR'
  }
  if (isDoorZone(fromZone) && toZone === 'PANEL') {
    return 'PANEL_TO_DOOR'
  }
  
  // Panel to side rail
  if (fromZone === 'PANEL' && isSideRailZone(toZone)) {
    return 'PANEL_TO_SIDE_RAIL'
  }
  if (isSideRailZone(fromZone) && toZone === 'PANEL') {
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
  if (isDoorZone(fromZone) && isDoorZone(toZone) && fromZone !== toZone) {
    return 'DOOR_TO_DOOR'
  }
  
  // Door to console
  if (isDoorZone(fromZone) && toZone === 'CONSOLE') {
    return 'DOOR_TO_CONSOLE'
  }
  if (fromZone === 'CONSOLE' && isDoorZone(toZone)) {
    return 'DOOR_TO_CONSOLE'
  }
  
  // Harness internal
  if (fromZone === 'HARNESS' || toZone === 'HARNESS') {
    return 'HARNESS_INTERNAL'
  }
  
  // Unknown external if zones differ
  if (fromZone !== toZone) {
    return 'UNKNOWN_EXTERNAL'
  }
  
  return 'INTERNAL_PANEL'
}

// ============================================================================
// CLASSIFICATION RULES
// ============================================================================

/**
 * Classify a single wire connection based on structural zone analysis.
 */
export function classifyConnectionBoundary(
  connection: WireConnection,
  context: Partial<ClassificationContext> = {}
): CrossWireClassification {
  const fromZone = detectStructuralZone(connection.fromLocation)
  const toZone = detectStructuralZone(connection.toLocation)
  const boundaryType = determineBoundaryType(fromZone, toZone, context)
  
  const fromPanel = extractPanelName(connection.fromLocation)
  const toPanel = extractPanelName(connection.toLocation)
  const currentPanel = context.currentPanel
  
  const reasons: string[] = []
  let isCrossWire = false
  let confidence: ClassificationConfidence = 'HIGH'
  let executionBucket: WireConnectionExecutionBucket = 'WIRING'
  
  // Rule 1: Different physical zones
  if (fromZone !== toZone) {
    reasons.push(`Connection crosses structural zones: ${fromZone} to ${toZone}`)
    
    // Rule 2: Cross-wire structural targets
    if (isDoorZone(fromZone) || isDoorZone(toZone)) {
      isCrossWire = true
      confidence = 'HIGH'
      reasons.push('Involves door zone (left/right door)')
    } else if (isSideRailZone(fromZone) || isSideRailZone(toZone)) {
      isCrossWire = true
      confidence = 'HIGH'
      reasons.push('Involves side rail connection')
    } else if (isEnclosureZone(fromZone) || isEnclosureZone(toZone)) {
      isCrossWire = true
      confidence = 'MEDIUM'
      reasons.push('Involves enclosure structure (box/console)')
    }
  }
  
  // Rule 3: Panel-to-panel
  if (boundaryType === 'PANEL_TO_PANEL') {
    if (fromPanel && toPanel && fromPanel !== toPanel) {
      isCrossWire = true
      confidence = 'HIGH'
      reasons.push(`Panel-to-panel connection: ${fromPanel} to ${toPanel}`)
    } else if (fromPanel !== currentPanel || toPanel !== currentPanel) {
      // One end is outside current panel
      isCrossWire = true
      confidence = 'MEDIUM'
      reasons.push('Connection leaves current panel scope')
    }
  }
  
  // Rule 4: Door harness routing (Console Cross Wire specific)
  if (connection.harnessId && (isDoorZone(fromZone) || isDoorZone(toZone))) {
    isCrossWire = true
    confidence = 'HIGH'
    reasons.push('Door harness routing detected')
  }
  
  // Rule 5: Side rail routing (Box Cross Wire specific)
  if (isSideRailZone(fromZone) || isSideRailZone(toZone)) {
    isCrossWire = true
    confidence = 'HIGH'
    reasons.push('Side rail routing detected')
  }
  
  // Rule 6: Communication cables crossing boundaries
  if (connection.isCable && boundaryType !== 'INTERNAL_PANEL') {
    isCrossWire = true
    confidence = 'HIGH'
    reasons.push('Communication cable crosses structural boundary')
  }
  
  // Rule 7: Ground wires to structural elements
  if (connection.isGround && (isSideRailZone(toZone) || isDoorZone(toZone) || isEnclosureZone(toZone))) {
    isCrossWire = true
    confidence = 'HIGH'
    reasons.push('Ground wire to structural element')
  }
  
  // Determine execution bucket
  if (isCrossWire) {
    executionBucket = confidence === 'LOW' ? 'REVIEW_REQUIRED' : 'CROSS_WIRING'
  } else if (boundaryType === 'UNKNOWN_EXTERNAL') {
    // External but not clearly cross-wire
    executionBucket = 'REVIEW_REQUIRED'
    confidence = 'LOW'
    reasons.push('External connection but boundary type unclear')
  }
  
  const isExternal = boundaryType !== 'INTERNAL_PANEL'
  
  return {
    connectionId: connection.id,
    isExternal,
    isCrossWire,
    confidence,
    boundaryType,
    executionBucket,
    fromZone,
    toZone,
    reasons,
    requiresReview: executionBucket === 'REVIEW_REQUIRED',
  }
}

/**
 * Determine the execution bucket for a connection.
 */
export function bucketConnectionByExecutionStage(
  connection: WireConnection,
  context: Partial<ClassificationContext> = {}
): WireConnectionExecutionBucket {
  const classification = classifyConnectionBoundary(connection, context)
  return classification.executionBucket
}

// ============================================================================
// CONNECTION LIST BUILDERS
// ============================================================================

/**
 * Build the list of connections for the WIRING stage.
 */
export function buildWiringConnections(
  connections: WireConnection[],
  context: Partial<ClassificationContext> = {}
): WireConnection[] {
  return connections.filter(conn => {
    const bucket = bucketConnectionByExecutionStage(conn, context)
    return bucket === 'WIRING'
  })
}

/**
 * Build the list of connections for the CROSS_WIRING stage.
 */
export function buildCrossWiringConnections(
  connections: WireConnection[],
  context: Partial<ClassificationContext> = {}
): WireConnection[] {
  return connections.filter(conn => {
    const bucket = bucketConnectionByExecutionStage(conn, context)
    return bucket === 'CROSS_WIRING'
  })
}

/**
 * Build the review queue for connections needing Team Lead classification.
 */
export function buildCrossWireReviewQueue(
  connections: WireConnection[],
  context: Partial<ClassificationContext> = {}
): CrossWireReviewItem[] {
  return connections
    .map(conn => {
      const classification = classifyConnectionBoundary(conn, context)
      if (classification.requiresReview) {
        return {
          connection: conn,
          classification,
          suggestedBucket: classification.isCrossWire ? 'CROSS_WIRING' : 'WIRING',
          suggestedReason: classification.reasons.join('; '),
        } as CrossWireReviewItem
      }
      return null
    })
    .filter((item): item is CrossWireReviewItem => item !== null)
}

// ============================================================================
// CLASSIFICATION SUMMARY
// ============================================================================

/**
 * Build a complete classification summary for a set of connections.
 */
export function buildCrossWireClassificationSummary(
  projectId: string,
  sheetName: string,
  connections: WireConnection[],
  context: Partial<ClassificationContext> = {}
): CrossWireClassificationSummary {
  const classifications = connections.map(conn => 
    classifyConnectionBoundary(conn, context)
  )
  
  const wiringConnections = classifications.filter(c => c.executionBucket === 'WIRING').length
  const crossWiringConnections = classifications.filter(c => c.executionBucket === 'CROSS_WIRING').length
  const reviewRequiredConnections = classifications.filter(c => c.executionBucket === 'REVIEW_REQUIRED').length
  
  const reviewQueue = buildCrossWireReviewQueue(connections, context)
  const overrideCount = classifications.filter(c => c.override).length
  
  return {
    projectId,
    sheetName,
    totalConnections: connections.length,
    wiringConnections,
    crossWiringConnections,
    reviewRequiredConnections,
    classifications,
    reviewQueue,
    lastClassifiedAt: new Date().toISOString(),
    overrideCount,
  }
}

// ============================================================================
// EXECUTION PLAN BUILDER
// ============================================================================

/**
 * Build an execution plan for the cross-wiring stage.
 * Organizes connections by routing type as specified in SWS documentation.
 */
export function buildCrossWireExecutionPlan(
  connections: WireConnection[],
  context: Partial<ClassificationContext> = {}
): CrossWireExecutionPlan {
  const crossWireConnections = buildCrossWiringConnections(connections, context)
  const reviewQueue = buildCrossWireReviewQueue(connections, context)
  
  const plan: CrossWireExecutionPlan = {
    panelToPanelConnections: [],
    leftDoorConnections: [],
    rightDoorConnections: [],
    sideRailConnections: [],
    groundConnections: [],
    communicationCables: [],
    otherConnections: [],
    pendingReview: reviewQueue,
  }
  
  for (const conn of crossWireConnections) {
    const classification = classifyConnectionBoundary(conn, context)
    
    // Categorize by boundary type and zone
    if (classification.boundaryType === 'PANEL_TO_PANEL') {
      plan.panelToPanelConnections.push(conn)
    } else if (classification.fromZone === 'LEFT_DOOR' || classification.toZone === 'LEFT_DOOR') {
      plan.leftDoorConnections.push(conn)
    } else if (classification.fromZone === 'RIGHT_DOOR' || classification.toZone === 'RIGHT_DOOR') {
      plan.rightDoorConnections.push(conn)
    } else if (isSideRailZone(classification.fromZone) || isSideRailZone(classification.toZone)) {
      plan.sideRailConnections.push(conn)
    } else if (conn.isGround) {
      plan.groundConnections.push(conn)
    } else if (conn.isCable) {
      plan.communicationCables.push(conn)
    } else {
      plan.otherConnections.push(conn)
    }
  }
  
  return plan
}

// ============================================================================
// ENCLOSURE TYPE DETECTION
// ============================================================================

/**
 * Detect enclosure type from project/drawing context.
 */
export function detectEnclosureType(drawingTitle: string): EnclosureType {
  const normalized = drawingTitle.toUpperCase()
  
  if (normalized.includes('CONSOLE') || normalized.includes('CON ')) {
    return 'CONSOLE'
  }
  if (normalized.includes('BOX') || normalized.includes('ENCLOSURE')) {
    return 'BOX'
  }
  if (normalized.includes('SKID')) {
    return 'SKID'
  }
  
  return 'UNKNOWN'
}

/**
 * Get the appropriate SWS type for cross-wiring based on enclosure type.
 */
export function getCrossWireSwsType(enclosureType: EnclosureType): string {
  switch (enclosureType) {
    case 'BOX':
      return 'BOX_CROSS_WIRE'
    case 'CONSOLE':
      return 'CONSOLE_CROSS_WIRE'
    default:
      return 'BOX_CROSS_WIRE' // Default to box cross wire
  }
}
