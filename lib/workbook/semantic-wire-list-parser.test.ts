import { describe, expect, it } from "vitest";

import { buildSemanticWireListRows } from "./semantic-wire-list-parser";

describe("buildSemanticWireListRows", () => {
  const columnMap = {
    0: "fromDeviceId",
    1: "wireType",
    2: "wireNo",
    3: "wireId",
    4: "gaugeSize",
    5: "fromPageZone",
    6: "toDeviceId",
    7: "toLocation",
    8: "toPageZone",
  } as const;

  it("prefixes numeric-leading wire numbers with a negative marker", () => {
    const rows = buildSemanticWireListRows(
      [["XT0100:1", "SC", "120702", "RED", "16", "1.A1", "XT0100:2", "PANEL", "1.A2"]],
      columnMap,
      0,
    );

    expect(rows[0]?.wireNo).toBe("-120702");
  });

  it("leaves existing negative and letter-leading wire numbers unchanged", () => {
    const rows = buildSemanticWireListRows(
      [
        ["XT0100:1", "SC", "-0V", "WHT", "16", "1.A1", "XT0100:2", "PANEL", "1.A2"],
        ["FU0100:1", "SC", "FU0139", "RED", "16", "1.A1", "FU0100:2", "PANEL", "1.A2"],
      ],
      columnMap,
      0,
    );

    expect(rows.map((row) => row.wireNo)).toEqual(["-0V", "FU0139"]);
  });
});
