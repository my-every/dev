import { describe, expect, it } from "vitest";

import type { PrintLocationGroup } from "../wire-list-print/model";
import { buildWireListSheetWorkspaceDocument } from "./build-sheet-document";

const internalRow = {
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
};

const externalRow = {
  __rowIndex: 2,
  __rowId: "row-2",
  fromDeviceId: "XT1:1",
  wireType: "WIRE",
  wireNo: "2",
  wireId: "RD",
  gaugeSize: "14",
  fromLocation: "EXT-A",
  fromPageZone: "B1",
  toDeviceId: "XT2:1",
  toLocation: "EXT-B",
  toPageZone: "B2",
  location: "EXT-A",
};

describe("buildWireListSheetWorkspaceDocument", () => {
  it("splits standard wire-list and cross-wire sections from the same shared document", () => {
    const processedLocationGroups: PrintLocationGroup[] = [
      {
        location: "UNIT1",
        isExternal: false,
        totalRows: 1,
        subsections: [
          {
            label: "CONTROL PANEL",
            rows: [internalRow],
          },
        ],
      },
      {
        location: "EXT-A",
        isExternal: true,
        totalRows: 1,
        subsections: [
          {
            label: "FIELD",
            rows: [externalRow],
          },
        ],
      },
    ];

    const document = buildWireListSheetWorkspaceDocument({
      sheetTitle: "Wire List",
      currentSheetName: "UNIT1",
      previewPageCount: 4,
      processedLocationGroups,
      activeHiddenSections: new Set(),
      sectionColumnVisibility: {},
      crossWireSections: new Set(["loc-1"]),
      rowLengthsById: {
        "row-1": { display: '24"', roundedInches: 24, confidence: "high" },
        "row-2": { display: '36"', roundedInches: 36, confidence: "high" },
      },
    });

    expect(document.standardSections).toHaveLength(2);
    expect(document.wireListSections).toHaveLength(1);
    expect(document.wireListSections[0]?.group.location).toBe("UNIT1");
    expect(document.crossWireSections).toHaveLength(1);
    expect(document.crossWireSections[0]?.group.location).toBe("EXT-A");
    expect(document.standardTable.totalRows).toBe(2);
    const externalStandardRow = document.standardTable.rows.find((row) => row.rowId === "row-2");
    expect(externalStandardRow?.fromLocation).toBe("UNIT1");
    expect(externalStandardRow?.toLocation).toBe("EXT-B");
  });
});
