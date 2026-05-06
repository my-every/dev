/**
 * Utilities for normalizing sheet names into URL-safe slugs.
 */

/**
 * Convert a sheet name to a URL-safe slug.
 * 
 * @param name - The original sheet name
 * @returns A URL-safe slug
 * 
 * @example
 * normalizeSheetName("(SHT 1) CONTROL,JB70") // "sht-1-control-jb70"
 * normalizeSheetName("PNL A,SMT130") // "pnl-a-smt130"
 * normalizeSheetName("Blue Labels") // "blue-labels"
 */
export function normalizeSheetName(name: string): string {
  return name
    .toLowerCase()
    // Remove parentheses and their content prefixes like "(SHT 1)"
    .replace(/^\([^)]*\)\s*/g, "")
    // Replace special characters with hyphens
    .replace(/[^a-z0-9]+/g, "-")
    // Remove leading/trailing hyphens
    .replace(/^-+|-+$/g, "")
    // Collapse multiple hyphens
    .replace(/-{2,}/g, "-")
    // Ensure non-empty
    || "sheet";
}

/**
 * Generate a stable, unique identifier from a sheet name and index.
 * 
 * @param name - The sheet name
 * @param index - The sheet index
 * @returns A unique identifier string
 */
export function generateSheetId(name: string, index: number): string {
  const slug = normalizeSheetName(name);
  return `${slug}-${index}`;
}

/**
 * Generate a project ID from filename.
 * 
 * @param filename - The workbook filename
 * @returns A stable project ID
 */
export function generateProjectId(filename: string): string {
  const base = filename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "project";

  // Add timestamp for uniqueness
  const timestamp = Date.now().toString(36);
  return `${base}-${timestamp}`;
}

/**
 * Generate a clean, human-readable project slug from PD number and name.
 * Produces IDs like "4m093-stock2" instead of "4m093-ucpwiringlist-a-5-m4-mo0h7usj".
 *
 * @param pdNumber - The PD number (e.g. "4M093")
 * @param projectName - The project name (e.g. "STOCK2")
 * @returns A clean project slug
 */
export function generateCleanProjectId(pdNumber: string, projectName: string): string {
  const pd = pdNumber.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const name = projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  if (!pd) return name || "project";
  if (!name) return pd;
  return `${pd}-${name}`;
}

/**
 * Extract a clean project name from filename.
 * 
 * @param filename - The workbook filename
 * @returns A human-readable project name
 */
export function extractProjectName(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .trim();
}

/**
 * Clean a sheet name for display by removing common prefixes.
 * 
 * @param name - The original sheet name
 * @returns A cleaned display name
 */
export function cleanSheetDisplayName(name: string): string {
  return name
    // Remove "(SHT X)" prefix pattern
    .replace(/^\([^)]*\)\s*/g, "")
    .trim();
}

/**
 * Normalize a title-like display value for UI surfaces.
 * Converts workbook-style separators like "^" and "," into readable spaces
 * while preserving the original semantic tokens for operators.
 */
export function normalizeDisplayTitle(name: string): string {
  const cleaned = cleanSheetDisplayName(name)
    .replace(/[\^,_/\\-]+/g, " ")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  return cleaned ? cleaned.toUpperCase() : "UNTITLED"
}
