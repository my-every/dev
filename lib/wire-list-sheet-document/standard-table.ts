import { shouldSwapForTargetPair } from "@/lib/wire-list-sections";
import type { VisiblePreviewSection } from "@/lib/wire-list-print/model";
import type { WireListStandardTableModel, WireListStandardTableRowRecord, WireListStandardTableSection } from "@/lib/wire-list-sheet-document/types";

function getDisplayEndpoints(row: VisiblePreviewSection["visibleRows"][number]): {
  fromDeviceId: string;
  toDeviceId: string;
  fromLocation: string;
  toLocation: string;
} {
  const shouldSwap = shouldSwapForTargetPair(row.fromDeviceId, row.toDeviceId);
  const rawFromLocation = row.fromLocation || "";
  const rawToLocation = row.toLocation || row.location || rawFromLocation || "";

  return {
    fromDeviceId: shouldSwap ? (row.toDeviceId || "") : (row.fromDeviceId || ""),
    toDeviceId: shouldSwap ? (row.fromDeviceId || "") : (row.toDeviceId || ""),
    fromLocation: shouldSwap ? rawToLocation || rawFromLocation : rawFromLocation || rawToLocation,
    toLocation: shouldSwap ? rawFromLocation || rawToLocation : rawToLocation || rawFromLocation,
  };
}

export function buildWireListStandardTableModelFromSections(
  visiblePreviewSections: VisiblePreviewSection[],
  rowLengthsById: Record<string, { display: string }> = {},
  currentSheetName?: string,
): WireListStandardTableModel {
  const sections: WireListStandardTableSection[] = [];
  const rows: WireListStandardTableRowRecord[] = [];

  for (const visibleSection of visiblePreviewSections) {
    const sectionRows: WireListStandardTableRowRecord[] = visibleSection.visibleRows.map((row) => {
      const display = getDisplayEndpoints(row);

      const rowRecord: WireListStandardTableRowRecord = {
        rowId: row.__rowId,
        rowIndex: row.__rowIndex,
        location: visibleSection.group.location,
        isExternal: visibleSection.group.isExternal,
        sectionLabel: visibleSection.subsection.label,
        sectionKind: visibleSection.subsection.sectionKind,
        fromDeviceId: display.fromDeviceId,
        fromLocation: visibleSection.group.isExternal
          ? (currentSheetName || display.fromLocation || display.toLocation)
          : display.fromLocation,
        wireNo: row.wireNo || "",
        wireId: row.wireId || "",
        gaugeSize: row.gaugeSize || "",
        lengthDisplay: rowLengthsById[row.__rowId]?.display || "",
        toDeviceId: display.toDeviceId,
        toLocation: display.toLocation,
      };

      rows.push(rowRecord);
      return rowRecord;
    });

    sections.push({
      id: `${visibleSection.group.location}:${visibleSection.subsection.label}:${sections.length}`,
      location: visibleSection.group.location,
      isExternal: visibleSection.group.isExternal,
      sectionLabel: visibleSection.subsection.label,
      sectionKind: visibleSection.subsection.sectionKind,
      rowCount: sectionRows.length,
      rows: sectionRows,
    });
  }

  return {
    totalRows: rows.length,
    sections,
    rows,
  };
}
