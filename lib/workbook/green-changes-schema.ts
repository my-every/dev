import type { ParsedWorkbook, ParsedWorkbookSheet, SemanticWireListRow } from "@/lib/workbook/types"

export type GreenChangeType = "added" | "deleted" | "changed" | "unknown"

export interface GreenChangeRow extends SemanticWireListRow {
  greenChangeType: GreenChangeType
  greenChangeStamp: string
  greenChangePreviousValues?: string
  greenChangeUpdated?: string
}

export interface GreenChangeSheetSchema {
  slug: string
  sheetName: string
  sourceFileName?: string
  generatedAt: string
  metadata?: ParsedWorkbookSheet["metadata"]
  summary: {
    totalRows: number
    added: number
    deleted: number
    changed: number
    unknown: number
  }
  rows: GreenChangeRow[]
}

function normalizeChangeTypeFromStamp(stamp: string): GreenChangeType {
  const value = stamp.trim().toLowerCase()
  if (!value) {
    return "unknown"
  }

  if (value === "added" || value === "add") {
    return "added"
  }

  if (value === "deleted" || value === "delete" || value === "removed") {
    return "deleted"
  }

  if (value === "chg" || value === "changed" || value === "modified" || value === "updated") {
    return "changed"
  }

  return "unknown"
}

function normalizeLookupKey(value: string): string {
  return value.toLowerCase().replace(/["'`]/g, "").replace(/\s+/g, " ").trim()
}

function pickRawValue(rawRow: Record<string, unknown>, predicate: (normalizedKey: string) => boolean): string {
  const entry = Object.entries(rawRow).find(([key]) => predicate(normalizeLookupKey(key)))
  return typeof entry?.[1] === "string"
    ? entry[1]
    : (entry?.[1] == null ? "" : String(entry[1]))
}

function buildGreenChangeRows(sheet: ParsedWorkbookSheet): GreenChangeRow[] {
  const semanticRows = Array.isArray(sheet.semanticRows) ? sheet.semanticRows : []
  if (semanticRows.length === 0) {
    return []
  }

  const rawRows = Array.isArray(sheet.rows) ? sheet.rows : []

  return semanticRows.map((row, index) => {
    const rawRow = (rawRows[index] ?? {}) as Record<string, unknown>
    const stamp = row.greenChangeStamp
      || pickRawValue(rawRow, (key) => key === "stamp")
    const previousValues = row.greenChangePreviousValues
      || pickRawValue(rawRow, (key) => key === "previous field values")
    const updated = row.greenChangeUpdated
      || pickRawValue(rawRow, (key) => key === "updated?")

    return {
      ...row,
      greenChangeStamp: stamp,
      greenChangeType: normalizeChangeTypeFromStamp(stamp),
      greenChangePreviousValues: previousValues || undefined,
      greenChangeUpdated: updated || undefined,
    }
  })
}

export function isGreenChangesWorkbookFileName(fileName: string): boolean {
  return /ucp/i.test(fileName) && /compare/i.test(fileName) && /\.(xlsx|xlsm|xls|xlsb|csv)$/i.test(fileName)
}

export function buildGreenChangeSchemasFromWorkbook(
  workbook: ParsedWorkbook,
  sourceFileName?: string,
): GreenChangeSheetSchema[] {
  const generatedAt = new Date().toISOString()

  return workbook.sheets
    .map((sheet) => {
      const rows = buildGreenChangeRows(sheet)
      if (rows.length === 0) {
        return null
      }

      const summary = rows.reduce(
        (acc, row) => {
          acc.totalRows += 1
          if (row.greenChangeType === "added") acc.added += 1
          else if (row.greenChangeType === "deleted") acc.deleted += 1
          else if (row.greenChangeType === "changed") acc.changed += 1
          else acc.unknown += 1
          return acc
        },
        { totalRows: 0, added: 0, deleted: 0, changed: 0, unknown: 0 },
      )

      return {
        slug: sheet.slug,
        sheetName: sheet.originalName,
        sourceFileName,
        generatedAt,
        metadata: sheet.metadata,
        summary,
        rows,
      } satisfies GreenChangeSheetSchema
    })
    .filter((schema): schema is GreenChangeSheetSchema => Boolean(schema))
}
