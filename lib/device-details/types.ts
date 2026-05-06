/**
 * Core types for the Device Details system.
 */

import type { SemanticWireListRow, ParsedSheetRow } from "@/lib/workbook/types";

/**
 * Parsed device identifier: base ID + optional terminal.
 * Examples: "AF0123" or "AF0123:13"
 */
export interface ParsedDeviceId {
  baseId: string;
  terminal: string | null;
}

/**
 * Device information from Part Number List.
 */
export interface DevicePartInfo {
  deviceId: string;
  partNumbers: string[];
  description: string;
  location: string;
}

/**
 * A single termination record from the wire list.
 * Shows which wire is connected to which terminal.
 */
export interface TerminationRecord {
  terminal: string;
  fromDeviceId: string;
  wireNo: string;
  wireType: string;
  wireId: string;
  gaugeSize: string;
  toDeviceId: string;
  toLocation: string;
  fromLocation: string;
  wireColor?: string;
  stripLength?: string;
  changeState?: "added" | "removed";
  rowId: string;
}

/**
 * Complete device details including part info and terminations.
 */
export interface DeviceDetails {
  parsedId: ParsedDeviceId;
  partInfo: DevicePartInfo | null;
  terminations: TerminationRecord[];
  usedTerminals: Set<string>;
  usedTerminalList: string[];
  totalTerminalsUsed: number;
}

/**
 * Terminal matrix layout for a device (e.g., Allen-Bradley I/O module).
 * Used for rendering the termination guide grid.
 */
export interface TerminalMatrixLayout {
  rows: TerminalMatrixRow[];
  columns: number;
  totalTerminals: number;
}

export interface TerminalMatrixRow {
  label: string; // "00", "01", "02", "COM -", "V+", "SH", etc.
  terminalNumbers: string[];
}

/**
 * Props for terminal guide components.
 */
export interface TerminationGuideProps {
  deviceId: string;
  description?: string;
  terminations: TerminationRecord[];
  usedTerminals: Set<string>;
  usedTerminalList?: string[];
  partNumbers?: string[];
  selectedTerminal?: string | null;
  onTerminalClick?: (terminal: string) => void;
}

/**
 * Device family types for routing to specific guides.
 */
export type DeviceFamilyType =
  | "relay" // KA, KT
  | "fuse" // FU
  | "terminal-block" // XT
  | "i-o-module" // AF
  | "other";

/**
 * Guide registry entry for a device family.
 */
export interface GuideRegistryEntry {
  family: DeviceFamilyType;
  prefixes: string[];
  component: React.ComponentType<TerminationGuideProps>;
  label: string;
}
