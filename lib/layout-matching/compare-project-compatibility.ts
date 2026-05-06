/**
 * Utilities for comparing workbook and PDF project compatibility.
 */

import type { ProjectMetadata, CompatibilityResult, CompatibilityStatus } from "./types";

/**
 * Compare project numbers for compatibility.
 * Returns true if they match or if one is missing.
 */
function compareProjectNumbers(
  workbook: string | undefined,
  pdf: string | undefined
): { match: boolean; comparable: boolean } {
  // If either is missing, we can't compare but shouldn't fail
  if (!workbook || !pdf) {
    return { match: false, comparable: false };
  }
  
  // Normalize and compare
  const normalizedWorkbook = workbook.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const normalizedPdf = pdf.toUpperCase().replace(/[^A-Z0-9]/g, "");
  
  return {
    match: normalizedWorkbook === normalizedPdf,
    comparable: true,
  };
}

/**
 * Compare revisions for compatibility.
 * Returns true if they match or if one is missing.
 */
function compareRevisions(
  workbook: string | undefined,
  pdf: string | undefined
): { match: boolean; comparable: boolean } {
  // If either is missing, we can't compare
  if (!workbook || !pdf) {
    return { match: false, comparable: false };
  }
  
  // Normalize revisions (remove leading zeros, handle letter revisions)
  const normalizeRev = (rev: string) => {
    const trimmed = rev.trim();
    // If it's a number, parse and compare
    const num = parseFloat(trimmed);
    if (!isNaN(num)) {
      return num.toString();
    }
    // Otherwise compare as uppercase string
    return trimmed.toUpperCase();
  };
  
  return {
    match: normalizeRev(workbook) === normalizeRev(pdf),
    comparable: true,
  };
}

/**
 * Compare workbook and PDF metadata for project compatibility.
 */
export function compareProjectCompatibility(
  workbookMeta: ProjectMetadata | null,
  pdfMeta: ProjectMetadata | null,
  sheetMatchCount: number = 0,
  totalSheets: number = 0
): CompatibilityResult {
  const warnings: string[] = [];
  
  // Handle missing PDF case
  if (!pdfMeta) {
    return {
      status: "missing_pdf",
      projectNumberMatch: false,
      revisionMatch: false,
      workbookMeta,
      pdfMeta: null,
      warnings: [],
      sheetMatchCount: 0,
      totalSheets,
    };
  }
  
  // Handle missing workbook metadata
  if (!workbookMeta) {
    return {
      status: "partial_match",
      projectNumberMatch: false,
      revisionMatch: false,
      workbookMeta: null,
      pdfMeta,
      warnings: ["Could not extract metadata from workbook"],
      sheetMatchCount,
      totalSheets,
    };
  }
  
  // Compare project numbers
  const projectComparison = compareProjectNumbers(
    workbookMeta.projectNumber,
    pdfMeta.projectNumber
  );
  
  // Compare revisions
  const revisionComparison = compareRevisions(
    workbookMeta.revision,
    pdfMeta.revision
  );
  
  // Build warnings
  if (projectComparison.comparable && !projectComparison.match) {
    warnings.push(
      `Layout PDF project number (${pdfMeta.projectNumber}) does not match workbook (${workbookMeta.projectNumber})`
    );
  }
  
  if (revisionComparison.comparable && !revisionComparison.match) {
    warnings.push(
      `Layout PDF revision (${pdfMeta.revision}) differs from workbook (${workbookMeta.revision})`
    );
  }
  
  if (!projectComparison.comparable) {
    warnings.push("Could not compare project numbers (missing from one or both files)");
  }
  
  // Determine overall status
  let status: CompatibilityStatus;
  
  if (projectComparison.match && revisionComparison.match) {
    status = "matched";
  } else if (projectComparison.match || revisionComparison.match) {
    status = "partial_match";
  } else if (!projectComparison.comparable && !revisionComparison.comparable) {
    // Can't compare either field - treat as partial match
    status = "partial_match";
  } else {
    status = "mismatch";
  }
  
  // Add warning for low sheet match rate
  if (totalSheets > 0 && sheetMatchCount / totalSheets < 0.5) {
    warnings.push(
      `Only ${sheetMatchCount} of ${totalSheets} sheets matched to layout pages`
    );
  }
  
  return {
    status,
    projectNumberMatch: projectComparison.match,
    revisionMatch: revisionComparison.match,
    workbookMeta,
    pdfMeta,
    warnings,
    sheetMatchCount,
    totalSheets,
  };
}

/**
 * Get a human-readable summary of compatibility status.
 */
export function getCompatibilityMessage(result: CompatibilityResult): string {
  switch (result.status) {
    case "matched":
      return `Project ${result.pdfMeta?.projectNumber || "unknown"} Rev ${result.pdfMeta?.revision || "?"} - Layout PDF matched`;
    case "partial_match":
      return "Layout PDF partially matched - some differences detected";
    case "mismatch":
      return "Layout PDF does not match workbook project";
    case "missing_pdf":
      return "No layout PDF attached";
    default:
      return "Unknown compatibility status";
  }
}

/**
 * Get badge variant for compatibility status.
 */
export function getCompatibilityBadgeVariant(
  status: CompatibilityStatus
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "matched":
      return "default";
    case "partial_match":
      return "secondary";
    case "mismatch":
      return "destructive";
    case "missing_pdf":
      return "outline";
    default:
      return "outline";
  }
}
