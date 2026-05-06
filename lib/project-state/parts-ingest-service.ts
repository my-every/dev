import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { resolveShareDirectorySync } from '@/lib/runtime/share-directory'
import { buildCablePartNumberMap, buildPartNumberMap } from '@/lib/part-number-list'
import { getCablePartNumbersSheet, getPartListSheet } from '@/lib/workbook/build-project-model'
import { createPart, initializePartsStructure } from '@/lib/project-state/parts-library-handlers'
import type { PartCategory, PartRecord } from '@/types/parts-library'
import type { StoredProject } from '@/types/d380-shared'
import type { DevicePartNumbersMap } from '@/lib/project-state/device-part-numbers-generator'

export interface PartIngestCandidate {
  partNumber: string
  description?: string
  sourceSheet?: string
  sourceLocation?: string
}

export interface PartIngestOptions {
  projectId?: string
  uploadedBy?: string
  dryRun?: boolean
  reviewRole?: string
}

export interface PartIngestResult {
  scanned: number
  uniqueCandidates: number
  existingCount: number
  createdCount: number
  skippedCount: number
  createdParts: string[]
  existingParts: string[]
  errors: string[]
}

interface NewPartsQueueEntry {
  partNumber: string
  category: PartCategory
  type: string
  projectId?: string
  sourceSheet?: string
  sourceLocation?: string
  discoveredAt: string
  status: 'new'
}

interface NewPartsQueueFile {
  updatedAt: string
  entries: NewPartsQueueEntry[]
}

function getPartsRoot(): string {
  return path.join(resolveShareDirectorySync(), 'parts')
}

function getNewPartsQueuePath(): string {
  return path.join(getPartsRoot(), 'new-parts-queue.json')
}

function normalizePartNumberToken(raw: string | null | undefined): string | undefined {
  const compact = String(raw ?? '').trim().toUpperCase()
  if (!compact) {
    return undefined
  }

  const normalized = compact
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\s+/g, '')
    .replace(/[^A-Z0-9._\-/]/g, '')

  if (!normalized) {
    return undefined
  }

  // Common quality gate: require at least one digit and a reasonable minimum length.
  if (!/\d/.test(normalized) || normalized.length < 3) {
    return undefined
  }

  return normalized
}

function splitPartNumbers(raw: string | undefined): string[] {
  return String(raw ?? '')
    .split(/[\n,;]+/)
    .map(token => normalizePartNumberToken(token))
    .filter((token): token is string => Boolean(token))
}

function inferCategoryAndType(candidate: PartIngestCandidate): { category: PartCategory; type: string; tags: string[] } {
  const context = `${candidate.description ?? ''} ${candidate.sourceSheet ?? ''} ${candidate.sourceLocation ?? ''}`.toLowerCase()

  if (/cable|wire|duct|loom|harness/.test(context)) {
    return { category: 'wiring', type: 'wire-management', tags: ['auto-ingest', 'wiring'] }
  }
  if (/terminal|ferrule|lug|busbar|ring terminal/.test(context)) {
    return { category: 'terminals', type: 'terminal-blocks', tags: ['auto-ingest', 'terminals'] }
  }
  if (/din|rail|panel|enclosure|bracket|mount/.test(context)) {
    return { category: 'hardware', type: 'panel-hardware', tags: ['auto-ingest', 'hardware'] }
  }
  if (/tool|crimp|stripper|cutter|driver|meter/.test(context)) {
    return { category: 'tools', type: 'hand-tools', tags: ['auto-ingest', 'tools'] }
  }
  if (/tape|label|shrink|lubricant|clean/.test(context)) {
    return { category: 'consumables', type: 'labels', tags: ['auto-ingest', 'consumables'] }
  }

  return { category: 'devices', type: 'control-modules', tags: ['auto-ingest', 'devices'] }
}

async function buildExistingPartNumberIndex(): Promise<Set<string>> {
  const root = getPartsRoot()
  const existing = new Set<string>()

  async function walk(dir: string): Promise<void> {
    let entries: Awaited<ReturnType<typeof fs.readdir>>
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }

      if (!entry.isFile() || !entry.name.endsWith('.json') || entry.name === 'manifest.json') {
        continue
      }

      try {
        const raw = await fs.readFile(fullPath, 'utf-8')
        const parsed = JSON.parse(raw) as Partial<PartRecord>
        const partNumber = normalizePartNumberToken(parsed.partNumber)
        if (partNumber) {
          existing.add(partNumber)
          continue
        }
      } catch {
        // Ignore malformed files and fall back to filename token.
      }

      const filenameToken = normalizePartNumberToken(path.basename(entry.name, '.json'))
      if (filenameToken) {
        existing.add(filenameToken)
      }
    }
  }

  await walk(root)
  return existing
}

async function readQueueFile(): Promise<NewPartsQueueFile> {
  const queuePath = getNewPartsQueuePath()
  try {
    const raw = await fs.readFile(queuePath, 'utf-8')
    const parsed = JSON.parse(raw) as NewPartsQueueFile
    return {
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
    }
  } catch {
    return {
      updatedAt: new Date().toISOString(),
      entries: [],
    }
  }
}

async function writeQueueFile(queue: NewPartsQueueFile): Promise<void> {
  const queuePath = getNewPartsQueuePath()
  await fs.mkdir(path.dirname(queuePath), { recursive: true })
  await fs.writeFile(queuePath, JSON.stringify(queue, null, 2), 'utf-8')
}

async function upsertQueueEntries(entries: NewPartsQueueEntry[]): Promise<void> {
  if (entries.length === 0) {
    return
  }

  const queue = await readQueueFile()
  const index = new Map<string, NewPartsQueueEntry>()

  for (const entry of queue.entries) {
    index.set(entry.partNumber, entry)
  }

  for (const entry of entries) {
    index.set(entry.partNumber, entry)
  }

  queue.entries = [...index.values()].sort((a, b) => a.partNumber.localeCompare(b.partNumber))
  queue.updatedAt = new Date().toISOString()
  await writeQueueFile(queue)
}

export function extractPartCandidatesFromDeviceMap(map: DevicePartNumbersMap): PartIngestCandidate[] {
  const candidates: PartIngestCandidate[] = []

  for (const entry of Object.values(map.devices ?? {})) {
    const tokens = splitPartNumbers(entry.partNumber)
    for (const token of tokens) {
      candidates.push({
        partNumber: token,
        description: entry.description,
        sourceSheet: entry.sheet,
        sourceLocation: entry.sheet,
      })
    }
  }

  return candidates
}

export function extractPartCandidatesFromStoredProject(project: StoredProject): PartIngestCandidate[] {
  const candidates: PartIngestCandidate[] = []

  const partListSheet = getPartListSheet(project.projectModel)
  const cablePartSheet = getCablePartNumbersSheet(project.projectModel)

  const partMap = buildPartNumberMap(partListSheet)
  for (const entry of partMap.values()) {
    const tokens = splitPartNumbers(entry.partNumber)
    for (const token of tokens) {
      candidates.push({
        partNumber: token,
        description: entry.description,
        sourceSheet: entry.location,
        sourceLocation: entry.location,
      })
    }
  }

  const cableMap = buildCablePartNumberMap(cablePartSheet)
  for (const entry of cableMap.values()) {
    const tokens = splitPartNumbers(entry.partNumber)
    for (const token of tokens) {
      candidates.push({
        partNumber: token,
        description: entry.description,
        sourceSheet: entry.location,
        sourceLocation: entry.location,
      })
    }
  }

  return candidates
}

export async function ingestPartCandidates(
  rawCandidates: PartIngestCandidate[],
  options: PartIngestOptions = {},
): Promise<PartIngestResult> {
  await initializePartsStructure()

  const existingIndex = await buildExistingPartNumberIndex()
  const normalizedMap = new Map<string, PartIngestCandidate>()

  for (const candidate of rawCandidates) {
    const normalizedPartNumber = normalizePartNumberToken(candidate.partNumber)
    if (!normalizedPartNumber) {
      continue
    }

    if (!normalizedMap.has(normalizedPartNumber)) {
      normalizedMap.set(normalizedPartNumber, {
        ...candidate,
        partNumber: normalizedPartNumber,
      })
    }
  }

  const uniqueCandidates = [...normalizedMap.values()]
  const createdParts: string[] = []
  const existingParts: string[] = []
  const errors: string[] = []
  const queueEntries: NewPartsQueueEntry[] = []

  for (const candidate of uniqueCandidates) {
    if (existingIndex.has(candidate.partNumber)) {
      existingParts.push(candidate.partNumber)
      continue
    }

    const { category, type, tags } = inferCategoryAndType(candidate)
    const now = new Date().toISOString()

    const stub: PartRecord = {
      partNumber: candidate.partNumber,
      description: candidate.description?.trim() || 'New part detected from workbook upload',
      category,
      type,
      tags,
      source: 'workbook_ingest',
      lifecycle: {
        status: 'new',
        needsTraining: true,
        needsImages: true,
        needsReviewByRole: options.reviewRole ?? 'team_lead',
        discoveredFrom: {
          projectId: options.projectId,
          sourceSheet: candidate.sourceSheet,
          sourceLocation: candidate.sourceLocation,
          uploadedBy: options.uploadedBy,
          discoveredAt: now,
        },
      },
      createdAt: now,
      updatedAt: now,
    }

    if (options.dryRun) {
      createdParts.push(candidate.partNumber)
      queueEntries.push({
        partNumber: candidate.partNumber,
        category,
        type,
        projectId: options.projectId,
        sourceSheet: candidate.sourceSheet,
        sourceLocation: candidate.sourceLocation,
        discoveredAt: now,
        status: 'new',
      })
      continue
    }

    try {
      await createPart(stub)
      existingIndex.add(candidate.partNumber)
      createdParts.push(candidate.partNumber)
      queueEntries.push({
        partNumber: candidate.partNumber,
        category,
        type,
        projectId: options.projectId,
        sourceSheet: candidate.sourceSheet,
        sourceLocation: candidate.sourceLocation,
        discoveredAt: now,
        status: 'new',
      })
    } catch (error) {
      errors.push(`Failed to create ${candidate.partNumber}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  if (!options.dryRun) {
    await upsertQueueEntries(queueEntries)
  }

  return {
    scanned: rawCandidates.length,
    uniqueCandidates: uniqueCandidates.length,
    existingCount: existingParts.length,
    createdCount: createdParts.length,
    skippedCount: existingParts.length,
    createdParts,
    existingParts,
    errors,
  }
}

export async function ingestDevicePartNumbersMap(
  map: DevicePartNumbersMap,
  options: PartIngestOptions = {},
): Promise<PartIngestResult> {
  const candidates = extractPartCandidatesFromDeviceMap(map)
  return ingestPartCandidates(candidates, options)
}

export async function ingestStoredProjectPartNumbers(
  project: StoredProject,
  options: PartIngestOptions = {},
): Promise<PartIngestResult> {
  const candidates = extractPartCandidatesFromStoredProject(project)
  return ingestPartCandidates(candidates, options)
}
