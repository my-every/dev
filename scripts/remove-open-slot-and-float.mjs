#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

function printUsage() {
    console.log(`Usage:
  node scripts/remove-open-slot-and-float.mjs <json-file> [--in-place] [--dry-run] [--out <output-file>]

Removes rows from a JSON array where either:
  1) NEW === "" and NOTE === "open slot" (case-insensitive, trimmed), or
  2) PROJECT === "FLOAT" (case-insensitive, trimmed)

Options:
  --in-place   Overwrite the input file with filtered output
  --dry-run    Print counts only; do not write any file
  --out <file> Write filtered output to a specific file
`);
}

function normalize(value) {
    return String(value ?? "").trim().toLowerCase();
}

function isOpenSlot(row) {
    return normalize(row?.NEW) === "" && normalize(row?.NOTE) === "open slot";
}

function isFloatProject(row) {
    return normalize(row?.PROJECT) === "float";
}

function parseArgs(argv) {
    const args = [...argv];
    const filePath = args.shift();

    let inPlace = false;
    let dryRun = false;
    let outPath = "";

    while (args.length > 0) {
        const token = args.shift();
        if (token === "--in-place") {
            inPlace = true;
            continue;
        }
        if (token === "--dry-run") {
            dryRun = true;
            continue;
        }
        if (token === "--out") {
            const next = args.shift();
            if (!next) {
                throw new Error("Missing value for --out");
            }
            outPath = next;
            continue;
        }
        throw new Error(`Unknown argument: ${token}`);
    }

    if (!filePath) {
        throw new Error("Missing required <json-file> path");
    }

    if (inPlace && outPath) {
        throw new Error("Use either --in-place or --out, not both");
    }

    return { filePath, inPlace, dryRun, outPath };
}

async function main() {
    let parsed;
    try {
        parsed = parseArgs(process.argv.slice(2));
    } catch (error) {
        console.error(`Error: ${error.message}`);
        printUsage();
        process.exitCode = 1;
        return;
    }

    const inputPath = path.resolve(parsed.filePath);
    const raw = await fs.readFile(inputPath, "utf8");
    const data = JSON.parse(raw);

    if (!Array.isArray(data)) {
        throw new Error("Expected the input JSON root to be an array");
    }

    let removedOpenSlot = 0;
    let removedFloat = 0;

    const filtered = data.filter((row) => {
        const removeForOpenSlot = isOpenSlot(row);
        const removeForFloat = isFloatProject(row);

        if (removeForOpenSlot) {
            removedOpenSlot += 1;
        }
        if (!removeForOpenSlot && removeForFloat) {
            removedFloat += 1;
        }

        return !(removeForOpenSlot || removeForFloat);
    });

    const removedTotal = data.length - filtered.length;

    console.log(`Input rows:   ${data.length}`);
    console.log(`Removed rows: ${removedTotal}`);
    console.log(`  - open slot condition: ${removedOpenSlot}`);
    console.log(`  - project FLOAT:       ${removedFloat}`);
    console.log(`Kept rows:    ${filtered.length}`);

    if (parsed.dryRun) {
        return;
    }

    let writePath = parsed.outPath ? path.resolve(parsed.outPath) : "";
    if (!writePath && parsed.inPlace) {
        writePath = inputPath;
    }
    if (!writePath) {
        const ext = path.extname(inputPath);
        const base = inputPath.slice(0, inputPath.length - ext.length);
        writePath = `${base}.filtered${ext || ".json"}`;
    }

    await fs.writeFile(writePath, `${JSON.stringify(filtered, null, 2)}\n`, "utf8");
    console.log(`Wrote filtered file: ${writePath}`);
}

main().catch((error) => {
    console.error(`Fatal: ${error.message}`);
    process.exitCode = 1;
});
