import { promises as fs } from "node:fs";
import path from "node:path";

import { NextRequest, NextResponse } from "next/server";

import { resolveProjectStateDirectory } from "@/lib/project-state/share-project-state-handlers";

export const dynamic = "force-dynamic";

const MEASUREMENTS_CONFIG_DIRECTORY = "measurements-config";
const SCHEMA_VERSION = 1;

interface MeasurePoint {
  id: string;
  pdfX: number;
  pdfY: number;
}

type MeasurementMode = "path" | "fanout";

interface StoredRowMeasurement {
  rowId: string;
  wireKey: string;
  pageNumber: number;
  mode: MeasurementMode;
  points: MeasurePoint[];
}

interface MeasurementConfigPayload {
  schemaVersion: number;
  sheetKey: string;
  rows: Record<string, StoredRowMeasurement>;
  updatedAt: string;
}

function sanitizeSheetKey(value: string | null): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "default-sheet";
}

function makeFileName(sheetKey: string): string {
  return `${encodeURIComponent(sheetKey)}.json`;
}

async function resolveMeasurementsConfigDirectory(projectId: string): Promise<string | null> {
  const stateDirectory = await resolveProjectStateDirectory(projectId);
  if (!stateDirectory) {
    return null;
  }

  const configDirectory = path.join(stateDirectory, MEASUREMENTS_CONFIG_DIRECTORY);
  await fs.mkdir(configDirectory, { recursive: true });
  return configDirectory;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const sheetKey = sanitizeSheetKey(request.nextUrl.searchParams.get("sheetKey"));
    const configDirectory = await resolveMeasurementsConfigDirectory(projectId);
    if (!configDirectory) {
      return NextResponse.json({
        schemaVersion: SCHEMA_VERSION,
        sheetKey,
        rows: {},
        updatedAt: new Date(0).toISOString(),
      } satisfies MeasurementConfigPayload);
    }

    const configPath = path.join(configDirectory, makeFileName(sheetKey));

    try {
      const raw = await fs.readFile(configPath, "utf-8");
      const payload = JSON.parse(raw) as MeasurementConfigPayload;
      return NextResponse.json(payload);
    } catch {
      return NextResponse.json({
        schemaVersion: SCHEMA_VERSION,
        sheetKey,
        rows: {},
        updatedAt: new Date(0).toISOString(),
      } satisfies MeasurementConfigPayload);
    }
  } catch (error) {
    console.error("Failed to read measurement config", error);
    return NextResponse.json(
      { error: "Failed to read measurement config" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ projectId: string }> },
) {
  try {
    const { projectId } = await context.params;
    const querySheetKey = sanitizeSheetKey(request.nextUrl.searchParams.get("sheetKey"));
    const body = (await request.json()) as Partial<MeasurementConfigPayload>;
    const sheetKey = sanitizeSheetKey(body.sheetKey ?? querySheetKey);
    const rows = body.rows ?? {};

    const payload: MeasurementConfigPayload = {
      schemaVersion: SCHEMA_VERSION,
      sheetKey,
      rows,
      updatedAt: new Date().toISOString(),
    };

    const configDirectory = await resolveMeasurementsConfigDirectory(projectId);
    if (!configDirectory) {
      return NextResponse.json(
        { error: "Project state directory not found" },
        { status: 404 },
      );
    }

    const configPath = path.join(configDirectory, makeFileName(sheetKey));
    await fs.writeFile(configPath, JSON.stringify(payload, null, 2), "utf-8");

    return NextResponse.json(payload);
  } catch (error) {
    console.error("Failed to save measurement config", error);
    return NextResponse.json(
      { error: "Failed to save measurement config" },
      { status: 500 },
    );
  }
}
