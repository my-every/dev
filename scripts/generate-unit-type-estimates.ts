/**
 * Generate estimated operation time constants from ProjTrackHistory(Consolidated).csv
 *
 * Reads the CSV, groups rows by Unit Type, and computes average hours per operation
 * code for each unit type. Outputs a TypeScript constants file.
 *
 * Usage:
 *   node --experimental-strip-types scripts/generate-unit-type-estimates.ts
 *
 * Options:
 *   --input <path>   Path to consolidated CSV (default: ./ProjTrackHistory(Consolidated).csv)
 *   --output <path>  Output TS file path (default: ./lib/priority-list/unit-type-estimates.ts)
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

// ---------------------------------------------------------------------------
// CSV Parser (handles quoted fields with commas inside)
// ---------------------------------------------------------------------------

function parseCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ",") {
                fields.push(current.trim());
                current = "";
            } else {
                current += ch;
            }
        }
    }
    fields.push(current.trim());
    return fields;
}

// ---------------------------------------------------------------------------
// Operation definitions matching the CSV columns
// ---------------------------------------------------------------------------

/** Operation codes in CSV column order */
const PLAN_OP_CODES = [
    "005", "006", "007", "010", "011", "012",
    "020", "030", "038", "070", "071",
    "101", "102", "103", "104", "105", "106", "107", "108", "109", "110",
    "200", "205", "207", "210", "215", "220", "225", "300",
] as const;

interface OperationSample {
    hours: number[];
    descriptions: Set<string>;
    /** BUP/ASM/VIS breakdown samples */
    bup: number[];
    asm: number[];
    vis: number[];
}

interface UnitTypeAccumulator {
    unitType: string;
    sampleCount: number;
    totalHours: number[];
    operations: Map<string, OperationSample>;
    /** Track number of panels (101-110) with non-zero hours */
    panelCounts: number[];
    numUnits: number[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
    const args = process.argv.slice(2);
    let inputPath = path.resolve("ProjTrackHistory(Consolidated).csv");
    let outputPath = path.resolve("lib/priority-list/unit-type-estimates.ts");

    for (let i = 0; i < args.length; i++) {
        if (args[i] === "--input" && args[i + 1]) {
            inputPath = path.resolve(args[++i]);
        } else if (args[i] === "--output" && args[i + 1]) {
            outputPath = path.resolve(args[++i]);
        }
    }

    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        process.exit(1);
    }

    const csv = fs.readFileSync(inputPath, "utf-8");
    const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length < 2) {
        console.error("CSV has no data rows");
        process.exit(1);
    }

    const headers = parseCSVLine(lines[0]);

    // Find column indices
    const unitTypeIdx = headers.indexOf("Unit Type");
    const numUnitsIdx = headers.indexOf("NumUnits");
    if (unitTypeIdx < 0) {
        console.error("Could not find 'Unit Type' column");
        process.exit(1);
    }

    // Find PlanOP hour columns - they have headers like "PlanOP 005", "PlanOp 102" (note inconsistent casing)
    const planOpHourIndices: { code: string; idx: number }[] = [];
    const planOpDescIndices: { code: string; idx: number }[] = [];

    for (let i = 0; i < headers.length; i++) {
        const h = headers[i];

        // Match hour columns: "PlanOP 005" (not Desc, not BUP/ASM/VIS)
        const hourMatch = h.match(/^Plan[Oo][Pp]\s+(\d{3})$/i);
        if (hourMatch) {
            planOpHourIndices.push({ code: hourMatch[1], idx: i });
            continue;
        }

        // Match description columns: "PlanOP 005 Desc"
        const descMatch = h.match(/^Plan[Oo][Pp]\s+(\d{3})\s+Desc$/i);
        if (descMatch) {
            planOpDescIndices.push({ code: descMatch[1], idx: i });
        }
    }

    // Find BUP/ASM/VIS columns for breakdown
    const bupAsmVisIndices: { code: string; type: "BUP" | "ASM" | "VIS"; idx: number }[] = [];
    for (let i = 0; i < headers.length; i++) {
        const m = headers[i].match(/^Plan[Oo][Pp]\s+(\d{3})\s+(BUP|ASM|VIS)$/i);
        if (m) {
            bupAsmVisIndices.push({ code: m[1], type: m[2].toUpperCase() as "BUP" | "ASM" | "VIS", idx: i });
        }
    }

    console.log(`Found ${planOpHourIndices.length} operation hour columns`);
    console.log(`Found ${planOpDescIndices.length} operation description columns`);
    console.log(`Found ${bupAsmVisIndices.length} BUP/ASM/VIS breakdown columns`);

    // Parse rows and accumulate by unit type
    const accumulators = new Map<string, UnitTypeAccumulator>();

    for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
        const fields = parseCSVLine(lines[rowIdx]);
        const rawUnitType = fields[unitTypeIdx] || "";
        if (!rawUnitType) continue;

        // Normalize: uppercase, trim
        const unitType = rawUnitType.toUpperCase().trim();

        let acc = accumulators.get(unitType);
        if (!acc) {
            acc = {
                unitType,
                sampleCount: 0,
                totalHours: [],
                operations: new Map(),
                panelCounts: [],
                numUnits: [],
            };
            accumulators.set(unitType, acc);
        }
        acc.sampleCount++;

        const numUnits = parseFloat(fields[numUnitsIdx] || "1") || 1;
        acc.numUnits.push(numUnits);

        // Sum all operation hours for total
        let rowTotal = 0;
        let panelCount = 0;

        for (const { code, idx } of planOpHourIndices) {
            const val = parseFloat(fields[idx] || "");
            if (!isNaN(val) && val > 0) {
                rowTotal += val;

                // Count non-zero panels (101-110)
                const opNum = parseInt(code);
                if (opNum >= 101 && opNum <= 110) panelCount++;
            }

            let opSample = acc.operations.get(code);
            if (!opSample) {
                opSample = { hours: [], descriptions: new Set(), bup: [], asm: [], vis: [] };
                acc.operations.set(code, opSample);
            }

            if (!isNaN(val) && val > 0) {
                opSample.hours.push(val);
            }
        }

        // Collect descriptions
        for (const { code, idx } of planOpDescIndices) {
            const desc = fields[idx] || "";
            if (desc && desc !== "Not Used" && desc !== "Not used") {
                const opSample = acc.operations.get(code);
                if (opSample) opSample.descriptions.add(desc);
            }
        }

        // Collect BUP/ASM/VIS
        for (const { code, type, idx } of bupAsmVisIndices) {
            const val = parseFloat(fields[idx] || "");
            if (!isNaN(val) && val > 0) {
                const opSample = acc.operations.get(code);
                if (opSample) {
                    if (type === "BUP") opSample.bup.push(val);
                    else if (type === "ASM") opSample.asm.push(val);
                    else if (type === "VIS") opSample.vis.push(val);
                }
            }
        }

        acc.totalHours.push(rowTotal);
        acc.panelCounts.push(panelCount);
    }

    // ---------------------------------------------------------------------------
    // Generate output
    // ---------------------------------------------------------------------------

    const sortedTypes = [...accumulators.values()].sort((a, b) => b.sampleCount - a.sampleCount);

    const avg = (arr: number[]) => (arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length);
    const round = (n: number, decimals = 1) => Math.round(n * 10 ** decimals) / 10 ** decimals;

    let output = `/**
 * Estimated operation hours per unit type.
 *
 * Auto-generated from ProjTrackHistory(Consolidated).csv
 * Generated: ${new Date().toISOString().split("T")[0]}
 *
 * Run: node --experimental-strip-types scripts/generate-unit-type-estimates.ts
 */

// ============================================================================
// Operation Code Reference
// ============================================================================

export interface OperationEstimate {
  /** Operation code (e.g. "010", "101") */
  code: string;
  /** Human-readable label */
  label: string;
  /** Average hours across historical projects */
  avgHours: number;
  /** Average breakdown: build-up hours */
  avgBup: number;
  /** Average breakdown: assembly hours */
  avgAsm: number;
  /** Average breakdown: visual/inspection hours */
  avgVis: number;
}

export interface UnitTypeEstimate {
  /** Normalized unit type key */
  unitType: string;
  /** Number of historical projects sampled */
  sampleCount: number;
  /** Average total estimated hours (sum of all operations) */
  avgTotalHours: number;
  /** Average number of units per project */
  avgUnits: number;
  /** Average number of active panels (OP 101-110 with hours > 0) */
  avgPanelCount: number;
  /** Per-operation hour estimates */
  operations: OperationEstimate[];
}

`;

    // ---------------------------------------------------------------------------
    // Generate the main constant map
    // ---------------------------------------------------------------------------

    output += `export const UNIT_TYPE_ESTIMATES: Record<string, UnitTypeEstimate> = {\n`;

    for (const acc of sortedTypes) {
        const totalAvg = round(avg(acc.totalHours));
        const unitsAvg = round(avg(acc.numUnits));
        const panelAvg = round(avg(acc.panelCounts));

        output += `  "${acc.unitType}": {\n`;
        output += `    unitType: "${acc.unitType}",\n`;
        output += `    sampleCount: ${acc.sampleCount},\n`;
        output += `    avgTotalHours: ${totalAvg},\n`;
        output += `    avgUnits: ${unitsAvg},\n`;
        output += `    avgPanelCount: ${panelAvg},\n`;
        output += `    operations: [\n`;

        for (const code of PLAN_OP_CODES) {
            const opSample = acc.operations.get(code);
            if (!opSample || opSample.hours.length === 0) continue;

            const opAvg = round(avg(opSample.hours));
            const bupAvg = round(avg(opSample.bup));
            const asmAvg = round(avg(opSample.asm));
            const visAvg = round(avg(opSample.vis));

            // Pick most common description
            let label = `OP ${code}`;
            if (opSample.descriptions.size > 0) {
                // Use first non-generic description
                const descs = [...opSample.descriptions];
                label = descs[0];
            }

            // Escape quotes in label
            const safeLabel = label.replace(/"/g, '\\"');
            output += `      { code: "${code}", label: "${safeLabel}", avgHours: ${opAvg}, avgBup: ${bupAvg}, avgAsm: ${asmAvg}, avgVis: ${visAvg} },\n`;
        }

        output += `    ],\n`;
        output += `  },\n`;
    }

    output += `};\n\n`;

    // ---------------------------------------------------------------------------
    // Summary constant: all unit types sorted by avg total hours
    // ---------------------------------------------------------------------------

    output += `/** All unit types sorted by average total hours (descending) */\n`;
    output += `export const UNIT_TYPE_SUMMARY: { unitType: string; sampleCount: number; avgTotalHours: number; avgPanelCount: number }[] = [\n`;

    const summaryItems = sortedTypes
        .map((acc) => ({
            unitType: acc.unitType,
            sampleCount: acc.sampleCount,
            avgTotalHours: round(avg(acc.totalHours)),
            avgPanelCount: round(avg(acc.panelCounts)),
        }))
        .sort((a, b) => b.avgTotalHours - a.avgTotalHours);

    for (const item of summaryItems) {
        output += `  { unitType: "${item.unitType}", sampleCount: ${item.sampleCount}, avgTotalHours: ${item.avgTotalHours}, avgPanelCount: ${item.avgPanelCount} },\n`;
    }

    output += `];\n\n`;

    // ---------------------------------------------------------------------------
    // Lookup helper
    // ---------------------------------------------------------------------------

    output += `/**
 * Look up estimated total hours for a unit type.
 * Falls back to overall average if the unit type is unknown.
 */
export function getEstimatedHours(unitType: string): number {
  const key = unitType.toUpperCase().trim();
  const estimate = UNIT_TYPE_ESTIMATES[key];
  if (estimate) return estimate.avgTotalHours;

  // Fallback: overall average across all unit types
  const all = Object.values(UNIT_TYPE_ESTIMATES);
  if (all.length === 0) return 0;
  return Math.round(all.reduce((s, e) => s + e.avgTotalHours, 0) / all.length);
}

/**
 * Look up estimated hours for a specific operation within a unit type.
 */
export function getOperationEstimate(unitType: string, opCode: string): OperationEstimate | null {
  const key = unitType.toUpperCase().trim();
  const estimate = UNIT_TYPE_ESTIMATES[key];
  if (!estimate) return null;
  return estimate.operations.find((op) => op.code === opCode) ?? null;
}
`;

    // Write output
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, output, "utf-8");

    // Print summary
    console.log(`\nGenerated: ${outputPath}`);
    console.log(`Unit types: ${sortedTypes.length}`);
    console.log(`\nSummary (by avg total hours):`);
    console.log("─".repeat(65));
    console.log(`${"Unit Type".padEnd(20)} ${"Samples".padStart(8)} ${"Avg Hours".padStart(10)} ${"Avg Panels".padStart(11)}`);
    console.log("─".repeat(65));
    for (const item of summaryItems) {
        console.log(
            `${item.unitType.padEnd(20)} ${String(item.sampleCount).padStart(8)} ${String(item.avgTotalHours).padStart(10)} ${String(item.avgPanelCount).padStart(11)}`
        );
    }
    console.log("─".repeat(65));
}

main();
