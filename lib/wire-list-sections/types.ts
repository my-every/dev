import type { PartNumberLookupResult } from "@/lib/part-number-list";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import type {
  BlueLabelSequenceMap,
  IdentificationFilterKind,
  PatternMatchMetadata,
} from "@/lib/wiring-identification/types";

export type WireListSectionSurface = "live" | "print" | "branding";

export type WireListCompiledSectionKind = IdentificationFilterKind | "au_jumpers";

export type WireListSubgroupKind = "location" | "run" | "pair" | "device_family";

export type WireListSubgroupTone = "default" | "muted" | "warning";

export interface WireListSectionCompilerInput {
  rows: SemanticWireListRow[];
  blueLabels?: BlueLabelSequenceMap | null;
  currentSheetName: string;
  partNumberMap?: Map<string, PartNumberLookupResult> | null;
  enabledKinds?: WireListCompiledSectionKind[];
  surface?: WireListSectionSurface;
}

export interface WireListCompiledSubgroup {
  id: string;
  kind: WireListSubgroupKind;
  label: string;
  tone: WireListSubgroupTone;
  description?: string;
  rowIds: string[];
  startRowId: string;
  order: number;
}

export interface WireListCompiledLocationGroup {
  key: string;
  label: string;
  isExternal: boolean;
  rowIds: string[];
  rows: SemanticWireListRow[];
  order: number;
}

export interface WireListCompiledSection {
  kind: WireListCompiledSectionKind;
  baseKind: IdentificationFilterKind;
  label: string;
  description: string;
  sortOrder: number;
  rows: SemanticWireListRow[];
  rowIds: string[];
  matchMetadata: Record<string, PatternMatchMetadata>;
  locationGroups: WireListCompiledLocationGroup[];
  subgroups: WireListCompiledSubgroup[];
  totalRows: number;
}

export interface WireListCompiledLocationSection {
  kind: WireListCompiledSectionKind;
  baseKind: IdentificationFilterKind;
  label: string;
  description: string;
  sortOrder: number;
  rows: SemanticWireListRow[];
  rowIds: string[];
  matchMetadata: Record<string, PatternMatchMetadata>;
  subgroups: WireListCompiledSubgroup[];
  totalRows: number;
}

export interface WireListCompiledLocationSectionGroup {
  key: string;
  label: string;
  isExternal: boolean;
  sections: WireListCompiledLocationSection[];
  totalRows: number;
  order: number;
}

export interface WireListCompiledSectionSet {
  surface: WireListSectionSurface;
  currentSheetName: string;
  sections: WireListCompiledSection[];
  includedKinds: WireListCompiledSectionKind[];
  usedRowIds: string[];
  unassignedRows: SemanticWireListRow[];
}