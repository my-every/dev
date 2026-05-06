/**
 * Utilities for matching layout PDF pages to wire-list sheets.
 * 
 * This module uses two strategies for matching:
 * 1. Device Label Matching (PRIMARY): Compare device labels found in PDF text
 *    against Blue Labels sheet to find which sheet's devices appear on each page.
 * 2. Title Matching (FALLBACK): Domain-aware structural matching using page titles.
 */

import type {
  SheetLayoutMatch,
  SheetLayoutMapping,
  LayoutPagePreview,
  LayoutPageDetail,
  MatchConfidence,
} from "./types";
import {
  scoreLayoutSheetMatch,
  getConfidenceFromDetailedScore,
  type MatchScore,
} from "./score-layout-sheet-match";
import {
  normalizeLayoutName,
} from "./layout-name-rules";
import {
  buildSheetLabelMap,
  matchPageByLabels,
  type SheetLabelMap,
  type LabelMatchResult,
} from "./match-by-device-labels";

// ============================================================================
// Match Scoring (using domain-aware structural matching)
// ============================================================================

/**
 * Score a potential match between a sheet name and layout page title.
 * Uses the new domain-aware structural scoring system.
 * Returns a score from -100 to 100 (can be negative due to penalties).
 */
export function scoreSheetToPageMatch(
  sheetName: string,
  layoutTitle: string
): { score: number; detailed: MatchScore } {
  const detailed = scoreLayoutSheetMatch(sheetName, layoutTitle);
  return { score: detailed.total, detailed };
}

/**
 * Determine match confidence from detailed score.
 * Maps the new confidence levels to the existing MatchConfidence type.
 */
export function getConfidenceFromScore(detailed: MatchScore): MatchConfidence {
  const confidence = getConfidenceFromDetailedScore(detailed);

  // Map to existing MatchConfidence type
  switch (confidence) {
    case "matched":
      return "high";
    case "likely":
      return "medium";
    case "unmatched":
    default:
      return "unmatched";
  }
}

// ============================================================================
// Page Matching
// ============================================================================

/**
 * Group layout pages by their panel number.
 * Pages with the same panel number belong to the same physical panel.
 * This helps disambiguate layouts that share JB identifiers.
 */
function groupPagesByPanelNumber(layoutPages: LayoutPagePreview[]): Map<string | undefined, LayoutPagePreview[]> {
  const groups = new Map<string | undefined, LayoutPagePreview[]>();

  for (const page of layoutPages) {
    const panelNum = page.panelNumber;
    const existing = groups.get(panelNum) || [];
    existing.push(page);
    groups.set(panelNum, existing);
  }

  return groups;
}

/**
 * Find the best matching page for a sheet using domain-aware structural matching.
 * 
 * IMPORTANT: Uses panel numbers as a primary discriminator to prevent
 * incorrect matches like "HPC CTRL,JB73" matching "RAIL,RIGHT,JB73".
 * These layouts may share the same JB identifier but have different panel numbers.
 */
export function findBestMatchingPage(
  sheetName: string,
  sheetSlug: string,
  layoutPages: LayoutPagePreview[]
): SheetLayoutMatch & { reasons?: string[]; panelNumber?: string } {
  let bestMatch: SheetLayoutMatch & { reasons?: string[]; panelNumber?: string } = {
    sheetName,
    sheetSlug,
    matchedPageNumber: undefined,
    matchedPageTitle: undefined,
    confidence: "unmatched",
    score: 0,
    alternativeMatches: [],
    reasons: [],
  };

  const scoredMatches: Array<{
    pageNumber: number;
    pageTitle: string;
    panelNumber?: string;
    score: number;
    detailed: MatchScore;
    imageUrl: string;
  }> = [];

  for (const page of layoutPages) {
    if (!page.title) continue;

    const { score, detailed } = scoreSheetToPageMatch(sheetName, page.title);

    // Only consider matches without structural conflicts
    // or with positive scores
    if (!detailed.hasConflict || score > 0) {
      scoredMatches.push({
        pageNumber: page.pageNumber,
        pageTitle: page.title,
        panelNumber: page.panelNumber,
        score,
        detailed,
        imageUrl: page.imageUrl,
      });
    }
  }

  // Sort by score descending
  scoredMatches.sort((a, b) => b.score - a.score);

  // Filter out matches with structural conflicts for the best match
  const validMatches = scoredMatches.filter(m => !m.detailed.hasConflict);

  // ========== PANEL NUMBER DISAMBIGUATION ==========
  // If multiple matches have the same high score but different panel numbers,
  // we should NOT auto-assign - these are different panels that happen to share JB.
  // Instead, only match if there's a clear winner by panel number uniqueness.

  if (validMatches.length > 1 && validMatches[0].score === validMatches[1].score) {
    // Tied scores - check if they have different panel numbers
    const topPanelNum = validMatches[0].panelNumber;
    const secondPanelNum = validMatches[1].panelNumber;

    if (topPanelNum && secondPanelNum && topPanelNum !== secondPanelNum) {
      // Different panels with same score - mark as ambiguous, don't auto-match
      bestMatch.reasons = [
        `Ambiguous: Multiple panels match with same score`,
        `Panel ${topPanelNum} (${validMatches[0].pageTitle}) vs Panel ${secondPanelNum} (${validMatches[1].pageTitle})`,
        `Manual review required to select correct panel`,
      ];
      bestMatch.alternativeMatches = validMatches.slice(0, 4).map(m => ({
        pageNumber: m.pageNumber,
        pageTitle: m.pageTitle,
        score: m.score,
      }));
      return bestMatch;
    }
  }

  const bestCandidate = validMatches[0] || scoredMatches[0];

  if (bestCandidate && !bestCandidate.detailed.hasConflict) {
    const confidence = getConfidenceFromScore(bestCandidate.detailed);

    // Only assign a match if confidence is not "unmatched"
    if (confidence !== "unmatched") {
      bestMatch = {
        sheetName,
        sheetSlug,
        matchedPageNumber: bestCandidate.pageNumber,
        matchedPageTitle: bestCandidate.pageTitle,
        panelNumber: bestCandidate.panelNumber,
        confidence,
        imageUrl: bestCandidate.imageUrl,
        score: bestCandidate.score,
        reasons: bestCandidate.detailed.reasons,
        alternativeMatches: validMatches.slice(1, 4).map(m => ({
          pageNumber: m.pageNumber,
          pageTitle: m.pageTitle,
          score: m.score,
        })),
      };
    }
  }

  return bestMatch;
}

/**
 * Extract lightweight page details from full LayoutPagePreview[].
 * Strips base64 images, raw text, and positioned text items.
 */
function buildPageDetails(layoutPages: LayoutPagePreview[]): LayoutPageDetail[] {
  return layoutPages.map(page => {
    const detail: LayoutPageDetail = { pageNumber: page.pageNumber };
    if (page.title) detail.title = page.title;
    if (page.normalizedTitle) detail.normalizedTitle = page.normalizedTitle;
    if (page.panelNumber) detail.panelNumber = page.panelNumber;
    if (page.boxNumber) detail.boxNumber = page.boxNumber;
    if (page.hasDoorLabels != null) detail.hasDoorLabels = page.hasDoorLabels;
    if (page.width) detail.width = page.width;
    if (page.height) detail.height = page.height;
    if (page.projectNumber) detail.projectNumber = page.projectNumber;
    if (page.revision) detail.revision = page.revision;
    if (page.railGroups && page.railGroups.length > 0) detail.railGroups = page.railGroups;
    if (page.panducts && page.panducts.length > 0) detail.panducts = page.panducts;
    if (page.railGroups && page.railGroups.length > 0) {
      detail.devices = page.railGroups.flatMap(group => group.devices);
    }
    return detail;
  });
}

/**
 * Match all sheets to layout pages.
 */
export function matchLayoutPagesToWireSheets(
  sheets: Array<{ name: string; slug: string }>,
  layoutPages: LayoutPagePreview[]
): SheetLayoutMapping {
  const matches: SheetLayoutMatch[] = [];
  const usedPages = new Set<number>();

  // Sort sheets by name length (longer names are more specific, match first)
  const sortedSheets = [...sheets].sort(
    (a, b) => String(b?.name ?? "").length - String(a?.name ?? "").length
  );

  for (const sheet of sortedSheets) {
    const sheetName = String(sheet?.name ?? "");
    const sheetSlug = String(sheet?.slug ?? sheetName);

    // Filter out already-used pages for this round
    const availablePages = layoutPages.filter(p => !usedPages.has(p.pageNumber));
    const match = findBestMatchingPage(sheetName, sheetSlug, availablePages);

    // Only claim the page if it's a high-confidence match
    if (match.matchedPageNumber && match.confidence !== "unmatched") {
      usedPages.add(match.matchedPageNumber);
    }

    matches.push(match);
  }

  // Calculate unmatched items
  const unmatchedSheets = matches
    .filter(m => m.confidence === "unmatched")
    .map(m => m.sheetName);

  const matchedPageNumbers = new Set(
    matches.filter(m => m.matchedPageNumber).map(m => m.matchedPageNumber!)
  );
  const unmatchedPages = layoutPages
    .filter(p => !matchedPageNumbers.has(p.pageNumber))
    .map(p => p.pageNumber);

  // Calculate overall confidence
  const highConfidenceCount = matches.filter(m => m.confidence === "high").length;
  const mediumConfidenceCount = matches.filter(m => m.confidence === "medium").length;
  const matchedCount = matches.filter(m => m.confidence !== "unmatched").length;

  let overallConfidence: MatchConfidence;
  if (highConfidenceCount >= matches.length * 0.7) {
    overallConfidence = "high";
  } else if (matchedCount >= matches.length * 0.5) {
    overallConfidence = "medium";
  } else if (matchedCount > 0) {
    overallConfidence = "low";
  } else {
    overallConfidence = "unmatched";
  }

  return {
    matches,
    unmatchedSheets,
    unmatchedPages,
    overallConfidence,
    pages: buildPageDetails(layoutPages),
  };
}

/**
 * Get match for a specific sheet.
 */
export function getMatchForSheet(
  sheetSlug: string,
  mapping: SheetLayoutMapping
): SheetLayoutMatch | undefined {
  return mapping.matches.find(m => m.sheetSlug === sheetSlug);
}

/**
 * Build a complete sheet layout mapping from project data.
 */
export function buildSheetLayoutMapping(
  sheets: Array<{ name: string; slug: string; kind?: string }>,
  layoutPages: LayoutPagePreview[]
): SheetLayoutMapping {
  // Only match operational sheets
  const operationalSheets = sheets.filter(
    s => !s.kind || s.kind === "operational"
  );

  return matchLayoutPagesToWireSheets(operationalSheets, layoutPages);
}

// ============================================================================
// Hybrid Matching (Label-Based + Title-Based)
// ============================================================================

/**
 * Extended layout page with full text content for label extraction.
 */
export interface LayoutPageWithText extends LayoutPagePreview {
  /** Full text content extracted from the PDF page */
  fullText?: string;
}

/**
 * Match layout pages to sheets using device labels as the PRIMARY strategy.
 * Falls back to title-based matching for pages without strong label matches.
 * 
 * This is the recommended function for matching when Blue Labels data is available.
 */
export function matchLayoutPagesByLabels(
  sheets: Array<{ name: string; slug: string; kind?: string }>,
  layoutPages: LayoutPageWithText[],
  blueLabelsData: string[][] | null
): SheetLayoutMapping {
  // Only match operational sheets
  const operationalSheets = sheets.filter(
    s => !s.kind || s.kind === "operational"
  );

  const sheetSlugs = operationalSheets.map(s => s.slug);

  // If no Blue Labels data, fall back to title-based matching
  if (!blueLabelsData || blueLabelsData.length === 0) {
    return matchLayoutPagesToWireSheets(operationalSheets, layoutPages);
  }

  // Build the sheet label map from Blue Labels
  const sheetLabelMap = buildSheetLabelMap(blueLabelsData, sheetSlugs);

  // If no labels were extracted, fall back to title-based matching
  if (sheetLabelMap.sheets.size === 0) {
    return matchLayoutPagesToWireSheets(operationalSheets, layoutPages);
  }

  // Match each page by device labels
  const labelMatches: LabelMatchResult[] = [];
  for (const page of layoutPages) {
    if (page.fullText) {
      const match = matchPageByLabels(
        page.pageNumber,
        page.fullText,
        page.title,
        sheetLabelMap
      );
      labelMatches.push(match);
    }
  }

  // Build matches array
  const matches: SheetLayoutMatch[] = [];
  const usedPages = new Set<number>();

  // First pass: Assign based on label matches
  for (const sheet of operationalSheets) {
    // Find label match for this sheet
    const labelMatch = labelMatches.find(
      lm => lm.bestMatch?.sheetSlug === sheet.slug
    );

    if (labelMatch?.bestMatch && !usedPages.has(labelMatch.pageNumber)) {
      const page = layoutPages.find(p => p.pageNumber === labelMatch.pageNumber);
      usedPages.add(labelMatch.pageNumber);

      matches.push({
        sheetName: sheet.name,
        sheetSlug: sheet.slug,
        matchedPageNumber: labelMatch.pageNumber,
        matchedPageTitle: labelMatch.pageTitle,
        confidence: labelMatch.bestMatch.confidence,
        imageUrl: page?.imageUrl,
        score: labelMatch.bestMatch.matchCount * 10, // Convert to score scale
        reasons: labelMatch.bestMatch.reasons,
        alternativeMatches: labelMatch.matches.slice(1, 4).map(m => ({
          pageNumber: labelMatch.pageNumber,
          pageTitle: m.sheetName,
          score: m.matchCount * 10,
        })),
      });
    } else {
      // Fall back to title-based matching for unmatched sheets
      const availablePages = layoutPages.filter(p => !usedPages.has(p.pageNumber));
      const titleMatch = findBestMatchingPage(sheet.name, sheet.slug, availablePages);

      if (titleMatch.matchedPageNumber && titleMatch.confidence !== "unmatched") {
        usedPages.add(titleMatch.matchedPageNumber);
      }

      // Add fallback indicator to reasons
      if (titleMatch.reasons) {
        titleMatch.reasons.unshift("(Title-based match - no label match found)");
      }

      matches.push(titleMatch);
    }
  }

  // Calculate unmatched items
  const unmatchedSheets = matches
    .filter(m => m.confidence === "unmatched")
    .map(m => m.sheetName);

  const matchedPageNumbers = new Set(
    matches.filter(m => m.matchedPageNumber).map(m => m.matchedPageNumber!)
  );
  const unmatchedPages = layoutPages
    .filter(p => !matchedPageNumbers.has(p.pageNumber))
    .map(p => p.pageNumber);

  // Calculate overall confidence
  const highConfidenceCount = matches.filter(m => m.confidence === "high").length;
  const matchedCount = matches.filter(m => m.confidence !== "unmatched").length;

  let overallConfidence: MatchConfidence;
  if (highConfidenceCount >= matches.length * 0.7) {
    overallConfidence = "high";
  } else if (matchedCount >= matches.length * 0.5) {
    overallConfidence = "medium";
  } else if (matchedCount > 0) {
    overallConfidence = "low";
  } else {
    overallConfidence = "unmatched";
  }

  return {
    matches,
    unmatchedSheets,
    unmatchedPages,
    overallConfidence,
    pages: buildPageDetails(layoutPages),
  };
}

/**
 * Build sheet label map from Blue Labels sheet.
 * Re-exported for use by hooks.
 */
export { buildSheetLabelMap, type SheetLabelMap } from "./match-by-device-labels";
