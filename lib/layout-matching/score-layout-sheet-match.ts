/**
 * Domain-aware scoring system for matching layout pages to wire-list sheets.
 * 
 * This module implements a weighted scoring system that prioritizes structural
 * correctness over fuzzy text similarity.
 */

import {
  type NormalizedLayoutName,
  type AreaType,
  normalizeLayoutName,
  hasAreaTypeConflict,
  hasSideConflict,
  stripJbSuffix,
  cleanText,
} from "./layout-name-rules";

// ============================================================================
// Types
// ============================================================================

/**
 * Detailed match score with breakdown.
 */
export interface MatchScore {
  /** Total score (0-100, can go negative with penalties) */
  total: number;
  /** JB ID match score component */
  jbIdScore: number;
  /** Area type match score component */
  areaTypeScore: number;
  /** Side match score component */
  sideScore: number;
  /** Token overlap score component */
  tokenScore: number;
  /** Fuzzy similarity score component */
  fuzzyScore: number;
  /** Penalty points (negative) */
  penalties: number;
  /** Reasons explaining the score */
  reasons: string[];
  /** Whether there's a structural conflict */
  hasConflict: boolean;
}

/**
 * Scoring weights configuration.
 */
export interface ScoringWeights {
  jbIdExactMatch: number;
  jbIdMismatch: number;
  areaTypeMatch: number;
  areaTypeConflict: number;
  sideMatch: number;
  sideConflict: number;
  tokenOverlap: number;
  fuzzySimilarity: number;
}

// ============================================================================
// Default Weights
// ============================================================================

/**
 * Default scoring weights.
 * These are tuned to prioritize structural correctness.
 */
export const DEFAULT_WEIGHTS: ScoringWeights = {
  jbIdExactMatch: 40,        // Very high weight for JB match
  jbIdMismatch: -30,         // Strong penalty for JB mismatch
  areaTypeMatch: 35,         // Very high weight for area type match
  areaTypeConflict: -50,     // Very strong penalty for area type conflict
  sideMatch: 15,             // High weight for side match
  sideConflict: -25,         // Strong penalty for side conflict
  tokenOverlap: 10,          // Medium weight for token overlap
  fuzzySimilarity: 5,        // Low weight for fuzzy similarity
};

// ============================================================================
// Scoring Functions
// ============================================================================

/**
 * Calculate Jaccard similarity between two token sets.
 */
function calculateTokenSimilarity(tokens1: string[], tokens2: string[]): number {
  if (tokens1.length === 0 || tokens2.length === 0) return 0;
  
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  
  let intersection = 0;
  for (const token of set1) {
    if (set2.has(token)) intersection++;
  }
  
  const union = set1.size + set2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Calculate fuzzy string similarity using Levenshtein distance.
 */
function calculateFuzzySimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;
  
  // Use a simplified similarity based on common substrings
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  // Check for containment
  if (longer.includes(shorter)) {
    return shorter.length / longer.length;
  }
  
  // Count common bigrams
  const getBigrams = (s: string): Set<string> => {
    const bigrams = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) {
      bigrams.add(s.substring(i, i + 2));
    }
    return bigrams;
  };
  
  const bigrams1 = getBigrams(s1);
  const bigrams2 = getBigrams(s2);
  
  let common = 0;
  for (const bigram of bigrams1) {
    if (bigrams2.has(bigram)) common++;
  }
  
  const total = bigrams1.size + bigrams2.size;
  return total > 0 ? (2 * common) / total : 0;
}

/**
 * Score a match between a sheet and a layout page.
 */
export function scoreLayoutSheetMatch(
  sheetName: string,
  layoutTitle: string,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): MatchScore {
  const sheet = normalizeLayoutName(sheetName);
  const layout = normalizeLayoutName(layoutTitle);
  
  // Also check stripped versions (without JB suffix) for cases where
  // sheet name is "CONTROL A" and layout title is "CONTROL A,JB70"
  const sheetCore = cleanText(stripJbSuffix(sheetName));
  const layoutCore = cleanText(stripJbSuffix(layoutTitle));
  
  const reasons: string[] = [];
  let jbIdScore = 0;
  let areaTypeScore = 0;
  let sideScore = 0;
  let tokenScore = 0;
  let fuzzyScore = 0;
  let penalties = 0;
  let hasConflict = false;
  
  // ========== Core Name Exact Match Bonus ==========
  // If the core names (without JB suffix) are exactly equal, this is a strong signal
  if (sheetCore && layoutCore && sheetCore === layoutCore) {
    // Very strong signal - exact core match
    jbIdScore += 25;
    reasons.push(`Core name exact match: "${sheetCore}"`);
  } else if (sheetCore && layoutCore) {
    // Check if one contains the other (for partial matches like "BOP CTRL" vs "BOP CTRL JB74")
    if (layoutCore.includes(sheetCore) || sheetCore.includes(layoutCore)) {
      jbIdScore += 15;
      reasons.push(`Core name partial match: sheet="${sheetCore}", layout="${layoutCore}"`);
    }
  }
  
  // ========== JB ID Matching ==========
  // CRITICAL: JB ID match alone is NOT sufficient for matching.
  // Two layouts can share the same JB (e.g., JB73) but be completely different panels
  // (e.g., "HPC CTRL,JB73" vs "RAIL,RIGHT,JB73"). 
  // We MUST check core name or area type match BEFORE giving JB credit.
  
  const hasGoodCoreName = jbIdScore >= 15; // Core name match from above
  
  if (sheet.jbId && layout.jbId) {
    if (sheet.jbId === layout.jbId) {
      // JB IDs match, but only give full credit if we have core name match
      if (hasGoodCoreName) {
        jbIdScore += weights.jbIdExactMatch;
        reasons.push(`JB ID matched: ${sheet.jbId} (with core name match)`);
      } else {
        // JB match without core name - could be different panels on same JB
        jbIdScore += 10; // Reduced credit
        reasons.push(`JB ID matched: ${sheet.jbId} (no core name match - verify panel number)`);
      }
    } else {
      jbIdScore = weights.jbIdMismatch;
      penalties += Math.abs(weights.jbIdMismatch);
      reasons.push(`JB ID mismatch: sheet=${sheet.jbId}, layout=${layout.jbId}`);
      hasConflict = true;
    }
  } else if (sheet.jbId || layout.jbId) {
    // One has JB ID, other doesn't
    // If sheet has no JB but layout does, this is EXPECTED (sheet names often don't include JB)
    // Don't penalize this case if we already have a core name match
    if (!sheet.jbId && layout.jbId && hasGoodCoreName) {
      // Sheet "BOP CTRL" vs layout "BOP CTRL,JB74" - the JB is just added context
      reasons.push(`JB ID: layout has ${layout.jbId}, sheet omits it (expected)`);
    } else {
      jbIdScore += -5;
      penalties += 5;
      reasons.push(`JB ID partial: sheet=${sheet.jbId || "none"}, layout=${layout.jbId || "none"}`);
    }
  }
  
  // ========== Area Type Matching ==========
  if (sheet.areaType !== "unknown" && layout.areaType !== "unknown") {
    if (sheet.areaType === layout.areaType) {
      areaTypeScore = weights.areaTypeMatch;
      reasons.push(`Area type matched: ${sheet.areaType}`);
    } else if (hasAreaTypeConflict(sheet.areaType, layout.areaType)) {
      areaTypeScore = weights.areaTypeConflict;
      penalties += Math.abs(weights.areaTypeConflict);
      reasons.push(`Area type CONFLICT: sheet=${sheet.areaType}, layout=${layout.areaType}`);
      hasConflict = true;
    } else {
      // Different but not conflicting
      areaTypeScore = -10;
      penalties += 10;
      reasons.push(`Area type different: sheet=${sheet.areaType}, layout=${layout.areaType}`);
    }
  } else if (sheet.areaType !== "unknown" || layout.areaType !== "unknown") {
    // One is unknown - no penalty but no bonus
    reasons.push(`Area type partial: sheet=${sheet.areaType}, layout=${layout.areaType}`);
  }
  
  // Check secondary area types for additional context
  if (sheet.secondaryAreaType && layout.secondaryAreaType) {
    if (sheet.secondaryAreaType === layout.secondaryAreaType) {
      areaTypeScore += 5;
      reasons.push(`Secondary area type matched: ${sheet.secondaryAreaType}`);
    }
  }
  
  // ========== Side Matching ==========
  if (sheet.side && layout.side) {
    if (sheet.side === layout.side) {
      sideScore = weights.sideMatch;
      reasons.push(`Side matched: ${sheet.side}`);
    } else {
      sideScore = weights.sideConflict;
      penalties += Math.abs(weights.sideConflict);
      reasons.push(`Side CONFLICT: sheet=${sheet.side}, layout=${layout.side}`);
      hasConflict = true;
    }
  } else if (sheet.side || layout.side) {
    // One has side, other doesn't
    if ((sheet.areaType === "rail" || layout.areaType === "rail") && (sheet.side || layout.side)) {
      // For rails, missing side on one is a concern
      sideScore = -5;
      penalties += 5;
      reasons.push(`Side partial for rail: sheet=${sheet.side || "none"}, layout=${layout.side || "none"}`);
    }
  }
  
  // ========== Token Overlap ==========
  const allSheetTokens = [...sheet.tokens, ...sheet.functionTokens];
  const allLayoutTokens = [...layout.tokens, ...layout.functionTokens];
  
  const structuralOverlap = calculateTokenSimilarity(sheet.tokens, layout.tokens);
  const functionalOverlap = calculateTokenSimilarity(sheet.functionTokens, layout.functionTokens);
  const totalOverlap = calculateTokenSimilarity(allSheetTokens, allLayoutTokens);
  
  // Weight structural overlap higher
  const weightedOverlap = structuralOverlap * 0.6 + functionalOverlap * 0.2 + totalOverlap * 0.2;
  tokenScore = Math.round(weights.tokenOverlap * weightedOverlap);
  
  if (weightedOverlap > 0.5) {
    reasons.push(`Good token overlap: ${Math.round(weightedOverlap * 100)}%`);
  } else if (weightedOverlap > 0) {
    reasons.push(`Partial token overlap: ${Math.round(weightedOverlap * 100)}%`);
  }
  
  // ========== Fuzzy Similarity (Low Weight) ==========
  const fuzzySim = calculateFuzzySimilarity(sheet.normalized, layout.normalized);
  fuzzyScore = Math.round(weights.fuzzySimilarity * fuzzySim);
  
  if (fuzzySim > 0.7) {
    reasons.push(`High fuzzy similarity: ${Math.round(fuzzySim * 100)}%`);
  }
  
  // ========== Calculate Total ==========
  const total = jbIdScore + areaTypeScore + sideScore + tokenScore + fuzzyScore;
  
  return {
    total,
    jbIdScore,
    areaTypeScore,
    sideScore,
    tokenScore,
    fuzzyScore,
    penalties,
    reasons,
    hasConflict,
  };
}

/**
 * Determine match confidence from detailed score.
 */
export function getConfidenceFromDetailedScore(score: MatchScore): "matched" | "likely" | "unmatched" {
  // If there's a structural conflict (side mismatch, etc.), never show as matched
  if (score.hasConflict) {
    return "unmatched";
  }
  
  // High confidence: good JB match + area type match
  if (score.total >= 60 && score.jbIdScore > 0 && score.areaTypeScore > 0) {
    return "matched";
  }
  
  // High confidence with strong core name match (JB score includes core name bonus)
  // A score of 25+ in jbIdScore indicates core name exact match, 15+ indicates partial
  if (score.total >= 40 && score.jbIdScore >= 25) {
    return "matched";
  }
  
  // High confidence with area type match + some JB/core match
  if (score.total >= 45 && score.areaTypeScore > 0) {
    return "matched";
  }
  
  // Core name exact match alone is enough for "matched" confidence
  if (score.jbIdScore >= 25) {
    return "matched";
  }
  
  // Medium confidence: decent score without conflicts
  if (score.total >= 30 && !score.hasConflict && score.penalties < 20) {
    return "likely";
  }
  
  // Also likely if partial core name match
  if (score.jbIdScore >= 15 && score.penalties < 30) {
    return "likely";
  }
  
  // Lower threshold for likely when there's positive area type match
  if (score.total >= 20 && score.areaTypeScore > 0 && score.penalties < 15) {
    return "likely";
  }
  
  // Very low bar - any positive score with area type match is at least "likely"
  if (score.total > 10 && score.areaTypeScore > 0) {
    return "likely";
  }
  
  return "unmatched";
}

/**
 * Compare two names and determine if they should match.
 * Returns true only for high-confidence structural matches.
 */
export function shouldMatch(sheetName: string, layoutTitle: string): boolean {
  const score = scoreLayoutSheetMatch(sheetName, layoutTitle);
  const confidence = getConfidenceFromDetailedScore(score);
  return confidence === "matched";
}

/**
 * Get the best match for a sheet from a list of layout pages.
 */
export function findBestStructuralMatch(
  sheetName: string,
  layoutTitles: string[]
): { title: string; score: MatchScore; confidence: "matched" | "likely" | "unmatched" } | null {
  if (layoutTitles.length === 0) return null;
  
  const scored = layoutTitles
    .map(title => ({
      title,
      score: scoreLayoutSheetMatch(sheetName, title),
    }))
    .map(item => ({
      ...item,
      confidence: getConfidenceFromDetailedScore(item.score),
    }))
    .filter(item => item.confidence !== "unmatched")
    .sort((a, b) => b.score.total - a.score.total);
  
  return scored[0] || null;
}
