/**
 * Wire Length Estimation Types
 * 
 * Core types for the wire length estimation subsystem.
 * This module computes approximate wire lengths using:
 * - Blue Labels device sequence
 * - Part List device dimensions
 * - Layout PDF geometry
 */

// ============================================================================
// Layout PDF Types
// ============================================================================

/**
 * A text node extracted from the layout PDF.
 */
export interface LayoutTextNode {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

/**
 * A device node detected in the layout.
 */
export interface LayoutDeviceNode {
  deviceId: string;
  prefix: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  railId?: string;
  panelId?: string;
}

/**
 * A rail detected in the layout.
 */
export interface LayoutRail {
  id: string;
  x: number;
  y: number;
  length: number;
  orientation: "horizontal" | "vertical";
  devices: LayoutDeviceNode[];
}

/**
 * A panduct (wire duct) node in the layout.
 */
export interface PanductNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  orientation: "horizontal" | "vertical";
}

/**
 * A ground or bonding point detected in the layout.
 */
export interface LayoutGroundPoint {
  id: string;
  x: number;
  y: number;
  label: string;
  kind: "frame-ground" | "rail-ground" | "bonding-point";
  railId?: string;
}

// ============================================================================
// Geometry Types
// ============================================================================

/**
 * A 2D point.
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * A segment of a wire path.
 */
export interface PathSegment {
  kind: "horizontal" | "vertical" | "entry" | "exit" | "service-loop";
  from: Point;
  to: Point;
  length: number;
}

// ============================================================================
// Device Catalog Types
// ============================================================================

/**
 * Terminal face position on a device.
 */
export type TerminalFace = "top" | "bottom" | "left" | "right" | "front" | "rear";

/**
 * Terminal anchor definition for a device family.
 */
export interface TerminalFaceMap {
  [terminal: string]: {
    face: TerminalFace;
    offsetX?: number;
    offsetY?: number;
  };
}

/**
 * Device family category.
 */
export type DeviceFamily = 
  | "KA"      // Relay
  | "KT"      // Timer relay
  | "AF"      // Analog module
  | "AU"      // Communication module
  | "XT"      // Terminal block
  | "FU"      // Fuse holder
  | "ZS"      // Safety relay
  | "AT"      // Power terminal
  | "unknown";

/**
 * Device dimensions and behavior.
 */
export interface DeviceDimensions {
  widthMm: number;
  heightMm: number;
  depthMm?: number;
  terminalFaces?: TerminalFaceMap;
}

/**
 * A device entry in the catalog.
 */
export interface DeviceCatalogEntry {
  deviceId: string;
  prefix: string;
  family: DeviceFamily;
  partNumber?: string;
  dimensions: DeviceDimensions;
}

/**
 * The complete device catalog built from Part List.
 */
export interface DeviceCatalog {
  entries: Map<string, DeviceCatalogEntry>;
  familyDefaults: Map<DeviceFamily, DeviceDimensions>;
}

// ============================================================================
// Placement Types
// ============================================================================

/**
 * A device placed on a rail with computed coordinates.
 */
export interface PlacedDevice {
  deviceId: string;
  prefix: string;
  family: DeviceFamily;
  railId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sequenceIndex: number;
  dimensions: DeviceDimensions;
}

/**
 * A rail with devices placed along it.
 */
export interface PlacedRail {
  id: string;
  x: number;
  y: number;
  length: number;
  orientation: "horizontal" | "vertical";
  devices: PlacedDevice[];
}

/**
 * The complete panel topology with placed devices and routing graph.
 */
export interface PanelTopology {
  rails: PlacedRail[];
  panducts: PanductNode[];
  deviceIndex: Map<string, PlacedDevice>;
  sheetName: string;
}

// ============================================================================
// Routing Types
// ============================================================================

/**
 * A node in the routing graph (entry/exit point).
 */
export interface RoutingNode {
  id: string;
  x: number;
  y: number;
  kind: "device-terminal" | "panduct-entry" | "panduct-exit" | "rail-waypoint";
  connectedTo: string[];
}

/**
 * An edge in the routing graph.
 */
export interface RoutingEdge {
  fromId: string;
  toId: string;
  distance: number;
  kind: "direct" | "panduct" | "rail";
}

/**
 * The routing graph for pathfinding.
 */
export interface RoutingGraph {
  nodes: Map<string, RoutingNode>;
  edges: RoutingEdge[];
}

// ============================================================================
// Estimation Types
// ============================================================================

/**
 * Confidence level for a wire length estimate.
 */
export type EstimateConfidence = "high" | "medium" | "low";

/**
 * A computed wire length estimate for a single row.
 */
export interface WireLengthEstimate {
  rowId: string;
  fromAnchor: Point | null;
  toAnchor: Point | null;
  path: PathSegment[];
  basePathLengthIn: number;
  terminationAllowanceIn: number;
  slackAllowanceIn: number;
  bendPenaltyIn: number;
  /** Additional allowance when row location differs from current wire list location */
  crossLocationAllowanceIn: number;
  estimatedCutLengthIn: number;
  roundedCutLengthIn: number;
  confidence: EstimateConfidence;
  notes: string[];
}

/**
 * Estimated length data attached to a semantic row.
 */
export interface RowEstimatedLength {
  rawInches: number;
  roundedInches: number;
  display: string;
  confidence: EstimateConfidence;
  notes?: string[];
}

/**
 * Context for wire length estimation.
 */
export interface WireLengthEstimationContext {
  topology: PanelTopology | null;
  catalog: DeviceCatalog;
  blueLabels: import("@/lib/wiring-identification/types").BlueLabelSequenceMap | null;
  currentSheetName: string;
}

// ============================================================================
// Allowance Rules
// ============================================================================

/**
 * Termination type affecting allowances.
 */
export type TerminationType = "ferrule" | "lug" | "bare" | "spade" | "unknown";

/**
 * Allowance rules configuration.
 */
export interface AllowanceRules {
  /** Base termination allowance by type (inches) */
  terminationAllowance: Record<TerminationType, number>;
  /** Slack allowance by route type (inches) */
  slackAllowance: {
    sameDevice: number;
    adjacentDevice: number;
    sameRail: number;
    crossRail: number;
    crossPanel: number;
  };
  /** Bend penalty per 90-degree turn by gauge (inches) */
  bendPenaltyPerTurn: Record<string, number>;
  /** Default bend penalty if gauge unknown */
  defaultBendPenalty: number;
  /** Round cut length to this increment (inches) */
  roundingIncrement: number;
}

// ============================================================================
// Result Types
// ============================================================================

/**
 * Summary of wire length estimation results.
 */
export interface WireLengthEstimationSummary {
  totalRows: number;
  estimatedRows: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  skippedRows: number;
  averageLengthIn: number;
  minLengthIn: number;
  maxLengthIn: number;
}

/**
 * Complete result of wire length estimation.
 */
export interface WireLengthEstimationResult {
  estimates: Map<string, WireLengthEstimate>;
  summary: WireLengthEstimationSummary;
  warnings: string[];
}
