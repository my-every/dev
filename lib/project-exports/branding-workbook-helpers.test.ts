import XLSX from "xlsx-js-style";
import { describe, expect, it } from "vitest";

import type { BrandListExportSchema } from "@/lib/wire-brand-list/schema";

import { appendBrandWorkbookSupportSheets } from "./branding-workbook-helpers";

function buildSchema(overrides: Partial<BrandListExportSchema> = {}): BrandListExportSchema {
  return {
    schemaVersion: 1,
    generatedAt: "2026-05-01T00:00:00.000Z",
    mode: "branding-export",
    schemaHash: "hash-1",
    sheetSlug: "jb71-b-pnl-customer",
    sheetName: "JB71 B,PNL CUSTOMER",
    totalRows: 0,
    header: {
      locationTitle: "JB71 B,PNL CUSTOMER",
      fromLabel: "From",
      toLabel: "To",
      columns: [
        "Device ID",
        "Wire No.",
        "Wire ID",
        "Gauge/Size",
        "Length",
        "Device ID",
        "To Location",
        "Bundle Name",
      ],
    },
    projectInfo: {
      projectNumber: "ANG01",
      projectName: "ANG01 STOCK",
      revision: "A.6_M.2",
    },
    importHints: {
      canonicalSheetName: "JB71 B,PNL CUSTOMER",
      normalizedSheetName: "jb71-b-pnl-customer",
      bundleNames: ["XT - XT"],
      bundleDisplays: ["XT - XT - B - PNL VIBRATION"],
    },
    prefixGroups: [],
    ...overrides,
  };
}

function readRows(workbook: XLSX.WorkBook, sheetName: string) {
  const worksheet = workbook.Sheets[sheetName];
  expect(worksheet).toBeTruthy();
  return XLSX.utils.sheet_to_json<string[]>(worksheet, {
    header: 1,
    defval: "",
    blankrows: true,
  });
}

describe("appendBrandWorkbookSupportSheets", () => {
  it("uses visible bundle displays for bundle tag support sheets", () => {
    const workbook = XLSX.utils.book_new();

    appendBrandWorkbookSupportSheets(workbook, [buildSchema()]);

    expect(readRows(workbook, "Bundle Tag Info")[6][0]).toBe("XT - XT - B - PNL VIBRATION");
    expect(readRows(workbook, "Bundle Tags2")[1][0]).toContain("XT - XT - B - PNL VIBRATION");
    expect(readRows(workbook, "__BRANDLIST_META__")[1][5]).toBe("XT - XT - B - PNL VIBRATION");
  });

  it("builds bundle tags from actual bundle sections without de-duping matching labels", () => {
    const workbook = XLSX.utils.book_new();

    appendBrandWorkbookSupportSheets(workbook, [
      buildSchema({
        importHints: {
          canonicalSheetName: "JB71 B,PNL CUSTOMER",
          normalizedSheetName: "jb71-b-pnl-customer",
          bundleNames: ["XT - XT"],
          bundleDisplays: ["XT - XT"],
        },
        prefixGroups: [
          {
            prefix: "XT",
            bundles: [
              {
                bundleName: "XT - XT",
                toLocation: "JB71 B,PNL CTRL1",
                rows: [
                  {
                    rowId: "row-1",
                    rowIndex: 1,
                    fromDeviceId: "XT1:1",
                    wireNo: "-1",
                    wireId: "WHT",
                    gaugeSize: "16",
                    length: 60,
                    toDeviceId: "XT2:1",
                    toLocation: "JB71 B,PNL CTRL1",
                    bundleName: "XT - XT",
                    bundleDisplay: "XT - XT - B - PNL CTRL1",
                    devicePrefix: "XT",
                  },
                ],
              },
              {
                bundleName: "XT - XT",
                toLocation: "JB71 B,PNL CTRL2",
                rows: [
                  {
                    rowId: "row-2",
                    rowIndex: 2,
                    fromDeviceId: "XT3:1",
                    wireNo: "-2",
                    wireId: "WHT",
                    gaugeSize: "16",
                    length: 60,
                    toDeviceId: "XT4:1",
                    toLocation: "JB71 B,PNL CTRL2",
                    bundleName: "XT - XT",
                    bundleDisplay: "XT - XT - B - PNL CTRL2",
                    devicePrefix: "XT",
                  },
                ],
              },
            ],
          },
        ],
      }),
    ]);

    expect(readRows(workbook, "Bundle Tag Info")[6][0]).toBe("XT - XT - B - PNL CTRL1");
    expect(readRows(workbook, "Bundle Tag Info")[7][0]).toBe("XT - XT - B - PNL CTRL2");
    expect(readRows(workbook, "Bundle Tags2")[1][0]).toContain("XT - XT - B - PNL CTRL1");
    expect(readRows(workbook, "Bundle Tags2")[2][0]).toContain("XT - XT - B - PNL CTRL2");
  });

  it("falls back to internal bundle names for older schemas without display labels", () => {
    const workbook = XLSX.utils.book_new();

    appendBrandWorkbookSupportSheets(workbook, [
      buildSchema({
        importHints: {
          canonicalSheetName: "JB71 B,PNL CUSTOMER",
          normalizedSheetName: "jb71-b-pnl-customer",
          bundleNames: ["XT - XT"],
          bundleDisplays: [],
        },
      }),
    ]);

    expect(readRows(workbook, "Bundle Tag Info")[6][0]).toBe("XT - XT");
    expect(readRows(workbook, "Bundle Tags2")[1][0]).toContain("XT - XT");
  });
});
