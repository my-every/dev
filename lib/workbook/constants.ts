/**
 * Constants for workbook parsing and sheet classification.
 * These values are centralized here to make future modifications easier.
 */

/**
 * Patterns used to identify reference sheets (non-operational).
 * These are matched case-insensitively against sheet names.
 */
export const REFERENCE_SHEET_PATTERNS = [
  "panel error",
  "panelerror",
  "blue label",
  "bluelabel",
  "white label",
  "whitelabel",
  "heat shrink",
  "heatshrink",
  "cable part number",
  "cablepartnumber",
  "part list",
  "partlist",
  "part number",
  "partnumber",
  "part_number",
  "parts list",
  "partslist",
  "bom",
  "bill of material",
] as const;

/**
 * Known operational sheet name patterns.
 * Used for enhanced classification when needed.
 * 
 * TODO: Extend this list as more sheet types are discovered.
 */
export const OPERATIONAL_SHEET_PATTERNS = [
  "pnl",
  "panel",
  "ctrl",
  "control",
  "gen",
  "fuse",
  "relay",
  "mcc",
  "plc",
  "tcp",
  "prox",
  "turb",
  "power",
  "dist",
] as const;

/**
 * Minimum number of rows for a sheet to be considered non-empty.
 */
export const MIN_SHEET_ROWS = 1;

/**
 * Maximum file size for workbook upload (in bytes).
 * Default: 50MB
 */
export const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

/**
 * Accepted file extensions for workbook upload.
 */
export const ACCEPTED_FILE_EXTENSIONS = [".xlsx", ".xls", ".xlsm", ".xlsb"] as const;

/**
 * MIME types accepted for workbook upload.
 */
export const ACCEPTED_MIME_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
  "application/vnd.ms-excel.sheet.binary.macroEnabled.12",
] as const;

/**
 * Local storage key for persisting project data.
 */
export const PROJECT_STORAGE_KEY = "wirelist_project" as const;

/**
 * Local storage key for persisting layout PDF data.
 */
export const LAYOUT_PDF_STORAGE_KEY = "wirelist_layout_pdf" as const;

/**
 * Local storage key for persisting layout page images (base64).
 */
export const LAYOUT_PAGES_STORAGE_KEY = "wirelist_layout_pages" as const;

/**
 * Local storage key for persisting layout mapping data.
 */
export const LAYOUT_MAPPING_STORAGE_KEY = "wirelist_layout_mapping" as const;

/**
 * Session storage key for current project ID.
 */
export const CURRENT_PROJECT_KEY = "wirelist_current_project" as const;
