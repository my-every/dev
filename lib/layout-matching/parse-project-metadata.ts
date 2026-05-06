/**
 * Utilities for parsing project metadata from filenames and content.
 */

import type { ProjectMetadata } from "./types";

// ============================================================================
// Filename Parsing
// ============================================================================

/**
 * Pattern to extract project number from filename.
 * Examples: "4L341_LAY_0.5.pdf", "4L341-UCPWiringList_0.5.xlsx"
 */
const PROJECT_NUMBER_PATTERN = /^([A-Z0-9]{3,10})[-_]/i;

/**
 * Pattern to extract revision from filename.
 * Examples: "_0.5.pdf", "_0.5.xlsx", "_Rev0.5", "-R0.5", "_B.1.xlsx"
 */
const REVISION_PATTERN = /[_-](?:Rev)?([A-Z]?\d+(?:\.\d+)?)\.\w+$/i;

/**
 * Alternative revision pattern for alphanumeric revisions like "_B.1.xlsx", "_A.5.pdf"
 */
const REVISION_ALPHA_DOT_PATTERN = /[_-]([A-Z]\.\d+)\.\w+$/i;

/**
 * Fallback revision pattern for formats like "Rev A", "R1"
 */
const REVISION_ALT_PATTERN = /[_-](?:Rev\s*)?([A-Z]|\d+)\.\w+$/i;

/**
 * Parse project number from a filename.
 */
export function parseProjectNumberFromFilename(filename: string): string | undefined {
  const match = filename.match(PROJECT_NUMBER_PATTERN);
  return match ? match[1].toUpperCase() : undefined;
}

/**
 * Parse revision from a filename.
 */
export function parseRevisionFromFilename(filename: string): string | undefined {
  // Try alphanumeric dot revision first (e.g., "B.1", "A.5")
  let match = filename.match(REVISION_ALPHA_DOT_PATTERN);
  if (match) {
    return match[1];
  }

  // Try numeric revision (e.g., "0.5", "A3")
  match = filename.match(REVISION_PATTERN);
  if (match) {
    return match[1];
  }
  
  // Try single letter/number fallback (e.g., "Rev A")
  match = filename.match(REVISION_ALT_PATTERN);
  if (match) {
    return match[1];
  }
  
  return undefined;
}

/**
 * Parse project metadata from a filename.
 */
export function parseMetadataFromFilename(filename: string): ProjectMetadata {
  return {
    projectNumber: parseProjectNumberFromFilename(filename),
    revision: parseRevisionFromFilename(filename),
    source: "filename",
  };
}

// ============================================================================
// Content Parsing
// ============================================================================

/**
 * Pattern to find project number in PDF text content.
 * Examples: "PROJECT: 4L341", "PROJ NO: 4L341", "4L341_LAY"
 */
const CONTENT_PROJECT_PATTERN = /(?:PROJECT|PROJ(?:\s*NO)?)[:\s]*([A-Z0-9]{3,10})/i;

/**
 * Alternative pattern: project number appears standalone
 */
const CONTENT_PROJECT_ALT_PATTERN = /\b([A-Z]\d[A-Z]\d{2,3})\b/;

/**
 * Pattern to find revision in PDF text content.
 * Examples: "REV: 0.5", "REVISION 0.5", "R0.5"
 */
const CONTENT_REVISION_PATTERN = /(?:REV(?:ISION)?)[:\s]*(\d+(?:\.\d+)?)/i;

/**
 * Parse project metadata from PDF text content.
 */
export function parseProjectMetadataFromPdf(pdfText: string): ProjectMetadata {
  let projectNumber: string | undefined;
  let revision: string | undefined;

  // Try explicit project pattern first
  let match = pdfText.match(CONTENT_PROJECT_PATTERN);
  if (match) {
    projectNumber = match[1].toUpperCase();
  } else {
    // Try alternative pattern
    match = pdfText.match(CONTENT_PROJECT_ALT_PATTERN);
    if (match) {
      projectNumber = match[1].toUpperCase();
    }
  }

  // Extract revision
  match = pdfText.match(CONTENT_REVISION_PATTERN);
  if (match) {
    revision = match[1];
  }

  return {
    projectNumber,
    revision,
    source: "content",
  };
}

/**
 * Parse project metadata from workbook metadata object.
 */
export function parseProjectMetadataFromWorkbook(
  workbookMeta: { projectNumber?: string; revision?: string } | undefined,
  filename: string
): ProjectMetadata {
  const fromFilename = parseMetadataFromFilename(filename);
  
  // Prefer metadata from workbook content, fall back to filename
  const projectNumber = workbookMeta?.projectNumber || fromFilename.projectNumber;
  const revision = workbookMeta?.revision || fromFilename.revision;
  
  return {
    projectNumber,
    revision,
    source: workbookMeta?.projectNumber ? "content" : "filename",
  };
}

// ============================================================================
// Merged Metadata
// ============================================================================

/**
 * Merge metadata from filename and content, preferring content when available.
 */
export function mergeMetadata(
  fromFilename: ProjectMetadata,
  fromContent: ProjectMetadata
): ProjectMetadata {
  return {
    projectNumber: fromContent.projectNumber || fromFilename.projectNumber,
    revision: fromContent.revision || fromFilename.revision,
    source: fromContent.projectNumber || fromContent.revision ? "both" : "filename",
  };
}
