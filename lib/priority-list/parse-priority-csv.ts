/**
 * CSV parser and normalizer for Priority List imports.
 *
 * The CSV has an irregular structure:
 * - Section headers appear as standalone rows (e.g. "RED CHANGE", "ASSEMBLY", "KITTING")
 * - Column headers repeat after each section header
 * - Data rows follow each column header row
 * - Empty rows separate sections
 *
 * We parse by tracking the current section, detecting column header rows,
 * and then classifying each data row into the appropriate stage.
 */

import type { PriorityEntry, PriorityStage, PriorityListData } from "./types";

// ============================================================================
// CSV Parsing
// ============================================================================

/**
 * Parse a CSV string handling quoted fields with commas/newlines.
 */
function parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (inQuotes) {
            if (char === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // skip escaped quote
                } else {
                    inQuotes = false;
                }
            } else {
                current += char;
            }
        } else {
            if (char === '"') {
                inQuotes = true;
            } else if (char === ",") {
                fields.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }
    }
    fields.push(current.trim());
    return fields;
}

// ============================================================================
// Section → Stage Mapping
// ============================================================================

/**
 * Known CSV section headers and the stage they map to.
 * The CSV uses various section names; we normalize them to our stage keys.
 */
const SECTION_TO_STAGE: Record<string, PriorityStage> = {
    "RED CHANGE": "biq",
    "GREEN CHANGE": "biq",
    "BIQ COMPLETE WITH SHORTAGES": "biq",
    "FINAL/BIQ": "biq",
    "FIRST PASS": "test",
    "HARDWARE/AC TEST": "test",
    "ASSEMBLY": "conassy",
    "KITTING": "kitting",
    "UPCOMING PROJECTS": "upcoming",
};

/**
 * Check if a row is a known section header.
 * Section headers are typically a single non-empty cell in the first column,
 * with the rest empty (or nearly empty).
 */
function detectSectionHeader(fields: string[]): string | null {
    const firstField = fields[0]?.toUpperCase().trim();
    if (!firstField) return null;

    // Check exact match first
    if (SECTION_TO_STAGE[firstField]) return firstField;

    // Check partial match for section headers
    for (const sectionName of Object.keys(SECTION_TO_STAGE)) {
        if (firstField.includes(sectionName) || sectionName.includes(firstField)) {
            return sectionName;
        }
    }

    return null;
}

/**
 * Check if a row is a column header row.
 * Column headers contain "CM #" in the first field.
 */
function isColumnHeaderRow(fields: string[]): boolean {
    const first = fields[0]?.toUpperCase().trim();
    return first === "CM #" || first === "CM#";
}

/**
 * Check if a row is empty (all fields blank).
 */
function isEmptyRow(fields: string[]): boolean {
    return fields.every((f) => !f.trim());
}

// ============================================================================
// Status-Based Stage Refinement
// ============================================================================

/**
 * Refine the stage based on the status text when the CSV section doesn't
 * provide enough granularity.
 */
function refineStageFromStatus(
    baseStage: PriorityStage,
    status: string
): PriorityStage {
    const upper = status.toUpperCase().trim();

    // Already completed/shipped
    if (
        upper.includes("SENT TO SHIPPING") ||
        upper.includes("SHIPPED") ||
        upper.includes("READY FOR SHIPPING")
    ) {
        return "completed";
    }

    // BIQ complete entries
    if (upper.includes("BIQ COMPLETE") || upper.includes("BIQ  COMPLETE")) {
        return "biq";
    }

    // BIQ work in progress
    if (upper.includes("BIQ WIP") || upper.includes("BIQ  WIP") || upper.includes("FINAL/BIQ")) {
        return "biq";
    }

    // Hardware / AC test
    if (
        upper.includes("HW TEST") ||
        upper.includes("READY FOR AC") ||
        upper.includes("READY FOR TEST") ||
        upper.includes("READY FOR CSA") ||
        upper.includes("AC TEST")
    ) {
        return "test";
    }

    // First pass is also test stage
    if (upper.includes("FIRST PASS")) {
        return "test";
    }

    // Panel build-up / wiring
    if (
        upper.includes("PANEL BU") ||
        upper.includes("PANEL WIRE") ||
        upper.includes("CONSOLE BU") ||
        upper.includes("CONSOLE XW") ||
        upper.includes("READY TO LAY") ||
        upper.includes("PANEL BUILD")
    ) {
        return "conassy";
    }

    // Branding stage (between kitting and conlay)
    if (upper.includes("BRANDING") || upper.includes("BRANDLIST") || upper.includes("READY TO BRAND")) {
        return "conlay";
    }

    // Kitting
    if (upper.includes("KITTING")) {
        return "kitting";
    }

    return baseStage;
}

// ============================================================================
// Public API
// ============================================================================

let entryIdCounter = 0;

/**
 * Parse a Priority List CSV string into structured PriorityListData.
 */
export function parsePriorityListCSV(
    csvText: string,
    filename: string
): PriorityListData {
    const lines = csvText.split(/\r?\n/);
    const entries: PriorityEntry[] = [];
    let currentSection = "UPCOMING PROJECTS";
    let currentBaseStage: PriorityStage = "upcoming";

    entryIdCounter = 0;

    for (const line of lines) {
        const fields = parseCSVLine(line);

        // Skip empty rows
        if (isEmptyRow(fields)) continue;

        // Check for section header
        const section = detectSectionHeader(fields);
        if (section) {
            currentSection = section;
            currentBaseStage = SECTION_TO_STAGE[section] ?? "upcoming";
            continue;
        }

        // Skip column header rows
        if (isColumnHeaderRow(fields)) continue;

        // Parse data row — must have CM # or at least customer info
        const cmNumber = fields[0]?.trim() ?? "";
        const customer = fields[1]?.trim() ?? "";

        // Skip rows with no useful data
        if (!cmNumber && !customer) continue;

        // Skip rows that look like section labels (single text cell, no number)
        if (cmNumber && !/^\d/.test(cmNumber) && !customer) continue;

        const status = fields[11]?.trim() ?? "";
        const stage = refineStageFromStatus(currentBaseStage, status);

        entryIdCounter++;
        entries.push({
            id: `pl-${entryIdCounter}`,
            cmNumber,
            customer,
            unit: fields[2]?.trim() ?? "",
            pd: fields[3]?.trim() ?? "",
            lwc: fields[4]?.trim() ?? "",
            planConlay: fields[5]?.trim() ?? "",
            conassy: fields[6]?.trim() ?? "",
            target: fields[7]?.trim() ?? "",
            concus: fields[8]?.trim() ?? "",
            productionPlanner: fields[9]?.trim() ?? "",
            unitLocation: fields[10]?.trim() ?? "",
            status,
            shortagesNotes: fields[12]?.trim() ?? "",
            stage,
            csvSection: currentSection,
        });
    }

    return {
        entries,
        importedAt: new Date().toISOString(),
        filename,
    };
}
