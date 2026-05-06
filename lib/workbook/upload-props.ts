import type { ParsedWorkbook, ParsedWorkbookSheet, ProjectModel, ProjectSheetKind } from '@/lib/workbook/types'

export interface UploadPropColumnMapping {
  propKey: string
  sourceColumnIndex: number
  sourceHeader: string
  sampleValue?: string
}

export interface UploadSheetPropMapping {
  sheetSlug: string
  sheetName: string
  kind: ProjectSheetKind | 'unknown'
  rowCount: number
  columnCount: number
  mappedProps: UploadPropColumnMapping[]
}

export interface UploadPropsManifest {
  generatedAt: string
  workbookFileName: string
  sheets: UploadSheetPropMapping[]
}

function toDisplayString(value: unknown): string | undefined {
  if (value == null) return undefined
  const normalized = String(value).trim()
  return normalized.length > 0 ? normalized : undefined
}

function resolveKind(sheetSlug: string, model?: ProjectModel): ProjectSheetKind | 'unknown' {
  const summary = model?.sheets.find(sheet => sheet.slug === sheetSlug)
  return summary?.kind ?? 'unknown'
}

function buildSheetMapping(sheet: ParsedWorkbookSheet, model?: ProjectModel): UploadSheetPropMapping {
  const diagnosticsMap = sheet.parserDiagnostics?.columnMap ?? {}
  const mappedProps: UploadPropColumnMapping[] = Object.entries(diagnosticsMap)
    .map(([columnIndexRaw, propKey]) => {
      const sourceColumnIndex = Number.parseInt(columnIndexRaw, 10)
      if (!Number.isFinite(sourceColumnIndex)) {
        return null
      }

      const sourceHeader =
        sheet.parserDiagnostics?.rawHeaders?.[sourceColumnIndex] ??
        sheet.headers?.[sourceColumnIndex] ??
        `Column_${sourceColumnIndex + 1}`

      const sampleValue = toDisplayString(sheet.rows?.[0]?.[sourceHeader])

      return {
        propKey,
        sourceColumnIndex,
        sourceHeader,
        sampleValue,
      } satisfies UploadPropColumnMapping
    })
    .filter((entry): entry is UploadPropColumnMapping => Boolean(entry))
    .sort((a, b) => a.sourceColumnIndex - b.sourceColumnIndex)

  return {
    sheetSlug: sheet.slug,
    sheetName: sheet.originalName,
    kind: resolveKind(sheet.slug, model),
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    mappedProps,
  }
}

export function buildUploadPropsManifest(parsedWorkbook: ParsedWorkbook, model?: ProjectModel): UploadPropsManifest {
  return {
    generatedAt: new Date().toISOString(),
    workbookFileName: parsedWorkbook.filename,
    sheets: parsedWorkbook.sheets.map(sheet => buildSheetMapping(sheet, model)),
  }
}
