/**
 * Project model building utilities.
 *
 * This module transforms parsed workbook data into the application's
 * project model structure. This separation allows the parsing layer
 * to remain generic while the project model can include business logic.
 */

import type {
  ParsedWorkbook,
  ProjectModel,
  ProjectSheetSummary,
} from "./types";
import { classifySheet } from "./classify-sheet";
import {
  generateProjectId,
  extractProjectName,
  generateSheetId,
  cleanSheetDisplayName,
  normalizeSheetName,
} from "./normalize-sheet-name";

/**
 * Build a project model from a parsed workbook.
 * 
 * This function transforms the raw parsed data into a structured
 * project model suitable for use throughout the application.
 * 
 * @param workbook - The parsed workbook data
 * @returns A complete project model
 */
export function buildProjectModel(workbook: ParsedWorkbook): ProjectModel {
  const projectId = generateProjectId(workbook.filename);
  const projectName = extractProjectName(workbook.filename);
  
  // Build sheet summaries
  const sheets: ProjectSheetSummary[] = workbook.sheets.map(sheet => {
    const id = generateSheetId(sheet.originalName, sheet.sheetIndex);
    const kind = classifySheet(sheet);
    
    return {
      id,
      name: cleanSheetDisplayName(sheet.originalName),
      slug: sheet.slug,
      kind,
      rowCount: sheet.rowCount,
      columnCount: sheet.columnCount,
      headers: sheet.headers,
      sheetIndex: sheet.sheetIndex,
      hasData: sheet.rowCount > 0,
      warnings: sheet.warnings,
    };
  });

  // Build sheet data lookup
  const sheetData: Record<string, typeof workbook.sheets[0]> = {};
  workbook.sheets.forEach(sheet => {
    const id = generateSheetId(sheet.originalName, sheet.sheetIndex);
    sheetData[id] = sheet;
  });

  return {
    id: projectId,
    filename: workbook.filename,
    name: projectName,
    sheets,
    sheetData,
    createdAt: new Date(),
    warnings: workbook.warnings,
  };
}

/**
 * Get operational sheets from a project model.
 * 
 * @param project - The project model
 * @returns Array of operational sheet summaries
 */
export function getOperationalSheets(project: ProjectModel): ProjectSheetSummary[] {
  return project.sheets.filter(sheet => sheet.kind === "operational");
}

/**
 * Get reference sheets from a project model.
 * 
 * @param project - The project model
 * @returns Array of reference sheet summaries
 */
export function getReferenceSheets(project: ProjectModel): ProjectSheetSummary[] {
  return project.sheets.filter(sheet => sheet.kind === "reference");
}

/**
 * Find a reference sheet by name pattern.
 * Used by ProjectContext to build lookup maps for Part Numbers and Blue Labels.
 * 
 * @param project - The project model
 * @param patterns - Array of name patterns to match (case-insensitive)
 * @returns The sheet data, or null if not found
 */
export function findReferenceSheetByPattern(
  project: ProjectModel,
  patterns: string[]
): typeof project.sheetData[string] | null {
  const normalizedPatterns = patterns.map(p => p.toLowerCase().replace(/\s+/g, ""));

  const matchesPatterns = (sheet: ProjectSheetSummary) => {
    const normalizedName = sheet.name.toLowerCase().replace(/\s+/g, "");
    return normalizedPatterns.some(pattern => normalizedName.includes(pattern));
  };

  // Prefer sheets already classified as reference, but fall back to any name match.
  const summary =
    project.sheets.find(sheet => sheet.kind === "reference" && matchesPatterns(sheet)) ??
    project.sheets.find(matchesPatterns);
  
  if (!summary) return null;
  return project.sheetData[summary.id] ?? null;
}

function findPreferredPartListSheet(
  project: ProjectModel
): typeof project.sheetData[string] | null {
  const preferredPatterns = [
    "partnumberlist",
    "part number list",
    "partlist",
    "part list",
    "part_number_list",
  ].map(pattern => pattern.toLowerCase().replace(/\s+/g, ""));

  const isCableSheet = (sheet: ProjectSheetSummary) => {
    const normalizedName = sheet.name.toLowerCase().replace(/\s+/g, "");
    return normalizedName.includes("cable");
  };

  const matchesPreferredPattern = (sheet: ProjectSheetSummary) => {
    const normalizedName = sheet.name.toLowerCase().replace(/\s+/g, "");
    return preferredPatterns.some(pattern => normalizedName.includes(pattern));
  };

  const preferredSummary =
    project.sheets.find(sheet => sheet.kind === "reference" && matchesPreferredPattern(sheet) && !isCableSheet(sheet)) ??
    project.sheets.find(sheet => matchesPreferredPattern(sheet) && !isCableSheet(sheet));

  if (!preferredSummary) {
    return null;
  }

  return project.sheetData[preferredSummary.id] ?? null;
}

/**
 * Get Blue Labels sheet from a project.
 * Looks for sheets with "blue label" or "bluelabel" in the name.
 */
export function getBlueLabelsSheet(
  project: ProjectModel
): typeof project.sheetData[string] | null {
  return findReferenceSheetByPattern(project, ["bluelabel", "blue label", "blue_label"]);
}

/**
 * Get Part List sheet from a project.
 * Looks for sheets with "part list", "partlist", or "part number" in the name.
 */
export function getPartListSheet(
  project: ProjectModel
): typeof project.sheetData[string] | null {
  return (
    findPreferredPartListSheet(project) ??
    findReferenceSheetByPattern(project, ["partlist", "part list", "part_list", "partnumber", "part number"])
  );
}

/**
 * Get Cable Part Numbers sheet from a project.
 * Looks for sheets with "cable part" or "cable pn" in the name.
 */
export function getCablePartNumbersSheet(
  project: ProjectModel
): typeof project.sheetData[string] | null {
  return findReferenceSheetByPattern(project, ["cable part", "cablepart", "cable pn", "cable_pn"]);
}

/**
 * Find a sheet by its ID within a project.
 * 
 * @param project - The project model
 * @param sheetId - The sheet ID to find
 * @returns The sheet summary and data, or null if not found
 */
export function findSheetById(
  project: ProjectModel,
  sheetId: string
): { summary: ProjectSheetSummary; data: typeof project.sheetData[string] } | null {
  const summary = project.sheets.find(s => s.id === sheetId);
  const data = project.sheetData[sheetId];
  
  if (!summary || !data) {
    return null;
  }
  
  return { summary, data };
}

/**
 * Find a sheet by its slug within a project.
 * 
 * @param project - The project model
 * @param slug - The sheet slug to find
 * @returns The sheet summary and data, or null if not found
 */
export function findSheetBySlug(
  project: ProjectModel,
  slug: string
): { summary: ProjectSheetSummary; data: typeof project.sheetData[string] } | null {
  const summary = project.sheets.find(s => s.slug === slug);
  
  if (!summary) {
    return null;
  }
  
  const data = project.sheetData[summary.id];
  
  if (!data) {
    return null;
  }
  
  return { summary, data };
}

  /**
   * Resolve a location label to an operational sheet within a project.
   *
   * Location values in the semantic wire list typically correspond to the cleaned
   * display name of another operational sheet, so we normalize both sides using
   * the same sheet-name rules the parser uses for slugs.
   */
  export function findOperationalSheetByLocation(
    project: ProjectModel,
    location: string
  ): { summary: ProjectSheetSummary; data: typeof project.sheetData[string] } | null {
    const normalizedLocation = normalizeSheetName(location);

    if (!normalizedLocation) {
      return null;
    }

    const summary = project.sheets.find((sheet) => {
      if (sheet.kind !== "operational") {
        return false;
      }

      return (
        sheet.slug === normalizedLocation ||
        normalizeSheetName(sheet.name) === normalizedLocation
      );
    });

    if (!summary) {
      return null;
    }

    const data = project.sheetData[summary.id];

    if (!data) {
      return null;
    }

    return { summary, data };
  }
