import { describe, expect, it } from "vitest";

import { buildWireListPrintSchema, type WireListPrintSchemaTocPage, type WireListPrintSchemaWireListPage } from "@/lib/wire-list-print/schema";
import type { PrintLocationGroup } from "@/lib/wire-list-print/model";
import type { SemanticWireListRow } from "@/lib/workbook/types";

function makeRow(index: number): SemanticWireListRow {
  return {
    __rowIndex: index,
    __rowId: `row-${index}`,
    fromDeviceId: `KA${index}:A1`,
    wireType: "WIRE",
    wireNo: String(index),
    wireId: "BK",
    gaugeSize: "16",
    fromLocation: "UNIT1",
    fromPageZone: "A1",
    toDeviceId: `TB${index}:1`,
    toLocation: "UNIT1",
    toPageZone: "A2",
  };
}

describe("wire-list print schema", () => {
  it("keeps Blue Label grouping settings aligned with TOC page estimates", () => {
    const processedLocationGroups: PrintLocationGroup[] = [
      {
        location: "UNIT1",
        isExternal: false,
        totalRows: 32,
        subsections: [
          {
            label: "Single Connections",
            sectionKind: "single_connections",
            rows: Array.from({ length: 31 }, (_, index) => makeRow(index + 1)),
          },
          {
            label: "Cables",
            sectionKind: "cables",
            rows: [makeRow(32)],
          },
        ],
      },
    ];

    const schema = buildWireListPrintSchema({
      currentSheetName: "UNIT1",
      processedLocationGroups,
      settings: {
        wireListSortMode: "blue-label-sequence",
        showCoverPage: true,
        showTableOfContents: true,
        showIPVCodes: true,
        showFeedbackSection: false,
      },
    });

    const tocPage = schema.pages.find(
      (page): page is WireListPrintSchemaTocPage => page.pageType === "toc",
    );
    const wireListPage = schema.pages.find(
      (page): page is WireListPrintSchemaWireListPage => page.pageType === "wire-list",
    );

    expect(schema.settings.wireListSortMode).toBe("blue-label-sequence");
    expect(schema.totalPages).toBe(5);
    expect(tocPage?.pageNumber).toBe(2);
    expect(wireListPage?.pageNumber).toBe(4);
    expect(tocPage?.locationGroups[0]?.sections.map((section) => section.estimatedPage)).toEqual([4, 5]);
  });

  it("normalizes numeric-leading wire numbers in saved print schemas", () => {
    const schema = buildWireListPrintSchema({
      currentSheetName: "UNIT1",
      rows: [
        makeRow(1),
        { ...makeRow(2), wireNo: "-0V" },
        { ...makeRow(3), wireNo: "XT04001" },
      ],
      settings: {
        showCoverPage: false,
        showTableOfContents: false,
        showIPVCodes: false,
        showFeedbackSection: false,
      },
    });

    const wireListPage = schema.pages.find(
      (page): page is WireListPrintSchemaWireListPage => page.pageType === "wire-list",
    );
    const rows = wireListPage?.locationGroups[0]?.subsections[0]?.rows ?? [];

    expect(rows.map((row) => row.wireNo)).toEqual(["-1", "-0V", "XT04001"]);
  });
});
