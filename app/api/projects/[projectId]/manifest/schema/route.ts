import { NextRequest, NextResponse } from "next/server";

import { readProjectManifest } from "@/lib/project-state/share-project-state-handlers";

export const dynamic = "force-dynamic";

/**
 * Returns the field-level schema descriptor used by the Engineer UI
 * to know which fields are editable, their types, and constraints.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const manifest = await readProjectManifest(projectId);
  if (!manifest) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  return NextResponse.json({
    projectFields: [
      { path: "name", label: "Project Name", type: "text", editable: true, maxLength: 200 },
      { path: "unitNumber", label: "Unit Number", type: "text", editable: true, maxLength: 50 },
      { path: "revision", label: "Revision", type: "text", editable: true, maxLength: 50 },
      { path: "lwcType", label: "LWC Type", type: "select", editable: true },
      { path: "color", label: "Color", type: "color", editable: true },
      { path: "status", label: "Status", type: "text", editable: true },
      { path: "dueDate", label: "Due Date", type: "date", editable: true },
      { path: "shipDate", label: "Ship Date", type: "date", editable: true },
      { path: "planConlayDate", label: "Plan ConLay", type: "date", editable: true },
      { path: "planConassyDate", label: "Plan ConAssy", type: "date", editable: true },
      { path: "id", label: "Project ID", type: "text", editable: false, locked: true, lockedReason: "System-generated identifier" },
      { path: "filename", label: "Source File", type: "text", editable: false, locked: true, lockedReason: "Set by workbook upload" },
      { path: "createdAt", label: "Created At", type: "datetime", editable: false, locked: true, lockedReason: "System timestamp" },
      { path: "pdNumber", label: "PD Number", type: "text", editable: false, locked: true, lockedReason: "Project identity — immutable after creation" },
    ],
    assignmentFields: [
      { path: "stage", label: "Stage", type: "select", editable: true },
      { path: "status", label: "Status", type: "select", editable: true },
      { path: "swsType", label: "SWS Type", type: "select", editable: true },
      { path: "unitType", label: "Unit Type", type: "text", editable: true },
      { path: "boxSide", label: "Box Side", type: "select", editable: true, nullable: true },
      { path: "linkedOperationCode", label: "Linked Op Code", type: "text", editable: true, nullable: true },
      { path: "defaultOperationCodeByStage", label: "Op Codes by Stage", type: "map", editable: true },
      { path: "rowCount", label: "Row Count", type: "number", editable: false, locked: true, lockedReason: "Parsed from workbook" },
      { path: "layout", label: "Layout Match", type: "object", editable: false, locked: true, lockedReason: "Server-computed layout match" },
      { path: "priority", label: "Priority", type: "object", editable: false, locked: true, lockedReason: "Server-computed from deadline and stage" },
      { path: "partNumbers", label: "Part Numbers", type: "array", editable: false, locked: true, lockedReason: "Extracted from device catalog" },
    ],
    boardAssignmentFields: [
      { path: "assignedBadge", label: "Assigned Badge", type: "text", editable: true, nullable: true },
      { path: "workAreaId", label: "Work Area", type: "text", editable: true, nullable: true },
      { path: "floorArea", label: "Floor Area", type: "text", editable: true, nullable: true },
      { path: "shiftId", label: "Shift", type: "select", editable: true, options: ["1st", "2nd"], nullable: true },
      { path: "scheduledDate", label: "Scheduled Date", type: "date", editable: true, nullable: true },
      { path: "startTime", label: "Start Time", type: "text", editable: true, nullable: true },
      { path: "endTime", label: "End Time", type: "text", editable: true, nullable: true },
      { path: "queueIndex", label: "Queue Index", type: "number", editable: true, nullable: true },
      { path: "assignmentGroupId", label: "Assignment Group", type: "text", editable: true, nullable: true },
      { path: "operationCode", label: "Operation Code", type: "text", editable: true, nullable: true },
      { path: "workflowStatus", label: "Workflow Status", type: "select", editable: true, options: ["pending", "scheduled", "in-progress", "completed"] },
      { path: "assignmentId", label: "Assignment ID", type: "text", editable: false, locked: true, lockedReason: "System-generated composite key" },
    ],
  });
}
