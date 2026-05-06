import { describe, expect, it } from "vitest";

import {
  buildBrandingRowGroupKey,
  buildBrandingRowGroupLabel,
  buildBrandListExportSchema,
  computeBrandListSchemaHash,
  normalizeExternalAssignmentTitle,
} from "./schema";

describe("brand-list schema hashing", () => {
  it("changes when persisted row content changes", () => {
    const baseSchema = buildBrandListExportSchema({
      sheetSlug: "sheet-a",
      sheetName: "JB74",
      brandingVisibleSections: [],
      sectionColumnVisibility: {},
      projectInfo: {
        projectNumber: "4L101",
        projectName: "PROP-99",
        revision: "C.4",
      },
    });

    const editedSchema = {
      ...baseSchema,
      prefixGroups: [
        {
          prefix: "AF",
          bundles: [
            {
              bundleName: "AF0410",
              toLocation: "JB74",
              rows: [
                {
                  rowId: "row-1",
                  rowIndex: 1,
                  fromDeviceId: "AF0410:55",
                  wireNo: "1",
                  wireId: "BK",
                  gaugeSize: "16",
                  length: 70,
                  toDeviceId: "AF0420:55",
                  toLocation: "JB74",
                  bundleName: "AF0410",
                  bundleDisplay: "AF0410",
                  devicePrefix: "AF",
                },
              ],
            },
          ],
        },
      ],
      totalRows: 1,
    };

    const baseHash = computeBrandListSchemaHash(baseSchema);
    const editedHash = computeBrandListSchemaHash(editedSchema);

    expect(baseSchema.schemaHash).toBe(baseHash);
    expect(editedHash).not.toBe(baseHash);
  });
});

describe("branding row grouping", () => {
  it("uses gauge and color in the group key without adding them to the visible bundle label", () => {
    expect(
      buildBrandingRowGroupKey({
        bundleName: "KA0100",
        toLocation: "JB70",
        gaugeSize: "16",
        wireColor: "RED",
      }),
    ).not.toBe(
      buildBrandingRowGroupKey({
        bundleName: "KA0100",
        toLocation: "JB70",
        gaugeSize: "14",
        wireColor: "RED",
      }),
    );

    expect(
      buildBrandingRowGroupLabel({
        bundleName: "KA0100",
        toLocation: "JB70",
        currentSheetName: "JB70",
      }),
    ).toBe("KA0100");
  });

  it("adds the normalized assignment title for external bundle labels without the unit prefix", () => {
    expect(normalizeExternalAssignmentTitle("JB71 B,PNL VIBRATION")).toBe("B - PNL VIBRATION");

    expect(
      buildBrandingRowGroupLabel({
        bundleName: "XT - XT",
        toLocation: "JB71 B,PNL VIBRATION",
        currentSheetName: "JB71 B,PNL CUSTOMER",
      }),
    ).toBe("XT - XT - B - PNL VIBRATION");
  });

  it("collapses multi-row termination bundle labels to the base device id", () => {
    const schema = buildBrandListExportSchema({
      sheetSlug: "jb71",
      sheetName: "JB71",
      sectionColumnVisibility: {},
      brandingVisibleSections: [
        {
          group: {
            location: "JB71",
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
              row: {
                __rowId: "row1",
                __rowIndex: 1,
                fromDeviceId: "KA0100:A1",
                wireNo: "101",
                wireId: "RD",
                wireType: "WIRE",
                gaugeSize: "16",
                fromLocation: "JB71",
                fromPageZone: "A1",
                toDeviceId: "XT0100:1",
                toLocation: "JB71",
                toPageZone: "A2",
              },
              location: "JB71",
              isExternal: false,
              isManual: false,
              measurement: 12,
            },
            {
              row: {
                __rowId: "row2",
                __rowIndex: 2,
                fromDeviceId: "KA0100:A2",
                wireNo: "102",
                wireId: "RD",
                wireType: "WIRE",
                gaugeSize: "16",
                fromLocation: "JB71",
                fromPageZone: "A1",
                toDeviceId: "XT0100:2",
                toLocation: "JB71",
                toPageZone: "A2",
              },
              location: "JB71",
              isExternal: false,
              isManual: false,
              measurement: 13,
            },
          ],
        },
      ],
    });

    expect(schema.prefixGroups).toHaveLength(1);
    expect(schema.prefixGroups[0].bundles).toHaveLength(1);
    expect(schema.prefixGroups[0].bundles[0].bundleName).toBe("KA0100");
    expect(schema.prefixGroups[0].bundles[0].rows).toHaveLength(2);
    expect(schema.prefixGroups[0].bundles[0].rows.map((row) => row.bundleDisplay)).toEqual(["KA0100", ""]);
    expect(schema.importHints.bundleNames).toEqual(["KA0100"]);
    expect(schema.importHints.bundleDisplays).toEqual(["KA0100"]);
  });

  it("splits same-device RED and BLU rows into color bundle sections", () => {
    const schema = buildBrandListExportSchema({
      sheetSlug: "jb71",
      sheetName: "JB71",
      sectionColumnVisibility: {},
      brandingVisibleSections: [
        {
          group: {
            location: "JB71",
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
              row: {
                __rowId: "red",
                __rowIndex: 1,
                fromDeviceId: "AT01322:A1",
                wireNo: "101",
                wireId: "RED",
                wireType: "WIRE",
                gaugeSize: "16",
                fromLocation: "JB71",
                fromPageZone: "A1",
                toDeviceId: "XT0100:1",
                toLocation: "JB71",
                toPageZone: "A2",
              },
              location: "JB71",
              isExternal: false,
              isManual: false,
              measurement: 12,
            },
            {
              row: {
                __rowId: "blu",
                __rowIndex: 2,
                fromDeviceId: "AT01322:A2",
                wireNo: "102",
                wireId: "BLU",
                wireType: "WIRE",
                gaugeSize: "16",
                fromLocation: "JB71",
                fromPageZone: "A1",
                toDeviceId: "XT0100:2",
                toLocation: "JB71",
                toPageZone: "A2",
              },
              location: "JB71",
              isExternal: false,
              isManual: false,
              measurement: 13,
            },
          ],
        },
      ],
    });

    expect(schema.prefixGroups[0].bundles.map((bundle) => bundle.bundleName)).toEqual([
      "AT01322 - RED",
      "AT01322 - BLU",
    ]);
    expect(schema.prefixGroups[0].bundles.map((bundle) => bundle.rows[0].bundleDisplay)).toEqual([
      "AT01322 - RED",
      "AT01322 - BLU",
    ]);
    expect(schema.importHints.bundleDisplays).toEqual(["AT01322 - RED", "AT01322 - BLU"]);
  });

  it("derives a device bundle name when no render subgroup header exists", () => {
    const schema = buildBrandListExportSchema({
      sheetSlug: "jb71",
      sheetName: "JB71",
      sectionColumnVisibility: {},
      brandingVisibleSections: [
        {
          group: {
            location: "JB71",
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
              row: {
                __rowId: "af1",
                __rowIndex: 1,
                fromDeviceId: "AF0074:COM",
                wireNo: "-0V",
                wireId: "WHT",
                wireType: "WIRE",
                gaugeSize: "14",
                fromLocation: "JB71",
                fromPageZone: "A1",
                toDeviceId: "XT0070:6",
                toLocation: "JB71",
                toPageZone: "A2",
              },
              location: "JB71",
              isExternal: false,
              isManual: false,
              measurement: 60,
            },
            {
              row: {
                __rowId: "af2",
                __rowIndex: 2,
                fromDeviceId: "AF0074:V+",
                wireNo: "FU0072",
                wireId: "WHT",
                wireType: "WIRE",
                gaugeSize: "14",
                fromLocation: "JB71",
                fromPageZone: "A1",
                toDeviceId: "FU0072:LD",
                toLocation: "JB71",
                toPageZone: "A2",
              },
              location: "JB71",
              isExternal: false,
              isManual: false,
              measurement: 60,
            },
          ],
        },
      ],
    });

    expect(schema.prefixGroups[0].bundles).toHaveLength(1);
    expect(schema.prefixGroups[0].bundles[0].bundleName).toBe("AF0074");
    expect(schema.prefixGroups[0].bundles[0].rows.map((row) => row.bundleDisplay)).toEqual(["AF0074", ""]);
  });
});
