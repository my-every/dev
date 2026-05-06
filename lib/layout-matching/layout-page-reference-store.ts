import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { resolveShareDirectory } from '@/lib/runtime/share-directory'
import type { SlimLayoutPage } from '@/lib/layout-matching/types'
import { buildLayoutPageCollections } from '@/lib/layout-matching/layout-page-collections'

export interface LayoutReferenceAggregateItem {
  value: string
  projectCount: number
}

export interface LayoutReferenceProjectSnapshot {
  projectKey: string
  pdNumber?: string | null
  projectName?: string | null
  updatedAt: string
  boxNumbers: string[]
  unitTypes: string[]
  panelNumbers: string[]
  normalizedTitles: string[]
  /** Titles with JB# stripped (e.g. "PANEL A JB70" → "PANEL A") */
  baseTitles: string[]
  /** Base titles keyed by their unit type (explicit or inferred) */
  groupedByUnitType: Record<string, string[]>
  /** Titles that could not be confidently assigned to any unit type */
  unassignedTitles: string[]
}

export interface LayoutPageReferenceDocument {
  updatedAt: string
  totalProjects: number
  projects: Record<string, LayoutReferenceProjectSnapshot>
  aggregates: {
    boxNumbers: LayoutReferenceAggregateItem[]
    unitTypes: LayoutReferenceAggregateItem[]
    panelNumbers: LayoutReferenceAggregateItem[]
    normalizedTitles: LayoutReferenceAggregateItem[]
  }
}

const REFERENCES_DIR = 'References'
const REFERENCE_FILE_NAME = 'layout-pages-reference.json'

function toAggregateItems(values: string[][]): LayoutReferenceAggregateItem[] {
  const counts = new Map<string, number>()

  for (const list of values) {
    for (const value of list) {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  return Array.from(counts.entries())
    .map(([value, projectCount]) => ({ value, projectCount }))
    .sort((left, right) => {
      if (right.projectCount !== left.projectCount) {
        return right.projectCount - left.projectCount
      }
      return left.value.localeCompare(right.value)
    })
}

function createEmptyReferenceDocument(): LayoutPageReferenceDocument {
  return {
    updatedAt: new Date().toISOString(),
    totalProjects: 0,
    projects: {},
    aggregates: {
      boxNumbers: [],
      unitTypes: [],
      panelNumbers: [],
      normalizedTitles: [],
    },
  }
}

async function resolveReferenceFilePath(): Promise<string> {
  const shareRoot = await resolveShareDirectory()
  return path.join(shareRoot, REFERENCES_DIR, REFERENCE_FILE_NAME)
}

async function readReferenceDocument(): Promise<LayoutPageReferenceDocument> {
  const filePath = await resolveReferenceFilePath()

  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as LayoutPageReferenceDocument
    return {
      ...createEmptyReferenceDocument(),
      ...parsed,
      projects: Object.fromEntries(
        Object.entries(parsed.projects ?? {}).map(([key, snapshot]) => [
          key,
          {
            baseTitles: [],
            groupedByUnitType: {},
            unassignedTitles: [],
            ...snapshot,
          },
        ]),
      ),
      aggregates: {
        boxNumbers: parsed.aggregates?.boxNumbers ?? [],
        unitTypes: parsed.aggregates?.unitTypes ?? [],
        panelNumbers: parsed.aggregates?.panelNumbers ?? [],
        normalizedTitles: parsed.aggregates?.normalizedTitles ?? [],
      },
    }
  } catch {
    return createEmptyReferenceDocument()
  }
}

async function writeReferenceDocument(document: LayoutPageReferenceDocument): Promise<void> {
  const filePath = await resolveReferenceFilePath()
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, JSON.stringify(document, null, 2), 'utf-8')
}

export async function updateLayoutPageReferenceStore(input: {
  projectKey: string
  pdNumber?: string | null
  projectName?: string | null
  pages: SlimLayoutPage[]
}): Promise<LayoutPageReferenceDocument> {
  const current = await readReferenceDocument()
  const collection = buildLayoutPageCollections(input.pages)
  const updatedAt = new Date().toISOString()

  current.projects[input.projectKey] = {
    projectKey: input.projectKey,
    pdNumber: input.pdNumber ?? null,
    projectName: input.projectName ?? null,
    updatedAt,
    boxNumbers: collection.boxNumbers,
    unitTypes: collection.unitTypes,
    panelNumbers: collection.panelNumbers,
    normalizedTitles: collection.normalizedTitles,
    baseTitles: collection.baseTitles,
    groupedByUnitType: collection.groupedByUnitType,
    unassignedTitles: collection.unassignedTitles,
  }

  const snapshots = Object.values(current.projects)
  const next: LayoutPageReferenceDocument = {
    updatedAt,
    totalProjects: snapshots.length,
    projects: current.projects,
    aggregates: {
      boxNumbers: toAggregateItems(snapshots.map((snapshot) => snapshot.boxNumbers)),
      unitTypes: toAggregateItems(snapshots.map((snapshot) => snapshot.unitTypes)),
      panelNumbers: toAggregateItems(snapshots.map((snapshot) => snapshot.panelNumbers)),
      normalizedTitles: toAggregateItems(snapshots.map((snapshot) => snapshot.normalizedTitles)),
    },
  }

  await writeReferenceDocument(next)
  return next
}
