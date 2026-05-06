/**
 * Main hook for gathering device details.
 */

import { useMemo } from "react";
import type {
  DeviceDetails,
  TerminationRecord,
} from "@/lib/device-details/types";
import {
  collectDeviceTerminations,
  resolveDeviceDetails,
} from "@/lib/device-details/utils";
import type { SemanticWireListRow, ParsedSheetRow } from "@/lib/workbook/types";

interface UseDeviceDetailsProps {
  deviceIdStr: string | null;
  semanticRows: SemanticWireListRow[];
  partListSheet?: { rows: ParsedSheetRow[] } | null;
}

/**
 * Main hook to load device details: part info + terminations.
 *
 * Usage:
 *   const device = useDeviceDetails({
 *     deviceIdStr: "AF0123:13",
 *     semanticRows: wireListRows,
 *     partListSheet: projectData.partListSheet,
 *   });
 */
export function useDeviceDetails({
  deviceIdStr,
  semanticRows,
  partListSheet,
}: UseDeviceDetailsProps): DeviceDetails | null {
  return useMemo(() => {
    if (!deviceIdStr) {
      return null;
    }

    return resolveDeviceDetails(deviceIdStr, semanticRows, partListSheet);
  }, [deviceIdStr, semanticRows, partListSheet]);
}

/**
 * Hook to collect terminations for a device.
 * Separated out for cases where you only need terminations.
 */
export function useDeviceTerminations(
  baseDeviceId: string,
  semanticRows: SemanticWireListRow[]
): TerminationRecord[] {
  return useMemo(() => {
    if (!baseDeviceId || !semanticRows || semanticRows.length === 0) {
      return [];
    }
    return collectDeviceTerminations(baseDeviceId, semanticRows);
  }, [baseDeviceId, semanticRows]);
}
