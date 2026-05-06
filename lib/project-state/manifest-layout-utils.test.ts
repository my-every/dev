import { describe, expect, it } from "vitest";

import {
  buildNormalizedLayoutPageIndex,
  matchAssignmentToLayoutPages,
} from "./manifest-layout-utils";
import type { SlimLayoutPage } from "../layout-matching";
import type { ManifestAssignmentNode } from "../../types/project-manifest";

function makeAssignment(sheetName: string): ManifestAssignmentNode {
  const sheetSlug = sheetName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  return {
    sheetSlug,
    sheetName,
    kind: "operational",
    rowCount: 10,
    swsType: "UNDECIDED",
    stage: "READY_TO_LAY",
    status: "NOT_STARTED",
    panducts: [],
    rails: [],
    whiteLabels: [],
    blueLabels: [],
    partNumbers: [],
    files: {},
    layout: null,
    devices: {},
  };
}

function makePage(pageNumber: number, title: string): SlimLayoutPage {
  return {
    pageNumber,
    title,
    normalizedTitle: title,
    unitType: title.match(/\b(JB\d+)\b/i)?.[1]?.toUpperCase(),
    rails: [],
    panducts: [],
    imageUrl: `data:image/png;base64,page-${pageNumber}`,
  };
}

describe("manifest layout matching", () => {
  it("does not persist generic fallback matches as assignment layout mappings", () => {
    const layoutIndex = buildNormalizedLayoutPageIndex([
      makePage(1, "POWER SUPPLY BOX"),
      makePage(2, "JB71 B,PNL DC PWR"),
    ]);

    const match = matchAssignmentToLayoutPages(
      makeAssignment("CONTROL PANEL B, JB70"),
      layoutIndex,
    );

    expect(match).toBeNull();
  });

  it("persists a high-confidence structural match", () => {
    const layoutIndex = buildNormalizedLayoutPageIndex([
      makePage(1, "POWER SUPPLY BOX"),
      makePage(2, "CONTROL PANEL B, JB70"),
    ]);

    const match = matchAssignmentToLayoutPages(
      makeAssignment("CONTROL PANEL B, JB70"),
      layoutIndex,
    );

    expect(match?.primaryPage?.pageNumber).toBe(2);
    expect(match?.primaryPage?.matchMethod).toBe("title");
  });
});
