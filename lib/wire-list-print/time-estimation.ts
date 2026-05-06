/**
 * Wire List Time Estimation
 *
 * Estimates the time (in minutes) to wire each connection based on
 * section kind, gauge size, and connection complexity.
 *
 * Each side (FROM / TO) is broken into three phases:
 *   - Preparing: reading docs, gathering tools/materials
 *   - Locating:  finding the device/terminal in the panel
 *   - Terminating: stripping, crimping, landing the wire
 *
 * All times are rounded to the nearest whole minute.
 */

import type { IdentificationFilterKind } from "@/lib/wiring-identification/types";

// ============================================================================
// Phase Rate Table
// ============================================================================

interface PhaseRates {
  preparing: number;
  locating: number;
  terminating: number;
}

/**
 * Per-side phase minutes, indexed by section kind.
 */
const SECTION_PHASE_RATES: Partial<Record<IdentificationFilterKind, { from: PhaseRates; to: PhaseRates }>> = {
  single_connections: { from: { preparing: 0.5, locating: 0.5, terminating: 0.5 }, to: { preparing: 0.5, locating: 0.5, terminating: 0.5 } },
  cables: { from: { preparing: 3, locating: 0.5, terminating: 1.0 }, to: { preparing: 0.5, locating: 0.5, terminating: 1.0 } },
  grounds: { from: { preparing: 0.3, locating: 0.3, terminating: 0.4 }, to: { preparing: 0.3, locating: 0.3, terminating: 0.4 } },
  clips: { from: { preparing: 0.2, locating: 0.2, terminating: 0.1 }, to: { preparing: 0.2, locating: 0.2, terminating: 0.1 } },
  fu_jumpers: { from: { preparing: 0.2, locating: 0.2, terminating: 0.1 }, to: { preparing: 0.2, locating: 0.2, terminating: 0.1 } },
  ka_jumpers: { from: { preparing: 0.3, locating: 0.3, terminating: 0.4 }, to: { preparing: 0.3, locating: 0.3, terminating: 0.4 } },
  ka_relay_plugin_jumpers: { from: { preparing: 0.3, locating: 0.3, terminating: 0.4 }, to: { preparing: 0.3, locating: 0.3, terminating: 0.4 } },
  ka_twin_ferrules: { from: { preparing: 1, locating: 0.5, terminating: 0.5 }, to: { preparing: 0.5, locating: 0.5, terminating: 0.5 } },
  kt_jumpers: { from: { preparing: 1, locating: 0.2, terminating: 0.1 }, to: { preparing: 0.2, locating: 0.2, terminating: 0.1 } },
  af_jumpers: { from: { preparing: 1, locating: 0.2, terminating: 0.1 }, to: { preparing: 0.2, locating: 0.2, terminating: 0.1 } },
  vio_jumpers: { from: { preparing: 1, locating: 0.2, terminating: 0.1 }, to: { preparing: 0.2, locating: 0.2, terminating: 0.1 } },
  resistors: { from: { preparing: 2, locating: 0.5, terminating: 0.5 }, to: { preparing: 0.5, locating: 0.5, terminating: 0.5 } },
};

const DEFAULT_PHASE: PhaseRates = { preparing: 1, locating: 0.5, terminating: 1 };

/**
 * Gauge multiplier — heavier gauge wires take longer to strip/terminate.
 */
function getGaugeMultiplier(gaugeSize: string | undefined): number {
  const gauge = parseFloat(gaugeSize || "");
  if (isNaN(gauge)) return 1.0;

  // Smaller AWG number = thicker wire = harder to work
  if (gauge <= 10) return 1.8;
  if (gauge <= 12) return 1.5;
  if (gauge <= 14) return 1.3;
  if (gauge <= 16) return 1.1;
  if (gauge <= 18) return 1.0;
  // 20+ AWG — thin/easy
  return 0.9;
}

function sumPhases(phases: PhaseRates): number {
  return phases.preparing + phases.locating + phases.terminating;
}

// ============================================================================
// Public API
// ============================================================================

export interface WirePhaseBreakdown {
  preparing: number;
  locating: number;
  terminating: number;
}

export interface WireTimeEstimate {
  /** Estimated minutes for FROM-side termination (rounded to 1 min) */
  fromMinutes: number;
  /** Estimated minutes for TO-side termination (rounded to 1 min) */
  toMinutes: number;
  /** Total estimated minutes for this wire */
  totalMinutes: number;
  /** Phase breakdown for FROM side */
  fromPhases: WirePhaseBreakdown;
  /** Phase breakdown for TO side */
  toPhases: WirePhaseBreakdown;
}

/**
 * Estimate the time for a single wire connection.
 * All per-side totals are rounded to the nearest whole minute (min 1).
 */
export function estimateWireTime(
  sectionKind: IdentificationFilterKind | undefined,
  gaugeSize: string | undefined,
): WireTimeEstimate {
  const rates = (sectionKind && SECTION_PHASE_RATES[sectionKind]) || { from: DEFAULT_PHASE, to: DEFAULT_PHASE };
  const multiplier = getGaugeMultiplier(gaugeSize);

  const fromRaw = sumPhases(rates.from) * multiplier;
  const toRaw = sumPhases(rates.to) * multiplier;

  const fromMinutes = Math.max(1, Math.round(fromRaw));
  const toMinutes = Math.max(1, Math.round(toRaw));

  return {
    fromMinutes,
    toMinutes,
    totalMinutes: fromMinutes + toMinutes,
    fromPhases: {
      preparing: Math.round(rates.from.preparing * multiplier),
      locating: Math.round(rates.from.locating * multiplier),
      terminating: Math.round(rates.from.terminating * multiplier),
    },
    toPhases: {
      preparing: Math.round(rates.to.preparing * multiplier),
      locating: Math.round(rates.to.locating * multiplier),
      terminating: Math.round(rates.to.terminating * multiplier),
    },
  };
}

/**
 * Format minutes as a compact display string.
 * - Under 60 min: "3m"
 * - 60+: "1.2h"
 */
export function formatEstTime(minutes: number | undefined): string {
  if (minutes === undefined || minutes <= 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  return `${(minutes / 60).toFixed(1)}h`;
}

/**
 * Format minutes as a long display string for section totals.
 * - Under 60 min: "3 Minutes"
 * - 60+: "1.2 Hours"
 */
export function formatEstTimeLong(minutes: number | undefined): string {
  if (minutes === undefined || minutes <= 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)} Minutes`;
  return `${(minutes / 60).toFixed(1)} Hours`;
}

export interface SectionTimeSummary {
  fromTotal: number;
  toTotal: number;
  grandTotal: number;
  phases: {
    preparing: number;
    locating: number;
    terminating: number;
  };
  rowCount: number;
}

/**
 * Summarize estimated time for a collection of rows.
 */
export function summarizeSectionTime(
  rows: Array<{ gaugeSize?: string }>,
  sectionKind: IdentificationFilterKind | undefined,
): SectionTimeSummary {
  let fromTotal = 0;
  let toTotal = 0;
  let preparing = 0;
  let locating = 0;
  let terminating = 0;

  for (const row of rows) {
    const est = estimateWireTime(sectionKind, row.gaugeSize);
    fromTotal += est.fromMinutes;
    toTotal += est.toMinutes;
    preparing += est.fromPhases.preparing + est.toPhases.preparing;
    locating += est.fromPhases.locating + est.toPhases.locating;
    terminating += est.fromPhases.terminating + est.toPhases.terminating;
  }

  return {
    fromTotal: Math.round(fromTotal),
    toTotal: Math.round(toTotal),
    grandTotal: Math.round(fromTotal + toTotal),
    phases: {
      preparing: Math.round(preparing),
      locating: Math.round(locating),
      terminating: Math.round(terminating),
    },
    rowCount: rows.length,
  };
}
