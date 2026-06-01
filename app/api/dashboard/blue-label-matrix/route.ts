import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import type { BlueLabelSequenceMatrixEntry } from "@/lib/wiring-identification";

export const runtime = "nodejs";

interface BlueLabelMatrixPayload {
  sourceFileName?: string;
  blueLabelsSheetName?: string;
  generatedAt?: string;
  warnings?: string[];
  entries?: BlueLabelSequenceMatrixEntry[];
}

function isValidEntry(entry: BlueLabelSequenceMatrixEntry): boolean {
  return (
    typeof entry.deviceId === "string" &&
    typeof entry.sheetName === "string" &&
    typeof entry.type === "string" &&
    typeof entry.location === "string" &&
    Number.isInteger(entry.sequenceIndex)
  );
}

export async function POST(request: Request) {
  let payload: BlueLabelMatrixPayload;

  try {
    payload = (await request.json()) as BlueLabelMatrixPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const entries = Array.isArray(payload.entries) ? payload.entries : [];
  if (entries.length === 0 || entries.some((entry) => !isValidEntry(entry))) {
    return NextResponse.json(
      { error: "Payload must contain valid matrix entries." },
      { status: 400 },
    );
  }

  const output = {
    sourceFileName: payload.sourceFileName ?? "unknown",
    blueLabelsSheetName: payload.blueLabelsSheetName ?? "Blue Labels",
    generatedAt: payload.generatedAt ?? new Date().toISOString(),
    warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
    entryCount: entries.length,
    entries,
  };

  const testDir = path.join(process.cwd(), "test");
  const targetFile = path.join(testDir, "blue-label-sequence-matrix-review.json");

  try {
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(targetFile, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to write review file.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const relativePath = path.relative(process.cwd(), targetFile).replaceAll("\\", "/");

  return NextResponse.json({
    ok: true,
    filePath: relativePath,
    entryCount: entries.length,
  });
}
