/**
 * Workbook parsing utilities using xlsx library.
 * 
 * This module handles the conversion of Excel workbook files into
 * our internal data structures for processing and display.
 */

import * as XLSX from "xlsx";
import type {
  ParsedWorkbook,
  ParsedWorkbookSheet,
  ParsedSheetRow,
  ParseWarning,
  WorkbookParseResult,
} from "./types";
import { normalizeSheetName } from "./normalize-sheet-name";
import { parseSemanticWireList } from "./semantic-wire-list-parser";

/**
 * Parse an Excel workbook file into our internal format.
 * 
 * @param file - The File object to parse
 * @returns A promise resolving to the parse result
 */
export async function parseWorkbook(file: File): Promise<WorkbookParseResult> {
  const warnings: ParseWarning[] = [];
  const errors: string[] = [];

  try {
    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Parse with xlsx
    const workbook = XLSX.read(arrayBuffer, {
      type: "array",
      cellDates: true,
      cellText: false,
      cellNF: false,
    });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      errors.push("Workbook contains no sheets");
      return { success: false, workbook: null, errors, warnings };
    }

    // Parse each sheet
    const sheets: ParsedWorkbookSheet[] = [];
    
    for (let index = 0; index < workbook.SheetNames.length; index++) {
      const sheetName = workbook.SheetNames[index];
      const worksheet = workbook.Sheets[sheetName];
      
      try {
        const parsedSheet = parseSheet(worksheet, sheetName, index);
        sheets.push(parsedSheet);
        
        // Collect meaningful sheet-level warnings
        parsedSheet.warnings.forEach(msg => {
          warnings.push({
            sheetName,
            message: msg,
            severity: "info",
          });
        });
      } catch (sheetError) {
        // Don't fail entire parse for one sheet error
        const errorMessage = sheetError instanceof Error 
          ? sheetError.message 
          : "Unknown error parsing sheet";
        
        warnings.push({
          sheetName,
          message: `Failed to parse sheet: ${errorMessage}`,
          severity: "error",
        });
        
        // Add empty sheet placeholder so we don't lose track of sheet order
        sheets.push({
          originalName: sheetName,
          slug: normalizeSheetName(sheetName),
          headers: [],
          rows: [],
          rowCount: 0,
          columnCount: 0,
          sheetIndex: index,
          warnings: [`Parse failed: ${errorMessage}`],
        });
      }
    }

    const parsedWorkbook: ParsedWorkbook = {
      filename: file.name,
      sheets,
      warnings: warnings.map(w => w.message),
      parsedAt: new Date(),
    };

    return {
      success: true,
      workbook: parsedWorkbook,
      errors: [],
      warnings,
    };
  } catch (error) {
    const errorMessage = error instanceof Error 
      ? error.message 
      : "Unknown error parsing workbook";
    errors.push(errorMessage);
    return { success: false, workbook: null, errors, warnings };
  }
}

/**
 * Parse a single worksheet into our internal format.
 * Uses semantic wire list parsing for reliable column mapping.
 * 
 * @param worksheet - The xlsx worksheet object
 * @param name - The sheet name
 * @param index - The sheet index
 * @returns The parsed sheet
 */
function parseSheet(
  worksheet: XLSX.WorkSheet,
  name: string,
  index: number
): ParsedWorkbookSheet {
  const warnings: string[] = [];
  
  // Get the range to understand actual dimensions
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");
  const actualCols = range.e.c - range.s.c + 1;
  
  // Convert to array of arrays first
  const rawData: (string | number | boolean | Date | null)[][] = XLSX.utils.sheet_to_json(
    worksheet,
    { 
      header: 1,
      defval: null,
      blankrows: false,
    }
  );

  if (rawData.length === 0) {
    return {
      originalName: name,
      slug: normalizeSheetName(name),
      headers: [],
      rows: [],
      rowCount: 0,
      columnCount: 0,
      sheetIndex: index,
      warnings: ["Sheet is empty"],
    };
  }

  // Ensure all rows have consistent column count (pad with null if needed)
  const maxCols = Math.max(...rawData.map(row => row?.length ?? 0), actualCols);
  const normalizedRawData = rawData.map(row => {
    const normalizedRow = [...(row || [])];
    while (normalizedRow.length < maxCols) {
      normalizedRow.push(null);
    }
    return normalizedRow;
  });

  // Use semantic wire list parsing
  const semanticResult = parseSemanticWireList(normalizedRawData);
  const { 
    semanticRows, 
    rawRows, 
    introRows, 
    footerRows, 
    metadata, 
    diagnostics 
  } = semanticResult;

  // Add detection info as warnings for transparency
  if (diagnostics.confidence === "low") {
    warnings.push(`Low confidence header detection at row ${diagnostics.headerRowIndex + 1}`);
  }
  if (diagnostics.groupingRowIndex !== null) {
    warnings.push(`Found From/To grouping row at ${diagnostics.groupingRowIndex + 1}`);
  }
  if (Object.keys(metadata).length > 0) {
    warnings.push(`Detected ${Object.keys(metadata).length} metadata fields`);
  }
  if (footerRows.length > 0) {
    warnings.push(`Trimmed ${footerRows.length} footer rows`);
  }

  // Build headers from normalized headers
  const headers = diagnostics.normalizedHeaders.filter(h => h.length > 0);
  if (headers.length === 0) {
    // Fallback to column indices
    for (let i = 0; i < maxCols; i++) {
      headers.push(`Column_${i + 1}`);
    }
  }

  // Deduplicate headers if necessary
  const headerCounts: Record<string, number> = {};
  const uniqueHeaders = headers.map(header => {
    if (headerCounts[header] !== undefined) {
      headerCounts[header]++;
      return `${header}_${headerCounts[header]}`;
    }
    headerCounts[header] = 0;
    return header;
  });

  // Convert raw rows to ParsedSheetRow format
  const rows: ParsedSheetRow[] = rawRows.map((rawRow, idx) => {
    const row: ParsedSheetRow = { __rowId: `row-${idx}` };
    for (const [key, value] of Object.entries(rawRow)) {
      row[key] = value;
    }
    return row;
  });

  // Convert intro rows to ParsedSheetRow format
  const parsedIntroRows: ParsedSheetRow[] = introRows.map((row, rowIdx) => {
    const introRow: ParsedSheetRow = { __introRowId: String(rowIdx) };
    row.forEach((cell, colIdx) => {
      introRow[`col_${colIdx}`] = cell;
    });
    return introRow;
  });

  // Convert footer rows to ParsedSheetRow format
  const parsedFooterRows: ParsedSheetRow[] = footerRows.map((row, rowIdx) => {
    const footerRow: ParsedSheetRow = { __footerRowId: String(rowIdx) };
    row.forEach((cell, colIdx) => {
      footerRow[`col_${colIdx}`] = cell;
    });
    return footerRow;
  });

  // Real column count (excluding placeholder columns)
  const realColumnCount = uniqueHeaders.filter(h => !h.startsWith("Column_")).length;

  return {
    originalName: name,
    slug: normalizeSheetName(name),
    headers: uniqueHeaders,
    rows,
    semanticRows,
    rowCount: rows.length,
    columnCount: realColumnCount || uniqueHeaders.length,
    sheetIndex: index,
    warnings,
    introRows: parsedIntroRows.length > 0 ? parsedIntroRows : undefined,
    footerRows: parsedFooterRows.length > 0 ? parsedFooterRows : undefined,
    metadata: Object.keys(metadata).length > 0 ? {
      projectNumber: metadata.projectNumber,
      projectName: metadata.projectName,
      revision: metadata.revision,
      controlsDE: metadata.controlsDE,
      controlsME: metadata.controlsME,
      beforeWorkbook: metadata.beforeWorkbook,
      afterWorkbook: metadata.afterWorkbook,
    } : undefined,
    headerDetection: {
      method: diagnostics.confidence === "low" ? "fallback" : "heuristic",
      confidence: diagnostics.confidence,
      message: `Header at row ${diagnostics.headerRowIndex + 1}`,
      headerRowIndex: diagnostics.headerRowIndex,
    },
    parserDiagnostics: diagnostics,
  };
}

/**
 * Validate that a file is an acceptable workbook type.
 * 
 * @param file - The file to validate
 * @returns An object with isValid boolean and optional error message
 */
export function validateWorkbookFile(file: File): { isValid: boolean; error?: string } {
  const maxSize = 50 * 1024 * 1024; // 50MB
  
  if (file.size > maxSize) {
    return { 
      isValid: false, 
      error: `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed (50MB)` 
    };
  }

  const validExtensions = [".xlsx", ".xls", ".xlsm", ".xlsb"];
  const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  
  if (!validExtensions.includes(fileExtension)) {
    return { 
      isValid: false, 
      error: `Invalid file type. Accepted types: ${validExtensions.join(", ")}` 
    };
  }

  return { isValid: true };
}
