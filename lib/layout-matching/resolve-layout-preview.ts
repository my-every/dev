import type { LayoutPagePreview } from "@/lib/layout-matching";
import { scoreLayoutSheetMatch } from "@/lib/layout-matching/score-layout-sheet-match";

interface ResolveLayoutPreviewOptions {
  pages: LayoutPagePreview[];
  matchedPageNumber?: number | null;
  sheetName?: string | null;
  sheetSlug?: string | null;
  matchedPageTitle?: string | null;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractUnitToken(...values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    const match = (value ?? "").toUpperCase().match(/\bJB\d+\b/);
    if (match) {
      return match[0];
    }
  }

  return null;
}

export function resolveLayoutPreviewPage(options: ResolveLayoutPreviewOptions): LayoutPagePreview | undefined {
  const { pages, matchedPageNumber, sheetName, sheetSlug, matchedPageTitle } = options;
  if (!pages.length) {
    return undefined;
  }

  const normalizedSheetName = normalize(sheetName);
  const normalizedSheetSlug = normalize(sheetSlug);
  const normalizedMatchedTitle = normalize(matchedPageTitle);
  const unitToken = extractUnitToken(sheetName, sheetSlug, matchedPageTitle);
  const meaningfulTokens = [normalizedSheetName, normalizedSheetSlug, normalizedMatchedTitle, unitToken]
    .filter((value): value is string => Boolean(value && value.length >= 2));

  const structuralMatches = pages
    .map((page) => ({
      page,
      score: scoreLayoutSheetMatch(sheetName ?? matchedPageTitle ?? sheetSlug ?? "", page.title ?? ""),
    }))
    .filter((entry) => entry.page.imageUrl && !entry.score.hasConflict && entry.score.total >= 60)
    .sort((a, b) => b.score.total - a.score.total || a.page.pageNumber - b.page.pageNumber);

  if (structuralMatches[0] && meaningfulTokens.length > 0) {
    return structuralMatches[0].page;
  }

  const scoredPages = pages.map((page) => {
    let score = 0;
    const normalizedTitle = normalize(page.title);
    const normalizedPageUnitType = normalize(page.unitType);

    if (normalizedMatchedTitle && normalizedTitle === normalizedMatchedTitle) {
      score += 120;
    }
    if (normalizedMatchedTitle && normalizedTitle.includes(normalizedMatchedTitle)) {
      score += 80;
    }
    if (normalizedSheetName && normalizedTitle === normalizedSheetName) {
      score += 100;
    }
    if (normalizedSheetName && normalizedTitle.includes(normalizedSheetName)) {
      score += 70;
    }
    if (normalizedSheetSlug && normalizedTitle.includes(normalizedSheetSlug)) {
      score += 40;
    }
    if (unitToken && normalizedTitle.includes(unitToken)) {
      score += 60;
    }
    if (unitToken && normalizedPageUnitType === unitToken) {
      score += 90;
    }
    if (unitToken && normalizedPageUnitType.includes(unitToken)) {
      score += 45;
    }
    if (page.imageUrl) {
      score += 5;
    }

    return { page, score };
  });

  scoredPages.sort((a, b) => b.score - a.score || a.page.pageNumber - b.page.pageNumber);
  const best = scoredPages[0];

  if (best && best.score >= 80 && meaningfulTokens.length > 0) {
    return best.page;
  }

  if (typeof matchedPageNumber === "number") {
    const exactPage = pages.find((page) => page.pageNumber === matchedPageNumber);
    if (exactPage?.imageUrl) {
      return exactPage;
    }
  }

  return pages.find((page) => Boolean(page.imageUrl));
}
