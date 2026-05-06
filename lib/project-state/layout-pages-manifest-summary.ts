import type { SlimLayoutPage } from '@/lib/layout-matching'

export interface LayoutPagesManifestSummary {
  unitType?: string
  unitTypes: string[]
  panducts: number
  rails: number
}

function normalizeUnitType(value: string | undefined): string | null {
  const normalized = value?.trim().toUpperCase() ?? ''
  return normalized ? normalized : null
}

export function summarizeLayoutPagesForManifest(pages: SlimLayoutPage[]): LayoutPagesManifestSummary {
  const unitTypeCount = new Map<string, number>()
  let panducts = 0
  let rails = 0

  for (const page of pages) {
    const unitType = normalizeUnitType(page.unitType)
    if (unitType) {
      unitTypeCount.set(unitType, (unitTypeCount.get(unitType) ?? 0) + 1)
    }

    panducts += Array.isArray(page.panducts) ? page.panducts.length : 0
    rails += Array.isArray(page.rails) ? page.rails.length : 0
  }

  const unitTypes = Array.from(unitTypeCount.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([unitType]) => unitType)

  return {
    unitType: unitTypes[0],
    unitTypes,
    panducts,
    rails,
  }
}
