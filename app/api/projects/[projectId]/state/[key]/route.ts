import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { resolveProjectRootDirectory } from '@/lib/project-state/share-project-state-handlers'
import { readAllSheetSchemas } from '@/lib/project-state/share-project-state-handlers'
import { readProjectManifest, writeProjectManifest } from '@/lib/project-state/share-project-state-handlers'
import { summarizeLayoutPagesForManifest } from '@/lib/project-state/layout-pages-manifest-summary'
import { buildManifestAssignmentSummaries } from '@/lib/project-state/manifest-assignment-summaries'
import { groupLayoutAndSheetsByUnitType } from '@/lib/project-state/unit-type-grouping'
import { buildLayoutPageCollections } from '@/lib/layout-matching/layout-page-collections'
import { updateLayoutPageReferenceStore } from '@/lib/layout-matching/layout-page-reference-store'
import type { LayoutPageIndexItem, LayoutPagesIndexDocument, SlimLayoutPage } from '@/lib/layout-matching'

export const dynamic = 'force-dynamic'

type StateKey = 'layout-pages' | 'layout-mapping' | 'upload-props' | 'biq-photos'

function isStateKey(value: string): value is StateKey {
  return value === 'layout-pages' || value === 'layout-mapping' || value === 'upload-props' || value === 'biq-photos'
}

function getStateFileName(key: StateKey): string {
  if (key === 'layout-pages') return 'layout-pages.json'
  if (key === 'layout-mapping') return 'layout-mapping.json'
  if (key === 'biq-photos') return 'biq-photos.json'
  return 'upload-props.json'
}

async function resolveStateFilePath(
  projectId: string,
  key: StateKey,
  pdNumber?: string | null,
  projectName?: string | null,
): Promise<string | null> {
  const projectRoot = await resolveProjectRootDirectory(projectId, { pdNumber, projectName })
  if (!projectRoot) return null

  const stateDir = path.join(projectRoot, 'state')
  await fs.mkdir(stateDir, { recursive: true })
  return path.join(stateDir, getStateFileName(key))
}

function toSlimPage(page: Record<string, unknown>): SlimLayoutPage {
  const railGroups = Array.isArray(page.railGroups) ? page.railGroups : []
  const devices = Array.isArray(page.devices) ? page.devices : []
  return {
    pageNumber: page.pageNumber as number,
    title: page.title as string | undefined,
    normalizedTitle: page.normalizedTitle as string | undefined,
    unitType: page.unitType as string | undefined,
    width: page.width as number | undefined,
    height: page.height as number | undefined,
    boxNumber: page.boxNumber as string | undefined,
    panelNumber: page.panelNumber as string | undefined,
    hasDoorLabels: page.hasDoorLabels as boolean | undefined,
    rails: railGroups.map((rg: Record<string, unknown>) => ({
      railLabel: (rg.railLabel as string) ?? '',
      railY: (rg.railY as number) ?? 0,
      spanXStart: typeof rg.spanXStart === 'number' ? (rg.spanXStart as number) : undefined,
      spanXEnd: typeof rg.spanXEnd === 'number' ? (rg.spanXEnd as number) : undefined,
      corridorTop: typeof rg.corridorTop === 'number' ? (rg.corridorTop as number) : undefined,
      corridorBottom: typeof rg.corridorBottom === 'number' ? (rg.corridorBottom as number) : undefined,
    })),
    railGroups: railGroups as SlimLayoutPage['railGroups'],
    devices: devices as SlimLayoutPage['devices'],
    panducts: Array.isArray(page.panducts) ? page.panducts : [],
    imageUrl: (page.imageUrl as string) ?? '',
  }
}

function toIndexPage(page: Record<string, unknown>): LayoutPageIndexItem {
  const railGroups = Array.isArray(page.railGroups) ? page.railGroups : []
  const textItems = Array.isArray(page.textItems) ? page.textItems : []
  const devices = Array.isArray(page.devices) ? page.devices : []
  return {
    pageNumber: page.pageNumber as number,
    title: page.title as string | undefined,
    normalizedTitle: page.normalizedTitle as string | undefined,
    unitType: page.unitType as string | undefined,
    width: page.width as number | undefined,
    height: page.height as number | undefined,
    boxNumber: page.boxNumber as string | undefined,
    panelNumber: page.panelNumber as string | undefined,
    hasDoorLabels: page.hasDoorLabels as boolean | undefined,
    rails: railGroups.map((rg: Record<string, unknown>) => ({
      railLabel: (rg.railLabel as string) ?? '',
      railY: (rg.railY as number) ?? 0,
      spanXStart: typeof rg.spanXStart === 'number' ? (rg.spanXStart as number) : undefined,
      spanXEnd: typeof rg.spanXEnd === 'number' ? (rg.spanXEnd as number) : undefined,
      corridorTop: typeof rg.corridorTop === 'number' ? (rg.corridorTop as number) : undefined,
      corridorBottom: typeof rg.corridorBottom === 'number' ? (rg.corridorBottom as number) : undefined,
    })),
    railGroups: railGroups as LayoutPageIndexItem['railGroups'],
    devices: devices as LayoutPageIndexItem['devices'],
    panducts: Array.isArray(page.panducts) ? page.panducts : [],
    imageUrl: (page.imageUrl as string) ?? '',
    textContent: (page.textContent as string) ?? '',
    textItems: textItems.map((item: Record<string, unknown>) => ({
      text: (item.text as string) ?? (item.str as string) ?? '',
      x: Number(item.x ?? 0),
      y: Number(item.y ?? 0),
      width: Number(item.width ?? 0),
      height: Number(item.height ?? 0),
    })),
    anchors: Array.isArray(page.anchors) ? (page.anchors as LayoutPageIndexItem['anchors']) : [],
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; key: string }> },
) {
  const { projectId, key } = await params

  if (!isStateKey(key)) {
    return NextResponse.json({ error: 'Invalid state key' }, { status: 400 })
  }

  const filePath = await resolveStateFilePath(projectId, key)
  if (!filePath) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    const data = JSON.parse(raw)

    if (key === 'layout-pages') {
      const pages = (data.pages ?? []) as SlimLayoutPage[]
      const groupBy = request.nextUrl.searchParams.get('groupBy')?.toLowerCase()

      if (groupBy === 'unittype') {
        const schemas = await readAllSheetSchemas(projectId)
        const groupedByUnitType = groupLayoutAndSheetsByUnitType(pages, schemas)
        return NextResponse.json({ key, data: { pages, groupedByUnitType } })
      }

      return NextResponse.json({ key, data: { pages: data.pages ?? [] } })
    }

    if (key === 'upload-props') {
      return NextResponse.json({ key, data: { props: data.props ?? null } })
    }

    if (key === 'biq-photos') {
      return NextResponse.json({ key, data: { photos: Array.isArray(data.photos) ? data.photos : [] } })
    }

    return NextResponse.json({ key, data: { mapping: data.mapping ?? null } })
  } catch {
    return NextResponse.json({ error: 'State object not found' }, { status: 404 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string; key: string }> },
) {
  const { projectId, key } = await params

  if (!isStateKey(key)) {
    return NextResponse.json({ error: 'Invalid state key' }, { status: 400 })
  }

  const body = await request.json() as {
    pdNumber?: string | null
    projectName?: string | null
    pages?: Record<string, unknown>[]
    mapping?: unknown
    props?: unknown
    photos?: unknown
  }

  const filePath = await resolveStateFilePath(projectId, key, body.pdNumber, body.projectName)
  if (!filePath) {
    return NextResponse.json({ error: 'Could not resolve project directory' }, { status: 400 })
  }

  if (key === 'layout-pages') {
    if (!Array.isArray(body.pages)) {
      return NextResponse.json({ error: 'Invalid payload for state key' }, { status: 400 })
    }

    const slimPages = body.pages.map(toSlimPage)
    await fs.writeFile(filePath, JSON.stringify({ pages: slimPages }, null, 2), 'utf-8')
    const indexPayload: LayoutPagesIndexDocument = {
      generatedAt: new Date().toISOString(),
      source: 'pdfjs-dist',
      pageCount: body.pages.length,
      pages: body.pages.map(toIndexPage),
    }
    await fs.writeFile(path.join(path.dirname(filePath), 'layout-pages.index.json'), JSON.stringify(indexPayload, null, 2), 'utf-8')
    await fs.writeFile(
      path.join(path.dirname(filePath), 'layout-pages.collections.json'),
      JSON.stringify(buildLayoutPageCollections(slimPages), null, 2),
      'utf-8',
    )

    const manifestForReference = await readProjectManifest(projectId)
    await updateLayoutPageReferenceStore({
      projectKey: manifestForReference?.pdNumber || projectId,
      pdNumber: manifestForReference?.pdNumber ?? body.pdNumber ?? null,
      projectName: manifestForReference?.name ?? body.projectName ?? null,
      pages: slimPages,
    })

    const manifest = manifestForReference
    if (manifest) {
      const summary = summarizeLayoutPagesForManifest(slimPages)
      const projectRoot = await resolveProjectRootDirectory(projectId, {
        pdNumber: manifest.pdNumber,
        projectName: manifest.name,
      })
      const enrichedAssignments = projectRoot
        ? await buildManifestAssignmentSummaries(projectRoot, manifest)
        : manifest.assignments

      await writeProjectManifest({
        ...manifest,
        unitType: summary.unitType ?? manifest.unitType,
        unitTypes: summary.unitTypes,
        panducts: summary.panducts,
        rails: summary.rails,
        assignments: enrichedAssignments as typeof manifest.assignments,
      })
    }

    return NextResponse.json({ ok: true, key })
  }

  if (key === 'upload-props') {
    await fs.writeFile(filePath, JSON.stringify({ props: body.props ?? null }, null, 2), 'utf-8')
    return NextResponse.json({ ok: true, key })
  }

  if (key === 'biq-photos') {
    const photos = Array.isArray(body.photos) ? body.photos : []
    await fs.writeFile(filePath, JSON.stringify({ photos }, null, 2), 'utf-8')
    return NextResponse.json({ ok: true, key })
  }

  await fs.writeFile(filePath, JSON.stringify({ mapping: body.mapping ?? null }, null, 2), 'utf-8')
  return NextResponse.json({ ok: true, key })
}
