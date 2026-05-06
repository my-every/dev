/**
 * merge-part-numbers.ts
 *
 * Reads every CSV in public/part-numbers/, merges them by part number,
 * assigns a category and icon based on the source filename, checks for
 * matching reference images in public/, and writes the merged library to
 * public/library/part-number-libary.csv.
 *
 * Usage:
 *   node --experimental-strip-types scripts/merge-part-numbers.ts
 */

import fs from "node:fs";
import path from "node:path";

// ─── paths ───────────────────────────────────────────────────────────────────
const ROOT = path.resolve(import.meta.dirname, "..");
const PART_NUMBERS_DIR = path.join(ROOT, "public", "part-numbers");
const LIBRARY_DIR = path.join(ROOT, "public", "library");
const OUTPUT_PATH = path.join(LIBRARY_DIR, "part-number-libary.csv");
const PUBLIC_DIR = path.join(ROOT, "public");
const SHARE_CATALOG_DIR = path.join(ROOT, "Share", "catalog");
const JSON_OUTPUT_PATH = path.join(SHARE_CATALOG_DIR, "part-library.json");

// ─── category mapping  (filename stem → PartCategory) ───────────────────────
const FILE_TO_CATEGORY: Record<string, string> = {
    base: "Terminal Blocks & Accessories",
    boxes: "Panel Hardware",
    busbar: "Grounding & Busbars",
    "cables-wires": "Cable Management",
    "circut-breakers": "Circuit Protection",
    clamps: "Cable Management",
    contactors: "Control Relays",
    diodes: "Diodes & Suppression",
    ferrules: "Wire Ferrules",
    "fire-system": "Control Modules",
    fuses: "Circuit Protection",
    inserts: "Panel Hardware",
    isolators: "Signal Conditioning",
    lighting: "Panel Lighting",
    lugs: "Ring Terminals",
    "media-converters": "Industrial Networking",
    modules: "Control Modules",
    panels: "Panel Hardware",
    relays: "Control Relays",
    resistors: "Passive Components",
    terminals: "Terminal Blocks & Accessories",
    tools: "Unknown",
};

// ─── icon mapping  (category → default icon path) ───────────────────────────
const CATEGORY_ICON: Record<string, string> = {
    "Grounding & Busbars": "/icons/busbar.svg",
    "Wire Ferrules": "/icons/gray-ferrule.svg",
    "Terminal Blocks & Accessories": "/icons/screw-terminals.svg",
    "Ring Terminals": "/icons/red-lug.svg",
    "Fork Terminals": "/icons/red-fork.svg",
    "Circuit Protection": "",
    "Control Relays": "",
    "Diodes & Suppression": "",
    "Passive Components": "",
    "Panel Hardware": "",
    "Cable Management": "",
    "Wire Management": "",
    "Panel Lighting": "",
    "Control Modules": "",
    "Signal Conditioning": "",
    "Industrial Networking": "",
    "DIN Rail & Mounting": "",
    Unknown: "",
};

// ─── reference-image directories  (category → public subdir to probe) ───────
const CATEGORY_IMAGE_DIR: Record<string, string> = {
    "Grounding & Busbars": "busbars",
    "Circuit Protection": "fuses",
    "Cable Management": "cables",
    "Wire Management": "wires",
};

// ─── types ───────────────────────────────────────────────────────────────────
interface LibraryEntry {
    partNumber: string;
    description: string;
    category: string;
    referenceImage: string;
    icon: string;
}

// ─── CSV helpers ─────────────────────────────────────────────────────────────

/** Minimal CSV line parser that handles quoted fields with commas. */
function parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++; // skip escaped quote
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

/** Escape a field for CSV output (quote if it contains comma, quote, or newline). */
function csvEscape(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

// ─── read existing library for preserved overrides ───────────────────────────
function readExistingLibrary(): Map<string, LibraryEntry> {
    const map = new Map<string, LibraryEntry>();
    if (!fs.existsSync(OUTPUT_PATH)) return map;

    const content = fs.readFileSync(OUTPUT_PATH, "utf-8");
    const lines = content.split(/\r?\n/).filter((l) => l.trim());
    // skip header
    for (let i = 1; i < lines.length; i++) {
        const fields = parseCsvLine(lines[i]);
        if (fields.length < 2) continue;
        const entry: LibraryEntry = {
            partNumber: fields[0],
            description: fields[1],
            category: fields[2] ?? "",
            referenceImage: fields[3] ?? "",
            icon: fields[4] ?? "",
        };
        map.set(entry.partNumber.toUpperCase(), entry);
    }
    return map;
}

// ─── probe for a reference image ─────────────────────────────────────────────
function findReferenceImage(
    partNumber: string,
    category: string,
): string {
    const subdir = CATEGORY_IMAGE_DIR[category];
    if (!subdir) return "";

    const dir = path.join(PUBLIC_DIR, subdir);
    if (!fs.existsSync(dir)) return "";

    // check common extensions
    for (const ext of [".png", ".jpg", ".jpeg", ".webp"]) {
        const file = path.join(dir, partNumber + ext);
        if (fs.existsSync(file)) {
            return `/${subdir}/${partNumber}${ext}`;
        }
    }
    return "";
}

// ─── convert flat entry → PartCatalogRecord shape ────────────────────────────

interface PartCatalogRecordJson {
    partNumber: string;
    description: string;
    category: string;
    images: {
        primary?: { src: string; viewType: string; alt: string };
        icon?: { src: string; viewType: string; alt: string };
        images: { src: string; viewType: string; alt: string }[];
        diagrams: never[];
    };
    source: "LIBRARY_CSV";
}

function toPartCatalogRecord(entry: LibraryEntry): PartCatalogRecordJson {
    const images: PartCatalogRecordJson["images"] = {
        images: [],
        diagrams: [],
    };

    if (entry.referenceImage) {
        const img = {
            src: entry.referenceImage,
            viewType: "front" as const,
            alt: entry.description,
        };
        images.primary = img;
        images.images.push(img);
    }

    if (entry.icon) {
        images.icon = {
            src: entry.icon,
            viewType: "icon" as const,
            alt: `${entry.description} icon`,
        };
    }

    return {
        partNumber: entry.partNumber,
        description: entry.description,
        category: entry.category,
        images,
        source: "LIBRARY_CSV",
    };
}

// ─── main ────────────────────────────────────────────────────────────────────
function main() {
    console.log("─── merge-part-numbers ───");

    // 1. Load existing library entries (to preserve manual overrides)
    const existing = readExistingLibrary();
    console.log(`Existing library entries: ${existing.size}`);

    // 2. Read all CSVs from part-numbers/
    const csvFiles = fs
        .readdirSync(PART_NUMBERS_DIR)
        .filter((f) => f.endsWith(".csv"))
        .sort();

    console.log(`Source CSVs found: ${csvFiles.length}`);

    // merged map keyed by uppercase part number
    const merged = new Map<string, LibraryEntry>();

    // Seed with existing entries first (so their overrides survive)
    for (const [key, entry] of existing) {
        merged.set(key, entry);
    }

    let newCount = 0;
    let skipCount = 0;

    for (const csvFile of csvFiles) {
        const stem = path.basename(csvFile, ".csv");
        const category = FILE_TO_CATEGORY[stem] ?? "Unknown";
        const defaultIcon = CATEGORY_ICON[category] ?? "";

        const filePath = path.join(PART_NUMBERS_DIR, csvFile);
        const content = fs.readFileSync(filePath, "utf-8");
        const lines = content.split(/\r?\n/).filter((l) => l.trim());

        if (lines.length < 2) {
            console.log(`  ⚠ ${csvFile}: empty, skipping`);
            continue;
        }

        // Parse header to find Product Number and Description columns
        const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
        const pnIdx = header.findIndex(
            (h) => h === "product number" || h === "part number",
        );
        const descIdx = header.findIndex(
            (h) => h === "description" || h === "desc",
        );

        if (pnIdx < 0 || descIdx < 0) {
            console.log(
                `  ⚠ ${csvFile}: missing Product Number or Description column, skipping`,
            );
            continue;
        }

        let fileCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const fields = parseCsvLine(lines[i]);
            const partNumber = (fields[pnIdx] ?? "").trim();
            const description = (fields[descIdx] ?? "").trim();

            if (!partNumber) continue;

            const key = partNumber.toUpperCase();

            if (merged.has(key)) {
                skipCount++;
                continue;
            }

            const referenceImage = findReferenceImage(partNumber, category);

            merged.set(key, {
                partNumber,
                description,
                category,
                referenceImage,
                icon: defaultIcon,
            });

            fileCount++;
            newCount++;
        }

        console.log(`  ✓ ${csvFile}: ${fileCount} new entries (category: ${category})`);
    }

    // 3. Sort entries by part number
    const sorted = [...merged.values()].sort((a, b) =>
        a.partNumber.localeCompare(b.partNumber),
    );

    // 4. Write output
    if (!fs.existsSync(LIBRARY_DIR)) {
        fs.mkdirSync(LIBRARY_DIR, { recursive: true });
    }

    const headerLine = "Part Number,Description,Category,Reference Image,Icon";
    const dataLines = sorted.map(
        (e) =>
            `${csvEscape(e.partNumber)},${csvEscape(e.description)},${csvEscape(e.category)},${e.referenceImage},${e.icon}`,
    );

    fs.writeFileSync(OUTPUT_PATH, [headerLine, ...dataLines].join("\n") + "\n", "utf-8");

    // 5. Write JSON for the catalog module (Share/catalog/part-library.json)
    if (!fs.existsSync(SHARE_CATALOG_DIR)) {
        fs.mkdirSync(SHARE_CATALOG_DIR, { recursive: true });
    }

    const entries: Record<string, unknown> = {};
    for (const entry of sorted) {
        entries[entry.partNumber] = toPartCatalogRecord(entry);
    }

    const catalogLibrary = {
        version: 1,
        updatedAt: new Date().toISOString(),
        entries,
    };

    fs.writeFileSync(
        JSON_OUTPUT_PATH,
        JSON.stringify(catalogLibrary, null, 2),
        "utf-8",
    );

    console.log(`\n─── Results ───`);
    console.log(`Total entries: ${sorted.length}`);
    console.log(`New entries added: ${newCount}`);
    console.log(`Duplicates skipped: ${skipCount}`);
    console.log(`CSV  → ${OUTPUT_PATH}`);
    console.log(`JSON → ${JSON_OUTPUT_PATH}`);
}

main();
