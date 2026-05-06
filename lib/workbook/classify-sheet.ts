/**
 * Sheet classification utilities.
 * 
 * This module provides functions to classify sheets within a workbook
 * as either operational (working sheets) or reference (supporting data).
 * 
 * The classification logic is intentionally separated to allow for
 * future enhancements such as:
 * - Machine learning-based classification
 * - User-defined classification rules
 * - Content-based analysis
 */

import { REFERENCE_SHEET_PATTERNS } from "./constants";
import type { ProjectSheetKind, ParsedWorkbookSheet } from "./types";

/**
 * Classify a sheet based on its name and optional content analysis.
 * 
 * Current classification logic:
 * - Sheets with names matching reference patterns -> "reference"
 * - All other sheets -> "operational"
 * 
 * @param sheet - The parsed sheet to classify
 * @returns The sheet classification
 * 
 * TODO: Future enhancements:
 * - Analyze header patterns for classification
 * - Check for specific column patterns (e.g., Part Number, Description)
 * - Allow user overrides via configuration
 */
export function classifySheet(sheet: ParsedWorkbookSheet): ProjectSheetKind {
  const nameLower = sheet.originalName.toLowerCase();
  
  // Check against reference patterns
  for (const pattern of REFERENCE_SHEET_PATTERNS) {
    if (nameLower.includes(pattern)) {
      return "reference";
    }
  }
  
  // Check if sheet has any data - if empty, mark as unknown
  if (sheet.rowCount === 0) {
    return "unknown";
  }
  
  // Default to operational for sheets with data
  return "operational";
}

/**
 * Check if a sheet name matches reference patterns.
 * 
 * @param sheetName - The name to check
 * @returns true if the name matches a reference pattern
 */
export function isReferenceSheetName(sheetName: string): boolean {
  const nameLower = sheetName.toLowerCase();
  return REFERENCE_SHEET_PATTERNS.some(pattern => nameLower.includes(pattern));
}

/**
 * Get a human-readable label for a sheet kind.
 * 
 * @param kind - The sheet kind
 * @returns A display label
 */
export function getSheetKindLabel(kind: ProjectSheetKind): string {
  switch (kind) {
    case "operational":
      return "Assignment";
    case "reference":
      return "Reference";
    case "unknown":
      return "Unknown";
  }
}

/**
 * Get the badge variant for a sheet kind (for UI styling).
 * 
 * @param kind - The sheet kind
 * @returns A variant name for badge styling
 */
export function getSheetKindVariant(kind: ProjectSheetKind): "default" | "secondary" | "outline" {
  switch (kind) {
    case "operational":
      return "default";
    case "reference":
      return "secondary";
    case "unknown":
      return "outline";
  }
}
