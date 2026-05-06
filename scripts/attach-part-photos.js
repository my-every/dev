#!/usr/bin/env node

/**
 * Recursively scans public/ for image files and matches them to JSON part files
 * in Share/parts by base filename (part number). When a match is found, writes
 * a data URL into the JSON under the `photo` field.
 *
 * Usage:
 *   node scripts/attach-part-photos.js
 *   node scripts/attach-part-photos.js --dry-run
 *   node scripts/attach-part-photos.js --overwrite
 *   node scripts/attach-part-photos.js --public-dir public --parts-dir Share/parts
 */

const fs = require("node:fs/promises");
const path = require("node:path");

const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]);

const MIME_BY_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

function parseArgs(argv) {
  const args = {
    dryRun: false,
    overwrite: false,
    publicDir: "public",
    partsDir: path.join("Share", "parts"),
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }

    if (token === "--overwrite") {
      args.overwrite = true;
      continue;
    }

    if (token === "--public-dir") {
      args.publicDir = argv[i + 1];
      i += 1;
      continue;
    }

    if (token === "--parts-dir") {
      args.partsDir = argv[i + 1];
      i += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

async function walkFiles(rootDir) {
  const files = [];

  async function walk(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  }

  await walk(rootDir);
  return files;
}

function toDataUrl(buffer, ext) {
  const mime = MIME_BY_EXT[ext.toLowerCase()] || "application/octet-stream";
  return `data:${mime};base64,${buffer.toString("base64")}`;
}

async function buildImageMap(publicDirAbs) {
  const allFiles = await walkFiles(publicDirAbs);
  const imageFiles = allFiles.filter((filePath) => SUPPORTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()));

  const map = new Map();

  for (const imagePath of imageFiles) {
    const base = path.parse(imagePath).name.toLowerCase();
    if (!map.has(base)) {
      map.set(base, imagePath);
    }
  }

  return map;
}

async function findPartJsonFiles(partsDirAbs) {
  const allFiles = await walkFiles(partsDirAbs);
  return allFiles.filter((filePath) => {
    if (path.extname(filePath).toLowerCase() !== ".json") return false;
    return path.basename(filePath).toLowerCase() !== "manifest.json";
  });
}

async function main() {
  const args = parseArgs(process.argv);

  const cwd = process.cwd();
  const publicDirAbs = path.resolve(cwd, args.publicDir);
  const partsDirAbs = path.resolve(cwd, args.partsDir);

  const imageMap = await buildImageMap(publicDirAbs);
  const partFiles = await findPartJsonFiles(partsDirAbs);

  let matched = 0;
  let updated = 0;
  let skippedHasPhoto = 0;
  let parseErrors = 0;

  for (const jsonPath of partFiles) {
    const partBase = path.parse(jsonPath).name;
    const imagePath = imageMap.get(partBase.toLowerCase());

    if (!imagePath) {
      continue;
    }

    matched += 1;

    let raw;
    let doc;

    try {
      raw = await fs.readFile(jsonPath, "utf8");
      doc = JSON.parse(raw);
    } catch (error) {
      parseErrors += 1;
      console.error(`Failed to parse JSON: ${jsonPath}`);
      console.error(error instanceof Error ? error.message : String(error));
      continue;
    }

    if (doc.photo && !args.overwrite) {
      skippedHasPhoto += 1;
      continue;
    }

    const ext = path.extname(imagePath).toLowerCase();
    const imageBuffer = await fs.readFile(imagePath);
    doc.photo = toDataUrl(imageBuffer, ext);

    if (!args.dryRun) {
      await fs.writeFile(jsonPath, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
    }

    updated += 1;
  }

  console.log("Done.");
  console.log(`public dir: ${publicDirAbs}`);
  console.log(`parts dir:  ${partsDirAbs}`);
  console.log(`image keys discovered: ${imageMap.size}`);
  console.log(`json part files scanned: ${partFiles.length}`);
  console.log(`matches found: ${matched}`);
  console.log(`updated: ${updated}`);
  console.log(`skipped (has photo): ${skippedHasPhoto}`);
  console.log(`parse errors: ${parseErrors}`);
  console.log(`mode: ${args.dryRun ? "dry-run" : "write"}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exit(1);
});
