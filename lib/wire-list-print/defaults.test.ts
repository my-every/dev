import { describe, expect, it } from "vitest";

import {
  DEFAULT_SECTION_ORDER,
  createDefaultPrintSettings,
  createDefaultProjectInfo,
  getDefaultSectionColumns,
  getEffectiveSectionColumns,
} from "@/lib/wire-list-print/defaults";

describe("wire-list print defaults", () => {
  it("builds stable default print settings", () => {
    const settings = createDefaultPrintSettings();

    expect(settings.mode).toBe("standardize");
    expect(settings.enabledSections).toEqual(DEFAULT_SECTION_ORDER);
    expect(settings.sectionOrder).toEqual(DEFAULT_SECTION_ORDER);
    expect(settings.showCoverPage).toBe(true);
    expect(settings.showTableOfContents).toBe(true);
    expect(settings.showIPVCodes).toBe(false);
    expect(settings.standardHiddenSections.size).toBe(0);
    expect(settings.brandingHiddenSections.size).toBe(0);
  });

  it("creates independent hidden-section sets", () => {
    const first = createDefaultPrintSettings();
    const second = createDefaultPrintSettings();

    first.standardHiddenSections.add("loc-0");
    first.brandingHiddenSections.add("0-0");

    expect(second.standardHiddenSections.size).toBe(0);
    expect(second.brandingHiddenSections.size).toBe(0);
  });

  it("creates default project info from metadata", () => {
    const projectInfo = createDefaultProjectInfo({
      projectNumber: "PD380",
      projectName: "Demo Project",
      revision: "B",
      pdNumber: "PD380",
      unitNumber: "U1",
    });

    expect(projectInfo.projectNumber).toBe("PD380");
    expect(projectInfo.projectName).toBe("Demo Project");
    expect(projectInfo.revision).toBe("B");
    expect(projectInfo.pdNumber).toBe("PD380");
    expect(projectInfo.unitNumber).toBe("U1");
    expect(projectInfo.personnel).toHaveLength(6);
  });

  it("falls back to section-specific column defaults", () => {
    expect(getDefaultSectionColumns("cables")).toMatchObject({
      description: false,
      wireNo: false,
    });

    expect(
      getEffectiveSectionColumns(
        {
          Cables: {
            partNumber: true,
            description: true,
            wireNo: true,
            wireId: false,
            wireType: false,
            gaugeSize: false,
            fromLocation: false,
            toLocation: true,
            swapFromTo: false,
          },
        },
        "Cables",
        "cables",
      ),
    ).toMatchObject({
      partNumber: true,
      description: true,
      wireNo: true,
    });
  });
});
