import { createHash } from "node:crypto";

import type { BrandingSortMode, SectionColumnVisibility } from '@/lib/wire-list-print/defaults'
import { getEffectiveSectionColumns } from '@/lib/wire-list-print/defaults'
import { buildBrandingSectionRenderPlan, type BrandingVisibleSection } from '@/lib/wire-list-print/model'
import { shouldSwapForTargetPair } from '@/lib/wire-list-sections'
import { normalizeDisplayTitle } from '@/lib/workbook/normalize-sheet-name'

export interface BrandListSchemaProjectInfo {
  projectNumber?: string
  projectName?: string
  revision?: string
  controlsDE?: string
  controlsME?: string
}

export interface BrandListSchemaImportHints {
  canonicalSheetName: string
  normalizedSheetName: string
  bundleNames: string[]
  bundleDisplays: string[]
}

export interface BrandListSchemaRow {
  rowId: string
  rowIndex: number
  fromDeviceId: string
  fromTerminal?: string
  fromTerminalSide?: string
  fromTerminalTier?: string
  fromTerminalOrder?: number | null
  wireNo: string
  wireId: string
  gaugeSize: string
  length: number | null
  toDeviceId: string
  toTerminal?: string
  toLocation: string
  bundleName: string
  bundleDisplay: string
  devicePrefix: string
  isNegative?: boolean
  terminalHardware?: Record<string, string>
  terminalInstructions?: string[]
}

export interface BrandListSchemaBundle {
  bundleName: string
  toLocation: string
  rows: BrandListSchemaRow[]
}

export interface BrandListSchemaPrefixGroup {
  prefix: string
  bundles: BrandListSchemaBundle[]
}

export interface BrandListExportSchema {
  schemaVersion: 1
  generatedAt: string
  mode: 'branding-export'
  schemaHash?: string
  sheetSlug: string
  sheetName: string
  totalRows: number
  header: {
    locationTitle: string
    fromLabel: string
    toLabel: string
    columns: [
      'Device ID',
      'Wire No.',
      'Wire ID',
      'Gauge/Size',
      'Length',
      'Device ID',
      'To Location',
      'Bundle Name',
    ]
  }
  projectInfo: BrandListSchemaProjectInfo
  importHints: BrandListSchemaImportHints
  prefixGroups: BrandListSchemaPrefixGroup[]
}

export function computeBrandListSchemaHash(schema: Omit<BrandListExportSchema, "schemaHash"> | BrandListExportSchema): string {
  const normalizedPayload = {
    schemaVersion: schema.schemaVersion,
    mode: schema.mode,
    sheetSlug: schema.sheetSlug,
    sheetName: schema.sheetName,
    totalRows: schema.totalRows,
    header: schema.header,
    projectInfo: schema.projectInfo,
    importHints: schema.importHints,
    prefixGroups: schema.prefixGroups,
  };

  return createHash("sha256").update(JSON.stringify(normalizedPayload)).digest("hex");
}

function getDevicePrefix(deviceId: string | undefined): string {
  const baseDeviceId = (deviceId ?? '').split(':')[0]?.trim() ?? ''
  const match = baseDeviceId.match(/^([A-Za-z]+)/)
  return match ? match[1].toUpperCase() : baseDeviceId.toUpperCase() || 'UNKNOWN'
}

function normalizeComparableValue(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase()
}

export function normalizeBrandingWireNo(wireNo: string | null | undefined, isNegative?: boolean): string {
  const normalized = String(wireNo ?? '').trim()
  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('-')) {
    return normalized
  }

  if (isNegative || /^\d/.test(normalized)) {
    return `-${normalized}`
  }

  return normalized
}

export function normalizeBrandingGaugeSize(gaugeSize: string | null | undefined): string {
  return normalizeComparableValue(gaugeSize)
}

export function normalizeBrandingWireColor(wireColor: string | null | undefined): string {
  return normalizeComparableValue(wireColor)
}

export function buildBrandingRowGroupKey(input: {
  bundleName: string
  toLocation?: string | null
  gaugeSize?: string | null
  wireColor?: string | null
}): string {
  return [
    normalizeComparableValue(input.bundleName),
    normalizeComparableValue(input.toLocation),
    normalizeBrandingGaugeSize(input.gaugeSize),
    normalizeBrandingWireColor(input.wireColor),
  ].join('|')
}

export function normalizeExternalAssignmentTitle(value: string | null | undefined): string {
  const normalized = normalizeDisplayTitle(String(value ?? ''))
    .replace(/^JB\d+\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized.replace(/\s+(PNL|PANEL|BOX|DOOR|RAIL|COMPNT|COMPONENT|CTRL|CONTROL)\b/i, ' - $1')
}

export function buildBrandingRowGroupLabel(input: {
  bundleName: string
  toLocation?: string | null
  currentSheetName?: string | null
}): string {
  const bundleName = String(input.bundleName ?? '').trim()
  const toLocation = String(input.toLocation ?? '').trim()
  const currentSheetName = String(input.currentSheetName ?? '').trim()

  if (!toLocation || toLocation.toUpperCase() === currentSheetName.toUpperCase()) {
    return bundleName
  }

  const assignmentTitle = normalizeExternalAssignmentTitle(toLocation)
  return assignmentTitle ? `${bundleName} - ${assignmentTitle}` : bundleName
}

export function compareBrandingGaugeAndColor(
  left: { gaugeSize?: string | null; wireColor?: string | null },
  right: { gaugeSize?: string | null; wireColor?: string | null },
): number {
  const gaugeCompare = normalizeBrandingGaugeSize(left.gaugeSize).localeCompare(
    normalizeBrandingGaugeSize(right.gaugeSize),
    undefined,
    { numeric: true, sensitivity: 'base' },
  )
  if (gaugeCompare !== 0) {
    return gaugeCompare
  }

  return normalizeBrandingWireColor(left.wireColor).localeCompare(
    normalizeBrandingWireColor(right.wireColor),
    undefined,
    { numeric: true, sensitivity: 'base' },
  )
}

const TERMINAL_SIDE_ORDER: Record<string, number> = {
  left: 0,
  right: 1,
  top: 2,
  bottom: 3,
  front: 4,
  rear: 5,
  inner: 6,
  outer: 7,
  unknown: 99,
}

function parseTierValue(value: string | undefined): number | string {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (!normalized) {
    return Number.MAX_SAFE_INTEGER
  }

  const numeric = normalized.replace(/^T/i, '')
  return /^\d+$/.test(numeric) ? Number(numeric) : normalized
}

function parseTerminalValue(value: string | undefined): number | string {
  const normalized = String(value ?? '').trim().toUpperCase()
  if (!normalized) {
    return Number.MAX_SAFE_INTEGER
  }

  return /^\d+$/.test(normalized) ? Number(normalized) : normalized
}

function getBrandingBaseDeviceId(row: BrandingVisibleSection['rows'][number]['row']): string {
  const swap = shouldSwapForTargetPair(row.fromDeviceId, row.toDeviceId)
  const displayDeviceId = swap ? (row.toDeviceId || '') : (row.fromDeviceId || '')
  return displayDeviceId.split(':')[0]?.trim() ?? ''
}

function hasTerminationDetail(label: string): boolean {
  return /[:/]/.test(label)
}

function normalizeBrandingBundleColor(value: string | null | undefined): 'RED' | 'BLU' | null {
  const normalized = normalizeComparableValue(value)
  if (normalized === 'RED') {
    return 'RED'
  }
  if (normalized === 'BLU' || normalized === 'BLUE') {
    return 'BLU'
  }
  return null
}

function resolveBrandingBundleName(input: {
  subgroupLabel: string
  baseDeviceId: string
  baseDeviceRowCount: number
  wireColor?: string | null
}): string {
  const subgroupLabel = input.subgroupLabel.trim()
  const baseDeviceId = input.baseDeviceId.trim()
  const bundleColor = normalizeBrandingBundleColor(input.wireColor)

  if (baseDeviceId && bundleColor && input.baseDeviceRowCount > 1) {
    return `${baseDeviceId} - ${bundleColor}`
  }

  if (baseDeviceId && input.baseDeviceRowCount > 1 && (!subgroupLabel || hasTerminationDetail(subgroupLabel))) {
    return baseDeviceId
  }

  return subgroupLabel || getDevicePrefix(baseDeviceId)
}

function getEffectiveBrandingSubgroupLabel(subgroupLabel: string, baseDeviceId: string): string {
  const normalizedLabel = subgroupLabel.trim()
  if (!normalizedLabel) {
    return ''
  }

  const labelBaseDevice = normalizedLabel.split(/[:/]/)[0]?.trim() ?? ''
  if (/^[A-Z]+[0-9]+$/i.test(labelBaseDevice) && baseDeviceId && labelBaseDevice.toUpperCase() !== baseDeviceId.toUpperCase()) {
    return ''
  }

  return normalizedLabel
}

export function buildBrandListExportSchema(options: {
  sheetSlug: string
  sheetName: string
  brandingVisibleSections: BrandingVisibleSection[]
  sectionColumnVisibility: Record<string, SectionColumnVisibility>
  brandingSortMode?: BrandingSortMode
  projectInfo?: BrandListSchemaProjectInfo
  generatedAt?: string
    resolveTerminalMetadata?: (input: { fromDeviceId: string; toDeviceId: string; wireNo?: string; wireId?: string }) => {
      fromTerminal?: string
      fromTerminalSide?: string
      fromTerminalTier?: string
      fromTerminalOrder?: number | null
      toTerminal?: string
      isNegative?: boolean
      terminalHardware?: Record<string, string>
      terminalInstructions?: string[]
  } | null
}): BrandListExportSchema {
  const {
    sheetSlug,
    sheetName,
    brandingVisibleSections,
    sectionColumnVisibility,
    brandingSortMode = 'default',
    projectInfo,
    generatedAt,
    resolveTerminalMetadata,
  } = options

  const prefixGroups: BrandListSchemaPrefixGroup[] = []
  let currentPrefixGroup: BrandListSchemaPrefixGroup | null = null
  let currentBundle: BrandListSchemaBundle | null = null
  let currentSubgroupLabel = ''
  let isFirstRowInSubgroup = false
  const allRows: BrandListSchemaRow[] = []
  const bundleLookup = new Map<string, BrandListSchemaBundle>()

  for (const { subsection, rows } of brandingVisibleSections) {
    const sectionColumns = getEffectiveSectionColumns(
      sectionColumnVisibility,
      subsection.label,
      subsection.sectionKind,
    )

    const rowMap = new Map(rows.map((entry) => [entry.row.__rowId, entry]))
    const renderPlan = buildBrandingSectionRenderPlan(
      rows.map((entry) => entry.row),
      sheetName,
      subsection.sectionKind,
      subsection.matchMetadata ?? {},
      undefined,
      brandingSortMode,
    )
    const baseDeviceRowCounts = new Map<string, number>()
    for (const entry of rows) {
      const baseDeviceId = getBrandingBaseDeviceId(entry.row)
      if (!baseDeviceId) {
        continue
      }
      baseDeviceRowCounts.set(baseDeviceId, (baseDeviceRowCounts.get(baseDeviceId) ?? 0) + 1)
    }

    for (const item of renderPlan) {
      if (item.type === 'group-header' && item.group.groupKind === 'prefix-category') {
        currentPrefixGroup = {
          prefix: item.group.label || 'UNKNOWN',
          bundles: [],
        }
        prefixGroups.push(currentPrefixGroup)
        currentBundle = null
        currentSubgroupLabel = ''
        isFirstRowInSubgroup = false
        continue
      }

      if (item.type === 'group-header' && item.group.groupKind === 'subgroup') {
        currentSubgroupLabel = item.group.label || ''
        isFirstRowInSubgroup = true
        currentBundle = null
        continue
      }

      if (item.type !== 'row') {
        continue
      }

      const entry = rowMap.get(item.rowId)
      if (!entry) {
        continue
      }

      const swap = shouldSwapForTargetPair(entry.row.fromDeviceId, entry.row.toDeviceId)
      const fromDeviceId = swap ? (entry.row.toDeviceId || '') : (entry.row.fromDeviceId || '')
      const toDeviceId = swap ? (entry.row.fromDeviceId || '') : (entry.row.toDeviceId || '')
      const toLocation = entry.location || ''
      const devicePrefix = getDevicePrefix(fromDeviceId)
      const baseDeviceId = fromDeviceId.split(':')[0]?.trim() ?? ''

      if (!currentPrefixGroup || currentPrefixGroup.prefix !== devicePrefix) {
        currentPrefixGroup = {
          prefix: devicePrefix,
          bundles: [],
        }
        prefixGroups.push(currentPrefixGroup)
        currentBundle = null
      }

      const locationMatchesCurrent = toLocation
        && toLocation.toUpperCase() === sheetName.toUpperCase()
      const bundleName = resolveBrandingBundleName({
        subgroupLabel: getEffectiveBrandingSubgroupLabel(currentSubgroupLabel, baseDeviceId),
        baseDeviceId,
        baseDeviceRowCount: baseDeviceRowCounts.get(baseDeviceId) ?? 0,
        wireColor: sectionColumns.wireId ? entry.row.wireId : '',
      })
      const bundleKey = buildBrandingRowGroupKey({
        bundleName,
        toLocation,
        gaugeSize: sectionColumns.gaugeSize ? entry.row.gaugeSize : '',
        wireColor: sectionColumns.wireId ? normalizeBrandingBundleColor(entry.row.wireId) ?? entry.row.wireId : '',
      })
      const scopedBundleKey = `${currentPrefixGroup.prefix}|${bundleKey}`
      const existingBundle = bundleLookup.get(scopedBundleKey) ?? null
      const startsNewBundle = !existingBundle
      currentBundle = existingBundle

      if (startsNewBundle) {
        currentBundle = {
          bundleName,
          toLocation,
          rows: [],
        }
        bundleLookup.set(scopedBundleKey, currentBundle)
        currentPrefixGroup.bundles.push(currentBundle)
      }

      if (!currentBundle) {
        continue
      }

      const bundleDisplay = currentBundle.rows.length === 0
        ? buildBrandingRowGroupLabel({
          bundleName,
          toLocation: locationMatchesCurrent ? '' : toLocation,
          currentSheetName: sheetName,
        })
        : ''

      const terminalMetadata = resolveTerminalMetadata?.({
        fromDeviceId,
        toDeviceId,
        wireNo: entry.row.wireNo || '',
        wireId: entry.row.wireId || '',
      }) ?? null

      const row: BrandListSchemaRow = {
        rowId: entry.row.__rowId,
        rowIndex: entry.row.__rowIndex,
        fromDeviceId,
        fromTerminal: terminalMetadata?.fromTerminal,
        fromTerminalSide: terminalMetadata?.fromTerminalSide,
        fromTerminalTier: terminalMetadata?.fromTerminalTier,
        fromTerminalOrder: terminalMetadata?.fromTerminalOrder ?? null,
        wireNo: sectionColumns.wireNo ? normalizeBrandingWireNo(entry.row.wireNo || '', terminalMetadata?.isNegative) : '',
        wireId: sectionColumns.wireId ? (entry.row.wireId || '') : '',
        gaugeSize: sectionColumns.gaugeSize ? (entry.row.gaugeSize || '') : '',
        length: typeof entry.measurement === 'number' ? entry.measurement : null,
        toDeviceId,
        toTerminal: terminalMetadata?.toTerminal,
        toLocation,
        bundleName,
        bundleDisplay,
        devicePrefix,
        isNegative: terminalMetadata?.isNegative,
        terminalHardware: terminalMetadata?.terminalHardware,
        terminalInstructions: terminalMetadata?.terminalInstructions,
      }

      currentBundle.rows.push(row)
      allRows.push(row)
      isFirstRowInSubgroup = false
    }
  }

  for (const group of prefixGroups) {
    for (const bundle of group.bundles) {
      bundle.rows.sort((left, right) => {
        const leftOrder = left.fromTerminalOrder ?? Number.MAX_SAFE_INTEGER
        const rightOrder = right.fromTerminalOrder ?? Number.MAX_SAFE_INTEGER
        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder
        }

        const leftSide = TERMINAL_SIDE_ORDER[String(left.fromTerminalSide ?? 'unknown').toLowerCase()] ?? 99
        const rightSide = TERMINAL_SIDE_ORDER[String(right.fromTerminalSide ?? 'unknown').toLowerCase()] ?? 99
        if (leftSide !== rightSide) {
          return leftSide - rightSide
        }

        const leftTier = parseTierValue(left.fromTerminalTier)
        const rightTier = parseTierValue(right.fromTerminalTier)
        if (typeof leftTier === 'number' && typeof rightTier === 'number' && leftTier !== rightTier) {
          return leftTier - rightTier
        }
        if (typeof leftTier === 'string' && typeof rightTier === 'string' && leftTier !== rightTier) {
          return leftTier.localeCompare(rightTier, undefined, { numeric: true })
        }

        const leftTerminal = parseTerminalValue(left.fromTerminal)
        const rightTerminal = parseTerminalValue(right.fromTerminal)
        if (typeof leftTerminal === 'number' && typeof rightTerminal === 'number' && leftTerminal !== rightTerminal) {
          return leftTerminal - rightTerminal
        }
        if (typeof leftTerminal === 'string' && typeof rightTerminal === 'string' && leftTerminal !== rightTerminal) {
          return leftTerminal.localeCompare(rightTerminal, undefined, { numeric: true })
        }

        return left.rowIndex - right.rowIndex
      })

      const visibleBundleLabel = bundle.rows.find((row) => row.bundleDisplay)?.bundleDisplay
        || buildBrandingRowGroupLabel({
          bundleName: bundle.bundleName,
          toLocation: bundle.toLocation,
          currentSheetName: sheetName,
        })
      bundle.rows.forEach((row, rowIndex) => {
        row.bundleDisplay = rowIndex === 0 ? visibleBundleLabel : ''
      })
    }
  }

  const bundleNames = Array.from(
    new Set(
      prefixGroups.flatMap((group) => group.bundles.map((bundle) => bundle.bundleName)).filter(Boolean),
    ),
  )
  const bundleDisplays = Array.from(
    new Set(
      allRows.map((row) => row.bundleDisplay).filter((value) => typeof value === 'string' && value.trim().length > 0),
    ),
  )

  const nextSchema: BrandListExportSchema = {
    schemaVersion: 1,
    generatedAt: generatedAt ?? new Date().toISOString(),
    mode: 'branding-export',
    sheetSlug,
    sheetName,
    totalRows: allRows.length,
    header: {
      locationTitle: sheetName,
      fromLabel: 'From',
      toLabel: 'To',
      columns: [
        'Device ID',
        'Wire No.',
        'Wire ID',
        'Gauge/Size',
        'Length',
        'Device ID',
        'To Location',
        'Bundle Name',
      ],
    },
    projectInfo: {
      projectNumber: projectInfo?.projectNumber,
      projectName: projectInfo?.projectName,
      revision: projectInfo?.revision,
      controlsDE: projectInfo?.controlsDE,
      controlsME: projectInfo?.controlsME,
    },
    importHints: {
      canonicalSheetName: sheetName,
      normalizedSheetName: sheetSlug,
      bundleNames,
      bundleDisplays,
    },
    prefixGroups,
  }

  return {
    ...nextSchema,
    schemaHash: computeBrandListSchemaHash(nextSchema),
  }
}
