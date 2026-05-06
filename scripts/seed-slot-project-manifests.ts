import path from "node:path";

import {
  seedProjectsFromSlots,
  type SeededSlotProjectResult,
} from "../lib/project-schedule/slots-project-seeding.ts";

function resolveShareRoot() {
  const configured = process.env.SHARE_DIR?.trim();
  if (configured && path.isAbsolute(configured)) {
    return configured;
  }
  return path.join(process.cwd(), "Share");
}

function formatResultLine(result: SeededSlotProjectResult) {
  return [
    result.action.toUpperCase().padEnd(7, " "),
    result.pdNumber.padEnd(10, " "),
    `unit ${String(result.unitNumber || "-").padEnd(4, " ")}`,
    result.displayName,
    `| legals=${result.legalsUploadStatus}`,
  ].join(" ");
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");
  const overwrite = args.has("--overwrite");
  const shareRoot = resolveShareRoot();

  const results = await seedProjectsFromSlots({
    shareRoot,
    dryRun,
    overwrite,
  });

  const created = results.filter((entry) => entry.action === "created").length;
  const updated = results.filter((entry) => entry.action === "updated").length;
  const skipped = results.filter((entry) => entry.action === "skipped").length;

  console.log(`Share root: ${shareRoot}`);
  console.log(`Rows processed: ${results.length}`);
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log("");

  for (const result of results) {
    console.log(formatResultLine(result));
  }
}

main().catch((error) => {
  console.error("Failed to seed slot project manifests");
  console.error(error);
  process.exitCode = 1;
});
