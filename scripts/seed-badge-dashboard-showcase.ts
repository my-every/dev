#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildDashboardSeedBundle } from "../app/(workspaces)/[badgeNumber]/_components/dashboard-seeds";

async function main() {
  const bundle = buildDashboardSeedBundle();
  const outDir = path.join(process.cwd(), "Share", "mock");
  const outFile = path.join(outDir, "badge-dashboard-seed.json");
  await mkdir(outDir, { recursive: true });
  await writeFile(outFile, JSON.stringify(bundle, null, 2), "utf8");
  console.log(`[seed-badge-dashboard-showcase] wrote ${outFile}`);
}

main().catch((error) => {
  console.error("[seed-badge-dashboard-showcase] failed:", error);
  process.exit(1);
});
