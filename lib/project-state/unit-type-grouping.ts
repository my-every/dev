import 'server-only'

import type { SlimLayoutPage } from '@/lib/layout-matching'
import type { SheetSchema } from '@/types/sheet-schema'

export interface GroupedLayoutPageSummary {
  pageNumber: number
  title?: string
  unitType?: string
}

export interface GroupedSheetSummary {
  slug: string
  name: string
  kind: SheetSchema['kind']
  rowCount: number
  inferredUnitTypes: string[]
  linkedSheetSlugs: string[]
}

export interface UnitTypeGroup {
  unitType: string
  layoutPages: GroupedLayoutPageSummary[]
  sheets: GroupedSheetSummary[]
}

export interface UnitTypeGroupingResult {
  groups: UnitTypeGroup[]
  unclassifiedLayoutPages: GroupedLayoutPageSummary[]
  unclassifiedSheets: GroupedSheetSummary[]
}

const UNIT_TYPE_REGEX = /\b(JB\d+)\b/gi

function normalizeUnitType(raw: string): string {
  return raw.trim().toUpperCase()
}

function extractUnitTypesFromText(raw: string | undefined | null): string[] {
  if (!raw) return []
  const unitTypes = new Set<string>()
  for (const match of raw.matchAll(UNIT_TYPE_REGEX)) {
    const unitType = normalizeUnitType(match[1] ?? '')
    if (unitType) {
      unitTypes.add(unitType)
    }
  }
  return Array.from(unitTypes)
}

function pushWeightedTokens(
  value: string | undefined,
  countByUnitType: Map<string, number>,
  weight = 1,
): void {
  if (!value) return
  const unitTypes = extractUnitTypesFromText(value)
  for (const unitType of unitTypes) {
    countByUnitType.set(unitType, (countByUnitType.get(unitType) ?? 0) + weight)
  }
}

function collectSheetTokenWeights(schema: SheetSchema): Map<string, number> {
  const countByUnitType = new Map<string, number>()

  // Sheet identity strongly signals unit type.
  pushWeightedTokens(schema.name, countByUnitType, 6)
  pushWeightedTokens(schema.slug, countByUnitType, 5)

  for (const header of schema.headers ?? []) {
    pushWeightedTokens(header, countByUnitType, 3)
  }

  for (const row of schema.rows ?? []) {
    pushWeightedTokens(row.fromPageZone, countByUnitType, 2)
    pushWeightedTokens(row.toPageZone, countByUnitType, 2)
    pushWeightedTokens(row.fromLocation, countByUnitType, 1)
    pushWeightedTokens(row.toLocation, countByUnitType, 1)
  }

  for (const rawRow of schema.rawRows ?? []) {
    for (const [key, value] of Object.entries(rawRow)) {
      if (key.startsWith('__')) continue
      pushWeightedTokens(String(value ?? ''), countByUnitType, 1)
    }
  }

  return countByUnitType
}

function sortUnitTypesByWeight(countByUnitType: Map<string, number>): string[] {
  return Array.from(countByUnitType.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([unitType]) => unitType)
}

function buildDeviceMemberMap(sheets: SheetSchema[]): Map<string, string> {
  const memberByDevice = new Map<string, string>()

  for (const sheet of sheets) {
    for (const row of sheet.rows ?? []) {
      const fromDevice = row.fromDeviceId?.trim().toUpperCase()
      if (fromDevice && !memberByDevice.has(fromDevice)) {
        memberByDevice.set(fromDevice, sheet.slug)
      }
    }
  }

  return memberByDevice
}

function buildCrossSheetLinks(sheets: SheetSchema[], memberByDevice: Map<string, string>): Map<string, Set<string>> {
  const links = new Map<string, Set<string>>()

  for (const sheet of sheets) {
    const sheetLinks = links.get(sheet.slug) ?? new Set<string>()

    for (const row of sheet.rows ?? []) {
      const toDevice = row.toDeviceId?.trim().toUpperCase()
      if (!toDevice) continue

      const targetSheet = memberByDevice.get(toDevice)
      if (targetSheet && targetSheet !== sheet.slug) {
        sheetLinks.add(targetSheet)
      }
    }

    links.set(sheet.slug, sheetLinks)
  }

  return links
}

export function groupLayoutAndSheetsByUnitType(
  layoutPages: SlimLayoutPage[],
  sheetSchemas: SheetSchema[],
): UnitTypeGroupingResult {
  const memberByDevice = buildDeviceMemberMap(sheetSchemas)
  const crossSheetLinks = buildCrossSheetLinks(sheetSchemas, memberByDevice)

  const tokenWeightsBySheet = new Map<string, Map<string, number>>()
  const inferredUnitTypesBySheet = new Map<string, string[]>()

  for (const sheet of sheetSchemas) {
    const weights = collectSheetTokenWeights(sheet)
    tokenWeightsBySheet.set(sheet.slug, weights)
    inferredUnitTypesBySheet.set(sheet.slug, sortUnitTypesByWeight(weights))
  }

  // If a sheet has no direct JB tag, inherit from linked sheets with clear signal.
  for (const sheet of sheetSchemas) {
    const inferred = inferredUnitTypesBySheet.get(sheet.slug) ?? []
    if (inferred.length > 0) continue

    const links = Array.from(crossSheetLinks.get(sheet.slug) ?? [])
    for (const linkedSlug of links) {
      const linkedInferred = inferredUnitTypesBySheet.get(linkedSlug) ?? []
      if (linkedInferred.length > 0) {
        inferredUnitTypesBySheet.set(sheet.slug, [linkedInferred[0]])
        break
      }
    }
  }

  const groupMap = new Map<string, UnitTypeGroup>()

  function ensureGroup(unitType: string): UnitTypeGroup {
    const normalized = normalizeUnitType(unitType)
    const existing = groupMap.get(normalized)
    if (existing) return existing

    const created: UnitTypeGroup = {
      unitType: normalized,
      layoutPages: [],
      sheets: [],
    }
    groupMap.set(normalized, created)
    return created
  }

  const unclassifiedLayoutPages: GroupedLayoutPageSummary[] = []
  for (const page of layoutPages) {
    const unitType = page.unitType ? normalizeUnitType(page.unitType) : undefined
    const summary: GroupedLayoutPageSummary = {
      pageNumber: page.pageNumber,
      title: page.title,
      unitType,
    }

    if (!unitType) {
      unclassifiedLayoutPages.push(summary)
      continue
    }

    ensureGroup(unitType).layoutPages.push(summary)
  }

  const unclassifiedSheets: GroupedSheetSummary[] = []
  for (const sheet of sheetSchemas) {
    const inferredUnitTypes = inferredUnitTypesBySheet.get(sheet.slug) ?? []
    const linkedSheetSlugs = Array.from(crossSheetLinks.get(sheet.slug) ?? []).sort((a, b) => a.localeCompare(b))

    const summary: GroupedSheetSummary = {
      slug: sheet.slug,
      name: sheet.name,
      kind: sheet.kind,
      rowCount: sheet.rowCount,
      inferredUnitTypes,
      linkedSheetSlugs,
    }

    if (inferredUnitTypes.length === 0) {
      unclassifiedSheets.push(summary)
      continue
    }

    for (const unitType of inferredUnitTypes) {
      ensureGroup(unitType).sheets.push(summary)
    }
  }

  const groups = Array.from(groupMap.values())
    .map(group => ({
      ...group,
      layoutPages: group.layoutPages.sort((a, b) => a.pageNumber - b.pageNumber),
      sheets: group.sheets.sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => a.unitType.localeCompare(b.unitType))

  return {
    groups,
    unclassifiedLayoutPages: unclassifiedLayoutPages.sort((a, b) => a.pageNumber - b.pageNumber),
    unclassifiedSheets: unclassifiedSheets.sort((a, b) => a.name.localeCompare(b.name)),
  }
}
