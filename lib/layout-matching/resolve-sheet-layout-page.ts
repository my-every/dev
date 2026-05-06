/**
 * resolveSheetLayoutPage
 *
 * Single source of truth for resolving which layout page belongs to a sheet.
 *
 * Resolution order:
 *   1. layoutMapping context (live, matches the current rendered PDF)
 *   2. assignment.matchedLayoutPage (persisted snapshot — used as fallback only)
 *
 * Every component that shows a layout image for a sheet should use this
 * function so all thumbnails, subheaders, and cards stay in sync.
 */

import type { LayoutPagePreview, SheetLayoutMapping } from "@/lib/layout-matching"
import type { MappedAssignment } from "@/components/projects/project-assignment-mapping-modal"

export interface ResolveLayoutPageOptions {
  sheetSlug: string
  layoutPages: LayoutPagePreview[]
  layoutMapping?: SheetLayoutMapping | null
  assignment?: MappedAssignment | null
}

/**
 * Resolve the correct layout page preview for a given sheet.
 * Returns `null` when no page can be determined.
 */
export function resolveSheetLayoutPage({
  sheetSlug,
  layoutPages,
  layoutMapping,
  assignment,
}: ResolveLayoutPageOptions): LayoutPagePreview | null {
  // Primary: live context mapping (always authoritative when available)
  if (layoutMapping) {
    const match = layoutMapping.matches.find(m => m.sheetSlug === sheetSlug)
    if (match?.matchedPageNumber) {
      const page = layoutPages.find(p => p.pageNumber === match.matchedPageNumber)
      if (page) return page
    }
  }

  // Fallback: persisted assignment page (snapshot from when mappings were last saved)
  if (assignment?.matchedLayoutPage) {
    const page = layoutPages.find(p => p.pageNumber === assignment.matchedLayoutPage)
    if (page) return page
  }

  return null
}

/**
 * Check whether a sheet has a resolved layout page (for matched/unmatched sorting).
 */
export function hasResolvedLayoutPage({
  sheetSlug,
  layoutPages,
  layoutMapping,
  assignment,
}: ResolveLayoutPageOptions): boolean {
  return resolveSheetLayoutPage({ sheetSlug, layoutPages, layoutMapping, assignment }) !== null
}
