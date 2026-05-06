import { NextResponse } from "next/server";

import { resolveShareDirectory } from "@/lib/runtime/share-directory";
import { getSlotProjectsUploadStatuses } from "@/lib/project-schedule/slots-project-seeding";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const shareRoot = await resolveShareDirectory();
    const statuses = await getSlotProjectsUploadStatuses(shareRoot);

    return NextResponse.json({
      rows: statuses,
      count: statuses.length,
      source: "SLOTS.json",
      importedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to build slot project seed statuses", error);
    return NextResponse.json(
      { error: "Failed to build slot project seed statuses" },
      { status: 500 },
    );
  }
}
