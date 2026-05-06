/**
 * D380 Parts Catalog Type Definitions
 * 
 * Comprehensive types for part catalog records, image sets,
 * instruction notes, associated parts, and lookup results.
 */

// ============================================================================
// PART CATALOG RECORD
// ============================================================================

/**
 * Part category classification.
 */
export type PartCategory =
  | 'Grounding & Busbars'
  | 'Wire Ferrules'
  | 'Terminal Blocks & Accessories'
  | 'Ring Terminals'
  | 'Fork Terminals'
  | 'DIN Rail & Mounting'
  | 'Passive Components'
  | 'Diodes & Suppression'
  | 'Measurement & Shunts'
  | 'Control Relays'
  | 'Relay Sockets'
  | 'Timing Relays'
  | 'Protection Relays'
  | 'Circuit Protection'
  | 'Control Power'
  | 'Power Conversion'
  | 'Operator Controls'
  | 'Pilot Lights & Indicators'
  | 'Panel Lighting'
  | 'Alarm Devices'
  | 'Panel Hardware'
  | 'Cable Management'
  | 'Wire Management'
  | 'Wire Duct & Panduit'
  | 'HMI & Operator Interface'
  | 'Industrial Computing'
  | 'Industrial Networking'
  | 'Gateway & Protocol Conversion'
  | 'Time Synchronization'
  | 'Counters & Timers'
  | 'PLC Control Platform'
  | 'PLC Rack Hardware'
  | 'PLC Communication Modules'
  | 'Safety Control System'
  | 'Control Modules'
  | 'Signal Conditioning'
  | 'Distributed I/O'
  | 'Condition Monitoring I/O'
  | 'Unknown'

/**
 * Mount type for physical installation.
 */
export type MountType =
  | 'DIN_RAIL'
  | 'PANEL_MOUNT'
  | 'SURFACE_MOUNT'
  | 'BUSBAR_MOUNT'
  | 'RACK_MOUNT'
  | 'TERMINAL_BLOCK'
  | 'UNKNOWN'

/**
 * Image view angle/type for reference images.
 */
export type ImageViewType =
  | 'front'
  | 'back'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'installed'
  | 'wiring_diagram'
  | 'schematic'
  | 'icon'

/**
 * A single image in a catalog image set.
 */
export interface CatalogImage {
  /** URL/path to the image */
  src: string
  /** View type/angle */
  viewType: ImageViewType
  /** Optional label */
  label?: string
  /** Alt text for accessibility */
  alt?: string
  /** Width in pixels (if known) */
  width?: number
  /** Height in pixels (if known) */
  height?: number
}

/**
 * Complete image set for a catalog entry.
 */
export interface CatalogImageSet {
  /** Primary reference image */
  primary?: CatalogImage
  /** Icon for compact display */
  icon?: CatalogImage
  /** All available images */
  images: CatalogImage[]
  /** Wiring diagrams if available */
  diagrams: CatalogImage[]
}

/**
 * Instruction note for assembly or installation.
 */
export interface CatalogInstructionNote {
  /** Note type */
  type: 'DO' | 'DONT' | 'WARNING' | 'CAUTION' | 'INFO' | 'TIP'
  /** Note text */
  text: string
  /** Applies to specific stages? */
  stages?: string[]
  /** Priority for display ordering */
  priority?: number
}

/**
 * Associated part that pairs with or complements this part.
 */
export interface CatalogAssociatedPart {
  /** Part number of associated part */
  partNumber: string
  /** Operationship type */
  operationship: 'REQUIRES' | 'RECOMMENDED' | 'ALTERNATIVE' | 'ACCESSORY' | 'MOUNTING'
  /** Quantity typically needed */
  quantity?: number
  /** Optional description of operationship */
  description?: string
}

/**
 * Tool reference for assembly or installation.
 */
export interface CatalogToolReference {
  /** Tool name */
  name: string
  /** Tool type */
  type: 'CRIMP' | 'TORQUE' | 'STRIP' | 'CUT' | 'DRIVER' | 'OTHER'
  /** Specific model/specification */
  specification?: string
  /** Required or optional */
  required: boolean
}

/**
 * Complete part catalog record.
 */
export interface PartCatalogRecord {
  /** Primary part number (unique identifier) */
  partNumber: string
  /** Human-readable description */
  description: string
  /** Part category */
  category: PartCategory
  /** Subcategory if applicable */
  subcategory?: string
  
  /** Alternate part numbers */
  alternatePartNumbers?: string[]
  /** Device prefix patterns this part typically uses */
  devicePrefixes?: string[]
  
  /** Mount type */
  mountType?: MountType
  /** AWG wire sizes this part accepts (for terminals) */
  wireGauges?: string[]
  /** Voltage rating if applicable */
  voltageRating?: string
  /** Current rating if applicable */
  currentRating?: string
  
  /** Image set */
  images: CatalogImageSet
  
  /** Associated parts */
  associatedParts?: CatalogAssociatedPart[]
  /** Tool references */
  tools?: CatalogToolReference[]
  /** Instruction notes */
  notes?: CatalogInstructionNote[]
  
  /** Manufacturer */
  manufacturer?: string
  /** Manufacturer part number */
  manufacturerPartNumber?: string
  
  /** Source of this record */
  source: 'LIBRARY_CSV' | 'PROJECT_REFERENCE' | 'MANUAL_ENTRY' | 'INFERRED'
}

// ============================================================================
// CATALOG LOOKUP RESULTS
// ============================================================================

/**
 * Match confidence level.
 */
export type MatchConfidence = 'EXACT' | 'ALTERNATE' | 'PREFIX' | 'FUZZY' | 'NONE'

/**
 * Result of a catalog lookup operation.
 */
export interface CatalogLookupResult {
  /** Whether a match was found */
  found: boolean
  /** The matched record (if found) */
  record?: PartCatalogRecord
  /** Confidence of the match */
  confidence: MatchConfidence
  /** Confidence score (0-100) */
  confidenceScore: number
  /** How the match was made */
  matchedBy: 'EXACT_PART_NUMBER' | 'ALTERNATE_PART_NUMBER' | 'DEVICE_PREFIX' | 'FUZZY_MATCH' | 'NOT_FOUND'
  /** The query that was searched */
  query: string
  /** Reasons for the match result */
  reasons: string[]
}

/**
 * Batch lookup result for multiple parts.
 */
export interface CatalogBatchLookupResult {
  /** Total parts queried */
  totalQueried: number
  /** Parts found with exact match */
  exactMatches: number
  /** Parts found with alternate match */
  alternateMatches: number
  /** Parts found with prefix fallback */
  prefixMatches: number
  /** Parts not found */
  notFound: number
  /** Individual results */
  results: CatalogLookupResult[]
}

// ============================================================================
// CATALOG INDEX TYPES
// ============================================================================

/**
 * Index entry for fast lookup.
 */
export interface CatalogIndexEntry {
  /** Part number this entry points to */
  partNumber: string
  /** Index type */
  indexType: 'PRIMARY' | 'ALTERNATE' | 'PREFIX'
}

/**
 * Complete catalog with indexes.
 */
export interface PartCatalog {
  /** All records by primary part number */
  records: Map<string, PartCatalogRecord>
  /** Index by normalized part number (for case-insensitive lookup) */
  byPartNumber: Map<string, CatalogIndexEntry>
  /** Index by alternate part numbers */
  byAlternate: Map<string, CatalogIndexEntry>
  /** Index by device prefix */
  byDevicePrefix: Map<string, CatalogIndexEntry[]>
  /** Index by category */
  byCategory: Map<PartCategory, PartCatalogRecord[]>
  /** Catalog metadata */
  metadata: {
    /** Total record count */
    recordCount: number
    /** When catalog was built */
    builtAt: string
    /** Source files used */
    sources: string[]
  }
}

// ============================================================================
// REFERENCE SHEET TYPES
// ============================================================================

/**
 * Reference sheet type enumeration.
 */
export type ReferenceSheetType =
  | 'PART_NUMBER_LIST'
  | 'CABLE_PART_NUMBERS'
  | 'BLUE_LABELS'
  | 'WHITE_LABELS'
  | 'HEAT_SHRINK_LABELS'
  | 'PANEL_ERRORS'
  | 'UNKNOWN'

/**
 * Normalized reference from a reference sheet.
 */
export interface NormalizedReference {
  /** Reference type */
  type: ReferenceSheetType
  /** Part number (if applicable) */
  partNumber?: string
  /** Device ID (if applicable) */
  deviceId?: string
  /** Wire ID (if applicable) */
  wireId?: string
  /** Label text (for label sheets) */
  labelText?: string
  /** Quantity */
  quantity?: number
  /** Description */
  description?: string
  /** Error message (for error sheets) */
  errorMessage?: string
  /** Row index in original sheet */
  sourceRow: number
  /** Source sheet name */
  sourceSheet: string
}

/**
 * Merged project reference data from all reference sheets.
 */
export interface ProjectReferenceData {
  /** Project ID */
  projectId: string
  /** Part number list entries */
  partNumbers: NormalizedReference[]
  /** Cable part numbers */
  cablePartNumbers: NormalizedReference[]
  /** Blue labels */
  blueLabels: NormalizedReference[]
  /** White labels */
  whiteLabels: NormalizedReference[]
  /** Heat shrink labels */
  heatShrinkLabels: NormalizedReference[]
  /** Panel errors */
  panelErrors: NormalizedReference[]
  /** Build timestamp */
  builtAt: string
  /** Source sheets used */
  sourceSheets: string[]
}

// ============================================================================
// ASSIGNMENT COMPONENT TYPES
// ============================================================================

/**
 * Component source enumeration.
 */
export type ComponentSource =
  | 'WIRE_LIST'
  | 'PART_NUMBER_LIST'
  | 'LAYOUT_EXTRACTION'
  | 'REFERENCE_SHEET'
  | 'CATALOG_MATCH'
  | 'MANUAL_ENTRY'

/**
 * Normalized component for an assignment.
 * Combines data from wire list, part numbers, layout, and catalog.
 */
export interface NormalizedAssignmentComponent {
  /** Unique component ID within assignment */
  componentId: string
  /** Device ID (e.g., "KA0561") */
  deviceId: string
  /** Terminal (if applicable, e.g., "A1") */
  terminal?: string
  /** Full device ID with terminal */
  fullDeviceId: string
  
  /** Part number(s) from various sources */
  partNumbers: string[]
  /** Primary part number (resolved) */
  primaryPartNumber?: string
  
  /** Description from catalog or reference */
  description?: string
  /** Category from catalog */
  category?: PartCategory
  
  /** Catalog lookup result */
  catalogMatch?: CatalogLookupResult
  
  /** Reference image from catalog or static */
  referenceImage?: CatalogImage
  /** Icon for compact display */
  icon?: CatalogImage
  
  /** Associated parts from catalog */
  associatedParts?: CatalogAssociatedPart[]
  /** Notes from catalog */
  notes?: CatalogInstructionNote[]
  
  /** Wire connections to this component */
  wireConnections: {
    wireId: string
    fromOrTo: 'FROM' | 'TO'
    otherDeviceId: string
    signal?: string
  }[]
  
  /** Data sources for this component */
  sources: ComponentSource[]
  /** Confidence in the merged data */
  confidence: number
  /** Reasons for confidence score */
  reasons: string[]
}

/**
 * Assignment component summary for an entire assignment.
 */
export interface AssignmentComponentSummary {
  /** Assignment ID */
  assignmentId: string
  /** Sheet name */
  sheetName: string
  
  /** Total components */
  totalComponents: number
  /** Components with catalog matches */
  catalogMatched: number
  /** Components with reference images */
  withImages: number
  /** Components with notes */
  withNotes: number
  
  /** All normalized components */
  components: NormalizedAssignmentComponent[]
  
  /** Components by category */
  byCategory: Map<PartCategory, NormalizedAssignmentComponent[]>
  
  /** Build timestamp */
  builtAt: string
}
