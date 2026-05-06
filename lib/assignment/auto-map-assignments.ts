/**
 * Auto-Map Assignments
 *
 * Automatically maps layout pages and SWS types to sheets using the full
 * domain-aware structural scoring system instead of simple exact-title matching.
 *
 * Layout matching uses a multi-strategy approach:
 *   1. Domain-aware structural scoring (JB ID, area type, side, tokens)
 *   2. Panel number disambiguation for tied scores
 *   3. Greedy assignment: longest names first, claim pages to avoid duplicates
 *
 * SWS detection uses layout context (panel/box numbers, door labels, text)
 * from the matched page for more accurate classification.
 */

import type { ProjectSheetSummary } from '@/lib/workbook/types'
import type { LayoutPagePreview } from '@/lib/layout-matching/types'
import { matchLayoutPagesToWireSheets } from '@/lib/layout-matching/match-layout-pages-to-sheets'
import { detectSwsType, type SwsDetectionResult } from './sws-detection'

export interface AutoMapResult {
    /** Matched layout page number, or undefined if no match */
    matchedLayoutPage?: number
    /** Display title of the matched layout page */
    matchedLayoutTitle?: string
    /** The matched page object for additional context */
    matchedPage?: LayoutPagePreview
    /** SWS detection result with layout context applied */
    swsDetection: SwsDetectionResult
}

/**
 * Run auto-mapping for all sheets against the available layout pages.
 *
 * Returns a map from sheetSlug → AutoMapResult containing the best layout
 * page match and a context-aware SWS detection.
 */
export function autoMapAssignments(
    sheets: ProjectSheetSummary[],
    layoutPages: LayoutPagePreview[],
): Map<string, AutoMapResult> {
    const results = new Map<string, AutoMapResult>()

    // ── Step 1: Match layout pages to sheets using full scoring system ──
    const mapping = matchLayoutPagesToWireSheets(
        sheets.map(s => ({ name: s.name, slug: s.slug })),
        layoutPages,
    )

    // Build a quick lookup: pageNumber → LayoutPagePreview
    const pageByNumber = new Map<number, LayoutPagePreview>()
    for (const page of layoutPages) {
        pageByNumber.set(page.pageNumber, page)
    }

    // ── Step 2: For each sheet, build SWS detection with layout context ──
    for (const sheet of sheets) {
        const match = mapping.matches.find(m => m.sheetSlug === sheet.slug)
        const matchedPage = match?.matchedPageNumber
            ? pageByNumber.get(match.matchedPageNumber)
            : undefined

        const hasWireRows = sheet.rowCount > 0

        // Build detection context from matched layout page
        const swsDetection = detectSwsType(sheet, {
            hasWireRows,
            layoutTitle: matchedPage?.title,
            layoutTextContent: matchedPage?.textContent,
            hasPanelNumber: Boolean(matchedPage?.panelNumber),
            hasBoxNumber: Boolean(matchedPage?.boxNumber),
            layoutPanelNumber: matchedPage?.panelNumber,
            layoutBoxNumber: matchedPage?.boxNumber,
        })

        results.set(sheet.slug, {
            matchedLayoutPage: match?.matchedPageNumber,
            matchedLayoutTitle: match?.matchedPageTitle ?? matchedPage?.title,
            matchedPage,
            swsDetection,
        })
    }

    return results
}
