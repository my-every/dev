import type { BrandingVisibleSection } from "@/lib/wire-list-print/model";
import type { BrandListEditableTableModel, BrandListEditableTableSection, WireListEditableRowRecord } from "@/lib/wire-list-sheet-document/types";

function getDevicePrefix(deviceId: string | undefined): string {
  const baseDeviceId = (deviceId ?? "").split(":")[0]?.trim() ?? "";
  const match = baseDeviceId.match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : baseDeviceId.toUpperCase() || "UNKNOWN";
}

export function buildBrandListEditableTableModelFromSections(
  brandingVisibleSections: BrandingVisibleSection[],
): BrandListEditableTableModel {
  const sectionMap = new Map<string, BrandListEditableTableSection>();
  const rows: WireListEditableRowRecord[] = [];

  for (const visibleSection of brandingVisibleSections) {
    const sectionLabel = visibleSection.subsection.label;

    for (const previewRow of visibleSection.rows) {
      const sourceRow = previewRow.row;
      const fromDeviceId = sourceRow.fromDeviceId || "";
      const toDeviceId = sourceRow.toDeviceId || "";
      const bundleName = sectionLabel || getDevicePrefix(fromDeviceId);
      const key = `${getDevicePrefix(fromDeviceId)}::${bundleName}::${previewRow.location}`;
      const existing = sectionMap.get(key);

      const rowRecord: WireListEditableRowRecord = {
        rowId: sourceRow.__rowId,
        rowIndex: sourceRow.__rowIndex,
        location: previewRow.location,
        isExternal: previewRow.isExternal,
        sectionLabel,
        bundleName,
        bundleDisplay: bundleName,
        devicePrefix: getDevicePrefix(fromDeviceId),
        fromDeviceId,
        wireNo: sourceRow.wireNo || "",
        wireId: sourceRow.wireId || "",
        gaugeSize: sourceRow.gaugeSize || "",
        length: typeof previewRow.measurement === "number" ? previewRow.measurement : null,
        toDeviceId,
        toLocation: sourceRow.toLocation || sourceRow.fromLocation || sourceRow.location || previewRow.location,
        isManual: previewRow.isManual,
      };

      rows.push(rowRecord);

      if (existing) {
        existing.rows.push(rowRecord);
        existing.rowCount += 1;
        continue;
      }

      sectionMap.set(key, {
        id: key,
        prefix: rowRecord.devicePrefix,
        bundleName,
        toLocation: rowRecord.toLocation,
        rowCount: 1,
        rows: [rowRecord],
      });
    }
  }

  const sections = Array.from(sectionMap.values()).sort((left, right) => {
    const prefixCompare = left.prefix.localeCompare(right.prefix, undefined, { numeric: true });
    if (prefixCompare !== 0) return prefixCompare;

    const bundleCompare = left.bundleName.localeCompare(right.bundleName, undefined, { numeric: true });
    if (bundleCompare !== 0) return bundleCompare;

    return left.toLocation.localeCompare(right.toLocation, undefined, { numeric: true });
  });

  return {
    totalRows: rows.length,
    sections,
    rows,
  };
}
