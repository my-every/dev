import type { BrandingPreviewRow, BrandingVisibleSection, PrintLocationGroup, VisiblePreviewSection } from "@/lib/wire-list-print/model";
import { buildBrandingVisibleSections, buildVisiblePreviewSections, isPrintableConnectionRow } from "@/lib/wire-list-print/model";
import type { WireListPrintDocumentData, WireListRenderableBlock, WireListSectionRecord, WireListSheetDocument } from "@/lib/wire-list-sheet-document/types";
import { buildBrandListEditableTableModelFromSections } from "@/lib/wire-list-sheet-document/brand-table";
import { buildWireListStandardTableModelFromSections } from "@/lib/wire-list-sheet-document/standard-table";
import { filterEmptyDeviceChangeSections } from "@/lib/wiring-identification/device-change-pattern";
import type { SectionColumnVisibility } from "@/lib/wire-list-print/defaults";
import type { PartNumberLookupResult } from "@/lib/part-number-list";

export function buildWireListSheetDocument(options: Pick<
  WireListPrintDocumentData,
  | "sheetTitle"
  | "currentSheetName"
  | "previewPageCount"
  | "processedLocationGroups"
  | "brandingVisibleSections"
  | "standardVisibleSections"
  | "rowLengthsById"
  | "includeFeedbackPage"
> & {
  wireListSections?: VisiblePreviewSection[];
  crossWireSections?: VisiblePreviewSection[];
}): WireListSheetDocument {
  const processedLocationGroups = options.processedLocationGroups ?? [];
  const brandingVisibleSections = options.brandingVisibleSections ?? [];
  const standardVisibleSections = options.standardVisibleSections ?? [];
  const wireListSections = options.wireListSections ?? standardVisibleSections;
  const crossWireSections = options.crossWireSections ?? [];

  const sectionGroups: WireListSectionRecord[] = processedLocationGroups.flatMap((group: PrintLocationGroup) =>
    group.subsections.map((subsection) => ({
      location: group.location,
      isExternal: group.isExternal,
      subsectionLabel: subsection.label,
      sectionKind: subsection.sectionKind,
      rowCount: subsection.rows.length,
      rows: subsection.rows,
    })),
  );

  const renderableBlocks: WireListRenderableBlock[] = [
    ...processedLocationGroups.map((group) => ({
      id: `location:${group.location}`,
      type: "location-group" as const,
      label: group.location,
      location: group.location,
      rowCount: group.totalRows,
    })),
    ...sectionGroups.map((section, index) => ({
      id: `section:${section.location}:${section.subsectionLabel}:${index}`,
      type: "wire-section" as const,
      label: section.subsectionLabel,
      location: section.location,
      rowCount: section.rowCount,
    })),
    ...brandingVisibleSections.map((section, index) => ({
      id: `branding:${section.group.location}:${section.subsection.label}:${index}`,
      type: "branding-section" as const,
      label: section.subsection.label,
      location: section.group.location,
      rowCount: section.rows.length,
    })),
  ];

  const brandTable = buildBrandListEditableTableModelFromSections(brandingVisibleSections);
  const standardTable = buildWireListStandardTableModelFromSections(
    standardVisibleSections,
    options.rowLengthsById,
  );

  return {
    sheetMeta: {
      title: options.sheetTitle,
      currentSheetName: options.currentSheetName,
      previewPageCount: options.previewPageCount,
      includeFeedbackPage: Boolean(options.includeFeedbackPage),
    },
    locationGroups: processedLocationGroups,
    sectionGroups,
    renderableBlocks,
    standardSections: standardVisibleSections,
    wireListSections,
    crossWireSections,
    brandingSections: brandingVisibleSections as BrandingVisibleSection[],
    editableRowRecords: brandTable.rows,
    brandTable,
    standardTable,
  };
}

function buildCrossWirePreviewSections(options: {
  processedLocationGroups: PrintLocationGroup[];
  activeHiddenSections: Set<string>;
  crossWireSections: Set<string>;
  hiddenRows?: Set<string>;
}): VisiblePreviewSection[] {
  if (options.crossWireSections.size === 0) {
    return [];
  }

  const sectionColumns: SectionColumnVisibility = {
    partNumber: false,
    description: false,
    wireType: false,
    wireNo: true,
    wireId: true,
    gaugeSize: true,
    fromLocation: true,
    toLocation: true,
    swapFromTo: true,
  };

  return options.processedLocationGroups.flatMap((group, groupIndex) => {
    const locationKey = `loc-${groupIndex}`;
    if (!options.crossWireSections.has(locationKey) || options.activeHiddenSections.has(locationKey)) {
      return [];
    }

    return group.subsections.flatMap((subsection, subIndex) => {
      const sectionKey = `${groupIndex}-${subIndex}`;
      if (options.activeHiddenSections.has(sectionKey)) {
        return [];
      }

      let visibleRows = filterEmptyDeviceChangeSections(subsection.rows).filter(isPrintableConnectionRow);
      if (options.hiddenRows && options.hiddenRows.size > 0) {
        visibleRows = visibleRows.filter((row) => !options.hiddenRows?.has(row.__rowId));
      }

      if (visibleRows.length === 0) {
        return [];
      }

      return [{ group, subsection, sectionColumns, visibleRows }];
    });
  });
}

export function buildWireListSheetWorkspaceDocument(options: {
  sheetTitle: string;
  currentSheetName: string;
  previewPageCount: number;
  processedLocationGroups: PrintLocationGroup[];
  activeHiddenSections: Set<string>;
  sectionColumnVisibility: WireListPrintDocumentData["settings"]["sectionColumnVisibility"];
  hiddenRows?: Set<string>;
  crossWireSections?: Set<string>;
  rowLengthsById?: Record<string, { display: string; roundedInches: number; confidence: string }>;
  includeFeedbackPage?: boolean;
  brandingPreviewRowMap?: Map<string, BrandingPreviewRow>;
  partNumberMap?: Map<string, PartNumberLookupResult>;
}): WireListSheetDocument {
  const activeCrossWireSections = options.crossWireSections ?? new Set<string>();

  const standardVisibleSections = buildVisiblePreviewSections(
    options.processedLocationGroups,
    options.activeHiddenSections,
    options.sectionColumnVisibility,
    options.hiddenRows,
  );

  const brandingVisibleSections = options.brandingPreviewRowMap
    ? buildBrandingVisibleSections({
        processedLocationGroups: options.processedLocationGroups,
        activeHiddenSections: options.activeHiddenSections,
        brandingPreviewRowMap: options.brandingPreviewRowMap,
        currentSheetName: options.currentSheetName,
        partNumberMap: options.partNumberMap,
        hiddenRows: options.hiddenRows,
      })
    : [];

  const crossWireVisibleSections = buildCrossWirePreviewSections({
    processedLocationGroups: options.processedLocationGroups,
    activeHiddenSections: options.activeHiddenSections,
    crossWireSections: activeCrossWireSections,
    hiddenRows: options.hiddenRows,
  });

  const wireListSections = standardVisibleSections.filter((section) => {
    const groupIndex = options.processedLocationGroups.findIndex((group) =>
      group.location === section.group.location && group.isExternal === section.group.isExternal,
    );
    return groupIndex < 0 || !activeCrossWireSections.has(`loc-${groupIndex}`);
  });

  return buildWireListSheetDocument({
    sheetTitle: options.sheetTitle,
    currentSheetName: options.currentSheetName,
    previewPageCount: options.previewPageCount,
    processedLocationGroups: options.processedLocationGroups,
    brandingVisibleSections,
    standardVisibleSections,
    wireListSections,
    crossWireSections: crossWireVisibleSections,
    rowLengthsById: options.rowLengthsById,
    includeFeedbackPage: options.includeFeedbackPage,
  });
}
