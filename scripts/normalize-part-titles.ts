import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { PartRecord } from "@/types/parts-library";
import { getPartDisplayTitle } from "@/lib/parts/normalize-part-title";

const ROOT = path.resolve(process.cwd(), "Share/parts");

async function walk(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) return walk(fullPath);
            if (entry.isFile() && entry.name.endsWith(".json") && entry.name !== "manifest.json") {
                return [fullPath];
            }
            return [];
        }),
    );
    return files.flat();
}

async function main() {
    const files = await walk(ROOT);
    let updated = 0;

    for (const file of files) {
        const raw = await readFile(file, "utf8");
        const parsed = JSON.parse(raw) as PartRecord;
        const normalized = getPartDisplayTitle(parsed);

        if (parsed.displayTitle === normalized) {
            continue;
        }

        parsed.displayTitle = normalized;
        await writeFile(file, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
        updated += 1;
    }

    console.log(`Normalized display titles for ${updated} parts.`);
}

void main();
