import type { PartNumberLookupResult, CablePartNumberLookupResult } from "@/lib/part-number-list";
import type { BrandingVisibleSection, PrintLocationGroup, PrintSubsection, VisiblePreviewSection } from "@/lib/wire-list-print/model";
import type { PrintSettings, ProjectInfo } from "@/lib/wire-list-print/defaults";

export interface BrandingSelectionState {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
  allSelected: boolean;
}

export interface WireListSectionRecord {
  location: string;
  isExternal: boolean;
  subsectionLabel: string;
  sectionKind?: string;
  rowCount: number;
  rows: PrintSubsection["rows"];
}

export interface WireListRenderableBlock {
  id: string;
  type: "location-group" | "wire-section" | "branding-section";
  label: string;
  location?: string;
  rowCount: number;
}

export interface WireListEditableRowRecord {
  rowId: string;
  rowIndex: number;
  location: string;
  isExternal: boolean;
  sectionLabel: string;
  bundleName: string;
  bundleDisplay: string;
  devicePrefix: string;
  fromDeviceId: string;
  wireNo: string;
  wireId: string;
  gaugeSize: string;
  length: number | null;
  toDeviceId: string;
  toLocation: string;
  isManual: boolean;
}

export interface BrandListEditableTableSection {
  id: string;
  prefix: string;
  bundleName: string;
  toLocation: string;
  rowCount: number;
  rows: WireListEditableRowRecord[];
}

export interface BrandListEditableTableModel {
  totalRows: number;
  sections: BrandListEditableTableSection[];
  rows: WireListEditableRowRecord[];
}

export interface WireListStandardTableRowRecord {
  rowId: string;
  rowIndex: number;
  location: string;
  isExternal: boolean;
  sectionLabel: string;
  sectionKind?: string;
  fromDeviceId: string;
  fromLocation: string;
  wireNo: string;
  wireId: string;
  gaugeSize: string;
  lengthDisplay: string;
  toDeviceId: string;
  toLocation: string;
}

export interface WireListStandardTableSection {
  id: string;
  location: string;
  isExternal: boolean;
  sectionLabel: string;
  sectionKind?: string;
  rowCount: number;
  rows: WireListStandardTableRowRecord[];
}

export interface WireListStandardTableModel {
  totalRows: number;
  sections: WireListStandardTableSection[];
  rows: WireListStandardTableRowRecord[];
}

export interface WireListSheetDocument {
  sheetMeta: {
    title: string;
    currentSheetName: string;
    previewPageCount: number;
    includeFeedbackPage: boolean;
  };
  locationGroups: PrintLocationGroup[];
  sectionGroups: WireListSectionRecord[];
  renderableBlocks: WireListRenderableBlock[];
  standardSections: VisiblePreviewSection[];
  wireListSections: VisiblePreviewSection[];
  crossWireSections: VisiblePreviewSection[];
  brandingSections: BrandingVisibleSection[];
  editableRowRecords: WireListEditableRowRecord[];
  brandTable: BrandListEditableTableModel;
  standardTable: WireListStandardTableModel;
}

export interface WireListPrintDocumentData {
  settings: PrintSettings;
  projectInfo: ProjectInfo;
  sheetTitle: string;
  currentSheetName: string;
  previewPageCount: number;
  processedLocationGroups: PrintLocationGroup[];
  hiddenSectionKeys?: string[];
  comments?: Record<string, string>;
  partNumberEntries?: Array<[string, PartNumberLookupResult]>;
  cablePartNumberEntries?: Array<[string, CablePartNumberLookupResult]>;
  rowLengthsById?: Record<string, { display: string; roundedInches: number; confidence: string }>;
  swsType?: {
    id: string;
    label: string;
    shortLabel: string;
    color?: string;
  };
  brandingVisibleSections?: BrandingVisibleSection[];
  brandingSelection?: BrandingSelectionState;
  includeFeedbackPage?: boolean;
  hiddenRowIds?: string[];
  crossWireSectionKeys?: string[];
  sheetDocument?: WireListSheetDocument;
  standardVisibleSections?: VisiblePreviewSection[];
  /** Destination sheet name (uppercase) -> box side mapping for external groups. */
  locationBoxSideByName?: Record<string, string>;
  /** Destination sheet name (uppercase) -> normalized title mapping for display in location columns. */
  locationNormalizedTitleByName?: Record<string, string>;
}
