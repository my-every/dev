/**
 * Device Family Ordering Types
 * 
 * Types for device-family-specific ordering profiles that reflect
 * physical/termination reading order from the panel.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";

/**
 * Orientation for reading order on the panel
 */
export type PanelOrientation = "bottom_to_top" | "top_to_bottom";

/**
 * Terminal bucket for grouping terminals
 */
export interface TerminalBucket {
  label: string;
  terminals: string[];
}

/**
 * Device ordering profile configuration
 */
export interface DeviceOrderingProfile {
  /** Device prefix (e.g., "AF", "KA") */
  prefix: string;
  /** Human-readable label */
  label: string;
  /** Physical reading orientation */
  orientation: PanelOrientation;
  /** Ordered list of terminals (explicit order) */
  terminalOrder: string[];
  /** Optional terminal buckets for grouping */
  terminalBuckets?: TerminalBucket[];
  /** Description of the ordering logic */
  description?: string;
}

/**
 * Parsed device ID components
 */
export interface ParsedDeviceId {
  /** Full device ID string */
  full: string;
  /** Device prefix (e.g., "AF", "KA") */
  prefix: string;
  /** Base device ID without terminal (e.g., "AF0081") */
  baseDeviceId: string;
  /** Device number (e.g., "0081") */
  deviceNumber: string;
  /** Terminal identifier (e.g., "V+", "COM", "12", "A1") */
  terminal: string | null;
  /** Numeric terminal value if applicable */
  numericTerminal: number | null;
}

/**
 * Context for applying device family ordering
 */
export interface DeviceOrderingContext {
  /** Current identification filter (e.g., "af_jumpers", "ka_jumpers") */
  identificationFilter?: string;
  /** Current "from" device prefix filter */
  fromPrefix?: string | null;
  /** Current "to" device prefix filter */
  toPrefix?: string | null;
  /** Blue Labels sequence map for device ordering */
  blueLabelsOrder?: Map<string, number>;
  /** Current sheet name for context */
  currentSheetName?: string;
}

/**
 * Result of applying device family ordering
 */
export interface DeviceOrderingResult {
  /** Ordered rows */
  rows: SemanticWireListRow[];
  /** Profile that was applied (if any) */
  appliedProfile: DeviceOrderingProfile | null;
  /** Whether ordering was applied */
  wasOrdered: boolean;
  /** Device groups for rendering group headers */
  deviceGroups: DeviceGroup[];
}

/**
 * Device group for rendering headers
 */
export interface DeviceGroup {
  /** Base device ID (e.g., "AF0081") */
  baseDeviceId: string;
  /** Index of first row in this group */
  startIndex: number;
  /** Number of rows in this group */
  rowCount: number;
}

/**
 * Endpoint selection result
 */
export interface ResolvedEndpoint {
  /** The device ID to use for ordering */
  deviceId: string;
  /** Which side it came from */
  side: "from" | "to";
  /** Parsed device info */
  parsed: ParsedDeviceId;
}
