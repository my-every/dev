import { afterEach, describe, expect, it } from "vitest";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { buildShareProjectFolderName } from "../project-state/share-project-state-handlers";
import { buildProjectSheetPrintDocument } from "./build-project-sheet-print-document";

const projectId = "vitest-print-project";
const projectName = "Vitest Print Project";
const pdNumber = "P1234";
const sheetSlug = "unit1";
const projectRoot = path.join(process.cwd(), "Share", "Projects", buildShareProjectFolderName(pdNumber, projectName));
const stateRoot = path.join(projectRoot, "state");
const assignmentSwsRoot = path.join(stateRoot, "assignment-sws");
const sheetsRoot = path.join(stateRoot, "sheets");

afterEach(async () => {
  await rm(projectRoot, { recursive: true, force: true });
});

describe("buildProjectSheetPrintDocument", () => {
  it("rebuilds a print document from persisted project and sheet state", async () => {
    await mkdir(assignmentSwsRoot, { recursive: true });
    await mkdir(sheetsRoot, { recursive: true });

    const semanticRows = [
      {
        __rowIndex: 1,
        __rowId: "row-1",
        fromDeviceId: "TB1:1",
        wireType: "WIRE",
        wireNo: "1",
        wireId: "BK",
        gaugeSize: "16",
        fromLocation: "UNIT1",
        fromPageZone: "A1",
        toDeviceId: "TB2:1",
        toLocation: "UNIT1",
        toPageZone: "A2",
        location: "UNIT1",
      },
    ];

    await writeFile(
      path.join(stateRoot, "project-manifest.json"),
      JSON.stringify({
        id: projectId,
        name: projectName,
        filename: "demo.xlsx",
        pdNumber,
        unitNumber: "U1",
        revision: "A",
        lwcType: "NEW/FLEX",
        color: "#f4b400",
        unitType: "UNIT1",
        unitTypes: ["UNIT1"],
        createdAt: new Date().toISOString(),
        dueDate: new Date().toISOString(),
        planConlayDate: new Date().toISOString(),
        planConassyDate: new Date().toISOString(),
        sheets: [
          {
            slug: sheetSlug,
            name: "UNIT1",
            kind: "operational",
            sheetPath: `state/sheets/${sheetSlug}.json`,
            rowCount: 1,
            columnCount: 10,
            sheetIndex: 0,
            hasData: true,
          },
        ],
        assignments: {},
        panducts: 0,
        rails: 0,
      }, null, 2),
      "utf-8",
    );

    await writeFile(
      path.join(sheetsRoot, `${sheetSlug}.json`),
      JSON.stringify({
        slug: sheetSlug,
        name: "UNIT1",
        kind: "operational",
        sheetIndex: 0,
        headers: [],
        rows: semanticRows,
        rawRows: [],
        rowCount: 1,
        metadata: {},
        assignment: {
          swsType: "PANEL",
          stage: "build_up",
          status: "NOT_STARTED",
          isOverride: false,
          overrideReason: "",
          detectedSwsType: "PANEL",
          detectedConfidence: 1,
          detectedReasons: [],
          requiresWireSws: false,
          requiresCrossWireSws: false,
        },
        warnings: [],
        generatedAt: new Date().toISOString(),
      }, null, 2),
      "utf-8",
    );

    await writeFile(
      path.join(assignmentSwsRoot, `${encodeURIComponent(sheetSlug)}.json`),
      JSON.stringify({
        templateId: "PANEL_BUILD_WIRE",
        isManualOverride: false,
        sectionOverrides: {},
        sectionOrder: [],
        sectionEdits: {},
        workElementEdits: {},
        components: [],
        worksheetMetadata: {},
        printOverrides: {},
        printOverridesAudit: [],
        executionState: {
          activeMode: "PRINT_MANUAL",
          sectionStates: [],
        },
        workspaceState: {
          rowPatches: [],
          workflow: {
            "row-1": { comment: "verify termination" },
          },
          columnVisibility: {},
          columnOrder: {},
          brandingEdits: {
            "row-1": { wireNo: "1", length: 42 },
          },
          revisionSelection: { wireListFilename: null, layoutFilename: null },
          patchHistory: { past: [], future: [], maxSize: 50 },
        },
        instanceVersion: 1,
        linkedOperationCode: null,
        defaultOperationCodeByStage: {},
        reviewStatus: "pending",
        exportReviews: [],
      }, null, 2),
      "utf-8",
    );

    const document = await buildProjectSheetPrintDocument({
      projectId,
      sheetSlug,
      settings: {
        mode: "branding",
        showCoverPage: false,
        showTableOfContents: false,
        showIPVCodes: false,
      },
    });

    expect(document).not.toBeNull();
    expect(document?.currentSheetName).toBe("UNIT1");
    expect(document?.projectInfo.projectName).toBe(projectName);
    expect(document?.comments).toEqual({ "row-1": "verify termination" });
    expect(document?.brandingVisibleSections?.flatMap((section) => section.rows).map((row) => row.measurement)).toContain(60);
    expect(document?.sheetDocument?.wireListSections).toHaveLength(1);
    expect(document?.sheetDocument?.crossWireSections).toHaveLength(0);
    expect(document?.sheetDocument?.brandTable.totalRows).toBeGreaterThan(0);
  }, 15000);
});
