import "server-only"

import { promises as fs } from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

import {
  buildPositionedTextItems,
  extractBoxNumber,
  extractPanelNumber,
  extractPanducts,
  extractRailGroups,
  extractTitleByPosition,
  extractTitleByRegex,
  hasDoorLabels,
} from "@/lib/layout-matching/extract-drawing-metadata"
import { stripUnitTypeFromTitle } from "@/lib/layout-matching/layout-page-collections"
import type {
  LayoutPageIndexAnchor,
  LayoutPageIndexItem,
  LayoutPageIndexTextItem,
  LayoutPagesIndexDocument,
  SlimLayoutPage,
} from "@/lib/layout-matching/types"

interface ServerPdfJsLib {
  standardFontsDir: string
  GlobalWorkerOptions?: {
    workerSrc?: string
  }
  getDocument: (params: { data: Uint8Array; disableWorker?: boolean; standardFontDataUrl?: string }) => {
    promise: Promise<ServerPdfDocumentProxy>
  }
}

interface ServerPdfDocumentProxy {
  numPages: number
  getPage: (pageNumber: number) => Promise<ServerPdfPageProxy>
}

interface ServerPdfPageViewport {
  width: number
  height: number
}

interface ServerPdfPageProxy {
  getViewport: (params: { scale: number }) => ServerPdfPageViewport
  getTextContent: () => Promise<{ items: Array<Record<string, unknown>> }>
}

let serverPdfJsPromise: Promise<ServerPdfJsLib> | null = null

async function loadServerPdfJs(): Promise<ServerPdfJsLib> {
  if (!serverPdfJsPromise) {
    serverPdfJsPromise = import("pdfjs-dist/legacy/build/pdf.mjs").then((module) => {
      const workerFilePath = path.join(
        process.cwd(),
        "node_modules",
        "pdfjs-dist",
        "legacy",
        "build",
        "pdf.worker.mjs",
      )

      if (module.GlobalWorkerOptions) {
        module.GlobalWorkerOptions.workerSrc = pathToFileURL(workerFilePath).href
      }

      return {
        GlobalWorkerOptions: module.GlobalWorkerOptions,
        getDocument: module.getDocument,
        standardFontsDir: path.join(
          process.cwd(),
          "node_modules",
          "pdfjs-dist",
          "standard_fonts",
        ),
      }
    })
  }

  return serverPdfJsPromise
}

function normalizeLayoutTitle(title: string | undefined) {
  if (!title) return undefined
  const upper = title.toUpperCase().replace(/[^A-Z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
  return stripUnitTypeFromTitle(upper)
}

function inferUnitTypeFromTitle(title: string | undefined) {
  const jbMatch = title?.match(/\b(JB\d+)\b/i)
  return jbMatch ? jbMatch[1].toUpperCase() : undefined
}

function buildAnchors(page: LayoutPageIndexItem): LayoutPageIndexAnchor[] {
  const anchors: LayoutPageIndexAnchor[] = []

  if (page.title) {
    const titleItem = page.textItems.find((item) => item.text.trim().toUpperCase() === page.title?.trim().toUpperCase())
    anchors.push({
      kind: "title",
      text: page.title,
      x: titleItem?.x,
      y: titleItem?.y,
      width: titleItem?.width,
      height: titleItem?.height,
    })
  }

  if (page.panelNumber) {
    const panelItem = page.textItems.find((item) => item.text.toUpperCase().includes(page.panelNumber?.toUpperCase() ?? ""))
    anchors.push({
      kind: "panel",
      text: page.panelNumber,
      x: panelItem?.x,
      y: panelItem?.y,
      width: panelItem?.width,
      height: panelItem?.height,
    })
  }

  if (page.boxNumber) {
    const boxItem = page.textItems.find((item) => item.text.toUpperCase().includes(page.boxNumber?.toUpperCase() ?? ""))
    anchors.push({
      kind: "box",
      text: page.boxNumber,
      x: boxItem?.x,
      y: boxItem?.y,
      width: boxItem?.width,
      height: boxItem?.height,
    })
  }

  if (page.hasDoorLabels) {
    anchors.push({ kind: "door-label", text: "Door Labels" })
  }

  page.rails.forEach((rail) => {
    const railItem = page.textItems.find((item) => item.text.trim().toUpperCase() === rail.railLabel.trim().toUpperCase())
    anchors.push({
      kind: "search",
      text: rail.railLabel,
      x: railItem?.x,
      y: railItem?.y ?? rail.railY,
      width: railItem?.width,
      height: railItem?.height,
    })
  })

  page.panducts.forEach((panduct) => {
    const panductItem = page.textItems.find((item) => item.text.trim().toUpperCase() === panduct.label.trim().toUpperCase())
    anchors.push({
      kind: "search",
      text: panduct.label,
      x: panductItem?.x,
      y: panductItem?.y ?? panduct.y,
      width: panductItem?.width,
      height: panductItem?.height,
    })
  })

  return anchors
}

function toSlimTextItems(
  textItems: Array<{
    str: string
    x: number
    y: number
    width: number
    height: number
  }>,
): LayoutPageIndexTextItem[] {
  return textItems.map((item) => ({
    text: item.str,
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
  }))
}

function toSlimPage(page: LayoutPageIndexItem): SlimLayoutPage {
  return {
    pageNumber: page.pageNumber,
    title: page.title,
    normalizedTitle: page.normalizedTitle,
    unitType: page.unitType,
    width: page.width,
    height: page.height,
    boxNumber: page.boxNumber,
    panelNumber: page.panelNumber,
    hasDoorLabels: page.hasDoorLabels,
    rails: page.rails,
    railGroups: page.railGroups,
    devices: page.devices,
    panducts: page.panducts,
    imageUrl: page.imageUrl ?? "",
  }
}

function buildDebugSummary(pages: LayoutPageIndexItem[]) {
  return {
    pagesWithTitle: pages.filter((page) => Boolean(page.title)).length,
    pagesWithPanelNumber: pages.filter((page) => Boolean(page.panelNumber)).length,
    pagesWithBoxNumber: pages.filter((page) => Boolean(page.boxNumber)).length,
    pagesWithDoorLabels: pages.filter((page) => page.hasDoorLabels).length,
    pagesWithRails: pages.filter((page) => page.rails.length > 0).length,
    pagesWithPanducts: pages.filter((page) => page.panducts.length > 0).length,
    totalRails: pages.reduce((sum, page) => sum + page.rails.length, 0),
    totalPanducts: pages.reduce((sum, page) => sum + page.panducts.length, 0),
    totalDevices: pages.reduce((sum, page) => sum + (page.devices?.length ?? 0), 0),
    totalTextItems: pages.reduce((sum, page) => sum + page.textItems.length, 0),
  }
}

export async function extractLayoutPagesIndexOnServer(pdfPath: string): Promise<LayoutPagesIndexDocument> {
  const pdfBytes = await fs.readFile(pdfPath)
  const pdfjsLib = await loadServerPdfJs()
  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes),
    disableWorker: true,
    // In Node, pdfjs can fail to load standard fonts from file:// URLs; use an absolute fs path.
    standardFontDataUrl: `${pdfjsLib.standardFontsDir}/`,
  }).promise
  const pages: LayoutPageIndexItem[] = []

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
    const pageNumber = pageIndex + 1
    const page = await pdf.getPage(pageNumber)
    const viewport = page.getViewport({ scale: 1 })
    const textContent = await page.getTextContent()
    const { text, items } = buildPositionedTextItems(textContent.items as Array<Record<string, unknown>>)

    const title = extractTitleByPosition(items) || extractTitleByRegex(text)
    const railGroups = extractRailGroups(items)
    const devices = railGroups.flatMap((group) => group.devices)
    const panducts = extractPanducts(items)

    const layoutPage: LayoutPageIndexItem = {
      pageNumber,
      title,
      normalizedTitle: normalizeLayoutTitle(title),
      unitType: inferUnitTypeFromTitle(title),
      width: viewport.width,
      height: viewport.height,
      boxNumber: extractBoxNumber(text),
      panelNumber: extractPanelNumber(text),
      hasDoorLabels: hasDoorLabels(text),
      rails: railGroups.map((group) => ({
        railLabel: group.railLabel,
        railY: group.railY,
        spanXStart: group.spanXStart,
        spanXEnd: group.spanXEnd,
        corridorTop: group.corridorTop,
        corridorBottom: group.corridorBottom,
      })),
      railGroups,
      devices,
      panducts,
      textContent: text,
      textItems: toSlimTextItems(items),
      imageUrl: "",
    }

    layoutPage.anchors = buildAnchors(layoutPage)
    pages.push(layoutPage)
  }

  return {
    generatedAt: new Date().toISOString(),
    source: "pdfjs-dist",
    pageCount: pages.length,
    pages,
    debug: buildDebugSummary(pages),
  } as LayoutPagesIndexDocument & { debug: ReturnType<typeof buildDebugSummary> }
}

export function buildSlimLayoutPagesFromIndex(index: LayoutPagesIndexDocument): SlimLayoutPage[] {
  return index.pages.map(toSlimPage)
}
