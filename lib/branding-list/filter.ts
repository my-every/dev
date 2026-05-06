/**
 * Branding List Filter
 * 
 * Filters wire list rows to produce branding-ready rows.
 * Applies exclusion rules for non-brandable wire types.
 */

import type { SemanticWireListRow } from "@/lib/workbook/types";
import { TARGET_PAIR_PREFIXES } from "@/lib/wire-list-sections";
import type {
  BrandingExclusionConfig,
  BrandingRow,
  BrandingFilterStats,
  ExclusionReason,
} from "./types";
import { DEFAULT_BRANDING_EXCLUSIONS } from "./types";
import type { DerivedRow, DerivedRowMeta } from "@/lib/row-patches";
import {
  parseDeviceId,
  isCableLikeRow,
  isClipLikeRow,
  isGroundColor,
  isIncrementalDeviceSequence,
  isIncrementalTerminalSequence,
  areSameBaseDevice,
  areAfFamilyCompatible,
  areSameAfFamilyIdentityTermination,
} from "@/lib/wiring-identification/device-parser";
import { isDeviceChangeRow } from "@/lib/wiring-identification/device-change-pattern";
import { getDisplayLocation } from "@/lib/wiring-domain";

// ============================================================================
// Exclusion Detection
// ============================================================================

/**
 * Check if a row is a FU (fuse) jumper.
 */
function isFuJumper(row: SemanticWireListRow): boolean {
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);

  // FU bus bar connection: FU device with BUS gauge
  const gauge = (row.gaugeSize || "").toUpperCase().trim();
  if (gauge === "BUS" && (fromParsed.prefix === "FU" || toParsed.prefix === "FU")) {
    return true;
  }

  // FU jumper: same FU device with incremental terminals
  if (fromParsed.prefix !== "FU" || toParsed.prefix !== "FU") return false;
  if (!areSameBaseDevice(row.fromDeviceId, row.toDeviceId)) return false;

  return isIncrementalTerminalSequence(fromParsed.terminal, toParsed.terminal);
}

/**
 * Check if a row is a KT (timer) jumper.
 */
function isKtJumper(row: SemanticWireListRow): boolean {
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);

  // KT jumper: same KT device with incremental terminals
  if (fromParsed.prefix !== "KT" || toParsed.prefix !== "KT") return false;
  if (!areSameBaseDevice(row.fromDeviceId, row.toDeviceId)) return false;

  return isIncrementalTerminalSequence(fromParsed.terminal, toParsed.terminal);
}

/**
 * Check if a row is an AF identity jumper.
 * Includes:
 * - Same identity termination jumpers (COM→COM, SH→SH, V+→V+)
 * - J→P chain jumpers (sequential AF devices)
 */
function isAfIdentityJumper(row: SemanticWireListRow): boolean {
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);

  // Must be AF-family compatible
  if (!areAfFamilyCompatible(fromParsed.prefix, toParsed.prefix)) return false;

  // Must be sequential devices
  if (!isIncrementalDeviceSequence(row.fromDeviceId, row.toDeviceId)) return false;

  // Check for J→P chain pattern (AF0061:J → AF0062:P)
  if (isDeviceChangeRow(row)) return true;

  // Check for same identity termination (COM, SH, V+)
  return areSameAfFamilyIdentityTermination(fromParsed.terminal, toParsed.terminal);
}

/**
 * Check if a row is a sequential terminal jumper.
 */
function isSequentialJumper(row: SemanticWireListRow): boolean {
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);

  // Same base device
  if (!areSameBaseDevice(row.fromDeviceId, row.toDeviceId)) return false;

  // Sequential terminals
  return isIncrementalTerminalSequence(fromParsed.terminal, toParsed.terminal);
}

/**
 * Check if a row is a VIO (sky) wire.
 */
function isVioWire(row: SemanticWireListRow): boolean {
  const wireId = (row.wireId || "").toUpperCase().trim();
  return wireId === "VIO" || wireId === "VIOLET" || wireId === "PUR" || wireId === "PURPLE";
}

/**
 * Check if a row is a shield wire.
 */
function isShieldWire(row: SemanticWireListRow): boolean {
  const wireId = (row.wireId || "").toUpperCase().trim();
  const fromTerminal = parseDeviceId(row.fromDeviceId).terminal.toUpperCase();
  const toTerminal = parseDeviceId(row.toDeviceId).terminal.toUpperCase();

  return wireId === "SH" || fromTerminal === "SH" || toTerminal === "SH";
}

/**
 * Check if a row is a mechanical relay jumper (KA device plugin jumpers).
 */
function isMechanicalRelayJumper(row: SemanticWireListRow): boolean {
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);

  // KA mechanical relay: same KA device with plugin terminals (2, 7, 10, etc.)
  if (fromParsed.prefix !== "KA" || toParsed.prefix !== "KA") return false;
  if (!areSameBaseDevice(row.fromDeviceId, row.toDeviceId)) return false;

  // Check for plugin terminal pattern (typically 2, 7, 10 or similar)
  const pluginTerminals = ["2", "7", "10", "4", "9", "12", "6", "11"];
  const fromIsPlugin = pluginTerminals.includes(fromParsed.terminal);
  const toIsPlugin = pluginTerminals.includes(toParsed.terminal);

  return fromIsPlugin && toIsPlugin;
}

/**
 * Check if a row is a KA jumper (between different KA devices).
 */
function isKaJumper(row: SemanticWireListRow): boolean {
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);

  // Both must be KA devices
  if (fromParsed.prefix !== "KA" || toParsed.prefix !== "KA") return false;

  // Sequential KA devices (KA0001 to KA0002)
  return isIncrementalDeviceSequence(row.fromDeviceId, row.toDeviceId);
}

/**
 * Check if a row is a resistor connection.
 */
function isResistorConnection(row: SemanticWireListRow): boolean {
  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);

  // Resistor prefixes: R, RES
  const resistorPrefixes = ["R", "RES"];

  return resistorPrefixes.includes(fromParsed.prefix) || resistorPrefixes.includes(toParsed.prefix);
}

/**
 * Check if a row is a target-pair device jumper.
 * HL, SA, SB, SH devices wired to themselves (same base device,
 * different terminals like A→B or A+→B+) are internal jumpers
 * that should not appear on the branding list.
 */
function isTargetPairJumper(row: SemanticWireListRow): boolean {
  if (!areSameBaseDevice(row.fromDeviceId, row.toDeviceId)) return false;

  const fromParsed = parseDeviceId(row.fromDeviceId);
  const toParsed = parseDeviceId(row.toDeviceId);

  // Only applies to target-pair prefixes
  if (!TARGET_PAIR_PREFIXES.has(fromParsed.prefix) && !TARGET_PAIR_PREFIXES.has(toParsed.prefix)) {
    return false;
  }

  // Different terminals on the same device → jumper
  return fromParsed.terminal !== toParsed.terminal;
}

/**
 * Check if a row matches a custom exclusion pattern.
 */
function matchesCustomPattern(row: SemanticWireListRow, patterns: string[]): boolean {
  if (patterns.length === 0) return false;

  const rowString = `${row.wireNo} ${row.wireId} ${row.fromDeviceId} ${row.toDeviceId}`.toUpperCase();

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, "i");
      if (regex.test(rowString)) return true;
    } catch {
      // Invalid regex, skip
    }
  }

  return false;
}

/**
 * Determine the exclusion reason for a row.
 */
export function getExclusionReason(
  row: SemanticWireListRow,
  config: BrandingExclusionConfig = DEFAULT_BRANDING_EXCLUSIONS
): ExclusionReason {
  // Check each exclusion type in order of specificity

  if (config.excludeClips && isClipLikeRow(row)) {
    return "clip";
  }

  if (config.excludeCables && isCableLikeRow(row)) {
    return "cable";
  }

  if (config.excludeGrounds && isGroundColor(row.wireId)) {
    return "ground";
  }

  if (config.excludeShields && isShieldWire(row)) {
    return "shield";
  }

  if (config.excludeVioWires && isVioWire(row)) {
    return "vio_wire";
  }

  if (config.excludeFuJumpers && isFuJumper(row)) {
    return "fu_jumper";
  }

  if (config.excludeKtJumpers && isKtJumper(row)) {
    return "kt_jumper";
  }

  if (config.excludeAfIdentityJumpers && isAfIdentityJumper(row)) {
    return "af_identity_jumper";
  }

  if (config.excludeSequentialJumpers && isSequentialJumper(row)) {
    return "sequential_jumper";
  }

  if (config.excludeMechanicalRelayJumpers && isMechanicalRelayJumper(row)) {
    return "mechanical_relay_jumper";
  }

  if (config.excludeKaJumpers && isKaJumper(row)) {
    return "ka_jumper";
  }

  if (config.excludeResistors && isResistorConnection(row)) {
    return "resistor";
  }

  if (config.excludeTargetPairJumpers && isTargetPairJumper(row)) {
    return "target_pair_jumper";
  }

  if (matchesCustomPattern(row, config.customExclusionPatterns)) {
    return "custom_pattern";
  }

  return "none";
}

/**
 * Check if a row should be included in the branding list.
 */
export function shouldIncludeInBranding(
  row: SemanticWireListRow,
  config: BrandingExclusionConfig = DEFAULT_BRANDING_EXCLUSIONS
): boolean {
  return getExclusionReason(row, config) === "none";
}

// ============================================================================
// Row Transformation
// ============================================================================

/**
 * Transform a semantic row into a branding row.
 */
export function toBrandingRow(
  row: SemanticWireListRow,
  sourceSheet: string,
  sourceSheetName: string,
  config: BrandingExclusionConfig = DEFAULT_BRANDING_EXCLUSIONS,
  computedLength?: number
): BrandingRow {
  const exclusionReason = getExclusionReason(row, config);
  const includedInBranding = exclusionReason === "none";
  const effectiveLocation = getDisplayLocation(row.toLocation, row.fromLocation, row.location);

  // Create minimal derived row meta
  const meta: DerivedRowMeta = {
    hasPatches: false,
    isLengthOverridden: false,
    isLengthAdjusted: false,
    originalLength: computedLength,
  };

  return {
    ...row,
    __patchMeta: meta,
    __sourceSheet: sourceSheet,
    __sourceSheetName: sourceSheetName,
    __includedInBranding: includedInBranding,
    __exclusionReason: exclusionReason,
    __effectiveLocation: effectiveLocation,
    brandingLength: computedLength,
    brandingLengthManual: false,
    finalLength: computedLength,
  };
}

// ============================================================================
// Filtering
// ============================================================================

/**
 * Filter rows for branding list.
 */
export function filterRowsForBranding(
  rows: SemanticWireListRow[],
  config: BrandingExclusionConfig = DEFAULT_BRANDING_EXCLUSIONS
): SemanticWireListRow[] {
  return rows.filter(row => shouldIncludeInBranding(row, config));
}

/**
 * Get filter statistics for a set of rows.
 */
export function getBrandingFilterStats(
  rows: SemanticWireListRow[],
  config: BrandingExclusionConfig = DEFAULT_BRANDING_EXCLUSIONS,
  computedLengths?: Map<string, number>
): BrandingFilterStats {
  const stats: BrandingFilterStats = {
    totalRows: rows.length,
    includedRows: 0,
    excludedRows: 0,
    exclusionBreakdown: {
      clip: 0,
      fu_jumper: 0,
      kt_jumper: 0,
      af_identity_jumper: 0,
      sequential_jumper: 0,
      cable: 0,
      vio_wire: 0,
      ground: 0,
      shield: 0,
      mechanical_relay_jumper: 0,
      ka_jumper: 0,
      resistor: 0,
      target_pair_jumper: 0,
      custom_pattern: 0,
      none: 0,
    },
    rowsWithLength: 0,
    rowsWithoutLength: 0,
    totalLength: 0,
  };

  for (const row of rows) {
    const reason = getExclusionReason(row, config);
    stats.exclusionBreakdown[reason]++;

    if (reason === "none") {
      stats.includedRows++;

      const length = computedLengths?.get(row.__rowId);
      if (length !== undefined && length > 0) {
        stats.rowsWithLength++;
        stats.totalLength += length;
      } else {
        stats.rowsWithoutLength++;
      }
    } else {
      stats.excludedRows++;
    }
  }

  return stats;
}

// ============================================================================
// Aggregation
// ============================================================================

/**
 * Aggregate branding rows from multiple sheets.
 */
export function aggregateBrandingRows(
  sheets: Array<{ slug: string; name: string; rows: SemanticWireListRow[] }>,
  config: BrandingExclusionConfig = DEFAULT_BRANDING_EXCLUSIONS,
  computedLengths?: Map<string, number>
): BrandingRow[] {
  const allRows: BrandingRow[] = [];

  for (const sheet of sheets) {
    if (!sheet.rows || !Array.isArray(sheet.rows)) continue;

    for (const row of sheet.rows) {
      // Try both prefixed and original row IDs for length lookup
      const prefixedRowId = `${sheet.slug}-${row.__rowId}`;
      const length = computedLengths?.get(row.__rowId) ?? computedLengths?.get(prefixedRowId);
      const brandingRow = toBrandingRow(row, sheet.slug, sheet.name, config, length);

      if (brandingRow.__includedInBranding) {
        // Make row ID unique across sheets by prefixing with sheet slug
        allRows.push({
          ...brandingRow,
          __rowId: prefixedRowId,
          __originalRowId: row.__rowId,
        });
      }
    }
  }

  return allRows;
}

/**
 * Exclusion reason display names.
 */
export const EXCLUSION_REASON_LABELS: Record<ExclusionReason, string> = {
  clip: "Clip Connection",
  fu_jumper: "FU Jumper",
  kt_jumper: "KT Jumper",
  af_identity_jumper: "AF Identity Jumper",
  sequential_jumper: "Sequential Jumper",
  cable: "Cable",
  vio_wire: "VIO Wire",
  ground: "Ground Wire",
  shield: "Shield Wire",
  mechanical_relay_jumper: "Mechanical Relay Jumper",
  ka_jumper: "KA Jumper",
  resistor: "Resistor",
  target_pair_jumper: "Target Pair Jumper",
  custom_pattern: "Custom Pattern",
  none: "Included",
};
