/**
 * Cross Wire Classification Types
 * 
 * Defines the classification system for determining whether a wire connection
 * belongs to WIRING (internal panel), CROSS_WIRING (structural boundary crossing),
 * or requires manual review.
 * 
 * Based on SWS documentation:
 * - Panel Wire: connections within same panel execution zone
 * - Box Cross Wire: panel-to-panel, side rails, left/right doors, grounds, cables
 * - Console Cross Wire: door harnesses, panel-to-door, communication cables
 */

import type { WireConnection, WiringGauge, WireColorId } from './d380-wiring'

// ============================================================================
// STRUCTURAL ZONE TYPES
// ============================================================================

/**
 * Physical zones that define structural boundaries for cross-wire detection.
 * Connections crossing these zones are candidates for cross-wire classification.
 */
export type StructuralZoneId =
  | 'PANEL'           // Internal panel zone (PNL A, PNL B, etc.)
  | 'LEFT_DOOR'       // Left door of box/console
  | 'RIGHT_DOOR'      // Right door of box/console
  | 'DOOR'            // Generic door (when side not specified)
  | 'LEFT_SIDE_RAIL'  // Left side rail
  | 'RIGHT_SIDE_RAIL' // Right side rail
  | 'SIDE_RAIL'       // Generic side rail
  | 'BOX'             // Box enclosure structure
  | 'CONSOLE'         // Console structure
  | 'HARNESS'         // Wire harness zone
  | 'UNKNOWN'         // Unclassified location

/**
 * Enclosure type that affects cross-wire routing patterns
 */
export type EnclosureType = 'BOX' | 'CONSOLE' | 'SKID' | 'UNKNOWN'

// ============================================================================
// WIRING BOUNDARY CLASSIFICATION
// ============================================================================

/**
 * Classification of the boundary type a wire connection crosses.
 * Used to determine the correct execution stage (WIRING vs CROSS_WIRING).
 */
export type WiringBoundaryType =
  | 'INTERNAL_PANEL'      // Wire stays within same panel zone
  | 'PANEL_TO_PANEL'      // Wire crosses from one panel to another panel
  | 'PANEL_TO_DOOR'       // Wire goes from panel to left/right door
  | 'PANEL_TO_SIDE_RAIL'  // Wire goes from panel to side rail
  | 'PANEL_TO_BOX'        // Wire goes from panel to box structure
  | 'PANEL_TO_CONSOLE'    // Wire goes from panel to console structure
  | 'DOOR_TO_DOOR'        // Wire crosses between doors
  | 'DOOR_TO_CONSOLE'     // Wire from door harness to console interior
  | 'HARNESS_INTERNAL'    // Wire within a harness (door-to-console routing)
  | 'UNKNOWN_EXTERNAL'    // External but boundary type unclear

/**
 * Confidence level for the classification decision.
 * LOW confidence triggers REVIEW_REQUIRED bucket.
 */
export type ClassificationConfidence = 'LOW' | 'MEDIUM' | 'HIGH'

/**
 * The execution bucket that determines which workflow stage handles the wire.
 */
export type WireConnectionExecutionBucket =
  | 'WIRING'           // Handle in panel wiring stage
  | 'CROSS_WIRE'       // Handle in cross-wiring stage
  | 'REVIEW_REQUIRED'  // Ambiguous - needs Team Lead review

// ============================================================================
// CROSS WIRE CLASSIFICATION RESULT
// ============================================================================

/**
 * Complete classification result for a wire connection.
 * Contains all the information needed to route the connection to the correct
 * execution stage and support Team Lead review when needed.
 */
export interface CrossWireClassification {
  /** Original connection ID for traceability */
  connectionId: string

  /** Whether the connection crosses any structural boundary */
  isExternal: boolean

  /** Final classification as cross-wire */
  isCrossWire: boolean

  /** Confidence in the classification decision */
  confidence: ClassificationConfidence

  /** The type of boundary being crossed */
  boundaryType: WiringBoundaryType

  /** The execution stage bucket for this connection */
  executionBucket: WireConnectionExecutionBucket

  /** Structured zones involved in the connection */
  fromZone: StructuralZoneId
  toZone: StructuralZoneId

  /** Human-readable reasons for the classification */
  reasons: string[]

  /** Whether Team Lead override is recommended */
  requiresReview: boolean

  /** Optional Team Lead override applied */
  override?: CrossWireOverride
}

/**
 * Team Lead override for a classification decision.
 * Applied when auto-classification is incorrect or ambiguous.
 */
export interface CrossWireOverride {
  /** Badge of the Team Lead who applied the override */
  overriddenBy: string

  /** When the override was applied */
  overriddenAt: string

  /** The original auto-classified bucket */
  originalBucket: WireConnectionExecutionBucket

  /** The Team Lead's chosen bucket */
  overrideBucket: WireConnectionExecutionBucket

  /** Reason for the override */
  reason: string
}

// ============================================================================
// STRUCTURAL ZONE DETECTION PATTERNS
// ============================================================================

/**
 * Pattern for detecting structural zones from location strings.
 * Used to parse location references like "PNL A", "LEFT DOOR", "SIDE RAIL", etc.
 */
export interface StructuralZonePattern {
  zoneId: StructuralZoneId
  patterns: RegExp[]
  keywords: string[]
  priority: number
}

/**
 * Default zone detection patterns based on SWS documentation.
 */
export const STRUCTURAL_ZONE_PATTERNS: StructuralZonePattern[] = [
  {
    zoneId: 'LEFT_DOOR',
    patterns: [/left\s*door/i, /l[\.\s]?door/i, /door\s*l/i],
    keywords: ['LEFT DOOR', 'L DOOR', 'LDOOR'],
    priority: 10,
  },
  {
    zoneId: 'RIGHT_DOOR',
    patterns: [/right\s*door/i, /r[\.\s]?door/i, /door\s*r/i],
    keywords: ['RIGHT DOOR', 'R DOOR', 'RDOOR'],
    priority: 10,
  },
  {
    zoneId: 'DOOR',
    patterns: [/^door$/i, /door\s*panel/i],
    keywords: ['DOOR'],
    priority: 5,
  },
  {
    zoneId: 'LEFT_SIDE_RAIL',
    patterns: [/left\s*side\s*rail/i, /l[\.\s]?rail/i, /lsr/i],
    keywords: ['LEFT SIDE RAIL', 'L RAIL', 'LSR'],
    priority: 10,
  },
  {
    zoneId: 'RIGHT_SIDE_RAIL',
    patterns: [/right\s*side\s*rail/i, /r[\.\s]?rail/i, /rsr/i],
    keywords: ['RIGHT SIDE RAIL', 'R RAIL', 'RSR'],
    priority: 10,
  },
  {
    zoneId: 'SIDE_RAIL',
    patterns: [/side\s*rail/i, /rail/i],
    keywords: ['SIDE RAIL', 'RAIL'],
    priority: 5,
  },
  {
    zoneId: 'BOX',
    patterns: [/^box$/i, /box\s*panel/i, /enclosure/i],
    keywords: ['BOX', 'ENCLOSURE'],
    priority: 3,
  },
  {
    zoneId: 'CONSOLE',
    patterns: [/^console$/i, /console\s*panel/i],
    keywords: ['CONSOLE', 'CON'],
    priority: 3,
  },
  {
    zoneId: 'HARNESS',
    patterns: [/harness/i, /harn/i],
    keywords: ['HARNESS', 'HARN'],
    priority: 8,
  },
  {
    zoneId: 'PANEL',
    patterns: [/pnl\s*[a-z]/i, /panel\s*[a-z]/i, /^pnl$/i, /^panel$/i],
    keywords: ['PNL', 'PANEL'],
    priority: 1,
  },
]

// ============================================================================
// CROSS WIRE CLASSIFICATION RULES
// ============================================================================

/**
 * Rule definition for cross-wire classification.
 * Rules are evaluated in priority order (higher priority first).
 */
export interface CrossWireClassificationRule {
  id: string
  name: string
  description: string
  priority: number

  /** Function to check if the rule applies */
  matches: (connection: WireConnection, context: ClassificationContext) => boolean

  /** Result when the rule matches */
  result: {
    isCrossWire: boolean
    boundaryType: WiringBoundaryType
    confidence: ClassificationConfidence
    executionBucket: WireConnectionExecutionBucket
  }
}

/**
 * Context information for classification decisions.
 */
export interface ClassificationContext {
  /** The panel/sheet being worked on */
  currentPanel: string

  /** The enclosure type (BOX or CONSOLE) */
  enclosureType: EnclosureType

  /** Parsed zone for the from location */
  fromZone: StructuralZoneId

  /** Parsed zone for the to location */
  toZone: StructuralZoneId

  /** All known panel names in this project */
  knownPanels: string[]

  /** Whether the connection involves a cable */
  isCable: boolean

  /** Whether the connection is a ground */
  isGround: boolean

  /** Whether the connection requires a harness */
  requiresHarness: boolean
}

// ============================================================================
// CROSS WIRE REVIEW QUEUE
// ============================================================================

/**
 * Review queue entry for connections needing Team Lead classification.
 */
export interface CrossWireReviewItem {
  connection: WireConnection
  classification: CrossWireClassification
  suggestedBucket: WireConnectionExecutionBucket
  suggestedReason: string
  reviewedBy?: string
  reviewedAt?: string
  finalBucket?: WireConnectionExecutionBucket
  reviewNotes?: string
}

/**
 * Summary of cross-wire classification results for a project/sheet.
 */
export interface CrossWireClassificationSummary {
  projectId: string
  sheetName: string
  totalConnections: number
  wiringConnections: number
  crossWiringConnections: number
  reviewRequiredConnections: number
  classifications: CrossWireClassification[]
  reviewQueue: CrossWireReviewItem[]
  lastClassifiedAt: string
  overrideCount: number
}

// ============================================================================
// CROSS WIRE EXECUTION PLAN
// ============================================================================

/**
 * Execution plan for cross-wiring stage, organized by structural routing.
 */
export interface CrossWireExecutionPlan {
  /** Panel-to-panel connections */
  panelToPanelConnections: WireConnection[]

  /** Left door harness connections */
  leftDoorConnections: WireConnection[]

  /** Right door harness connections */
  rightDoorConnections: WireConnection[]

  /** Side rail connections */
  sideRailConnections: WireConnection[]

  /** Ground wire connections */
  groundConnections: WireConnection[]

  /** Communication cable connections */
  communicationCables: WireConnection[]

  /** Other cross-wiring connections */
  otherConnections: WireConnection[]

  /** Connections requiring review before execution */
  pendingReview: CrossWireReviewItem[]
}

// ============================================================================
// TYPE GUARDS AND HELPERS
// ============================================================================

/**
 * Check if a boundary type represents a cross-wire boundary
 */
export function isCrossWireBoundary(boundaryType: WiringBoundaryType): boolean {
  return boundaryType !== 'INTERNAL_PANEL'
}

/**
 * Check if a zone is a door zone
 */
export function isDoorZone(zone: StructuralZoneId): boolean {
  return zone === 'LEFT_DOOR' || zone === 'RIGHT_DOOR' || zone === 'DOOR'
}

/**
 * Check if a zone is a side rail zone
 */
export function isSideRailZone(zone: StructuralZoneId): boolean {
  return zone === 'LEFT_SIDE_RAIL' || zone === 'RIGHT_SIDE_RAIL' || zone === 'SIDE_RAIL'
}

/**
 * Check if a zone is an enclosure zone (box/console)
 */
export function isEnclosureZone(zone: StructuralZoneId): boolean {
  return zone === 'BOX' || zone === 'CONSOLE'
}

/**
 * Get the enclosure type from a zone
 */
export function getEnclosureTypeFromZone(zone: StructuralZoneId): EnclosureType {
  if (zone === 'BOX') return 'BOX'
  if (zone === 'CONSOLE') return 'CONSOLE'
  return 'UNKNOWN'
}
