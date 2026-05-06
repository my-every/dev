import type { SlimLayoutPage } from '@/lib/layout-matching'
import { normalizeLayoutPageTitle, normalizeSheetName } from '@/lib/layout-matching'
import { type UbpReferenceIndex, inferUnitTypeByUbpReference, scorePageByUbpReference } from '@/lib/layout-matching/ubp-reference-index'
import type {
  ManifestAssignmentNode,
  ManifestLayoutMatch,
  ManifestLayoutPageMatch,
  ProjectManifest,
} from '@/types/project-manifest'
import { scoreLayoutSheetMatch } from '@/lib/layout-matching/score-layout-sheet-match'
import { calculateAggregates } from '@/lib/services/manifest-service'
import { calculateProjectPriorities, parseTimeToMinutes, calculateRemainingMinutes } from '@/lib/services/priority-service'

const UNIT_TYPE_REGEX = /\b(JB\d+)\b/i
const GENERIC_TOKENS = new Set([
  'TURBINE',
  'BOX',
  'PANEL',
  'CONTROL',
  'CTRL',
  'BOP',
  'LEFT',
  'RIGHT',
  'RAIL',
])

export interface NormalizedLayoutPage extends SlimLayoutPage {
  inferredUnitType?: string
  normalizedResolvedTitle: string
  titleTokens: string[]
}

export interface NormalizedLayoutPageIndex {
  pages: NormalizedLayoutPage[]
  byUnitType: Map<string, NormalizedLayoutPage[]>
}

function normalizeUnitType(value?: string | null): string | undefined {
  const normalized = value?.trim().toUpperCase()
  return normalized ? normalized : undefined
}

function extractUnitType(value?: string | null): string | undefined {
  const match = value?.match(UNIT_TYPE_REGEX)
  return normalizeUnitType(match?.[1])
}

function tokenizeTitle(value: string): string[] {
  return value
    .split(/\s+/)
    .map((token) => token.trim().toUpperCase())
    .filter(Boolean)
}

function extractSignalTokens(value: string): string[] {
  return tokenizeTitle(value).filter((token) => !GENERIC_TOKENS.has(token))
}

function inferConfidence(score: number): ManifestLayoutPageMatch['confidence'] {
  if (score >= 110) return 'high'
  if (score >= 70) return 'medium'
  if (score >= 35) return 'low'
  return 'unmatched'
}

function inferMatchMethod(score: number): ManifestLayoutPageMatch['matchMethod'] {
  if (score >= 110) return 'title'
  if (score >= 70) return 'title'
  return 'fallback'
}

function inferPrimaryUnitType(counts: Map<string, number>): string | undefined {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0]
}

function inferAssignmentUnitType(assignment: ManifestAssignmentNode): string | undefined {
  return normalizeUnitType(assignment.unitType)
    ?? extractUnitType(assignment.sheetName)
    ?? extractUnitType(assignment.sheetSlug)
}

export function inferUnitTypeFromLayoutPage(page: SlimLayoutPage): string | undefined {
  return normalizeUnitType(page.unitType)
    ?? extractUnitType(page.title)
    ?? extractUnitType(page.normalizedTitle)
}

export function buildNormalizedLayoutPageIndex(pages: SlimLayoutPage[]): NormalizedLayoutPageIndex {
  const normalizedPages = pages.map((page) => {
    const normalizedResolvedTitle = normalizeLayoutPageTitle(
      page.normalizedTitle?.trim() || page.title?.trim() || `PAGE ${page.pageNumber}`,
    )
    return {
      ...page,
      inferredUnitType: inferUnitTypeFromLayoutPage(page),
      normalizedResolvedTitle,
      titleTokens: tokenizeTitle(normalizedResolvedTitle),
    }
  })

  const byUnitType = new Map<string, NormalizedLayoutPage[]>()
  for (const page of normalizedPages) {
    if (!page.inferredUnitType) continue
    const current = byUnitType.get(page.inferredUnitType) ?? []
    current.push(page)
    byUnitType.set(page.inferredUnitType, current)
  }

  return { pages: normalizedPages, byUnitType }
}

function scoreAssignmentToPage(
  assignment: ManifestAssignmentNode,
  assignmentUnitType: string | undefined,
  page: NormalizedLayoutPage,
  ubpIndex?: UbpReferenceIndex,
  projectUnitTypes?: string[],
): number {
  const normalizedSheetName = normalizeSheetName(assignment.sheetName)
  const structuralScore = scoreLayoutSheetMatch(
    assignment.sheetName,
    page.title ?? page.normalizedResolvedTitle,
  )

  if (structuralScore.hasConflict) {
    return -1
  }

  const hasStructuralMatch = structuralScore.total >= 60
  const hasStructuralSignal = structuralScore.total >= 35
  const sheetTokens = new Set(tokenizeTitle(normalizedSheetName))
  const signalTokens = extractSignalTokens(normalizedSheetName)
  let score = 0

  if (assignmentUnitType && page.inferredUnitType === assignmentUnitType) {
    score += 80
  }

  if (page.normalizedResolvedTitle === normalizedSheetName) {
    score += 70
  } else {
    if (page.normalizedResolvedTitle.includes(normalizedSheetName) || normalizedSheetName.includes(page.normalizedResolvedTitle)) {
      score += 40
    }

    const overlap = signalTokens.filter((token) => page.titleTokens.includes(token))
    score += overlap.length * 18
  }

  if (sheetTokens.has('DOOR') && page.titleTokens.includes('DOOR')) score += 20
  if (sheetTokens.has('LEFT') && page.titleTokens.includes('LEFT')) score += 18
  if (sheetTokens.has('RIGHT') && page.titleTokens.includes('RIGHT')) score += 18
  if (sheetTokens.has('RAIL') && page.titleTokens.includes('RAIL')) score += 18
  if (sheetTokens.has('PLC') && page.titleTokens.includes('PLC')) score += 20
  if (sheetTokens.has('POWER') && page.titleTokens.includes('POWER')) score += 20
  if (sheetTokens.has('PANEL') && page.titleTokens.includes('PANEL')) score += 14

  if (signalTokens.length === 0 && assignmentUnitType && page.inferredUnitType === assignmentUnitType) {
    score += 15
  }

  // ── UBP reference bonus ────────────────────────────────────────────────────
  // Boosts score using cross-project panel/box/unit signals from the reference.
  // Applied after structural scoring so it never masks hard conflicts (score=-1).
  const referenceBonus = ubpIndex
    ? scorePageByUbpReference(page, assignment.sheetName, projectUnitTypes ?? (assignmentUnitType ? [assignmentUnitType] : []), ubpIndex)
    : 0

  const titleMatched = page.normalizedResolvedTitle === normalizedSheetName
  const strongLegacyMatch = titleMatched || score >= 90

  if (!hasStructuralSignal && !strongLegacyMatch) {
    return -1
  }

  return score + (hasStructuralMatch ? 70 : 0) + Math.max(0, structuralScore.total) + referenceBonus
}

export function matchAssignmentToLayoutPages(
  assignment: ManifestAssignmentNode,
  layoutIndex: NormalizedLayoutPageIndex,
  ubpIndex?: UbpReferenceIndex,
  projectUnitTypes?: string[],
): ManifestLayoutMatch | null {
  const assignmentUnitType = inferAssignmentUnitType(assignment)
  const candidatePages = assignmentUnitType
    ? [
      ...(layoutIndex.byUnitType.get(assignmentUnitType) ?? []),
      ...layoutIndex.pages.filter((page) => page.inferredUnitType !== assignmentUnitType),
    ]
    : layoutIndex.pages

  const ranked = candidatePages
    .map((page) => {
      const score = scoreAssignmentToPage(assignment, assignmentUnitType, page, ubpIndex, projectUnitTypes)
      const resolvedUnitType = page.inferredUnitType
        ?? (ubpIndex ? inferUnitTypeByUbpReference(page, assignment.sheetName, projectUnitTypes ?? (assignmentUnitType ? [assignmentUnitType] : []), ubpIndex) : undefined)
      return {
        page,
        score,
        resolvedUnitType,
      }
    })
    .filter((entry) => entry.score >= 70)
    .sort((a, b) => b.score - a.score || a.page.pageNumber - b.page.pageNumber)

  if (ranked.length === 0) {
    return null
  }

  const primaryResolvedUnitType = ranked[0]?.resolvedUnitType
  const scopedRanked = primaryResolvedUnitType
    ? ranked.filter((entry) => !entry.resolvedUnitType || entry.resolvedUnitType === primaryResolvedUnitType)
    : ranked

  const pages: ManifestLayoutPageMatch[] = scopedRanked.slice(0, 3).map(({ page, score, resolvedUnitType }) => ({
    pageNumber: page.pageNumber,
    title: page.title ?? `Page ${page.pageNumber}`,
    normalizedTitle: page.normalizedResolvedTitle,
    unitType: resolvedUnitType,
    panelNumber: page.panelNumber ?? null,
    boxNumber: page.boxNumber ?? null,
    confidence: inferConfidence(score),
    matchMethod: inferMatchMethod(score),
    score,
  }))

  return {
    primaryPage: pages[0],
    pages: pages.slice(1),
  }
}

export function deriveProjectMechanicalSummaryFromAssignments(
  assignments: Record<string, ManifestAssignmentNode>,
): Pick<ProjectManifest, 'unitType' | 'unitTypes' | 'panducts' | 'rails'> {
  const unitTypeCounts = new Map<string, number>()
  const railKeys = new Set<string>()
  const panductKeys = new Set<string>()

  for (const assignment of Object.values(assignments)) {
    const unitType = normalizeUnitType(assignment.unitType)
    if (unitType) {
      unitTypeCounts.set(unitType, (unitTypeCounts.get(unitType) ?? 0) + 1)
    }

    for (const rail of assignment.rails ?? []) {
      const key = `${unitType ?? 'UNKNOWN'}:${rail.trim().toUpperCase()}`
      railKeys.add(key)
    }

    for (const panduct of assignment.panducts ?? []) {
      const key = `${unitType ?? 'UNKNOWN'}:${panduct.trim().toUpperCase()}`
      panductKeys.add(key)
    }
  }

  const unitTypes = Array.from(unitTypeCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([unitType]) => unitType)

  return {
    unitType: inferPrimaryUnitType(unitTypeCounts) ?? '',
    unitTypes,
    panducts: panductKeys.size,
    rails: railKeys.size,
  }
}

export function computeManifestAggregates(manifest: ProjectManifest): ProjectManifest {
  const assignments = Object.fromEntries(
    Object.entries(manifest.assignments ?? {}).map(([slug, assignment]) => {
      const totalEstimatedMinutes =
        parseTimeToMinutes(assignment.buildUpEstTime ?? '')
        + parseTimeToMinutes(assignment.wireListEstTime ?? '')
      const remainingMinutes = calculateRemainingMinutes(assignment)
      const actualMinutes =
        assignment.actualMinutes
        ?? (assignment.boardAssignment?.actualStartTime && assignment.boardAssignment?.actualEndTime
          ? Math.max(
            0,
            Math.round(
              (new Date(assignment.boardAssignment.actualEndTime).getTime()
                - new Date(assignment.boardAssignment.actualStartTime).getTime()) / 60000,
            ),
          )
          : undefined)

      return [
        slug,
        {
          ...assignment,
          totalEstimatedMinutes,
          remainingMinutes,
          actualMinutes,
        },
      ]
    }),
  ) as ProjectManifest['assignments']

  return calculateAggregates(
    calculateProjectPriorities({
      ...manifest,
      assignments,
    }),
  )
}
