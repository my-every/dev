import type { PartNumberLookupResult } from "@/lib/part-number-list";
import type { SemanticWireListRow } from "@/lib/workbook/types";
import { FILTER_METADATA, applyIdentificationFilter } from "@/lib/wiring-identification/filter-registry";
import type {
  BlueLabelSequenceMap,
  IdentificationFilterKind,
  PatternMatchMetadata,
} from "@/lib/wiring-identification/types";

import type {
  WireListCompiledLocationSection,
  WireListCompiledLocationSectionGroup,
  WireListCompiledLocationGroup,
  WireListCompiledSection,
  WireListCompiledSectionKind,
  WireListCompiledSectionSet,
  WireListCompiledSubgroup,
  WireListSectionCompilerInput,
  WireListSectionSurface,
} from "./types";
import { buildRenderableSectionSubgroups } from "./subgroups";

const DEFAULT_SECTION_KINDS: WireListCompiledSectionKind[] = [
  "grounds",
  "clips",
  "vio_jumpers",
  "ka_relay_plugin_jumpers",
  "ka_jumpers",
  "ka_twin_ferrules",
  "resistors",
  "fu_jumpers",
  "af_jumpers",
  "kt_jumpers",
  "single_connections",
  "cables",
];

const LEGACY_SECTION_METADATA: Record<"au_jumpers", { label: string; description: string; sortOrder: number; baseKind: IdentificationFilterKind }> = {
  au_jumpers: {
    label: "AU Jumpers",
    description: "AU identity jumpers split from the AF/AU jumper extractor for print and branding section parity.",
    sortOrder: 9.5,
    baseKind: "af_jumpers",
  },
};

function getRowLocation(row: SemanticWireListRow): string {
  return row.toLocation || row.fromLocation || row.location || "Unknown";
}

function getDevicePrefix(deviceId: string): string {
  const normalized = deviceId.trim().toUpperCase();
  const baseDevice = normalized.split(":")[0] ?? normalized;
  const match = baseDevice.match(/^([A-Z]+)/);
  return match?.[1] ?? "";
}

function isAuJumperRow(row: SemanticWireListRow): boolean {
  return getDevicePrefix(row.fromDeviceId || "") === "AU" || getDevicePrefix(row.toDeviceId || "") === "AU";
}

function isExternalLocation(location: string, currentSheetName: string): boolean {
  const normalizedLocation = location.toUpperCase().trim();
  const normalizedSheet = currentSheetName.toUpperCase().trim();

  if (!normalizedLocation || !normalizedSheet) {
    return false;
  }

  // Exact match means internal
  if (normalizedLocation === normalizedSheet) {
    return false;
  }

  // Extract the base panel name (e.g., "JB70" from "JB70 PANEL B" or "JB70 LEFT RAIL")
  const getBasePanelName = (name: string): string => {
    // Check if it has a PANEL suffix (e.g., "JB70 PANEL B")
    const panelMatch = name.match(/^(.+?)\s+PANEL\s+/i);
    if (panelMatch) {
      return panelMatch[1].trim();
    }
    // Check if it has a sub-location suffix (e.g., "JB70 LEFT RAIL")
    const parts = name.split(/\s+/);
    if (parts.length > 1) {
      // Return first part as base name
      return parts[0];
    }
    return name;
  };

  // Check if both are panel variants of the same base (e.g., "JB70 PANEL A" and "JB70 PANEL B")
  const sheetHasPanel = /\bPANEL\b/i.test(normalizedSheet);
  const locationHasPanel = /\bPANEL\b/i.test(normalizedLocation);

  // If sheet is a panel variant (e.g., "JB70 PANEL B")
  if (sheetHasPanel) {
    // If location is just the base name (e.g., "JB70"), it's external
    const sheetBase = getBasePanelName(normalizedSheet);
    if (normalizedLocation === sheetBase) {
      return true; // "JB70" is external to "JB70 PANEL B"
    }
    // If location is a different panel variant, it's external
    if (locationHasPanel) {
      return normalizedLocation !== normalizedSheet;
    }
    // If location starts with sheet base but isn't the sheet itself, check further
    if (normalizedLocation.startsWith(sheetBase + " ")) {
      // It's a sub-location of the base - external if not matching this panel
      return !normalizedLocation.startsWith(normalizedSheet);
    }
  }

  // If sheet is NOT a panel variant (e.g., "JB70")
  if (!sheetHasPanel) {
    // If location is a panel variant of this sheet (e.g., "JB70 PANEL B"), it's external
    if (locationHasPanel && normalizedLocation.startsWith(normalizedSheet + " ")) {
      return true;
    }
    // If location starts with sheet name but is a sub-location (e.g., "JB70 LEFT RAIL"), it's internal
    if (normalizedLocation.startsWith(normalizedSheet + " ")) {
      return false;
    }
  }

  // Location doesn't match or start with sheet name - it's external
  return true;
}

function buildLocationGroups(
  rows: SemanticWireListRow[],
  currentSheetName: string,
): WireListCompiledLocationGroup[] {
  const locationMap = new Map<string, SemanticWireListRow[]>();

  for (const row of rows) {
    const location = getRowLocation(row);
    const groupRows = locationMap.get(location) ?? [];
    groupRows.push(row);
    locationMap.set(location, groupRows);
  }

  return Array.from(locationMap.entries())
    .sort(([leftLocation], [rightLocation]) => {
      const leftExternal = isExternalLocation(leftLocation, currentSheetName);
      const rightExternal = isExternalLocation(rightLocation, currentSheetName);

      if (leftExternal !== rightExternal) {
        return leftExternal ? 1 : -1;
      }

      return leftLocation.localeCompare(rightLocation, undefined, { numeric: true, sensitivity: "base" });
    })
    .map(([location, locationRows], order) => ({
      key: location,
      label: location,
      isExternal: isExternalLocation(location, currentSheetName),
      rowIds: locationRows.map((row) => row.__rowId),
      rows: locationRows,
      order,
    }));
}

function buildMatchMetadata(
  rows: SemanticWireListRow[],
  matchMetadata: Record<string, PatternMatchMetadata>,
): Record<string, PatternMatchMetadata> {
  return Object.fromEntries(
    rows
      .map((row) => [row.__rowId, matchMetadata[row.__rowId]])
      .filter((entry): entry is [string, PatternMatchMetadata] => Boolean(entry[1])),
  );
}

function compileBaseSection(
  rows: SemanticWireListRow[],
  blueLabels: BlueLabelSequenceMap | null,
  currentSheetName: string,
  partNumberMap: Map<string, PartNumberLookupResult> | null,
  baseKind: IdentificationFilterKind,
): WireListCompiledSection | null {
  const result = applyIdentificationFilter(rows, baseKind, blueLabels, currentSheetName, partNumberMap);
  if (result.rows.length === 0) {
    return null;
  }

  const sortOrder = FILTER_METADATA[baseKind]?.sortOrder ?? Number.MAX_SAFE_INTEGER;

  return {
    kind: baseKind,
    baseKind,
    label: FILTER_METADATA[baseKind]?.label ?? baseKind,
    description: FILTER_METADATA[baseKind]?.description ?? "",
    sortOrder,
    rows: result.rows,
    rowIds: result.rows.map((row) => row.__rowId),
    matchMetadata: result.matchMetadata,
    // For ka_twin_ferrules and resistors, merge all rows into a single
    // location group so wire-number pairs are never split across locations.
    locationGroups: (baseKind === "ka_twin_ferrules" || baseKind === "resistors")
      ? [{
        key: currentSheetName || "Internal",
        label: currentSheetName || "Internal",
        isExternal: false,
        rowIds: result.rows.map((row) => row.__rowId),
        rows: result.rows,
        order: 0,
      }]
      : buildLocationGroups(result.rows, currentSheetName),
    subgroups: buildRenderableSectionSubgroups(baseKind, result.rows, result.matchMetadata, partNumberMap),
    totalRows: result.rows.length,
  };
}

function compileAuJumpersSection(
  rows: SemanticWireListRow[],
  blueLabels: BlueLabelSequenceMap | null,
  currentSheetName: string,
  partNumberMap: Map<string, PartNumberLookupResult> | null,
): WireListCompiledSection | null {
  const baseSection = compileBaseSection(rows, blueLabels, currentSheetName, partNumberMap, "af_jumpers");
  if (!baseSection) {
    return null;
  }

  const auRows = baseSection.rows.filter((row) => isAuJumperRow(row));
  if (auRows.length === 0) {
    return null;
  }

  const metadata = LEGACY_SECTION_METADATA.au_jumpers;
  const matchMetadata = buildMatchMetadata(auRows, baseSection.matchMetadata);

  return {
    kind: "au_jumpers",
    baseKind: metadata.baseKind,
    label: metadata.label,
    description: metadata.description,
    sortOrder: metadata.sortOrder,
    rows: auRows,
    rowIds: auRows.map((row) => row.__rowId),
    matchMetadata,
    locationGroups: buildLocationGroups(auRows, currentSheetName),
    subgroups: buildRenderableSectionSubgroups(metadata.baseKind, auRows, matchMetadata, partNumberMap),
    totalRows: auRows.length,
  };
}

function compileSection(
  rows: SemanticWireListRow[],
  blueLabels: BlueLabelSequenceMap | null,
  currentSheetName: string,
  partNumberMap: Map<string, PartNumberLookupResult> | null,
  kind: WireListCompiledSectionKind,
): WireListCompiledSection | null {
  if (kind === "au_jumpers") {
    // AU jumpers are now merged into af_jumpers — return null for legacy callers
    return null;
  }

  const baseSection = compileBaseSection(rows, blueLabels, currentSheetName, partNumberMap, kind);
  if (!baseSection) {
    return null;
  }

  return baseSection;
}

export function compileWireListSections({
  rows,
  blueLabels = null,
  currentSheetName,
  partNumberMap = null,
  enabledKinds = DEFAULT_SECTION_KINDS,
  surface = "live",
}: WireListSectionCompilerInput): WireListCompiledSectionSet {
  const sections: WireListCompiledSection[] = [];
  const usedRowIds = new Set<string>();

  for (const kind of enabledKinds) {
    const compiledSection = compileSection(rows, blueLabels, currentSheetName, partNumberMap, kind);
    if (!compiledSection) {
      continue;
    }

    const uniqueRows = compiledSection.rows.filter((row) => !usedRowIds.has(row.__rowId));
    if (uniqueRows.length === 0) {
      continue;
    }

    uniqueRows.forEach((row) => usedRowIds.add(row.__rowId));

    const uniqueMetadata = buildMatchMetadata(uniqueRows, compiledSection.matchMetadata);

    sections.push({
      ...compiledSection,
      rows: uniqueRows,
      rowIds: uniqueRows.map((row) => row.__rowId),
      matchMetadata: uniqueMetadata,
      locationGroups: buildLocationGroups(uniqueRows, currentSheetName),
      subgroups: buildRenderableSectionSubgroups(compiledSection.baseKind, uniqueRows, uniqueMetadata, partNumberMap),
      totalRows: uniqueRows.length,
    });
  }

  const includedKinds = sections.map((section) => section.kind);
  const unassignedRows = rows.filter((row) => !usedRowIds.has(row.__rowId));

  return {
    surface: surface as WireListSectionSurface,
    currentSheetName,
    sections,
    includedKinds,
    usedRowIds: Array.from(usedRowIds),
    unassignedRows,
  };
}

export function groupCompiledSectionsByLocation(
  sectionSet: WireListCompiledSectionSet,
): WireListCompiledLocationSectionGroup[] {
  const locationGroups = new Map<string, WireListCompiledLocationSectionGroup>();

  for (const section of sectionSet.sections) {
    for (const locationGroup of section.locationGroups) {
      const existingGroup = locationGroups.get(locationGroup.key) ?? {
        key: locationGroup.key,
        label: locationGroup.label,
        isExternal: locationGroup.isExternal,
        sections: [],
        totalRows: 0,
        order: locationGroup.order,
      };

      const locationRowIds = new Set(locationGroup.rowIds);
      const sectionRows = section.rows.filter((row) => locationRowIds.has(row.__rowId));
      const sectionMatchMetadata = buildMatchMetadata(sectionRows, section.matchMetadata);
      const sectionSubgroups = section.subgroups
        .map((subgroup) => {
          const subgroupRowIds = subgroup.rowIds.filter((rowId) => locationRowIds.has(rowId));
          if (subgroupRowIds.length === 0) {
            return null;
          }

          return {
            ...subgroup,
            rowIds: subgroupRowIds,
            startRowId: subgroupRowIds[0] ?? subgroup.startRowId,
          };
        })
        .filter((subgroup): subgroup is WireListCompiledSubgroup => Boolean(subgroup));

      const locationSection: WireListCompiledLocationSection = {
        kind: section.kind,
        baseKind: section.baseKind,
        label: section.label,
        description: section.description,
        sortOrder: section.sortOrder,
        rows: sectionRows,
        rowIds: sectionRows.map((row) => row.__rowId),
        matchMetadata: sectionMatchMetadata,
        subgroups: sectionSubgroups,
        totalRows: sectionRows.length,
      };

      existingGroup.sections.push(locationSection);
      existingGroup.totalRows += locationSection.totalRows;
      locationGroups.set(locationGroup.key, existingGroup);
    }
  }

  return Array.from(locationGroups.values())
    .map((group) => ({
      ...group,
      sections: group.sections.sort((left, right) => left.sortOrder - right.sortOrder),
    }))
    .sort((left, right) => {
      if (left.isExternal !== right.isExternal) {
        return left.isExternal ? 1 : -1;
      }

      return left.label.localeCompare(right.label, undefined, { numeric: true, sensitivity: "base" });
    });
}
