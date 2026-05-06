import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { resolveShareDirectory } from "@/lib/runtime/share-directory";

type DispatchRecord = {
  id: string;
  trainingId: string;
  sentBy: string;
  sentAt: string;
  badges: string[];
  note?: string;
};

async function getDispatchPath() {
  const share = await resolveShareDirectory();
  return path.join(share, "training", "dispatch-log.json");
}

async function readDispatches(filePath: string): Promise<DispatchRecord[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as DispatchRecord[]) : [];
  } catch {
    return [];
  }
}

async function writeDispatches(filePath: string, rows: DispatchRecord[]) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(rows, null, 2), "utf-8");
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filePath = await getDispatchPath();
  const rows = await readDispatches(filePath);
  return NextResponse.json({ dispatches: rows.filter((row) => row.trainingId === id) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await request.json()) as { badges?: string[]; sentBy?: string; note?: string };
  const badges = Array.isArray(body.badges)
    ? body.badges.map((badge) => String(badge).trim()).filter(Boolean)
    : [];

  if (!badges.length) {
    return NextResponse.json({ error: "At least one badge is required." }, { status: 400 });
  }

  const filePath = await getDispatchPath();
  const rows = await readDispatches(filePath);
  const now = new Date().toISOString();
  const next: DispatchRecord = {
    id: `dispatch-${Date.now()}`,
    trainingId: id,
    sentBy: body.sentBy?.trim() || "unknown",
    sentAt: now,
    badges,
    note: body.note?.trim() || undefined,
  };
  rows.unshift(next);
  await writeDispatches(filePath, rows);
  return NextResponse.json({ success: true, dispatch: next });
}
