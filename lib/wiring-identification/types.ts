/**
 * Wiring Identification Types
 * 
 * This module defines all TypeScript types for the wiring identification system.
 * These types support pattern extraction, filtering, and specialized views.
 */

import type { PartNumberLookupResult } from "@/lib/part-number-list";
import type { SemanticWireListRow } from "@/lib/workbook/types";

// ============================================================================
// Filter Kind Enum
// ============================================================================

/**
 * All available identification filter kinds.
 * Use "default" for normal view, others for specialized filtered views.
 */
export type IdentificationFilterKind =
  | "default"
  | "grounds"
  | "jumpers"
  | "clips"
  | "cables"
  | "single_connections"
  | "af_jumpers"
  | "xt_jumpers"
  | "xt_clips"
  | "ka_jumpers"
  | "ka_relay_plugin_jumpers"
  | "ka_twin_ferrules"
  | "kt_jumpers"
  | "fu_jumpers"
  | "vio_jumpers"
  | "resistors";

// ============================================================================
// Filter Option
// ============================================================================

/**
 * A filter option to display in the dropdown.
 */
export interface IdentificationFilterOption {
  /** The filter kind identifier */
  kind: IdentificationFilterKind;
  /** Display label */
  label: string;
  /** Number of matching rows (for display) */
  count: number;
  /** Whether this filter is available (has matches) */
  available: boolean;
  /** Whether this filter requires Blue Labels */
  requiresBlueLabels: boolean;
  /** Description for tooltip */
  description?: string;
}

// ============================================================================
// Filter Result
// ============================================================================

/**
 * Result of applying an identification filter.
 */
export interface IdentificationFilterResult {
  /** The filter kind that was applied */
  kind: IdentificationFilterKind;
  /** Filtered rows */
  rows: SemanticWireListRow[];
  /** Match metadata for each row (keyed by __rowId) */
  matchMetadata: Record<string, PatternMatchMetadata>;
  /** Summary statistics */
  summary: IdentificationSummary;
}

// ============================================================================
// Presence Detection
// ============================================================================

/**
 * Map indicating which filters have matches in the current data.
 */
export interface IdentificationPresenceMap {
  /** Count of matches for each filter kind */
  counts: Record<IdentificationFilterKind, number>;
  /** Whether Blue Labels data is available */
  hasBlueLabels: boolean;
  /** Current sheet name (for internal/external detection) */
  currentSheetName: string;
}

// ============================================================================
// Blue Labels
// ============================================================================

/**
 * Parsed Blue Labels entry for a single device.
 */
export interface BlueLabelEntry {
  /** The device ID (without terminal) */
  deviceId: string;
  /** The sheet/assignment this device belongs to */
  sheetName: string;
  /** Position in the sequence (0-indexed) */
  sequenceIndex: number;
}

/**
 * Map from device ID to Blue Label entry.
 */
export type BlueLabelMap = Map<string, BlueLabelEntry>;

/**
 * Full Blue Labels sequence map.
 */
export interface BlueLabelSequenceMap {
  /** Map of device ID to entry */
  deviceMap: BlueLabelMap;
  /** Map of sheet name to ordered device list */
  sheetSequences: Map<string, string[]>;
  /** Whether the map was successfully built */
  isValid: boolean;
  /** Any warnings during parsing */
  warnings: string[];
}

// ============================================================================
// Pattern Extraction Context
// ============================================================================

/**
 * Context provided to pattern extractors.
 */
export interface PatternExtractionContext {
  /** All semantic rows in the sheet */
  rows: SemanticWireListRow[];
  /** Blue Labels sequence map (if available) */
  blueLabels: BlueLabelSequenceMap | null;
  /** Current sheet name (for internal/external detection) */
  currentSheetName: string;
  /** Normalized sheet name for matching */
  normalizedSheetName: string;
  /** Device ID to Part Number List lookup map (if available) */
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
}

// ============================================================================
// Pattern Match Types
// ============================================================================

/**
 * Metadata attached to a matched row.
 */
export interface PatternMatchMetadata {
  /** The match type */
  matchType: IdentificationFilterKind;
  /** Human-readable badge label */
  badge: string;
  /** Additional metadata */
  meta: Record<string, string | number | boolean>;
}

/**
 * A row that matched a pattern with its metadata.
 */
export interface PatternMatchRow {
  /** The original row */
  row: SemanticWireListRow;
  /** Match metadata */
  metadata: PatternMatchMetadata;
}

/**
 * A group of related pattern matches.
 */
export interface PatternMatchGroup {
  /** Group identifier */
  groupId: string;
  /** Group label */
  label: string;
  /** Rows in this group */
  rows: PatternMatchRow[];
  /** Group-level metadata */
  groupMeta: Record<string, string | number | boolean>;
}

// ============================================================================
// Specific Match Types
// ============================================================================

/**
 * Ground wire match.
 */
export interface GroundMatch extends PatternMatchRow {
  /** Whether this is internal (same location as sheet) or external */
  isInternal: boolean;
  /** The ground color code */
  groundColor: string;
}

/**
 * Jumper match (generic).
 */
export interface JumperMatch extends PatternMatchRow {
  /** Jumper subtype */
  jumperType: "af" | "xt" | "xt_clip" | "ka" | "kt" | "generic";
  /** From device prefix */
  fromPrefix: string;
  /** To device prefix */
  toPrefix: string;
  /** From terminal */
  fromTerminal: string;
  /** To terminal */
  toTerminal: string;
  /** Whether devices are sequential in Blue Labels */
  isSequential: boolean;
}

/**
 * Twin ferrule match.
 */
export interface TwinFerruleMatch {
  /** The device ID */
  deviceId: string;
  /** The terminal */
  terminal: string;
  /** The wire ID (color) */
  wireId: string;
  /** Rows sharing this terminal */
  rows: SemanticWireListRow[];
  /** Number of wires */
  wireCount: number;
  /** Gauge values */
  gauges: string[];
}

// ============================================================================
// Relay Plugin Jumper Run Types
// ============================================================================

/**
 * Signal type for relay plugin jumper runs.
 * - ESTOP: A1 terminal with ESTOP wire number
 * - 0V: A2 terminal with 0V wire number
 * - GENERIC: A1/A2 terminal with same wireId between adjacent KA devices (not ESTOP/0V)
 */
export type RelayPluginSignalType = "ESTOP" | "0V" | "GENERIC";

/**
 * Terminal type for relay plugin jumper runs.
 */
export type RelayPluginTerminal = "A1" | "A2";

/**
 * A grouped relay plugin jumper run.
 * Represents a continuous sequence of KA relay devices connected by identity jumpers.
 */
export interface RelayPluginJumperRun {
  /** Unique identifier for this run */
  id: string;
  /** Signal type (ESTOP or 0V) */
  signalType: RelayPluginSignalType;
  /** Terminal type (A1 or A2) */
  terminal: RelayPluginTerminal;
  /** Row IDs participating in this run */
  rowIds: string[];
  /** All unique device IDs (unordered) */
  devices: string[];
  /** Devices ordered by Blue Labels sequence */
  orderedDevices: string[];
  /** First device in sequence */
  startDeviceId: string;
  /** Last device in sequence */
  endDeviceId: string;
  /** Count of unique devices in the run */
  deviceCount: number;
  /** Count of identity links (rows) in the run */
  segmentCount: number;
  /** Location context */
  location: string;
  /** Suggested cut length label (e.g., "5-device run") */
  suggestedCutLengthLabel: string;
  /** The actual rows in this run */
  rows: SemanticWireListRow[];
}

/**
 * Result of relay plugin jumper extraction.
 */
export interface RelayPluginJumperResult {
  /** All grouped runs */
  runs: RelayPluginJumperRun[];
  /** All matching rows (for filtering) */
  rows: PatternMatchRow[];
  /** Summary statistics */
  summary: {
    totalRuns: number;
    a1Runs: number;
    a2Runs: number;
    genericRuns: number;
    totalDevices: number;
    totalSegments: number;
  };
}

// ============================================================================
// Summary Statistics
// ============================================================================

/**
 * Summary of identification results.
 */
export interface IdentificationSummary {
  /** Total rows matched */
  totalMatched: number;
  /** Breakdown by subtype (for compound filters like "jumpers") */
  breakdown: Record<string, number>;
  /** Internal vs external (for grounds) */
  internalCount?: number;
  externalCount?: number;
  /** Group count (for clips, twin ferrules) */
  groupCount?: number;
}

// ============================================================================
// Parsed Device Info
// ============================================================================

/**
 * Parsed device ID components.
 */
export interface ParsedDeviceId {
  /** Full original device ID */
  original: string;
  /** Device prefix (e.g., "AF", "XT", "KA") */
  prefix: string;
  /** Numeric portion of the device (e.g., 500 from AF0500) */
  deviceNumeric: number | null;
  /** Terminal portion (e.g., "12" from AF0500:12, "A1" from KA0461:A1) */
  terminal: string;
  /** Terminal numeric value if applicable */
  terminalNumeric: number | null;
  /** Whether parsing was successful */
  isValid: boolean;
}

/**
 * Extended semantic row with parsed device info.
 */
export interface EnrichedSemanticRow extends SemanticWireListRow {
  /** Parsed from device */
  fromParsed: ParsedDeviceId;
  /** Parsed to device */
  toParsed: ParsedDeviceId;
  /** Normalized wire ID (uppercase, trimmed) */
  wireIdNormalized: string;
  /** Gauge as number (null if non-numeric) */
  gaugeNumeric: number | null;
  /** Whether this is a ground candidate (by color) */
  isGroundCandidate: boolean;
  /** Whether destination is internal (same location as sheet) */
  isInternal: boolean;
  /** Whether destination is external */
  isExternal: boolean;
}

// ============================================================================
// Filter Registry Types
// ============================================================================

/**
 * A registered filter definition.
 */
export interface FilterDefinition {
  /** The filter kind */
  kind: IdentificationFilterKind;
  /** Display label */
  label: string;
  /** Description */
  description: string;
  /** Whether this filter requires Blue Labels */
  requiresBlueLabels: boolean;
  /** Function to extract matching rows */
  extractor: (context: PatternExtractionContext) => PatternMatchRow[];
  /** Optional function to get count without full extraction */
  counter?: (context: PatternExtractionContext) => number;
}
