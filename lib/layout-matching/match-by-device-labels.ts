/**
 * Device Label-Based Layout Page Matching
 * 
 * This module matches layout PDF pages to wire list sheets by comparing
 * device labels found in the PDF text against the Blue Labels sheet data.
 * 
 * Strategy:
 * 1. Extract all device labels (e.g., KA0172, XT0111, FU0080) from PDF page text
 * 2. For each wire list sheet, get its device label set from Blue Labels
 * 3. Count how many PDF page labels appear in each sheet's label set
 * 4. The sheet with the highest overlap (and above threshold) is the match
 */

import type { MatchConfidence } from "./types";

// ============================================================================
// Device Label Extraction
// ============================================================================

/**
 * Pattern to match device labels in PDF text.
 * Device labels follow patterns like:
 * - KA0172, KA6510 (relays)
 * - XT0111, XT0290 (terminal blocks)
 * - FU0080, FU1100 (fuses)
 * - AF0081, AF0086 (analog filters)
 * - GR0431, GR0532 (grounds)
 * - AT0175, AT1100 (attenuators)
 * - SA0170, SB0170 (switches)
 * - HL0171, HA0472 (heaters/lights)
 * - SH0470, SH0472 (shields)
 * - UV0170, UV0600 (UV sensors)
 * - BA0001, BA1100 (batteries)
 * - AP0601, AR0600 (analog processors)
 * - PC0470 (power converters)
 * - UA1200, UA4473 (user assemblies)
 * - IEG0010, PEG0130 (grounds)
 * - AU0080, AU0140 (audio units)
 * - UJ0131 (junctions)
 * - WC8058 (wire connectors)
 */
const DEVICE_LABEL_PATTERN = /\b([A-Z]{2,3}\d{4})\b/g;

/**
 * Extract all device labels from PDF page text.
 */
export function extractDeviceLabelsFromText(pageText: string): Set<string> {
  const labels = new Set<string>();
  const matches = pageText.matchAll(DEVICE_LABEL_PATTERN);
  
  for (const match of matches) {
    const label = match[1];
    // Filter out likely false positives (pure numbers disguised as labels)
    if (!isLikelyFalsePositive(label)) {
      labels.add(label);
    }
  }
  
  return labels;
}

/**
 * Check if a potential label is likely a false positive.
 */
function isLikelyFalsePositive(label: string): boolean {
  // Filter out things like revision numbers, dates, etc.
  const falsePositivePatterns = [
    /^[A-Z]{2}2026$/,  // Year patterns
    /^[A-Z]{2}2025$/,
    /^[A-Z]{2}2024$/,
    /^[A-Z]{2}0000$/,  // Generic zeros
  ];
  
  return falsePositivePatterns.some(p => p.test(label));
}

// ============================================================================
// Blue Labels Parsing
// ============================================================================

/**
 * Map of sheet slug/name to its set of device labels.
 */
export interface SheetLabelMap {
  /** Maps sheet identifier to its device labels */
  sheets: Map<string, {
    sheetName: string;
    sheetSlug: string;
    labels: Set<string>;
  }>;
  /** All labels across all sheets (for quick lookup) */
  allLabels: Set<string>;
}

/**
 * Build a sheet-to-labels map from Blue Labels sheet data.
 * 
 * The Blue Labels sheet has columns like "(SHT 1) CONTROL,JB70;TT6"
 * with device labels listed vertically under each column.
 */
export function buildSheetLabelMap(
  blueLabelsRows: string[][],
  sheetSlugs: string[]
): SheetLabelMap {
  const sheets = new Map<string, { sheetName: string; sheetSlug: string; labels: Set<string> }>();
  const allLabels = new Set<string>();
  
  if (!blueLabelsRows || blueLabelsRows.length === 0) {
    return { sheets, allLabels };
  }
  
  // First row is headers with sheet names
  const headers = blueLabelsRows[0];
  
  // Parse each column
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const header = headers[colIdx];
    if (!header) continue;
    
    // Extract sheet number and name from header like "(SHT 1) CONTROL,JB70;TT6"
    const sheetMatch = header.match(/\(SHT\s*(\d+)\)\s*(.+)/i);
    if (!sheetMatch) continue;
    
    const sheetNum = parseInt(sheetMatch[1], 10);
    const sheetName = sheetMatch[2].trim();
    
    // Find matching slug from provided slugs (by index or name matching)
    const sheetSlug = findMatchingSlug(sheetNum, sheetName, sheetSlugs);
    if (!sheetSlug) continue;
    
    // Collect all labels from this column
    const labels = new Set<string>();
    for (let rowIdx = 1; rowIdx < blueLabelsRows.length; rowIdx++) {
      const cell = blueLabelsRows[rowIdx]?.[colIdx];
      if (cell && typeof cell === "string" && cell.trim()) {
        const label = cell.trim().toUpperCase();
        if (DEVICE_LABEL_PATTERN.test(label)) {
          labels.add(label);
          allLabels.add(label);
        }
      }
    }
    
    if (labels.size > 0) {
      sheets.set(sheetSlug, { sheetName, sheetSlug, labels });
    }
  }
  
  return { sheets, allLabels };
}

/**
 * Find matching sheet slug from sheet number or name.
 */
function findMatchingSlug(
  sheetNum: number,
  sheetName: string,
  sheetSlugs: string[]
): string | undefined {
  // Try to match by sheet number in slug (e.g., "sht-1-control")
  const byNumber = sheetSlugs.find(slug => {
    const match = slug.match(/sht-?(\d+)/i);
    return match && parseInt(match[1], 10) === sheetNum;
  });
  if (byNumber) return byNumber;
  
  // Try to match by normalized name
  const normalizedTarget = normalizeForMatch(sheetName);
  const byName = sheetSlugs.find(slug => {
    const normalizedSlug = normalizeForMatch(slug);
    return normalizedSlug.includes(normalizedTarget) || normalizedTarget.includes(normalizedSlug);
  });
  if (byName) return byName;
  
  // Return slug by index if available
  if (sheetNum > 0 && sheetNum <= sheetSlugs.length) {
    return sheetSlugs[sheetNum - 1];
  }
  
  return undefined;
}

/**
 * Normalize string for matching.
 */
function normalizeForMatch(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/sht\d+/g, "");
}

// ============================================================================
// Label-Based Matching
// ============================================================================

/**
 * Result of matching a layout page to sheets by device labels.
 */
export interface LabelMatchResult {
  pageNumber: number;
  pageTitle?: string;
  pageText: string;
  labelsFound: string[];
  matches: Array<{
    sheetSlug: string;
    sheetName: string;
    matchedLabels: string[];
    matchCount: number;
    totalLabelsInSheet: number;
    overlapRatio: number;
    confidence: MatchConfidence;
  }>;
  bestMatch?: {
    sheetSlug: string;
    sheetName: string;
    matchedLabels: string[];
    matchCount: number;
    confidence: MatchConfidence;
    reasons: string[];
  };
}

/**
 * Match a single layout page to wire list sheets using device labels.
 */
export function matchPageByLabels(
  pageNumber: number,
  pageText: string,
  pageTitle: string | undefined,
  sheetLabelMap: SheetLabelMap
): LabelMatchResult {
  // Extract labels from the PDF page
  const pageLabels = extractDeviceLabelsFromText(pageText);
  const labelsFound = Array.from(pageLabels);
  
  // Score each sheet by label overlap
  const matches: LabelMatchResult["matches"] = [];
  
  for (const [sheetSlug, sheetData] of sheetLabelMap.sheets) {
    const matchedLabels: string[] = [];
    
    for (const label of pageLabels) {
      if (sheetData.labels.has(label)) {
        matchedLabels.push(label);
      }
    }
    
    if (matchedLabels.length > 0) {
      const matchCount = matchedLabels.length;
      const totalLabelsInSheet = sheetData.labels.size;
      const overlapRatio = matchCount / totalLabelsInSheet;
      
      matches.push({
        sheetSlug,
        sheetName: sheetData.sheetName,
        matchedLabels,
        matchCount,
        totalLabelsInSheet,
        overlapRatio,
        confidence: getConfidenceFromLabelMatch(matchCount, overlapRatio, pageLabels.size),
      });
    }
  }
  
  // Sort by match count (primary) and overlap ratio (secondary)
  matches.sort((a, b) => {
    if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
    return b.overlapRatio - a.overlapRatio;
  });
  
  // Determine best match
  let bestMatch: LabelMatchResult["bestMatch"];
  
  if (matches.length > 0) {
    const best = matches[0];
    const runnerUp = matches[1];
    
    // Check if best match is sufficiently better than runner-up
    const isClear = !runnerUp || best.matchCount >= runnerUp.matchCount * 1.5 || best.matchCount >= 3;
    
    if (best.confidence !== "unmatched" && isClear) {
      const reasons: string[] = [];
      reasons.push(`${best.matchCount} device labels matched`);
      reasons.push(`Labels: ${best.matchedLabels.slice(0, 5).join(", ")}${best.matchedLabels.length > 5 ? "..." : ""}`);
      if (best.overlapRatio > 0.5) {
        reasons.push(`${Math.round(best.overlapRatio * 100)}% of sheet labels found`);
      }
      
      bestMatch = {
        sheetSlug: best.sheetSlug,
        sheetName: best.sheetName,
        matchedLabels: best.matchedLabels,
        matchCount: best.matchCount,
        confidence: best.confidence,
        reasons,
      };
    }
  }
  
  return {
    pageNumber,
    pageTitle,
    pageText,
    labelsFound,
    matches,
    bestMatch,
  };
}

/**
 * Determine confidence from label match statistics.
 */
function getConfidenceFromLabelMatch(
  matchCount: number,
  overlapRatio: number,
  totalPageLabels: number
): MatchConfidence {
  // High confidence: Many matches AND good overlap
  if (matchCount >= 5 && overlapRatio >= 0.3) return "high";
  if (matchCount >= 8) return "high";
  
  // Medium confidence: Some matches
  if (matchCount >= 3 && overlapRatio >= 0.2) return "medium";
  if (matchCount >= 5) return "medium";
  
  // Low confidence: Few matches
  if (matchCount >= 2) return "low";
  
  return "unmatched";
}

/**
 * Match all layout pages to wire list sheets using device labels.
 */
export function matchAllPagesByLabels(
  pages: Array<{ pageNumber: number; text: string; title?: string }>,
  sheetLabelMap: SheetLabelMap
): LabelMatchResult[] {
  return pages.map(page => 
    matchPageByLabels(page.pageNumber, page.text, page.title, sheetLabelMap)
  );
}

/**
 * Build sheet layout mapping from label-based matches.
 */
export function buildMappingFromLabelMatches(
  labelMatches: LabelMatchResult[],
  sheetSlugs: string[]
): Map<string, { pageNumber: number; confidence: MatchConfidence; reasons: string[] }> {
  const mapping = new Map<string, { pageNumber: number; confidence: MatchConfidence; reasons: string[] }>();
  
  // First pass: Assign high-confidence matches
  for (const match of labelMatches) {
    if (match.bestMatch && match.bestMatch.confidence === "high") {
      const existing = mapping.get(match.bestMatch.sheetSlug);
      if (!existing || match.bestMatch.matchCount > (existing as any).matchCount) {
        mapping.set(match.bestMatch.sheetSlug, {
          pageNumber: match.pageNumber,
          confidence: match.bestMatch.confidence,
          reasons: match.bestMatch.reasons,
        });
      }
    }
  }
  
  // Second pass: Assign medium-confidence matches (if not already assigned)
  for (const match of labelMatches) {
    if (match.bestMatch && match.bestMatch.confidence === "medium") {
      if (!mapping.has(match.bestMatch.sheetSlug)) {
        mapping.set(match.bestMatch.sheetSlug, {
          pageNumber: match.pageNumber,
          confidence: match.bestMatch.confidence,
          reasons: match.bestMatch.reasons,
        });
      }
    }
  }
  
  return mapping;
}
