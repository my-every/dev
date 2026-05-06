/**
 * Build sidebar sections grouped by location.
 */

import type { 
  OriginalWireListNavItem, 
  OriginalWireListSection,
  SidebarStatistics,
} from "./types";

/**
 * Group nav items into sections by location.
 */
export function buildOriginalWireListSections(
  items: OriginalWireListNavItem[],
  collapsedSections?: Set<string>
): OriginalWireListSection[] {
  // Group by location
  const locationMap = new Map<string, OriginalWireListNavItem[]>();
  
  for (const item of items) {
    const loc = item.location || "Unknown Location";
    if (!locationMap.has(loc)) {
      locationMap.set(loc, []);
    }
    locationMap.get(loc)!.push(item);
  }
  
  // Build sections
  const sections: OriginalWireListSection[] = [];
  
  for (const [location, sectionItems] of locationMap) {
    const matchedCount = sectionItems.filter(i => i.matchState === "matched").length;
    const hiddenCount = sectionItems.filter(i => i.matchState === "hidden").length;
    const missingCount = sectionItems.filter(i => i.matchState === "missing").length;
    const mismatchCount = sectionItems.filter(i => i.matchState === "mismatch").length;
    
    sections.push({
      location,
      label: location,
      items: sectionItems,
      matchedCount,
      hiddenCount,
      missingCount,
      mismatchCount,
      collapsed: collapsedSections?.has(location) ?? false,
    });
  }
  
  // Sort sections by location name
  sections.sort((a, b) => a.location.localeCompare(b.location));
  
  return sections;
}

/**
 * Calculate statistics from nav items.
 */
export function calculateSidebarStatistics(
  items: OriginalWireListNavItem[]
): SidebarStatistics {
  const totalOriginal = items.length;
  const matched = items.filter(i => i.matchState === "matched").length;
  const hidden = items.filter(i => i.matchState === "hidden").length;
  const missing = items.filter(i => i.matchState === "missing").length;
  const mismatch = items.filter(i => i.matchState === "mismatch").length;
  
  const matchPercentage = totalOriginal > 0 
    ? Math.round(((matched + hidden) / totalOriginal) * 100) 
    : 0;
  
  return {
    totalOriginal,
    matched,
    hidden,
    missing,
    mismatch,
    matchPercentage,
  };
}

/**
 * Filter nav items by search query.
 */
export function filterNavItemsBySearch(
  items: OriginalWireListNavItem[],
  query: string
): OriginalWireListNavItem[] {
  if (!query.trim()) return items;
  
  const normalizedQuery = query.toLowerCase().trim();
  
  return items.filter(item => {
    return (
      item.fromDeviceId.toLowerCase().includes(normalizedQuery) ||
      item.wireNo.toLowerCase().includes(normalizedQuery) ||
      item.gaugeSize.toLowerCase().includes(normalizedQuery) ||
      item.toDeviceId.toLowerCase().includes(normalizedQuery) ||
      item.location.toLowerCase().includes(normalizedQuery) ||
      item.wireType.toLowerCase().includes(normalizedQuery)
    );
  });
}

/**
 * Filter nav items by match state.
 */
export function filterNavItemsByMatchState(
  items: OriginalWireListNavItem[],
  showMatched: boolean,
  showHidden: boolean,
  showMissing: boolean,
  showMismatch: boolean
): OriginalWireListNavItem[] {
  return items.filter(item => {
    switch (item.matchState) {
      case "matched": return showMatched;
      case "hidden": return showHidden;
      case "missing": return showMissing;
      case "mismatch": return showMismatch;
      default: return true;
    }
  });
}
