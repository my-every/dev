#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'

const APP_ROOT = process.cwd()
const LEGAL_ROOT = process.env.LEGAL_DRAWINGS_ROOT || path.join(APP_ROOT, 'Share', 'Legal Drawings')
const PROJECTS_ROOT = process.env.PROJECTS_ROOT || path.join(APP_ROOT, 'Share', 'Projects')
const REFERENCES_ROOT = process.env.LEGAL_REFERENCES_ROOT || path.join(APP_ROOT, 'Share', 'References')
const DEFAULT_OUTPUT = path.join(REFERENCES_ROOT, 'layout-panel-dimensions-reference.json')

function normalizePanelNumber(value) {
  return String(value || '').trim().toUpperCase()
}

function compareRevisionNames(left, right) {
  return left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' })
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toInches(points) {
  // PDF coordinates are points (72 points = 1 inch)
  return Number((points / 72).toFixed(3))
}

function toRoundedInches(value) {
  return Number(Number(value).toFixed(3))
}

function formatDimensionKey(width, height) {
  return `${width}x${height}`
}

function parseArgs(argv) {
  const args = { mode: 'legal', output: DEFAULT_OUTPUT }
  for (const token of argv) {
    if (!token.startsWith('--')) continue
    const [key, rawValue] = token.replace(/^--/, '').split('=')
    const value = String(rawValue || '').trim()
    if (key === 'mode' && (value === 'legal' || value === 'projects')) {
      args.mode = value
    } else if (key === 'output' && value) {
      args.output = path.isAbsolute(value) ? value : path.join(APP_ROOT, value)
    }
  }
  return args
}

async function readJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

async function getLayoutPagesFromRevision(revisionRoot) {
  const indexDoc = await readJson(path.join(revisionRoot, 'layout-pages.index.json'))
  if (Array.isArray(indexDoc?.pages)) return indexDoc.pages

  const slimDoc = await readJson(path.join(revisionRoot, 'layout-pages.json'))
  if (Array.isArray(slimDoc?.pages)) return slimDoc.pages

  return []
}

async function getLayoutPagesFromProject(projectRoot) {
  const stateRoot = path.join(projectRoot, 'state')
  const indexDoc = await readJson(path.join(stateRoot, 'layout-pages.index.json'))
  if (Array.isArray(indexDoc?.pages)) return indexDoc.pages

  const slimDoc = await readJson(path.join(stateRoot, 'layout-pages.json'))
  if (Array.isArray(slimDoc?.pages)) return slimDoc.pages

  return []
}

function createAccumulator() {
  // panelNumber -> {
  //   panelNumber,
  //   occurrences,
  //   pageDimensions: Map<"widthxheight", {...}>,
  //   inferredPanelDimensions: Map<"widthxheight", {...}>,
  //   examples: Array<...>
  // }
  return new Map()
}

function parseDimensionToken(raw) {
  const value = String(raw || '').trim().replace(/["\u201D\u2033']/g, '')
  if (!value) return null
  if (!/^\d{1,3}(?:\.\d{1,3})?$/.test(value)) return null
  const num = Number(value)
  if (!Number.isFinite(num)) return null
  return num
}

function extractDimensionCalloutsFromPage(page) {
  const textItems = Array.isArray(page?.textItems) ? page.textItems : []
  const dimensions = []

  for (const item of textItems) {
    const text = String(item?.text || '').trim()
    if (!text) continue

    const parsed = parseDimensionToken(text)
    if (parsed == null) continue

    // Filter out tiny / near-zero drawing offsets and gigantic non-panel values.
    if (parsed < 3 || parsed > 200) continue

    const width = toNumber(item?.width) ?? 0
    const height = toNumber(item?.height) ?? 0
    dimensions.push({
      value: parsed,
      x: toNumber(item?.x) ?? 0,
      y: toNumber(item?.y) ?? 0,
      width,
      height,
      isLikelyVertical: height > width,
    })
  }

  return dimensions
}

function inferPanelDimensionFromPage(page) {
  const dims = extractDimensionCalloutsFromPage(page)
  if (dims.length === 0) return null

  const horizontal = dims.filter((d) => !d.isLikelyVertical).map((d) => d.value)
  const vertical = dims.filter((d) => d.isLikelyVertical).map((d) => d.value)

  const sortedAll = [...new Set(dims.map((d) => d.value))].sort((a, b) => b - a)
  const sortedHorizontal = [...new Set(horizontal)].sort((a, b) => b - a)
  const sortedVertical = [...new Set(vertical)].sort((a, b) => b - a)

  // Prefer orientation-aware picks. If unavailable, fall back to the top two
  // unique dimensions on the page as a best-effort panel envelope estimate.
  const inferredWidth = sortedHorizontal[0] ?? sortedAll[0]
  let inferredHeight = sortedVertical[0] ?? sortedAll[1]

  if (!inferredWidth || !inferredHeight) return null

  // Keep width >= height for stable aggregation keys.
  let widthInches = inferredWidth
  let heightInches = inferredHeight
  if (heightInches > widthInches) {
    const temp = widthInches
    widthInches = heightInches
    heightInches = temp
  }

  return {
    widthInches: toRoundedInches(widthInches),
    heightInches: toRoundedInches(heightInches),
    calloutCount: dims.length,
  }
}

function addPanelObservation(acc, input) {
  const panelNumber = normalizePanelNumber(input.panelNumber)
  if (!panelNumber) return

  const pageWidth = toNumber(input.pageWidth)
  const pageHeight = toNumber(input.pageHeight)
  const inferredPanel = input.inferredPanelDimension || null

  // Keep rows even if inferred panel size is missing, as long as page size exists.
  if (pageWidth == null || pageHeight == null) return

  if (!acc.has(panelNumber)) {
    acc.set(panelNumber, {
      panelNumber,
      occurrences: 0,
      pageDimensions: new Map(),
      inferredPanelDimensions: new Map(),
      examples: [],
    })
  }

  const row = acc.get(panelNumber)
  row.occurrences += 1

  const pageDimKey = formatDimensionKey(pageWidth, pageHeight)
  if (!row.pageDimensions.has(pageDimKey)) {
    row.pageDimensions.set(pageDimKey, {
      widthPoints: pageWidth,
      heightPoints: pageHeight,
      widthInches: toInches(pageWidth),
      heightInches: toInches(pageHeight),
      occurrences: 0,
    })
  }
  row.pageDimensions.get(pageDimKey).occurrences += 1

  if (inferredPanel?.widthInches != null && inferredPanel?.heightInches != null) {
    const inferredKey = formatDimensionKey(inferredPanel.widthInches, inferredPanel.heightInches)
    if (!row.inferredPanelDimensions.has(inferredKey)) {
      row.inferredPanelDimensions.set(inferredKey, {
        widthInches: inferredPanel.widthInches,
        heightInches: inferredPanel.heightInches,
        occurrences: 0,
      })
    }
    row.inferredPanelDimensions.get(inferredKey).occurrences += 1
  }

  if (row.examples.length < 8) {
    row.examples.push({
      source: input.source,
      sourceId: input.sourceId,
      revision: input.revision || null,
      pageNumber: input.pageNumber ?? null,
      unitType: input.unitType || null,
      boxNumber: input.boxNumber || null,
      title: input.title || null,
      pageWidthPoints: pageWidth,
      pageHeightPoints: pageHeight,
      pageWidthInches: toInches(pageWidth),
      pageHeightInches: toInches(pageHeight),
      inferredPanelWidthInches: inferredPanel?.widthInches ?? null,
      inferredPanelHeightInches: inferredPanel?.heightInches ?? null,
      inferredDimensionCalloutCount: inferredPanel?.calloutCount ?? 0,
    })
  }
}

async function extractFromLegal(acc) {
  const pdEntries = await fs.readdir(LEGAL_ROOT, { withFileTypes: true }).catch(() => [])
  const pdFolders = pdEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

  let revisionCount = 0
  let pageCount = 0

  for (const pdNumber of pdFolders) {
    const pdRoot = path.join(LEGAL_ROOT, pdNumber)
    const revEntries = await fs.readdir(pdRoot, { withFileTypes: true }).catch(() => [])
    const revisions = revEntries
      .filter((entry) => entry.isDirectory() && entry.name.toLowerCase() !== 'electrical')
      .map((entry) => entry.name)
      .sort(compareRevisionNames)

    for (const revision of revisions) {
      revisionCount += 1
      const revisionRoot = path.join(pdRoot, revision)
      const pages = await getLayoutPagesFromRevision(revisionRoot)
      if (!Array.isArray(pages) || pages.length === 0) continue

      for (const page of pages) {
        pageCount += 1
        addPanelObservation(acc, {
          panelNumber: page?.panelNumber,
          pageWidth: page?.width,
          pageHeight: page?.height,
          inferredPanelDimension: inferPanelDimensionFromPage(page),
          source: 'legal',
          sourceId: pdNumber,
          revision,
          pageNumber: page?.pageNumber,
          unitType: page?.unitType,
          boxNumber: page?.boxNumber,
          title: page?.title,
        })
      }
    }
  }

  return {
    sourceRoot: LEGAL_ROOT,
    projectCount: pdFolders.length,
    revisionCount,
    pageCount,
  }
}

async function extractFromProjects(acc) {
  const projectEntries = await fs.readdir(PROJECTS_ROOT, { withFileTypes: true }).catch(() => [])
  const projectFolders = projectEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name)

  let pageCount = 0

  for (const folderName of projectFolders) {
    const projectRoot = path.join(PROJECTS_ROOT, folderName)
    const pages = await getLayoutPagesFromProject(projectRoot)
    if (!Array.isArray(pages) || pages.length === 0) continue

    for (const page of pages) {
      pageCount += 1
      addPanelObservation(acc, {
        panelNumber: page?.panelNumber,
        pageWidth: page?.width,
        pageHeight: page?.height,
        inferredPanelDimension: inferPanelDimensionFromPage(page),
        source: 'project',
        sourceId: folderName,
        revision: null,
        pageNumber: page?.pageNumber,
        unitType: page?.unitType,
        boxNumber: page?.boxNumber,
        title: page?.title,
      })
    }
  }

  return {
    sourceRoot: PROJECTS_ROOT,
    projectCount: projectFolders.length,
    revisionCount: null,
    pageCount,
  }
}

function buildOutput(stats, acc, mode) {
  const inferredDimensionScore = (dimension) => {
    const width = Number(dimension?.widthInches || 0)
    const height = Number(dimension?.heightInches || 0)
    const occurrences = Number(dimension?.occurrences || 0)
    if (width <= 0 || height <= 0 || occurrences <= 0) return 0
    return width * height * occurrences
  }

  const panels = [...acc.values()]
    .map((row) => {
      const observedPageDimensions = [...row.pageDimensions.values()]
        .sort((a, b) => (b.occurrences - a.occurrences) || (a.widthPoints - b.widthPoints) || (a.heightPoints - b.heightPoints))

      const observedInferredPanelDimensions = [...row.inferredPanelDimensions.values()]
        .sort((a, b) => {
          const scoreDiff = inferredDimensionScore(b) - inferredDimensionScore(a)
          if (scoreDiff !== 0) return scoreDiff
          return (b.occurrences - a.occurrences) || (b.widthInches - a.widthInches) || (b.heightInches - a.heightInches)
        })

      // Existing top-level fields remain compatible, but now represent inferred
      // actual panel envelope dimensions from drawing callouts where available.
      const primaryInferredPanelDimension = observedInferredPanelDimensions[0] || null

      return {
        panelNumber: row.panelNumber,
        occurrences: row.occurrences,
        primaryDimension: primaryInferredPanelDimension,
        observedDimensions: observedInferredPanelDimensions,
        primaryPageDimension: observedPageDimensions[0] || null,
        observedPageDimensions,
        examples: row.examples,
      }
    })
    .sort((a, b) => (b.occurrences - a.occurrences) || a.panelNumber.localeCompare(b.panelNumber, undefined, { numeric: true, sensitivity: 'base' }))

  return {
    generatedAt: new Date().toISOString(),
    mode,
    sourceRoot: stats.sourceRoot,
    totals: {
      projectCount: stats.projectCount,
      revisionCount: stats.revisionCount,
      scannedPages: stats.pageCount,
      uniquePanelNumbers: panels.length,
    },
    panels,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const acc = createAccumulator()

  const stats = args.mode === 'projects'
    ? await extractFromProjects(acc)
    : await extractFromLegal(acc)

  const output = buildOutput(stats, acc, args.mode)

  await fs.mkdir(path.dirname(args.output), { recursive: true })
  await fs.writeFile(args.output, JSON.stringify(output, null, 2), 'utf8')

  console.log(JSON.stringify({
    ok: true,
    mode: args.mode,
    sourceRoot: stats.sourceRoot,
    outputFile: args.output,
    projectCount: stats.projectCount,
    revisionCount: stats.revisionCount,
    scannedPages: stats.pageCount,
    uniquePanelNumbers: output.totals.uniquePanelNumbers,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
