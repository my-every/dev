import type { WireListFeedbackSection } from "@/lib/wire-list-feedback/types";
import { DEFAULT_WIRE_LIST_FEEDBACK_SECTIONS, FEEDBACK_SECTION_QUESTIONS } from "@/lib/wire-list-feedback/types";
import type { IdentificationFilterKind } from "@/lib/wiring-identification/types";

export type PrintFormatMode = "standardize" | "branding";

export type BrandingSortMode = "default" | "device-prefix" | "device-prefix-part-number" | "blue-label-sequence";

export type JumperSection =
  | "grounds"
  | "clips"
  | "ka_relay_plugin_jumpers"
  | "vio_jumpers"
  | "resistors"
  | "ka_jumpers"
  | "ka_twin_ferrule"
  | "kt_jumpers"
  | "fu_jumpers"
  | "af_jumpers"
  | "single_connections"
  | "cables";

export interface PersonnelEntry {
  id: string;
  badgeNumber: string;
  date: string;
  time: string;
  isAssembler: boolean;
  isInspector: boolean;
}

export interface ProjectInfo {
  projectNumber: string;
  projectName: string;
  revision: string;
  pdNumber: string;
  unitNumber: string;
  preparedBy: string;
  badgeNumber: string;
  date: string;
  time: string;
  personnel: PersonnelEntry[];
}

export interface CustomQuestion {
  key: string;
  label: string;
  type: "boolean" | "text" | "number" | "difficulty" | "quality" | "improvement";
  enabled: boolean;
  sectionId: string;
  isCustom?: boolean;
}

export interface SectionColumnVisibility {
  partNumber: boolean;
  description: boolean;
  wireNo: boolean;
  wireId: boolean;
  wireType: boolean;
  gaugeSize: boolean;
  fromLocation: boolean;
  toLocation: boolean;
  swapFromTo: boolean;
}

export interface PrintSettings {
  mode: PrintFormatMode;
  enabledSections: JumperSection[];
  sectionOrder: JumperSection[];
  customSettings: {
    sortByGauge: "none" | "smallest-first" | "largest-first";
    groupByLocation: boolean;
    includeGrounds: boolean;
    includeJumpers: boolean;
    includeClips: boolean;
  };
  showFromCheckbox: boolean;
  showToCheckbox: boolean;
  showIPV: boolean;
  showComments: boolean;
  showLength: boolean;
  showEstTime: boolean;
  showDeviceSubheaders: boolean;
  enableBlueDeviceIDColumns: boolean;
  showCoverPage: boolean;
  coverImageUrl?: string;
  showTableOfContents: boolean;
  showIPVCodes: boolean;
  showFeedbackSection: boolean;
  feedbackRenderMode: "PREFILLED" | "BLANK";
  feedbackSections: WireListFeedbackSection[];
  customQuestions: Record<string, CustomQuestion>;
  sectionColumnVisibility: Record<string, SectionColumnVisibility>;
  standardHiddenSections: Set<string>;
  standardHiddenSectionsCustomized: boolean;
  brandingHiddenSections: Set<string>;
  brandingHiddenSectionsCustomized: boolean;
  hiddenRows: Set<string>;
  crossWireSections: Set<string>;
  brandingSortMode: BrandingSortMode;
  wireListSortMode: BrandingSortMode;
}

export const DEFAULT_SECTION_ORDER: JumperSection[] = [
  "grounds",
  "clips",
  "vio_jumpers",
  "resistors",
  "fu_jumpers",
  "ka_relay_plugin_jumpers",
  "ka_jumpers",
  "ka_twin_ferrule",
  "kt_jumpers",
  "af_jumpers",
  "single_connections",
  "cables",
];

export const DEFAULT_SECTION_COLUMNS: SectionColumnVisibility = {
  partNumber: false,
  description: false,
  wireNo: true,
  wireId: true,
  wireType: true,
  gaugeSize: true,
  fromLocation: false,
  toLocation: true,
  swapFromTo: false,
};

export function getDefaultSectionColumns(sectionKind?: IdentificationFilterKind): SectionColumnVisibility {
  if (sectionKind === "cables") {
    return {
      partNumber: false,
      description: false,
      wireNo: false,
      wireId: false,
      wireType: true,
      gaugeSize: false,
      fromLocation: false,
      toLocation: true,
      swapFromTo: false,
    };
  }

  if (sectionKind === "clips" || sectionKind === "ka_relay_plugin_jumpers") {
    return {
      partNumber: false,
      description: false,
      wireNo: false,
      wireId: false,
      wireType: false,
      gaugeSize: false,
      fromLocation: false,
      toLocation: true,
      swapFromTo: false,
    };
  }

  if (sectionKind === "grounds") {
    return {
      ...DEFAULT_SECTION_COLUMNS,
      wireType: false,
    };
  }

  return DEFAULT_SECTION_COLUMNS;
}

export function getEffectiveSectionColumns(
  sectionColumnVisibility: Record<string, SectionColumnVisibility>,
  sectionLabel?: string,
  sectionKind?: IdentificationFilterKind,
): SectionColumnVisibility {
  if (sectionLabel && sectionColumnVisibility[sectionLabel]) {
    return sectionColumnVisibility[sectionLabel];
  }

  if (sectionKind && sectionColumnVisibility[sectionKind]) {
    return sectionColumnVisibility[sectionKind];
  }

  return getDefaultSectionColumns(sectionKind);
}

export function getSectionColumnVisibilityKey(
  sectionLabel?: string,
  sectionKind?: IdentificationFilterKind,
): string {
  return sectionLabel || sectionKind || "default";
}

export function createDefaultPrintSettings(): PrintSettings {
  const questions: Record<string, CustomQuestion> = {};
  for (const [sectionId, sectionQuestions] of Object.entries(FEEDBACK_SECTION_QUESTIONS)) {
    for (const q of sectionQuestions) {
      questions[q.key as string] = {
        key: q.key as string,
        label: q.label,
        type: q.type,
        enabled: true,
        sectionId,
        isCustom: false,
      };
    }
  }

  return {
    mode: "standardize",
    enabledSections: [...DEFAULT_SECTION_ORDER],
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    customSettings: {
      sortByGauge: "none",
      groupByLocation: true,
      includeGrounds: true,
      includeJumpers: true,
      includeClips: true,
    },
    showFromCheckbox: true,
    showToCheckbox: true,
    showIPV: true,
    showComments: true,
    showLength: false,
    showEstTime: false,
    showDeviceSubheaders: false,
    enableBlueDeviceIDColumns: false,
    showCoverPage: true,
    coverImageUrl: undefined,
    showTableOfContents: true,
    showIPVCodes: false,
    showFeedbackSection: false,
    feedbackRenderMode: "BLANK",
    feedbackSections: [...DEFAULT_WIRE_LIST_FEEDBACK_SECTIONS],
    customQuestions: questions,
    sectionColumnVisibility: {},
    standardHiddenSections: new Set<string>(),
    standardHiddenSectionsCustomized: false,
    brandingHiddenSections: new Set<string>(),
    brandingHiddenSectionsCustomized: false,
    hiddenRows: new Set<string>(),
    crossWireSections: new Set<string>(),
    brandingSortMode: "device-prefix",
    wireListSortMode: "device-prefix",
  };
}

export function createDefaultProjectInfo(metadata?: {
  projectNumber?: string;
  projectName?: string;
  revision?: string;
  pdNumber?: string;
  unitNumber?: string;
}): ProjectInfo {
  return {
    projectNumber: metadata?.projectNumber || "",
    projectName: metadata?.projectName || "",
    revision: metadata?.revision || "",
    pdNumber: metadata?.pdNumber || "",
    unitNumber: metadata?.unitNumber || "",
    preparedBy: "",
    badgeNumber: "",
    date: "",
    time: "",
    personnel: [
      { id: "1", badgeNumber: "", date: "", time: "", isAssembler: false, isInspector: false },
      { id: "2", badgeNumber: "", date: "", time: "", isAssembler: false, isInspector: false },
      { id: "3", badgeNumber: "", date: "", time: "", isAssembler: false, isInspector: false },
      { id: "4", badgeNumber: "", date: "", time: "", isAssembler: false, isInspector: false },
      { id: "5", badgeNumber: "", date: "", time: "", isAssembler: false, isInspector: false },
      { id: "6", badgeNumber: "", date: "", time: "", isAssembler: false, isInspector: false },
    ],
  };
}
