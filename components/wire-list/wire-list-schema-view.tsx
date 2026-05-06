"use client";

import { useMemo } from "react";

import { SemanticWireList } from "@/components/wire-list/semantic-wire-list";
import type { WireListPrintSchema } from "@/lib/wire-list-print/schema";
import type { SemanticWireListRow } from "@/lib/workbook/types";

interface WireListSchemaViewProps {
  schema: WireListPrintSchema;
  projectId: string;
  sheetSlug: string;
  title: string;
  swsType?: {
    id: string;
    label: string;
    shortLabel: string;
    color?: string;
  };
}

export function WireListSchemaView({
  schema,
  projectId,
  sheetSlug,
  title,
  swsType,
}: WireListSchemaViewProps) {
  const rows = useMemo<SemanticWireListRow[]>(() => {
    return schema.pages
      .filter((page) => page.pageType === "wire-list")
      .flatMap((page) => page.locationGroups)
      .flatMap((group) => group.subsections)
      .flatMap((subsection) => subsection.rows)
      .map((row, index) => ({
        __rowIndex: row.rowIndex ?? index,
        __rowId: row.rowId,
        fromDeviceId: row.fromDeviceId,
        wireType: row.wireType,
        wireNo: row.wireNo,
        wireId: row.wireId,
        gaugeSize: row.gaugeSize,
        fromLocation: row.fromLocation,
        fromPageZone: row.fromPageZone,
        toDeviceId: row.toDeviceId,
        toLocation: row.toLocation,
        toPageZone: row.toPageZone,
      }));
  }, [schema]);

  return (
    <SemanticWireList
      rows={rows}
      title={title}
      currentSheetName={title}
      projectId={projectId}
      sheetSlug={sheetSlug}
      featureConfig={{
        showCheckboxColumns: false,
        showFromCheckbox: false,
        showToCheckbox: false,
        showIPVCheckbox: false,
        showComments: false,
        groupByLocation: true,
        groupByFromDevice: true,
        showDeviceGroupHeader: true,
        stickyGroupHeaders: true,
        showPartNumber: false,
      }}
      swsType={swsType}
      showFloatingToolbar={false}
    />
  );
}
