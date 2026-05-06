import 'server-only'

import { promises as fs } from 'node:fs'

import { discoverLegalDrawingsProjects } from '@/lib/data-loader/legal-drawings-loader'
import { buildPartNumberMap } from '@/lib/part-number-list'
import { parseWorkbook } from '@/lib/workbook/parse-workbook'
import type { ParsedWorkbookSheet } from '@/lib/workbook/types'
import { parseBlueLabelSheet } from '@/lib/wiring-identification/blue-label-sequence'
import { extractKaRelayPluginJumpers } from '@/lib/wiring-identification/extract-ka-relay-plugin-jumpers'

export interface KaMechanicalRunRowReport {
  rowId: string
  fromDeviceId: string
  toDeviceId: string
  wireNo: string
  wireId: string
  fromLocation: string
  toLocation: string
  location: string
}

export interface KaMechanicalRunReport {
  id: string
  terminal: string
  signalType: string
  location: string
  startDeviceId: string
  endDeviceId: string
  deviceCount: number
  segmentCount: number
  orderedDevices: string[]
  rows: KaMechanicalRunRowReport[]
}

export interface KaMechanicalSheetReport {
  sheetName: string
  sheetSlug: string
  rowCount: number
  runCount: number
  segmentCount: number
  deviceCount: number
  runs: KaMechanicalRunReport[]
}

export interface KaMechanicalReport {
  generatedAt: string
  pdNumber: string
  projectFolder: string
  projectName: string
  wireList: {
    filename: string
    revision: string
    href: string
  }
  layoutPdf: {
    filename: string
    revision: string
    href: string
  } | null
  blueLabelsSheetName: string | null
  partListSheetName: string | null
  blueLabelWarnings: string[]
  workbookWarnings: string[]
  partNumberCount: number
  sheets: KaMechanicalSheetReport[]
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '')
}

function isBlueLabelsSheetName(name: string): boolean {
  const normalized = normalizeName(name)
  return normalized.includes('bluelabel')
}

function isPartListSheetName(name: string): boolean {
  const normalized = normalizeName(name)
  if (normalized.includes('cable')) {
    return false
  }

  return normalized.includes('partlist') || normalized.includes('partnumber') || normalized.includes('part_number')
}

function buildLegalDrawingsHref(projectFolder: string, fileName: string): string {
  return `/api/projects/projects/files?project=${encodeURIComponent(projectFolder)}&file=${encodeURIComponent(fileName)}`
}

function findBlueLabelsSheet(sheets: ParsedWorkbookSheet[]): ParsedWorkbookSheet | null {
  return sheets.find((sheet) => isBlueLabelsSheetName(sheet.originalName)) ?? null
}

function findPartListSheet(sheets: ParsedWorkbookSheet[]): ParsedWorkbookSheet | null {
  return sheets.find((sheet) => isPartListSheetName(sheet.originalName)) ?? null
}

function toReportRows(
  rows: KaMechanicalRunReport['rows'],
): KaMechanicalRunReport['rows'] {
  return rows
}

export async function loadKaMechanicalReport(pdNumber = '4M093'): Promise<KaMechanicalReport> {
  const projects = await discoverLegalDrawingsProjects()
  const project = projects.find((entry) => entry.pdNumber.toUpperCase() === pdNumber.toUpperCase())

  if (!project) {
    throw new Error(`Legal Drawings project ${pdNumber} was not found.`)
  }

  if (!project.wireList) {
    throw new Error(`Project ${project.folderName} does not have a wire list workbook.`)
  }

  const buffer = await fs.readFile(project.wireList.fullPath)
  const workbookFile = new File([buffer], project.wireList.filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const parsed = await parseWorkbook(workbookFile)

  if (!parsed.success || !parsed.workbook) {
    const errorMessage = parsed.errors.join('; ') || 'Workbook parsing failed.'
    throw new Error(errorMessage)
  }

  const workbook = parsed.workbook
  const blueLabelsSheet = findBlueLabelsSheet(workbook.sheets)
  const partListSheet = findPartListSheet(workbook.sheets)
  const blueLabels = parseBlueLabelSheet(blueLabelsSheet)
  const partNumberMap = buildPartNumberMap(partListSheet)

  const sheets = workbook.sheets
    .filter((sheet) => (sheet.semanticRows?.length ?? 0) > 0)
    .map<KaMechanicalSheetReport>((sheet) => {
      const rows = (sheet.semanticRows ?? []).map((row) => ({
        ...row,
        __rowId: `${sheet.slug}-${row.__rowId}`,
        location: row.toLocation || row.fromLocation || row.location || '',
      }))

      const result = extractKaRelayPluginJumpers({
        rows,
        blueLabels,
        currentSheetName: sheet.originalName,
        normalizedSheetName: sheet.originalName.toUpperCase().trim(),
        partNumberMap,
      })

      const runs = result.runs.map<KaMechanicalRunReport>((run) => ({
        id: run.id,
        terminal: run.terminal,
        signalType: run.signalType,
        location: run.location,
        startDeviceId: run.startDeviceId,
        endDeviceId: run.endDeviceId,
        deviceCount: run.deviceCount,
        segmentCount: run.segmentCount,
        orderedDevices: [...run.orderedDevices],
        rows: toReportRows(run.rows.map((row) => ({
          rowId: row.__rowId,
          fromDeviceId: row.fromDeviceId,
          toDeviceId: row.toDeviceId,
          wireNo: row.wireNo,
          wireId: row.wireId,
          fromLocation: row.fromLocation,
          toLocation: row.toLocation,
          location: row.location || row.toLocation || row.fromLocation || '',
        }))),
      }))

      return {
        sheetName: sheet.originalName,
        sheetSlug: sheet.slug,
        rowCount: rows.length,
        runCount: runs.length,
        segmentCount: runs.reduce((total, run) => total + run.segmentCount, 0),
        deviceCount: runs.reduce((total, run) => total + run.deviceCount, 0),
        runs,
      }
    })
    .sort((left, right) => {
      if (left.runCount !== right.runCount) {
        return right.runCount - left.runCount
      }

      return left.sheetName.localeCompare(right.sheetName, undefined, { numeric: true, sensitivity: 'base' })
    })

  return {
    generatedAt: new Date().toISOString(),
    pdNumber: project.pdNumber,
    projectFolder: project.folderName,
    projectName: project.projectName,
    wireList: {
      filename: project.wireList.filename,
      revision: project.wireList.revision,
      href: buildLegalDrawingsHref(project.folderName, project.wireList.filename),
    },
    layoutPdf: project.layoutPdf ? {
      filename: project.layoutPdf.filename,
      revision: project.layoutPdf.revision,
      href: buildLegalDrawingsHref(project.folderName, project.layoutPdf.filename),
    } : null,
    blueLabelsSheetName: blueLabelsSheet?.originalName ?? null,
    partListSheetName: partListSheet?.originalName ?? null,
    blueLabelWarnings: blueLabels.warnings,
    workbookWarnings: workbook.warnings,
    partNumberCount: partNumberMap.size,
    sheets,
  }
}