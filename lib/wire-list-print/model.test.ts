import { describe, expect, it } from "vitest";

import type { SemanticWireListRow } from "@/lib/workbook/types";
import {
  buildBrandingCsvContent,
  buildDefaultBrandingHiddenSections,
  buildPrintPreviewPageCount,
  buildProcessedPrintLocationGroups,
  buildVisiblePreviewSections,
  resolveActiveHiddenSections,
  sortRowsForPrintSubsection,
  sortRowsForDeviceGroupedPreview,
  type PrintLocationGroup,
} from "@/lib/wire-list-print/model";
import type { BlueLabelSequenceMap } from "@/lib/wiring-identification/types";

function makeRow(overrides: Partial<SemanticWireListRow>): SemanticWireListRow {
  return {
    __rowIndex: 1,
    __rowId: overrides.__rowId ?? "row-1",
    fromDeviceId: overrides.fromDeviceId ?? "TB1:1",
    wireType: overrides.wireType ?? "WIRE",
    wireNo: overrides.wireNo ?? "1",
    wireId: overrides.wireId ?? "BK",
    gaugeSize: overrides.gaugeSize ?? "16",
    fromLocation: overrides.fromLocation ?? "UNIT1",
    fromPageZone: overrides.fromPageZone ?? "A1",
    toDeviceId: overrides.toDeviceId ?? "TB2:1",
    toLocation: overrides.toLocation ?? "UNIT1",
    toPageZone: overrides.toPageZone ?? "A2",
    location: overrides.location,
  };
}

describe("wire-list print model", () => {
  it("hides non-single-connection sections by default in branding mode", () => {
    const groups: PrintLocationGroup[] = [
      {
        location: "UNIT1",
        isExternal: false,
        totalRows: 4,
        subsections: [
          { label: "Grounds", rows: [makeRow({ __rowId: "g-1" })], sectionKind: "grounds" },
          { label: "Single Connections", rows: [makeRow({ __rowId: "s-1" })], sectionKind: "single_connections" },
          { label: "Cables", rows: [makeRow({ __rowId: "c-1" })], sectionKind: "cables" },
        ],
      },
    ];

    expect(Array.from(buildDefaultBrandingHiddenSections(groups))).toEqual(["0-0", "0-2"]);
  });

  it("resolves branding hidden sections from defaults unless customized", () => {
    const defaultHidden = new Set(["0-0", "0-2"]);

    expect(
      Array.from(
        resolveActiveHiddenSections({
          mode: "branding",
          standardHiddenSections: new Set(["loc-0"]),
          brandingHiddenSections: new Set(["0-1"]),
          brandingHiddenSectionsCustomized: false,
          defaultBrandingHiddenSections: defaultHidden,
        }),
      ),
    ).toEqual(["0-0", "0-2"]);

    expect(
      Array.from(
        resolveActiveHiddenSections({
          mode: "branding",
          standardHiddenSections: new Set(["loc-0"]),
          brandingHiddenSections: new Set(["0-1"]),
          brandingHiddenSectionsCustomized: true,
          defaultBrandingHiddenSections: defaultHidden,
        }),
      ),
    ).toEqual(["0-1"]);
  });

  it("filters hidden sections and keeps visible rows for preview", () => {
    const groups: PrintLocationGroup[] = [
      {
        location: "UNIT1",
        isExternal: false,
        totalRows: 2,
        subsections: [
          { label: "Single Connections", rows: [makeRow({ __rowId: "r-1" })], sectionKind: "single_connections" },
          { label: "Cables", rows: [makeRow({ __rowId: "r-2" })], sectionKind: "cables" },
        ],
      },
    ];

    const visible = buildVisiblePreviewSections(groups, new Set(["0-1"]), {});

    expect(visible).toHaveLength(1);
    expect(visible[0]?.group.location).toBe("UNIT1");
    expect(visible[0]?.subsection.label).toBe("Single Connections");
    expect(visible[0]?.visibleRows.map((row) => row.__rowId)).toEqual(["r-1"]);
  });

  it("calculates print preview page counts from the enabled pages", () => {
    expect(
      buildPrintPreviewPageCount({
        mode: "standardize",
        processedLocationGroups: [{ location: "UNIT1", isExternal: false, totalRows: 61, subsections: [] }],
        showFeedbackSection: true,
        showCoverPage: true,
        showTableOfContents: true,
        showIPVCodes: true,
      }),
    ).toBe(7);

    expect(
      buildPrintPreviewPageCount({
        mode: "branding",
        processedLocationGroups: [],
        showFeedbackSection: false,
        showCoverPage: false,
        showTableOfContents: false,
        showIPVCodes: false,
      }),
    ).toBe(1);
  });

  it("keeps current-sheet single-connection groups ahead of external groups", () => {
    const rows = sortRowsForDeviceGroupedPreview(
      [
        makeRow({ __rowId: "external", fromDeviceId: "KA2:A1", toDeviceId: "TB2:1", fromLocation: "REMOTE", toLocation: "REMOTE", wireNo: "2" }),
        makeRow({ __rowId: "local", fromDeviceId: "KA1:A1", toDeviceId: "TB1:1", fromLocation: "UNIT1", toLocation: "UNIT1", wireNo: "1" }),
      ],
      "UNIT1",
      false,
      new Map([
        ["KA1", { partNumber: "1061979-1", description: "Relay", location: "UNIT1" }],
        ["KA2", { partNumber: "1061979-1", description: "Relay", location: "REMOTE" }],
      ]),
    );

    expect(rows.map((row) => row.__rowId)).toEqual(["local", "external"]);
  });

  it("can sort single connections by the current sheet blue label sequence", () => {
    const blueLabels: BlueLabelSequenceMap = {
      isValid: true,
      warnings: [],
      deviceMap: new Map(),
      sheetSequences: new Map([
        ["UNIT1", ["KA2", "KA1", "KA3"]],
      ]),
    };

    const rows = sortRowsForPrintSubsection(
      [
        makeRow({ __rowId: "ka1", fromDeviceId: "KA1:A1" }),
        makeRow({ __rowId: "ka3", fromDeviceId: "KA3:A1" }),
        makeRow({ __rowId: "ka2", fromDeviceId: "KA2:A1" }),
      ],
      "UNIT1",
      "single_connections",
      {},
      null,
      blueLabels,
      "blue-label-sequence",
    );

    expect(rows.map((row) => row.__rowId)).toEqual(["ka2", "ka1", "ka3"]);
  });

  it("uses device id subgroups for Blue Label sequence single connections", () => {
    const blueLabels: BlueLabelSequenceMap = {
      isValid: true,
      warnings: [],
      deviceMap: new Map(),
      sheetSequences: new Map([
        ["UNIT1", ["KA2", "KA1", "KA3"]],
      ]),
    };

    const groups = buildProcessedPrintLocationGroups({
      rows: [
        makeRow({ __rowId: "ka1", fromDeviceId: "KA1:A1" }),
        makeRow({ __rowId: "ka3", fromDeviceId: "KA3:A1" }),
        makeRow({ __rowId: "ka2", fromDeviceId: "KA2:A1" }),
      ],
      mode: "standardize",
      enabledSections: ["single_connections"],
      sectionOrder: ["single_connections"],
      currentSheetName: "UNIT1",
      blueLabels,
      sortMode: "blue-label-sequence",
    });

    const subsection = groups[0]?.subsections[0];
    expect(subsection?.rows.map((row) => row.__rowId)).toEqual(["ka2", "ka1", "ka3"]);
    expect(subsection?.deviceToDeviceSubsections?.map((entry) => entry.label)).toEqual(["KA2", "KA1", "KA3"]);
  });

  it("does not split Blue Label sequence print groups by location", () => {
    const blueLabels: BlueLabelSequenceMap = {
      isValid: true,
      warnings: [],
      deviceMap: new Map(),
      sheetSequences: new Map([
        ["UNIT1", ["KA2", "KA1", "KA3"]],
      ]),
    };

    const groups = buildProcessedPrintLocationGroups({
      rows: [
        makeRow({ __rowId: "ka1", fromDeviceId: "KA1:A1", fromLocation: "REMOTE-A", toLocation: "REMOTE-A" }),
        makeRow({ __rowId: "ka2", fromDeviceId: "KA2:A1", fromLocation: "UNIT1", toLocation: "UNIT1" }),
        makeRow({ __rowId: "ka3", fromDeviceId: "KA3:A1", fromLocation: "REMOTE-B", toLocation: "REMOTE-B" }),
      ],
      mode: "standardize",
      enabledSections: ["single_connections"],
      sectionOrder: ["single_connections"],
      currentSheetName: "UNIT1",
      blueLabels,
      sortMode: "blue-label-sequence",
    });

    expect(groups).toHaveLength(1);
    expect(groups[0].subsections).toHaveLength(1);
    expect(groups[0].subsections[0].rows.map((row) => row.__rowId)).toEqual(["ka2", "ka1", "ka3"]);
    expect(groups[0].subsections[0].deviceToDeviceSubsections?.map((entry) => entry.label)).toEqual(["KA2", "KA1", "KA3"]);
  });

  it("prints one branding CSV bundle label for multi-row termination groups", () => {
    const csv = buildBrandingCsvContent({
      currentSheetName: "UNIT1",
      sectionColumnVisibility: {},
      brandingVisibleSections: [
        {
          group: {
            location: "UNIT1",
            isExternal: false,
            subsections: [],
            totalRows: 2,
          },
          subsection: {
            label: "KA Twin Ferrules",
            sectionKind: "ka_twin_ferrules",
            rows: [],
            matchMetadata: {
              row1: {
                matchType: "ka_twin_ferrules",
                badge: "KA Twin Ferrule",
                meta: {
                  groupKey: "KA0100:A1:101",
                  deviceId: "KA0100",
                  terminal: "A1",
                  wireNo: "101",
                },
              },
              row2: {
                matchType: "ka_twin_ferrules",
                badge: "KA Twin Ferrule",
                meta: {
                  groupKey: "KA0100:A2:102",
                  deviceId: "KA0100",
                  terminal: "A2",
                  wireNo: "102",
                },
              },
            },
          },
          rows: [
            {
              row: makeRow({
                __rowId: "row1",
                __rowIndex: 1,
                fromDeviceId: "KA0100:A1",
                wireNo: "101",
                wireId: "RD",
                gaugeSize: "16",
                toDeviceId: "XT0100:1",
              }),
              location: "UNIT1",
              isExternal: false,
              isManual: false,
              measurement: 12,
            },
            {
              row: makeRow({
                __rowId: "row2",
                __rowIndex: 2,
                fromDeviceId: "KA0100:A2",
                wireNo: "102",
                wireId: "RD",
                gaugeSize: "16",
                toDeviceId: "XT0100:2",
              }),
              location: "UNIT1",
              isExternal: false,
              isManual: false,
              measurement: 13,
            },
          ],
        },
      ],
    });

    expect(csv.split("\n").filter((line) => line.endsWith(",KA0100"))).toHaveLength(1);
    expect(csv).not.toContain("KA0100:A1 / 101");
    expect(csv).not.toContain("KA0100:A2 / 102");
  });

  it("separates same-device RED and BLU branding CSV bundles with an empty row", () => {
    const csv = buildBrandingCsvContent({
      currentSheetName: "UNIT1",
      sectionColumnVisibility: {},
      brandingVisibleSections: [
        {
          group: {
            location: "UNIT1",
            isExternal: false,
            subsections: [],
            totalRows: 2,
          },
          subsection: {
            label: "KA Twin Ferrules",
            sectionKind: "ka_twin_ferrules",
            rows: [],
            matchMetadata: {
              red: {
                matchType: "ka_twin_ferrules",
                badge: "KA Twin Ferrule",
                meta: {
                  groupKey: "AT01322:A1:101",
                  deviceId: "AT01322",
                  terminal: "A1",
                  wireNo: "101",
                },
              },
              blu: {
                matchType: "ka_twin_ferrules",
                badge: "KA Twin Ferrule",
                meta: {
                  groupKey: "AT01322:A2:102",
                  deviceId: "AT01322",
                  terminal: "A2",
                  wireNo: "102",
                },
              },
            },
          },
          rows: [
            {
              row: makeRow({
                __rowId: "red",
                __rowIndex: 1,
                fromDeviceId: "AT01322:A1",
                wireNo: "101",
                wireId: "RED",
                gaugeSize: "16",
                toDeviceId: "XT0100:1",
              }),
              location: "UNIT1",
              isExternal: false,
              isManual: false,
              measurement: 12,
            },
            {
              row: makeRow({
                __rowId: "blu",
                __rowIndex: 2,
                fromDeviceId: "AT01322:A2",
                wireNo: "102",
                wireId: "BLU",
                gaugeSize: "16",
                toDeviceId: "XT0100:2",
              }),
              location: "UNIT1",
              isExternal: false,
              isManual: false,
              measurement: 13,
            },
          ],
        },
      ],
    });
    const lines = csv.split("\n");
    const redLineIndex = lines.findIndex((line) => line.endsWith(",AT01322 - RED"));
    const bluLineIndex = lines.findIndex((line) => line.endsWith(",AT01322 - BLU"));

    expect(redLineIndex).toBeGreaterThan(-1);
    expect(bluLineIndex).toBeGreaterThan(redLineIndex);
    expect(lines.slice(redLineIndex + 1, bluLineIndex)).toContain(",,,,,,,");
  });

  it("prints derived device bundle names for CSV rows without subgroup headers", () => {
    const csv = buildBrandingCsvContent({
      currentSheetName: "UNIT1",
      sectionColumnVisibility: {},
      brandingVisibleSections: [
        {
          group: {
            location: "UNIT1",
            isExternal: false,
            subsections: [],
            totalRows: 2,
          },
          subsection: {
            label: "Ungrouped",
            rows: [],
          },
          rows: [
            {
              row: makeRow({
                __rowId: "af1",
                __rowIndex: 1,
                fromDeviceId: "AF0074:COM",
                wireNo: "-0V",
                wireId: "WHT",
                gaugeSize: "14",
                toDeviceId: "XT0070:6",
              }),
              location: "UNIT1",
              isExternal: false,
              isManual: false,
              measurement: 60,
            },
            {
              row: makeRow({
                __rowId: "af2",
                __rowIndex: 2,
                fromDeviceId: "AF0074:V+",
                wireNo: "FU0072",
                wireId: "WHT",
                gaugeSize: "14",
                toDeviceId: "FU0072:LD",
              }),
              location: "UNIT1",
              isExternal: false,
              isManual: false,
              measurement: 60,
            },
          ],
        },
      ],
    });

    expect(csv.split("\n").filter((line) => line.endsWith(",AF0074"))).toHaveLength(1);
  });
});
