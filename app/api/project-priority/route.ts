import { NextRequest, NextResponse } from "next/server";

import {
  readProjectPriorityQueueStore,
  writeProjectPriorityQueueStore,
} from "@/lib/projects/priority-queue-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await readProjectPriorityQueueStore();
  return NextResponse.json({ manualOrder: store.manualOrder, updatedAt: store.updatedAt });
}

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      manualOrder?: unknown;
    };

    if (!Array.isArray(body.manualOrder)) {
      return NextResponse.json(
        { error: "manualOrder array is required" },
        { status: 422 },
      );
    }

    const store = await writeProjectPriorityQueueStore(
      body.manualOrder.filter((value): value is string => typeof value === "string"),
    );

    return NextResponse.json({ manualOrder: store.manualOrder, updatedAt: store.updatedAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update project priority order";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
